'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { createAssignment } from '@/lib/actions/assignments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SubtaskEditor } from '@/components/subtask-editor';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { TemplateItem } from '@/lib/types/database';
import { errorMessage } from '@/lib/errors';

export type PlaceOption = {
  id: string;
  siteId: string | null;
  nameAr: string;
  nameEn: string;
  items: TemplateItem[];
};

export type StaffOption = { id: string; name: string };

type FieldKey = 'place' | 'assignee' | 'title' | 'date' | 'from' | 'to' | 'items';

export function NewAssignmentForm({
  places,
  staff,
  dict,
  locale,
}: {
  places: PlaceOption[];
  staff: StaffOption[];
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [placeId, setPlaceId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [taskNote, setTaskNote] = useState('');
  const [errors, setErrors] = useState<Set<FieldKey>>(new Set());

  const place = places.find((p) => p.id === placeId);

  /** Choosing a place seeds the title and its default subtasks. A starting
   *  point, not a constraint — everything below stays editable. */
  function onPlaceChange(id: string) {
    setPlaceId(id);
    const p = places.find((x) => x.id === id);
    if (!p) return;
    setItems(p.items.map((i) => ({ ...i })));
    if (!titleAr) setTitleAr(p.nameAr);
    if (!titleEn) setTitleEn(p.nameEn);
  }

  /** Names the exact fields that are missing. The old version showed a
   *  generic "fill in the required fields", which left you hunting. */
  function validate(): Set<FieldKey> {
    const bad = new Set<FieldKey>();
    if (!placeId) bad.add('place');
    if (!assigneeId) bad.add('assignee');
    if (!titleAr.trim() && !titleEn.trim()) bad.add('title');
    if (!date) bad.add('date');
    if (!from) bad.add('from');
    if (!to) bad.add('to');
    // create_assignment happily accepts an empty p_items, but an assignment
    // with no subtasks renders 0/0 on the phone with Submit permanently
    // disabled — so it is a dead end, not a valid state.
    if (items.length === 0 || items.every((i) => !i.text_ar.trim() && !i.text_en.trim())) {
      bad.add('items');
    }
    return bad;
  }

  const LABELS: Record<FieldKey, string> = {
    place: dict.place,
    assignee: dict.assignee,
    title: dict.assignmentTitleAr,
    date: dict.scheduledDate,
    from: dict.windowStart,
    to: dict.windowEnd,
    items: dict.subtasks,
  };

  function submit() {
    const bad = validate();
    setErrors(bad);

    if (bad.size > 0) {
      const names = [...bad].map((k) => LABELS[k]).join('، ');
      alert.error(`${dict.missingFields} ${names}`);
      // Put the first offending field on screen — the form is tall enough
      // that the culprit is often scrolled out of view.
      document
        .getElementById(bad.has('items') && bad.size === 1 ? 'subtasks' : [...bad][0])
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    // Every template carries a site_id, but a hand-made row might not, and
    // create_assignment requires p_site_id — say so rather than blaming the form.
    if (!place?.siteId) {
      alert.error(dict.placeHasNoSite);
      return;
    }

    startTransition(async () => {
      const res = await createAssignment({
        templateId: place.id,
        siteId: place.siteId!,
        assigneeId,
        titleAr,
        titleEn,
        scheduledDate: date,
        windowStart: from,
        windowEnd: to,
        // Whole items, ids included: an item seeded from the place keeps its
        // id, which becomes assignment_items.template_item_id, and its
        // correct answer travels with it. The server action runs these
        // through templateItems() before they reach the RPC.
        items: items.filter((i) => i.text_ar.trim() || i.text_en.trim()),
        taskNote,
      });

      if (res.ok) {
        alert.success(dict.assignmentCreated);
        router.push(`/assignments/${res.id}`);
        router.refresh();
        return;
      }
      alert.error(errorMessage(dict, res.error));
    });
  }

  const err = (k: FieldKey) =>
    errors.has(k) ? <p className="text-caption text-magenta">{dict.required}</p> : null;
  const invalid = (k: FieldKey) => errors.has(k) || undefined;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="place">{dict.place}</Label>
          <Select
            id="place"
            aria-invalid={invalid('place')}
            value={placeId}
            onChange={(e) => onPlaceChange(e.target.value)}
          >
            <option value="">{dict.selectPlace}</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {bilingual(locale, p.nameAr, p.nameEn)}
              </option>
            ))}
          </Select>
          {err('place')}
        </div>

        <div className="space-y-1">
          <Label htmlFor="assignee">{dict.assignee}</Label>
          <Select
            id="assignee"
            aria-invalid={invalid('assignee')}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">{dict.selectAssignee}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {err('assignee')}
        </div>

        <div className="space-y-1">
          <Label htmlFor="title">{dict.assignmentTitleAr}</Label>
          <Input
            id="title"
            aria-invalid={invalid('title')}
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
          {err('title')}
        </div>
        <div className="space-y-1">
          <Label htmlFor="title-en">{dict.assignmentTitleEn}</Label>
          <Input
            id="title-en"
            dir="ltr"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="date">{dict.scheduledDate}</Label>
          <Input
            id="date"
            type="date"
            dir="ltr"
            aria-invalid={invalid('date')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {err('date')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="from">{dict.windowStart}</Label>
            <Input
              id="from"
              type="time"
              dir="ltr"
              aria-invalid={invalid('from')}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            {err('from')}
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">{dict.windowEnd}</Label>
            <Input
              id="to"
              type="time"
              dir="ltr"
              aria-invalid={invalid('to')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            {err('to')}
          </div>
        </div>
      </div>

      <div className="max-w-2xl space-y-1">
        <Label htmlFor="task-note">
          {dict.taskNote} <span className="text-text/55">({dict.optional})</span>
        </Label>
        <Textarea id="task-note" rows={3} value={taskNote} onChange={(e) => setTaskNote(e.target.value)} />
      </div>

      <section id="subtasks">
        <h2 className="text-heading">{dict.subtasks}</h2>
        <p className="mt-1 text-sm text-text/55">{dict.subtasksFromPlace}</p>
        {errors.has('items') && (
          <p className="mt-1 text-caption text-magenta">{dict.needAtLeastOneSubtask}</p>
        )}
        <div className="mt-4">
          <SubtaskEditor items={items} onChange={setItems} dict={dict} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} onClick={submit}>
          {pending ? dict.loading : dict.create}
        </Button>
        <Button variant="ghost" onClick={() => router.push('/assignments')}>
          {dict.cancel}
        </Button>
      </div>
    </div>
  );
}
