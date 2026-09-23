/**
 * Which club a portal host belongs to, asked of the O House API — the one
 * club registry. No Next.js imports, so proxy.ts can use it as well as the
 * server components.
 *
 * Every club is its own Supabase project, so its URL and publishable key are
 * runtime data, not build-time NEXT_PUBLIC_* values: one portal deployment
 * serves every club, chosen by the host (<club>.<PORTAL_DOMAIN>, or a club's
 * own domain listed in the registry).
 */

export type PublicClub = {
  slug: string;
  code: string;
  name: { en: string; ar: string };
  logoUrl: string | null;
  supabaseUrl: string;
  publishableKey: string;
};

const TTL_MS = 5 * 60_000;
// ponytail: per-process memory; a new club shows up within TTL_MS without a
// redeploy. Negative answers are cached too, so a scan of random hosts costs
// the API one request per host per TTL, not one per page view.
const cache = new Map<string, { club: PublicClub | null; expires: number }>();

export function apiUrl(): string {
  const url = process.env.OHOUSE_API_URL;
  if (!url) throw new Error('OHOUSE_API_URL is not set');
  return url.replace(/\/+$/, '');
}

/**
 * CLUB_HOST replaces the request's host when set: `localhost` in development,
 * or a deployment that should always serve one club.
 */
export function effectiveHost(requestHost: string | null): string | null {
  return process.env.CLUB_HOST || requestHost;
}

export async function clubForHost(host: string | null): Promise<PublicClub | null> {
  if (!host) return null;
  const key = host.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.club;

  const res = await fetch(`${apiUrl()}/clubs/host/${encodeURIComponent(key)}`, { cache: 'no-store' });
  if (res.status === 404) {
    cache.set(key, { club: null, expires: Date.now() + TTL_MS });
    return null;
  }
  // Anything else is the API being unwell, not an unknown club: don't cache
  // it, and don't show a "no such club" page for an outage.
  if (!res.ok) throw new Error(`O House API answered ${res.status} for the club lookup`);
  const club = (await res.json()) as PublicClub;
  cache.set(key, { club, expires: Date.now() + TTL_MS });
  return club;
}
