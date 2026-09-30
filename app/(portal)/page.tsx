import { redirect } from 'next/navigation';
import { can, getProfile } from '@/lib/auth';
import { NoPermission } from '@/components/no-permission';
import { getDashboardData } from '@/lib/dashboard';
import { listRefusals } from '@/lib/db/sync';
import { SyncRefusals } from '@/components/sync-refusals';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtDate, fmtNum, todayInCairo } from '@/lib/format';
import { CategoryBars } from '@/components/charts/category-bars';
import { TrendChart } from '@/components/charts/trend-chart';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const FIRST_PAGES: [string, string][] = [
  ['/rounds', 'planner.view'],
  ['/places', 'places.view'],
  ['/departments', 'departments.view'],
  ['/users', 'users.view'],
  ['/roles', 'roles.view'],
  ['/reports', 'reports.view'],
  ['/club-settings', 'club_settings.view'],
];

export default async function DashboardPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  if (!can(me, 'checklists.view')) {
    // Sign-in lands here; a role without the dashboard goes to its first
    // page instead (the sidebar's order), and only one with none sees this.
    const home = FIRST_PAGES.find(([, perm]) => can(me, perm));
    if (home) redirect(home[0]);
    return (
      <>
        <PageHeader kicker={fmtDate(todayInCairo(), locale)} title={dict.navDashboard} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }
  const [d, refusals] = await Promise.all([getDashboardData(locale, dict.none), listRefusals()]);

  const n = (v: number) => fmtNum(v, locale);
  const rate = (v: number | null) => (v === null ? dict.none : `${n(v)}%`);

  // Only the expired tile is tinted — it is the "overdue" tile and magenta
  // is reserved for exactly that. Needs-review is just a number.
  const tiles: Array<{ label: string; value: string; alarm?: boolean }> = [
    { label: dict.totalAssignments, value: n(d.totalAll) },
    { label: dict.needsReview, value: n(d.counts.submitted) },
    { label: dict.statusExpired, value: n(d.counts.expired), alarm: true },
    { label: dict.onTimeRate, value: rate(d.onTimeRate) },
    { label: dict.rejectionRate, value: rate(d.rejectionRate) },
    { label: dict.extendedCount, value: n(d.extended) },
  ];

  const num = 'text-end tabular-nums';

  return (
    <>
      <PageHeader
        kicker={fmtDate(todayInCairo(), locale)}
        title={dict.navDashboard}
        subtitle={dict.last30Days}
      />
      <PageBody>
        {/* assignments_v is security_invoker, so a team or departments role's
            rows are already narrowed to its scope. Say so, rather than
            letting a team-sized figure read as club-wide. */}
        {me?.access?.scope === 'team' && <p className="text-sm text-text/55">{dict.dashboardScope}</p>}
        {me?.access?.scope === 'departments' && (
          <p className="text-sm text-text/55">{dict.scopeDepartmentsNote}</p>
        )}

        {/* Only when there is something to act on: an empty table is noise. */}
        {refusals.length > 0 && <SyncRefusals rows={refusals} dict={dict} locale={locale} />}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map((t) => (
            <StatTile key={t.label} label={t.label} value={t.value} alarm={t.alarm} />
          ))}
        </div>

        <section>
          <h2 className="text-heading">{dict.trendTitle}</h2>
          <div className="mt-4">
            <TrendChart
              data={d.trend}
              locale={locale}
              onTimeLabel={dict.onTime}
              lateLabel={dict.late}
            />
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-heading">{dict.byPlace}</h2>
            <div className="mt-4">
              {d.places.length ? (
                <CategoryBars data={d.places} locale={locale} valueLabel={dict.navAssignments} />
              ) : (
                <p className="text-text/55">{dict.noData}</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-heading">{dict.byDepartment}</h2>
            <div className="mt-4">
              {d.departments.length ? (
                <CategoryBars
                  data={d.departments}
                  locale={locale}
                  valueLabel={dict.navAssignments}
                />
              ) : (
                <p className="text-text/55">{dict.noData}</p>
              )}
            </div>
          </section>
        </div>

        <section>
          <h2 className="text-heading">{dict.byUser}</h2>
          <div className="mt-4">
            {d.users.length === 0 ? (
              <p className="text-text/55">{dict.noData}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.assignee}</TableHead>
                    <TableHead>{dict.department}</TableHead>
                    <TableHead className={num}>{dict.totalAssignments}</TableHead>
                    <TableHead className={num}>{dict.needsReview}</TableHead>
                    <TableHead className={num}>{dict.statusApproved}</TableHead>
                    <TableHead className={num}>{dict.statusRejected}</TableHead>
                    <TableHead className={num}>{dict.late}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold">{u.name}</TableCell>
                      <TableCell>{u.dept}</TableCell>
                      <TableCell className={num}>{n(u.total)}</TableCell>
                      <TableCell className={num}>{n(u.review)}</TableCell>
                      <TableCell className={num}>{n(u.approved)}</TableCell>
                      <TableCell className={num}>{n(u.rejected)}</TableCell>
                      <TableCell className={num}>
                        {u.late > 0 ? <span className="text-magenta">{n(u.late)}</span> : n(0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </PageBody>
    </>
  );
}
