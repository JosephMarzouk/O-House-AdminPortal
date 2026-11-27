@AGENTS.md

## Pilot tickets, 26-27 Nov (migration `20261127075639_pilot_tickets_nov`)

- **Note boxes:** `components/note-box.tsx` (staff comments and the sign-off note amber, the manager's
  send-back reason red-tinted, task instructions grey), used on the checklist page and the daily report, so
  the PDF has them too.
- **Date presets:** `components/date-preset-buttons.tsx` (Today / This week Sat-Fri / This month, from
  `lib/format.ts`) on Assignments and Reports; the Reports list also has From/To.
- **Deletes (soft):** Delete on a never-submitted checklist (`checklists.delete`) and on a round
  (`planner.delete`), with a confirm dialog; Users: Delete (`users.delete`, built-in Admin only) shows what
  goes with the person and asks for their typed name. Deleted users leave lists and pickers.
- **Access** (Portal / App / Both) on the user form; the portal sends `x-ohouse-portal-key` on login and
  refresh, and shows a clear message on `PLATFORM_DENIED`.
- Evidence the API purged after 3 months shows "Photo removed after 3 months"; the dashboard warns past 800 MB.
  Run this worktree, not the old `o-house-admin` checkout.
