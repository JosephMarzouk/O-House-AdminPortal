'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { TrashIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { deleteAssignment } from '@/lib/actions/assignments';
import { errorMessage } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * Delete a checklist nobody has submitted (26 Nov): a plain confirm naming
 * what goes (the checklist, the person, the day). The page only offers it
 * while the checklist is unsubmitted; delete_assignment checks again.
 *
 * `denied`: no checklists.delete — greyed out with the "no permission" title,
 * the portal's pattern for a control you can see but not use.
 * `after`: where to go once it is gone ('/assignments' from its own page;
 * omitted, the list just refreshes).
 */
export function DeleteAssignmentButton({
  id,
  summary,
  group,
  denied,
  after,
  iconOnly,
  dict,
}: {
  id: string;
  /** "Morning round · Ali · 26 Nov", pre-formatted by the page. */
  summary: string;
  /** Part of a multi-place task: its other unsubmitted places go too. */
  group?: boolean;
  denied?: boolean;
  after?: string;
  iconOnly?: boolean;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <span title={denied ? dict.noPermission : undefined} className="inline-flex">
      <Button
        variant={iconOnly ? 'ghost' : 'outline'}
        size={iconOnly ? 'icon' : undefined}
        className="text-magenta hover:bg-magenta/10"
        aria-label={dict.deleteChecklist}
        disabled={pending || denied}
        onClick={async () => {
          const ok = await alert.confirm({
            title: dict.deleteChecklistConfirm,
            description: `${summary}${group ? `\n${dict.deleteChecklistGroup}` : ''}`,
            confirmLabel: dict.deleteChecklist,
            destructive: true,
          });
          if (!ok) return;
          startTransition(async () => {
            const res = await deleteAssignment(id);
            if (!res.ok) {
              alert.error(errorMessage(dict, res.error));
              return;
            }
            alert.success(dict.checklistDeleted);
            if (after) router.push(after);
            else router.refresh();
          });
        }}
      >
        <TrashIcon />
        {!iconOnly && dict.deleteChecklist}
      </Button>
    </span>
  );
}
