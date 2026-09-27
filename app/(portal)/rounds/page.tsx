import Link from 'next/link';
import { PencilIcon, PlusIcon } from '@/components/icons';
import { canSchedule, getProfile } from '@/lib/auth';
import { listPlaces } from '@/lib/db/places';
import { listRoundTemplates, listRounds, startedRoundIds } from '@/lib/db/rounds';
import { assignableStaff, listProfiles } from '@/lib/db/users';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { addDays, fmtDate, fmtNum, fmtWindow, parseDay, todayInCairo, weekStart } from '@/lib/format';
import { cellKey, roundPlaces } from '@/lib/rounds';
import { WeekPlanner } from '@/components/rounds/week-planner';
import { Button } from '@/components/ui/button';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { LinkPending } from '@/components/ui/link-pending';
import { Tag } from '@/components/ui/tag';
import { SearchBox } from '@/components/search-box';
import { parseOne } from '@/lib/db/assignments';
import { matchesQuery } from '@/lib/search';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function RoundsPage({
  searchParams,
}: {
  // A Promise in Next 16 — it must be awaited before anything reads it.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const today = todayInCairo();
  const kicker = fmtDate(today, locale);

  // Courtesy, not the control: round_templates_write and schedule_rounds()
  // refuse everyone but admins and managers in the database.
  if (!me || !canSchedule(me.role)) {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navRounds} subtitle={dict.adminOnly} />
        <PageBody />
      </>
    );
  }

  const start = weekStart(parseDay(sp.week) ?? today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const lastWeekDays = days.map((d) => addDays(d, -7));

  const [templates, rounds, profiles, places] = await Promise.all([
    listRoundTemplates(),
    // Last week too, for "copy last week".
    listRounds(lastWeekDays[0], days[6]),
    listProfiles(),
    listPlaces(),
  ]);

  const thisWeek = rounds.filter((r) => r.scheduled_date >= days[0]);
  const started = await startedRoundIds(thisWeek.map((r) => r.id));

  const initial: Record<string, string[]> = {};
  const startedKeys: string[] = [];
  for (const r of thisWeek) {
    const key = cellKey(r.round_template_id, r.scheduled_date);
    initial[key] = r.assignee_ids ?? [];
    if (started.has(r.id)) startedKeys.push(key);
  }
  const lastWeek: Record<string, string[]> = {};
  for (const r of rounds) {
    if (r.scheduled_date < days[0] && r.assignee_ids?.length) {
      lastWeek[cellKey(r.round_template_id, r.scheduled_date)] = r.assignee_ids;
    }
  }

  // Active rounds, plus any retired one still planned this week — otherwise
  // its cells would vanish from the grid while its tasks carried on.
  const plannedIds = new Set(thisWeek.map((r) => r.round_template_id));
  const plannerRounds = templates
    .filter((t) => t.active || plannedIds.has(t.id))
    .map((t) => ({ id: t.id, titleAr: t.title_ar, titleEn: t.title_en }));

  // The assignable staff, plus anyone already holding a cell who no longer
  // is (deactivated, or moved to another role) — so the picker can still show
  // their name rather than an empty cell that looks unplanned.
  const assignable = assignableStaff(profiles);
  const assignableIds = new Set(assignable.map((p) => p.id));
  const holders = new Set(Object.values(initial).flat());
  const staff = [
    ...assignable,
    ...profiles.filter((p) => holders.has(p.id) && !assignableIds.has(p.id)),
  ].map((p) => ({ id: p.id, name: p.name }));

  const placeName = new Map(
    places.map((p) => [p.id, bilingual(locale, p.title_ar, p.title_en)]),
  );

  // The search narrows the template table only; the planner above keeps
  // every round, or a search would hide cells someone is scheduling.
  const q = parseOne(sp.q);
  const listed = templates.filter((t) =>
    matchesQuery(
      q,
      t.title_en,
      t.title_ar,
      ...roundPlaces(t.places).map((s) => placeName.get(s.template_id)),
    ),
  );

  return (
    <>
      <PageHeader
        kicker={kicker}
        title={dict.navRounds}
        subtitle={dict.roundsIntro}
        actions={
          <Button className="relative" nativeButton={false} render={<Link href="/rounds/new" />}>
            <PlusIcon />
            {dict.newRound}
            <LinkPending />
          </Button>
        }
      />

      <PageBody>
        <WeekPlanner
          // Remount from the server's plan whenever it changes, so after a
          // save the grid shows what the database now holds.
          key={`${start}:${JSON.stringify(initial)}`}
          weekStart={start}
          days={days}
          lastWeekDays={lastWeekDays}
          today={today}
          rounds={plannerRounds}
          staff={staff}
          initial={initial}
          lastWeek={lastWeek}
          started={startedKeys}
          dict={dict}
          locale={locale}
        />

        <section>
          <h2 className="text-heading">{dict.roundTemplates}</h2>
          <div className="mt-4">
            <SearchBox value={q} label={dict.search} />
          </div>
          <div className="mt-4">
            {listed.length === 0 ? (
              <p className="text-text/55">{q ? dict.noData : dict.noRounds}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.round}</TableHead>
                    <TableHead>{dict.roundPlaces}</TableHead>
                    <TableHead>{dict.status}</TableHead>
                    <TableHead>{dict.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listed.map((t) => {
                    const stops = roundPlaces(t.places);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link
                            href={`/rounds/${t.id}`}
                            className="relative [&_.link-hint]:-end-2 font-semibold text-cyan-dark hover:underline"
                          >
                            {bilingual(locale, t.title_ar, t.title_en) || dict.none}
                            <LinkPending />
                          </Link>
                          <div className="text-caption text-text/55">
                            {dict.placeCount.replace('{n}', fmtNum(stops.length, locale))}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {/* The walk, in order: "Gym 07:00 – 07:30 · Pool …" */}
                          <span className="text-sm text-text/70">
                            {stops
                              .map(
                                (s) =>
                                  `${placeName.get(s.template_id) || dict.none} ${fmtWindow(s.window_start, s.window_end) ?? ''}`,
                              )
                              .join(' · ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Tag tone={t.active ? 'in_progress' : 'pending'}>
                            {t.active ? dict.roundActive : dict.roundInactive}
                          </Tag>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={dict.edit}
                            nativeButton={false}
                            render={<Link href={`/rounds/${t.id}`} />}
                          >
                            <PencilIcon />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </PageBody>
    </>
  );
}
