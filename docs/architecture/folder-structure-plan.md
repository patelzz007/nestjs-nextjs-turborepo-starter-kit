---
title: "Folder structure and type-safety plan"
description: "The agreed plan (2026-11-05) to simplify the repository's folders, convert the tooling to typed, reusable TypeScript, generate the standard RLS policies, and tighten the types (branded IDs, enum-derived unions, keyed records, typed routes) without losing any behaviour. Most of it is done; the status table lists what is open."
author: "Platform Team"
lastUpdated: 1793865600000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 9
tags: ["architecture", "structure", "tooling", "rls", "typescript", "plan"]
---

# Folder structure and type-safety plan

**Status (2026-11-06): phases 1, 2, 3, 4, 6 and 8 done; phases 5 and 7 have open items.**

| Open item | Why it is open |
|---|---|
| Phase 5: `apps/docs/scripts/capture-api-samples.mjs` is still JavaScript | 1,500 lines of untyped API responses need real schemas |
| Phase 5: the `ci:local` step list stays in `src/ci-local/ci-local-plan.ts` | It reads names and ports from `tooling.config.ts`, but the steps themselves did not move |
| Phase 7: branded ids are not rolled out | `Id`, `idSchema`, `TenantId`, `UserId` and `LocationId` exist. About 1,125 `userId`, `tenantId` and `locationId: string` parameters in `apps/api/src` still use plain strings. Each needs a real parse at its source (Prisma rows, fixtures like `"user-1"`), because casts are banned. Go context by context |
| Phase 8: merchant route builders return `AppPath` | Its tenant-relative paths aren't real routes, so they become routes through `appRoute()` where they are used | Every decision below was made with the owner in one
grilling session (Q1–Q44). The tables below keep the original "from" paths as the record of what moved; see
`docs/history/PROGRESS-2026-11-06.md`.

## Goal and ground rules

Make the repository simpler to find your way around and harder to get wrong, **without losing any behaviour**.

| Rule | What it means here |
|---|---|
| No behaviour change | A move changes paths and the references to them, nothing else. The RLS and type phases change code, and each is proven equivalent (below) |
| Everything that points at a path moves with it | Imports, `tsconfig` paths, `package.json` scripts and exports, `pnpm-workspace.yaml`, `turbo.json`, CI workflows and the `ci-changes` filter, `.gitignore` (anchored, see below), Dockerfiles and compose files, docs and their links, `rules/`, skills, `AGENTS.md`, code comments |
| `.gitignore` stays anchored | A moved folder never falls under an unanchored ignore rule (2026-10-29: `logs/` unanchored hid source). Checked by the fresh-clone step |
| Scoped checks per step, full gate once | After each step: that area's typecheck, lint and tests. At the end: `format → lint → typecheck → test → test:e2e → ci:local`, plus a fresh clone with the CI-only database setup |
| Start from a quiet tree | The starting point is the owner's pushed commit; the other agent session pauses until the end |
| No commits without the owner | The work stays in the working tree for review |

## What stays as it is (and why)

| Area | Why it stays |
|---|---|
| `apps/api/src` inside (contexts, platform, layers) | It follows the approved DDD/CQRS plan (ADR 058/059) |
| `apps/mobile/src` and `packages/ui-native` inside | Must stay identical to `expo-boilerplate` (only typed routes change, in both repos) |
| `contexts/` next to `features/` in the apps | Deliberate: business areas vs client UI state stores (ADR 023, migration plan #17) |
| `rules/`, `skills/`, `.agents/skills`, `.claude/skills` | The repository contract and installed tool plumbing (`skills-lock.json`) |
| `.cursor/rules/*.mdc` | Two path-triggered pointers into `rules/`, not copies |
| Each web app's `lib/navigation`, `lib/session`, `lib/palette`, `lib/routes.ts` | Measured 10–50% alike across web, admin and merchant: same file names, each app's own menus, permissions and redirects. The shared machinery is already in `packages/client` |
| Tool config files (`postcss.config.mjs` ×4, `rspack.config.mjs`, `jest.resolver.cjs` ×2, the Babel config, `lint-staged.config.mjs`) | Their tools require these formats |
| `compose.yml` at the root | Local development services (`docker compose up` from the root), not deployment |
| The admin component gallery inside admin | Moving it out would mean rebuilding its shell, sign-in and the 211-screenshot visual suite for no user-facing gain |

## Before phase 1

`packages/docs-renderer` is **not in git** (untracked, not ignored) and `apps/docs` depends on it: a fresh clone would
not build. It goes into the first commit with the docs work. (Found during the survey; not a structure decision.)

## Phase 1: the repository root and the docs

| From | To | What changes with it |
|---|---|---|
| `PROGRESS-2026-10-28.md`, `-10-29`, `-10-31`, `-11-02`, `-11-05`, `FIXES-2026-10-27.md`, `SESSION-NOTES-2026-10-25.md`, `SECURITY-AUDIT-2026-10-25.md` | `docs/history/` (same names, flat) | 4 files link to `PROGRESS-*` and 4 to the security audit (`enhancements.md`, three API code comments); `AGENTS.md` and the "log in PROGRESS" convention say new progress files go to `docs/history/` |
| (new) | The docs site skips `docs/history/` | `apps/docs/vite.config.ts` and `content.server.ts` leave the folder out; a test proves no `/docs/history/*` page is built. **The security audit must never be published** |
| `blog/` | `docs/blog/` | 48 files mention `blog/`: the docs site's page list and content loader (pages stay at `/blog/...`), `ci-changes` (`DOCUMENTATION_FOLDERS`), docs links |
| `docs/assets/` (7 files: logos, architecture diagram, OG image, README banner) | `docs/images/` | 2 files link to it (the README banner, the OG image) |
| `bundle-budgets.json`, `load-baselines.json`, `mobile-startup-budgets.json` | `budgets/bundle.json`, `budgets/load.json`, `budgets/mobile-startup.json` | 11, 10 and 5 references (the bundle-budget, load-baseline and cold-start tools, CI, docs); the tools still rewrite them, so they stay JSON; `tooling.config.ts` (phase 5) names their paths |
| `logs/`, `.ci-logs/`, `.dev-timing/`, each app's `test-results/` | `.artifacts/<kind>/` (`ci`, `dev-timing`, `logs`, `playwright/<app>`), one ignored folder | 12, 3 and 4 references (`ci:local`, dev-timing, Playwright configs); `.gitignore` gets one anchored `/.artifacts/` entry |
| Root stays | `README`, `INSTALL`, `AGENTS`/`CLAUDE`, `PRODUCT`, `GLOSSARY`, `enhancements.md`, `CHANGELOG`, `project.json`, `skills-lock.json`, `compose.yml`, and the workspace config files | — |

## Phase 2: one home for deployment

| From | To | What changes with it |
|---|---|---|
| `deploy/docker`, `deploy/droplet`, `deploy/nginx`, `deploy/pm2` | `infra/docker`, `infra/droplet`, `infra/nginx`, `infra/pm2` | 19 files mention `deploy/` (Dockerfile paths in compose files, the droplet setup script, the deploy tools, CI, the DigitalOcean guide) |
| `apps/aws-infrastructure` (CDK) | `infra/aws` | 11 references; `pnpm-workspace.yaml` gains `infra/*`; the package keeps its name, so `pnpm --filter` commands don't change; `turbo.json` and CI paths updated |

## Phase 3: the apps

| From | To | What changes with it |
|---|---|---|
| `apps/web/data/user-sidebar-menu.json`, `apps/merchant/data/merchant-sidebar-menu.json` | each app's `lib/navigation/` (admin's is already there); the `data/` folders go | 3 references each |
| `apps/admin/components/showcase/` | `apps/admin/components/component-gallery/showcase/` | 9 references |
| `apps/merchant/lib/url-state/__tests__/url-states.test.ts` (a test with no code beside it) | split into the `__tests__/` of the contexts whose URL state it checks (rewards, POS…); `lib/url-state/` goes | Plus a scan for any other code-less test folder |
| `lib/env/env.runtime.ts` (96% the same in all three apps), the client and server env wrappers (about 75%) | One `env.runtime.ts` and a small factory in `packages/client`; each app keeps only its `env.schema.ts` (its own variables) and a few lines calling the factory | Same parsing, the same start-up failure on a bad env; the env tests move with it |

Measured similarity of the same-named `lib/` files (why only env moves):

| File | Web ~ admin | Web ~ merchant | Admin ~ merchant |
|---|---|---|---|
| `env/env.runtime.ts` | 96% | 96% | 96% |
| `env/env.client.ts` | 69% | 73% | 73% |
| `env/env.server.ts` | 75% | 76% | 75% |
| `env/env.schema.ts` | 49% | 69% | 52% |
| `navigation/breadcrumb.ts` | 35% | 29% | 34% |
| `navigation/menu-icons.ts` | 18% | 41% | 23% |
| `navigation/sidebar-menu.ts` | 52% | 49% | 47% |
| `session/capabilities.ts` | 46% | — | — |
| `palette/store-config.ts` | 50% | 50% | 50% |

## Phase 4: test helpers and rules

| From | To | What changes with it |
|---|---|---|
| `apps/admin/test/`, `apps/merchant/test/`, `apps/web/test-support/`, `apps/analytics-consumer/src/test-support/`, `packages/client/src/test/` (merged with `testing/`) | `testing/` in each (`packages/api-client`, `client`, `tokens` and `ui` already use `testing/`) | `@/test/...` imports, `tsconfig` paths, Vitest setup files, package exports (`./testing/*`) |
| `apps/api/test/` (e2e specs and their snapshot) | `apps/api/e2e/` (like the web apps' Playwright `e2e/`) | `vitest.config.e2e.ts` (`include`), the e2e helpers' imports, `ci:local`, CI, docs |
| `apps/mobile/test/`, `packages/ui-native/test/` | **unchanged** | Kept identical to `expo-boilerplate` |
| `rules/16-code-review-checklist.md` (a second "16") | `rules/33-code-review-checklist.md` | 10 references (`AGENTS.md` routing table, rules, skills) |
| `rules/22-glossary.md` (architecture terms) | `rules/22-architecture-terms.md` | 4 references; `GLOSSARY.md` (the business language) is the only "glossary" |

Tests themselves stay in `__tests__/` beside the code, as now.

## Phase 5: the tooling, typed and reusable

**Today:** 76 `.mjs` scripts and tests in `packages/tooling` (plus `apps/docs/scripts`), plain JavaScript, linted but
never typechecked (no `tsconfig`). None is dead: every one is called by a package script, CI, a git hook, another script,
a config or a guard test. 28 of the 65 scripts hard-code this repo's app paths, 14 its package names, 9 its ports and 4
its seed data. The package depends only on `zod` and Node.

**After:**

| Change | Detail |
|---|---|
| TypeScript, no build step | Every script becomes `.ts`, run by Node 24 directly (`process.features.typescript` is `strip`), so hooks and CI still work before an install. Erasable syntax only (no `enum`, `namespace` or parameter properties) |
| Typechecked | `packages/tooling/tsconfig.json` and a `typecheck` script, in the gate like every other package, under the same rules (explicit return types, no `any`, no casts) |
| One layout | `packages/tooling/src/<tool>/`: the engine, `cli.ts` and `__tests__/`, replacing the `scripts/` + `scripts/lib/` + `src/` mix. The `pnpm` commands stay the same |
| Engines vs settings | Engines contain no app names, ports or paths. This repo's values live in one typed `tooling.config.ts` at the root (zod-checked when a tool starts): apps and their folders, workspace names, ports, the jobs `ci:local` runs, deploy targets, the `budgets/` paths, the `.artifacts/` folders. `project.json` stays as it is and is read by the settings file |
| Starter-specific tools marked | Tools that only fit this architecture (`scaffold-context`, `certification-check`, the mobile device and screenshot tools) live in `src/starter/<tool>/` |
| Reusable | (a) A product built from this starter changes `tooling.config.ts`, never the tool code; (b) the package works when copied into another repo with its own settings file. Actually copying it into `expo-boilerplate` is a later, separate task. Not published to npm |
| Documented | `docs/technical/tooling/tools.md`: every tool (command, what it does, who runs it: you, a hook, `ci:local`, GitHub CI; which settings it reads) and the nine kept config files (what each is for). `packages/tooling/README.md` points to it. A test fails when a tool exists that the list doesn't mention |

## Phase 6: RLS in one folder, standard policies generated

**Today:** a 1,120-line `prisma/rls.sql` plus 17 fragments in `prisma/rls/`, applied in order by TypeScript in the
same folder (`apply.ts`, `apply-plan.ts`, the manifests). There are 250 policies, which reduce to **80 distinct rule shapes** once
table and column names are blanked out; the six most common cover about 180 policies, and 46 are one-offs. Identical
rules are spelled two ways ("bypass OR owner" ×13 vs "owner OR bypass" ×11; `USING …` ×35 vs `FOR ALL USING …` ×9).

| Change | Detail |
|---|---|
| One folder | `prisma/rls.sql` → `prisma/rls/10-policies.sql` (a numbered fragment like the rest); the apply order stays exactly the same; 24 references updated |
| A per-table list | Next to the table manifest, each table declares the standard rule it follows: system-only, owner-only, insert-only (audit), readable by all, tenant-scoped, API-key store access, and any others the 80 shapes show to be standard. The list must name every table, so a check fails for a table without a rule |
| Generated policies | The apply step writes the standard policies from the list; the 46 one-off policies stay hand-written SQL |
| One spelling per rule | Generated policies use a single form for each rule |
| Proof | Build a fresh database before and after and compare every row of `pg_policies` (table, action, roles, conditions): the only differences allowed are the listed rewordings. Then the RLS, single-tenant RLS, tenancy and API e2e suites |
| ADR 083 | Records the decision (hard to reverse, surprising without context, a real trade-off), linked from `prisma/rls/README.md` and `docs/technical/security/database-security.md` |

## Phase 7: types that mean something

**Today:** no casts, about 2,950 generic declarations, and little copy-paste between similar files (list handlers
average 34% alike, repositories 14%, controllers 16%, page views 11%). The weak spots are in what the types mean:

| Change | Detail |
|---|---|
| Branded IDs | One generic `Id<"User">`, `Id<"Tenant">`… from one `idSchema("User")` factory in `packages/shared`. Contract schemas produce them at the API boundary, so a tenant ID passed as a user ID stops compiling (4,063 parameters are plain `xxxId: string` today; `EpochMs` is the only brand). Rolled out context by context: user, tenant and location first. Autocomplete shows `Id<"User">` |
| One source per set of values | The 36 hand-written unions identical to an existing `z.enum` become `z.infer` of it; a guard test fails when a hand-written union repeats an enum |
| Keyed objects | Objects with a known set of keys use `Record<TheUnion, …>` or `satisfies`, so a missing or misspelled key fails (27 found; all 469 `Record<string, …>` are reviewed, and genuinely open-ended maps stay) |

## Phase 8: typed routes

| App | Change |
|---|---|
| web, admin, merchant | `typedRoutes: true` (Next 16.4, `next.config.ts`); every `href`, `redirect` and `router.push` is checked against the real pages and autocompleted; each app's `lib/routes.ts` builders return the typed route |
| mobile, and `expo-boilerplate` identically | `experiments.typedRoutes` in `app.config.ts`; `ROUTES` (82 uses) typed against the generated route type. Expo writes those types only while its dev server starts, so they are committed with a staleness check that fails when they're out of date with the screens (the pattern the generated tokens use) |

## Order, and what is checked when

| Step | Scoped check |
|---|---|
| 1 Root and docs | Docs site build (no `/docs/history` page), `ci-changes` tests, docs link check, `git check-ignore` on every moved folder |
| 2 Deployment | `infra/aws` typecheck and tests (CDK synth), compose config validation, deploy-tool tests |
| 3 Apps | Each app's typecheck, lint and unit tests; env tests |
| 4 Test helpers and rules | All unit tests; API e2e with the renamed folder; rules link check |
| 5 Tooling | Tooling typecheck, lint and tests; every `pnpm` command it backs run once (`ci:local --help`, hooks dry-run) |
| 6 RLS | `pg_policies` comparison on fresh databases; RLS, single-tenant RLS, tenancy and API e2e |
| 7 Types | Full typecheck; the unit tests of the touched contexts; the enum-duplication guard |
| 8 Routes | Typecheck of all four apps; the route-types staleness check; the same change verified in `expo-boilerplate` |
| End | `format → lint → typecheck → test → test:e2e → ci:local`, then a fresh clone with the CI-only database setup |

## Afterwards

`enhancements.md` gets the items checked off and `docs/history/PROGRESS-<date>.md` records what moved, what was
measured and the gate results.
