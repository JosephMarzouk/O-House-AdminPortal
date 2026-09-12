import { getProfile } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard';
import { getDictionary, getLocale } from '@/lib/i18n';
import { fmtNum } from '@/lib/format';
import { CategoryBars } from '@/components/charts/category-bars';
import { TrendChart } from '@/components/charts/trend-chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function DashboardPage() {
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const d = await getDashboardData(locale, dict.none);

  const n = (v: number) => fmtNum(v, locale);
  const rate = (v: number | null) => (v === null ? dict.none : `${n(v)}%`);

  const tiles: Array<{ label: string; value: string; alarm?: boolean }> = [
    { label: dict.totalAssignments, value: n(d.totalAll) },
    { label: dict.needsReview, value: n(d.counts.submitted), alarm: d.counts.submitted > 0 },
    { label: dict.statusExpired, value: n(d.counts.expired), alarm: d.counts.expired > 0 },
    { label: dict.onTimeRate, value: rate(d.onTimeRate) },
    { label: dict.rejectionRate, value: rate(d.rejectionRate) },
    { label: dict.extendedCount, value: n(d.extended) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{dict.navDashboard}</h1>
        <span className="section-label">{dict.last30Days}</span>
      </div>

      {/* assignments_v is security_invoker, so a manager's rows are already
          narrowed to their own reports. Say so, rather than letting a
          team-sized figure read as club-wide. */}
      {me?.role === 'manager' && (
        <p className="text-sm text-muted-foreground">{dict.dashboardScope}</p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card p-4 shadow-[var(--shadow-broadsheet)]">
            <div className="section-label">{t.label}</div>
            <div
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                t.alarm ? 'text-destructive' : ''
              }`}
            >
              {t.value}
            </div>
          </div>
        ))}
      </div>

      <section className="bg-card p-4 shadow-[var(--shadow-broadsheet)]">
        <h2 className="section-label mb-3">{dict.trendTitle}</h2>
        <TrendChart
          data={d.trend}
          locale={locale}
          onTimeLabel={dict.onTime}
          lateLabel={dict.late}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-card p-4 shadow-[var(--shadow-broadsheet)]">
          <h2 className="section-label mb-3">{dict.byPlace}</h2>
          {d.places.length ? (
            <CategoryBars data={d.places} locale={locale} valueLabel={dict.navAssignments} />
          ) : (
            <p className="text-muted-foreground">{dict.noData}</p>
          )}
        </section>

        <section className="bg-card p-4 shadow-[var(--shadow-broadsheet)]">
          <h2 className="section-label mb-3">{dict.byDepartment}</h2>
          {d.departments.length ? (
            <CategoryBars data={d.departments} locale={locale} valueLabel={dict.navAssignments} />
          ) : (
            <p className="text-muted-foreground">{dict.noData}</p>
          )}
        </section>
      </div>

      <section className="bg-card p-4 shadow-[var(--shadow-broadsheet)]">
        <h2 className="section-label mb-3">{dict.byUser}</h2>
        {d.users.length === 0 ? (
          <p className="text-muted-foreground">{dict.noData}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{dict.assignee}</TableHead>
                  <TableHead className="text-start">{dict.department}</TableHead>
                  <TableHead className="text-start">{dict.totalAssignments}</TableHead>
                  <TableHead className="text-start">{dict.needsReview}</TableHead>
                  <TableHead className="text-start">{dict.statusApproved}</TableHead>
                  <TableHead className="text-start">{dict.statusRejected}</TableHead>
                  <TableHead className="text-start">{dict.late}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-start font-semibold">{u.name}</TableCell>
                    <TableCell className="text-start">{u.dept}</TableCell>
                    <TableCell className="text-start tabular-nums">{n(u.total)}</TableCell>
                    <TableCell className="text-start tabular-nums">{n(u.review)}</TableCell>
                    <TableCell className="text-start tabular-nums">{n(u.approved)}</TableCell>
                    <TableCell className="text-start tabular-nums">{n(u.rejected)}</TableCell>
                    <TableCell className="text-start tabular-nums">
                      {u.late > 0 ? <span className="text-destructive">{n(u.late)}</span> : n(0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
