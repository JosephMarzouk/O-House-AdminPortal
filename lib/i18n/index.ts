import { cookies } from 'next/headers';
import { brandFor } from '@/lib/brand';
import { requestClub } from '@/lib/club';
import { dictionaries, defaultLocale, isLocale, type Dictionary, type Locale } from './dictionaries';

export const LOCALE_COOKIE = 'locale';
export * from './dictionaries';

/**
 * The active locale for this request. Cookie-backed rather than URL-segment
 * based: the portal has one audience and no SEO surface, so /ar/... routes
 * would be noise. profiles.locale mirrors this for the phone app.
 *
 * Server-only — this module imports next/headers. Client components take
 * `locale` as a prop and import bilingual() from ./dictionaries.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

/**
 * The strings for this request, with the club's own app name ("RYZE House")
 * in place of the default: one deployment serves every club, and appName
 * reaches the sidebar, the login card and the not-authorised page from here.
 */
export async function getDictionary(): Promise<Dictionary> {
  const [locale, club] = await Promise.all([getLocale(), requestClub()]);
  return { ...dictionaries[locale], appName: brandFor(club?.slug).appName[locale] };
}
