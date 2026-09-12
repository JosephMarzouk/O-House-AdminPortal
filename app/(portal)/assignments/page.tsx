import Link from 'next/link';
import { Plus } from 'lucide-react';
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
import { fmtDate, fmtNum, fmtWindow } from '@/lib/format';
import { StatusBadge } from '@/components/status-badge';
import { AssignmentFilters } from '@/components/assignments/assignment-filters';
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
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="section-label">{title}</h2>
          <span className="text-sm font-semibold tabular-nums">{n(data.total)}</span>
          {data.total > data.rows.length && (
            <span className="text-xs text-muted-foreground">
              {dict.showingOf.replace('{n}', n(data.rows.length)).replace('{total}', n(data.total))}
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {data.rows.length === 0 ? (
          <p className="text-muted-foreground">{dict.noData}</p>
        ) : (
          <div className="overflow-x-auto bg-card shadow-[var(--shadow-broadsheet)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{dict.place}</TableHead>
                  <TableHead className="text-start">{dict.assignee}</TableHead>
                  <TableHead className="text-start">{dict.date}</TableHead>
                  <TableHead className="text-start">{dict.window}</TableHead>
                  <TableHead className="text-start">{dict.progress}</TableHead>
                  <TableHead className="text-start">{dict.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{data.rows.map((a) => row(a, counts.get(a.id!)))}</TableBody>
            </Table>
          </div>
        )}
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
        <TableCell className="text-start">
          <Link href={`/assignments/${a.id}`} className="font-semibold hover:underline">
            {title || dict.none}
          </Link>
          {place && <div className="text-xs text-muted-foreground">{place}</div>}
        </TableCell>
        <TableCell className="text-start">{a.inspector_name || dict.none}</TableCell>
        <TableCell className="text-start">{fmtDate(a.scheduled_date, locale)}</TableCell>
        <TableCell className="text-start tabular-nums" dir="ltr">
          {fmtWindow(a.window_start, a.window_end) ?? dict.none}
        </TableCell>
        <TableCell className="text-start tabular-nums">
          {total === 0 ? (
            // Zero items means the phone shows 0/0 with Submit permanently
            // disabled — worth flagging, not hiding.
            <span className="text-destructive">{n(0)} / {n(0)}</span>
          ) : (
            `${n(done)} / ${n(total)}`
          )}
        </TableCell>
        <TableCell className="text-start">
          <StatusBadge status={a.effective_status} dict={dict} extended={a.was_extended} />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{dict.navAssignments}</h1>
        {/* nativeButton={false}: Base UI defaults to expecting a real
            <button>, and this renders an <a>. */}
        <Button nativeButton={false} render={<Link href="/assignments/new" />}>
          <Plus className="size-4" />
          {dict.newAssignment}
        </Button>
      </div>

      <div className="space-y-3 bg-card p-4 shadow-[var(--shadow-broadsheet)]">
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
                  'rounded-[var(--radius)] px-2 py-0.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-[var(--accent-700)] text-[var(--paper)]'
                    : 'bg-[var(--surface)] text-foreground/70 hover:bg-[var(--neutral-300)]',
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

      {showReview && section(dict.needsReview, dict.needsReviewHint, review)}
      {showRest && section(status ? dict.navAssignments : dict.everythingElse, null, rest)}
    </div>
  );
}
