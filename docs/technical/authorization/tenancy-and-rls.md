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
[ADR 017](../../adr/017-unified-request-context.md)) and used by the kernel and the RLS
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
| `app.current_api_key_id` | the verified merchant API key of an API-key request (`''` = none) |
| `app.current_api_key_location_id` | that key's store (`''` = organization-wide key) |

Queries on the shared pool (`PrismaService`) get these settings on every connection checkout
(`src/prisma/rls-pool.ts`), taken from an `AsyncLocalStorage` scope
(`src/prisma/rls-context.ts`). This RLS store is deliberately **separate** from the request
context: its bypass / system-operation scopes are transaction-scoped and nest (and exist in
queue jobs with no request at all). `RlsInterceptor` is the one place the request context
(verified tenant) feeds it — see [ADR 017](../../adr/017-unified-request-context.md). Which scope
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
| Handler, request authenticated by a merchant API key (`MerchantApiKeyGuard` POS routes, `@AllowApiKeyAuth()` routes) | `api_key`: the key, its organization, its store — no user | ❌ |
| `POST /pos/terminals/pair` (no key exists yet) | `pos.terminal.pair`, opened by `PosPairingService` | ✅ named system op |
| Handler, anonymous | no user | ❌ |
| BullMQ workers | one `queue.<job>` operation per queue | ✅ |
| `@Cron` maintenance | one `maintenance.<task>` operation per task | ✅ |
| Outbox event **inside** a domain transaction (`PlatformOutboxService.enqueueInTransaction`) | the caller's transaction session — `outbox_events_append` allows the INSERT without bypass | ❌ |
| Outbox telemetry with no domain write (`PlatformOutboxService.recordTelemetry`) | `outbox.enqueue` | ✅ |
| `TenantTransactionService.withTenantTransaction()` | the given user + organization, **transaction-local** | ❌ |
| `TenantTransactionService.withSystemOperation()` | the given operation, **transaction-local** | ✅ |

> [!IMPORTANT]
> RLS is the **final** boundary (spec §33, §51): if an application query forgets a filter,
> RLS still hides other tenants' rows. It is **not** the authorization engine (spec §52):
> business rules ("cashiers may refund up to 500") belong in the kernel.

### 3.1 System operations

A bypass is only possible for names in `SystemOperationSchema`
(`src/prisma/system-operation.registry.ts`) — a closed zod enum, so a name that is not
allowlisted does not compile, and `parseSystemOperation` rejects it at runtime. Each entry
names **one** purpose and the role it runs as. The database enforces it too:

- `app_rls_bypass()` is true only when `app.rls_bypass = true` **and** `app.system_operation`
  names an operation — an unnamed bypass is no bypass;
- the session switches to the operation's `role` (`SET ROLE`): `tenant.enumerate` runs as the
  read-only `app_enumerator` (SELECT on `organizations` only), everything else as `app_runtime`;
- policies can demand a specific operation — geo writes accept only `geo.reference_data.write`;
- every `withSystemOperation` call writes an `rls.system_operation` log line (operation, role,
  reason, actor, the request's real correlation id — callers cannot pass their own), and inside
  an HTTP request the operation is listed on the request's `audit_logs` row.

| Group | Operations |
|---|---|
| HTTP request phases | `request.pre_handler`, `route.rls_bypass`, `platform.superadmin`, `platform.staff_single_tenant` |
| Platform | `audit.http_request.record`, `http.idempotency`, `idempotency.retention`, `outbox.publish`, `outbox.enqueue`, `outbox.retention`, `tenant.enumerate`, `geo.reference_data.write` |
| Queues / cron (one per job) | `queue.email.send`, `queue.storage.*`, `queue.rewards.auto_publish`, `queue.claims.*`, `maintenance.*` |
| Organization, invitations, locations, encryption, support access, policy | one name per purpose, e.g. `organization.invitation.create`, `encryption.tenant_key.unwrap`, `support_access.verify`, `policy.publish` |
| Account security / bootstrap | `auth.profile.update`, `auth.mfa_recovery.*`, `auth.superadmin.bootstrap` and `reference_data.sync` (CLI/seed only; [runbook](../operations/superadmin-bootstrap.md)) — `auth.superadmin.bootstrap` (CLI only: the first SuperAdmin, [runbook](../operations/superadmin-bootstrap.md)) |
| Domain reads RLS cannot express | `rewards.sales.merchant_summary`, `files.authorization` |

The registry spec fails when an entry is unused, so dead allowlist entries cannot accumulate.

### 3.2 Running background work

```ts
import { runWithSystemRlsContext } from "../../../prisma/rls-context";

@Cron(CronExpression.EVERY_HOUR)
public async cleanup(): Promise<void> {
	await runWithSystemRlsContext("maintenance.audit_log_retention", async (): Promise<void> => this.runCleanup());
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
| `stores` | bypass, organization members, or active store members of that store | bypass, or a member of the session's tenant writing the mirror of one of that tenant's own locations (`stores_mirror_insert` / `stores_mirror_update` — the location write and its store mirror share one transaction); DELETE bypass only |
| `organization_access_requests` | bypass, tenant members, or the requester | INSERT: bypass or the requester; UPDATE (review): bypass only — the `organization.access_request.review` system operation |
| `store_memberships` | bypass, your own rows, or organization members | bypass only |

### 4.1 The merchant API key principal

An API-key request is a **machine principal**, not anonymous and not a bypass. The guard verifies
the key (in the `request.pre_handler` scope), binds it to the request context
(`RequestApiKeyPrincipal`: key id, organization, store), and `RlsInterceptor` turns it into the
`api_key` RLS context (`apiKeyRlsContext` in `src/prisma/rls-context.ts`; its session variables come
from the one `rlsSessionVariables`). `prisma/rls/40-api-key-principal.sql` adds permissive
policies for it — helpers `app_api_key_org_access(org)`, `app_api_key_store_access(org, store)`,
`app_api_key_reward_access(reward)`:

| Table | The key may | Limited to |
|---|---|---|
| `reward_sales`, `reward_redemptions` | read, insert | its organization **and** its store (a store-scoped key never sees another store's or a store-less row) |
| `organization_terminals` | read, update (last seen) | organization and store |
| `organization_api_keys` | read, update | **its own key row** only (last used, code-guess lockout) |
| `rewards`, `reward_location_scopes` | read, insert, update | its organization (store availability is enforced by the service) |
| `reward_claims`, `reward_referrals` | read, insert/update | claims and referrals of its organization's rewards |
| `reward_notifications` | insert | users who referred someone to one of its organization's rewards |
| `reward_audit_logs` | insert | its organization |
| `organizations`, `organization_locations`, `organization_assets`, `stored_files` | read | its organization (reward responses embed name, stores, logo) |

No policy lets a key DELETE anything, and a crafted id of another organization or store matches no
row (`test/api-key-rls-principal.e2e-spec.ts`). Published consumer rewards remain public
marketplace data for every session.

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
