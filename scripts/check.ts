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
import {
  assignableEnabled,
  buildMatrix,
  canBeManager,
  can,
  canManageRoles,
  cellEnabled,
  mayDeleteRole,
  mayManageUser,
  parseAccess,
  roleReadOnly,
  sortRoles,
  type Access,
} from '../lib/access';
import { changedCells, fillFromLastWeek, roundPlaces } from '../lib/rounds';
import { allowedMoves, COLUMN_OF, MOVE_PERMISSION } from '../lib/tracker';
import { errorMessage } from '../lib/errors';
import { refusalLabel } from '../lib/refusals';
import { ilikePattern, matchesQuery } from '../lib/search';
import { parseLocation } from '../lib/club-location';
import { daysFromTasks, parseEmails, reportEnd, reportParams, reportScore, reportSummary, roundDepartment, workDuration } from '../lib/report';
import { dictionaries } from '../lib/i18n/dictionaries';
import { refreshOutcome } from '../lib/session';
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
// Each move needs what its function requires: approve_assignment and
// reject_items review.edit, extend_assignment checklists.edit.
assert.deepEqual(MOVE_PERMISSION, {
  approve: 'review.edit',
  send_back: 'review.edit',
  extend: 'checklists.edit',
});
// A refused action says "no permission", not the portal gate's sentence.
for (const dict of Object.values(dictionaries)) {
  assert.equal(errorMessage(dict, 'not_authorized'), dict.noPermission);
  assert.notEqual(dict.noPermission, dict.notAuthorized);
}

// --- who may do what (custom roles) --------------------------------------
// The database is the boundary (has_permission, the role RPCs); these are the
// rules the portal draws itself from, and they must never fail open.
const access = (a: Partial<Access> & { id?: string; key?: string | null }): Access => ({
  role: { id: a.id ?? 'r-me', key: a.key ?? null, name_en: 'Me', name_ar: 'أنا', locked: a.key === 'admin' },
  scope: a.scope ?? 'own',
  departments: a.departments ?? [],
  permissions: a.permissions ?? [],
  assignable: a.assignable ?? [],
});
const admin = {
  id: 'u-admin',
  access: access({
    id: 'r-admin',
    key: 'admin',
    scope: 'all',
    permissions: ['portal.view', 'users.edit', 'roles.view', 'roles.create', 'roles.edit', 'roles.delete', 'places.edit'],
    assignable: ['r-manager', 'r-cleaner', 'r-custom'],
  }),
};
const teamLead = {
  id: 'u-lead',
  access: access({
    id: 'r-manager',
    key: 'manager',
    scope: 'team',
    permissions: ['portal.view', 'users.edit', 'roles.create', 'roles.edit'],
    assignable: ['r-cleaner'],
  }),
};

// my_access(): anything malformed is no access at all.
assert.equal(parseAccess(null), null);
assert.equal(parseAccess('x'), null);
assert.equal(parseAccess({ role: { id: 'r' }, scope: 'everything' }), null, 'unknown scope');
assert.equal(parseAccess({ scope: 'all', permissions: ['portal.view'] }), null, 'no role');
assert.deepEqual(parseAccess({ role: { id: 'r' }, scope: 'own', permissions: ['a', 7] })?.permissions, ['a']);
assert.deepEqual(parseAccess({ role: { id: 'r' }, scope: 'own' })?.assignable, []);

// can(): the key, exactly; nobody signed in, or no role, can do nothing.
assert.ok(can(admin, 'portal.view') && !can(admin, 'staff_app.view'));
assert.ok(!can(null, 'portal.view') && !can(undefined, 'portal.view'));
assert.ok(!can({ id: 'u', access: null }, 'portal.view'), 'inactive / no role');
assert.ok(!can(admin, 'portal'), 'no prefix matching');

// Managing roles needs the permission AND whole-club scope.
assert.ok(canManageRoles(admin, 'create') && canManageRoles(admin, 'delete'));
assert.ok(!canManageRoles(teamLead, 'create'), 'roles.create without scope all');

// Read-only: the Admin role for everyone, your own role, or no rights.
assert.equal(roleReadOnly(admin, { id: 'r-admin', locked: true }), 'locked');
assert.equal(roleReadOnly(admin, { id: 'r-custom', locked: false }), null);
const hr = { id: 'u-hr', access: access({ id: 'r-hr', scope: 'all', permissions: ['roles.edit'] }) };
assert.equal(roleReadOnly(hr, { id: 'r-hr', locked: false }), 'own');
assert.equal(roleReadOnly(teamLead, { id: 'r-cleaner', locked: false }), 'rights');
assert.equal(roleReadOnly(null, { id: 'r-cleaner', locked: false }), 'rights');

// Delete: custom roles only, never locked or your own.
assert.ok(mayDeleteRole(admin, { id: 'r-custom', key: null, locked: false }));
assert.ok(!mayDeleteRole(admin, { id: 'r-cleaner', key: 'cleaner', locked: false }), 'defaults stay');
assert.ok(!mayDeleteRole(admin, { id: 'r-admin', key: 'admin', locked: true }));
assert.ok(!mayDeleteRole(teamLead, { id: 'r-custom', key: null, locked: false }), 'no roles.delete');

// The matrix: only what I hold is live; staff_app.view is a trait anyone
// managing roles may give; a ticked cell stays live so it can be taken away.
assert.ok(cellEnabled(admin, 'places.edit', false, true));
assert.ok(!cellEnabled(admin, 'reports.view', false, true), "can't give what I don't hold");
assert.ok(cellEnabled(admin, 'reports.view', true, true), '…but can take it away');
assert.ok(cellEnabled(admin, 'staff_app.view', false, true), 'staff_app.view is a trait');
assert.ok(!cellEnabled(admin, 'places.edit', true, false), 'read-only role');

// "Can create users with these roles" is live only for a role that can create
// or edit users; which roles it may list is not limited by its own power.
assert.ok(assignableEnabled(new Set(['portal.view', 'users.create'])));
assert.ok(assignableEnabled(new Set(['users.edit'])));
assert.ok(!assignableEnabled(new Set(['portal.view', 'users.view', 'checklists.view'])), 'view only');
assert.ok(!assignableEnabled(new Set()));

// buildMatrix: sections and rows in catalog order, null where no key exists.
const perm = (key: string, section: string, sort: number) => {
  const [module, action] = key.split('.') as [string, 'view' | 'create' | 'edit' | 'delete'];
  return { key, section, module, action, label_en: key, label_ar: key, sort };
};
const matrix = buildMatrix([
  perm('reports.view', 'checklists', 40),
  perm('portal.view', 'access', 10),
  perm('checklists.edit', 'checklists', 30),
  perm('checklists.view', 'checklists', 20),
]);
assert.deepEqual(matrix.map((s) => s.section), ['access', 'checklists']);
assert.deepEqual(matrix[1].rows.map((r) => r.module), ['checklists', 'reports']);
assert.equal(matrix[1].rows[0].cells.edit?.key, 'checklists.edit');
assert.equal(matrix[1].rows[0].cells.create, null, 'no checklists.create in this catalog');
assert.equal(matrix[1].rows[1].cells.delete, null);

// Defaults first, most privileged first; then custom roles by name.
assert.deepEqual(
  sortRoles([
    { key: null, name_en: 'Night supervisor' },
    { key: 'cleaner', name_en: 'Cleaner' },
    { key: null, name_en: 'Head of Sports' },
    { key: 'admin', name_en: 'Admin' },
  ]).map((r) => r.name_en),
  ['Admin', 'Cleaner', 'Head of Sports', 'Night supervisor'],
);

// can_manage_user: not me, and their current role one I may assign — so
// never an Admin, and never a peer.
assert.ok(mayManageUser(teamLead, { id: 'u-x', roleId: 'r-cleaner' }));
assert.ok(!mayManageUser(teamLead, { id: 'u-y', roleId: 'r-manager' }), 'no peer');
assert.ok(!mayManageUser(admin, { id: 'u-z', roleId: 'r-admin' }), 'never an Admin');
assert.ok(!mayManageUser(admin, { id: 'u-admin', roleId: 'r-manager' }), 'never myself');
assert.ok(!mayManageUser(hr, { id: 'u-x', roleId: 'r-cleaner' }), 'no users.edit');

// The manager picker: a team or the whole club, and someone to manage.
assert.ok(canBeManager({ scope: 'team', permissions: ['users.edit'] }));
assert.ok(canBeManager({ scope: 'all', permissions: ['checklists.view'] }));
assert.ok(!canBeManager({ scope: 'own', permissions: ['users.edit', 'checklists.view'] }));
assert.ok(!canBeManager({ scope: 'team', permissions: ['staff_app.view'] }));

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
// A range report (the weekly email): at most Saturday to Friday, never backwards.
assert.equal(reportEnd('2026-10-10', '2026-10-16'), '2026-10-16', 'a week');
assert.equal(reportEnd('2026-10-10', '2026-10-17'), '2026-10-10', 'eight days falls back to one');
assert.equal(reportEnd('2026-10-10', '2026-10-09'), '2026-10-10', 'backwards falls back to one');
assert.equal(reportEnd('2026-10-10', undefined), '2026-10-10');
// The routes' ?date=&to=&dept=: a day, a week at most, a department id or all.
{
  const p = (q: string) => reportParams(new URLSearchParams(q));
  const HK = '86a8851d-dc64-4209-9ed7-344ee99a4b7f';
  assert.deepEqual(p(`date=2026-10-10&dept=${HK}`), { date: '2026-10-10', to: '2026-10-10', dept: HK });
  assert.deepEqual(p('date=2026-10-10&to=2026-10-16'), { date: '2026-10-10', to: '2026-10-16', dept: 'all' });
  assert.equal(p('date=2026-10-10&to=2026-10-17'), null, 'past a week');
  assert.equal(p('date=2026-10-10&to=bad'), null);
  assert.equal(p('date=2026-10-10&dept=x'), null);
  assert.equal(p('dept=all'), null);
}
// The email's summary: statuses most-first, who handed in, whose are not done.
// Done follows the status, so the brief never contradicts its own counts.
assert.deepEqual(
  reportSummary([
    { effective_status: 'approved', inspector_name: 'Mona', assignee_names: ['Mona'] },
    { effective_status: 'approved', inspector_name: 'Mona', assignee_names: ['Mona', 'Omar'] },
    { effective_status: 'submitted', inspector_name: 'Omar', assignee_names: ['Omar'] },
    { effective_status: 'expired', inspector_name: 'Sara', assignee_names: ['Sara', 'Nour'] },
    { effective_status: 'pending', inspector_name: 'Sara', assignee_names: [] },
  ]),
  {
    total: 5,
    byStatus: [{ status: 'approved', n: 2 }, { status: 'submitted', n: 1 }, { status: 'expired', n: 1 }, { status: 'pending', n: 1 }],
    doneBy: [{ name: 'Mona', n: 2 }, { name: 'Omar', n: 1 }],
    notDoneBy: ['Sara', 'Nour'],
  },
);
assert.deepEqual(reportSummary([]), { total: 0, byStatus: [], doneBy: [], notDoneBy: [] });
// Report email recipients, as typed or pasted from Outlook.
assert.deepEqual(parseEmails(' A@Club.com\nb@club.com; a@club.com ,\n\n'), { emails: ['a@club.com', 'b@club.com'], bad: null });
assert.deepEqual(parseEmails(''), { emails: [], bad: null });
assert.equal(parseEmails('a@club.com\nAhmed <b@club.com>').bad, 'ahmed', 'a display name is not an address');
assert.equal(parseEmails('a@club').bad, 'a@club');

// The reports list: each task on every day of its period up to today, newest
// first, filtered by the same department rule as the day's report.
{
  const task = (id: string, from: string, to: string | null, status: 'approved' | 'pending' | null, place: string | null, owner: string | null) => ({
    id, scheduled_date: from, end_date: to, effective_status: status,
    template_id: place, source_template_id: null, inspector_id: owner, assignee_ids: owner ? [owner] : [],
  });
  const tasks = [
    task('a', '2026-09-28', '2026-10-02', 'pending', 'p-pool', null), // runs past today
    task('b', '2026-09-28', null, 'approved', 'p-shared', 'u-gym'),   // shared place: the owner's department
    task('c', '2026-09-24', null, null, 'p-pool', null),             // no status: counted, not badged
  ];
  const placeDept = new Map<string, string | null>([['p-pool', 'd-pool'], ['p-shared', null]]);
  const personDept = new Map<string, string | null>([['u-gym', 'd-gym']]);
  const all = daysFromTasks(tasks, '2026-09-29', null, placeDept, personDept);
  assert.deepEqual(all.map((d) => [d.day, d.total]), [['2026-09-29', 1], ['2026-09-28', 2], ['2026-09-24', 1]], 'capped at today');
  assert.deepEqual(all[1].byStatus, { pending: 1, approved: 1 });
  assert.deepEqual(all[2].byStatus, {});
  assert.deepEqual(daysFromTasks(tasks, '2026-09-29', 'd-gym', placeDept, personDept).map((d) => d.day), ['2026-09-28']);
  assert.deepEqual(daysFromTasks(tasks, '2026-09-29', 'd-pool', placeDept, personDept).map((d) => [d.day, d.total]), [['2026-09-29', 1], ['2026-09-28', 1], ['2026-09-24', 1]]);
  assert.deepEqual(daysFromTasks(tasks, '2026-09-23', null, placeDept, personDept), [], 'nothing before it started');
}

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

// --- club location --------------------------------------------------------
// What Google Maps copies, and what the table's checks would refuse anyway.
assert.deepEqual(parseLocation('30.0444, 31.2357', 200), { lat: 30.0444, lng: 31.2357, radiusM: 200 });
assert.deepEqual(parseLocation(' -33.9,18.4 ', 50), { lat: -33.9, lng: 18.4, radiusM: 50 });
for (const bad of ['', '30.0444', '30.0444 31.2357', '30,31,32', 'a, b', '91, 0', '0, 181', '30.0444, ']) {
  assert.equal(parseLocation(bad, 200), null, bad);
}
assert.equal(parseLocation('30, 31', 49), null);
assert.equal(parseLocation('30, 31', 2001), null);
assert.equal(parseLocation('30, 31', 200.5), null);
assert.equal(parseLocation('30, 31', NaN), null);

// F-28 / AUTH-04: only a refused refresh token ends a portal session.
assert.equal(refreshOutcome(200), 'renewed');
assert.equal(refreshOutcome(401), 'ended');
assert.equal(refreshOutcome(400), 'ended');
for (const s of [429, 500, 502, 503, 504]) assert.equal(refreshOutcome(s), 'unavailable', String(s));

console.log(
  'ok — phone + dashboard + template-item + correct-answer + round + tracker + role + refusal + search + location rules hold',
);
