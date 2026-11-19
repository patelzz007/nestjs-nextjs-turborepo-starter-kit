# Plan — test coverage above 95% everywhere (written 2026-11-19, work starts Saturday 2026-11-21)

Goal: every workspace that has tests, in **all three repos**, is above 95% on **all four** coverage metrics: lines, statements, functions and branches. Every source file counts, including files no test loads today. The tests prove what a user actually does, including the awkward cases (§4), not only the happy path.

| Repo | Workspaces in scope |
|---|---|
| `nestjs-nextjs-turborepo-starter-kit` (this repo) | **apps/web, apps/mobile, apps/admin, apps/merchant**, apps/api, apps/docs, apps/analytics-consumer, apps/server-agent, apps/load-runner, packages/ui, packages/ui-native, packages/ui-kit-logic, packages/client, packages/api-client, packages/shared, packages/messaging, packages/oxlint-config, packages/tokens, packages/tooling, packages/docs-content, packages/docs-renderer, packages/docs-sync, infra/aws. In short: everything that has tests. |
| `nextjs-admin-dashboard-layout` | The whole app: one Vitest workspace, 380 test files today. |
| `expo-boilerplate` | The whole app: one Jest workspace, 346 suites today. |

Status: **not started.** Tonight (2026-11-19) the package upgrades and the full gate ran instead; see §9. Parts are marked ✅ when done, each with a note on what was done, what it achieved, and how each problem was solved.

---

## 1. Decisions already made (the owner, 2026-11-19)

| Question | Decision |
|---|---|
| Which metrics | All four above 95%: lines, statements, functions **and branches**. |
| Which files count | Every source file. Untested files show up at 0% and then get tests. |
| Which repos | This repo, `nextjs-admin-dashboard-layout` and `expo-boilerplate`, with the same rules everywhere. |
| What the tests prove | What the user uses (form validation, button clicks, navigation, keyboard, and so on) **and** the edge cases (§4). When the code does not handle an edge case, the **code is fixed first**, then the test proves it. |
| Thresholds | Each config's `thresholds` is raised to just below the reached values, and never lowered. |
| Budget | The owner's quota is limited. Work one part per session, stop at a part boundary, and record where it stopped (§8). |

## 2. Baseline (measured 2026-11-19, this repo, before any work)

These configs count **only files some test loads**, so the real figures are lower. Part A re-measures with every file counted. The two sibling repos have not been measured yet; part A measures them.

| Workspace | Lines | Statements | Functions | Branches | Uncovered lines to reach 95% |
|---|---|---|---|---|---|
| apps/api (unit only) | 75.6% | 75.3% | 67.9% | 65.7% | ~6,850 |
| apps/admin | 81.0% | 82.3% | 81.7% | 56.1% | ~3,440 |
| packages/ui | 83.2% | 83.2% | 82.4% | 71.1% | ~2,570 |
| packages/client | 83.3% | 83.3% | 84.0% | 75.1% | ~455 |
| apps/merchant | 84.0% | 83.9% | 79.0% | 71.7% | ~420 |
| packages/oxlint-config | 72.3% | 71.7% | 72.0% | 50.3% | ~115 |
| apps/web | 89.8% | 89.9% | 87.4% | 81.6% | ~70 |
| apps/analytics-consumer | 81.2% | 81.0% | 81.6% | 57.1% | ~20 |
| apps/server-agent | 82.9% | 82.6% | 76.4% | 53.7% | ~15 |
| infra/aws (after tonight's tests) | 90.9% | 88.9% | 84.2% | 74.3% | ~4 |
| packages/messaging | 92.6% | 92.5% | 86.4% | 84.2% | ~17 |
| packages/api-client | 94.3% | 93.2% | 95.7% | 83.1% | ~5 |
| packages/ui-kit-logic | 94.7% | 94.7% | 91.1% | 88.4% | ~7 |
| packages/shared | 95.2% | 94.8% | 86.1% | 84.2% | branches, functions |
| apps/mobile (Jest) | 96.2% | 96.1% | 94.8% | 83.2% | branches |
| packages/ui-native (Jest) | 98.0% | 97.9% | 97.3% | 91.5% | branches |
| packages/docs-renderer | 96.8% | 96.7% | 98.6% | 87.0% | branches |
| packages/docs-sync | 96.6% | 96.7% | 96.2% | 88.7% | branches |
| packages/tokens | 99.6% | 99.6% | 100% | 85.0% | branches |
| packages/tooling | 98.3% | 98.3% | 98.4% | 91.8% | branches |
| packages/docs-content | 100% | 100% | 100% | 97.1% | — |
| apps/load-runner | 98.2% | 98.3% | 100% | 96.9% | — |
| apps/docs | not measured: 3 tests fail on another thread's untracked `docs/architecture/data-table-unification-plan.md`, which has no front matter (§7) | | | | |

## 3. Rules for the work

| Rule | Meaning |
|---|---|
| User behaviour first | Test what a person does: type into a field, submit, click, open and close, navigate, use the keyboard, pull to refresh, go back. For the API: each endpoint's success, validation failure, unauthenticated, forbidden, not found, conflict and rate limit. Use Testing Library queries by role and label (web and mobile) and `userEvent` (web), never implementation details. |
| Edge cases are code first, test second | For each case in §4, check that the code handles it. If it does not, fix the code at the owning layer (for example disable the button while the request is in flight, or make the command idempotent), then write the test. Log the fix in §6. |
| Real assertions | Every test asserts an outcome the user or caller can observe. No test that only executes a line, no snapshot padding, no `expect(true)`. |
| No exclusions to reach the number | No `/* v8 ignore */` or `istanbul ignore`, and no file excluded to lift a percentage. The only excludes are files with nothing to execute or that are not source: generated artefacts, type-only declarations, test helpers and fakes, config files. Each is listed in the config with its reason. |
| Tests live in `__tests__/` | Beside the code, in every app and package, in all three repos. |
| Same code, same tests | Where the code is mirrored (this repo's `packages/ui` and `apps/admin` ↔ `nextjs-admin-dashboard-layout`; `apps/mobile` and `packages/ui-native` ↔ `expo-boilerplate`), the tests are mirrored too, with the same names and layout. |
| Scoped checks while working, full gate at the end | Per workspace: format, lint, typecheck and that workspace's tests. The full gate (`format → lint → typecheck → test → test:e2e → ci:local`) runs once, after the last part. |
| No subagents, no workarounds | As the standing instructions say: root-cause fixes only. |

## 4. Edge cases every test pass must cover

The code must handle each case, and the tests prove it.

| Area | Edge cases |
|---|---|
| Buttons and actions | Double click or double tap submits **once**: disabled while pending, or an idempotency key. A click while disabled does nothing. Keyboard Enter and Space activate it. A slow response shows a pending state. Leaving the page mid-request causes no state update after unmount. |
| Forms | Each field's validation message appears and blocks the submit. Fields that are empty, whitespace only, too long or invalid (email, phone, date ranges where the end is before the start). Server-side validation errors are mapped onto the right field. Submitting twice. The reset and cancel paths. Unsaved-changes guards. Values are kept after a failed submit. |
| Data loading | Loading, empty, error and retry states. A 401 sends the user to sign-in. A 403 shows a "no access" state. A 404 shows a not-found state. Network offline (mobile: offline banner and queued retries). A stale response arriving after a newer one must not overwrite it. |
| Lists and tables | No rows, one row, many rows and pagination edges (first and last page, page out of range). Sorting and filtering produce an empty result. Selection survives paging, or is cleared deliberately. Bulk actions with nothing selected. |
| Dialogs and menus | Opening and closing with Escape, an outside click and the close button. Focus is trapped while open and returns to the trigger when closed. Confirm dialogs: cancel does nothing, confirm runs once. |
| URL state | Invalid query parameters fall back to defaults. Back and forward restore the state. A deep link to a missing record. |
| Auth and permissions | A signed-out user, an expired session (refresh succeeds, then fails), a missing permission (button hidden or disabled, and the API refuses), impersonation, MFA steps. |
| API commands | Validation failure. Forbidden (per role and per tenant). Not found. A soft-deleted record. Concurrent writes (version or CAS conflict). Idempotent replay. Audit record written. Rate limit. |
| API queries and services | The actor guard rejects (as a rejected promise). The tenant scope. An empty page. The cursor at the end. |
| Mobile specifics | Reduce Motion on (no entering animation strands a view). Android back. Keyboard covering inputs. Pull to refresh while already refreshing. Push notification taps from a cold start. |
| Jobs and messaging | A retry after a failure, a poison message, a duplicate delivery (idempotent consumer), and shutdown mid-job (ADR 095: the job finishes first). |

## 5. Parts, in order

Each part is one or more sessions, and each ends with its scoped checks green and the thresholds ratcheted.

| Part | Scope | How | Status |
|---|---|---|---|
| A | **Measurement, all three repos.** | (1) `coverage.include` in every Vitest config (`src/**/*.{ts,tsx}`, plus `app/`, `components/`, `lib/`, `contexts/`, `features/` and similar for the Next apps), and `collectCoverageFrom` in every Jest config. (2) Add the `json-summary` and `json` reporters next to `text-summary`, written to `coverage/` (git-ignored), and list the files under 95% per workspace. (3) API: unit and e2e coverage measured together. Both suites run with `--coverage` and the blob reporter, then `vitest --merge-reports --coverage` produces the one figure the thresholds check. Prisma repositories, RLS and the HTTP pipeline are proven against real Postgres in e2e, where `rules/11` puts them; mocking the database to cover SQL would prove nothing. (4) Record the new baseline in §2 for all three repos. | ⬜ |
| B | Small workspaces in this repo: oxlint-config, messaging, api-client, shared, ui-kit-logic, tokens, tooling, docs-content, docs-renderer, docs-sync, load-runner, analytics-consumer, server-agent, infra/aws. | Mostly branches: the error paths and invalid inputs each module already handles. | ⬜ |
| C | **apps/web** and **apps/merchant** (this repo), and packages/client. | User flows per page: sign-in and sign-up forms, the merchant console's forms and tables, the double-submit and permission cases from §4. | ⬜ |
| D | **packages/ui** (web UI kit), mirrored to `nextjs-admin-dashboard-layout`'s copy. | Every interactive component: keyboard, focus, disabled, controlled and uncontrolled, empty data. The kit stays data-agnostic, so its tests drive props and events. | ⬜ |
| E | **apps/admin**, then the rest of `nextjs-admin-dashboard-layout`. | Each page: the list, view and edit flows, forms, bulk actions, settings, the audit log; the §4 cases. | ⬜ |
| F | **apps/api**, context by context: platform first, then identity, authorization, tenancy, rewards, claims, notifications, reporting, integrations-github, kanban, webhooks, files, feature-flags, operations, tiers, referrals, saved-views and reference-data. | Unit: handlers, application services, domain policies and value objects. E2E: the persistence adapters and endpoints that a unit test cannot prove. | ⬜ |
| G | **apps/mobile** and packages/ui-native, mirrored to `expo-boilerplate`. | Mostly branches: screens' error, empty and offline states, and the mobile cases in §4. | ⬜ |
| H | apps/docs. | After its 3 failing tests are fixed (§7). | ⬜ |
| I | Ratchet every threshold to the reached values (all three repos); add the 95% floor on all four metrics to `rules/11` (and the sibling repos' rules); update `enhancements.md` 3.1 and the progress log; full gate in all three repos. | | ⬜ |

## 6. Bugs found by the new tests

| Where | Wrong behaviour | Root cause | Fix |
|---|---|---|---|
| — | — | — | — |

## 7. Known issues to clear before or during the work

| Issue | Where | What to do |
|---|---|---|
| `client.query()` called while the client is already executing a query (a pg deprecation; it becomes an error in pg@9) | apps/api: some code runs `Promise.all` over queries on **one** interactive-transaction client. 39 infrastructure files combine `Promise.all` with a transaction; the exact sites are not known yet. | Run the API e2e suite with `NODE_OPTIONS=--throw-deprecation`. Each site then fails its test. Make the queries inside one transaction sequential (one connection cannot run them in parallel anyway), and add a rule to `rules/08` or `rules/19`. |
| `apps/docs` fails 3 tests | `docs/architecture/data-table-unification-plan.md` is untracked, from the data-table thread, and has no front matter. | It belongs to that thread. It needs front matter, or it moves to `docs/history/` (dated plans live there and are not published). Not touched tonight. |
| `trace-examples-use.test.tsx` takes 81 s alone | expo-boilerplate, `src/features/showcase/__tests__/` | It passes alone, but timed out in a full run under load. Find out why 22 tests take 81 s (probably rendering every example), and make it fast instead of raising the timeout. Check the same test in this repo's mobile app. |
| A Vite warning: `import "./e2e/support/e2e-worker-databases"` without a file extension | apps/api `vitest.config.e2e.ts` | Add the extension, as the native config loader will require. |

## 8. Resume checklist (Friday or Saturday)

1. `source ~/.nvm/nvm.sh && nvm use` in each repo (this repo: Node 26.13.1; the siblings also run on 26.13.1).
2. `git status` in all three repos. Tonight's changes are uncommitted (§9); keep them.
3. Start part A. After each part: update §2 (new figures), §5 (✅ plus a note), §6 (bugs) and the thresholds.
4. Stop at a part boundary when the session budget runs low, and write in §5 exactly where the work stopped.

---

## 9. Done tonight (2026-11-19): package upgrades and the gate

### 9.1 This repo

| What | Implementation | Why |
|---|---|---|
| Upgraded every package to its newest release that is at least a day old | `npm-check-updates --workspaces --root --cooldown 1 -u` across all 25 workspaces, then `rm -rf node_modules pnpm-lock.yaml` and `pnpm i` (the owner's request), then `pnpm db:generate` (schema blocks plus `prisma generate`) | The owner asked for a full sweep, a fresh lockfile, and the Prisma client regenerated so the API runs. `--cooldown 1` matches pnpm's 24 h `minimumReleaseAge` supply-chain rule, so nothing too new is pulled in. |
| Notable moves | pnpm 12.16.1 → 12.21.0, Nest 12.4 → 12.5, tsrs 0.24 → 7.1.0-beta.tsrs2, oxlint 1.93 → 1.94, oxfmt 0.78 → 0.79, recharts 3.10 → 3.11, tiptap 3.33 → 3.34, Expo 58.0.24 → 58.0.26 (and its modules), aws-cdk-lib 2.276 → 2.277, @platformatic/kafka 2.16 → 2.17, plus patches | Newest stable releases. tsrs3 and turbo 2.11.13 are under a day old and come in the next sweep. |
| Held back, each with its blocker (recorded in `pnpm-workspace.yaml` → "Versions held back") | react/react-dom 19.3.1, react-native-reanimated 4.7.2, svg 15.16.1, keyboard-controller 1.23.1, view-shot 6.2.1, worklets 0.13.1, metro 0.88, `@babel/plugin-transform-dynamic-import` 8 | Expo 58.0.26's `bundledNativeModules.json` pins the old versions (React Native needs an exact React match), `@expo/metro` bundles metro 0.87.1, and babel-preset-expo runs on Babel 7. Both `expo install --check` (offline) and `pnpm check:expo-latest` (online) pass. |
| Held: fontkit 3 | Stays on 2.0.4 | PDFKit 0.20.2 (latest) draws with fontkit ^2.0.4, and the API's report-font registry validates the fonts with fontkit before PDFKit draws them. The validator and the renderer must be the same engine. |
| Held: eslint 10 | Stays 9.39.5 | It is only the peer of the oxlint JS plugins (eslint-plugin-react 7.37, jsx-a11y 6.10), whose peer ranges stop at ^9. |
| Fix: infra/aws typecheck (aws-cdk-lib 2.277) | `OriginBucket` overrides the new `encryption` getter, through `knownBucketEncryption()`: it returns the known mode, and if the mode is not known it **stops synthesis**. 3 new tests: the known mode, the unknown mode, and the synthesized bucket's SSE-S3 config. Floors raised to 90/88/84/74. | CDK 2.277 added `Bucket#encryption: BucketEncryption \| undefined` against `IBucket#encryption?: BucketEncryption`, the same mismatch the class already handled for `isWebsite`. "Unknown" must never be replaced by a guessed default, because a consumer decides key grants from it. |
| Fix: admin typecheck (recharts 3.11) | `chart-22.tsx` passes `fill` to `<Sector>` only when the slice has one; showcase sources regenerated. | recharts 3.11 types `Sector`'s `fill` as `string \| RechartsFill`, no longer accepting `undefined`. An absent fill now keeps Sector's default instead of an explicit `undefined`. |
| Fix: the EAS guard test | `apps/mobile/eas.json` pnpm 12.16.1 → 12.21.0 | The guard requires EAS builds to use the repo's own pnpm. It caught the bump. |
| Fix: the dependency-override guard test | Removed the `gaxios>uuid` override and its guard test | With the fresh lockfile, the installed gaxios (7.3.1, 8.3.3) no longer depends on uuid, and uuid is not installed at all. The security override was dead, so its guard had nothing left to check. |
| Fix: `FeatureFlagGate` (mobile, both repos) | Returns `ReactNode` directly instead of wrapping it in a one-child fragment | oxlint 1.94 flags the useless fragment in expo-boilerplate (whose config enables the rule). The fragment existed only to turn a `ReactNode` into a `JSX.Element`, and React 19 components may return `ReactNode`. Changed in both repos so the code stays identical. |
| pnpm "agent skills" prompt | `permissions: skills: false` for `@tanstack/react-router` and `@tanstack/react-start`, next to the existing `@tanstack/react-table` | pnpm 12.21 asks whether a dependency may add agent skills. The repo's own rules are the agent's instructions, the same decision already made for react-table. |
| Gate results | format ✅, lint ✅, typecheck ✅, test ✅ (every workspace except apps/docs: §7), test:e2e ✅ (API 122 files / 783 tests, analytics-consumer 4 / 16), ci:local ✅ except the apps/docs steps (§9.4) | |
| Also done earlier today | D1 (ADR 096): 64 of the 119 query handlers became application-service methods, and 55 stay as queries. A wiring bug found by e2e (the authorization services were not exported to `AuthorizationHttpModule`) was fixed. See `PROGRESS-2026-11-19.md`. | |
| Nothing committed | All three repos have uncommitted changes, as the standing instructions require | Review, then commit. |

### 9.2 `nextjs-admin-dashboard-layout`

| What | Implementation | Why |
|---|---|---|
| Upgraded | `npm-check-updates --cooldown 1 -u` and `pnpm install` (lockfile kept): pnpm 12.21.0, recharts 3.11, oxlint 1.94, oxfmt 0.79, tsrs 7.1.0-beta.tsrs2, intl-messageformat 12.2, react-query 5.108, react-resizable-panels 4.24, lucide-react 1.74, playwright 1.65.1, postcss, axe-core | The same sweep as this repo. |
| Fix | The same `chart-22.tsx` change as this repo, and showcase sources regenerated | recharts 3.11 (as above), with the same code in both repos. |
| Checks | lint ✅, typecheck ✅, test ✅ (380 files, 5,131 tests) | |

### 9.3 `expo-boilerplate`

| What | Implementation | Why |
|---|---|---|
| Upgraded | `npm-check-updates --cooldown 1 -u` and `pnpm install`: Expo 58.0.23 → 58.0.26 and every expo-* module, expo-router 58.0.32, expo-web-browser 58.1, react-query 5.108, zustand 5.1, uniwind 1.14, nuqs, marked, tailwindcss, lottie 7.5.1, oxlint 1.94, oxfmt 0.79, tsrs 7.1.0-beta.tsrs2 | The same sweep. |
| Held | react 19.3.1, reanimated, svg, keyboard-controller, worklets, **gesture-handler 3.5** (Expo pins ~3.3.0), `@babel/core` 8 and the Babel 8 plugin | Expo 58.0.26's pins and its Babel 7 toolchain. `expo install --check` passes. |
| Fix | `FeatureFlagGate` (see 9.1) | oxlint 1.94's `jsx-no-useless-fragment`. |
| Checks | lint ✅, typecheck ✅, test: 345 / 346 suites ✅; `trace-examples-use` timed out under load (passes alone, 22/22, but takes 81 s: §7) | |

### 9.4 ci:local (this repo, 31 min)

| Step | Result | Note |
|---|---|---|
| Lint, typecheck, RLS manifest drift, security SQL, dependency consistency, migration history, dependency audit, secret scan, docs links | ✅ | |
| Database + API e2e (build, deploy, drift, seed, seed coverage, integrity, API, tenancy, RLS, enterprise seed), single-tenant e2e + RLS, analytics-consumer e2e | ✅ | |
| Browser e2e (build, deploy, seed, install, web, admin and merchant suites) | ✅ | |
| Unit tests | ❌ **apps/docs only** | Every other workspace passes. apps/docs fails 3 tests on `docs/architecture/data-table-unification-plan.md` (no front matter; §7). |
| Build | ❌ **apps/docs only** | Same cause: the docs build cannot render `/` while that file has no front matter. |
| Bundle budgets | ❌ | Measures the docs build output, so it fails because the build did. |

**Root cause of all three ❌:** one untracked file from the data-table thread (§7). It is that thread's file, so it was left untouched. Once it has front matter, or moves to `docs/history/`, rerun `pnpm ci:local`. The upgrades themselves broke nothing that remains unfixed.
