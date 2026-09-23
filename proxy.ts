import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clubForHost, effectiveHost, type PublicClub } from '@/lib/club-registry';

/**
 * Refreshes the Supabase session on every request and bounces anonymous
 * traffic to /login.
 *
 * This only checks that a session EXISTS. Whether that user may use the
 * portal at all (admin/manager, not cleaner) is decided in the portal layout,
 * which can read profiles.role — the proxy runs on the edge and a role read
 * per request would be a query on every asset. Next's own docs say the same:
 * this convention "should not be used as a full authorization solution".
 *
 * Named `proxy`, in proxy.ts, because Next 16 deprecated the `middleware`
 * convention and renamed it. Behaviour is identical; only the names changed.
 *
 * It first decides which club the host belongs to (lib/club-registry.ts):
 * each club is its own Supabase project, so the session is checked against
 * that club's. A host that belongs to no club gets a plain 404 — no login
 * page for an address nobody configured.
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

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    club.supabaseUrl,
    club.publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser(), not getSession(): getSession only decodes the cookie, while
  // getUser revalidates the token with Supabase. Do not remove — it is also
  // what triggers the refresh whose cookies are written above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith('/login');

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)',
  ],
};
