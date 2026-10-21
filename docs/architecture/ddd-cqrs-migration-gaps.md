---
title: "DDD + CQRS migration gaps"
description: "What the migration has not finished yet, and which task owns each gap."
tags: ["architecture", "ddd", "cqrs", "migration"]
author: "Platform Team"
lastUpdated: 1792540800000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 4
---

# DDD/CQRS migration gaps

Notes found while implementing the migration. These are not workarounds left in code. Each one says what is unfinished and which task owns it.

## Status on 2026-10-21

A cross-check against the plan found this file partly out of date, and the owner asked for every open item to be finished (Swagger and Cedar loading at boot excepted: **deferred by the owner**). What changed:

| Item | Now |
| --- | --- |
| Lint context list said `tenants`; the folders are `tenancy` | Fixed in `packages/eslint-config/import-boundaries.js`; a fixture test now fails if the list and `apps/api/src/contexts` disagree |
| `TenantEncryptionService.encrypt/decrypt` (D31) | Removed; the service keeps `ensureTenantKey` and `rewrapToCurrentKek` |
| `MerchantAccessPort` defined twice | One definition (`platform/application/ports/authorization.port.ts`) |
| Seven per-context "corrupt aggregate state" errors | One `CorruptAggregateStateError` (`platform/domain/errors`) |
| Frontend contexts without an `index.ts` | Every web, admin, merchant and `packages/client` context has one |
| Regression tests for D25 and idempotency | `test/tenancy-transaction-regressions.e2e-spec.ts` (one-transaction proof by `xmin`; idempotent invite and sample-category retries); cross-tenant file completion in `tenant-store-logo.e2e-spec.ts` |
| T43 range controls and code block | SSR `next/dynamic` chunks with sized skeletons (`AnalyticsRangePickerSkeleton`; the API-keys page's code-block panels) |
| T44 Metro `inlineRequires` | On (`apps/mobile/metro.config.js`), checked by `packages/tooling/src/mobile-metro/__tests__/metro-config.test.mjs`; still to be confirmed on a device |
| T48 rules and `docs/technical` paths | Rules 00, 01, 02, 05, 08, 09, 10, 14–17, 20, 22–26 point at `src/contexts/` and `packages/shared`; the eslint guide matches the real config |
| §17.2 follow-ups | Cross-app duplication reduced (shared impersonation bar, session-permission rules, menu-icon resolver, profile-cache rules in `@workspace/api-client/react`, `contractFormSchema` in `packages/client`; one-line re-export files deleted). Demo-account lists stay per app on purpose: server-only on the web, `__DEV__`-gated on mobile, so passwords never reach a bundle. Referral attribution captured (share links + pending attribution). `react-hook-form` removed. Support-access expiry job added |
| Stale claims below | The `runtime/` folders are gone; contracts are split per context (`packages/shared/src/contexts/*/{contract,routes}.ts`); mobile is regrouped (`apps/mobile/src/contexts/*`); `pnpm dev:timing` exists; mobile lazy screens use `lib/lazy-view.tsx`. The older notes below are kept as history and marked where superseded |

## T07 — base repository

- The import restriction (only `contexts/*/infrastructure/**` and `platform/infrastructure/**` may import `PrismaBaseRepository`) is **T10**. Product and sample-category still import it directly, which T07 requires until T11 moves them.
- `base.service.ts` was deleted in **T11**. Catalog application services own list/get/create/update/delete/restore.
- `delete` (cascade) and `restore` (cascade) use the same `runInRepositoryTransaction` helper as `createMany` / `deleteMany`, so they also skip a nested `$transaction` when the repository is already bound to one. The plan only named the batch methods.

## T10 — architecture lint

- Enabling the application-layer rule forced three existing files out of `platform/application`: `exception-mapper` (it branches on Prisma errors), `system-command.module` (it wires infrastructure), and the command payload redaction (it now runs in the audit adapter, which is infrastructure). `platform/domain/errors/error-codes.ts` no longer imports `@nestjs/common`; the status numbers are local constants.
- `DbClient` in the in-transaction handler is `object` so the application layer does not import `@prisma/client`. Infrastructure still passes a Prisma transaction client.

## T09 — HTTP security kit

- `AdminAccessGuard`, `SuperAdminGuard`, and `EmailVerifiedGuard` are not named in the T09 file list. They moved with the decorators that apply them (`@AdminAccessOnly`, `@SuperAdminOnly`, `@EmailVerified`).
- Resolved (review finding 1): `ThrottlingModule` is the ONE `ThrottlerModule` registration, with named throttlers `preAuth`, `strict`, `default` and the opt-in `webhook`. The second (notifications) registration made the global guard resolve the webhook options, so strict and default limits were ignored; `test/rate-limit-wiring.e2e-spec.ts` proves the fix. Storage is the Redis `RedisThrottlerStorage`, passed as the options' `storage`.
- `APP_GUARD_ORDER` (owner decision Q72): `PreAuthThrottlerGuard` (per client IP, one bucket across routes, `PRE_AUTH_LIMIT_MULTIPLIER` × the default limit) runs BEFORE `AuthGuard`, so a flood of bad credentials is counted; `PrincipalThrottlerGuard` (strict per IP, default per principal, webhook per IP) runs after it. `MutationIntentGuard` stays on `AuthModule`.

## T08 — system command audit row

- `AuditLog` is an HTTP row. `recordSystemCommand` stores a system command there: `method` is the origin kind (`JOB`, `CRON`, `CLI`, `BOOTSTRAP`, `CONSUMER`), `endpoint` is the command class, `path` is `kind:name`, and `requestBody` is the redacted command. There is no separate system-command table yet.
- `SystemCommandDispatcher` imports `toAuditPayload` from the audit infrastructure so the port receives an already-redacted payload. That is an application → infrastructure import. A later task can move the redactor to a port if that dependency is rejected.

## T11 — catalog

- `Product` and `SampleCategory` policies allow only `app_rls_bypass()`. Catalog reads and writes therefore use `runSystemOperation` with `catalog.product_catalog.read` and `catalog.product_catalog.write`, not the caller's user RLS context. The actor is still the first argument and is recorded as the operation's actor user.

## T12 — rewards

- The aggregate, the compared-and-set status updates (approve, reject, submit, revise, auto-publish), and the single-transaction consumer+referrer create are in place. Auto-publish goes through `SystemCommandDispatcher`.
- Organization, admin, marketplace and legal controllers still live in `modules/rewards` and call the existing services. Those services now persist through the CAS repository methods. Moving every rewards route into `contexts/rewards/presentation` is the rest of T12c; claims, POS, KYB and analytics stay until Phase C.
- `REWARD_NOT_DRAFT` stays HTTP 400 because the exception-filter probe and the current publish response use that status. A lost race on submit/approve/reject is HTTP 409 `CONFLICT` (`ConcurrentModificationError`). Auto-publish skips a row whose compare-and-set matches nothing.
- `AutoPublishDueRewardsHandler` still calls `MerchantRewardService`. The handler is the job's command; the service still owns the query and the outbox write.

## T14 — files

- `FileVerdictReached` is dispatched to the in-transaction registry from the existing verdict transaction. Rewards registers `ReconcileKybOnFileVerdict` there. The old `KybFileVerdictListener` still runs too; reconcile is idempotent, and organizations replaces the bridge in T18.
- `claimPendingForScan` runs in the uploader's RLS transaction. `softDeleteWithReferences` runs in `files.delete` (bypass) because product-image rows are bypass-only.
- *(Superseded: owners bind and guard their files through `FileReferenceGuardRegistry` / `FileVerdictReached`; `LegacyBindingAdapter` is gone.)* Binding-table writes still live in `stored-file.repository.ts`. `LegacyBindingAdapter` is the guard those owners will replace. It is not yet the only delete check; the repository still refuses a reward image inside the locked transaction.
- Binding-table writes still live in the files runtime repository. `LegacyBindingAdapter` is the guard those owners will replace. The repository still refuses a reward image inside the locked transaction.

## T15–T26 — contexts hold the old modules

- Every former `modules/` package now lives under its context (`identity/auth`, `authorization/rbac`, `organizations/runtime`, `rewards/runtime`, `pos/api-keys`, `notifications/runtime`, `files/runtime`, `audit/runtime`, `reference-data/geo`, `integrations-github/runtime`). `src/modules/` is gone, and lint rejects any file put back there.
- Callers send mail through `EMAIL_REQUEST`. A stored email-log status that is not one of the six statuses throws `CORRUPT_AGGREGATE_STATE` (D32).
- *(Superseded 2026-10-21: no `runtime/` folder remains; claims, POS, referrals, identity, authorization and tenancy dispatch per-use-case command and query handlers.)* Claims, point of sale, and referrals still share `contexts/rewards/runtime`. Their use cases are not yet separate command and query handlers.

## Phase D — T27 rate limits and T28 N+1

- Named policies, `@RateLimit`, and a principal-or-IP tracker are in place. Every controller mutation carries `@RateLimit`, `@SkipThrottle`, `@SkipAuthThrottle`, or its own `ThrottlerGuard`. The coverage test walks the source.
- `@SkipAuthThrottle()` still skips both the strict and the default bucket. Merchant routes that used it were left on that explicit skip. Replacing the skip with `AUTHENTICATED_MUTATION` would start limiting routes that were deliberately unlimited. That replacement is the rest of §10.3.
- The email and GitHub webhooks use `@RateLimit(RATE_LIMIT_POLICY.webhook)` on the one registration (`WEBHOOK_RATE_LIMIT_PER_MINUTE`, per IP per minute, 0 turns it off); a webhook route skips `strict` and `default`.
- `RATE_LIMIT_POLICY.adminSecurityMutation` (10/min per principal) and `sessionRefresh` (10/min per IP) are applied by the identity and authorization controllers (owner decision Q73). `/auth/change-password` and `/auth/verify-email` carry the strict per-IP `credential` policy.
- `test/rate-limit-policies.e2e-spec.ts` drives every named policy to limit + 1 and expects 429 (LOGIN, WEBHOOK and the pre-auth flood are in `rate-limit-wiring.e2e-spec.ts`). Principal-keyed policies send each request from a new address, so only the principal's bucket can fill.
- `expectNoNPlusOne` covers `GET /product`, the redemptions list, and `GET /auth/admin/users`, `/admin/merchants`, `/orgs/:orgSlug/members`, `/rewards` and `/claims` (`test/n-plus-one-lists.e2e-spec.ts`, which clones seeded rows to fill a 25-row page).

## Phase E — T29 to T36

- Frontend lint rejects `@workspace/api` and a context importing another context's internals (anything under `contexts/<name>/` except `index` / `index.ts`). Mobile lint rejects `@workspace/api`. Fixture tests cover both.
- *(Superseded: split into `packages/shared/src/contexts/*/contract.ts`.)* Contract files were not split into per-context folders. `apiContract` and the snapshot in `packages/shared` are unchanged. T29 owns that move, and it has to keep every export name stable.
- Web, admin and merchant domain code lives under `contexts/<name>/{components,lib,url-state}` (T31–T33); routes stay in `app/`, generic code in `components/` and `lib/`. A context reaches another only through its `index.ts`.
- `packages/client`: the capability checker is the authorization context's index (`@workspace/client/lib/contexts/authorization`, was `identity/can`); the API error-message mapping is generic (`@workspace/client/lib/api/error-messages`, was `identity/errors`).
- *(Superseded: `apps/mobile/src/contexts/{identity,pos,integrations-github,reporting}`.)* Mobile feature folders (T35) were not regrouped.
- `lib/url-state/selection.ts` (admin) holds the selection state of three contexts' pages and stays generic; `lib/url-state/__tests__/url-states.test.ts` still tests the moved url-state modules from there.

## Phase E2 — T40 to T46

- API dev builds use `cheap-module-source-map`. Production keeps `source-map`. Pinned by `apps/api/scripts/__tests__/dev-script-runtime.spec.ts`.
- *(Partly superseded: `pnpm dev:timing` exists — `packages/tooling/src/dev-timing`. It was still not run on 2026-10-21: it starts the dev stack from `apps/api/.env`, whose database needed the owner's reset first. Startup medians stay **NOT VERIFIED** until the owner runs it three times warm and three times cold.)* `pnpm dev:timing` was not added and was not run (it needs ports 3000/3001 free). Warm and cold medians are **NOT VERIFIED**. Targets (40% faster than a T40 baseline, API boot ≤ 5000 ms warm) cannot be judged without that measurement. No cache was added to chase the number.
- Every maintenance scheduler adds itself to `MaintenanceSchedulerRegistry` from `onModuleInit`; after bootstrap all register at once (`Promise.allSettled`, 10 s timeout). The registry is a critical readiness indicator only until that first attempt settles; a failure is reported and retried every 30 s, never a reason to leave rotation.
- Report fonts load per PDF export (`ReportFontLoader`, no cache, ADR 059). Swagger is unchanged (owner decision).
- *(Owner, 2026-10-21: keeping Swagger and Cedar at boot is deferred to a later decision.)* Cedar's WASM is still loaded at boot: it measures ~8 ms, and loading it on first use needs a dynamic `import()`, which would make the synchronous `PolicyEngine` port asynchronous on every authorization path. Owner decision needed (ADR 059 asks for first use).
- *(Superseded 2026-10-21: the range controls and the API-keys code blocks are now `next/dynamic` chunks.)* T43: `CLIENT_ONLY_WIDGETS` and its lint rule, the chart, command-palette, image-crop and KYB-preview wrappers, `LazyMotion` (`m.*`) and the merchant bundle analyzer are in place; the permission explorer tree is an SSR `next/dynamic` chunk. The analytics range controls and the code block stay static: the code block is compound components sharing one context (shiki is already lazy inside), and the range controls have no sized skeleton yet.
- *(Superseded 2026-10-21: `inlineRequires` is on; lazy screens use `lib/lazy-view.tsx`.)* T44: Expo Router async routes are on for development (`asyncRoutes: "development"`). Metro `inlineRequires` stays at Expo's default (`false`) and the `React.lazy` screen splits were not made: both change module evaluation order and need a run on a device to verify.
- T45: `bundle-budgets.json` holds the measured baseline + 10% (web 18 routes, admin 42, merchant 28, mobile iOS and Android), written by `pnpm bundle:check --write-baseline` from fresh builds. CI and `pnpm ci:local` run `pnpm bundle:check` after the build. Proven: an eager recharts import in web's root layout put every web route over budget (exit 1); the probe was reverted.
- T46 cannot compare against T40 until `pnpm dev:timing` exists and has been run three times cold and three times warm.

## Phase F — T47 to T49

- ADR 058, ADR 059 and ADR 060 are written. ADR 015, ADR 017 and ADR 026 carry a superseded-in-part line. The context map is `docs/architecture/context-map.md`. Glossary terms are in `GLOSSARY.md` and `rules/22-glossary.md`. Routing rows are in `AGENTS.md`. `.cursorrules` is the pointer from decision #28.
- Rules 01, 02, 10, 11, 19, 21 and 25 gained the context, CQRS, N+1 and anti-pattern notes. They were not rewritten from scratch. Rules 23 and 24 already pointed at the catalog and reward files.
- *(Superseded 2026-10-21: no `src/modules/` path is left in `docs/technical` outside the authorization change log's history.)* `docs/technical/**` still mentions some `src/modules/` paths inside backticks. The link checker does not treat those as links. Updating every historical mention, without rewriting the migration plan's "today" paths, is the rest of T48.
- T49's §18.2 report: see "Final report (2026-10-21)" at the end of this file. T49's full §18.2 report is this file plus the gate command run after the last edit. A green `pnpm run ci:local` is the verification. Anything that command fails is not done.

## Idempotency under parallel checkout

- A duplicate identical request now waits up to 5 seconds for the in-flight request to store its response, then replays it. Still in progress when that window ends is 409 `IDEMPOTENCY_REQUEST_IN_PROGRESS`, which the unit tests still cover. This is the root of the parallel POS checkout returning one 409 under a full e2e run: the losers arrived before the winner had stored the sale.

## T06 — reads

- `PrismaReadExecutor` uses `withRlsContext` (a short transaction) because Prisma's pg driver checks the connection out outside AsyncLocalStorage. `rlsStorage.run` alone does not stamp `RlsPool` for a Prisma query. Recorded in `ddd-cqrs-migration-plan.md` §5.4.

## Final report (2026-10-21)

- **Implementation summary:** every open item of the DDD + CQRS and multi-tenancy cross-check is closed, except loading Swagger and Cedar at boot (deferred by the owner) and the `pnpm dev:timing` measurement (not run: it needs the owner's database reset first).
- **Completion gate (after the last edit):** `pnpm run format` 0; `pnpm run lint` 18/18 tasks, 0 warnings; `pnpm run test` 20/20 tasks; `pnpm run ci:local` every job green after the two new admin pages got their bundle budgets.
- **Remaining:** startup timing medians (T46) NOT VERIFIED; Metro `inlineRequires` still to be confirmed on a device; `RewardReferralStatus.BLOCKED` is not modelled.
