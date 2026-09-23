import 'server-only';
import { apiGet, ApiError } from '@/lib/club';
import { createClient } from '@/lib/supabase/server';

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

export async function roundMedia(assignmentId: string): Promise<MediaLookup> {
  const supabase = await createClient();
  // getSession, not getUser: this only forwards the token. The API verifies
  // it against the club's keys, and Postgres verifies it again behind that.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return () => null;

  try {
    const { media } = await apiGet<{ media: Record<string, string | null> }>(
      `/assignments/${encodeURIComponent(assignmentId)}`,
      session.access_token,
    );
    return (stored) => (stored ? (media[stored] ?? null) : null);
  } catch (e) {
    // Media is secondary: an API outage renders the round without its photos
    // (placeholders) rather than failing the whole page.
    console.error('[media]', e instanceof ApiError ? e.message : e);
    return () => null;
  }
}
