'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { saveWeekPlan } from '@/lib/actions/rounds';
import { CaretLeftIcon, CaretRightIcon, CopyIcon, LockIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { addDays, fmtDate, fmtNum, fmtWeekday } from '@/lib/format';
import { cellKey, changedCells, fillFromLastWeek } from '@/lib/rounds';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { ScheduleResult } from '@/lib/types/database';

export type PlannerRound = { id: string; titleAr: string; titleEn: string };
export type PlannerStaff = { id: string; name: string };

/** The "whole week" picker's resting value, and its "nobody" choice. */
const PICK = '';
const NOBODY = '__nobody__';

/**
 * The week planner: every active round × the seven days of a Saturday–Friday
 * week, one staff picker per cell. Nothing is written until Save, and Save
 * sends only the cells that changed — as one schedule_rounds() call, so the
 * week lands whole or not at all.
 *
 * What a save does to each changed cell is the database's business
 * (schedule_rounds, 0013): a new person gets one task per place; a changed
 * person takes over only the places nobody has started; a cleared cell
 * removes only untouched tasks. A lock marks the cells where that
 * distinction will bite, and the summary afterwards says what happened.
 *
 * The past is read-only — the database refuses it too (PAST_DATE).
 */
export function WeekPlanner({
  weekStart,
  days,
  lastWeekDays,
  today,
  rounds,
  staff,
  initial,
  lastWeek,
  started,
  dict,
  locale,
}: {
  weekStart: string;
  days: string[];
  lastWeekDays: string[];
  today: string;
  rounds: PlannerRound[];
  staff: PlannerStaff[];
  /** cellKey → assignee id ('' when the round exists but nobody holds it). */
  initial: Record<string, string>;
  lastWeek: Record<string, string>;
  /** cellKeys whose round already has a started task. */
  started: string[];
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cells, setCells] = useState<Record<string, string>>(initial);

  const startedSet = useMemo(() => new Set(started), [started]);
  const changes = useMemo(() => changedCells(initial, cells), [initial, cells]);
  const editable = (day: string) => day >= today;
  const title = (r: PlannerRound) => bilingual(locale, r.titleAr, r.titleEn) || dict.none;

  function setCell(roundId: string, day: string, assignee: string) {
    setCells((c) => ({ ...c, [cellKey(roundId, day)]: assignee }));
  }

  function setWholeWeek(roundId: string, picked: string) {
    const assignee = picked === NOBODY ? '' : picked;
    setCells((c) => {
      const next = { ...c };
      for (const day of days) if (editable(day)) next[cellKey(roundId, day)] = assignee;
      return next;
    });
  }

  function copyLastWeek() {
    setCells((c) =>
      fillFromLastWeek(c, lastWeek, rounds.map((r) => r.id), days, lastWeekDays, today),
    );
  }

  function summary(r: ScheduleResult): string {
    const n = (v: number) => fmtNum(v, locale);
    return [
      dict.planSaved,
      r.created && dict.planCreated.replace('{n}', n(r.created)),
      r.moved && dict.planMoved.replace('{n}', n(r.moved)),
      r.removed && dict.planRemoved.replace('{n}', n(r.removed)),
      r.kept && dict.planKept.replace('{n}', n(r.kept)),
      r.skipped && dict.planSkipped.replace('{n}', n(r.skipped)),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  function save() {
    startTransition(async () => {
      const res = await saveWeekPlan(changes);
      if (!res.ok) {
        alert.error(errorMessage(dict, res.error));
        return;
      }
      alert.success(summary(res.result));
      // The page re-reads the week and remounts this grid from it (it is
      // keyed on the server's plan), so what shows is what the database holds.
      router.refresh();
    });
  }

  const staffOptions = (
    <>
      <option value="">{dict.unassigned}</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </>
  );

  function cellPicker(r: PlannerRound, day: string, className?: string) {
    const key = cellKey(r.id, day);
    const changed = (cells[key] ?? '') !== (initial[key] ?? '');
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Select
          compact
          className={cn('min-w-36 flex-1', changed && '[&_select]:border-cyan')}
          aria-label={`${title(r)} — ${fmtWeekday(day, locale)}`}
          disabled={!editable(day) || pending}
          value={cells[key] ?? ''}
          onChange={(e) => setCell(r.id, day, e.target.value)}
        >
          {staffOptions}
        </Select>
        {startedSet.has(key) && (
          <span title={dict.startedHint} aria-label={dict.startedHint} className="text-text/55">
            <LockIcon className="size-icon-sm" />
          </span>
        )}
      </div>
    );
  }

  function wholeWeekPicker(r: PlannerRound) {
    return (
      <Select
        compact
        className="min-w-36"
        aria-label={`${title(r)} — ${dict.wholeWeek}`}
        disabled={pending}
        value={PICK}
        onChange={(e) => setWholeWeek(r.id, e.target.value)}
      >
        <option value={PICK} disabled>
          {dict.wholeWeek}
        </option>
        <option value={NOBODY}>{dict.unassigned}</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    );
  }

  const weekHref = (start: string) => `/rounds?week=${start}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="me-2 text-heading">{dict.weekPlan}</h2>
        <span className="text-lg text-text/55">
          {fmtDate(days[0], locale)} – {fmtDate(days[6], locale)}
        </span>
        <div className="ms-auto flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={dict.prevWeek}
            nativeButton={false}
            render={<Link href={weekHref(addDays(weekStart, -7))} scroll={false} />}
          >
            <CaretLeftIcon className="rtl:-scale-x-100" />
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/rounds" scroll={false} />}
          >
            {dict.thisWeek}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={dict.nextWeek}
            nativeButton={false}
            render={<Link href={weekHref(addDays(weekStart, 7))} scroll={false} />}
          >
            <CaretRightIcon className="rtl:-scale-x-100" />
          </Button>
          <Button variant="outline" disabled={pending} onClick={copyLastWeek}>
            <CopyIcon />
            {dict.copyLastWeek}
          </Button>
        </div>
      </div>

      {rounds.length === 0 ? (
        <p className="text-text/55">{dict.noRounds}</p>
      ) : (
        <>
          {/* md and up: the grid itself — rounds down, days across. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.round}</TableHead>
                  {days.map((d) => (
                    <TableHead key={d} className={cn(d === today && 'text-cyan-dark')}>
                      {fmtWeekday(d, locale)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="min-w-44 align-top">
                      <div className="mb-2 font-semibold">{title(r)}</div>
                      {wholeWeekPicker(r)}
                    </TableCell>
                    {days.map((d) => (
                      <TableCell key={d} className="align-top">
                        {cellPicker(r, d)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phones: the same grid read one day at a time, which is how a
              supervisor plans on the move — today, then tomorrow. */}
          <div className="space-y-6 md:hidden">
            <div className="space-y-2">
              <h3 className="section-label">{dict.wholeWeek}</h3>
              {rounds.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate">{title(r)}</span>
                  {wholeWeekPicker(r)}
                </div>
              ))}
            </div>
            {days.map((d) => (
              <div key={d} className="space-y-2">
                <h3 className={cn('section-label', d === today && 'text-cyan-dark')}>
                  {fmtWeekday(d, locale)}
                </h3>
                {rounds.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate">{title(r)}</span>
                    {cellPicker(r, d, 'w-48 flex-none')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {changes.length > 0 && (
        <div className="sticky bottom-6 flex flex-wrap items-center gap-2 rounded-tile bg-raised p-4 shadow-md shadow-(color:--color-shade)">
          <span className="me-auto text-sm text-text/70">
            {dict.changesPending.replace('{n}', fmtNum(changes.length, locale))}
          </span>
          <Button variant="ghost" disabled={pending} onClick={() => setCells(initial)}>
            {dict.discard}
          </Button>
          <Button disabled={pending} onClick={save}>
            {pending ? dict.loading : dict.save}
          </Button>
        </div>
      )}
    </section>
  );
}
