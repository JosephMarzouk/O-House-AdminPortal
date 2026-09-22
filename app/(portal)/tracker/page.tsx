import { canMoveTasks, getProfile } from '@/lib/auth';
import { itemCountsFor, listTrackerTasks, reviewItemsFor } from '@/lib/db/assignments';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtNum, fmtWindow, parseDay, todayInCairo } from '@/lib/format';
import type { BoardTask } from '@/lib/tracker';
import { DayNav } from '@/components/tracker/day-nav';
import { TaskBoard } from '@/components/tracker/task-board';
import { PageBody, PageHeader } from '@/components/ui/page-header';

/**
 * The task tracker. Every portal role can follow it; only admins move cards
 * (canMoveTasks). RLS decides what each viewer sees — an admin everything, a
 * manager their own staff, an inspector their own tasks — through
 * assignments_v's security_invoker.
 */
export default async function TrackerPage({
  searchParams,
}: {
  // A Promise in Next 16 — it must be awaited before anything reads it.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const today = todayInCairo();
  // parseDay is the guard for the .or() filter listTrackerTasks builds.
  const day = parseDay(sp.date) ?? today;

  const [dict, locale, me, { rows, total }] = await Promise.all([
    getDictionary(),
    getLocale(),
    getProfile(),
    listTrackerTasks(day),
  ]);

  const canMove = canMoveTasks(me?.role);
  const ids = rows.map((r) => r.id).filter((id): id is string => !!id);
  // The send-back dialog lists a card's items, and only In Review cards can
  // be sent back — so only theirs are fetched, and only for someone who can move.
  const reviewIds = canMove
    ? rows.filter((r) => r.effective_status === 'submitted' && r.id).map((r) => r.id!)
    : [];
  const [counts, reviewItems] = await Promise.all([itemCountsFor(ids), reviewItemsFor(reviewIds)]);

  const tasks: BoardTask[] = rows
    .filter((r) => r.id && r.effective_status)
    .map((r) => {
      const c = counts.get(r.id!);
      return {
        id: r.id!,
        // The app's card heading, falling back to the template title for the
        // odd legacy row whose own title columns are empty.
        title:
          bilingual(locale, r.title_ar, r.title_en) ||
          bilingual(locale, r.template_title_ar, r.template_title_en),
        place: bilingual(locale, r.site_name_ar, r.site_name_en),
        round: bilingual(locale, r.round_title_ar, r.round_title_en),
        assignee: r.inspector_name ?? '',
        date: r.scheduled_date,
        window: fmtWindow(r.window_start, r.window_end),
        effective: r.effective_status!,
        raw: r.status,
        extended: !!r.was_extended,
        done: c?.done ?? 0,
        total: c?.total ?? 0,
        followUp: c?.followUp ?? 0,
      };
    });

  const scopeNote =
    me?.role === 'manager' ? dict.trackerScope : me?.role === 'inspector' ? dict.trackerScopeOwn : null;

  return (
    <>
      <PageHeader kicker={fmtDate(today, locale)} title={dict.navTracker} subtitle={fmtDate(day, locale)}>
        <DayNav
          day={day}
          today={today}
          labels={{ prev: dict.prevDay, next: dict.nextDay, today: dict.today, date: dict.date }}
        />
      </PageHeader>

      <PageBody className="space-y-4">
        {(!canMove || scopeNote || total > rows.length) && (
          <div className="space-y-1 text-sm text-text/55">
            {!canMove && <p>{dict.trackerReadOnly}</p>}
            {scopeNote && <p>{scopeNote}</p>}
            {total > rows.length && (
              <p>
                {dict.showingOf
                  .replace('{n}', fmtNum(rows.length, locale))
                  .replace('{total}', fmtNum(total, locale))}
              </p>
            )}
          </div>
        )}

        <TaskBoard
          key={day}
          tasks={tasks}
          reviewItems={Object.fromEntries(reviewItems)}
          canMove={canMove}
          dict={dict}
          locale={locale}
        />
      </PageBody>
    </>
  );
}
