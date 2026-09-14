'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/lib/auth';
import { normalizePhone, phoneToLoginEmail, phoneToE164 } from '@/lib/phone';
import { isStaffRole, type Role, type StaffRole } from '@/lib/types/database';

export type ActionResult = { ok: true } | { ok: false; error: string };

const MIN_PASSWORD = 8; // matches set_password_screen.dart's own rule

function friendly(message: string): string {
  if (/Only admins/i.test(message) || /permission denied/i.test(message)) return 'not_authorized';
  if (/already registered|already been registered/i.test(message)) return 'phone_taken';
  return message;
}

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
  if (error) return { ok: false, error: friendly(error.message) };
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
  if (error) return { ok: false, error: friendly(error.message) };
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
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath('/users');
  return { ok: true };
}

/**
 * Create a staff account that the phone app can actually sign into.
 *
 * Needs the service-role key: `profiles` has no INSERT policy and there is no
 * RPC for this. The one rule that cannot be got wrong is the login address —
 * login_screen.dart caps its field at 10 digits, prepends +20 and strips the
 * '+', so the account must exist as exactly 20<10 digits>@ohouse.internal.
 *
 * Deliberately does NOT write email or phone afterwards: handle_new_user()
 * already derives phone from the synthetic address and blanks profiles.email
 * ("never store the disguise"). The old edge function overwrote both, which is
 * why accounts it created could not log in. The role is the one field we do
 * set, because the trigger's default ('cleaner') is a guess about a choice the
 * admin just made explicitly.
 */
export async function createStaff(input: {
  name: string;
  phone: string;
  password: string;
  role: StaffRole;
}): Promise<ActionResult> {
  const caller = await getProfile();
  if (caller?.role !== 'admin') return { ok: false, error: 'not_authorized' };

  const digits = normalizePhone(input.phone);
  if (digits.length !== 10) return { ok: false, error: 'phone_invalid' };
  if (input.password.length < MIN_PASSWORD) return { ok: false, error: 'password_too_short' };
  if (!input.name.trim()) return { ok: false, error: 'fields_required' };
  if (!isStaffRole(input.role)) return { ok: false, error: 'role_not_allowed' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'service_key_missing' };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: phoneToLoginEmail(digits),
    password: input.password,
    // .internal is unreachable by design, so an unconfirmed account could
    // never verify itself.
    email_confirm: true,
    user_metadata: { name: input.name.trim() },
  });
  if (error || !created?.user) return { ok: false, error: friendly(error?.message ?? 'create_failed') };

  // The signup trigger has been observed not firing for Admin-API-created
  // users on this project before. Verify rather than assume, and fill in the
  // row ourselves if it is missing — matching exactly what the trigger writes.
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', created.user.id)
    .maybeSingle();

  if (!profile) {
    await admin.from('profiles').insert({
      id: created.user.id,
      name: input.name.trim(),
      email: '',
      phone: phoneToE164(digits),
      role: input.role,
    });
  }

  // Role rides along with the must_change_password write rather than in a
  // second round trip — the trigger has already set 'cleaner' by now either
  // way, so this is a correction in both the trigger-fired and fallback paths.
  //
  // ponytail: must_change_password defaults true, but the app's forced-change
  // screen only started calling complete_password_change() in an unreleased
  // build — on the shipped build it raises 42501 and traps the user in a loop.
  // Ceiling: the admin's chosen password persists until the user changes it.
  // Flip this to leave the flag true once that app build is deployed.
  const { error: roleErr } = await admin
    .from('profiles')
    .update({ must_change_password: false, role: input.role })
    .eq('id', created.user.id);
  // The account exists at this point; reporting success while it carries the
  // wrong role would leave an inspector quietly filed as a cleaner.
  if (roleErr) return { ok: false, error: friendly(roleErr.message) };

  revalidatePath('/users');
  return { ok: true };
}

export async function resetStaffPassword(
  targetUserId: string,
  newPassword: string,
): Promise<ActionResult> {
  const caller = await getProfile();
  if (caller?.role !== 'admin') return { ok: false, error: 'not_authorized' };
  if (newPassword.length < MIN_PASSWORD) return { ok: false, error: 'password_too_short' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'service_key_missing' };
  }

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  });
  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath('/users');
  return { ok: true };
}
