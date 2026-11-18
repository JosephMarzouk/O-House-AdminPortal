import { addDays, parseDay } from '@/lib/format';
import { isUuid } from '@/lib/rounds';
import { matchesQuery } from '@/lib/search';
import type { Assignment, EffectiveStatus, SubmissionEventRow } from '@/lib/types/database';

/**
 * The pure rules behind the daily department report (app/(portal)/reports),
 * kept apart from the queries so scripts/check.ts can test them.
 */

/** report_mail_recipients' own check, so the form refuses what the database would. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * A department's report recipients as typed: one per line (commas and
 * semicolons too, as pasted from Outlook), lower-cased, deduplicated.
 * `bad` is the first entry that is not an address.
 */
export function parseEmails(text: string): { emails: string[]; bad: string | null } {
  const all = text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return { emails: [...new Set(all)], bad: all.find((e) => !EMAIL.test(e) || e.length > 254) ?? null };
}

/** A week: the weekly report email covers Saturday to Friday. */
export const MAX_REPORT_DAYS = 7;

/**
 * A report's last day: `to` when it runs from `from` to at most a week on,
 * else `from` (a one-day report). Both MUST come through parseDay().
 */
export function reportEnd(from: string, to: string | undefined): string {
  return to && to >= from && to <= addDays(from, MAX_REPORT_DAYS - 1) ? to : from;
}

/** assignments_v.effective_status values, as lib/db/assignments.ts lists them
 *  (kept here because that module needs the database client). */
export const REPORT_STATUSES = ['pending', 'in_progress', 'follow_up', 'submitted', 'approved', 'rejected', 'expired'] as const;

/** The reports' optional filters. Every field absent = no filter. */
export type ReportFilter = {
  /** Checklist name, either language, case-insensitive. */
  q?: string;
  /** A place (templates row) id. */
  place?: string;
  /** A person's id: an assignee, the inspector (who took it / submitted it). */
  user?: string;
  status?: EffectiveStatus;
};

/** Longest checklist-name filter; more is certainly not a name. */
const MAX_Q = 100;

/**
 * Parses the filter params (?q=&place=&user=&status=): null when one is
 * present but malformed. Empty values count as absent, since a GET form
 * sends every field. Only the filters that are set appear in the result.
 */
export function reportFilterParams(sp: URLSearchParams): ReportFilter | null {
  const f: ReportFilter = {};
  const q = (sp.get('q') ?? '').trim();
  if (q.length > MAX_Q) return null;
  if (q) f.q = q;
  for (const key of ['place', 'user'] as const) {
    const v = sp.get(key) ?? '';
    if (v === '') continue;
    if (!isUuid(v)) return null;
    f[key] = v;
  }
  const status = sp.get('status') ?? '';
  if (status !== '') {
    if (!(REPORT_STATUSES as readonly string[]).includes(status)) return null;
    f.status = status as EffectiveStatus;
  }
  return f;
}

/** The columns matchesReportFilter reads. */
export type ReportFilterRow = Pick<
  Assignment,
  | 'effective_status'
  | 'template_id'
  | 'source_template_id'
  | 'inspector_id'
  | 'assignee_ids'
  | 'title_en'
  | 'title_ar'
  | 'template_title_en'
  | 'template_title_ar'
>;

/**
 * Whether a task passes the report's filters. The one rule behind the list's
 * counts (daysFromTasks), the day's report (reportRows) and so the PDF and
 * the summary, which is what keeps them in agreement.
 */
export function matchesReportFilter(row: ReportFilterRow, f: ReportFilter | undefined): boolean {
  if (!f) return true;
  if (f.status && row.effective_status !== f.status) return false;
  if (f.place && (row.template_id ?? row.source_template_id) !== f.place) return false;
  if (f.user && row.inspector_id !== f.user && !(row.assignee_ids ?? []).includes(f.user)) return false;
  return matchesQuery(f.q, row.title_en, row.title_ar, row.template_title_en, row.template_title_ar);
}

/** The report URLs' query string; empty values are left out. */
export function reportQuery(p: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) qs.set(k, v);
  return qs.toString();
}

export type ReportParams = {
  /** Absent only for a single-checklist report (`id`) without a date. */
  date: string | undefined;
  to: string | undefined;
  dept: string;
  /** One checklist, ignoring the range, the department and the filters. */
  id?: string;
} & ReportFilter;

/**
 * A report's query string (?date=&to=&dept=, plus the optional filters and
 * ?id=), as the PDF and the summary routes take it: null for anything
 * malformed or a range past a week. `to` is the same day for a one-day
 * report. With `id` the date may be absent (the page uses the checklist's
 * own); without it a date is required, as before.
 */
export function reportParams(sp: URLSearchParams): ReportParams | null {
  const id = sp.get('id');
  if (id !== null && !isUuid(id)) return null;
  const dept = sp.get('dept') ?? 'all';
  if (dept !== 'all' && !isUuid(dept)) return null;
  const filter = reportFilterParams(sp);
  if (!filter) return null;

  let date: string | undefined;
  let to: string | undefined;
  if (sp.has('date') || id === null) {
    date = parseDay(sp.get('date') ?? undefined) ?? undefined;
    if (!date) return null;
    to = sp.has('to') ? (parseDay(sp.get('to') ?? undefined) ?? undefined) : date;
    if (!to || reportEnd(date, to) !== to) return null;
  }
  return { date, to, dept, ...(id ? { id } : {}), ...filter };
}

/** The email's few lines: what happened, and who did it. The PDF has the rest. */
export type ReportSummary = {
  total: number;
  /** Non-zero statuses, the most common first. */
  byStatus: { status: EffectiveStatus; n: number }[];
  /** Who submitted, with how many; the most first. */
  doneBy: { name: string; n: number }[];
  /** Whose checklists are not done (pending, in progress, expired). */
  notDoneBy: string[];
};

/**
 * Done = the status says it was handed in (submitted, approved, sent back,
 * follow-up), never submitted_at alone: an old row can carry a submit time
 * and still read expired, and the brief must agree with its own counts.
 */
const DONE: readonly EffectiveStatus[] = ['submitted', 'approved', 'rejected', 'follow_up'];

export function reportSummary(
  rows: Pick<Assignment, 'effective_status' | 'inspector_name' | 'assignee_names'>[],
): ReportSummary {
  const count = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const isDone = (a: (typeof rows)[number]) => !!a.effective_status && DONE.includes(a.effective_status);
  return {
    total: rows.length,
    byStatus: count(rows.map((a) => a.effective_status).filter((s): s is EffectiveStatus => !!s)).map(([status, n]) => ({ status, n })),
    doneBy: count(rows.filter(isDone).map((a) => a.inspector_name || '—')).map(([name, n]) => ({ name, n })),
    notDoneBy: [
      ...new Set(
        rows
          .filter((a) => !isDone(a))
          .flatMap((a) => ((a.assignee_names ?? []).filter(Boolean).length ? a.assignee_names! : [a.inspector_name]))
          .filter((n): n is string => !!n),
      ),
    ],
  };
}

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
  | 'title_en'
  | 'title_ar'
  | 'template_title_en'
  | 'template_title_ar'
>;

/** roundDepartment() for one task, given who and what belongs where. The daily
 *  report and the list both filter with this, so their counts agree. */
export function taskDepartment(
  a: Pick<ReportTask, 'template_id' | 'source_template_id' | 'inspector_id' | 'assignee_ids'>,
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
 * of its days, as listTasksBetween() finds it; `deptId` null = all departments.
 */
export function daysFromTasks(
  rows: ReportTask[],
  today: string,
  deptId: string | null,
  placeDept: Map<string, string | null>,
  personDept: Map<string, string | null>,
  filter?: ReportFilter,
): ReportDay[] {
  const days = new Map<string, ReportDay>();
  for (const a of rows) {
    if (!a.scheduled_date) continue;
    if (deptId && taskDepartment(a, placeDept, personDept) !== deptId) continue;
    if (!matchesReportFilter(a, filter)) continue;
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
