'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteUser, deleteUserPreview, type DeleteUserPreview } from '@/lib/actions/users';
import { errorMessage } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * Deleting a person (26 Nov, the built-in Admin only). It locks someone out,
 * so first the dialog says what goes with them (delete_user_preview: their
 * unsubmitted checklists, shared ones they leave, future planner rounds, the
 * people who report to them), then the admin types the name to confirm. The
 * database compares the name again (NAME_MISMATCH).
 */
export function DeleteUserDialog({
  user,
  onClose,
  dict,
}: {
  user: { id: string; name: string } | null;
  onClose: () => void;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<DeleteUserPreview | null>(null);
  const [typed, setTyped] = useState('');

  // The parent keys this component by the person, so the preview and the
  // typed name start empty for each one; this only loads the preview.
  useEffect(() => {
    if (!user) return;
    let live = true;
    deleteUserPreview(user.id).then((res) => {
      if (!live) return;
      if (res.ok) setPreview(res.preview);
      else {
        alert.error(errorMessage(dict, res.error));
        onClose();
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the person changes
  }, [user?.id]);

  const matches = !!user && typed.trim().toLowerCase() === user.name.trim().toLowerCase();
  const lines = preview
    ? [
        preview.checklists > 0 && dict.deleteUserChecklists.replace('{n}', String(preview.checklists)),
        preview.shared > 0 && dict.deleteUserShared.replace('{n}', String(preview.shared)),
        preview.rounds > 0 && dict.deleteUserRounds.replace('{n}', String(preview.rounds)),
        preview.reports > 0 && dict.deleteUserReports.replace('{n}', String(preview.reports)),
      ].filter((l): l is string => !!l)
    : [];

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={dict.cancel}>
        {user && (
          <>
            <DialogHeader>
              <DialogTitle>{dict.deleteUserTitle.replace('{name}', user.name || dict.none)}</DialogTitle>
              <DialogDescription>{dict.deleteUserHint}</DialogDescription>
            </DialogHeader>

            {!preview ? (
              <p className="text-sm text-text/55">{dict.loading}</p>
            ) : (
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {(lines.length ? lines : [dict.deleteUserNothing]).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}

            <div className="space-y-1">
              <Label htmlFor="delete-user-name">{dict.deleteUserType.replace('{name}', user.name)}</Label>
              <Input id="delete-user-name" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </div>

            <DialogFooter>
              <Button variant="ghost" disabled={pending} onClick={onClose}>
                {dict.cancel}
              </Button>
              <Button
                variant="destructive"
                size="md"
                disabled={pending || !preview || !matches}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteUser(user.id, typed);
                    if (!res.ok) {
                      alert.error(errorMessage(dict, res.error));
                      return;
                    }
                    alert.success(dict.userDeleted);
                    onClose();
                    router.refresh();
                  })
                }
              >
                {dict.deleteUser}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
