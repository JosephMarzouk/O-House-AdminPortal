/**
 * The shape every server action returns, and the one place a driver message
 * becomes something the UI is allowed to show.
 *
 * Lives outside the 'use server' modules on purpose: those may export nothing
 * but async functions, so a shared type or helper cannot sit in any of them.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Map a Postgres / GoTrue message to a code the dictionary can translate.
 *
 * The default is `error_generic`, NOT the message itself. Raw driver strings
 * carry table names, constraint names and phrases like "permission denied for
 * table profiles" — they describe the schema to anyone who can provoke an
 * error, and they tell the cleaner reading the toast nothing they can act on.
 * A message worth showing gets a code here; everything else is generic.
 */
export function toErrorCode(message: string): string {
  if (/Only admins|permission denied|row-level security/i.test(message)) return 'not_authorized';
  if (/already registered|already been registered/i.test(message)) return 'phone_taken';
  // 23503. The department or place still has staff or assignments pointing at
  // it — the one driver failure a user can actually resolve, so it keeps a
  // message of its own rather than collapsing into the generic one.
  if (/foreign key constraint|23503/i.test(message)) return 'still_referenced';
  return 'error_generic';
}
