import 'server-only';
import { cookies } from 'next/headers';
import { apiGet, ApiError } from '@/lib/club';
import { ACCESS_COOKIE } from '@/lib/session';

/**
 * Photos and signatures, as short-lived signed links from the O House API.
 *
 * The bucket is going private, so there is no public URL to build any more
 * (this file used to build them). The API reads the round AS the signed-in
 * user — RLS decides whether they may see it — and only then signs its paths.
 * Nothing here holds a storage key.
 *
 * Stored values come in several shapes (bare bucket paths, and full public
 * URLs the legacy web client wrote into signature_url); the API resolves all
 * of them, and its map is keyed by the value exactly as stored, so the page
 * looks up what it already holds.
 */
export type MediaLookup = (stored: string | null | undefined) => string | null;

/** A camera clip rather than a photo: `….mp4`, before any signed-link query. */
export const isVideo = (url: string) => /\.mp4(\?|$)/i.test(url);

export async function roundMedia(assignmentId: string): Promise<MediaLookup> {
  // The sign-in cookie is only forwarded: the API verifies it, reads the
  // round as this person, and signs only what RLS let them see.
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return () => null;

  try {
    const { media } = await apiGet<{ media: Record<string, string | null> }>(
      `/assignments/${encodeURIComponent(assignmentId)}`,
      access,
    );
    return (stored) => (stored ? (media[stored] ?? null) : null);
  } catch (e) {
    // Media is secondary: an API outage renders the round without its photos
    // (placeholders) rather than failing the whole page.
    console.error('[media]', e instanceof ApiError ? e.message : e);
    return () => null;
  }
}
