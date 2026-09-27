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

/** A task's day, or "23 Sep 2026 – 25 Sep 2026" when it runs over several. */
export function fmtPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: Locale,
): string {
  return end ? `${fmtDate(start, locale)} – ${fmtDate(end, locale)}` : fmtDate(start, locale);
}

/**
 * "Ahmed · Sara" — everyone a task was given to. Falls back to the owner's
 * name for a row the view could not name (a caller who may not read the
 * other profiles).
 */
export function assigneeNames(a: {
  assignee_names?: string[] | null;
  inspector_name?: string | null;
}): string {
  const names = (a.assignee_names ?? []).filter(Boolean);
  return names.length > 0 ? names.join(' · ') : (a.inspector_name ?? '');
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
 *  yields ISO ordering. Matches todayCairoDateStr() in the old portal.
 *
 *  Pass a Date to get that instant's Cairo day instead of today's — which is
 *  how the dashboard buckets rows. Doing it any other way is wrong:
 *  `new Date("2026-09-12")` is UTC midnight and `iso.slice(0, 10)` is
 *  UTC-truncated, so a late-evening-in-Cairo row lands on the previous day. */
export function todayInCairo(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLUB_TZ }).format(d);
}

const DAY_MS = 86_400_000;

/**
 * A calendar day `n` days from `ymd`, as YYYY-MM-DD.
 *
 * Stepped from UTC noon, like windowDays() in lib/dashboard.ts: 24-hour hops
 * from midday never cross a midnight, so no DST change can skip or repeat a
 * day. The input and output are calendar dates, not instants — no timezone
 * is involved at all.
 */
export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The Saturday that starts `ymd`'s week. Egypt's week runs Saturday to
 * Friday (CLDR's first day for EG), and that is how the club rosters — so the
 * planner's week does too, whatever the viewer's language.
 */
export function weekStart(ymd: string): string {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = Sunday … 6 = Saturday
  return addDays(ymd, -((dow + 1) % 7));
}

/** "Sat 19 Sep" — a planner column heading. Read in UTC because `ymd` is a
 *  calendar date, not an instant; any other zone could shift it a day. */
export function fmtWeekday(ymd: string, locale: Locale): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(localeTag(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * A `?date=` / `?week=` param as a real calendar day, or undefined.
 *
 * The tracker interpolates it into a PostgREST `.or()` filter string, so
 * anything but YYYY-MM-DD must be refused here — a comma or a parenthesis
 * would rewrite the filter rather than fail. The round trip through Date
 * catches 2026-02-31.
 */
export function parseDay(v: string | string[] | undefined): string | undefined {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : undefined;
}

/**
 * A count in the locale's own numerals. fmtDate/fmtDateTime use ar-EG, whose
 * default numbering system is arab (٠١٢٣); a chart axis left to its own
 * devices emits Latin digits, so the same screen would show both.
 */
export function fmtNum(n: number, locale: Locale): string {
  return n.toLocaleString(localeTag(locale));
}
