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

/** The same lookup without notFound(), for the root layout: the not-found page renders inside it. */
export const requestClub = cache(
  async (): Promise<PublicClub | null> => clubForHost(effectiveHost((await headers()).get('host'))),
);

/**
 * GET from the O House API as the signed-in user: their access token, and
 * X-Club so the API verifies it against this club's keys.
 *
 * The token is read from the session cookie without re-verifying it here —
 * the API verifies it (JWKS, issuer, profile) and so does Postgres behind it.
 */
export async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const club = await currentClub();
  const res = await fetch(`${apiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Club': club.slug },
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`O House API ${status}: ${body.slice(0, 200)}`);
  }
}
