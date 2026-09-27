import { NextResponse, type NextRequest } from 'next/server';
import { clubForHost, effectiveHost, type PublicClub } from '@/lib/club-registry';
import {
  ACCESS_COOKIE,
  authPost,
  expiresAt,
  REFRESH_COOKIE,
  sessionCookies,
} from '@/lib/session';

/** Refresh a little before the access token runs out, so a page never renders on a dying one. */
const REFRESH_EARLY_MS = 60_000;

/**
 * Keeps the sign-in session fresh on every request and bounces anonymous
 * traffic to /login.
 *
 * The session is the API's own two tokens (lib/session.ts). When the access
 * token is missing or about to expire and a refresh token is there, it is
 * refreshed here, before the page renders, and both cookies are rewritten —
 * on the response for the browser, and on the request so this same render
 * already sees the new ones.
 *
 * This only checks that a session EXISTS. Whether that user may use the
 * portal at all (admin/manager, not cleaner) is decided in the portal layout,
 * which reads profiles.role. The API verifies every token it is given.
 *
 * Named `proxy`, in proxy.ts: Next 16's name for middleware.
 *
 * It first decides which club the host belongs to (lib/club-registry.ts). A
 * host that belongs to no club gets a plain 404 — no login page for an
 * address nobody configured.
 */
export async function proxy(request: NextRequest) {
  let club: PublicClub | null;
  try {
    club = await clubForHost(effectiveHost(request.headers.get('host')));
  } catch {
    // The API is down: say so rather than pretending the club does not exist.
    return new NextResponse('Service temporarily unavailable', { status: 503 });
  }
  if (!club) return new NextResponse('Not found', { status: 404 });

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let signedIn = expiresAt(access) > Date.now() + REFRESH_EARLY_MS;
  let fresh: ReturnType<typeof sessionCookies> | null = null;

  if (!signedIn && refresh) {
    try {
      const res = await authPost(club.slug, '/auth/refresh', { refreshToken: refresh });
      if (res.status === 200 && res.data) {
        fresh = sessionCookies(res.data);
        signedIn = true;
      }
    } catch {
      // API unreachable: the page will say so; don't sign anyone out for it.
      return new NextResponse('Service temporarily unavailable', { status: 503 });
    }
  }

  const isLogin = request.nextUrl.pathname.startsWith('/login');
  let response: NextResponse;
  if (!signedIn && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    response = NextResponse.redirect(url);
  } else if (signedIn && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    response = NextResponse.redirect(url);
  } else {
    if (fresh) for (const [name, value] of fresh) request.cookies.set(name, value);
    response = NextResponse.next({ request });
  }

  // Supabase sign-in cookies from before our own sign-in (sb-<ref>-auth-token,
  // and its .0/.1 chunks). Nothing reads them any more, and unlike ours they
  // are readable by page scripts and hold a live Supabase refresh token.
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-')) response.cookies.delete(c.name);
  }

  if (fresh) {
    for (const [name, value, options] of fresh) response.cookies.set(name, value, options);
  } else if (!signedIn && (access || refresh)) {
    // A dead session: clear it, so the next request does not try it again.
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)',
  ],
};
