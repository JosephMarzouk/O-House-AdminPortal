import { listProfiles } from '@/lib/db/users';
import { listDepartments } from '@/lib/db/places';
import { getProfile } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, todayInCairo } from '@/lib/format';
import { UsersManager } from '@/components/users/users-manager';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import type { Role } from '@/lib/types/database';

export default async function UsersPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const kicker = fmtDate(todayInCairo(), locale);

  // set_user_role is admin-only, and staff creation needs the service-role
  // key — a manager would see nothing but disabled controls.
  if (me?.role !== 'admin') {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navUsers} subtitle={dict.adminOnly} />
        <PageBody />
      </>
    );
  }

  const [users, departments] = await Promise.all([listProfiles(), listDepartments()]);

  return (
    <>
      <PageHeader kicker={kicker} title={dict.navUsers} />
      <PageBody>
        <UsersManager
          dict={dict}
          locale={locale}
          currentUserId={me.id}
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role as Role,
            departmentId: u.department_id,
            managerId: u.manager_id,
          }))}
          departments={departments.map((d) => ({
            id: d.id,
            nameAr: d.name_ar,
            nameEn: d.name_en,
          }))}
        />
      </PageBody>
    </>
  );
}
