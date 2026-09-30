'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { approveAssignment } from '@/lib/actions/assignments';
import { Button } from '@/components/ui/button';
import { ExtendDialog, RejectItemsDialog } from '@/components/assignments/review-dialogs';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import type { AssignmentItem, EffectiveStatus } from '@/lib/types/database';
import { errorMessage } from '@/lib/errors';
import { NoPermission } from '@/components/no-permission';

/**
 * The review actions as a floating bar — paper, 20px radius, the mid shadow —
 * that sticks to the bottom of the viewport while the checklist scrolls
 * underneath it, the way the app's bottom bar does.
 *
 * The reject and extend forms live in review-dialogs.tsx, shared with the
 * tracker board.
 */
export function ReviewBar({
  assignmentId,
  status,
  items,
  mayReview,
  mayExtend,
  dict,
  locale,
}: {
  assignmentId: string;
  status: EffectiveStatus | null;
  items: AssignmentItem[];
  /** review.edit: approve and reject. Without it they show, greyed out. */
  mayReview: boolean;
  /** checklists.edit: more time. */
  mayExtend: boolean;
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  // approve_assignment only accepts a row already in 'submitted'; extend
  // refuses anything submitted or approved — and, since 0013, a follow-up,
  // which never expires and so has no deadline to move. Mirror all of that so
  // the buttons never promise something the database will silently decline.
  const canReview = status === 'submitted';
  const canExtend = status !== 'submitted' && status !== 'approved' && status !== 'follow_up';
  // Greyed for want of a permission: a title on the wrapper (a disabled
  // button takes no pointer events) and one note for the bar.
  const denied = (canReview && !mayReview) || (canExtend && !mayExtend);
  const deniedTitle = (may: boolean) => (may ? undefined : dict.noPermission);

  function done() {
    alert.success(dict.saved);
    router.refresh();
  }

  function approve() {
    startTransition(async () => {
      const res = await approveAssignment(assignmentId);
      if (res.ok) done();
      else alert.error(errorMessage(dict, res.error));
    });
  }

  if (!canReview && !canExtend) return null;

  return (
    <div className="sticky bottom-6 flex flex-wrap items-center gap-2 rounded-tile bg-raised p-4 shadow-md shadow-(color:--color-shade)">
      {canReview && (
        <>
          <span title={deniedTitle(mayReview)} className="inline-flex gap-2">
            <Button disabled={pending || !mayReview} onClick={approve}>
              {dict.approve}
            </Button>
            <Button
              variant="outline"
              disabled={pending || !mayReview}
              onClick={() => setRejectOpen(true)}
            >
              {dict.reject}
            </Button>
          </span>
          <RejectItemsDialog
            assignmentId={assignmentId}
            items={items}
            open={rejectOpen}
            onOpenChange={setRejectOpen}
            onDone={done}
            dict={dict}
            locale={locale}
          />
        </>
      )}

      {canExtend && (
        <>
          <span title={deniedTitle(mayExtend)} className="inline-flex">
            <Button
              variant="outline"
              disabled={pending || !mayExtend}
              onClick={() => setExtendOpen(true)}
            >
              {dict.extend}
            </Button>
          </span>
          <ExtendDialog
            assignmentId={assignmentId}
            open={extendOpen}
            onOpenChange={setExtendOpen}
            onDone={done}
            dict={dict}
          />
        </>
      )}

      {denied && <NoPermission dict={dict} />}
    </div>
  );
}
