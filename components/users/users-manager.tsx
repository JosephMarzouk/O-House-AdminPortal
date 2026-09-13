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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { Role } from '@/lib/types/database';

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

const ROLES: Role[] = ['admin', 'manager', 'inspector', 'cleaner'];

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
    };
    toast.error(map[res.error] ?? res.error);
  }

  return (
    <>
      <form
        className="flex max-w-4xl flex-wrap items-start gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await createStaff({ name, phone, password });
            if (res.ok) {
              toast.success(dict.staffCreated);
              setName('');
              setPhone('');
              setPassword('');
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
          <Label htmlFor="s-pass">{dict.password}</Label>
          <Input
            id="s-pass"
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {users.map((u) => (
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
                  // An admin demoting themselves would lock the whole org
                  // out of role changes; set_user_role does not guard this.
                  disabled={pending || u.id === currentUserId}
                  onChange={(e) =>
                    startTransition(async () =>
                      report(await setUserRole(u.id, e.target.value as Role)),
                    )
                  }
                >
                  {ROLES.map((r) => (
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
                  disabled={pending}
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
                  disabled={pending}
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
                  aria-label={dict.password}
                  disabled={pending}
                  onClick={() => {
                    const next = prompt(dict.password);
                    if (!next) return;
                    startTransition(async () => report(await resetStaffPassword(u.id, next)));
                  }}
                >
                  <KeyIcon />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
