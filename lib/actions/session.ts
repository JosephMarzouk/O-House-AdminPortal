'use server';

import { cookies } from 'next/headers';
import { currentClub } from '@/lib/club';
import { ACCESS_COOKIE, authPost, REFRESH_COOKIE, sessionCookies } from '@/lib/session';

/**
 * Sign in through the API: phone or email, one box. The API tells "no such
 * account" and "wrong password" apart for nobody — this passes on only
 * whether it worked, is locked, or the account has no access.
 */
export async function signIn(
  login: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: 'invalid' | 'locked' | 'no_access' | 'unavailable' }> {
  const club = await currentClub();
  let res;
  try {
    res = await authPost(club.slug, '/auth/login', { login, password });
  } catch {
    return { ok: false, error: 'unavailable' };
  }
  if (res.status === 200 && res.data) {
    const store = await cookies();
    for (const [name, value, options] of sessionCookies(res.data)) store.set(name, value, options);
    return { ok: true };
  }
  if (res.status === 429) return { ok: false, error: 'locked' };
  if (res.status === 403) return { ok: false, error: 'no_access' };
  if (res.status === 401 || res.status === 400) return { ok: false, error: 'invalid' };
  return { ok: false, error: 'unavailable' };
}

/** Ends this session on the server too (the refresh token is revoked), then drops the cookies. */
export async function signOut(): Promise<void> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await authPost((await currentClub()).slug, '/auth/logout', { refreshToken });
    } catch {
      // Offline API: the cookies still go, and the token expires on its own.
    }
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
