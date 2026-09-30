'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { TrashIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import type { ActionResult } from '@/lib/actions/result';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * The destructive row control: ghost so the table stays quiet, magenta text as
 * the destructive marker, a confirmation dialog as the gate.
 *
 * Places and departments had this twice, character for character, and the
 * copies had already started to drift on how they reported a failure. The
 * caller supplies only the action, because that is the sole difference.
 *
 * The gate used to be the browser's own confirm(). It is the portal's dialog
 * now — the same one the password reset uses — so that every irreversible
 * click in the portal is stopped by the same thing, in the right typeface and
 * the right reading direction.
 */
export function ConfirmDeleteButton({
  dict,
  onDelete,
  label,
  denied,
}: {
  dict: Dictionary;
  onDelete: () => Promise<ActionResult>;
  label?: string;
  /** No delete permission: greyed out, titled "no permission" (on a wrapper,
   *  since a disabled button takes no pointer events). */
  denied?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <span title={denied ? dict.noPermission : undefined} className="inline-flex">
      <Button
        variant="ghost"
        size="icon"
        className="text-magenta hover:bg-magenta/10"
        aria-label={label ?? dict.remove}
        disabled={pending || denied}
        // async, and the transition starts only once the promise has settled:
        // starting it around the await would let React tear the pending state
        // down while the dialog is still open.
        onClick={async () => {
          const ok = await alert.confirm({
            title: dict.confirmDelete,
            confirmLabel: dict.remove,
            destructive: true,
          });
          if (!ok) return;
          startTransition(async () => {
            const res = await onDelete();
            if (res.ok) {
              alert.success(dict.saved);
              router.refresh();
            } else {
              alert.error(errorMessage(dict, res.error));
            }
          });
        }}
      >
        <TrashIcon />
      </Button>
    </span>
  );
}
