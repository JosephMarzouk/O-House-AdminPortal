import { apiUrl } from '@/lib/club-registry';

/**
 * The portal's sign-in session: the API's own tokens (POST /auth/login), in
 * two httpOnly cookies. The browser never holds a Supabase URL, key or token:
 * the portal's server exchanges the access token for a short-lived database
 * token (GET /auth/db-token) when it queries on the user's behalf.
 *
 * No Next.js imports, so proxy.ts can use it as well as server actions.
 */

export const ACCESS_COOKIE = 'oh_at';
export const REFRESH_COOKIE = 'oh_rt';
const REFRESH_MAX_AGE_S = 30 * 24 * 60 * 60;

export type Tokens = { accessToken: string; refreshToken: string; expiresIn: number; userId: string };

/**
 * httpOnly: no script reads them. Host-only (no `domain`): a club's cookies
 * never reach another club's subdomain. Secure outside local development.
 */
export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/** [name, value, options] for both cookies, ready for any cookie store. */
export function sessionCookies(t: Tokens) {
  return [
    [ACCESS_COOKIE, t.accessToken, cookieOptions(t.expiresIn)],
    [REFRESH_COOKIE, t.refreshToken, cookieOptions(REFRESH_MAX_AGE_S)],
  ] as const;
}

/**
 * When an access token expires, read without verifying — for routing only:
 * whether to refresh before the page renders. The API verifies every token it
 * is actually given.
 */
export function expiresAt(token: string | undefined): number {
  if (!token) return 0;
  try {
    const c = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof c?.exp === 'number' ? c.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** POST to the API's public sign-in routes. Null body for 204. */
export async function authPost(
  clubSlug: string,
  path: '/auth/login' | '/auth/refresh' | '/auth/logout',
  body: object,
): Promise<{ status: number; data: (Tokens & { code?: string }) | null }> {
  const res = await fetch(`${apiUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Club': clubSlug },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
