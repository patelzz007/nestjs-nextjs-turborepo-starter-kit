# RBAC + ACL + RLS Implementation

## Overview

This document describes the production RBAC (Role-Based Access Control) + ACL (Access Control Lists) + RLS (Row-Level Security) architecture implemented in this NestJS + Prisma 7 + PostgreSQL turborepo starter kit.

**Specification**: The implementation follows the architecture defined in `uploads/rbac-acl-rls-architecture.md`.

**Implementation Date**: January 2026

**Status**: ✅ Production-ready

---

## Architecture Summary

### Three Distinct Authorization Layers

This implementation maintains a clear separation between three authorization mechanisms:

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP REQUEST                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 1. AUTHENTICATION: Who is this user?                    │
│    JWT token → userId, organizationId, tokenVersion     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. RBAC: What actions can the user perform?             │
│    - Permission-based (not role names in code)          │
│    - Database-backed (permissions table)                │
│    - Immediate effect (no restart needed)               │
│    Guards: @RequireAllPermissions, @RequireAnyPermission│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. ACL: What organizational scope?                      │
│    - Organization membership                            │
│    - Location (branch) access assignments               │
│    - Tables: organization_memberships,                  │
│              organization_membership_location_scopes    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. DATABASE CONTEXT: Set transaction-local vars         │
│    - app.current_user_id                                │
│    - app.current_organization_id                        │
│    - app.rls_bypass (false for tenant operations)       │
│    Service: TenantTransactionService                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. RLS: Which database rows can be accessed?            │
│    - Generic policies (not role-specific)               │
│    - Uses app_owns(), app_organization_member_of()      │
│    - Fail-closed (missing context denies access)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   DATABASE ROWS                         │
└─────────────────────────────────────────────────────────┘
```

---

## Key Implementation Details

### 1. RBAC (Role-Based Access Control)

#### Database Schema

```prisma
model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  parentId    String?  // Optional hierarchy
  
  users       UserRole[]
  permissions RolePermission[]
}

model Permission {
  id       String             @id @default(uuid())
  action   PermissionAction   // CREATE, READ, UPDATE, DELETE, LIST, MANAGE
  resource PermissionResource // USER, ROLE, ORGANIZATION, etc.
  
  roles RolePermission[]
}

model UserRole {
  userId String
  roleId String
  
  @@id([userId, roleId])
}

model RolePermission {
  roleId       String
  permissionId String
  
  @@id([roleId, permissionId])
}
```

#### NestJS Implementation

**Guards**:
- `AuthorizationGuard` — Global guard that checks permissions
- Registered after `AuthGuard` so `request.user` is already populated

**Decorators**:
```typescript
@RequireAllPermissions(
  ["READ", "ORDER"],
  ["UPDATE", "ORDER"]
)
async updateOrder() { }

@RequireAnyPermission(
  ["READ", "ADMIN_DASHBOARD"],
  ["MANAGE", "SYSTEM_SETTINGS"]
)
async adminEndpoint() { }
```

**Services**:
- `AuthorizationCheckerService` — Evaluates permissions
- `RoleService` — CRUD for roles
- `PermissionService` — CRUD for permissions

**Key Features**:
- **Database-backed**: Permissions resolved from DB, not JWT
- **Token versioning**: `tokenVersion` field incremented on role/permission changes
- **Immediate effect**: Permission changes visible immediately (no restart)
- **Super-admin bypass**: Users with `isSuperAdmin: true` bypass all checks
- **Wildcard**: `MANAGE` action satisfies any action on the resource

---

### 2. ACL (Access Control Lists)

#### Database Schema

```prisma
model Organization {
  id          String @id @default(uuid())
  slug        String @unique
  displayName String
  
  locations   OrganizationLocation[]
  memberships OrganizationMembership[]
}

model OrganizationLocation {
  id             String @id @default(uuid())
  organizationId String
  name           String
  code           String
  status         OrganizationLocationStatus
  
  membershipScopes OrganizationMembershipLocationScope[]
}

model OrganizationMembership {
  id             String @id @default(uuid())
  organizationId String
  userId         String
  role           OrganizationMembershipRole // OWNER, ADMIN, MEMBER, CASHIER
  status         OrganizationMembershipStatus
  
  locationScopes OrganizationMembershipLocationScope[]
}

model OrganizationMembershipLocationScope {
  id             String @id @default(uuid())
  organizationId String
  membershipId   String
  scopeType      OrganizationLocationScopeType // ALL_LOCATIONS, SELECTED
  locationId     String?
}
```

#### Branch vs Location Terminology

**Specification Term**: Branch  
**Implementation Term**: Location (`OrganizationLocation`)

**Rationale**: The project was already using "location" terminology for organizational subdivisions (stores, sites). This maps directly to the spec's "Branch" concept. The implementation is semantically identical:

- Multi-location organization (spec: multi-branch)
- Users assigned location access (spec: branch access)
- RLS enforces location isolation (spec: branch isolation)

**Example**:
```
Cake Shop A (Organization)
├── KL Store (Location = spec's Branch A)
├── Melaka Store (Location = spec's Branch B)
└── Penang Store (Location = spec's Branch C)
```

---

### 3. RLS (Row-Level Security)

#### Implementation Location

**Before**: RLS was in a separate `apps/api/prisma/rls.sql` file, manually applied via `pnpm db:rls`.

**After**: RLS is integrated into `apps/api/prisma/migrations/20260914155553_init/migration.sql`.

**Result**: `pnpm db:reset` now fully initializes the database including RLS. No separate `db:rls` command needed.

#### RLS Architecture

**Generic Policies** (not role-specific):

1. **Ownership** — `app_owns(user_id)`: User owns the row
2. **Organization membership** — `app_organization_member_of(org_id)`: User is a member
3. **Tenant context** — `app_tenant_organization_member_of(org_id)`: Active tenant context + membership
4. **Bypass** — `app_rls_bypass()`: System operations

**Database Role**:
- `app_runtime` — NOLOGIN, NOSUPERUSER, NOINHERIT, NOBYPASSRLS
- Applied via `RlsPool` on every connection checkout

**Helper Functions**:
```sql
CREATE FUNCTION app_rls_bypass() RETURNS boolean;
CREATE FUNCTION app_current_user_id() RETURNS text;
CREATE FUNCTION app_current_organization_id() RETURNS text;
CREATE FUNCTION app_owns(owner_id text) RETURNS boolean;
CREATE FUNCTION app_organization_member_of(org_id text) RETURNS boolean;
CREATE FUNCTION app_tenant_organization_member_of(org_id text) RETURNS boolean;
```

**Policy Examples**:

```sql
-- User-owned table
CREATE POLICY users_own ON users
  USING (app_owns(id))
  WITH CHECK (app_owns(id));

-- Organization-scoped table
CREATE POLICY organizations_member ON organizations
  FOR SELECT
  USING (app_rls_bypass() OR app_organization_member_of(id));

-- Tenant-scoped table (requires active organization context)
CREATE POLICY organization_locations_member ON organization_locations
  USING (
    app_rls_bypass()
    OR app_tenant_organization_member_of(organization_id)
    OR app_organization_member_of(organization_id)
  );
```

#### Database Context Setup

**Service**: `TenantTransactionService`

```typescript
await tx.$executeRaw`SELECT set_config('role', 'app_runtime', true)`;
await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${orgId}, true)`;
await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'false', true)`;
```

**Key Points**:
- Transaction-local (`true` third parameter)
- Set at the start of every tenant transaction
- Automatic via `TenantTransactionService.withTenantTransaction()`
- Also set on pool checkout via `RlsPool`

---

## Critical Architecture Principles

### 1. Roles Are Data, Not RLS

❌ **WRONG**:
```sql
-- DO NOT create role-specific RLS policies
CREATE POLICY orders_manager ON orders
  USING (current_user_role = 'Manager');
```

✅ **CORRECT**:
```sql
-- Generic policy based on organization membership
CREATE POLICY orders_org_member ON orders
  USING (app_organization_member_of(organization_id));
```

When an admin creates a new "Cashier" role:
- ✅ `INSERT INTO roles (name) VALUES ('Cashier')` — Normal data
- ✅ `INSERT INTO role_permissions` — Normal data
- ❌ No RLS policy generation
- ❌ No migration
- ❌ No restart

### 2. RLS Fail-Closed

Missing database context results in **zero access**, not unrestricted access:

```typescript
// Missing user context
await prisma.$executeRaw`SELECT set_config('app.current_user_id', '', false)`;
const users = await prisma.user.findMany(); // Returns [] (RLS filters all)

// Missing organization context  
await prisma.$executeRaw`SELECT set_config('app.current_organization_id', '', false)`;
const orgs = await prisma.organization.findMany(); // Returns []
```

### 3. Transaction-Local Context

```typescript
// ❌ WRONG: Persistent SET on pooled connection
await client.query("SET app.user_id = '...'");

// ✅ CORRECT: Transaction-local
await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
//                                                               ^^^^ transaction-local
```

### 4. Permission Changes Are Immediate

```typescript
// User has READ permission
let canRead = await authChecker.hasPermission(userId, "READ", "ORDER");
// true

// Admin revokes permission
await prisma.rolePermission.delete({ where: { ... } });

// User immediately loses access (no restart needed)
canRead = await authChecker.hasPermission(userId, "READ", "ORDER");
// false
```

The `tokenVersion` mechanism forces re-authentication after role/permission changes.

---

## Migration Workflow

### Development

```bash
# Full reset with RLS
pnpm db:reset
# Runs: prisma migrate reset → seed

# New migration
pnpm db:migrate
# Runs: prisma migrate dev

# Generate Prisma client
pnpm db:generate
```

### Production

```bash
# Deploy migrations (includes RLS)
pnpm db:migrate:deploy
# Runs: prisma migrate deploy
```

### No Separate RLS Command

Before:
```bash
pnpm db:migrate && pnpm db:rls  # ❌ Manual RLS step
```

After:
```bash
pnpm db:migrate  # ✅ RLS included in migration
```

---

## Testing

### Test Coverage

The implementation includes comprehensive integration tests in:
`apps/api/src/modules/authorization/__tests__/rbac-acl-rls.integration.spec.ts`

**Test Categories**:

1. **RBAC Tests**
   - Permission checks (has/doesn't have)
   - Immediate permission changes
   - Role-permission assignments

2. **ACL Tests**
   - Organization membership
   - Location (branch) access
   - Immediate access changes

3. **RLS Tests**
   - Organization isolation
   - Fail-closed behavior
   - Location-level filtering

4. **Combined RBAC + RLS Tests**
   - Both layers enforcing restrictions
   - RBAC blocks even when RLS would allow
   - RLS filters even when RBAC allows

5. **Dynamic Role Management Tests**
   - Create role without migration
   - RLS policies remain unchanged
   - Immediate effect

6. **Fail-Closed Security Tests**
   - Missing user context
   - Missing organization context
   - Empty context denies access

### Running Tests

```bash
# Run unit tests
pnpm test:unit

# Run integration tests (includes RLS tests)
pnpm test:e2e
```

---

## Seed Data

The seed is deterministic and creates:

**Permissions** (sample):
- `CREATE:USER`, `READ:USER`, `UPDATE:USER`, `DELETE:USER`
- `CREATE:ORDER`, `READ:ORDER`, `UPDATE:ORDER`, `DELETE:ORDER`
- `MANAGE:ADMIN_DASHBOARD`, `MANAGE:SYSTEM_SETTINGS`

**Roles** (sample):
- `SuperAdmin` — All permissions
- `Admin` — Most permissions
- `Manager` — Business operations
- `User` — Read-only

**Users** (sample):
- `superadmin@example.com` — isSuperAdmin: true
- `admin@example.com` — Admin role
- `manager@example.com` — Manager role
- `user@example.com` — User role

**Organizations** (sample):
- KL Organization — Multiple locations
- MLK Organization — Multiple locations

**Memberships & Access**:
- Users assigned to organizations
- Location scopes defined per membership
- Deterministic UUIDs for reproducibility

---

## Deviations from Specification

### 1. Branch → Location Terminology

**Spec**: Branch  
**Implementation**: OrganizationLocation

**Impact**: None (semantically identical)

**Rationale**: Existing domain model already used "location" for organizational subdivisions

### 2. Additional Features

The implementation includes features beyond the spec:

**Authorization Policies** (Cedar/ABAC):
- `authorization_policy_drafts`
- `authorization_policy_versions`
- Allows dynamic policy creation (advanced use case)

**Support Access**:
- `support_access_grants`
- JIT (Just-In-Time) privileged access for support

**Tenant Placement**:
- `tenant_placements`
- Multi-region/shard support (future-proof)

**Encryption Keys**:
- `tenant_encryption_keys`
- Envelope encryption metadata

**Impact**: These additions don't conflict with the core RBAC + ACL + RLS architecture

### 3. OrganizationMembershipRole Enum

The implementation has a built-in `OrganizationMembershipRole` enum:
- `OWNER`
- `ADMIN`
- `MEMBER`
- `POLICY_ADMIN`
- `CASHIER`

**Spec Guidance**: Dynamic roles in the `roles` table

**Implementation**: Both exist
- Enum roles for organization-level access control
- Dynamic roles in `roles` table for permission-based RBAC

**Rationale**: Organization membership roles are structural (owner/admin), while business roles (manager/cashier) are dynamic

### 4. Existing Role Hierarchy

The implementation supports optional role hierarchy via `role.parentId`.

**Spec**: No hierarchy initially (deferred)

**Implementation**: Schema supports it, not used in seed

**Impact**: None (compatible with spec, available if needed)

---

## Acceptance Criteria (Section 83 of Spec)

### ✅ Database

- [x] Prisma schema represents RBAC/ACL relationships
- [x] Tenant-owned tables contain organization ownership
- [x] Relevant location-owned tables contain location ownership
- [x] Required indexes exist
- [x] Foreign keys and unique constraints exist

### ✅ RLS

- [x] RLS is enabled through migrations
- [x] RLS policies are version controlled
- [x] No manual `db:rls` step is required
- [x] Missing authorization context fails closed
- [x] Organization isolation works
- [x] Location (branch) isolation works
- [x] INSERT/UPDATE `WITH CHECK` behavior is tested
- [x] Runtime application DB role cannot bypass RLS unintentionally

### ✅ RBAC

- [x] Permissions are database-backed
- [x] Roles are database-backed
- [x] Role-permission assignments are database-backed
- [x] Permission decorator exists (`@RequireAllPermissions`, `@RequireAnyPermission`)
- [x] Permission guard exists (`AuthorizationGuard`)
- [x] Controllers do not hardcode role names
- [x] Permission changes take effect without deployment

### ✅ ACL

- [x] Organization membership is represented
- [x] Location (branch) access is represented
- [x] Location access is checked by the database/RLS where appropriate
- [x] Client-provided organization/location context is never trusted blindly

### ✅ Prisma

- [x] No unsafe connection-context assumptions
- [x] `set_config(..., true)` is used transaction-locally
- [x] Context and protected queries execute in the same transaction
- [x] No `any`
- [x] No `unknown`
- [x] No `never`
- [x] No unsafe type casts

### ✅ Developer Experience

- [x] `pnpm db:reset` creates the complete environment
- [x] `pnpm db:seed` works
- [x] No `pnpm db:rls` is necessary
- [x] Production uses `pnpm db:migrate:deploy`
- [x] Development can repeatedly reset and reseed

### ✅ Security

- [x] Cross-tenant reads are blocked
- [x] Cross-tenant updates are blocked
- [x] Cross-tenant inserts are blocked
- [x] Unauthorized permissions return 403
- [x] RLS tests exist independently from RBAC tests
- [x] Combined RBAC + RLS integration tests exist
- [x] Privilege escalation scenarios are tested

---

## Files Modified

### Core Changes

1. **Migration**:
   - `apps/api/prisma/migrations/20260914155553_init/migration.sql`
   - Appended RLS from `rls.sql`

2. **Package Scripts**:
   - `apps/api/package.json`
   - Removed `db:rls` calls from `db:reset`, `db:migrate`, `db:deploy`, `db:push`

3. **Tests**:
   - `apps/api/src/modules/authorization/__tests__/rbac-acl-rls.integration.spec.ts`
   - Comprehensive RBAC + ACL + RLS tests

4. **Documentation**:
   - `apps/api/docs/RBAC-ACL-RLS-IMPLEMENTATION.md` (this file)

### No Changes Needed

The following were already production-ready:
- `apps/api/src/prisma/prisma.service.ts` — RlsPool integration
- `apps/api/src/prisma/rls-pool.ts` — Connection pooling with RLS
- `apps/api/src/prisma/tenant-transaction.service.ts` — Transaction context
- `apps/api/src/modules/authorization/` — Full authorization module
- `apps/api/src/modules/authorization/guards/authorization.guard.ts` — Permission guards
- `apps/api/src/modules/authorization/decorators/` — Permission decorators

---

## Verification Steps

### 1. Verify RLS in Migration

```bash
grep -A 5 "CREATE FUNCTION app_rls_bypass" apps/api/prisma/migrations/20260914155553_init/migration.sql
```

### 2. Verify No Manual RLS Required

```bash
# Should NOT contain "pnpm db:rls"
grep "db:rls" apps/api/package.json
```

### 3. Run Full Reset

```bash
cd apps/api
pnpm db:reset
# Should complete successfully with RLS enabled
```

### 4. Verify RLS is Active

```bash
psql $DATABASE_URL -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LIMIT 10;"
```

### 5. Run Tests

```bash
cd apps/api
pnpm test:unit
pnpm test:e2e
```

---

## Summary

This implementation delivers a **production-oriented RBAC + ACL + RLS architecture** where:

1. **Roles and permissions are dynamic application data** — Admins can create/modify roles without migrations or RLS changes
2. **RLS is generic database infrastructure** — Policies operate on ownership, organization membership, and location access
3. **No manual RLS command** — `pnpm db:reset` fully initializes the database including RLS
4. **Fail-closed security** — Missing context denies access by default
5. **Immediate effect** — Permission and access changes take effect without restart
6. **Fully tested** — Comprehensive integration tests cover RBAC, ACL, RLS, and their combinations

The implementation **fully satisfies the specification** with the following notes:
- "Branch" terminology mapped to existing "OrganizationLocation" (semantically identical)
- Additional enterprise features (policies, support access) that don't conflict with core architecture
- Existing codebase already had excellent authorization infrastructure that aligned with the spec

**Status**: ✅ Ready for production use
