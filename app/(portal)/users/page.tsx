import { adminStaffList } from '@/lib/db/users';
import { listDepartments } from '@/lib/db/places';
import { listRoles } from '@/lib/db/roles';
import { can, getProfile } from '@/lib/auth';
import { canBeManager } from '@/lib/access';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, todayInCairo } from '@/lib/format';
import { UsersManager } from '@/components/users/users-manager';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { toDepartmentOptions } from '@/lib/options';
import { parseOne } from '@/lib/db/assignments';
import { SearchBox } from '@/components/search-box';
import { NoPermission } from '@/components/no-permission';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = parseOne((await searchParams).q);
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const kicker = fmtDate(todayInCairo(), locale);

  // users.view. This early return is courtesy, not the control:
  // adminStaffList() below calls a SECURITY DEFINER RPC that raises without
  // it and strips the phone without phones.view, so neither the screen nor a
  // phone number is reachable without them.
  if (!me || !can(me, 'users.view')) {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navUsers} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }

  const [users, departments, roles] = await Promise.all([
    adminStaffList(),
    listDepartments(),
    listRoles(),
  ]);

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
          me={{ id: me.id, access: me.access }}
          roles={roles.map((r) => ({
            id: r.id,
            key: r.key,
            nameAr: r.name_ar,
            nameEn: r.name_en,
            canManage: canBeManager(r),
          }))}
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            roleId: u.role_id,
            departmentId: u.department_id,
            managerId: u.manager_id,
          }))}
          departments={toDepartmentOptions(departments)}
        />
      </PageBody>
    </>
  );
}
