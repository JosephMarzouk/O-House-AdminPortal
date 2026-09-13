import { listDepartments } from '@/lib/db/places';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, todayInCairo } from '@/lib/format';
import { DepartmentsManager } from '@/components/departments/departments-manager';
import { PageBody, PageHeader } from '@/components/ui/page-header';

export default async function DepartmentsPage() {
  const [dict, locale, departments] = await Promise.all([
    getDictionary(),
    getLocale(),
    listDepartments(),
  ]);

  return (
    <>
      <PageHeader
        kicker={fmtDate(todayInCairo(), locale)}
        title={dict.navDepartments}
      />
      <PageBody>
        <DepartmentsManager
          dict={dict}
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
