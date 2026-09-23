'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';
import type { ClubPageKey } from '@/lib/types/database';

/**
 * set_club_page() is the whole guard: it refuses anyone but an admin, and the
 * table has no write grant at all. The page hiding itself from other roles is
 * only a courtesy, since a Server Action is reachable by POST.
 */
export async function saveClubPage(
  key: ClubPageKey,
  bodyEn: string,
  bodyAr: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_club_page', {
    p_key: key,
    p_body_en: bodyEn,
    p_body_ar: bodyAr,
  });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/club-pages');
  return { ok: true };
}
