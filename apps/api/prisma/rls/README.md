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
| `prisma/rls.sql` | Main idempotent bundle (role, core helpers, enable RLS, baseline policies). Applied **first**. |
| `prisma/rls/*.sql` | Ordered fragments (`01-`, `02-`, …). Helpers and **new** policy families — applied **after** `rls.sql`. |
| `scripts/apply-rls.ts` | Applies all fragments + `rls.sql` via `psql`. |

Add new generic helpers in `prisma/rls/NN-name.sql` (numeric prefix controls order). Add or adjust table policies in `rls.sql` (or split into more fragments over time).

## Architecture (RBAC vs ACL vs RLS)

| Layer | Question | Stored as |
|-------|----------|-----------|
| **RBAC** | Can this user perform this action? | `roles`, `permissions`, `role_permissions`, `user_roles` |
| **ACL / scope** | Which org/locations may they touch? | `organization_memberships`, `organization_membership_location_scopes` |
| **RLS** | Which rows may this DB session see? | PostgreSQL policies (this folder) — **not** per-role |

Creating a role like `Cashier` or assigning `ORDER.UPDATE` is **data only** — no migration, no RLS change.

See [RBAC + ACL + RLS architecture](../../../../docs/rbac-acl-rls-architecture.md).

## Session variables (fail-closed)

Set **inside the same transaction** as tenant queries (`TenantTransactionService`):

| Setting | Meaning |
|---------|---------|
| `app.current_user_id` | Authenticated user |
| `app.current_organization_id` | Active tenant |
| `app.rls_bypass` | Trusted system path only |

Helpers: `app_rls_bypass()`, `app_current_user_id()`, `app_current_organization_id()`, `app_tenant_organization_member_of(org_id)`, `app_tenant_has_location_access(location_id)`.

Missing context must **not** widen access.

## Commands

| Command | When |
|---------|------|
| `pnpm db:migrate` | Dev schema change — migrates **and** applies RLS |
| `pnpm db:reset` | Clean DB — migrate, apply RLS, seed |
| `pnpm db:check-rls-manifest` | Verify Prisma tables ↔ manifest ↔ RLS SQL (CI-friendly) |
| `pnpm db:deploy` | Production — deploy migrations **and** apply RLS |

You do **not** need a separate manual RLS step after reset when using these scripts.
