import { countByStatus, listAssignments } from '@/lib/db/assignments';
import { listDepartments } from '@/lib/db/places';
import { listProfiles } from '@/lib/db/users';
import { todayInCairo } from '@/lib/format';
import { bilingual, type Locale } from '@/lib/i18n/dictionaries';
import type { Assignment, EffectiveStatus } from '@/lib/types/database';

export const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export type Named = { label: string; value: number };

export type UserRow = {
  id: string;
  name: string;
  dept: string;
  total: number;
  review: number;
  approved: number;
  rejected: number;
  late: number;
};

export type DashboardData = {
  counts: Record<EffectiveStatus, number>;
  totalAll: number;
  /** Percentages, or null when there is nothing to divide by. */
  onTimeRate: number | null;
  rejectionRate: number | null;
  extended: number;
  trend: Array<{ label: string; onTime: number; late: number }>;
  places: Named[];
  departments: Named[];
  users: UserRow[];
};

/**
 * Was this assignment delivered by its deadline?
 *
 * `deadline` on the view is COALESCE(extended_until, scheduled_date + window),
 * so one that was extended and then met the new date counts as on time. That
 * is deliberate — the extension moved the deadline — and the number of
 * extensions is reported separately rather than folded in here.
 *
 * Anything still unsubmitted past its deadline surfaces as `expired`, which is
 * late by definition.
 */
export function isLate(a: Assignment): boolean {
  if (a.effective_status === 'expired') return true;
  if (!a.submitted_at || !a.deadline) return false;
  return new Date(a.submitted_at) > new Date(a.deadline);
}

export function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/**
 * The days of the window as Cairo YYYY-MM-DD keys, oldest first.
 *
 * Stepped from a UTC-noon anchor rather than from `now`: 24h hops from midday
 * never straddle a DST change, so no Cairo day is skipped or emitted twice.
 * Seeding the whole range matters — grouping the rows alone would omit quiet
 * days entirely and draw a line that overstates a lull.
 */
export function windowDays(now: Date, days = WINDOW_DAYS): string[] {
  // Anchor at midday UTC on *Cairo's* current date, not on `now`. Anchoring
  // to UTC noon of `now` drops a day whenever UTC is late evening and Cairo
  // has already rolled over — the window would then end yesterday and quietly
  // bucket nothing for today. Midday keeps every 24h step far from midnight,
  // so a DST change cannot duplicate or skip a day either.
  const anchor = new Date(`${todayInCairo(now)}T12:00:00Z`);
  return Array.from({ length: days }, (_, i) =>
    todayInCairo(new Date(anchor.getTime() - (days - 1 - i) * DAY_MS)),
  );
}

/** Everything the dashboard renders, fetched and aggregated in one place.
 *  Kept out of the page component so the clock is read behind an async
 *  boundary rather than in a render body, and so the arithmetic is reachable
 *  from a test without a React tree. */
export async function getDashboardData(locale: Locale, fallbackLabel: string): Promise<DashboardData> {
  const now = new Date();
  const days = windowDays(now);
  const from = days[0];

  const [counts, { rows }, profiles, departments] = await Promise.all([
    // Counted in the database, so the tiles stay exact however many rows
    // exist — unlike anything derived from the windowed page below.
    countByStatus(),
    listAssignments({ from, limit: 1000 }),
    listProfiles(),
    listDepartments(),
  ]);

  const totalAll = Object.values(counts).reduce((sum, v) => sum + v, 0);
  const submitted = rows.filter((a) => a.submitted_at);
  const onTimeRate = pct(submitted.filter((a) => !isLate(a)).length, submitted.length);
  const rejectionRate = pct(counts.rejected, counts.approved + counts.rejected);
  const extended = rows.filter((a) => a.was_extended).length;

  const byDay = new Map(days.map((d) => [d, { onTime: 0, late: 0 }]));
  for (const a of rows) {
    if (!a.submitted_at) continue;
    const bucket = byDay.get(todayInCairo(new Date(a.submitted_at)));
    if (!bucket) continue;
    if (isLate(a)) bucket.late += 1;
    else bucket.onTime += 1;
  }
  const trend = days.map((d) => ({
    // Bare "DD/MM": a fully localised date would mix Arabic-Indic digits with
    // Latin separators inside the chart's LTR subtree and reorder badly.
    label: `${d.slice(8)}/${d.slice(5, 7)}`,
    ...byDay.get(d)!,
  }));

  const tally = (key: (a: Assignment) => string): Named[] => {
    const m = new Map<string, number>();
    for (const a of rows) {
      const k = key(a);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m]
      .map(([label, value]) => ({ label, value }))
      .sort((x, y) => y.value - x.value);
  };

  // assignments_v carries no department_id, so it is joined here through the
  // assignee. (The other route — the place's department — can disagree; this
  // one answers "how is each team doing", which is what the page is for.)
  const deptOfUser = new Map(profiles.map((p) => [p.id, p.department_id]));
  const deptName = new Map(departments.map((d) => [d.id, bilingual(locale, d.name_ar, d.name_en)]));
  const deptOf = (a: Assignment) => {
    const id = a.inspector_id ? deptOfUser.get(a.inspector_id) : null;
    return (id && deptName.get(id)) || fallbackLabel;
  };

  const places = tally(
    (a) => bilingual(locale, a.site_name_ar, a.site_name_en) || fallbackLabel,
  ).slice(0, 8);

  const users = new Map<string, UserRow>();
  for (const a of rows) {
    if (!a.inspector_id) continue;
    const u = users.get(a.inspector_id) ?? {
      id: a.inspector_id,
      name: a.inspector_name || fallbackLabel,
      dept: deptOf(a),
      total: 0,
      review: 0,
      approved: 0,
      rejected: 0,
      late: 0,
    };
    u.total += 1;
    if (a.effective_status === 'submitted') u.review += 1;
    if (a.effective_status === 'approved') u.approved += 1;
    if (a.effective_status === 'rejected') u.rejected += 1;
    if (isLate(a)) u.late += 1;
    users.set(a.inspector_id, u);
  }

  return {
    counts,
    totalAll,
    onTimeRate,
    rejectionRate,
    extended,
    trend,
    places,
    departments: tally(deptOf),
    users: [...users.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
  };
}
