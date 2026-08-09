---
title: "Performance & DX Roadmap"
description: "20 grounded improvements to make the monorepo faster and friendlier to develop in — each with a priority, effort estimate, and acceptance criteria."
order: 15
author: "Acme Inc."
lastUpdated: "2026-08-08"
coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80"
---

# Performance & Developer Experience Roadmap

> [!NOTE] This guide lists **20 concrete improvements** to make the monorepo run faster and be
> nicer to develop in. Every item is grounded in the repo's *actual current state* —
> each one was verified against `turbo.json`, the workspace `package.json` files, the
> tsconfigs, and the running output before being written down (not a wish-list).
>
> Each item has a **priority**, an **effort estimate**, a **status**, and a set of
> **acceptance criteria** — a junior should be able to pick up any pending item, read
> its recipe, implement it, and prove it works by checking the criteria boxes.

## Status legend

| Mark | Meaning |
| ---- | ------- |
| ✅ **Done** | Shipped and verified. |
| 🔶 **Partial** | Some of it exists; the rest is listed as follow-up work. |
| ⬜ **Pending** | Not started — the recipe below is the plan. |

---

## Priority matrix

| # | Improvement | Area | Priority | Effort | Status |
| - | ----------- | ---- | -------- | ------ | ------ |
| 1 | Enable turbo caching | ⚡ Speed | **P1** | S | ⬜ |
| 2 | Incremental `nest build` | ⚡ Speed | P2 | S | ⬜ |
| 3 | `tsc -b` project references for typecheck | ⚡ Speed | P2 | M | ⬜ |
| 4 | Wire the installed pino logger | ⚡ Speed | **P1** | M | ⬜ |
| 5 | Lazy-load heavy admin libs | ⚡ Speed | **P1** | M | ✅ |
| 6 | `output: "standalone"` in the Next apps | ⚡ Speed | P2 | S | ⬜ |
| 7 | Narrow the `useTable` selector | ⚡ Speed | P2 | S | ⬜ |
| 8 | Bundle analyzer (`pnpm analyze`) | ⚡ Speed | P2 | S | ⬜ |
| 9 | `.env.example` for api / web / admin | 🧑💻 DX | — | — | ✅ |
| 10 | `postinstall: prisma generate` | 🧑💻 DX | **P0** | S | ⬜ |
| 11 | Pin the toolchain (`.nvmrc` + engines) | 🧑💻 DX | **P1** | S | 🔶 |
| 12 | Husky + lint-staged | 🧑💻 DX | **P1** | M | ⬜ |
| 13 | Watch feedback loops | 🧑💻 DX | P2 | S | ⬜ |
| 14 | `dev:clean` — stale-server killer | 🧑💻 DX | **P1** | S | ⬜ |
| 15 | GitHub Actions CI | 🧑💻 DX | **P1** | M | ⬜ |
| 16 | Port preflight before dev | 🧑💻 DX | **P0** | S | ⬜ |
| 17 | `dev:fresh` — nuke-and-restart | 🧑💻 DX | P2 | S | ⬜ |
| 18 | `pnpm smoke` — boot smoke test | 🧑💻 DX | **P0** | S | ⬜ |
| 19 | Enable typed routes | 🧑💻 DX | **P1** | S | ⬜ |
| 20 | Cleaner dev output | 🧑💻 DX | — | — | ✅ |

**Priority scale:** **P0** = landmine/footgun removal (do first — they bite every day).
**P1** = high value, low risk. **P2** = nice-to-have or requires more effort than the
payoff justifies today.

**Where to start — the P0 trio + two P1s:**

1. **#10** `postinstall: prisma generate` — removes a landmine we actually stepped on.
2. **#16** Port preflight — removes the daily `EADDRINUSE` footgun.
3. **#18** `pnpm smoke` — catches the broken-`dist`/dead-server class of bug in seconds.
4. **#1** Turbo caching — the single biggest free speed win.
5. **#12** Husky + lint-staged — the checks stop being optional.

---

## ⚡ Faster (1–8)

### 1. Turn on turbo caching

**What:** flip `"cache": false` to `"cache": true` on the `build`, `lint`, `typecheck`,
`test`, and `format` tasks in `turbo.json`.

**Why:** every one of those tasks currently forces a full re-run ("cache bypass, force
executing") — even when nothing changed. The `inputs`, `outputs`, and `env` lists are
already fully declared (which is the hard part), so this is a config flip, not a
project. A no-op `pnpm lint` would go from ~30s to ~200ms.

**How:**

- Flip `"cache": true` on `build`, `lint`, `typecheck`, `test`, `format`.
- Leave `dev` and all `db:*`/`deps:*` tasks uncached (dev is persistent; db/deps are
  side-effectful).
- Run each task twice and confirm the second run reports `FULL TURBO` / cache hits.
- `deps:check` uses `cache: false` by design (it reads the live install) — keep it that way.

**Acceptance criteria:**

- [ ] Second consecutive `pnpm lint` / `pnpm typecheck` / `pnpm test` prints `FULL TURBO`
  (or per-task cache hits) — the **cache-hit line is the structural proof**, not a
  stopwatch (timing comparisons are noisy on loaded machines).
- [ ] Changing one source file in `apps/web` does **not** replay `@workspace/shared:build` (hash-based invalidation works).
- [ ] `pnpm build` still produces identical artifacts (smoke: `pnpm start` boots the API after a cached build).

**Status:** ⬜ Pending.

### 2. Re-enable incremental for `nest build`

**What:** stop forcing `"incremental": false` in `apps/api/tsconfig.build.json`.

**Why:** `tsconfig.json` already sets `"incremental": true` (it's the dev-time
default), but the build config overrides it back to `false`, so **every** `nest build`
recompiles all ~120 API files from scratch. With incremental builds, unchanged files
are skipped via `.tsbuildinfo`.

**How:**

- Remove the `"incremental": false` override from `tsconfig.build.json` (it inherits
  `true` from `tsconfig.json`).
- `*.tsbuildinfo` is already git-ignored (`.gitignore` line 44), so no repo noise.
- Ensure the `build` script does `rm -rf dist` *or* keeps the tsbuildinfo alongside —
  pick one strategy and document it (recommended: keep both `dist` and `.tsbuildinfo`
  and let Nest overwrite; only `pnpm dev:fresh` (#17) does a full wipe).

**Acceptance criteria:**

- [ ] Two consecutive `pnpm --filter @workspace/api build` runs — the second emits far
  fewer files (Nest prints the count) or completes faster; the `.tsbuildinfo` file
  existing after the build is the structural proof.
- [ ] A `.tsbuildinfo` file exists after build and is not tracked by git.
- [ ] `nest build` still emits runnable ESM (`node dist/main.js` boots, `/health` returns 200).

**Status:** ⬜ Pending.

### 3. `tsc -b` (project references) for typecheck

**What:** replace the six independent `tsc --noEmit` runs with build-mode project
references so repeat typechecks only re-check changed projects.

**Why:** today `pnpm typecheck` runs each workspace's `tsc --noEmit` cold. Build-mode
(`tsc -b`) understands the `references` graph and skips projects whose inputs didn't
change — the same win as #1 but at the type-checker level. It also works with TS7's
`tsgo` (the Go-native compiler used by web/admin and the packages; the API is pinned
to TS 6.x so the Nest CLI keeps working — see [typescript.md](./typescript.md)).

**How:**

- Add `"references"` to each app's `tsconfig.json` pointing at the packages it imports
  (`web`/`admin` → `ui`, `client`, `shared`; `api` → `shared`).
- Switch each workspace's `typecheck` script from `tsc --noEmit` to `tsc -b --noEmit`
  (or `tsgo -b`) — `--noEmit` in build mode still respects the reference graph.
- Commit the root wiring in `turbo.json` (`typecheck` already has `dependsOn: ["^typecheck"]`).

**Acceptance criteria:**

- [ ] `pnpm typecheck` passes from a clean checkout.
- [ ] Editing only `apps/web` typechecks `web` (and its `^typecheck` deps at most) — not the API.
- [ ] No `.tsbuildinfo` files are tracked by git.

**Status:** ⬜ Pending.

### 4. Wire the pino logger that's already in deps

**What:** `nestjs-pino`, `pino-http`, and `pino-pretty` are installed but have **zero
usages** — `apps/api/src` still uses Nest's default logger.

**Why:** structured JSON logs give you `{requestId, userId, event}` correlation across
the proxy-refresh logs, auth events, and throttle hits — one place to grep instead of
parsing free-text lines. It's also measurably faster than the default logger at volume.

**How:**

- `LoggerModule.forRoot()` in `app.module.ts` with a pino-http transport; keep
  `pino-pretty` for local dev (`NODE_ENV !== "production"`), raw JSON in prod.
- Swap `Logger` (Nest) for `Logger` from `nestjs-pino` in the services that log.
- Keep the existing proxy refresh logs in `apps/*/proxy.ts` — those are Next-side and
  stay separate (documented in [token-refresh.md](./token-refresh.md)).

**Acceptance criteria:**

- [ ] `pnpm dev:api` prints pretty, leveled log lines (not Nest's default `[Nest]` format).
- [ ] A `POST /auth/login` request produces a JSON log line with a `requestId` and a `status` field.
- [ ] Production build logs one JSON object per line (parseable by `jq`).

**Status:** ⬜ Pending.

### 5. Lazy-load the heavy admin libs

**What:** make the docs-heavy admin bundle stop shipping mermaid, shiki, katex, and
recharts eagerly.

**Why:** `apps/admin` imports `mermaid` (11.x), `shiki`, `katex`, and `recharts` —
megabyte-class deps — and most admin pages never render them. `mermaid` is already
`next/dynamic` (only loads when a diagram exists); the others are still in the main
bundle.

**How (what shipped 2026-08-08 — see the LCP/INP section below for the full detail):**

- `mermaid-diagram.tsx` — already `next/dynamic`-lazy; keep.
- `code-block.tsx` — shiki is now a **runtime `import("shiki")`** (type-only static
  import), so the ~300 KB shiki chunk is no longer part of the docs page bundle; it
  downloads on the first code block and the plain `<pre>` shows until highlight lands.
- The admin `/` page — recharts, react-table, dnd-kit, cmdk, and react-hook-form are
  all code-split out of the initial bundle; the eight below-the-fold demo sections are
  additionally **viewport-gated** (they mount only when scrolled near).
- `framer-motion` was removed from the admin entirely (sidebar/drawer are pure CSS).
- KaTeX stays in the docs route chunk (reactive-core.md and ui-components.md use math).

**Acceptance criteria:**

- [x] The admin **initial** HTML no longer references recharts / cmdk / react-table /
  dnd-kit / react-hook-form / framer-motion / shiki / mermaid (verified against the
  prod build's chunk list).
- [x] `/docs/<any guide>` still renders code blocks, math, and mermaid correctly.
- [x] The dashboard chart renders with a skeleton while its chunk loads (no blank gap).

**Status:** ✅ Done (initial-load half). See "Admin initial-load (LCP/INP)" below for
what shipped and how to re-measure.

### 6. `output: "standalone"` in both Next apps

**What:** set `output: "standalone"` in `apps/web/next.config.ts` and
`apps/admin/next.config.ts`.

**Why:** you deploy to DigitalOcean/Linode VMs. Standalone output traces only the
runtime files into `.next/standalone`, so the server image doesn't carry
`node_modules` — smaller deploys and faster cold starts. (The Turbopack default is
`classic`; this repo builds with `next build`, where standalone is fully supported.)

**How:**

- Add `output: "standalone"` to both configs (Next 16 — check `node_modules/next/dist/docs/`
  per the repo rule before committing; the flag may have moved).
- On deploy, run `node .next/standalone/apps/web/server.js` (paths differ per app —
  see the Next docs).
- Public assets must be copied manually: `cp -r apps/web/public .next/standalone/apps/web/public`.

**Acceptance criteria:**

- [ ] `pnpm build` produces a `.next/standalone` directory in both apps.
- [ ] `node .next/standalone/.../server.js` boots and serves the app without `node_modules`.
- [ ] Static assets (favicon, images) still load.

**Status:** ⬜ Pending.

### 7. Narrow the `useTable` selector

**What:** in `apps/admin/components/dashboard/data-table.tsx` (line 109), the table
subscribes to the whole store via `(state) => state` — the migration comment even says
"narrow later if render-perf ever matters".

**Why:** TanStack v9 re-renders the table whenever the selected slice changes.
Subscribing to the whole state means *any* table state change (hover, column resize,
row expansion) re-renders the entire grid.

**How:**

- Select only what the table renders:
  `sorting`, `columnVisibility`, `rowSelection`, `columnFilters`, `pagination`, and the
  derived `rowModel` slices the renderer uses — per TanStack v9's
  `useTable({ getRowModel })` selector contract.
- Keep the `tableFeatures` file (`dashboard-table-features.ts`) as the single source
  for the feature list so the selector and the features never drift.

**Acceptance criteria:**

- [ ] Sorting / filtering / selecting still works identically (covered by `data-table.test.tsx`).
- [ ] React DevTools "Highlight updates" shows only the rows/cells that changed on hover — not the whole table.
- [ ] All 6 existing table tests pass unchanged.

**Status:** ⬜ Pending.

### 8. Add a bundle analyzer

**What:** add `@next/bundle-analyzer` and a root `pnpm analyze` script.

**Why:** #5 is a guess until you can *see* how much mermaid/recharts/shiki contribute.
An analyzer makes future bundle decisions data-driven instead of vibes-driven.

**How:**

- Install `@next/bundle-analyzer` in both Next apps; wrap `next.config.ts` with
  `withAnalyzer` behind `ANALYZE=true`.
- Root script: `"analyze": "ANALYZE=true turbo build --filter @workspace/admin"` (and a
  `analyze:web` variant).
- Open the generated `report.html` and record the main-bundle numbers in this doc.

**Acceptance criteria:**

- [ ] `pnpm analyze` produces an HTML report for the admin app.
- [ ] The top-5 largest chunks are identified and named in this doc.
- [ ] Running it does not change normal `pnpm build` output (flag-gated).

**Status:** ⬜ Pending.

---

## 🧑💻 Better DX (9–20)

### 9. `.env.example` for api / web / admin

**What:** committed env templates each developer copies to `.env`.

**Why:** this one is **already done** — `apps/api/.env.example`, `apps/web/.env.example`,
and `apps/admin/.env.example` all exist, and [getting-started.md](./getting-started.md)
walks through `cp`-ing them. A fresh clone boots on the first try instead of hitting a
"failed to fetch" mystery.

**How (maintenance rule):** whenever you add a `process.env.X` / `NEXT_PUBLIC_X`
read, add it to the matching `.env.example` in the same commit — a missing example is
a bug, not a chore.

**Acceptance criteria:**

- [ ] Every env var referenced in code appears in the matching `.env.example`.
- [ ] `git status` never shows a `.env` file (they stay ignored).

**Status:** ✅ Done.

### 10. `postinstall: prisma generate` in apps/api

**What:** add `"postinstall": "prisma generate"` (or `pnpm db:generate`) to
`apps/api/package.json`.

**Why:** this session proved the exact failure mode: `pnpm install` wipes the
generated client in `node_modules/.prisma/client`, and the next API typecheck explodes
with `Property 'user' does not exist on type 'PrismaService'`. Automating regeneration
removes the landmine permanently — nobody should need to remember `pnpm db:generate`
after an install.

**How:**

- Add `"postinstall": "prisma generate"` to `apps/api/package.json` (Prisma's CLI is
  already a devDep; no `dotenv` needed for generate).
- Verify: delete `node_modules/.prisma`, run `pnpm install`, confirm `.prisma/client`
  is back and `pnpm --filter @workspace/api typecheck` passes.

**Acceptance criteria:**

- [ ] Fresh `pnpm install` leaves the API typecheck passing (no manual generate step).
- [ ] `postinstall` failure fails the install loudly (no silent half-state).

**Status:** ⬜ Pending.

### 11. Pin the toolchain (`.nvmrc` + engines)

**What:** `.nvmrc` with the Node version, plus the existing `engines`/`packageManager`
fields.

**Why:** partially done — `package.json` already pins `packageManager: pnpm@11.18.0`
and `engines.node: >=20`. Missing: `.nvmrc` and a hard floor. The ESM/resolver behavior
this repo relies on (Next 16 Turbopack, Nest ESM emit, Node `--import` hooks) is
Node-version-sensitive; "works on my machine" drift starts the moment versions differ.

**How:**

- Add `.nvmrc` containing the exact Node version you develop on (e.g. `24`).
- Tighten `engines.node` from `>=20` to the tested major (e.g. `>=24`) once you confirm
  the whole toolchain passes on it.

**Acceptance criteria:**

- [ ] `nvm use` (from the repo root) picks the right Node with zero prompting.
- [ ] `pnpm install` warns when the pnpm version doesn't match `packageManager`.
- [ ] CI (#15) installs the pinned Node version.

**Status:** 🔶 Partial — `packageManager` + `engines` exist; `.nvmrc` missing.

### 12. Husky + lint-staged

**What:** pre-commit hooks that run eslint + prettier on staged files only.

**Why:** checks are currently "remember to run them" — and memory fails under pressure.
A hook runs `prettier` and `eslint --fix` on just the staged files, so every commit is
formatted and lint-clean, and the whole-repo check (`pnpm lint`) stays fast because
only staged files are touched.

**How:**

- `pnpm add -Dw husky lint-staged`, `pnpm exec husky init` (creates `.husky/pre-commit`).
- `lint-staged` config (root `package.json` or `.lintstagedrc`):
  - `"*.{ts,tsx}": ["eslint --fix", "prettier --write"]`
  - `"*.{json,md,yml,yaml}": ["prettier --write"]`
- Keep `pnpm lint` / `pnpm typecheck` in CI (#15) — the hook is the fast local layer,
  CI is the authoritative one.

**Acceptance criteria:**

- [ ] Committing a deliberately-unformatted file triggers the hook and fixes it.
- [ ] A file with a lint error blocks the commit.
- [ ] The hook completes in <5s on a typical 3-file commit.

**Status:** ⬜ Pending.

### 13. Watch feedback loops

**What:** `typecheck:watch` and `test:watch` scripts per workspace (or at the root).

**Why:** today the loop is "edit → run `pnpm typecheck` (cold) → wait". A watch script
re-checks on save, so errors surface within a second of saving instead of when you
remember to run the check.

**How:**

- Root scripts: `"typecheck:watch": "turbo typecheck --watch"` (turbo forwards `--watch`
  to each task's `tsc` where supported; verify per workspace) and
  `"test:watch": "turbo test --watch"` (vitest natively supports `--watch`).
- If `tsc --watch` conflicts with the build config, scope the watch to the apps you're
  actively editing (`turbo typecheck --watch --filter @workspace/admin`).

**Acceptance criteria:**

- [ ] `pnpm test:watch` re-runs only the affected test file on save.
- [ ] `pnpm typecheck:watch` reports a type error <2s after saving a broken file.

**Status:** ⬜ Pending.

### 14. `dev:clean` — stale-server killer

**What:** a root script that kills leftover dev servers before you boot fresh ones.

**Why:** the recurring `EADDRINUSE` / "port already in use" pain — a crashed
`pnpm dev` leaves `next-server` / `nest start` children holding 3000/3001/8080, and the
next boot half-fails (web up, API dead → "failed to fetch"). One script kills them all.

**How:**

- Root script (macOS/Linux): `"dev:clean": "lsof -ti :3000,3001,8080 | xargs kill 2>/dev/null; echo 'dev servers stopped'"`.
- Pair it with the preflight (#16): `dev` should *check* and warn; `dev:clean` is the
  explicit hammer when you see the warning.

**Acceptance criteria:**

- [ ] With a live `pnpm dev` running, `pnpm dev:clean` stops all three listeners.
- [ ] Running `pnpm dev` right after `dev:clean` boots all apps on the first try.

**Status:** ⬜ Pending.

### 15. GitHub Actions CI

**What:** a CI workflow that runs the full check suite on every push/PR.

**Why:** there is no `.github/` at all today. CI makes the checks authoritative:
`pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` →
`pnpm deps:check`, on the pinned Node/pnpm (#11). It also runs `db:generate` so the
Prisma client is exercised in a clean environment.

**How:**

- `.github/workflows/ci.yml`:
  - `setup-node` with `node-version-file: .nvmrc` (created in #11) and
    `package-manager: pnpm` (corepack).
  - Steps: `pnpm install` → `pnpm --filter @workspace/api db:generate` →
    `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` → `pnpm deps:check`.
  - No database needed (tests are unit-level; the API doesn't hit Postgres in CI).
- Consider `actions/cache` for pnpm's store and turbo's `.turbo` cache (once #1 lands).

**Acceptance criteria:**

- [ ] A PR with a type error or lint error fails CI with a readable log.
- [ ] A green PR shows all checks passing in under ~5 minutes.
- [ ] CI uses the same Node/pnpm versions as local dev (#11).

**Status:** ⬜ Pending.

### 16. Port preflight before dev

**What:** warn (and optionally abort, via `--strict`) when 3000/3001/8080 are already
listening before starting dev.

**Why:** the stale-server problem (#14) happens because nothing checks up front — turbo
starts all tasks, three fail with EADDRINUSE, and you're left with a half-broken stack.
A preflight turns "mysterious half-failure" into "here's exactly which port is taken
and how to free it".

**How:**

- A small `scripts/preflight.mjs` (root, Node-only, no deps) that checks each port and
  exits 1 with a message like `Port 8080 is in use by pid 1234 — run `pnpm dev:clean``.
- Wire it as a root script: `"preflight": "node scripts/preflight.mjs"` and run it from
  the `dev` scripts: `"dev": "pnpm preflight && turbo dev"`.
- Non-blocking alternative: warn and continue (some people run API + web in separate
  terminals intentionally) — decide with the team; this doc recommends **warn and
  continue**, with `--strict` to abort.

**Acceptance criteria:**

- [ ] With a live server on 8080, `pnpm dev` prints which process holds the port.
- [ ] With a live server on 8080, `pnpm dev --strict` exits 1 before starting anything.
- [ ] With all ports free, `pnpm dev` behaves exactly as before (zero output added).

**Status:** ⬜ Pending.

### 17. `dev:fresh` — nuke-and-restart

**What:** one command that clears every build cache and starts clean.

**Why:** stale caches are a whole bug class in this repo — the broken-`dist` episode,
`.next` corruption after a dependency upgrade, Prisma's `.prisma/client` wipe (#10).
When something is weird, the fix is "wipe everything and rebuild"; that should be one
command, not a 5-command ritual.

**How:**

- Root script: `"dev:fresh": "rm -rf apps/*/dist apps/*/.next node_modules/.cache && pnpm install && pnpm db:all && pnpm dev"`.
- (Omit `pnpm db:all` from the script if you don't want to re-seed; make it
  `dev:fresh:no-db`.)

**Acceptance criteria:**

- [ ] Running `pnpm dev:fresh` from a dirty state boots the full stack (web/admin/api) cleanly.
- [ ] It does not delete the database or migrations (only build artifacts + install).

**Status:** ⬜ Pending.

### 18. `pnpm smoke` — boot smoke test

**What:** a script that boots the API and checks `/health` + `/docs`, exiting non-zero
on failure.

**Why:** the login outage was a *dead server with a green terminal* — nothing told you
the API was down until a 401/failed-fetch. A smoke test catches the broken-`dist` /
dead-server class of regression in seconds, and it's the perfect "did the deploy
work?" check.

**How:**

- `scripts/smoke.mjs` (root): spawns `node apps/api/dist/main.js` (or `pnpm --filter
  @workspace/api start:prod`), polls `/health` up to N seconds, asserts 200 + JSON
  `status: "ok"`, curls `/docs` for 200, then kills the child.
- Exit codes: 0 = all good, 1 = any step failed (with the failing step named).
- Wire as `"smoke": "node scripts/smoke.mjs"` and call it from CI (#15) after build.

**Acceptance criteria:**

- [ ] `pnpm smoke` passes when the API builds and boots.
- [ ] Simulating a broken `dist` (rename `dist/main.js`) makes `pnpm smoke` exit 1 with a clear message.
- [ ] It never leaves an orphaned API process behind.

**Status:** ⬜ Pending.

### 19. Enable typed routes

**What:** turn on Next's typed routes in both Next apps so `<Link href>` is type-checked.

**Why:** a typo'd route today compiles fine and 404s at runtime; typed routes make
`<Link href="/setings">` a compile error. Dead routes are caught at `tsc` time instead
of by a user. (Note: `typedRoutes` in this Next version — 16.x — may live behind a
config flag or experimental block; check `node_modules/next/dist/docs/` before wiring,
per the repo's Next-version rule.)

**How:**

- Add the typed-routes config to `apps/web/next.config.ts` and
  `apps/admin/next.config.ts` per the installed Next docs.
- Run `pnpm dev` once to generate the route types, then `pnpm typecheck`.

**Acceptance criteria:**

- [ ] `pnpm typecheck` fails on a `<Link href="/non-existent">`.
- [ ] All existing `<Link>`/`router.push` calls still typecheck (any that fail reveal
  real dead routes — fix them, don't cast).

**Status:** ⬜ Pending.

### 20. Cleaner dev output

**What:** make `pnpm dev` output scannable instead of raw interleaved `@workspace/x:dev`
noise — and kill the "can you rename the tasks to 'Dev Admin / Dev Web / Dev API'"
question once and for all.

**Why:** raw stream mode interleaves three servers' logs with `@workspace/web:dev:`
prefixes. **This item is done as of 2026-08-05** — here's exactly what shipped and the
one hard constraint:

**How (what shipped):**

- `turbo.json` has `"ui": "tui"` — in a real terminal, `pnpm dev` renders the
  **interactive TUI dashboard** (per-task panes, statuses, zero interleaving). This is
  the primary clean-output experience.
- `dev:web` / `dev:admin` / `dev:api` now pass `--log-prefix=none` — when you run a
  single app (e.g. in a split pane or piped to a file), the `@workspace/web:dev:`
  prefix is stripped so you see the app's own output (Next's `Ready`, Nest's routes)
  cleanly.

  > [!WARNING] ⚠️ **Trade-off:** `--log-prefix=none` also strips prefixes from a task's
  > *dependencies* — `pnpm dev:web` runs `@workspace/shared:build` first (via
  > `^build`), so a failure there shows up without a `@workspace/shared:build:` tag.
  > For a single app that's a fair trade (the shared build rarely fails); if it ever
  > bites, drop the flag from that one script.
- Verified behavior (tested against turbo 2.10.8 under a real PTY):
  - TTY + `ui: tui` → TUI dashboard.
  - Non-TTY + multiple tasks → stream mode with colored `@workspace/<app>:dev:`
    prefixes (`--log-prefix=task`, the default).
  - `--log-order=grouped` is **NOT** usable for `dev` — it buffers output until the
    task *finishes*, which for persistent dev servers means **no output at all**
    (tested; 0 lines captured). Never add it to a dev task.

**The one hard constraint (why we can't name them "Dev Web"):**

turbo 2.10's prefix values are a fixed enum — `none | task | auto` — and the task id
is always `<package-name>:<task>` (e.g. `@workspace/admin:dev`). There is no per-task
`logPrefix` or label override in `turbo.json` (verified against the installed
`schema.json`: `ui` is the only output-related key, and its enum is just
`tui | stream`). The *only* way to change the label would be renaming the workspace
packages, which would ripple through every `--filter`, import, and doc in the repo —
not worth it. The TUI sidebar is the intended "nice labels" surface, and it's already on.

**Acceptance criteria:**

- [ ] `pnpm dev` in a real terminal shows the TUI dashboard (not raw interleaved lines).
- [ ] `pnpm dev:web` piped to a file contains no `@workspace/web:dev:` prefix lines.
- [ ] `pnpm dev:api` in a split pane shows Nest's output without a turbo prefix.
- [ ] A PR that adds `--log-order=grouped` to any dev task fails review with this doc as the citation.

**Status:** ✅ Done.

---

## 🚀 Admin initial-load (LCP/INP) — shipped 2026-08-08

> [!NOTE] The measurable goal this section documents: take the admin panel's **Largest
> Contentful Paint (LCP) from 1.36 s down toward HTML-paint time** (the existing INP of
> ~8 ms was already excellent and must stay that way). This is the "why" behind every
> file touched — a junior should be able to explain each change to a reviewer.

### The two things that made LCP slow

1. **First paint was blocked on the API.** `DashboardShell` rendered a full-screen
   spinner until auth hydration (`isInitializing`) AND `GET /auth/me` resolved. The SSR
   HTML was *just a spinner*, so no content could paint until JS hydrated and a network
   round-trip completed.
2. **The `/` page eagerly imported every demo section.** recharts, @tanstack/react-table,
   dnd-kit, cmdk, react-hook-form and framer-motion were all in the initial JS bundle —
   downloaded, parsed, and executed before the first frame.

### What changed (file by file)

| File | Change | Effect |
| --- | --- | --- |
| `components/layout/dashboard-shell.tsx` | Renders the shell immediately with a fallback identity; error screen only when `/auth/me` **fails** with no cached data | First paint no longer waits for the API; `/` is now statically prerendered |
| `app/(panel)/layout.tsx` + `lib/auth-server.ts` | Panel layout is now a **server component** that decodes the `adminAccessToken` JWT cookie and passes the real `{ name, email }` into `DashboardShell` | SSR paints the true identity — **no placeholder flash** |
| `app/(panel)/page.tsx` | The 8 demo sections below the chart are wrapped in `LazySection`; the chart loads eagerly behind a `ChartSkeleton` | recharts + friends load on scroll, not at hydration |
| `components/dashboard/lazy-section.tsx` *(new)* | IntersectionObserver-gated mount (default `300px` rootMargin) with a fade/slide-up reveal; never unmounts once shown | Below-fold sections only download/parse their chunks when scrolled near |
| `components/dashboard/chart-skeleton.tsx` *(new)* | Chart-shaped skeleton (header + gridlines + pulse bars) shown while recharts loads | The chart never leaves a blank gap |
| `components/layout/topbar.tsx` | `CommandPalette` is dynamic and mounts only when opened; the ⌘K listener moved to the Topbar | cmdk + the palette search index leave the initial bundle |
| `components/layout/dashboard-layout.tsx` | framer-motion sidebar tween → CSS `transition-[width]` | framer-motion dropped from the app |
| `components/layout/mobile-menu-overlay.tsx` | `AnimatePresence` → conditional render + `animate-in` CSS | framer-motion gone; the mobile `Sidebar` only mounts when opened |
| `components/ui/code-block.tsx` | shiki is a runtime `import()` (types stay static) | ~300 KB shiki chunk leaves the docs bundle |
| `stores/sidebar-store.ts` | `skipHydration: true`; `DashboardLayout` calls `persist.rehydrate()` once after mount | Fixes a hydration mismatch the shell's new SSR would otherwise cause |

### ⚠️ The zustand gotcha (read before you touch the shell)

The shell is now server-rendered. zustand's `persist` middleware rehydrates
**synchronously from localStorage at store creation** on the client — sowithout `skipHydration`, the client's first render could differ from the SSR HTML (a
persisted collapsed sidebar vs the default expanded one) and React would throw a
hydration mismatch. Pattern to reuse:

```ts title="stores/sidebar-store.ts"
persist(config, { name: KEY, skipHydration: true });
// in a component that mounts on every panel page:
useEffect(() => { void useSidebarStore.persist.rehydrate(); }, []);
```

### 🚿 The SSR hydration checklist (every new shell component must pass this)

Now that the shell server-renders, **any** window/browser read during the first
render is a latent hydration mismatch. The bugs we actually hit (all were hidden
by the old spinner gate):

| Footgun | Symptom | Fix |
| --- | --- | --- |
| `useMediaQuery` reading `matchMedia` in `useState` | Topbar brand / breadcrumb mismatch | Init `false` on server **and** first client render; resolve in an effect |
| `navigator.onLine` in `useState` | Network pill mismatch | Same pattern (init `true`) |
| `window.scrollY` in `useState` | ScrollToTop mismatch on reload | Same pattern (init `false`) |
| next-themes `resolvedTheme` in render | ThemeToggle Sun/Moon mismatch | Mounted-gate: render an invisible placeholder until one frame after mount |
| zustand `persist` sync rehydration | Sidebar collapsed state mismatch | `skipHydration` + `rehydrate()` after mount (above) |

**Rule of thumb:** if a component's first render depends on `window`/`document`/
`navigator`/localStorage/theme, its initial state must be the **same constant on
both server and client**, and the real value must arrive via an effect (or the
`useSyncExternalStore` server-snapshot pattern).

### The viewport-lazy pattern (reuse for new sections)

```tsx
<LazySection height="h-40">
  <MyHeavySection />
</LazySection>
```

- The `height` reserves space → zero layout shift while the skeleton shows.
- The IO fires ~300px early, so by the time the user scrolls there, the section is
  usually already rendered.
- The reveal is a CSS `fade-in slide-in-from-bottom-2` — no JS animation lib needed.
- SSR-safe: `visible` starts `false` on both server and client (no hydration mismatch).

### SSR + SPA — how it actually works now

- **Every page SSRs.** Client components still render to HTML on the server; only the
  *interactivity* is hydrated. The `/` page is statically prerendered; the shell is
  rendered per-request with the real user (because it reads the cookie).
- **Navigation stays SPA-like.** The `(panel)` route-group layout stays mounted across
  navigations — Next swaps only the page `children`, so the sidebar/topbar never
  reset (search state, animations, the command palette all persist).
- **Only heavy interactive sections are client-deferred** — and only until they're
  needed (chart immediately, demos on scroll).

### How to re-measure (and what "good" looks like)

- Lighthouse in DevTools or `npx lighthouse http://localhost:3001/ --only-categories=performance`
  (log in first so the panel is the measured page, not the login form).
- Expected: **LCP ≈ TTFB + HTML-paint time** — the HTML now contains the shell, stat
  cards, and chart skeleton, so the first paint no longer waits on JS or the API.
- INP should stay low (single-digit ms) — the only animations left are CSS transitions
  (sidebar width, drawer, reveal fades), which never block the main thread.

### What's still on the table (follow-ups, not regressions)

- The `/docs` route bundle still ships react-markdown + KaTeX for math-heavy guides
  (acceptable: it's a route-level chunk, not the initial bundle).
- `data-table.tsx` still subscribes to the whole table state (#7) — worth doing when
  the table grows real data.
- #8 (bundle analyzer) would make the next perf pass data-driven instead of measured
  by hand.

---

## Keeping this doc honest

- **When you ship an item:** flip its status to ✅ (or 🔶 for partial) and tick the
  acceptance criteria you verified. Unticked boxes mean "claimed but unproven" — don't
  mark an item done on vibes.
- **When you add a performance/DX improvement** that isn't listed: add it here with a
  priority and acceptance criteria — the matrix is the team's agreed backlog, not a
  graveyard of old ideas.
- **When you touch `turbo.json` or the dev scripts:** re-check #20's constraint box
  (never `--log-order=grouped` on dev) and update the acceptance criteria if the
  behavior changes.
