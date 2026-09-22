import { parseCorrect } from '@/lib/template-items';
import { fmtNum } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import type { ItemType } from '@/lib/types/database';

/**
 * How an answer and a correct-answer rule read on screen. The stored values
 * are the machine form — 'yes', 'pass', "2.5" — because answer_ok() compares
 * them; these turn them back into words in the viewer's language.
 */

function asType(type: string): ItemType {
  return type === 'pass_fail' || type === 'text' || type === 'number' ? type : 'yesno';
}

/** "Yes" / "Pass" for the choice types; a number or text exactly as given. */
export function answerLabel(type: string, answer: string | null, dict: Dictionary): string {
  if (!answer) return dict.none;
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
): string | null {
  const t = asType(type);
  const c = parseCorrect(t, raw);
  if (!c) return null;
  if ('eq' in c) return t === 'text' ? `“${c.eq}”` : answerLabel(t, c.eq, dict);
  const n = (v: number) => fmtNum(v, locale);
  if (c.min !== undefined && c.max !== undefined) {
    return c.min === c.max ? n(c.min) : `${n(c.min)} – ${n(c.max)}`;
  }
  if (c.min !== undefined) return dict.atLeast.replace('{n}', n(c.min));
  return dict.atMost.replace('{n}', n(c.max!));
}
