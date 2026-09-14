-- =====================================================================
-- 0010 — put the no-admin-minting rule in the database
-- Target: Supabase project ptonujazlljpkgpfrkpw ("Check List")
-- Status: APPLIED 2026-09-14, verified against pg_proc and the column
--         privileges — set_user_role rejects 'admin', and anon holds no
--         insert/update/select on profiles.
--
-- Two things, both defence in depth. Neither changes what the portal can
-- do today; both remove a way round it.
--
-- 1. set_user_role still accepts 'admin'.
--
--    The rule that the portal never mints an admin is real and deliberate
--    (STAFF_ROLES in lib/types/database.ts: "an admin is the account that
--    can mint accounts, so minting one from inside the portal would let a
--    single compromised session escalate itself permanently"). But it is
--    enforced in exactly one place — the isStaffRole() call in
--    setUserRole — and a Server Action is an HTTP endpoint. Anyone with an
--    admin session and the publishable key can skip the portal entirely:
--
--      POST /rest/v1/rpc/set_user_role {"new_role":"admin", ...}
--
--    scripts/verify-writes.ts says this out loud: "The DB does not stop it
--    — the code does." After this migration the database stops it too, and
--    verify-writes can assert the refusal rather than the constant.
--
--    Nothing legitimate calls it with 'admin': the portal's role <select>
--    offers STAFF_ROLES, and the 'admin' option on an admin's own row sits
--    on a disabled select purely so it has something to display. Admins are
--    made in the Supabase dashboard, which this does not touch.
--
-- 2. anon holds column grants on profiles, including role.
--
--    Supabase grants SELECT/INSERT/UPDATE on every column to anon by
--    default. `authenticated` was already narrowed to name and phone — that
--    is what makes the profiles_update_self policy (id = auth.uid()) safe
--    rather than a role-escalation hole — but anon was never touched.
--
--    Today RLS denies it anyway: every profiles policy resolves false when
--    auth.uid() is null. So this changes no behaviour. It matters because
--    the grant is the second lock: if a future policy is ever written a
--    little too permissively, the difference between a mistake and an
--    incident is whether anon also holds UPDATE on profiles.role.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. 'admin' out of the whitelist.
--
-- Reproduced from the live definition with one line changed. The caller
-- guard keeps 0007's `if <positive> then null; else raise` shape on
-- purpose: `if current_role() <> 'admin' then raise` never fires when
-- current_role() is NULL, because PL/pgSQL reads a NULL condition as
-- false. 0008 made current_role() return 'none' instead of NULL, but the
-- shape is what makes that belt-and-braces rather than load-bearing.
-- Do not "simplify" it back.
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

  -- 'admin' deliberately absent. Promotion is creation by another route,
  -- so the portal is not allowed either one.
  if new_role not in ('manager', 'inspector', 'cleaner') then
    raise exception 'Invalid role: %', new_role;
  end if;

  update public.profiles set role = new_role where id = target_user_id;
end;
$function$;

-- ---------------------------------------------------------------------
-- 2. Take anon off profiles.
--
-- Revoked by name rather than with a bare `revoke ... from public`:
-- Supabase grants to anon directly via ALTER DEFAULT PRIVILEGES, so
-- revoking from PUBLIC alone is a no-op. 0007 learned this the hard way.
--
-- SELECT goes too. An anonymous read is denied by profiles_select today
-- and the portal never reads profiles without a session.
-- ---------------------------------------------------------------------
revoke insert, update, select on table public.profiles from anon;

commit;

-- ---------------------------------------------------------------------
-- Verification — run this after, and read it. Expect:
--   admin_rejected        = t   (the RPC refuses to mint an admin)
--   anon_can_write_role   = f
--   anon_can_read_profiles= f
--   authed_can_update_name= t   (staff can still edit their own name)
-- ---------------------------------------------------------------------
-- select 'admin_rejected' as fact, (
--   select not exists (
--     select 1 from pg_proc
--      where proname = 'set_user_role'
--        and pronamespace = 'public'::regnamespace
--        and pg_get_functiondef(oid) ~ '''admin'', ''manager'''
--   )
-- )::text as value
-- union all
-- select 'anon_can_write_role',
--        has_column_privilege('anon', 'public.profiles', 'role', 'UPDATE')::text
-- union all
-- select 'anon_can_read_profiles',
--        has_table_privilege('anon', 'public.profiles', 'SELECT')::text
-- union all
-- select 'authed_can_update_name',
--        has_column_privilege('authenticated', 'public.profiles', 'name', 'UPDATE')::text
-- order by 1;
--
-- Then, signed in as an admin, confirm the portal still changes a staff
-- member's role, and that this is refused:
--   select public.set_user_role('<some staff id>', 'admin');
--   -- ERROR:  Invalid role: admin

-- ---------------------------------------------------------------------
-- NOT included, on purpose — two backup tables carrying pre-migration
-- personal data sit in the exposed `public` schema:
--
--   public._backup_pre_ohouse_profiles
--   public._backup_pre_ohouse_submissions
--
-- Both have RLS enabled with zero policies, so they are deny-all to anon
-- and authenticated alike and are not currently reachable through
-- PostgREST. They should still not live in the API schema. Dropping them
-- destroys data, so that is your call, not this migration's:
--
--   -- keep a copy first if the pre-O-House state still matters
--   -- alter table public._backup_pre_ohouse_profiles    set schema private;
--   -- alter table public._backup_pre_ohouse_submissions set schema private;
--   -- (or, once you are certain:)
--   -- drop table public._backup_pre_ohouse_profiles;
--   -- drop table public._backup_pre_ohouse_submissions;
-- ---------------------------------------------------------------------
