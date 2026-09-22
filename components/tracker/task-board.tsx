'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { alert } from '@/components/ui/alert-dialog';
import { approveAssignment } from '@/lib/actions/assignments';
import { ExtendDialog, RejectItemsDialog } from '@/components/assignments/review-dialogs';
import {
  MoreIcon,
  SearchIcon,
  StatusExtendedIcon,
  StatusFollowUpIcon,
  StatusPendingIcon,
  UserIcon,
} from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Tag, TagGroup } from '@/components/ui/tag';
import {
  allowedMoves,
  COLUMN_LABEL,
  COLUMN_OF,
  COLUMN_TONE,
  COLUMNS,
  type BoardTask,
  type Column,
  type Move,
} from '@/lib/tracker';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { fmtDate, fmtNum } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

type ReviewItem = { id: string; text_ar: string; text_en: string };

/**
 * The task tracker: every task of the day (and open work carried over from
 * earlier days) as cards in six columns, one per stage of a task's life.
 *
 * Admins can move a card — by dragging it on a desktop, or from its "Move
 * to…" menu anywhere (a phone has no HTML5 drag, and a keyboard has no mouse).
 * The moves are the review actions and nothing else; see allowedMoves(). While
 * a card is held, only the columns it may land in light up and accept it.
 *
 * A move runs the same action the detail page's review bar runs, then
 * refreshes: the card lands where the database now says it belongs, rather
 * than where the drop suggested. Only failures raise an alert — a success
 * dialog after every drop would be noise on a board you work through quickly.
 */
export function TaskBoard({
  tasks,
  reviewItems,
  canMove,
  dict,
  locale,
}: {
  tasks: BoardTask[];
  /** Checklist items of the In Review cards, for the send-back dialog. */
  reviewItems: Record<string, ReviewItem[]>;
  canMove: boolean;
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState<BoardTask | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'send_back' | 'extend'; task: BoardTask } | null>(
    null,
  );

  const n = (v: number) => fmtNum(v, locale);

  const byColumn = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = Object.fromEntries(COLUMNS.map((c) => [c, [] as BoardTask[]])) as Record<
      Column,
      BoardTask[]
    >;
    for (const t of tasks) {
      if (q && ![t.title, t.place, t.round, t.assignee].some((s) => s.toLowerCase().includes(q))) {
        continue;
      }
      groups[COLUMN_OF[t.effective]].push(t);
    }
    return groups;
  }, [tasks, query]);

  function perform(task: BoardTask, move: Move) {
    if (move !== 'approve') {
      setDialog({ kind: move, task });
      return;
    }
    setBusy(task.id);
    startTransition(async () => {
      const res = await approveAssignment(task.id);
      setBusy(null);
      if (res.ok) router.refresh();
      else alert.error(errorMessage(dict, res.error));
    });
  }

  function drop(column: Column) {
    const task = dragging;
    setDragging(null);
    setOver(null);
    if (!task) return;
    const move = allowedMoves(task.effective, task.raw)[column];
    if (move) perform(task, move);
  }

  const moveLabel: Record<Move, string> = {
    approve: dict.moveApprove,
    send_back: dict.moveSendBack,
    extend: dict.moveExtend,
  };

  return (
    <div className="space-y-4">
      <Input
        compact
        className="max-w-sm"
        prefix={<SearchIcon className="size-icon" />}
        aria-label={dict.search}
        placeholder={dict.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* One lane per column. On a phone each lane is most of the screen
          wide and snaps into place, so the next lane's edge shows there is
          more to swipe to; from md up they share the width and scroll only
          when six no longer fit. The negative margin lets the lanes run to
          the screen edge on a phone instead of stopping at the gutter. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0">
        {COLUMNS.map((column) => {
          const cards = byColumn[column];
          const target = dragging ? allowedMoves(dragging.effective, dragging.raw)[column] : undefined;
          return (
            <section
              key={column}
              aria-labelledby={`col-${column}`}
              className={cn(
                'flex w-lane shrink-0 snap-start flex-col gap-2 rounded-card p-1 transition-colors md:w-auto md:min-w-column md:flex-1',
                target && 'bg-cyan-tint outline-2 outline-offset-2 outline-cyan outline-dashed',
                target && over === column && 'outline-solid',
              )}
              onDragOver={(e) => {
                if (!target) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (over !== column) setOver(column);
              }}
              onDragLeave={(e) => {
                // Leaving for one of this lane's own cards is not leaving.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setOver((o) => (o === column ? null : o));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(column);
              }}
            >
              <header className="flex min-h-control items-center gap-2 px-2">
                <h2 id={`col-${column}`} className="text-label uppercase text-text/70">
                  {dict[COLUMN_LABEL[column]]}
                </h2>
                <Tag tone={COLUMN_TONE[column]} className="tabular-nums">
                  {n(cards.length)}
                </Tag>
              </header>

              {cards.length === 0 && (
                <p className="px-2 pb-2 text-caption text-text/55">{dict.emptyColumn}</p>
              )}

              {cards.map((t) => {
                const moves = Object.entries(allowedMoves(t.effective, t.raw)) as [Column, Move][];
                const movable = canMove && moves.length > 0 && busy !== t.id;
                const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
                return (
                  <article
                    key={t.id}
                    draggable={movable}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', t.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragging(t);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn(
                      'space-y-2 rounded-card bg-surface p-3',
                      movable && 'cursor-grab active:cursor-grabbing',
                      busy === t.id && 'opacity-45',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {t.round && (
                          <div className="truncate text-kicker uppercase text-cyan-dark">{t.round}</div>
                        )}
                        {/* draggable={false}: a link is draggable on its own, and
                            would otherwise carry its URL off instead of the card. */}
                        <Link
                          href={`/assignments/${t.id}`}
                          draggable={false}
                          className="font-semibold text-text hover:underline"
                        >
                          {t.title || dict.none}
                        </Link>
                        {t.place && t.place !== t.title && (
                          <div className="text-caption text-text/55">{t.place}</div>
                        )}
                      </div>

                      {movable && (
                        <Menu.Root>
                          <Menu.Trigger
                            aria-label={dict.moveTo}
                            className="-me-2 -mt-2 flex size-control shrink-0 items-center justify-center rounded-control text-text/55 transition-colors hover:bg-text/7 hover:text-text [&_svg]:size-icon"
                          >
                            <MoreIcon />
                          </Menu.Trigger>
                          <Menu.Portal>
                            <Menu.Positioner sideOffset={4} align="end" className="z-50">
                              <Menu.Popup className="min-w-48 rounded-dialog bg-raised p-1 text-text shadow-lg shadow-(color:--color-shade) outline-none">
                                {moves.map(([column, move]) => (
                                  <Menu.Item
                                    key={column}
                                    onClick={() => perform(t, move)}
                                    className="flex min-h-control cursor-pointer items-center rounded-control px-3 text-sm outline-none data-highlighted:bg-text/7"
                                  >
                                    {moveLabel[move]}
                                  </Menu.Item>
                                ))}
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.Root>
                      )}
                    </div>

                    {(t.followUp > 0 || t.extended) && (
                      <TagGroup>
                        {t.followUp > 0 && (
                          <Tag tone="follow_up" icon={<StatusFollowUpIcon />}>
                            {dict.followUpCount.replace('{n}', n(t.followUp))}
                          </Tag>
                        )}
                        {t.extended && (
                          <Tag tone="extended" icon={<StatusExtendedIcon />}>
                            {dict.extended}
                          </Tag>
                        )}
                      </TagGroup>
                    )}

                    <div className="flex items-center gap-1 text-sm text-text/70">
                      <UserIcon className="size-icon-sm shrink-0" />
                      <span className="truncate">{t.assignee || dict.none}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-caption text-text/55">
                      <StatusPendingIcon className="size-icon-sm shrink-0" />
                      <span>{fmtDate(t.date, locale)}</span>
                      {t.window && (
                        <span dir="ltr" className="tabular-nums">
                          · {t.window}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-control bg-text/8">
                        <div
                          className={cn('h-full', t.followUp > 0 ? 'bg-magenta' : 'bg-cyan')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-caption tabular-nums text-text/55">
                        {n(t.done)} / {n(t.total)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>

      {dialog?.kind === 'send_back' && (
        <RejectItemsDialog
          assignmentId={dialog.task.id}
          items={reviewItems[dialog.task.id] ?? []}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onDone={() => router.refresh()}
          dict={dict}
          locale={locale}
        />
      )}
      {dialog?.kind === 'extend' && (
        <ExtendDialog
          assignmentId={dialog.task.id}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onDone={() => router.refresh()}
          dict={dict}
        />
      )}
    </div>
  );
}
