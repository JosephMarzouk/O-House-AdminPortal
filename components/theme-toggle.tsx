'use client';

import { useState } from 'react';
import { MoonIcon, SunIcon } from '@/components/icons';
import { THEME_COOKIE, type Theme } from '@/lib/theme';

/**
 * Light/dark, switched from the drawer.
 *
 * Follows the sidebar-collapse pattern rather than the locale one. Locale goes
 * through a Server Action and revalidatePath because it changes the dictionary,
 * `dir` and a database column; a colour swap changes one attribute, so this
 * writes it straight to the DOM and the cookie. No round trip, no re-render of
 * the tree, and the cookie exists only to seed the next server render.
 *
 * `initialTheme` comes from the server, which already read the cookie for
 * <html data-theme>, so the first client render agrees with the SSR markup and
 * nothing flashes.
 */
export function ThemeToggle({
  initialTheme,
  collapsed,
  className,
  labels,
}: {
  initialTheme: Theme;
  collapsed: boolean;
  /** The shared drawer row class — passed in so this is visually one of the group. */
  className: string;
  labels: { dark: string; light: string };
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // The label and icon name the destination, not the current state.
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? labels.dark : labels.light;
  const Icon = next === 'dark' ? MoonIcon : SunIcon;

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        // The palette is keyed off this attribute in app/tokens.css, so setting
        // it repaints immediately.
        document.documentElement.dataset.theme = next;
        document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${
          60 * 60 * 24 * 365
        }; samesite=lax`;
      }}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={className}
    >
      <Icon />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
