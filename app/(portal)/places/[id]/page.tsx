import { notFound } from 'next/navigation';
import { getPlace, listDepartments, templateItems } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { PlaceForm } from '@/components/places/place-form';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { toDepartmentOptions } from '@/lib/options';
import { NoPermission } from '@/components/no-permission';
import { can, getProfile } from '@/lib/auth';

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  if (!can(me, 'places.view')) {
    return (
      <>
        <PageHeader kicker={<BackLink href="/places" label={dict.back} />} title={dict.navPlaces} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }
  const [place, departments] = await Promise.all([getPlace(id), listDepartments()]);
  if (!place) notFound();
  const canEdit = can(me, 'places.edit');

  return (
    <>
      <PageHeader
        kicker={<BackLink href="/places" label={dict.back} />}
        title={bilingual(locale, place.title_ar, place.title_en) || dict.newPlace}
        subtitle={canEdit ? dict.edit : undefined}
      />
      <PageBody>
        {!canEdit && <NoPermission dict={dict} text={dict.viewOnly} />}
        <PlaceForm
          readOnly={!canEdit}
          dict={dict}
          locale={locale}
          place={{
            id: place.id,
            nameAr: place.title_ar,
            nameEn: place.title_en,
            departmentId: place.department_id,
            items: templateItems(place.items),
          }}
          departments={toDepartmentOptions(departments)}
        />
      </PageBody>
    </>
  );
}
