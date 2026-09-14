-- =====================================================================
-- 0009 — an admin's department and manager are set in the database only
-- Target: Supabase project ptonujazlljpkgpfrkpw ("Check List")
--
-- Run in the SQL Editor. Safe to re-run: both statements are
-- CREATE OR REPLACE.
--
-- The portal already freezes the ROLE select on admin rows, and says why
-- in components/users/users-manager.tsx: promotion mints an admin without
-- going near the create form, and demoting the last admin locks the org
-- out. Department and manager were never given the same treatment, in the
-- UI or here — so anyone who can reach the users screen can reassign an
-- admin, and set_user_department/set_user_manager accept it from any
-- manager by direct POST whatever the UI offers.
--
-- This closes the function. It deliberately does NOT close the table: a
-- plain `update public.profiles set department_id = ...` in the SQL
-- Editor still works, which is the whole point — admins are assigned by
-- hand, by us, and nowhere else.
--
-- Both functions are otherwise reproduced verbatim from 0007, including
-- the deny-on-NULL `if <positive> then null; else raise` caller guard.
-- =====================================================================

begin;

create or replace function public.set_user_department(target_user_id uuid, new_department_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.current_role() in ('admin', 'manager') then
    null;
  else
    raise exception 'Only admins/managers can change user departments';
  end if;

  -- coalesce, not a bare subquery: 0008's lesson. A target with no profiles
  -- row would make the comparison NULL, which PL/pgSQL reads as false — the
  -- exact shape that silently disabled every guard in this schema once.
  if coalesce((select role from public.profiles where id = target_user_id), 'none') = 'admin' then
    raise exception 'An admin''s department is set in the database, not the portal';
  end if;

  update public.profiles set department_id = new_department_id where id = target_user_id;
end;
$function$;

create or replace function public.set_user_manager(target_user_id uuid, new_manager_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.current_role() in ('admin', 'manager') then
    null;
  else
    raise exception 'Only admins/managers can change user managers';
  end if;

  if coalesce((select role from public.profiles where id = target_user_id), 'none') = 'admin' then
    raise exception 'An admin''s manager is set in the database, not the portal';
  end if;

  if new_manager_id = target_user_id then
    raise exception 'A user cannot be their own manager';
  end if;

  update public.profiles set manager_id = new_manager_id where id = target_user_id;
end;
$function$;

commit;

-- ---------------------------------------------------------------------
-- Verification — expect both guarded = true, and the grants from 0007
-- still in place (CREATE OR REPLACE keeps them; this is the check that
-- says so out loud).
-- ---------------------------------------------------------------------
-- select 'guarded_'||p.proname, (pg_get_functiondef(p.oid) like '%not the portal%')
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('set_user_department','set_user_manager')
-- union all
-- select 'anon_exec_'||p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('set_user_department','set_user_manager');
--
-- Then, as a signed-in admin:
--   select public.set_user_department('<an admin id>', null);   -- must raise
--   select public.set_user_department('<a cleaner id>', null);  -- must succeed
