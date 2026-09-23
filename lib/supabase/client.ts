import { createBrowserClient } from '@supabase/ssr';
import type { PublicClub } from '@/lib/club-registry';
import type { Database } from '@/lib/types/database';

/** Browser client. Only for interactive auth (sign in / sign out); all data
 *  reads happen server-side so RLS is evaluated close to the database.
 *  Takes the club because each club is its own project — get it from
 *  useClub() (components/club-provider.tsx). */
export function createClient(club: Pick<PublicClub, 'supabaseUrl' | 'publishableKey'>) {
  return createBrowserClient<Database>(club.supabaseUrl, club.publishableKey);
}
