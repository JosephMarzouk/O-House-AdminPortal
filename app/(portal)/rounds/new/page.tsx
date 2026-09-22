import { canSchedule, getProfile } from '@/lib/auth';
import { listPlaces } from '@/lib/db/places';
import { getDictionary, getLocale } from '@/lib/i18n';
import { RoundTemplateForm } from '@/components/rounds/round-template-form';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { toRoundPlaceOptions } from '@/lib/round-options';

export default async function NewRoundPage() {
  const [dict, locale, me, places] = await Promise.all([
    getDictionary(),
    getLocale(),
    getProfile(),
    listPlaces(),
  ]);

  if (!me || !canSchedule(me.role)) {
    return (
      <>
        <PageHeader
          kicker={<BackLink href="/rounds" label={dict.back} />}
          title={dict.newRound}
          subtitle={dict.adminOnly}
        />
        <PageBody />
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker={<BackLink href="/rounds" label={dict.back} />}
        title={dict.newRound}
        subtitle={dict.roundPlacesHint}
      />
      <PageBody>
        <RoundTemplateForm dict={dict} locale={locale} places={toRoundPlaceOptions(places)} />
      </PageBody>
    </>
  );
}
