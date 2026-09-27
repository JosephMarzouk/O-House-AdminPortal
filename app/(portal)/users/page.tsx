import { adminStaffList } from '@/lib/db/users';
import { listDepartments } from '@/lib/db/places';
import { canManageUsers, getProfile } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, todayInCairo } from '@/lib/format';
import { UsersManager } from '@/components/users/users-manager';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import type { Role } from '@/lib/types/database';
import { toDepartmentOptions } from '@/lib/options';
import { parseOne } from '@/lib/db/assignments';
import { SearchBox } from '@/components/search-box';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = parseOne((await searchParams).q);
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const kicker = fmtDate(todayInCairo(), locale);

  // Admins and managers. This early return is courtesy, not the control:
  // adminStaffList() below calls a SECURITY DEFINER RPC that raises for
  // anyone else and hands a manager every row with the phone stripped, so
  // neither the screen nor a phone number is reachable without it.
  if (!me || !canManageUsers(me.role)) {
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
      <PageHeader kicker={kicker} title={dict.navUsers}>
        <SearchBox value={q} label={dict.search} />
      </PageHeader>
      <PageBody>
        <UsersManager
          query={q}
          dict={dict}
          locale={locale}
          currentUserId={me.id}
          callerRole={me.role as Role}
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
