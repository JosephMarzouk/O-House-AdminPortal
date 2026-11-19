'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { Category } from '@/lib/types/database';

/**
 * Which of a place's categories a round entry or a multi-place task includes.
 * `value` undefined means all of them, and stays undefined while all are
 * ticked, so a place's new category is included by default; unticking one
 * stores the ids that remain. Questions without a category are always
 * included (private.place_items() in the database).
 */
export function CategoryTicks({
  categories,
  value,
  onChange,
  dict,
  locale,
  disabled = false,
}: {
  categories: Category[];
  value: string[] | undefined;
  onChange: (next: string[] | undefined) => void;
  dict: Dictionary;
  locale: Locale;
  disabled?: boolean;
}) {
  if (categories.length === 0) return null;
  const on = (id: string) => !value || value.includes(id);

  function toggle(id: string, checked: boolean) {
    const now = categories.filter((c) => (c.id === id ? checked : on(c.id))).map((c) => c.id);
    onChange(now.length === categories.length ? undefined : now);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="text-caption text-text/55">{dict.includeCategories}</span>
      {categories.map((c) => (
        <label key={c.id} className="flex min-h-control items-center gap-2">
          <Checkbox
            disabled={disabled}
            checked={on(c.id)}
            onCheckedChange={(v) => toggle(c.id, v === true)}
          />
          {bilingual(locale, c.name_ar, c.name_en)}
        </label>
      ))}
    </div>
  );
}

/** How many of a place's questions a round entry or task place keeps. */
export function keptItemCount(
  items: { category_id?: string }[],
  categories: Category[],
  keep: string[] | undefined,
): number {
  const known = new Set(categories.map((c) => c.id));
  return items.filter(
    (i) => !i.category_id || !known.has(i.category_id) || !keep || keep.includes(i.category_id),
  ).length;
}
