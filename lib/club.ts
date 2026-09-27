// No 'server-only' guard: nothing here is secret (public club fields, and the
// caller's own token), and next/headers already ties it to the server. The
// guard would also break `pnpm check`, which imports lib/auth -> this file.
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { apiUrl, clubForHost, effectiveHost, type PublicClub } from '@/lib/club-registry';

export type { PublicClub };

/**
 * The club this request is for. proxy.ts has already turned away hosts that
 * belong to no club, so notFound() here is a backstop, not the normal path.
 * cache(): one lookup per request however many components ask.
 */
export const currentClub = cache(async (): Promise<PublicClub> => {
  const club = await requestClub();
  if (!club) notFound();
  return club;
});

/** The same lookup without notFound(). */
export const requestClub = cache(
  async (): Promise<PublicClub | null> => clubForHost(effectiveHost((await headers()).get('host'))),
);

/**
 * Call the O House API as the signed-in user: their access token, and X-Club
 * so the API verifies it against this club's key.
 *
 * The token is read from the session cookie without re-verifying it here —
 * the API verifies it (signature, issuer, profile) and Postgres checks the
 * database token it mints behind that.
 */
export async function apiGet<T>(path: string, accessToken: string, extra: Record<string, string> = {}): Promise<T> {
  return apiCall<T>('GET', path, accessToken, undefined, extra);
}

export async function apiPost<T>(path: string, accessToken: string, body: object): Promise<T> {
  return apiCall<T>('POST', path, accessToken, body);
}

async function apiCall<T>(
  method: 'GET' | 'POST',
  path: string,
  accessToken: string,
  body?: object,
  extra: Record<string, string> = {},
): Promise<T> {
  const club = await currentClub();
  const res = await fetch(`${apiUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Club': club.slug,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export class ApiError extends Error {
  /** The API's error code ({code, message} body), when it sent one. */
  readonly code: string | null;
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`O House API ${status}: ${body.slice(0, 200)}`);
    let code: string | null = null;
    try {
      code = (JSON.parse(body) as { code?: string }).code ?? null;
    } catch {
      // not JSON: no code
    }
    this.code = code;
  }
}
