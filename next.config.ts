import type { NextConfig } from 'next';

/**
 * Response headers for every route.
 *
 * Deliberately NOT a full Content-Security-Policy. A real script-src on an
 * App Router page needs per-request nonces threaded through the proxy and
 * every inline script, and getting it wrong fails closed — a blank portal.
 * `frame-ancestors` is the half that costs nothing: it is ignored by
 * <script>, so it cannot break rendering, and it is the directive that
 * actually matters here, since the risk an admin portal carries is being
 * framed by someone else's page and clickjacked into a role change.
 *
 * X-Frame-Options says the same thing for browsers predating frame-ancestors.
 */
const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Supabase project URLs are the referrer's whole value on an outbound
  // request; send the origin only, and nothing at all when downgrading.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The portal asks for none of these. Denying them up front means an
  // injected script cannot either.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Two years, and the portal is HTTPS-only in every environment it runs in.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // Nothing gains from advertising the framework and version.
  poweredByHeader: false,

  // Dev only. The dev terminal prints every Server Function call with its
  // arguments, which put the sign-in password in clear text in the log.
  logging: { serverFunctions: false },

  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
