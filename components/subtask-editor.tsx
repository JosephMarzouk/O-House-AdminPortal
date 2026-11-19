'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { MAX_OPTIONS, parseDecimal } from '@/lib/template-items';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Category, ChoiceOption, Correct, ItemType, TemplateItem } from '@/lib/types/database';

const TYPES: ItemType[] = ['yesno', 'pass_fail', 'text', 'number', 'choice'];

export function emptyItem(categoryId?: string): TemplateItem {
  return {
    // A real id from birth, not ''. The rows are keyed by it — an index key
    // hands one row's in-progress number to its neighbour the moment an item
    // above it is removed — and templateItems() keeps any non-empty id, so
    // this is also the id the item is saved with.
    id: crypto.randomUUID(),
    text_ar: '',
    text_en: '',
    type: 'yesno',
    critical: false,
    requires_photo: false,
    ...(categoryId ? { category_id: categoryId } : {}),
  };
}

function emptyOption(): ChoiceOption {
  return { id: crypto.randomUUID(), text_ar: '', text_en: '' };
}

/** The item without its category: the key gone, not set to undefined. */
function uncategorised(item: TemplateItem): TemplateItem {
  const rest = { ...item };
  delete rest.category_id;
  return rest;
}

/**
 * Shared by the place editor (where it defines a place's default subtasks,
 * stored in templates.items, and its categories, templates.categories) and the
 * new-assignment form (where both are seeded from the place and become
 * assignment_items).
 *
 * The questions show grouped: those without a category first, then one block
 * per category in its order — the same order orderAndStamp() and the
 * database's place_items() give a checklist. Inside a block the order is the
 * array order; the arrows swap a question with its neighbour in the same
 * block, or move a whole category block.
 *
 * Each subtask is a discrete item, so each is a card; the controls inside
 * are the compact 44px size because a row of 56px fields reads as a form,
 * not a list.
 */
export function SubtaskEditor({
  items,
  onChange,
  categories,
  onCategoriesChange,
  dict,
  disabled = false,
}: {
  items: TemplateItem[];
  onChange: (next: TemplateItem[]) => void;
  categories: Category[];
  onCategoriesChange: (next: Category[]) => void;
  dict: Dictionary;
  /** Read-only: the fieldset greys the native controls, the checkboxes are told. */
  disabled?: boolean;
}) {
  // The category whose delete is waiting on "delete its questions or keep them".
  const [deleting, setDeleting] = useState<string | null>(null);
  const known = new Set(categories.map((c) => c.id));
  const groupOf = (it: TemplateItem) =>
    it.category_id && known.has(it.category_id) ? it.category_id : '';

  function patch(id: string, p: Partial<TemplateItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }

  /** Swap a question with its previous / next neighbour in the same group. */
  function moveItem(id: string, by: -1 | 1) {
    const i = items.findIndex((it) => it.id === id);
    const g = groupOf(items[i]);
    let j = i + by;
    while (j >= 0 && j < items.length && groupOf(items[j]) !== g) j += by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function moveCategory(index: number, by: -1 | 1) {
    const next = [...categories];
    const [c] = next.splice(index, 1);
    next.splice(index + by, 0, c);
    onCategoriesChange(next);
  }

  function patchCategory(id: string, p: Partial<Category>) {
    onCategoriesChange(categories.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  function deleteCategory(id: string, withQuestions: boolean) {
    onCategoriesChange(categories.filter((c) => c.id !== id));
    onChange(
      withQuestions
        ? items.filter((it) => it.category_id !== id)
        : items.map((it) => (it.category_id === id ? uncategorised(it) : it)),
    );
    setDeleting(null);
  }

  function setCategory(item: TemplateItem, categoryId: string) {
    const base = uncategorised(item);
    const next = categoryId ? { ...base, category_id: categoryId } : base;
    onChange(items.map((it) => (it.id === item.id ? next : it)));
  }

  function typeLabel(t: ItemType) {
    return t === 'pass_fail'
      ? dict.typePassFail
      : t === 'yesno'
        ? dict.typeYesno
        : t === 'text'
          ? dict.typeText
          : t === 'choice'
            ? dict.typeChoice
            : dict.typeNumber;
  }

  function itemCard(item: TemplateItem, first: boolean, last: boolean) {
    return (
      <li key={item.id}>
        <Card className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            compact
            aria-label={dict.subtaskAr}
            placeholder={dict.subtaskAr}
            value={item.text_ar}
            onChange={(e) => patch(item.id, { text_ar: e.target.value })}
          />
          <Input
            compact
            aria-label={dict.subtaskEn}
            placeholder={dict.subtaskEn}
            dir="ltr"
            value={item.text_en}
            onChange={(e) => patch(item.id, { text_en: e.target.value })}
          />
          <Select
            compact
            className="sm:w-44"
            aria-label={dict.itemType}
            value={item.type}
            // A rule only means something for the type it was written
            // for — {min: 1} on a yes/no item would flag every answer.
            onChange={(e) => {
              const type = e.target.value as ItemType;
              patch(item.id, {
                type,
                correct: undefined,
                options:
                  type === 'choice' ? (item.options ?? [emptyOption(), emptyOption()]) : undefined,
              });
            }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </Select>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:col-span-full">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <label className="flex min-h-control items-center gap-2 whitespace-nowrap">
                <Checkbox
                  disabled={disabled}
                  checked={item.requires_photo}
                  onCheckedChange={(v) => patch(item.id, { requires_photo: v === true })}
                />
                {dict.requiresPhoto}
              </label>
              {/* `critical` only changes font weight on the phone
                  (subtask_tile.dart:78). requires_photo is the flag with
                  teeth — it gates Submit client-side and raises
                  MISSING_PHOTO server-side. */}
              <label className="flex min-h-control items-center gap-2 whitespace-nowrap">
                <Checkbox
                  disabled={disabled}
                  checked={item.critical}
                  onCheckedChange={(v) => patch(item.id, { critical: v === true })}
                />
                {dict.critical}
              </label>
              {categories.length > 0 && (
                <Select
                  compact
                  className="w-auto sm:w-56"
                  aria-label={dict.category}
                  value={groupOf(item)}
                  onChange={(e) => setCategory(item, e.target.value)}
                >
                  <option value="">{dict.noCategory}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryName(c, dict)}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={dict.moveUp}
                disabled={first}
                onClick={() => moveItem(item.id, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={dict.moveDown}
                disabled={last}
                onClick={() => moveItem(item.id, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={dict.remove}
                onClick={() => onChange(items.filter((it) => it.id !== item.id))}
              >
                <XIcon />
              </Button>
            </div>
          </div>

          {item.type === 'choice' ? (
            <ChoiceOptions
              item={item}
              onChange={(p) => patch(item.id, p)}
              dict={dict}
              disabled={disabled}
            />
          ) : (
            <CorrectAnswer
              item={item}
              onChange={(correct) => patch(item.id, { correct })}
              dict={dict}
            />
          )}
        </Card>
      </li>
    );
  }

  function group(categoryId: string) {
    const list = items.filter((it) => groupOf(it) === categoryId);
    return (
      <>
        {list.length > 0 && (
          <ul className="space-y-2">
            {list.map((it, i) => itemCard(it, i === 0, i === list.length - 1))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...items, emptyItem(categoryId || undefined)])}
        >
          <PlusIcon />
          {dict.addSubtask}
        </Button>
      </>
    );
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      {items.length === 0 && categories.length === 0 && (
        <p className="text-sm text-text/55">{dict.noData}</p>
      )}

      {categories.length > 0 && <h3 className="text-field text-text/70">{dict.noCategory}</h3>}
      {group('')}

      {categories.map((c, ci) => {
        const count = items.filter((it) => it.category_id === c.id).length;
        const nameless = !c.name_ar.trim() && !c.name_en.trim();
        return (
          <section key={c.id} className="space-y-3 border-s-4 border-cyan/40 ps-3 pt-2">
            <div className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <Input
                compact
                aria-label={dict.categoryAr}
                placeholder={dict.categoryAr}
                aria-invalid={nameless || undefined}
                value={c.name_ar}
                onChange={(e) => patchCategory(c.id, { name_ar: e.target.value })}
              />
              <Input
                compact
                dir="ltr"
                aria-label={dict.categoryEn}
                placeholder={dict.categoryEn}
                aria-invalid={nameless || undefined}
                value={c.name_en}
                onChange={(e) => patchCategory(c.id, { name_en: e.target.value })}
              />
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={dict.moveUp}
                  disabled={ci === 0}
                  onClick={() => moveCategory(ci, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={dict.moveDown}
                  disabled={ci === categories.length - 1}
                  onClick={() => moveCategory(ci, 1)}
                >
                  <ArrowDownIcon />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={dict.remove}
                onClick={() => (count === 0 ? deleteCategory(c.id, false) : setDeleting(c.id))}
              >
                <TrashIcon />
              </Button>
            </div>
            {nameless && <p className="text-caption text-magenta">{dict.categoryNameRequired}</p>}
            {deleting === c.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-magenta/10 p-3 text-sm">
                <span>{dict.deleteCategoryAsk}</span>
                <Button type="button" variant="outline" onClick={() => deleteCategory(c.id, false)}>
                  {dict.keepQuestions}
                </Button>
                <Button type="button" variant="outline" onClick={() => deleteCategory(c.id, true)}>
                  {dict.deleteWithQuestions}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
                  {dict.cancel}
                </Button>
              </div>
            )}
            {group(c.id)}
          </section>
        );
      })}

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onCategoriesChange([...categories, { id: crypto.randomUUID(), name_ar: '', name_en: '' }])
          }
        >
          <PlusIcon />
          {dict.addCategory}
        </Button>
      </div>
    </fieldset>
  );
}

/** A category's name, Arabic first (the portal's default), then English. */
function categoryName(c: Category, dict: Dictionary): string {
  return c.name_ar.trim() || c.name_en.trim() || dict.noCategory;
}

/**
 * A choice question's options, each with an "acceptable" tick. The ticks are
 * the item's rule ({in: [ids]}); none ticked means any option is fine.
 */
function ChoiceOptions({
  item,
  onChange,
  dict,
  disabled,
}: {
  item: TemplateItem;
  onChange: (p: Partial<TemplateItem>) => void;
  dict: Dictionary;
  disabled: boolean;
}) {
  const options = item.options ?? [];
  const accepted = item.correct && 'in' in item.correct ? item.correct.in : [];
  const withRule = (opts: ChoiceOption[], ids: string[]): Partial<TemplateItem> => {
    const keep = ids.filter((id) => opts.some((o) => o.id === id));
    return { options: opts, correct: keep.length ? { in: keep } : undefined };
  };
  const rename = (id: string, p: Partial<ChoiceOption>) =>
    onChange(withRule(options.map((x) => (x.id === id ? { ...x, ...p } : x)), accepted));
  const tooFew = options.filter((o) => o.text_ar.trim() || o.text_en.trim()).length < 2;

  return (
    <div className="space-y-2 sm:col-span-full">
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.id} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <Input
              compact
              aria-label={dict.optionAr}
              placeholder={dict.optionAr}
              value={o.text_ar}
              onChange={(e) => rename(o.id, { text_ar: e.target.value })}
            />
            <Input
              compact
              dir="ltr"
              aria-label={dict.optionEn}
              placeholder={dict.optionEn}
              value={o.text_en}
              onChange={(e) => rename(o.id, { text_en: e.target.value })}
            />
            <label className="flex min-h-control items-center gap-2 whitespace-nowrap text-sm">
              <Checkbox
                disabled={disabled}
                checked={accepted.includes(o.id)}
                onCheckedChange={(v) =>
                  onChange(
                    withRule(
                      options,
                      v === true ? [...accepted, o.id] : accepted.filter((id) => id !== o.id),
                    ),
                  )
                }
              />
              {dict.acceptable}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={dict.remove}
              onClick={() => onChange(withRule(options.filter((x) => x.id !== o.id), accepted))}
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          variant="outline"
          disabled={options.length >= MAX_OPTIONS}
          onClick={() => onChange(withRule([...options, emptyOption()], accepted))}
        >
          <PlusIcon />
          {dict.addOption}
        </Button>
        <span className={tooFew ? 'text-caption text-magenta' : 'text-caption text-text/55'}>
          {tooFew ? dict.choiceNeedsOptions : dict.choiceHint}
        </span>
      </div>
    </div>
  );
}

/**
 * The optional correct answer (0013) — a full-width row under the item's
 * controls. Leaving it empty means any answer is fine; setting it means a
 * different answer holds the task in follow-up until the assignee fixes it.
 * The shapes are exactly what parseCorrect() and answer_ok() accept.
 */
function CorrectAnswer({
  item,
  onChange,
  dict,
}: {
  item: TemplateItem;
  onChange: (next: Correct | undefined) => void;
  dict: Dictionary;
}) {
  const eq = item.correct && 'eq' in item.correct ? item.correct.eq : '';
  const range: { min?: number; max?: number } =
    item.correct && !('eq' in item.correct) && !('in' in item.correct) ? item.correct : {};

  // The two choice types share one control: pick the answer, or "any".
  const choices: Record<'yesno' | 'pass_fail', [string, string][]> = {
    yesno: [
      ['yes', dict.answerYes],
      ['no', dict.answerNo],
    ],
    pass_fail: [
      ['pass', dict.answerPass],
      ['fail', dict.answerFail],
    ],
  };

  let control: ReactNode;
  if (item.type === 'yesno' || item.type === 'pass_fail') {
    control = (
      <Select
        compact
        className="sm:w-44"
        aria-label={dict.correctAnswer}
        value={eq}
        onChange={(e) => onChange(e.target.value ? { eq: e.target.value } : undefined)}
      >
        <option value="">{dict.correctAnswerAny}</option>
        {choices[item.type].map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    );
  } else if (item.type === 'text') {
    control = (
      <Input
        compact
        className="sm:max-w-72"
        aria-label={dict.correctAnswer}
        placeholder={dict.correctAnswerAny}
        value={eq}
        onChange={(e) => onChange(e.target.value.trim() ? { eq: e.target.value } : undefined)}
      />
    );
  } else {
    const set = (key: 'min' | 'max', v: number | undefined) => {
      const next = { ...range, [key]: v };
      if (next.min === undefined) delete next.min;
      if (next.max === undefined) delete next.max;
      onChange(next.min === undefined && next.max === undefined ? undefined : next);
    };
    control = (
      <div className="flex flex-wrap items-center gap-2">
        <DecimalInput label={dict.correctMin} value={range.min} onChange={(v) => set('min', v)} />
        <DecimalInput label={dict.correctMax} value={range.max} onChange={(v) => set('max', v)} />
      </div>
    );
  }

  const inverted =
    range.min !== undefined && range.max !== undefined && range.min > range.max;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:col-span-full">
      <span className="text-field text-text/70">{dict.correctAnswer}</span>
      {control}
      <span className={inverted ? 'text-caption text-magenta' : 'text-caption text-text/55'}>
        {inverted ? dict.correctRangeInverted : dict.correctAnswerHint}
      </span>
    </div>
  );
}

/**
 * A number typed the way people type it: its own text, so "1." and "-" can
 * exist on the way to "1.5" and "-2". The parsed value (Arabic-Indic digits,
 * the Arabic decimal separator and a comma all accepted) is what reaches the
 * item; anything unparseable reads as "no bound".
 */
function DecimalInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  return (
    <Input
      compact
      className="w-32"
      aria-label={label}
      placeholder={label}
      inputMode="decimal"
      dir="ltr"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseDecimal(e.target.value));
      }}
    />
  );
}
