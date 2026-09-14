import { notFound } from 'next/navigation';
import { getPlace, listDepartments, templateItems } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { PlaceForm } from '@/components/places/place-form';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { toDepartmentOptions } from '@/lib/options';

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dict, locale, place, departments] = await Promise.all([
    getDictionary(),
    getLocale(),
    getPlace(id),
    listDepartments(),
  ]);
  if (!place) notFound();

  return (
    <>
      <PageHeader
        kicker={<BackLink href="/places" label={dict.back} />}
        title={bilingual(locale, place.title_ar, place.title_en) || dict.newPlace}
        subtitle={dict.edit}
      />
      <PageBody>
        <PlaceForm
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
