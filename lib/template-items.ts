import type { Correct, ItemType, TemplateItem } from '@/lib/types/database';

/**
 * The legacy inspector web client's keys. That client is still in daily use
 * and reads them with its own meaning — it scores against `expected` and files
 * an `actions` row when an answer equals `follow_up_on` — so a portal save must
 * hand them back exactly as it found them. Before this list existed the
 * whitelist below dropped them on every save (and on every read, since the
 * edit form is seeded through here too), quietly switching off scoring and
 * follow-ups for any place someone had touched in the portal.
 */
const LEGACY_KEYS = ['expected', 'follow_up_on', 'scored'] as const;

/**
 * `templates.items` is jsonb with its shape documented only in a comment, so
 * parse defensively: a malformed row should cost one item, not the page.
 *
 * This is also the WRITE whitelist. savePlace and createAssignment run their
 * input through here before storing, because a Server Action is an HTTP
 * endpoint and the TemplateItem[] annotation is gone at runtime — without it,
 * any key a caller invented would be persisted verbatim into a column the
 * phone app reads. The six core fields always come out; `correct` and the
 * three legacy keys come out only when they were there and well-formed, so a
 * plain item still has exactly six keys.
 *
 * Lives apart from lib/db/places.ts (which re-exports it, so no import site
 * changed) because that module pulls in the server Supabase client, and this
 * is a pure function that scripts/check.ts needs to import on its own.
 */
export function templateItems(items: unknown): TemplateItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw): TemplateItem[] => {
    if (!raw || typeof raw !== 'object') return [];
    const o = raw as Record<string, unknown>;
    const type: ItemType =
      o.type === 'pass_fail' || o.type === 'yesno' || o.type === 'text' || o.type === 'number'
        ? o.type
        : 'yesno';
    const correct = parseCorrect(type, o.correct);

    const legacy: Partial<Pick<TemplateItem, (typeof LEGACY_KEYS)[number]>> = {};
    for (const k of LEGACY_KEYS) {
      const v = o[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') legacy[k] = v;
    }

    return [
      {
        // `&& o.id`, not just the typeof: an empty string is a string. A new
        // subtask arrives from emptyItem() with id '', and savePlace now runs
        // its input through here — without the truthiness check every new item
        // would be stored with an id of '', several of them sharing it, which
        // is exactly the itemId stability this parser exists to protect.
        id: typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID(),
        text_en: typeof o.text_en === 'string' ? o.text_en : '',
        text_ar: typeof o.text_ar === 'string' ? o.text_ar : '',
        type,
        critical: o.critical === true,
        requires_photo: o.requires_photo === true,
        // Spread, never `correct: undefined`: a key present with an undefined
        // value still shows up in Object.keys and in the stored jsonb shape.
        ...(correct ? { correct } : {}),
        ...legacy,
      },
    ];
  });
}

/**
 * A number as someone typed it into a field, or undefined when there isn't
 * one. Accepts what an Arabic keyboard produces — Arabic-Indic (٠-٩) and
 * Extended Arabic-Indic (۰-۹) digits, the Arabic decimal separator ٫ — and a
 * comma decimal, because answer_ok() normalises all of those too and a bound
 * the portal refused would be one the phone can meet.
 */
export function parseDecimal(raw: string): number | undefined {
  const s = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return undefined;
  return Number(s);
}

/**
 * A correct-answer rule, checked against the item's type — the same shapes
 * answer_ok() judges in the database (0013).
 *
 *   yesno      {eq: 'yes' | 'no'}
 *   pass_fail  {eq: 'pass' | 'fail'}
 *   text       {eq: '<non-empty text>'}           compared ignoring case/spaces
 *   number     {min?, max?}  finite, min <= max   an exact value is min = max
 *
 * Anything else becomes "no rule" rather than an error. A rule that does not
 * fit its type — a {min} left behind on an item that was switched to yes/no —
 * would otherwise flag every answer to it as wrong, forever.
 */
export function parseCorrect(type: ItemType, raw: unknown): Correct | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;

  if (type === 'number') {
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const min = num(o.min);
    const max = num(o.max);
    if (min === undefined && max === undefined) return undefined;
    if (min !== undefined && max !== undefined && min > max) return undefined;
    return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
  }

  const eq = typeof o.eq === 'string' ? o.eq.trim() : '';
  if (!eq) return undefined;
  if (type === 'yesno') return eq === 'yes' || eq === 'no' ? { eq } : undefined;
  if (type === 'pass_fail') return eq === 'pass' || eq === 'fail' ? { eq } : undefined;
  return { eq };
}
