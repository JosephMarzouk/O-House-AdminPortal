import type { Metadata } from 'next';
import { cairo } from './fonts';
import { getLocale, dir } from '@/lib/i18n';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'O House — Admin',
  description: 'Housekeeping assignments, review and staff for O West Sports Club',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  // dir on <html> is the whole RTL mechanism — the same approach the old
  // portal used and the app gets from Directionality. Tailwind's logical
  // utilities (ms-/me-/text-start) mirror off it, so there are no
  // [dir=rtl] overrides anywhere in the stylesheet.
  return (
    <html
      lang={locale}
      dir={dir(locale)}
      className={`${cairo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
