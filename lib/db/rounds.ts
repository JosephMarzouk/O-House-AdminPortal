import { createClient } from '@/lib/supabase/server';
import type { Round, RoundTemplate } from '@/lib/types/database';

/**
 * Zone rounds (0013). A round template is an ordered list of places with a
 * window each; a round is one template on one day for one person, and owns
 * the per-place tasks schedule_rounds() created for it (submissions.round_id).
 *
 * Every signed-in user may read round_templates (the app shows their names);
 * rounds are readable by portal roles, and by staff for rounds they hold a
 * task in. Writes: templates directly under RLS (admin/manager), rounds only
 * through schedule_rounds().
 */

export async function listRoundTemplates(): Promise<RoundTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('round_templates')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listRoundTemplates: ${error.message}`);
  return data ?? [];
}

export async function getRoundTemplate(id: string): Promise<RoundTemplate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('round_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getRoundTemplate: ${error.message}`);
  return data;
}

/**
 * Rounds scheduled between two Cairo days, inclusive. Ordered, because the
 * planner remounts on a key built from these rows: an unordered read could
 * return the same plan in a different order and throw away unsaved edits.
 */
export async function listRounds(from: string, to: string): Promise<Round[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .gte('scheduled_date', from)
    .lte('scheduled_date', to)
    .order('scheduled_date')
    .order('round_template_id');
  if (error) throw new Error(`listRounds: ${error.message}`);
  return data ?? [];
}

/**
 * The rounds, among those given, where at least one task has been started —
 * anything past 'pending' in the base table. The planner marks those cells:
 * reassigning such a round moves only its untouched places, and unassigning it
 * keeps the started ones, so the admin should know before pressing Save.
 */
export async function startedRoundIds(roundIds: string[]): Promise<Set<string>> {
  const started = new Set<string>();
  if (roundIds.length === 0) return started;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignments_v')
    .select('round_id')
    .in('round_id', roundIds)
    .neq('status', 'pending');
  if (error) throw new Error(`startedRoundIds: ${error.message}`);
  for (const row of data ?? []) if (row.round_id) started.add(row.round_id);
  return started;
}
