import { can, getProfile } from '@/lib/auth';
import { itemCountsFor, listTrackerTasks, reviewItemsFor } from '@/lib/db/assignments';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import {
  assigneeNames,
  fmtDate,
  fmtNum,
  fmtWindow,
  parseDay,
  todayInCairo,
} from '@/lib/format';
import { MOVE_PERMISSION, type BoardTask, type Move } from '@/lib/tracker';
import { DayNav } from '@/components/tracker/day-nav';
import { TaskBoard } from '@/components/tracker/task-board';
import { NoPermission } from '@/components/no-permission';
import { PageBody, PageHeader } from '@/components/ui/page-header';

/**
 * The task tracker. checklists.view follows it; review.edit approves and
 * sends back, checklists.edit gives more time (MOVE_PERMISSION).
 * RLS decides what each viewer sees — by the role's scope — through
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

  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  if (!can(me, 'checklists.view')) {
    return (
      <>
        <PageHeader kicker={fmtDate(today, locale)} title={dict.navTracker} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }
  const { rows, total } = await listTrackerTasks(day);

  const moves = Object.keys(MOVE_PERMISSION) as Move[];
  const permitted = moves.filter((m) => can(me, MOVE_PERMISSION[m]));
  const ids = rows.map((r) => r.id).filter((id): id is string => !!id);
  // The send-back dialog lists a card's items, and only In Review cards can
  // be sent back — so only theirs are fetched, and only for someone who may.
  const reviewIds = permitted.includes('send_back')
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
        // Several assignees and nobody has started: all of them. Once someone
        // has, the owner — the card is theirs now.
        assignee: r.inspector_name || assigneeNames(r),
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

  const scope = me?.access?.scope;
  const scopeNote =
    scope === 'team'
      ? dict.trackerScope
      : scope === 'departments'
        ? dict.scopeDepartmentsNote
        : scope === 'own'
          ? dict.trackerScopeOwn
          : null;

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
        {/* Nothing movable: view only. Some moves: the greyed ones are the
            ones I lack (approve and send back are review.edit's). */}
        {permitted.length < moves.length && (
          <NoPermission dict={dict} text={permitted.length ? dict.greyedNoPermission : dict.viewOnly} />
        )}
        {(scopeNote || total > rows.length) && (
          <div className="space-y-1 text-sm text-text/55">
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
          permitted={permitted}
          dict={dict}
          locale={locale}
        />
      </PageBody>
    </>
  );
}
