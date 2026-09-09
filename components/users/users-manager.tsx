'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, KeyRound } from 'lucide-react';
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
import { SELECT_CLASS } from '@/components/subtask-editor';
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
    <div className="space-y-8">
      <form
        className="flex max-w-4xl flex-wrap items-end gap-3 bg-card p-4 shadow-[var(--shadow-broadsheet)]"
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
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="s-name">{dict.name}</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="min-w-44 flex-1 space-y-1.5">
          <Label htmlFor="s-phone">{dict.phone}</Label>
          <Input
            id="s-phone"
            dir="ltr"
            inputMode="numeric"
            placeholder="1012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {/* Show the exact address the account will be created under. The app
              builds this same string at login and validates nothing, so a
              wrong digit here is an account that simply never signs in. */}
          <p className="text-xs text-muted-foreground" dir="ltr">
            {preview ? `${dict.loginEmailPreview}: ${preview}` : dict.phoneHint}
          </p>
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="s-pass">{dict.password}</Label>
          <Input
            id="s-pass"
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />
          {dict.newStaff}
        </Button>
      </form>

      <div className="overflow-x-auto bg-card shadow-[var(--shadow-broadsheet)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{dict.name}</TableHead>
              <TableHead className="text-start">{dict.phone} / {dict.email}</TableHead>
              <TableHead className="text-start">{dict.role}</TableHead>
              <TableHead className="text-start">{dict.department}</TableHead>
              <TableHead className="text-start">{dict.manager}</TableHead>
              <TableHead className="text-start">{dict.password}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-start font-semibold">{u.name || '—'}</TableCell>
                <TableCell className="text-start text-sm" dir="ltr">
                  {/* profiles.email is deliberately '' for phone accounts —
                      handle_new_user never stores the synthetic address. */}
                  {u.phone || u.email || '—'}
                </TableCell>

                <TableCell className="text-start">
                  <select
                    aria-label={dict.changeRole}
                    className={SELECT_CLASS + ' min-w-28'}
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
                  </select>
                </TableCell>

                <TableCell className="text-start">
                  <select
                    aria-label={dict.changeDepartment}
                    className={SELECT_CLASS + ' min-w-32'}
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
                  </select>
                </TableCell>

                <TableCell className="text-start">
                  <select
                    aria-label={dict.changeManager}
                    className={SELECT_CLASS + ' min-w-32'}
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
                  </select>
                </TableCell>

                <TableCell className="text-start">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      const next = prompt(dict.password);
                      if (!next) return;
                      startTransition(async () =>
                        report(await resetStaffPassword(u.id, next)),
                      );
                    }}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
