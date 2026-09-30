'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';
import { can, getProfile } from '@/lib/auth';

export type { ActionResult };

// Each checks the departments policy's key first, so a refusal reads "no
// permission"; the policy is still the authority.
export async function createDepartment(nameAr: string, nameEn: string): Promise<ActionResult> {
  if (!can(await getProfile(), 'departments.create')) return { ok: false, error: 'not_authorized' };
  if (!nameAr.trim() && !nameEn.trim()) return { ok: false, error: 'fields_required' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('departments')
    .insert({ name_ar: nameAr.trim(), name_en: nameEn.trim() });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/departments');
  return { ok: true };
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  if (!can(await getProfile(), 'departments.delete')) return { ok: false, error: 'not_authorized' };
  const supabase = await createClient();
  // profiles.department_id and templates.department_id are plain references
  // with no ON DELETE, so Postgres refuses while anything still points here.
  // Surfacing that beats silently orphaning a department's staff.
  //
  // The .select() catches the quieter failure: an RLS-blocked DELETE comes
  // back as zero rows and no error, which would otherwise read as success.
  const { data: deleted, error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: toErrorCode(error.message) };
  if (!deleted?.length) return { ok: false, error: 'nothing_changed' };
  revalidatePath('/departments');
  return { ok: true };
}
