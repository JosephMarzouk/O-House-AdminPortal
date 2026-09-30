import Form from 'next/form';
import Link from 'next/link';
import { can, getProfile } from '@/lib/auth';
import { EFFECTIVE_STATUSES, parseOne, reportDays } from '@/lib/db/assignments';
import { listDepartments, listPlaces } from '@/lib/db/places';
import { listProfiles } from '@/lib/db/users';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtDay, fmtNum, todayInCairo } from '@/lib/format';
import { isUuid } from '@/lib/rounds';
import { daysFromTasks } from '@/lib/report';
import { EyeIcon } from '@/components/icons';
import { DownloadPdfButton } from '@/components/download-pdf-button';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LinkPending } from '@/components/ui/link-pending';
import { Select } from '@/components/ui/select';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { NoPermission } from '@/components/no-permission';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Every day with checklists, newest first and today included, each with the
 * figures of its daily report, a View link to it and a PDF download. The
 * department filter is a GET form, so a filtered list has its own URL.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const deptParam = parseOne((await searchParams).dept);
  const deptId = isUuid(deptParam) ? deptParam : null; // anything else = all departments
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const today = todayInCairo();
  const kicker = fmtDate(today, locale);

  // Courtesy, not the control: the report reads through RLS, so a caller only
  // ever gets the tasks they could already see.
  if (!can(me, 'reports.view')) {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navReports} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }

  // Places and people only matter to the department filter.
  const [departments, tasks, places, profiles] = await Promise.all([
    listDepartments(),
    reportDays(today),
    deptId ? listPlaces() : [],
    deptId ? listProfiles() : [],
  ]);
  const days = daysFromTasks(
    tasks,
    today,
    deptId,
    new Map(places.map((p) => [p.id, p.department_id])),
    new Map(profiles.map((p) => [p.id, p.department_id])),
  );
  const n = (v: number) => fmtNum(v, locale);

  return (
    <>
      <PageHeader kicker={kicker} title={dict.navReports} subtitle={dict.reportsIntro} />
      <PageBody>
        <Form action="/reports" className="flex max-w-xl flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="r-dept">{dict.department}</Label>
            <Select id="r-dept" name="dept" defaultValue={deptId ?? 'all'} compact>
              <option value="all">{dict.allDepartments}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {bilingual(locale, d.name_ar, d.name_en)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            {dict.applyFilter}
          </Button>
        </Form>

        {days.length === 0 ? (
          <p className="text-text/55">{dict.reportNoDays}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.date}</TableHead>
                <TableHead className="text-end">{dict.totalChecklists}</TableHead>
                <TableHead>{dict.status}</TableHead>
                <TableHead className="text-end">{dict.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => (
                <TableRow key={d.day}>
                  <TableCell className="font-semibold">{fmtDay(d.day, locale)}</TableCell>
                  <TableCell className="text-end tabular-nums">{n(d.total)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {EFFECTIVE_STATUSES.filter((s) => d.byStatus[s]).map((s) => (
                        <li key={s} className="flex items-center gap-1.5">
                          <StatusBadge status={s} dict={dict} />
                          <span className="tabular-nums font-semibold">{n(d.byStatus[s]!)}</span>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        className="relative"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/reports/daily?date=${d.day}&dept=${deptId ?? 'all'}`} />}
                      >
                        <EyeIcon />
                        {dict.view}
                        <LinkPending />
                      </Button>
                      <DownloadPdfButton
                        date={d.day}
                        dept={deptId ?? 'all'}
                        label={dict.download}
                        dict={dict}
                        variant="outline"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageBody>
    </>
  );
}
