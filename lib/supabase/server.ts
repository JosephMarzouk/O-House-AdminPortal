import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { currentClub } from '@/lib/club';
import type { Database } from '@/lib/types/database';

/**
 * Server client for RSCs, Route Handlers and Server Actions.
 * Runs as the signed-in user, so RLS applies — which is the point:
 * assignments_v now has security_invoker=on, and a manager sees only
 * their own reports' rows.
 *
 * The project is the request's club (lib/club.ts), not a build-time env:
 * one deployment serves every club.
 */
export async function createClient() {
  const [cookieStore, club] = await Promise.all([cookies(), currentClub()]);

  return createServerClient<Database>(club.supabaseUrl, club.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
