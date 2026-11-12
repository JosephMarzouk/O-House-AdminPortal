import {
  PERMISSION_ACTIONS,
  ROLE_SCOPES,
  type Permission,
  type PermissionAction,
  type RoleScope,
} from '@/lib/types/database';

/**
 * What the signed-in person may do, and the pure rules the portal draws
 * itself from. Every rule here is the database's first (has_permission, the
 * role RPCs' rails, can_manage_user); these only decide what a screen offers,
 * so nobody is handed a control that can only fail. A Server Action is
 * reachable by POST whatever the screen showed, and the database still says no.
 *
 * No server imports: client components read it too.
 */

/** my_access(), parsed. */
export type Access = {
  role: { id: string; key: string | null; name_en: string; name_ar: string; locked: boolean };
  scope: RoleScope;
  departments: string[];
  permissions: string[];
  /** The roles this person may create users with or assign. Never the Admin role. */
  assignable: string[];
};

/** The signed-in person as the rules need them (getProfile's Me fits), or nobody. */
export type Caller = { id: string; access: Access | null } | null | undefined;

/**
 * my_access() is jsonb. Anything that isn't the expected shape is no access
 * at all: this must fail closed, never open.
 */
export function parseAccess(v: unknown): Access | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Partial<Access>;
  if (typeof a.role?.id !== 'string' || !(ROLE_SCOPES as readonly unknown[]).includes(a.scope)) return null;
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
  return {
    role: a.role,
    scope: a.scope as RoleScope,
    departments: list(a.departments),
    permissions: list(a.permissions),
    assignable: list(a.assignable),
  };
}

export function can(me: Caller, key: string): boolean {
  return !!me?.access?.permissions.includes(key);
}

/** Managing roles needs the roles.* permission AND whole-club scope (save_role, delete_role). */
export function canManageRoles(me: Caller, action: 'create' | 'edit' | 'delete'): boolean {
  return can(me, `roles.${action}`) && me?.access?.scope === 'all';
}

/**
 * Why a role is read-only for me, or null when I may edit it. The Admin role
 * is locked for everyone, and nobody edits their own role (save_role raises
 * ROLE_LOCKED / OWN_ROLE).
 */
export function roleReadOnly(
  me: Caller,
  role: { id: string; locked: boolean },
): 'locked' | 'own' | 'rights' | null {
  if (role.locked) return 'locked';
  if (role.id === me?.access?.role.id) return 'own';
  if (!canManageRoles(me, 'edit')) return 'rights';
  return null;
}

/**
 * Delete is offered for a custom role only: the defaults stay until flag day
 * (DEFAULT_ROLE). A role someone holds is refused too (ROLE_IN_USE); the
 * screen says so rather than hiding the button.
 */
export function mayDeleteRole(
  me: Caller,
  role: { id: string; key: string | null; locked: boolean },
): boolean {
  return canManageRoles(me, 'delete') && role.key === null && !role.locked && role.id !== me?.access?.role.id;
}

/**
 * staff_app.view ("can be given checklists") is a trait, not a power: anyone
 * managing roles may give it. Everything else only if I hold it myself.
 */
export const STAFF_APP = 'staff_app.view';

export function mayGrant(me: Caller, key: string): boolean {
  return key === STAFF_APP || can(me, key);
}

/**
 * A matrix cell is live when the role is editable and I could grant the
 * permission — or it is already ticked, so I can take away what I couldn't
 * give (saving a role that holds more than I do is NOT_A_SUBSET).
 */
export function cellEnabled(me: Caller, key: string, checked: boolean, editable: boolean): boolean {
  return editable && (checked || mayGrant(me, key));
}

/**
 * Is "Can create users with these roles" live for a role? Only if the role can
 * create or edit users; otherwise the list means nothing. Ticking a role there
 * is enough to hand it out, even a stronger one (never Admin: the database
 * refuses it). `ticked` is the role's permissions as they stand in the editor,
 * not as saved.
 */
export function assignableEnabled(ticked: ReadonlySet<string>): boolean {
  return ticked.has('users.create') || ticked.has('users.edit');
}

export type MatrixRow ={
  module: string;
  cells: Record<PermissionAction, Permission | null>;
  /** Keys whose action is none of the four columns (assignments.unlock_place): one tick each, across the row. */
  extra: Permission[];
};
export type MatrixSection = { section: string; rows: MatrixRow[] };

/**
 * The catalog as the matrix draws it: sections, then one row per module, in
 * catalog order; a cell per action, null where the catalog has no such key
 * (drawn disabled, like "Delete" on Reports). A key with an action of its
 * own lands in `extra` rather than being dropped, so it can still be granted.
 */
export function buildMatrix(catalog: Permission[]): MatrixSection[] {
  const sections: MatrixSection[] = [];
  for (const p of [...catalog].sort((a, b) => a.sort - b.sort)) {
    let section = sections.find((s) => s.section === p.section);
    if (!section) sections.push((section = { section: p.section, rows: [] }));
    let row = section.rows.find((r) => r.module === p.module);
    if (!row) {
      const cells = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, null])) as MatrixRow['cells'];
      section.rows.push((row = { module: p.module, cells, extra: [] }));
    }
    if ((PERMISSION_ACTIONS as readonly string[]).includes(p.action)) row.cells[p.action as PermissionAction] = p;
    else row.extra.push(p);
  }
  return sections;
}

const DEFAULT_ORDER = ['admin', 'manager', 'inspector', 'cleaner'];

/** The defaults first, most privileged first, then custom roles by English name. */
export function sortRoles<T extends { key: string | null; name_en: string }>(roles: T[]): T[] {
  const rank = (r: T) => (r.key ? DEFAULT_ORDER.indexOf(r.key) : DEFAULT_ORDER.length);
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.name_en.localeCompare(b.name_en));
}

/**
 * Mirrors can_manage_user: users.edit, not me, and their current role one I
 * may assign — so never an Admin, and a Manager never a peer. Whether they
 * are in my scope is the staff list's own answer: I only see those.
 */
export function mayManageUser(me: Caller, user: { id: string; roleId: string }): boolean {
  return can(me, 'users.edit') && user.id !== me?.id && !!me?.access?.assignable.includes(user.roleId);
}

/**
 * May I change this report-mail list ('all' or a department id)? set_report_mail's
 * own rule: club_settings.edit + reports.view (the PDFs are rendered as the saver),
 * and a department in my scope. 'all' also stands for the frequency and sender:
 * whole-club scope only, since every department's PDF is rendered as whoever saved them.
 */
export function mayEditReportMail(me: Caller, list: string): boolean {
  const a = me?.access;
  if (!a || !can(me, 'club_settings.edit') || !can(me, 'reports.view')) return false;
  if (a.scope === 'all') return true;
  if (list === 'all') return false;
  return a.scope === 'team' || (a.scope === 'departments' && a.departments.includes(list));
}

/**
 * Who is offered as someone's manager: people whose role sees a team or the
 * whole club and either manages staff (users.edit) or follows checklists
 * (checklists.view). A manager_id only widens what a 'team' role sees; 'all'
 * roles stay on the list because Admins were managers before custom roles.
 * Kept simple on purpose: set_user_manager accepts anyone.
 */
export function canBeManager(role: { scope: RoleScope; permissions: string[] }): boolean {
  return (
    (role.scope === 'team' || role.scope === 'all') &&
    (role.permissions.includes('users.edit') || role.permissions.includes('checklists.view'))
  );
}
