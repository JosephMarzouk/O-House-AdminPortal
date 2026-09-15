'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { alert } from '@/components/ui/alert-dialog';
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
import { grantableRoles, STAFF_ROLES, type Role, type StaffRole } from '@/lib/types/database';
import { errorMessage } from '@/lib/errors';
import type { DepartmentOption } from '@/lib/options';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  departmentId: string | null;
  managerId: string | null;
};

/** Mirrors MIN_PASSWORD in lib/actions/users.ts. Duplicated rather than
 *  imported because that module is 'use server' and may export nothing but
 *  async functions; the server check is the real one, this only greys out
 *  the button. */
const MIN_PASSWORD = 8;

/**
 * Descending privilege — the order the table's sections run in, and the
 * order a row select offers.
 *
 * `admin` is on the front of STAFF_ROLES rather than in it: STAFF_ROLES is
 * the list the portal may GRANT, and admin is deliberately absent from that
 * (see lib/types/database.ts). Here the question is only what to display,
 * and admins have to be displayable — they exist, and an admin looking at
 * this screen should see the other admins.
 */
const ROLE_ORDER: readonly Role[] = ['admin', ...STAFF_ROLES];

export function UsersManager({
  users,
  departments,
  dict,
  locale,
  currentUserId,
  callerRole,
}: {
  users: UserRow[];
  departments: DepartmentOption[];
  dict: Dictionary;
  locale: Locale;
  currentUserId: string;
  /** Admin or manager — canManageUsers is what got us here. It decides what
   *  this screen offers; lib/actions/users.ts decides what it may do. */
  callerRole: Role;
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

  // What this caller may hand out, and — the same list, on purpose — whose
  // password they may set. An admin gets all three staff roles; a manager
  // gets inspector and cleaner, never a peer. See grantableRoles.
  const grantable = grantableRoles(callerRole);
  const isAdminCaller = callerRole === 'admin';

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

  function rolePlural(r: Role) {
    return r === 'admin'
      ? dict.roleAdminPlural
      : r === 'manager'
        ? dict.roleManagerPlural
        : r === 'inspector'
          ? dict.roleInspectorPlural
          : r === 'cleaner'
            ? dict.roleCleanerPlural
            : // Not in ROLE_ORDER: a role the database grew and this file did
              // not. Label it with the raw value rather than guessing.
              r;
  }

  // The table is grouped by role, most-privileged first, rather than sorted
  // flat. `order by role` in admin_staff_list is alphabetical — admin,
  // cleaner, inspector, manager — which is not an order anyone reads a staff
  // list in. ROLE_ORDER is, and it is the same list the row selects offer,
  // so a role change moves the row into the section the select just named.
  //
  // Empty roles are dropped: a heading over nothing is noise, and the page
  // already says how many of each there are by showing them.
  //
  // The section list is ROLE_ORDER plus anything the data holds that it does
  // not, rather than ROLE_ORDER alone. profiles_role_check allows exactly the
  // four roles below, so the tail is normally empty — but this project has
  // twice shipped code whose idea of the database was out of date, and a flat
  // `ROLE_ORDER.map` would drop a fifth role's accounts off this screen in
  // silence rather than show them in a section nobody styled.
  const extraRoles = [...new Set(users.map((u) => u.role))].filter(
    (r) => !ROLE_ORDER.includes(r),
  );
  const groups = [...ROLE_ORDER, ...extraRoles]
    .map((role) => ({ role, rows: users.filter((u) => u.role === role) }))
    .filter((g) => g.rows.length > 0);

  function report(res: { ok: true } | { ok: false; error: string }) {
    if (res.ok) {
      alert.success(dict.saved);
      router.refresh();
      return;
    }
    alert.error(errorMessage(dict, res.error));
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
              alert.success(dict.staffCreated);
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
          {/* 'admin' is never on offer, and 'manager' only to an admin.
              createStaff re-checks against the same list — this select is the
              convenience, not the boundary. */}
          <Select id="s-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            {grantable.map((r) => (
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
          {groups.map(({ role, rows }, groupIndex) => (
            <Fragment key={role}>
              {/* A label row rather than a second <Table> per group: one
                  header, one set of column widths, so the selects below stay
                  in line down the whole page. Whitespace does the separating,
                  which is why this row carries no rule and no hover. */}
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={6} className={groupIndex > 0 ? 'pt-8 pb-1' : 'pb-1'}>
                  <span className="section-label">{rolePlural(role)}</span>
                  <span className="ms-2 text-caption tabular-nums text-text/50">{rows.length}</span>
                </TableCell>
              </TableRow>

              {rows.map((u) => {
                // An admin's own row keeps an 'admin' option purely so its
                // select has something to display. The select is disabled
                // there, so the option is never reachable from another row.
                const isAdmin = u.role === 'admin';
                const roleOptions: Role[] = isAdmin ? [...ROLE_ORDER] : [...STAFF_ROLES];
                // The row's password button. Same list as the create form,
                // because taking an account over and minting one are the same
                // reach — so a manager's own row, and every admin's, is shown
                // with the key greyed rather than hidden. resetStaffPassword
                // enforces it; this only keeps the rule visible.
                const canSetPassword = (grantable as readonly string[]).includes(u.role);

                return (
                  // Keyed by role as well as id, so a confirmed role change
                  // remounts the row in its new section with the selects
                  // re-seeded. Keyed by id alone, React would move the same
                  // DOM node and the uncontrolled selects would keep showing
                  // whatever was last picked.
                  <TableRow key={`${u.id}-${u.role}`}>
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
                    // ...and frozen for a manager on every row: set_user_role
                    // is admin-only in the database (0010), so leaving this
                    // live would only buy a raw error.
                    disabled={pending || isAdmin || u.id === currentUserId || !isAdminCaller}
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
                    disabled={pending || !canSetPassword}
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
            </Fragment>
          ))}
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
                        alert.success(dict.passwordReset);
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
