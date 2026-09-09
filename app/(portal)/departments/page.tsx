import { listDepartments } from '@/lib/db/places';
import { getDictionary } from '@/lib/i18n';
import { DepartmentsManager } from '@/components/departments/departments-manager';

export default async function DepartmentsPage() {
  const [dict, departments] = await Promise.all([getDictionary(), listDepartments()]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{dict.navDepartments}</h1>
      <DepartmentsManager
        dict={dict}
        departments={departments.map((d) => ({
          id: d.id,
          nameAr: d.name_ar,
          nameEn: d.name_en,
        }))}
      />
    </div>
  );
}
