import { canExportReports, getProfile } from '@/lib/auth';
import { listDepartments } from '@/lib/db/places';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, todayInCairo } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PageBody, PageHeader } from '@/components/ui/page-header';

/**
 * Pick a day and a department, then Generate. A plain GET form: the report is
 * a page with its own URL, so it can be bookmarked or regenerated later, and
 * this screen needs no client code at all.
 */
export default async function ReportsPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const today = todayInCairo();
  const kicker = fmtDate(today, locale);

  // Courtesy, not the control: the report reads through RLS, so a caller only
  // ever gets the tasks they could already see.
  if (!me || !canExportReports(me.role)) {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navReports} subtitle={dict.adminOnly} />
        <PageBody />
      </>
    );
  }

  const departments = await listDepartments();

  return (
    <>
      <PageHeader kicker={kicker} title={dict.navReports} subtitle={dict.reportsIntro} />
      <PageBody>
        <form action="/reports/daily" className="flex max-w-3xl flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="r-date">{dict.date}</Label>
            <Input id="r-date" name="date" type="date" dir="ltr" defaultValue={today} required />
          </div>
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="r-dept">{dict.department}</Label>
            <Select id="r-dept" name="dept" defaultValue="all">
              <option value="all">{dict.allDepartments}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {bilingual(locale, d.name_ar, d.name_en)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">{dict.generateReport}</Button>
        </form>
      </PageBody>
    </>
  );
}
