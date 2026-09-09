import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getProfile, canUsePortal } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
import { PortalNav } from '@/components/portal-nav';
import { PortalHeaderActions } from '@/components/portal-header-actions';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [profile, dict, locale] = await Promise.all([getProfile(), getDictionary(), getLocale()]);

  // middleware already bounced anonymous traffic; this catches the case where
  // a session exists but the profiles row does not (a state this project has
  // hit before, which is exactly what current_role() returning 'none' guards).
  if (!profile) redirect('/login');

  // Role gate lives here, not in middleware: reading profiles.role on the edge
  // would mean a query per request, including every asset.
  if (!canUsePortal(profile.role)) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm bg-card p-6 text-center shadow-[var(--shadow-broadsheet)]">
          <p className="mb-4">{dict.notAuthorized}</p>
          <PortalHeaderActions dict={dict} locale={locale} />
        </div>
      </main>
    );
  }

  const isAdmin = profile.role === 'admin';

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 shrink-0 flex-col gap-6 bg-sidebar p-4 text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-1">
          <Image
            src="/owest.png"
            alt=""
            width={32}
            height={32}
            className="rounded-[var(--radius)]"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold">{dict.appName}</div>
            <div className="text-xs text-[var(--accent-300)]">{dict.appSubtitle}</div>
          </div>
        </div>

        <PortalNav dict={dict} isAdmin={isAdmin} />

        <div className="mt-auto px-1">
          <div className="text-sm font-semibold">{profile.name}</div>
          <div className="text-xs text-[var(--sidebar-foreground)]/60">
            {isAdmin ? dict.roleAdmin : dict.roleManager}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b bg-card px-6 py-2.5">
          <PortalHeaderActions dict={dict} locale={locale} />
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
