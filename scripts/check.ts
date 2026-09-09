/**
 * Self-check for the two pure rules the portal cannot get wrong:
 * storage path resolution and the phone -> login-email transform.
 * Run: pnpm check
 */
import assert from 'node:assert/strict';
import { mediaUrl, mediaUrls } from '../lib/media';
import { normalizePhone, isValidPhone, phoneToLoginEmail, phoneToE164 } from '../lib/phone';

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

console.log('ok — media + phone rules hold');
