'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
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
 * The drawer carries the brand: it is the one dark surface in the portal,
 * and the logo sits at its top. Pages used to open with an ink header block
 * doing that job; this took it over when the header moved onto the paper.
 *
 * On ink, base cyan is only 3.9:1 — it cannot be the active label. accent-300
 * is 11:1 and is a ramp step rather than an ad-hoc alpha, so it is the accent
 * tone for this surface. The active row also gets a faint paper wash, so the
 * state does not rest on colour alone.
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
      active
        ? 'bg-paper/10 font-semibold text-accent-300'
        : 'text-paper/70 hover:bg-paper/7 hover:text-paper',
    );

  return (
    <aside
      // Four classes do the pinning, in order:
      //
      // h-dvh    — the one that matters. The parent is `flex min-h-dvh`, and
      //   its default stretch would otherwise give this a height equal to the
      //   whole page, leaving sticky nothing to pin. Stretch only applies to an
      //   auto height, so an explicit one releases it. Measured in the browser:
      //   after scrolling 1500px the aside sits at top 0, bottom 900 on a 900px
      //   viewport.
      // self-start — belt and braces. h-dvh already defeats stretch, so this
      //   changes nothing today; it keeps the pin working if the height is ever
      //   relaxed to auto or a min-height.
      // sticky top-0 — so every nav icon stays on screen however far the page
      //   scrolls, which is the whole point.
      // overflow-y-auto — replaces a blanket overflow-hidden. The clipping was
      //   only ever needed horizontally, for labels during the width snap; left
      //   vertical it would cut off the bottom rows on a short viewport, which
      //   is exactly the failure this is meant to prevent. Now the drawer
      //   scrolls itself only when the viewport is genuinely too short for it.
      //
      // No ancestor sets overflow (the flex row, body and html are all clean),
      // so sticky resolves against the viewport. Do not add one.
      //
      // Width still snaps between two token widths with no transition.
      // Animating width here left the element stuck at its previous size — the
      // labels and icons swapped correctly but the box never resized. Snapping
      // is honest and has no failure mode; if this ever wants animation,
      // animate a wrapper's transform, not width.
      // rounded-e-tile rounds the edge that faces the content — the right side
      // in English, mirrored to the left in Arabic, because `e` is the logical
      // inline end and this codebase mirrors on `dir` alone. The outer edge
      // stays square against the viewport.
      className={cn(
        'sticky top-0 flex h-dvh shrink-0 flex-col gap-8 self-start overflow-x-hidden overflow-y-auto',
        'rounded-e-tile bg-ink px-3 py-6 text-paper',
        collapsed ? 'w-rail' : 'w-sidebar',
      )}
    >
      {/* The logo and the wordmark together are the brand block. Collapsed,
          the logo stands alone — an initial beside it would be redundant —
          so the link needs an explicit name to replace the one the wordmark
          was giving it. */}
      <Link
        href="/"
        aria-label={dict.appName}
        className={cn('flex min-w-0 items-center gap-3 px-3', collapsed && 'justify-center px-0')}
      >
        {/* width/height are next/image's intrinsic size, not a style — the
            rendered box is size-logo from the tokens. */}
        <Image
          src="/owest.png"
          alt=""
          width={32}
          height={32}
          priority
          className="size-logo shrink-0 rounded-card"
        />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-brand">{dict.appName}</div>
            <div className="truncate text-caption text-paper/55">{dict.appSubtitle}</div>
          </div>
        )}
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
            <div className="truncate text-caption text-paper/55">{roleLabel}</div>
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
