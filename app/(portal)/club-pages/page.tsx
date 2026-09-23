import { redirect } from 'next/navigation';
import { canEditClubPages, getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, todayInCairo } from '@/lib/format';
import { ClubPagesEditor } from '@/components/club-pages-editor';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { CLUB_PAGE_KEYS } from '@/lib/types/database';

/** The staff app's About and Policies text. Admins only (set_club_page says so too). */
export default async function ClubPagesPage() {
  const [profile, dict, locale, supabase] = await Promise.all([
    getProfile(),
    getDictionary(),
    getLocale(),
    createClient(),
  ]);
  if (!canEditClubPages(profile?.role)) redirect('/');

  const { data, error } = await supabase.from('club_pages').select('key, body_en, body_ar');
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        kicker={fmtDate(todayInCairo(), locale)}
        title={dict.navClubPages}
        subtitle={dict.clubPagesHint}
      />
      <PageBody>
        {CLUB_PAGE_KEYS.map((key) => {
          const row = data.find((r) => r.key === key);
          return (
            <ClubPagesEditor
              key={key}
              dict={dict}
              pageKey={key}
              bodyEn={row?.body_en ?? ''}
              bodyAr={row?.body_ar ?? ''}
            />
          );
        })}
      </PageBody>
    </>
  );
}
