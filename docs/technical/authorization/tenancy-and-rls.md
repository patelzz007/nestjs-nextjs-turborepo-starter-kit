---
title: "Tenancy, Locations and Row-Level Security"
tags: ["authorization", "multi-tenancy", "locations", "rls", "postgres", "prisma"]
description: "Tenants, stores, locations and memberships; how client tenant ids are verified; how PostgreSQL RLS knows who is asking; system operations; the two Prisma clients; and applying RLS safely."
order: 22
author: "Platform Team"
lastUpdated: 1792972800000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Tenancy, Locations and Row-Level Security

> [!NOTE]
> Read the [overview](./overview.md) and [backend guide](./backend.md) first.
> Paths are relative to `apps/api/`.

---

## 1. The tenant model

```text
Tenant  (the tenant — e.g. "Brew & Bean KL")
│
├── Location  (an operational site: terminals, rewards, redemptions happen here; also the authorization unit for location staff)
│
└── Membership  (user ↔ tenant, one tenant role: the tenant's copy of Owner / Manager / Cashier, or its own)
      └── MembershipLocationScope  (ALL_LOCATIONS, or one SELECTED location, optionally with a dynamic RBAC Role such as "Location Manager")
```

| Model                     | Table                     | Purpose                                                                                                                                                                          |
| ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tenant`                  | `Tenant`                  | The tenant boundary (spec §35).                                                                                                                                                  |
| `Location`                | `Location`                | Where business happens. Rewards, terminals, API keys and redemptions point here.                                                                                                 |
| `Membership`              | `Membership`              | "Alice belongs to Brew & Bean as CASHIER". Grants **no permissions** by itself.                                                                                                  |
| `MembershipLocationScope` | `MembershipLocationScope` | Which locations a member may act in. A `SELECTED` row may carry a `roleId`: "Alice works at KL as **Location Staff**" — that role's permissions apply **only at that location**. |

### One location model (Store merged into Location, 2026-10-21)

Earlier versions kept a `Store` twin per location (and `StoreMembership` for store roles), synced
from the location repository. The twin added nothing a location could not hold, so it was merged:
the `Store` / `StoreMembership` tables, the `STORE` permission scope and resource, the `x-store-id`
header and every `storeId` selector are gone. Location roles live on the member's location scope
row (`MembershipLocationScope.roleId`, `LOCATION` scope); the seeded roles are `Location Manager`
and `Location Staff`. Migration `20261020224859_merge_store_into_location_bans_and_appeals`.

---

## 2. Client tenant ids are requests, not facts

A client may say which tenant it is working in:

| Where        | Tenant        | Location      |
| ------------ | ------------- | ------------- |
| Route param  | `:tenantSlug` | `:locationId` |
| Query / body | —             | `locationId`  |

The tenant comes from `:tenantSlug` (or the single-mode default tenant), never from a header or a `tenantId` field.
`AuthorizationContextResolver` (`src/contexts/authorization/infrastructure/kernel/authorization-context.resolver.ts`)
reads the location (route, query or body) and asks `TenantMembershipService.verify()`:

| Claim    | Proven when                                                                                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant   | the deployment serves the tenant (single mode: only the default tenant, `ServedTenantPolicy`) and the user has an **ACTIVE**, non-deleted membership in it, or an approved support grant                                          |
| Location | the location belongs to the tenant **and** the membership has an `ALL_LOCATIONS` scope row or a `SELECTED` row for it (a membership **without** scope rows covers nothing — same rule as the DB helper `app_can_access_location`) |

### `X-Tenant-Id` and `X-Location-Id`: information only

The merchant console sends `X-Tenant-Id` (the open tenant) and `X-Location-Id` (the chosen store; absent for "All locations") on every call, from the browser and from its server-rendered pages alike (`loadTenantServerCaller`), and the mobile till sends its tenant and store with every POS call. **The API decides nothing from them**: they select, narrow and authorize nothing, so a forged value changes nothing (a key's call with another store's id answers exactly as without it). The audit trail records them as claims (`claimedTenantId`, `claimedLocationId`, next to the verified `tenantId` and `locationId`), so an investigator sees which tenant the client thought it was in and spots a mismatch. What else they should do is still to be decided. Until then, a location filter is the `locationId` route, query or body field, verified as above. Both headers are allowed by CORS (`src/bootstrap/cors-options.ts`) so the browser does not refuse the merchant console's requests.

What happens next:

| Case                                            | Result                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A **header** claim is not proven                | **403** immediately (forged tenant)                                                                                                                    |
| A header value is malformed (> 64 chars, empty) | **403**                                                                                                                                                |
| A route / body / query claim is not proven      | not trusted; only kept as a **resource attribute**. A `GLOBAL` permission may still act on another tenant's record; an `TENANT` / `STORE` one may not. |
| SuperAdmin                                      | may select any tenant                                                                                                                                  |

The verified result is bound into the request context (`RequestContextService.bindTenant`,
[ADR 017](../../adr/017-unified-request-context.md)) and used by the kernel and the RLS
interceptor. **Never read tenant ids from `request.headers` or the body yourself** — read
`requestContext.current()?.tenant` (verified ids only; absent = not requested or not proven).

---

## 3. PostgreSQL RLS — how the database knows who is asking

Every tenant table has RLS enabled and **forced** (`prisma/rls.sql`, helpers in
`prisma/rls/*.sql`). Policies compare rows with session settings:

| Setting                           | Meaning                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `app.current_user_id`             | the user the query runs for (`''` = nobody)                            |
| `app.current_tenant_id`           | the verified tenant                                                    |
| `app.rls_bypass`                  | `'true'` only for an allowlisted system operation                      |
| `app.system_operation`            | which system operation justified the bypass (for auditing / debugging) |
| `app.current_api_key_id`          | the verified merchant API key of an API-key request (`''` = none)      |
| `app.current_api_key_location_id` | that key's store (`''` = tenant-wide key)                              |

Queries take these settings from the transaction `TenantTransactionService` opens
(`src/prisma/tenant-transaction.service.ts`). Checkout of the shared pool
(`src/prisma/rls-pool.ts`) only switches the connection to `app_runtime`; it does
not copy the caller's user, tenant, or bypass onto the session. The settings are
transaction-local, so they end when the transaction ends and a pooled connection
cannot carry them to the next caller. The active scope still comes from
`src/prisma/rls-context.ts`. This RLS store is deliberately **separate** from the request
context: its bypass / system-operation scopes nest (and exist in
queue jobs with no request at all). `RlsInterceptor` is the one place the request context
(verified tenant) feeds it — see [ADR 017](../../adr/017-unified-request-context.md). Which scope
is active depends on **where** the code runs:

| Where the code runs                                                                                                  | RLS scope                                                                                                                | Bypass?                              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **Outside any scope** (should not happen)                                                                            | anonymous: no user, no tenant                                                                                            | ❌ **fails closed**                  |
| Guards                                                                                                               | the lookup they open (`auth.principal.lookup`, `auth.membership.lookup`, `auth.api_key.lookup`, `support_access.verify`) | ✅ only the tables that lookup lists |
| Handler, named platform operation                                                                                    | that operation                                                                                                           | ✅ only the tables it lists          |
| Handler, platform superadmin with no named operation                                                                 | the user's own scope                                                                                                     | no bypass                            |
| Handler, admin staff in **single-tenant** mode                                                                       | the user's tenant scope                                                                                                  | no bypass                            |
| Handler, normal signed-in user                                                                                       | user + verified tenant                                                                                                   | ❌                                   |
| Handler, refresh-token routes (refresh, logout)                                                                      | the token's user                                                                                                         | ❌                                   |
| Handler, request authenticated by a merchant API key (`MerchantApiKeyGuard` POS routes, `@AllowApiKeyAuth()` routes) | `api_key`: the key, its tenant, its store — no user                                                                      | ❌                                   |
| `POST /integration/terminals/pair` (no key exists yet)                                                               | `pos.terminal.pair`, opened by pos's `PairTerminalHandler`                                                               | ✅ named system op                   |
| Handler, anonymous                                                                                                   | no user                                                                                                                  | ❌                                   |
| BullMQ workers                                                                                                       | one `queue.<job>` operation per queue                                                                                    | ✅                                   |
| `@Cron` maintenance                                                                                                  | one `maintenance.<task>` operation per task                                                                              | ✅                                   |
| Outbox event **inside** a domain transaction (`PlatformOutboxService.enqueueInTransaction`)                          | the caller's transaction session — `outbox_events_append` allows the INSERT without bypass                               | ❌                                   |
| Outbox telemetry with no domain write (`PlatformOutboxService.recordTelemetry`)                                      | `outbox.enqueue`                                                                                                         | ✅                                   |
| `TenantTransactionService.withTenantTransaction()`                                                                   | the given user + tenant, **transaction-local**                                                                           | ❌                                   |
| `TenantTransactionService.withSystemOperation()`                                                                     | the given operation, **transaction-local**                                                                               | ✅                                   |

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
  `app_tenant_*`, `app_tenant_member_of`) never grant a bypass themselves;
- the session switches to the operation's `role` (`SET ROLE`): `tenant.enumerate` runs as the
  read-only `app_enumerator` (SELECT on `Tenant` only), everything else as `app_runtime`;
- policies can demand a specific operation — geo writes accept only `geo.reference_data.write`;
- every `withSystemOperation` call writes an `rls.system_operation` log line (operation, role,
  reason, actor, the request's real correlation id — callers cannot pass their own), and inside
  an HTTP request the operation is listed on the request's `AuditLog` row. An operation the registry
  marks `routine` (a poller on a short timer whether or not there is work — today only
  `outbox.publish`) writes that line at **debug** instead of info; it is still recorded.

**One name, one constant.** An operation name is written as a string once, in its definition. Code
imports a named constant: from the owning context's `application/ports/*.tokens.ts` (for example
`MERCHANT_ADMIN_READ_OPERATION` in `tenants.tokens.ts`), or from
`platform/application/shared-system-operations.ts` for an operation several contexts run under
(`auth.principal.lookup`, `auth.membership.lookup`, `files.authorization`, `support_access.verify`). The route decorator
(`@PlatformOperation(MERCHANT_ADMIN_READ_OPERATION)`) and the repositories that run under it import
the same constant, so they cannot drift apart. `system-operation-single-source.spec.ts` fails when a
name is written in a second file.

| Group                                                              | Operations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP request phases                                                | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Platform                                                           | `audit.http_request.record`, `audit.http_request.read`, `audit.data_change.read`, `audit.trail.read`, `http.idempotency`, `idempotency.retention`, `outbox.publish`, `outbox.enqueue`, `outbox.retention`, `tenant.enumerate`, `tenancy.default_tenant.verify`, `auth.membership.lookup`, `auth.api_key.lookup`, `geo.reference_data.write`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Queues / cron (one per job)                                        | `queue.email.send`, `queue.storage.cleanup`, `queue.storage.delete` (object storage and CDN only: its scope lists no table), `queue.rewards.auto_publish`, `queue.claims.*`, `maintenance.*`. The scan job runs as `files.scan_verdict.apply` and the referrer-credit email sweeper as `rewards.referral_credit.deliver`, the operations their work already is.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tenant, invitations, locations, encryption, support access, policy | one name per purpose, e.g. `tenant.invitation.create`, `tenant.onboarding.document_file`, `encryption.tenant_key.rewrap`, `support_access.verify`, `policy.publish`, `authorization.policy.match`, `authorization.acl.match`, `authorization.acl.write`, `authorization.superadmin_bypass.audit`, `authorization.health.system_roles`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Account security / bootstrap                                       | `auth.profile.update`, `auth.account.lookup`, `auth.admin_users.read`, `auth.admin_users.unlock`, `auth.principal.lookup`, `auth.merchant_portal.lookup`, `auth.login.record_failure`, `auth.login.clear_lockout`, `auth.login.open_challenge`, `auth.login.request_device_code`, `auth.login.complete_mfa`, `auth.login.record_mfa_failure`, `auth.session.issue`, `auth.password_reset.request`, `auth.password_reset.lookup`, `auth.password_reset.complete`, `auth.signup.register`, `auth.email_verification.send`, `auth.email_verification.confirm`, `auth.impersonation.start`, `auth.impersonation.stop`, `auth.signup_referrals.validate_code`, `auth.signup_referrals.list_referees`, `auth.signup_referrals.admin_summary`, `auth.signup_referrals.notify_success` (ADR 035: the referrer's success notification, after checkout and from the hourly retry), `auth.mfa_recovery.*`, `auth.superadmin.bootstrap`, `authorization.capability_catalog.sync` (API boot: diff-only capability catalog sync) and `reference_data.sync` (CLI/seed only; [runbook](../operations/superadmin-bootstrap.md)) — `auth.superadmin.bootstrap` (CLI only: the first SuperAdmin, [runbook](../operations/superadmin-bootstrap.md)) |
| Domain reads RLS cannot express                                    | `claims.otp.request`, `claims.reward.claim`, `rewards.sales.merchant_summary`, `rewards.referral_credit.deliver` (claims requests a credited referrer's email after the checkout and from the sweeper: the till's key may not read the referrer's address), `files.authorization`, `files.delete`, `files.local_object.read`, `files.local_variant.read`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Catalog                                                            | `catalog.product_catalog.read`, `catalog.product_catalog.write` (bypass-only `Product` and `SampleCategory` tables, after the permission check)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Kanban boards                                                      | `kanban.board.read`, `kanban.board.write` (bypass-only `KanbanPlanningColumn`, `KanbanExecutionColumn`, `KanbanLevelCounter` (write only), `KanbanTask`, `KanbanTaskComment`, `KanbanTaskAttachment`, `KanbanChecklistItem`, `KanbanTaskWatcher`, `KanbanTaskLink`, `KanbanTaskActivity`, plus `User` names and the attached `StoredFile` rows, after the KANBAN_TASK permission check); CLI only, `kanban.board.convert` (`pnpm db:kanban-convert`: the retired `KanbanColumn` and the conversion's `KanbanConversionStage` too); `files.delete` also reaches `KanbanTaskAttachment` to release an attached file's row and `KanbanTaskActivity` (+ `User`) to record it; the assignable people come from `authorization.permission_holders.read` (the RBAC tables, read by the authorization context)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CLI only                                                           | `seed.demo_dataset` (every `pnpm db:seed` connection, as `app_runtime`), `seed.test_fixture` (the two-tenant e2e fixture), `seed.github_link.carry`, `tenancy.data_check` (read-only, `pnpm tools db:check-tenant-integrity`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The registry spec fails when an entry is unused, so dead allowlist entries cannot accumulate.

Every scope is a declared table list (`TableName` is a Prisma model name, so a typo does not compile); no operation can reach every table (multi-tenancy plan D19, MT-47). A route names its operation with `@PlatformOperation` (admin console) or `@PublicOperation` (public flows), never both; coverage specs discover every controller route and fail on a missing or doubled declaration.

**Scope of each operation's bypass** (`scope` in the registry):

| Scope                         | Operations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Meaning                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tables(…)`                   | the platform plumbing and readers above (`audit.*`, `http.idempotency`, `idempotency.retention`, `outbox.*`, `email.log.write`, `notifications.email_log.list`, `notifications.health.email_log`, `queue.email.send`, `tenant.enumerate`, `tenancy.default_tenant.verify`, `auth.membership.lookup`, `auth.api_key.lookup`, `geo.reference_data.read`, `geo.reference_data.write`, `catalog.*`, `authorization.rbac.catalog.read`, `policy.bundle.load`, `github.webhook.*`, `encryption.tenant_key.*`, `support_access.verify`, `maintenance.authorization_change_sweep`, `seed.github_link.carry`) | the bypass reaches exactly the listed tables                                                                                                                                                                                    |
| `allTables: request_scope`    | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | no operation uses a request-wide bypass                                                                                                                                                                                         |
| `allTables: not_yet_narrowed` | the remaining domain commands (tenant, invitation, location, RBAC, policy, identity, claims, files, rewards, referral flows)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | still every table: their writes span several contexts and every branch has not been verified against a declared set yet. Narrowing one is a `tables(…)` change in the registry plus a run of the API **and** browser e2e suites |

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

## 4. Tenant RLS policies

| Table                    | Read                                                                                    | Write                                                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TenantAccessRequest`    | bypass, tenant members, or the requester                                                | INSERT: bypass or the requester; UPDATE (review): bypass only — the `tenant.access_request.review` system operation                                                                                                                          |
| `TenantSuspensionAppeal` | bypass, or members of the tenant                                                        | bypass only — the `tenant.lifecycle.*` system operations                                                                                                                                                                                     |
| `TenantCustomerBan`      | bypass, members of the tenant, or an API key of the tenant (`40-api-key-principal.sql`) | bypass only — `tenant.customer_ban.create` / `.lift` after the `merchant:manage_rewards` check. Claims (`claims.reward.claim`) and the tills read it to refuse a banned customer; the redemption log reads it under the member's own session |

### 4.0 Roles, grants and shares in Postgres (ADR 067)

RLS is the primary enforcer, and it decides with the same rules as the API's `AccessControlService`.
`prisma/rls/02-access-model.sql` defines two helpers, read by the policies in `prisma/rls.sql`:

- `app_has_permission(resource, action, tenant, store)` — the caller's **active** membership in the
  tenant whose tenant role holds `resource.action` (role path), or a live grant of it (grant path, a
  store-limited grant only at that store and never for a tenant-level record); either way only inside
  the membership's stores. `store` NULL is a tenant-level record. A session bound to tenant A never
  reaches tenant B.
- `app_shared(resource, id, level)` — one record shared with the caller's active membership, unexpired,
  at `level` or higher (EDIT includes VIEW).

| Table | Read | Write |
| --- | --- | --- |
| `Reward` | `reward.read`, a VIEW share of that reward, published consumer rewards, a claim holder's own reward | insert `reward.create`; update `reward.update` / `reward.publish` or an EDIT share; delete `reward.delete` |
| `RewardClaim` | the customer's own claims; merchant members with `claim.read` | the customer's own claim, or system flows |
| `RewardRedemption` | the customer's own; members with `redemption.read` **at the redemption's store** | system flows only |
| `ResourceAcl` (shares) | the shares made to the caller; everyone's with `member.read` | system operation only |
| `Role`, `RolePermission` | the platform catalogue and templates; a tenant's own roles to its members only | system operation only (`authorization.tenant_access.write`) |

### 4.1 The merchant API key principal

An API-key request is a **machine principal**, not anonymous and not a bypass. The guard verifies
the key (under `auth.api_key.lookup`), binds it to the request context
(`RequestApiKeyPrincipal`: key id, tenant, location), and `RlsInterceptor` turns it into the
`api_key` RLS context (`apiKeyRlsContext` in `src/prisma/rls-context.ts`; its session variables come
from the one `rlsSessionVariables`). `prisma/rls/40-api-key-principal.sql` adds permissive
policies for it — helpers `app_api_key_org_access(org)`, `app_api_key_store_access(org, store)`,
`app_api_key_reward_access(reward)`:

| Table                                                   | The key may              | Limited to                                                                                                   |
| ------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `RewardSale`, `RewardRedemption`                        | read, insert             | its tenant **and** its location (a location-scoped key never sees another location's or a location-less row) |
| `TenantTerminal`                                        | read, update (last seen) | tenant and location                                                                                          |
| `TenantApiKey`                                          | read, update             | **its own key row** only (last used, code-guess lockout)                                                     |
| `Reward`, `RewardLocationScope`                         | read, insert, update     | its tenant (store availability is enforced by the service)                                                   |
| `RewardClaim`, `RewardReferral`                         | read, insert/update      | claims and referrals of its tenant's rewards                                                                 |
| `RewardNotification`                                    | insert                   | users who referred someone to one of its tenant's rewards                                                    |
| `RewardAuditLog`                                        | insert                   | its tenant                                                                                                   |
| `Tenant`, `TenantLocation`, `TenantAsset`, `StoredFile` | read                     | its tenant (reward responses embed name, stores, logo)                                                       |

No policy lets a key DELETE anything, and a crafted id of another tenant or location matches no
row (`test/api-key-rls-principal.e2e-spec.ts`). Published consumer rewards remain public
marketplace data for every session.

Every new tenant table must be added to `prisma/rls/manifest-index.ts` and get policies in
`prisma/rls.sql`. `pnpm --filter @workspace/api db:check-rls-manifest` fails if a table is
missing. See [recipes → add a tenant table](./recipes.md#7-add-a-new-tenant-table-with-rls).

**Dynamic roles never create RLS policies** (spec §50). RLS protects stable concepts — tenant,
location, user — and reads roles, grants and shares as *data* through the two helpers above, so a role
a tenant creates or edits needs no new policy.

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
pnpm tools build:shared
# 3. reset, seed, apply RLS
cd apps/api
pnpm db:reset          # drops + migrates (+ runs the bootstrap seed)
pnpm db:seed           # full demo seed (permissions, roles, users, tenants, locations, …)
pnpm tools db:apply-security # RLS helpers, policies, grants
```

You do **not** need `npx prisma migrate reset`, `prisma migrate dev` **and** `pnpm db:reset`
together — `db:reset` already resets and migrates.

---

## 6. Migrations added by the authorization work

The authorization tables (`UserPermission`, `ResourceAcl`, `AuthorizationAudit`) are part of the single baseline migration `20261004152638_init`
(`apps/api/prisma/migrations-baseline.json` records why the history was regenerated). New changes are
generated forward from `schema.prisma` ([Database](../database.md)). The Store → Location merge,
user bans and suspension appeals are `20261020224859_merge_store_into_location_bans_and_appeals`.

---

## 7. The two database clients

| Client                | File                                  | Connects as                                                     | RLS         | Use for                                                                                                 |
| --------------------- | ------------------------------------- | --------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `PrismaService`       | `src/prisma/prisma.service.ts`        | switches to the restricted `app_runtime` role on every checkout | ✅ enforced | **everything request-related** (and background work through system operations)                          |
| `SystemPrismaService` | `src/prisma/system-prisma.service.ts` | the `DATABASE_URL` owner, no role switch                        | ❌ ignored  | only: permission-registry sync at startup, capability-catalog sync, authorization decision audit writes |

> [!WARNING]
> Never inject `SystemPrismaService` into feature code. If you think you need it, you almost
> certainly need a named system operation (`runWithSystemRlsContext` /
> `TenantTransactionService.withSystemOperation`) instead — that keeps the bypass explicit,
> allowlisted and auditable.

---

## 8. Policy profiles and SQL helpers

Every Prisma table appears in exactly one **profile** of `RLS_MANIFEST_PROFILES`
(`apps/api/prisma/rls/manifest-index.ts`). A profile names the _shape_ of the data, so a new table
copies a known policy instead of inventing one; `db:check-rls-manifest` fails on a table that is in
no profile.

| Profile                                                                                      | Use when the row…                                                                         | Policy primitive                                                                 |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ownership`                                                                                  | belongs to one user                                                                       | `app_owns(user_id)`                                                              |
| `user_identity`                                                                              | is the `User` row itself                                                                  | `app_owns(id)` — the user's own row                                              |
| `rbac_catalog`                                                                               | is the global role / permission / policy catalogue                                        | open `SELECT`; writes through system operations                                  |
| `tenant_tenant`                                                                              | belongs to a tenant, no branch scope                                                      | `app_tenant_tenant_member_of(tenant_id)`                                         |
| `tenant_location`                                                                            | belongs to a tenant **and** a location (terminals, API keys)                              | `app_tenant_row_org_location_access(tenant_id, location_id)`                     |
| `reward_user`                                                                                | is a customer's claim, sale, referral or notification                                     | `app_owns(user_id)` for the customer, plus read policies for the reward's tenant |
| `bypass_only`                                                                                | is written by jobs or platform audit (outbox, inbox, `AuditLog`, `AuthorizationAudit`, …) | `app_rls_bypass_on('<table>')` only                                              |
| `geo_reference`, `product_catalog`, `append_log`, `file_derived`, `authorization_simulation` | special-purpose tables                                                                    | see the policies in `prisma/rls.sql`                                             |

SQL helpers (all `STABLE`, granted to `app_runtime`; each returns `false` — never "allow all" — when
the session variables are missing). Only `app_rls_bypass()` / `app_rls_bypass_on()` ever admit a
system operation; the relationship helpers answer for the session's user and tenant alone:

| Helper                                                                                                     | File                                         | True when                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_rls_bypass()`                                                                                         | `00-app-helpers.sql`                         | `app.rls_bypass` is set **and** an `app.system_operation` is named                                                                                  |
| `app_rls_bypass_on(table)`                                                                                 | `00-system-operation-scopes.sql` (generated) | `app_rls_bypass()` **and** the named operation's registry scope lists `table` — what every policy calls, as `(SELECT app_rls_bypass_on('<table>'))` |
| `app_current_user_id()`, `app_current_tenant_id()`                                                         | `00-app-helpers.sql`                         | return the session values, `NULL` when unset                                                                                                        |
| `app_owns(owner_id)`                                                                                       | `00-app-helpers.sql`                         | the row's owner is the session user                                                                                                                 |
| `app_tenant_member_of(org)`                                                                                | `01-acl-location-access.sql`                 | the user has an ACTIVE membership in `org`, whatever the session tenant (ReBAC)                                                                     |
| `app_tenant_tenant_member_of(org)`                                                                         | `01-acl-location-access.sql`                 | the session tenant **is** `org` and the user is an ACTIVE member — prefer this for new tables                                                       |
| `app_tenant_org_member(org)`                                                                               | `01-acl-location-access.sql`                 | either of the two above (older reward tables)                                                                                                       |
| `app_tenant_has_location_access(loc)`                                                                      | `01-acl-location-access.sql`                 | the location belongs to the session tenant and the membership has an `ALL_LOCATIONS` scope row or a `SELECTED` row for it                           |
| `app_tenant_row_org_location_access(org, loc)`                                                             | `01-acl-location-access.sql`                 | the row's tenant is the session tenant and the user has scope for the row's location                                                                |
| `app_api_key_org_access(org)`, `app_api_key_store_access(org, store)`, `app_api_key_reward_access(reward)` | `40-api-key-principal.sql`                   | the [API-key principal](#41-the-merchant-api-key-principal) owns the row                                                                            |

Membership helpers that read `TenantMembership` are `SECURITY DEFINER` with a pinned
`search_path`, because a plain function would recurse through that table's own policies. Keep
`SECURITY DEFINER` to such lookups.

The standard location-scoped policy, idempotent so `db:apply-security` can re-run it:

```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_tenant_acl ON public.orders;
CREATE POLICY orders_tenant_acl ON public.orders
  FOR ALL TO app_runtime
  USING (app_tenant_row_org_location_access(tenant_id, location_id))
  WITH CHECK (app_tenant_row_org_location_access(tenant_id, location_id));
```

- Name policies `<table>_<purpose>` so they can be found and dropped idempotently.
- Use `FOR ALL` only when reads and writes follow the same rule; split `SELECT` / `INSERT` /
  `UPDATE` otherwise (e.g. public catalogue rows).
- A new SQL file is `prisma/rls/NN-<name>.sql`, registered in `RLS_APPLY_ORDER`
  (`apps/api/prisma/rls/apply-plan.ts`); the plan rejects unregistered files and helpers used
  before the file that defines them. Never put RLS into `migrations/*/migration.sql`.
- Folder-level reference: `apps/api/prisma/rls/README.md`.
