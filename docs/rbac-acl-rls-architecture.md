---
title: "RBAC, ACL, and RLS"
tags: ["security", "rbac", "rls", "multi-tenancy", "authorization"]
description: "How this template separates RBAC, ACL scope, and PostgreSQL RLS — and how to extend it without editing migration SQL."
author: "Platform Team"
lastUpdated: 1789500000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# RBAC, ACL, and RLS

This starter implements a **production-oriented authorization model** for NestJS + Prisma + PostgreSQL. The layers are related but **not interchangeable**.

```text
Authentication → RBAC (action?) → ACL (scope?) → DB context → PostgreSQL RLS → rows
```

| Layer | Question | Where it lives |
|-------|----------|----------------|
| **RBAC** | Can the user perform this action? | `roles`, `permissions`, `role_permissions`, `user_roles` — **data**, not migrations |
| **ACL** | Which org / locations may they touch? | `organization_memberships`, `organization_membership_location_scopes` |
| **RLS** | Which rows may this DB session read/write? | `apps/api/prisma/rls.sql` + `apps/api/prisma/rls/*.sql` |

## Golden rules

1. **Never create RLS policies per application role** (Admin, Cashier, Manager). Policies use **user id**, **organization id**, and **location scope** — not role names.
2. **Creating or editing a role** is `INSERT`/`UPDATE` on RBAC tables only — no migration, no RLS change, no deploy.
3. **Do not put permissions in the JWT** — resolve at guard time from the database (see [Authorization & RBAC](./authorization.md)).
4. **Fail closed** — missing `app.current_user_id` / `app.current_organization_id` must not widen access.
5. **Same transaction** — `set_config(..., true)` and tenant queries run inside `TenantTransactionService` (`apps/api/src/prisma/tenant-transaction.service.ts`).

## Migrations vs RLS (template workflow)

Prisma migrations contain **tables, indexes, constraints** only.

RLS lives in:

- `apps/api/prisma/rls.sql` — main idempotent bundle
- `apps/api/prisma/rls/*.sql` — ordered extensions (e.g. ACL helpers)
- `apps/api/prisma/rls/table-manifest.ts` — guide for which profile new tables use

Applied automatically when you run:

```bash
pnpm db:migrate    # dev
pnpm db:deploy     # production
pnpm db:reset      # drop + migrate + apply security + seed
```

There is **no separate manual RLS step** after reset when using these commands. (`db:rls` is an alias for `db:apply-security`.)

**Do not** append RLS to `migrations/*/migration.sql`. If you delete `migrations/` and run `prisma migrate dev`, only schema SQL is regenerated — RLS is reapplied from `prisma/rls*`.

Details: [apps/api/prisma/rls/README.md](../apps/api/prisma/rls/README.md).

## Session variables

| PostgreSQL setting | Set by |
|--------------------|--------|
| `app.current_user_id` | Tenant / system transactions |
| `app.current_organization_id` | Tenant transactions |
| `app.rls_bypass` | System operations + `@RlsBypass()` routes |

SQL helpers (non-exhaustive):

| Function | Purpose |
|----------|---------|
| `app_rls_bypass()` | Trusted system path |
| `app_owns(owner_id)` | User-owned rows |
| `app_organization_member_of(org_id)` | Membership in org (any active tenant) |
| `app_tenant_organization_member_of(org_id)` | Active org context + membership |
| `app_tenant_has_location_access(location_id)` | ACL: org + location scope |
| `app_tenant_row_org_location_access(org_id, location_id)` | Row carries org + location |

Location scope rows use `ALL_LOCATIONS` or `SELECTED` (see `buildMembershipLocationScopeRows` in the API).

## Example: new location-scoped table

1. Add model in `schema.prisma` with `organizationId` + `locationId`.
2. Add table name to `RLS_ORGANIZATION_LOCATION_TABLES` in `table-manifest.ts`.
3. In `rls.sql` (or a new `prisma/rls/NN-*.sql` fragment), enable RLS and add policies using `app_tenant_row_org_location_access(organization_id, location_id)`.
4. `pnpm db:migrate` — schema + security apply together.
5. Expose endpoints with `@RequirePermission(...)` — assign permissions to roles via admin UI/seed.

## RBAC in this repo

- Decorator: `@RequirePermission(action, resource)` on controllers
- Guard: `AuthorizationGuard` + `AuthorizationCheckerService`
- Permission catalog: `packages/shared/src/schemas/domain/rbac/`
- Seed: `apps/api/prisma/seed/permissions.ts`, `roles.ts`

## ACL in this repo

- Organization membership: `OrganizationMembership`
- Branch/location scope: `OrganizationMembershipLocationScope`
- Team invites store intended scope on `OrganizationInvitation` + `OrganizationInvitationLocationScope`

RLS enforces scope; the app must still validate business rules.

## Hardening (defense in depth)

Treat each layer as **necessary but not sufficient**. RBAC without RLS still allows ORM bugs to leak rows; RLS without RBAC still allows authorized users to call forbidden actions.

### Application layer

| Practice | Why |
|----------|-----|
| **`@RequirePermission` on every mutating route** | RBAC is the product contract; RLS is the safety net. |
| **`withTenantTransaction` for tenant data** | `set_config(..., true)` must share the same transaction as queries ([`tenant-transaction.service.ts`](../apps/api/src/prisma/tenant-transaction.service.ts)). |
| **Minimize `@RlsBypass()`** | Each bypass is a audited exception; prefer [`SYSTEM_OPERATIONS`](../apps/api/src/prisma/system-operation.registry.ts) + `runWithSystemOperation` for jobs. |
| **`TENANCY_ENABLED=true` in real SaaS** | Stops `hasAdminAccess` from bypassing RLS ([ADR 007](./adr/007-tenancy-and-rls-bypass.md)). |
| **Resolve permissions from DB, not JWT** | Roles change without redeploy; tokens must not embed capability lists. |
| **ACL in app + RLS in DB** | e.g. reject `locationId` the user cannot access **before** insert; RLS blocks reads/writes if the app slips. |

### Database layer

| Practice | Why |
|----------|-----|
| **`FORCE ROW LEVEL SECURITY`** | Table owners cannot accidentally skip policies. |
| **`app_runtime` with `NOBYPASSRLS`** | API connections use `SET ROLE app_runtime`; bypass only via `app.rls_bypass`, not superuser. |
| **Fail-closed helpers** | `app_current_user_id()` / `app_current_organization_id()` return NULL when unset — policies must not treat NULL as “allow all”. |
| **`SECURITY DEFINER` sparingly** | Only for membership lookups that would recurse through RLS (see `app_organization_member_of` in `rls.sql`). Keep `search_path` pinned. |
| **No role names in SQL** | `Cashier`, `MANAGE:ORDERS`, etc. belong in RBAC tables — not in `CREATE POLICY`. |
| **Idempotent SQL** | `DROP POLICY IF EXISTS` + `CREATE OR REPLACE FUNCTION` so `db:apply-security` is safe to re-run. |

### Operations and CI

| Practice | Why |
|----------|-----|
| **Chain security on migrate/deploy/reset** | Never rely on humans running RLS after Prisma (`pnpm db:migrate`, `db:deploy`, `db:reset`). |
| **Extend [`rls-hardening.e2e-spec.ts`](../apps/api/test/rls-hardening.e2e-spec.ts)** | Prove cross-org denial, bypass-only tables, and (when you add location tables) ACL scope. |
| **Extend [`organization-isolation.e2e-spec.ts`](../apps/api/test/organization-isolation.e2e-spec.ts)** | ABAC / scope templates stay aligned with membership models. |
| **Review new tables** | Every new model must appear in RLS enable list + a policy profile (see manifest below). |

## Making it generic (extension playbook)

Goal: new domains (orders, inventory, billing) copy a **profile**, not invent policy shapes.

### 1. Pick a manifest profile

[`table-manifest.ts`](../apps/api/prisma/rls/table-manifest.ts) lists table names by **data shape**, not by feature:

| Profile | Use when | SQL primitive |
|---------|----------|----------------|
| `RLS_OWNERSHIP_TABLES` | Row has `user_id` / owner | `app_owns(...)` |
| `RLS_RBAC_CATALOG_TABLES` | Global permission catalog | Open `SELECT`, writes via bypass |
| `RLS_ORGANIZATION_TENANT_TABLES` | Org boundary, no branch ACL | `app_tenant_organization_member_of(org_id)` |
| `RLS_ORGANIZATION_LOCATION_TABLES` | Org + branch | `app_tenant_row_org_location_access(org_id, location_id)` |
| `RLS_BYPASS_ONLY_TABLES` | Jobs, outbox, platform audit | `app_rls_bypass()` only |

Add the Prisma `@@map` table name to the right array so reviewers see intent in one place.

### 2. Wire schema → SQL → API in order

1. **Prisma** — columns match the profile (`organizationId`, `locationId`, indexes).
2. **RLS** — `ENABLE` + `FORCE` RLS; `USING` / `WITH CHECK` from the profile.
   - Core tables: often `rls.sql`.
   - New families: `prisma/rls/02-<domain>.sql` (runs **after** `01-acl-location-access.sql` helpers).
3. **`pnpm db:migrate`** — schema + security.
4. **Shared Zod** — `packages/shared` permission + DTO schemas.
5. **Nest** — `@RequirePermission` + `withTenantTransaction` in repositories/services.

### 3. Standard policy template (location-scoped)

```sql
-- prisma/rls/02-orders.sql (example)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_tenant_acl ON public.orders;
CREATE POLICY orders_tenant_acl ON public.orders
  FOR ALL
  TO app_runtime
  USING (app_tenant_row_org_location_access(organization_id, location_id))
  WITH CHECK (app_tenant_row_org_location_access(organization_id, location_id));
```

Use `FOR ALL` only when read and write rules match; split `SELECT` vs `INSERT` when they diverge (e.g. public catalog rows).

### 4. Consolidate helpers, not policies

- **One** `app_tenant_has_location_access` (ACL) — already in `01-acl-location-access.sql`.
- **One** tenant org helper — prefer `app_tenant_organization_member_of` for multi-tenant session org; legacy `app_organization_member_of` exists for some reward tables — new work should use the tenant-scoped helper when `app.current_organization_id` must match.
- **Many** thin policies that call helpers — that is the generic part.

### 5. RBAC stays data-driven

Adding `ORDER.CANCEL` or a role `StoreManager`:

- Seed / admin API → `permissions`, `role_permissions`, `user_roles`.
- **No** migration, **no** RLS edit.

### 6. Optional hardening extras (when you outgrow the template)

| Enhancement | Purpose |
|-------------|---------|
| **Manifest drift check** | `pnpm db:check-rls-manifest` — Prisma models must match `prisma/rls/manifest-index.ts` and RLS enable lists. |
| **Policy naming convention** | `<table>_<profile>` (e.g. `orders_tenant_acl`) for grep and idempotent drops. |
| **Separate DB role for migrations** | Migration user owns tables; app uses `app_runtime` only at runtime. |
| **Column-level grants** | Rare; prefer RLS — use only if a table mixes public and secret columns. |

## Further reading

- [Prisma & database — §10 Row Level Security](./prisma.md)
- [Multi-tenancy](./multi-tenancy.md)
- [Authorization & RBAC](./authorization.md)
- [ADR 007: Tenancy and RLS bypass](./adr/007-tenancy-and-rls-bypass.md)
- [ADR 012: System operations](./adr/012-system-operations.md)

## Acceptance checklist (new projects)

- [ ] `pnpm db:reset` completes without manually running RLS
- [ ] `TENANCY_ENABLED` set intentionally for the deployment shape (ADR 007)
- [ ] New roles via API/seed do not require migrations
- [ ] Every new table: manifest profile + RLS enable + policies in `rls.sql` or `prisma/rls/NN-*.sql`
- [ ] `pnpm db:check-rls-manifest` passes after schema/security changes
- [ ] Cross-tenant and cross-location reads blocked in `rls-hardening` / org isolation tests
- [ ] Tenant mutations use `withTenantTransaction`; jobs use allowlisted system operations
- [ ] `@RlsBypass()` limited to auth, webhooks, and documented public paths
- [ ] Permissions defined in `packages/shared` and enforced with `@RequirePermission`
