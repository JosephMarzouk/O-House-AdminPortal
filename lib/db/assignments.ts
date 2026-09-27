import { createClient } from '@/lib/supabase/server';
import { ilikePattern } from '@/lib/search';
import type {
  Assignment,
  AssignmentItem,
  EffectiveStatus,
  SubmissionEventRow,
} from '@/lib/types/database';

/**
 * Reads go through assignments_v, never `submissions` — the view is the only
 * place `effective_status` and `deadline` are computed, and a row past its
 * window still reports status='pending' in the base table.
 *
 * The view now has security_invoker=on, so RLS applies: an admin sees
 * everything, a manager sees only profiles whose manager_id is theirs.
 */

export type AssignmentWithItems = Assignment & { items: AssignmentItem[] };

export const EFFECTIVE_STATUSES = [
  'pending',
  'in_progress',
  'follow_up',
  'submitted',
  'approved',
  'rejected',
  'expired',
] as const;

/**
 * A search param is `string | string[] | undefined` and arrives from the URL,
 * so it is validated here rather than passed to .eq() raw: an unrecognised
 * value would not error, it would quietly match no rows and read as "empty".
 */
export function parseStatus(v: string | string[] | undefined): EffectiveStatus | undefined {
  return typeof v === 'string' && (EFFECTIVE_STATUSES as readonly string[]).includes(v)
    ? (v as EffectiveStatus)
    : undefined;
}

/** A plain `?id=` param, narrowed to a single string. */
export function parseOne(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export type AssignmentFilters = {
  status?: EffectiveStatus;
  /** Everything except this status — the "not awaiting review" half of the list. */
  notStatus?: EffectiveStatus;
  siteId?: string;
  inspectorId?: string;
  /** Inclusive YYYY-MM-DD against scheduled_date, in Africa/Cairo. */
  from?: string;
  to?: string;
  /** Free text: title, place or assignee name, EN or AR. */
  search?: string;
  limit?: number;
};

/**
 * Supabase caps a Data API response at 1000 rows, so an unbounded select
 * silently truncates and every figure computed from it is wrong with no error.
 * Ask for a bounded page deliberately and return `total` from an exact count
 * so callers can say "200 of 1240" instead of quietly lying.
 *
 * (itemCountsFor() used to be the other reason for keeping this small — it puts
 * every id in the query string — but it now sends them in slices.)
 */
const DEFAULT_LIMIT = 200;

/** Newest scheduled first. Postgres DESC defaults to NULLS FIRST, which would
 *  float unscheduled rows to the top with a blank date — hence nullsFirst. */
export async function listAssignments(
  f: AssignmentFilters = {},
): Promise<{ rows: Assignment[]; total: number }> {
  const supabase = await createClient();
  let q = supabase
    .from('assignments_v')
    .select('*', { count: 'exact' })
    .order('scheduled_date', { ascending: false, nullsFirst: false })
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .range(0, (f.limit ?? DEFAULT_LIMIT) - 1);

  if (f.status) q = q.eq('effective_status', f.status);
  // neq alone would also drop rows whose effective_status is null, hiding them
  // from both halves of the list rather than putting them in this one.
  if (f.notStatus) q = q.or(`effective_status.neq.${f.notStatus},effective_status.is.null`);
  if (f.siteId) q = q.eq('site_id', f.siteId);
  // Any task given to that person, claimed or not. The owner is always one of
  // the assignees, so this also covers the tasks they own.
  if (f.inspectorId) q = q.contains('assignee_ids', [f.inspectorId]);
  if (f.from) q = q.gte('scheduled_date', f.from);
  if (f.to) q = q.lte('scheduled_date', f.to);
  // In the database, not over the page: the list is capped at DEFAULT_LIMIT,
  // so filtering what came back would miss everything past row 200.
  const p = ilikePattern(f.search);
  if (p) {
    q = q.or(
      ['title_en', 'title_ar', 'site_name_en', 'site_name_ar', 'inspector_name']
        .map((c) => `${c}.ilike.${p}`)
        .join(','),
    );
  }

  const { data, error, count } = await q;
  if (error) throw new Error(`listAssignments: ${error.message}`);
  return { rows: data ?? [], total: count ?? data?.length ?? 0 };
}

export type ItemCounts = { total: number; done: number; followUp: number };

/**
 * `.in()` puts every id in the query string — ~45 bytes per UUID once
 * percent-encoded — so a long list is sent in slices a gateway will accept.
 * 100 ids is ~4.5KB of URL; the board can hold several hundred tasks.
 */
const IN_CHUNK = 100;

function chunks<T>(xs: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/**
 * done/total per assignment, plus how many items are waiting on a follow-up,
 * in one round trip per slice rather than N+1. The list and the board need
 * progress on every row, and the app shows the same figure.
 */
export async function itemCountsFor(ids: string[]): Promise<Map<string, ItemCounts>> {
  const counts = new Map<string, ItemCounts>();
  if (ids.length === 0) return counts;

  const supabase = await createClient();
  const pages = await Promise.all(
    chunks(ids).map((slice) =>
      supabase.from('assignment_items').select('assignment_id, status').in('assignment_id', slice),
    ),
  );

  for (const { data, error } of pages) {
    if (error) throw new Error(`itemCountsFor: ${error.message}`);
    for (const row of data ?? []) {
      const c = counts.get(row.assignment_id) ?? { total: 0, done: 0, followUp: 0 };
      c.total += 1;
      if (row.status === 'done') c.done += 1;
      if (row.status === 'follow_up') c.followUp += 1;
      counts.set(row.assignment_id, c);
    }
  }
  return counts;
}

/** An item as the reject dialog lists it. */
export type ReviewItem = { id: string; text_ar: string; text_en: string };

/**
 * The checklist items of the given assignments, keyed by assignment — what
 * the board's "send back" dialog offers for rejection. Only asked for the
 * cards that can actually be sent back (In Review), so it stays small.
 */
export async function reviewItemsFor(ids: string[]): Promise<Map<string, ReviewItem[]>> {
  const byTask = new Map<string, ReviewItem[]>();
  if (ids.length === 0) return byTask;

  const supabase = await createClient();
  const pages = await Promise.all(
    chunks(ids).map((slice) =>
      supabase
        .from('assignment_items')
        .select('id, assignment_id, text_ar, text_en')
        .in('assignment_id', slice)
        .order('sort_order'),
    ),
  );

  for (const { data, error } of pages) {
    if (error) throw new Error(`reviewItemsFor: ${error.message}`);
    for (const { assignment_id, ...item } of data ?? []) {
      byTask.set(assignment_id, [...(byTask.get(assignment_id) ?? []), item]);
    }
  }
  return byTask;
}

/**
 * Whole checklist items of the given tasks, in order, keyed by task — what
 * the daily report prints under each task.
 */
export async function itemsFor(ids: string[]): Promise<Map<string, AssignmentItem[]>> {
  const byTask = new Map<string, AssignmentItem[]>();
  if (ids.length === 0) return byTask;

  const supabase = await createClient();
  const pages = await Promise.all(
    chunks(ids).map((slice) =>
      supabase.from('assignment_items').select('*').in('assignment_id', slice).order('sort_order'),
    ),
  );

  for (const { data, error } of pages) {
    if (error) throw new Error(`itemsFor: ${error.message}`);
    for (const item of data ?? []) {
      byTask.set(item.assignment_id, [...(byTask.get(item.assignment_id) ?? []), item]);
    }
  }
  return byTask;
}

/**
 * Every task whose period includes `day`: scheduled on it, or a multi-day
 * task running through it. RLS scopes it — a manager gets their reports'.
 *
 * `day` MUST come through parseDay() (lib/format.ts): it is interpolated.
 */
export async function listTasksOnDay(day: string): Promise<{ rows: Assignment[]; total: number }> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from('assignments_v')
    .select('*', { count: 'exact' })
    .lte('scheduled_date', day)
    .or(`end_date.gte.${day},and(end_date.is.null,scheduled_date.eq.${day})`)
    .order('window_start', { ascending: true, nullsFirst: false })
    .order('title_en')
    // ponytail: one department's day is tens of tasks; past this the report
    // says "n of total" rather than paging.
    .range(0, TRACKER_LIMIT - 1);

  if (error) throw new Error(`listTasksOnDay: ${error.message}`);
  return { rows: data ?? [], total: count ?? data?.length ?? 0 };
}

/**
 * Each task's status history, oldest first, keyed by task. RLS lets a caller
 * see the history of exactly the tasks they can see.
 */
export async function eventsFor(ids: string[]): Promise<Map<string, SubmissionEventRow[]>> {
  const byTask = new Map<string, SubmissionEventRow[]>();
  if (ids.length === 0) return byTask;

  const supabase = await createClient();
  const pages = await Promise.all(
    chunks(ids).map((slice) =>
      supabase
        .from('submission_events')
        .select('*')
        .in('submission_id', slice)
        .order('at')
        .order('id'),
    ),
  );

  for (const { data, error } of pages) {
    if (error) throw new Error(`eventsFor: ${error.message}`);
    for (const e of data ?? []) {
      byTask.set(e.submission_id, [...(byTask.get(e.submission_id) ?? []), e]);
    }
  }
  return byTask;
}

/** The board's page size. A busy day is ~100 tasks; this is the safety net. */
const TRACKER_LIMIT = 500;

/**
 * Everything the task tracker shows for one Cairo day: the tasks scheduled on
 * it, plus open work carried over from earlier days — a follow-up waiting on
 * a fix, or a submission waiting on review — which would otherwise vanish
 * from the board the morning after it happened.
 *
 * Legacy rows (the old web client's, with no scheduled_date) never match
 * either branch, which is what keeps them off the board.
 *
 * `day` MUST come through parseDay() (lib/format.ts): it is interpolated into
 * the filter.
 */
export async function listTrackerTasks(
  day: string,
): Promise<{ rows: Assignment[]; total: number }> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from('assignments_v')
    .select('*', { count: 'exact' })
    .or(
      // on the day · a multi-day task running through it · carried-over open work
      `scheduled_date.eq.${day},and(scheduled_date.lt.${day},end_date.gte.${day}),and(scheduled_date.lt.${day},effective_status.in.(follow_up,submitted))`,
    )
    .order('scheduled_date', { ascending: true })
    .order('window_start', { ascending: true, nullsFirst: false })
    .range(0, TRACKER_LIMIT - 1);

  if (error) throw new Error(`listTrackerTasks: ${error.message}`);
  return { rows: data ?? [], total: count ?? data?.length ?? 0 };
}

export async function getAssignment(id: string): Promise<AssignmentWithItems | null> {
  const supabase = await createClient();

  const [{ data: row, error }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from('assignments_v').select('*').eq('id', id).maybeSingle(),
    supabase.from('assignment_items').select('*').eq('assignment_id', id).order('sort_order'),
  ]);

  if (error) throw new Error(`getAssignment: ${error.message}`);
  if (itemsError) throw new Error(`getAssignment items: ${itemsError.message}`);
  if (!row) return null;

  return { ...row, items: items ?? [] };
}

/**
 * Counts by effective_status, for the dashboard.
 *
 * Counted in the database, not over a fetched array: a row-counting version
 * can only ever see the (capped) page it was handed, so it would under-report
 * without saying so. `head: true` sends a HEAD request — the count comes back
 * in the Content-Range header and no row crosses the wire, so this stays exact
 * however large the table grows. RLS still applies, so a manager gets their own
 * reports' counts.
 */
export async function countByStatus(): Promise<Record<EffectiveStatus, number>> {
  const supabase = await createClient();
  const entries = await Promise.all(
    EFFECTIVE_STATUSES.map(async (s) => {
      const { count, error } = await supabase
        .from('assignments_v')
        .select('id', { count: 'exact', head: true })
        .eq('effective_status', s);
      if (error) throw new Error(`countByStatus(${s}): ${error.message}`);
      return [s, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<EffectiveStatus, number>;
}

export function doneCount(items: AssignmentItem[]): number {
  return items.filter((i) => i.status === 'done').length;
}

/** Terminal for review purposes: nothing more will arrive from the phone. */
export function isReviewable(status: EffectiveStatus | null): boolean {
  return status === 'submitted';
}
