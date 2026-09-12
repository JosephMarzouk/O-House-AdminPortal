import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getProfile, canUsePortal } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
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

  // middleware already bounced anonymous traffic; this catches the case where
  // a session exists but the profiles row does not — the state that
  // current_role() returning 'none' now guards against server-side.
  if (!profile) redirect('/login');

  // Role gate lives here, not in middleware: reading profiles.role on the edge
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

  const isAdmin = profile.role === 'admin';

  return (
    <div className="flex min-h-dvh">
      <PortalSidebar
        dict={dict}
        locale={locale}
        isAdmin={isAdmin}
        userName={profile.name}
        roleLabel={isAdmin ? dict.roleAdmin : dict.roleManager}
        initialCollapsed={store.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
      />
      {/* No padding here: every page opens with the ink header block, which
          must sit flush with the top of the viewport. The paper body brings
          its own margins (PageBody). */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
