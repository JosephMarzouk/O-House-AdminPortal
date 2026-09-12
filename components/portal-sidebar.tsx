'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Users,
  Building2,
  Languages,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { setLocale } from '@/lib/actions/locale';
import { cn } from '@/lib/utils';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';

export const SIDEBAR_COOKIE = 'sidebar';

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
    { href: '/', label: dict.navDashboard, Icon: LayoutDashboard },
    { href: '/assignments', label: dict.navAssignments, Icon: ClipboardList },
    { href: '/places', label: dict.navPlaces, Icon: MapPin },
    { href: '/departments', label: dict.navDepartments, Icon: Building2 },
    // set_user_role is admin-only and staff creation needs the service key,
    // so a manager would find nothing but disabled controls here.
    ...(isAdmin ? [{ href: '/users', label: dict.navUsers, Icon: Users }] : []),
  ];

  const rowClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors',
      collapsed && 'justify-center px-0',
      active
        ? 'bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)]'
        : 'text-[var(--sidebar-foreground)]/75 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]',
    );

  return (
    <aside
      // Width is an inline style rather than a w-* class, and there is no
      // width transition. Animating width here left the element stuck at its
      // previous size — the labels and icons swapped correctly but the box
      // never resized. Snapping is honest and has no failure mode; if this
      // ever wants animation, animate a wrapper's transform, not width.
      style={{ width: collapsed ? '4rem' : '15rem', minWidth: 0 }}
      className={cn(
        'flex shrink-0 flex-col gap-6 overflow-hidden bg-sidebar p-3',
        'text-sidebar-foreground',
      )}
    >
      <div className={cn('flex items-center gap-2.5 px-1', collapsed && 'justify-center px-0')}>
        <Image
          src="/owest.png"
          alt=""
          width={32}
          height={32}
          className="shrink-0 rounded-[var(--radius)]"
        />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{dict.appName}</div>
            <div className="truncate text-xs text-[var(--accent-300)]">{dict.appSubtitle}</div>
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map(({ href, label, Icon }) => {
          // '/' needs its own case: every pathname startsWith('/'), so the
          // prefix rule would light up the dashboard on every route — and
          // alongside whichever row is genuinely active.
          const active =
            href === '/'
              ? pathname === '/'
              : pathname === href || pathname.startsWith(`${href}/`);
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
              <Icon className="size-4 shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-[var(--sidebar-border)] pt-3">
        {!collapsed && (
          <div className="mb-1 min-w-0 px-3">
            <div className="truncate text-sm font-semibold">{userName}</div>
            <div className="truncate text-xs text-[var(--sidebar-foreground)]/60">{roleLabel}</div>
          </div>
        )}

        <button
          type="button"
          disabled={pending}
          title={collapsed ? dict.language : undefined}
          className={rowClass(false)}
          onClick={() => startTransition(() => setLocale(locale === 'ar' ? 'en' : 'ar'))}
        >
          <Languages className="size-4 shrink-0" aria-hidden />
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
          <LogOut className="size-4 shrink-0" aria-hidden />
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
          {/* The panel icons are directional, so mirror them under RTL. */}
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
          )}
          {!collapsed && <span className="truncate">{dict.collapseSidebar}</span>}
        </button>
      </div>
    </aside>
  );
}
