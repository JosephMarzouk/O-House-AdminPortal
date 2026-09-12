import { createClient } from '@/lib/supabase/server';
import type { Assignment, AssignmentItem, EffectiveStatus } from '@/lib/types/database';

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
  limit?: number;
};

/**
 * Supabase caps a Data API response at 1000 rows, so an unbounded select
 * silently truncates and every figure computed from it is wrong with no error.
 * Ask for a bounded page deliberately and return `total` from an exact count
 * so callers can say "200 of 1240" instead of quietly lying.
 *
 * 200 also keeps itemCountsFor() viable: it puts every id in the query string,
 * which is ~45 bytes per UUID once percent-encoded, and a few hundred rows is
 * enough URL for a gateway to reject the request outright.
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
  if (f.inspectorId) q = q.eq('inspector_id', f.inspectorId);
  if (f.from) q = q.gte('scheduled_date', f.from);
  if (f.to) q = q.lte('scheduled_date', f.to);

  const { data, error, count } = await q;
  if (error) throw new Error(`listAssignments: ${error.message}`);
  return { rows: data ?? [], total: count ?? data?.length ?? 0 };
}

export type ItemCounts = { total: number; done: number };

/**
 * done/total per assignment, in one round trip rather than N+1.
 * The list needs progress on every row, and the app shows the same figure.
 */
export async function itemCountsFor(ids: string[]): Promise<Map<string, ItemCounts>> {
  const counts = new Map<string, ItemCounts>();
  if (ids.length === 0) return counts;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignment_items')
    .select('assignment_id, status')
    .in('assignment_id', ids);

  if (error) throw new Error(`itemCountsFor: ${error.message}`);

  for (const row of data ?? []) {
    const c = counts.get(row.assignment_id) ?? { total: 0, done: 0 };
    c.total += 1;
    if (row.status === 'done') c.done += 1;
    counts.set(row.assignment_id, c);
  }
  return counts;
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
