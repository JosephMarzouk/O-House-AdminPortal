'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { templateItems } from '@/lib/db/places';
import type { TemplateItem } from '@/lib/types/database';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';

export type { ActionResult };

export type PlaceInput = {
  id?: string;
  nameAr: string;
  nameEn: string;
  departmentId: string | null;
  items: TemplateItem[];
};

/**
 * Places live in `templates`, and their twin row in `sites` is what
 * create_assignment denormalizes onto an assignment. Both must stay in step,
 * so a rename writes to both — otherwise the dropdown and the phone disagree,
 * which is exactly the drift migration 0007 had to clean up.
 *
 * Item ids are PRESERVED on edit. The old portal regenerated every id on every
 * save (admin.js:436), orphaning the itemId references stored on past
 * submissions and actions.
 *
 * Every UPDATE and DELETE below asks for the affected rows back. PostgREST
 * reports an RLS-blocked INSERT as an error but an RLS-blocked UPDATE or
 * DELETE as a clean zero-row result, so without the .select() a manager whose
 * role had changed underneath them would be told "Saved" by a write that
 * touched nothing. The same is true of a row that no longer exists.
 */
export async function savePlace(input: PlaceInput): Promise<ActionResult> {
  if (!input.nameAr.trim() && !input.nameEn.trim()) return { ok: false, error: 'fields_required' };

  const supabase = await createClient();
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn.trim();
  // templateItems, not a spread of `input.items`. The parameter is typed
  // TemplateItem[], but a Server Action is an HTTP endpoint and TypeScript is
  // gone by the time this runs — a spread persists whatever keys the caller
  // sent, verbatim, into a jsonb column the phone app reads without a guard of
  // its own. The read-side parser is already the whitelist; run writes through
  // it too, so only the six known fields can ever land in the column.
  const items = templateItems(input.items);

  if (input.id) {
    const { data: existing, error: readErr } = await supabase
      .from('templates')
      .select('site_id')
      .eq('id', input.id)
      .maybeSingle();
    if (readErr) return { ok: false, error: toErrorCode(readErr.message) };

    const { data: updated, error } = await supabase
      .from('templates')
      .update({
        title_ar: nameAr,
        title_en: nameEn,
        department_id: input.departmentId,
        items,
      })
      .eq('id', input.id)
      .select('id');
    if (error) return { ok: false, error: toErrorCode(error.message) };
    if (!updated?.length) return { ok: false, error: 'nothing_changed' };

    if (existing?.site_id) {
      const { data: site, error: siteErr } = await supabase
        .from('sites')
        .update({ name_ar: nameAr, name_en: nameEn })
        .eq('id', existing.site_id)
        .select('id');
      if (siteErr) return { ok: false, error: toErrorCode(siteErr.message) };
      // A template that renamed while its twin site did not is the exact drift
      // migration 0007 had to clean up — surface it rather than bank it.
      if (!site?.length) return { ok: false, error: 'nothing_changed' };
    }
  } else {
    // New place: create the sites row FIRST, because a template without a
    // site_id can never be assigned — create_assignment requires p_site_id.
    const { data: site, error: siteErr } = await supabase
      .from('sites')
      .insert({ name_ar: nameAr, name_en: nameEn })
      .select('id')
      .single();
    if (siteErr || !site) {
      return { ok: false, error: toErrorCode(siteErr?.message ?? 'site_insert_failed') };
    }

    const { error } = await supabase.from('templates').insert({
      title_ar: nameAr,
      title_en: nameEn,
      department_id: input.departmentId,
      site_id: site.id,
      items,
    });
    if (error) return { ok: false, error: toErrorCode(error.message) };
  }

  revalidatePath('/places');
  return { ok: true };
}

export async function deletePlace(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Only the template goes. The sites row stays: submissions.site_id points at
  // it and past assignments would lose their location.
  const { data: deleted, error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: toErrorCode(error.message) };
  if (!deleted?.length) return { ok: false, error: 'nothing_changed' };
  revalidatePath('/places');
  return { ok: true };
}
