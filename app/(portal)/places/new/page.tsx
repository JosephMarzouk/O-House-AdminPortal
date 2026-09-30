import { listDepartments } from '@/lib/db/places';
import { getDictionary, getLocale } from '@/lib/i18n';
import { PlaceForm } from '@/components/places/place-form';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
import { toDepartmentOptions } from '@/lib/options';
import { NoPermission } from '@/components/no-permission';
import { can, getProfile } from '@/lib/auth';

export default async function NewPlacePage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  if (!can(me, 'places.create')) {
    return (
      <>
        <PageHeader kicker={<BackLink href="/places" label={dict.back} />} title={dict.newPlace} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }
  const departments = await listDepartments();

  return (
    <>
      <PageHeader
        kicker={<BackLink href="/places" label={dict.back} />}
        title={dict.newPlace}
        subtitle={dict.subtasksFromPlace}
      />
      <PageBody>
        <PlaceForm
          dict={dict}
          locale={locale}
          departments={toDepartmentOptions(departments)}
        />
      </PageBody>
    </>
  );
}
