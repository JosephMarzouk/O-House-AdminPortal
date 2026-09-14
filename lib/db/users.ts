import { createClient } from '@/lib/supabase/server';
import { PROFILE_COLUMNS, type PortalProfile } from '@/lib/types/database';

/**
 * Every profile, minus the phone number.
 *
 * RLS lets admins, managers and inspectors read the whole table
 * (profiles_select is not scoped, unlike submissions). The column list is
 * what keeps that from including phone numbers: after 0011 `authenticated`
 * holds no table-wide SELECT here, so this must stay explicit — a
 * `select('*')` fails outright rather than quietly returning less.
 *
 * Three of this function's four callers only ever use id, name and
 * department_id; they used to pull every column including phone across the
 * wire on every dashboard and assignments page load.
 */
export async function listProfiles(): Promise<PortalProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('role')
    .order('name');
  if (error) throw new Error(`listProfiles: ${error.message}`);
  return data ?? [];
}

/** One row of the admin Users screen. Phone is here and nowhere else. */
export type StaffRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  department_id: string | null;
  manager_id: string | null;
  active: boolean;
  must_change_password: boolean;
};

/**
 * The Users screen's data, phone numbers included — admins only.
 *
 * Goes through the admin_staff_list() RPC rather than the table because the
 * table no longer exposes `phone` to anyone. The RPC is SECURITY DEFINER
 * and raises for a non-admin caller, so this is a real boundary rather than
 * a screen that is merely hidden: a manager or inspector calling it
 * directly gets an exception, not a quietly empty list.
 */
export async function adminStaffList(): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_staff_list');
  if (error) throw new Error(`adminStaffList: ${error.message}`);
  return data ?? [];
}

/** Who an assignment can be given to. `cleaner` and `inspector` are
 *  indistinguishable at the database level — both are field staff. */
export function assignableStaff(profiles: PortalProfile[]): PortalProfile[] {
  return profiles.filter((p) => p.active && (p.role === 'cleaner' || p.role === 'inspector'));
}
