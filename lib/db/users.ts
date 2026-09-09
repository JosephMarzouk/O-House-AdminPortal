import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types/database';

/** Every profile. RLS lets admins and managers read the whole table
 *  (profiles_select is not manager-scoped, unlike submissions). */
export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('role')
    .order('name');
  if (error) throw new Error(`listProfiles: ${error.message}`);
  return data ?? [];
}

/** Who an assignment can be given to. `cleaner` and `inspector` are
 *  indistinguishable at the database level — both are field staff. */
export function assignableStaff(profiles: Profile[]): Profile[] {
  return profiles.filter((p) => p.active && (p.role === 'cleaner' || p.role === 'inspector'));
}

/** Candidates for profiles.manager_id, minus the user themselves —
 *  set_user_manager rejects self-assignment. */
export function managerCandidates(profiles: Profile[], excludeId: string): Profile[] {
  return profiles.filter(
    (p) => p.id !== excludeId && (p.role === 'admin' || p.role === 'manager'),
  );
}
