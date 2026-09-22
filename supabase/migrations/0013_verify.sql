-- =====================================================================
-- Behavioural verification for 0013_rounds_follow_up.sql
--
-- Run AFTER the migration. It builds a throwaway site, place, round
-- template and schedule, then walks the whole story: guards, scheduling,
-- reassign, a wrong answer, follow-up surviving its deadline, the fix,
-- and unassign keeping started work.
--
-- IT NEVER COMMITS. The block ends by raising on purpose:
--
--     ERROR:  ALL 0013 CHECKS PASSED (rolled back by design)
--
-- is SUCCESS. Any message starting "FAIL:" is a failure. Raising — rather
-- than relying on the begin/rollback around it — means no fixture row can
-- survive even if a client runs statements outside one transaction.
--
-- Uses existing profiles (one admin, two active cleaners/inspectors) as the
-- actors, and switches between them through request.jwt.claims, which is
-- where auth.uid() reads the caller from.
-- =====================================================================

begin;

do $$
declare
  v_admin uuid; v_staff uuid; v_staff2 uuid; v_nobody uuid := gen_random_uuid();
  v_site uuid; v_tpl uuid; v_rt uuid; v_round uuid; v_task uuid; v_task_b uuid;
  v_rule_item uuid; v_plain_item uuid;
  v_tomorrow date := (now() at time zone 'Africa/Cairo')::date + 1;
  v_res jsonb; v_n int; v_s text; v_t text; v_first_submitted timestamptz;
begin
  select id into v_admin  from public.profiles where role = 'admin' limit 1;
  select id into v_staff  from public.profiles where active and role in ('cleaner', 'inspector') order by id limit 1;
  select id into v_staff2 from public.profiles where active and role in ('cleaner', 'inspector') order by id offset 1 limit 1;
  if v_admin is null or v_staff is null then
    raise exception 'FAIL: need at least one admin and one active cleaner/inspector profile';
  end if;

  -- ---- answer rule ----------------------------------------------------
  if not (public.answer_ok('{"eq":"yes"}', ' YES ')
          and not public.answer_ok('{"eq":"yes"}', 'no')
          and not public.answer_ok('{"eq":"yes"}', null)
          and public.answer_ok('{"eq":"Clean"}', 'clean')
          and public.answer_ok('{"min":1,"max":3}', '٢٫٥')
          and public.answer_ok('{"min":1,"max":3}', '2,5')
          and not public.answer_ok('{"min":1,"max":3}', '3,5')
          and not public.answer_ok('{"min":1}', 'abc')
          and public.answer_ok('{"max":0}', '-4')
          and public.answer_ok('{"foo":1}', 'x')
          and public.answer_ok('{"eq":null}', 'x')
          and public.answer_ok(null, 'anything')) then
    raise exception 'FAIL: answer_ok rules';
  end if;

  -- ---- fixtures (rolled back) -------------------------------------------
  insert into public.sites (name_en, name_ar) values ('[verify] Gym', '[verify] الصالة')
  returning id into v_site;
  insert into public.templates (title_en, title_ar, site_id, items)
  values ('[verify] Gym', '[verify] الصالة', v_site,
          '[{"id":"verify-rule","text_en":"Dryer works?","text_ar":"المجفف يعمل؟","type":"yesno",
             "critical":false,"requires_photo":false,"correct":{"eq":"yes"}},
            {"id":"verify-plain","text_en":"Floor mopped","text_ar":"الأرضية ممسوحة","type":"yesno",
             "critical":false,"requires_photo":false}]'::jsonb)
  returning id into v_tpl;
  insert into public.round_templates (title_en, title_ar, places)
  values ('[verify] Zone 1 Morning', '[verify] المنطقة ١ صباحًا',
          jsonb_build_array(jsonb_build_object('template_id', v_tpl, 'window_start', '07:00', 'window_end', '07:30')))
  returning id into v_rt;

  -- ---- guards fail closed -------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_nobody, 'role', 'authenticated')::text, true);
  begin
    perform public.schedule_rounds('[]'::jsonb);
    raise exception 'FAIL: a caller with no profile scheduled rounds';
  exception when others then
    if sqlerrm not like 'Only admins%' then raise; end if;
  end;
  begin
    perform public.create_assignment('x', 'x', v_site, v_staff, v_tomorrow, '07:00', '08:00', '[]'::jsonb);
    raise exception 'FAIL: a caller with no profile created an assignment';
  exception when others then
    if sqlerrm not like 'Only admins%' then raise; end if;
  end;
  begin
    perform public.approve_assignment(gen_random_uuid());
    raise exception 'FAIL: a caller with no profile reached approve_assignment';
  exception when others then
    if sqlerrm not like 'Only admins%' then raise; end if;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  begin
    perform public.schedule_rounds('[]'::jsonb);
    raise exception 'FAIL: a cleaner/inspector scheduled rounds';
  exception when others then
    if sqlerrm not like 'Only admins%' then raise; end if;
  end;

  -- ---- scheduling, as the admin -------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  begin
    perform public.schedule_rounds(jsonb_build_array(jsonb_build_object(
      'round_template_id', v_rt, 'date', v_tomorrow - 2, 'assignee_id', v_staff)));
    raise exception 'FAIL: scheduled into the past';
  exception when others then
    if sqlerrm <> 'PAST_DATE' then raise; end if;
  end;
  begin
    perform public.schedule_rounds(jsonb_build_array(jsonb_build_object(
      'round_template_id', v_rt, 'date', v_tomorrow, 'assignee_id', v_admin)));
    raise exception 'FAIL: an admin was accepted as a round assignee';
  exception when others then
    if sqlerrm <> 'INVALID_ASSIGNEE' then raise; end if;
  end;

  v_res := public.schedule_rounds(jsonb_build_array(jsonb_build_object(
    'round_template_id', v_rt, 'date', v_tomorrow, 'assignee_id', v_staff)));
  if (v_res ->> 'created')::int <> 1 then
    raise exception 'FAIL: expected 1 task created, got %', v_res;
  end if;

  select id into v_round from public.rounds where round_template_id = v_rt and scheduled_date = v_tomorrow;
  select id into v_task from public.submissions where round_id = v_round;
  if v_task is null then raise exception 'FAIL: the task is not stamped with round_id'; end if;

  if not exists (select 1 from public.submissions
                  where id = v_task and inspector_id = v_staff and scheduled_date = v_tomorrow
                    and window_start = '07:00' and window_end = '07:30' and source_template_id = v_tpl) then
    raise exception 'FAIL: the task did not take the place''s window / assignee / template';
  end if;

  select id into v_rule_item  from public.assignment_items where assignment_id = v_task and template_item_id = 'verify-rule';
  select id into v_plain_item from public.assignment_items where assignment_id = v_task and template_item_id = 'verify-plain';
  if v_rule_item is null or v_plain_item is null then
    raise exception 'FAIL: template_item_id provenance lost';
  end if;
  if (select correct from public.assignment_items where id = v_rule_item) is distinct from '{"eq":"yes"}'::jsonb
     or (select correct from public.assignment_items where id = v_plain_item) is not null then
    raise exception 'FAIL: correct was not copied onto the items as written';
  end if;

  select round_title_en into v_t from public.assignments_v where id = v_task;
  if v_t is distinct from '[verify] Zone 1 Morning' then
    raise exception 'FAIL: assignments_v.round_title_en = %', v_t;
  end if;

  v_res := public.schedule_rounds(jsonb_build_array(jsonb_build_object(
    'round_template_id', v_rt, 'date', v_tomorrow, 'assignee_id', v_staff)));
  if (v_res ->> 'created')::int <> 0 then
    raise exception 'FAIL: re-running the same plan created tasks again: %', v_res;
  end if;

  -- ---- reassign an untouched round ----------------------------------------
  if v_staff2 is not null then
    v_res := public.schedule_rounds(jsonb_build_array(jsonb_build_object(
      'round_template_id', v_rt, 'date', v_tomorrow, 'assignee_id', v_staff2)));
    if (v_res ->> 'moved')::int <> 1
       or (select inspector_id from public.submissions where id = v_task) <> v_staff2 then
      raise exception 'FAIL: reassigning an untouched round did not move its task: %', v_res;
    end if;
    perform public.schedule_rounds(jsonb_build_array(jsonb_build_object(
      'round_template_id', v_rt, 'date', v_tomorrow, 'assignee_id', v_staff)));
  else
    raise notice 'skipped the reassign check: only one active cleaner/inspector exists';
  end if;

  -- ---- a wrong answer, as the assignee ------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

  perform public.mark_item_done(v_rule_item, null, 'no');
  perform public.mark_item_done(p_item_id := v_plain_item, p_note := null);   -- the old 2-arg named call

  select status into v_s from public.assignment_items where id = v_rule_item;
  if v_s <> 'follow_up' then raise exception 'FAIL: wrong answer should flag the item, got %', v_s; end if;
  select status into v_s from public.assignment_items where id = v_plain_item;
  if v_s <> 'done' then raise exception 'FAIL: an item with no rule should be done, got %', v_s; end if;

  perform public.submit_assignment(v_task, 'signatures/verify.png', now());
  select effective_status, submitted_at into v_s, v_first_submitted from public.assignments_v where id = v_task;
  if v_s <> 'follow_up' then raise exception 'FAIL: a round with a wrong answer should be follow_up, got %', v_s; end if;

  -- follow_up survives its deadline
  update public.submissions set scheduled_date = v_tomorrow - 3 where id = v_task;
  select effective_status into v_s from public.assignments_v where id = v_task;
  if v_s <> 'follow_up' then raise exception 'FAIL: follow_up expired, got %', v_s; end if;

  -- the fix
  perform public.mark_item_done(v_rule_item, null, 'YES');
  select status, flagged_answer into v_s, v_t from public.assignment_items where id = v_rule_item;
  if v_s <> 'done' or v_t is distinct from 'no' then
    raise exception 'FAIL: the fix should be done and keep flagged_answer=no, got % / %', v_s, v_t;
  end if;
  perform public.submit_assignment(v_task, 'signatures/verify-2.png', now());
  if (select effective_status from public.assignments_v where id = v_task) <> 'submitted' then
    raise exception 'FAIL: corrected round should be submitted';
  end if;
  if (select submitted_at from public.submissions where id = v_task) is distinct from v_first_submitted then
    raise exception 'FAIL: a correction must keep the first submitted_at';
  end if;

  -- ---- RLS: the assignee still sees the round title --------------------
  execute 'set local role authenticated';
  select round_title_en into v_t from public.assignments_v where id = v_task;
  execute 'reset role';
  if v_t is distinct from '[verify] Zone 1 Morning' then
    raise exception 'FAIL: the assignee cannot read their round title through RLS (got %)', v_t;
  end if;

  -- ---- started work survives reassign and unassign --------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  if v_staff2 is not null then
    v_res := public.schedule_rounds(jsonb_build_array(jsonb_build_object(
      'round_template_id', v_rt, 'date', v_tomorrow, 'assignee_id', v_staff2)));
    if (v_res ->> 'moved')::int <> 0 or (v_res ->> 'kept')::int <> 1
       or (select inspector_id from public.submissions where id = v_task) <> v_staff then
      raise exception 'FAIL: reassign moved a started task: %', v_res;
    end if;
  end if;
  v_res := public.schedule_rounds(jsonb_build_array(jsonb_build_object(
    'round_template_id', v_rt, 'date', v_tomorrow, 'assignee_id', null)));
  if (v_res ->> 'removed')::int <> 0 or (v_res ->> 'kept')::int <> 1
     or not exists (select 1 from public.submissions where id = v_task)
     or (select assignee_id from public.rounds where id = v_round) is not null then
    raise exception 'FAIL: unassign must keep started work and null the round assignee: %', v_res;
  end if;

  -- an untouched round unassigns cleanly, round row and all
  v_res := public.schedule_rounds(jsonb_build_array(jsonb_build_object(
    'round_template_id', v_rt, 'date', v_tomorrow + 1, 'assignee_id', v_staff)));
  select s.id into v_task_b from public.submissions s
    join public.rounds r on r.id = s.round_id
   where r.round_template_id = v_rt and r.scheduled_date = v_tomorrow + 1;
  v_res := public.schedule_rounds(jsonb_build_array(jsonb_build_object(
    'round_template_id', v_rt, 'date', v_tomorrow + 1, 'assignee_id', null)));
  if (v_res ->> 'removed')::int <> 1
     or exists (select 1 from public.submissions where id = v_task_b)
     or exists (select 1 from public.rounds where round_template_id = v_rt and scheduled_date = v_tomorrow + 1) then
    raise exception 'FAIL: unassigning an untouched round should remove its task and the round: %', v_res;
  end if;

  -- ---- legacy-shaped insert still lands --------------------------------------
  insert into public.submissions (template_id, site_id, inspector_id, inspector_name, answers)
  values (v_tpl, v_site, v_staff, 'legacy', '[]'::jsonb);

  -- ---- permissions and shape ---------------------------------------------------
  if has_function_privilege('anon', 'public.schedule_rounds(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.mark_item_done(uuid,text,text)', 'execute')
     or has_function_privilege('anon', 'public.submit_assignment(uuid,text,timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.create_assignment(text,text,uuid,uuid,date,time,time,jsonb,uuid,uuid)', 'execute')
     or has_table_privilege('anon', 'public.assignments_v', 'select') then
    raise exception 'FAIL: anon can reach 0013 objects';
  end if;
  select count(*) into v_n from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'mark_item_done';
  if v_n <> 1 then raise exception 'FAIL: % mark_item_done overloads (expected 1)', v_n; end if;
  if (select array_to_string(reloptions, ',') from pg_class where oid = 'public.assignments_v'::regclass)
     is distinct from 'security_invoker=on' then
    raise exception 'FAIL: assignments_v lost security_invoker';
  end if;

  raise exception 'ALL 0013 CHECKS PASSED (rolled back by design)';
end
$$;

rollback;
