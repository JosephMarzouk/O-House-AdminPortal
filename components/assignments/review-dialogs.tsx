'use client';

import { useState, useTransition } from 'react';
import { alert } from '@/components/ui/alert-dialog';
import { extendAssignment, rejectItems } from '@/lib/actions/assignments';
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
} from '@/components/ui/dialog';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import type { AssignmentItem } from '@/lib/types/database';
import { errorMessage } from '@/lib/errors';

/**
 * The two review dialogs that need a form — send items back, and give more
 * time — shared by the detail page's ReviewBar and the tracker board, where a
 * drag onto In Progress or out of Overdue opens them.
 *
 * Controlled rather than owning their trigger: the review bar opens them from
 * a button, the board from a drop. Each keeps its own form state, calls its
 * action, and reports failure itself; success is left to `onDone`, because the
 * two callers want different things after it (the review bar confirms with an
 * alert, the board just refreshes — the card moving is the confirmation).
 */

type DialogItem = Pick<AssignmentItem, 'id' | 'text_ar' | 'text_en'>;

export function RejectItemsDialog({
  assignmentId,
  items,
  open,
  onOpenChange,
  onDone,
  dict,
  locale,
}: {
  assignmentId: string;
  items: DialogItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  dict: Dictionary;
  locale: Locale;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');

  function submit() {
    startTransition(async () => {
      const res = await rejectItems(assignmentId, [...selected], reason);
      if (!res.ok) {
        alert.error(errorMessage(dict, res.error));
        return;
      }
      setSelected(new Set());
      setReason('');
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={dict.cancel}>
        <DialogHeader>
          <DialogTitle>{dict.selectItemsToReject}</DialogTitle>
        </DialogHeader>

        <ul className="max-h-64 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex min-h-control items-center gap-3">
              <Checkbox
                id={`rej-${assignmentId}-${item.id}`}
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
              <Label htmlFor={`rej-${assignmentId}-${item.id}`} className="text-base text-text">
                {bilingual(locale, item.text_ar, item.text_en) || dict.none}
              </Label>
            </li>
          ))}
        </ul>

        <div className="space-y-1">
          <Label htmlFor={`reject-reason-${assignmentId}`}>{dict.rejectReason}</Label>
          <Textarea
            id={`reject-reason-${assignmentId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {dict.cancel}
          </Button>
          {/* The one destructive button in the portal: rejecting sends
              work back, so it wears magenta. */}
          <Button variant="destructive" disabled={pending || !reason.trim()} onClick={submit}>
            {dict.reject}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExtendDialog({
  assignmentId,
  open,
  onOpenChange,
  onDone,
  dict,
}: {
  assignmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  dict: Dictionary;
}) {
  const [pending, startTransition] = useTransition();
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');

  function submit() {
    startTransition(async () => {
      // datetime-local has no zone; the browser reads it as local time, which
      // for a Cairo-based club is the intended one.
      const res = await extendAssignment(assignmentId, new Date(deadline).toISOString(), note);
      if (!res.ok) {
        alert.error(errorMessage(dict, res.error));
        return;
      }
      setDeadline('');
      setNote('');
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={dict.cancel}>
        <DialogHeader>
          <DialogTitle>{dict.extend}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor={`new-deadline-${assignmentId}`}>{dict.newDeadline}</Label>
          <Input
            id={`new-deadline-${assignmentId}`}
            type="datetime-local"
            dir="ltr"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ext-note-${assignmentId}`}>
            {dict.extensionNote} <span className="text-text/55">({dict.optional})</span>
          </Label>
          <Textarea
            id={`ext-note-${assignmentId}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {dict.cancel}
          </Button>
          <Button disabled={pending || !deadline} onClick={submit}>
            {dict.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
