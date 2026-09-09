import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types/database';

/** Roles that may use this portal at all. `inspector` and `cleaner` are
 *  staff roles — they use the phone app, not the dashboard. */
export const PORTAL_ROLES = ['admin', 'manager'] as const;

export function canUsePortal(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'manager';
}

/**
 * The signed-in user's profile, or null if there is no session.
 *
 * Note this is a real query, not a JWT claim read: `role` lives in
 * public.profiles and can change without the token being reissued, so
 * reading the token would go stale. RLS lets a user read their own row
 * (profiles_select: id = auth.uid()).
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error || !data) return null;
  return data;
}
