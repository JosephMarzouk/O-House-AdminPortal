import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listDepartments } from '@/lib/db/places';
import { getDictionary, getLocale } from '@/lib/i18n';
import { PlaceForm } from '@/components/places/place-form';

export default async function NewPlacePage() {
  const [dict, locale, departments] = await Promise.all([
    getDictionary(),
    getLocale(),
    listDepartments(),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/places"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {dict.back}
      </Link>
      <h1 className="text-xl font-semibold">{dict.newPlace}</h1>
      <PlaceForm
        dict={dict}
        locale={locale}
        departments={departments.map((d) => ({
          id: d.id,
          nameAr: d.name_ar,
          nameEn: d.name_en,
        }))}
      />
    </div>
  );
}
