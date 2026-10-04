import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { cairo, montserrat } from './fonts';
import { brandCss, brandFor } from '@/lib/brand';
import { requestClub } from '@/lib/club';
import { getDictionary, getLocale, dir } from '@/lib/i18n';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import { AlertHost } from '@/components/ui/alert-dialog';
import './globals.css';

/** Per club: one deployment serves every club, so the tab names this one. */
export async function generateMetadata(): Promise<Metadata> {
  const club = await requestClub();
  const brand = brandFor(club?.slug);
  return {
    title: `${brand.appName.en} — Admin`,
    description: `Housekeeping assignments, review and staff for ${club?.name.en ?? brand.appName.en}`,
    icons: { icon: brand.logo.src },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, dict, store, club] = await Promise.all([getLocale(), getDictionary(), cookies(), requestClub()]);
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);

  // dir on <html> is the whole RTL mechanism — the same approach the old
  // portal used and the app gets from Directionality. Tailwind's logical
  // utilities (ms-/me-/text-start) mirror off it, so there are no
  // [dir=rtl] overrides anywhere in the stylesheet.
  //
  // data-theme works the same way: the palette swap is a specificity match on
  // this one attribute (see app/tokens.css), and because it is server-rendered
  // the right theme paints on the first frame with no flash.
  return (
    <html
      lang={locale}
      dir={dir(locale)}
      data-theme={theme}
      className={`${montserrat.variable} ${cairo.variable} h-full antialiased`}
    >
      <head>
        {/* The club's brand colours over app/tokens.css (lib/brand.ts):
            server-rendered like data-theme, so the first frame is already
            the right club. */}
        <style>{brandCss(brandFor(club?.slug))}</style>
      </head>
      <body className="flex min-h-full flex-col">
        {/* Nothing club-specific reaches the browser: sign-in and every query
            happen on the server (lib/actions/session.ts, lib/supabase/server.ts). */}
        {children}
        {/* One alert surface for the whole portal. Its two labels are passed
            in because the host is imperative and holds no dictionary. */}
        <AlertHost labels={{ ok: dict.ok, cancel: dict.cancel }} />
      </body>
    </html>
  );
}
