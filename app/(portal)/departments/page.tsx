import { listDepartments } from '@/lib/db/places';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, todayInCairo } from '@/lib/format';
import { DepartmentsManager } from '@/components/departments/departments-manager';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { toDepartmentOptions } from '@/lib/options';
import { NoPermission } from '@/components/no-permission';
import { can, getProfile } from '@/lib/auth';

export default async function DepartmentsPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const kicker = fmtDate(todayInCairo(), locale);
  if (!can(me, 'departments.view')) {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navDepartments} />
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
        kicker={kicker}
        title={dict.navDepartments}
      />
      <PageBody>
        <DepartmentsManager
          dict={dict}
          departments={toDepartmentOptions(departments)}
          canCreate={can(me, 'departments.create')}
          canDelete={can(me, 'departments.delete')}
        />
      </PageBody>
    </>
  );
}
