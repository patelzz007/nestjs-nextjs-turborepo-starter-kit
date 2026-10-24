# Session notes — 2026-10-25

A skim-later summary of (1) the agreed kanban redesign and (2) the report on the earlier tasks
(Expo 58 upgrade, package updates, tsrs, TypeScript 7 plan, API startup). Delete this file whenever
you're done with it; it is not part of the docs site.

---

## Part 1 — Kanban redesign (agreed design)

### Cards (Q2, Q3, Q6)

- The top row reads `[icon] [LEVEL chip] [KEY] … title`.
- The chip is uppercase, ~11 px, in the level's colour, contrast ≥ 4.5:1. The key (`STORY-142`) is monospace and muted.
- No colour edge on the card.
- The same chip and key appear on item pages, breadcrumbs, palette results and rollup rows.

### Boards by role (Q4, Q5, Q11, Q12)

- **Planning board:** Epics and Features. Stages: Backlog → Refining → Ready → Planned → Delivered. No WIP limits; moving to Delivered warns if children are still open.
- **Execution board:** Stories, Tasks and Subtasks. States: To Do → In Progress → Review → Done.
- **Separate columns:** two column tables, two nullable item fields (`planningColumnId` / `executionColumnId`), two enums (`PlanningStage` / `WorkState`); the shared enum is deleted.
- **One validator:** `assertColumnForLevel`, used by every write path. Renaming a column never changes its stage or WIP limit (tested).
- **Planning "In Progress"** items migrate to Refining if they have no breakdown, otherwise Ready.

### Keys (Q6)

- One counter per level (`EPIC`, `FEATURE`, `STORY`, `TASK`, `SUBTASK`), incremented in the same transaction as the insert.
- Keys are never reused, even after a soft delete. Existing items are backfilled in creation order (`createdAt`, then `id`).

### Subtasks (Q7, Q13, Q14)

- A Subtask is a real card whose parent must be a Task, with its own status, assignee and drag.
- A board-level **Show subtasks** toggle, kept in the URL and in your preference. The Task card's "3 subtasks · 1 done" badge flips it.
- A Task can be marked Done with open Subtasks: a warning, not a block.
- The checklist inside a Subtask nests two levels deep.

### WIP (Q16)

- Stories and Tasks count toward WIP; Subtasks never count and are never blocked by a full column.
- Column header shows `5/6 · +3 subtasks`.

### Execution board extras (Q8, Q9, Q15)

- **Rollup strip:** one row per Feature with ≥ 1 unfinished Story, Epic as prefix, a count-based bar and dates (or "—"). Clicking a row filters the board to that Feature; state kept in the URL.
- **Grouping:** Group by Feature by default. Precedence URL > your preference > Feature; filtering to one Feature updates the Group-by control.
- **Preferences:** a `UserPreference` table with per-board keys (`board.<id>.groupBy`, `.showSubtasks`) and a zod registry. Invalid values fall back silently; the Group-by menu gets "Reset to default".

### Moving (Q1, Q10, Q17)

- **Status** changes by drag.
- **Parent** changes only through **Move to…** (card ⋯ menu, item page, ⌘K). The picker lists valid parents only, searchable by key or title. Logged in History (old → new parent); a toast offers Undo for ~10 s.
- **⌘K:** ranked item search (exact key → key prefix → title); actions for the item in focus; "Change status…" offers stages or states by board.

### Data move (Q18)

1. **Migration 1** (generated) — additive only, every new field nullable.
2. **Conversion script** — four stages, each in its own transaction with a completion marker: counters & keys → column split → planning triage → checklist to Subtasks. Refuses to run without migration 1; supports `--dry-run`, a mapping report and `--verify` (no unconverted rows; every counter ahead of every key).
3. **Migration 2** (generated) — drops the old column field and enum, run only after you've reviewed `--verify` (manual runbook gate). The counter assertion lives in `--verify`, because a generated migration can't assert.

### Delivery (Q19)

1. Model, keys, chip, `assertColumnForLevel`.
2. Subtask card, conversion script, toggle.
3. Planning stages, Delivered warning, WIP rules.
4. Rollup strip, grouping, preferences, Move to…
5. ⌘K items and actions.

Each stage: full gate + script `--dry-run` against a seeded database; docs and seeds updated.

---

## Part 2 — Report on the earlier tasks

### Your three questions

**1. Is tsrs replacing `tsc`?** For type checking, yes — every workspace's `typecheck` runs `tsrs --noEmit` (except `apps/docs`, which keeps `astro check`). `tsc` 6 is still used for:

- package builds (`dist/` of `shared`, `messaging`, `api-client`);
- `next build`'s own type check;
- the editor and typescript-eslint (they need TypeScript's JS compiler API, which tsrs doesn't provide).

tsrs gave identical diagnostics to `tsc` on every workspace; the whole repo checks in ~4 s. No binaries for Windows/Intel Mac — use `pnpm exec tsc --noEmit` there.

**2. TypeScript 7 without breaking ESLint.** typescript-eslint (8.72) requires TS < 6.1, and TS 7 drops the JS API its type-aware rules use.

- **Now (done):** two compilers side by side — tsrs checks with TS 7 rules; TS 6.0.3 stays the library for typescript-eslint, Next and the editor.
- **Next:** watch for typescript-eslint's TS 7 support (built on `typescript/unstable/*`).
- **When it lands:** bump TS 7 + typescript-eslint together, remove the `overrides.typescript` pin and the TS 6 shim for `@darraghor/eslint-plugin-nestjs-typed`, run lint + typecheck.
- **ESLint 10** is a separate blocker: `eslint-plugin-react`, `-import`, `-jsx-a11y`, `-react-native` cap at ESLint 9. Needs a move to maintained replacements (e.g. `eslint-plugin-import-x`) with your rule-by-rule sign-off.

**3. API startup (~3.4 s).** Now ~1 s. A CPU profile showed the validator warmup queued mid-boot (~2 s), compiling into a cache no request read. Now one shared Ajv compiler + cache, warmup after "ready" in batches of 8. `pnpm dev:api` also no longer waits for `tsc` builds of `shared`/`messaging` — the dev bundle reads them from source.

### What was done

- **Expo SDK 58** (React 19.3, RN 0.88, Reanimated 4.7, Jest 30); RN's stricter ref types absorbed across ~150 files; a pnpm-safe Reanimated Jest resolver (tested); `react-native-web` as a test-only dep; pre-release Expo packages allowed via min-release-age exclusions expiring 2026-10-25.
- **"Unmatched Route"** fixed — the root guard redirects signed-out users to `/sign-in`.
- **`anchor`** replaces `initialRouteName` in both stacks.
- **`--clear`** always passed by the mobile `dev`/`start` scripts.
- **Metro "transformFile" error** fixed (Babel config); Android + iOS bundle.
- **`marked` 18** with a Babel plugin that keeps its regexes intact under Jest.
- **All packages to latest**, peer/audit issues fixed at the root: removed unused `chokidar`; a tested `zod` override for `@expo/cli`; patched `dompurify`, `body-parser`, `undici`; code adapted to Base UI 1.9 and react-virtual's measuring.
- **Held (blocked upstream):** `react` 19.3.1 & keyboard-controller 1.22.8 (Expo pins), ESLint 10 & TS 7 (above), Babel 8 dynamic-import plugin (Expo on Babel 7), `prisma` 8 (release candidate).
- **`db:generate`** works after a reinstall wipes the Prisma client (tested).
- **Fixed failures:** lint on a deprecated `matchMedia` stub; an e2e test broken by the date passing 1 Oct; missing kanban bundle budgets; CI browser job missing the component-gallery flag; the History step in a browser test.

### Results

- `format`, `lint`, `typecheck`, `test`, `test:e2e` all passed on the last full run.
- `ci:local`: every stage passed except the browser job (your dev stack held ports 3000/3001/8080). Run `pnpm ci:local --e2e-only` with `pnpm dev` stopped to confirm the admin History fix.
- Your GitHub link in the dev database is intact.

### Still open

- The missing Expo Go loading icon (manifest icon URL serves a valid PNG; config unchanged; Expo Go 58's loading view isn't drawing it — couldn't confirm without a device).
- Restart your running Metro once.
- Nothing is committed.

---

## Part 3 — Kanban redesign: what was built

All five delivery stages landed in one go. Full write-up: `docs/technical/kanban.md`.

- **Model:** Subtask is a real level (EPIC → FEATURE → STORY → TASK → SUBTASK); a subtask's checklist is its *steps* (2 levels). Separate `KanbanPlanningColumn` (stages) and `KanbanExecutionColumn` (states); `assertColumnForLevel` is the one board check. Keys (`STORY-142`) from per-level counters, never reused.
- **API:** `GET /admin/kanban/search` (exact key → key prefix → title), `POST /admin/kanban/tasks/:id/parent` (Move to…; `PATCH` no longer takes `parentId`), `GET/PUT/DELETE /auth/preferences[/:key]` (registry-checked). Planning columns refuse a WIP limit.
- **Board:** level chip + key on every card; ⋯ menu (Open, Move to…, Move to column); Feature lanes by default; Show subtasks (toggle or a task's "3 subtasks · 1 done" badge); WIP header `5/6 · +3 subtasks`; rollup strip of active features; Done/Delivered warning with open children; Move to… dialog with 10-second Undo.
- **⌘K:** item search (Items group) and actions for the item on screen (Move to…, Change status, Edit).
- **Data move:** migration 1 is in your new baseline; `pnpm db:kanban-convert` (`--dry-run`, run, `--verify`) converts an older board. Migration 2 is a manual step — see "Converting an older board" in the kanban doc.
- **Fixes from your messages:** cards no longer show above the sticky column header while scrolling; the board is taller (`100dvh − 8.5rem`, min 40rem).

Gate: `format`, `lint`, `typecheck`, `test` (20/20 tasks) all pass; kanban + preferences e2e 31/31.
