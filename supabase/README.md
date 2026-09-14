# supabase/

`migrations/` holds numbered SQL scripts, run by hand in the project's SQL
Editor. There is no Supabase CLI migration table — the files are a ledger of
what was run, not something a tool replays. Every script is written to be safe
to re-run.

## The ledger is not evidence

A pre-deployment audit in September 2026 found the ledger wrong in both
directions: `0009` was live but untracked in git, while `0007` and `0008` were
committed here and **not applied** — production was still running the
fail-open `current_role()` that 0008 exists to replace, and a `set_user_role`
that rejected `'cleaner'` while three accounts held that role.

Nothing warns you about this. A file in this folder means someone intended to
run it. So before trusting any guard described here, ask the database:

```sql
-- expect: coalesce present, no fail-open '<>' guard, 'cleaner' accepted
select p.proname,
       pg_get_functiondef(p.oid) ~ 'coalesce'                  as has_coalesce,
       pg_get_functiondef(p.oid) ~* 'current_role\(\)\s*(<>|!=)' as fail_open
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and pg_get_functiondef(p.oid) ~ 'current_role'
 order by fail_open desc, p.proname;

select public.current_role() is null as should_be_false;
```

`fail_open` must be `f` on every row — `if current_role() not in (...) then
raise` never fires when the value is NULL, because PL/pgSQL reads a NULL
condition as false. Each migration carries its own checks at the foot; run
them, and read the output, rather than assuming the script took.

## Two orphan Edge Functions

The project (`ptonujazlljpkgpfrkpw`, "Check List") still has two Edge Functions
deployed and ACTIVE. **Nothing in this repo calls them**, there is no
`supabase/functions/` source directory here, and there never was one in this
repo's history — they are left over from the portal that came before it.

| Slug | Superseded by |
|---|---|
| `admin-create-user` | `createStaff` in `lib/actions/users.ts` |
| `admin-reset-password` | `resetStaffPassword` in `lib/actions/users.ts` |

Do not wire either back in. `admin-create-user` upserts `public.profiles` with
the address it was given and `role: 'inspector'`, overwriting what
`handle_new_user` derives — that overwrite is why accounts it created could not
log in, which is the whole reason `createStaff` exists and is documented at
`lib/actions/users.ts:73-78`.

Both are kept for now only in case the older clients still reach them. To
remove one: Supabase Dashboard → Edge Functions → the function → ⋯ → Delete.

Sign-in itself has never needed a function: `components/login-form.tsx` calls
`supabase.auth.signInWithPassword` on the browser client, and the session is
carried by `proxy.ts`.

## The one secret this app needs

`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Only `lib/supabase/admin.ts` reads
it, and that file is `import 'server-only'`, so a browser import is a build
error. Creating a staff account and setting someone's password are the only two
operations that need it — `profiles` has no INSERT policy and there is no RPC
for either. Everything else goes through the RLS-respecting server client.

If the users screen says "Service key not set", the value is missing or empty.
Next reads env files at startup, so restart `next dev` after filling it in.
