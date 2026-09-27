import type { RoundPlace } from '@/lib/types/database';

/**
 * The pure rules behind zone rounds — kept apart from lib/db/rounds.ts so
 * scripts/check.ts can import them without the server Supabase client.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "07:00" from "07:00" or Postgres's "07:00:00"; null for anything else. */
function hhmm(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.slice(0, 5);
  return HHMM.test(s) ? s : null;
}

/**
 * `round_templates.places` — parsed on read and, as the write whitelist, on
 * save, the same way templateItems() guards `templates.items`: a Server Action
 * is an HTTP endpoint, and this column is what schedule_rounds() walks to
 * create real tasks.
 *
 * A place survives only with a real template id and a window whose ends
 * differ. Equal ends would be a zero-length window that expires the moment it
 * opens; an end BEFORE the start is fine — it is an overnight window
 * (23:00–01:00), which assignments_v rolls into the next day. A place listed
 * twice keeps its first entry: schedule_rounds() creates one task per place
 * per round, so a second entry could never produce anything.
 */
export function roundPlaces(raw: unknown): RoundPlace[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((p): RoundPlace[] => {
    if (!p || typeof p !== 'object') return [];
    const o = p as Record<string, unknown>;
    const id = typeof o.template_id === 'string' ? o.template_id.toLowerCase() : '';
    const start = hhmm(o.window_start);
    const end = hhmm(o.window_end);
    if (!UUID.test(id) || !start || !end || start === end || seen.has(id)) return [];
    seen.add(id);
    return [{ template_id: id, window_start: start, window_end: end }];
  });
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

/**
 * One cell of the week planner: a round template on a day, and who does it.
 * Several people: each gets the round's tasks, and whoever starts a task
 * first owns it. Empty: the cell is cleared.
 */
export type PlanCell = { round_template_id: string; date: string; assignee_ids: string[] };

/** The planner's state is keyed `${roundTemplateId}|${YYYY-MM-DD}` → assignee ids, [] for nobody. */
export const cellKey = (roundTemplateId: string, date: string) => `${roundTemplateId}|${date}`;

/** Same people, whatever order they were ticked in. */
export function sameIds(a: readonly string[] = [], b: readonly string[] = []): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/**
 * The cells whose assignee differs between what the server sent and what is
 * on screen — the only ones Save sends. Sending the whole grid would re-run
 * schedule_rounds() over every untouched round, which is harmless but slow,
 * and would make the summary it returns meaningless.
 */
export function changedCells(
  initial: Record<string, string[]>,
  current: Record<string, string[]>,
): PlanCell[] {
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)]);
  const out: PlanCell[] = [];
  for (const key of keys) {
    const after = current[key] ?? [];
    if (sameIds(initial[key], after)) continue;
    const [round_template_id, date] = key.split('|');
    out.push({ round_template_id, date, assignee_ids: [...after] });
  }
  return out;
}

/**
 * "Copy last week": each empty cell takes whoever did the same round on the
 * same weekday a week earlier. Blanks only — a cell already planned is never
 * overwritten, and nothing is ever cleared, so pressing it twice is harmless.
 * Days before `firstEditable` are left alone; the past is read-only.
 */
export function fillFromLastWeek(
  current: Record<string, string[]>,
  lastWeek: Record<string, string[]>,
  roundTemplateIds: string[],
  days: string[],
  lastWeekDays: string[],
  firstEditable: string,
): Record<string, string[]> {
  const next = { ...current };
  for (const rt of roundTemplateIds) {
    days.forEach((day, i) => {
      if (day < firstEditable) return;
      const key = cellKey(rt, day);
      const previous = lastWeek[cellKey(rt, lastWeekDays[i])];
      if (!next[key]?.length && previous?.length) next[key] = previous;
    });
  }
  return next;
}
