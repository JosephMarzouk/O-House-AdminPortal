'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createAssignment } from '@/lib/actions/assignments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubtaskEditor, SELECT_CLASS } from '@/components/subtask-editor';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { TemplateItem } from '@/lib/types/database';

export type PlaceOption = {
  id: string;
  siteId: string | null;
  nameAr: string;
  nameEn: string;
  items: TemplateItem[];
};

export type StaffOption = { id: string; name: string };

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

  function submit() {
    // create_assignment requires p_site_id, and the phone reads the place name
    // from the sites row it copies across — a place with no twin cannot be used.
    if (!place?.siteId) {
      toast.error(dict.fieldsRequired);
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
        items: items.map(({ text_ar, text_en, type, critical, requires_photo }) => ({
          text_ar,
          text_en,
          type,
          critical,
          requires_photo,
        })),
      });

      if (res.ok) {
        toast.success(dict.assignmentCreated);
        router.push(`/assignments/${res.id}`);
        router.refresh();
        return;
      }
      toast.error(
        res.error === 'fields_required'
          ? dict.fieldsRequired
          : res.error === 'need_at_least_one_subtask'
            ? dict.needAtLeastOneSubtask
            : res.error === 'not_authorized'
              ? dict.notAuthorized
              : dict.errorGeneric,
      );
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="place">{dict.place}</Label>
          <select
            id="place"
            className={SELECT_CLASS}
            value={placeId}
            onChange={(e) => onPlaceChange(e.target.value)}
          >
            <option value="">{dict.selectPlace}</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {bilingual(locale, p.nameAr, p.nameEn)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assignee">{dict.assignee}</Label>
          <select
            id="assignee"
            className={SELECT_CLASS}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">{dict.selectAssignee}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title-ar">{dict.assignmentTitleAr}</Label>
          <Input id="title-ar" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title-en">{dict.assignmentTitleEn}</Label>
          <Input
            id="title-en"
            dir="ltr"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date">{dict.scheduledDate}</Label>
          <Input
            id="date"
            type="date"
            dir="ltr"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="from">{dict.windowStart}</Label>
            <Input
              id="from"
              type="time"
              dir="ltr"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">{dict.windowEnd}</Label>
            <Input
              id="to"
              type="time"
              dir="ltr"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="section-label">{dict.subtasks}</h2>
          <p className="text-sm text-muted-foreground">{dict.subtasksFromPlace}</p>
        </div>
        <SubtaskEditor items={items} onChange={setItems} dict={dict} />
      </section>

      <div className="flex gap-2 border-t pt-4">
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
