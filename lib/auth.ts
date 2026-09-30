import { cache } from 'react';
import { createClient, dbSession } from '@/lib/supabase/server';
import { PROFILE_COLUMNS, type PortalProfile } from '@/lib/types/database';
import { parseAccess, type Access } from '@/lib/access';

// The rules (can, canManageRoles, …) live in lib/access.ts so client
// components can read them; server code imports them from here or there.
export { can, canManageRoles } from '@/lib/access';

/** The signed-in person: their profile row and what their role lets them do. */
export type Me = PortalProfile & { access: Access | null };

/**
 * The signed-in user's profile and access, or null if there is no session.
 *
 * Note these are real queries, not JWT claim reads: the role lives in
 * public.profiles and can change without the token being reissued, so
 * reading the token would go stale. RLS lets a user read their own row
 * (profiles_select: id = auth.uid()). `access` is my_access(): null for an
 * inactive account or one without a role, which every check reads as "no".
 *
 * The column list is explicit and MUST NOT go back to select('*'). After
 * 0011 `authenticated` holds no table-wide SELECT on profiles — only the
 * named columns — so a '*' expands to include `phone` and the whole query
 * fails with a permission error, on every page. Phone reaches the portal
 * through adminStaffList() alone.
 *
 * cache(): the layout and the page both ask, once per request.
 */
export const getProfile = cache(async (): Promise<Me | null> => {
  // Who is signed in comes from the API's exchange (it verified the access
  // token); the row itself is read as them.
  const session = await dbSession();
  if (!session) return null;
  const supabase = await createClient();

  const [{ data, error }, access] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', session.userId).single(),
    supabase.rpc('my_access'),
  ]);
  if (error || !data) return null;
  return { ...data, access: access.error ? null : parseAccess(access.data) };
});
