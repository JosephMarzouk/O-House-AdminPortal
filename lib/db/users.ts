import { createClient } from '@/lib/supabase/server';
import { PROFILE_COLUMNS, type PortalProfile } from '@/lib/types/database';

/**
 * Every profile the caller may see, minus the phone number.
 *
 * RLS decides who that is (profiles_select): yourself, plus your staff list
 * with users.view. The column list is what keeps that from including phone
 * numbers: after 0011 `authenticated` holds no table-wide SELECT here, so
 * this must stay explicit — a `select('*')` fails outright rather than
 * quietly returning less.
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
 *  with phones.view; without it the same row comes with phone null. */
export type StaffRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** The text mirror (custom roles read 'cleaner'). Decide and label on role_id. */
  role: string;
  role_id: string;
  department_id: string | null;
  manager_id: string | null;
  active: boolean;
  must_change_password: boolean;
};

/**
 * The Users screen's data — the caller's staff list, phone numbers with
 * phones.view.
 *
 * Goes through the admin_staff_list() RPC rather than the table because the
 * table no longer exposes `phone` to anyone. The RPC is SECURITY DEFINER and
 * decides both halves itself: it raises without users.view, and nulls the
 * phone without phones.view. So this is a real boundary rather than a screen
 * that is merely hidden.
 *
 * The RPC returns the role's text mirror, not the role; role_id comes from
 * the table, whose policy admits the same people (users.view, the same
 * can_see_staff).
 *
 * The name is 0011's and stayed: see the note at the head of 0012.
 */
export async function adminStaffList(): Promise<StaffRow[]> {
  const supabase = await createClient();
  const [list, roles] = await Promise.all([
    supabase.rpc('admin_staff_list'),
    supabase.from('profiles').select('id, role_id'),
  ]);
  if (list.error) throw new Error(`adminStaffList: ${list.error.message}`);
  if (roles.error) throw new Error(`adminStaffList: ${roles.error.message}`);
  const roleOf = new Map((roles.data ?? []).map((p) => [p.id, p.role_id]));
  return (list.data ?? []).map((u) => ({ ...u, role_id: roleOf.get(u.id) ?? '' }));
}

/** The roles holding staff_app.view: whoever may be given checklists. */
export async function staffAppRoles(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permissions')
    .select('role_id')
    .eq('permission_key', 'staff_app.view');
  if (error) throw new Error(`staffAppRoles: ${error.message}`);
  return new Set((data ?? []).map((r) => r.role_id));
}

/** Who a checklist can be given to: active people whose role holds
 *  staff_app.view — the same test create_assignment and schedule_rounds
 *  make (check_assignees). `roles` is staffAppRoles(). */
export function assignableStaff(profiles: PortalProfile[], roles: Set<string>): PortalProfile[] {
  return profiles.filter((p) => p.active && roles.has(p.role_id));
}
