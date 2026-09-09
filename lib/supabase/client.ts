import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

/** Browser client. Only for interactive auth (sign in / sign out); all data
 *  reads happen server-side so RLS is evaluated close to the database. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
