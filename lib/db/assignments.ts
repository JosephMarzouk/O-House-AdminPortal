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

/** Newest scheduled first. Postgres DESC defaults to NULLS FIRST, which would
 *  float unscheduled rows to the top with a blank date — hence nullsFirst. */
export async function listAssignments(): Promise<Assignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignments_v')
    .select('*')
    .order('scheduled_date', { ascending: false, nullsFirst: false })
    .order('submitted_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(`listAssignments: ${error.message}`);
  return data ?? [];
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

/** Counts by effective_status, for the overview. */
export function countByStatus(rows: Assignment[]): Record<EffectiveStatus, number> {
  const counts = {
    pending: 0,
    in_progress: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
  } as Record<EffectiveStatus, number>;

  for (const r of rows) {
    const s = r.effective_status;
    if (s && s in counts) counts[s] += 1;
  }
  return counts;
}

export function doneCount(items: AssignmentItem[]): number {
  return items.filter((i) => i.status === 'done').length;
}

/** Terminal for review purposes: nothing more will arrive from the phone. */
export function isReviewable(status: EffectiveStatus | null): boolean {
  return status === 'submitted';
}
