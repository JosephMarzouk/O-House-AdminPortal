'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { can, getProfile } from '@/lib/auth';
import { parseDay } from '@/lib/format';
import { isUuid, placeWindowOverlaps, roundPlaces, type PlanCell } from '@/lib/rounds';
import type { RoundPlace, ScheduleResult } from '@/lib/types/database';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';

/**
 * Both actions check the caller's permission themselves as well as leaning on
 * the database: a Server Action is reachable by a direct POST whatever the
 * page showed, and a clear "not authorised" beats an RLS zero-row write that
 * has to be decoded. The database has the final word either way — the
 * round_templates policies and schedule_rounds() check the same planner.* keys.
 */

export type RoundTemplateInput = {
  id?: string;
  titleAr: string;
  titleEn: string;
  active: boolean;
  places: RoundPlace[];
};

/**
 * Round templates are written directly, like places: they are plain
 * configuration with an RLS write policy, and nothing about saving one needs
 * to be atomic with anything else. The places run through roundPlaces(), the
 * write whitelist, and a row it drops is reported rather than silently lost —
 * the form validates first, so that only happens to a hand-made request.
 */
export async function saveRoundTemplate(
  input: RoundTemplateInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const profile = await getProfile();
  if (!can(profile, input.id ? 'planner.edit' : 'planner.create')) return { ok: false, error: 'not_authorized' };

  const titleAr = input.titleAr.trim();
  const titleEn = input.titleEn.trim();
  if (!titleAr && !titleEn) return { ok: false, error: 'fields_required' };

  const places = roundPlaces(input.places);
  if (places.length === 0) return { ok: false, error: 'need_at_least_one_place' };
  if (places.length !== input.places.length) return { ok: false, error: 'round_places_invalid' };
  // A place may repeat, each time in its own period (a trigger checks the same).
  if (placeWindowOverlaps(places).size > 0) return { ok: false, error: 'place_window_overlap' };

  const supabase = await createClient();
  const row = { title_ar: titleAr, title_en: titleEn, active: input.active === true, places };

  // .select('id') on both paths: PostgREST reports an RLS-blocked UPDATE as a
  // clean zero-row result, so without it a revoked role would read "Saved".
  const { data, error } = input.id
    ? await supabase.from('round_templates').update(row).eq('id', input.id).select('id')
    : await supabase.from('round_templates').insert(row).select('id');
  if (error) {
    const code = /PLACE_WINDOW_OVERLAP/.test(error.message) ? 'place_window_overlap' : toErrorCode(error.message);
    return { ok: false, error: code };
  }
  if (!data?.length) return { ok: false, error: 'nothing_changed' };

  revalidatePath('/rounds');
  return { ok: true, id: data[0].id };
}

/** schedule_rounds() raises these by name; everything else goes through the shared mapper. */
function scheduleError(message: string): string {
  if (/PAST_DATE/.test(message)) return 'past_date';
  if (/INVALID_PLAN/.test(message)) return 'invalid_plan';
  return toErrorCode(message);
}

/**
 * The week planner's Save: every changed cell in one schedule_rounds() call,
 * which runs as one transaction — the whole week lands, or none of it does.
 *
 * Cells are checked here before they reach the RPC so a malformed one comes
 * back as a named error rather than a Postgres cast failure.
 */
export async function saveWeekPlan(
  cells: PlanCell[],
): Promise<{ ok: true; result: ScheduleResult } | { ok: false; error: string }> {
  const profile = await getProfile();
  if (!can(profile, 'planner.create')) return { ok: false, error: 'not_authorized' };
  if (!Array.isArray(cells) || cells.length === 0) return { ok: false, error: 'nothing_changed' };

  const plan: PlanCell[] = [];
  for (const c of cells) {
    const date = parseDay(c?.date);
    const ids = c?.assignee_ids;
    if (
      !isUuid(c?.round_template_id) ||
      !date ||
      !Array.isArray(ids) ||
      !ids.every((id) => isUuid(id))
    ) {
      return { ok: false, error: 'invalid_plan' };
    }
    plan.push({ round_template_id: c.round_template_id, date, assignee_ids: [...new Set(ids)] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('schedule_rounds', { p_plan: plan });
  if (error) return { ok: false, error: scheduleError(error.message) };

  const r = (data ?? {}) as Partial<ScheduleResult>;
  const result: ScheduleResult = {
    created: r.created ?? 0,
    moved: r.moved ?? 0,
    removed: r.removed ?? 0,
    kept: r.kept ?? 0,
    skipped: r.skipped ?? 0,
  };

  revalidatePath('/rounds');
  revalidatePath('/tracker');
  revalidatePath('/assignments');
  return { ok: true, result };
}

export type { ActionResult };
