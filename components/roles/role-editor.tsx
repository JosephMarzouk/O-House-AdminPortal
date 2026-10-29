'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs } from '@base-ui/react/tabs';
import { alert } from '@/components/ui/alert-dialog';
import { LockIcon, TrashIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { deleteRole, saveRole } from '@/lib/actions/roles';
import {
  assignableEnabled,
  cellEnabled,
  type Caller,
  type MatrixRow,
  type MatrixSection,
} from '@/lib/access';
import { errorMessage } from '@/lib/errors';
import { fmtNum } from '@/lib/format';
import { bilingual, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { PERMISSION_ACTIONS, ROLE_SCOPES, type Permission, type RoleScope } from '@/lib/types/database';
import type { DepartmentOption } from '@/lib/options';
import { cn } from '@/lib/utils';

/** The role being edited, or shown read-only. */
export type EditorRole = {
  id: string;
  key: string | null;
  nameEn: string;
  nameAr: string;
  scope: RoleScope;
  permissions: string[];
  departments: string[];
  assignable: string[];
};

/** Any role, as a "can create users with these roles" choice. */
export type RoleChoice = {
  id: string;
  key: string | null;
  nameEn: string;
  nameAr: string;
  permissions: string[];
};

// The catalog carries a label per key, not per row or section: these name
// the rows. A module a later migration adds falls back to its first key's
// label, a section to its raw name, so nothing renders blank.
const SECTION_LABEL: Record<string, keyof Dictionary> = {
  access: 'permSectionAccess',
  checklists: 'permSectionChecklists',
  places: 'permSectionPlaces',
  staff: 'permSectionStaff',
  club: 'permSectionClub',
};
const MODULE_LABEL: Record<string, keyof Dictionary> = {
  portal: 'permPortal',
  staff_app: 'permStaffApp',
  checklists: 'permChecklists',
  review: 'permReview',
  planner: 'permPlanner',
  reports: 'permReports',
  places: 'permPlaces',
  departments: 'permDepartments',
  users: 'permUsers',
  phones: 'permPhones',
  roles: 'permRoles',
  club_settings: 'permClubSettings',
  // assignments.unlock_place (QR-locked places)
  assignments: 'permUnlockPlace',
};

function flip(set: Set<string>, id: string, on: boolean): Set<string> {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * One role: its names, whose work it sees, which roles it may give out, and
 * the permission matrix — or the same, read-only (the Admin role, your own
 * role, or without roles.edit and whole-club scope).
 *
 * Every control mirrors a rail save_role enforces: permissions only from what
 * I hold (staff_app.view aside), assignable roles only from mine (any of them,
 * even a stronger one, once the role can create or edit users), departments
 * iff "Chosen departments". The database has the final word; this keeps the
 * Save button from being a trap.
 */
export function RoleEditor({
  role,
  meta,
  sections,
  roles,
  departments,
  holders,
  me,
  readOnly,
  canDelete,
  dict,
  locale,
}: {
  /** null: a new role. */
  role: EditorRole | null;
  /** "Created … · Updated …", already formatted. */
  meta?: string;
  sections: MatrixSection[];
  roles: RoleChoice[];
  departments: DepartmentOption[];
  /** The people holding this role, as far as I can see them. */
  holders: { id: string; name: string; department: string }[];
  me: NonNullable<Caller>;
  /** Why it can't be edited (roleReadOnly), or null. */
  readOnly: 'locked' | 'own' | 'rights' | null;
  canDelete: boolean;
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editable = readOnly === null;

  const [nameEn, setNameEn] = useState(role?.nameEn ?? '');
  const [nameAr, setNameAr] = useState(role?.nameAr ?? '');
  const [scope, setScope] = useState<RoleScope>(role?.scope ?? 'own');
  const [perms, setPerms] = useState(() => new Set(role?.permissions ?? []));
  const [depts, setDepts] = useState(() => new Set(role?.departments ?? []));
  const [assign, setAssign] = useState(() => new Set(role?.assignable ?? []));

  const name = (r: { nameAr: string; nameEn: string }) => bilingual(locale, r.nameAr, r.nameEn);
  const mine = new Set(me.access?.assignable ?? []);
  const valid = !!nameEn.trim() && !!nameAr.trim() && (scope !== 'departments' || depts.size > 0);
  // The list only means something for a role that can create or edit users;
  // otherwise it is greyed out and saved empty. The ticks stay in state, so
  // re-ticking Users → Create brings them back.
  const assignLive = assignableEnabled(perms);

  // Editing: the roles I may give out, plus any the role already lists (so
  // they can be taken away). Never Admin, never the role itself. Read-only:
  // just what the role lists.
  const assignOptions = editable
    ? roles.filter((r) => r.key !== 'admin' && r.id !== role?.id && (mine.has(r.id) || assign.has(r.id)))
    : roles.filter((r) => assign.has(r.id));

  const scopeLabel: Record<RoleScope, string> = {
    own: dict.scopeOwn,
    team: dict.scopeTeam,
    departments: dict.scopeDepartments,
    all: dict.scopeAll,
  };
  const actionLabel = {
    view: dict.permView,
    create: dict.permCreate,
    edit: dict.permEdit,
    delete: dict.permDelete,
  };
  const sectionLabel = (s: string) => (SECTION_LABEL[s] ? dict[SECTION_LABEL[s]] : s);
  const moduleLabel = (row: MatrixRow) => {
    if (MODULE_LABEL[row.module]) return dict[MODULE_LABEL[row.module]];
    const first = PERMISSION_ACTIONS.map((a) => row.cells[a]).find(Boolean) ?? row.extra[0];
    return first ? bilingual(locale, first.label_ar, first.label_en) : row.module;
  };
  /** One permission's tick. */
  const tick = (p: Permission, className?: string) => {
    const checked = perms.has(p.key);
    const label = bilingual(locale, p.label_ar, p.label_en);
    const live = cellEnabled(me, p.key, checked, editable);
    return (
      <Checkbox
        className={className}
        aria-label={label}
        // Greyed on an editable role: a permission I don't
        // hold myself. A read-only role has its banner.
        title={!live && editable ? dict.noPermission : label}
        checked={checked}
        disabled={!live}
        onCheckedChange={(v) => setPerms(flip(perms, p.key, v === true))}
      />
    );
  };
  const readOnlyNote =
    readOnly === 'locked'
      ? dict.roleReadOnlyLocked
      : readOnly === 'own'
        ? dict.roleReadOnlyOwn
        : readOnly === 'rights'
          ? dict.roleReadOnlyRights
          : null;

  function save() {
    startTransition(async () => {
      const res = await saveRole(role?.id ?? null, {
        nameEn,
        nameAr,
        scope,
        permissions: [...perms],
        departmentIds: [...depts],
        assignableRoleIds: assignLive ? [...assign] : [],
      });
      if (!res.ok) {
        alert.error(errorMessage(dict, res.error));
        return;
      }
      alert.success(role ? dict.saved : dict.roleCreated);
      if (role) router.refresh();
      else router.push(`/roles?role=${res.id}`);
    });
  }

  async function remove() {
    if (!role) return;
    const ok = await alert.confirm({
      title: dict.roleDeleteConfirm.replace('{name}', name(role)),
      confirmLabel: dict.remove,
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteRole(role.id);
      if (!res.ok) {
        alert.error(errorMessage(dict, res.error));
        return;
      }
      alert.success(dict.roleDeleted);
      router.push('/roles');
    });
  }

  const tabClass =
    'relative inline-flex h-control items-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors ' +
    'bg-surface text-text/70 hover:bg-text/7 hover:text-text data-active:bg-cyan data-active:text-on-cyan';

  return (
    <section className="min-w-0 flex-1 space-y-8">
      <div>
        <h2 className="text-heading">{role ? name(role) : dict.newRole}</h2>
        {meta && <p className="mt-1 text-caption text-text/55">{meta}</p>}
        {readOnlyNote && (
          <p
            className={cn(
              'mt-2 flex items-center gap-2 text-sm',
              // Red only when it is a missing permission; a locked or own role is a fact, not a refusal.
              readOnly === 'rights' ? 'text-magenta' : 'text-text/70',
            )}
          >
            <LockIcon className="size-icon-sm shrink-0" />
            {readOnlyNote}
          </p>
        )}
      </div>

      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="role-ar">{dict.roleNameAr}</Label>
          <Input
            id="role-ar"
            dir="rtl"
            maxLength={60}
            disabled={!editable}
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role-en">{dict.roleNameEn}</Label>
          <Input
            id="role-en"
            dir="ltr"
            maxLength={60}
            disabled={!editable}
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role-scope">{dict.roleSees}</Label>
          <Select
            id="role-scope"
            disabled={!editable}
            value={scope}
            onChange={(e) => setScope(e.target.value as RoleScope)}
          >
            {ROLE_SCOPES.map((s) => (
              <option key={s} value={s}>
                {scopeLabel[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {scope === 'departments' && (
        <fieldset className="space-y-1">
          <legend className="section-label">{dict.roleDepartments}</legend>
          <ul className="flex flex-wrap gap-x-6">
            {departments.map((d) => (
              <li key={d.id} className="flex min-h-control items-center gap-3">
                <Checkbox
                  id={`dept-${d.id}`}
                  disabled={!editable}
                  checked={depts.has(d.id)}
                  onCheckedChange={(v) => setDepts(flip(depts, d.id, v === true))}
                />
                <Label htmlFor={`dept-${d.id}`} className="text-base text-text">
                  {bilingual(locale, d.nameAr, d.nameEn) || dict.none}
                </Label>
              </li>
            ))}
          </ul>
          {editable && depts.size === 0 && (
            <p className="text-caption text-magenta">{dict.pickDepartments}</p>
          )}
        </fieldset>
      )}

      <fieldset className="space-y-1">
        <legend className="section-label">{dict.roleAssignable}</legend>
        {editable && !assignLive && (
          <p className="text-caption text-text/55">{dict.roleAssignableNeedsUsers}</p>
        )}
        {assignOptions.length === 0 ? (
          <p className="text-sm text-text/55">{dict.roleAssignableNone}</p>
        ) : (
          <ul className="flex flex-wrap gap-x-6">
            {assignOptions.map((r) => {
              // Greyed and unticked while not live, since it saves as empty.
              // Read-only shows what the role lists.
              const checked = assign.has(r.id) && (assignLive || !editable);
              return (
                <li key={r.id} className="flex min-h-control items-center gap-3">
                  <Checkbox
                    id={`assign-${r.id}`}
                    // Ticked ones stay live so they can be taken away.
                    disabled={!editable || !assignLive || (!checked && !mine.has(r.id))}
                    checked={checked}
                    onCheckedChange={(v) => setAssign(flip(assign, r.id, v === true))}
                  />
                  <Label htmlFor={`assign-${r.id}`} className="text-base text-text">
                    {name(r)}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <Tabs.Root defaultValue="permissions">
        <Tabs.List className="flex flex-wrap gap-1">
          <Tabs.Tab value="permissions" className={tabClass}>
            {dict.tabPermissions}
          </Tabs.Tab>
          <Tabs.Tab value="users" className={tabClass}>
            {dict.navUsers}
            <span className="tabular-nums opacity-70">{fmtNum(holders.length, locale)}</span>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="permissions" className="mt-4 max-w-3xl">
          <p className="text-caption text-text/55">{dict.roleMatrixHint}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                {PERMISSION_ACTIONS.map((a) => (
                  <TableHead key={a} className="w-20 text-center">
                    {actionLabel[a]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((s) => (
                <Fragment key={s.section}>
                  {/* A label row, as on the staff list: one set of columns
                      down the whole matrix. */}
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={5} className="pt-6 pb-1">
                      <span className="section-label">{sectionLabel(s.section)}</span>
                    </TableCell>
                  </TableRow>
                  {s.rows.map((row) => (
                    <Fragment key={row.module}>
                    {PERMISSION_ACTIONS.some((a) => row.cells[a]) && (
                    <TableRow>
                      <TableCell className="whitespace-normal font-semibold">{moduleLabel(row)}</TableCell>
                      {PERMISSION_ACTIONS.map((a) => {
                        const p = row.cells[a];
                        if (!p) {
                          // Doesn't apply to this row: a greyed box, as in
                          // the reference, not a control.
                          return (
                            <TableCell key={a}>
                              <span
                                aria-hidden
                                className="mx-auto block size-4 rounded-card border border-divider bg-text/4 opacity-45"
                              />
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={a}>
                            {tick(p, 'mx-auto')}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    )}
                    {/* A key that is none of the four actions
                        (assignments.unlock_place): its own row, one tick
                        under View, its label beside it. */}
                    {row.extra.map((p) => (
                      <TableRow key={p.key}>
                        <TableCell className="whitespace-normal font-semibold">{moduleLabel(row)}</TableCell>
                        <TableCell colSpan={4}>
                          <span className="flex items-center gap-3">
                            {tick(p, 'ms-7 shrink-0')}
                            <span className="text-caption text-text/55">{bilingual(locale, p.label_ar, p.label_en)}</span>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="users" className="mt-4 max-w-3xl">
          {holders.length === 0 ? (
            <p className="text-text/55">{dict.roleNoHolders}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.name}</TableHead>
                  <TableHead>{dict.department}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holders.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-semibold">{h.name || dict.none}</TableCell>
                    <TableCell>{h.department}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Tabs.Panel>
      </Tabs.Root>

      {(editable || canDelete) && (
        // Sticky, like the week planner's save bar: the matrix is long.
        <div className="sticky bottom-6 flex flex-wrap items-center gap-3 rounded-tile bg-raised p-4 shadow-md shadow-(color:--color-shade)">
          {editable && (
            <Button disabled={pending || !valid} onClick={save}>
              {pending ? dict.loading : role ? dict.save : dict.create}
            </Button>
          )}
          {canDelete && role && (
            <>
              <Button
                variant="ghost"
                className="text-magenta hover:bg-magenta/10"
                disabled={pending || holders.length > 0}
                onClick={remove}
              >
                <TrashIcon />
                {dict.remove}
              </Button>
              {holders.length > 0 && <span className="text-caption text-text/55">{dict.roleInUse}</span>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
