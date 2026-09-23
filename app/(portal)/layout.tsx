import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getProfile, canEditClubPages, canManageUsers, canSchedule, canUsePortal } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import { PortalSidebar, SIDEBAR_COOKIE } from '@/components/portal-sidebar';
import { SignOutButton } from '@/components/sign-out-button';
import { PageBody, PageHeader } from '@/components/ui/page-header';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [profile, dict, locale, store] = await Promise.all([
    getProfile(),
    getDictionary(),
    getLocale(),
    cookies(),
  ]);

  // the proxy already bounced anonymous traffic; this catches the case where
  // a session exists but the profiles row does not — the state that
  // current_role() returning 'none' now guards against server-side.
  if (!profile) redirect('/login');

  // Role gate lives here, not in the proxy: reading profiles.role on the edge
  // would mean a query per request, including every asset.
  if (!canUsePortal(profile.role)) {
    return (
      <main className="min-h-dvh">
        <PageHeader kicker={dict.appSubtitle} title={dict.appName} subtitle={dict.notAuthorized} />
        <PageBody>
          <SignOutButton label={dict.signOut} />
        </PageBody>
      </main>
    );
  }

  // The sidebar's Users row, and nothing else. What a manager may do once on
  // that screen is decided there and in lib/actions/users.ts.
  const manages = canManageUsers(profile.role);

  // Every non-admin used to read as "Manager" here, which quietly mislabelled
  // every inspector in the portal. Three roles reach this layout, so the label
  // has to answer for three.
  const roleLabel =
    profile.role === 'admin'
      ? dict.roleAdmin
      : profile.role === 'manager'
        ? dict.roleManager
        : dict.roleInspector;

  return (
    // A column on phones (the sidebar's ink bar on top of the page), a row
    // from md up (the sticky aside beside it).
    <div className="flex min-h-dvh flex-col md:flex-row">
      <PortalSidebar
        dict={dict}
        locale={locale}
        canManageUsers={manages}
        canSchedule={canSchedule(profile.role)}
        canEditClubPages={canEditClubPages(profile.role)}
        userName={profile.name}
        roleLabel={roleLabel}
        initialCollapsed={store.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
        initialTheme={parseTheme(store.get(THEME_COOKIE)?.value)}
      />
      {/* No padding here: PageHeader and PageBody bring their own gutters, so
          they stay the single place the page's left edge is decided — the
          not-authorized branch above renders them inside a different <main>
          and has to line up with the rest. */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
