/**
 * Staff phone numbers. Egyptian, 10 national digits, stored in E.164
 * (+20XXXXXXXXXX) — in profiles.phone and in the API's user_logins, which is
 * what a phone account signs in with. The API applies the same rule when it
 * reads a sign-in (o-house-api/src/auth/logins.ts, parseLogin).
 */

const DIAL = '20';

/** Reduce anything an admin might paste to the 10-digit national number. */
export function normalizePhone(raw: string): string {
  return raw
    .replace(/\D/g, '')       // spaces, dashes, parens, a leading '+'
    .replace(/^20/, '')       // pasted country code
    .replace(/^0/, '');       // Egyptian trunk prefix
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw).length === 10;
}

/** What goes in profiles.phone — E.164, WITH the '+', matching the live rows. */
export function phoneToE164(raw: string): string {
  const digits = normalizePhone(raw);
  if (digits.length !== 10) throw new Error('phone_must_be_10_digits');
  return `+${DIAL}${digits}`;
}
