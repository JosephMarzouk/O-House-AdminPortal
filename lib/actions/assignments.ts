'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { templateItems } from '@/lib/template-items';
import type { TaskGroupPlace, TemplateItem } from '@/lib/types/database';
import { isUuid, placeWindowOverlaps } from '@/lib/rounds';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';
import { can, getProfile } from '@/lib/auth';

/**
 * Every write goes through a SECURITY DEFINER RPC. This is not a style
 * choice: `submissions` has NO RLS UPDATE policy and `assignment_items` has
 * no INSERT/UPDATE/DELETE policy at all, so a direct .update() would silently
 * affect zero rows rather than erroring.
 *
 * Each action checks the key its RPC requires (private.require) first, so a
 * refusal reads "no permission"; the RPC checks again and is the authority.
 */

export type { ActionResult };

/** The RPCs raise plain Postgres exceptions. This one is worth its own
 *  message; the rest go through the shared mapper, which ends at
 *  'error_generic' rather than handing the driver's string to the browser. */
function friendly(message: string): string {
  if (/New deadline must be in the future/i.test(message)) return 'deadline_must_be_future';
  if (/INVALID_END_DATE/.test(message)) return 'invalid_end_date';
  if (/REASON_REQUIRED/.test(message)) return 'reason_required';
  // REVIEW-04: approved (or never submitted) can't be sent back.
  if (/NOT_REVIEWABLE/.test(message)) return 'not_in_submitted_state';
  if (/NO_ITEMS/.test(message)) return 'no_items_selected';
  // create_task_group (QR-locked places).
  if (/TITLE_REQUIRED/.test(message)) return 'title_en_required';
  if (/INVALID_PLACES/.test(message)) return 'round_places_invalid';
  if (/PLACE_WINDOW_OVERLAP/.test(message)) return 'place_window_overlap';
  if (/Place not found/.test(message)) return 'place_not_found';
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
  if (!can(await getProfile(), 'checklists.create')) return { ok: false, error: 'not_authorized' };
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

export type NewTaskGroupInput = {
  /** In walk order. A place without its own window gets the task's. */
  places: TaskGroupPlace[];
  assigneeIds: string[];
  titleAr: string;
  titleEn: string;
  scheduledDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  taskNote?: string;
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A task over several places (QR-locked places): create_task_group makes one
 * checklist per place, each with that place's own title and subtasks, tied by
 * a shared task_group_id the way schedule_rounds ties a round's. The form
 * offers no item editing here — the places' own lists are what each gets.
 *
 * The places are re-checked rather than trusted (a Server Action is an HTTP
 * endpoint): real ids, every window two distinct "HH:MM", and a place listed
 * more than once only in periods that don't overlap.
 * The form always sends a window per place, so the RPC never has to guess one.
 */
export async function createTaskGroup(
  input: NewTaskGroupInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!can(await getProfile(), 'checklists.create')) return { ok: false, error: 'not_authorized' };
  if (
    input.places.length < 2 ||
    !input.places.every(
      (p) =>
        isUuid(p.template_id) &&
        HHMM.test(p.window_start) &&
        HHMM.test(p.window_end) &&
        p.window_start !== p.window_end,
    )
  ) {
    return { ok: false, error: 'round_places_invalid' };
  }
  // A place may repeat, each time in its own period (create_task_group checks the same).
  if (placeWindowOverlaps(input.places).size > 0) return { ok: false, error: 'place_window_overlap' };
  if (input.assigneeIds.length === 0 || !input.scheduledDate) return { ok: false, error: 'fields_required' };
  // task_groups.title_en is the push's title: create_task_group needs it.
  if (!input.titleEn.trim()) return { ok: false, error: 'title_en_required' };
  if (input.endDate && input.endDate < input.scheduledDate) return { ok: false, error: 'invalid_end_date' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_task_group', {
    p_title_en: input.titleEn.trim(),
    p_title_ar: input.titleAr.trim(),
    p_places: input.places.map(({ template_id, window_start, window_end }) => ({
      template_id,
      window_start,
      window_end,
    })),
    p_assignee_ids: input.assigneeIds,
    p_scheduled_date: input.scheduledDate,
    p_end_date: input.endDate || null,
    p_task_note: input.taskNote?.trim() || null,
  });
  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath('/assignments');
  revalidatePath('/tracker');
  return { ok: true, id: data as unknown as string };
}

/**
 * A supervisor opens a QR-locked place without a scan (a missing or damaged
 * sticker). unlock_place checks the permission and the reviewers' scope again
 * and logs the unlock under the caller's name.
 */
export async function unlockPlace(id: string): Promise<ActionResult> {
  if (!can(await getProfile(), 'assignments.unlock_place')) return { ok: false, error: 'not_authorized' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('unlock_place', { p_assignment_id: id });
  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath(`/assignments/${id}`);
  return { ok: true };
}

export async function approveAssignment(id: string, score?: number): Promise<ActionResult> {
  if (!can(await getProfile(), 'review.edit')) return { ok: false, error: 'not_authorized' };
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

/** The reason is required: refused here, and again by reject_items in the database. */
export async function rejectItems(
  id: string,
  itemIds: string[],
  reason: string,
): Promise<ActionResult> {
  if (!can(await getProfile(), 'review.edit')) return { ok: false, error: 'not_authorized' };
  if (itemIds.length === 0) return { ok: false, error: 'no_items_selected' };
  const trimmed = reason?.trim();
  if (!trimmed) return { ok: false, error: 'reason_required' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_items', {
    p_assignment_id: id,
    p_item_ids: itemIds,
    p_reason: trimmed,
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
  if (!can(await getProfile(), 'checklists.edit')) return { ok: false, error: 'not_authorized' };
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
