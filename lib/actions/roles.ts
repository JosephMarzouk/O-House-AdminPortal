'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canManageRoles, getProfile } from '@/lib/auth';
import { isUuid } from '@/lib/rounds';
import { ROLE_SCOPES, type RoleScope } from '@/lib/types/database';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';

/**
 * create_role / update_role / delete_role are the whole guard: roles.* with
 * whole-club scope, nothing beyond the caller's own permissions or assignable
 * roles, never the Admin role or your own. The checks here only turn a
 * hand-made request into a named answer before it reaches them.
 */

export type RoleInput = {
  nameEn: string;
  nameAr: string;
  scope: RoleScope;
  permissions: string[];
  departmentIds: string[];
  assignableRoleIds: string[];
};

/** The role RPCs raise these by name; everything else goes through the shared mapper. */
function roleError(message: string): string {
  const codes = [
    'ROLE_IN_USE',
    'ROLE_LOCKED',
    'OWN_ROLE',
    'NOT_A_SUBSET',
    'DEPARTMENTS_REQUIRED',
    'NAME_TAKEN',
    'NAME_REQUIRED',
    'INVALID_SCOPE',
    'NOT_FOUND',
    'DEFAULT_ROLE',
  ];
  // \b: NOT_FOUND must not match ITEM_NOT_FOUND ('_' is a word character).
  const code = codes.find((c) => new RegExp(`\\b${c}\\b`).test(message));
  return code ? code.toLowerCase() : toErrorCode(message);
}

const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
const uuids = (v: unknown): v is string[] => strings(v) && v.every((s) => isUuid(s));

export async function saveRole(
  id: string | null,
  input: RoleInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const me = await getProfile();
  if (!canManageRoles(me, id ? 'edit' : 'create')) return { ok: false, error: 'not_authorized' };
  if (id !== null && !isUuid(id)) return { ok: false, error: 'not_found' };
  if (!input.nameEn?.trim() || !input.nameAr?.trim()) return { ok: false, error: 'name_required' };
  if (!ROLE_SCOPES.includes(input.scope)) return { ok: false, error: 'invalid_scope' };
  if (!strings(input.permissions) || !uuids(input.departmentIds) || !uuids(input.assignableRoleIds)) {
    return { ok: false, error: 'error_generic' };
  }

  const args = {
    p_name_en: input.nameEn.trim(),
    p_name_ar: input.nameAr.trim(),
    p_scope: input.scope,
    p_permissions: input.permissions,
    // Departments only mean something for that scope (DEPARTMENTS_REQUIRED
    // refuses them anywhere else), so a switch away drops them here.
    p_department_ids: input.scope === 'departments' ? input.departmentIds : [],
    p_assignable_role_ids: input.assignableRoleIds,
  };

  const supabase = await createClient();
  let savedId: string;
  if (id) {
    const { error } = await supabase.rpc('update_role', { p_role_id: id, ...args });
    if (error) return { ok: false, error: roleError(error.message) };
    savedId = id;
  } else {
    const { data, error } = await supabase.rpc('create_role', args);
    if (error || !data) return { ok: false, error: roleError(error?.message ?? '') };
    savedId = data;
  }

  revalidatePath('/roles');
  revalidatePath('/users'); // role names label the staff list
  return { ok: true, id: savedId };
}

export async function deleteRole(id: string): Promise<ActionResult> {
  const me = await getProfile();
  if (!canManageRoles(me, 'delete')) return { ok: false, error: 'not_authorized' };
  if (!isUuid(id)) return { ok: false, error: 'not_found' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_role', { p_role_id: id });
  if (error) return { ok: false, error: roleError(error.message) };
  revalidatePath('/roles');
  return { ok: true };
}
