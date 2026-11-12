import { can, getProfile } from '@/lib/auth';
import { mayEditReportMail } from '@/lib/access';
import { NoPermission } from '@/components/no-permission';
import { createClient } from '@/lib/supabase/server';
import { bilingual, getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, fmtDateTime, fmtNum, todayInCairo } from '@/lib/format';
import { mapsUrl } from '@/lib/club-location';
import { listDepartments } from '@/lib/db/places';
import { ClubLocationForm } from '@/components/club-location-form';
import { ClubPagesEditor } from '@/components/club-pages-editor';
import { ReportMailForm } from '@/components/report-mail-form';
import { Card } from '@/components/ui/card';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { CLUB_PAGE_KEYS } from '@/lib/types/database';

/**
 * Club settings: the club's location (set once, then read-only), the report
 * emails, and the staff app's About and Policies text. club_settings.view
 * opens it and club_settings.edit edits the text (set_club_page checks the
 * same); the report emails also need reports.view and the caller's scope
 * (mayEditReportMail, as set_report_mail). The
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

  const [pages, loc, mail, recipients, mailLog, departments] = await Promise.all([
    supabase.from('club_pages').select('key, body_en, body_ar'),
    supabase.from('club_location').select('lat, lng, radius_m, set_by, set_at').maybeSingle(),
    supabase.from('report_mail_settings').select('frequency, sender').maybeSingle(),
    supabase.from('report_mail_recipients').select('department_id, email').order('email'),
    // Newest first: the first row per department is its latest send.
    supabase.from('report_mail_log').select('department_id, status, error, updated_at').order('updated_at', { ascending: false }).limit(200),
    listDepartments(),
  ]);
  if (pages.error) throw new Error(pages.error.message);
  for (const r of [loc, mail, recipients, mailLog]) if (r.error) throw new Error(r.error.message);
  const location = loc.data;

  // First the "all departments" list (no department id: one email with every
  // department, e.g. the general manager), then one list per department.
  const mailLists = [
    { id: null, name: dict.reportMailAll, hint: dict.reportMailAllHint },
    ...departments.map((d) => ({ id: d.id, name: bilingual(locale, d.name_ar, d.name_en), hint: null })),
  ];
  const mailDepartments = mailLists.map((d) => {
    const last = mailLog.data?.find((l) => l.department_id === d.id);
    const at = last ? fmtDateTime(last.updated_at, locale) : '';
    return {
      id: d.id ?? 'all',
      name: d.name,
      hint: d.hint,
      emails: (recipients.data ?? []).filter((r) => r.department_id === d.id).map((r) => r.email),
      last: !last
        ? null
        : last.status === 'sent'
          ? dict.reportMailSent.replace('{date}', at)
          : last.status === 'failed'
            ? dict.reportMailFailed.replace('{date}', at).replace('{error}', last.error ?? '')
            : dict.reportMailSending,
      failed: last?.status === 'failed',
      locked: !mayEditReportMail(profile, d.id ?? 'all'),
    };
  });

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
        <ReportMailForm
          dict={dict}
          frequency={mail.data?.frequency ?? 'off'}
          sender={mail.data?.sender ?? ''}
          departments={mailDepartments}
          settingsLocked={!mayEditReportMail(profile, 'all')}
        />
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
