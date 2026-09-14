'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyIcon, PlusIcon } from '@/components/icons';
import {
  setUserRole,
  setUserDepartment,
  setUserManager,
  createStaff,
  resetStaffPassword,
} from '@/lib/actions/users';
import { normalizePhone, phoneToLoginEmail } from '@/lib/phone';
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
import { PasswordInput } from '@/components/ui/password-input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { STAFF_ROLES, type Role, type StaffRole } from '@/lib/types/database';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  departmentId: string | null;
  managerId: string | null;
};

export type Option = { id: string; nameAr: string; nameEn: string };

/** Mirrors MIN_PASSWORD in lib/actions/users.ts. Duplicated rather than
 *  imported because that module is 'use server' and may export nothing but
 *  async functions; the server check is the real one, this only greys out
 *  the button. */
const MIN_PASSWORD = 8;

export function UsersManager({
  users,
  departments,
  dict,
  locale,
  currentUserId,
}: {
  users: UserRow[];
  departments: Option[];
  dict: Dictionary;
  locale: Locale;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('cleaner');

  // The password dialog: which user, and which of its two beats we are on.
  // One dialog at the root rather than one per row — the table runs to every
  // account in the club and only ever one of them is being edited.
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const digits = normalizePhone(phone);
  const preview = digits.length === 10 ? phoneToLoginEmail(digits) : null;

  function roleLabel(r: Role) {
    return r === 'admin'
      ? dict.roleAdmin
      : r === 'manager'
        ? dict.roleManager
        : r === 'inspector'
          ? dict.roleInspector
          : dict.roleCleaner;
  }

  function report(res: { ok: true } | { ok: false; error: string }) {
    if (res.ok) {
      toast.success(dict.saved);
      router.refresh();
      return;
    }
    const map: Record<string, string> = {
      not_authorized: dict.notAuthorized,
      phone_invalid: dict.phoneInvalid,
      password_too_short: dict.passwordTooShort,
      fields_required: dict.fieldsRequired,
      service_key_missing: dict.serviceKeyMissing,
      role_not_allowed: dict.roleNotAllowed,
    };
    toast.error(map[res.error] ?? res.error);
  }

  /** Drops the typed password on the way out, whichever way the dialog was
   *  dismissed — Escape and the backdrop close it too, not just Cancel. */
  function closeReset() {
    setResetting(null);
    setConfirming(false);
    setNewPassword('');
  }

  return (
    <>
      <form
        className="flex max-w-5xl flex-wrap items-start gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await createStaff({ name, phone, password, role });
            if (res.ok) {
              toast.success(dict.staffCreated);
              setName('');
              setPhone('');
              setPassword('');
              setRole('cleaner');
              router.refresh();
            } else {
              report(res);
            }
          });
        }}
      >
        <div className="min-w-44 flex-1 space-y-1">
          <Label htmlFor="s-name">{dict.name}</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="min-w-44 flex-1 space-y-1">
          <Label htmlFor="s-phone">{dict.phone}</Label>
          {/* "+20" is decoration, exactly as the staff app shows it — the field
              holds the 10 national digits and normalizePhone strips a pasted
              country code anyway, so nothing downstream changes. */}
          <Input
            id="s-phone"
            dir="ltr"
            prefix="+20"
            inputMode="numeric"
            placeholder="1012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {/* Show the exact address the account will be created under. The app
              builds this same string at login and validates nothing, so a
              wrong digit here is an account that simply never signs in. */}
          <p className="text-caption text-text/55" dir="ltr">
            {preview ? `${dict.loginEmailPreview}: ${preview}` : dict.phoneHint}
          </p>
        </div>
        <div className="min-w-44 flex-1 space-y-1">
          <Label htmlFor="s-role">{dict.role}</Label>
          {/* STAFF_ROLES, so 'admin' is never on offer. createStaff re-checks
              it — this select is the convenience, not the boundary. */}
          <Select id="s-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-44 flex-1 space-y-1">
          <Label htmlFor="s-pass">{dict.password}</Label>
          <PasswordInput
            id="s-pass"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showLabel={dict.showPassword}
            hideLabel={dict.hidePassword}
          />
        </div>
        {/* pt aligns the 56px button with the 56px inputs under their labels. */}
        <Button type="submit" disabled={pending} className="mt-4">
          <PlusIcon />
          {dict.newStaff}
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{dict.name}</TableHead>
            <TableHead>
              {dict.phone} / {dict.email}
            </TableHead>
            <TableHead>{dict.role}</TableHead>
            <TableHead>{dict.department}</TableHead>
            <TableHead>{dict.manager}</TableHead>
            <TableHead>{dict.password}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            // An admin's own row keeps an 'admin' option purely so its select
            // has something to display. The select is disabled there, so the
            // option is never reachable from anyone else's row.
            const isAdmin = u.role === 'admin';
            const roleOptions: Role[] = isAdmin ? ['admin', ...STAFF_ROLES] : [...STAFF_ROLES];

            return (
              <TableRow key={u.id}>
                <TableCell className="font-semibold">{u.name || dict.none}</TableCell>
                <TableCell dir="ltr">
                  {/* profiles.email is deliberately '' for phone accounts —
                      handle_new_user never stores the synthetic address. */}
                  {u.phone || u.email || dict.none}
                </TableCell>

                <TableCell>
                  <Select
                    compact
                    className="min-w-32"
                    aria-label={dict.changeRole}
                    defaultValue={u.role}
                    // Admin rows are frozen in both directions. Upward because
                    // promotion mints an admin without going near the create
                    // form; downward because demoting the last admin locks the
                    // whole org out of role changes — and set_user_role guards
                    // neither. Admins are made and unmade in Supabase.
                    disabled={pending || isAdmin || u.id === currentUserId}
                    onChange={(e) =>
                      startTransition(async () =>
                        report(await setUserRole(u.id, e.target.value as Role)),
                      )
                    }
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </Select>
                </TableCell>

                <TableCell>
                  <Select
                    compact
                    className="min-w-36"
                    aria-label={dict.changeDepartment}
                    defaultValue={u.departmentId ?? ''}
                    // Frozen on admin rows for the same reason the role select
                    // above is: an admin's place in the org is set in the
                    // database by hand, not from a screen anyone on it can
                    // reach. set_user_department enforces it too — this select
                    // only keeps the rule visible.
                    disabled={pending || isAdmin}
                    onChange={(e) =>
                      startTransition(async () =>
                        report(await setUserDepartment(u.id, e.target.value || null)),
                      )
                    }
                  >
                    <option value="">{dict.noDepartment}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {bilingual(locale, d.nameAr, d.nameEn)}
                      </option>
                    ))}
                  </Select>
                </TableCell>

                <TableCell>
                  <Select
                    compact
                    className="min-w-36"
                    aria-label={dict.changeManager}
                    defaultValue={u.managerId ?? ''}
                    disabled={pending || isAdmin}
                    onChange={(e) =>
                      startTransition(async () =>
                        report(await setUserManager(u.id, e.target.value || null)),
                      )
                    }
                  >
                    <option value="">{dict.noManager}</option>
                    {users
                      .filter((m) => m.id !== u.id && (m.role === 'admin' || m.role === 'manager'))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </Select>
                </TableCell>

                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={dict.resetPassword}
                    disabled={pending}
                    onClick={() => {
                      setResetting(u);
                      setConfirming(false);
                      setNewPassword('');
                    }}
                  >
                    <KeyIcon />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Setting someone else's password is irreversible and silent — they are
          never told. So it gets a dialog over a blurred-out page and a second
          beat naming the person, rather than the prompt() this replaces, which
          could not show whose row had been clicked. */}
      <Dialog open={resetting !== null} onOpenChange={(open) => !open && closeReset()}>
        <DialogContent closeLabel={dict.cancel}>
          {resetting && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dict.resetPasswordFor.replace('{name}', resetting.name || dict.none)}
                </DialogTitle>
                {confirming && (
                  <DialogDescription>
                    {dict.resetPasswordConfirm.replace('{name}', resetting.name || dict.none)}
                  </DialogDescription>
                )}
              </DialogHeader>

              {/* `hidden` rather than an unmount, so stepping back from the
                  confirmation returns the typed value and its reveal state
                  instead of an empty field. */}
              <div className="space-y-1" hidden={confirming}>
                <Label htmlFor="reset-pass">{dict.newPassword}</Label>
                <PasswordInput
                  id="reset-pass"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  showLabel={dict.showPassword}
                  hideLabel={dict.hidePassword}
                />
                <p className="text-caption text-text/55">{dict.passwordTooShort}</p>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => (confirming ? setConfirming(false) : closeReset())}
                >
                  {confirming ? dict.back : dict.cancel}
                </Button>
                <Button
                  variant={confirming ? 'destructive' : 'primary'}
                  size="md"
                  disabled={pending || newPassword.length < MIN_PASSWORD}
                  onClick={() => {
                    if (!confirming) {
                      setConfirming(true);
                      return;
                    }
                    const target = resetting;
                    startTransition(async () => {
                      const res = await resetStaffPassword(target.id, newPassword);
                      if (res.ok) {
                        toast.success(dict.passwordReset);
                        closeReset();
                        router.refresh();
                      } else {
                        report(res);
                      }
                    });
                  }}
                >
                  {confirming ? dict.confirm : dict.resetPassword}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
