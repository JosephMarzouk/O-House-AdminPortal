'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { createAssignment, createTaskGroup } from '@/lib/actions/assignments';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AssigneePicker } from '@/components/assignee-picker';
import { SubtaskEditor } from '@/components/subtask-editor';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { TemplateItem } from '@/lib/types/database';
import { errorMessage } from '@/lib/errors';
import { fmtNum } from '@/lib/format';
import { placeWindowOverlaps } from '@/lib/rounds';

export type PlaceOption = {
  id: string;
  siteId: string | null;
  nameAr: string;
  nameEn: string;
  items: TemplateItem[];
};

export type StaffOption = { id: string; name: string };

type FieldKey = 'place' | 'assignee' | 'title' | 'titleEn' | 'date' | 'endDate' | 'from' | 'to' | 'items';

/**
 * One place of the task, in walk order. The window is that place's own and
 * optional (several places only): blank means the task's From–To. The key is
 * client-only, because rows reorder (see round-template-form.tsx).
 */
type PlaceRow = { key: string; templateId: string; windowStart: string; windowEnd: string };
type RowError = 'place' | 'overlap' | 'window' | 'not_ready';

const newRow = (): PlaceRow => ({ key: crypto.randomUUID(), templateId: '', windowStart: '', windowEnd: '' });

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

  // One row: exactly the single-place form it always was (create_assignment,
  // subtasks editable). Two or more: a multi-place task (create_task_group),
  // each place with its own subtasks from the Places screen.
  const [rows, setRows] = useState<PlaceRow[]>(() => [newRow()]);
  // Which place the subtask list below was seeded from.
  const [seededFrom, setSeededFrom] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<string, RowError>>({});
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [date, setDate] = useState('');
  // Off: a one-day task, the end date is the start date. On: pick the last day.
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [taskNote, setTaskNote] = useState('');
  const [errors, setErrors] = useState<Set<FieldKey>>(new Set());

  const multi = rows.length > 1;
  const placeId = rows[0].templateId;
  const place = places.find((p) => p.id === placeId);
  const placeById = new Map(places.map((p) => [p.id, p]));

  /** Choosing a place seeds the title and its default subtasks. A starting
   *  point, not a constraint — everything below stays editable. Only with one
   *  place: that is the one form whose subtasks are edited here. */
  function seed(id: string) {
    const p = places.find((x) => x.id === id);
    if (!p) return;
    setSeededFrom(id);
    setItems(p.items.map((i) => ({ ...i })));
    if (!titleAr) setTitleAr(p.nameAr);
    if (!titleEn) setTitleEn(p.nameEn);
  }

  /** Every change to the places goes through here. Back down to one place
   *  (after a remove), the subtasks must be that place's, not a neighbour's. */
  function changeRows(next: PlaceRow[]) {
    setRows(next);
    if (next.length !== 1) return;
    // Cleared: picking a place again reseeds, as it always did.
    if (!next[0].templateId) setSeededFrom('');
    else if (next[0].templateId !== seededFrom) seed(next[0].templateId);
  }

  function patchRow(key: string, p: Partial<PlaceRow>) {
    changeRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  function moveRow(index: number, by: -1 | 1) {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    changeRows(next);
  }

  /** The window a row is sent with: its own, else the task's From–To. */
  const windowOf = (r: PlaceRow) =>
    r.windowStart && r.windowEnd
      ? { window_start: r.windowStart, window_end: r.windowEnd }
      : { window_start: from, window_end: to };

  /** Several places: each row's own rules, named per row. */
  function validateRows(): Record<string, RowError> {
    const bad: Record<string, RowError> = {};
    if (!multi) return bad;
    // A place may repeat, each time in its own period: compare the windows
    // each row will really get (its own, else the task's From–To).
    const overlapping = placeWindowOverlaps(rows.map((r) => ({ template_id: r.templateId, ...windowOf(r) })));
    rows.forEach((r, i) => {
      const p = placeById.get(r.templateId);
      const own = r.windowStart || r.windowEnd;
      if (!p) bad[r.key] = 'place';
      // create_task_group copies the place's own subtasks: none would be a
      // 0/0 checklist the phone can never submit.
      else if (!p.siteId || p.items.length === 0) bad[r.key] = 'not_ready';
      else if (own && (!r.windowStart || !r.windowEnd || r.windowStart === r.windowEnd)) bad[r.key] = 'window';
      else if (overlapping.has(i)) bad[r.key] = 'overlap';
    });
    return bad;
  }
  // The task's From–To is every place's window, unless each has its own.
  const needTaskWindow = !multi || rows.some((r) => !r.windowStart || !r.windowEnd);

  /** Names the exact fields that are missing. The old version showed a
   *  generic "fill in the required fields", which left you hunting. */
  function validate(): Set<FieldKey> {
    const bad = new Set<FieldKey>();
    if (!placeId || Object.keys(validateRows()).length > 0) bad.add('place');
    if (assigneeIds.length === 0) bad.add('assignee');
    if (!titleAr.trim() && !titleEn.trim()) bad.add('title');
    // A multi-place task's English title is required (create_task_group: the push shows it).
    else if (multi && !titleEn.trim()) bad.add('titleEn');
    if (!date) bad.add('date');
    // YYYY-MM-DD compares as text. The same day as the start is allowed
    // (the server stores it as a one-day task).
    if (multiDay && (!endDate || (date && endDate < date))) bad.add('endDate');
    if (needTaskWindow && !from) bad.add('from');
    if (needTaskWindow && !to) bad.add('to');
    // create_assignment happily accepts an empty p_items, but an assignment
    // with no subtasks renders 0/0 on the phone with Submit permanently
    // disabled — so it is a dead end, not a valid state.
    // Several places: each brings its own, checked per row instead.
    if (!multi && (items.length === 0 || items.every((i) => !i.text_ar.trim() && !i.text_en.trim()))) {
      bad.add('items');
    }
    return bad;
  }

  const LABELS: Record<FieldKey, string> = {
    place: dict.place,
    assignee: dict.assignee,
    title: dict.assignmentTitleAr,
    titleEn: dict.assignmentTitleEn,
    date: dict.scheduledDate,
    endDate: dict.endDate,
    from: dict.windowStart,
    to: dict.windowEnd,
    items: dict.subtasks,
  };

  function submit() {
    const bad = validate();
    setErrors(bad);
    setRowErrors(validateRows());

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

    if (multi) {
      startTransition(async () => {
        const res = await createTaskGroup({
          // Always a window per place, so create_task_group never guesses one.
          places: rows.map((r) => ({ template_id: r.templateId, ...windowOf(r) })),
          assigneeIds,
          titleAr,
          titleEn,
          scheduledDate: date,
          endDate: multiDay ? endDate : undefined,
          taskNote,
        });
        if (res.ok) {
          alert.success(dict.taskGroupCreated.replace('{n}', fmtNum(rows.length, locale)));
          router.push('/assignments');
          router.refresh();
          return;
        }
        alert.error(errorMessage(dict, res.error));
      });
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
        assigneeIds,
        titleAr,
        titleEn,
        scheduledDate: date,
        endDate: multiDay ? endDate : undefined,
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
  const rowErrorText: Record<RowError, string> = {
    place: dict.selectPlace,
    overlap: dict.placeWindowOverlap,
    window: dict.windowInvalid,
    not_ready: dict.placeNotReady,
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="place">{dict.place}</Label>
          {/* The places in walk order. One row is the form as it always was. */}
          <ol className="space-y-2">
            {rows.map((r, i) => {
              const rowErr = rowErrors[r.key];
              return (
                <li key={r.key} className="space-y-1">
                  <div className="flex items-center gap-1">
                    {multi && <span className="w-6 shrink-0 tabular-nums text-text/55">{fmtNum(i + 1, locale)}</span>}
                    <Select
                      id={i === 0 ? 'place' : undefined}
                      aria-label={i === 0 ? undefined : dict.place}
                      aria-invalid={
                        (multi ? !!rowErr && rowErr !== 'window' && rowErr !== 'overlap' : invalid('place')) || undefined
                      }
                      value={r.templateId}
                      // One place: changeRows seeds the title and subtasks from it.
                      onChange={(e) => patchRow(r.key, { templateId: e.target.value })}
                    >
                      <option value="">{dict.selectPlace}</option>
                      {places.map((p) => (
                        <option key={p.id} value={p.id}>
                          {bilingual(locale, p.nameAr, p.nameEn)}
                        </option>
                      ))}
                    </Select>
                    {multi && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={dict.moveUp}
                          disabled={i === 0}
                          onClick={() => moveRow(i, -1)}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={dict.moveDown}
                          disabled={i === rows.length - 1}
                          onClick={() => moveRow(i, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={dict.remove}
                          onClick={() => changeRows(rows.filter((x) => x.key !== r.key))}
                        >
                          <XIcon />
                        </Button>
                      </>
                    )}
                  </div>
                  {multi && (
                    <div className="flex flex-wrap items-center gap-2 ps-7 text-caption text-text/55">
                      <span>{dict.placeOwnWindow}</span>
                      <span className="flex items-center gap-2" dir="ltr">
                        <Input
                          compact
                          type="time"
                          className="w-32"
                          aria-label={dict.windowStart}
                          aria-invalid={rowErr === 'window' || rowErr === 'overlap' || undefined}
                          value={r.windowStart}
                          onChange={(e) => patchRow(r.key, { windowStart: e.target.value })}
                        />
                        <span>–</span>
                        <Input
                          compact
                          type="time"
                          className="w-32"
                          aria-label={dict.windowEnd}
                          aria-invalid={rowErr === 'window' || rowErr === 'overlap' || undefined}
                          value={r.windowEnd}
                          onChange={(e) => patchRow(r.key, { windowEnd: e.target.value })}
                        />
                      </span>
                    </div>
                  )}
                  {multi && rowErr && <p className="ps-7 text-caption text-magenta">{rowErrorText[rowErr]}</p>}
                </li>
              );
            })}
          </ol>
          {multi ? <p className="text-caption text-text/55">{dict.multiPlaceHint}</p> : err('place')}
          <Button type="button" variant="outline" onClick={() => setRows([...rows, newRow()])}>
            <PlusIcon />
            {dict.addAnotherPlace}
          </Button>
        </div>

        <div className="space-y-1">
          <Label htmlFor="assignee">{dict.assignees}</Label>
          <AssigneePicker
            id="assignee"
            staff={staff}
            value={assigneeIds}
            onChange={setAssigneeIds}
            placeholder={dict.selectAssignee}
            invalid={invalid('assignee')}
          />
          {err('assignee') ??
            (assigneeIds.length > 1 && (
              <p className="text-caption text-text/55">{dict.assigneesHint}</p>
            ))}
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
            aria-invalid={invalid('titleEn')}
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
          {errors.has('titleEn') && <p className="text-caption text-magenta">{dict.titleEnRequired}</p>}
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
          <label className="flex min-h-control items-center gap-2 text-sm">
            <Checkbox checked={multiDay} onCheckedChange={(v) => setMultiDay(v === true)} />
            {dict.multiDay}
          </label>
          {multiDay && (
            <div className="space-y-1">
              <Label htmlFor="endDate">{dict.endDate}</Label>
              <Input
                id="endDate"
                type="date"
                dir="ltr"
                min={date || undefined}
                aria-invalid={invalid('endDate')}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              {err('endDate') ?? <p className="text-caption text-text/55">{dict.multiDayHint}</p>}
            </div>
          )}
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

      {/* Several places: each checklist takes its place's own subtasks
          (create_task_group), so there is nothing to edit here. */}
      {!multi && (
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
      )}

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
