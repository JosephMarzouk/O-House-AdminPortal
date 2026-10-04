import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { ApiError, apiGet, currentClub } from '@/lib/club';
import { ACCESS_COOKIE } from '@/lib/session';
import type { Database } from '@/lib/types/database';

/**
 * The signed-in person, as the database knows them: a short-lived token the
 * API minted for them (GET /auth/db-token), in exchange for the access token
 * in their cookie plus this server's own key. Null when nobody is signed in
 * or the session is no longer good. cache(): one exchange per request.
 */
export const dbSession = cache(async (): Promise<{ token: string; userId: string } | null> => {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return null;
  try {
    return await apiGet<{ token: string; userId: string }>('/auth/db-token', access, {
      'x-ohouse-portal-key': process.env.OHOUSE_GATEWAY_KEY ?? '',
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      // Logged because the caller only sees "no session" and signs the user
      // out (app/session-ended). 403 GATEWAY_REQUIRED means this server's
      // OHOUSE_GATEWAY_KEY is not the API's PORTAL_GATEWAY_KEY: every sign-in
      // will fail until the variables are fixed. Status and code only: never
      // the token or the key.
      console.error(`[auth] db-token refused: ${e.status} ${e.code ?? ''}`.trim());
      return null;
    }
    throw e;
  }
});

/**
 * Server client for RSCs, Route Handlers and Server Actions.
 * Runs as the signed-in user, so RLS applies — which is the point:
 * assignments_v has security_invoker=on, and a manager sees only their own
 * reports' rows.
 *
 * The project is the request's club (lib/club.ts), not a build-time env:
 * one deployment serves every club. No Supabase session lives in cookies any
 * more: the Authorization header carries the minted token, and the gateway
 * key lets the request through the Data API gate once it is on (Step 4).
 */
export async function createClient() {
  const [club, session] = await Promise.all([currentClub(), dbSession()]);
  const gate = process.env.OHOUSE_GATEWAY_KEY;

  return createServerClient<Database>(club.supabaseUrl, club.publishableKey, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: {
      headers: {
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(gate ? { 'x-ohouse-gateway-key': gate } : {}),
      },
    },
  });
}
