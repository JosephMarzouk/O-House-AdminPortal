import type { Locale } from '@/lib/i18n/dictionaries';

/**
 * The club runs on one clock. Every date the portal shows is pinned to
 * Africa/Cairo, matching template_claims.claim_date's default and the
 * AT TIME ZONE in assignments_v.deadline — otherwise a manager abroad sees
 * a different "today" than the database enforces.
 */
export const CLUB_TZ = 'Africa/Cairo';

const localeTag = (l: Locale) => (l === 'ar' ? 'ar-EG' : 'en-GB');

/** "8 Sep 2026" — day-level, for scheduled_date and due dates. */
export function fmtDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(localeTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: CLUB_TZ,
  });
}

/** "8 Sep 2026, 14:50" — for submitted_at and deadlines, where time matters. */
export function fmtDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(localeTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: CLUB_TZ,
  });
}

/**
 * "07:00 – 11:00". Postgres returns `time` as "HH:MM:SS"; the app slices to
 * 5 chars and so do we. Both ends must be present or there is no window —
 * the same both-or-neither rule template_window_open() enforces.
 */
export function fmtWindow(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

/** Today in the club's timezone, as YYYY-MM-DD. en-CA is the trick that
 *  yields ISO ordering. Matches todayCairoDateStr() in the old portal. */
export function todayInCairo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLUB_TZ }).format(new Date());
}
