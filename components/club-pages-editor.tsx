'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveClubPage } from '@/lib/actions/club-pages';
import { errorMessage } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ClubPageKey } from '@/lib/types/database';

/** One page (About or Policies): its English and Arabic text, saved together. */
export function ClubPagesEditor({
  dict,
  pageKey,
  bodyEn,
  bodyAr,
  readOnly,
}: {
  dict: Dictionary;
  pageKey: ClubPageKey;
  bodyEn: string;
  bodyAr: string;
  /** Without club_settings.edit: the text, but no way to change it. */
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [en, setEn] = useState(bodyEn);
  const [ar, setAr] = useState(bodyAr);
  const dirty = en !== bodyEn || ar !== bodyAr;
  const title = pageKey === 'about' ? dict.clubPageAbout : dict.clubPagePolicies;

  return (
    <Card className="max-w-3xl space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await saveClubPage(pageKey, en, ar);
            if (res.ok) {
              alert.success(dict.saved);
              // The database trims; match it so the form isn't left "dirty".
              setEn(en.trim());
              setAr(ar.trim());
              router.refresh();
            } else {
              alert.error(errorMessage(dict, res.error));
            }
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor={`${pageKey}-en`}>{dict.clubPageEn}</Label>
          <Textarea
            id={`${pageKey}-en`}
            dir="ltr"
            rows={6}
            maxLength={20000}
            readOnly={readOnly}
            value={en}
            onChange={(e) => setEn(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${pageKey}-ar`}>{dict.clubPageAr}</Label>
          <Textarea
            id={`${pageKey}-ar`}
            dir="rtl"
            rows={6}
            maxLength={20000}
            readOnly={readOnly}
            value={ar}
            onChange={(e) => setAr(e.target.value)}
          />
        </div>
        {/* Greyed rather than hidden; the page carries the "view only" note. */}
        <span title={readOnly ? dict.noPermission : undefined} className="inline-flex">
          <Button type="submit" disabled={pending || !dirty || readOnly}>
            {dict.save}
          </Button>
        </span>
      </form>
    </Card>
  );
}
