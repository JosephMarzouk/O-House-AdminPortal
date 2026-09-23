import { createClient } from '@/lib/supabase/server';
import { PROFILE_COLUMNS, type PortalProfile } from '@/lib/types/database';

/**
 * Roles that may use this portal at all. `cleaner` is the one staff role
 * that stays on the phone app.
 *
 * canUsePortal now reads this list instead of restating it inline — the two
 * had to be kept in step by hand, and the inline copy was the one that
 * actually decided access, so the exported constant was decorative.
 *
 * The database half of this list is migration 0011, which adds 'inspector'
 * to every policy and RPC that said admin/manager. Both halves have to
 * agree: this one only decides whether pages render, and a Server Action is
 * reachable by POST whatever the layout does.
 */
export const PORTAL_ROLES = ['admin', 'manager', 'inspector'] as const;

export function canUsePortal(role: string | undefined | null): boolean {
  return !!role && (PORTAL_ROLES as readonly string[]).includes(role);
}

/**
 * Who may open the Users screen and act on it. Admins and managers; what each
 * of them may actually reach once inside is grantableRoles' answer, not this
 * one — this only decides whether the screen and its Server Actions engage at
 * all.
 *
 * Inspectors are deliberately absent. They are portal users (PORTAL_ROLES)
 * but not staff administrators, and 0011 says the same in the database.
 */
export function canManageUsers(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'manager';
}

/**
 * Who may define zone rounds and plan the week. Admins and managers — the
 * same pair round_templates_write and schedule_rounds() admit in the database
 * (0013). An inspector carries rounds out; planning other people's weeks is
 * not theirs to do.
 */
export function canSchedule(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'manager';
}

/**
 * Who may drag cards on the task tracker. Admins only, by the club's own
 * rule — managers and inspectors follow the board read-only. Note this is the
 * board's rule, not a database one: the moves it offers are approve, send back
 * and extend, which the detail page's review bar already offers managers and
 * inspectors under their own RPC guards.
 */
export function canMoveTasks(role: string | undefined | null): boolean {
  return role === 'admin';
}

/**
 * Who may edit the staff app's About and Policies text. Admins only, the same
 * rule set_club_page() enforces in the database.
 */
export function canEditClubPages(role: string | undefined | null): boolean {
  return role === 'admin';
}

/**
 * The signed-in user's profile, or null if there is no session.
 *
 * Note this is a real query, not a JWT claim read: `role` lives in
 * public.profiles and can change without the token being reissued, so
 * reading the token would go stale. RLS lets a user read their own row
 * (profiles_select: id = auth.uid()).
 *
 * The column list is explicit and MUST NOT go back to select('*'). After
 * 0011 `authenticated` holds no table-wide SELECT on profiles — only the
 * named columns — so a '*' expands to include `phone` and the whole query
 * fails with a permission error, on every page. Phone reaches the portal
 * through adminStaffList() alone.
 */
export async function getProfile(): Promise<PortalProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .single();
  if (error || !data) return null;
  return data;
}
