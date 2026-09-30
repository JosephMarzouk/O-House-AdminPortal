# supabase/

`migrations/` holds numbered SQL scripts, run by hand in the project's SQL
Editor. There is no Supabase CLI migration table — the files are a ledger of
what was run, not something a tool replays. Every script is written to be safe
to re-run.

## The ledger is not evidence

A pre-deployment audit in September 2026 found the ledger wrong in both
directions: `0009` was live but untracked in git, while `0007` and `0008` were
committed here and **not applied** — production was still running the
fail-open `current_role()` that 0008 exists to replace, and a `set_user_role`
that rejected `'cleaner'` while three accounts held that role.

Nothing warns you about this. A file in this folder means someone intended to
run it. So before trusting any guard described here, ask the database:

```sql
-- expect: coalesce present, no fail-open '<>' guard, 'cleaner' accepted
select p.proname,
       pg_get_functiondef(p.oid) ~ 'coalesce'                  as has_coalesce,
       pg_get_functiondef(p.oid) ~* 'current_role\(\)\s*(<>|!=)' as fail_open
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and pg_get_functiondef(p.oid) ~ 'current_role'
 order by fail_open desc, p.proname;

select public.current_role() is null as should_be_false;
```

`fail_open` must be `f` on every row — `if current_role() not in (...) then
raise` never fires when the value is NULL, because PL/pgSQL reads a NULL
condition as false. Each migration carries its own checks at the foot; run
them, and read the output, rather than assuming the script took.

## How to make an admin

Nothing in the portal can mint an admin, by design, and since `0010` the
database refuses it too — `set_user_role` accepts only `manager`, `inspector`
and `cleaner`, so a direct `POST /rest/v1/rpc/set_user_role` with `"admin"`
raises. That leaves exactly one path, and it is deliberately manual.

**1. Create the account.** Supabase Dashboard → Authentication → Users →
*Add user* → *Create new user*. Give it a **real email address** and a
password, and leave *Auto confirm user* ticked. The dialog has no phone
field, which is fine: staff sign in by phone, admins by email, and the
portal's login box accepts either (`components/login-form.tsx`).

**2. Promote it.** SQL Editor:

```sql
update public.profiles
   set role = 'admin'
 where email = 'the.address@you.just.used';
-- expect: UPDATE 1
```

The `handle_new_user` trigger files every new account as `cleaner` — the
least-privileged role — so step 2 is what makes the difference, and it takes
project-level access to run. That is the whole point: the slow, witnessed
path. `0009` deliberately left `public.profiles` writable from the SQL Editor
for exactly this.

To demote an admin, the same `update` in reverse. Do not add an RPC for
either — an RPC that can grant `admin` is the thing `0010` exists to remove.

## Roles and permissions (since 29 Sep)

The four roles above are now only the **defaults**. Each club edits them and
adds its own on the Roles screen; what a role may do is a set of permissions
from a fixed catalog, plus a scope (own work, team, chosen departments, whole
club). The migrations and the rules are in `o-house-api` (its README →
"Roles"); the step 2 `update … set role = 'admin'` still works, because a
trigger sets `role_id` from the text.

**Who can sign into the portal:** any role holding `portal.view`. The layout
asks `can(me, 'portal.view')` (`lib/access.ts`); `getProfile()` loads
`my_access()` once per request.

**What a screen offers** is `can(me, '<module>.<action>')`, the same keys the
database checks with `has_permission()`. A page the person may not open shows
"You don't have permission to open this page"; a control they may not use
stays visible, greyed out, with a red note (`components/no-permission.tsx`).
Server Actions check the same key first, and the database refuses regardless:
the layout gate only decides what *renders*.

## Who administers whom

One list answers both questions, as before: which roles you may create, and
whose role, department, manager and password you may change. It is
`my_access().assignable`: the roles ticked for your role under "Can create
users with these roles" (every non-Admin role, for an Admin). `mayManageUser`
in `lib/access.ts` mirrors the database's `can_manage_user`: `users.edit`, not
yourself, and their current role on your list. So nobody touches an Admin, and
a Manager cannot touch another Manager unless Manager is ticked for them.

Account creation and password resets go through the API (`POST /admin/staff`,
`…/:id/password`), which asks `can_assign_role` / `can_manage_user` as the
caller before writing with its secret key. `pnpm check` asserts the portal's
half of these rules.

## Phone numbers are admin-only

`0011` revoked the table-wide SELECT on `public.profiles` from
`authenticated` and granted back every column except `phone`. The only way to
read a phone number is `admin_staff_list()`, which is `SECURITY DEFINER`.

`0012` opened that function to managers as well, because the Users screen is
theirs too now — but only the rows. A manager gets every row back with
`phone` null; the column is still admin-only, decided inside the function
rather than by who can see the screen. An inspector or cleaner still gets an
exception. The function kept its `admin_staff_list` name, which is now a
shade inaccurate; renaming it would have churned the generated types to change
nothing.

Two consequences worth knowing before you change anything here:

- **`select('*')` on `profiles` now fails** with a permission error. Use
  `PROFILE_COLUMNS` from `lib/types/database.ts`.
- **Narrowing `profiles_select` instead would have been a trap.** Six
  policies across `submissions`, `assignment_items`, `actions` and
  `action_events` subquery `profiles` inside their own expressions, and
  Postgres applies RLS to those subqueries — restricting the table would
  silently cut every supervisor off from their own reports' work.

## Two orphan Edge Functions

The project (`ptonujazlljpkgpfrkpw`, "Check List") still has two Edge Functions
deployed and ACTIVE. **Nothing in this repo calls them**, there is no
`supabase/functions/` source directory here, and there never was one in this
repo's history — they are left over from the portal that came before it.

| Slug | Superseded by |
|---|---|
| `admin-create-user` | `createStaff` in `lib/actions/users.ts` |
| `admin-reset-password` | `resetStaffPassword` in `lib/actions/users.ts` |

Do not wire either back in. `admin-create-user` upserts `public.profiles` with
the address it was given and `role: 'inspector'`, overwriting what
`handle_new_user` derives — that overwrite is why accounts it created could not
log in, which is the whole reason `createStaff` exists and is documented at
`lib/actions/users.ts:73-78`.

Both are kept for now only in case the older clients still reach them. To
remove one: Supabase Dashboard → Edge Functions → the function → ⋯ → Delete.

Sign-in itself has never needed a function: `components/login-form.tsx` calls
`supabase.auth.signInWithPassword` on the browser client, and the session is
carried by `proxy.ts`.

## The one secret this app needs

`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Only `lib/supabase/admin.ts` reads
it, and that file is `import 'server-only'`, so a browser import is a build
error. Creating a staff account and setting someone's password are the only two
operations that need it — `profiles` has no INSERT policy and there is no RPC
for either. Everything else goes through the RLS-respecting server client.

If the users screen says "Service key not set", the value is missing or empty.
Next reads env files at startup, so restart `next dev` after filling it in.
