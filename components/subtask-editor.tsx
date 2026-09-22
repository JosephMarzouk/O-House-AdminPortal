'use client';

import { useState, type ReactNode } from 'react';
import { PlusIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { parseDecimal } from '@/lib/template-items';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Correct, ItemType, TemplateItem } from '@/lib/types/database';

const TYPES: ItemType[] = ['yesno', 'pass_fail', 'text', 'number'];

export function emptyItem(): TemplateItem {
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
  };
}

/**
 * Shared by the place editor (where it defines a place's default subtasks,
 * stored in templates.items) and the new-assignment form (where the list is
 * seeded from those defaults and becomes assignment_items).
 *
 * Both consume the identical shape, which is why create_assignment's p_items
 * needs no translation layer. Order matters: sort_order is array position.
 *
 * Each subtask is a discrete item, so each is a card; the controls inside
 * are the compact 44px size because a row of 56px fields reads as a form,
 * not a list.
 */
export function SubtaskEditor({
  items,
  onChange,
  dict,
}: {
  items: TemplateItem[];
  onChange: (next: TemplateItem[]) => void;
  dict: Dictionary;
}) {
  function patch(index: number, p: Partial<TemplateItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...p } : it)));
  }

  function typeLabel(t: ItemType) {
    return t === 'pass_fail'
      ? dict.typePassFail
      : t === 'yesno'
        ? dict.typeYesno
        : t === 'text'
          ? dict.typeText
          : dict.typeNumber;
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-text/55">{dict.noData}</p>}

      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={item.id || i}>
            <Card className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
              <Input
                compact
                aria-label={dict.subtaskAr}
                placeholder={dict.subtaskAr}
                value={item.text_ar}
                onChange={(e) => patch(i, { text_ar: e.target.value })}
              />
              <Input
                compact
                aria-label={dict.subtaskEn}
                placeholder={dict.subtaskEn}
                dir="ltr"
                value={item.text_en}
                onChange={(e) => patch(i, { text_en: e.target.value })}
              />
              <Select
                compact
                className="sm:w-44"
                aria-label={dict.itemType}
                value={item.type}
                // A rule only means something for the type it was written
                // for — {min: 1} on a yes/no item would flag every answer.
                onChange={(e) => patch(i, { type: e.target.value as ItemType, correct: undefined })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
                  </option>
                ))}
              </Select>

              <div className="flex items-center gap-4 whitespace-nowrap text-sm">
                <label className="flex min-h-control items-center gap-2">
                  <Checkbox
                    checked={item.requires_photo}
                    onCheckedChange={(v) => patch(i, { requires_photo: v === true })}
                  />
                  {dict.requiresPhoto}
                </label>
                {/* `critical` only changes font weight on the phone
                    (subtask_tile.dart:78). requires_photo is the flag with
                    teeth — it gates Submit client-side and raises
                    MISSING_PHOTO server-side. */}
                <label className="flex min-h-control items-center gap-2">
                  <Checkbox
                    checked={item.critical}
                    onCheckedChange={(v) => patch(i, { critical: v === true })}
                  />
                  {dict.critical}
                </label>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={dict.remove}
                onClick={() => onChange(items.filter((_, x) => x !== i))}
              >
                <XIcon />
              </Button>

              <CorrectAnswer
                item={item}
                onChange={(correct) => patch(i, { correct })}
                dict={dict}
              />
            </Card>
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" onClick={() => onChange([...items, emptyItem()])}>
        <PlusIcon />
        {dict.addSubtask}
      </Button>
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
  const range = item.correct && !('eq' in item.correct) ? item.correct : {};

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
