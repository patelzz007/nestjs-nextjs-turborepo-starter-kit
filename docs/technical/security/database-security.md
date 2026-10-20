---
title: "Database security: RLS, roles and system operations"
description: "How PostgreSQL row-level security backs every request: database roles, session settings, the API-key principal, allow-listed system operations and withheld privileges."
order: 31
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&h=630&fit=crop"
tags: ["security", "rls", "postgres", "tenancy"]
---

# Database security: RLS, roles and system operations

Authorization in the API decides **whether** an action is allowed; PostgreSQL row-level security
decides **which rows** a database session can touch. Each layer is necessary, neither is
sufficient: RBAC without RLS lets an ORM bug leak rows; RLS without RBAC lets an authorized user call
a forbidden action. The full model (tenants, stores, policies per table) is in
[Tenancy and RLS](../authorization/tenancy-and-rls.md); this page is the security checklist.

## Principals

| Principal | Database role | Session settings | Used by |
| --- | --- | --- | --- |
| Signed-in user | `app_runtime` (NOLOGIN, NOBYPASSRLS) | `app.current_user_id`, `app.current_tenant_id` | Every authenticated request |
| Anonymous | `app_runtime` | none | Public routes |
| **Merchant API key** | `app_runtime` | `app.current_tenant_id`, `app.current_api_key_id`, `app.current_api_key_location_id` (`''` = tenant-wide) | POS and integration routes ([Tenancy §4.1](../authorization/tenancy-and-rls.md#41-the-merchant-api-key-principal)) |
| System operation | `app_runtime` or `app_enumerator` | `app.rls_bypass` + `app.system_operation = <name>` | Allow-listed background / cross-tenant work |
| Analytics consumer | `analytics_consumer` (own LOGIN) | — | `apps/analytics-consumer` only |

The API-key principal gets **additional** permissive policies (`prisma/rls/40-api-key-principal.sql`):
exactly its tenant's rows, and for store-owned tables (redemptions, sales, terminals) only its
store's rows when the key is store-scoped. It never deletes anything and has **no RLS bypass**.

## Session settings are transaction-local

`TenantTransactionService` sets `app.*` with `set_config(..., true)` inside the same transaction as
the queries ([ADR 010](../../adr/010-rls-transaction-contract.md)). Helpers
(`app_current_user_id()`, `app_current_tenant_id()`, …) return `NULL` when unset, and
policies treat `NULL` as **no access** — missing context fails closed.

## Rows readable through something the user owns

A row a user owns can keep another row readable to them after it stops being public. `rewards_read`
lets anyone read a **published** consumer reward, the reward's tenant members read all of its
rewards, and — through `app_holds_reward_claim(reward_id)` — **a user who holds a claim reads the
reward they claimed, whatever its state now** (expired, disabled, archived, soft-deleted), so the
wallet and claim history can still name it. Nobody else gains access: a user with no claim, or a
session with no user, still sees only published rewards (`test/rls-hardening.e2e-spec.ts`).

A helper like this that reads another RLS table is `SECURITY DEFINER` with a pinned `search_path`:
policies on the two tables reference each other (`reward_claims_merchant_read` reads `Reward`), and
Postgres rejects a policy cycle. The helper must stay fail-closed on a missing `app.current_user_id`.

## System operations (the only bypass)

`apps/api/src/prisma/system-operation.registry.ts` is the closed allow-list of work that may bypass
RLS ([ADR 012](../../adr/012-system-operations.md)). Each name has one purpose and the narrowest role:

- code obtains the bypass only through `withSystemOperation({ operation, reason, actorUserId })`
  (a route cannot opt into every table);
- `app_rls_bypass()` refuses a bypass that does not name its operation;
- every use is logged (`rls.system_operation`) and recorded in the request's audit entry.

Adding one: add the name to `SystemOperationSchema` and `SYSTEM_OPERATIONS` (a missing definition
is a compile error), pick `app_enumerator` when read-only cross-tenant access suffices, and
document it in [Tenancy §3.1](../authorization/tenancy-and-rls.md#31-system-operations).

## Withheld privileges

`apps/api/prisma/rls/withheld-privileges.ts` is the one list of privileges `app_runtime` must not
hold even though `99-app-runtime-grants.sql` grants DML on every table:

| Tables | Withheld | Why |
| --- | --- | --- |
| `AuditLog`, `DataChangeLog`, `ImpersonationAuditLog`, `MfaRecoveryAuditLog` | `UPDATE`, `DELETE` | Append-only audit trails |
| `ImpersonationSession`, `Region`, `Subregion`, `Country`, `State`, `City` | `DELETE` | Never hard-deleted |

`db:apply-security` revokes them in the same transaction as the blanket grant and verifies the live
catalog; `db:check-rls-manifest` rejects unknown tables and hand-written `REVOKE … FROM app_runtime`.

## How the API connects

`DATABASE_URL` usually names the database owner or a superuser, and **superusers bypass RLS even
with `FORCE ROW LEVEL SECURITY`**. So the API never queries as that user:

- `PrismaService` is a Prisma 7 client on the `PrismaPg` driver adapter over `RlsPool`
  (`apps/api/src/prisma/rls-pool.ts`, a `pg.Pool` subclass). `DB_POOL_MAX` (default 10, minimum 2) is
  the replica's whole connection budget: `databasePoolBudget` (`apps/api/src/prisma/prisma-client-setup.ts`)
  gives the system pool 1 connection (2 from a budget of 10) and this request pool the rest.
- Every checkout runs `applyRlsSession`: `SET ROLE` to the scope's role (`app_runtime`, or a system
  operation's narrower role) and sets every `app.*` variable from the current RLS context — so a
  pooled connection never carries the previous request's identity. Inside a transaction,
  `TenantTransactionService` then sets the same variables transaction-locally (above).
- A user-scoped checkout in multi-tenant mode with no tenant fails fast
  (`Tenant database access requires tenant context`) instead of running unscoped.
- `schema.prisma` declares only the provider; the Prisma CLI reads the URL from
  `apps/api/prisma.config.ts`, which loads `apps/api/.env`.
- `SystemPrismaService` and the seeder connect as the `DATABASE_URL` user **without** a role switch;
  they are limited to the uses listed in [Tenancy §7](../authorization/tenancy-and-rls.md#7-the-two-database-clients).

**`permission denied for schema public` (`42501`, Prisma `P2039`).** `app_runtime` is a cluster-wide
role and survives `DROP DATABASE`, but `USAGE` on `public` and the table grants are per database. A
bare `prisma migrate reset` recreates the schema without them. Re-apply the security layer with
`pnpm --filter @workspace/api db:apply-security`, and prefer `pnpm db:reset`, which chains it.

## Golden rules

1. **No RLS policy per application role.** Policies use user id, tenant id and store scope —
   never role names like `Cashier`. Creating or changing a role is data, not a migration.
2. **Fail closed.** Missing session context never widens access.
3. **Same transaction.** Settings and queries share one transaction.
4. **Minimize bypass.** Every system operation is an audited exception.
5. **`FORCE ROW LEVEL SECURITY`** on tenant tables, so table owners cannot skip policies.
6. **`SECURITY DEFINER` sparingly**, only for membership lookups that would recurse, with
   `search_path` pinned.
7. **Idempotent SQL** (`DROP POLICY IF EXISTS`, `CREATE OR REPLACE`) so `db:apply-security` can run
   any time; it runs automatically after every migrate/deploy/reset/push.
8. **`TENANCY_ENABLED=true` for multi-tenant SaaS**: staff with admin access then no longer bypass
   RLS ([ADR 007](../../adr/007-tenancy-and-rls-bypass.md)).
9. **Every new table** gets an RLS manifest entry and a policy profile, and a test in
   `apps/api/test/rls-hardening.e2e-spec.ts` (cross-org denial) when it holds tenant data.

## Related

[Database](../database.md) · [Threat model](./threat-model.md) ·
[Data classification](./data-classification.md) · `apps/api/prisma/rls/README.md`

## Row-level data-change trail (ADR 051)

Every table in `public` except the declared exemptions carries two triggers, generated and
installed by `pnpm db:apply-security` (`prisma/rls/data-change-capture.ts`):

- `data_change_capture` (AFTER INSERT / UPDATE / DELETE, per row) and
  `data_change_capture_truncate` (AFTER TRUNCATE, per statement) append one `DataChangeLog`
  row per change **in the same transaction** — a change and its record commit or roll back together.
- The trigger function is `SECURITY INVOKER`: `databaseRole` is the role that really wrote the
  row (`app_runtime`, a system operation's role, the owner during a migration or a manual `psql`
  session). The attribution — user, tenant, API key, system operation, purpose, correlation
  id — is read from the same `app.*` session variables the RLS policies read.
- `DataChangeLog` accepts an INSERT only while a trigger runs (`pg_trigger_depth() > 0`); the
  application role cannot create functions or triggers, so it can neither forge nor pre-write a
  record. UPDATE / DELETE are withheld (append-only); SELECT is bypass-only
  (`audit.data_change.read`).
- Capture is the default: a table created by a later migration is captured on the next apply.
  Leaving one out takes an entry in `DATA_CHANGE_CAPTURE_EXEMPTIONS` with a reason, and every
  column whose name looks like secret material must be classified (`DATA_CHANGE_SECRET_COLUMNS`
  → `[REDACTED]`, or `DATA_CHANGE_NON_SECRET_COLUMNS` with the reason) — the apply and the unit
  suite fail otherwise.
- A role that writes a captured table must hold INSERT on `DataChangeLog` (`app_runtime` does
  through the blanket grant). The analytics consumer's role writes only exempt tables; if it ever
  writes a captured one its write fails until it is granted — fail closed, never unrecorded.

