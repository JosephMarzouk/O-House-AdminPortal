'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { replacePlaceQr, savePlace } from '@/lib/actions/places';
import { PrinterIcon } from '@/components/icons';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SubtaskEditor } from '@/components/subtask-editor';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { TemplateItem } from '@/lib/types/database';
import { errorMessage } from '@/lib/errors';
import type { DepartmentOption } from '@/lib/options';

// Re-exported: the pages that render this form import the option type from
// here, and it now has one definition in lib/options.
export type { DepartmentOption };

export function PlaceForm({
  place,
  departments,
  readOnly = false,
  dict,
  locale,
}: {
  /** Without places.edit: the place as it stands, nothing to change. */
  readOnly?: boolean;
  place?: {
    id: string;
    nameAr: string;
    nameEn: string;
    departmentId: string | null;
    items: TemplateItem[];
    qrRequired: boolean;
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
  const [qrRequired, setQrRequired] = useState(place?.qrRequired ?? false);

  function submit() {
    startTransition(async () => {
      const res = await savePlace({
        id: place?.id,
        nameAr,
        nameEn,
        departmentId: departmentId || null,
        items,
        qrRequired,
      });
      if (res.ok) {
        alert.success(place ? dict.placeSaved : dict.placeCreated);
        router.push('/places');
        router.refresh();
      } else {
        alert.error(errorMessage(dict, res.error));
      }
    });
  }

  /** The old sticker dies the moment this returns, so it asks first. */
  async function replaceQr() {
    if (!place) return;
    const ok = await alert.confirm({
      title: dict.replaceQrConfirm,
      description: dict.replaceQrWarning,
      confirmLabel: dict.replaceQr,
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await replacePlaceQr(place.id);
      if (res.ok) {
        alert.success(dict.qrReplaced);
        router.refresh();
      } else {
        alert.error(errorMessage(dict, res.error));
      }
    });
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="name-ar">{dict.placeNameAr}</Label>
          <Input
            id="name-ar"
            disabled={readOnly}
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="name-en">{dict.placeNameEn}</Label>
          <Input
            id="name-en"
            dir="ltr"
            disabled={readOnly}
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dept">{dict.department}</Label>
          <Select
            id="dept"
            disabled={readOnly}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">{dict.allDepartments}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {bilingual(locale, d.nameAr, d.nameEn)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* QR-locked places. Copied onto each checklist when it is created, so
          switching it never locks (or frees) one already handed out. */}
      <section className="space-y-2">
        <label className="flex min-h-control items-center gap-2 text-sm">
          <Checkbox
            checked={qrRequired}
            disabled={readOnly}
            onCheckedChange={(v) => setQrRequired(v === true)}
          />
          {dict.qrRequired}
        </label>
        <p className="text-caption text-text/55">{dict.qrRequiredHint}</p>
        {place && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={`/places/${place.id}/qr`} />}>
              <PrinterIcon />
              {dict.printQr}
            </Button>
            <span title={readOnly ? dict.noPermission : undefined} className="inline-flex">
              <Button variant="outline" disabled={pending || readOnly} onClick={replaceQr}>
                {dict.replaceQr}
              </Button>
            </span>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-heading">{dict.defaultSubtasks}</h2>
        {/* These seed every new assignment for this place; editing them
            changes future assignments only. Existing assignment_items rows
            are copies and are never rewritten. */}
        <p className="mt-1 text-sm text-text/55">{dict.subtasksFromPlace}</p>
        <div className="mt-4">
          <SubtaskEditor items={items} onChange={setItems} dict={dict} disabled={readOnly} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <span title={readOnly ? dict.noPermission : undefined} className="inline-flex">
          <Button disabled={pending || readOnly} onClick={submit}>
            {pending ? dict.loading : dict.save}
          </Button>
        </span>
        <Button variant="ghost" onClick={() => router.push('/places')}>
          {dict.cancel}
        </Button>
      </div>
    </div>
  );
}
