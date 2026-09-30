import { addDays } from '@/lib/format';
import type { Assignment, EffectiveStatus, SubmissionEventRow } from '@/lib/types/database';

/**
 * The pure rules behind the daily department report (app/(portal)/reports),
 * kept apart from the queries so scripts/check.ts can test them.
 */

/**
 * Which department a task belongs to in the report: its place's department,
 * and only when the place has none (a place shared by every department),
 * the department of whoever holds it — the owner, else the first assignee.
 */
export function roundDepartment(
  placeDepartment: string | null | undefined,
  peopleDepartments: (string | null | undefined)[],
): string | null {
  return placeDepartment ?? peopleDepartments.find((d) => !!d) ?? null;
}

/** The columns the reports list reads (lib/db/assignments.ts, reportDays). */
export type ReportTask = Pick<
  Assignment,
  | 'id'
  | 'scheduled_date'
  | 'end_date'
  | 'effective_status'
  | 'template_id'
  | 'source_template_id'
  | 'inspector_id'
  | 'assignee_ids'
>;

/** roundDepartment() for one task, given who and what belongs where. The daily
 *  report and the list both filter with this, so their counts agree. */
export function taskDepartment(
  a: Omit<ReportTask, 'id' | 'scheduled_date' | 'end_date' | 'effective_status'>,
  placeDept: Map<string, string | null>,
  personDept: Map<string, string | null>,
): string | null {
  const place = a.template_id ?? a.source_template_id;
  const people = [a.inspector_id, ...(a.assignee_ids ?? [])].map((id) => (id ? personDept.get(id) : null));
  return roundDepartment(place ? placeDept.get(place) : null, people);
}

export type ReportDay = { day: string; total: number; byStatus: Partial<Record<EffectiveStatus, number>> };

/**
 * The reports list: every day up to `today` with a task on it, newest first,
 * with the same figures as that day's report. A multi-day task counts on each
 * of its days, as listTasksOnDay() finds it; `deptId` null = all departments.
 */
export function daysFromTasks(
  rows: ReportTask[],
  today: string,
  deptId: string | null,
  placeDept: Map<string, string | null>,
  personDept: Map<string, string | null>,
): ReportDay[] {
  const days = new Map<string, ReportDay>();
  for (const a of rows) {
    if (!a.scheduled_date) continue;
    if (deptId && taskDepartment(a, placeDept, personDept) !== deptId) continue;
    const end = a.end_date ?? a.scheduled_date;
    const last = end < today ? end : today;
    for (let d = a.scheduled_date; d <= last; d = addDays(d, 1)) {
      const e = days.get(d) ?? { day: d, total: 0, byStatus: {} };
      e.total += 1;
      // The report counts a status only when there is one; total counts all.
      if (a.effective_status) e.byStatus[a.effective_status] = (e.byStatus[a.effective_status] ?? 0) + 1;
      days.set(d, e);
    }
  }
  return [...days.values()].sort((x, y) => (x.day < y.day ? 1 : -1));
}

/** Items answered correctly out of all items, as the reference report scores a checklist. */
export function reportScore(items: { status: string }[]): { done: number; total: number; pct: number } {
  const total = items.length;
  const done = items.filter((i) => i.status === 'done').length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * From the first answer to the first submit: how long the work took. Null
 * until both have happened. A backfilled row has no 'started' event (history
 * began on 27 Sep 2026), so it has no duration either rather than a wrong one.
 */
export function workDuration(
  events: Pick<SubmissionEventRow, 'event' | 'at'>[],
): { start: string; end: string; minutes: number } | null {
  const start = events.find((e) => e.event === 'started' || e.event === 'claimed')?.at;
  const end = events.find((e) => e.event === 'submitted' || e.event === 'follow_up')?.at;
  if (!start || !end || end < start) return null;
  return { start, end, minutes: Math.round((Date.parse(end) - Date.parse(start)) / 60_000) };
}
