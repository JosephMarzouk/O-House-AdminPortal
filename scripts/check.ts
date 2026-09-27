/**
 * Self-check for the pure rules the portal cannot get wrong: the staff phone format, the dashboard's
 * lateness/date-bucket arithmetic, the template-item parser that guards what
 * savePlace is allowed to store, and who may administer whom.
 * Run: pnpm check
 */
import assert from 'node:assert/strict';
import { normalizePhone, isValidPhone, phoneToE164 } from '../lib/phone';
import { isLate, pct, windowDays, WINDOW_DAYS } from '../lib/dashboard';
import {
  addDays,
  assigneeNames,
  fmtDate,
  fmtPeriod,
  parseDay,
  todayInCairo,
  weekStart,
} from '../lib/format';
import { parseCorrect, parseDecimal, templateItems } from '../lib/template-items';
import { grantableRoles, STAFF_ROLES } from '../lib/types/database';
import { canManageUsers, canMoveTasks, canSchedule, canUsePortal } from '../lib/auth';
import { changedCells, fillFromLastWeek, roundPlaces } from '../lib/rounds';
import { allowedMoves, COLUMN_OF } from '../lib/tracker';
import { refusalLabel } from '../lib/refusals';
import { ilikePattern, matchesQuery } from '../lib/search';
import { reportScore, roundDepartment, workDuration } from '../lib/report';
import { dictionaries } from '../lib/i18n/dictionaries';
import type { Assignment } from '../lib/types/database';

// Storage path resolution moved to the O House API (media signing), and is
// tested there: o-house-api/src/assignments/assignments.spec.ts, toBucketPath.

// --- phone ---------------------------------------------------------------
// The staff form's preview. The login box's phone-or-email rule moved to the
// API with sign-in (o-house-api/src/auth/logins.spec.ts, parseLogin).
const EXPECTED = '+201012345678';
assert.equal(phoneToE164('1012345678'), EXPECTED);   // what the app's field accepts
assert.equal(phoneToE164('01012345678'), EXPECTED);  // admin typed the trunk 0
assert.equal(phoneToE164('+201012345678'), EXPECTED); // pasted E.164
assert.equal(phoneToE164('0101 234 5678'), EXPECTED); // spaced
assert.equal(phoneToE164('(010) 1234-5678'), EXPECTED);
assert.equal(normalizePhone('+20 101 234 5678'), '1012345678');
assert.equal(isValidPhone('1012345678'), true);
assert.equal(isValidPhone('101234567'), false); // 9 digits
assert.equal(isValidPhone(''), false);
assert.throws(() => phoneToE164('12345'), /phone_must_be_10_digits/);

// --- dashboard arithmetic -------------------------------------------------
// Only the fields isLate() reads; the rest of Assignment is irrelevant here.
const a = (p: Partial<Assignment>) => p as Assignment;

// Delivered before the deadline, and after it.
assert.equal(
  isLate(a({ effective_status: 'approved', submitted_at: '2026-09-10T08:00:00Z', deadline: '2026-09-10T20:00:00Z' })),
  false,
);
assert.equal(
  isLate(a({ effective_status: 'approved', submitted_at: '2026-09-11T08:00:00Z', deadline: '2026-09-10T20:00:00Z' })),
  true,
);
// Expired is late by definition — it never arrived at all.
assert.equal(isLate(a({ effective_status: 'expired', submitted_at: null, deadline: '2026-09-01T20:00:00Z' })), true);
// Still open and not yet due: not late, and must not be scored as on-time
// either (the caller only rates rows that were actually submitted).
assert.equal(isLate(a({ effective_status: 'pending', submitted_at: null, deadline: '2099-01-01T00:00:00Z' })), false);
// No schedule at all means no deadline to miss.
assert.equal(isLate(a({ effective_status: 'pending', submitted_at: null, deadline: null })), false);
// An assignment with no deadline that WAS submitted cannot be judged late.
assert.equal(isLate(a({ effective_status: 'approved', submitted_at: '2026-09-11T08:00:00Z', deadline: null })), false);

// pct guards the empty denominator rather than rendering NaN%.
assert.equal(pct(0, 0), null);
assert.equal(pct(1, 3), 33);
assert.equal(pct(3, 3), 100);
assert.equal(pct(0, 5), 0);

// The trend axis must cover every day in the window, including quiet ones,
// and must not repeat or skip a day across a DST change.
const days = windowDays(new Date('2026-09-12T23:30:00Z'));
assert.equal(days.length, WINDOW_DAYS);
assert.equal(new Set(days).size, WINDOW_DAYS, 'no duplicated day');
assert.deepEqual([...days].sort(), days, 'oldest first');
assert.equal(days.at(-1), '2026-09-13'); // 23:30Z on the 12th is already the 13th in Cairo
// Egypt observes DST; stepping across the change must still yield 30 distinct days.
const dst = windowDays(new Date('2026-11-10T12:00:00Z'));
assert.equal(new Set(dst).size, WINDOW_DAYS, 'no day lost across a DST boundary');

// A late-evening-UTC instant belongs to the NEXT Cairo day — the bug that
// `iso.slice(0, 10)` and `new Date("YYYY-MM-DD")` both get wrong.
assert.equal(todayInCairo(new Date('2026-09-11T22:30:00Z')), '2026-09-12');
assert.equal(todayInCairo(new Date('2026-09-12T09:00:00Z')), '2026-09-12');

// --- template items ------------------------------------------------------
// This parser guards a write as well as a read: savePlace runs caller input
// through it before storing, so it is the whitelist standing between an HTTP
// endpoint and a jsonb column the phone app reads unguarded.

// Junk in the array costs the item, not the page.
assert.deepEqual(templateItems(null), []);
assert.deepEqual(templateItems('nope'), []);
assert.deepEqual(templateItems([null, 'x', 42]), []);

// An id that is already a uuid survives — assignment_items and actions store
// itemId references against it, so regenerating one orphans past work.
const keep = templateItems([{ id: 'b2e1c0de-0000-4000-8000-000000000000', text_ar: 'س' }]);
assert.equal(keep[0].id, 'b2e1c0de-0000-4000-8000-000000000000');

// A NEW subtask arrives from emptyItem() with id '' and must be given a real
// one. The obvious `typeof o.id === 'string'` test passes an empty string
// through, which would store several items all sharing an id of ''.
const fresh = templateItems([{ id: '' }, { id: '' }]);
assert.notEqual(fresh[0].id, '', 'a blank id must be replaced, not kept');
assert.notEqual(fresh[0].id, fresh[1].id, 'two new items must not share an id');

// Unknown keys are dropped and unknown types fall back — the whole point of
// running writes through this rather than spreading the caller's object.
const [clean] = templateItems([
  { id: 'x', text_en: 'Mop', type: 'sql-injection', critical: 'yes', evil: { deep: [1, 2] } },
]);
assert.deepEqual(Object.keys(clean).sort(), [
  'critical',
  'id',
  'requires_photo',
  'text_ar',
  'text_en',
  'type',
]);
assert.equal(clean.type, 'yesno', 'an unrecognised type falls back');
assert.equal(clean.critical, false, "the string 'yes' is not true");
assert.equal(clean.text_ar, '');

// The legacy web client's keys survive a portal round trip — it scores on
// `expected` and files follow-ups on `follow_up_on`, and a save used to strip
// both. Primitives only: anything else is still a key a caller invented.
const [legacyItem] = templateItems([
  { id: 'l', type: 'yesno', expected: 'yes', follow_up_on: 'no', scored: true },
]);
assert.equal(legacyItem.expected, 'yes');
assert.equal(legacyItem.follow_up_on, 'no');
assert.equal(legacyItem.scored, true);
const [junkLegacy] = templateItems([{ id: 'j', expected: { deep: 1 } }]);
assert.ok(!('expected' in junkLegacy), 'a non-primitive legacy value is dropped');

// --- correct answers (0013) -----------------------------------------------
// The same shapes answer_ok() judges in the database. A rule that does not
// fit its item's type is dropped, not kept — it would flag every answer.
assert.deepEqual(parseCorrect('yesno', { eq: 'yes' }), { eq: 'yes' });
assert.equal(parseCorrect('yesno', { eq: 'maybe' }), undefined);
assert.equal(parseCorrect('pass_fail', { eq: 'yes' }), undefined, 'yes is not a pass/fail answer');
assert.deepEqual(parseCorrect('pass_fail', { eq: 'fail' }), { eq: 'fail' });
assert.deepEqual(parseCorrect('text', { eq: '  Clean  ' }), { eq: 'Clean' });
assert.equal(parseCorrect('text', { eq: '   ' }), undefined);
assert.deepEqual(parseCorrect('number', { min: 1, max: 3 }), { min: 1, max: 3 });
assert.deepEqual(parseCorrect('number', { max: 0 }), { max: 0 }, 'zero is a real bound');
assert.equal(parseCorrect('number', { min: 5, max: 1 }), undefined, 'an inverted range');
assert.equal(parseCorrect('number', { min: '1' }), undefined, 'bounds are numbers, not strings');
assert.equal(parseCorrect('number', { eq: '5' }), undefined);
assert.equal(parseCorrect('yesno', null), undefined);

const [ruled, misfit] = templateItems([
  { id: 'r', type: 'number', correct: { min: 1, max: 3 } },
  { id: 'm', type: 'yesno', correct: { min: 1 } }, // left behind by a type change
]);
assert.deepEqual(ruled.correct, { min: 1, max: 3 });
assert.ok(!('correct' in misfit), 'a rule that does not fit its type never reaches the column');

// Numbers as an Arabic keyboard types them — answer_ok() accepts the same.
assert.equal(parseDecimal('٢٫٥'), 2.5);
assert.equal(parseDecimal('۳'), 3);
assert.equal(parseDecimal('3,5'), 3.5);
assert.equal(parseDecimal(' -4 '), -4);
assert.equal(parseDecimal('1.'), undefined, 'half-typed is not a number yet');
assert.equal(parseDecimal('abc'), undefined);
assert.equal(parseDecimal(''), undefined);

// --- calendar arithmetic for the planner and tracker ------------------------
// Egypt's week starts on Saturday. 2026-09-25 is a Friday.
assert.equal(weekStart('2026-09-25'), '2026-09-19');
assert.equal(weekStart('2026-09-19'), '2026-09-19', 'a Saturday is its own week start');
assert.equal(weekStart('2026-09-20'), '2026-09-19');
assert.equal(addDays('2026-10-29', 3), '2026-11-01', 'across a month end and the DST change');
assert.equal(addDays('2026-01-01', -1), '2025-12-31');
// parseDay guards a PostgREST filter string — nothing but a real day passes.
assert.equal(parseDay('2026-09-21'), '2026-09-21');
assert.equal(parseDay('2026-02-31'), undefined);
assert.equal(parseDay('2026-09-21,status.eq.x'), undefined);
assert.equal(parseDay(['2026-09-21']), undefined);

// --- round templates ---------------------------------------------------------
const G = 'aaaaaaaa-0000-4000-8000-000000000001';
const P = 'aaaaaaaa-0000-4000-8000-000000000002';
assert.deepEqual(
  roundPlaces([
    { template_id: G, window_start: '07:00:00', window_end: '07:30' }, // Postgres-style time
    { template_id: 'not-a-uuid', window_start: '07:30', window_end: '08:00' },
    { template_id: P, window_start: '08:00', window_end: '08:00' }, // zero-length
    { template_id: P, window_start: '23:00', window_end: '01:00' }, // overnight is fine
    { template_id: G, window_start: '09:00', window_end: '10:00' }, // a place twice
    { template_id: P, window_start: '25:00', window_end: '26:00' },
  ]),
  [
    { template_id: G, window_start: '07:00', window_end: '07:30' },
    { template_id: P, window_start: '23:00', window_end: '01:00' },
  ],
);
assert.deepEqual(roundPlaces('nope'), []);

// Save sends only what changed; a cleared cell is an explicit unassign.
assert.deepEqual(
  changedCells(
    { [`${G}|2026-09-21`]: ['u1', 'u2'], [`${G}|2026-09-22`]: ['u1'] },
    // Same two people ticked in the other order is no change.
    { [`${G}|2026-09-21`]: ['u2', 'u1'], [`${G}|2026-09-22`]: [], [`${P}|2026-09-22`]: ['u2', 'u3'] },
  ),
  [
    { round_template_id: G, date: '2026-09-22', assignee_ids: [] },
    { round_template_id: P, date: '2026-09-22', assignee_ids: ['u2', 'u3'] },
  ],
);

// "Copy last week" fills blanks only, never the past, never overwrites.
const planDays = ['2026-09-19', '2026-09-20', '2026-09-21'];
const prevDays = ['2026-09-12', '2026-09-13', '2026-09-14'];
assert.deepEqual(
  fillFromLastWeek(
    { [`${G}|2026-09-21`]: ['kept'] },
    { [`${G}|2026-09-12`]: ['a'], [`${G}|2026-09-13`]: ['b', 'd'], [`${G}|2026-09-14`]: ['c'] },
    [G],
    planDays,
    prevDays,
    '2026-09-20',
  ),
  { [`${G}|2026-09-20`]: ['b', 'd'], [`${G}|2026-09-21`]: ['kept'] },
);

// --- the tracker ---------------------------------------------------------------
// Every status has a column — a status without one would be a card that
// silently vanishes.
for (const s of ['pending', 'in_progress', 'follow_up', 'submitted', 'approved', 'rejected', 'expired']) {
  assert.ok(s in COLUMN_OF, `${s} has a column`);
}
// Review moves only.
assert.deepEqual(allowedMoves('submitted', 'submitted'), { done: 'approve', in_progress: 'send_back' });
assert.deepEqual(allowedMoves('expired', 'pending'), { todo: 'extend' });
assert.deepEqual(allowedMoves('expired', 'in_progress'), { in_progress: 'extend' });
for (const s of ['pending', 'in_progress', 'follow_up', 'approved'] as const) {
  assert.deepEqual(allowedMoves(s, s), {}, `${s} cannot be moved from the board`);
}

// --- who may administer whom ---------------------------------------------
// The two questions grantableRoles answers are deliberately the same one:
// which roles a caller may create, and whose password they may set.

// An admin's reach is exactly what it was before managers arrived.
assert.deepEqual([...grantableRoles('admin')], [...STAFF_ROLES]);

// A manager reaches field staff and stops.
assert.deepEqual([...grantableRoles('manager')], ['inspector', 'cleaner']);

// Nobody mints a peer, and nobody mints an admin. These two are the whole
// point of the function — 0010 in the database says the same thing.
assert.ok(!grantableRoles('manager').includes('manager'), 'no peer minting');
assert.ok(
  !(grantableRoles('admin') as readonly string[]).includes('admin'),
  'the portal never mints an admin',
);

// Unknown, missing and field roles all fall to the narrow list rather than
// widening — the function must never fail open.
for (const r of ['inspector', 'cleaner', 'nonsense', undefined, null]) {
  assert.deepEqual([...grantableRoles(r)], ['inspector', 'cleaner'], `grantableRoles(${r})`);
}

// The Users screen's audience is narrower than the portal's.
assert.ok(canManageUsers('admin') && canManageUsers('manager'));
assert.ok(!canManageUsers('inspector'), 'an inspector is a portal user, not a staff admin');
assert.ok(!canManageUsers('cleaner') && !canManageUsers(undefined));
assert.ok(canUsePortal('inspector'), 'but an inspector does use the portal');

// Planning rounds is admin + manager (the database agrees); moving cards on
// the tracker is admin only, by the club's rule.
assert.ok(canSchedule('admin') && canSchedule('manager'));
assert.ok(!canSchedule('inspector') && !canSchedule('cleaner') && !canSchedule(null));
assert.ok(canMoveTasks('admin'));
assert.ok(!canMoveTasks('manager') && !canMoveTasks('inspector') && !canMoveTasks(undefined));

// --- sync refusals (SY-10) -----------------------------------------------
// Every code the API can record reads as something a supervisor can act on,
// and an unknown one never renders blank.
for (const d of Object.values(dictionaries)) {
  assert.equal(refusalLabel('ASSIGNMENT_EXPIRED', d), d.refusalExpired);
  assert.equal(refusalLabel('ITEM_NOT_FOUND', d), d.refusalNotFound);
  assert.equal(refusalLabel('MISSING_FILE', d), d.refusalMissingFile);
  assert.equal(refusalLabel('SOMETHING_NEW', d), d.refusalOther);
}

// --- several assignees, multi-day ----------------------------------------
assert.equal(assigneeNames({ assignee_names: ['A', 'B'], inspector_name: 'B' }), 'A · B');
assert.equal(assigneeNames({ assignee_names: [], inspector_name: 'B' }), 'B', 'view could not name them');
assert.equal(assigneeNames({ assignee_names: null, inspector_name: null }), '');
assert.equal(fmtPeriod('2026-09-23', null, 'en'), fmtDate('2026-09-23', 'en'));
assert.equal(
  fmtPeriod('2026-09-23', '2026-09-25', 'en'),
  `${fmtDate('2026-09-23', 'en')} – ${fmtDate('2026-09-25', 'en')}`,
);

// --- daily report -----------------------------------------------------------
// The place's department wins; a place shared by every department falls back
// to the people's.
assert.equal(roundDepartment('d-place', ['d-person']), 'd-place');
assert.equal(roundDepartment(null, [null, 'd-person']), 'd-person');
assert.equal(roundDepartment(undefined, []), null);
assert.deepEqual(reportScore([{ status: 'done' }, { status: 'follow_up' }, { status: 'pending' }, { status: 'done' }]), {
  done: 2,
  total: 4,
  pct: 50,
});
assert.deepEqual(reportScore([]), { done: 0, total: 0, pct: 0 });
assert.deepEqual(
  workDuration([
    { event: 'created', at: '2026-09-27T05:00:00Z' },
    { event: 'started', at: '2026-09-27T05:35:06Z' },
    { event: 'submitted', at: '2026-09-27T05:38:32Z' },
    { event: 'sent_back', at: '2026-09-27T06:00:00Z' },
    { event: 'submitted', at: '2026-09-27T06:10:00Z' },
  ]),
  { start: '2026-09-27T05:35:06Z', end: '2026-09-27T05:38:32Z', minutes: 3 },
  'first answer to FIRST submit',
);
assert.equal(workDuration([{ event: 'submitted', at: '2026-09-27T05:38:32Z' }]), null, 'a backfilled row has no start');

// --- list search ----------------------------------------------------------
// PostgREST's .or() syntax and ilike's wildcards never reach the query.
assert.equal(ilikePattern(undefined), undefined);
assert.equal(ilikePattern('  '), undefined);
assert.equal(ilikePattern('Gym'), '*Gym*');
assert.equal(ilikePattern('a,b.c(d)%_*'), '*a b c d*');
assert.equal(ilikePattern('حمام السباحة'), '*حمام السباحة*');
assert.ok(matchesQuery(undefined, 'x') && matchesQuery('', null));
assert.ok(matchesQuery('POOL', null, 'Olympic Pool'));
assert.ok(!matchesQuery('gym', 'Pool', undefined));

console.log(
  'ok — phone + dashboard + template-item + correct-answer + round + tracker + role + refusal + search rules hold',
);
