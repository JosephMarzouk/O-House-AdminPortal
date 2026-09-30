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
import { normalizePhone, phoneToE164 } from '@/lib/phone';
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
import { can, mayManageUser, type Caller } from '@/lib/access';
import { errorMessage } from '@/lib/errors';
import { matchesQuery } from '@/lib/search';
import { NoPermission } from '@/components/no-permission';
import type { DepartmentOption } from '@/lib/options';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roleId: string;
  departmentId: string | null;
  managerId: string | null;
};

/** A role as this screen needs it. `canManage`: offered as someone's manager (canBeManager). */
export type RoleOption = { id: string; key: string | null; nameAr: string; nameEn: string; canManage: boolean };

/** Mirrors MIN_PASSWORD in lib/actions/users.ts. Duplicated rather than
 *  imported because that module is 'use server' and may export nothing but
 *  async functions; the server check is the real one, this only greys out
 *  the button. */
const MIN_PASSWORD = 8;

export function UsersManager({
  query,
  users,
  roles,
  departments,
  dict,
  locale,
  me,
}: {
  /** The page's ?q= search. It narrows the table only: the manager picker
   *  in each row still offers every manager. */
  query?: string;
  users: UserRow[];
  /** Every role, in sortRoles order: the order the table's sections run in. */
  roles: RoleOption[];
  departments: DepartmentOption[];
  dict: Dictionary;
  locale: Locale;
  /** users.view is what got us here. It decides what this screen offers;
   *  lib/actions/users.ts and the database decide what it may do. */
  me: NonNullable<Caller>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // What this caller may hand out — my_access().assignable, the database's
  // own list, which never holds the Admin role. The same list decides whose
  // role, department, manager and password they may change (mayManageUser).
  const assignable = roles.filter((r) => me.access?.assignable.includes(r.id));
  const canCreate = can(me, 'users.create') && assignable.length > 0;
  // A role that covers chosen departments places people in those only
  // (can_assign_role, set_user_department); everyone else in any, or none.
  const myDepartments =
    me.access?.scope === 'departments'
      ? departments.filter((d) => me.access?.departments.includes(d.id))
      : null;

  const [name, setName] = useState('');
  // What the person signs in with: a phone number (staff, the usual case) or
  // an email address. One of the two, chosen here.
  const [loginKind, setLoginKind] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // The least privileged default role, as before: Cleaner when it's on offer.
  const defaultRole = (assignable.find((r) => r.key === 'cleaner') ?? assignable[0])?.id ?? '';
  const [roleId, setRoleId] = useState(defaultRole);
  const [departmentId, setDepartmentId] = useState(myDepartments?.[0]?.id ?? '');

  // The password dialog: which user, and which of its two beats we are on.
  // One dialog at the root rather than one per row — the table runs to every
  // account in the club and only ever one of them is being edited.
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const digits = normalizePhone(phone);
  const preview = digits.length === 10 ? phoneToE164(digits) : null;

  const roleName = (r: RoleOption) => bilingual(locale, r.nameAr, r.nameEn);
  const managerRoles = new Set(roles.filter((r) => r.canManage).map((r) => r.id));

  // The table is grouped by role, in the roles' own order (the defaults most
  // privileged first, then custom roles), so a role change moves the row into
  // the section the select just named.
  //
  // Empty roles are dropped: a heading over nothing is noise.
  //
  // Anyone whose role isn't in the list (it can't happen while every role is
  // readable) lands in a last, unnamed section rather than off the screen.
  const known = new Set(roles.map((r) => r.id));
  const shown = users.filter((u) => matchesQuery(query, u.name, u.phone, u.email));
  const groups = [
    ...roles.map((r) => ({ id: r.id, label: roleName(r), rows: shown.filter((u) => u.roleId === r.id) })),
    { id: '', label: dict.none, rows: shown.filter((u) => !known.has(u.roleId)) },
  ].filter((g) => g.rows.length > 0);

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

  // Greyed rows get one note above the table, not one per row.
  const someLocked = shown.some((u) => !mayManageUser(me, u));

  return (
    <>
      {!canCreate ? (
        <NoPermission dict={dict} text={dict.noPermissionAddStaff} />
      ) : (
        <form
          className="flex max-w-5xl flex-wrap items-start gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createStaff({
                name,
                ...(loginKind === 'phone' ? { phone } : { email }),
                password,
                roleId,
                ...(myDepartments ? { departmentId } : {}),
              });
              if (res.ok) {
                alert.success(dict.staffCreated);
                setName('');
                setPhone('');
                setEmail('');
                setPassword('');
                setRoleId(defaultRole);
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
          <div className="min-w-36 space-y-1">
            <Label htmlFor="s-login-kind">{dict.signInWith}</Label>
            <Select
              id="s-login-kind"
              value={loginKind}
              onChange={(e) => setLoginKind(e.target.value as 'phone' | 'email')}
            >
              <option value="phone">{dict.phone}</option>
              <option value="email">{dict.email}</option>
            </Select>
          </div>
          {loginKind === 'phone' ? (
            <div className="min-w-44 flex-1 space-y-1">
              <Label htmlFor="s-phone">{dict.phone}</Label>
              {/* "+20" is decoration, exactly as the staff app shows it — the field
                  holds the 10 national digits and the API strips a pasted
                  country code anyway. */}
              <Input
                id="s-phone"
                dir="ltr"
                prefix="+20"
                inputMode="numeric"
                placeholder="1012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {/* The exact number they will sign in with, so a wrong digit is
                  caught here rather than as an account that never signs in. */}
              <p className="text-caption text-text/55" dir="ltr">
                {preview ? `${dict.signInAs}: ${preview}` : dict.phoneHint}
              </p>
            </div>
          ) : (
            <div className="min-w-44 flex-1 space-y-1">
              <Label htmlFor="s-email">{dict.email}</Label>
              <Input
                id="s-email"
                type="email"
                dir="ltr"
                autoComplete="off"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
          <div className="min-w-44 flex-1 space-y-1">
            <Label htmlFor="s-role">{dict.role}</Label>
            {/* Only the roles this caller may give — never Admin. createStaff
                and the API re-check (can_assign_role); this select is the
                convenience, not the boundary. */}
            <Select id="s-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {assignable.map((r) => (
                <option key={r.id} value={r.id}>
                  {roleName(r)}
                </option>
              ))}
            </Select>
          </div>
          {myDepartments && (
            <div className="min-w-44 flex-1 space-y-1">
              <Label htmlFor="s-dept">{dict.department}</Label>
              <Select
                id="s-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                {myDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {bilingual(locale, d.nameAr, d.nameEn)}
                  </option>
                ))}
              </Select>
            </div>
          )}
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
          <Button
            type="submit"
            disabled={pending || !roleId || (!!myDepartments && !departmentId)}
            className="mt-4"
          >
            <PlusIcon />
            {dict.newStaff}
          </Button>
        </form>
      )}

      {someLocked && <NoPermission dict={dict} text={dict.usersGreyedNote} />}
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
          {groups.map(({ id, label, rows }, groupIndex) => (
            <Fragment key={id}>
              {/* A label row rather than a second <Table> per group: one
                  header, one set of column widths, so the selects below stay
                  in line down the whole page. Whitespace does the separating,
                  which is why this row carries no rule and no hover. */}
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={6} className={groupIndex > 0 ? 'pt-8 pb-1' : 'pb-1'}>
                  <span className="section-label">{label}</span>
                  <span className="ms-2 text-caption tabular-nums text-text/50">{rows.length}</span>
                </TableCell>
              </TableRow>

              {rows.map((u) => {
                // Every control on the row — role, department, manager,
                // password — is live only where can_manage_user would say yes:
                // not me, and a current role I may assign, so never an Admin
                // and never a peer. Greyed rather than hidden, so the rule
                // stays visible; the database enforces it either way.
                const manageable = mayManageUser(me, u);
                // A disabled select still has to show the person's role.
                const current = roles.find((r) => r.id === u.roleId);
                const roleOptions = manageable ? assignable : current ? [current] : [];

                return (
                  // Keyed by role as well as id, so a confirmed role change
                  // remounts the row in its new section with the selects
                  // re-seeded. Keyed by id alone, React would move the same
                  // DOM node and the uncontrolled selects would keep showing
                  // whatever was last picked. The "no permission" title sits
                  // on the row: a disabled control shows none of its own.
                  <TableRow
                    key={`${u.id}-${u.roleId}`}
                    title={manageable ? undefined : dict.noPermission}
                  >
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
                    defaultValue={u.roleId}
                    // Admin rows are frozen in both directions: nothing
                    // callable grants or removes the Admin role (assign_role
                    // refuses it), so Admins are made and unmade in SQL.
                    disabled={pending || !manageable}
                    onChange={(e) =>
                      startTransition(async () => report(await setUserRole(u.id, e.target.value)))
                    }
                  >
                    {roleOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {roleName(r)}
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
                    // set_user_department enforces the same rule
                    // (can_manage_user) — this select only keeps it visible.
                    disabled={pending || !manageable}
                    onChange={(e) =>
                      startTransition(async () =>
                        report(await setUserDepartment(u.id, e.target.value || null)),
                      )
                    }
                  >
                    {/* A departments role moves people between its own
                        departments only, never out of them. */}
                    {!myDepartments && <option value="">{dict.noDepartment}</option>}
                    {(myDepartments ?? departments).map((d) => (
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
                    disabled={pending || !manageable}
                    onChange={(e) =>
                      startTransition(async () =>
                        report(await setUserManager(u.id, e.target.value || null)),
                      )
                    }
                  >
                    <option value="">{dict.noManager}</option>
                    {/* People who can manage (canBeManager), plus whoever the
                        manager is now, so the select can still show them. */}
                    {users
                      .filter(
                        (m) => m.id !== u.id && (managerRoles.has(m.roleId) || m.id === u.managerId),
                      )
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
                    disabled={pending || !manageable}
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
