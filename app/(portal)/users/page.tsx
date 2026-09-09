import { listProfiles } from '@/lib/db/users';
import { listDepartments } from '@/lib/db/places';
import { getProfile } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
import { UsersManager } from '@/components/users/users-manager';
import type { Role } from '@/lib/types/database';

export default async function UsersPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);

  // set_user_role is admin-only, and staff creation needs the service-role
  // key — a manager would see nothing but disabled controls.
  if (me?.role !== 'admin') {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{dict.navUsers}</h1>
        <p className="text-muted-foreground">{dict.adminOnly}</p>
      </div>
    );
  }

  const [users, departments] = await Promise.all([listProfiles(), listDepartments()]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{dict.navUsers}</h1>
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
    </div>
  );
}
