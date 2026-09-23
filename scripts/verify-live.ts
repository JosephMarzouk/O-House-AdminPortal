/**
 * Proves, against the live project, the two things that must be true before
 * any UI is built on top:
 *
 *   1. The portal reads the same bucket the Flutter app writes to, and every
 *      stored media path resolves to a real, fetchable object.
 *   2. Assignments submitted from the phone come back complete — items,
 *      photos, signature, and the right effective_status.
 *
 * Auth: prefers ADMIN_EMAIL/ADMIN_PASSWORD (exercises the REAL path, with RLS
 * applied exactly as the portal will see it). Falls back to
 * SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS — fine for checking data
 * shape, but it does not prove what an admin can actually see.
 *
 * Run: pnpm verify:live
 */
import { installNodeWebSocket } from '../lib/node-ws';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/types/database';

installNodeWebSocket(); // must run before createClient — see lib/node-ws.ts

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'checklist-media';

/** The API's signed links for one round, or null when the API can't be used. */
async function signedMedia(
  sb: ReturnType<typeof createClient<Database>>,
  id: string,
): Promise<Record<string, string | null> | null> {
  const api = process.env.OHOUSE_API_URL;
  const token = (await sb.auth.getSession()).data.session?.access_token;
  if (!api || !token) return null;
  const res = await fetch(`${api.replace(/\/+$/, '')}/assignments/${id}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Club': process.env.CLUB_SLUG ?? 'ohouse' },
  });
  if (!res.ok) throw new Error(`O House API answered ${res.status} for round ${id}`);
  return ((await res.json()) as { media: Record<string, string | null> }).media;
}

async function connect() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (email && password) {
    const sb = createClient<Database>(URL, ANON);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
    return { sb, mode: `signed in as ${email} (RLS applied)` };
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key) {
    return {
      sb: createClient<Database>(URL, key, { auth: { persistSession: false } }),
      mode: 'service_role (RLS BYPASSED — data shape only)',
    };
  }

  throw new Error(
    'No credentials. Add ADMIN_EMAIL + ADMIN_PASSWORD (preferred) or ' +
      'SUPABASE_SERVICE_ROLE_KEY to .env.local.',
  );
}

async function reachable(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status;
  } catch {
    return 0;
  }
}

async function main() {
  const { sb, mode } = await connect();
  console.log(`project : ${URL}`);
  console.log(`bucket  : ${BUCKET}`);
  console.log(`auth    : ${mode}\n`);

  const { data: rows, error } = await sb
    .from('assignments_v')
    .select('*')
    .order('scheduled_date', { ascending: false, nullsFirst: false });
  if (error) throw new Error(`assignments_v read failed: ${error.message}`);

  console.log(`assignments visible: ${rows!.length}\n`);

  let checked = 0;
  let broken = 0;

  for (const a of rows!) {
    const { data: items } = await sb
      .from('assignment_items')
      .select('*')
      .eq('assignment_id', a.id!)
      .order('sort_order');

    const place = a.site_name_en || a.site_name_ar || '(NO PLACE — hidden on the phone)';
    const title = a.title_en || a.title_ar || a.template_title_en || '(untitled)';

    console.log(`${title}`);
    console.log(`  place    ${place}`);
    console.log(`  status   ${a.status} -> effective ${a.effective_status}${a.was_extended ? ' (extended)' : ''}`);
    console.log(`  schedule ${a.scheduled_date ?? '—'} ${a.window_start ?? ''}${a.window_end ? '–' + a.window_end : ''}`);
    console.log(`  deadline ${a.deadline ?? '— (no schedule: can never expire)'}`);
    console.log(`  items    ${items?.length ?? 0}${!items?.length ? '  <-- renders 0/0, Submit disabled on the phone' : ''}`);

    // Signed links from the O House API, as the portal gets them (the bucket
    // is going private, so there are no public URLs to test any more).
    const links = await signedMedia(sb, a.id!);
    const media: { label: string; url: string }[] = [];
    if (links === null) {
      console.log('  media    skipped (needs OHOUSE_API_URL and a signed-in admin)');
    } else {
      const sig = a.signature_url ? links[a.signature_url] : null;
      if (a.signature_url) media.push({ label: 'signature', url: sig ?? '(no link: object missing)' });
      for (const it of items ?? []) {
        for (const p of it.photo_paths ?? []) {
          media.push({ label: `photo (${it.text_en || it.text_ar})`, url: links[p] ?? '(no link: object missing)' });
        }
      }
    }

    for (const m of media) {
      const status = await reachable(m.url);
      checked++;
      const ok = status === 200;
      if (!ok) broken++;
      console.log(`  ${ok ? 'OK ' : 'ERR'}  ${m.label} -> ${status || 'network error'}`);
      if (!ok) console.log(`       ${m.url}`);
    }
    console.log();
  }

  console.log(`media objects checked: ${checked}, unreachable: ${broken}`);
  if (broken > 0) {
    console.log(
      'Unreachable objects are usually orphans — clients cannot delete from storage,\n' +
        'so paths can outlive their rows. Investigate before assuming a portal bug.',
    );
  }
}

main().catch((e) => {
  console.error(`\nFAILED: ${e.message}`);
  process.exit(1);
});
