'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { can, getProfile } from '@/lib/auth';
import { ApiError, apiPost } from '@/lib/club';
import { ACCESS_COOKIE } from '@/lib/session';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';
import { PLATFORM_ACCESS, type PlatformAccess } from '@/lib/types/database';

export type { ActionResult };

// Staff never set their own password: the app has no screen for it, by the
// business rule. The portal (here) is the only place a password is set.
const MIN_PASSWORD = 8;

export async function setUserRole(targetUserId: string, roleId: string): Promise<ActionResult> {
  // assign_role is the guard: users.edit over this person (can_manage_user)
  // and a new role the caller may assign, which is never Admin. Checked here
  // too for a named answer — promotion is creation by another route, so it
  // gets the same list the create form offers.
  const caller = await getProfile();
  if (!caller?.access?.assignable.includes(roleId)) return { ok: false, error: 'role_not_allowed' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_role', { p_user_id: targetUserId, p_role_id: roleId });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/users');
  return { ok: true };
}

export async function setUserDepartment(
  targetUserId: string,
  departmentId: string | null,
): Promise<ActionResult> {
  // users.edit up front; set_user_department also checks can_manage_user.
  if (!can(await getProfile(), 'users.edit')) return { ok: false, error: 'not_authorized' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_user_department', {
    target_user_id: targetUserId,
    new_department_id: departmentId,
  });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/users');
  return { ok: true };
}

export async function setUserManager(
  targetUserId: string,
  managerId: string | null,
): Promise<ActionResult> {
  if (!can(await getProfile(), 'users.edit')) return { ok: false, error: 'not_authorized' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_user_manager', {
    target_user_id: targetUserId,
    new_manager_id: managerId,
  });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/users');
  return { ok: true };
}

/** The API's staff errors, as the codes lib/errors.ts turns into sentences. */
const STAFF_ERRORS: Record<string, string> = {
  FIELDS_REQUIRED: 'fields_required',
  PHONE_INVALID: 'phone_invalid',
  EMAIL_INVALID: 'email_invalid',
  PASSWORD_TOO_SHORT: 'password_too_short',
  ROLE_NOT_ALLOWED: 'role_not_allowed',
  ROLE_REQUIRED: 'fields_required',
  DEPARTMENT_INVALID: 'department_required',
  LOGIN_TAKEN: 'login_taken',
  NOT_AUTHORIZED: 'not_authorized',
  NO_LOGIN: 'not_authorized',
  ACCESS_INVALID: 'invalid_access',
};

/** The caller's access token, for the API's staff routes (it checks who may do what). */
async function staffCall(path: string, body: object): Promise<ActionResult> {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return { ok: false, error: 'not_authorized' };
  try {
    await apiPost(path, access, body);
  } catch (e) {
    const code = e instanceof ApiError ? e.code : null;
    return { ok: false, error: (code && STAFF_ERRORS[code]) || 'error_generic' };
  }
  revalidatePath('/users');
  return { ok: true };
}

/**
 * Create a staff account. The API does it (POST /admin/staff): it holds the
 * only key that may write sign-in details, and it asks the database
 * (can_assign_role) whether this caller may give this role in this
 * department. A caller whose role covers chosen departments must put the
 * person in one of them. The person signs in with the phone number, the
 * email, or either when both are given.
 */
export async function createStaff(input: {
  name: string;
  phone?: string;
  email?: string;
  password: string;
  roleId: string;
  departmentId?: string;
  /** Where they may sign in: required (the form pre-fills it from the role). */
  access: PlatformAccess;
}): Promise<ActionResult> {
  const caller = await getProfile();
  const access = caller?.access;
  if (!access || !can(caller, 'users.create')) return { ok: false, error: 'not_authorized' };
  // Checked here too for a quick, named answer; the API is the boundary.
  if (input.password.length < MIN_PASSWORD) return { ok: false, error: 'password_too_short' };
  if (!input.name.trim()) return { ok: false, error: 'fields_required' };
  if (!access.assignable.includes(input.roleId)) return { ok: false, error: 'role_not_allowed' };
  if (access.scope === 'departments' && !access.departments.includes(input.departmentId ?? '')) {
    return { ok: false, error: 'department_required' };
  }
  if (!input.phone?.trim() && !input.email?.trim()) return { ok: false, error: 'fields_required' };
  if (!PLATFORM_ACCESS.includes(input.access)) return { ok: false, error: 'invalid_access' };

  return staffCall('/admin/staff', {
    name: input.name.trim(),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    password: input.password,
    roleId: input.roleId,
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    access: input.access,
  });
}

/**
 * Where someone may sign in: portal, app or both (26 Nov). set_user_access
 * applies assign_role's rule (users.edit over this person); the API signs
 * them out of the platform they lost within a minute.
 */
export async function setUserAccess(targetUserId: string, access: PlatformAccess): Promise<ActionResult> {
  if (!can(await getProfile(), 'users.edit')) return { ok: false, error: 'not_authorized' };
  if (!PLATFORM_ACCESS.includes(access)) return { ok: false, error: 'invalid_access' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_user_access', { p_user_id: targetUserId, p_access: access });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/users');
  return { ok: true };
}

/** What deleting this person takes with them, for the confirm dialog. */
export type DeleteUserPreview = { checklists: number; shared: number; rounds: number; reports: number };

export async function deleteUserPreview(
  targetUserId: string,
): Promise<{ ok: true; preview: DeleteUserPreview } | { ok: false; error: string }> {
  if (!can(await getProfile(), 'users.delete')) return { ok: false, error: 'not_authorized' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('delete_user_preview', { p_user_id: targetUserId });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  const p = (data ?? {}) as Partial<DeleteUserPreview>;
  return {
    ok: true,
    preview: { checklists: p.checklists ?? 0, shared: p.shared ?? 0, rounds: p.rounds ?? 0, reports: p.reports ?? 0 },
  };
}

/**
 * Delete a person (26 Nov): the built-in Admin role only (users.delete, which
 * no other role can be given). A soft delete — they can't sign in and leave
 * every list, their name stays on past checklists, their phone and email are
 * free for a new account. `typedName` is what the admin typed to confirm; the
 * database compares it again (NAME_MISMATCH).
 */
export async function deleteUser(targetUserId: string, typedName: string): Promise<ActionResult> {
  if (!can(await getProfile(), 'users.delete')) return { ok: false, error: 'not_authorized' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_user', { p_user_id: targetUserId, p_confirm_name: typedName });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/users');
  revalidatePath('/assignments');
  return { ok: true };
}

/**
 * Set someone's password (staff never change their own). The API refuses a
 * person the caller can't manage (can_manage_user) — resetting a peer's
 * password is a silent account takeover — and ends every session they had.
 */
export async function resetStaffPassword(
  targetUserId: string,
  newPassword: string,
): Promise<ActionResult> {
  const caller = await getProfile();
  if (!can(caller, 'users.edit')) return { ok: false, error: 'not_authorized' };
  if (newPassword.length < MIN_PASSWORD) return { ok: false, error: 'password_too_short' };
  return staffCall(`/admin/staff/${encodeURIComponent(targetUserId)}/password`, { password: newPassword });
}
