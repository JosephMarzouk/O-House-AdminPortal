/**
 * Self-check for the pure rules the portal cannot get wrong: storage path
 * resolution, the phone -> login-email transform, the dashboard's
 * lateness/date-bucket arithmetic, the template-item parser that guards what
 * savePlace is allowed to store, and who may administer whom.
 * Run: pnpm check
 */
import assert from 'node:assert/strict';
import { mediaUrl, mediaUrls } from '../lib/media';
import {
  normalizePhone,
  isValidPhone,
  phoneToLoginEmail,
  phoneToE164,
  toLoginCredential,
} from '../lib/phone';
import { isLate, pct, windowDays, WINDOW_DAYS } from '../lib/dashboard';
import { todayInCairo } from '../lib/format';
import { templateItems } from '../lib/template-items';
import { grantableRoles, STAFF_ROLES } from '../lib/types/database';
import { canManageUsers, canUsePortal } from '../lib/auth';
import type { Assignment } from '../lib/types/database';

const BASE = 'https://ptonujazlljpkgpfrkpw.supabase.co/storage/v1/object/public/checklist-media';

// --- media ---------------------------------------------------------------
assert.equal(mediaUrl(null), null);
assert.equal(mediaUrl(''), null);
assert.equal(mediaUrl(undefined), null);

// A bare path, as submit_assignment writes it (row 893f1c08).
assert.equal(
  mediaUrl('signatures/893f1c08-f14c-4dec-907d-7f9dbef54440-1788868212340289.png'),
  `${BASE}/signatures/893f1c08-f14c-4dec-907d-7f9dbef54440-1788868212340289.png`,
);

// A full URL, as the legacy browser flow stored it (row d23535de). Passes through.
const legacy = `${BASE}/signatures/c32742ac-2020-4454-8335-d27142d11017.png`;
assert.equal(mediaUrl(legacy), legacy);

// A real photo_paths entry.
assert.equal(
  mediaUrl('photos/893f1c08-f14c-4dec-907d-7f9dbef54440/09718390-9ec5-4bef-abd3-f1657edc9c91-1788868210552896.jpg'),
  `${BASE}/photos/893f1c08-f14c-4dec-907d-7f9dbef54440/09718390-9ec5-4bef-abd3-f1657edc9c91-1788868210552896.jpg`,
);

assert.equal(mediaUrl('/answers/abc.jpg'), `${BASE}/answers/abc.jpg`); // leading slash
assert.equal(mediaUrl('answers/a b.jpg'), `${BASE}/answers/a%20b.jpg`); // space encoded
assert.deepEqual(mediaUrls(null), []);
assert.deepEqual(mediaUrls(['answers/a.jpg', 'answers/b.jpg']).length, 2);

// --- phone ---------------------------------------------------------------
const EXPECTED = '201012345678@ohouse.internal';

assert.equal(phoneToLoginEmail('1012345678'), EXPECTED);   // what the app's field accepts
assert.equal(phoneToLoginEmail('01012345678'), EXPECTED);  // admin typed the trunk 0
assert.equal(phoneToLoginEmail('+201012345678'), EXPECTED); // pasted E.164
assert.equal(phoneToLoginEmail('0101 234 5678'), EXPECTED); // spaced
assert.equal(phoneToLoginEmail('(010) 1234-5678'), EXPECTED);

// The one real account in the database.
assert.equal(phoneToLoginEmail('+201229338195'), '201229338195@ohouse.internal');
assert.equal(phoneToE164('1229338195'), '+201229338195');

assert.equal(normalizePhone('+20 101 234 5678'), '1012345678');
assert.equal(isValidPhone('1012345678'), true);
assert.equal(isValidPhone('101234567'), false); // 9 digits
assert.equal(isValidPhone(''), false);
assert.throws(() => phoneToLoginEmail('12345'), /phone_must_be_10_digits/);

// --- the login box's one branch ------------------------------------------
// The portal takes a phone OR an email in a single field. Getting the
// discrimination wrong locks a real user out of their own account, so it is
// worth more than the four lines it costs.

// Staff: every shape an admin might have given them, all one account.
assert.equal(toLoginCredential('1012345678'), EXPECTED);
assert.equal(toLoginCredential('01012345678'), EXPECTED);
assert.equal(toLoginCredential('+20 101 234 5678'), EXPECTED);
assert.equal(toLoginCredential('  1012345678  '), EXPECTED); // pasted with spaces

// Admins and managers: passed through untouched.
assert.equal(toLoginCredential('joseph@blueribbon-inc.com'), 'joseph@blueribbon-inc.com');
assert.equal(toLoginCredential(' Admin@Example.com '), 'Admin@Example.com');

// The one that matters: normalizePhone strips non-digits, so an address
// whose local part is ten digits reduces to a valid-looking phone. Without
// the '@' test this would be rewritten to 201012345678@ohouse.internal and
// that user could never sign in.
assert.equal(
  toLoginCredential('1012345678@gmail.com'),
  '1012345678@gmail.com',
  'an email must never be rewritten as a phone',
);

// Not a phone and not an address: hand it to GoTrue and let it refuse,
// rather than guessing.
assert.equal(toLoginCredential('12345'), '12345');
assert.equal(toLoginCredential(''), '');

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

console.log('ok — media + phone + dashboard + template-item + role rules hold');
