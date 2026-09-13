/**
 * The portal's light/dark choice.
 *
 * Kept deliberately tiny and dependency-free — it is one attribute on <html>
 * and one cookie, which is why next-themes is not back in this project. The
 * cookie is read on the server in app/layout.tsx, so the correct theme is in
 * the first byte of HTML and there is no flash and no blocking inline script.
 *
 * No import of next/headers here: a client component reads this module too.
 */

export const THEME_COOKIE = 'theme';

export const themes = ['light', 'dark'] as const;
export type Theme = (typeof themes)[number];

export const defaultTheme: Theme = 'light';

export function isTheme(value: unknown): value is Theme {
  return themes.includes(value as Theme);
}

/** Never trust the raw cookie — anything unrecognised falls back to light. */
export function parseTheme(value: string | undefined): Theme {
  return isTheme(value) ? value : defaultTheme;
}
