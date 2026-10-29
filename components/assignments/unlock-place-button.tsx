'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { unlockPlace } from '@/lib/actions/assignments';
import { Button } from '@/components/ui/button';
import { NoPermission } from '@/components/no-permission';
import { errorMessage } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * "Unlock place": a supervisor opens a QR-locked checklist whose sticker is
 * missing or damaged. Logged under their name (unlock_place), so it asks
 * first. Without assignments.unlock_place: the same button, greyed, with the
 * red note, like every other denied control.
 */
export function UnlockPlaceButton({
  assignmentId,
  may,
  dict,
}: {
  assignmentId: string;
  may: boolean;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function unlock() {
    const ok = await alert.confirm({
      title: dict.unlockPlaceConfirm,
      description: dict.unlockPlaceHint,
      confirmLabel: dict.unlockPlace,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await unlockPlace(assignmentId);
      if (res.ok) {
        alert.success(dict.placeUnlocked);
        router.refresh();
      } else {
        alert.error(errorMessage(dict, res.error));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span title={may ? undefined : dict.noPermission} className="inline-flex">
        <Button variant="outline" disabled={pending || !may} onClick={unlock}>
          {dict.unlockPlace}
        </Button>
      </span>
      {!may && <NoPermission dict={dict} />}
    </div>
  );
}
