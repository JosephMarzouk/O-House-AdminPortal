'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { savePlace } from '@/lib/actions/places';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SubtaskEditor } from '@/components/subtask-editor';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { TemplateItem } from '@/lib/types/database';
import { errorMessage } from '@/lib/errors';

export type DepartmentOption = { id: string; nameAr: string; nameEn: string };

export function PlaceForm({
  place,
  departments,
  dict,
  locale,
}: {
  place?: {
    id: string;
    nameAr: string;
    nameEn: string;
    departmentId: string | null;
    items: TemplateItem[];
  };
  departments: DepartmentOption[];
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nameAr, setNameAr] = useState(place?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(place?.nameEn ?? '');
  const [departmentId, setDepartmentId] = useState(place?.departmentId ?? '');
  const [items, setItems] = useState<TemplateItem[]>(place?.items ?? []);

  function submit() {
    startTransition(async () => {
      const res = await savePlace({
        id: place?.id,
        nameAr,
        nameEn,
        departmentId: departmentId || null,
        items,
      });
      if (res.ok) {
        toast.success(place ? dict.placeSaved : dict.placeCreated);
        router.push('/places');
        router.refresh();
      } else {
        toast.error(errorMessage(dict, res.error));
      }
    });
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="name-ar">{dict.placeNameAr}</Label>
          <Input id="name-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="name-en">{dict.placeNameEn}</Label>
          <Input
            id="name-en"
            dir="ltr"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dept">{dict.department}</Label>
          <Select id="dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">{dict.allDepartments}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {bilingual(locale, d.nameAr, d.nameEn)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <section>
        <h2 className="text-heading">{dict.defaultSubtasks}</h2>
        {/* These seed every new assignment for this place; editing them
            changes future assignments only. Existing assignment_items rows
            are copies and are never rewritten. */}
        <p className="mt-1 text-sm text-text/55">{dict.subtasksFromPlace}</p>
        <div className="mt-4">
          <SubtaskEditor items={items} onChange={setItems} dict={dict} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} onClick={submit}>
          {pending ? dict.loading : dict.save}
        </Button>
        <Button variant="ghost" onClick={() => router.push('/places')}>
          {dict.cancel}
        </Button>
      </div>
    </div>
  );
}
