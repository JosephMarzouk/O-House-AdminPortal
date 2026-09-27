import type { SubmissionEventRow } from '@/lib/types/database';

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
