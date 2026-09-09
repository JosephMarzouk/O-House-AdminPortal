-- =====================================================================
-- 0008 — close the fail-open guards on the assignment lifecycle RPCs
--
-- URGENT. Verified against the live project on 2026-09-09 with the
-- PUBLISHABLE key only (no session), zero rows affected:
--
--   POST /rest/v1/rpc/approve_assignment {"p_assignment_id":"000...0"}
--     -> 204 No Content       (guard never fired; no-op only because the id
--                              does not exist — a real submitted id would
--                              have been approved)
--   POST /rest/v1/rpc/extend_assignment  {... ,"p_new_deadline":"2020-01-01"}
--     -> 400 "New deadline must be in the future"
--                             (reached the SECOND validation, i.e. it sailed
--                              straight past the role check)
--
-- Cause: `if public.current_role() not in ('admin','manager') then raise`
-- never fires when current_role() returns NULL, because PL/pgSQL treats a
-- NULL IF condition as false. current_role() returns NULL for any caller
-- with no public.profiles row — every anonymous caller, and any
-- authenticated user whose signup trigger did not materialize a row (a state
-- this project has hit in production before).
--
-- Affected: create_assignment, approve_assignment, reject_items,
-- extend_assignment. The publishable key ships in both web/js/config.js and
-- o_house/lib/supabase.dart, so "anonymous caller" means anyone with the app.
--
-- Fix is one function, not four: make current_role() return a non-NULL
-- sentinel. 'none' fails every `= 'admin'`, `in ('admin','manager')` and
-- `not in (...)` test correctly, so it closes this shape wherever it appears
-- — including any future RPC written the same way.
--
-- Verified safe: nothing in any function body or RLS policy tests
-- current_role() for NULL (checked pg_proc and pg_policy). Every existing
-- caller uses equality or IN, where NULL and 'none' both evaluate falsy.
-- =====================================================================

begin;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- coalesce, NOT a bare select: a NULL here silently disables every guard
  -- written as `if current_role() not in (...) then raise`.
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'none'
  );
$function$;

-- Defence in depth: anon has no business reaching these at all, guard or no
-- guard. Supabase grants EXECUTE to anon directly via ALTER DEFAULT
-- PRIVILEGES, so revoking from PUBLIC alone is not enough — revoke from both.
revoke execute on function public.create_assignment(text, text, uuid, uuid, date, time, time, jsonb, uuid, uuid) from public, anon;
revoke execute on function public.approve_assignment(uuid, integer)                                              from public, anon;
revoke execute on function public.reject_items(uuid, uuid[], text)                                               from public, anon;
revoke execute on function public.extend_assignment(uuid, timestamptz, text)                                     from public, anon;

grant execute on function public.create_assignment(text, text, uuid, uuid, date, time, time, jsonb, uuid, uuid) to authenticated;
grant execute on function public.approve_assignment(uuid, integer)                                              to authenticated;
grant execute on function public.reject_items(uuid, uuid[], text)                                               to authenticated;
grant execute on function public.extend_assignment(uuid, timestamptz, text)                                     to authenticated;

commit;

-- ---------------------------------------------------------------------
-- Verification — expect current_role_never_null = t and every
-- anon_exec_* = f.
-- ---------------------------------------------------------------------
-- select 'current_role_never_null' as fact, (public.current_role() is not null)::text as value
-- union all
-- select 'anon_exec_'||p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')::text
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('create_assignment','approve_assignment','reject_items','extend_assignment')
-- order by 1;
--
-- Then re-run the probe that found this. It must now return 401, not 204:
--   curl -s -o /dev/null -w '%{http_code}\n' -X POST \
--     https://ptonujazlljpkgpfrkpw.supabase.co/rest/v1/rpc/approve_assignment \
--     -H "apikey: <publishable>" -H "Authorization: Bearer <publishable>" \
--     -H 'Content-Type: application/json' \
--     -d '{"p_assignment_id":"00000000-0000-0000-0000-000000000000"}'
