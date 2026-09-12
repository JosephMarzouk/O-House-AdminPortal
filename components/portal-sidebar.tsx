'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BuildingsIcon,
  ClipboardIcon,
  HouseIcon,
  MapPinIcon,
  SidebarIcon,
  SignOutIcon,
  TranslateIcon,
  UsersIcon,
} from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { setLocale } from '@/lib/actions/locale';
import { cn } from '@/lib/utils';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export const SIDEBAR_COOKIE = 'sidebar';

/**
 * Navigation on paper, in the serif, with the active item in cyan and no
 * dividers anywhere — the ink is reserved for each page's header block, so
 * the sidebar stays quiet and the header carries the brand.
 */
export function PortalSidebar({
  dict,
  locale,
  isAdmin,
  userName,
  roleLabel,
  initialCollapsed,
}: {
  dict: Dictionary;
  locale: Locale;
  isAdmin: boolean;
  userName: string;
  roleLabel: string;
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Seeded from a cookie the server already read, so the correct width paints
  // on first frame — no flash of the wrong layout on every navigation.
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'expanded'}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; samesite=lax`;
  }

  const items = [
    { href: '/', label: dict.navDashboard, Icon: HouseIcon },
    { href: '/assignments', label: dict.navAssignments, Icon: ClipboardIcon },
    { href: '/places', label: dict.navPlaces, Icon: MapPinIcon },
    { href: '/departments', label: dict.navDepartments, Icon: BuildingsIcon },
    // set_user_role is admin-only and staff creation needs the service key,
    // so a manager would find nothing but disabled controls here.
    ...(isAdmin ? [{ href: '/users', label: dict.navUsers, Icon: UsersIcon }] : []),
  ];

  const rowClass = (active: boolean) =>
    cn(
      'flex min-h-control items-center gap-3 rounded-control px-3 text-base transition-colors',
      '[&_svg]:size-icon [&_svg]:shrink-0',
      collapsed && 'justify-center px-0',
      active ? 'font-semibold text-cyan' : 'text-text/70 hover:bg-text/7 hover:text-text',
    );

  return (
    <aside
      // Width snaps between two token widths with no transition. Animating
      // width here left the element stuck at its previous size — the labels
      // and icons swapped correctly but the box never resized. Snapping is
      // honest and has no failure mode; if this ever wants animation, animate
      // a wrapper's transform, not width.
      className={cn(
        'flex shrink-0 flex-col gap-8 overflow-hidden bg-paper px-3 py-6',
        collapsed ? 'w-rail' : 'w-sidebar',
      )}
    >
      {/* Wordmark in the serif — the logo itself lives in the ink header. */}
      <Link
        href="/"
        className={cn('block min-w-0 px-3 text-ink', collapsed && 'px-0 text-center')}
      >
        <div className="truncate text-brand">{collapsed ? dict.appName.slice(0, 1) : dict.appName}</div>
        {!collapsed && <div className="truncate text-caption text-text/55">{dict.appSubtitle}</div>}
      </Link>

      <nav className="flex flex-col">
        {items.map(({ href, label, Icon }) => {
          // '/' needs its own case: every pathname startsWith('/'), so the
          // prefix rule would light up the dashboard on every route — and
          // alongside whichever row is genuinely active.
          const active =
            href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              // The label is the only affordance when collapsed, so it has to
              // survive as a tooltip and for screen readers.
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={rowClass(active)}
            >
              <Icon />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col">
        {!collapsed && (
          <div className="mb-2 min-w-0 px-3">
            <div className="truncate text-sm font-semibold">{userName}</div>
            <div className="truncate text-caption text-text/55">{roleLabel}</div>
          </div>
        )}

        <button
          type="button"
          disabled={pending}
          title={collapsed ? dict.language : undefined}
          className={rowClass(false)}
          onClick={() => startTransition(() => setLocale(locale === 'ar' ? 'en' : 'ar'))}
        >
          <TranslateIcon />
          {!collapsed && <span className="truncate">{dict.language}</span>}
        </button>

        <button
          type="button"
          title={collapsed ? dict.signOut : undefined}
          className={rowClass(false)}
          onClick={async () => {
            await createClient().auth.signOut();
            router.refresh();
            router.push('/login');
          }}
        >
          <SignOutIcon />
          {!collapsed && <span className="truncate">{dict.signOut}</span>}
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          title={collapsed ? dict.expandSidebar : dict.collapseSidebar}
          aria-label={collapsed ? dict.expandSidebar : dict.collapseSidebar}
          className={rowClass(false)}
        >
          {/* The panel icon is directional, so mirror it under RTL. */}
          <SidebarIcon className="rtl:-scale-x-100" />
          {!collapsed && <span className="truncate">{dict.collapseSidebar}</span>}
        </button>
      </div>
    </aside>
  );
}
