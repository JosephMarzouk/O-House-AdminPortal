import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';

/**
 * Server client for RSCs, Route Handlers and Server Actions.
 * Runs as the signed-in user, so RLS applies — which is the point:
 * assignments_v now has security_invoker=on, and a manager sees only
 * their own reports' rows.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // middleware.ts refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
