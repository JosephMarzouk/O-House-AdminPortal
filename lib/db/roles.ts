import { createClient } from '@/lib/supabase/server';
import { sortRoles } from '@/lib/access';
import type { Permission, RoleRow } from '@/lib/types/database';

/** A role with what it holds, as the Roles and Users screens draw it. */
export type RoleDetail = RoleRow & {
  permissions: string[];
  departments: string[];
  assignable: string[];
};

/**
 * Every role (sortRoles order) with its permissions, departments and the
 * roles it may assign. The role tables are readable by anyone signed in.
 *
 * The Admin role's assignable list is a rule in the database, not rows
 * (assignable_role_ids: every other role), so it is filled in here — the
 * screen shows what the role can actually do.
 */
export async function listRoles(): Promise<RoleDetail[]> {
  const supabase = await createClient();
  const [roles, perms, depts, assign] = await Promise.all([
    supabase.from('roles').select('id, key, name_en, name_ar, scope, locked, created_at, updated_at'),
    supabase.from('role_permissions').select('role_id, permission_key'),
    supabase.from('role_departments').select('role_id, department_id'),
    supabase.from('role_assignable').select('role_id, assignable_role_id'),
  ]);
  const error = roles.error ?? perms.error ?? depts.error ?? assign.error;
  if (error) throw new Error(`listRoles: ${error.message}`);

  const sorted = sortRoles(roles.data ?? []);
  return sorted.map((r) => ({
    ...r,
    permissions: (perms.data ?? []).filter((x) => x.role_id === r.id).map((x) => x.permission_key),
    departments: (depts.data ?? []).filter((x) => x.role_id === r.id).map((x) => x.department_id),
    assignable:
      r.key === 'admin'
        ? sorted.filter((o) => o.key !== 'admin').map((o) => o.id)
        : (assign.data ?? []).filter((x) => x.role_id === r.id).map((x) => x.assignable_role_id),
  }));
}

/** The permission catalog, in matrix order. */
export async function listPermissions(): Promise<Permission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('permissions')
    .select('key, section, module, action, label_en, label_ar, sort')
    .order('sort');
  if (error) throw new Error(`listPermissions: ${error.message}`);
  return data ?? [];
}
