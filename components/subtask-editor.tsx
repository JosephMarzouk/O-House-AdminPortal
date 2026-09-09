'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ItemType, TemplateItem } from '@/lib/types/database';

const TYPES: ItemType[] = ['yesno', 'pass_fail', 'text', 'number'];

export const SELECT_CLASS =
  'h-9 w-full border bg-[var(--input)] px-2 text-sm rounded-[var(--radius)]';

export function emptyItem(): TemplateItem {
  return {
    id: '',
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
      {items.length === 0 && <p className="text-sm text-muted-foreground">{dict.noData}</p>}

      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="grid gap-2 bg-card p-3 shadow-[var(--shadow-broadsheet)] sm:grid-cols-[1fr_1fr_8rem_auto_auto]"
          >
            <Input
              aria-label={dict.subtaskAr}
              placeholder={dict.subtaskAr}
              value={item.text_ar}
              onChange={(e) => patch(i, { text_ar: e.target.value })}
            />
            <Input
              aria-label={dict.subtaskEn}
              placeholder={dict.subtaskEn}
              dir="ltr"
              value={item.text_en}
              onChange={(e) => patch(i, { text_en: e.target.value })}
            />
            <select
              aria-label={dict.itemType}
              className={SELECT_CLASS}
              value={item.type}
              onChange={(e) => patch(i, { type: e.target.value as ItemType })}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3 whitespace-nowrap text-sm">
              <label className="flex items-center gap-1.5">
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
              <label className="flex items-center gap-1.5">
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
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" onClick={() => onChange([...items, emptyItem()])}>
        <Plus className="size-4" />
        {dict.addSubtask}
      </Button>
    </div>
  );
}
