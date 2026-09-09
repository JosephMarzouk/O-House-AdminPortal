'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n';

/**
 * Switch the portal's language. Also mirrors to profiles.locale via the
 * set_locale RPC so the phone app picks up the same choice — that column is
 * self-only and has no other write path.
 */
export async function setLocale(locale: Locale) {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  const supabase = await createClient();
  // Best-effort: a failure here only desynchronises the phone, so it must not
  // block the portal from switching.
  await supabase.rpc('set_locale', { p_locale: locale });

  revalidatePath('/', 'layout');
}
