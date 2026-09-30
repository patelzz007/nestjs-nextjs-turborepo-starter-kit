---
title: "Authorization Overhaul — Change Log"
tags: ["authorization", "changelog", "migration", "security"]
description: "Everything that changed in the authorization overhaul: security fixes, new kernel features, stores, RLS hardening, frontend gating, removed code, breaking changes, and known follow-ups."
order: 28
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Authorization Overhaul — Change Log

> [!NOTE]
> This page records **what changed and why**, so reviewers and future readers can follow the
> reasoning. The how-to guides are linked from the [overview](./overview.md).

---

## 1. Security holes fixed

| # | Problem (before) | Fix (now) |
|---|---|---|
| 1 | `@Authorize(...)` was declared on routes but **no guard read it** — those routes only required login | `AuthorizationGuard` enforces `@Authorize`, failing closed when a declared resource id cannot be resolved |
| 2 | Any active organization member was **allowed every action** in that org (relationship check returned ALLOW); owners could `DELETE` anything they owned | Membership only satisfies ORGANIZATION / STORE / LOCATION **scopes**; ownership only satisfies **OWN-scoped** grants for the actions they list |
| 3 | `organizationId` / `locationId` came from headers, body or query **without checking membership**; RLS used the raw `x-organization-id` header | `AuthorizationContextResolver` + `TenantMembershipService` verify every claim; forged headers → 403; RLS uses only the verified organization |
| 4 | With no request scope, the RLS pool **fell back to bypass**; unauthenticated requests were bypassed | No scope → anonymous, non-bypass session; guards run in a named `request.pre_handler` scope; background work declares named system operations |
| 5 | Admins could assign themselves roles / permissions and grant permissions they did not hold | `PrivilegeEscalationService`: no self-escalation, subset rule, real actor in audits |
| 6 | `/authorization-kernel/examples` was live in production, leaked ACL ids / policy names, and trusted a query-string organization | Removed. Replaced by `POST /authorization/decisions` (caller only) and admin-only `GET /authorization/decisions/explain` |
| 7 | Role decorators used a fake `ASSUME` action and always denied non-superadmins | Native role checks (`kernel.hasRoles`) |
| 8 | `POST /files/upload-url` only checked avatars — anyone could get upload tickets for other organizations' KYB documents, store logos, or any product image | `FileUploadAuthorizationService` per-category rules |
| 9 | The default tenant policy let **cashiers do every Reward Hub action** (manage rewards, API keys) | Shared `MERCHANT_ROLE_CAPABILITIES` enforced **before** Cedar; cashiers are read-only |
| 10 | Any organization member could read the KYB profile and download KYB documents | KYB read, download and submit are **owner-only** |

---

## 2. Kernel features added or completed

- **Precedence** rewritten and documented ([backend §4](./backend.md#4-decision-precedence-the-most-important-section)).
- **Per-user overrides** with `effect` `ALLOW` / `DENY` (new column `user_permissions.effect`).
- **Role hierarchy** (parent roles) is evaluated.
- **Scopes** `GLOBAL`, `ORGANIZATION`, `STORE` (new), `LOCATION`, `OWN`, `RESOURCE`.
- **Implicit self grants**: read / update your own `USER` and `PROFILE`.
- **ACL**: user and role subjects, type-wide entries (`resourceId = null`), tenant binding, conditions, `MANAGE`.
- **Policies (ABAC)**: strict rule schema; DENY-only sets no longer block everyone; conditional ALLOW semantics; malformed rules fail closed.
- **Permission conditions** (`permissions.conditions`) are evaluated.
- **`filter()`** builds Prisma filters from real grants, ACLs and overrides.
- **Audit**: every decision checked by the guard is audited (DENY, writes, sensitive reads).
- **`resourceCapabilities()`** for per-record UI hints; **decisions endpoint** for batches.
- `AuthorizationException` carries `error: "PERMISSION_DENIED"`.

## 3. Stores and tenancy

- New tables `stores` (1:1 with `organization_locations`) and `store_memberships` (user, store, dynamic role).
- `STORE` added to `PermissionScope` and `PermissionResource`; `x-store-id` header.
- Store roles' permissions are always bound to their store.
- Stores are synced by `OrganizationLocationRepository` via `syncStoreForLocation()`.
- New seeded roles `Store Manager` and `Store Staff`; seed creates stores and memberships.
- Migration `20261001090000_stores_and_store_scope`; RLS policies `stores_member`, `store_memberships_member`.

## 4. RLS hardening

- `RlsPreHandlerMiddleware` (new) opens `request.pre_handler` for guards — a Fastify integration test proves the scope reaches guards and handlers.
- `RlsInterceptor`: named system operations for every bypass; refresh / logout scoped to the token's user; anonymous never bypassed.
- BullMQ processors → `queue.job`; cron jobs → `scheduled.maintenance`; outbox → `outbox.enqueue`.
- Storage callbacks / local transfers marked `@RlsBypass()` explicitly.
- `app.system_operation` is set on every pooled connection.
- `apply-rls.ts`: per-file transaction, 10 s lock timeout, retry on deadlock / lock timeout.

## 5. Data and seed fixes

- **User role** now holds **OWN-scoped** permissions only (profile, URLs, tags, API keys, analytics).
- `PermissionDefinition` gained `scope`; permission sync and capability sync are scope-aware (a capability links to the GLOBAL row when several scopes exist).
- The seeded ABAC policies were invalid JSON rules (and, combined with the old DENY semantics, **denied the admin dashboard to every non-superadmin**) — rewritten in the valid format.
- SuperAdmins receive every platform capability from `/auth/permissions`.
- Legacy checker ignores DENY overrides as grants and subtracts them from capabilities.
- **Bug:** role / permission / user-role **syncs** soft-deleted everything and then `createMany({ skipDuplicates })` skipped existing rows, leaving them deleted. Syncs now revive listed rows first.
- **Bug:** logout / refresh failed with an RLS error on `outbox_events` once they stopped bypassing. Outbox writes now run under `outbox.enqueue`.

## 6. Frontend

- Shared vocabulary `PERMISSION`, `ACTION`, `RESOURCE`, `MERCHANT_CAPABILITY`, `MERCHANT_ROLE_CAPABILITIES`.
- `useAuthorization()` with `can`, `cannot`, `canAll`, `canAny`, resource-aware checks; `<Can resource fallback>`.
- Admin: provider mounted; route guard; menu requirements in `menu-authorization.ts`; palette and pinned items use the filtered menu; every feature area gated; `DisabledActionButton`, `AccessRestrictedNotice`, `useSuperAdminStatus`.
- Merchant: moved onto the shared provider; typed constants; loading states; role gates; owner-only KYB.
- Web: one provider for the whole app; `AccessGate`; impersonation gated; guests never fetch permissions.
- Live permissions win even when empty; refetch on focus and every 60 s.
- Sidebar schema: `authorization { permissions, mode, cascade }`, `featureFlag`; legacy `requiredCapabilities` removed; slugs validated at load.

## 7. Code quality

- Roughly 355 strict-TypeScript violations removed across apps and packages (`unknown`, `never`, casts, `as const`, `!`, `eslint-disable`).
- The API gained a `test` script, so `pnpm run test` runs its unit suite.
- Web and merchant gained Vitest + Testing Library setups.
- Legacy Jest-style specs (never run) were replaced with working Vitest specs.

## 8. Resource generator removed

Deleted: `packages/cli`, the `resources/` workspace, `.app/`, the admin Generator UI and
devtools section, `docs/cli-guide.md`, `docs/contract-driven-scaffolding.md`, the root
`app` script, the generator feature flag, the two `DEVTOOLS` permission definitions.
The `DEVTOOLS` enum value is kept (removing a Postgres enum value needs a type rebuild).

Products and sample categories are ordinary code now:

| Before | After |
|---|---|
| `packages/shared/src/schemas/domain/generated/*.generated.ts` | `packages/shared/src/schemas/domain/catalog/*.ts` |
| `apps/admin/app/(panel)/**/*-view.generated.tsx` | `*-view.tsx`, `*-detail-view.tsx` |
| `apps/api/src/modules/*/*.repository.generated.ts` | `*.repository.ts` (`ProductRepository`, `SampleCategoryRepository`) |
| `*.controller.generated.ts`, `*.service.generated.ts` | merged into `*.controller.ts`, `*.service.ts` |

---

## 9. Breaking changes (for code outside this work)

| Change | What to do |
|---|---|
| `@Authorize` options: `scope` and `context` removed; use `resourceId` (param name or `self()` / `fromParam()`) and `attributes` (object or `attributesFromBody`) | update decorators |
| `TenantMembershipService.verify(userId, { organizationId, storeId, locationId })` (object argument) | update calls |
| `AclService.checkAcl` → `findApplicable(lookup, request)` with `resourceScope` | update calls |
| `kernel.filter()` is `async` | `await` it |
| `AuthorizationContextMiddleware` and `request.authorizationContext.resourceId` removed | read the verified `request.authorizationContext` (organization / store / location only) |
| `useSessionCapabilities`, `canDeletePlatformResource` (admin) removed | use `useAuthorization()` |
| Sidebar `requiredCapabilities` removed | use `authorization.permissions` |
| `PlatformOutboxService.enqueue(input, tx?)` takes an `OutboxWriter` | pass your transaction as before |
| `useDebouncedCallback` (ui) takes one argument | — |
| `@workspace/client` error helpers take `CaughtValue` | narrow caught errors first |
| Role-service mutations accept an `actorId`; `RoleService.updateAs()` added | pass the actor |

---

## 10. Known follow-ups

- **Store membership administration** has no API or UI yet (memberships come from the seed / DB).
- **ACL and policy administration** UIs do not exist yet (services exist).
- The shared **KYB view has no read-only mode**; non-owners see "access denied" (by decision: KYB is owner-only).
- **Spec files are not type-checked** by the API `tsconfig` or lint (they are checked by review and by a scratch config during this work).
- Older authorization docs in `docs/` (`authorization-kernel.md`, `authorization-context-middleware.md`, `kernel-first-refactor-*.md`, `kernel-integration-*.md`) describe the pre-overhaul design and are marked as superseded.
