import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { can, getProfile } from '@/lib/auth';
import { brandFor } from '@/lib/brand';
import { requestClub } from '@/lib/club';
import { bilingual, getDictionary, getLocale } from '@/lib/i18n';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import { PortalSidebar, SIDEBAR_COOKIE } from '@/components/portal-sidebar';
import { SignOutButton } from '@/components/sign-out-button';
import { PageBody, PageHeader } from '@/components/ui/page-header';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [profile, dict, locale, store, club] = await Promise.all([
    getProfile(),
    getDictionary(),
    getLocale(),
    cookies(),
    requestClub(),
  ]);

  // the proxy already bounced anonymous traffic; this catches the case where
  // a session exists but the profiles row does not — the state that
  // current_role() returning 'none' now guards against server-side.
  if (!profile) redirect('/login');

  // Role gate lives here, not in the proxy: reading the role on the edge
  // would mean a query per request, including every asset. No access at all
  // (inactive, or no role) fails this too.
  const access = profile.access;
  if (!access || !can(profile, 'portal.view')) {
    return (
      <main className="min-h-dvh">
        <PageHeader kicker={dict.appSubtitle} title={dict.appName} subtitle={dict.notAuthorized} />
        <PageBody>
          <SignOutButton label={dict.signOut} />
        </PageBody>
      </main>
    );
  }

  return (
    // A column on phones (the sidebar's ink bar on top of the page), a row
    // from md up (the sticky aside beside it).
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* `contents` keeps the sidebar a direct flex child; print:hidden keeps
          it out of an exported report. */}
      <div className="contents print:hidden">
        <PortalSidebar
          dict={dict}
          locale={locale}
          permissions={access.permissions}
          userName={profile.name}
          roleLabel={bilingual(locale, access.role.name_ar, access.role.name_en)}
          initialCollapsed={store.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
          initialTheme={parseTheme(store.get(THEME_COOKIE)?.value)}
          logo={brandFor(club?.slug).logo}
        />
      </div>
      {/* No padding here: PageHeader and PageBody bring their own gutters, so
          they stay the single place the page's left edge is decided — the
          not-authorized branch above renders them inside a different <main>
          and has to line up with the rest. */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
