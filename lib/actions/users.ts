'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { canManageUsers, getProfile } from '@/lib/auth';
import { ApiError, apiPost } from '@/lib/club';
import { ACCESS_COOKIE } from '@/lib/session';
import { grantableRoles, isStaffRole, type Role, type StaffRole } from '@/lib/types/database';
import { toErrorCode, type ActionResult } from '@/lib/actions/result';

export type { ActionResult };

// Staff never set their own password: the app has no screen for it, by the
// business rule. The portal (here) is the only place a password is set.
const MIN_PASSWORD = 8;

export async function setUserRole(targetUserId: string, newRole: Role): Promise<ActionResult> {
  // isStaffRole is the real guard, not the <select> that omits 'admin': a
  // Server Action is reachable by direct POST whatever the UI offers. And it
  // has to sit on promotion as well as creation — promotion is creation by
  // another route, so banning one without the other closes nothing.
  if (!isStaffRole(newRole)) return { ok: false, error: 'role_not_allowed' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_user_role', {
    target_user_id: targetUserId,
    new_role: newRole,
  });
  if (error) return { ok: false, error: toErrorCode(error.message) };
  revalidatePath('/users');
  return { ok: true };
}

export async function setUserDepartment(
  targetUserId: string,
  departmentId: string | null,
): Promise<ActionResult> {
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
  LOGIN_TAKEN: 'login_taken',
  NOT_AUTHORIZED: 'not_authorized',
  NO_LOGIN: 'not_authorized',
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
 * only key that may write sign-in details, and it enforces the same rules
 * this used to — grantableRoles, a password of at least 8, a 10-digit phone.
 * The person signs in with the phone number, the email, or either when both
 * are given.
 */
export async function createStaff(input: {
  name: string;
  phone?: string;
  email?: string;
  password: string;
  role: StaffRole;
}): Promise<ActionResult> {
  const caller = await getProfile();
  if (!canManageUsers(caller?.role)) return { ok: false, error: 'not_authorized' };
  // Checked here too for a quick, named answer; the API is the boundary.
  if (input.password.length < MIN_PASSWORD) return { ok: false, error: 'password_too_short' };
  if (!input.name.trim()) return { ok: false, error: 'fields_required' };
  if (!grantableRoles(caller?.role).includes(input.role)) return { ok: false, error: 'role_not_allowed' };
  if (!input.phone?.trim() && !input.email?.trim()) return { ok: false, error: 'fields_required' };

  return staffCall('/admin/staff', {
    name: input.name.trim(),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    password: input.password,
    role: input.role,
  });
}

/**
 * Set someone's password (staff never change their own). The API refuses a
 * target outside grantableRoles — resetting a peer's password is a silent
 * account takeover — and ends every session the person had.
 */
export async function resetStaffPassword(
  targetUserId: string,
  newPassword: string,
): Promise<ActionResult> {
  const caller = await getProfile();
  if (!canManageUsers(caller?.role)) return { ok: false, error: 'not_authorized' };
  if (newPassword.length < MIN_PASSWORD) return { ok: false, error: 'password_too_short' };
  return staffCall(`/admin/staff/${encodeURIComponent(targetUserId)}/password`, { password: newPassword });
}
