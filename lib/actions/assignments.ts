'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { templateItems } from '@/lib/template-items';
import type { TemplateItem } from '@/lib/types/database';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';

/**
 * Every write goes through a SECURITY DEFINER RPC. This is not a style
 * choice: `submissions` has NO RLS UPDATE policy and `assignment_items` has
 * no INSERT/UPDATE/DELETE policy at all, so a direct .update() would silently
 * affect zero rows rather than erroring.
 */

export type { ActionResult };

/** The RPCs raise plain Postgres exceptions. This one is worth its own
 *  message; the rest go through the shared mapper, which ends at
 *  'error_generic' rather than handing the driver's string to the browser. */
function friendly(message: string): string {
  if (/New deadline must be in the future/i.test(message)) return 'deadline_must_be_future';
  if (/INVALID_END_DATE/.test(message)) return 'invalid_end_date';
  return toErrorCode(message);
}

export type NewAssignmentInput = {
  templateId: string; // the place
  siteId: string; // its twin in `sites` — what the phone actually renders
  /** One or more. With several, the first to act on the phone owns the task. */
  assigneeIds: string[];
  titleAr: string;
  titleEn: string;
  scheduledDate: string; // YYYY-MM-DD
  /** The last day, for a task that runs over several days. Absent = one day. */
  endDate?: string; // YYYY-MM-DD
  windowStart: string; // HH:MM
  windowEnd: string; // HH:MM
  items: TemplateItem[];
  /** Optional instructions shown to the assignee on the task. */
  taskNote?: string;
};

/**
 * create_assignment has NO defaults on the date or either window bound — every
 * assignment must be scheduled. That is also what makes assignments_v.deadline
 * and effective_status compute at all; both go NULL without them.
 *
 * p_items becomes assignment_items, with sort_order taken from array position.
 * It goes through templateItems(), the same whitelist savePlace uses: that
 * keeps each item's id (it lands in assignment_items.template_item_id, so the
 * row links back to the place's subtask — it used to be replaced with a fresh
 * uuid, which linked to nothing), gives new items a real one, and drops a
 * `correct` rule that does not fit its item's type.
 */
export async function createAssignment(
  input: NewAssignmentInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (
    !input.templateId ||
    !input.siteId ||
    input.assigneeIds.length === 0 ||
    !input.scheduledDate ||
    !input.windowStart ||
    !input.windowEnd ||
    !(input.titleAr.trim() || input.titleEn.trim())
  ) {
    return { ok: false, error: 'fields_required' };
  }
  if (input.items.length === 0) return { ok: false, error: 'need_at_least_one_subtask' };
  if (input.endDate && input.endDate < input.scheduledDate) {
    return { ok: false, error: 'invalid_end_date' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_assignment', {
    p_title_ar: input.titleAr.trim(),
    p_title_en: input.titleEn.trim(),
    p_site_id: input.siteId,
    p_assignee_ids: input.assigneeIds,
    p_scheduled_date: input.scheduledDate,
    ...(input.endDate ? { p_end_date: input.endDate } : {}),
    p_window_start: input.windowStart,
    p_window_end: input.windowEnd,
    p_items: templateItems(input.items),
    p_source_template_id: input.templateId,
    p_client_id: crypto.randomUUID(), // idempotency key for a retried submit
    // Omitted rather than sent empty: the RPC also turns '' into NULL, but an
    // absent key is what a pre-notes database would accept too.
    ...(input.taskNote?.trim() ? { p_task_note: input.taskNote.trim() } : {}),
  });

  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath('/assignments');
  return { ok: true, id: data as unknown as string };
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
  revalidatePath('/tracker');
  return { ok: true };
}

/** The reason is optional (notes migration): reject_items stores a blank one as NULL. */
export async function rejectItems(
  id: string,
  itemIds: string[],
  reason?: string,
): Promise<ActionResult> {
  if (itemIds.length === 0) return { ok: false, error: 'no_items_selected' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_items', {
    p_assignment_id: id,
    p_item_ids: itemIds,
    ...(reason?.trim() ? { p_reason: reason.trim() } : {}),
  });
  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath('/assignments');
  revalidatePath(`/assignments/${id}`);
  revalidatePath('/tracker');
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
  revalidatePath('/tracker');
  return { ok: true };
}
