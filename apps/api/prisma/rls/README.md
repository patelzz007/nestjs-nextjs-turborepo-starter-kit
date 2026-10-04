# Row-Level Security (RLS) — template workflow

Prisma cannot emit `ENABLE ROW LEVEL SECURITY` or policies from the schema. This folder is the **canonical, version-controlled security layer** for every project cloned from this starter.

## Do not patch `migrations/*/migration.sql` for RLS

When you squash or recreate migrations (`prisma migrate reset`, delete `migrations/`, `prisma migrate dev`), Prisma regenerates table SQL only. **Never append RLS to migration files by hand** — it will be lost on the next squash.

Instead:

1. Change **`prisma/schema.prisma`** for tables/columns/indexes.
2. Run **`pnpm db:migrate`** (creates/applies Prisma migration).
3. RLS is applied automatically by **`pnpm db:apply-security`** (chained after migrate, deploy, reset, and push).

## File layout

| Path | Purpose |
|------|---------|
| `prisma/rls/00-app-helpers.sql` | Base session helpers (`app_rls_bypass()`, `app_current_user_id()`, `app_current_organization_id()`, `app_owns()`). Applied **first** — `01` and `rls.sql` call them, so a fresh database needs them before anything else. |
| `prisma/rls/01-acl-location-access.sql` | ReBAC + ACL helpers and location-scoped policies. Applied **second**. |
| `prisma/rls.sql` | Main idempotent bundle (role, grants, enable RLS, baseline policies). Applied **third**. |
| `prisma/rls/90-analytics-consumer.sql` | The analytics consumer's least-privilege `analytics_consumer` role: table grants and role-scoped policies (its LOGIN is created by `pnpm --filter @workspace/analytics-consumer db:provision-login`). Applied after `rls.sql`. |
| `prisma/rls/*.sql` | Other ordered fragments (`NN-*.sql`, then `99-app-runtime-grants`). **app_runtime** grants run **last**. |
| `prisma/rls/withheld-privileges.ts` | `APP_RUNTIME_WITHHELD_PRIVILEGES` — the ONE list of tables whose UPDATE/DELETE `app_runtime` must not hold (append-only audit trails, never-deleted rows). `apply-rls.ts` revokes them in the same transaction as the `99` blanket grant and verifies the live catalog; `db:check-rls-manifest` rejects unknown tables and hand-written `REVOKE … FROM app_runtime`. Adding a table is a one-line change there. |
| `scripts/rls-apply-plan.ts` | `RLS_APPLY_ORDER` — the apply order, plus disk-drift and helper use-before-define validation (runs before any SQL, also in `db:check-rls-manifest`). |
| `scripts/apply-rls.ts` | Applies the validated plan via Node `pg` (no local `psql` required). |

Add new fragments as `prisma/rls/NN-name.sql` and register them in `RLS_APPLY_ORDER` (`scripts/rls-apply-plan.ts`) — unregistered files, missing files, and helpers used before their defining file all fail the plan. Add or adjust table policies in `rls.sql` (or split into more fragments over time).

## Architecture (RBAC vs ACL vs RLS)

| Layer | Question | Stored as |
|-------|----------|-----------|
| **RBAC** | Can this user perform this action? | `roles`, `permissions`, `role_permissions`, `user_roles` |
| **ACL / scope** | Which org/locations may they touch? | `organization_memberships`, `organization_membership_location_scopes` |
| **RLS** | Which rows may this DB session see? | PostgreSQL policies (this folder) — **not** per-role |

Creating a role like `Cashier` or assigning `ORDER.UPDATE` is **data only** — no migration, no RLS change.

See [RBAC + ACL + RLS architecture](../../../../docs/technical/security/database-security.md).

## Session variables (fail-closed)

Set **inside the same transaction** as tenant queries (`TenantTransactionService`):

| Setting | Meaning |
|---------|---------|
| `app.current_user_id` | Authenticated user |
| `app.current_organization_id` | Active tenant |
| `app.rls_bypass` | Trusted system path only |

Helpers: `app_rls_bypass()`, `app_current_user_id()`, `app_current_organization_id()`, `app_tenant_org_member(org_id)` (tenant context or legacy org membership), `app_tenant_organization_member_of(org_id)`, `app_tenant_has_location_access(location_id)`.

Missing context must **not** widen access.

## Commands

| Command | When |
|---------|------|
| `pnpm db:migrate` | Dev schema change — migrates **and** applies RLS |
| `pnpm db:reset` | Clean DB — migrate, apply RLS, seed |
| `pnpm db:check-rls-manifest` | Verify Prisma tables ↔ manifest ↔ RLS SQL (CI-friendly) |
| `pnpm db:deploy` | Production — deploy migrations **and** apply RLS |

You do **not** need a separate manual RLS step after reset when using these scripts.
