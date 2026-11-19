import type { Category, ChoiceOption, Correct, ItemType, TemplateItem } from '@/lib/types/database';

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
 * phone app reads. The six core fields always come out; `correct`,
 * `options` (choice items only), `category_id` (only one in `categories`,
 * when given) and the three legacy keys come out only when they were there
 * and well-formed, so a plain item still has exactly six keys. The stamped
 * category names never survive this: orderAndStamp() adds them afterwards.
 *
 * Lives apart from lib/db/places.ts (which re-exports it, so no import site
 * changed) because that module pulls in the server Supabase client, and this
 * is a pure function that scripts/check.ts needs to import on its own.
 */
export function templateItems(items: unknown, categories?: Category[]): TemplateItem[] {
  if (!Array.isArray(items)) return [];
  const known = categories ? new Set(categories.map((c) => c.id)) : null;
  return items.flatMap((raw): TemplateItem[] => {
    if (!raw || typeof raw !== 'object') return [];
    const o = raw as Record<string, unknown>;
    const type: ItemType =
      o.type === 'pass_fail' ||
      o.type === 'yesno' ||
      o.type === 'text' ||
      o.type === 'number' ||
      o.type === 'choice'
        ? o.type
        : 'yesno';
    // Options only on a choice item: switching the type away drops them.
    const options = type === 'choice' ? choiceOptions(o.options) : undefined;
    const correct = parseCorrect(type, o.correct, options);
    // A category the place no longer has (deleted) leaves the item uncategorised.
    const categoryId =
      typeof o.category_id === 'string' && o.category_id && (!known || known.has(o.category_id))
        ? o.category_id
        : undefined;

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
        ...(options ? { options } : {}),
        ...(categoryId ? { category_id: categoryId } : {}),
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
export function parseCorrect(
  type: ItemType,
  raw: unknown,
  options?: ChoiceOption[],
): Correct | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;

  // choice: {in: [option ids]}, only ids the item still has; none left = no rule.
  if (type === 'choice') {
    if (!Array.isArray(o.in)) return undefined;
    const ids = new Set(options?.map((x) => x.id));
    const keep = [...new Set(o.in.filter((v): v is string => typeof v === 'string' && ids.has(v)))];
    return keep.length ? { in: keep } : undefined;
  }

  if (type === 'number') {
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const min = num(o.min);
    const max = num(o.max);
    if (min === undefined && max === undefined) return undefined;
    if (min !== undefined && max !== undefined && min > max) return undefined;
    return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
  }

  if ('in' in o) return undefined;
  const eq = typeof o.eq === 'string' ? o.eq.trim() : '';
  if (!eq) return undefined;
  if (type === 'yesno') return eq === 'yes' || eq === 'no' ? { eq } : undefined;
  if (type === 'pass_fail') return eq === 'pass' || eq === 'fail' ? { eq } : undefined;
  return { eq };
}

/** At most this many options on one choice question (the phone lists them all). */
export const MAX_OPTIONS = 10;

/**
 * A choice item's options: each keeps a non-empty id (one is made when
 * missing) and needs a label in at least one language. Duplicated ids keep the
 * first. Kept even below two, so the editor never loses what someone typed;
 * choiceProblem() is what refuses a save.
 */
export function choiceOptions(raw: unknown): ChoiceOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ChoiceOption[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const text_en = typeof o.text_en === 'string' ? o.text_en.trim() : '';
    const text_ar = typeof o.text_ar === 'string' ? o.text_ar.trim() : '';
    if (!text_en && !text_ar) continue;
    let id = typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID();
    if (seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    out.push({ id, text_en, text_ar });
    if (out.length === MAX_OPTIONS) break;
  }
  return out;
}

/** True when a choice item has fewer than two usable options: the save is refused. */
export function choiceProblem(items: TemplateItem[]): boolean {
  return items.some((i) => i.type === 'choice' && (i.options?.length ?? 0) < 2);
}

/**
 * `templates.categories` — parsed on read and, as the write whitelist, on save.
 * A category needs a name in at least one language; ids are kept (items point
 * at them) and made when missing; a duplicated id keeps the first.
 */
export function templateCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Category[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const name_en = typeof o.name_en === 'string' ? o.name_en.trim() : '';
    const name_ar = typeof o.name_ar === 'string' ? o.name_ar.trim() : '';
    if (!name_en && !name_ar) continue;
    const id = typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name_en, name_ar });
  }
  return out;
}

/**
 * The items as a checklist gets them — the same order and stamp as
 * private.place_items() in the database: uncategorised first, then category by
 * category in the place's order, each keeping its own order inside; each
 * categorised item carries its category's names, which create_assignment
 * copies onto the checklist. `keep` (category ids) leaves the others out;
 * absent = all.
 */
export function orderAndStamp(
  items: TemplateItem[],
  categories: Category[],
  keep?: string[],
): TemplateItem[] {
  const pos = new Map(categories.map((c, i) => [c.id, i] as const));
  const byId = new Map(categories.map((c) => [c.id, c] as const));
  const kept = keep ? new Set(keep) : null;
  return items
    .map((it, i) => ({ it, i, c: it.category_id ? byId.get(it.category_id) : undefined }))
    .filter(({ c }) => !c || !kept || kept.has(c.id))
    .sort((a, b) => (a.c ? pos.get(a.c.id)! + 1 : 0) - (b.c ? pos.get(b.c.id)! + 1 : 0) || a.i - b.i)
    .map(({ it, c }) => {
      const rest = { ...it };
      delete rest.category_id;
      delete rest.category_en;
      delete rest.category_ar;
      return c
        ? { ...rest, category_id: c.id, category_en: c.name_en, category_ar: c.name_ar }
        : rest;
    });
}
