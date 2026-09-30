import Link from 'next/link';
import { can, getProfile } from '@/lib/auth';
import { currentClub } from '@/lib/club';
import {
  EFFECTIVE_STATUSES,
  eventsFor,
  itemsFor,
  listTasksOnDay,
  nearestDaysWithTasks,
  parseOne,
} from '@/lib/db/assignments';
import { listDepartments, listPlaces } from '@/lib/db/places';
import { listProfiles } from '@/lib/db/users';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import {
  assigneeNames,
  fmtDate,
  fmtDateTime,
  fmtNum,
  fmtPeriod,
  fmtWindow,
  parseDay,
  todayInCairo,
} from '@/lib/format';
import { answerLabel } from '@/lib/answers';
import { isVideo, roundMedia, type MediaLookup } from '@/lib/media';
import { isUuid } from '@/lib/rounds';
import { reportScore, taskDepartment, workDuration } from '@/lib/report';
import { StatusBadge } from '@/components/status-badge';
import { StatusTimeline } from '@/components/status-timeline';
import { DownloadPdfButton } from '@/components/download-pdf-button';
import { LinkPending } from '@/components/ui/link-pending';
import { BackLink, PageBody, PageHeader } from '@/components/ui/page-header';
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
 * The daily department report: everything assigned in one department on one
 * day — to whom, who did it, its status history and its answers — laid out to
 * print. "Export PDF" downloads this page printed on the server (./pdf/route.ts).
 *
 * Modelled on the club's reference audit report: a header, a summary, then
 * one section per checklist with its score, duration and question/answer table.
 */
export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const day = parseDay(sp.date) ?? todayInCairo();
  const deptParam = parseOne(sp.dept);
  const deptId = isUuid(deptParam) ? deptParam : null; // anything else = all departments

  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  if (!me || !can(me, 'reports.view')) {
    return (
      <>
        <PageHeader kicker={fmtDate(day, locale)} title={dict.dailyReport} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }

  const [club, tasks, places, profiles, departments] = await Promise.all([
    currentClub(),
    listTasksOnDay(day),
    listPlaces(),
    listProfiles(),
    listDepartments(),
  ]);

  const placeDept = new Map(places.map((p) => [p.id, p.department_id]));
  const personDept = new Map(profiles.map((p) => [p.id, p.department_id]));
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const dept = deptId ? departments.find((d) => d.id === deptId) : undefined;

  const rows = tasks.rows.filter((a) => !deptId || taskDepartment(a, placeDept, personDept) === deptId);

  // An empty day is usually "the checklists are on other days" — offer them.
  const nearby = rows.length === 0 ? await nearestDaysWithTasks(day) : null;

  const ids = rows.map((a) => a.id!).filter(Boolean);
  const [items, events] = await Promise.all([itemsFor(ids), eventsFor(ids)]);

  // Signed links, only for tasks that have evidence to show. One API call per
  // such task; the links last an hour, which outlives any print.
  const withMedia = rows.filter(
    (a) => a.signature_url || (items.get(a.id!) ?? []).some((i) => (i.photo_paths ?? []).length > 0),
  );
  const lookups = new Map<string, MediaLookup>(
    await Promise.all(withMedia.map(async (a) => [a.id!, await roundMedia(a.id!)] as const)),
  );

  const n = (v: number) => fmtNum(v, locale);
  const counts = EFFECTIVE_STATUSES.map((s) => ({
    s,
    n: rows.filter((a) => a.effective_status === s).length,
  })).filter((c) => c.n > 0);

  const title = (a: (typeof rows)[number]) =>
    bilingual(locale, a.title_ar, a.title_en) ||
    bilingual(locale, a.template_title_ar, a.template_title_en) ||
    dict.none;
  const place = (a: (typeof rows)[number]) =>
    [bilingual(locale, a.round_title_ar, a.round_title_en), bilingual(locale, a.site_name_ar, a.site_name_en)]
      .filter(Boolean)
      .join(' · ');

  return (
    <>
      {/* A4 with a small margin; the browser adds nothing else. White paper:
          the PDF prints backgrounds (the status tags need theirs), and the
          screen's paper tint would come out as a grey box inside a white margin. */}
      <style>{'@page { size: A4; margin: 12mm; } @media print { body { background: #fff; } }'}</style>

      <PageHeader
        kicker={
          <span className="print:hidden">
            <BackLink href="/reports" label={dict.back} />
          </span>
        }
        title={`${dict.dailyReport} — ${dept ? bilingual(locale, dept.name_ar, dept.name_en) : dict.allDepartments}`}
        subtitle={[
          bilingual(locale, club.name.ar, club.name.en),
          fmtDate(day, locale),
          `${dict.reportGeneratedBy} ${me.name} · ${fmtDateTime(new Date().toISOString(), locale)}`,
        ].join(' · ')}
        actions={<DownloadPdfButton date={day} dept={deptId ?? 'all'} label={dict.exportPdf} dict={dict} />}
      />

      <PageBody>
        {/* Summary */}
        <section>
          <h2 className="text-heading">{dict.reportSummary}</h2>
          <p className="mt-2 text-lg">
            {dict.totalChecklists}: <span className="tabular-nums font-semibold">{n(rows.length)}</span>
            {tasks.total > tasks.rows.length && (
              <span className="ms-3 text-caption text-text/55">
                {dict.showingOf.replace('{n}', n(tasks.rows.length)).replace('{total}', n(tasks.total))}
              </span>
            )}
          </p>
          {counts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {counts.map(({ s, n: c }) => (
                <li key={s} className="flex items-center gap-2">
                  <StatusBadge status={s} dict={dict} />
                  <span className="tabular-nums font-semibold">{n(c)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {rows.length === 0 ? (
          <div className="space-y-3">
            <p className="text-text/55">{dict.reportNoRounds}</p>
            {nearby && nearby.before.length + nearby.after.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-2 print:hidden">
                <span className="text-text/55">{dict.reportNearbyDays}</span>
                {[...nearby.before, ...nearby.after].map((d) => (
                  <Link
                    key={d}
                    href={`/reports/daily?date=${d}&dept=${deptId ?? 'all'}`}
                    className="relative [&_.link-hint]:-end-2 font-semibold text-cyan-dark hover:underline"
                  >
                    {fmtDate(d, locale)}
                    <LinkPending />
                  </Link>
                ))}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Overview: one line per checklist */}
            <section>
              <h2 className="text-heading">{dict.navAssignments}</h2>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{dict.place}</TableHead>
                      <TableHead>{dict.window}</TableHead>
                      <TableHead>{dict.assignedTo}</TableHead>
                      <TableHead>{dict.submittedBy}</TableHead>
                      <TableHead className="text-end">{dict.score}</TableHead>
                      <TableHead>{dict.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((a) => {
                      const sc = reportScore(items.get(a.id!) ?? []);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="whitespace-normal">
                            <div className="font-semibold">{title(a)}</div>
                            {place(a) && <div className="text-caption text-text/55">{place(a)}</div>}
                          </TableCell>
                          <TableCell className="tabular-nums" dir="ltr">
                            {fmtWindow(a.window_start, a.window_end) ?? dict.none}
                            {a.end_date && (
                              <div className="text-caption text-text/55">
                                {fmtPeriod(a.scheduled_date, a.end_date, locale)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal">{assigneeNames(a) || dict.none}</TableCell>
                          <TableCell>{a.submitted_at ? a.inspector_name || dict.none : dict.none}</TableCell>
                          <TableCell className="text-end tabular-nums">
                            {n(sc.done)} / {n(sc.total)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={a.effective_status} dict={dict} extended={a.was_extended} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* One section per checklist, each on its own printed page. */}
            {rows.map((a) => {
              const its = items.get(a.id!) ?? [];
              const evs = events.get(a.id!) ?? [];
              const sc = reportScore(its);
              const dur = workDuration(evs);
              const media = lookups.get(a.id!) ?? (() => null);
              const signature = media(a.signature_url);
              return (
                <section key={a.id} className="space-y-4 print:break-before-page">
                  <div>
                    <h2 className="text-heading">{title(a)}</h2>
                    <p className="text-sm text-text/55">
                      {[place(a), fmtPeriod(a.scheduled_date, a.end_date, locale), fmtWindow(a.window_start, a.window_end)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                    <div>
                      <dt className="section-label">{dict.assignedTo}</dt>
                      <dd className="mt-1">{assigneeNames(a) || dict.none}</dd>
                    </div>
                    <div>
                      <dt className="section-label">{dict.submittedBy}</dt>
                      <dd className="mt-1">{a.submitted_at ? a.inspector_name || dict.none : dict.none}</dd>
                    </div>
                    <div>
                      <dt className="section-label">{dict.status}</dt>
                      <dd className="mt-1">
                        <StatusBadge status={a.effective_status} dict={dict} extended={a.was_extended} />
                      </dd>
                    </div>
                    <div>
                      <dt className="section-label">{dict.score}</dt>
                      <dd className="mt-1 tabular-nums">
                        {n(sc.done)} / {n(sc.total)} ({n(sc.pct)}%)
                      </dd>
                    </div>
                    <div>
                      <dt className="section-label">{dict.duration}</dt>
                      <dd className="mt-1 tabular-nums">
                        {dur
                          ? `${fmtDateTime(dur.start, locale)} – ${fmtDateTime(dur.end, locale)} · ${dict.minutesShort.replace('{n}', n(dur.minutes))}`
                          : dict.none}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <h3 className="section-label">{dict.timeline}</h3>
                    <div className="mt-2">
                      <StatusTimeline events={evs} names={names} dict={dict} locale={locale} />
                    </div>
                  </div>

                  {its.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{dict.question}</TableHead>
                          <TableHead>{dict.answer}</TableHead>
                          <TableHead className="text-end">{dict.score}</TableHead>
                          <TableHead>{dict.photo}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {its.map((i) => {
                          const photos = (i.photo_paths ?? [])
                            .map(media)
                            .filter((u): u is string => u !== null);
                          return (
                            <TableRow key={i.id}>
                              <TableCell className="whitespace-normal">
                                {bilingual(locale, i.text_ar, i.text_en) || dict.none}
                                {i.note && <div className="text-caption text-text/55">{i.note}</div>}
                                {i.reject_note && <div className="text-caption text-magenta">{i.reject_note}</div>}
                              </TableCell>
                              <TableCell>{i.answer ? answerLabel(i.type, i.answer, dict) : dict.none}</TableCell>
                              <TableCell className="text-end tabular-nums">{n(i.status === 'done' ? 1 : 0)}</TableCell>
                              <TableCell>
                                {photos.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {photos.map((url) =>
                                      isVideo(url) ? (
                                        <a key={url} href={url} className="text-caption text-cyan-dark underline">
                                          {dict.video}
                                        </a>
                                      ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img key={url} src={url} alt={dict.photo} className="size-16 rounded-card object-cover" />
                                      ),
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}

                  {(a.task_note || a.submit_note || a.review_note) && (
                    <div className="space-y-1 text-sm">
                      {a.task_note && (
                        <p>
                          <span className="me-2 text-label uppercase">{dict.taskNote}</span>
                          {a.task_note}
                        </p>
                      )}
                      {a.submit_note && (
                        <p>
                          <span className="me-2 text-label uppercase">{dict.submitNote}</span>
                          {a.submit_note}
                        </p>
                      )}
                      {a.review_note && (
                        <p>
                          <span className="me-2 text-label uppercase">{dict.reviewNote}</span>
                          {a.review_note}
                        </p>
                      )}
                    </div>
                  )}

                  {signature && (
                    <div>
                      <h3 className="section-label">{dict.signature}</h3>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signature} alt={dict.signature} className="mt-2 max-w-48 rounded-card bg-surface p-2" />
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </PageBody>
    </>
  );
}
