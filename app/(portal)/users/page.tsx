import { adminStaffList } from '@/lib/db/users';
import { listDepartments } from '@/lib/db/places';
import { getProfile } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, todayInCairo } from '@/lib/format';
import { UsersManager } from '@/components/users/users-manager';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import type { Role } from '@/lib/types/database';
import { toDepartmentOptions } from '@/lib/options';

export default async function UsersPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const kicker = fmtDate(todayInCairo(), locale);

  // set_user_role is admin-only, and staff creation needs the service-role
  // key — a manager or inspector would see nothing but disabled controls.
  //
  // This early return is courtesy, not the control. adminStaffList() below
  // calls a SECURITY DEFINER RPC that raises for a non-admin, so phone
  // numbers stay out of reach even if this check were removed.
  if (me?.role !== 'admin') {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navUsers} subtitle={dict.adminOnly} />
        <PageBody />
      </>
    );
  }

  const [users, departments] = await Promise.all([adminStaffList(), listDepartments()]);

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
          departments={toDepartmentOptions(departments)}
        />
      </PageBody>
    </>
  );
}
