import Link from 'next/link';
import { LockIcon, PlusIcon } from '@/components/icons';
import { can, canManageRoles, getProfile } from '@/lib/auth';
import { buildMatrix, mayDeleteRole, roleReadOnly } from '@/lib/access';
import { parseOne } from '@/lib/db/assignments';
import { listDepartments } from '@/lib/db/places';
import { listPermissions, listRoles } from '@/lib/db/roles';
import { listProfiles } from '@/lib/db/users';
import { getDictionary, getLocale, bilingual } from '@/lib/i18n';
import { fmtDate, fmtNum, todayInCairo } from '@/lib/format';
import { toDepartmentOptions } from '@/lib/options';
import { RoleEditor } from '@/components/roles/role-editor';
import { DeniedAction, NoPermission } from '@/components/no-permission';
import { Button } from '@/components/ui/button';
import { LinkPending } from '@/components/ui/link-pending';
import { PageBody, PageHeader } from '@/components/ui/page-header';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

/**
 * Roles: the club's roles on the start side, the selected one (?role=<id>,
 * or ?role=new) beside it. roles.view opens it; changing roles needs
 * roles.create / edit / delete and whole-club scope, which the database
 * checks in create_role / update_role / delete_role — this page only
 * decides what to offer.
 */
export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const [dict, locale, me] = await Promise.all([getDictionary(), getLocale(), getProfile()]);
  const kicker = fmtDate(todayInCairo(), locale);

  if (!me || !can(me, 'roles.view')) {
    return (
      <>
        <PageHeader kicker={kicker} title={dict.navRoles} />
        <PageBody>
          <NoPermission page dict={dict} />
        </PageBody>
      </>
    );
  }

  const [roles, catalog, profiles, departments] = await Promise.all([
    listRoles(),
    listPermissions(),
    // Holders and counts are the people I can see (profiles RLS), which
    // for a role manager without users.view is only themselves.
    listProfiles(),
    listDepartments(),
  ]);

  const canCreate = canManageRoles(me, 'create');
  const wanted = parseOne(sp.role);
  // ?role=new without roles.create says so, rather than quietly showing a role.
  const creating = wanted === 'new';
  const selected = creating ? null : (roles.find((r) => r.id === wanted) ?? roles[0]);

  const deptName = new Map(departments.map((d) => [d.id, bilingual(locale, d.name_ar, d.name_en)]));
  const holdersOf = (roleId: string) => profiles.filter((p) => p.role_id === roleId);
  const holders = selected
    ? holdersOf(selected.id).map((p) => ({
        id: p.id,
        name: p.name,
        department: (p.department_id && deptName.get(p.department_id)) || dict.none,
      }))
    : [];

  return (
    <>
      <PageHeader kicker={kicker} title={dict.navRoles} subtitle={dict.rolesIntro} />
      <PageBody>
        {/* A column on phones (the list, then the role), a row from md up. */}
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <nav aria-label={dict.navRoles} className="w-full shrink-0 space-y-2 md:w-72">
            {canCreate ? (
              <Button
                variant="outline"
                className="relative w-full"
                nativeButton={false}
                render={<Link href="/roles?role=new" scroll={false} />}
              >
                <PlusIcon />
                {dict.newRole}
                <LinkPending />
              </Button>
            ) : (
              <DeniedAction
                dict={dict}
                variant="outline"
                icon={<PlusIcon />}
                label={dict.newRole}
                className="items-stretch"
              />
            )}
            <ul>
              {roles.map((r) => {
                const active = r.id === selected?.id;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/roles?role=${r.id}`}
                      scroll={false}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex min-h-control items-center gap-2 rounded-control px-3 py-2 transition-colors',
                        active ? 'bg-cyan-tint text-cyan-dark' : 'hover:bg-text/7',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {bilingual(locale, r.name_ar, r.name_en)}
                      </span>
                      {r.locked ? (
                        <Tag tone="pending" icon={<LockIcon />}>
                          {dict.roleLocked}
                        </Tag>
                      ) : (
                        r.key && <Tag tone="pending">{dict.roleDefault}</Tag>
                      )}
                      <span
                        className="text-caption tabular-nums text-text/55"
                        title={dict.rolePeople.replace('{n}', fmtNum(holdersOf(r.id).length, locale))}
                      >
                        {fmtNum(holdersOf(r.id).length, locale)}
                      </span>
                      <LinkPending />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {creating && !canCreate ? (
            <NoPermission page dict={dict} className="min-w-0 flex-1" />
          ) : (
            <RoleEditor
              // A fresh form for each role: nothing typed for one leaks into another.
              key={selected?.id ?? 'new'}
              role={
                selected
                  ? {
                      id: selected.id,
                      key: selected.key,
                      nameEn: selected.name_en,
                      nameAr: selected.name_ar,
                      scope: selected.scope,
                      permissions: selected.permissions,
                      departments: selected.departments,
                      assignable: selected.assignable,
                    }
                  : null
              }
              meta={
                selected
                  ? `${dict.roleCreatedOn.replace('{date}', fmtDate(selected.created_at, locale))} · ${dict.roleUpdatedOn.replace('{date}', fmtDate(selected.updated_at, locale))}`
                  : undefined
              }
              sections={buildMatrix(catalog)}
              roles={roles.map((r) => ({
                id: r.id,
                key: r.key,
                nameEn: r.name_en,
                nameAr: r.name_ar,
                permissions: r.permissions,
              }))}
              departments={toDepartmentOptions(departments)}
              holders={holders}
              me={{ id: me.id, access: me.access }}
              readOnly={selected ? roleReadOnly(me, selected) : null}
              canDelete={!!selected && mayDeleteRole(me, selected)}
              dict={dict}
              locale={locale}
            />
          )}
        </div>
      </PageBody>
    </>
  );
}
