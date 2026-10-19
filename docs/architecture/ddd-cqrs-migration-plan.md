---
title: "DDD + CQRS migration plan"
description: "The approved decisions and tasks for moving the API and apps onto bounded contexts with CQRS."
tags: ["architecture", "ddd", "cqrs", "migration"]
author: "Platform Team"
lastUpdated: 1792368000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 3
---

# DDD + CQRS Migration Plan

> **Status:** approved for implementation (2026-10-17).
> **Rule set:** [`ddd-cqrs-spec.md`](./ddd-cqrs-spec.md). This plan cites its sections as **§spec-N**.
> **Implementer:** Cursor Composer (or any agent). Treat the implementer as a junior engineer: **every decision has already been made in this file.** Your job is to implement it exactly, verify it, and report.
> **Deliverable:** one branch, `refactor/ddd-cqrs`, merged once.

---

## 0. How to use this document (read this first, every session)

### 0.1 Your role

You are **implementing**, not designing. The architecture, the bounded contexts, which use case becomes a command, which bug gets fixed, which file moves where: all of it was decided in a design review between the repository owner and the plan author. The reasons are written next to each decision so you understand them. Understanding them is not permission to change them.

### 0.2 The stop-and-report rule

If any of the following happens, **stop work on the current task**, do not guess, and report back with the exact file, line, and what you found:

1. A file, symbol, Prisma model, route, or command named in this plan does not exist, or exists somewhere else.
2. The plan does not say what to do in a situation you have hit (for example, a use case missing from §7, or a use case in a module that §6 does not assign to a context).
3. Following the plan would require breaking a rule in `rules/00-non-negotiables.md` or a lint rule.
4. A test fails and the cause is code you did not touch in this task.
5. A Prisma schema change looks necessary (see §13.4: there is a fixed procedure, but you still report first).
6. You find a mobile app call site for `claims.qr` (see D07). The design assumes there is none.

"Report" means: write a short note with the task ID (for example `T19`), what you expected, what you found, and the evidence (paths, command output). Then wait.

### 0.3 The per-task loop

Every task in §16 follows the same loop:

1. Read the files listed under **Read first**. Read them fully, not just skim.
2. Read the referenced rule files (`rules/NN-*.md`) and spec sections.
3. Make the changes listed under **Do**.
4. Write or move the tests listed under **Tests**.
5. Run the gate from the repository root:

   ```bash
   pnpm run lint    # must exit 0: zero errors AND zero warnings
   pnpm run test    # must exit 0: every test passes
   ```

6. If the task touches `packages/shared`, Prisma, or more than one app, also run `pnpm run typecheck`.
7. If the task's **Gate** line says `+e2e`, also run `pnpm test:e2e` (needs live Postgres and Redis; see `docs/technical` for how to start them locally). If you cannot start them, write **NOT VERIFIED (e2e)** in your report. Do not call the task done.
8. Commit with a message like `refactor(rewards): T12 move reward lifecycle to CQRS`, ending with the attribution lines required by the repository.

**Never** move to the next task with a red gate. A lint fix can break a test and a test fix can break lint, so the gate must pass **after your last edit**.

### 0.4 Forbidden ways to make the gate pass

These are copied from `AGENTS.md` because they matter most during a large refactor:

- `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or any suppression comment.
- Editing ESLint config to add `ignores`, lower a rule, or raise `--max-warnings`. **Exception:** the new rules this plan tells you to add in §12 (adding rules is not weakening them).
- Deleting, skipping (`.skip`, `.todo`), or focusing (`.only`) a test, or weakening an assertion. Moving a test and updating its imports is fine. **e2e assertions must not change**, except where a task in this plan explicitly says so (only T19 for the QR endpoint).
- Mocking away the thing a test is meant to verify.
- `--no-verify`.

### 0.5 Code rules you will hit constantly

From `rules/00`, `rules/27`, `rules/28`, and memory of past reviews:

- No `any`, `unknown`, `never` (except exhaustiveness), `z.any()`, `z.unknown()`, `z.never()`.
- No `as` casts and no `as const`. Use typed tuples and zod.
- No runtime `typeof` / `Array.isArray`. Use zod schemas or `instanceof`.
- No numeric-literal indices (`items[0]`). Use destructuring (`const [first] = items`).
- No magic numbers. Every limit, TTL, and window is a named constant with a comment explaining it.
- Explicit return types and access modifiers on every function, method, and constructor parameter property.
- Every business entity is soft-deleted (`isDeleted`, `deletedAt`, `deletedBy`). Never a hard `DELETE`.
- Tests live in a `__tests__/` folder **next to** the code they test. Never colocated, never in a top-level `tests/` folder (except the existing `apps/api/test/*.e2e-spec.ts` suite, which stays where it is).

---

## 1. Decision log: what was decided and why

Each row is a decision from the design review. The **Why** column is the reason. When you are unsure how to apply a rule, come back to the reason.

| # | Decision | Why |
|---|---|---|
| 1 | Scope is the whole monorepo: `apps/api`, `apps/analytics-consumer`, `packages/shared`, `packages/api-client`, `packages/client`, and the `web`, `admin`, `merchant` and `mobile` apps. `apps/docs` (Astro) is out of scope. | The owner wants one shared language from the database to the UI. Docs has no feature logic. |
| 2 | One combined plan for DDD and CQRS. | CQRS handlers live in the DDD application layer. Two plans would contradict each other on layering. |
| 3 | Logical CQRS: same Postgres, same tables. Queries read projections directly. A separate read model only where a read is measurably expensive (dashboards, audit timeline). **No event sourcing.** | Juniors copy this kit. Event sourcing and separate stores add operational cost the products have not asked for (§spec-4.5). |
| 4 | Use `@nestjs/cqrs` **12.1.x**. Its peer range is `@nestjs/core ^12.0.0`, matching our `^12.1.2`. Use its built-in generics (`Command<TResult>`, `Query<TResult>`). **No custom bus, no base handler classes.** | It is the official package and it already types `execute()` results. A custom mediator is forbidden by §spec-4.6. |
| 5 | One deliverable, one merge, but executed as ordered tasks with a green gate after each. | The owner wants one merge. Agents need small verifiable steps. A 1,000-file change checked only at the end would be undebuggable. |
| 6 | The domain layer has **no Prisma and no NestJS imports**. | That is what makes domain tests run in milliseconds with no database, and it lines up with the SOLID and dependency-inversion rules. |
| 7 | Contexts live in `apps/api/src/contexts/<context>/` (not separate packages). Technical code lives in `apps/api/src/platform/`. | Separate packages add build and turbo overhead with no second consumer. The folder name `contexts` says "bounded context", the unit of the ubiquitous language. During the migration it also separates migrated code from `modules/`. |
| 8 | Write ADRs 058, 059 and 060, a context map, and glossary updates. | A starter kit must record its "why", and `rules/14` makes docs part of the task. |
| 9 | On the frontend, DDD means **strategic alignment only**: folders and contracts are grouped by the same context names. No client-side aggregates. | The server stays authoritative (rule 00: never trust the frontend). Copying aggregates to the client would duplicate business rules that then drift. |
| 10 | This plan builds on the spec. The spec is saved verbatim in `ddd-cqrs-spec.md`. | The spec is the rule set; this file is the repo-specific execution. |
| 11 | CQRS is **selective**, per use case (§spec-4.6). Simple CRUD uses an application service with the same layering, validation, authorization, audit, and test rules. | A handler per field update is boilerplate that juniors would copy everywhere. |
| 12 | No speculative base classes. `BaseService` is deleted. `BaseRepository` becomes `PrismaBaseRepository`, used only inside `infrastructure/`. Shared primitives are added only where several contexts need them now. | Keeps generic code that carries real type information (rule 00) and drops inheritance that does not (§spec-5.3). |
| 13 | Folder name is `contexts/`, not `modules/`. | See #7. At the end, `apps/api/src/modules/` is deleted. |
| 14 | Frontend: regroup by context, keep **public route paths and contract keys unchanged**, keep `useQuery` for reads and `useMutation` for writes, add architecture lint for clients. | §spec-12 and §spec-13 say DDD and CQRS are backend details. Mobile versions already shipped still call today's routes. |
| 15 | Contracts move to `packages/shared/src/contexts/<context>/`. Group keys, paths and exported names stay **identical**, proved by a contract snapshot test. | The internal layout follows the contexts while the public surface stays the same, so no client breaks. |
| 16 | Web apps get `<app>/contexts/<context>/{components,hooks,forms,tables,url-state}`. Routes in `app/` stay thin. | Same vocabulary as the backend. Someone browsing the code can find all of a context's frontend code in one folder. |
| 17 | `features/` is kept **only** for Zustand feature stores and UI/runtime features (ADR 023). Domain code moves to `contexts/`. | "Feature store" (client UI state) and "bounded context" (business language) are different concepts and must not blur. |
| 18 | Cross-app duplication (mobile copying web code, the impersonation banner, nav helpers) is a **separate follow-up**, listed in §17. | It is a code-sharing problem, not a boundary problem. Mixing it in would make each task larger and riskier. |
| 19 | The 14 bounded contexts in §6. | Each one follows a real boundary in language and lifecycle (see §6 for the reasoning per context). |
| 20 | No separate "phase 2". Sample-category and the reward lifecycle are simply the **first tasks**, and `rules/24` is rewritten from them right after. | One deliverable. The early tasks still produce the reference shapes juniors copy. |
| 21 | Transactions reach the application layer through a generic `UnitOfWork<TScope>` port (§5.4). There is no ambient transaction. | Keeps the repo's explicit-transaction style, satisfies §spec-8.2, preserves RLS, and `TScope` carries real types. |
| 22 | Exactly **three** event mechanisms (§5.6): (1) in-transaction handlers, (2) after-commit `EventBus`, (3) the existing transactional outbox. | §spec-9 applied to what already exists. Each mechanism has one job. §8 maps every current event to one of them. |
| 23 | Follow proper DDD even where an existing ADR disagrees. Every command and query carries an explicit `ActorContext`. Handlers do **resource-level** authorization through ports. Superseded ADRs are updated afterwards. | In DDD, resource-level authorization belongs to the use case: the guard cannot see the loaded aggregate. AsyncLocalStorage remains only as infrastructure plumbing (RLS, audit, logs). |
| 24 | The domain throws `DomainError` subclasses with stable codes. The exception filter maps codes to HTTP status and the ADR 016 envelope through one table. | §spec-10. "Which HTTP status does this rule produce" becomes a single lookup. Codes clients already see never change. |
| 25 | Layer and context boundaries are enforced in `packages/eslint-config/import-boundaries.js` with core ESLint (`no-restricted-imports`) and fixture tests. | Existing tooling, no new plugin. These rules prevent violations; they don't suppress them. |
| 26 | `BaseRepository` becomes `PrismaBaseRepository`, constructed with a database client (transaction or plain), and is used only inside `infrastructure/persistence`. | It must work with UnitOfWork (#21) and keep soft delete, optimistic concurrency and paging. |
| 27 | Commands from non-HTTP entry points (BullMQ, cron, Kafka, CLI, bootstrap) are audited by a `SystemCommandDispatcher`. HTTP commands are audited only by the existing interceptor. | Rule 00 requires a complete audit entry for every state change. A job-triggered change today leaves only a row-change log, with no actor and no record of what was asked. Auditing HTTP commands twice would duplicate rows. |
| 28 | `rules/` is the **single** source of agent guidance. `.cursorrules` becomes a short pointer to `AGENTS.md` and `rules/`. | Two copies always drift. That is how a nonexistent `packages/contracts` ended up in the docs. |
| 29 | One deliverable and one merge (restates #5). | The owner's explicit instruction. |
| 30 | Where an ADR conflicts with proper DDD, follow DDD and supersede the ADR (ADR 017 narrowed, ADR 026 amended, ADR 015 extended). | The owner's explicit instruction. |
| 31 | Agents read `rules/`. | See #28. |
| 32 | The plan author classified every use case up front (§7). Composer does not classify. | Classifying in each task would produce different answers in each context. A table is reviewable. |
| 33 | **Zod remains the shared contract everywhere.** The domain may import zod and `@workspace/shared` schemas and inferred types. **This deliberately deviates from §spec-5.1** and is recorded in ADR 058. | The owner's rule: frontend and backend share one contract. A second set of domain-only rules would drift from the contract the client validates against. |
| 34 | No Prisma schema change is expected. If one becomes necessary: `pnpm db:migrate:create` only (never hand-written SQL), and every new column is seeded. | The repository's existing migration and seed rules. |
| 35 | `apps/analytics-consumer` becomes the **reporting** context's projection side. `packages/messaging` stays as it is. | It already is a CQRS read-side projector. `packages/messaging` is pure technical infrastructure. |
| 36 | Tests move into `__tests__/` and become **more complete**: every command, query, aggregate and policy gets explicit edge cases (§13). The e2e suite is the behaviour regression net. | The owner asked for more edge-case coverage. The e2e suite runs against real Postgres and Redis and proves behaviour did not change. |
| 37 | This plan is fully prescriptive. Composer only implements. | The owner's explicit instruction. |
| 38 | Fix every race, atomicity and audit defect found in the inventory (§9), each with a regression test that reproduces it. | "Aggregate enforces invariants, every concurrent write path is protected" is DDD and rule 00. Porting bugs into clean code would teach juniors the bugs. |
| 39 | `GET /claims/:claimId/qr` becomes **`POST`** (it rotates codes, so it is a command). The `GET` is removed and the web client updated. | A GET must not change state (§spec-4.3). Link prefetching or a retried GET would silently rotate a customer's codes. |
| 40 | Delete dead code. Do **not** finish referral attribution (record it as a follow-up). | Finishing attribution is new product behaviour that needs product decisions. Dead code is deleted under the no-shortcuts rule. |
| 41 | The old `rewards` module splits into `rewards`, `claims`, `pos`, `referrals`, `reporting`, plus KYB and onboarding moving to `organizations`. Checkout stays **atomic** through one shared UnitOfWork scope with explicit ports. | Each is a real lifecycle: a reward is defined, a claim is held, a sale is checked out, a referral is credited. Money paths must not be eventually consistent. |
| 42 | `identity` and `authorization` as described in §6. The auth↔authorization↔sessions cycle is broken by `IdentitySessionsPort`. | Identity answers "who are you", authorization answers "what may you do". The port points at whoever owns session data. |
| 43 | Guards and decorators used by many contexts move to `platform/presentation/http/security/`. | Otherwise 23 modules reach into identity internals and the context lint rule fails. |
| 44 | Email delivery becomes durable: an outbox record `notification.email.requested` is written in the same transaction, then routed to the existing BullMQ email queue (ADR 060). | §spec-9.4: a post-commit side effect cannot be the only guarantee for a password-reset email. |
| 45 | Startup sync tasks (permission registry, capability catalog) become audited system commands run under an advisory lock and **awaited** before readiness. | Removes a race between replicas. "Ready" then means the catalog is consistent. |
| 46 | `files` is a generic supporting context. Binding tables belong to the consuming contexts. Verdict reactions use the in-transaction mechanism. Deletes check references through `FileReferenceGuard`. | Every product built on the kit will reuse files. It must not know about KYB or rewards. |
| 47 | Delete the dead organization lifecycle, erasure and quota services. Keep `TenantEncryptionService` (the rewrap CLI uses it) but delete its unused `encrypt`/`decrypt`. | Code with no entry point can't be tested end to end. Wiring it would be new product behaviour. |
| 48 | The final list of contexts and platform areas in §6. | See §6. |
| 49 | Smaller fixes D24, D28, D29, D30, D32 (§9). | Each violates a rule we already have. None changes an API shape. |
| 50 | Bump `MOBILE_MIN_SUPPORTED_VERSION` only if mobile calls a removed or changed route. **Verified fact: mobile does not call `claims.qr`** (only `apps/web` does), so **no bump**. | The decision was conditional on mobile using the route. If T19 finds a mobile call site, stop and report (§0.2 item 6). |
| 51 | A rate-limit table (§10) covers every public, credential-checking and email-sending endpoint, with an e2e test that confirms the request after the limit is rejected. Throttles live in presentation; attempt limits are domain invariants. | Infrastructure ("how often may this IP call") is separate from domain ("how many attempts does a claim allow"). |
| 52 | Prevent N+1 queries and prove it with an e2e SQL statement counter: same statement count for a 1-row page and a 25-row page (§11). | Counting statements proves there's no N+1 instead of hoping. The 1-vs-25 comparison works whatever the absolute count. |
| 53 | "Fast local startup" covers four phases: cold `pnpm dev`, API boot to `/health/ready`, first page compile in Next dev, and the first Metro bundle (§19). | A slow step in any one of them is what people experience as "startup is slow". Measuring each separately avoids fixing the wrong one. |
| 54 | Measure a baseline first (`pnpm dev:timing`). Targets: ≥ 40% faster than baseline and API ready ≤ 5 s on a warm cache, recorded in `rules/19`. **No CI gate on startup time.** | Numbers chosen before measuring are guesses. CI machines aren't laptops, so a startup gate would be flaky. |
| 55 | Startup gets faster through **lazy initialisation** (same in every environment) and visible flags. Correctness work is never skipped. | Different behaviour in dev and prod hides bugs. |
| 56 | Code splitting at three levels (routes, heavy components, heavy libraries in handlers) **while every page stays SSR**. | Most of the payoff is in heavy components. `next/dynamic` splits code whether or not SSR is on, so the two don't conflict. |
| 57 | Bundle budgets enforced in CI: per-route first-load JS for Next, main bundle for mobile. Baseline + 10%. | Without a gate, splitting decays the first time someone imports a chart into a layout. |
| 58 | `ssr: false` only for an **allowlist** of browser-only widgets, each server-rendering a sized skeleton. Lint enforces the allowlist. | The server still renders the page and data; only DOM-dependent widgets wait for the client. |
| 59 | New read query **`GET /claims/:claimId`** server-renders the QR page. Only the secret codes come from the client `POST /claims/:claimId/qr`. | Keeps the page SSR (decision #56) and keeps "GET never writes" (decision #39). |
| 60 | Mobile: Expo Router async routes (development), Metro `inlineRequires`, `React.lazy` for heavy screens. "SSR" doesn't apply to native apps. | Native apps ship one bundle per build, so the goal is less JavaScript evaluated at launch and a faster Metro start. |
| 61 | **Keep** the `dependsOn: ["^build"]` prebuild for `turbo dev`. The API keeps loading workspace packages from `dist`. | The owner's explicit choice. |
| 62 | Lazy-load boot work, but **add no caches**. Report fonts load on each export. Swagger is built on each `/docs` request. Cedar WASM loads on first use via `import()`. Permission and capability sync runs fully every boot. | The owner's explicit choice. Trade-off: each PDF export pays the font-parse time, bounded by the existing export rate limit (recorded in ADR 059). Node's module loader keeping an imported module in memory is runtime behaviour, not a cache we add. |
| 63 | **Keep** Kafka and RabbitMQ enabled in `.env.example`. | The owner's explicit choice. |
| 64 | Measure bundles with a custom `packages/tooling` script (build manifests + `node:zlib` gzip, no new dependency). The analyzer stays available via `ANALYZE=true next build --webpack` in all three apps. | Next 16 with Turbopack no longer prints first-load sizes, and the analyzer is webpack-only. |
| 65 | Lazy list (§19.4): recharts, the image cropper, the KYB PDF dialog and the command palettes are `ssr: false` with skeletons. The permission tree, range controls and code block are dynamic with SSR on. framer-motion moves to `LazyMotion` + `m`. | These are the measured eager imports. `LazyMotion` is framer's own splitting API, so motion looks and times exactly the same. |
| 66 | Mobile details in §19.5. Composer verifies option names in the installed docs and stops if one is unsupported. | Avoids guessing SDK 57 APIs. |
| 67 | Performance tasks are T40–T46, run after the frontend regroup (T36) and before docs and final verification (now T47–T49). | Budgets are set from the final structure, and the final verification still runs last. |
| 68 | Q62 detail: parallel BullMQ scheduler registration with a timeout, the missing `useBullMq` guard, and `devtool: cheap-module-source-map` in dev are all applied. | None of these is a cache. |
| 69 | `shared`, `messaging` and `api-client` get `dev` scripts (`tsc --watch` + `tsc-alias --watch`) that `turbo dev` runs after the prebuild. | The prebuild guarantees a valid `dist` at start, and the watchers keep it current. Otherwise a zod schema edit silently runs stale code. |
| 70 | `pnpm dev` keeps booting **everything**. Astro docs drop `--force`. | The owner's explicit choice. `--force` re-optimises dependencies on every start for no benefit and doesn't change what boots. |
| 71 | Idempotency: a concurrent duplicate **waits, then replays**. The waiter blocks on a Postgres advisory lock for the key (no polling), takes over if the original failed, and is capped at 5 s; after that it gets `409 IDEMPOTENCY_REQUEST_IN_PROGRESS`. Recorded in ADR 061. | Owner decision (2026-10-18). A retried POS sale gets the original result instead of a 409, and the advisory lock removes the polling cost that the previous implementation introduced. |
| 72 | Add a coarse IP-keyed **pre-auth throttler** before `AuthGuard`. The per-principal throttling stays after it. | Owner decision. Requests that `AuthGuard` rejects (token spraying, expired-token floods) are otherwise never counted. |
| 73 | `adminSecurityMutation` (10/min per principal) for RBAC, policy and support-access mutations; `sessionRefresh` (10/min per IP) for `POST /auth/refresh`. | Owner decision, correcting §10.2. These limits were 10/min before the migration; privilege-changing and token-minting endpoints stay tight. |
| 74 | `POST /admin/rewards/:rewardId/reject` **requires** a trimmed, non-empty `reason` (contract change). The admin UI requires it too. | Owner decision. A merchant whose reward is rejected must learn why, and the rule holds at the boundary, not only in the domain. |

---

## 2. Verified repository facts (as of 2026-10-17)

These were checked against the code. If you find one that is wrong, stop and report (§0.2).

### 2.1 Toolchain

- pnpm workspaces plus Turborepo. Root scripts:
  - `lint` (`turbo lint`), `test` (`turbo run test --concurrency=1`), `typecheck`
  - `test:e2e` (API plus analytics-consumer)
  - `db:migrate:create`, `db:generate`, `db:seed`, `db:rls`, `db:check-rls-manifest`
- `apps/api` versions: NestJS `^12.1.2` (`@nestjs/core`, `@nestjs/common`), `@nestjs/bullmq ^12`, `@nestjs/schedule ^12`, `@nestjs/throttler ^6.7.1`, Prisma `^7.10` with `@prisma/adapter-pg`, zod `4.6.5`, TypeScript `6.0.3`, Vitest `^5`.
- The API runs on the **Fastify** adapter (ADR 027).
- `@nestjs/cqrs` is **not installed**. The latest published version is `12.1.0`, with peers `@nestjs/core ^12`, `@nestjs/common ^12`, `rxjs ^7.2`, `reflect-metadata`.
- `@nestjs/event-emitter` is not installed and will **not** be added.

### 2.2 API layout today

`apps/api/src/` contains:
- `modules/` (22 feature modules)
- `platform/` (`persistence`, `idempotency`)
- `infrastructure/` (`outbox`, `kafka`, `jobs`, `redis`, `queue`, `database`)
- `common/` (`audit`, `context`, `tenancy`, `interceptors`, `errors`, `decorators`, `pipes`, `http`, `crypto`, `dto`)
- `prisma/`, `messaging/`, `config/`, `bootstrap/`

Modules by size, in files:

| Module | Files | Module | Files |
|---|---|---|---|
| auth | 145 | sessions | 29 |
| rewards | 122 | authorization-cedar | 21 |
| authorization | 86 | api-keys | 19 |
| github | 63 | encryption | 11 |
| notifications | 54 | logs | 9 |
| storage | 47 | health | 7 |
| organization | 41 | impersonation | 7 |
| files | 33 | product, sample-category | 6 each |
| audit-logs | 32 | geo | 5 |
| | | support-access | 4 |

- **Layering is technical** (`controllers/`, `services/`, `repositories/`). Services are large transaction scripts. `rules/01` and `rules/02` already *describe* a DDD layout that the code does not follow.

### 2.3 Persistence, tenancy and transactions

- **One Prisma schema:** `apps/api/prisma/schema.prisma` (89 models), configured by `apps/api/prisma.config.ts`.
- `PrismaService extends PrismaClient` and is built on `RlsPool` (`apps/api/src/prisma/rls-pool.ts`). `RlsPool` is a `pg.Pool` subclass that runs `SET ROLE app_runtime` and sets session variables on every checkout.
- **Tenancy is Postgres RLS:**
  - SQL: `apps/api/prisma/rls.sql`, `apps/api/prisma/rls/*.sql`
  - AsyncLocalStorage `rlsStorage` in `apps/api/src/prisma/rls-context.ts`, a union of user / system / api_key / anonymous
  - `common/interceptors/rls.interceptor.ts` (the outermost interceptor)
  - `prisma/tenant-transaction.service.ts`: `withTenantTransaction(ctx, tx => …)` and `withSystemOperation(ctx, tx => …)`
  - Allowlist of system operations: `prisma/system-operation.registry.ts`
- **Transactions are passed explicitly** as `tx: Prisma.TransactionClient` (about 48 files). There is no ambient transaction.
- `platform/persistence/base.repository.ts`: generic CRUD, soft delete with cascade, optimistic concurrency (`updateManyAndReturn` → 404/409), keyset/offset paging, unique-violation translation. It **cannot use the caller's transaction**. Only `product` and `sample-category` use it, together with `BaseService`.

### 2.4 Events and messaging

- **Outbox** (ADR 015), in `apps/api/src/infrastructure/outbox/`:
  - `platform-outbox.service.ts` writes through the caller's `tx`.
  - The dispatcher (`outbox-dispatcher.ts`) claims, leases, retries and dead-letters records. It is driven by BullMQ and publishes to Kafka (`@confluentinc/kafka-javascript`, ADR 024).
  - The envelope and topics are defined in `packages/shared/src/schemas/infrastructure/{outbox,kafka}.ts`.
- **In-process events** (hand-written):
  - `modules/authorization/events/authorization.events.ts` (`AuthorizationEventEmitter`)
  - `modules/files/lifecycle/file-lifecycle-listener.ts` and its registry, which runs listeners **inside** the verdict transaction
- **LISTEN/NOTIFY** (Postgres): the audit trail live stream (`audit-logs/events`) and GitHub live updates.
- **Idempotency:**
  - HTTP: the global `IdempotencyInterceptor` acts on `@Idempotent()` routes (`platform/idempotency/`).
  - Consumers: `packages/messaging/src/inbox`.

### 2.5 Authorization and audit

- **Authorization:**
  - Cedar (`@cedar-policy/cedar-wasm`) in `modules/authorization-cedar/`, plus the kernel in `modules/authorization/kernel/`.
  - Global guard order: `MobileAppVersionGuard` → `ApiKeyAuthGuard` → `AuthGuard` → `RestrictedSessionGuard` → `AuthorizationGuard`.
  - Endpoints declare `@RequirePermission(action, resource)`.
- **Audit:**
  - The global `AuditLogInterceptor` writes an HTTP trail row (ADR 025).
  - Database triggers write every row change to `data_change_logs` (ADR 051).
  - Domain audit tables also exist: `permission_audit_logs`, `organization_audit_logs`, `impersonation_audit_logs`, `mfa_recovery_audit_logs`, `authorization_audits`, `reward_audit_logs`.

### 2.6 Contracts and tests

- **Contracts:** there is no `packages/contracts`. Zod schemas and the API contract live in `@workspace/shared`:
  - `packages/shared/src/contracts/index.ts` (~69K) holds `apiContract`.
  - `packages/shared/src/api-routes.ts` holds the paths.
  - `packages/shared/src/schemas/{api,auth,domain,email,infrastructure,runtime}` hold the schemas.
  - `@workspace/shared` has **one** public entry point (lint enforces it).
  - The API validates with `@ZodBody` / `@ZodParams` / `@ZodListQuery` / `@ZodResponse` (`common/decorators/`).
- **Tests:**
  - Unit: `apps/api/vitest.config.unit.ts` runs `src/**/*.spec.ts` (~296 files).
  - e2e: `apps/api/vitest.config.e2e.ts` runs `apps/api/test/*.e2e-spec.ts` (58 files, real Postgres and Redis, no file parallelism).

### 2.7 Lint, throttling, mobile versioning

- **Lint boundaries:** `packages/eslint-config/import-boundaries.js` uses only core `no-restricted-imports` with `regex` patterns, plus one local rule.
  - **Gotcha:** `no-restricted-imports` is one rule. A later config block *replaces* an earlier block's options. Every new block must re-state the universal patterns (`[...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...yours]`).
  - Fixture tests are in `packages/eslint-config/__tests__/`.
- **Throttling:**
  - `ThrottlerModule.forRootAsync` is registered in `modules/auth/auth.module.ts`.
  - Named throttlers `strict` and `default` (`modules/auth/throttling/auth-throttler.config.ts`) take TTL and limits from `config.rateLimits.*`.
  - The tracker is `throttleTrackerFor(req)` (by IP).
  - Custom guards: `PosRateLimitGuard`, `AnalyticsExportRateLimitGuard`.
  - Many decorators pass **literal numbers** (`@Throttle({ strict: { ttl: 60000, limit: 3 } })`). These are magic numbers and get fixed in T27.
- **Mobile versioning:** `MOBILE_MIN_SUPPORTED_VERSION` (`apps/api/src/config/api-config.schema.ts`, default `1.0.0`) → `426 APP_VERSION_UNSUPPORTED` (ADR 033).

### 2.8 Frontend and docs

- **The claim QR endpoint** (`apiRoutes.claims.qr = "/claims/:claimId/qr"`, `apiRouter.claims.qr` is a `defineQuery`) is consumed **only** by `apps/web`:
  - `app/dashboard/wallet/[claimId]/page.tsx` (server render through `createWebServerCaller().claims.qr.query`)
  - `components/dashboard/claims/qr-view.tsx` (`useQuery`)
  - `lib/navigation/route-access.ts`
- **Frontend layout:**
  - Web apps are organised as `components/<feature>/` + `lib/<feature>/`. Admin keeps its smart components next to routes in `app/(panel)/…`.
  - Mobile has `src/features/<x>`.
  - `packages/client` is the shared web-only layer; mobile is banned from importing it.
- **ADRs** run from `001` to `057` (three-digit numbering). The next free numbers are **058, 059, 060**.
- `.cursorrules` (5.5 KB) holds an outdated architecture summary.

---

## 3. Glossary for this migration (juniors: read once)

These terms go into `rules/22-glossary.md` in T48. Use them exactly.

| Term | Meaning in this repo |
|---|---|
| **Bounded context** | A folder under `apps/api/src/contexts/` with its own language, models and rules. Example: `claims`. |
| **Aggregate** | A cluster of domain objects saved together as one consistency unit, accessed through its **root** class. Example: `RewardClaim`. |
| **Aggregate root** | The class (extending `AggregateRoot`) whose methods enforce invariants. Nothing outside may change its children directly. |
| **Value object** | An immutable object defined by its value, which validates itself on creation. Example: `MinorUnits`. |
| **Invariant** | A rule that must always hold. Example: "a claim can only be redeemed while PENDING". |
| **Domain event** | A past-tense fact recorded by an aggregate. Example: `RewardPublished`. Not a command. |
| **Integration event** | The stable, versioned payload written to the outbox for other processes (Kafka, the email queue). |
| **Command** | A request to change state, carrying `actor` + `input`. Example: `PublishRewardCommand`. Handled by exactly one handler. |
| **Query** | A request to read state without changing it. Example: `ListRewardsQuery`. |
| **Handler** | The application-layer class that runs one command or query. It orchestrates; it does not hold business rules. |
| **Application service** | The "simple path" (§4.4) for plain CRUD, used instead of handlers. Same layer rules. |
| **Port** | An interface the application or domain depends on, implemented by infrastructure (dependency inversion). |
| **Adapter** | An infrastructure class implementing a port. Example: `PrismaRewardRepository`. |
| **UnitOfWork** | The port that runs work inside one database transaction with the right RLS context (§5.4). |
| **Scope** | The bag of transaction-bound repositories and ports a UnitOfWork hands to your callback. |
| **ActorContext** | Who is acting (user, API key, system, anonymous) plus request metadata. Passed explicitly to every command and query (§5.1). |
| **Public API (of a context)** | `contexts/<x>/public-api.ts`, the only file another context may import from (§12). |
| **Feature store** | Client-side Zustand UI state (ADR 023), under `features/`. Not a bounded context. |
| **CAS** | Compare-and-set: an `UPDATE … WHERE <expected state>` whose affected-row count is checked. Our default concurrency guard. |

---

## 4. Target architecture

### 4.1 Top-level API layout (end state)

```text
apps/api/src/
  main.ts
  app.module.ts              # composition root: imports every context module + platform modules
  bootstrap/                 # unchanged location
  config/                    # unchanged location
  prisma/                    # unchanged location (PrismaService, RLS pool, tenant tx, registry)
  platform/                  # technical, no business language
    domain/                  # AggregateRoot, DomainEvent, DomainError, error-codes catalog
    application/             # ActorContext, UnitOfWork port, Clock port, event ports, SystemCommandDispatcher, system-operation names
    infrastructure/
      persistence/           # PrismaBaseRepository, list paging, unique-violation, cascade soft delete
      unit-of-work/          # PrismaUnitOfWork, TransactionalEventDispatcher, InTransactionEventRegistry
      idempotency/           # moved from platform/idempotency
      outbox/                # moved from infrastructure/outbox (+ email route, ADR 060)
      kafka/ queue/ jobs/ redis/ database/   # moved from infrastructure/*
      storage/               # moved from modules/storage (ports + adapters)
      encryption/            # moved from modules/encryption
      audit/                 # moved from common/audit
      context/ tenancy/ crypto/ http/        # moved from common/*
      logging/               # moved from modules/logs
    presentation/
      http/
        security/            # guards, decorators, throttling, ActorContext factory (moved from auth/authorization/api-keys)
        errors/              # GlobalExceptionFilter, domain-error status map, error envelope
        validation/          # Zod decorators + pipe (moved from common/decorators, common/pipes)
        interceptors/        # audit, rls, idempotency wiring (moved from common/interceptors)
        health/              # moved from modules/health
  contexts/
    identity/ authorization/ organizations/ rewards/ claims/ pos/ referrals/
    reporting/ files/ notifications/ catalog/ reference-data/ audit/ integrations-github/
```

**Why `prisma/`, `config/` and `bootstrap/` do not move:** many scripts, CLIs and RLS tooling (`db:check-rls-manifest`, `prisma.config.ts`, seed) reference these paths. Moving them gains nothing architecturally and risks breaking database tooling.

### 4.2 Inside one context (template)

Only create the folders you need. **Never** create empty folders (`rules/01`).

```text
contexts/<context>/
  <context>.module.ts            # Nest module: providers, controllers, handlers, scope factory, registry hooks
  public-api.ts                  # the ONLY file other contexts may import (§12)
  domain/
    aggregates/<name>.aggregate.ts
    entities/<name>.entity.ts            # child entities inside an aggregate
    value-objects/<name>.value-object.ts
    events/<name>.event.ts
    errors/<context>.errors.ts           # DomainError subclasses + the context's code schema
    policies/<name>.policy.ts            # pure rules that span aggregates or need several inputs
    repositories/<name>.repository.ts    # repository INTERFACES (ports) for aggregates
    __tests__/
  application/
    commands/<use-case>/<use-case>.command.ts
    commands/<use-case>/<use-case>.handler.ts
    queries/<use-case>/<use-case>.query.ts
    queries/<use-case>/<use-case>.handler.ts
    services/<name>.application-service.ts   # simple path only (catalog, reference-data)
    event-handlers/in-transaction/<name>.in-transaction-handler.ts
    event-handlers/after-commit/<name>.event-handler.ts
    ports/<name>.port.ts                 # read ports, external-service ports, cross-context ports this context consumes
    ports/<context>.tokens.ts            # injection Symbols
    <context>-scope.ts                   # the TScope type for this context's UnitOfWork
    __tests__/
  infrastructure/
    persistence/prisma-<name>.repository.ts
    persistence/prisma-<name>.read-repository.ts
    persistence/<name>.mapper.ts
    persistence/<context>-scope.factory.ts
    outbox/<context>-integration-events.mapper.ts
    adapters/<name>.adapter.ts           # external APIs, cross-context port implementations
    __tests__/
  presentation/
    http/<name>.controller.ts
    jobs/<name>.processor.ts             # BullMQ processors
    jobs/<name>.cron.ts                  # @Cron tasks
    cli/<name>.cli.ts
    __tests__/
```

**Why this exact shape:** it is §spec-5 adapted to the repo:
- `contexts` instead of `modules` (decision #13).
- `aggregates/` and `entities/` are separate so a junior can see which class is the consistency boundary.
- `presentation/jobs/` exists because BullMQ processors and crons are entry points just like controllers. They translate an external trigger into a command.

### 4.3 Layer dependency rules (enforced by lint in T10)

| From \ may import | domain | application | infrastructure | presentation | platform/domain | platform/application | platform/infrastructure | platform/presentation | `@workspace/shared`, `zod` | `@nestjs/common`, `@nestjs/cqrs` | `@prisma/*`, `pg`, `bullmq`, `ioredis` | other context `public-api.ts` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **domain** | ✅ own | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ (domain types only) |
| **application** | ✅ | ✅ own | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **infrastructure** | ✅ | ✅ | ✅ own | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **presentation** | ✅ (errors, VOs for parsing) | ✅ | ❌ | ✅ own | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ + `@nestjs/bullmq`, `@nestjs/schedule`, `@nestjs/throttler` | ❌ | ✅ |
| **`<context>.module.ts`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

**Why:**
- The domain stays testable without a framework.
- The application layer depends on ports, never on adapters.
- Only infrastructure touches Prisma.
- Only the module file wires everything together (it is the per-context composition root).
- The application layer may use `@nestjs/common` (`@Injectable`, `@Inject`) and `@nestjs/cqrs` (`@CommandHandler`), because handlers are Nest providers. That is the agreed, minimal framework surface.

### 4.4 Choosing CQRS handler vs application service (goes into `rules/23` in T13)

```text
Is this use case in §7? ── yes ──► use what §7 says. Stop.
        │ no (new feature after the migration)
        ▼
Does it change state?
   no ──► Query + QueryHandler (always; even trivial reads), read port returns a DTO.
   yes ─► Does ANY of these hold?
            • a state transition / invariant (status machine, counters, limits)
            • resource-level authorization beyond the endpoint permission
            • more than one aggregate or context in the same transaction
            • a domain event, outbox record, or email
            • a concurrency hazard (two requests could race)
          yes ─► Command + CommandHandler + aggregate.
          no  ─► Application service method (simple path), e.g. catalog CRUD.
```

**Why queries always get a handler:** query handlers are cheap and give every read an explicit place for authorization, projection and N+1 discipline (§11). The selectivity rule (§spec-4.6) is about *commands*, where handler-per-field boilerplate is the real cost.

---

## 5. Shared primitives (T04–T08 build these; every context uses them)

All code below is the **required shape**. Keep the names. Fill in bodies following the comments. Read `node_modules/@nestjs/cqrs/dist/**/*.d.ts` after installing (T02) to confirm the generic signatures. If `ICommandHandler` / `IQueryHandler` accept a second type parameter for the result, always pass it explicitly.

### 5.1 `ActorContext`: `platform/application/actor-context.ts`

```ts
import { z } from "zod";

import { SystemOperationNameSchema } from "./system-operation-names";

/** Request metadata copied into audit entries; null when not applicable (jobs, CLI). */
export const RequestMetadataSchema = z.object({
	requestId: z.string().min(1),
	ip: z.string().nullable(),
	userAgent: z.string().nullable(),
	deviceLabel: z.string().nullable(),
	endpoint: z.string().nullable(),
});

/** Where a system actor's work was triggered from. */
export const SystemOriginSchema = z.enum(["job", "cron", "cli", "bootstrap", "consumer"]);

export const ActorContextSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("user"),
		userId: z.string().min(1),
		sessionId: z.string().min(1),
		organizationId: z.string().min(1).nullable(),
		isSuperAdmin: z.boolean(),
		accessScope: z.enum(["tenant", "superadmin", "staff_single_tenant"]),
		impersonatorUserId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
	}),
	z.object({
		kind: z.literal("api_key"),
		apiKeyId: z.string().min(1),
		organizationId: z.string().min(1),
		locationId: z.string().min(1).nullable(),
		terminalId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
	}),
	z.object({
		kind: z.literal("system"),
		operation: SystemOperationNameSchema,
		origin: SystemOriginSchema,
		organizationId: z.string().min(1).nullable(),
		actorUserId: z.string().min(1).nullable(),
		reason: z.string().min(1),
	}),
	z.object({
		kind: z.literal("anonymous"),
		organizationId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
	}),
]);

export type ActorContext = z.infer<typeof ActorContextSchema>;
export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;
```

- **`system-operation-names.ts`:** move the *names* out of `apps/api/src/prisma/system-operation.registry.ts` into `platform/application/system-operation-names.ts` as `SystemOperationNameSchema = z.enum([...])`. The registry then imports the names from there. **Keep every existing name byte-for-byte.** RLS tooling and audit rows reference them. Why: the application layer may not import from `prisma/`, which is infrastructure.
- **Factory:** `platform/presentation/http/security/actor-context.factory.ts` builds the actor from the authenticated request (`AccessTokenPayload`, API-key auth context, `RequestContextService`). Expose it to controllers through a `@CurrentActor()` param decorator in the same folder. Controllers **never** build actors by hand. Jobs and CLIs build system actors with `systemActor(operation, origin, organizationId, reason, actorUserId)` in `platform/application/actor-context.ts`.
- **RLS fields on the actor:** `accessScope` (user), `organizationId` (anonymous), and `reason` / `actorUserId` (system) are the inputs `toRlsContext` needs. They come from the same decision `RlsInterceptor` already makes (superadmin, single-tenant staff, guard-verified tenant, or the boot-verified single-tenant organization). They are not optional decoration.
- **Why explicit:** handlers become pure functions of their inputs, so tests construct an actor literal and need no request mocking (decision #23).

### 5.2 Errors: `platform/domain/errors/`

```ts
// platform/domain/errors/domain-error.ts
import type { ErrorCode } from "./error-codes";

/** Primitive-only details so they serialise into the ADR 016 envelope safely. */
export type DomainErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

export abstract class DomainError extends Error {
	public abstract readonly code: ErrorCode;

	protected constructor(message: string, public readonly details: DomainErrorDetails = {}) {
		super(message);
		this.name = new.target.name;
	}
}
```

- **Move** `apps/api/src/common/errors/error-codes.ts` to `platform/domain/errors/error-codes.ts`. **Never rename or remove an existing code**; clients match on them. New codes are added to the same catalog.
- **Move** the existing application errors (`ConcurrentModificationError`, `RateLimitError`, `DependencyUnavailableError`, and any NotFound/Conflict/Forbidden equivalents in `common/errors`) to `platform/application/errors/`. Keep their class names.
- **Each context** declares its errors in `domain/errors/<context>.errors.ts`. Example:

  ```ts
  export class RewardNotDraftError extends DomainError {
  	public readonly code = "REWARD_NOT_DRAFT";
  	public constructor(rewardId: string) { super("Reward is not a draft.", { rewardId }); }
  }
  ```

  Note: `public readonly code = "REWARD_NOT_DRAFT"` is a literal property type, **not** `as const`. That is allowed.
- **HTTP mapping:**
  - `platform/presentation/http/errors/domain-error-status.map.ts` exports `DOMAIN_ERROR_HTTP_STATUS: Readonly<Record<DomainErrorCode, HttpStatus>>`. `DomainErrorCode` is the union of every context's error-code schema, re-exported from each `public-api.ts`.
  - The existing `GlobalExceptionFilter` gains one branch: `error instanceof DomainError` → status from the map, envelope code = `error.code`.
- **Test:** `platform/presentation/http/errors/__tests__/domain-error-status.map.spec.ts` asserts every `DomainErrorCode` exists in `error-codes.ts`. Because the map is a `Record`, TypeScript already forces a status for every code.
- **Why:** §spec-10. The domain never imports `HttpStatus` or Nest exceptions, and the mapping is one reviewable table.

### 5.3 Aggregates, events, clock: `platform/domain/` and `platform/application/`

```ts
// platform/domain/domain-event.ts
export abstract class DomainEvent {
	/** "<context>.<PastTenseName>", e.g. "rewards.RewardPublished". Unique across the app. */
	public abstract readonly eventName: string;

	protected constructor(public readonly occurredAt: EpochMs) {}
}

// platform/domain/aggregate-root.ts
import type { DomainEvent } from "./domain-event";

export abstract class AggregateRoot<TEvent extends DomainEvent> {
	private readonly pendingEvents: TEvent[] = [];

	protected record(event: TEvent): void {
		this.pendingEvents.push(event);
	}

	/** Returns and clears the recorded events. Called once by the UnitOfWork collector. */
	public pullEvents(): readonly TEvent[] {
		return this.pendingEvents.splice(0, this.pendingEvents.length);
	}
}

// platform/application/clock.port.ts
export interface Clock {
	now(): EpochMs;
}
export const CLOCK = Symbol("CLOCK");
```

- `SystemClock` (`platform/infrastructure/system-clock.ts`) returns `nowEpochMs()`. Tests use `FixedClock` (`platform/application/__tests__/fixed-clock.ts`, exported for tests through a `testing` barrel) frozen at one `EpochMs`. Domain code does not call `new Date()`.
- **Domain methods take time as a parameter** (`reward.approve(now)`), and `now` is epoch milliseconds. Why: deterministic tests at TTL boundaries (claim 7 days, OTP 5 minutes, auto-publish 24 hours), and one time representation with the rest of the API.
- **Do not** use `@nestjs/cqrs`'s own `AggregateRoot`. The domain may not import Nest (decision #6). Our `DomainEvent` instances are still publishable on the Nest `EventBus` (§5.6, mechanism 2), because `@EventsHandler(RewardPublished)` keys on the class.

### 5.4 UnitOfWork: `platform/application/unit-of-work.port.ts`

```ts
import type { ActorContext } from "./actor-context";
import type { SystemOperationName } from "./system-operation-names";

export interface UnitOfWork<TScope> {
	/** Runs `work` in one transaction under the actor's RLS context (tenant or system). */
	run<TResult>(actor: ActorContext, work: (scope: TScope) => Promise<TResult>): Promise<TResult>;

	/** Same, but as an allowlisted system operation (today's `withSystemOperation`). Used by RlsBypass flows. */
	runSystemOperation<TResult>(
		operation: SystemOperationName,
		actor: ActorContext,
		work: (scope: TScope) => Promise<TResult>,
	): Promise<TResult>;
}
```

**Infrastructure:**

- `platform/infrastructure/unit-of-work/prisma-unit-of-work.ts`: `PrismaUnitOfWork<TScope> implements UnitOfWork<TScope>`. Constructor arguments:
  - `TenantTransactionService`
  - a `ScopeFactory<TScope>`
  - `TransactionalEventDispatcher`
  - Nest `EventBus`
- **What `run` does, in order:**
  1. Map the actor to the existing RLS context type with `toRlsContext(actor)` (`platform/infrastructure/unit-of-work/actor-to-rls-context.ts`):
     - `user` → user context
     - `api_key` → api-key context
     - `anonymous` → anonymous context
     - `system` → call `withSystemOperation(actor.operation, …)`
     
     Read `prisma/rls-context.ts` and `tenant-transaction.service.ts` and map field by field. If a field has no source, **stop and report**.
  2. Open `TenantTransactionService.withRlsContext`. It stamps `rlsSessionVariables(context)` transaction-locally, so a system actor keeps its organization id. `withTenantTransaction` stays the encryption session (`purpose`, `policyVersion`) and is not the unit-of-work opener. `withSystemOperation` stays for callers that already pass a `SystemDatabaseContext`.
  3. Create a fresh `TransactionalEventCollector`, then `scope = scopeFactory.create(db, collector)`.
  4. `result = await work(scope)`.
  5. `committed = await dispatcher.drain(collector, db, actor)`. This runs in-transaction handlers and outbox mappers; see §5.6.
  6. Return `result` from the transaction callback (the transaction commits).
  7. **After** commit, call `eventBus.publish(event)` for each event in `committed`.
  8. If anything throws before commit, nothing is published and the transaction rolls back.
- **`ScopeFactory<TScope>`:** `{ create(db: DbClient, events: TransactionalEventCollector): TScope }`, where `DbClient = Prisma.TransactionClient`. Each context implements `infrastructure/persistence/<context>-scope.factory.ts` and constructs **new** repository instances bound to `db` on every call.
  - Never cache them.
  - Never store `db` on a singleton (§spec-8.2).
- **Injection tokens:** per context, e.g. `REWARDS_UNIT_OF_WORK` in `application/ports/rewards.tokens.ts`. The module provides it with `useFactory` that builds `new PrismaUnitOfWork(tenantTx, new RewardsScopeFactory(...deps), dispatcher, eventBus)`.

**Cross-context scopes** (checkout, store closure, signup):
- The owning context's `public-api.ts` exports a **transactional port factory**, e.g. `createClaimsTransactionalPorts(db, events): ClaimsTransactionalPorts`.
- The consuming context's scope factory calls it with the same `db`, so every repository involved shares **one** transaction.
- **Why:** atomicity on money paths (decision #41) without letting `pos` import `claims` repositories directly.

**Reads:**
- Query handlers call read ports that take `actor` as their first argument.
- Read adapters run through `PrismaReadExecutor.read(actor, (db) => …)` (`platform/infrastructure/unit-of-work/prisma-read-executor.ts`). It uses `withRlsContext`, the same session stamp as writes. Prisma's pg driver checks the connection out outside AsyncLocalStorage, so `rlsStorage.run` alone does not reach `RlsPool` for a Prisma query. The short transaction exists to bind the actor's session to that connection. Where today's code deliberately uses a transaction for reads (analytics `statement_timeout`), it keeps using `withTenantTransaction` inside the adapter.
- **Why:** explicit tenant context per §spec-11.4, and no dependence on the HTTP interceptor's ALS for correctness, so jobs and CLIs are safe too.

### 5.5 `PrismaBaseRepository`: `platform/infrastructure/persistence/prisma-base.repository.ts`

- **Rename and refactor** `platform/persistence/base.repository.ts`. The constructor now receives `db: DbClient | PrismaService` together with the existing `RepositoryPorts` object. Keep all existing behaviour:
  - soft delete and restore
  - cascade soft delete
  - optimistic `version` updates (404 when the row is gone, `ConcurrentModificationError` when it changed)
  - keyset/offset paging
  - unique-violation translation
- `createMany` / `deleteMany` stop opening their own `$transaction` when `db` is already a transaction client. Detect that via the constructor argument type: add a `kind: "transaction" | "root"` field to a small wrapper type `RepositoryDb`. **Do not** use `typeof` or duck typing.
- It may only be imported from `contexts/*/infrastructure/**` and `platform/infrastructure/**` (lint, T10).
- **Delete** `platform/persistence/base.service.ts` and its tests. Its behaviour moves into catalog's application service (T11).
- **Why:** decision #26. The useful generic code stays; it just becomes transaction-aware and confined to infrastructure.

### 5.6 The three event mechanisms: `platform/application/events/` and `platform/infrastructure/unit-of-work/`

**Mechanism 1: in-transaction handlers** (atomic reactions that must commit or roll back with the trigger)

```ts
// platform/application/events/in-transaction-event-handler.ts
import type { DomainEvent } from "../../domain/domain-event";

export interface InTransactionEventHandler<TEvent extends DomainEvent, TScope> {
	/** Type guard, implemented with `instanceof`; this is how we narrow without casts. */
	accepts(event: DomainEvent): event is TEvent;
	handle(event: TEvent, scope: TScope): Promise<void>;
}
```

- **Registration:** each context module, in `onModuleInit`, calls `InTransactionEventRegistry.register(bindInTransactionHandler(handler, scopeFactory))`. The binding closes over the handler's own `ScopeFactory`, so a handler in `organizations` gets an `OrganizationsScope` bound to the **same** `db` as the producer.
- **Dispatch:** `TransactionalEventDispatcher.drain(collector, db, actor)` works in rounds:
  1. Take the collected events.
  2. Run every matching binding. Handlers may record new events into the same collector.
  3. Run outbox mappers.
  4. Repeat until no new events, up to `MAX_IN_TRANSACTION_EVENT_ROUNDS = 5`. That constant needs a comment: deeper chains mean a design smell, so we fail loudly with `InTransactionEventLoopError` rather than loop forever.
  
  It returns all events for after-commit publishing.
- **Why:** this replaces `FileLifecycleListener` generically. A listener that throws rolls the whole thing back, exactly as today.

**Mechanism 2: after-commit, in-process** (best-effort reactions: cache invalidation, SSE nudges)

- Standard `@nestjs/cqrs` `@EventsHandler(SomeEvent)` classes in `application/event-handlers/after-commit/`. They receive events only after a successful commit (§5.4 step 7).
- They **must not** perform a state change that the business depends on. If one fails, it logs and does not rethrow. A cache TTL or `tokenVersion` check is the backstop.
- **Why:** replaces `AuthorizationEventEmitter`, with typed classes instead of string channels.

**Mechanism 3: transactional outbox** (durable, cross-process: Kafka analytics, email delivery)

- Each context implements `infrastructure/outbox/<context>-integration-events.mapper.ts` with `map(event: DomainEvent): OutboxRecordInput | null`. It returns `null` for events that are not integration events.
- The dispatcher writes non-null records with the existing `PlatformOutboxService.enqueueInTransaction(db, record)`.
- **Keep every existing outbox `type` and payload shape** (`reward.platform`, `session.action`, `impersonation.action`, `email.log.updated`). The Kafka consumer validates them.
- **Why:** decision #22. The outbox stays the only durable path. Mappers keep private domain classes out of external payloads (§spec-9.2).

### 5.7 Commands, queries, handlers, controllers: the exact shapes

```ts
// contexts/rewards/application/commands/submit-reward-for-review/submit-reward-for-review.command.ts
import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SubmitRewardForReviewInput, SubmitRewardForReviewResult } from "../../../public-api";

export class SubmitRewardForReviewCommand extends Command<SubmitRewardForReviewResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SubmitRewardForReviewInput,
	) {
		super();
	}
}
```

- **Input and result types** are `z.infer` of `@workspace/shared` schemas wherever the contract already defines them (decision #33). Define a new local zod schema only for inputs that combine path params and body. Put it in `application/ports/` and build it from shared schemas with `.extend()`.
- **Handler:**

  ```ts
  @CommandHandler(SubmitRewardForReviewCommand)
  export class SubmitRewardForReviewHandler implements ICommandHandler<SubmitRewardForReviewCommand, SubmitRewardForReviewResult> {
  	public constructor(
  		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
  		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
  		@Inject(CLOCK) private readonly clock: Clock,
  	) {}

  	public async execute(command: SubmitRewardForReviewCommand): Promise<SubmitRewardForReviewResult> {
  		const { actor, input } = command;
  		await this.merchantAccess.assertCapability(actor, { organizationId: input.organizationId, capability: "manage_rewards" });

  		return this.uow.run(actor, async (scope) => {
  			const reward = await scope.rewards.getInOrganization(input.organizationId, input.rewardId);
  			reward.submitForReview(this.clock.now());
  			await scope.rewards.save(reward);
  			scope.events.collectFrom(reward);
  			return { rewardId: reward.id, status: reward.status };
  		});
  	}
  }
  ```

  The handler's steps are always, in this order: authorize → open the UnitOfWork → load the aggregate → call **one** domain method → save → collect events → return a small DTO. Business `if`s belong in the aggregate, not here.
- **Controller** (presentation):

  ```ts
  @Post(":rewardId/publish")
  @RequirePermission(/* keep exactly what exists today */)
  @ZodResponse(/* keep exactly what exists today */)
  public async publishReward(
  	@ZodParams(/* existing schema */) params: PublishRewardParams,
  	@CurrentActor() actor: ActorContext,
  ): Promise<PublishRewardResponse> {
  	return this.commandBus.execute(new SubmitRewardForReviewCommand(actor, params));
  }
  ```

  **Keep every existing decorator** on every route: guards, `@Public`, `@RlsBypass`, `@Idempotent`, `@Throttle`, `@SkipMutationIntent`, `@TrackAuthFlow`, response decorators. The controller still makes exactly one call (`rules/02`).
- **Repository save:**
  - `save(aggregate)` performs a **CAS** using the aggregate's `concurrencyToken`: the `status` (or `version`) it was loaded with.
  - Zero affected rows → throw `ConcurrentModificationError` (409). That covers the races in §9.
  - The aggregate exposes `public get concurrencyToken(): RewardConcurrencyToken` and keeps the loaded value in a private field set by its `rehydrate` factory.
- **Rehydration:** `<Name>.rehydrate(state)` is used only by mappers. `<Name>.create(...)` is used by commands. Both validate invariants. If persisted data violates an invariant, the mapper throws `CorruptAggregateStateError` (platform/domain) with the aggregate id. **Never** build an invalid aggregate silently (§spec-7.3).

### 5.8 `SystemCommandDispatcher`: `platform/application/system-command-dispatcher.ts`

- **Signature:** `dispatch<TResult>(command: Command<TResult>, origin: SystemCommandOrigin): Promise<TResult>`.
  - `SystemCommandOrigin = { kind: "job" | "cron" | "cli" | "bootstrap" | "consumer"; name: string }`
  - `name` is, for example, the queue name, the cron method, or the CLI name.
- **Behaviour:**
  1. Record `startedAt` from `Clock`.
  2. Run `commandBus.execute(command)`.
  3. Write one audit entry through the audit port (`platform/application/ports/command-audit.port.ts`, implemented in `platform/infrastructure/audit/` with the existing `AuditTrailService`). Read that service. If it has no method suited to a non-HTTP command, add `recordSystemCommand(entry)` next to the existing methods, reusing the redaction in `audit-data-policy.ts`.
  4. The audit entry contains:
     - origin kind and name
     - command class name
     - redacted command input
     - actor: the system operation name and the organization id, if any
     - outcome (`success`, or `failure` with the `DomainError` code or `INTERNAL_ERROR`)
     - duration in milliseconds
     - epoch timestamp
  5. On failure, record the entry and then **rethrow**, so BullMQ's retry semantics are unchanged.
- **Lint:** files under `contexts/*/presentation/jobs/**` and `contexts/*/presentation/cli/**` may not import `CommandBus` (§12). They must use `SystemCommandDispatcher`.
- **Why:** decision #27.

### 5.9 Authorization ports

These are owned by `authorization` and `organizations` and exported through their `public-api.ts`.

- `AuthorizationPort` (authorization):
  - `assertAllowed(actor, check: { action; resource; resourceId: string | null }): Promise<void>` throws `AuthorizationDeniedError` (code `FORBIDDEN`, or the code today's kernel raises).
  - `can(actor, check): Promise<boolean>`.
  - Implemented by an adapter over `AuthorizationKernelService`.
- `MerchantAccessPort` (organizations):
  - `assertCapability(actor, { organizationId; capability; locationId?: string | null }): Promise<MerchantAccessGrant>`, where the grant includes the actor's location scope.
  - Implemented by an adapter over today's `OrganizationRewardAuthService` / `requireCedarAction` and `MerchantContextService`. It must keep writing the same `authorize.*` organization audit rows.
- **Guards stay** as the coarse first filter (decision #23). Handlers add the resource-level check. Don't remove `@RequirePermission` anywhere: security must never be weaker during the move.

---

## 6. Bounded contexts and the context map

### 6.1 The 14 contexts at a glance

| Context | One-line purpose | Style (§4.4) | Old code it absorbs |
|---|---|---|---|
| `identity` | Who you are: accounts, credentials, MFA, device sessions, impersonation, own profile | Full CQRS | `modules/auth` (minus `signup-referrals`), `modules/sessions`, `modules/impersonation` |
| `authorization` | What you may do: roles, permissions, overrides, Cedar policy plane, decision kernel, capabilities, support-access grants | Full CQRS | `modules/authorization`, `modules/authorization-cedar`, `modules/support-access` |
| `organizations` | Tenants and their people/places: organization, membership, invitations, access requests, locations, merchant profile, **KYB**, **merchant onboarding** | Full CQRS | `modules/organization`; KYB and onboarding from `modules/rewards` |
| `rewards` | Defining offers: the Reward aggregate (lifecycle, inventory counters, referrer child), admin review, auto-publish, marketplace reads, legal acceptance | Full CQRS | most of `modules/rewards` (reward, admin review, consumer marketplace, legal) |
| `claims` | Holding an offer: RewardClaim, OTP challenge, QR codes, claim expiry, reward notification inbox | Full CQRS | claim, OTP, notifications parts of `modules/rewards` |
| `pos` | Checking out at a till: RewardSale, validate/checkout, OrganizationTerminal and pairing, brute-force lockout, merchant API keys and their verification | Full CQRS | redemption, terminal, POS, merchant API key parts of `modules/rewards`; all of `modules/api-keys` |
| `referrals` | Crediting referrers: RewardReferral crediting, SignupReferralCode/SignupReferral, credit and success notifications | Full CQRS | `modules/auth/signup-referrals`, referral parts of `modules/rewards` |
| `reporting` | Analytics reads and projections | Queries only | `modules/rewards/analytics`, `apps/analytics-consumer` |
| `files` | Generic file lifecycle: upload, scan, verdict, variants, delete | Full CQRS | `modules/files` |
| `notifications` | Email delivery: EmailLog aggregate, templates, provider webhook, durable delivery | Mixed (webhook = command, rest queries) | `modules/notifications` |
| `catalog` | Product and sample-category CRUD, the "simple path" reference | Application service | `modules/product`, `modules/sample-category` |
| `reference-data` | Geography hierarchy and import | Application service | `modules/geo` |
| `audit` | Read-only query side over the audit tables, plus the live audit-trail stream | Queries only | `modules/audit-logs` |
| `integrations-github` | Anti-corruption layer over the GitHub API: account link, PR reads/writes, webhooks, live updates | Mixed | `modules/github` |

**Platform (not contexts):**
- `modules/storage` → `platform/infrastructure/storage`
- `modules/logs` → `platform/infrastructure/logging`
- `modules/health` → `platform/presentation/http/health`
- `modules/encryption` → `platform/infrastructure/encryption`
- `platform/persistence` → `platform/infrastructure/persistence`
- `platform/idempotency` → `platform/infrastructure/idempotency`
- `infrastructure/*` → `platform/infrastructure/*`
- `common/*` → `platform/*`, per the §4.1 table

**Why these splits:**
- **identity / authorization:** see decision #42.
- **rewards / claims / pos / referrals:** these are four lifecycles with four vocabularies (decision #41).
- **KYB → organizations:** KYB verifies the *merchant organization* and its data lives on `OrganizationMerchantProfile`. It is not about a reward.
- **API keys → pos:** `OrganizationApiKey` is a till/integration credential. Its scopes are POS and INTEGRATION, and today rewards owns it.
- **storage / logs / health / encryption:** they have no business language, so they are platform.
- **catalog and reference-data are deliberately simple:** they demonstrate the application-service path.

### 6.2 Prisma model ownership

**Rule:** a model is read or written **only** by its owner's `infrastructure/`. Other contexts go through the owner's public API (a port, a transactional port factory, or a read port).

- If you find a model that is **not** in this table, stop and report.
- Check exact model names against `apps/api/prisma/schema.prisma`.

| Owner | Prisma models |
|---|---|
| identity | `User`, `PasswordHistory`, `PasswordResetToken`, `TwoFactorPendingSetup`, `BackupCode`, `TwoFactorLoginChallenge`, `MfaRecoveryRequest`, `MfaRecoveryAuditLog`, `RefreshToken`, `ImpersonationSession`, `ImpersonationAuditLog`, `UserAvatar` |
| authorization | `Role`, `Permission`, `RolePermission`, `UserRole`, `UserPermission`, `PermissionAuditLog`, `AuthorizationAudit`, `CapabilityDefinition`, `ResourceAcl`, `PolicyDefinition`, `AuthorizationPolicyDraft`, `AuthorizationPolicyVersion`, `AuthorizationPolicySimulation`, `SupportAccessGrant` |
| organizations | `Organization`, `OrganizationMerchantProfile`, `OrganizationEntitlement`, `TenantPlacement`, `OrganizationSlugHistory`, `OrganizationQuota`, `OrganizationLifecycleEvent`, `OrganizationAuditLog`, `OrganizationLocation`, `Store`, `OrganizationMembership`, `OrganizationMembershipLocationScope`, `StoreMembership`, `OrganizationInvitation`, `OrganizationInvitationLocationScope`, `OrganizationAccessRequest`, `OrganizationAsset`, `OrganizationKybFile` |
| rewards | `Reward`, `RewardImage`, `RewardLocationScope`, `RewardLegalAcceptance`, `RewardAuditLog` (append port exposed to claims/pos/referrals) |
| claims | `RewardClaim`, `RewardOtpChallenge`, `RewardNotification` |
| pos | `RewardSale`, `RewardRedemption`, `OrganizationTerminal`, `OrganizationApiKey` |
| referrals | `RewardReferral`, `SignupReferralCode`, `SignupReferral` |
| files | `StoredFile`, `FileVariant` |
| catalog | `Product`, `SampleCategory`, `ProductImage` |
| notifications | `EmailLog`, `EmailDeliveryEvent` |
| reference-data | `Region`, `Subregion`, `Country`, `State`, `City` |
| audit | `AuditLog`, `DataChangeLog` (read-only; writers are the platform audit interceptor and DB triggers) |
| integrations-github | `GithubAccountLink`, `GithubWebhookSubscription`, `GithubWebhookDelivery` |
| platform | `OutboxEvent` (`outbox_events`), idempotency records, `TenantEncryptionKey`; inbox tables used by `packages/messaging` |
| reporting | no Prisma models of its own; raw-SQL fact readers (existing `analytics-sql.ts`) and the consumer's `analytics_events` |

**Why `RewardAuditLog` stays with rewards:** it is the rewards-family audit trail. Claims, pos and referrals append to it through `RewardAuditPort` (exported by rewards) inside the shared transaction. This keeps one audit table per family, as today, with no schema change.

### 6.3 Context relationships (the context map)

This section becomes `docs/architecture/context-map.md` in T48, with the same content plus a Mermaid diagram.

| Upstream (supplier) | Downstream (consumer) | Mechanism | What crosses |
|---|---|---|---|
| identity | authorization | `IdentitySessionsPort` (transactional, implemented by identity) | revoke sessions, bump `tokenVersion` inside RBAC transactions |
| authorization | identity | `AuthorizationPort`, `DefaultRoleAssignmentPort` (transactional) | permission checks; default consumer role assigned **in the signup transaction** |
| authorization | all contexts | `AuthorizationPort` | resource-level checks |
| organizations | rewards, claims, pos, reporting, files | `MerchantAccessPort`, `OrganizationReadPort` | merchant capability + location scope; org/location display data |
| organizations | pos | `MerchantPosSettingsPort` (transactional) | `requireRegisteredTerminals` setting lives on the merchant profile |
| pos | organizations | `StoreClosurePort` (transactional) | store closure revokes the store's terminals and API keys in the same transaction |
| identity | organizations | `AccountProvisioningPort` (transactional) | create/verify account during invite-accept and onboarding |
| identity | claims | `ConsumerPhoneVerificationPort` (transactional) | mark phone verified when an OTP-backed claim is created |
| files | organizations, catalog, identity, rewards, integrations-github | `FileReferencePort`; event `FileVerdictReached` (mechanism 1) | "is this file READY and owned by X", lock files for binding |
| organizations, catalog, identity, rewards | files | `FileReferenceGuard` registrations | "may this file be deleted?" |
| rewards | claims | `RewardInventoryPort` (transactional) | `reserve()`, `release()`, `recordRedemption()` on the Reward aggregate |
| claims | pos | `ClaimRedemptionPort` (transactional) | find merchant claim, redeem claims at checkout |
| referrals | pos | `ReferralCreditPort` (transactional) | credit referrer and stamp signup success during checkout |
| claims | referrals | in-transaction handler on `ReferrerCredited` / `SignupReferralSucceeded` | write `RewardNotification` inbox row |
| notifications | everyone who emails | `EmailRequestPort` (transactional) | write `EmailLog(pending)` + outbox `notification.email.requested` |
| rewards | claims, pos, referrals | `RewardAuditPort` (transactional) | append `RewardAuditLog` |
| all contexts | reporting | outbox → Kafka → `apps/analytics-consumer` | integration events |
| all writers | audit | DB triggers + HTTP interceptor | audit rows (read by `audit`) |

**No cycles:**
- Wherever two contexts need each other, one direction is a **port the other implements** (dependency inversion). For example, authorization depends on `IdentitySessionsPort` and identity *implements* it.
- The Nest modules import each other one way only: the implementer's module exports the provider bound to the port token, and the consumer imports that module.
- No `forwardRef` (§spec-6.4).
- Remove `AccessTokenModule` and `SessionsPersistenceModule` once nothing needs them (T16/T17).

### 6.4 What each `public-api.ts` exports

Only these kinds of things:

1. Port **interfaces** and their injection **tokens** that other contexts consume.
2. Transactional port **factories** (`create<Context>TransactionalPorts(db, events)`), which may only be imported by other contexts' `infrastructure/`.
3. **Public domain events** used by another context's in-transaction or after-commit handlers. Example: files exports `FileVerdictReached`.
4. The context's `DomainErrorCode` schema and type, for the HTTP status map.
5. Input/result **types** used by other contexts' ports.
6. The Nest **module** class, for `app.module.ts` and consumer modules.

Never export aggregates, repositories, mappers, Prisma types or controllers. **Why:** §spec-6.3. A context's insides can change without touching its neighbours.

---

## 7. Use-case classification (decided; do not reclassify)

**Legend:**
- **Type:**
  - **C** = Command + handler + aggregate
  - **Q** = Query + handler + read port
  - **S** = application-service method (simple path)
  - **J** = a job, cron or CLI entry point that dispatches the named command through `SystemCommandDispatcher`
- **Conc** (concurrency guard):
  - `CAS-status`: conditional update on the expected status
  - `CAS-ver`: conditional update on `version`
  - `lock`: `SELECT … FOR UPDATE`
  - `adv`: `pg_advisory_xact_lock`
  - `uniq`: unique index
- **Events:** outbox `type`/action, or `M1`/`M2` for in-process mechanisms.
- **D-xx:** a defect fix from §9 that applies to that row.

Paths in "Today" are relative to `apps/api/src/modules/`. Command and query class names are given without the `Command`/`Query` suffix.

### 7.1 rewards

| Endpoint / entry | Today | Type | New name | Aggregate | Conc | Events | Notes |
|---|---|---|---|---|---|---|---|
| GET /orgs/:orgSlug/rewards | rewards/services/merchant-reward.service.ts:listRewards | Q | ListOrganizationRewards | — | — | — | store scope from `MerchantAccessGrant` |
| GET /orgs/:orgSlug/rewards/:rewardId | :getReward | Q | GetOrganizationReward | — | — | — | out-of-scope → 404 (keep) |
| POST /orgs/:orgSlug/rewards | :createReward | C | CreateReward | Reward (+ referrer child) | uniq; `lock` image files via `FileReferencePort` | M1 none | **D02**: ONE transaction for consumer + referrer + scopes + link |
| PATCH /orgs/:orgSlug/rewards/:rewardId | :updateReward | C | ReviseReward | Reward | CAS-status (DRAFT\|PENDING_REVIEW) | — | **D03**; referrer child updated inside the aggregate |
| POST /orgs/:orgSlug/rewards/:rewardId/publish | :publishReward | C | SubmitRewardForReview | Reward | CAS-status DRAFT | — | **D04**: consumer + referrer in one tx |
| GET /admin/rewards/pending | rewards-admin.service.ts:listPendingRewards | Q | ListRewardsPendingReview | — | — | — | |
| GET /admin/rewards/:rewardId | :getReward | Q | GetRewardForAdmin | — | — | — | |
| GET /admin/rewards/:rewardId/images/:fileId/download | :getRewardImageDownload | Q | GetRewardImageDownloadUrl | — | — | — | via `FileReferencePort` |
| GET /admin/rewards/:rewardId/images/archive | :getRewardImagesArchive | Q | GetRewardImagesArchive | — | — | — | stream stays in presentation |
| POST /admin/rewards/:rewardId/approve | :approveReward | C | ApproveReward | Reward | CAS-status PENDING_REVIEW | outbox `reward.platform`/`reward.approved` (**new**) | **D01**; owner notification email via `EmailRequestPort` |
| POST /admin/rewards/:rewardId/reject | :rejectReward | C | RejectReward | Reward | CAS-status PENDING_REVIEW | outbox `reward.platform`/`reward.rejected` (**new**) | **D01** |
| BullMQ `rewardsAutoPublish` | rewards-queue.processors.ts:RewardsAutoPublishProcessor | J→C | AutoPublishDueRewards | Reward | CAS-status PENDING_REVIEW **inside** tx | outbox `reward.platform`/`reward.auto_published` (keep) | **D10**: re-check status in tx; skip rows whose CAS returns 0 |
| GET /rewards (public) | consumer-rewards.service.ts:listMarketplace | Q | ListMarketplaceRewards | — | — | — | N+1 test (§11) |
| GET /rewards/:rewardId (public) | :getPublishedReward | Q | GetPublishedReward | — | — | — | |
| GET /legal/status | reward-legal.service.ts:getCheckoutStatus | Q | GetLegalAcceptanceStatus | — | — | — | |
| POST /legal/accept | :accept | C | AcceptLegalTerms | RewardLegalAcceptance | uniq (user, version) if index exists, else append | — | append-only; keep "new row each call" semantics |
| (dead) rewards-admin.service.ts:runScheduledJobs | — | — | **delete** | — | — | — | **D11** |

**Reward aggregate invariants** (enforce in `reward.aggregate.ts`; each one gets a domain test):
- Status machine:
  - `DRAFT → PENDING_REVIEW` (submit for review, or create with publish)
  - `PENDING_REVIEW → PUBLISHED` (approve or auto-publish when `autoPublishAt ≤ now`)
  - `PENDING_REVIEW → DRAFT` (reject, with a non-empty reason)
  - Any other transition throws `RewardTransitionNotAllowedError`.
- **Revisions** are allowed only in `DRAFT` or `PENDING_REVIEW`.
- **Quantity:**
  - The total may change only if `quantityRemaining + delta ≥ 0` (`RewardQuantityBelowReservedError`).
  - `reserve()` requires PUBLISHED, unexpired, and `quantityRemaining > 0`. It does remaining −1, reserved +1, claimCount +1.
  - `release()` does reserved −1, remaining +1.
  - `recordRedemption()` does reserved −1, redemptionCount +1.
- The **referrer child** (kind REFERRER) moves in lockstep with its parent on every transition. Its expiry is ≤ 30 days (existing constant in `referral-credit.constants.ts`).
- A **store-limited actor** may only select its own stores. If an organization has ≤ 1 store, the scope becomes ALL_LOCATIONS.
- **Domain model statuses:** `DRAFT`, `PENDING_REVIEW` and `PUBLISHED` only. `EXPIRED` and `DISABLED` stay in the Prisma enum but are not modelled (decision #40). If the mapper meets them, it throws `CorruptAggregateStateError` **for command loads only**. Read projections still display whatever is stored.

### 7.2 claims

| Endpoint / entry | Today | Type | New name | Aggregate | Conc | Events | Notes |
|---|---|---|---|---|---|---|---|
| POST /claims/otp | claim.service.ts:requestOtp → reward-otp.service.ts:sendClaimOtp | C | RequestClaimOtp | RewardOtpChallenge | — | email via `EmailRequestPort` (durable) | reward must be claimable (read via `RewardInventoryPort.assertClaimable`) |
| POST /claims | claim.service.ts:createClaim | C | ClaimReward | RewardClaim + OtpChallenge | `CAS` stock via `RewardInventoryPort.reserve`; **D08** per-user limit under `lock` on the user's claim-limit row (see D08); **D09** OTP attempts CAS | — | OTP verify moves **inside** the same transaction |
| GET /claims | :listClaims | Q | ListMyClaims | — | — | — | N+1 test |
| **GET /claims/:claimId** (new) | — | Q | GetMyClaim | — | — | — | **new route** (decision #59): claim details for the SSR QR page (reward title, status, expiry, store); own claims only, else 404; never returns token or backup-code values. Request/response schemas added to `contexts/claims` in `packages/shared`, built from existing claim schemas |
| GET /claims/analytics | rewards-analytics.service.ts:getUserAnalytics | Q (reporting) | GetConsumerClaimAnalytics | — | — | — | handler lives in **reporting** |
| GET /claims/analytics/dashboard | analytics-dashboard.service.ts:getCustomerDashboard | Q (reporting) | GetConsumerDashboard | — | — | — | reporting |
| **POST** /claims/:claimId/qr (was GET) | :getClaimQr | C | IssueClaimQrCodes | RewardClaim | CAS-status PENDING + unexpired | — | **D07**, API change (decision #39) |
| GET /reward-notifications | reward-notification.service.ts:listForUser | Q | ListMyRewardNotifications | — | — | — | |
| POST /reward-notifications/read | :markRead | C | MarkRewardNotificationsRead | (set-based) | idempotent set `readAt` where null | — | set-based update is fine; no aggregate hydration for N rows |
| BullMQ `claimsExpirePending` | ClaimsExpirePendingProcessor | J→C | ExpireOverdueClaims | RewardClaim | CAS-status PENDING (keep), batch size constant 200 (keep, named) | outbox `reward.platform`/`reward.claim_expired` (keep) | releases inventory via `RewardInventoryPort.release` in same tx |
| BullMQ `claimsExpireReferrer` | claims-expire-referrer.processor.ts | J→C | ExpireOverdueReferrerClaims | RewardClaim | same | same | |
| in-tx handler | (new) | M1 | RecordNotificationOnReferrerCredited | — | — | — | replaces direct `RewardNotification` write in `reward-referral.repository.ts` |
| in-tx handler | (new) | M1 | RecordNotificationOnSignupReferralSucceeded | — | — | — | replaces `signup-referral.repository.ts:insertSuccessNotificationInTx` |

**RewardClaim invariants:**
- `PENDING → REDEEMED` (checkout only, via `ClaimRedemptionPort`).
- `PENDING → EXPIRED` (when `expiresAt ≤ now`).
- The claim TTL is `min(7 days, reward expiry)`, using the existing constant.
- QR rotation is allowed only while PENDING and unexpired.

**OtpChallenge invariants:**
- At most 5 attempts (existing constant, named).
- Expires after 5 minutes.
- Single use (`consumedAt`).

### 7.3 pos

| Endpoint / entry | Today | Type | New name | Aggregate | Conc | Events | Notes |
|---|---|---|---|---|---|---|---|
| POST /redemptions/validate | redemption.service.ts:validate | C | ValidateRedemptionCodes | ApiKeyLockout (on `OrganizationApiKey`) | CAS on lockout window fields (keep) | — | writes audit `merchant.scan_qr` + lockout counters → it is a command (it writes) |
| POST /redemptions/checkout | redemption.service.ts:checkout | C | CheckoutSale | RewardSale | uniq `(organizationId, idempotencyKey)` + requestHash (keep); claims CAS in sorted order (keep) | outbox `reward.platform`/`merchant.redeem_reward` (keep) | ONE UnitOfWork with `ClaimRedemptionPort`, `RewardInventoryPort`, `ReferralCreditPort`, `RewardAuditPort` |
| GET /orgs/:orgSlug/redemptions | merchant-reward.service.ts:listRedemptions | Q | ListOrganizationRedemptions | — | — | — | N+1 test |
| GET /orgs/:orgSlug/terminals | merchant-terminal.service.ts:list | Q | ListTerminals | — | — | — | |
| POST /orgs/:orgSlug/terminals | :create | C | RegisterTerminal | OrganizationTerminal | uniq (keep) | — | terminalId generation retries = named constant (keep 3) |
| GET /orgs/:orgSlug/terminals/summary | :summary | Q | GetTerminalSummary | — | — | — | |
| GET /orgs/:orgSlug/terminals/settings | :getSettings | Q | GetPosSettings | — | — | — | via `MerchantPosSettingsPort` |
| PATCH /orgs/:orgSlug/terminals/settings | :updateSettings | C | ChangePosSettings | — | — | — | writes through `MerchantPosSettingsPort` (organizations owns the column) |
| GET /orgs/:orgSlug/terminals/:id | :get | Q | GetTerminal | — | — | — | |
| POST /orgs/:orgSlug/terminals/:id/pairing-code | :issuePairingCode | C | IssuePairingCode | OrganizationTerminal | lock (add) | — | **D33**: add row lock so two concurrent issues don't interleave |
| DELETE /orgs/:orgSlug/terminals/:id | :remove | C | RemoveTerminal | OrganizationTerminal | lock (keep) | — | soft delete + revoke key in same tx |
| POST /pos/terminals/pair | pos-pairing.service.ts:pair | C | PairTerminal | OrganizationTerminal + OrganizationApiKey | CAS on `pairingCodeHash` (keep) | — | system operation `pos.terminal.pair` (keep name) |
| GET /orgs/:orgSlug/api-keys | merchant-api-key.service.ts:listKeys | Q | ListApiKeys | — | — | — | |
| POST /orgs/:orgSlug/api-keys | :createKey | C | IssueApiKey | OrganizationApiKey | — | — | plaintext returned once (keep) |
| POST /orgs/:orgSlug/api-keys/:keyId/revoke | :revokeKey | C | RevokeApiKey | OrganizationApiKey | CAS `revokedAt IS NULL` (**D34**) | — | |
| Global `ApiKeyAuthGuard` + `MerchantApiKeyGuard` | api-keys/services/merchant-api-key-verification.service.ts:verify | presentation + Q | VerifyApiKey (read port) | — | `touchLastUsed` stays a fire-and-forget write in the adapter | — | guard moves to `platform/presentation/http/security/` and calls pos `ApiKeyVerificationPort` |
| in-tx port | (new) `StoreClosurePort.closeStore` | port | — | — | lock | — | called by organizations `CloseLocation` |

### 7.4 referrals

| Endpoint / entry | Today | Type | New name | Aggregate | Conc | Notes |
|---|---|---|---|---|---|---|
| GET /auth/signup-referrals/dashboard | signup-referral.service.ts:getDashboard | Q | GetMySignupReferralDashboard | — | — | route path unchanged |
| GET /auth/signup-referrals/referees | :listReferees | Q | ListMyReferees | — | — | system op `auth.signup_referrals.list_referees` (keep name) |
| port (from identity signup) | :acceptCodeForSignup, :attachSignupReferralInTx, :issueFirstCodeInTx | port | `SignupReferralPort` (transactional) | SignupReferralCode, SignupReferral | `FOR SHARE` + revalidate (keep) | called inside identity's `SignUp` UnitOfWork |
| port (from identity provisioning, bootstrap) | SignupReferralRepository.insertCodeInTx, signup-referral-code.issuer.ts | port | `SignupReferralPort.issueFirstCode` | SignupReferralCode | uniq + bounded retry (keep 8, named) | |
| port (from identity admin list) | findAdminSummariesForReferees | read port | `ReferralSummaryReadPort` | — | — | batched (one query for a page of users) |
| port (from pos checkout) | reward-referral.repository.ts:creditReferrerForRedemption, signup-referral-checkout.service.ts:markSuccessfulInTransaction | port | `ReferralCreditPort` | RewardReferral, SignupReferral | CAS (keep) | records `ReferrerCredited`, `SignupReferralSucceeded` |
| @Cron hourly (in auth TaskScheduleService) | maintainSignupReferrals | J→C | MaintainSignupReferralCodes | SignupReferralCode | lock user row (keep) | cron moves to `referrals/presentation/jobs/` |
| @Cron hourly (same) | deliverPendingSuccessNotifications | J→C | SweepSignupSuccessNotices (claims; see handoff §0.9) | SignupReferral | CAS on `successNotifiedAt` (keep) | backlog sweeper; normal path is after commit (M2), delivered by claims, which owns the inbox |
| BullMQ `rewardsReferralCreditNotify` | ReferralCreditNotifyProcessor | J→C | SweepReferrerCreditEmails | RewardReferral | CAS on `creditNotifiedAt` | becomes a sweeper: requests the email through `EmailRequestPort` and sets `creditNotifiedAt` **in the same tx** (decision #44); normal path requests the email during checkout |

**Not implemented (decision #40):** `RewardReferral` creation and `pendingAttributionToken` writes. `RewardReferralStatus.BLOCKED` is not modelled.

### 7.5 organizations

| Endpoint / entry | Today | Type | New name | Aggregate | Conc |
|---|---|---|---|---|---|
| GET /orgs/memberships, GET /orgs/:orgSlug/memberships | organization-reward-auth.service.ts:listMembershipsForUser | Q | ListMyMemberships | — | — |
| GET /orgs/:orgSlug/context | organization-context.service.ts:getContext | Q | GetOrganizationContext | — | — |
| POST /orgs/:orgSlug/access-requests | organization-membership.service.ts:createAccessRequest | C | RequestOrganizationAccess | AccessRequest | uniq (keep) |
| POST /orgs/:orgSlug/access-requests/:requestId/review | :reviewAccessRequest | C | ReviewAccessRequest | AccessRequest (+ Membership created) | CAS-status PENDING (keep) |
| POST /orgs/:orgSlug/locations | organization-location.service.ts:createMerchantLocation | C | ProposeLocation | Location | adv per org (keep) |
| PATCH /orgs/:orgSlug/locations/:locationId | :resubmitMerchantLocation | C | ResubmitLocation | Location | CAS-status REJECTED (keep) |
| POST /orgs/:orgSlug/locations/:locationId/close | :closeMerchantLocation | C | CloseLocation | Location | adv + CAS (keep); calls pos `StoreClosurePort` (**D27**) |
| POST /orgs/:orgSlug/members/:membershipId/stores/:locationId/remove | organization-store-member.service.ts:removeFromStore | C | RemoveMemberFromStore | Membership | lock (keep) |
| GET /orgs/:orgSlug/members | membership:listMembers | Q | ListMembers | — | — (one batched profile read; N+1 test) |
| PATCH /orgs/:orgSlug/members/me | organization-own-membership.service.ts | C | RenameOwnMembership | Membership | lock (keep) |
| GET /orgs/:orgSlug/members/invites | membership:listPendingInvites | Q | ListPendingInvites | — | — |
| POST /orgs/:orgSlug/members/invite | membership:inviteMember | C | InviteMember | Invitation | uniq (keep); **one** UnitOfWork (today 3 SysOps) | 
| POST /orgs/:orgSlug/members/invites/:inviteId/revoke | :revokeInvite | C | RevokeInvite | Invitation | CAS (keep) |
| POST /orgs/invites/validate | :validateTeamInvite | Q | PreviewTeamInvite | — | — |
| POST /orgs/invites/accept | :acceptTeamInvite | C | AcceptTeamInvite | Invitation + Membership | CAS + uniq (keep) |
| POST /orgs/invites/register-and-accept | :registerAndAcceptTeamInvite | C | RegisterAndAcceptTeamInvite | Invitation + Membership (+ identity `AccountProvisioningPort`) | CAS + uniq (keep) |
| POST /admin/organizations/invites | organization-provisioning.service.ts:provisionFromPlatformInvite | C | ProvisionOrganizationFromPlatformInvite | Organization + Invitation | uniq slug; **D24** add `@Idempotent()` |
| POST /admin/invites (rewards admin) | rewards-admin.service.ts:createMerchantInvite → provisionFromDashboardAdminInvite | C | ProvisionMerchantFromAdminInvite | Organization + Invitation | uniq; email durable |
| GET /admin/invites/preview-email | :previewMerchantInviteEmail | Q (notifications) | PreviewMerchantInviteEmail | — | — |
| GET /admin/location-requests | location:listAdminLocationRequests | Q | ListLocationRequests | — | — |
| POST /admin/merchants/:organizationId/locations | :createAdminLocation | C | CreateLocationAsAdmin | Location | adv (keep) |
| PATCH /admin/merchants/:organizationId/locations/:locationId/review | :reviewAdminLocation | C | ReviewLocation | Location | CAS (keep) |
| GET /admin/merchants, GET /admin/merchants/:organizationId | rewards-admin.service.ts:listMerchants/getMerchantDetail | Q | ListMerchants, GetMerchantDetail | — | — (N+1 test) |
| GET /orgs/:orgSlug/kyb | rewards/services/merchant-kyb.service.ts:getProfile | Q | GetKybProfile | — | — |
| PATCH /orgs/:orgSlug/kyb | :submitKyb | C | SubmitKyb | MerchantVerification (on MerchantProfile) | CAS `kybStatus≠APPROVED` + lock (keep); **D06** audit in tx |
| GET /orgs/:orgSlug/kyb/documents/:documentId/download, GET /admin/merchants/:organizationId/documents/:documentId/download | merchant-kyb-document.service.ts:getDownloadUrl | Q | GetKybDocumentDownloadUrl | — | — |
| PATCH /admin/merchants/:organizationId/kyb | rewards-admin.service.ts:updateMerchantKyb | C | DecideKyb | MerchantVerification | lock + CAS (**D05**) |
| in-tx handler on files `FileVerdictReached` (MERCHANT_KYB) | rewards/listeners/kyb-file-verdict.listener.ts | M1 | ReconcileKybOnFileVerdict | MerchantVerification | lock (keep) |
| POST /orgs/onboarding/validate | merchant-onboarding.service.ts:validateInviteToken | Q | PreviewOnboardingInvite | — | — |
| POST /orgs/onboarding/complete | :completeOnboarding | C | CompleteMerchantOnboarding | Invitation + Organization (+ identity `AccountProvisioningPort`) | CAS on invite (keep) |
| POST /orgs/onboarding/documents/upload-url(s) | :createDocumentUploadUrl(s) | C | RequestOnboardingDocumentUpload | (files `FileUploadPort`) | window check |
| POST /orgs/onboarding/documents/upload-complete(-batch) | :completeDocumentUpload(s) | C | CompleteOnboardingDocumentUpload | (files) | files CAS |
| POST /orgs/onboarding/documents/submit | :submitDocuments | C | SubmitOnboardingDocuments | MerchantVerification | CAS on window + lock (keep) |
| POST /orgs/onboarding/documents/status | :documentStatus | Q | GetOnboardingDocumentStatus | — | — |
| (dead) organization-lifecycle.service.ts, organization-erasure.service.ts, organization-quota.service.ts | — | **delete** (**D26**) | — | — | — |

**MerchantVerification (KYB) invariants:**
- **Merchant submit:** any status except `APPROVED` → `PENDING`. Previously submitted evidence is retired. Each file must be a `MERCHANT_KYB` file of the same organization, in status SCANNING, PROCESSING or READY.
- **Reconcile on file verdict:** applies only when the status is not decided. An infected or failed file → `ACTION_REQUIRED`. All files clean while in `ACTION_REQUIRED` → `PENDING`.
- **Admin decision** (D05):
  - `PENDING → APPROVED | REJECTED | ACTION_REQUIRED`
  - `ACTION_REQUIRED → APPROVED | REJECTED`
  - `REJECTED → PENDING` is **not** allowed (the merchant must resubmit).
  - `APPROVED → REJECTED | ACTION_REQUIRED` is allowed (revocation).
  - REJECTED and ACTION_REQUIRED **require a reason** (the contract already says so).
  - Every decision writes an organization audit row in the same transaction.

### 7.6 identity

| Endpoint / entry | Today | Type | New name | Aggregate | Conc / fix |
|---|---|---|---|---|---|
| POST /auth/signup | identity.service.ts:signup | C | SignUp | UserAccount | uniq email; **D14** user + referral code + default role in ONE tx |
| POST /auth/login | login.service.ts:login | C | LogIn | UserAccount (lockout) | **D19** atomic lockout increment-and-decide |
| (internal) issue session | auth-session.service.ts:issueSessionForUser | port | `SessionIssuer` (identity application service used by LogIn/VerifyLogin/2FA/accept-invite) | DeviceSession | **D15** create + retire in one tx |
| POST /auth/verify-login | login-verification.service.ts:verifyLoginCode | C | VerifyNewDeviceLogin | (Redis record) | **D20** atomic attempt counter |
| POST /auth/resend-verification | email-verification.service.ts:resendVerificationEmail | C | ResendVerificationEmail | — | durable email |
| POST /auth/verify-email | :verifyEmail | C | VerifyEmail | UserAccount | CAS (keep) |
| POST /auth/forgot-password | password-reset.service.ts:forgotPassword | C | RequestPasswordReset | PasswordResetToken | one tx (expire old + create) + durable email |
| POST /auth/validate-reset-token | :validateResetToken | Q | CheckPasswordResetToken | — | — |
| POST /auth/reset-password | :resetPassword | C | ResetPassword | UserAccount + PasswordResetToken | **D12** CAS `usedAt IS NULL` |
| POST /auth/change-password | change-password.service.ts | C | ChangePassword | UserAccount | CAS-ver on `tokenVersion` (**D35**) |
| GET /auth/me | identity.service.ts:getMe | Q | GetMe | — | cache (keep) |
| GET /auth/permissions | :getSessionPermissions | Q | GetSessionPermissions | — | — |
| GET /auth/admin/users, GET /auth/admin/users/:userId | admin-user.service.ts | Q | ListUsersForAdmin, GetUserForAdmin | — | N+1 test; referral summary via batched `ReferralSummaryReadPort` |
| PATCH /auth/admin/users/:userId/unlock | :unlockUser | C | UnlockAccount | UserAccount | **D18** audit + invalidate |
| POST /auth/2fa/setup | two-factor.service.ts:generateSetup | C | StartTwoFactorSetup | TwoFactorEnrollment | upsert (keep) |
| POST /auth/2fa/enable | :enableTwoFactor | C | EnableTwoFactor | TwoFactorEnrollment | **D16** token-version bump in tx + cross-instance invalidation |
| POST /auth/2fa/rotate | :rotateTwoFactor | C | RotateTwoFactor | TwoFactorEnrollment | **D16**, **D17** one tx; consume backup code |
| GET /auth/2fa/backup-codes/remaining | :getBackupCodesRemaining | Q | CountRemainingBackupCodes | — | — |
| POST /auth/2fa/verify-backup-code | :verifyBackupCode | Q | CheckBackupCode | — | does not consume (keep) |
| POST /auth/login/2fa | :completeLoginWithTotp | C | CompleteTotpLogin | TwoFactorLoginChallenge | **D13** honour CAS results |
| POST /auth/login/backup-code | :completeLoginWithBackupCode | C | CompleteBackupCodeLogin | TwoFactorLoginChallenge + BackupCode | CAS (keep) |
| POST /auth/mfa/recovery | mfa-recovery.service.ts:initiateRecovery | C | RequestMfaRecovery | MfaRecoveryRequest | adv (keep) |
| GET /auth/mfa/recovery/status | :getRecoveryStatus | Q | GetMyMfaRecoveryStatus | — | — |
| GET /auth/admin/mfa/recovery/requests | :listAdminRecoveryRequests | Q | ListMfaRecoveryRequests | — | — |
| POST /auth/admin/mfa/recovery/review | :adminApprove/adminDeny | C | ReviewMfaRecovery | MfaRecoveryRequest | CAS (keep) |
| @Cron every 10 min | task-schedule.service.ts:processMfaRecoveryUnlocks | J→C | CompleteDueMfaRecoveries | MfaRecoveryRequest | CAS (keep) |
| @Cron hourly | :cleanupExpiredResetTokens | J→C | PurgeStalePasswordResetTokens | — (set-based soft delete) | — |
| GET /auth/profile | own-profile.service.ts:getOwnProfile | Q | GetOwnProfile | — | — |
| PATCH /auth/profile | :updateOwnProfile | C | UpdateOwnProfile | UserProfile | CAS-ver `profileVersion` (keep) |
| CLI `pnpm admin:bootstrap-superadmin` | auth/bootstrap/* | J→C | BootstrapSuperAdmin | UserAccount | adv + uniq (keep); keep the non-Nest composition (`composition.ts`) but route through the same handler class instantiated manually |
| POST /auth/refresh | sessions.service.ts:refreshToken | C | RefreshSession | DeviceSession | CAS (keep); reuse-detection path revokes all in same tx (keep) |
| POST /auth/logout | :logoutDevice | C | LogOutDevice | DeviceSession | CAS (keep) |
| POST /auth/logout-all | :logoutAllDevices | C | LogOutAllDevices | UserAccount + sessions | — |
| GET /auth/sessions | :getSessions | Q | ListMySessions | — | — |
| POST /auth/sessions/:sessionId/revoke | :revokeSession | C | RevokeMySession | DeviceSession | CAS (keep) |
| GET /session | session-status.controller.ts | presentation only | — | — | no DB, stays a controller method |
| POST /auth/impersonate/:userId | impersonation.service.ts:impersonateUser | C | StartImpersonation | ImpersonationSession | **D36** partial-unique or CAS so an admin can't open two live sessions concurrently (use a `lock` on the impersonator's user row) |
| POST /auth/stop-impersonation | :stopImpersonation | C | StopImpersonation | ImpersonationSession | CAS (keep) |
| listener `auth-me-cache.listener.ts` | — | M2 | InvalidateMeCacheOnAuthorizationChanged | — | after-commit |

**Value objects to create in `identity/domain/value-objects/`:** `EmailAddress` (wraps the shared email schema), `PasswordPolicy` (wraps the shared password schema plus the history rule of the last 5 passwords, named constant), `LockoutState` (5 attempts / 15 minutes, named constants), `TokenVersion`.

### 7.7 authorization

| Endpoint / entry | Today | Type | New name | Notes |
|---|---|---|---|---|
| Permissions CRUD + restore (`/admin/permissions*`) | permission.service.ts | C/Q | CreatePermission, RevisePermission, RemovePermission, RestorePermission, ListPermissions, GetPermission, ListPermissionGroups | every C runs inside `RbacMutationScope` (below) |
| POST /admin/permissions/check | AuthorizationCheckerService | Q | CheckPermission | |
| POST /admin/permissions/user/grant, revoke, sync | permission.service.ts | C | GrantUserPermission, RevokeUserPermission, SyncUserPermissions | |
| Roles CRUD, assign, remove, sync, parent, permissions, restore (`/admin/roles*`) | role.service.ts | C/Q | CreateRole, ReviseRole, RemoveRole, RestoreRole, ReparentRole, SyncRolePermissions, AssignRole, UnassignRole, SyncUserRoles, ListRoles, GetRole | |
| POST /admin/roles/:id/validate-assignment, POST /admin/roles/preview | conflict-detection / role-assignment-preview | Q | ValidateRoleAssignment, PreviewRoleAssignment | system op `authorization.rbac.inspect` (keep) |
| GET /admin/audit | permission-audit-log-query.service.ts | Q | ListPermissionAuditLog | |
| GET /capabilities/catalog | capability-definition.service.ts:listCatalog | Q | GetCapabilityCatalog | |
| POST /authorization/decisions, GET /authorization/decisions/explain | kernel | Q | DecideAuthorization, ExplainAuthorization | |
| POST /policies/drafts, /simulate, /publish | policy-control-plane.service.ts | C | CreatePolicyDraft, SimulatePolicyDraft, PublishPolicy | publish keeps advisory locks and four-eyes check; **D37** simulate in one tx (today 3 SysOps) |
| POST /support-access/request, /:grantId/approve, /:grantId/revoke | support-access.service.ts | C | RequestSupportAccess, ApproveSupportAccess, RevokeSupportAccess | CAS (keep) |
| (dead) support-access.service.ts:assertActiveReadGrant | — | **delete** (**D23**) | | |
| @Cron hourly permission-expiry.cleanup | J→C | ExpireTimeBoundPermissionOverrides | |
| @Cron hourly audit-log.cleanup | J→C | PurgeOldPermissionAuditLogs | soft delete (keep) |
| onModuleInit permission-registry-sync.bootstrap | J→C (bootstrap) | SyncPermissionRegistry | **D21** advisory lock + awaited before readiness |
| onModuleInit capability-definition sync | J→C (bootstrap) | SyncCapabilityCatalog | awaited (keep) + advisory lock |
| CLI `pnpm db:sync-reference-data` | J→C | SyncReferenceData | |
| AuthorizationEventEmitter | — | M2 | `UserAuthorizationChanged` event replaces `emitUsersMeInvalidate`; the 4 dead channels are deleted (**D22**) |

**`RbacMutationScope`:** today's `RbacMutationRunner` becomes the authorization context's UnitOfWork scope factory plus a domain service `RbacMutationGuard`. Inside **one** `runSystemOperation("authorization.rbac.mutate", …)` it does:
1. Take the global advisory lock (keep the key constant).
2. Run the escalation and separation-of-duties (SoD) checks in the domain policy (`domain/policies/rbac-escalation.policy.ts`, `separation-of-duties.policy.ts`).
3. Write the change.
4. Revoke affected sessions through `IdentitySessionsPort` in the same transaction.
5. Write the `permission_audit_logs` row in the same transaction.
6. Record `UserAuthorizationChanged` for after-commit cache invalidation (Redis `authz:invalidate`, unchanged).

### 7.8 files, notifications, catalog, reference-data, audit, reporting, integrations-github

| Endpoint / entry | Context | Type | New name | Notes |
|---|---|---|---|---|
| POST /files/upload-url | files | C | RequestFileUpload | per-category authorization moves to `FileUploadAuthorization` domain policy plus ports: owner contexts register their category rules through `FileCategoryAccessRegistry` (same idea as `FileReferenceGuard`) |
| POST /files/:fileId/complete | files | C | CompleteFileUpload | CAS `claimPendingForScan` via UnitOfWork (**D28**) |
| POST /files/processing-callback | files | C | ApplyFileProcessingResult | records `FileVerdictReached` (M1) |
| GET /files/:fileId, GET /files/:fileId/download-url | files | Q | GetFile, GetFileDownloadUrl | |
| DELETE /files/:fileId | files | C | DeleteFile | asks `FileReferenceGuard`s; soft-deletes; dispatch of physical delete after commit (M2 → existing queue) (**D28**) |
| local storage transfer endpoints | files | presentation (driver-only) | — | stay in `files/presentation/http/local-storage-transfer.controller.ts` |
| BullMQ scan / cleanup / delete / cdn-invalidate | files | J→C | ScanFile, CleanUpStaleUploads, PurgeFileObject, InvalidateFileCdn | keep jobIds and retry options |
| GET /notifications/email-log (+ SSE) | notifications | Q | ListEmailLog | SSE stays presentation |
| GET /notifications/email-preview(/:key) | notifications | Q | ListEmailTemplates, PreviewEmailTemplate | |
| POST /notifications/email-preview/:key/send | notifications | C | SendTestEmail | uses `EmailRequestPort` |
| POST /notifications/email-webhook | notifications | C | ApplyEmailDeliveryEvent | CAS + webhookId unique (keep); **D32** parse status with zod |
| BullMQ `emailSend` | notifications | J→C | DeliverEmail | skips non-pending (keep) |
| outbox route `notification.email.requested` | platform outbox | infra | — | ADR 060, §9 D25 |
| `/product*`, `/sample-category*` (8 endpoints each) | catalog | S | `ProductApplicationService`, `SampleCategoryApplicationService` | **D29** `@Idempotent()` on sample-category create |
| `/geo*` reads | reference-data | Q via service | `GeographyApplicationService` read methods | simple path |
| `/geo*` writes, import, validate | reference-data | S | same service | keep SysOp `GEO_WRITE_OPERATION` + audit in tx, advisory lock on import |
| `/admin/audit-logs*`, `/admin/data-changes*`, `/admin/audit-trail*` | audit | Q | ListHttpAuditLogs, GetHttpAuditLog, ListDataChanges, GetDataChange, ListAuditTrail | the sensitive-read audit write stays (allowed by §spec-4.3) |
| SSE `/admin/audit-trail/events` | audit | presentation | — | LISTEN/NOTIFY unchanged |
| all `/orgs/:orgSlug/analytics*`, `/admin/analytics/*`, `/claims/analytics*` | reporting | Q | GetMerchantAnalytics, GetMerchantDashboard, ExportMerchantReport, GetAdminSalesAnalytics, GetAdminDashboard, ExportPlatformReport, GetConsumerClaimAnalytics, GetConsumerDashboard | keep `statement_timeout` transactions and export rate limit guard |
| `apps/analytics-consumer` | reporting | projection | — | reorganise `src/` into `projections/platform-events/` + `infrastructure/`; logic unchanged |
| `/github/*` reads | integrations-github | Q | (one query per endpoint) | GitHub API adapter stays in infrastructure |
| PUT/DELETE /github/account | integrations-github | C | LinkGithubAccount, UnlinkGithubAccount | |
| POST comments/reviews/merge/pictures, PUT reactions | integrations-github | C | CommentOnPullRequest, SubmitPullRequestReview, MergePullRequest, AttachPullRequestPicture, SetPullRequestReaction | keep `@Idempotent({ required: true })` |
| live-updates enable/disable, webhook receive | integrations-github | C | EnableLiveUpdates, DisableLiveUpdates, RecordGithubWebhookDelivery | keep ON CONFLICT claims |
| @Cron webhook delivery retention | integrations-github | J→C | PruneGithubWebhookDeliveries | |

---

## 8. Event mechanism mapping (every current event, decided)

| Today | Mechanism | New producer → consumer |
|---|---|---|
| `FileLifecycleListener` registry + `KybFileVerdictListener` | M1 | files `FileVerdictReached` → organizations `ReconcileKybOnFileVerdict` |
| `AuthorizationEventEmitter.emitUsersMeInvalidate` | M2 | authorization `UserAuthorizationChanged` → identity `InvalidateMeCacheOnAuthorizationChanged` |
| `AuthorizationEventEmitter` role/permission/userRole/userPermission channels | — | delete (D22) |
| `AuthorizationInvalidationService` (Redis `authz:invalidate`) | M2 transport | called from after-commit handlers: `UserCredentialsChanged`, `SessionsRevoked`, `UserAuthorizationChanged`, `PolicyPublished`. **D16** adds 2FA enable/rotate |
| Local-only `AccessTokenStateService.bumpTokenVersion` (2FA) | M1 + M2 | bump inside the tx; publish `UserCredentialsChanged` → cross-instance invalidation |
| Outbox `reward.platform` (checkout, auto-publish, claim expired) | M3 | mappers in pos, rewards and claims; **new actions** `reward.approved`, `reward.rejected` added to the shared payload schema |
| Outbox `session.action`, `impersonation.action` | M3 | identity mapper |
| `auth.flow` telemetry (`@TrackAuthFlow` → `recordTelemetry`) | unchanged | presentation decorator; telemetry is allowed to be non-transactional |
| Outbox `email.log.updated` | M3 | notifications mapper |
| Emails sent after commit (identity, organizations invites, claims OTP, rewards owner notices, referrals) | M3 | `EmailRequestPort` writes `EmailLog(pending)` + outbox `notification.email.requested` in the caller's tx; the dispatcher routes this type to the BullMQ `emailSend` queue (ADR 060) |
| `reward-referral.repository.ts` writing `RewardNotification` | M1 | referrals `ReferrerCredited` → claims `RecordNotificationOnReferrerCredited` |
| `signup-referral.repository.ts:insertSuccessNotificationInTx` | M1 | referrals `SignupReferralSucceeded` → claims `RecordNotificationOnSignupReferralSucceeded` |
| `files` physical delete / CDN invalidate after commit | M2 | files `FileDeleted` → after-commit handler enqueues the existing jobs (jobId dedupe keeps it safe) |
| Postgres NOTIFY `audit_trail` | unchanged | DB triggers → audit SSE |
| Postgres NOTIFY GitHub channel | unchanged | integrations-github hub |
| `email-log-events.service.ts` in-process EventEmitter for SSE | M2 | notifications `EmailLogUpdated` after-commit handler → SSE subject |

**Shared payload schema changes** (`packages/shared/src/schemas/infrastructure/outbox.ts`): add `reward.approved`, `reward.rejected` and `notification.email.requested`.
- Check whether `outbox_events.type` is a Prisma enum. If it is, adding a value is a schema change: follow §13.4 (stop, report, then `db:migrate:create` once approved).
- Update `apps/analytics-consumer` tests so the new reward actions are ingested. `notification.email.requested` is **not** published to Kafka.

---

## 9. Defect register (fix during the migration; each needs a regression test)

Every fix here was found in the code inventory. **Rule:** write the regression test **first**, against the old behaviour if you can, so it fails. Then fix. "Race test" means an e2e test that fires the two conflicting requests concurrently with `Promise.all` against real Postgres and asserts exactly one wins and the loser gets the documented error.

| ID | Where (today) | Defect | Fix | Test |
|---|---|---|---|---|
| D01 | rewards-admin approve/reject, `reward.repository.ts:approveInTransaction/rejectInTransaction` | status checked outside the tx, update is unconditional; no outbox | CAS-status `PENDING_REVIEW` in the UnitOfWork; record `RewardApproved`/`RewardRejected` → outbox actions `reward.approved`/`reward.rejected` | race: approve vs reject → one 200, one 409; unit: invalid transitions |
| D02 | `merchant-reward.service.ts:createReward` | several separate `$transaction`s, so a consumer reward can exist without its referrer child | one UnitOfWork for consumer + referrer + location scopes + link | e2e: force a failure in referrer creation (test-only adapter throwing) → no reward rows remain |
| D03 | `:updateReward` | read-then-unconditional update | CAS-status on `DRAFT\|PENDING_REVIEW` | race: update vs approve |
| D04 | `:publishReward` | two separate updates (consumer, referrer) without CAS | aggregate transitions both; repository saves both in one tx with CAS | race: double publish → one 200, one 409 `REWARD_NOT_DRAFT` |
| D05 | `rewards-admin.service.ts:updateMerchantKyb` | any → any, no lock, no audit | transition table in §7.5, lock + CAS, organization audit row in tx | unit: every forbidden transition; e2e: audit row exists |
| D06 | `merchant-kyb.service.ts:submitKyb` | audit row written outside the tx | write through scope inside the UnitOfWork | e2e: forced failure after audit → no audit row |
| D07 | `GET /claims/:claimId/qr` | GET changes state (rotates codes) | `POST`, command `IssueClaimQrCodes`; delete the GET route; update contract, api-client and web (T19) | e2e: GET → 404; POST rotates; old codes no longer validate |
| D08 | `reward-claim.repository.ts:createReservedClaim` | per-user limit counted without a lock | inside the UnitOfWork, take `SELECT … FOR UPDATE` on the **user row** (`User` id = claimant) before counting PENDING+REDEEMED claims for the reward; serialises a user's concurrent claims without a schema change | race: `maxUsePerUser=1`, two concurrent claims → one succeeds |
| D09 | OTP attempt update | unconditional increment | `UPDATE … SET attempts = attempts + 1 WHERE id = $1 AND attempts < MAX AND consumed_at IS NULL RETURNING attempts`; zero rows → `OtpAttemptsExhaustedError` | race: 10 concurrent wrong codes → attempts never exceed 5 |
| D10 | auto-publish | status not re-checked in tx; can overwrite a concurrent reject | CAS-status `PENDING_REVIEW` per reward; 0 rows → skip silently (count it in the job log) | e2e: reject between selection and publish → reward stays DRAFT |
| D11 | `rewards-admin.service.ts:runScheduledJobs` | dead code | delete | — |
| D12 | `password-reset.service.ts:resetPassword` | token consumed by id without `usedAt IS NULL` | CAS `usedAt IS NULL` | race: two resets with one token → one succeeds |
| D13 | `two-factor.service.ts:finishMfaLogin` | ignores the `consumeChallenge` CAS result; `lastTotpStep` update is unconditional | treat 0 rows as `MfaChallengeAlreadyUsedError`; update `lastTotpStep` with `WHERE last_totp_step IS NULL OR last_totp_step < $step` | race: double completion → one session issued |
| D14 | `identity.service.ts:signup` | user and default role committed separately | `DefaultRoleAssignmentPort.assignInTransaction` (today `assignToUserAtProvisioningInTx`) inside the signup UnitOfWork | e2e: role-assignment failure → no user row |
| D15 | `auth-session.service.ts:issueSessionForUser` | create session and retire stale sessions are separate writes | one UnitOfWork | unit + e2e: session cap never exceeded under 5 concurrent logins |
| D16 | 2FA enable/rotate | `bumpTokenVersion` outside tx; local-only cache invalidation | bump inside the tx; `UserCredentialsChanged` → cross-instance invalidation (M2 via existing Redis channel) | e2e: old access token rejected after enable |
| D17 | 2FA rotate | backup code checked but not consumed; non-atomic | consume (CAS) inside one tx | unit: reused backup code rejected |
| D18 | `admin-user.service.ts:unlockUser` | no audit, no invalidation | permission audit row (or the HTTP audit, plus a domain audit row in `permission_audit_logs` if that is where admin user actions go today; check `rules/10`) + `UserCredentialsChanged` | e2e: audit row exists |
| D19 | `login.service.ts` lockout | `shouldLock` computed from a stale read | single SQL: `UPDATE users SET failed_login_attempts = failed_login_attempts + 1, locked_until = CASE WHEN failed_login_attempts + 1 >= $max THEN $until ELSE locked_until END WHERE id = $1 RETURNING …` (column names: check `schema.prisma` `@map`) | race: 10 concurrent bad logins → locked exactly once, attempts counted correctly |
| D20 | `login-verification.service.ts` | GET then SETEX attempt counter | Redis `INCR` + `PEXPIRE` in a `MULTI` (or the existing redis helper's equivalent); memory fallback uses a synchronous map update | unit (memory store) + e2e (Redis) |
| D21 | permission registry sync bootstrap | fire-and-forget on every replica, no lock | `SyncPermissionRegistry` command under `pg_advisory_xact_lock`, awaited in bootstrap before `HealthService.markReady` | e2e: two app instances booting concurrently → no duplicate/failed rows |
| D22 | `AuthorizationEventEmitter` dead channels | dead code | delete | — |
| D23 | `support-access.service.ts:assertActiveReadGrant` | dead code | delete | — |
| D24 | `POST /admin/organizations/invites` | no `@Idempotent()` though clients send a key | add `@Idempotent()` | e2e: same key twice → one organization |
| D25 | team invite, merchant invite, OTP, owner notifications, password reset, etc. | email sent after commit (dual write) | `EmailRequestPort` in the caller's tx (ADR 060) | e2e: force a failure after commit-before-send is no longer possible; assert `EmailLog` + outbox row are created in the same tx as the business row |
| D26 | organization lifecycle/erasure/quota services | dead code; `requestDeletion` races | delete | — |
| D27 | `organization/repositories/store-access.repository.ts` | writes pos-owned `OrganizationTerminal`/`OrganizationApiKey` | pos `StoreClosurePort.closeStore(scope, …)` in the same tx | existing `store-closure.e2e-spec.ts` stays green |
| D28 | `stored-file.repository.ts:claimPendingForScan`, `softDeleteWithReferences` | bypass tenant/system transaction wrapper | go through the files UnitOfWork with the right actor | e2e: RLS denies cross-tenant complete |
| D29 | sample-category create | missing `@Idempotent()` (product has it) | add | e2e: idempotent replay |
| D30 | `EncryptionModule` | re-provides `OrganizationAuditService` (duplicate instance) | inject via organizations public API port `OrganizationAuditPort` | unit: module compiles with one instance |
| D31 | `TenantEncryptionService.encrypt/decrypt` | unused | delete methods and their tests; keep rewrap | — |
| D32 | `email_logs.status` (text column) | not validated when mapped | parse with the shared `EmailLogStatus` zod enum in the mapper; invalid → `CorruptAggregateStateError` | unit: unknown status rejected |
| D33 | terminal pairing-code issue | no lock | `FOR UPDATE` on the terminal row | race: two issues → last one wins, both responses valid, only the last code pairs |
| D34 | API key revoke | unconditional | CAS `revokedAt IS NULL`; replay returns success (idempotent, keep today's behaviour) | unit |
| D35 | change password | last-write-wins | CAS on `tokenVersion` loaded at start | race: two changes → one succeeds |
| D36 | start impersonation | no protection against two live sessions | lock impersonator user row; refuse if a live session exists (`ImpersonationAlreadyActiveError`) | race |
| D37 | policy simulate | 3 separate system operations | one `runSystemOperation("policy.draft.simulate", …)`; keep `policy.simulation.record` name in the registry for the audit row type if it is referenced elsewhere, else remove it from the registry (check `db:check-rls-manifest`) | e2e green |

**Unused enum values** (never set by code): Reward `EXPIRED`/`DISABLED`, RewardReferral `BLOCKED`, SupportAccessGrant `PENDING_APPROVAL`/`EXPIRED`/`DENIED`, AuthorizationPolicyStatus `PENDING_APPROVAL`/`APPROVED`/`ROLLED_BACK`, Organization lifecycle states beyond PROVISIONING/ACTIVE, AccessRequest `CANCELLED`.
- Leave them in Prisma (no schema change).
- Leave them out of the domain models.
- List them in §17 follow-ups.

---

## 10. Rate limiting (decision #51)

### 10.1 Where it lives

- **Infrastructure throttling** (requests per key per window) is presentation:
  - `ThrottlerModule` registration moves from `modules/auth/auth.module.ts` to `platform/presentation/http/security/throttling/throttling.module.ts`. It is imported once by `app.module.ts`.
  - Confirm `ThrottlerGuard` is registered as an `APP_GUARD`. If it is not, register it in `app.module.ts` **after** `AuthGuard` in the guard list, so that `request.user` exists for the principal tracker below.
- **Domain attempt limits** stay inside aggregates and are enforced with CAS:
  - OTP 5 attempts
  - POS lockout (15-minute window, 60-minute lock)
  - login lockout (5 attempts / 15 minutes)
  - MFA challenge `maxAttempts`
  - login-verification 5 attempts

### 10.2 Policy constants

Create `platform/presentation/http/security/throttling/rate-limit-policy.ts`. The policies are named, with comments, and no literal numbers appear in decorators:

| Policy | Throttler | Tracker | Limit / window | Used for |
|---|---|---|---|---|
| `CREDENTIAL` | `strict` | IP | `config.rateLimits.throttleStrictLimit` per `throttleTtlMs` (today 3–5/min literals → use the config value; where today's literal is **lower** than config, keep the lower literal as a named constant `CREDENTIAL_LOW_LIMIT = 3`) | login, signup, verify-login, reset/forgot password, 2FA verify/login, backup code, MFA recovery request, invite validate/accept, onboarding validate/complete, terminal pairing, claim OTP |
| `EMAIL_SENDING_PUBLIC` | `strict` | IP | 3 per minute (`EMAIL_SENDING_PUBLIC_LIMIT`, `EMAIL_SENDING_WINDOW_MS = 60_000`) | forgot-password, resend-verification, claim OTP, MFA recovery request |
| `EMAIL_SENDING_AUTHENTICATED` | `default` | principal | 10 per minute | member invite, admin merchant invite, admin org invite, email-preview test send |
| `AUTHENTICATED_MUTATION` | `default` | principal | `config.rateLimits.throttleDefaultLimit` | every other authenticated command (today's `{ default: { ttl: 60000, limit: 10 } }` literals) |
| `WEBHOOK` | `default` | IP | 120 per minute (`WEBHOOK_LIMIT`) | email webhook, GitHub webhook, files processing callback |
| `PUBLIC_READ` | `default` | IP | `config.rateLimits.throttleDefaultLimit` × `PUBLIC_READ_MULTIPLIER = 5` | `GET /rewards`, `GET /rewards/:id`, onboarding document status |
| `POS` | custom `PosRateLimitGuard` | API key | keep current constants (rename to named exports if literals) | `/redemptions/*` |
| `ANALYTICS_EXPORT` | custom `AnalyticsExportRateLimitGuard` | principal | keep | analytics export |

**Tracker:** extend `throttleTrackerFor` (`platform/presentation/http/...client-ip`):
- `principal` resolves to `user:<id>` when `request.user` is set, otherwise `key:<apiKeyId>` when an API-key context is set, otherwise the IP.
- `strict` always uses the IP, so credential stuffing is limited per source and not per target account.

**Decorators:** `@RateLimit(RATE_LIMIT_POLICY.CREDENTIAL)` (`security/throttling/rate-limit.decorator.ts`) wraps `@Throttle` / `@SkipThrottle` with the policy values. Replace **every** existing literal `@Throttle({...})`. Keep `@SkipAuthThrottle()` where it exists today; rename it to `@SkipCredentialThrottle()` only if all usages are updated in the same task.

### 10.3 Endpoint table (gaps marked ➕; implement all in T27)

| Endpoint | Today | Target |
|---|---|---|
| POST /auth/signup, /auth/login, /auth/verify-login, /auth/forgot-password, /auth/validate-reset-token, /auth/reset-password, /auth/resend-verification, /auth/verify-email | strict literals | `CREDENTIAL` (+ `EMAIL_SENDING_PUBLIC` for forgot/resend) |
| POST /auth/login/2fa, /auth/login/backup-code, /auth/2fa/* | strict literals | `CREDENTIAL` |
| POST /auth/mfa/recovery (+ admin review) | strict literals | `EMAIL_SENDING_PUBLIC` / `AUTHENTICATED_MUTATION` |
| POST /auth/refresh | default literal | `AUTHENTICATED_MUTATION` with IP tracker (no user yet) |
| POST /auth/change-password, PATCH /auth/profile | default (profile skips strict) | `AUTHENTICATED_MUTATION` |
| POST /auth/impersonate/:userId, /auth/stop-impersonation | ➕ | `AUTHENTICATED_MUTATION` |
| /admin/roles*, /admin/permissions* mutations | default literals | `AUTHENTICATED_MUTATION` |
| POST /policies/* | ➕ | `AUTHENTICATED_MUTATION` |
| POST /support-access/* | ➕ | `AUTHENTICATED_MUTATION` |
| POST /claims/otp | ➕ | `EMAIL_SENDING_PUBLIC` |
| POST /claims | ➕ | `CREDENTIAL` (OTP verification inside) |
| POST /claims/:claimId/qr | ➕ | `AUTHENTICATED_MUTATION` |
| POST /legal/accept, POST /reward-notifications/read | ➕ | `AUTHENTICATED_MUTATION` |
| GET /rewards, GET /rewards/:rewardId | ➕ | `PUBLIC_READ` |
| merchant `/orgs/:orgSlug/rewards*`, `/terminals*`, `/api-keys*` mutations | `@SkipAuthThrottle` (no throttle) | `AUTHENTICATED_MUTATION` (keep skipping `strict`) |
| POST /pos/terminals/pair | strict with named constants | `CREDENTIAL` (keep existing named constants) |
| POST /redemptions/validate, /redemptions/checkout | `PosRateLimitGuard` | unchanged |
| POST /orgs/onboarding/validate, /complete | ➕ | `CREDENTIAL` |
| POST /orgs/onboarding/documents/* | status throttled only | `AUTHENTICATED_MUTATION` with IP tracker (anonymous flow), status `PUBLIC_READ` |
| POST /orgs/invites/validate, /accept, /register-and-accept | ➕ | `CREDENTIAL` |
| POST /orgs/:orgSlug/members/invite | ➕ | `EMAIL_SENDING_AUTHENTICATED` |
| other `/orgs/:orgSlug/*` mutations | ➕ | `AUTHENTICATED_MUTATION` |
| POST /admin/invites, POST /admin/organizations/invites | ➕ | `EMAIL_SENDING_AUTHENTICATED` |
| other `/admin/*` mutations (rewards review, KYB, locations, geo writes/import) | ➕ | `AUTHENTICATED_MUTATION` |
| POST /files/upload-url, /files/:fileId/complete, DELETE /files/:fileId | ➕ | `AUTHENTICATED_MUTATION` |
| POST /files/processing-callback | ➕ | `WEBHOOK` |
| POST /notifications/email-preview/:key/send | ➕ | `EMAIL_SENDING_AUTHENTICATED` |
| POST /notifications/email-webhook | throttled | `WEBHOOK` |
| POST /github/webhook | ➕ | `WEBHOOK` |
| GitHub PR mutations, account link, live updates | ➕ | `AUTHENTICATED_MUTATION` |
| analytics export | custom guard | unchanged |

**Tests (T27):**
- `test/rate-limits.e2e-spec.ts`: one test **per policy**, calling a representative endpoint `limit + 1` times and asserting the last response is `429` with the ADR 016 envelope code the throttler produces today.
- One unit test per policy constant file, asserting the values are positive integers.
- Do **not** add a test per endpoint: the per-policy test plus a lint-free decorator is the contract. Add a unit test that walks controller metadata (Nest `Reflector` over every controller in `AppModule`) and asserts every `POST|PUT|PATCH|DELETE` route has either a `@RateLimit` policy or an explicit `@SkipThrottle` with a reason constant. This is how gaps stay closed after the migration.

---

## 11. N+1 prevention and proof (decision #52)

### 11.1 Rules (go into `rules/19` and `rules/25` in T48)

1. A **query handler** issues a **fixed** number of SQL statements, independent of page size:
   - one projection query (`select` with the needed relations, or a raw SQL join), plus at most a fixed number of batched `WHERE id IN (...)` lookups;
   - **never** a repository call inside `for`/`map` over rows.
2. A **command handler** loads its aggregate (root + children) in **one** query. Bulk commands (`createMany`, set-based expiry) use batched writes, never per-row `save` inside a loop. Exception: jobs that process items one transaction each by design (claim expiry, auto-publish). Those use a bounded batch size constant and one transaction per item, as today.
3. Cross-context display data (organization names, logos, user names) is fetched through a **batched read port** (`OrganizationReadPort.getDisplayData(ids: readonly string[])`), never one call per row.

### 11.2 The statement counter (T28)

- **File:** `apps/api/test/support/sql-statement-counter.ts`.
- **How it works:** wrap `pg.Client.prototype.query` with `vi.spyOn(…)` so that the **real implementation still runs** (call-through). This is instrumentation, not mocking. Prisma 7's driver adapter may not emit `$on('query')` (see the note in `prisma.service.ts`), which is why we count at the `pg` client.
- **API:** `countStatements(run: () => Promise<void>): Promise<number>` counts statements issued during `run`.
- **Ignored statements**, as they are infrastructure noise (put them in a regex constant with a comment):
  - `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT …`, `RELEASE SAVEPOINT …`
  - `SET ROLE …`, `RESET …`, `SELECT set_config(…)`
  - `SET LOCAL statement_timeout …`
- **Assertion helper:** `expectNoNPlusOne(request: (pageSize: number) => Promise<void>, seed: (rows: number) => Promise<void>)`. It:
  1. seeds 1 row and counts the statements of a page-size-1 request;
  2. seeds up to 25 rows and counts a page-size-25 request;
  3. asserts the counts are **equal**.
- **Coverage:** every list endpoint in §7 marked "N+1 test", plus every other `GET` list endpoint whose handler joins cross-context data. Put them in `test/n-plus-one.e2e-spec.ts`, grouped by context.
- **Why equal counts and not a fixed number:** the absolute count changes legitimately when a projection gains a join. Growth with page size never does.

---

## 12. Architecture lint (T10, widened in T26)

### 12.1 Changes to `packages/eslint-config/import-boundaries.js`

- Add a `CONTEXTS` list (the 14 folder names from §6.1) and build the blocks in a loop.
- Remember that every block must spread `UNIVERSAL_RESTRICTED_IMPORT_PATTERNS` (see §2.7).

| Files glob (relative to `apps/api/src/`) | Forbidden import regex | Message (short) |
|---|---|---|
| `contexts/*/domain/**` | `^@nestjs/`, `^@prisma/`, `^\.prisma/`, `^prisma$`, `^pg$`, `^bullmq$`, `^ioredis$`, `/(application\|infrastructure\|presentation)(/\|$)`, `platform/(application\|infrastructure\|presentation)(/\|$)` | "Domain is pure: no framework, no persistence, no outer layers (decision #6)." |
| `contexts/*/application/**` | `^@prisma/`, `^\.prisma/`, `^pg$`, `^bullmq$`, `^ioredis$`, `^@nestjs/(?!common$\|cqrs$)`, `/(infrastructure\|presentation)(/\|$)`, `platform/(infrastructure\|presentation)(/\|$)`, `(^\|/)prisma/` | "Application depends on ports, never adapters." |
| `contexts/*/presentation/**` | `^@prisma/`, `^\.prisma/`, `^pg$`, `/infrastructure(/\|$)`, `platform/infrastructure(/\|$)`, `(^\|/)prisma/` | "Presentation dispatches commands/queries; it never touches persistence." |
| `contexts/*/presentation/{jobs,cli}/**` | the presentation rules + `CommandBus` from `@nestjs/cqrs` via `importNames` (use `paths: [{ name: "@nestjs/cqrs", importNames: ["CommandBus"], message }]`) | "Non-HTTP entry points dispatch through SystemCommandDispatcher (decision #27)." |
| `contexts/<X>/**` (one block per context) | `(\.\./)+(<every other context>)/(domain\|application\|infrastructure\|presentation)(/\|$)` and the same for absolute `contexts/<other>/(domain\|...)` | "Import another context only through its public-api.ts (§6.4)." |
| `contexts/*/{domain,application,presentation}/**` | `(\.\./)+(<other context>)/public-api$` is **allowed**; `platform/infrastructure/persistence/prisma-base` forbidden | "PrismaBaseRepository is infrastructure-only." |
| `platform/domain/**` | same as context domain | |
| `platform/application/**` | same as context application, plus `(^\|/)contexts/` | "Platform must not depend on contexts." |
| `platform/infrastructure/**`, `platform/presentation/**` | `(^\|/)contexts/[^/]+/(domain\|application\|infrastructure\|presentation)/` | "Platform may only use a context's public-api (for the error map and security kit)." |
| `modules/**` (until T26) | n/a | after T26, add a rule that **any** file under `apps/api/src/modules/` fails lint with "modules/ was retired by the DDD migration; use contexts/". (A `no-restricted-syntax` on `Program` scoped to that glob works with core ESLint.) |

- **Fixture tests:** add `packages/eslint-config/__tests__/import-boundaries.contexts.test.*`, following the existing tests there. For **every** row, include one fixture that must fail and one that must pass.

### 12.2 Frontend

- **Mobile:** add `@workspace/api`-internal and `contexts/` server folders to the forbidden set. They are already covered by "apps never import apps"; just add a fixture proving it.
- **Next apps:** a rule that `app/**` (routes) may import from `contexts/*/` but `contexts/<a>/**` may not import `contexts/<b>/**` internals except `contexts/<b>/index.ts` (each frontend context folder gets an `index.ts` barrel). Same loop approach.

---

## 13. Testing standards for every task

### 13.1 Where tests go

- `contexts/<x>/domain/__tests__/<name>.spec.ts`: aggregates, value objects, policies. **No mocks at all.**
- `contexts/<x>/application/__tests__/<use-case>.handler.spec.ts`: handlers with **in-memory fakes** of ports (§13.3). No `vi.mock` of Prisma.
- `contexts/<x>/infrastructure/__tests__/`: mappers (pure unit) and repositories. Repository behaviour against real Postgres goes in e2e.
- `contexts/<x>/presentation/__tests__/`: controller metadata (decorators present, `@ZodResponse` count = 1), job → command mapping.
- `apps/api/test/*.e2e-spec.ts`: unchanged location. New e2e files from this plan (`rate-limits`, `n-plus-one`, the `*-race` files) go here.

### 13.2 Minimum cases per kind (edge cases the owner asked for)

| Kind | Must include |
|---|---|
| Aggregate | every allowed transition; **every** forbidden transition (table-driven over the status enum); boundary values (TTL at `now`, `now − 1ms`, `now + 1ms`; quantity 0/1/max); events recorded exactly once; `rehydrate` rejects corrupt state; `pullEvents` clears |
| Value object | valid values; each invalid class (empty, too long, wrong format, whitespace, unicode lookalikes for codes/emails where the shared schema already rejects them); equality |
| Policy | each rule true/false; combination cases (e.g. store-limited actor + ALL_LOCATIONS reward) |
| Command handler | happy path; authorization denied (port throws) → nothing saved; domain error → nothing saved and UnitOfWork rolled back (fake records "rolled back"); concurrency (repository fake throws `ConcurrentModificationError`) → propagates; events collected; correct actor passed to UnitOfWork; soft-deleted target → not found; cross-tenant id → not found (never "forbidden", so existence isn't leaked, matching today's 404 behaviour) |
| Query handler | empty result; pagination boundaries (first/last page, cursor at end); filters each on/off; actor scope (store-limited sees only its stores); soft-deleted rows excluded |
| Job / cron | dispatches the right command with a system actor; failure rethrows (BullMQ retries) and is audited |
| Controller | decorators unchanged (snapshot of metadata keys); one `@ZodResponse` |
| e2e (new) | race tests from §9; rate-limit tests; N+1 tests; QR POST |

### 13.3 Fakes

- Put shared fakes in `apps/api/src/platform/application/__tests__/fakes/`:
  - `InMemoryUnitOfWork<TScope>`: runs `work(scope)` and records committed/rolled-back state.
  - `FixedClock`
  - `RecordingEventCollector`
  - `FakeAuthorizationPort` and `FakeMerchantAccessPort`: configurable allow/deny.
- Put per-context fakes in `contexts/<x>/application/__tests__/fakes/`, e.g. `InMemoryRewardRepository` implementing the domain repository interface with CAS semantics on `concurrencyToken`.
- Fakes are **real implementations of the port**, not `vi.fn()` stubs. That is how we avoid "mocking the thing under test".

### 13.4 If a schema change becomes necessary

1. Stop and report (§0.2).
2. Once approved: edit `schema.prisma` → `pnpm db:migrate:create` → review the generated SQL (never hand-write it) → `pnpm db:generate`.
3. Seed **every** new column in `apps/api/prisma/seed/` (repository rule).
4. Re-run `pnpm db:check-rls-manifest` and the RLS tests.

---

## 14. Frontend work (T29–T36)

### 14.1 `packages/shared` contract split (T29)

- New folders: `packages/shared/src/contexts/<context>/{contract.ts,schemas/…}`.
- **Move schemas:**

  | From | To |
  |---|---|
  | `schemas/auth/*` | `contexts/identity/schemas/` |
  | `schemas/domain/rbac` | `contexts/authorization/schemas/` |
  | `schemas/domain/organization` | `contexts/organizations/schemas/` |
  | `schemas/domain/rewards` | split by owner (§6.2): claim → claims; sale/redemption/terminal/api-key → pos; referral → referrals; the rest → rewards |
  | `schemas/domain/signup-referrals` | `contexts/referrals/schemas/` |
  | `schemas/domain/catalog` | `contexts/catalog/schemas/` |
  | `schemas/domain/github` | `contexts/integrations-github/schemas/` |
  | `schemas/domain/platform/` api-keys | pos |
  | `schemas/domain/platform/` audit-trail, data-change-log | audit |
  | `schemas/domain/platform/` geo | reference-data |
  | `schemas/domain/platform/` events, clicks | reporting |
  | `schemas/domain/platform/` enums | the owner of each enum |
  | `schemas/email/*` | `contexts/notifications/schemas/` |

  `schemas/{api,infrastructure,runtime}` stay where they are (cross-cutting).
- **Barrels:** `schemas/index.ts` and `src/index.ts` keep re-exporting **every** symbol under the **same name**. The single `@workspace/shared` entry point is unchanged.
- **Move contracts:** `contracts/index.ts` keeps exporting `apiContract`, but builds it from per-context pieces. Each context's `contract.ts` exports its group objects, e.g. `export const claimsContract = { … }`, and `organizationRewardsContract` for the nested `organizations.rewards`.
  - Group key → context follows §7 (the backend owner of the endpoint).
  - Nested groups are composed in `contracts/index.ts`: `organizations: { ...organizationsContract, rewards: organizationRewardsContract, … }`.
  - Shared helpers (`client-session`, `response`, `versioning`, `idempotency`, `mutation-intent`, `path-param`) stay in `contracts/`.
- **`api-routes.ts`:** split the same way into `contexts/<x>/routes.ts`, recomposed in `api-routes.ts` with identical keys and values.
- **Snapshot test (written FIRST, in T01):** `packages/shared/src/contracts/__tests__/api-contract-shape.test.ts`.
  - It walks `apiContract` and `apiRoutes` and produces a sorted list of `"<dotted.key> <METHOD> <path>"`.
  - It also lists every export name of `@workspace/shared`.
  - It compares both lists to committed inline snapshots.
  - **Only T19 may change it**: `claims.qr` GET → POST, and the new `claims.get` entry.
- **Why:** decision #15. The layout changes, the surface doesn't, and the test proves it.

### 14.2 `packages/api-client` (T19, T29)

- `claims.qr`: `defineQuery` → `defineMutation` (T19). Keep the name `qr`.
- On success, invalidate scope `["claims", claimId]`-family keys per the existing `query-cache` helpers.
- No other router changes. The router is generated from `apiContract`, so the split in T29 is transparent.

### 14.3 Web apps (T31–T33)

The new structure in each app is `contexts/<context>/{components,hooks,forms,tables,url-state,lib}/` plus `index.ts`. Moves:

| App | From | To context |
|---|---|---|
| web | `components/dashboard/browse`, `lib/rewards` (featured offers), `app/rewards` views | `contexts/rewards` |
| web | `components/dashboard/claims`, wallet views | `contexts/claims` |
| web | dashboard referrals and activity views | `contexts/referrals` (activity → `contexts/reporting` if it reads analytics, else claims) |
| web | `components/auth`, `lib/auth`, account views | `contexts/identity` |
| admin | `app/(panel)/users/*` smart components, `components/users`, `components/security`, `lib/permissions`, `components/access` | `contexts/identity` (users, security) and `contexts/authorization` (roles/permissions/policies/access) |
| admin | `app/(panel)/merchants/*`, `lib/merchants` | `contexts/organizations` |
| admin | `app/(panel)/rewards/*`, `lib/rewards` | `contexts/rewards` |
| admin | `app/(panel)/audit-logs/*`, `components/audit-logs`, `lib/audit` | `contexts/audit` |
| admin | `app/(panel)/emails/*`, `components/email`, `lib/notifications` | `contexts/notifications` |
| admin | `app/(panel)/geography/*` | `contexts/reference-data` |
| admin | `app/(panel)/analytics/*`, `components/analytics`, `lib/analytics` | `contexts/reporting` |
| admin | `app/(panel)/catalog/*`, `components/catalog`, `lib/catalog` | `contexts/catalog` |
| merchant | `components/rewards`, `lib/rewards` | `contexts/rewards` |
| merchant | `components/redemptions`, `lib/redemptions`, `components/terminals`, `lib/terminals`, `components/api-keys`, `lib/api-keys`, `lib/pos` | `contexts/pos` |
| merchant | `components/org`, `lib/org`, `components/onboarding`, `components/team-invite`, `lib/team-invite` | `contexts/organizations` |
| merchant | `components/analytics`, `lib/analytics` | `contexts/reporting` |

- **Stay where they are:**
  - `app/` (routes), `lib/{env,navigation,session,server,palette,ui-preferences,url-state (generic helpers only),routes.ts}`
  - `components/{layout,loading,common,impersonation,merchant-ui,web-ui,component-gallery,showcase,dashboard,settings,account}`
  - Exception: `account` → identity, if it holds identity forms.
- `lib/url-state/<feature>.ts` → `contexts/<context>/url-state/`.
- `apps/merchant/features/tenant-context/` stays (feature store, decision #17).
- **Pages:** `page.tsx` files keep their route locations and import the smart view from `contexts/<x>`.

**Admin co-located smart components:** move every non-route file under `app/(panel)/<area>/` (anything that is not `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, `default.tsx`, `template.tsx`, or `__tests__/`) into `contexts/<context>/components/`.
- Move the tests with them, into `contexts/<context>/components/__tests__/`.
- If a component is used by two contexts, it is not domain code: move it to `components/common/`.

### 14.4 `packages/client` (T34)

- `src/lib/auth` → `src/lib/contexts/identity`
- `src/lib/merchant` → `src/lib/contexts/organizations`
- `src/lib/rewards` → `src/lib/contexts/rewards`
- `src/lib/features/*` stays (feature stores).
- Update `package.json` `exports` entries so **public import paths stay the same**: add new deliberate entry points and keep the old paths as aliases to the new files. Don't break app imports in this task; update the app imports, then remove the aliases in the same task once nothing uses them.

### 14.5 Mobile (T35)

- **Domain folders move to `src/contexts/`:**
  - `src/features/{auth,two-factor,devices,profile}` → `src/contexts/identity/`
  - `till` → `src/contexts/pos/`
  - `github`, `github-pull-requests` → `src/contexts/integrations-github/`
  - `analytics` → `src/contexts/reporting/`
- **These stay in `src/features/`** (runtime/UI): `session`, `preferences`, `app-lock`, `app-shell`, `app-drawer`, `navigation`, `toast`, `pdf-viewer`, `app-status`, `component-gallery`.
- Screen tests remain in `src/__tests__/app` (`rules/04`).
- **No behaviour changes. No API changes:** mobile does not call `claims.qr` (decision #50).

### 14.6 The QR change in web (T19)

- `app/dashboard/wallet/[claimId]/page.tsx` must **not** call the command during server render. A write during render is exactly the problem: link prefetching and re-renders would rotate codes.
- **Server render** (the page stays SSR, decision #59):
  1. Validate `claimId` with the router's input schema (keep).
  2. Prefetch **`claims.get`** through `createWebServerCaller().claims.get.query(...)` with the existing `settleServerQuery` pattern (same `expected` outcomes as today).
  3. Render the claim card (reward title, status, expiry, store) into the HTML.
  4. In the QR slot, render a sized QR skeleton.
- **`ClaimQrView`** (client):
  - Receives the prefetched claim as `initialData` for `api.claims.get.useQuery`.
  - Calls `api.claims.qr.useMutation()` once on mount, **only if the claim is PENDING**. Guard it with a `useRef` flag so React StrictMode's double-mount does not rotate twice.
  - Renders the returned codes in place of the skeleton.
  - Keeps a "Refresh code" button that calls the same mutation.
  - Handles the error states it already handles: unauthenticated, forbidden, not-found → "Claim unavailable".
- `lib/navigation/route-access.ts` keeps the same page route. Update it only if it references the API path.
- Update `page.test.tsx` and `qr-view.test.tsx` for the new flow:
  - the server render prefetches `claims.get` and the HTML contains the claim card
  - a server render never calls `claims.qr`
  - no mutation call when the claim isn't PENDING
  - mutation called once on mount
  - refresh calls again
  - StrictMode double-mount → called once
  - error → unavailable view

---

## 15. Documentation and ADRs (T47–T48)

- **ADR 058:** `docs/adr/058-ddd-modular-monolith-bounded-contexts.md`
  - Decisions 6, 7, 12, 19, 21, 23–26, 28, 30, 33, 41, 42, 46.
  - Record the **zod-in-domain deviation from §spec-5.1** with the owner's reason.
- **ADR 059:** `docs/adr/059-selective-cqrs-and-event-mechanisms.md`
  - Decisions 3, 4, 11, 22, 27, 32, 38, 39, 45, 51, 52, plus the performance decisions 53–70.
  - Record the uncached-fonts trade-off from decision #62.
- **ADR 060:** `docs/adr/060-durable-email-through-outbox.md`
  - Decision 44: the `notification.email.requested` route to BullMQ, the idempotency key (`email-log/<id>`, reused from today), the inline fallback when Redis is disabled (the outbox dispatcher calls the existing inline delivery path), and retention (same as the other outbox rows).
- **Superseded or amended ADRs.** Edit only the header: add `Status: superseded in part by ADR 05x — <one line>`. Don't rewrite history.
  - **017** (request context): ALS is infrastructure-only; application and domain receive `ActorContext`.
  - **026** (kernel-first authorization): resource-level checks move to handlers through `AuthorizationPort`; the guard remains the coarse filter.
  - **015** (outbox): extended by 060.
  - Any ADR that names `modules/<x>` paths: add one line pointing to the new context path.
- **Context map:** `docs/architecture/context-map.md` = §6.3 + a Mermaid diagram.
- **Glossary:**
  - Root `GLOSSARY.md` (the domain glossary): add context-scoped terms. Claim, Sale, Referral credit, KYB decision, Terminal pairing and Store closure are each defined by the context that owns them.
  - `rules/22-glossary.md`: the §3 terms.
- **Rules rewrite (T48):**
  - **01:** fix the monorepo map (no `packages/contracts`, `packages/database`, `packages/observability`; real `packages/shared`, `apps/api/prisma`). Add `contexts/` and `platform/`, and the context-boundary rules.
  - **02:** layering, handler shape, UnitOfWork, ActorContext, controllers dispatch commands and queries, the three event mechanisms, jobs through `SystemCommandDispatcher`.
  - **19:** the N+1 rules and statement counter.
  - **21:** aggregates, ports, no base classes except `PrismaBaseRepository` and `AggregateRoot`.
  - **23:** the §4.4 decision tree.
  - **24:** rewrite **from real code** (T13): the sample-category application-service path and the reward lifecycle CQRS path, with file links.
  - **25:** anti-patterns: business `if` in a handler, Prisma in application, cross-context internal import, N+1 loop, unthrottled public endpoint, email after commit, `GET` that writes.
  - **10, 11:** link to the authorization split and the §13 test standards.
- **`AGENTS.md`:** update the routing table: add rows for "Adding a command or query", "Cross-context interaction", "Domain events" → rules 02/21/23 and ADRs 058–060.
- **`.cursorrules`:** replace its content with a 10–15 line pointer: read `AGENTS.md` first, `rules/` is the source of truth, and the completion gate. **Why:** decision #28.
- **`docs/technical/**`:** grep for `modules/` paths and update every reference. Add the new docs to `docs/README.md` and `docs/meta.json` following their existing entry format.

---

## 16. Ordered task list

**Conventions:**
- **Gate** = the §0.3 loop. `+tc` = also run `pnpm run typecheck`. `+e2e` = also run `pnpm test:e2e`.
- **Moving files:** use `git mv` so history follows the file, then fix imports. After each move, run `rg "<old path fragment>" apps packages` and confirm zero hits outside `docs/adr/` history.
- **Every context migration task** (T11–T25) has the same **definition of done**:
  - [ ] Every row of that context in §7 is implemented with the stated Type, name, concurrency guard and events.
  - [ ] Every D-xx tagged on those rows is fixed with its §9 test.
  - [ ] Every model in §6.2 owned by the context is touched only by its `infrastructure/`.
  - [ ] The context's `public-api.ts` exports only §6.4 items.
  - [ ] Old files under `modules/<x>` are deleted (not left as re-export shims).
  - [ ] Tests follow §13; old specs are moved and rewritten, never deleted without a replacement covering the same behaviour.
  - [ ] Routes, decorators and response shapes are unchanged (except D07). `rg "@Controller\(" contexts/<x>` lists the same route prefixes as before.
  - [ ] Gate `+tc +e2e` green.

### Phase A: foundations

**T01: Baseline and safety nets**
- **Read first:** `AGENTS.md`, `rules/00`, `rules/11`, `packages/shared/src/contracts/index.ts` (skim), `apps/api/vitest.config.e2e.ts`, `apps/api/test/support/*`.
- **Do:**
  1. Create branch `refactor/ddd-cqrs` from `main`.
  2. Run the full gate `+tc +e2e` and record the pass counts in the PR description draft (baseline).
  3. Add the contract snapshot test (§14.1).
  4. Add `test/support/sql-statement-counter.ts` and `expectNoNPlusOne` (§11.2), with a self-test in `test/support/__tests__/sql-statement-counter.spec.ts` that issues known queries through a scratch connection (follow `scratch-database.ts`).
- **Why first:** the snapshot and the counter are the nets that catch accidental contract changes and N+1 regressions in every later task.
- **Gate:** `+tc +e2e`.

**T02: Install `@nestjs/cqrs`**
- **Do:**
  1. `pnpm --filter @workspace/api add @nestjs/cqrs@^12.1.0`.
  2. Read `node_modules/@nestjs/cqrs/dist/index.d.ts` and the `Command`, `Query`, `ICommandHandler`, `IQueryHandler`, `EventBus` and `EventsHandler` typings. Note in the PR whether `ICommandHandler`/`IQueryHandler` take a result type parameter (§5).
  3. Import `CqrsModule.forRoot()` once in `app.module.ts`.
- **Tests:** `apps/api/src/platform/application/__tests__/cqrs-typing.spec.ts`. A tiny `PingCommand extends Command<"pong">` with a handler proves `execute` infers `"pong"`. This test documents the typing for juniors.
- **Gate:** `+tc`.

**T03: Create `platform/` and move technical code (no behaviour change)**
- **Do:** `git mv`, following §4.1:
  - `platform/persistence` → `platform/infrastructure/persistence`
  - `platform/idempotency` → `platform/infrastructure/idempotency`
  - `infrastructure/{outbox,kafka,jobs,redis,queue,database}` → `platform/infrastructure/…`
  - `common/audit` → `platform/infrastructure/audit`
  - `common/{context,tenancy,crypto,http}` → `platform/infrastructure/…`
  - `common/errors` → split: `error-codes.ts` → `platform/domain/errors/`; error classes → `platform/application/errors/`; the filter → `platform/presentation/http/errors/`
  - `common/decorators` (zod) and `common/pipes` → `platform/presentation/http/validation/`
  - `common/interceptors` → `platform/presentation/http/interceptors/`
  - `common/dto`, `common/api-docs*` → `platform/presentation/http/`
  - `modules/storage` → `platform/infrastructure/storage`
  - `modules/logs` → `platform/infrastructure/logging`
  - `modules/health` → `platform/presentation/http/health`
  - `modules/encryption` → `platform/infrastructure/encryption`
  - `messaging/` → `platform/infrastructure/messaging/`
- Split into several commits if it helps review, but keep it in one task.
- **Not moved:** `prisma/`, `config/`, `bootstrap/` (§4.1 explains why).
- **Gate:** `+tc +e2e`.

**T04: `ActorContext`, system operation names, `@CurrentActor()`**
- **Do:** implement §5.1:
  1. Extract the system operation names.
  2. Build `actor-context.factory.ts` and `@CurrentActor()`.
  3. Add `systemActor()`.
- **Tests:**
  - Factory: user, impersonating user, API key with and without terminal, anonymous, missing session → `UnauthenticatedError`.
  - `systemActor` validates the operation name.
- **Gate:** standard.

**T05: Errors**
- **Do:** implement §5.2. Add the `DomainError` branch and the status map to `GlobalExceptionFilter`.
- **Tests:**
  - The map covers all codes.
  - The filter renders the ADR 016 envelope for a sample `DomainError` (unit, Fastify reply fake from `test/support/fake-reply.ts`).
- **Gate:** standard.

**T06: Aggregates, events, clock, UnitOfWork, dispatcher, registry**
- **Do:** implement §5.3, §5.4 and §5.6:
  - `PrismaUnitOfWork`
  - `PrismaReadExecutor`
  - `actor-to-rls-context.ts`
  - `TransactionalEventCollector`
  - `TransactionalEventDispatcher` (with `MAX_IN_TRANSACTION_EVENT_ROUNDS`)
  - `InTransactionEventRegistry`
  - `bindInTransactionHandler`
  - the after-commit publish
  - an `IntegrationEventMapper` registry, where each context registers its mapper in `onModuleInit`
- **Tests:**
  - Unit with fakes:
    - order of operations (in-tx handlers before outbox, publish after commit)
    - rollback publishes nothing
    - loop guard
    - a handler adding events is processed in the next round
  - e2e: `test/unit-of-work.e2e-spec.ts` against real Postgres, with a scratch outbox row:
    - commit writes business row + outbox row
    - a thrown error leaves neither
    - RLS context is applied (reading another tenant's row returns nothing)
- **Gate:** `+e2e`.

**T07: `PrismaBaseRepository`; delete `BaseService`**
- **Do:**
  - Implement §5.5.
  - Product and sample-category keep working through a temporary direct use, until T11 rewrites them in the same PR.
  - Delete `base.service.ts` only in T11. In this task, mark nothing as deprecated; just refactor the repository.
- **Tests:** the existing `base.repository` specs are moved and adapted. Add:
  - inside an outer transaction, `createMany` does not open a nested `$transaction`
  - rollback of the outer transaction undoes it
- **Gate:** `+e2e`.

**T08: `SystemCommandDispatcher`, command audit, authorization ports**
- **Do:**
  - Implement §5.8 and the audit port adapter.
  - Declare the `AuthorizationPort` and `MerchantAccessPort` interfaces in `platform/application/ports/authorization.port.ts` **temporarily**. They move into the authorization and organizations `public-api.ts` in T17/T18. This keeps T11/T12 unblocked. Leave a `// moved in T17/T18` note only in the PR description, not in code.
- **Tests:**
  - success writes one audit entry
  - failure writes one entry and rethrows
  - redaction is applied (a payload with a `password` field is redacted)
- **Gate:** standard.

**T09: HTTP security kit**
- **Do:** `git mv` the global guards and shared decorators into `platform/presentation/http/security/`:
  - guards: `AuthGuard`, `RestrictedSessionGuard`, `MobileAppVersionGuard`, `ApiKeyAuthGuard`, `AuthorizationGuard`, `RefreshTokenGuard`
  - decorators: `RequirePermission`, `Authorize`/`self`, `Public`, `RlsBypass`, `GetUser`, `CurrentUser`, `AdminAccessOnly`, `SuperAdminOnly`, `SkipMutationIntent`, `SkipAuthThrottle`, `AllowApiKeyAuth`, `GetMerchantActor`, `EmailVerified`, `RequiresFullSession`, `TrackAuthFlow`
  - interceptors: `MerchantActorInterceptor`, `SetAuthCookiesInterceptor`, `ClearAuthCookiesInterceptor`
  
  The implementations keep calling the old services for now. The security kit's guards may import context `public-api.ts` files once those exist (T16–T20 switch them). Move the throttling module too (§10.1). Keep `app.module.ts`'s guard **order** exactly.
- **Tests:** move the existing guard and decorator specs. Add a test asserting the `APP_GUARD` order.
- **Gate:** `+e2e`.

**T10: Architecture lint rules**
- **Do:** §12.1 for `contexts/**` and `platform/**`, plus fixture tests. Contexts don't exist yet, so the fixtures prove the rules.
- **Gate:** standard.

### Phase B: reference implementations

**T11: catalog (application-service path)**
- **Read first:** `modules/product/*`, `modules/sample-category/*`, `platform/infrastructure/persistence/*`.
- **Do:**
  1. Create `contexts/catalog/`:
     - `domain/`: `Product` and `SampleCategory` entities with their invariants (sku/slug uniqueness stays a DB rule; the version is carried as the concurrency token).
     - `application/services/{product,sample-category}.application-service.ts`: every method takes `actor` first and uses `CATALOG_UNIT_OF_WORK`. Cascade soft delete runs in one transaction.
     - `infrastructure/persistence/` repositories on `PrismaBaseRepository`.
     - `presentation/http/` controllers: same routes and decorators.
  2. Apply **D29**.
  3. Delete `base.service.ts`.
- **Why first:** it is the smallest complete slice. Every later task copies its layering.
- **Gate:** `+e2e`.

**T12: rewards (CQRS path), in three commits**
- **T12a domain:**
  - The `Reward` aggregate (with the referrer child as an entity), value objects (`MinorUnits`, `RewardRules`, `RewardValue`, `MerchantLocationScope`), events (`RewardCreated`, `RewardRevised`, `RewardSubmittedForReview`, `RewardApproved`, `RewardRejected`, `RewardAutoPublished`), errors and policies.
  - Exhaustive domain tests (§13.2).
- **T12b application + infrastructure:**
  - Every rewards row in §7.1.
  - The scope factory, repository with CAS on `concurrencyToken`, read repository, outbox mapper (`reward.platform` actions incl. new `reward.approved`/`reward.rejected`) and the `RewardInventoryPort` / `RewardAuditPort` transactional factories (consumed in T19/T20).
  - The handlers use the temporary `MerchantAccessPort` from T08, implemented here by an adapter over the existing `OrganizationRewardAuthService` (moved to organizations in T18).
- **T12c presentation:** controllers (organization rewards, admin rewards review, consumer marketplace, legal) and the auto-publish job through `SystemCommandDispatcher`.
- **Fix:** D01–D04, D10, D11.
- **Gate:** `+tc +e2e`.

**T13: Reference docs from real code**
- **Do:**
  - Rewrite `rules/24` using T11 and T12 files.
  - Add the §4.4 tree to `rules/23`.
  - Write a short `contexts/README.md` (layout template §4.2 + links).
- **Why now:** every later context task copies these. The docs must match the code they point to.
- **Gate:** standard (lint covers markdown only if configured; run it anyway).

### Phase C: remaining contexts

Each task: the §16 definition of done.

**T14: files**
- Implement §7.8 (files rows): `FileVerdictReached` (M1), `FileDeleted` (M2), `FileReferencePort`, `FileReferenceGuard` and `FileCategoryAccessRegistry` registrations.
- Move the binding tables' knowledge out of `stored-file.repository.ts`: KYB/product/asset/avatar methods move to their owners in T11 (product images, done there if reached, else here via catalog), T16 (avatar), T18 (KYB, assets) and T12 (reward images).
- Until each owner migrates, keep the owner-specific methods in a **files-internal** `legacy-binding.adapter.ts` that implements the owner's guard. Delete it when the last owner has migrated (check in T26).
- Fix D28.
- The verdict listener for KYB is re-registered by organizations in T18. Until then, register the existing listener logic as an in-transaction binding from the old rewards module.

**T15: notifications + durable email (ADR 060 implementation)**
- Implement:
  - the EmailLog aggregate (forward-only status table `ALLOWED_FROM`, kept)
  - `EmailRequestPort` (transactional)
  - the outbox route `notification.email.requested` → `emailSend` queue, with the inline fallback when the queue is disabled
  - the delivery webhook command (D32)
  - the `DeliverEmail` job
- Switch **all** existing `EmailSenderService.send` callers to `EmailRequestPort` **in the same tx as their business write** (D25). Old modules that are not migrated yet call it through notifications' public API.
- **Tests:**
  - e2e: business row + EmailLog + outbox row commit together; rollback leaves none.
  - The queue job is idempotent on redelivery (jobId = emailLogId, kept).

**T16: identity, in four commits**
- **(a)** UserAccount, credentials, signup, login, lockout, email verification, password reset/change, unlock. Fixes: D12, D14, D18, D19, D35.
- **(b)** TwoFactorEnrollment, login challenges, new-device verification, MFA recovery and its cron. Fixes: D13, D16, D17, D20.
- **(c)** DeviceSession (refresh, logout, revoke, list) and `IdentitySessionsPort` (implemented here; consumed by authorization in T17). Fix D15.
- **(d)** Impersonation (D36), own profile, superadmin bootstrap CLI, `GetMe`/permissions queries, admin user queries (batched referral summary).
- Then delete `modules/{auth,sessions,impersonation}` except `auth/signup-referrals` (moves in T21) and `AccessTokenModule` if it is no longer imported.
- Switch the security kit to identity's `public-api.ts`.

**T17: authorization**
- Implement §7.7, `RbacMutationScope`, `AuthorizationPort` + `DefaultRoleAssignmentPort` in the public API (move the T08 temporary interface here), the Cedar policy plane (D37), support access (D23), bootstrap sync commands (D21), and the cleanup crons.
- Replace `AuthorizationEventEmitter` with `UserAuthorizationChanged` (M2) and delete the dead channels (D22).
- Delete `SessionsPersistenceModule` once unused.
- **Test:** RBAC change revokes sessions **in the same transaction**. Force an audit-write failure: no role change and no revocation.

**T18: organizations**
- Implement §7.5:
  - KYB with `ReconcileKybOnFileVerdict` (M1, replacing the T14 bridge) and D05, D06
  - onboarding, invites, access requests, locations with `StoreClosurePort` usage (D27; the port is implemented in T20; until then call a temporary adapter in the old rewards code; T20 swaps it)
  - provisioning (D24)
  - `MerchantAccessPort` in the public API (move the T08 temporary interface here)
  - `OrganizationReadPort` (batched)
  - `MerchantPosSettingsPort`
  - `OrganizationAuditPort` (D30)
  - `AccountProvisioningPort` consumption
- Delete the dead services (D26).

**T19: claims + the QR API change**
- Implement §7.2, including the M1 notification handlers. Fix D08 and D09.
- **D07, end to end in this task:**
  1. Backend: `POST /claims/:claimId/qr`. Delete the GET route. Add the new query route `GET /claims/:claimId` (`GetMyClaim`, §7.2). It's a read, so the global `default` throttler applies with no `@RateLimit` decorator.
  2. `packages/shared`: `claims.qr` method POST, plus the new `claims.get` contract and route. **Update the snapshot test**: these two entries are the only allowed snapshot changes.
  3. `packages/api-client`: `claims.qr` → `defineMutation`; new `claims.get` → `defineQuery` with scope `["claims", "detail", claimId]`.
  4. `apps/web`: §14.6.
  5. **Verify mobile has no caller:** `rg -n "claims\.qr|/qr\b" apps/mobile/src`. Expect zero; if not, stop (§0.2).
  6. Update `test/*.e2e-spec.ts` that call the GET. This is the only allowed e2e assertion change: method only.

**T20: pos**
- Implement §7.3:
  - checkout as one UnitOfWork over `ClaimRedemptionPort` (T19), `RewardInventoryPort` (T12), `ReferralCreditPort` (T21; until then the existing signup-referral checkout service is wrapped in a temporary adapter implementing the port, swapped in T21), `RewardAuditPort`
  - validate with lockout
  - terminals and pairing (D33)
  - API keys (D34)
  - `ApiKeyVerificationPort` used by the security kit guards
  - `StoreClosurePort` (swap the T18 temporary adapter)
- Delete `modules/api-keys`.
- **Keep `pos-checkout.e2e-spec.ts` assertions identical.**

**T21: referrals**
- Implement §7.4. Move `modules/auth/signup-referrals`. The crons and the BullMQ sweeper go through `SystemCommandDispatcher`.
- `ReferralCreditPort` replaces the T20 temporary adapter.
- `SignupReferralPort` is consumed by identity signup (swap from the T16 direct call).

**T22: reporting**
- Move rewards analytics (queries, renderers, export guard, SQL runner).
- Reorganise `apps/analytics-consumer/src` into `projections/` + `infrastructure/`, with the logic unchanged. Add the new reward actions to its fixtures.

**T23: audit**
- Queries over the audit tables, the SSE stream, and the sensitive-read audit (kept).

**T24: reference-data**
- `GeographyApplicationService` (simple path). The cascade and import advisory lock are kept.
- Add the unit tests that are missing today: geo had 0 unit specs. Cover cascade rules, import validation and natural-key upsert.

**T25: integrations-github**
- An anti-corruption layer: GitHub API DTOs are mapped to our own read models in infrastructure, and never cross into application types.
- Commands and queries per §7.8. Keep the idempotency decorators, the webhook dedupe and the LISTEN hub.

**T26: retire `modules/`**
- **Do:**
  1. `apps/api/src/modules/` must be empty. Delete it.
  2. Add the "no files under modules/" lint rule (§12.1).
  3. Delete every temporary adapter introduced in T14/T18/T20 (`rg -n "legacy|temporary" apps/api/src/contexts` must return nothing).
  4. Delete `AccessTokenModule` / `SessionsPersistenceModule` if not already gone.
  5. Confirm `rg -n "forwardRef" apps/api/src` returns nothing new compared to the T01 baseline.
- **Gate:** `+tc +e2e`.

### Phase D: cross-cutting verification

**T27: Rate limiting** (§10). Policies, decorator, tracker, every gap closed, controller-metadata coverage test, `rate-limits.e2e-spec.ts`. **Gate:** `+e2e`.

**T28: N+1 assertions** (§11). An `n-plus-one.e2e-spec.ts` covering every list endpoint marked in §7 and every cross-context list. Fix any growth found by batching through read ports. **Gate:** `+e2e`.

### Phase E: frontend

**T29: Contract split in `packages/shared`** (§14.1). Snapshot test unchanged. **Gate:** `+tc`.

**T30: Frontend lint rules** (§12.2) with fixtures. **Gate:** standard.

**T31: web regroup** (§14.3). **Gate:** `+tc`.

**T32: admin regroup** (§14.3). **Gate:** `+tc`.

**T33: merchant regroup** (§14.3). **Gate:** `+tc`.

**T34: `packages/client` regroup** (§14.4). **Gate:** `+tc`.

**T35: mobile regroup** (§14.5). **Gate:** `+tc` + `pnpm --filter @workspace/mobile test`.

**T36: Frontend verification**
- `rg` for any import of `apps/api` or `contexts/*/(domain|application|infrastructure)` from client packages: expect none.
- Build all Next apps: `pnpm --filter @workspace/web build`, and the same for admin and merchant.
- **Gate:** `+tc`.

### Phase E2: startup and bundle performance (§19)

**T40: Measure the baseline**
- **Do:** build `pnpm dev:timing` (§19.1). Run it 3× cold and 3× warm and record the medians in `rules/19` and the PR description.
- **Gate:** standard.

**T41: Dev scripts**
- **Do:**
  - `dev` watch scripts for `shared`, `messaging` and `api-client` (§19.2).
  - Remove `--force` from the docs `dev` script.
  - Keep `dependsOn: ["^build"]`, keep `pnpm dev` booting everything, keep Kafka and RabbitMQ in `.env.example`.
- **Gate:** standard, plus a manual check: edit a schema in `shared` while `pnpm dev` runs; the API restarts with the change.

**T42: API boot**
- **Do:** §19.3.
- **Gate:** `+e2e`.
- **Also:** re-run `pnpm dev:timing` and record the API boot number.

**T43: Next lazy loading, all pages SSR**
- **Do:**
  - §19.4: the allowlist constant and its lint rule, every lazy item, and `LazyMotion`.
  - Add the analyzer to merchant.
- **Gate:** `+tc` + all three Next builds.

**T44: Mobile startup**
- **Do:** §19.5.
- **Gate:** `+tc` + `pnpm --filter @workspace/mobile test` + the mobile `expo export` build.

**T45: Bundle budgets**
- **Do:**
  - §19.6: the script, the committed `bundle-budgets.json` (baseline + 10%), and the CI step in `.github/workflows/ci.yml`.
  - Prove the gate works by adding a temporary eager recharts import to a layout **in a scratch commit you do not push**. CI-equivalent locally: run the script and see it fail. Then drop that commit.
- **Gate:** standard + the budget script exit 0.

**T46: Verify the targets**
- **Do:** re-run `pnpm dev:timing` and compare against the T40 targets (decision #54).
- If a target is missed, report the phase, the numbers, and the top three boot phases from the API `markPhase` log. **Do not** add caches or skip work to hit a number (decisions #55 and #62).
- **Gate:** standard.

### Phase F: documentation and final verification

**T47: ADRs 058, 059, 060 + supersede headers** (§15).

**T48: rules, AGENTS.md, `.cursorrules`, glossary, context map, `docs/technical` path updates** (§15).

**T49: Final verification**
- **Run, from a clean install** (`pnpm install --frozen-lockfile`):
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm test:e2e`
  - `pnpm db:check-rls-manifest`
  - every app's build
- **Compare against the T01 baseline:**
  - Test counts must be ≥ baseline. Unit tests should be well above, because of §13.
  - The e2e files are the same set plus the new ones.
- **Fill in the report template (§18.2).**

---

## 17. Risks and follow-ups

### 17.1 Migration risks and their mitigations

| Risk | Mitigation |
|---|---|
| RLS context mapping wrong in `PrismaUnitOfWork` → data leak or denied writes | T06 e2e isolation test; existing `rls-hardening`, `organization-isolation`, `api-key-rls-principal` e2e must stay green after every task |
| Guard order changes during the security-kit move | T09 test asserting `APP_GUARD` order |
| Behaviour drift in big services (auth 145 files, rewards 122) | e2e suite unchanged (§0.4); domain tests written from today's code paths before rewriting |
| Contract accidentally changes | snapshot test (T01), only T19 may update it (`claims.qr`, `claims.get`) |
| A lazy component renders nothing on the server and the layout jumps | every `ssr: false` item renders a sized skeleton; allowlist lint (§19.4) |
| Uncached fonts make PDF exports slower | accepted (decision #62); export rate limit bounds the frequency |
| In-transaction handler chains grow | `MAX_IN_TRANSACTION_EVENT_ROUNDS` guard + loud error |
| Email backlog at deploy time (rows credited/succeeded but not yet notified) | sweeper commands in referrals (§7.4) keep draining |
| Outbox `type` is a Prisma enum | §8 note: stop, report, then generated migration + seed |
| Long-lived branch conflicts with `main` | rebase onto `main` at the start of every task; resolve conflicts in favour of moving `main`'s change into the new location |
| Web QR page SSR vs the write | resolved: claim details are SSR via `claims.get`; only the codes come from the client `POST` (§14.6) |

### 17.2 Follow-ups (not in this deliverable)

1. **Cross-app duplication** (decision #18):
   - `lib/auth/demo-account-list.ts` / `demo-accounts.ts` in web, admin, merchant and mobile.
   - `components/impersonation/*` in web, admin and merchant.
   - `lib/navigation/{breadcrumb,filter-menu-by-capabilities,menu-icons,pinned-items,sidebar-menu}.ts` in all three web apps.
   - `lib/palette/store-config.ts`, `lib/session/{capabilities,notifications}`, `lib/server/server-query-outcome.ts` (also in `packages/client/src/lib/api`).
   - `apps/mobile/src/features/profile/own-profile-cache.ts` vs `packages/client/src/lib/auth/profile/own-profile-cache.ts`.
   - Candidate fix: a platform-agnostic `packages/client-core`.
2. **Referral attribution capture:** nothing writes `RewardReferral` rows or `pendingAttributionToken`. Needs product decisions.
3. **Organization lifecycle** (suspend, delete, erasure) and quotas: deleted as dead code (D26). Needs product decisions.
4. **Unused enum values** (§9 end): decide per enum whether to model them or remove them with a migration.
5. **Support access expiry job:** `EXPIRED` is never written; expiry is enforced only by predicate.
6. **Redis `authz:invalidate` is at-most-once:** acceptable today (`tokenVersion` is authoritative). Revisit if caches grow longer TTLs.
7. **Both `react-hook-form` and `@tanstack/react-form` are installed:** `rules/06` mandates TanStack Form.

---

## 18. Definition of done and final report

### 18.1 Checklist (all must be true at T49)

- [ ] `apps/api/src/modules/` does not exist. Every context in §6.1 exists with the §4.2 layout.
- [ ] Every row in §7 implemented as classified; every D-xx in §9 fixed with its test.
- [ ] Lint rules in §12 are active with fixtures; `pnpm run lint` exits 0 with zero warnings.
- [ ] No `forwardRef` added; no cross-context internal imports; no Prisma in domain/application/presentation.
- [ ] `@nestjs/cqrs` is the only bus; no custom mediator, no base handler classes, no `BaseService`.
- [ ] Every non-HTTP command goes through `SystemCommandDispatcher` and is audited.
- [ ] Every email is requested inside the business transaction (ADR 060).
- [ ] Rate-limit coverage test passes: every mutating route has a policy.
- [ ] N+1 tests pass for every list endpoint in §7.
- [ ] Contract snapshot identical to T01 except `claims.qr` method and the new `claims.get`.
- [ ] Every Next page is SSR; `ssr: false` appears only for allowlisted widgets with sized skeletons.
- [ ] Bundle budget script passes in CI for web, admin, merchant and mobile.
- [ ] `pnpm dev:timing` results recorded at T40 and T46; targets met or the misses reported with evidence.
- [ ] No new caches were introduced for startup (decision #62).
- [ ] Frontend contexts regrouped; public paths unchanged; mobile untouched except folders.
- [ ] ADRs 058–060 written; 015/017/026 headers updated; rules rewritten; `.cursorrules` is a pointer; `AGENTS.md` routing updated; context map and glossary updated.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm test:e2e`, app builds: all green in the same final run.

### 18.2 Final report template (fill in, paste into the PR description)

```text
## Implementation summary
<one paragraph>

## Files changed
<counts per area: api contexts, platform, shared, api-client, client, web, admin, merchant, mobile, docs>

## Completion gate (final run, after last edit)
pnpm run lint      → <exit code, warnings count>
pnpm run test      → <exit code, passed/total>
pnpm run typecheck → <exit code>
pnpm test:e2e      → <exit code, passed/total>  (or NOT VERIFIED + reason)
builds             → <per app>

## Baseline comparison (T01 → T49)
unit tests: <n> → <n>   e2e files: <n> → <n>

## Defects fixed
<D-xx list with test file paths>

## Stop-and-report items raised during implementation
<task, issue, resolution>

## Architecture decisions made during implementation
<should be "none": every decision is in the plan. If any, list and justify.>

## Documentation updated
<ADRs, rules, docs files>

## Remaining risks / follow-ups
<from §17 plus anything new>
```

---

## 19. Startup and bundle performance (decisions #53–70; tasks T40–T46)

### 19.1 Measuring (T40)

- **Script:** `pnpm dev:timing` → `packages/tooling/src/dev-timing/` (Node script, no new dependency). It measures four phases, each in milliseconds:

| Phase | Start | End |
|---|---|---|
| A. Cold `pnpm dev` | command spawned | every app's port answers (`api` `/health/ready` 200, web 3000, admin 3001, merchant 3003, docs 3002 respond to `GET /`; mobile Metro `GET /status` returns `packager-status:running`) |
| B. API boot | API process spawned | `/health/ready` 200. Also capture the `markPhase` lines that `bootstrap-app.ts` already prints. |
| C. First page compile | dev server ready | first `GET` of a representative route per app returns 200 (web `/dashboard`, admin `/`, merchant `/orgs/<seeded slug>/dashboard`, using the seeded demo accounts' session from `docs/technical`) |
| D. First Metro bundle | Metro ready | the iOS bundle URL (`/index.bundle?platform=ios&dev=true`) finishes downloading |

- **Modes:**
  - **cold:** delete `.turbo`, `.next`, `apps/api/dist`, the Metro cache (`--clear`)
  - **warm:** a second run with no deletions
- **Output:** print a table and write `.dev-timing/latest.json` (gitignored).
- **Targets** (decision #54): every phase ≥ 40% faster than its T40 warm median, and phase B ≤ 5,000 ms warm. Put them in `rules/19` as named constants in prose. Don't add them to CI.
- **Tests:**
  - `packages/tooling/src/dev-timing/__tests__/` covers the readiness probes and timer maths, using fake servers on ephemeral ports.
  - No test spawns the real stack.

### 19.2 Dev scripts (T41)

- `packages/shared`, `packages/messaging` and `packages/api-client` each get a `dev` script that runs `tsc --watch --preserveWatchOutput` and `tsc-alias --watch` **together through a small Node runner** in `packages/tooling/src/watch-runner/`. The runner spawns both, prefixes their output, and forwards SIGINT/SIGTERM to both children. **Why a runner and not `a & b`:** `&` in a package script isn't portable and leaves orphan watchers after Ctrl-C. The runner gets unit tests for signal forwarding, using fake child processes.
- **`turbo.json`:**
  - `dev` stays `dependsOn: ["^build"]`, `persistent: true`, `cache: false`.
  - Because these packages now have a `dev` task, they run alongside the apps automatically.
  - Confirm the API's `rspack --watch` picks up `dist` changes in `node_modules/@workspace/*`. If it doesn't (externals aren't watched), add the three `dist` folders to rspack `watchOptions` (read rspack docs for the installed version). If neither works, stop and report.
- **docs:** `astro dev --port 3002` (drop `--force`).
- **Unchanged on purpose:** `pnpm dev` boots everything (decision #70), and Kafka, RabbitMQ, Redis and the Mailpit probe stay on (decision #63).

### 19.3 API boot (T42). Lazy, never cached, never skipped (decisions #55, #62, #68)

| Item | Today | Change |
|---|---|---|
| BullMQ maintenance schedulers (~7 queues) | each `onModuleInit` awaits `registerMaintenanceScheduler` in sequence | add `MaintenanceSchedulerRegistry` in `platform/infrastructure/jobs`. Each queue module calls `registry.add(definition)` in `onModuleInit` (synchronous). The registry's `onApplicationBootstrap` runs all registrations with `Promise.all`, each wrapped in a timeout `SCHEDULER_REGISTRATION_TIMEOUT_MS = 10_000` (comment: Redis round-trips; a hung Redis must fail boot loudly, not hang it). Readiness stays not-ready until all succeed. |
| `storage-queue.processors.ts` | no `useBullMq` guard | add the guard, the same as the other processors |
| Report fonts (`report-font-registry.ts`, 22 MB assets) | parsed at module init via `useFactory` | inject a `ReportFontLoader` with `load(fontKeys): Promise<LoadedFonts>` that reads and parses **only the requested fonts on each call**, with **no module-level or instance cache**. The export services call it per export. Glyph validation moves to a unit test over all fonts, so a broken font fails CI rather than boot. |
| Cedar WASM (`@cedar-policy/cedar-wasm/nodejs`) | static import, loaded at module load | replace static imports in `cedar-wasm-policy-engine.ts` and `preparsed-policy-set-cache.ts` with `await import(...)` inside the first evaluation path, behind a single in-flight promise so concurrent first calls don't load twice. The in-flight promise is a concurrency guard, not a cache of results (the module system holds the module). Readiness probe: `AuthorizationHealthIndicator` performs one trivial evaluation, so `/health/ready` still proves Cedar works. |
| Swagger (`buildOpenApiDocument` + `setupApiDocs` before listen) | built at boot when `SWAGGER_ENABLED` | register the docs routes at boot, but build the document **inside the request handler on every `/docs` and `/docs-json` request**. No stored document. Keep `SWAGGER_ENABLED` and the docs access gate unchanged. Test: two requests both build (spy on the builder) and both return identical JSON. |
| Permission registry + capability sync | registry sync fire-and-forget; capability sync awaited | per D21: both awaited, under an advisory lock, every boot, **no hash-skip** (decision #68) |
| Dev `devtool` | `source-map` | `cheap-module-source-map` when `--mode development`; prod unchanged. Update `apps/api/scripts/__tests__/dev-script-runtime.spec.ts` to pin the new value. This is a deliberate change, not a weakened test. |

- **Tests:**
  - Unit: the registry runs registrations concurrently (fake timers) and times out.
  - Unit: the font loader returns the requested fonts and holds no state between calls.
  - Unit: the Cedar loader runs once under concurrent first calls.
  - e2e: `/health/ready` is 503 until schedulers are registered, then 200.

### 19.4 Next apps: lazy loading with every page SSR (T43)

**Allowlist** (decision #58): `packages/ui/src/lib/client-only-widgets.ts` exports `CLIENT_ONLY_WIDGETS` as a typed tuple of widget names, each with a comment saying which DOM API it needs.
- **Lint rule** (local rule in `packages/eslint-config`, the same style as the existing local rule): `dynamic(..., { ssr: false })` is allowed only in files named `*.client-only.tsx`, and every such file's default export name must appear in `CLIENT_ONLY_WIDGETS`. Fixture tests cover pass and fail cases.
- Each client-only wrapper renders the matching existing skeleton (`packages/ui` Skeleton) at the widget's final size as the `loading` fallback, which is also its server output.

| Item | Where today | Change |
|---|---|---|
| recharts charts | `apps/web/contexts/reporting/components/analytics-page-view.tsx`, `apps/admin/contexts/reporting/components/platform-analytics-dashboard.tsx`, `apps/admin/components/dashboard/platform-sales-cards.tsx` (static import in admin home `dashboard-gallery.tsx`), `apps/merchant/contexts/reporting/components/merchant-analytics-page-view.tsx` (paths after the T31–T33 regroup) | `packages/ui/src/components/chart.client-only.tsx` and `time-series-chart.client-only.tsx` wrap the existing chart components with `ssr: false` and a skeleton sized from the chart's `height` prop. Pages keep server-rendering their data, headings, KPIs and tables. Import the wrappers instead of the charts. |
| Image cropper | `packages/client/src/lib/storage/image-crop-dialog.tsx` → `ui/components/image-cropper.tsx`, used by profile/branding/reward-image fields | `image-crop-dialog.client-only.tsx`, loaded only when the dialog opens (render the dynamic component conditionally on `open`) |
| KYB PDF preview | `packages/client/src/lib/merchant/kyb/document-preview-dialog.tsx` (path after T34) | `document-preview-dialog.client-only.tsx`, loaded when opened |
| Command palettes | already `ssr: false` in 3 apps | rename the files to `*.client-only.tsx` and add them to the allowlist |
| Permission explorer tree (`@headless-tree`) | `apps/admin/contexts/authorization/components/access-permission-explorer-tree.tsx` | `next/dynamic` **with SSR on** (default), with `loading` skeleton |
| Analytics range controls (react-day-picker) | `packages/client/src/lib/analytics/analytics-range-controls.tsx` | `next/dynamic` with SSR on |
| Code block | `ui/components/code-block.tsx` (merchant terminals/api-keys) | `next/dynamic` with SSR on (shiki is already lazy inside) |
| framer-motion in shells | `packages/ui/src/components/sidebar-progress.tsx` via `sidebar-context.tsx` | wrap the shell in `<LazyMotion features={loadDomAnimation} strict>`, where `loadDomAnimation = () => import("framer-motion").then((module) => module.domAnimation)`. Replace `motion.*` with `m.*` in `sidebar-progress.tsx`, `geo-table.tsx` and the chart example. **Same props, same timing, same visuals.** `strict` makes any leftover `motion.*` throw in dev, so nothing slips back. |

- **Level 3** (heavy libraries in handlers): the inventory found none on the client (no xlsx, no client PDF export). The rule still goes into `rules/19`: a library used only in an event handler is loaded with `await import()` inside the handler.
- **Analyzer:** add `@next/bundle-analyzer` to merchant like web and admin. Document `ANALYZE=true pnpm --filter @workspace/<app> exec next build --webpack` in `rules/19`.
- **Tests:**
  - Each `*.client-only.tsx` has a test that its server render (`renderToString`) outputs the skeleton.
  - Shells render with `LazyMotion` (smoke test).
  - Existing page tests stay green.
  - e2e/manual: each Next app builds.

### 19.5 Mobile (T44)

- **Async routes:** in `apps/mobile/app.config.ts`, enable Expo Router async routes **for development only**. Read `node_modules/expo-router` docs and `node_modules/expo/` config typings for SDK 57 to find the exact option (it has been an `expo-router` plugin option and an `experiments` key in different SDKs). If SDK 57 has neither, stop and report (decision #66). Production native builds keep a single bundle.
- **`inlineRequires`:** read `node_modules/expo/metro-config` (`getDefaultConfig`). If it already sets `transformer.getTransformOptions` with `inlineRequires: true`, change nothing and note it in the PR. Otherwise set it in `metro.config.js` **inside** the existing `withUniwindConfig` wrapping, keeping the singleton pins and the `development` condition.
- **`React.lazy`** + `Suspense` with the existing skeleton components for:
  - the GitHub pull request screens' markdown rendering (`src/components/markdown.tsx` → lazy `MarkdownBody` so `marked` evaluates on first use)
  - the till pairing and till counter camera views (`src/contexts/pos/…` after T35)
  - the PDF viewer screen body (`src/app/(app)/settings/pdf-viewer.tsx`)
  
  Route files stay in `src/app`. Only their heavy bodies are lazy.
- **Unchanged:** the six fonts stay eager behind the splash screen, and the root layout stays as light as it is.
- **Tests:** each lazy screen renders its skeleton first and then the content (Jest with the existing `plugin-transform-dynamic-import`). Screen tests stay in `src/__tests__/app`.

### 19.6 Bundle budgets (T45)

- **Script:** `packages/tooling/src/bundle-budget/` with `pnpm bundle:check` at the root.
  - **Next apps:** read `node_modules/next/dist/docs` for 16.3 to identify the build manifest that maps each App Router route to its client chunks (for example the app build manifest or client reference manifests). For each route, sum the **gzip** size (`node:zlib` `gzipSync`, default level) of its unique first-load JS chunks. If no manifest maps routes to chunks, stop and report.
  - **Mobile:** read the bundle size from the `expo export` output the CI build already produces (the Hermes bytecode bundle per platform).
- **Budgets file:** `bundle-budgets.json` at the repo root: `{ "web": { "<route>": <bytes> }, "admin": {...}, "merchant": {...}, "mobile": { "ios": <bytes>, "android": <bytes> } }`.
  - Generate it once after T43/T44 with `pnpm bundle:check --write-baseline`, which writes measured × `BUDGET_HEADROOM = 1.10` (named constant: 10% headroom, decision #57), rounded up to the next KiB.
  - Commit it.
  - Raising a budget later requires a PR that edits this file. That diff is the review signal.
- **CI:** add a step to `.github/workflows/ci.yml` after the existing build job's `turbo run build`: `pnpm bundle:check`. It fails when any route exceeds its budget or when a route has no budget entry (a new route must add one).
- **Tests:** unit tests for manifest parsing (fixture manifests in `__tests__/fixtures/`), the gzip summing, the headroom rounding, and the "missing route fails" rule.
