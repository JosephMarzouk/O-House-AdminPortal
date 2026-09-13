# Broadsheet — the O House portal design system

The admin portal shares a backend and a visual language with the Flutter
staff app. The app's `theme.dart` is the source of truth; this file records
how the portal reads it so the next person does not drift.

**The rule that makes every other rule enforceable:** every colour, font,
type size, spacing, radius and shadow lives in [`app/tokens.css`](app/tokens.css)
and nowhere else. Screens and components reach them through Tailwind
utilities (`bg-ink`, `text-cyan-dark`, `rounded-control`, `shadow-md`,
`text-display`) or `var(--color-…)` in the rare inline style. To prove it:

```bash
grep -rn -E "#[0-9a-fA-F]{3,8}\b|font-family" --include=*.tsx --include=*.ts --include=*.css app components lib | grep -v app/tokens.css
```

should return nothing but comments in `globals.css`.

## Colour — named by role, never by hue

| Token | Utility | Hex | Role |
|---|---|---|---|
| ink | `bg-ink` | `#0E213F` | The drawer, and the top of the login gradient. **The only dark surface.** |
| cyan | `bg-cyan` / `text-cyan` | `#0088B0` | Every primary action, active nav, focus rings, selection. |
| cyan-dark | `text-cyan-dark` | `#006786` | Link and accent *paragraph* text (base cyan is only 3:1 on paper), pressed primaries, "submitted". |
| cyan-tint | `bg-cyan-tint` | `#E9F8FF` | Tinted fills: in-progress tag, info banners, selected rows. |
| magenta | `bg-magenta` / `text-magenta` | `#AA0B56` | **Reserved.** Rejected, expired/overdue, destructive, errors. Nothing else. |
| magenta-tint | `bg-magenta-tint` | `#FFF1F4` | Ground for the overdue tile and error banners. |
| magenta-deep | `text-magenta-deep` | `#4B1528` | Text sitting on magenta-tint. |
| paper | `bg-paper` / `text-paper` | `#F3F2F2` | Every page ground; also the text on ink and on solid cyan/magenta. |
| surface | `bg-surface` | `#EAE9E9` | Input fill, cards. |
| text | `text-text` | `#201E1D` | Body ink. |
| divider | `border-divider` | text @ 16% | Hairlines, input borders. |

Derived tones are always `text` at an alpha, never a grey hex:
`text-text/70` field labels · `/60` table headers, pending tags · `/55`
captions · `/50` section labels · `bg-text/8` row rules · `bg-text/4` row hover.

Full ramps (`neutral-*`, `accent-*`, `accent2-*`, 100–900) exist for the odd
hover or pressed step; prefer a ramp step over an ad-hoc alpha.

**On ink the tones invert and cyan stops working.** Measured against `#0E213F`:
`cyan` is 3.9:1 and must never be a label there; `accent-300` is 11:1 and is the
accent step for dark surfaces; `paper/70` is 7.6:1 and is the resting text tone.
A solid cyan pill is not a way round it either — `paper` on `cyan` is 3.6:1.

Rules: light theme only, no dark mode. Never both accents in one small
component. No amber, orange, green or yellow — "approved" is cyan, "warning"
is a neutral tag, "rejected/overdue" is magenta. That is the whole vocabulary.

## Type — one family

Cairo, the variable build (`wght` 200–1000), loaded through `next/font/google`
in `app/fonts.ts` and self-hosted from there. One face covers Arabic, Latin and
the Arabic-Indic digits `fmtNum` emits under `ar-EG`, so there is no fallback
stack and no second family to keep in step. **Never add a second family.**

Cairo ships no italic, and nothing in the portal sets italic. If a design ever
wants emphasis, it is weight or colour, not a synthesised oblique.

This replaced a Source Serif 4 + Noto Naskh Arabic pair that worked by per-glyph
fallback. That pair set one mixed line in two typefaces with different weight
axes — Latin 400/600, Arabic 400/700 — so Arabic at 600 silently resolved to
700. A single variable axis is what fixes that, and is why the build is variable
rather than two static weights.

| Utility | Size / line / weight / tracking | Use |
|---|---|---|
| `text-display` | 34 · 1.1 · 600 · −0.02em | Page title, stat-tile number |
| `text-heading` | 26 · 1.15 · 600 · −0.02em | Section heading |
| `text-title` | 20 · 1.25 · 600 | Card / dialog title |
| `text-lg` | 17 · 1.3 | Subtitles, key facts |
| `text-base` | 15 · 1.4 | Body, button labels, nav |
| `text-sm` | 14 · 1.4 | Table cells |
| `text-xs` | 13 · 1.4 | Small |
| `text-label` + `uppercase` | 11 · 600 · +0.09em | Section labels, table headers (`.section-label` = this at `text/50`) |
| `text-caption` | 11 | Meta, at `text/50–55` |
| `text-tag` | 11 · +0.02em | Status tags |
| `text-kicker` + `uppercase` | 10 · 600 · +0.09em | Cyan kicker above a card title |
| `text-brand` | 18 · 600 | Sidebar wordmark |
| `text-field` | 12 | Form field labels, at `text/70` |

Headings are flush-left. Layouts hug the left with whitespace on the right.
Never centre a page — login is the sole exception, and it earns it by having
no drawer to sit beside and nothing to read down.

## Spacing, radius, elevation

- **Spacing** is a 5px base: `p-1`=5, `p-2`=10, `p-3`=15, `p-4`=20, `p-6`=30,
  `p-8`=40. Already 1.25× airy — do not tighten. Named sizes: `size-icon`
  (16), `size-icon-sm` (12), `h-control` (44), `h-control-lg` (56),
  `w-sidebar` (240), `w-rail` (64), `size-thumb` (64), `max-w-dialog` (440 —
  the floating-surface width, used by dialogs *and* the login card).
- **Radius:** `rounded-card` 2px on cards and tables; `rounded-dialog` 4px;
  `rounded-control` 16px on buttons, inputs, selects, chips **and status tags**
  — the staff app's one deliberate departure from flat. CSS clamps a radius to
  half the box, so on a ~19px tag that same 16px renders as a true pill; there
  is no separate pill token and there should not be one. `rounded-tile` 20px on
  the things that float off the ground: stat tiles, floating bars, the login
  card, and the drawer's inner edge.
- **Shadows**, ink-tinted, only these three: `shadow-sm` (hairline lift),
  `shadow-md` (stat tiles, floating bars), `shadow-lg` (dialogs and the login
  card — the two modal-weight surfaces).
- **Control heights:** 44px minimum for anything clickable; 56px for primary
  buttons and text inputs. Inputs and selects take `compact` for 44px inside
  filter rows and table cells.

## Layout grammar — how a page is built

1. **Page header** (`<PageHeader>`): on the paper ground, same colour as the
   body — the page starts at its title, with no block above it. A
   `.section-label` kicker (today's date on list pages, a `<BackLink>` on
   detail and create pages), then the display title. A subtitle **only when it
   says something the title does not**: "12 · Places" under "Places" is not
   that, but an assignment's `place · date · window` is. Anything that belongs
   with the title rather than in the body — filters, status chips — is passed
   as children and sits under it; a page's one New… button is `actions`.
2. **Paper body** (`<PageBody>`): sections separated by **whitespace only**
   (`space-y-8`), never rules, borders or boxes. Section headings are
   `text-heading`; hierarchy comes from the scale and negative space.
3. **Cards** (`<Card>`) are for discrete items only — a subtask, a staff
   member — never for page layout. Surface fill, 2px, no border, no shadow.
4. **Stat tiles** (`<StatTile>`): paper, 20px, `shadow-md`, display number,
   11px label. `alarm` gives the overdue tile its magenta tint — the only
   tinted tile.
5. **Tables**: 14px cells, uppercase 11px headers at `text/60` over one
   divider, row rules at `text/8`, hover `text/4`, selected `cyan-tint`.
   Text starts left; numbers use `text-end tabular-nums`. No zebra, no
   outer border, no fill.
6. **The drawer**: the portal's one dark surface, carrying the brand now that
   the header is on paper. `ink` ground, `rounded-e-tile` on the edge facing
   the content (logical, so it mirrors on `dir`; the outer edge stays square
   against the viewport), logo and 18px wordmark at the top, no dividers
   between items. Active row is `accent-300` on a `paper/10` wash —
   **not** `cyan`, which is 3.9:1 there; resting rows are `paper/70`. It is
   `sticky top-0 h-dvh`, so every icon stays on screen however far the page
   scrolls, and `overflow-y-auto` so it scrolls itself rather than clipping on
   a short viewport. Collapsing snaps between `w-sidebar` and `w-rail` with no
   transition — see the comment in the component for why width is not animated.
7. **Dialogs**: surface, 4px, `shadow-lg`, 440px, backdrop `neutral-900/50`,
   actions at the end.
8. **Forms**: `<Label>` (12px, `text/70`) above a `<Input>`/`<Select>`
   (surface, divider border, 16px, 56px). Hover border `text/45`, focus
   border cyan, invalid via `aria-invalid` → magenta border.
9. **Login**, the one screen with its own grammar: the system's only gradient,
   `--gradient-login`, running down the blue ramp from `ink` through
   `accent-900` and `accent-800` to `cyan-dark`, with a centred `max-w-dialog`
   paper card on it at `rounded-tile` and `shadow-lg`. The card carries the
   logo and app name, because there is no drawer here to carry them.

## Component states — themed, never browser default

- **Button** `primary`: cyan fill, paper text, hover `accent-600`, pressed
  `accent-700`, 56px. `outline`: transparent, divider border, cyan-dark text,
  hover `text/7`, pressed `text/14`. `ghost`: cyan text, hover `cyan/10`.
  `destructive`: magenta fill — the only non-status magenta. Disabled: 45%.
- **Focus**: `outline: 2px solid cyan; offset 2px` on every focusable element
  (set globally). Inputs swap the outline for the cyan border.
- **Selection**: cyan at 30%.
- **Icons**: Phosphor, duotone, via [`components/icons.tsx`](components/icons.tsx).
  One set only; size with `size-icon` / `size-icon-sm`.

## Status vocabulary — pixel for pixel with the app

Read `effective_status` from `assignments_v`, never the raw `status` column.
`<StatusBadge>` renders the tag; "extended" is an independent flag and gets
its own tag beside the status, never an amber warning icon.

| Status | Ground | Text | Icon |
|---|---|---|---|
| pending | surface | `text/60` | Clock |
| in_progress | cyan-tint | cyan-dark | DotsThree |
| submitted | cyan-dark | paper | PaperPlaneTilt |
| approved | cyan | paper | CheckCircle |
| rejected | magenta | paper | XCircle |
| expired / overdue | transparent, 1px magenta outline | magenta | ClockCountdown |
| extended (marker) | surface | `text/60` | ArrowsClockwise |

Tag anatomy: 11px, +0.02em, 3×10px padding, `rounded-control` (which clamps to
a pill at tag height), 12px icon before the label, in a `<TagGroup>` so status
and extended wrap together.

## Vocabulary — do not "fix" these

- The table is `submissions`; the concept is an **assignment/round**. Label
  it "Assignments" in the UI; never rename the table.
- `inspector_id` means "the person assigned" (a cleaner or an inspector).
- `submissions.answers` is deprecated; live checklist state is `assignment_items`.
- Roles: `admin | manager | inspector | cleaner`.
- All writes go through `SECURITY DEFINER` RPCs. Never add a direct table write.
- Photo evidence is permanent. The portal never offers a delete-photo control.
- Times are `Africa/Cairo`.

## Do / Don't

**Do** separate sections with whitespace; set everything in Cairo; use cyan for
every interactive element on paper and `accent-300` for one on ink; keep magenta
for rejected, overdue and destructive only; keep every target ≥ 44px; write
comments that say *why*.

**Don't** structure pages with boxes, borders, rules or nested cards; add a
second family, a second icon set, a dark mode, or a colour outside the table
above; add a gradient anywhere but the login ground; centre a page other than
login; round cards past 2px or controls past 16px; tighten the
spacing scale; use both accents in one small component; add a dependency for
something CSS or the existing stack already does; touch queries, RPCs or auth.
