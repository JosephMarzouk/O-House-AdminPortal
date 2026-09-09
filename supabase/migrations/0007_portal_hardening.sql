-- =====================================================================
-- 0007 — portal hardening
-- Target: Supabase project ptonujazlljpkgpfrkpw ("Check List")
--
-- Run in the SQL Editor. Safe to re-run: every statement is either
-- CREATE OR REPLACE, an idempotent REVOKE, or a guarded UPDATE.
--
-- Already applied on 2026-09-09, recorded here for the ledger only:
--   alter view public.assignments_v set (security_invoker = on);
--   revoke select on public.assignments_v from anon;
--   update public.sites s set name_en = btrim(t.title_en),
--          name_ar = btrim(t.title_ar)
--     from public.templates t where t.site_id = s.id;
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Close the fail-open role guards.
--
-- `if public.current_role() <> 'admin' then raise` never fires when
-- current_role() returns NULL — PL/pgSQL treats a NULL condition as false.
-- NULL is exactly what a caller with no public.profiles row gets, a state
-- this project has hit in production before (see the comment block in
-- supabase/functions/admin-create-user/index.ts in the old repo).
--
-- The `if <positive> then null; else raise` shape denies on NULL. It is the
-- shape set_action_status already uses correctly.
-- ---------------------------------------------------------------------

create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.current_role() = 'admin' then
    null;
  else
    raise exception 'Only admins can change user roles';
  end if;

  if new_role not in ('admin', 'manager', 'inspector', 'cleaner') then
    raise exception 'Invalid role: %', new_role;
  end if;

  update public.profiles set role = new_role where id = target_user_id;
end;
$function$;

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

  if new_manager_id = target_user_id then
    raise exception 'A user cannot be their own manager';
  end if;

  update public.profiles set manager_id = new_manager_id where id = target_user_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- 2. Take EXECUTE away from anon.
--
-- Supabase grants EXECUTE to anon DIRECTLY via ALTER DEFAULT PRIVILEGES,
-- not through PUBLIC — so `revoke ... from public` is a no-op here and the
-- earlier attempt left anon with access. Revoke from anon by name.
-- ---------------------------------------------------------------------

revoke execute on function public.set_user_role(uuid, text)       from anon;
revoke execute on function public.set_user_department(uuid, uuid) from anon;
revoke execute on function public.set_user_manager(uuid, uuid)    from anon;

grant execute on function public.set_user_role(uuid, text)       to authenticated;
grant execute on function public.set_user_department(uuid, uuid) to authenticated;
grant execute on function public.set_user_manager(uuid, uuid)    to authenticated;

-- ---------------------------------------------------------------------
-- 3. Un-swap the row whose English and Arabic columns hold each other's
--    language ("C6 community" / مبني خدمة العملاء).
--
-- The site-name sync above copied templates -> sites before this was fixed,
-- so the swap now exists in both tables. SQL evaluates the right-hand side
-- against the OLD row, so `set a = b, b = a` is a real swap.
--
-- Guarded on the actual condition rather than on an id: only a row whose
-- _en column contains Arabic AND whose _ar column does not can match, so
-- re-running this cannot swap a correct row back.
-- ---------------------------------------------------------------------

update public.templates
   set title_en = title_ar,
       title_ar = title_en
 where title_en ~ '[؀-ۿ]'
   and title_ar !~ '[؀-ۿ]';

update public.sites
   set name_en = name_ar,
       name_ar = name_en
 where name_en ~ '[؀-ۿ]'
   and name_ar !~ '[؀-ۿ]';

commit;

-- ---------------------------------------------------------------------
-- Verification — expect: anon_exec_* = false, failopen_* = false,
-- and zero rows with Arabic in an _en column.
-- ---------------------------------------------------------------------
-- select 'anon_exec_'||p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('set_user_role','set_user_department','set_user_manager')
-- union all
-- select 'failopen_'||p.proname, (pg_get_functiondef(p.oid) not like '%else%raise%')
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('set_user_role','set_user_department','set_user_manager')
-- union all
-- select 'templates_en_with_arabic', count(*) > 0 from public.templates where title_en ~ '[؀-ۿ]'
-- union all
-- select 'sites_en_with_arabic',     count(*) > 0 from public.sites     where name_en  ~ '[؀-ۿ]';
