'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createDepartment(nameAr: string, nameEn: string): Promise<ActionResult> {
  if (!nameAr.trim() && !nameEn.trim()) return { ok: false, error: 'fields_required' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('departments')
    .insert({ name_ar: nameAr.trim(), name_en: nameEn.trim() });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/departments');
  return { ok: true };
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // profiles.department_id and templates.department_id are plain references
  // with no ON DELETE, so Postgres refuses while anything still points here.
  // Surfacing that beats silently orphaning a department's staff.
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/departments');
  return { ok: true };
}
