'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { deletePlace } from '@/lib/actions/places';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export function DeletePlaceButton({ id, dict }: { id: string; dict: Dictionary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
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
            toast.error(res.error);
          }
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
