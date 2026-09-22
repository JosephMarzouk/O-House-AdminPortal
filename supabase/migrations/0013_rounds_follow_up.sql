-- =====================================================================
-- 0013 — zone rounds, answer capture + correct answers + follow-up,
--        and the review RPCs the task tracker board drives
-- Target: Supabase project ptonujazlljpkgpfrkpw ("Check List")
-- Status: APPLIED 2026-09-21 (SQL Editor). Verified the same day with the
--         read-only check at the foot of this file — every column true.
--
-- The replaced function bodies were taken from the LIVE database
-- (pg_get_functiondef, 2026-09-21), not from the earlier files in this
-- folder: supabase/README.md's first section is why. Every change against
-- those live bodies is marked "0013".
--
-- What this adds, and why it is shaped this way:
--
--   * Answers. Until now the phone ticked items and stored no value, so an
--     item's `type` (yes/no, pass/fail, number, text) changed nothing.
--     assignment_items gains `answer`, and mark_item_done() takes it.
--
--   * Correct answers + follow-up. An item may carry `correct` — copied
--     from templates.items[].correct by create_assignment(). A wrong answer
--     makes the item `follow_up` instead of `done`; submitting with any
--     item still wrong leaves the round `follow_up` rather than
--     `submitted`. Only the assignee's corrected answer clears it — there is
--     no admin path, by design. The first wrong answer and when it was given
--     are kept (flagged_answer / flagged_at) so the history survives the fix.
--
--     A NEW key, not the legacy `expected`: the old inspector web client
--     still reads expected / follow_up_on / scored with its own meaning
--     (scoring, and an `actions` row on a matching answer). Reusing
--     `expected` would have changed what that client does.
--
--   * follow_up never expires. assignments_v clock-expires every status it
--     does not pass through, and a correction can take days (a broken dryer
--     waits for a part). submit_assignment() skips the deadline for a round
--     already in follow_up, and a correction keeps the first submission's
--     times so lateness is judged on the round, not on the repair.
--
--   * Zone rounds. round_templates = an ordered list of places (templates
--     rows) with a fixed window each. rounds = one round template on one day
--     for one person. schedule_rounds() — the week planner's Save — turns a
--     round into one ordinary assignment per place via create_assignment(),
--     stamped with submissions.round_id, so the app and every existing
--     screen keep working on plain assignments.
--
--   * Fail-closed guards. Live current_role() returns NULL for a user with
--     no profile row, and `NULL not in (...)` is NULL, which PL/pgSQL reads
--     as false — the guard never fires. Every function this file creates or
--     replaces uses coalesce(current_role(), 'none'), including the three
--     review RPCs the tracker board makes the admin's main tools.
--
-- Additive and re-runnable: widened CHECKs, `if not exists` columns and
-- tables, drop-and-create for policies and the view, create-or-replace for
-- functions. Legacy inserts are untouched — they default to 'pending' and
-- never set round_id.
-- =====================================================================

begin;

-- 1. Status vocabulary + answer columns ---------------------------------
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check
  check (status in ('pending','in_progress','submitted','approved','rejected','follow_up'));

alter table public.assignment_items drop constraint if exists assignment_items_status_check;
alter table public.assignment_items add constraint assignment_items_status_check
  check (status in ('pending','done','rejected','follow_up'));

alter table public.assignment_items
  add column if not exists correct        jsonb,        -- copied from templates.items[].correct
  add column if not exists answer         text,         -- the latest answer given
  add column if not exists flagged_answer text,         -- first wrong answer, kept as history
  add column if not exists flagged_at     timestamptz;

-- 2. Round tables -------------------------------------------------------
create table if not exists public.round_templates (
  id         uuid primary key default gen_random_uuid(),
  title_ar   text not null default '',
  title_en   text not null default '',
  -- [{"template_id": uuid, "window_start": "HH:MM", "window_end": "HH:MM"}, ...] in walk order
  places     jsonb not null default '[]'::jsonb check (jsonb_typeof(places) = 'array'),
  active     boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id                uuid primary key default gen_random_uuid(),
  round_template_id uuid not null references public.round_templates(id),
  scheduled_date    date not null,
  assignee_id       uuid references public.profiles(id) on delete set null,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (round_template_id, scheduled_date)
);

alter table public.submissions
  add column if not exists round_id uuid references public.rounds(id) on delete set null;
create index if not exists submissions_round_idx
  on public.submissions (round_id) where round_id is not null;

-- 3. RLS on the new tables (default privileges hand anon everything; take it back)
alter table public.round_templates enable row level security;
alter table public.rounds          enable row level security;

drop policy if exists round_templates_select on public.round_templates;
create policy round_templates_select on public.round_templates
  for select to authenticated using (true);

drop policy if exists round_templates_write on public.round_templates;
create policy round_templates_write on public.round_templates
  for all to authenticated
  using      (coalesce(public.current_role(), 'none') in ('admin', 'manager'))
  with check (coalesce(public.current_role(), 'none') in ('admin', 'manager'));

-- Portal roles, or anyone with a task in the round (keeps the round title
-- visible to a started task's original assignee after a reassign).
drop policy if exists rounds_select on public.rounds;
create policy rounds_select on public.rounds
  for select to authenticated using (
    coalesce(public.current_role(), 'none') in ('admin', 'manager', 'inspector')
    or exists (select 1 from public.submissions s
                where s.round_id = rounds.id and s.inspector_id = auth.uid())
  );

revoke all on public.round_templates, public.rounds from anon;
revoke truncate, references, trigger on public.round_templates from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.rounds from authenticated;

-- 4. assignments_v: follow_up never expires; + round title --------------
drop view if exists public.assignments_v;
create view public.assignments_v with (security_invoker = on) as
select
  a.*,
  coalesce(
    a.extended_until,
    ((a.scheduled_date + (case when a.window_end < a.window_start then 1 else 0 end)) + a.window_end)
      at time zone 'Africa/Cairo'
  ) as deadline,
  case
    when a.status in ('submitted', 'approved', 'rejected', 'follow_up') then a.status
    when a.scheduled_date is null or a.window_end is null then a.status
    when now() > coalesce(
      a.extended_until,
      ((a.scheduled_date + (case when a.window_end < a.window_start then 1 else 0 end)) + a.window_end)
        at time zone 'Africa/Cairo'
    ) then 'expired'
    else a.status
  end as effective_status,
  (a.extended_until is not null) as was_extended,
  rt.title_en as round_title_en,
  rt.title_ar as round_title_ar
from public.submissions a
left join public.rounds r           on r.id  = a.round_id
left join public.round_templates rt on rt.id = r.round_template_id;

comment on view public.assignments_v is
  'Read effective_status, never submissions.status. follow_up never expires. The +1 day handles overnight windows (22:00-02:00), matching template_window_open(). Africa/Cairo throughout.';

revoke all on public.assignments_v from anon;
revoke insert, update, delete, truncate, references, trigger on public.assignments_v from authenticated;
grant select on public.assignments_v to authenticated;

-- 5. Answer rule ----------------------------------------------------------
-- correct = {"eq": "<text>"}  (yes/no, pass/fail, text; case/space-insensitive)
--        or {"min": n, "max": n} (either bound optional; exact value = min = max).
-- No rule, or a malformed one, never flags. Arabic-Indic digits, the Arabic
-- decimal separator and a comma are normalised before a numeric compare.
create or replace function public.answer_ok(p_correct jsonb, p_answer text)
returns boolean language plpgsql immutable set search_path to 'public'
as $fn$
declare
  v_num text := translate(btrim(coalesce(p_answer, '')),
                          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫,',
                          '01234567890123456789..');
  v numeric;
begin
  if p_correct is null or jsonb_typeof(p_correct) <> 'object' then
    return true;
  end if;
  if jsonb_typeof(p_correct -> 'eq') = 'string' then
    return lower(btrim(coalesce(p_answer, ''))) = lower(btrim(p_correct ->> 'eq'));
  end if;
  if jsonb_typeof(p_correct -> 'min') is distinct from 'number'
     and jsonb_typeof(p_correct -> 'max') is distinct from 'number' then
    return true;
  end if;
  if v_num !~ '^-?[0-9]+(\.[0-9]+)?$' then
    return false;
  end if;
  v := v_num::numeric;
  return (jsonb_typeof(p_correct -> 'min') is distinct from 'number' or v >= (p_correct ->> 'min')::numeric)
     and (jsonb_typeof(p_correct -> 'max') is distinct from 'number' or v <= (p_correct ->> 'max')::numeric);
end;
$fn$;

-- 6. create_assignment: live body + fail-closed guard + copy `correct` -------
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
  -- 0013: coalesce. Live current_role() is NULL for a user with no profile
  -- row, and NULL NOT IN (...) is NULL, which let the call through.
  if coalesce(public.current_role(), 'none') not in ('admin', 'manager', 'inspector') then
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
      type, critical, requires_photo, sort_order, correct
    ) values (
      v_id,
      v_item ->> 'id',
      coalesce(v_item ->> 'text_en', ''),
      coalesce(v_item ->> 'text_ar', ''),
      coalesce(v_item ->> 'type', 'yesno'),
      coalesce((v_item ->> 'critical')::bool, false),
      coalesce((v_item ->> 'requires_photo')::bool, false),
      v_i,
      case when jsonb_typeof(v_item -> 'correct') = 'object' then v_item -> 'correct' end  -- 0013
    );
    v_i := v_i + 1;
  end loop;

  return v_id;
end;
$function$;

-- 7. mark_item_done: + p_answer ---------------------------------------------
-- A wrong (or missing) answer on an item with a correct rule becomes
-- follow_up instead of done; the first wrong answer is kept. Deliberately
-- never raises for a missing answer: the app's outbox retries unknown errors
-- and would jam behind it. answer_ok(rule, NULL) is already false.
drop function if exists public.mark_item_done(uuid, text);
create or replace function public.mark_item_done(
  p_item_id uuid, p_note text default null, p_answer text default null
) returns void language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_assignment uuid; v_assignee uuid; v_status text; v_correct jsonb; v_ok boolean;
  v_answer text := nullif(btrim(p_answer), '');
begin
  select i.assignment_id, s.inspector_id, s.status, i.correct
    into v_assignment, v_assignee, v_status, v_correct
  from public.assignment_items i
  join public.submissions s on s.id = i.assignment_id
  where i.id = p_item_id;

  if v_assignment is null then raise exception 'Item not found'; end if;
  if v_assignee is distinct from auth.uid() then raise exception 'Not authorized'; end if;
  if v_status in ('submitted', 'approved') then raise exception 'Assignment is closed'; end if;

  v_ok := coalesce(public.answer_ok(v_correct, v_answer), false);

  update public.assignment_items
     set status         = case when v_ok then 'done' else 'follow_up' end,
         done_at        = case when v_ok then now() end,
         note           = coalesce(p_note, note),
         reject_note    = null,
         answer         = coalesce(v_answer, answer),
         flagged_answer = case when v_ok then flagged_answer else coalesce(flagged_answer, v_answer) end,
         flagged_at     = case when v_ok then flagged_at     else coalesce(flagged_at, now()) end
   where id = p_item_id;

  update public.submissions set status = 'in_progress'
   where id = v_assignment and status = 'pending';
end;
$fn$;

-- 8. submit_assignment: live (0006) body + follow-up -------------------------
create or replace function public.submit_assignment(
  p_assignment_id uuid,
  p_signature_path text,
  p_completed_at timestamptz default null
) returns void language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_assignee uuid; v_status text; v_deadline timestamptz;
  v_answered int; v_flagged int; v_missing_photo int; v_late bool := false;
begin
  select a.inspector_id, a.status, v.deadline
    into v_assignee, v_status, v_deadline
  from public.submissions a
  join public.assignments_v v on v.id = a.id
  where a.id = p_assignment_id;

  if v_assignee is null then raise exception 'Assignment not found'; end if;
  if v_assignee is distinct from auth.uid() then raise exception 'Not authorized'; end if;
  if v_status in ('submitted','approved') then return; end if;   -- idempotent replay

  -- 0013: an item answered wrong (follow_up) is still answered work, and
  -- still owes its photo.
  select count(*) filter (where status in ('done', 'follow_up')),
         count(*) filter (where status = 'follow_up'),
         count(*) filter (where status in ('done', 'follow_up') and requires_photo
                            and coalesce(array_length(photo_paths, 1), 0) = 0)
    into v_answered, v_flagged, v_missing_photo
    from public.assignment_items
   where assignment_id = p_assignment_id;

  if v_answered = 0 then
    raise exception 'EMPTY_SUBMISSION: no item(s) done';
  end if;
  if v_missing_photo > 0 then
    raise exception 'MISSING_PHOTO: % item(s) require a photo', v_missing_photo;
  end if;

  -- Late sync as before (0006). 0013: skipped when the round is already in
  -- follow_up — it was submitted once; a correction has no deadline.
  if v_status <> 'follow_up' and v_deadline is not null then
    if p_completed_at is not null and p_completed_at <= v_deadline then
      v_late := now() > v_deadline;
    elsif now() > v_deadline then
      raise exception 'ASSIGNMENT_EXPIRED';
    end if;
  end if;

  -- 0013: any item still wrong keeps the round in follow_up. A correction
  -- keeps the first submission's times, so lateness is judged on the round
  -- itself and not on how long a repair took.
  update public.submissions
     set status        = case when v_flagged > 0 then 'follow_up' else 'submitted' end,
         submitted_at  = case when v_status = 'follow_up' then submitted_at else now() end,
         completed_at  = case when v_status = 'follow_up' then completed_at
                              else coalesce(p_completed_at, now()) end,
         late_sync     = case when v_status = 'follow_up' then late_sync else v_late end,
         signature_url = p_signature_path
   where id = p_assignment_id;
end;
$fn$;

-- 9. The tracker's review RPCs: live bodies, fail-closed guard only ----------
create or replace function public.approve_assignment(p_assignment_id uuid, p_score integer default null)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(public.current_role(), 'none') not in ('admin', 'manager', 'inspector') then
    raise exception 'Only admins/managers/inspectors can approve assignments';
  end if;

  -- Nobody signs off their own work (0011).
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
  if coalesce(public.current_role(), 'none') not in ('admin', 'manager', 'inspector') then
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
  if coalesce(public.current_role(), 'none') not in ('admin', 'manager', 'inspector') then
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
     and status not in ('submitted', 'approved', 'follow_up');   -- 0013: follow_up never expires
end;
$function$;

-- 10. schedule_rounds: the week planner's Save --------------------------------
-- One cell = one round template on one day.
--   assignee set  -> upsert the round, move its untouched tasks to the new
--                    person, create a task per place not yet in the round.
--   assignee null -> delete untouched tasks; keep started ones (assignee -> NULL).
-- "Untouched" = task still 'pending' with no item answered or photographed,
-- re-checked inside each UPDATE/DELETE so a task started mid-save is left
-- alone. Photo evidence is never deleted.
create or replace function public.schedule_rounds(p_plan jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_cell jsonb; v_rt uuid; v_date date; v_assignee uuid; v_name text;
  v_round uuid; v_place record; v_new uuid; v_n int;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_created int := 0; v_moved int := 0; v_removed int := 0; v_kept int := 0; v_skipped int := 0;
begin
  if coalesce(public.current_role(), 'none') not in ('admin', 'manager') then
    raise exception 'Only admins/managers can schedule rounds';
  end if;
  if jsonb_typeof(p_plan) is distinct from 'array' then
    raise exception 'INVALID_PLAN';
  end if;

  for v_cell in select value from jsonb_array_elements(p_plan)
  loop
    v_rt       := nullif(v_cell ->> 'round_template_id', '')::uuid;
    v_date     := nullif(v_cell ->> 'date', '')::date;
    v_assignee := nullif(v_cell ->> 'assignee_id', '')::uuid;

    if v_rt is null or v_date is null then raise exception 'INVALID_PLAN'; end if;
    if v_date < v_today then raise exception 'PAST_DATE'; end if;

    if v_assignee is null then
      select id into v_round from public.rounds
       where round_template_id = v_rt and scheduled_date = v_date
       for update;
      continue when v_round is null;

      delete from public.submissions s
       where s.round_id = v_round and s.status = 'pending'
         and not exists (select 1 from public.assignment_items i
                          where i.assignment_id = s.id
                            and (i.status <> 'pending' or cardinality(i.photo_paths) > 0));
      get diagnostics v_n = row_count;
      v_removed := v_removed + v_n;

      select count(*) into v_n from public.submissions where round_id = v_round;
      v_kept := v_kept + v_n;
      if v_n = 0 then
        delete from public.rounds where id = v_round;
      else
        update public.rounds set assignee_id = null where id = v_round;
      end if;
      continue;
    end if;

    select name into v_name from public.profiles
     where id = v_assignee and active and role in ('cleaner', 'inspector');
    if v_name is null then raise exception 'INVALID_ASSIGNEE'; end if;

    insert into public.rounds (round_template_id, scheduled_date, assignee_id, created_by)
    values (v_rt, v_date, v_assignee, auth.uid())
    on conflict (round_template_id, scheduled_date)
      do update set assignee_id = excluded.assignee_id
    returning id into v_round;

    update public.submissions s
       set inspector_id = v_assignee, inspector_name = v_name
     where s.round_id = v_round
       and s.inspector_id is distinct from v_assignee
       and s.status = 'pending'
       and not exists (select 1 from public.assignment_items i
                        where i.assignment_id = s.id
                          and (i.status <> 'pending' or cardinality(i.photo_paths) > 0));
    get diagnostics v_n = row_count;
    v_moved := v_moved + v_n;

    select count(*) into v_n from public.submissions
     where round_id = v_round and inspector_id is distinct from v_assignee;
    v_kept := v_kept + v_n;

    for v_place in
      select t.id, t.title_en, t.title_ar, t.site_id, t.items,
             nullif(e.p ->> 'window_start', '')::time as ws,
             nullif(e.p ->> 'window_end', '')::time   as we
        from public.round_templates rt
       cross join lateral jsonb_array_elements(rt.places) with ordinality as e(p, ord)
        join public.templates t on t.id::text = e.p ->> 'template_id'
       where rt.id = v_rt
         and not exists (select 1 from public.submissions s
                          where s.round_id = v_round and s.source_template_id = t.id)
       order by e.ord
    loop
      if v_place.site_id is null or v_place.ws is null or v_place.we is null
         or (case when jsonb_typeof(v_place.items) = 'array'
                  then jsonb_array_length(v_place.items) else 0 end) = 0 then
        v_skipped := v_skipped + 1;   -- a place with no site, window or checklist
        continue;
      end if;

      -- Item ids are kept, so assignment_items.template_item_id links back.
      v_new := public.create_assignment(
        v_place.title_en, v_place.title_ar, v_place.site_id, v_assignee,
        v_date, v_place.ws, v_place.we, v_place.items, v_place.id, null);
      update public.submissions set round_id = v_round where id = v_new;
      v_created := v_created + 1;
    end loop;
  end loop;

  return jsonb_build_object('created', v_created, 'moved', v_moved, 'removed', v_removed,
                            'kept', v_kept, 'skipped', v_skipped);
end;
$fn$;

-- 11. Permissions: nothing here is callable by anon or via PUBLIC ------------
revoke execute on function
  public.answer_ok(jsonb, text),
  public.schedule_rounds(jsonb),
  public.create_assignment(text, text, uuid, uuid, date, time, time, jsonb, uuid, uuid),
  public.mark_item_done(uuid, text, text),
  public.submit_assignment(uuid, text, timestamptz),
  public.approve_assignment(uuid, integer),
  public.reject_items(uuid, uuid[], text),
  public.extend_assignment(uuid, timestamptz, text)
from public, anon;

grant execute on function
  public.schedule_rounds(jsonb),
  public.create_assignment(text, text, uuid, uuid, date, time, time, jsonb, uuid, uuid),
  public.mark_item_done(uuid, text, text),
  public.submit_assignment(uuid, text, timestamptz),
  public.approve_assignment(uuid, integer),
  public.reject_items(uuid, uuid[], text),
  public.extend_assignment(uuid, timestamptz, text)
to authenticated;

notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------------------
-- Verification — run it, read it. Read-only; every column must be true.
-- Behaviour (scheduling, follow-up, guards) is exercised by
-- 0013_verify.sql, which rolls itself back.
-- ---------------------------------------------------------------------
-- select
--   (select count(*) from pg_proc
--     where pronamespace = 'public'::regnamespace and proname = 'mark_item_done') = 1 as one_mark_item_done,
--   to_regprocedure('public.mark_item_done(uuid,text,text)') is not null           as mark_item_done_takes_answer,
--   to_regprocedure('public.schedule_rounds(jsonb)') is not null                   as schedule_rounds_exists,
--   to_regclass('public.rounds') is not null
--     and to_regclass('public.round_templates') is not null                        as round_tables_exist,
--   pg_get_viewdef('public.assignments_v'::regclass) like '%follow_up%'            as view_never_expires_follow_up,
--   (select array_to_string(reloptions, ',') from pg_class
--     where oid = 'public.assignments_v'::regclass) = 'security_invoker=on'        as view_security_invoker,
--   not has_table_privilege('anon', 'public.assignments_v', 'select')              as anon_cannot_read_view,
--   not has_function_privilege('anon', 'public.mark_item_done(uuid,text,text)', 'execute')
--     and not has_function_privilege('anon', 'public.submit_assignment(uuid,text,timestamptz)', 'execute')
--     and not has_function_privilege('anon', 'public.schedule_rounds(jsonb)', 'execute') as anon_cannot_call_rpcs,
--   public.answer_ok('{"eq":"yes"}', ' YES ')
--     and not public.answer_ok('{"eq":"yes"}', 'no')
--     and not public.answer_ok('{"eq":"yes"}', null)
--     and public.answer_ok('{"min":1,"max":3}', '٢٫٥')
--     and not public.answer_ok('{"min":1,"max":3}', '3,5')
--     and not public.answer_ok('{"min":1}', 'abc')
--     and public.answer_ok('{"foo":1}', 'x')
--     and public.answer_ok(null, 'anything')                                      as answer_rules_ok;
