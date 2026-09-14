# supabase/

`migrations/` holds numbered SQL scripts, run by hand in the project's SQL
Editor. There is no Supabase CLI migration table — the files are a ledger of
what was run, not something a tool replays. Every script is written to be safe
to re-run.

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
carried by `middleware.ts`.

## The one secret this app needs

`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Only `lib/supabase/admin.ts` reads
it, and that file is `import 'server-only'`, so a browser import is a build
error. Creating a staff account and setting someone's password are the only two
operations that need it — `profiles` has no INSERT policy and there is no RPC
for either. Everything else goes through the RLS-respecting server client.

If the users screen says "Service key not set", the value is missing or empty.
Next reads env files at startup, so restart `next dev` after filling it in.
