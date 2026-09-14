-- =====================================================================
-- 0011 — inspectors become portal users, and phone numbers become
--        admin-only
-- Target: Supabase project ptonujazlljpkgpfrkpw ("Check List")
-- Status: NOT YET APPLIED.
--
-- RUN THIS BEFORE DEPLOYING THE MATCHING CODE. Section 4 removes the
-- table-level SELECT on profiles, and the old code's `select('*')` breaks
-- the moment it does. The commit that pairs with this migration replaces
-- every `select('*')` on profiles with an explicit column list.
--
-- Four changes:
--
--   1. handle_new_user() finally does what the code has always claimed.
--   2. 'inspector' joins 'admin' and 'manager' as a portal role.
--   3. Nobody approves their own assignment.
--   4. profiles.phone is readable by admins only, and not through the
--      table at all.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. handle_new_user()
--
-- Three claims in lib/actions/users.ts have been false against this
-- database for as long as they have been written: the comment says the
-- trigger derives phone from the synthetic address, blanks profiles.email
-- ("never store the disguise"), and defaults to 'cleaner'. The deployed
-- function did none of those — it stored new.email verbatim, never set
-- phone, and defaulted to 'inspector'. That is why 1 profile in 14 has a
-- phone number.
--
-- The default role matters more than it used to. Section 2 makes
-- 'inspector' a portal role, so a trigger defaulting to 'inspector' would
-- hand dashboard access to every account created outside the portal,
-- including one made from the Supabase dashboard by someone only meaning
-- to add a cleaner. The default is now the least-privileged role, and the
-- portal corrects it immediately afterwards from what the admin chose.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_local     text    := split_part(new.email, '@', 1);
  v_synthetic boolean := new.email like '%@ohouse.internal';
begin
  insert into public.profiles (id, name, email, phone, role)
  values (
    new.id,
    -- A synthetic address's local part is a phone number, not a name.
    -- Falling back to it would file staff under "201012345678".
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      case when v_synthetic then '' else v_local end
    ),
    -- Never store the disguise. profiles.email is '' for phone accounts,
    -- which is what users-manager.tsx's `phone || email || none` expects.
    case when v_synthetic then '' else new.email end,
    -- 20 + 10 national digits is the only shape phoneToLoginEmail emits.
    -- Anything else is not a phone account and gets no phone.
    case
      when v_synthetic and v_local ~ '^20[0-9]{10}$' then '+' || v_local
      else null
    end,
    -- Least privilege. See the note above.
    'cleaner'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- 2. 'inspector' becomes a portal role.
--
-- Every policy below is reproduced from its live definition with
-- 'inspector' added and nothing else changed, so the diff is readable
-- against `pg_policies`. Two shapes appear:
--
--   flat    — admin/manager/inspector alike: the whole table.
--   scoped  — admin sees everything; manager AND inspector see only the
--             people who report to them (profiles.manager_id).
--
-- The scoped shape is worth understanding before you use it: an inspector
-- with nobody reporting to them sees only their own assignments, so their
-- dashboard will look empty. That is the same rule managers already live
-- under, not a new one. If inspectors should instead see everything, the
-- change is to move 'inspector' into the admin branch of each scoped
-- policy below.
--
-- The TypeScript side of this list is PORTAL_ROLES in lib/auth.ts. Keep
-- the two in step.
-- ---------------------------------------------------------------------

-- flat: the whole staff table
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select using (
  (id = auth.uid())
  or ("current_role"() = any (array['admin', 'manager', 'inspector']))
);

-- flat: places, their twin sites, and departments
drop policy if exists sites_write on public.sites;
create policy sites_write on public.sites
for all
using      ("current_role"() = any (array['admin', 'manager', 'inspector']))
with check ("current_role"() = any (array['admin', 'manager', 'inspector']));

drop policy if exists templates_write on public.templates;
create policy templates_write on public.templates
for all
using      ("current_role"() = any (array['admin', 'manager', 'inspector']))
with check ("current_role"() = any (array['admin', 'manager', 'inspector']));

drop policy if exists templates_select on public.templates;
create policy templates_select on public.templates
for select using (
  ("current_role"() = any (array['admin', 'manager', 'inspector']))
  or (department_id is null)
  or (department_id = current_department_id())
);

drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments
for all
using      ("current_role"() = any (array['admin', 'manager', 'inspector']))
with check ("current_role"() = any (array['admin', 'manager', 'inspector']));

drop policy if exists template_claims_release on public.template_claims;
create policy template_claims_release on public.template_claims
for update
using      ("current_role"() = any (array['admin', 'manager', 'inspector']))
with check ("current_role"() = any (array['admin', 'manager', 'inspector']));

-- scoped: the work itself
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
for select using (
  (inspector_id = auth.uid())
  or ("current_role"() = 'admin')
  or (
    "current_role"() = any (array['manager', 'inspector'])
    and inspector_id in (select p.id from public.profiles p where p.manager_id = auth.uid())
  )
);

drop policy if exists assignment_items_select on public.assignment_items;
create policy assignment_items_select on public.assignment_items
for select using (
  exists (
    select 1 from public.submissions s
     where s.id = assignment_items.assignment_id
       and (
         (s.inspector_id = auth.uid())
         or ("current_role"() = 'admin')
         or (
           "current_role"() = any (array['manager', 'inspector'])
           and s.inspector_id in (select p.id from public.profiles p where p.manager_id = auth.uid())
         )
       )
  )
);

drop policy if exists actions_select on public.actions;
create policy actions_select on public.actions
for select using (
  (owner_id = auth.uid())
  or ("current_role"() = 'admin')
  or (
    "current_role"() = any (array['manager', 'inspector'])
    and owner_id in (select p.id from public.profiles p where p.manager_id = auth.uid())
  )
);

drop policy if exists actions_insert on public.actions;
create policy actions_insert on public.actions
for insert with check (
  (owner_id = auth.uid())
  or ("current_role"() = 'admin')
  or (
    "current_role"() = any (array['manager', 'inspector'])
    and owner_id in (select p.id from public.profiles p where p.manager_id = auth.uid())
  )
);

drop policy if exists actions_update_admin on public.actions;
create policy actions_update_admin on public.actions
for update
using (
  ("current_role"() = 'admin')
  or (
    "current_role"() = any (array['manager', 'inspector'])
    and owner_id in (select p.id from public.profiles p where p.manager_id = auth.uid())
  )
)
with check (
  ("current_role"() = 'admin')
  or (
    "current_role"() = any (array['manager', 'inspector'])
    and owner_id in (select p.id from public.profiles p where p.manager_id = auth.uid())
  )
);

drop policy if exists action_events_select on public.action_events;
create policy action_events_select on public.action_events
for select using (
  exists (
    select 1 from public.actions a
     where a.id = action_events.action_id
       and (
         (a.owner_id = auth.uid())
         or ("current_role"() = 'admin')
         or (
           "current_role"() = any (array['manager', 'inspector'])
           and a.owner_id in (select p.id from public.profiles p where p.manager_id = auth.uid())
         )
       )
  )
);

-- The four lifecycle RPCs. Guard shape is unchanged — `not in (...)` is
-- safe here only because 0008 made current_role() return 'none' rather
-- than NULL. Do not write a new guard in this shape without that.
create or replace function public.approve_assignment(p_assignment_id uuid, p_score integer default null)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if public.current_role() not in ('admin', 'manager', 'inspector') then
    raise exception 'Only admins/managers/inspectors can approve assignments';
  end if;

  -- ------------------------------------------------------------------
  -- 3. Nobody signs off their own work.
  --
  -- New, and the reason it is new: inspectors are assignable (they appear
  -- in assignableStaff alongside cleaners) AND, as of this migration, can
  -- approve. Without this an inspector could submit an assignment and
  -- approve it in the next request, which empties the review step of any
  -- meaning. Managers are not assignable today, so this never fires for
  -- them; it is written for the role that is both.
  --
  -- coalesce, not a bare comparison: 0009's lesson.
  -- ------------------------------------------------------------------
  if coalesce(public.current_role(), 'none') <> 'admin'
     and exists (
       select 1 from public.submissions
        where id = p_assignment_id and inspector_id = auth.uid()
     ) then
    raise exception 'You cannot approve an assignment you carried out';
  end if;

  update public.submissions
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
         score = coalesce(p_score, score)
   where id = p_assignment_id and status = 'submitted';
end;
$function$;

create or replace function public.reject_items(p_assignment_id uuid, p_item_ids uuid[], p_reason text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if public.current_role() not in ('admin', 'manager', 'inspector') then
    raise exception 'Only admins/managers/inspectors can reject items';
  end if;

  if coalesce(public.current_role(), 'none') <> 'admin'
     and exists (
       select 1 from public.submissions
        where id = p_assignment_id and inspector_id = auth.uid()
     ) then
    raise exception 'You cannot review an assignment you carried out';
  end if;

  update public.assignment_items
     set status = 'rejected', reject_note = p_reason, done_at = null
   where assignment_id = p_assignment_id and id = any(p_item_ids);

  update public.submissions
     set status = 'in_progress', review_note = p_reason,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_assignment_id;
end;
$function$;

create or replace function public.extend_assignment(p_assignment_id uuid, p_new_deadline timestamptz, p_note text default null)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if public.current_role() not in ('admin', 'manager', 'inspector') then
    raise exception 'Only admins/managers/inspectors can extend assignments';
  end if;
  if p_new_deadline <= now() then
    raise exception 'New deadline must be in the future';
  end if;

  update public.submissions
     set extended_until = p_new_deadline,
         extended_by    = auth.uid(),
         extended_at    = now(),
         extension_note = p_note
   where id = p_assignment_id
     and status not in ('submitted', 'approved');
end;
$function$;

-- create_assignment: only the guard line changes. The body is reproduced
-- verbatim because CREATE OR REPLACE would otherwise drop it.
create or replace function public.create_assignment(
  p_title_en text, p_title_ar text, p_site_id uuid, p_assignee_id uuid,
  p_scheduled_date date, p_window_start time, p_window_end time,
  p_items jsonb, p_source_template_id uuid default null, p_client_id uuid default null
) returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid; v_site_ar text; v_site_en text; v_assignee_name text;
  v_item jsonb; v_i int := 0;
begin
  if public.current_role() not in ('admin', 'manager', 'inspector') then
    raise exception 'Only admins/managers/inspectors can create assignments';
  end if;

  if p_client_id is not null then
    select id into v_id from public.submissions where client_id = p_client_id;
    if v_id is not null then return v_id; end if;      -- idempotent
  end if;

  select name_ar, name_en into v_site_ar, v_site_en
    from public.sites where id = p_site_id;

  select name into v_assignee_name from public.profiles where id = p_assignee_id;
  if v_assignee_name is null then raise exception 'Assignee not found'; end if;

  insert into public.submissions (
    template_id, template_title_ar, template_title_en,
    site_id, site_name_ar, site_name_en,
    inspector_id, inspector_name,
    title_en, title_ar, source_template_id,
    scheduled_date, window_start, window_end,
    status, created_by, client_id, submitted_at, answers
  ) values (
    p_source_template_id, p_title_ar, p_title_en,
    p_site_id, v_site_ar, v_site_en,
    p_assignee_id, v_assignee_name,
    p_title_en, p_title_ar, p_source_template_id,
    p_scheduled_date, p_window_start, p_window_end,
    'pending', auth.uid(), p_client_id, null, '[]'::jsonb
  ) returning id into v_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.assignment_items (
      assignment_id, template_item_id, text_en, text_ar,
      type, critical, requires_photo, sort_order
    ) values (
      v_id,
      v_item ->> 'id',
      coalesce(v_item ->> 'text_en', ''),
      coalesce(v_item ->> 'text_ar', ''),
      coalesce(v_item ->> 'type', 'yesno'),
      coalesce((v_item ->> 'critical')::bool, false),
      coalesce((v_item ->> 'requires_photo')::bool, false),
      v_i
    );
    v_i := v_i + 1;
  end loop;

  return v_id;
end;
$function$;

-- Deliberately NOT extended to inspectors: set_user_role (admin only,
-- 0010) and set_user_department / set_user_manager (admin + manager,
-- 0009). User administration stays where it is. The Users screen is
-- admin-only in the UI, so no inspector has a path to these anyway.

-- ---------------------------------------------------------------------
-- 4. phone becomes admin-only.
--
-- The Users screen being admin-only was never the control: profiles_select
-- lets every manager — and now every inspector — read the whole staff
-- table straight from PostgREST with their own session. Hiding the screen
-- changes nothing for them.
--
-- The obvious fix, narrowing profiles_select to admins, is a trap. Six
-- policies across submissions, assignment_items, actions and action_events
-- subquery public.profiles inside their own expressions, and Postgres
-- applies RLS to those subqueries. Narrowing the table would silently cut
-- every supervisor off from their own reports' work.
--
-- So the row stays readable and the COLUMN moves out of reach. Note the
-- revoke of the table-level SELECT first: `revoke select (phone)` on its
-- own is a no-op while a table-wide grant exists, which is the quiet way
-- to think this is done when it is not.
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
begin
  if coalesce(public.current_role(), 'none') <> 'admin' then
    raise exception 'Only admins can read staff contact details';
  end if;

  return query
    select p.id, p.name, p.email, p.phone, p.role,
           p.department_id, p.manager_id, p.active, p.must_change_password
      from public.profiles p
     order by p.role, p.name;
end;
$function$;

revoke execute on function public.admin_staff_list() from public, anon;
grant  execute on function public.admin_staff_list() to authenticated;

-- Table-level SELECT out, then every column back except phone.
revoke select on table public.profiles from authenticated;
grant  select (id, name, email, role, created_at, department_id,
               manager_id, active, must_change_password, locale)
  on table public.profiles to authenticated;

-- Grant hygiene, same argument as 0010's anon revoke: nothing in the
-- portal deletes or inserts a profile as the signed-in user (createStaff
-- uses the service-role client, handle_new_user is SECURITY DEFINER), and
-- TRUNCATE is not subject to RLS at all.
revoke insert, delete, truncate, trigger, references on table public.profiles from authenticated;
revoke delete, truncate, trigger, references         on table public.profiles from anon;

commit;

-- ---------------------------------------------------------------------
-- Verification — run it, read it. Expect every value below.
--
--   authed_table_select      = f   (table-wide SELECT is gone)
--   authed_reads_name        = t   (but the columns came back)
--   authed_reads_phone       = f   (except this one)
--   authed_can_delete        = f
--   inspector_is_portal_role = t
--   trigger_defaults_cleaner = t
--   approve_has_self_guard   = t
-- ---------------------------------------------------------------------
-- select 'authed_table_select'  as fact, has_table_privilege('authenticated','public.profiles','SELECT')::text as value
-- union all select 'authed_reads_name',  has_column_privilege('authenticated','public.profiles','name','SELECT')::text
-- union all select 'authed_reads_phone', has_column_privilege('authenticated','public.profiles','phone','SELECT')::text
-- union all select 'authed_can_delete',  has_table_privilege('authenticated','public.profiles','DELETE')::text
-- union all select 'inspector_is_portal_role',
--   (select (qual like '%inspector%') from pg_policies
--     where schemaname='public' and tablename='profiles' and policyname='profiles_select')::text
-- union all select 'trigger_defaults_cleaner',
--   (select pg_get_functiondef(oid) ~ '''cleaner''' from pg_proc
--     where proname='handle_new_user' and pronamespace='public'::regnamespace)::text
-- union all select 'approve_has_self_guard',
--   (select pg_get_functiondef(oid) ~ 'carried out' from pg_proc
--     where proname='approve_assignment' and pronamespace='public'::regnamespace)::text
-- order by 1;
--
-- Then, signed in as a non-admin, confirm the column is genuinely gone:
--   select phone from public.profiles limit 1;
--   -- ERROR:  permission denied for column phone  (or for table profiles)
