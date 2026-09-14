/**
 * Proves that every create path in the portal actually reaches Postgres.
 *
 * `pnpm check` covers the pure rules and `pnpm verify:live` covers reads; a
 * write that silently affects zero rows would pass both. This runs the same
 * three inserts the portal's forms run — department, place, assignment — and
 * reads each one back before deleting it.
 *
 * It signs in as ADMIN_EMAIL rather than using the service-role key, on
 * purpose: service_role bypasses RLS, so it would prove the SQL works while
 * saying nothing about whether a real admin is allowed to run it. Every write
 * here goes through the policies the portal actually meets. The one exception
 * is staff creation, which needs the service-role key by design — it is
 * checked separately at the end, and is the only step that can be skipped.
 *
 * Everything created is prefixed [verify] and removed in reverse dependency
 * order, including on failure. If the script dies hard enough to skip its own
 * cleanup, the leftovers are greppable by that prefix.
 *
 * Run: pnpm verify:writes
 */
import { installNodeWebSocket } from '../lib/node-ws';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { STAFF_ROLES, type Database } from '../lib/types/database';

installNodeWebSocket(); // must run before createClient — see lib/node-ws.ts

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TAG = '[verify]';

type DB = SupabaseClient<Database>;

/** Reverse-ordered teardown. Registered as each row is created, so a failure
 *  half way through still unwinds exactly what exists. */
const cleanup: { what: string; run: () => Promise<void> }[] = [];

let failures = 0;

function pass(step: string, detail = '') {
  console.log(`  OK   ${step}${detail ? `  ${detail}` : ''}`);
}

function fail(step: string, why: string) {
  failures++;
  console.log(`  FAIL ${step}\n       ${why}`);
}

async function connect(): Promise<{ sb: DB; userId: string }> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'This script must run as a real admin — service_role would bypass the\n' +
        'policies it exists to test. Add ADMIN_EMAIL + ADMIN_PASSWORD to .env.local.',
    );
  }

  const sb = createClient<Database>(URL, ANON);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    throw new Error(`${email} is '${profile?.role ?? 'unknown'}', not admin — nothing to test.`);
  }

  return { sb, userId: data.user.id };
}

/* ---------------------------------------------------------------- */
/* 1. Department — components/departments/departments-manager.tsx    */
/* ---------------------------------------------------------------- */
async function checkDepartment(sb: DB): Promise<string | null> {
  const { error } = await sb
    .from('departments')
    .insert({ name_ar: `${TAG} قسم`, name_en: `${TAG} Department` });
  if (error) {
    fail('departments insert', error.message);
    return null;
  }

  // Read it back through a fresh SELECT rather than trusting .select() on the
  // insert — the question is whether it is *in the table*, visible to a
  // subsequent request, which is what the portal's next page load will do.
  const { data } = await sb.from('departments').select('id').eq('name_en', `${TAG} Department`);
  if (!data?.length) {
    fail('departments insert', 'insert reported success but the row is not readable back');
    return null;
  }

  const id = data[0].id;
  cleanup.push({
    what: `department ${id}`,
    run: async () => void (await sb.from('departments').delete().eq('id', id)),
  });
  pass('departments insert', id);
  return id;
}

/* ---------------------------------------------------------------- */
/* 2. Place — components/places/place-form.tsx (savePlace)           */
/*    A place is a `templates` row plus its twin in `sites`.         */
/* ---------------------------------------------------------------- */
async function checkPlace(sb: DB, departmentId: string | null) {
  const { data: site, error: siteErr } = await sb
    .from('sites')
    .insert({ name_ar: `${TAG} مكان`, name_en: `${TAG} Place` })
    .select('id')
    .single();
  if (siteErr || !site) {
    fail('sites insert', siteErr?.message ?? 'no row returned');
    return null;
  }
  cleanup.push({
    what: `site ${site.id}`,
    run: async () => void (await sb.from('sites').delete().eq('id', site.id)),
  });
  pass('sites insert', site.id);

  const { data: template, error: tplErr } = await sb
    .from('templates')
    .insert({
      title_ar: `${TAG} مكان`,
      title_en: `${TAG} Place`,
      department_id: departmentId,
      site_id: site.id,
      items: [
        { id: crypto.randomUUID(), text_ar: 'بند', text_en: 'Item', type: 'yesno', critical: false, requires_photo: false },
      ],
    })
    .select('id')
    .single();
  if (tplErr || !template) {
    fail('templates insert', tplErr?.message ?? 'no row returned');
    return null;
  }
  cleanup.push({
    what: `template ${template.id}`,
    run: async () => void (await sb.from('templates').delete().eq('id', template.id)),
  });

  // The twin must be joined up, or create_assignment has no p_site_id to take
  // and the place can never be assigned — the drift migration 0007 cleaned up.
  const { data: readBack } = await sb
    .from('templates')
    .select('id, site_id, items')
    .eq('id', template.id)
    .maybeSingle();
  if (!readBack) {
    fail('templates insert', 'insert reported success but the row is not readable back');
    return null;
  }
  if (readBack.site_id !== site.id) {
    fail('templates insert', `site_id is ${readBack.site_id}, expected ${site.id}`);
    return null;
  }
  if (!Array.isArray(readBack.items) || readBack.items.length !== 1) {
    fail('templates insert', 'items did not round-trip');
    return null;
  }
  pass('templates insert', template.id);

  // The edit path is the one that can silently affect zero rows under RLS.
  const { data: updated, error: updErr } = await sb
    .from('templates')
    .update({ title_en: `${TAG} Place renamed` })
    .eq('id', template.id)
    .select('id');
  if (updErr) fail('templates update', updErr.message);
  else if (!updated?.length) fail('templates update', 'affected zero rows (RLS blocked it silently)');
  else pass('templates update', `${updated.length} row`);

  return { templateId: template.id, siteId: site.id };
}

/* ---------------------------------------------------------------- */
/* 3. Assignment — components/assignments/new-assignment-form.tsx    */
/*    create_assignment writes submissions + assignment_items.       */
/* ---------------------------------------------------------------- */
async function checkAssignment(
  sb: DB,
  place: { templateId: string; siteId: string },
  assigneeId: string,
) {
  const { data: id, error } = await sb.rpc('create_assignment', {
    p_title_ar: `${TAG} مهمة`,
    p_title_en: `${TAG} Assignment`,
    p_site_id: place.siteId,
    // Assigned to the admin running this, so no real staff member sees a
    // phantom task appear and vanish on their phone.
    p_assignee_id: assigneeId,
    p_scheduled_date: new Date().toISOString().slice(0, 10),
    p_window_start: '08:00',
    p_window_end: '17:00',
    p_items: [
      { id: crypto.randomUUID(), text_ar: 'بند ١', text_en: 'Item 1', type: 'yesno', critical: false, requires_photo: false },
      { id: crypto.randomUUID(), text_ar: 'بند ٢', text_en: 'Item 2', type: 'yesno', critical: true, requires_photo: true },
    ],
    p_source_template_id: place.templateId,
    p_client_id: crypto.randomUUID(),
  });
  if (error || !id) {
    fail('create_assignment', error?.message ?? 'returned no id');
    return;
  }

  const assignmentId = id as unknown as string;
  cleanup.push({
    what: `assignment ${assignmentId} (items cascade)`,
    run: async () => void (await sb.from('submissions').delete().eq('id', assignmentId)),
  });
  pass('create_assignment', assignmentId);

  const { data: row } = await sb
    .from('assignments_v')
    .select('id, status, deadline, site_name_en')
    .eq('id', assignmentId)
    .maybeSingle();
  if (!row) {
    fail('assignment read-back', 'the RPC returned an id that assignments_v cannot see');
  } else if (row.status !== 'pending') {
    fail('assignment read-back', `status is '${row.status}', expected 'pending'`);
  } else if (!row.deadline) {
    // deadline is computed from scheduled_date + window_end; a null one means
    // the schedule did not land, and the assignment can then never expire.
    fail('assignment read-back', 'deadline is null — the schedule did not persist');
  } else {
    pass('assignment read-back', `status=${row.status} deadline=${row.deadline}`);
  }

  const { data: items } = await sb
    .from('assignment_items')
    .select('id, sort_order, critical, requires_photo')
    .eq('assignment_id', assignmentId)
    .order('sort_order');
  if (items?.length !== 2) {
    fail('assignment_items', `wrote ${items?.length ?? 0} items, expected 2`);
  } else if (!items[1].critical || !items[1].requires_photo) {
    fail('assignment_items', 'per-item flags did not round-trip');
  } else {
    pass('assignment_items', `2 items, sort_order ${items.map((i) => i.sort_order).join(',')}`);
  }
}

/* ---------------------------------------------------------------- */
/* 4. Staff creation — the one path that needs the service-role key. */
/* ---------------------------------------------------------------- */
async function checkStaff() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.log('  SKIP staff creation  (no SUPABASE_SERVICE_ROLE_KEY — the portal would also fail)');
    return;
  }

  const admin = createClient<Database>(URL, key, { auth: { persistSession: false } });
  // A number no real Egyptian mobile uses, so this can never collide with a
  // staff account: the login address is derived from it verbatim.
  const email = '209999999999@ohouse.internal';

  // A leftover from an interrupted earlier run would fail as "already
  // registered" and look like a broken write. Clear it first.
  const { data: existing } = await admin.auth.admin.listUsers();
  const stale = existing?.users.find((u) => u.email === email);
  if (stale) await admin.auth.admin.deleteUser(stale.id);

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: 'verify-only-throwaway',
    email_confirm: true,
    user_metadata: { name: `${TAG} Staff` },
  });
  if (error || !created?.user) {
    fail('auth.admin.createUser', error?.message ?? 'no user returned');
    return;
  }
  cleanup.push({
    what: `auth user ${created.user.id} (profile cascades)`,
    run: async () => void (await admin.auth.admin.deleteUser(created.user.id)),
  });
  pass('auth.admin.createUser', created.user.id);

  // handle_new_user() has been observed not firing for Admin-API-created users
  // on this project. createStaff() fills the row in itself when that happens,
  // so report which path ran rather than just whether a row exists.
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, phone, email')
    .eq('id', created.user.id)
    .maybeSingle();
  if (!profile) {
    fail('profiles row', 'neither the trigger nor a fallback insert produced a row');
    return;
  }
  pass('profiles row', `trigger fired, role=${profile.role} phone=${profile.phone}`);

  // The role write createStaff performs after creation.
  const { data: roled, error: roleErr } = await admin
    .from('profiles')
    .update({ role: 'inspector', must_change_password: false })
    .eq('id', created.user.id)
    .select('role');
  if (roleErr) fail('profiles role update', roleErr.message);
  else if (roled?.[0]?.role !== 'inspector') fail('profiles role update', 'role did not stick');
  else pass('profiles role update', 'role=inspector');

  // And the reset path behind the key icon.
  const { error: pwErr } = await admin.auth.admin.updateUserById(created.user.id, {
    password: 'verify-only-throwaway-2',
  });
  if (pwErr) fail('auth.admin.updateUserById', pwErr.message);
  else pass('auth.admin.updateUserById', 'password reset accepted');

  // The portal must never mint an admin. The DB does not stop it — the code
  // does — so assert the guard exists rather than that the write fails.
  if ((STAFF_ROLES as readonly string[]).includes('admin')) {
    fail('STAFF_ROLES', "'admin' is grantable from the portal");
  } else {
    pass('STAFF_ROLES', `grantable roles: ${STAFF_ROLES.join(', ')}`);
  }
}

async function teardown() {
  console.log('\ncleanup');
  for (const { what, run } of cleanup.reverse()) {
    try {
      await run();
      console.log(`  removed ${what}`);
    } catch (e) {
      console.log(`  LEFT BEHIND ${what} — ${(e as Error).message}`);
      failures++;
    }
  }
}

async function main() {
  const { sb, userId } = await connect();
  console.log(`project : ${URL}`);
  console.log(`auth    : ${process.env.ADMIN_EMAIL} (RLS applied)\n`);

  try {
    console.log('departments');
    const departmentId = await checkDepartment(sb);

    console.log('\nplaces');
    const place = await checkPlace(sb, departmentId);

    console.log('\nassignments');
    if (place) await checkAssignment(sb, place, userId);
    else console.log('  SKIP create_assignment  (no place to assign against)');

    console.log('\nusers');
    await checkStaff();
  } finally {
    await teardown();
  }

  console.log();
  if (failures > 0) {
    console.log(`${failures} write path(s) did NOT reach the database.`);
    process.exit(1);
  }
  console.log('ok — every portal write path reaches Supabase, and left nothing behind');
}

main().catch(async (e) => {
  await teardown();
  console.error(`\nFAILED: ${e.message}`);
  process.exit(1);
});
