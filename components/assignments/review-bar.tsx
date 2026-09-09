'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { approveAssignment, rejectItems, extendAssignment } from '@/lib/actions/assignments';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { AssignmentItem, EffectiveStatus } from '@/lib/types/database';

/** Server actions return short codes; turn them into the user's language. */
function message(dict: Dictionary, code: string): string {
  const map: Record<string, string> = {
    not_authorized: dict.notAuthorized,
    reason_required: dict.reasonRequired,
    no_items_selected: dict.noItemsSelected,
    not_in_submitted_state: dict.notInSubmittedState,
    already_closed: dict.alreadyClosed,
    deadline_must_be_future: dict.deadlineMustBeFuture,
  };
  return map[code] ?? dict.errorGeneric;
}

export function ReviewBar({
  assignmentId,
  status,
  items,
  dict,
  locale,
}: {
  assignmentId: string;
  status: EffectiveStatus | null;
  items: AssignmentItem[];
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');

  const [extendOpen, setExtendOpen] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [extNote, setExtNote] = useState('');

  // approve_assignment only accepts a row already in 'submitted'; extend
  // refuses anything submitted or approved. Mirror both so the buttons never
  // promise something the database will silently decline.
  const canReview = status === 'submitted';
  const canExtend = status !== 'submitted' && status !== 'approved';

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(dict.saved);
        done?.();
        router.refresh();
      } else {
        toast.error(message(dict, res.error));
      }
    });
  }

  if (!canReview && !canExtend) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
      {canReview && (
        <>
          <Button disabled={pending} onClick={() => run(() => approveAssignment(assignmentId))}>
            {dict.approve}
          </Button>

          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger render={<Button variant="outline" disabled={pending} />}>
              {dict.reject}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{dict.selectItemsToReject}</DialogTitle>
              </DialogHeader>

              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <Checkbox
                      id={`rej-${item.id}`}
                      checked={selected.has(item.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        })
                      }
                    />
                    <Label htmlFor={`rej-${item.id}`} className="font-normal leading-snug">
                      {bilingual(locale, item.text_ar, item.text_en) || '—'}
                    </Label>
                  </li>
                ))}
              </ul>

              <div className="space-y-1.5">
                <Label htmlFor="reject-reason">{dict.rejectReason}</Label>
                <Textarea
                  id="reject-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setRejectOpen(false)}>
                  {dict.cancel}
                </Button>
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(() => rejectItems(assignmentId, [...selected], reason), () => {
                      setRejectOpen(false);
                      setSelected(new Set());
                      setReason('');
                    })
                  }
                >
                  {dict.reject}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {canExtend && (
        <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
          <DialogTrigger render={<Button variant="outline" disabled={pending} />}>
            {dict.extend}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.extend}</DialogTitle>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="new-deadline">{dict.newDeadline}</Label>
              <Input
                id="new-deadline"
                type="datetime-local"
                dir="ltr"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-note">
                {dict.extensionNote} <span className="text-muted-foreground">({dict.optional})</span>
              </Label>
              <Textarea
                id="ext-note"
                rows={2}
                value={extNote}
                onChange={(e) => setExtNote(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setExtendOpen(false)}>
                {dict.cancel}
              </Button>
              <Button
                disabled={pending || !deadline}
                onClick={() =>
                  run(
                    // datetime-local has no zone; the browser reads it as local
                    // time, which for a Cairo-based club is the intended one.
                    () => extendAssignment(assignmentId, new Date(deadline).toISOString(), extNote),
                    () => {
                      setExtendOpen(false);
                      setDeadline('');
                      setExtNote('');
                    },
                  )
                }
              >
                {dict.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
