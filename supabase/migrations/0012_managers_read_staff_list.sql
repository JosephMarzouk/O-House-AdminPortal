-- =====================================================================
-- 0012 — managers may read the staff list, without the phone numbers
-- Target: Supabase project ptonujazlljpkgpfrkpw ("Check List")
-- Status: NOT YET APPLIED.
--
-- DEPENDS ON 0011. This replaces the admin_staff_list() that 0011
-- introduces, and takes the phone-privacy rule from it as given. Check
-- the database before running either — supabase/README.md's first
-- section exists because this ledger has been wrong in both directions.
--
--   select pg_get_functiondef(oid) from pg_proc
--    where proname = 'admin_staff_list' and pronamespace = 'public'::regnamespace;
--
-- If that comes back without the 'Only admins can read staff contact
-- details' guard, 0011 is not live: run it first.
--
-- One change, and it is the only database half the Users screen's new
-- audience needs. Everything else already fits:
--
--   set_user_department / set_user_manager  admin + manager since 0009
--   set_user_role                           admin only since 0010, and
--                                           staying that way — a manager
--                                           does not change roles
--   creating an account / setting a password
--                                           no SQL path at all; both run
--                                           through the service-role key
--                                           in lib/actions/users.ts, which
--                                           carries its own caller check
--                                           (canManageUsers) and its own
--                                           target check (grantableRoles)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Managers join admins on the staff list — but phone numbers do not
-- follow them.
--
-- 0011's argument for making phone admin-only was that hiding the Users
-- screen was never the control, because profiles_select already let
-- every manager read the whole staff table from PostgREST. That argument
-- is untouched here: the screen opening to managers is not what decides
-- who sees a phone number, this function is, and it still answers
-- 'admin' only. A manager gets every row with phone null, which is a
-- shape the screen already renders — users-manager.tsx falls through to
-- the email and then to an em dash.
--
-- The name stays admin_staff_list. It is a shade less accurate now, but
-- renaming it would touch the generated type in lib/types/database.ts
-- and lib/db/users.ts to change nothing, and a rename is the kind of
-- diff that hides a behaviour change inside it.
--
-- Guard keeps the `if <positive> then null; else raise` shape from 0007
-- and 0010. `if v_role not in (...) then raise` never fires on a NULL,
-- because PL/pgSQL reads a NULL condition as false. 0008 made
-- current_role() return 'none' rather than NULL, which makes this belt
-- and braces rather than load-bearing — do not "simplify" it back.
-- ---------------------------------------------------------------------
create or replace function public.admin_staff_list()
returns table (
  id uuid, name text, email text, phone text, role text,
  department_id uuid, manager_id uuid, active boolean, must_change_password boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(public.current_role(), 'none');
begin
  if v_role in ('admin', 'manager') then
    null;
  else
    raise exception 'Only admins and managers can read the staff list';
  end if;

  return query
    select p.id, p.name, p.email,
           -- 0011's rule, unchanged: the phone column is admin-only.
           case when v_role = 'admin' then p.phone else null end,
           p.role, p.department_id, p.manager_id, p.active, p.must_change_password
      from public.profiles p
     order by p.role, p.name;
end;
$function$;

-- Unchanged from 0011, restated because a CREATE OR REPLACE does not
-- disturb grants and re-running this file should still land them.
revoke execute on function public.admin_staff_list() from public, anon;
grant  execute on function public.admin_staff_list() to authenticated;

commit;

-- ---------------------------------------------------------------------
-- Verification — run it, read it.
--
--   list_admits_manager  = t
--   phone_is_conditional = t
--   guard_is_fail_closed = f   (no `not in` guard on current_role())
-- ---------------------------------------------------------------------
-- select 'list_admits_manager' as fact,
--        (pg_get_functiondef(oid) ~ '''admin'', ''manager''')::text as value
--   from pg_proc where proname = 'admin_staff_list'
--    and pronamespace = 'public'::regnamespace
-- union all
-- select 'phone_is_conditional',
--        (pg_get_functiondef(oid) ~ 'case when v_role')::text
--   from pg_proc where proname = 'admin_staff_list'
--    and pronamespace = 'public'::regnamespace
-- union all
-- select 'guard_is_fail_closed',
--        (pg_get_functiondef(oid) ~* 'current_role\(\)\s*(<>|!=)')::text
--   from pg_proc where proname = 'admin_staff_list'
--    and pronamespace = 'public'::regnamespace
-- order by 1;
--
-- Then the three sessions that matter:
--
--   -- as an admin:     rows, with phone numbers
--   select role, phone from public.admin_staff_list() limit 5;
--
--   -- as a manager:    the same rows, every phone null
--   select count(*) as rows, count(phone) as phones from public.admin_staff_list();
--   -- expect: phones = 0
--
--   -- as an inspector: ERROR:  Only admins and managers can read the staff list
--   select * from public.admin_staff_list();
