import { choiceOptions, parseCorrect } from '@/lib/template-items';
import { fmtNum } from '@/lib/format';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { ItemType } from '@/lib/types/database';

/**
 * How an answer and a correct-answer rule read on screen. The stored values
 * are the machine form — 'yes', 'pass', "2.5" — because answer_ok() compares
 * them; these turn them back into words in the viewer's language.
 */

function asType(type: string): ItemType {
  return type === 'pass_fail' || type === 'text' || type === 'number' || type === 'choice'
    ? type
    : 'yesno';
}

/** A choice option's label in the viewer's language (the other one when it is blank). */
function optionLabel(options: unknown, id: string, locale: Locale): string | undefined {
  const o = choiceOptions(options).find((x) => x.id === id);
  return o ? bilingual(locale, o.text_ar, o.text_en) || o.text_en || o.text_ar : undefined;
}

/**
 * "Yes" / "Pass" for the two-way types; a multiple-choice answer as its
 * option's label (the stored answer is the option id; `options` is the
 * item's copied list); a number or text exactly as given.
 */
export function answerLabel(
  type: string,
  answer: string | null,
  dict: Dictionary,
  options?: unknown,
  locale: Locale = 'en',
): string {
  if (!answer) return dict.none;
  if (asType(type) === 'choice') return optionLabel(options, answer, locale) ?? answer;
  const words: Record<string, string> = {
    yes: dict.answerYes,
    no: dict.answerNo,
    pass: dict.answerPass,
    fail: dict.answerFail,
  };
  const t = asType(type);
  return (t === 'yesno' || t === 'pass_fail') && words[answer] ? words[answer] : answer;
}

/**
 * The rule in words, or null when the item has none: "Yes", "“clean”",
 * "1 – 3", "at least 1", "at most 3". Runs the stored jsonb back through
 * parseCorrect() so a rule the database would ignore is not shown either.
 */
export function correctLabel(
  type: string,
  raw: unknown,
  dict: Dictionary,
  locale: Locale,
  options?: unknown,
): string | null {
  const t = asType(type);
  const c = parseCorrect(t, raw, t === 'choice' ? choiceOptions(options) : undefined);
  if (!c) return null;
  if ('in' in c) return c.in.map((id) => optionLabel(options, id, locale) ?? id).join(' / ');
  if ('eq' in c) return t === 'text' ? `“${c.eq}”` : answerLabel(t, c.eq, dict);
  const n = (v: number) => fmtNum(v, locale);
  if (c.min !== undefined && c.max !== undefined) {
    return c.min === c.max ? n(c.min) : `${n(c.min)} – ${n(c.max)}`;
  }
  if (c.min !== undefined) return dict.atLeast.replace('{n}', n(c.min));
  return dict.atMost.replace('{n}', n(c.max!));
}

/**
 * A checklist's items in runs of one category, in the order they come (the
 * database orders them by category already). An item without a category
 * belongs to a run with a null title; a checklist with no categories at all
 * is one such run, so screens draw no headings for it.
 */
export function groupByCategory<
  T extends { category_id?: string | null; category_en?: string | null; category_ar?: string | null },
>(items: T[], locale: Locale): { key: string; title: string | null; items: T[] }[] {
  const runs: { key: string; title: string | null; items: T[] }[] = [];
  for (const it of items) {
    const id = it.category_id || '';
    const last = runs.at(-1);
    if (last && last.key === id) {
      last.items.push(it);
      continue;
    }
    const title = id
      ? bilingual(locale, it.category_ar ?? '', it.category_en ?? '') ||
        it.category_en ||
        it.category_ar ||
        null
      : null;
    runs.push({ key: id, title, items: [it] });
  }
  return runs;
}
