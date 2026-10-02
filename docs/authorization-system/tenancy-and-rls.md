---
title: "Tenancy, Stores and Row-Level Security"
tags: ["authorization", "multi-tenancy", "stores", "rls", "postgres", "prisma"]
description: "Organizations, stores, locations and memberships; how client tenant ids are verified; how PostgreSQL RLS knows who is asking; system operations; the two Prisma clients; and applying RLS safely."
order: 22
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Tenancy, Stores and Row-Level Security

> [!NOTE]
> Read the [overview](./overview.md) and [backend guide](./backend.md) first.
> Paths are relative to `apps/api/`.

---

## 1. The tenant model

```text
Organization  (the tenant — e.g. "Brew & Bean KL")
│
├── OrganizationLocation  (an operational site: terminals, rewards, redemptions happen here)
│     └── Store  (1:1 with its location — the authorization unit for store staff)
│
├── OrganizationMembership  (user ↔ organization, role OWNER / ADMIN / MEMBER / POLICY_ADMIN / CASHIER)
│     └── OrganizationMembershipLocationScope  (ALL_LOCATIONS, or SELECTED location ids)
│
└── StoreMembership  (user ↔ one store, with a dynamic RBAC Role such as "Store Manager")
```

| Model | Table | Purpose |
|---|---|---|
| `Organization` | `organizations` | The tenant boundary (spec §35). |
| `OrganizationLocation` | `organization_locations` | Where business happens. Existing rewards / terminals / API keys point here. |
| `Store` | `stores` | One per location (`locationId` is unique). Status `ACTIVE` only while the location is `ACTIVE` and not deleted. |
| `OrganizationMembership` | `organization_memberships` | "Alice belongs to Brew & Bean as CASHIER". Grants **no permissions** by itself. |
| `OrganizationMembershipLocationScope` | `organization_membership_location_scopes` | Which locations an organization member may act in. |
| `StoreMembership` | `store_memberships` | "Alice works at Store KL as **Store Staff**". The role's permissions apply **only in that store**. |

### Why both Store and Location?

`OrganizationLocation` already carried terminals, rewards, redemptions and API keys. Rather
than a risky rename, each location got a `Store` twin (spec §134 "reuse existing
conventions"). **Keep them in sync through the repository only:** every location write in
`OrganizationLocationRepository` calls `syncStoreForLocation()`
(`src/modules/organization/utils/store-sync.util.ts`) **in the same transaction**, so a store
can never drift from its location. The seed uses the same helper.

> [!WARNING]
> Never write `organizationLocation.create/update` outside `OrganizationLocationRepository`,
> and never create a `Store` by hand. If you do, the store will be missing or out of date.

---

## 2. Client tenant ids are requests, not facts

A client may say which tenant it is working in:

| Where | Organization | Store | Location |
|---|---|---|---|
| Header (the "active tenant" selector) | `x-organization-id` | `x-store-id` | `x-location-id` |
| Route param | `:organizationId`, `:orgId` | `:storeId` | `:locationId` |
| Query / body | `organizationId` | `storeId` | `locationId` |

`AuthorizationContextResolver` (`src/modules/authorization/services/authorization-context.resolver.ts`)
reads them (header wins) and asks `TenantMembershipService.verify()`:

| Claim | Proven when |
|---|---|
| Organization | the user has an **ACTIVE**, non-deleted membership in a non-deleted organization |
| Store | the store is `ACTIVE` **and** belongs to that organization **and** the user has an active store membership **or** an organization membership whose location scope covers the store's location |
| Location | the location belongs to the organization **and** the membership has an `ALL_LOCATIONS` scope row or a `SELECTED` row for it (a membership **without** scope rows covers nothing — same rule as the DB helper `app_can_access_location`) |

What happens next:

| Case | Result |
|---|---|
| A **header** claim is not proven | **403** immediately (forged tenant) |
| A header value is malformed (> 64 chars, empty) | **403** |
| A route / body / query claim is not proven | not trusted; only kept as a **resource attribute**. A `GLOBAL` permission may still act on another organization's record; an `ORGANIZATION` / `STORE` one may not. |
| SuperAdmin | may select any tenant |

The verified result is bound into the request context (`RequestContextService.bindTenant`,
[ADR 017](../adr/017-unified-request-context.md)) and used by the kernel and the RLS
interceptor. **Never read tenant ids from `request.headers` or the body yourself** — read
`requestContext.current()?.tenant` (verified ids only; absent = not requested or not proven).

---

## 3. PostgreSQL RLS — how the database knows who is asking

Every tenant table has RLS enabled and **forced** (`prisma/rls.sql`, helpers in
`prisma/rls/*.sql`). Policies compare rows with session settings:

| Setting | Meaning |
|---|---|
| `app.current_user_id` | the user the query runs for (`''` = nobody) |
| `app.current_organization_id` | the verified tenant |
| `app.rls_bypass` | `'true'` only for an allowlisted system operation |
| `app.system_operation` | which system operation justified the bypass (for auditing / debugging) |

Queries on the shared pool (`PrismaService`) get these settings on every connection checkout
(`src/prisma/rls-pool.ts`), taken from an `AsyncLocalStorage` scope
(`src/prisma/rls-context.ts`). This RLS store is deliberately **separate** from the request
context: its bypass / system-operation scopes are transaction-scoped and nest (and exist in
queue jobs with no request at all). `RlsInterceptor` is the one place the request context
(verified tenant) feeds it — see [ADR 017](../adr/017-unified-request-context.md). Which scope
is active depends on **where** the code runs:

| Where the code runs | RLS scope | Bypass? |
|---|---|---|
| **Outside any scope** (should not happen) | anonymous: no user, no organization | ❌ **fails closed** |
| Guards (`RlsPreHandlerMiddleware` opens it) | `request.pre_handler` | ✅ named system op — authentication and authorization lookups |
| Handler, `@RlsBypass()` route | `route.rls_bypass` | ✅ |
| Handler, platform SuperAdmin | `platform.superadmin` | ✅ |
| Handler, admin staff in **single-tenant** mode | `platform.staff_single_tenant` | ✅ |
| Handler, normal signed-in user | user + verified organization | ❌ |
| Handler, refresh-token routes (refresh, logout) | the token's user | ❌ |
| Handler, anonymous | no user | ❌ |
| BullMQ workers | `queue.job` | ✅ |
| `@Cron` maintenance | `scheduled.maintenance` | ✅ |
| Outbox event **inside** a domain transaction (`PlatformOutboxService.enqueueInTransaction`) | the caller's transaction session — `outbox_events_append` allows the INSERT without bypass | ❌ |
| Outbox telemetry with no domain write (`PlatformOutboxService.recordTelemetry`) | `outbox.enqueue` | ✅ |
| `TenantTransactionService.withTenantTransaction()` | the given user + organization, **transaction-local** | ❌ |
| `TenantTransactionService.withSystemOperation()` | the given operation, **transaction-local** | ✅ |

> [!IMPORTANT]
> RLS is the **final** boundary (spec §33, §51): if an application query forgets a filter,
> RLS still hides other tenants' rows. It is **not** the authorization engine (spec §52):
> business rules ("cashiers may refund up to 500") belong in the kernel.

### 3.1 System operations

A bypass is only possible for names listed in `src/prisma/system-operation.registry.ts`.
`systemRlsContext(name)` throws for unknown names. The current list:

| Operation | Used by |
|---|---|
| `request.pre_handler` | guards (authentication, kernel lookups) |
| `queue.job`, `scheduled.maintenance` | background workers, cron jobs |
| `outbox.enqueue`, `outbox.publish` | transactional outbox — standalone telemetry writes / the dispatcher ([ADR 015](../adr/015-transactional-outbox-and-inbox.md)) |
| `route.rls_bypass`, `platform.superadmin`, `platform.staff_single_tenant` | the RLS interceptor |
| `files.upload_authorization` | upload-url authorization (organization role lookup) |
| `storage.callback` | storage callbacks |
| `http.idempotency` | `@Idempotent()` endpoints recording/replaying `Idempotency-Key` responses |
| `idempotency.retention` | hourly BullMQ job deleting expired `Idempotency-Key` records ([Messaging — Retention](../infrastructure/messaging.md#retention)) |
| `auth.pre_login`, `health.probe`, `seed.bootstrap` | login lookup, health checks, seeds |
| `tenant.enumerate`, `organization.*`, `policy.publish` | tenant sagas and schedulers |

### 3.2 Running background work

```ts
import { runWithSystemRlsContext } from "../../../prisma/rls-context";

@Cron(CronExpression.EVERY_HOUR)
public async cleanup(): Promise<void> {
	await runWithSystemRlsContext("scheduled.maintenance", async (): Promise<void> => this.runCleanup());
}
```

For a new kind of background work, **add a new, specific name** to the registry. Do not
reuse a broad one "because it works".

The registry guards the API process. `apps/analytics-consumer` is a separate process with its
own `pg` pool (it does not use `PrismaService`); it sets the same session settings itself —
`role = app_runtime`, `app.rls_bypass = true` — and tags them with its own operation names:
`analytics.ingest` (inbox claim, analytics write, dead-letter park) and
`analytics.inbox_retention` (hourly inbox purge). They are deliberately **not** in the API
registry, so no API code path can borrow them.

---

## 4. Store and organization RLS policies

| Table | Read | Write |
|---|---|---|
| `stores` | bypass, organization members, or active store members of that store | bypass only (stores mirror locations) |
| `store_memberships` | bypass, your own rows, or organization members | bypass only |

Every new tenant table must be added to `prisma/rls/manifest-index.ts` and get policies in
`prisma/rls.sql`. `pnpm --filter @workspace/api db:check-rls-manifest` fails if a table is
missing. See [recipes → add a tenant table](./recipes.md#7-add-a-new-tenant-table-with-rls).

**Dynamic roles never create RLS policies** (spec §50). RLS protects stable concepts —
organization, store, user — while roles and permissions live in the kernel.

---

## 5. Applying RLS safely (`db:apply-security`)

`scripts/apply-rls.ts` runs the SQL files in `RLS_APPLY_ORDER`
(`scripts/rls-apply-plan.ts`). Each file:

1. runs on its own connection inside **one transaction**,
2. with `SET LOCAL lock_timeout = '10s'`,
3. and on a **deadlock** (`40P01`) or **lock timeout** (`55P03`) rolls back and retries up to
   6 times with backoff (0.5 s, 1 s, 2 s, …).

The SQL is idempotent, so retries are safe.

> [!TIP]
> `ALTER TABLE … ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` lock each table. A running
> API (workers, cron jobs) or Prisma Studio touching the same tables can deadlock with it.
> **Stop the API before resetting / applying RLS.** If it still happens, the retry will
> usually recover and print a hint.

### The reset sequence

```bash
# 1. stop `pnpm dev` (API, workers)
# 2. the seed imports @workspace/shared from its build output
pnpm build:shared
# 3. reset, seed, apply RLS
cd apps/api
pnpm db:reset          # drops + migrates (+ runs the bootstrap seed)
pnpm db:seed           # full demo seed (permissions, roles, users, orgs, stores, …)
pnpm db:apply-security # RLS helpers, policies, grants
```

You do **not** need `npx prisma migrate reset`, `prisma migrate dev` **and** `pnpm db:reset`
together — `db:reset` already resets and migrates.

---

## 6. Migrations added by the authorization work

| Migration | What it adds |
|---|---|
| (in the current `…_init`) | `user_permissions.effect` (`AclEffect`, default `ALLOW`) |
| `20261001090000_stores_and_store_scope` | `StoreStatus` enum, `STORE` value on `PermissionResource` and `PermissionScope`, tables `stores` and `store_memberships` with indexes and foreign keys |

---

## 7. The two database clients

| Client | File | Connects as | RLS | Use for |
|---|---|---|---|---|
| `PrismaService` | `src/prisma/prisma.service.ts` | switches to the restricted `app_runtime` role on every checkout | ✅ enforced | **everything request-related** (and background work through system operations) |
| `SystemPrismaService` | `src/prisma/system-prisma.service.ts` | the `DATABASE_URL` owner, no role switch | ❌ ignored | only: permission-registry sync at startup, capability-catalog sync, authorization decision audit writes |

> [!WARNING]
> Never inject `SystemPrismaService` into feature code. If you think you need it, you almost
> certainly need a named system operation (`runWithSystemRlsContext` /
> `TenantTransactionService.withSystemOperation`) instead — that keeps the bypass explicit,
> allowlisted and auditable.
