/**
 * The list screens' `?q=` search (components/search-box.tsx).
 */

/** Case-insensitive "any field contains the text". An empty search matches all. */
export function matchesQuery(q: string | undefined, ...fields: (string | null | undefined)[]) {
  const needle = q?.trim().toLowerCase();
  return !needle || fields.some((f) => f?.toLowerCase().includes(needle));
}

/**
 * The search text as an ilike pattern that is safe inside a PostgREST `.or()`
 * string. Commas, parentheses, quotes, dots and colons are that syntax, and
 * `% _ *` are wildcards, so they become spaces rather than reaching the parser.
 */
export function ilikePattern(q: string | undefined): string | undefined {
  const t = q?.replace(/[,()"'%_*\\:.]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? `*${t}*` : undefined;
}
