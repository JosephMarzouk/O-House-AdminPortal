'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';
import { can, getProfile } from '@/lib/auth';
import { parseLocation } from '@/lib/club-location';
import { parseEmails } from '@/lib/report';
import { isUuid } from '@/lib/rounds';
import { REPORT_MAIL_FREQUENCIES, type ClubPageKey, type ReportMailFrequency } from '@/lib/types/database';

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

/**
 * The report emails: how often, the club mailbox they are sent from (one
 * per club, whoever is signed in), and each department's addresses as typed
 * (one textarea each, keyed by department id, plus 'all': one email with
 * every department, e.g. the general manager). set_report_mail() is the
 * guard (club_settings.edit + reports.view) and replaces the whole list.
 */
export async function saveReportMail(
  frequency: ReportMailFrequency,
  sender: string,
  recipients: Record<string, string>,
): Promise<ActionResult> {
  if (!can(await getProfile(), 'club_settings.edit')) return { ok: false, error: 'not_authorized' };
  if (!REPORT_MAIL_FREQUENCIES.includes(frequency)) return { ok: false, error: 'error_generic' };
  const from = parseEmails(String(sender ?? ''));
  if (from.bad || from.emails.length > 1) return { ok: false, error: 'email_invalid' };
  if (frequency !== 'off' && from.emails.length === 0) return { ok: false, error: 'sender_required' };
  const lists: Record<string, string[]> = {};
  for (const [dept, text] of Object.entries(recipients ?? {})) {
    if (dept !== 'all' && !isUuid(dept)) return { ok: false, error: 'error_generic' };
    const { emails, bad } = parseEmails(String(text));
    if (bad) return { ok: false, error: 'email_invalid' };
    if (emails.length) lists[dept] = emails;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_report_mail', {
    p_frequency: frequency,
    p_sender: from.emails[0] ?? '',
    p_recipients: lists,
  });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/club-settings');
  return { ok: true };
}
