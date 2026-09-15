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

/** One row of the Users screen. Phone is here and nowhere else — and only
 *  for an admin caller; a manager gets the same row with phone null. */
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
 * The Users screen's data — admins and managers, phone numbers for admins.
 *
 * Goes through the admin_staff_list() RPC rather than the table because the
 * table no longer exposes `phone` to anyone. The RPC is SECURITY DEFINER and
 * decides both halves itself (0012): it raises for an inspector or a cleaner,
 * and returns every row with phone null to a manager. So this is a real
 * boundary rather than a screen that is merely hidden — calling it directly as
 * an inspector gets an exception, not a quietly empty list, and calling it as
 * a manager gets no phone number however the screen is rendered.
 *
 * The name is 0011's and stayed: see the note at the head of 0012.
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
