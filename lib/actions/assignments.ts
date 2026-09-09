'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Every write goes through a SECURITY DEFINER RPC. This is not a style
 * choice: `submissions` has NO RLS UPDATE policy and `assignment_items` has
 * no INSERT/UPDATE/DELETE policy at all, so a direct .update() would silently
 * affect zero rows rather than erroring.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

/** The RPCs raise plain Postgres exceptions. Map the ones a user can cause;
 *  let anything else through rather than swallowing it into "went wrong". */
function friendly(message: string): string {
  if (/Only admins/i.test(message)) return 'not_authorized';
  if (/New deadline must be in the future/i.test(message)) return 'deadline_must_be_future';
  if (/permission denied/i.test(message)) return 'not_authorized';
  return message;
}

export async function approveAssignment(id: string, score?: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_assignment', {
    p_assignment_id: id,
    ...(score === undefined ? {} : { p_score: score }),
  });
  if (error) return { ok: false, error: friendly(error.message) };

  // approve_assignment filters on `status = 'submitted'` and no-ops silently
  // otherwise, so a clean return does not prove anything changed. Re-read.
  const { data } = await supabase
    .from('assignments_v')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (data?.status !== 'approved') return { ok: false, error: 'not_in_submitted_state' };

  revalidatePath('/assignments');
  revalidatePath(`/assignments/${id}`);
  return { ok: true };
}

export async function rejectItems(
  id: string,
  itemIds: string[],
  reason: string,
): Promise<ActionResult> {
  if (itemIds.length === 0) return { ok: false, error: 'no_items_selected' };
  if (!reason.trim()) return { ok: false, error: 'reason_required' }; // p_reason has no default

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_items', {
    p_assignment_id: id,
    p_item_ids: itemIds,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath('/assignments');
  revalidatePath(`/assignments/${id}`);
  return { ok: true };
}

export async function extendAssignment(
  id: string,
  newDeadlineIso: string,
  note?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('extend_assignment', {
    p_assignment_id: id,
    p_new_deadline: newDeadlineIso,
    ...(note ? { p_note: note } : {}),
  });
  if (error) return { ok: false, error: friendly(error.message) };

  // Also filtered — `where status not in ('submitted','approved')` — so a
  // closed round returns success having changed nothing.
  const { data } = await supabase
    .from('assignments_v')
    .select('extended_until')
    .eq('id', id)
    .maybeSingle();
  if (!data?.extended_until) return { ok: false, error: 'already_closed' };

  revalidatePath('/assignments');
  revalidatePath(`/assignments/${id}`);
  return { ok: true };
}
