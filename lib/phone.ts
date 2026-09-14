/**
 * Staff sign into the Flutter app with a phone number, not an email. The app
 * caps its field at 10 digits, shows "+20" as decoration only, then builds the
 * login email in code (login_screen.dart:70, supabase.dart:31):
 *
 *   types 1012345678  ->  "+20" + it  ->  strip "+"  ->  201012345678@ohouse.internal
 *
 * The app applies NO formatter and NO validator, so the portal is the only
 * place this can be enforced. Get it wrong and the account simply never logs in.
 */

const DIAL = '20';
export const LOGIN_EMAIL_DOMAIN = 'ohouse.internal';

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

/** The `email` to pass to auth.admin.createUser / signInWithPassword. */
export function phoneToLoginEmail(raw: string): string {
  const digits = normalizePhone(raw);
  if (digits.length !== 10) throw new Error('phone_must_be_10_digits');
  return `${DIAL}${digits}@${LOGIN_EMAIL_DOMAIN}`;
}

/** What goes in profiles.phone — E.164, WITH the '+', matching the live row. */
export function phoneToE164(raw: string): string {
  const digits = normalizePhone(raw);
  if (digits.length !== 10) throw new Error('phone_must_be_10_digits');
  return `+${DIAL}${digits}`;
}

/** Display helper: profiles.email is deliberately '' for phone accounts. */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`);
}

/**
 * What the portal's login box hands to signInWithPassword.
 *
 * Staff type the phone number they use in the app; admins and managers type
 * the email their account was created under. GoTrue only holds an email
 * either way, so a phone is rebuilt into the same synthetic address the
 * Flutter app builds — which is why the portal needs no phone auth and the
 * project needs no SMS provider.
 *
 * The '@' test is load-bearing, not tidiness. normalizePhone strips every
 * non-digit, so "1012345678@gmail.com" reduces to ten digits and would
 * otherwise be rewritten into a synthetic address, locking that user out of
 * their own account. An address is anything containing '@'; a phone is
 * everything else that normalises to ten digits. Anything else is passed
 * through untouched and left for GoTrue to reject.
 */
export function toLoginCredential(typed: string): string {
  const value = typed.trim();
  if (value.includes('@')) return value;
  return isValidPhone(value) ? phoneToLoginEmail(value) : value;
}
