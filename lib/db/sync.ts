import { createClient } from '@/lib/supabase/server';
import type { SyncRefusal } from '@/lib/types/database';

/**
 * What phones could not send (SY-10). RLS narrows it exactly like rounds: an
 * admin sees everyone's, a manager their reports', staff their own.
 */
export type RefusalRow = SyncRefusal & {
  staff: string | null;
  round: { title_en: string | null; title_ar: string | null } | null;
};

const RECENT = 50;

export async function listRefusals(opts: { assignmentId?: string } = {}): Promise<RefusalRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from('sync_refusals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(RECENT);
  if (opts.assignmentId) q = q.eq('assignment_id', opts.assignmentId);
  const { data, error } = await q;
  if (error) throw new Error(`listRefusals: ${error.message}`);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Names and titles in two reads rather than a join: sync_refusals has no
  // foreign keys on purpose (a planner delete must not erase the record), so
  // PostgREST has no relationship to embed. A deleted round simply shows none.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const roundIds = [...new Set(rows.map((r) => r.assignment_id).filter((v): v is string => !!v))];
  const [people, rounds] = await Promise.all([
    supabase.from('profiles').select('id, name').in('id', userIds),
    roundIds.length
      ? supabase.from('assignments_v').select('id, title_en, title_ar').in('id', roundIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (people.error) throw new Error(`listRefusals profiles: ${people.error.message}`);
  if (rounds.error) throw new Error(`listRefusals rounds: ${rounds.error.message}`);

  const name = new Map((people.data ?? []).map((p) => [p.id, p.name]));
  const round = new Map((rounds.data ?? []).map((r) => [r.id, r]));
  return rows.map((r) => ({
    ...r,
    staff: name.get(r.user_id) ?? null,
    round: (r.assignment_id && round.get(r.assignment_id)) || null,
  }));
}
