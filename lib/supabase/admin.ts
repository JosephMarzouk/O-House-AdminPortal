import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * Service-role client. Bypasses RLS entirely — never import this into
 * anything that reaches the browser (the `server-only` import above turns a
 * mistake into a build error rather than a leaked key).
 *
 * Needed for exactly one thing: creating staff accounts. `profiles` has no
 * INSERT policy and `authenticated` holds no UPDATE grant beyond `name`, so
 * there is no user-level path to provision an account.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — required to create staff accounts. ' +
        'Supabase Dashboard > Project Settings > API keys > service_role.',
    );
  }
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
