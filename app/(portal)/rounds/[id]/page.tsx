import { notFound } from 'next/navigation';
import { canSchedule, getProfile } from '@/lib/auth';
import { listPlaces } from '@/lib/db/places';
import { getRoundTemplate } from '@/lib/db/rounds';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { roundPlaces } from '@/lib/rounds';
import { RoundTemplateForm } from '@/components/rounds/round-template-form';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { toRoundPlaceOptions } from '@/lib/round-options';

export default async function EditRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dict, locale, me, round, places] = await Promise.all([
    getDictionary(),
    getLocale(),
    getProfile(),
    getRoundTemplate(id),
    listPlaces(),
  ]);
  if (!round) notFound();

  const title = bilingual(locale, round.title_ar, round.title_en) || dict.newRound;
  if (!me || !canSchedule(me.role)) {
    return (
      <>
        <PageHeader
          kicker={<BackLink href="/rounds" label={dict.back} />}
          title={title}
          subtitle={dict.adminOnly}
        />
        <PageBody />
      </>
    );
  }

  // A place deleted since the round was saved has nothing left to schedule;
  // it drops out here and is gone for good on the next save.
  const known = new Set(places.map((p) => p.id));

  return (
    <>
      <PageHeader
        kicker={<BackLink href="/rounds" label={dict.back} />}
        title={title}
        subtitle={dict.edit}
      />
      <PageBody>
        <RoundTemplateForm
          dict={dict}
          locale={locale}
          round={{
            id: round.id,
            titleAr: round.title_ar,
            titleEn: round.title_en,
            active: round.active,
            places: roundPlaces(round.places).filter((p) => known.has(p.template_id)),
          }}
          places={toRoundPlaceOptions(places)}
        />
      </PageBody>
    </>
  );
}
