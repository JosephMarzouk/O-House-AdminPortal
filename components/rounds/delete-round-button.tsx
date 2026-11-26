'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { TrashIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { deleteRoundTemplate } from '@/lib/actions/rounds';
import { errorMessage } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * Delete a round (26 Nov), with planner.delete: a plain confirm naming it. Its
 * untouched checklists from today on go too; past ones and anything already
 * started stay. `denied`: greyed out with the "no permission" title.
 */
export function DeleteRoundButton({
  id,
  name,
  denied,
  dict,
}: {
  id: string;
  name: string;
  denied?: boolean;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <span title={denied ? dict.noPermission : undefined} className="inline-flex">
      <Button
        variant="ghost"
        size="icon"
        className="text-magenta hover:bg-magenta/10"
        aria-label={dict.deleteRound}
        disabled={pending || denied}
        onClick={async () => {
          const ok = await alert.confirm({
            title: dict.deleteRoundConfirm.replace('{name}', name),
            description: dict.deleteRoundHint,
            confirmLabel: dict.deleteRound,
            destructive: true,
          });
          if (!ok) return;
          startTransition(async () => {
            const res = await deleteRoundTemplate(id);
            if (!res.ok) {
              alert.error(errorMessage(dict, res.error));
              return;
            }
            alert.success(dict.roundDeletedCount.replace('{n}', String(res.removed)));
            router.refresh();
          });
        }}
      >
        <TrashIcon />
      </Button>
    </span>
  );
}
