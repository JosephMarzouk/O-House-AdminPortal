import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getPlace, listDepartments, templateItems } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { PlaceForm } from '@/components/places/place-form';

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
    <div className="space-y-6">
      <Link
        href="/places"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {dict.back}
      </Link>
      <h1 className="text-xl font-semibold">
        {bilingual(locale, place.title_ar, place.title_en) || dict.newPlace}
      </h1>
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
        departments={departments.map((d) => ({
          id: d.id,
          nameAr: d.name_ar,
          nameEn: d.name_en,
        }))}
      />
    </div>
  );
}
