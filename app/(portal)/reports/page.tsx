import Form from 'next/form';
import Link from 'next/link';
import { can, getProfile } from '@/lib/auth';
import { EFFECTIVE_STATUSES, parseOne, reportDays } from '@/lib/db/assignments';
import { listDepartments, listPlaces } from '@/lib/db/places';
import { listProfiles } from '@/lib/db/users';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtDay, fmtNum, presetOf, presetRange, todayInCairo } from '@/lib/format';
import { DatePresetButtons } from '@/components/date-preset-buttons';
import { isUuid } from '@/lib/rounds';
import { daysFromTasks, reportFilterParams, reportQuery } from '@/lib/report';
import { EyeIcon } from '@/components/icons';
import { DownloadPdfButton } from '@/components/download-pdf-button';
import { STATUS, StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const sp = await searchParams;
  const deptParam = parseOne(sp.dept);
  const deptId = isUuid(deptParam) ? deptParam : null; // anything else = all departments
  // Name, place, person, status. A malformed one means no filter, like dept.
  const filter =
    reportFilterParams(
      new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))),
    ) ?? {};
  const filterQuery = reportQuery({ q: filter.q, place: filter.place, user: filter.user, status: filter.status });
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const today = todayInCairo();
  // From / To (26 Nov): which days the list shows. A malformed one is no limit.
  const ymd = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const from = ymd(parseOne(sp.from));
  const to = ymd(parseOne(sp.to));
  // The same URL with other From/To: the quick buttons are links, like the form is GET.
  const listHref = (range: { from: string; to: string }) => {
    const qs = new URLSearchParams(filterQuery);
    if (deptId) qs.set('dept', deptId);
    qs.set('from', range.from);
    qs.set('to', range.to);
    return `/reports?${qs}`;
  };
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

  // Places and people feed the department rule and the place / person filters;
  // both are RLS-scoped, so they offer only what the caller can already see.
  const [departments, tasks, places, profiles] = await Promise.all([
    listDepartments(),
    reportDays(today, { from, to }),
    listPlaces(),
    listProfiles(),
  ]);
  const days = daysFromTasks(
    tasks,
    today,
    deptId,
    new Map(places.map((p) => [p.id, p.department_id])),
    new Map(profiles.map((p) => [p.id, p.department_id])),
    filter,
  ).filter((d) => (!from || d.day >= from) && (!to || d.day <= to));
  const n = (v: number) => fmtNum(v, locale);

  return (
    <>
      <PageHeader kicker={kicker} title={dict.navReports} subtitle={dict.reportsIntro} />
      <PageBody>
        <Form action="/reports" className="flex max-w-4xl flex-wrap items-end gap-3">
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
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="r-q">{dict.checklistName}</Label>
            <Input id="r-q" name="q" type="search" defaultValue={filter.q ?? ''} maxLength={100} compact />
          </div>
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="r-place">{dict.place}</Label>
            <Select id="r-place" name="place" defaultValue={filter.place ?? ''} compact>
              <option value="">{dict.allPlaces}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {bilingual(locale, p.title_ar, p.title_en)}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="r-user">{dict.person}</Label>
            <Select id="r-user" name="user" defaultValue={filter.user ?? ''} compact>
              <option value="">{dict.allPeople}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="r-status">{dict.status}</Label>
            <Select id="r-status" name="status" defaultValue={filter.status ?? ''} compact>
              <option value="">{dict.allStatuses}</option>
              {EFFECTIVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {dict[STATUS[s].label]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-from">{dict.dateFrom}</Label>
            <Input id="r-from" name="from" type="date" dir="ltr" defaultValue={from ?? ''} compact />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-to">{dict.dateTo}</Label>
            <Input id="r-to" name="to" type="date" dir="ltr" defaultValue={to ?? ''} compact />
          </div>
          <Button type="submit" variant="outline">
            {dict.applyFilter}
          </Button>
        </Form>

        {/* Today / This week (Sat–Fri) / This month: links that set From and To. */}
        <DatePresetButtons
          chosen={presetOf(from, to, today)}
          labels={{ today: dict.presetToday, week: dict.presetWeek, month: dict.presetMonth }}
          hrefFor={(p) => listHref(presetRange(p, today))}
        />

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
                        render={<Link href={`/reports/daily?date=${d.day}&dept=${deptId ?? 'all'}${filterQuery ? `&${filterQuery}` : ''}`} />}
                      >
                        <EyeIcon />
                        {dict.view}
                        <LinkPending />
                      </Button>
                      <DownloadPdfButton
                        date={d.day}
                        dept={deptId ?? 'all'}
                        filter={filter}
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
