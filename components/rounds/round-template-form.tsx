'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { saveRoundTemplate } from '@/lib/actions/rounds';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { fmtNum } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { RoundPlace } from '@/lib/types/database';
import type { RoundPlaceOption } from '@/lib/round-options';

type Row = RoundPlace & { key: string };
type RowError = 'place' | 'window' | 'duplicate';

/**
 * A round template: its name, and the places it walks through in order, each
 * with its own window. The sub-items are each place's own checklist, edited on
 * the Places screen — this form only says which places, in which order, when.
 *
 * Rows carry a client-only key because they reorder: an index key would hand
 * one row's half-typed time to its neighbour on every move.
 */
export function RoundTemplateForm({
  round,
  places,
  dict,
  locale,
}: {
  round?: { id: string; titleAr: string; titleEn: string; active: boolean; places: RoundPlace[] };
  places: RoundPlaceOption[];
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [titleAr, setTitleAr] = useState(round?.titleAr ?? '');
  const [titleEn, setTitleEn] = useState(round?.titleEn ?? '');
  const [active, setActive] = useState(round?.active ?? true);
  const [rows, setRows] = useState<Row[]>(
    (round?.places ?? []).map((p) => ({ ...p, key: crypto.randomUUID() })),
  );
  const [titleError, setTitleError] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, RowError>>({});

  const placeById = new Map(places.map((p) => [p.id, p]));

  function patch(key: string, p: Partial<RoundPlace>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  function move(index: number, by: -1 | 1) {
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });
  }

  function addRow() {
    // A new row starts where the last one ended — the usual shape of a round
    // is one place after another — so most rows need only their end time.
    const last = rows.at(-1);
    setRows((rs) => [
      ...rs,
      {
        key: crypto.randomUUID(),
        template_id: '',
        window_start: last?.window_end ?? '',
        window_end: '',
      },
    ]);
  }

  /** The same rules roundPlaces() applies on the server, named per row so the
   *  admin sees which one is wrong instead of a row silently disappearing. */
  function validate(): Record<string, RowError> {
    const bad: Record<string, RowError> = {};
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.template_id) bad[r.key] = 'place';
      else if (!r.window_start || !r.window_end || r.window_start === r.window_end) bad[r.key] = 'window';
      else if (seen.has(r.template_id)) bad[r.key] = 'duplicate';
      seen.add(r.template_id);
    }
    return bad;
  }

  function submit() {
    const badRows = validate();
    const noTitle = !titleAr.trim() && !titleEn.trim();
    setRowErrors(badRows);
    setTitleError(noTitle);
    if (noTitle || Object.keys(badRows).length > 0) {
      alert.error(dict.fieldsRequired);
      return;
    }
    if (rows.length === 0) {
      alert.error(dict.needAtLeastOnePlace);
      return;
    }

    startTransition(async () => {
      const res = await saveRoundTemplate({
        id: round?.id,
        titleAr,
        titleEn,
        active,
        places: rows.map(({ template_id, window_start, window_end }) => ({
          template_id,
          window_start,
          window_end,
        })),
      });
      if (res.ok) {
        alert.success(round ? dict.roundSaved : dict.roundCreated);
        router.push('/rounds');
        router.refresh();
      } else {
        alert.error(errorMessage(dict, res.error));
      }
    });
  }

  const rowErrorText: Record<RowError, string> = {
    place: dict.selectPlace,
    window: dict.windowInvalid,
    duplicate: dict.duplicatePlace,
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="round-title-ar">{dict.roundTitleAr}</Label>
          <Input
            id="round-title-ar"
            aria-invalid={titleError || undefined}
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="round-title-en">{dict.roundTitleEn}</Label>
          <Input
            id="round-title-en"
            dir="ltr"
            aria-invalid={titleError || undefined}
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </div>
        <label className="flex min-h-control items-center gap-2 text-sm">
          <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
          {dict.roundActive}
          <span className="text-caption text-text/55">— {dict.roundActiveHint}</span>
        </label>
      </div>

      <section>
        <h2 className="text-heading">{dict.roundPlaces}</h2>
        <p className="mt-1 text-sm text-text/55">{dict.roundPlacesHint}</p>

        <ol className="mt-4 space-y-2">
          {rows.length === 0 && <li className="text-sm text-text/55">{dict.noData}</li>}
          {rows.map((r, i) => {
            const place = placeById.get(r.template_id);
            const err = rowErrors[r.key];
            return (
              <li key={r.key}>
                <Card className="grid items-center gap-2 sm:grid-cols-[auto_1fr_auto_auto_auto]">
                  <span className="text-lg tabular-nums text-text/55">{fmtNum(i + 1, locale)}</span>

                  <Select
                    compact
                    aria-label={dict.place}
                    aria-invalid={err === 'place' || err === 'duplicate' || undefined}
                    value={r.template_id}
                    onChange={(e) => patch(r.key, { template_id: e.target.value })}
                  >
                    <option value="">{dict.selectPlace}</option>
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>
                        {bilingual(locale, p.nameAr, p.nameEn)}
                      </option>
                    ))}
                  </Select>

                  <div className="flex items-center gap-2" dir="ltr">
                    <Input
                      compact
                      type="time"
                      className="w-32"
                      aria-label={dict.windowStart}
                      aria-invalid={err === 'window' || undefined}
                      value={r.window_start}
                      onChange={(e) => patch(r.key, { window_start: e.target.value })}
                    />
                    <span className="text-text/55">–</span>
                    <Input
                      compact
                      type="time"
                      className="w-32"
                      aria-label={dict.windowEnd}
                      aria-invalid={err === 'window' || undefined}
                      value={r.window_end}
                      onChange={(e) => patch(r.key, { window_end: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={dict.moveUp}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={dict.moveDown}
                      disabled={i === rows.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={dict.remove}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    <XIcon />
                  </Button>

                  {(err || place) && (
                    <div className="flex flex-wrap items-center gap-x-3 text-caption sm:col-span-full">
                      {err && <span className="text-magenta">{rowErrorText[err]}</span>}
                      {place && (
                        <>
                          <span className={place.schedulable ? 'text-text/55' : 'text-magenta'}>
                            {place.schedulable
                              ? dict.placeSubtaskCount.replace('{n}', fmtNum(place.itemCount, locale))
                              : dict.placeNotSchedulable}
                          </span>
                          <Link
                            href={`/places/${place.id}`}
                            className="inline-flex min-h-control items-center text-cyan-dark hover:underline"
                          >
                            {dict.editSubtasks}
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>

        <Button type="button" variant="outline" className="mt-3" onClick={addRow}>
          <PlusIcon />
          {dict.addPlace}
        </Button>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} onClick={submit}>
          {pending ? dict.loading : dict.save}
        </Button>
        <Button variant="ghost" onClick={() => router.push('/rounds')}>
          {dict.cancel}
        </Button>
      </div>
    </div>
  );
}
