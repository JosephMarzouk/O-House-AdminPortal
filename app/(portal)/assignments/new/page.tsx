import { listPlaces, templateItems } from '@/lib/db/places';
import { listProfiles, assignableStaff } from '@/lib/db/users';
import { getDictionary, getLocale } from '@/lib/i18n';
import { NewAssignmentForm } from '@/components/assignments/new-assignment-form';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';

export default async function NewAssignmentPage() {
  const [dict, locale, places, profiles] = await Promise.all([
    getDictionary(),
    getLocale(),
    listPlaces(),
    listProfiles(),
  ]);

  return (
    <>
      <PageHeader
        kicker={<BackLink href="/assignments" label={dict.back} />}
        title={dict.newAssignment}
        subtitle={dict.subtasksFromPlace}
      />
      <PageBody>
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
      </PageBody>
    </>
  );
}
