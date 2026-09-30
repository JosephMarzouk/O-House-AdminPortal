import { can, getProfile } from '@/lib/auth';
import { listPlaces } from '@/lib/db/places';
import { getDictionary, getLocale } from '@/lib/i18n';
import { RoundTemplateForm } from '@/components/rounds/round-template-form';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { toRoundPlaceOptions } from '@/lib/round-options';
import { NoPermission } from '@/components/no-permission';

export default async function NewRoundPage() {
  const [dict, locale, me, places] = await Promise.all([
    getDictionary(),
    getLocale(),
    getProfile(),
    listPlaces(),
  ]);

  if (!can(me, 'planner.create')) {
    return (
      <>
        <PageHeader
          kicker={<BackLink href="/rounds" label={dict.back} />}
          title={dict.newRound}
        />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
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
