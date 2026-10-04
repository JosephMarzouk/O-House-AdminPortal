import { redirect } from 'next/navigation';
import { signOut } from '@/lib/actions/session';

/**
 * Where the portal layout sends a session whose profile it cannot load.
 *
 * Without this the portal looped forever (ERR_TOO_MANY_REDIRECTS, 1 Oct, on
 * the Railway test deploy): proxy.ts calls a request signed in when the access
 * cookie has not expired, without asking the API, so it let `/` through; the
 * layout could not load the profile (the API refused /auth/db-token over a
 * gateway-key mismatch) and redirected to /login; and the proxy, seeing the
 * same unexpired cookie on /login, redirected back to `/`. Each check was
 * right on its own evidence, and nothing broke the tie.
 *
 * This breaks it: the session is ended for real (the refresh token revoked at
 * the API, both cookies dropped), so the proxy has nothing to bounce back on,
 * and the login page says why the user is there. A Route Handler, not the
 * layout, because a Server Component cannot change cookies.
 *
 * GET because it is the target of a redirect. Anyone can link here and so
 * sign a visitor out, which costs that visitor a sign-in and nothing else.
 */
export async function GET() {
  await signOut();
  redirect('/login?ended=1');
}
