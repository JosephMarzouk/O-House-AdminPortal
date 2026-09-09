'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TemplateItem } from '@/lib/types/database';

export type ActionResult = { ok: true } | { ok: false; error: string };

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
 */
export async function savePlace(input: PlaceInput): Promise<ActionResult> {
  if (!input.nameAr.trim() && !input.nameEn.trim()) return { ok: false, error: 'fields_required' };

  const supabase = await createClient();
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn.trim();
  const items = input.items.map((i) => ({ ...i, id: i.id || crypto.randomUUID() }));

  if (input.id) {
    const { data: existing, error: readErr } = await supabase
      .from('templates')
      .select('site_id')
      .eq('id', input.id)
      .maybeSingle();
    if (readErr) return { ok: false, error: readErr.message };

    const { error } = await supabase
      .from('templates')
      .update({
        title_ar: nameAr,
        title_en: nameEn,
        department_id: input.departmentId,
        items,
      })
      .eq('id', input.id);
    if (error) return { ok: false, error: error.message };

    if (existing?.site_id) {
      const { error: siteErr } = await supabase
        .from('sites')
        .update({ name_ar: nameAr, name_en: nameEn })
        .eq('id', existing.site_id);
      if (siteErr) return { ok: false, error: siteErr.message };
    }
  } else {
    // New place: create the sites row FIRST, because a template without a
    // site_id can never be assigned — create_assignment requires p_site_id.
    const { data: site, error: siteErr } = await supabase
      .from('sites')
      .insert({ name_ar: nameAr, name_en: nameEn })
      .select('id')
      .single();
    if (siteErr || !site) return { ok: false, error: siteErr?.message ?? 'site_insert_failed' };

    const { error } = await supabase.from('templates').insert({
      title_ar: nameAr,
      title_en: nameEn,
      department_id: input.departmentId,
      site_id: site.id,
      items,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/places');
  return { ok: true };
}

export async function deletePlace(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Only the template goes. The sites row stays: submissions.site_id points at
  // it and past assignments would lose their location.
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/places');
  return { ok: true };
}
