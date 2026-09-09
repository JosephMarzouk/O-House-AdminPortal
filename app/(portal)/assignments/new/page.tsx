import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listPlaces, templateItems } from '@/lib/db/places';
import { listProfiles, assignableStaff } from '@/lib/db/users';
import { getDictionary, getLocale } from '@/lib/i18n';
import { NewAssignmentForm } from '@/components/assignments/new-assignment-form';

export default async function NewAssignmentPage() {
  const [dict, locale, places, profiles] = await Promise.all([
    getDictionary(),
    getLocale(),
    listPlaces(),
    listProfiles(),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/assignments"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {dict.back}
      </Link>

      <h1 className="text-xl font-semibold">{dict.newAssignment}</h1>

      <NewAssignmentForm
        dict={dict}
        locale={locale}
        places={places.map((p) => ({
          id: p.id,
          siteId: p.site_id,
          nameAr: p.title_ar,
          nameEn: p.title_en,
          items: templateItems(p.items),
        }))}
        staff={assignableStaff(profiles).map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
