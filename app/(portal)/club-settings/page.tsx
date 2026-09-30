import { can, getProfile } from '@/lib/auth';
import { NoPermission } from '@/components/no-permission';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, fmtNum, todayInCairo } from '@/lib/format';
import { mapsUrl } from '@/lib/club-location';
import { ClubLocationForm } from '@/components/club-location-form';
import { ClubPagesEditor } from '@/components/club-pages-editor';
import { Card } from '@/components/ui/card';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { CLUB_PAGE_KEYS } from '@/lib/types/database';

/**
 * Club settings: the club's location (set once, then read-only) and the staff
 * app's About and Policies text. club_settings.view opens it and
 * club_settings.edit edits the text (set_club_page checks the same). The
 * location is not a grantable permission: only the Admin role sets it
 * (set_club_location).
 */
export default async function ClubSettingsPage() {
  const [profile, dict, locale, supabase] = await Promise.all([
    getProfile(),
    getDictionary(),
    getLocale(),
    createClient(),
  ]);
  if (!can(profile, 'club_settings.view')) {
    return (
      <>
        <PageHeader kicker={fmtDate(todayInCairo(), locale)} title={dict.navClubPages} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }
  const canEditText = can(profile, 'club_settings.edit');
  const isAdmin = profile?.access?.role.key === 'admin';

  const [pages, loc] = await Promise.all([
    supabase.from('club_pages').select('key, body_en, body_ar'),
    supabase.from('club_location').select('lat, lng, radius_m, set_by, set_at').maybeSingle(),
  ]);
  if (pages.error) throw new Error(pages.error.message);
  if (loc.error) throw new Error(loc.error.message);
  const location = loc.data;

  let setByName = '—';
  if (location?.set_by) {
    const { data } = await supabase.from('profiles').select('name').eq('id', location.set_by).maybeSingle();
    setByName = data?.name ?? setByName;
  }

  return (
    <>
      <PageHeader
        kicker={fmtDate(todayInCairo(), locale)}
        title={dict.navClubPages}
        subtitle={dict.clubSettingsHint}
      />
      <PageBody>
        <Card className="max-w-3xl space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{dict.clubLocation}</h2>
            <p className="mt-1 text-sm text-text/55">{dict.locationHint}</p>
          </div>
          {location ? (
            <div className="space-y-2">
              <p dir="ltr" className="text-start tabular-nums">
                {location.lat}, {location.lng}
              </p>
              <p>
                {dict.locationRadius}: {fmtNum(location.radius_m, locale)}
              </p>
              <p className="text-caption text-text/55">
                {dict.locationSetBy
                  .replace('{name}', setByName)
                  .replace('{date}', fmtDate(location.set_at, locale))}
              </p>
              <a
                className="inline-block text-cyan-dark hover:underline"
                href={mapsUrl(location.lat, location.lng)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {dict.locationOpenMap}
              </a>
            </div>
          ) : isAdmin ? (
            <ClubLocationForm dict={dict} />
          ) : (
            <NoPermission dict={dict} text={dict.locationNotSet} />
          )}
        </Card>
        <section className="space-y-4">
          <p className="max-w-3xl text-sm text-text/55">{dict.clubPagesHint}</p>
          {!canEditText && <NoPermission dict={dict} text={dict.viewOnly} />}
          {CLUB_PAGE_KEYS.map((key) => {
            const row = pages.data.find((r) => r.key === key);
            return (
              <ClubPagesEditor
                key={key}
                dict={dict}
                pageKey={key}
                bodyEn={row?.body_en ?? ''}
                bodyAr={row?.body_ar ?? ''}
                readOnly={!canEditText}
              />
            );
          })}
        </section>
      </PageBody>
    </>
  );
}
