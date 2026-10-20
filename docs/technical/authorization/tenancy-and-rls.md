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
| `Organization` | `Organization` | The tenant boundary (spec §35). |
| `OrganizationLocation` | `OrganizationLocation` | Where business happens. Existing rewards / terminals / API keys point here. |
| `Store` | `Store` | One per location (`locationId` is unique). Status `ACTIVE` only while the location is `ACTIVE` and not deleted. |
| `OrganizationMembership` | `OrganizationMembership` | "Alice belongs to Brew & Bean as CASHIER". Grants **no permissions** by itself. |
| `OrganizationMembershipLocationScope` | `OrganizationMembershipLocationScope` | Which locations an organization member may act in. |
| `StoreMembership` | `StoreMembership` | "Alice works at Store KL as **Store Staff**". The role's permissions apply **only in that store**. |

### Why both Store and Location?

`OrganizationLocation` already carried terminals, rewards, redemptions and API keys. Rather
than a risky rename, each location got a `Store` twin (spec §134 "reuse existing
conventions"). **Keep them in sync through the repository only:** every location write in
`OrganizationLocationRepository` calls `syncStoreForLocation()`
(`src/contexts/organizations/infrastructure/persistence/store-sync.ts`) **in the same transaction**, so a store
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

`AuthorizationContextResolver` (`src/contexts/authorization/infrastructure/kernel/authorization-context.resolver.ts`)
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
| `POST /pos/terminals/pair` (no key exists yet) | `pos.terminal.pair`, opened by pos's `PairTerminalHandler` | ✅ named system op |
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
- **a bypass reaches only the tables its operation lists.** Every policy admits a system operation
  through `(SELECT app_rls_bypass_on('<its own table>'))`, and `app_rls_bypass_on` is generated from
  each registry entry's `scope` into `prisma/rls/00-system-operation-scopes.sql`
  (`pnpm --filter @workspace/api db:generate-system-operation-scopes`; a spec fails when the file is
  stale). `outbox.publish` can read and write `OutboxEvent` and nothing else; an operation name the
  registry does not list bypasses nothing. The tenant/ownership helpers (`app_owns`,
  `app_tenant_*`, `app_organization_member_of`) never grant a bypass themselves;
- the session switches to the operation's `role` (`SET ROLE`): `tenant.enumerate` runs as the
  read-only `app_enumerator` (SELECT on `Organization` only), everything else as `app_runtime`;
- policies can demand a specific operation — geo writes accept only `geo.reference_data.write`;
- every `withSystemOperation` call writes an `rls.system_operation` log line (operation, role,
  reason, actor, the request's real correlation id — callers cannot pass their own), and inside
  an HTTP request the operation is listed on the request's `AuditLog` row.

| Group | Operations |
|---|---|
| HTTP request phases | `request.pre_handler`, `route.rls_bypass`, `platform.superadmin`, `platform.staff_single_tenant` |
| Platform | `audit.http_request.record`, `audit.http_request.read`, `audit.data_change.read`, `audit.trail.read`, `http.idempotency`, `idempotency.retention`, `outbox.publish`, `outbox.enqueue`, `outbox.retention`, `tenant.enumerate`, `geo.reference_data.write` |
| Queues / cron (one per job) | `queue.email.send`, `queue.storage.*`, `queue.rewards.auto_publish`, `queue.rewards.referral_credit_notify` (claims' referrer-credit email sweeper), `queue.claims.*`, `maintenance.*` |
| Organization, invitations, locations, encryption, support access, policy | one name per purpose, e.g. `organization.invitation.create`, `encryption.tenant_key.unwrap`, `support_access.verify`, `policy.publish` |
| Account security / bootstrap | `auth.profile.update`, `auth.signup_referrals.list_referees`, `auth.signup_referrals.notify_success` (ADR 035: the referrer's success notification, after checkout and from the hourly retry), `auth.mfa_recovery.*`, `auth.superadmin.bootstrap`, `authorization.capability_catalog.sync` (API boot: diff-only capability catalog sync) and `reference_data.sync` (CLI/seed only; [runbook](../operations/superadmin-bootstrap.md)) — `auth.superadmin.bootstrap` (CLI only: the first SuperAdmin, [runbook](../operations/superadmin-bootstrap.md)) |
| Domain reads RLS cannot express | `rewards.sales.merchant_summary`, `rewards.referral_credit.deliver` (claims requests a credited referrer's email after the checkout and from the sweeper: the till's key may not read the referrer's address), `files.authorization`, `files.delete` |
| Catalog | `catalog.product_catalog.read`, `catalog.product_catalog.write` (bypass-only `Product` and `SampleCategory` tables, after the permission check) |

The registry spec fails when an entry is unused, so dead allowlist entries cannot accumulate.

**Scope of each operation's bypass** (`scope` in the registry):

| Scope | Operations | Meaning |
|---|---|---|
| `tables(…)` | the platform plumbing and readers above (`audit.*`, `http.idempotency`, `idempotency.retention`, `outbox.*`, `email.log.write`, `queue.email.send`, `tenant.enumerate`, `tenancy.default_organization.verify`, `geo.reference_data.write`, `catalog.*`, `policy.bundle.load`, `github.webhook.*`, `encryption.tenant_key.*`, `support_access.verify`, `maintenance.authorization_change_sweep`) | the bypass reaches exactly the listed tables |
| `allTables: request_scope` | `request.pre_handler`, `route.rls_bypass`, `platform.superadmin`, `platform.staff_single_tenant` | request-wide: the route decides what it touches, so no fixed table set describes it |
| `allTables: not_yet_narrowed` | the remaining domain commands (organization, invitation, location, RBAC, policy, identity, claims, files, rewards, referral flows) | still every table: their writes span several contexts and every branch has not been verified against a declared set yet. Narrowing one is a `tables(…)` change in the registry plus a run of the API **and** browser e2e suites |

Narrow an operation by listing what it touches, including tables reached through Prisma `include`s
and through other contexts' transactional ports, and `OutboxEvent` when it raises outbox events.
A capture build of `app_rls_bypass_on` that logs `(operation, table)` instead of deciding is a quick
way to see an operation's footprint across the e2e suites; treat what it shows as a lower bound —
an unexercised branch is not in it.

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
| `Store` | bypass, organization members, or active store members of that store | bypass, or a member of the session's tenant writing the mirror of one of that tenant's own locations (`stores_mirror_insert` / `stores_mirror_update` — the location write and its store mirror share one transaction); DELETE bypass only |
| `OrganizationAccessRequest` | bypass, tenant members, or the requester | INSERT: bypass or the requester; UPDATE (review): bypass only — the `organization.access_request.review` system operation |
| `StoreMembership` | bypass, your own rows, or organization members | bypass only |

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
| `RewardSale`, `RewardRedemption` | read, insert | its organization **and** its store (a store-scoped key never sees another store's or a store-less row) |
| `OrganizationTerminal` | read, update (last seen) | organization and store |
| `OrganizationApiKey` | read, update | **its own key row** only (last used, code-guess lockout) |
| `Reward`, `RewardLocationScope` | read, insert, update | its organization (store availability is enforced by the service) |
| `RewardClaim`, `RewardReferral` | read, insert/update | claims and referrals of its organization's rewards |
| `RewardNotification` | insert | users who referred someone to one of its organization's rewards |
| `RewardAuditLog` | insert | its organization |
| `Organization`, `OrganizationLocation`, `OrganizationAsset`, `StoredFile` | read | its organization (reward responses embed name, stores, logo) |

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

`prisma/rls/apply.ts` runs the SQL files in `RLS_APPLY_ORDER`
(`prisma/rls/apply-plan.ts`). Each file:

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

The authorization tables (`UserPermission.effect`, `Store`, `StoreMembership`, the `STORE` value
of `PermissionResource` / `PermissionScope`, `ResourceAcl`, `PolicyDefinition`,
`AuthorizationAudit`) are part of the single baseline migration `20261004152638_init`
(`apps/api/prisma/migrations-baseline.json` records why the history was regenerated). New changes are
generated forward from `schema.prisma` ([Database](../database.md)).

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

---

## 8. Policy profiles and SQL helpers

Every Prisma table appears in exactly one **profile** of `RLS_MANIFEST_PROFILES`
(`apps/api/prisma/rls/manifest-index.ts`). A profile names the *shape* of the data, so a new table
copies a known policy instead of inventing one; `db:check-rls-manifest` fails on a table that is in
no profile.

| Profile | Use when the row… | Policy primitive |
|---|---|---|
| `ownership` | belongs to one user | `app_owns(user_id)` |
| `user_identity` | is the `User` row itself | `app_owns(id)` — the user's own row |
| `rbac_catalog` | is the global role / permission / policy catalogue | open `SELECT`; writes through system operations |
| `organization_tenant` | belongs to an organization, no branch scope | `app_tenant_organization_member_of(organization_id)` |
| `organization_location` | belongs to an organization **and** a location (terminals, API keys) | `app_tenant_row_org_location_access(organization_id, location_id)` |
| `reward_user` | is a customer's claim, sale, referral or notification | `app_owns(user_id)` for the customer, plus read policies for the reward's organization |
| `bypass_only` | is written by jobs or platform audit (outbox, inbox, `AuditLog`, `AuthorizationAudit`, …) | `app_rls_bypass_on('<table>')` only |
| `geo_reference`, `product_catalog`, `append_log`, `file_derived`, `authorization_simulation` | special-purpose tables | see the policies in `prisma/rls.sql` |

SQL helpers (all `STABLE`, granted to `app_runtime`; each returns `false` — never "allow all" — when
the session variables are missing). Only `app_rls_bypass()` / `app_rls_bypass_on()` ever admit a
system operation; the relationship helpers answer for the session's user and tenant alone:

| Helper | File | True when |
|---|---|---|
| `app_rls_bypass()` | `00-app-helpers.sql` | `app.rls_bypass` is set **and** an `app.system_operation` is named |
| `app_rls_bypass_on(table)` | `00-system-operation-scopes.sql` (generated) | `app_rls_bypass()` **and** the named operation's registry scope lists `table` — what every policy calls, as `(SELECT app_rls_bypass_on('<table>'))` |
| `app_current_user_id()`, `app_current_organization_id()` | `00-app-helpers.sql` | return the session values, `NULL` when unset |
| `app_owns(owner_id)` | `00-app-helpers.sql` | the row's owner is the session user |
| `app_organization_member_of(org)` | `01-acl-location-access.sql` | the user has an ACTIVE membership in `org`, whatever the session organization (ReBAC) |
| `app_tenant_organization_member_of(org)` | `01-acl-location-access.sql` | the session organization **is** `org` and the user is an ACTIVE member — prefer this for new tables |
| `app_tenant_org_member(org)` | `01-acl-location-access.sql` | either of the two above (older reward tables) |
| `app_tenant_has_location_access(loc)` | `01-acl-location-access.sql` | the location belongs to the session organization and the membership has an `ALL_LOCATIONS` scope row or a `SELECTED` row for it |
| `app_tenant_row_org_location_access(org, loc)` | `01-acl-location-access.sql` | the row's organization is the session organization and the user has scope for the row's location |
| `app_api_key_org_access(org)`, `app_api_key_store_access(org, store)`, `app_api_key_reward_access(reward)` | `40-api-key-principal.sql` | the [API-key principal](#41-the-merchant-api-key-principal) owns the row |

Membership helpers that read `OrganizationMembership` are `SECURITY DEFINER` with a pinned
`search_path`, because a plain function would recurse through that table's own policies. Keep
`SECURITY DEFINER` to such lookups.

The standard location-scoped policy, idempotent so `db:apply-security` can re-run it:

```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_tenant_acl ON public.orders;
CREATE POLICY orders_tenant_acl ON public.orders
  FOR ALL TO app_runtime
  USING (app_tenant_row_org_location_access(organization_id, location_id))
  WITH CHECK (app_tenant_row_org_location_access(organization_id, location_id));
```

- Name policies `<table>_<purpose>` so they can be found and dropped idempotently.
- Use `FOR ALL` only when reads and writes follow the same rule; split `SELECT` / `INSERT` /
  `UPDATE` otherwise (e.g. public catalogue rows).
- A new SQL file is `prisma/rls/NN-<name>.sql`, registered in `RLS_APPLY_ORDER`
  (`apps/api/prisma/rls/apply-plan.ts`); the plan rejects unregistered files and helpers used
  before the file that defines them. Never put RLS into `migrations/*/migration.sql`.
- Folder-level reference: `apps/api/prisma/rls/README.md`.

