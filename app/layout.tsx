import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { cairo } from './fonts';
import { getDictionary, getLocale, dir } from '@/lib/i18n';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import { AlertHost } from '@/components/ui/alert-dialog';
import './globals.css';

export const metadata: Metadata = {
  title: 'O House — Admin',
  description: 'Housekeeping assignments, review and staff for O West Sports Club',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, dict, store] = await Promise.all([getLocale(), getDictionary(), cookies()]);
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
      className={`${cairo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {/* One alert surface for the whole portal. Its two labels are passed
            in because the host is imperative and holds no dictionary. */}
        <AlertHost labels={{ ok: dict.ok, cancel: dict.cancel }} />
      </body>
    </html>
  );
}
