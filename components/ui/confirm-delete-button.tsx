'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TrashIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import type { ActionResult } from '@/lib/actions/result';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * The destructive row control: ghost so the table stays quiet, magenta text as
 * the destructive marker, confirm() as the gate.
 *
 * Places and departments had this twice, character for character, and the
 * copies had already started to drift on how they reported a failure. The
 * caller supplies only the action, because that is the sole difference.
 *
 * confirm() rather than the Dialog primitive: it is one irreversible click on
 * a table row, the browser's own dialog cannot be missed or mis-focused, and
 * a themed modal here would buy nothing the native one does not already do.
 */
export function ConfirmDeleteButton({
  dict,
  onDelete,
  label,
}: {
  dict: Dictionary;
  onDelete: () => Promise<ActionResult>;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-magenta hover:bg-magenta/10"
      aria-label={label ?? dict.remove}
      disabled={pending}
      onClick={() => {
        if (!confirm(dict.confirmDelete)) return;
        startTransition(async () => {
          const res = await onDelete();
          if (res.ok) {
            toast.success(dict.saved);
            router.refresh();
          } else {
            toast.error(errorMessage(dict, res.error));
          }
        });
      }}
    >
      <TrashIcon />
    </Button>
  );
}
