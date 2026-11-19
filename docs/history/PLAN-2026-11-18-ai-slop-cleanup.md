# Plan — 2026-11-18: project-wide code quality cleanup

Goal: remove needless code, indirection and noise from the whole repository without changing behaviour, security, contracts or accepted architecture decisions.

Status: plan only. Nothing in the source tree has been changed yet. No source edit starts until the owner says go.

Same phase: per-endpoint API versioning, `PLAN-2026-11-19-endpoint-versioning.md`. Its section 9 gives the order of the two pieces of work.

## 1. What the reconnaissance found

Measured on `main` at `464aba2f`, with the working tree as it stands today.

| Measure | Value |
|---|---|
| Source lines (TS/TSX/JS, tests excluded) | about 830,000 across 9 apps and 14 packages |
| Biggest workspaces | admin 217k, api 195k, mobile 143k, ui 88k, ui-native 41k, shared 33k |
| Uncommitted files before this work | 366 (287 modified, 41 deleted, 38 new) |
| Lint or TypeScript suppressions | 2 (the approved `signature-pad.tsx` exception) |
| `TODO` / `FIXME` / `HACK` markers | 66 |
| `return await` | 58 |
| Files that only re-export something from elsewhere | 82 (71 are context `index.ts` / `public-api.ts`; 11 are plain forwarding files) |
| Doubled folder | `apps/api/src/platform/infrastructure/interfaces/interfaces/` |
| API command and query handlers | 307; 82 of them are under 20 lines |
| API `*Port` interfaces | 200: 184 have one implementing class, 3 have several, 13 have no `implements` clause anywhere |
| DI tokens declared as `Symbol(...)` | 280 |
| Folders holding exactly one source file | api 159 of 749, admin 82 of 297 |
| Comment share of source lines | api-client 27 %, tokens 24 %, shared 21 %, messaging 21 %, client 18 %; admin and mobile about 8 % |
| Class-name suffixes worth challenging | Adapter 58, Store 42, Factory 24, Processor 23, Registry 13 |
| Dead-code and duplicate-code tooling in the repo | none (no knip, no jscpd) |

Two findings look like slop but are accepted decisions, so they stay:

| Pattern | Why it stays |
|---|---|
| 184 ports with one implementation | `docs/architecture/ddd-cqrs-spec.md` forbids the application layer from importing Prisma types, and handler tests use port test doubles. The port is the layer boundary, not a guess at a second implementation. |
| `contexts/<name>/index.ts` and `public-api.ts` barrels | They are the one public door of each bounded context (ADR 058). The lint boundary rules depend on them. |

## 2. Decisions the owner must make

Work that does not depend on these starts without waiting.

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | 82 query handlers only forward one call to a port (example: `list-roles.handler.ts`). ADR 059 says plain CRUD reads belong in an application service, not on the bus. Convert them? | (a) leave as they are; (b) convert to application services, context by context | **Decided by the owner (2026-11-18): (b), in this pass.** **Withdrawn on 2026-11-19, before any code changed: the question's premise was wrong.** ADR 059 does not say reads belong in an application service. It says "use a query when the read model is not the aggregate", and `rules/23` (line 14) plus the approved migration plan §4.4 say "no state change → Query + QueryHandler (always; even trivial reads)". The stated reason is one explicit place per read for authorization, projection and N+1 discipline. The handlers follow that rule (38 are pure one-call forwards; 82 was a looser count), so they stay under rule 3 below. Converting them would need a rule change to `rules/23` and the plan first; the owner was told. **Re-decided by the owner (2026-11-19): change the rule, then convert.** [ADR 096](../adr/096-single-port-reads-are-application-services.md): a read through one read port (or one existing application service) becomes an application-service method; a read that composes collaborators stays a Query + QueryHandler. `rules/23` and migration plan §4.4 changed first. **Done (2026-11-19):** 64 of 119 handlers converted across 12 contexts, 55 kept; migration plan §7 rows say `S` with the service. |
| D2 | The working tree has 366 uncommitted files. A repo-wide cleanup on top of them cannot be told apart in `git diff`. | (a) owner commits first; (b) I work on top and keep a baseline patch to diff against | (a). Until then I use (b) and never touch a file only to reformat it. |
| D3 | `apps/admin/components/component-showcase/examples/**` and the large UI kit files (`data-grid`, `gantt`, `event-calendar`, `time-picker`) follow the upstream ReUI / shadcn shape. | (a) treat as vendored: dead code and comments only; (b) restructure them too | (a). Restructuring them makes every future upstream update a hand merge. |

## 3. Rules for every change in this plan

| Rule | Meaning |
|---|---|
| Behaviour stays the same | No change to API contracts, database schema, RLS, authorization, tenancy, audit, rate limits or business rules. No migration is expected. |
| Accepted ADRs stay | A pattern an ADR chose is not removed. If one looks wrong, it is written down in section 6 of the final report, not silently reversed. |
| Proof before deletion | A symbol or file is deleted only after a repo-wide search (source, tests, scripts, docs, config, string references) shows no consumer. A tool report alone is not proof. |
| No new dependency | `knip` and `jscpd` run through `pnpm dlx` as one-off reports. Nothing is added to a `package.json`. |
| No new suppression, cast or weakened test | Same as `rules/00-non-negotiables.md`. A test is removed only together with the code it tested. |
| Both mobile repos | A change under `apps/mobile` is reported so the owner can mirror it in `expo-boilerplate`. |
| Tests move with code | A moved file keeps its `__tests__/` folder beside it. |

## 4. Work batches

Each batch is: read the code and its consumers, change, run the scoped checks for the touched workspaces (`format`, `lint`, `typecheck`, unit tests), read the diff. The full gate runs once, at the end.

| # | Batch | What happens | Scope known today |
|---|---|---|---|
| 0 | Baseline | Save the list and patch of the 366 pre-existing changes outside the repo. Run `pnpm run lint` and `pnpm run typecheck` once so later failures can be told apart from existing ones. | whole repo |
| 1 | Forwarding files | Delete files that only re-export from another package; point their importers at the real source. Flatten `interfaces/interfaces/`. | 11 files: `kafka-producer.service.ts`, `redis.config.ts`, `redis.tokens.ts`, `interfaces/interfaces/json.ts`, `presentation/http/idempotency/idempotent.decorator.ts` (api); `rate-limit.ts`, `permission-check.ts`, `test-utils.ts` (client); `data-table/labels.ts` (ui); `palette/styles.ts` (admin); `authorization/facade.ts` (mobile, checked against the mobile feature-boundary rule first) |
| 2 | Dead code | `knip` report for unused files, exports and dependencies; verify each hit by search; delete what is truly unused. Resolve the 13 ports nothing implements. | size known after the report |
| 3 | Line-level noise | Drop `return await` outside `try` blocks. Close or delete the 66 TODO markers. Remove comments that restate the code; keep every comment that gives a reason, a rule, a security or framework constraint. Comment-heavy packages first: api-client, tokens, shared, messaging, client. | 58 + 66 + comment pass |
| 4 | Duplication | `jscpd` report on non-test source. Merge only copies that are the same concept and change together. Main suspects: the three Next.js apps (admin, merchant, web), `ui` against `ui-native`, per-context repository helpers in the API. | size known after the report |
| 5 | Naming | Review every `Factory`, `Registry`, `Processor`, `Adapter`, `Store`, `Manager`, `Helper` class and the handle/process/execute function names. Rename only where the name hides what the code does. | about 160 classes |
| 6 | Needless structure inside the accepted architecture | Single-use helpers moved next to their one caller; one-file folders merged where the folder adds nothing; factories that build one fixed object replaced by the object; DI tokens with no second binding checked against the layer rule. | api 159 folders, admin 82 folders, 24 factories |
| 7 | TypeScript | Simplify conditional and mapped types that no caller needs; remove type parameters that only ever take one type; remove hand-written types a zod schema already gives. | `shared`, `api-client`, `client`, `ui-kit-logic` |
| 8 | Frontend and mobile | Components that only forward props, hooks used once that wrap one call, state that can be derived, copies of server state outside TanStack Query. | admin, merchant, web, mobile, `client` |
| 9 | Workspace read pass | Read each workspace top to bottom for anything the tools miss: tangled functions, deep nesting, unclear module boundaries. | order: shared, api-client, messaging, client, api (context by context), tooling, docs packages, web, merchant, admin, mobile, ui, ui-native |
| 10 | Consistency and close | Second sweep for anything the earlier batches exposed. Update docs that name moved files. Add the `PROGRESS-2026-11-18` entry. Run the full gate. Write the report. | whole repo |

Order reason: batches 1 to 3 shrink the code and carry almost no risk, so the later, judgement-heavy batches read less code.

## 5. Verification

| When | Command | Note |
|---|---|---|
| Baseline and after each batch | `pnpm --filter <workspace> run format`, `lint`, `typecheck`, `test` | only the workspaces the batch touched |
| After API changes | `pnpm --filter @workspace/api test:e2e` | throwaway databases; the dev database is not migrated, reset or seeded |
| Once, after the last edit | `pnpm run format`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run test:e2e`, `pnpm run ci:local` | `ci:local` as `--skip-e2e` then `--e2e-only` if the owner's dev servers hold ports 8080 / 3000 / 3001; the browser stage is then reported `NOT VERIFIED` |
| Before the report | `git diff --check`, full diff read against the batch 0 baseline | |

## 6. What the final report will state honestly

| Topic | Commitment |
|---|---|
| Coverage | Which workspaces were read file by file and which were covered by tools and sampling only. 830k lines will not all get the same depth, and the report says where. |
| Left alone on purpose | Every pattern kept because an ADR requires it, with the ADR number. |
| Not done | Anything unsafe to change without a product or architecture decision (D1 is the known one). |
| Exit codes | The real exit status of every command in section 5. |

## 7. Risks

| Risk | Handling |
|---|---|
| A "dead" export is used through a string, a Nest DI token, a route file convention or the docs site | Search by name and by string before deleting; Next.js and Expo route files and Nest providers are never judged by import count. |
| A removed comment carried a real constraint | When unsure whether a comment gives a reason, it stays. |
| Merging two copies couples things that should drift apart | Merge only with two real callers and a stable shared contract (`rules/00`, abstraction threshold). |
| Cleanup collides with the owner's 366 uncommitted files | Baseline patch in batch 0; files with pre-existing edits are changed only where a batch needs it. |
| Scale | The work spans many sessions. This file and `PROGRESS-2026-11-18.md` carry the state between them. |
