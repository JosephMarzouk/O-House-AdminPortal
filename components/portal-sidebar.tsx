'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Drawer } from '@base-ui/react/drawer';
import {
  BuildingsIcon,
  CalendarIcon,
  ClipboardIcon,
  HouseIcon,
  InfoIcon,
  KanbanIcon,
  ListIcon,
  MapPinIcon,
  SidebarIcon,
  SignOutIcon,
  TranslateIcon,
  UsersIcon,
} from '@/components/icons';
import { useSignOut } from '@/lib/use-sign-out';
import { setLocale } from '@/lib/actions/locale';
import { ThemeToggle } from '@/components/theme-toggle';
import { BrandMark } from '@/components/brand-mark';
import { LinkPending } from '@/components/ui/link-pending';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';
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
 *
 * Two surfaces, one body. From `md` up it is the sticky aside it always was.
 * Below that there is no room beside the page for even the 64px rail, so a
 * thin ink bar sits on top with a menu button, and the same nav opens from the
 * start edge as a Base UI Drawer — swiped back the way it came, which is the
 * left edge in English and the right in Arabic.
 */
export function PortalSidebar({
  dict,
  locale,
  canManageUsers,
  canSchedule,
  canEditClubPages,
  userName,
  roleLabel,
  initialCollapsed,
  initialTheme,
}: {
  dict: Dictionary;
  locale: Locale;
  canManageUsers: boolean;
  /** Admins and managers: the Rounds screen plans work for other people. */
  canSchedule: boolean;
  /** Admins: the staff app's About and Policies text. */
  canEditClubPages: boolean;
  userName: string;
  roleLabel: string;
  initialCollapsed: boolean;
  initialTheme: Theme;
}) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    { href: '/tracker', label: dict.navTracker, Icon: KanbanIcon },
    { href: '/assignments', label: dict.navAssignments, Icon: ClipboardIcon },
    // Admins and managers: planning a week assigns other people's work, and
    // schedule_rounds() refuses anyone else in the database too.
    ...(canSchedule ? [{ href: '/rounds', label: dict.navRounds, Icon: CalendarIcon }] : []),
    { href: '/places', label: dict.navPlaces, Icon: MapPinIcon },
    { href: '/departments', label: dict.navDepartments, Icon: BuildingsIcon },
    // Admins and managers. An inspector is a portal user but not a staff
    // administrator, and the page and the RPC behind it both say so too —
    // this row only spares them a dead end.
    ...(canManageUsers ? [{ href: '/users', label: dict.navUsers, Icon: UsersIcon }] : []),
    ...(canEditClubPages ? [{ href: '/club-pages', label: dict.navClubPages, Icon: InfoIcon }] : []),
  ];

  /**
   * The drawer's contents, for either surface. `rail` is the collapsed 64px
   * state and only ever applies to the aside. `onNavigate` is the phone
   * drawer's close: a link that routes must also put the drawer away, and the
   * collapse button means nothing there, so its presence also drops that row.
   */
  function body(rail: boolean, onNavigate?: () => void) {
    const rowClass = (active: boolean) =>
      cn(
        // relative anchors <LinkPending />'s dot, which is absolute so it costs
        // no width in the collapsed rail.
        'relative flex min-h-control items-center gap-3 rounded-control px-3 text-base transition-colors',
        '[&_svg]:size-icon [&_svg]:shrink-0',
        rail && 'justify-center px-0',
        active
          ? 'bg-on-brand/10 font-semibold text-accent-300'
          : 'text-on-brand/70 hover:bg-on-brand/7 hover:text-on-brand',
      );

    return (
      <>
        {/* The logo and the wordmark together are the brand block. Collapsed,
            the logo stands alone — an initial beside it would be redundant —
            so the link needs an explicit name to replace the one the wordmark
            was giving it. */}
        <Link
          href="/"
          aria-label={dict.appName}
          onClick={onNavigate}
          className={cn('flex min-w-0 items-center gap-3 px-3', rail && 'justify-center px-0')}
        >
          {/* No rounded-card any more: the mark is drawn in currentColor, so
              there is no longer a box to round off. */}
          <BrandMark className="size-logo shrink-0" />
          {!rail && (
            <div className="min-w-0">
              <div className="truncate text-brand">{dict.appName}</div>
              <div className="truncate text-caption text-on-brand/55">{dict.appSubtitle}</div>
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
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                // The label is the only affordance when collapsed, so it has to
                // survive as a tooltip and for screen readers.
                title={rail ? label : undefined}
                aria-label={rail ? label : undefined}
                className={rowClass(active)}
              >
                <Icon />
                {!rail && <span className="truncate">{label}</span>}
                <LinkPending />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col">
          {!rail && (
            <div className="mb-2 min-w-0 px-3">
              <div className="truncate text-sm font-semibold">{userName}</div>
              <div className="truncate text-caption text-on-brand/55">{roleLabel}</div>
            </div>
          )}

          <button
            type="button"
            disabled={pending}
            title={rail ? dict.language : undefined}
            className={rowClass(false)}
            onClick={() => startTransition(() => setLocale(locale === 'ar' ? 'en' : 'ar'))}
          >
            <TranslateIcon />
            {!rail && <span className="truncate">{dict.language}</span>}
          </button>

          <ThemeToggle
            initialTheme={initialTheme}
            collapsed={rail}
            className={rowClass(false)}
            labels={{ dark: dict.themeDark, light: dict.themeLight }}
          />

          <button
            type="button"
            title={rail ? dict.signOut : undefined}
            className={rowClass(false)}
            onClick={signOut}
          >
            <SignOutIcon />
            {!rail && <span className="truncate">{dict.signOut}</span>}
          </button>

          {!onNavigate && (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!rail}
              title={rail ? dict.expandSidebar : dict.collapseSidebar}
              aria-label={rail ? dict.expandSidebar : dict.collapseSidebar}
              className={rowClass(false)}
            >
              {/* The panel icon is directional, so mirror it under RTL. */}
              <SidebarIcon className="rtl:-scale-x-100" />
              {!rail && <span className="truncate">{dict.collapseSidebar}</span>}
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Phones and small tablets: an ink bar the height of a primary control,
          sticky so the menu is one tap away however far the page scrolls. */}
      <header className="sticky top-0 z-40 flex h-control-lg items-center gap-2 bg-ink px-2 text-on-brand md:hidden">
        <Drawer.Root
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          // The drawer enters from the start edge, so it is dismissed by
          // swiping back towards it.
          swipeDirection={locale === 'ar' ? 'right' : 'left'}
        >
          <Drawer.Trigger
            aria-label={dict.openMenu}
            className="flex size-control items-center justify-center rounded-control text-on-brand/70 transition-colors hover:bg-on-brand/7 hover:text-on-brand [&_svg]:size-icon"
          >
            <ListIcon />
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Backdrop className="fixed inset-0 z-50 bg-neutral-900/50 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            {/* justify-start is logical under flex, so the panel sits at the
                start edge in both languages without a branch. */}
            <Drawer.Viewport className="fixed inset-0 z-50 flex items-stretch justify-start">
              <Drawer.Popup
                className={cn(
                  'flex h-full w-sidebar max-w-lane flex-col overflow-y-auto overscroll-contain',
                  'rounded-e-tile bg-ink px-3 py-6 text-on-brand shadow-lg shadow-(color:--color-shade) outline-none',
                  // Follows the finger while swiping, slides in and out from
                  // its own edge otherwise — mirrored for Arabic.
                  '[transform:translateX(var(--drawer-swipe-movement-x))] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                  'data-swiping:select-none',
                  'data-starting-style:[transform:translateX(-100%)] data-ending-style:[transform:translateX(-100%)]',
                  'rtl:data-starting-style:[transform:translateX(100%)] rtl:data-ending-style:[transform:translateX(100%)]',
                )}
              >
                <Drawer.Content className="flex min-h-full flex-col gap-8">
                  <Drawer.Title className="sr-only">{dict.appName}</Drawer.Title>
                  {body(false, () => setDrawerOpen(false))}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>

        <Link href="/" className="flex min-w-0 items-center gap-2">
          <BrandMark className="size-logo shrink-0" />
          <span className="truncate text-brand">{dict.appName}</span>
        </Link>
      </header>

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
        //
        // hidden md:flex — below md the ink bar above stands in for it.
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col gap-8 self-start overflow-x-hidden overflow-y-auto md:flex',
          'rounded-e-tile bg-ink px-3 py-6 text-on-brand',
          collapsed ? 'w-rail' : 'w-sidebar',
        )}
      >
        {body(collapsed)}
      </aside>
    </>
  );
}
