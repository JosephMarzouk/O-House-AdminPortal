import { cookies } from 'next/headers';
import { dictionaries, defaultLocale, isLocale, type Dictionary, type Locale } from './dictionaries';

export const LOCALE_COOKIE = 'locale';
export * from './dictionaries';

/**
 * The active locale for this request. Cookie-backed rather than URL-segment
 * based: the portal has one audience and no SEO surface, so /ar/... routes
 * would be noise. profiles.locale mirrors this server-side for the app.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}

/** Pick a bilingual column pair, falling back across languages.
 *  Mirrors pickLocalized() in the Flutter app — showing an empty string
 *  because the Arabic column was never filled is worse than showing English. */
export function bilingual(
  locale: Locale,
  ar: string | null | undefined,
  en: string | null | undefined,
): string {
  const preferred = locale === 'ar' ? ar : en;
  if (preferred) return preferred;
  return (locale === 'ar' ? en : ar) ?? '';
}
