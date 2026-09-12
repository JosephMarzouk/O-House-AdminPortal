import Link from 'next/link';
import { PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  EFFECTIVE_STATUSES,
  itemCountsFor,
  listAssignments,
  parseOne,
  parseStatus,
  type ItemCounts,
} from '@/lib/db/assignments';
import { listSites } from '@/lib/db/places';
import { assignableStaff, listProfiles } from '@/lib/db/users';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtNum, fmtWindow, todayInCairo } from '@/lib/format';
import { StatusBadge } from '@/components/status-badge';
import { AssignmentFilters } from '@/components/assignments/assignment-filters';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import type { Assignment, EffectiveStatus } from '@/lib/types/database';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS_LABEL: Record<EffectiveStatus, string> = {
  pending: 'statusPending',
  in_progress: 'statusInProgress',
  submitted: 'statusSubmitted',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  expired: 'statusExpired',
};

export default async function AssignmentsPage({
  searchParams,
}: {
  // A Promise in Next 16 — it must be awaited before anything reads it.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const site = parseOne(sp.site);
  const who = parseOne(sp.who);
  const from = parseOne(sp.from);
  const to = parseOne(sp.to);

  const base = { siteId: site, inspectorId: who, from, to };

  // Sections are driven by the status filter: with none chosen the list splits
  // into "waiting on you" and the rest; choosing one makes that split
  // meaningless, so it collapses to a single list.
  const showReview = !status || status === 'submitted';
  const showRest = status !== 'submitted';

  const [dict, locale, review, rest, sites, profiles] = await Promise.all([
    getDictionary(),
    getLocale(),
    showReview
      ? listAssignments({ ...base, status: 'submitted' })
      : Promise.resolve({ rows: [], total: 0 }),
    showRest
      ? listAssignments(status ? { ...base, status } : { ...base, notStatus: 'submitted' })
      : Promise.resolve({ rows: [], total: 0 }),
    listSites(),
    listProfiles(),
  ]);

  // One round trip for both tables; listAssignments caps each page well under
  // the point where this .in() list would outgrow the URL.
  const counts = await itemCountsFor(
    [...review.rows, ...rest.rows].map((r) => r.id!).filter(Boolean),
  );

  const n = (v: number) => fmtNum(v, locale);
  const chipHref = (s: EffectiveStatus | 'all') => {
    const qs = new URLSearchParams();
    if (s !== 'all') qs.set('status', s);
    for (const [k, v] of Object.entries({ site, who, from, to })) if (v) qs.set(k, v);
    const q = qs.toString();
    return q ? `/assignments?${q}` : '/assignments';
  };

  function section(
    title: string,
    hint: string | null,
    data: { rows: Assignment[]; total: number },
  ) {
    return (
      <section>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-heading">{title}</h2>
          <span className="text-lg tabular-nums text-text/55">{n(data.total)}</span>
          {data.total > data.rows.length && (
            <span className="text-caption text-text/55">
              {dict.showingOf.replace('{n}', n(data.rows.length)).replace('{total}', n(data.total))}
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-sm text-text/55">{hint}</p>}
        <div className="mt-4">
          {data.rows.length === 0 ? (
            <p className="text-text/55">{dict.noData}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.place}</TableHead>
                  <TableHead>{dict.assignee}</TableHead>
                  <TableHead>{dict.date}</TableHead>
                  <TableHead>{dict.window}</TableHead>
                  <TableHead className="text-end">{dict.progress}</TableHead>
                  <TableHead>{dict.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{data.rows.map((a) => row(a, counts.get(a.id!)))}</TableBody>
            </Table>
          )}
        </div>
      </section>
    );
  }

  function row(a: Assignment, c: ItemCounts | undefined) {
    const { total = 0, done = 0 } = c ?? {};
    // The app renders title_* as the card heading and site_name_* as the place
    // line. Fall back to template_title_* for the one legacy row whose title
    // columns are empty.
    const title =
      bilingual(locale, a.title_ar, a.title_en) ||
      bilingual(locale, a.template_title_ar, a.template_title_en);
    const place = bilingual(locale, a.site_name_ar, a.site_name_en);

    return (
      <TableRow key={a.id}>
        <TableCell>
          <Link
            href={`/assignments/${a.id}`}
            className="font-semibold text-cyan-dark hover:underline"
          >
            {title || dict.none}
          </Link>
          {place && <div className="text-caption text-text/55">{place}</div>}
        </TableCell>
        <TableCell>{a.inspector_name || dict.none}</TableCell>
        <TableCell>{fmtDate(a.scheduled_date, locale)}</TableCell>
        <TableCell className="tabular-nums" dir="ltr">
          {fmtWindow(a.window_start, a.window_end) ?? dict.none}
        </TableCell>
        <TableCell className="text-end tabular-nums">
          {total === 0 ? (
            // Zero items means the phone shows 0/0 with Submit permanently
            // disabled — worth flagging, not hiding.
            <span className="text-magenta">
              {n(0)} / {n(0)}
            </span>
          ) : (
            `${n(done)} / ${n(total)}`
          )}
        </TableCell>
        <TableCell>
          <StatusBadge status={a.effective_status} dict={dict} extended={a.was_extended} />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      <PageHeader
        kicker={fmtDate(todayInCairo(), locale)}
        title={dict.navAssignments}
        subtitle={showReview ? `${dict.needsReview} · ${n(review.total)}` : undefined}
        actions={
          // nativeButton={false}: Base UI defaults to expecting a real
          // <button>, and this renders an <a>.
          <Button nativeButton={false} render={<Link href="/assignments/new" />}>
            <PlusIcon />
            {dict.newAssignment}
          </Button>
        }
      >
        {/* The filter rows belong "inside the ink": status chips, then the
            place / assignee / date controls. */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Status filters are plain links: they enumerate, so they need no
              client JS at all, and Next still navigates them client-side. */}
          <nav className="flex flex-wrap gap-1" aria-label={dict.status}>
            {(['all', ...EFFECTIVE_STATUSES] as const).map((s) => {
              const active = (status ?? 'all') === s;
              return (
                <Link
                  key={s}
                  href={chipHref(s)}
                  scroll={false}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-control items-center rounded-control px-4 text-sm font-semibold transition-colors',
                    active ? 'bg-cyan text-paper' : 'bg-paper/10 text-paper hover:bg-paper/20',
                  )}
                >
                  {s === 'all' ? dict.filterAll : dict[STATUS_LABEL[s] as keyof typeof dict]}
                </Link>
              );
            })}
          </nav>

          <AssignmentFilters
            values={{ status, site, who, from, to }}
            sites={sites.map((s) => ({
              value: s.id,
              label: bilingual(locale, s.name_ar, s.name_en) || s.id,
            }))}
            staff={assignableStaff(profiles).map((p) => ({ value: p.id, label: p.name }))}
            labels={{
              place: dict.place,
              assignee: dict.assignee,
              from: dict.dateFrom,
              to: dict.dateTo,
              all: dict.filterAll,
              reset: dict.filterReset,
            }}
          />
        </div>
      </PageHeader>

      <PageBody>
        {showReview && section(dict.needsReview, dict.needsReviewHint, review)}
        {showRest && section(status ? dict.navAssignments : dict.everythingElse, null, rest)}
      </PageBody>
    </>
  );
}
