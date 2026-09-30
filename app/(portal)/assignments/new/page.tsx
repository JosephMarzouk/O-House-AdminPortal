import { listPlaces, templateItems } from '@/lib/db/places';
import { listProfiles, assignableStaff, staffAppRoles } from '@/lib/db/users';
import { getDictionary, getLocale } from '@/lib/i18n';
import { NewAssignmentForm } from '@/components/assignments/new-assignment-form';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { NoPermission } from '@/components/no-permission';
import { can, getProfile } from '@/lib/auth';

export default async function NewAssignmentPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  // create_assignment requires checklists.create; this only says so up front.
  if (!can(me, 'checklists.create')) {
    return (
      <>
        <PageHeader
          kicker={<BackLink href="/assignments" label={dict.back} />}
          title={dict.newAssignment}
        />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }

  const [places, profiles, staffRoles] = await Promise.all([
    listPlaces(),
    listProfiles(),
    staffAppRoles(),
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
          staff={assignableStaff(profiles, staffRoles).map((p) => ({ id: p.id, name: p.name }))}
        />
      </PageBody>
    </>
  );
}
