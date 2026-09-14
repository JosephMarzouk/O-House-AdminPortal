'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TrashIcon } from '@/components/icons';
import { deletePlace } from '@/lib/actions/places';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { errorMessage } from '@/lib/errors';

/** Ghost in the row so the table stays quiet; the magenta text is the
 *  destructive marker, and confirm() is the gate. */
export function DeletePlaceButton({ id, dict }: { id: string; dict: Dictionary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-magenta hover:bg-magenta/10"
      aria-label={dict.remove}
      disabled={pending}
      onClick={() => {
        if (!confirm(dict.confirmDelete)) return;
        startTransition(async () => {
          const res = await deletePlace(id);
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
