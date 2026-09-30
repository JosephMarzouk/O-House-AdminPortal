'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';
import { can, getProfile } from '@/lib/auth';
import { parseLocation } from '@/lib/club-location';
import type { ClubPageKey } from '@/lib/types/database';

/**
 * set_club_page() is the whole guard: it requires club_settings.edit, and the
 * table has no write grant at all. The check here only names the refusal,
 * since a Server Action is reachable by POST.
 */
export async function saveClubPage(
  key: ClubPageKey,
  bodyEn: string,
  bodyAr: string,
): Promise<ActionResult> {
  if (!can(await getProfile(), 'club_settings.edit')) return { ok: false, error: 'not_authorized' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_club_page', {
    p_key: key,
    p_body_en: bodyEn,
    p_body_ar: bodyAr,
  });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/club-settings');
  return { ok: true };
}

/**
 * Set once. set_club_location() refuses anyone but an admin, and refuses
 * again once a row exists (LOCATION_ALREADY_SET); support clears a wrong pin.
 * The input is checked here too, since a Server Action is reachable by POST.
 */
export async function setClubLocation(coords: string, radius: number): Promise<ActionResult> {
  // The Admin role, not a permission (set_club_location checks the same).
  const me = await getProfile();
  if (me?.access?.role.key !== 'admin') return { ok: false, error: 'not_authorized' };
  const zone = parseLocation(String(coords), Number(radius));
  if (!zone) return { ok: false, error: 'location_invalid' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_club_location', {
    p_lat: zone.lat,
    p_lng: zone.lng,
    p_radius_m: zone.radiusM,
  });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/club-settings');
  return { ok: true };
}
