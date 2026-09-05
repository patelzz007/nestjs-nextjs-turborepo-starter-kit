---
title: "Authorization Module (RBAC)"
tags: ["authorization", "rbac", "permissions", "roles", "guards"]
description: "Production-oriented Spatie-style authorization architecture for NestJS + Fastify + Prisma + PostgreSQL."
author: "Acme Inc."
lastUpdated: 1772000000000
coverImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop"
order: 8
---

# Authorization Module (RBAC)

Production-oriented Spatie-style authorization architecture for NestJS + Fastify + Prisma + PostgreSQL.

## Table of Contents

1. [Philosophy](#philosophy)
2. [Quick Start for New Developers](#quick-start-for-new-developers)
3. [Roles vs Permissions — When to Use What](#roles-vs-permissions--when-to-use-what)
4. [Architecture](#architecture)
5. [Database Schema](#database-schema)
6. [How Permission Checks Work](#how-permission-checks-work)
7. [Decorators (Route Protection)](#decorators-route-protection)
8. [Programmatic Checks (Service API)](#programmatic-checks-service-api)
9. [Cache Layer](#cache-layer)
10. [Session profile vs permissions (`/me` vs `/auth/permissions`)](#session-profile-vs-permissions-me-vs-authpermissions)
11. [Impersonation (super-admin)](#impersonation-super-admin)
12. [Request Lifecycle](#request-lifecycle)
13. [Web vs Admin Sessions (Dual Cookies)](#web-vs-admin-sessions-dual-cookies)
14. [JWT Design](#jwt-design)
15. [Admin API](#admin-api)
16. [Admin panel UI](#admin-panel-ui)
17. [Seeding](#seeding)
18. [Advanced Features](#advanced-features)
19. [Directory Structure](#directory-structure)
20. [Key Design Decisions](#key-design-decisions)
21. [Troubleshooting](#troubleshooting)

---

## Philosophy

The core model is:

> **Roles are groups of permissions. Permissions are what authorize actions.**

```
                         ┌──────────────┐
                         │     User     │
                         └──────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
             ┌─────────────┐        ┌────────────────┐
             │    Roles    │        │ Direct User    │
             │             │        │ Permissions    │
             └──────┬──────┘        └───────┬────────┘
                    │                       │
                    ▼                       │
             ┌─────────────┐                │
             │ Permissions │◄───────────────┘
             └──────┬──────┘
                    │
                    ▼
           Effective Permissions
                    │
                    ▼
          Authorization Checker
                    │
                    ▼
              NestJS Guards
```

**Key rule:** Controllers depend on `@RequirePermission("CREATE", "USER")`, never `@RequireRole("admin")`. This keeps authorization decoupled from role names.

---

## Quick Start for New Developers

If you are new to this codebase, read this section first. It explains the minimum you need to protect a route or check access in a service.

### The mental model (30 seconds)

1. A **permission** is an `action` + `resource` pair, e.g. `CREATE` on `USER`.
2. A **role** is a named bucket of permissions, e.g. `"admin"`.
3. A **user** gets permissions in two ways:
   - **Indirectly** — through roles (including inherited parent-role permissions).
   - **Directly** — a permission granted straight to the user (optionally with expiry).
4. **Route protection** uses decorators on controllers. The global `AuthorizationGuard` enforces them.
5. **Business logic** uses `AuthorizationService` or `AuthorizationCheckerService` when you need to branch inside a method.

### Protect a route (most common task)

```ts
import { RequirePermission } from "../auth/decorators/require-permission.decorator";

@Post()
@RequirePermission("CREATE", "USER")
createUser() {
  // Only users with CREATE:USER (or MANAGE:USER) reach here.
}
```

No `UseGuards()` needed — `AuthorizationGuard` is registered globally in `app.module.ts`.

### Check access inside a service

```ts
import { AuthorizationService } from "../authorization/services/authorization.service";

@Injectable()
export class UserService {
  constructor(private readonly authorization: AuthorizationService) {}

  async deleteUser(actorId: string, targetId: string): Promise<void> {
    const canDelete = await this.authorization.user(actorId).can("DELETE", "USER");
    if (!canDelete) {
      throw new ForbiddenException("Cannot delete users");
    }
    // ...
  }
}
```

### Assign a role to a user

```ts
await this.authorization.user(userId).assignRole("admin");
```

### Give a permission to a role (not a user)

```ts
await this.authorization.role("admin").givePermissionTo("CREATE", "USER");
```

### Where things live

| You want to… | Use this |
|--------------|----------|
| Block an HTTP route | Decorators (`@RequirePermission`, `@RequireAllPermissions`, etc.) |
| Check access in service code | `authorization.user(id).can(...)` or `checker.hasPermissions(...)` |
| Change who has what | `assignRole`, `givePermissionTo`, `syncRoles`, admin API |
| See full effective permissions | `checker.getUserPermissionDetails(userId)` |

---

## Roles vs Permissions — When to Use What

### Permissions = what you authorize (preferred)

Permissions answer: **"Can this user perform this action on this resource?"**

```ts
@RequirePermission("UPDATE", "ROLE")
@RequireAllPermissions(["CREATE", "USER"], ["READ", "USER"])
@RequireAnyPermission(["READ", "REPORT"], ["LIST", "REPORT"])
```

Use permissions for almost all API routes. Role names can change; permission meaning should not.

### Roles = who someone is (use sparingly)

Roles answer: **"Does this user have this named role assigned?"**

```ts
@RequireAllRoles("admin", "auditor")
@RequireAnyRole("admin", "manager")
```

Use roles only when the business rule is literally about role membership (e.g. "must be both admin and auditor"). Do **not** use roles as a shortcut for permissions.

### Important: role hierarchy behaves differently for roles vs permissions

| Check type | Does parent role count? | Example |
|------------|-------------------------|---------|
| **Permission check** (`hasPermission`, `@RequirePermission`) | **Yes** — permissions flow up the hierarchy | User has role `"editor"` whose parent is `"viewer"`. They get `"viewer"`'s permissions even if `"viewer"` is not directly assigned. |
| **Role name check** (`hasRole`, `@RequireAllRoles`) | **No** — only **directly assigned** role names count | Same user does **not** pass `hasRole("viewer")` unless `"viewer"` is explicitly on their account. |

```
User assigned: ["editor"]
Role tree:     viewer → editor

hasPermission("READ", "USER")  → true  (inherited from viewer role's permissions)
hasRole("viewer")              → false (viewer is not a direct assignment)
hasRole("editor")              → true
```

### Super-admin bypass

Users with `isSuperAdmin: true` pass **all** decorator checks automatically. The guard logs a `SUPER_ADMIN_BYPASS` audit entry. Super-admin is identity, not a role.

---

## Architecture

```
apps/api/src/modules/authorization/
├── authorization.module.ts                  # @Global() NestJS module
├── admin/
│   ├── authorization-admin.module.ts        # Admin CRUD module
│   ├── roles.controller.ts                  # Roles CRUD + hierarchy + preview
│   ├── permissions.controller.ts            # Permissions CRUD + user grants
│   └── audit.controller.ts                  # Audit log query API
├── audit/
│   └── authorization-audit.service.ts       # Audit logging for all mutations
├── cache/
│   ├── authorization-cache.service.ts       # In-memory Map (local dev default)
│   └── redis-authorization-cache.service.ts # Redis pub/sub invalidation (deployed)
├── cleanup/
│   └── permission-expiry.cleanup.ts         # Hourly cron: soft-delete expired grants
├── constants/
│   └── authorization.constants.ts           # Metadata keys + type definitions
├── decorators/
│   ├── current-user.decorator.ts            # @CurrentUser() param decorator
│   ├── require-all-permissions.decorator.ts # AND semantics
│   ├── require-any-permission.decorator.ts  # OR semantics
│   ├── require-all-roles.decorator.ts       # AND semantics
│   └── require-any-role.decorator.ts        # OR semantics
├── events/
│   └── authorization.events.ts              # Typed event emitter for auth changes
├── exceptions/
│   └── authorization.exception.ts           # Custom exception classes
├── guards/
│   └── authorization.guard.ts               # Unified global guard
├── health/
│   └── authorization.health.ts              # Health check indicator
├── migration/
│   └── permission-migration.service.ts      # Code-to-DB permission sync
├── policies/
│   ├── policy.interface.ts                  # Policy interface definition
│   └── policy-registry.ts                   # Resource-specific policy registry
└── services/
    ├── authorization.service.ts             # Spatie-like fluent facade
    ├── authorization-checker.service.ts     # Permission/role evaluation
    ├── auth-rate-limit.service.ts           # Rate limiting on auth checks
    ├── conflict-detection.service.ts        # Role conflict rules
    ├── permission.service.ts                # Permission CRUD + user grants
    └── role.service.ts                      # Role CRUD + hierarchy + assignment
```

---

## Database Schema

All RBAC tables use **soft-delete** (`isDeleted` / `deletedAt`) and **explicit junction tables** (not Prisma implicit many-to-many).

### Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `User` | Application user | `id`, `email`, `isSuperAdmin` |
| `Role` | Named role (e.g. "admin") | `id`, `name`, `description`, `parentId` (hierarchy), `isActive` |
| `Permission` | Action+Resource pair | `id`, `action` (enum), `resource` (enum), `description`, `group` |
| `UserRole` | User ↔ Role junction | `[userId, roleId]` composite PK |
| `RolePermission` | Role ↔ Permission junction | `[roleId, permissionId]` composite PK |
| `UserPermission` | Direct user permission grant | `[userId, permissionId]` + optional `expiresAt` |

### Permission Naming (Enum-Based)

Permissions use `PermissionAction` + `PermissionResource` enums — not strings:

```
PermissionAction:    CREATE | READ | UPDATE | DELETE | LIST | MANAGE
PermissionResource:  USER | PROFILE | ROLE | PERMISSION | ADMIN_DASHBOARD |
                     SYSTEM_SETTINGS | URL | TAG | API_KEY | ANALYTICS |
                     AUDIT_LOG | REPORT | TELESCOPE | EMAIL | BACKUP
```

Example: `@RequirePermission("CREATE", "USER")` requires the `CREATE` action on the `USER` resource.

### Permission registry (code catalog)

`packages/shared/src/schemas/domain/permissions-registry.ts` is the **single source of truth** for permissions that routes protect in code:

| Artifact | Purpose |
|----------|---------|
| `PERMISSION_DEFINITIONS` | Full list with `action`, `resource`, `description`, `group`, `isSystem` — used by **seed** and **startup sync** |
| `PERMISSIONS` | Nested dot-notation constants (`user.read`) for documentation |
| `getPermissionDefinitions()` | Returns the catalog for seed / migration |
| `getAllPermissionNames()` | Flat dot-notation names |

**Route decorators use enum pairs**, not dot strings:

```ts
@RequirePermission("CREATE", "USER") // ✅
@RequirePermission("user.create")      // ❌ does not compile
```

### Registry ↔ database sync (one direction)

On **API startup**, `PermissionRegistrySyncBootstrap` runs `PermissionMigrationService.syncFromRegistry()`:

- **Registry → DB**: new code permissions are inserted; descriptions/groups updated
- **DB → registry**: never — admin-created permissions stay in the database only

`prisma db seed` uses the same `getPermissionDefinitions()` list, so seed and deploy stay aligned.

### Admin UI permissions vs code registry

| Created via | Stored in | Used by `@RequirePermission` | Appears in registry file |
|-------------|-----------|-------------------------------|--------------------------|
| `permissions-registry.ts` + deploy | DB (via sync/seed) | Yes — add matching decorator | Yes |
| Admin panel “create permission” | DB only | Only if you add a decorator that checks that `action:resource` | No |

**Workflow for a new protected route:**

1. Add row to `PERMISSION_DEFINITIONS` in `permissions-registry.ts`
2. Add `@RequirePermission("ACTION", "RESOURCE")` on the controller
3. Deploy (startup sync inserts the DB row)
4. Assign the permission to roles in admin (or seed role matrix)

**Workflow for a runtime-only permission** (no new route, custom RBAC rule):

1. Create in admin panel
2. Assign to roles / users
3. Checker `hasPermission()` will honor it — no registry change needed

Orphaned DB permissions (admin-created, not in registry) are logged at debug level on startup; they are **not** deleted automatically.

### Wildcard: MANAGE Action

A `MANAGE` permission on a resource grants **every action** on that resource:

- `MANAGE` on `USER` → grants `CREATE:USER`, `READ:USER`, `UPDATE:USER`, `DELETE:USER`, `LIST:USER`
- This is handled automatically by `AuthorizationCheckerService`

### Plural Resource Prefix Match

`READ:USERS` satisfies `READ:USER` (resource prefix match). A user with `READ:USERS` can access any `USER` resource. This supports the `users.*` pattern from the permission registry.

### Role Hierarchy

Roles support parent-child hierarchy via `parentId`:

```
SuperAdmin → Admin → Manager → User
```

A child role inherits all permissions from its parent. The hierarchy is walked upward during permission resolution. Circular references are detected via full DFS traversal (not just depth-1 check).

---

## How Permission Checks Work

### Step-by-Step Flow

1. **AuthGuard runs first** — validates JWT, attaches `request.user`.
2. **AuthorizationGuard reads route metadata** — checks for `@RequirePermission`, `@RequireAllPermissions`, `@RequireAnyPermission`, `@RequireAllRoles`, `@RequireAnyRole`.
3. **No metadata?** — route is unguarded; `hasAdminAccess` is still computed for downstream guards/interceptors; request is allowed.
4. **User must be authenticated** — unauthenticated requests get `401 UNAUTHENTICATED`.
5. **Token version check** — if `user.tokenVersion` in JWT does not match DB, request is rejected with `401 TOKEN_VERSION_MISMATCH` (forces refresh/re-login after role/permission changes).
6. **Super-admin bypass** — `isSuperAdmin === true` always passes; audit trail logged.
7. **`hasAdminAccess` computed** — resolved live from `READ:ADMIN_DASHBOARD` permission (not trusted from JWT alone on protected routes).
8. **Resolve effective permissions** — cache lookup → DB fallback → cache populate.
9. **Evaluate requirements** — permission and/or role decorators are checked.
10. **Allow or throw 403** — `PERMISSION_DENIED` or `ROLE_DENIED`.

### Permission Resolution

The `AuthorizationCheckerService.resolve()` method:

1. Check in-memory cache → return on hit
2. Query DB:
   - Fetch user's **direct** role assignments (active, not soft-deleted)
   - Walk role hierarchy upward to collect all ancestor role IDs
   - Fetch role permissions for all collected roles
   - Fetch direct user permissions (not soft-deleted, not expired)
3. Deduplicate into a flat set of `CachedPermission[]` keyed by `action:resource`
4. Populate cache
5. Return `{ roles: string[], permissions: CachedPermission[], cachedAt }`

Note: `roles` in the cache contains **only directly assigned role names**, not ancestor role names. Ancestors are used only when building the permission set.

### Effective Permissions

```
EffectivePermissions(user) =
  DirectUserPermissions (non-expired)
  ∪ PermissionsFromAllRoles (direct roles + ancestor roles via hierarchy)
```

Duplicate permissions are removed. The result is a flat set of `{ action, resource }` pairs.

### Wildcard matching (`matchesPermission`)

When checking if a user satisfies `action:resource`, the checker applies these rules in order:

| User holds | Check for | Result |
|------------|-----------|--------|
| `MANAGE:USER` | `CREATE:USER` | ✅ Pass — MANAGE covers all actions on USER |
| `MANAGE:USER` | `DELETE:USER` | ✅ Pass |
| `READ:USER` | `READ:USER` | ✅ Pass — exact match |
| `READ:USERS` | `READ:USER` | ✅ Pass — plural resource prefix match |
| `READ:USER` | `UPDATE:USER` | ❌ Fail — action mismatch |
| `READ:ROLE` | `READ:USER` | ❌ Fail — resource mismatch |

### Empty requirement lists

When you pass an empty array to programmatic check methods:

| Method | Empty input | Result | Why |
|--------|-------------|--------|-----|
| `hasAllRoles([])` / `hasAllPermissions([])` | `[]` | `true` | Vacuous truth — "all of nothing" is satisfied |
| `hasAnyRole([])` / `hasAnyPermission([])` | `[]` | `false` | No candidate to match |
| `hasRoles([], "all")` | `[]` | `true` | Delegates to `hasAllRoles` |
| `hasRoles([], "any")` | `[]` | `false` | Delegates to `hasAnyRole` |
| `hasPermissions([], "all")` | `[]` | `true` | Delegates to `hasAllPermissions` |
| `hasPermissions([], "any")` | `[]` | `false` | Delegates to `hasAnyPermission` |

Avoid passing dynamic empty arrays to `"any"` mode unless you explicitly want denial.

---

## Decorators (Route Protection)

All decorators below are enforced by the global **`AuthorizationGuard`** (registered in `app.module.ts` after `AuthGuard`). You do **not** need `@UseGuards()` on individual routes.

### Choosing the right decorator

```
Need to protect a route?
│
├─ One permission?
│   └─ @RequirePermission("ACTION", "RESOURCE")
│
├─ Multiple permissions?
│   ├─ User must have ALL of them → @RequireAllPermissions(...)
│   └─ User must have ANY of them  → @RequireAnyPermission(...)
│
└─ Must check role names (rare)?
    ├─ User must have ALL roles → @RequireAllRoles(...)
    └─ User must have ANY role  → @RequireAnyRole(...)
```

Prefer permission decorators. Role decorators only check **directly assigned** role names (no hierarchy).

### Permission action + resource reference

Import types from `@workspace/shared` for autocomplete:

```ts
import type { PermissionAction, PermissionResource } from "@workspace/shared";
```

| Action | Meaning |
|--------|---------|
| `CREATE` | Create a new record |
| `READ` | View a single record or detail |
| `UPDATE` | Modify an existing record |
| `DELETE` | Remove a record |
| `LIST` | List/search collection |
| `MANAGE` | Wildcard — all actions on that resource |

| Resource | Typical use |
|----------|-------------|
| `USER` | User management |
| `ROLE` | Role CRUD |
| `PERMISSION` | Permission CRUD and grants |
| `ADMIN_DASHBOARD` | Admin panel access (`hasAdminAccess` is derived from `READ:ADMIN_DASHBOARD`) |
| `REPORT`, `TELESCOPE`, `EMAIL`, `BACKUP`, … | Feature-specific resources |

Full list: `packages/shared/src/schemas/domain/enums.ts` → `PermissionResourceSchema`.

### Single permission (most common)

```ts
import { RequirePermission } from "../auth/decorators/require-permission.decorator";

@Get()
@RequirePermission("READ", "USER")
findAll() {}

@Post()
@RequirePermission("CREATE", "USER")
create() {}

@Delete(":id")
@RequirePermission("DELETE", "USER")
remove() {}
```

Equivalent to requiring exactly one `action:resource` pair. `MANAGE` on the same resource also satisfies the check.

### Multiple permissions — AND semantics

User must hold **every** listed permission:

```ts
import { RequireAllPermissions } from "../authorization/decorators/require-all-permissions.decorator";

@Post("bulk-import")
@RequireAllPermissions(
  ["CREATE", "USER"],
  ["READ", "USER"],
)
importUsers() {}
```

### Multiple permissions — OR semantics

User must hold **at least one** listed permission:

```ts
import { RequireAnyPermission } from "../authorization/decorators/require-any-permission.decorator";

@Get("reports")
@RequireAnyPermission(
  ["READ", "REPORT"],
  ["LIST", "REPORT"],
)
getReports() {}
```

### Role decorators (use sparingly)

These check **direct role assignments only** — not inherited parent roles.

```ts
import { RequireAllRoles } from "../authorization/decorators/require-all-roles.decorator";
import { RequireAnyRole } from "../authorization/decorators/require-any-role.decorator";

// User must have BOTH roles directly assigned
@Get("admin-audit")
@RequireAllRoles("admin", "auditor")
adminAuditOnly() {}

// User must have at least ONE of these roles directly assigned
@Get("management")
@RequireAnyRole("admin", "manager")
managementOnly() {}
```

### Combining decorators

If a route has **both** permission metadata and role metadata, **both** must pass (logical AND between decorator groups):

```ts
@RequirePermission("READ", "AUDIT_LOG")
@RequireAnyRole("admin", "auditor")
getAuditLog() {}
// User needs READ:AUDIT_LOG AND (admin OR auditor) as a direct role
```

You cannot combine `@RequireAllPermissions` and `@RequireAnyPermission` on the same handler — they share the same metadata key; the last one wins. Use one multi-permission decorator per route.

### @CurrentUser — access the authenticated user

```ts
import { CurrentUser } from "../authorization/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../types/authenticated-user";

@Get("me")
getMe(@CurrentUser() user: AuthenticatedUser) {
  return {
    id: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    hasAdminAccess: user.hasAdminAccess, // set by AuthorizationGuard at runtime
  };
}
```

`hasAdminAccess` on `request.user` is **computed by the guard** on each request. Do not assume the JWT value is current on protected routes.

### Error responses from the guard

| Situation | HTTP | `error` code |
|-----------|------|--------------|
| No JWT / invalid session | 401 | `UNAUTHENTICATED` |
| Stale token after role/permission change | 401 | `TOKEN_VERSION_MISMATCH` |
| Missing permission | 403 | `PERMISSION_DENIED` |
| Missing role | 403 | `ROLE_DENIED` |

### Decorator → checker mapping (what the guard calls internally)

| Decorator | Checker method |
|-----------|----------------|
| `@RequirePermission` | `hasPermission(userId, action, resource)` |
| `@RequireAllPermissions` | `hasAllPermissions(userId, requirements)` |
| `@RequireAnyPermission` | `hasAnyPermission(userId, requirements)` |
| `@RequireAllRoles` | `hasAllRoles(userId, roleNames)` |
| `@RequireAnyRole` | `hasAnyRole(userId, roleNames)` |

---

## Programmatic Checks (Service API)

Use programmatic checks when route decorators are not enough — conditional logic, background jobs, admin previews, or multi-step workflows.

There are two entry points:

| Entry point | When to use |
|-------------|-------------|
| `AuthorizationService` | Fluent Spatie-like API — `authorization.user(id).can(...)` |
| `AuthorizationCheckerService` | Direct checker — inject when you already have `userId` and want the raw methods |

Both read from the same cache/DB resolution path.

### Inject the service

```ts
import { AuthorizationService } from "../authorization/services/authorization.service";

@Injectable()
export class OrderService {
  constructor(private readonly authorization: AuthorizationService) {}
}
```

For direct checker access (e.g. in a controller):

```ts
const checker = this.authorization.checkerService;
// or inject AuthorizationCheckerService directly
```

---

### User proxy — `authorization.user(userId)`

Returns a `UserAuthorizationProxy` scoped to one user.

#### Permission checks

```ts
const userAuth = this.authorization.user(userId);

// Single permission
const canCreate = await userAuth.can("CREATE", "USER");
const canCreateAlt = await userAuth.hasPermissionTo("CREATE", "USER"); // alias

// Multiple permissions — explicit AND / OR
const canManageUsers = await userAuth.hasAllPermissions([
  { action: "CREATE", resource: "USER" },
  { action: "UPDATE", resource: "USER" },
]);
const canViewSomething = await userAuth.hasAnyPermission([
  { action: "READ", resource: "REPORT" },
  { action: "LIST", resource: "REPORT" },
]);

// Unified helper — pass mode "all" (default) or "any"
const canEdit = await userAuth.hasPermissions([
  { action: "UPDATE", resource: "USER" },
  { action: "UPDATE", resource: "ROLE" },
], "any");
```

#### Role checks

```ts
// Single role (direct assignment only)
const isAdmin = await userAuth.hasRole("admin");

// Multiple roles — explicit AND / OR
const isAdminAndAuditor = await userAuth.hasAllRoles(["admin", "auditor"]);
const isAdminOrManager = await userAuth.hasAnyRole(["admin", "manager"]);

// Unified helper — pass mode "all" (default) or "any"
const hasRequiredRoles = await userAuth.hasRoles(["admin", "auditor"], "all");
const hasAnyManagementRole = await userAuth.hasRoles(["admin", "manager"], "any");
```

#### Role mutations

```ts
// Add one role (throws if role name not found)
await userAuth.assignRole("editor");

// Remove one role (no-op if role not found or not assigned)
await userAuth.removeRole("editor");

// Replace entire role set — roles not in the list are removed
await userAuth.syncRoles(["admin", "editor"]);
```

#### Direct permission mutations (user-level grants)

```ts
// Grant a permission directly to the user (bypasses roles)
await userAuth.givePermissionTo("READ", "REPORT");

// Revoke a direct grant (no-op if not found)
await userAuth.revokePermissionTo("READ", "REPORT");
```

Direct grants support expiry via `PermissionService.giveToUser()` (admin API / low-level service). Expired grants are excluded from resolution and cleaned up hourly.

---

### Role proxy — `authorization.role(roleName)`

Returns a `RoleAuthorizationProxy` for managing a role's permissions.

```ts
// Grant permission to the role
await this.authorization.role("admin").givePermissionTo("CREATE", "USER");

// Revoke permission from the role
await this.authorization.role("admin").revokePermissionTo("DELETE", "USER");

// Replace all permissions on the role
await this.authorization.role("merchant").syncPermissions([
  { action: "READ", resource: "REPORT" },
  { action: "LIST", resource: "REPORT" },
]);
```

---

### Checker service — `AuthorizationCheckerService`

Use when you have a `userId` string and want methods without the fluent proxy.

#### All permission methods

```ts
@Injectable()
export class ReportService {
  constructor(private readonly checker: AuthorizationCheckerService) {}

  async canExport(userId: string): Promise<boolean> {
    return this.checker.hasPermission(userId, "READ", "REPORT");
  }

  async canExportOrList(userId: string): Promise<boolean> {
    return this.checker.hasAnyPermission(userId, [
      { action: "READ", resource: "REPORT" },
      { action: "LIST", resource: "REPORT" },
    ]);
  }

  async needsFullAccess(userId: string): Promise<boolean> {
    return this.checker.hasAllPermissions(userId, [
      { action: "READ", resource: "REPORT" },
      { action: "DELETE", resource: "REPORT" },
    ]);
  }

  // Unified — mode "all" | "any"
  async canEdit(userId: string): Promise<boolean> {
    return this.checker.hasPermissions(userId, [
      { action: "UPDATE", resource: "USER" },
      { action: "UPDATE", resource: "ROLE" },
    ], "any");
  }
}
```

#### All role methods

```ts
await checker.hasRole(userId, "admin");
await checker.hasAnyRole(userId, ["admin", "manager"]);
await checker.hasAllRoles(userId, ["admin", "auditor"]);
await checker.hasRoles(userId, ["admin", "manager"], "any");
```

#### Full permission details (replaces old `RbacService.getUserPermissions`)

```ts
const details = await checker.getUserPermissionDetails(userId);
// details.roles     → SlimRoleResponse[]  (id, name, description)
// details.permissions → PermissionDetailsResponse[] (id, action, resource, description)
```

Use this when building user profile responses or admin inspector UIs.

---

### Unified helpers: `hasRoles` and `hasPermissions`

These are thin wrappers that pick AND vs OR semantics via a `mode` parameter. They delegate to `hasAllRoles`/`hasAnyRole` and `hasAllPermissions`/`hasAnyPermission` so behavior is always consistent.

```ts
// ── Roles ──────────────────────────────────────────────────────────

// User must have BOTH admin AND auditor (direct assignments)
await checker.hasRoles(userId, ["admin", "auditor"], "all");

// User needs at least ONE of admin or manager
await checker.hasRoles(userId, ["admin", "manager"], "any");

// Default mode is "all"
await authorization.user(userId).hasRoles(["admin", "auditor"]);

// ── Permissions ────────────────────────────────────────────────────

// User needs ALL of these
await checker.hasPermissions(userId, [
  { action: "CREATE", resource: "USER" },
  { action: "READ", resource: "ADMIN_DASHBOARD" },
], "all");

// User needs ANY one of these
await checker.hasPermissions(userId, [
  { action: "UPDATE", resource: "ROLE" },
  { action: "UPDATE", resource: "PERMISSION" },
], "any");

// Fluent equivalent
await authorization.user(userId).hasPermissions([
  { action: "CREATE", resource: "USER" },
  { action: "READ", resource: "ADMIN_DASHBOARD" },
], "all");
```

**When to use unified vs explicit methods:**

| Scenario | Use |
|----------|-----|
| Mode is fixed at compile time | `hasAllPermissions` / `hasAnyPermission` / `hasAllRoles` / `hasAnyRole` |
| Mode comes from a variable/config | `hasPermissions(..., mode)` / `hasRoles(..., mode)` |
| Route protection | Decorators (guard calls explicit methods internally) |

---

### Complete method reference

#### `UserAuthorizationProxy` (`authorization.user(id)`)

| Method | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `hasPermissionTo` | `(action, resource)` | `Promise<boolean>` | Single permission |
| `can` | `(action, resource)` | `Promise<boolean>` | Alias for `hasPermissionTo` |
| `hasAnyPermission` | `(requirements[])` | `Promise<boolean>` | OR semantics |
| `hasAllPermissions` | `(requirements[])` | `Promise<boolean>` | AND semantics |
| `hasPermissions` | `(requirements[], mode?)` | `Promise<boolean>` | Unified; mode defaults to `"all"` |
| `hasRole` | `(roleName)` | `Promise<boolean>` | Direct assignment only |
| `hasAnyRole` | `(roleNames[])` | `Promise<boolean>` | OR semantics |
| `hasAllRoles` | `(roleNames[])` | `Promise<boolean>` | AND semantics |
| `hasRoles` | `(roleNames[], mode?)` | `Promise<boolean>` | Unified; mode defaults to `"all"` |
| `assignRole` | `(roleName)` | `Promise<void>` | Throws if role not found |
| `removeRole` | `(roleName)` | `Promise<void>` | No-op if missing |
| `syncRoles` | `(roleNames[])` | `Promise<void>` | Replaces all user roles |
| `givePermissionTo` | `(action, resource)` | `Promise<void>` | Direct user grant |
| `revokePermissionTo` | `(action, resource)` | `Promise<void>` | Revokes direct grant |

#### `RoleAuthorizationProxy` (`authorization.role(name)`)

| Method | Description |
|--------|-------------|
| `givePermissionTo(action, resource)` | Grant a permission to the role |
| `revokePermissionTo(action, resource)` | Revoke a permission from the role |
| `syncPermissions(permissions[])` | Replace all permissions on the role |

#### `AuthorizationCheckerService`

| Method | Description |
|--------|-------------|
| `hasPermission(userId, action, resource)` | Single permission check |
| `hasAnyPermission(userId, requirements)` | OR across permissions |
| `hasAllPermissions(userId, requirements)` | AND across permissions |
| `hasPermissions(userId, requirements, mode?)` | Unified permission check |
| `hasRole(userId, roleName)` | Single direct role check |
| `hasAnyRole(userId, roleNames)` | OR across roles |
| `hasAllRoles(userId, roleNames)` | AND across roles |
| `hasRoles(userId, roleNames, mode?)` | Unified role check |
| `can(userId, action, resource)` | Alias for `hasPermission` |
| `getUserPermissionDetails(userId)` | Full roles + permissions for API responses |

#### `AuthorizationService` root facade

| Method | Description |
|--------|-------------|
| `user(userId)` | Returns `UserAuthorizationProxy` |
| `role(roleName)` | Returns `RoleAuthorizationProxy` |
| `roles` | Direct access to `RoleService` (admin CRUD) |
| `permissions` | Direct access to `PermissionService` (admin CRUD) |
| `checkerService` | Direct access to `AuthorizationCheckerService` |

---

### Common recipes

#### Controller: gate an action before calling service

```ts
@Post("assign")
@RequirePermission("UPDATE", "ROLE")
async assignRoles(
  @CurrentUser() actor: AuthenticatedUser,
  @Body() body: AssignRolesDto,
) {
  const checker = this.authorization.checkerService;

  // Extra business rule: actor must also be admin role (direct assignment)
  const isAdmin = await checker.hasRole(actor.id, "admin");
  if (!isAdmin) {
    throw new ForbiddenException("Only admins can assign roles");
  }

  await this.authorization.user(body.targetUserId).syncRoles(body.roleNames);
}
```

#### Service: dynamic mode from config

```ts
async userCanAccess(
  userId: string,
  required: readonly { action: PermissionAction; resource: PermissionResource }[],
  match: "all" | "any",
): Promise<boolean> {
  return this.authorization.user(userId).hasPermissions(required, match);
}
```

#### Service: check before returning sensitive data

```ts
async getUserWithPermissions(requesterId: string, targetId: string) {
  const canView = await this.authorization.user(requesterId).can("READ", "USER");
  if (!canView) {
    throw new ForbiddenException();
  }
  const user = await this.prisma.user.findUnique({ where: { id: targetId } });
  const permissions = await this.authorization.checkerService.getUserPermissionDetails(targetId);
  return { user, permissions };
}
```

#### After mutation: cache + token version

Role and permission mutations automatically:
1. Invalidate the authorization cache for affected users
2. Bump `user.tokenVersion` in the database

The next API request with an old JWT gets `401 TOKEN_VERSION_MISMATCH`. The client should refresh tokens or re-login. You do not need to manually invalidate after calling `assignRole` / `givePermissionTo`.

---

## Cache Layer

### In-memory cache (default)

`AuthorizationCacheService` uses a `Map<string, CacheEntry>` with configurable TTL (default 5 minutes). This is the **default backend** for local development (`NODE_ENV=development` or `AUTHORIZATION_CACHE_BACKEND=memory`).

**Cache key:** `userId`  
**Cache value:** `{ roles: string[], permissions: CachedPermission[], cachedAt: EpochMs }`

Reads are synchronous on the hot path (`AuthorizationCheckerService` → `cache.get()`).

### Redis pub/sub (deployed environments)

`RedisAuthorizationCacheService` delegates all reads/writes to the same in-memory `Map` on each API instance, but publishes invalidation events over Redis so **every instance** drops stale entries when one node mutates RBAC.

| Env var | Default | Meaning |
| --- | --- | --- |
| `AUTHORIZATION_CACHE_BACKEND` | `auto` | `memory`, `redis`, or `auto` (redis when `REDIS_URL` is set and `NODE_ENV !== development`) |
| `REDIS_URL` | unset | Redis connection URL (required when backend is `redis`) |
| `AUTHORIZATION_CACHE_TTL_MS` | `300000` | Entry TTL in milliseconds |

**Why pub/sub instead of Redis-as-primary-store?** Permission checks stay sync and fast (local Map). Redis is only for **cross-instance invalidation** — no blocking Redis reads on every request.

Module wiring (`authorization.module.ts`):

```ts
{
  provide: AuthorizationCacheService,
  useFactory: (config, memory, redis) =>
    config.useRedisAuthorizationCache ? redis : memory,
  inject: [TypedConfigService, "IN_MEMORY_AUTH_CACHE", RedisAuthorizationCacheService],
}
```

### Cache Invalidation

Cache is automatically invalidated when:

| Mutation | Invalidation |
|----------|-------------|
| Role assigned/removed from user | `invalidateUser(userId)` |
| Role permissions changed | `invalidateUsersWithRole(roleId)` |
| Direct user permission changed | `invalidateUser(userId)` |
| Role or permission deleted | Cascading invalidation of all affected users |

### Role Hierarchy Cache

The role hierarchy graph is cached separately with a 15-minute TTL. It is invalidated when a role's `parentId` changes.

The role hierarchy graph is cached separately with a 15-minute TTL. It is invalidated when a role's `parentId` changes (including `RoleService.restore()`).

---

## Session profile vs permissions (`/me` vs `/auth/permissions`)

The API **splits** identity profile from RBAC payload so clients can refetch permissions after admin mutations without reloading the full user record on every navigation.

| Endpoint | Returns | When to use |
| --- | --- | --- |
| `GET /auth/me` | `UserResponse` — id, email, `fullName`, flags, **roles** (no `permissions`) | Sidebar identity, profile pages, SSR shell |
| `GET /auth/permissions` | `SessionPermissionsResponse` — roles, **permissions**, `tokenVersion`, `hasAdminAccess`, optional `isImpersonating` / `originalUserId` | Permission-gated UI, admin access panels, impersonation banner |

**Client query keys:**

- `["auth", "me"]` — `api.auth.me.useQuery()`
- `["auth", "permissions"]` — `api.auth.permissions.useQuery()`

**After RBAC mutations** (role assign/remove, permission grant/revoke/sync), invalidate both:

```ts
import { invalidateSessionAuth } from "@workspace/client/lib/auth/invalidate-session-auth";

await invalidateSessionAuth(queryClient);
```

`UserAccessPanel` and impersonation flows call this helper on mutation success. `IdentityService.invalidateMe()` clears the API-side session cache (Redis or in-memory) for both endpoints when authorization events fire.

**Admin user detail** (`GET /auth/admin/users/:id`) still returns full `AdminUserDetail` including `permissions` and `directPermissionIds` — that endpoint is for managing *other* users, not the current session.

---

## Impersonation (super-admin)

Super-admins can act as another user for support/debugging. The original admin refresh token is **not** rotated — only the access cookie is swapped.

| Endpoint | Auth | Sets cookie? | Notes |
| --- | --- | --- | --- |
| `POST /auth/impersonate/:userId` | `@SuperAdminOnly()` + `@RequirePermission("CREATE", "USER")` | Yes (`SetAuthCookiesInterceptor`) | JWT `sub` = target user; claims `isImpersonating: true`, `originalUserId` = admin |
| `POST /auth/stop-impersonation` | Authenticated only (no super-admin guard) | Yes | Must work while JWT `sub` is the impersonated user; returns `accessToken` for original admin |

**Stop flow:** client calls `stopImpersonation` → interceptor sets admin access cookie from response → `invalidateSessionAuth()` refetches `/me` and `/auth/permissions`.

**Admin UI:**

- `ImpersonateUserButton` on `/users/[id]` (super-admin, target not super-admin, not self)
- `ImpersonationBanner` in `dashboard-shell` while `permissions.isImpersonating === true`

**RLS during impersonation:** `app.current_user_id` is the impersonated user's `sub` — queries run as the target unless bypass applies (super-admin on target JWT is usually false; staff see target-scoped data).

---

## Request Lifecycle

```
HTTP Request
     │
     ▼
┌───────────────────┐
│ AuthGuard         │
│ Validate JWT      │
│ request.user = payload
│ (identity + tokenVersion)
└─────────┬─────────┘
          │
          ▼
┌─────────────────────────┐
│ AuthorizationGuard      │
│                         │
│ 1. Read route metadata  │
│ 2. No metadata? → allow │
│    (still set hasAdminAccess)
│ 3. Require auth → 401   │
│ 4. tokenVersion check   │
│    → 401 if stale       │
│ 5. Super-admin bypass   │
│ 6. Resolve permissions  │
│    (cache → DB → cache) │
│ 7. Evaluate decorators  │
│ 8. Set hasAdminAccess   │
└────────────┬────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
  ALLOW          401 / 403
```

---

## Web vs Admin Sessions (Dual Cookies)

Web and admin use **the same JWT shape** but **separate httpOnly cookie pairs** so sessions stay isolated on the same browser:

| App | Access cookie | Refresh cookie | Login header |
|-----|---------------|----------------|----------------|
| Web (`localhost:3000`) | `accessToken` | `refreshToken` | none (or `web`) |
| Admin (`localhost:3001`) | `adminAccessToken` | `adminRefreshToken` | `X-Client-Type: admin` |

**Why two cookie pairs?**
- An admin user can log into **both** web and admin (separate logins).
- Logging out of the admin panel clears only `adminAccessToken` / `adminRefreshToken` — the web session stays alive.
- `AuthGuard` and `RefreshTokenGuard` read **only** the cookie pair for the requesting app (`X-Client-Type`), never cross-fallback.

**Admin login gate:** `POST /auth/login` with `X-Client-Type: admin` requires `READ:ADMIN_DASHBOARD` (or super-admin). Users without admin permissions cannot obtain an admin cookie set even with valid credentials.

**User session cache (login → Redis):** On successful login (web, admin, or merchant — same API, different `X-Client-Type`), `LoginService` calls `IdentityService.warmSessionCache()` which stores:

| Redis key | Payload | Schema |
|-----------|---------|--------|
| `auth:me:{userId}` | `GET /auth/me` response | `UserResponse` |
| `auth:permissions:{userId}` | `GET /auth/permissions` response (without impersonation claims) | `SessionPermissionsResponse` |

- **Backend:** `memory` in development (default), `redis` when `REDIS_URL` is set outside development (override with `USER_SESSION_CACHE_BACKEND=memory|redis`).
- **TTL:** `USER_SESSION_CACHE_TTL_MS` (default 30 minutes). Invalidated immediately on RBAC changes via `IdentityService.invalidateMe()`.
- **Read path:** `GET /auth/me` and `GET /auth/permissions` check Redis first, then PostgreSQL on miss.

JWT access/refresh tokens are **not** stored in Redis — only profile + RBAC payloads.

---

## JWT Design

The JWT carries **identity + lightweight flags** — no permission lists, no role lists:

```json
{
  "sub": "user_123",
  "id": "user_123",
  "email": "admin@example.com",
  "fullName": "Admin User",
  "isActive": true,
  "isSuperAdmin": false,
  "isEmailVerified": true,
  "hasAdminAccess": true,
  "tokenVersion": 3,
  "isImpersonating": true,
  "originalUserId": "admin_user_id"
}
```

### `tokenVersion` — stale token detection

Every role/permission mutation bumps `user.tokenVersion` in the database. The JWT embeds the version at issuance time.

On protected routes, `AuthorizationGuard` compares JWT `tokenVersion` to the DB value. If they differ:

```json
{
  "statusCode": 401,
  "message": "Token revoked — authorization state changed",
  "error": "TOKEN_VERSION_MISMATCH"
}
```

**What this means for you:**
- Permission changes take effect on the **next request** for cache resolution.
- But a user with an old JWT is **forced to refresh/re-login** before accessing protected routes again.
- Unguarded routes (no authorization decorators) skip the version check.

### Why `hasAdminAccess` is in the JWT

`hasAdminAccess` is a pre-computed boolean included because the **Next.js proxy** (`proxy.ts`) runs server-side on every page navigation and needs a fast, synchronous way to gate admin panel routes without an async DB call. It is NOT a substitute for the guard-level RBAC check — the API enforces fine-grained permissions.

On protected API routes, the guard **re-resolves** `hasAdminAccess` from `READ:ADMIN_DASHBOARD` and overwrites the value on `request.user`.

### Why permissions are NOT in the JWT

Full permission resolution happens at guard time via `AuthorizationCheckerService`. Embedding permissions in the JWT would require token regeneration on every role change and would quickly exceed cookie size limits.

### Token lifecycle

1. **Login** → `TokenService.generateTokens()` signs JWT with identity + `hasAdminAccess` + `tokenVersion`
2. **Proxy reads JWT** → `decodeJwtPayload()` checks `hasAdminAccess` for Next.js route gating
3. **API guard** → validates `tokenVersion`, resolves full permissions from DB/cache
4. **Permission/role mutation** → bumps `tokenVersion`, invalidates cache
5. **Next protected request** → `TOKEN_VERSION_MISMATCH` until client refreshes token

---

## Admin API

### Roles

| Method | Endpoint | Permission |
|--------|----------|------------|
| `GET` | `/api/v1/admin/roles` | `LIST:ROLE` |
| `POST` | `/api/v1/admin/roles` | `CREATE:ROLE` |
| `GET` | `/api/v1/admin/roles/:id` | `READ:ROLE` |
| `PATCH` | `/api/v1/admin/roles/:id` | `UPDATE:ROLE` |
| `DELETE` | `/api/v1/admin/roles/:id` | `DELETE:ROLE` |
| `PATCH` | `/api/v1/admin/roles/:id/parent` | `UPDATE:ROLE` |
| `POST` | `/api/v1/admin/roles/:id/permissions` | `UPDATE:ROLE` |
| `POST` | `/api/v1/admin/roles/preview` | `READ:ROLE` |
| `POST` | `/api/v1/admin/roles/user/assign` | `UPDATE:ROLE` |
| `POST` | `/api/v1/admin/roles/user/remove` | `UPDATE:ROLE` |
| `POST` | `/api/v1/admin/roles/user/sync` | `UPDATE:ROLE` |

User role bodies use action-style URLs (same pattern as permission user grants):

```json
// assign / remove
{ "userId": "uuid", "roleId": "uuid" }

// sync — replaces all direct role assignments
{ "userId": "uuid", "roleIds": ["uuid", "uuid"] }
```

### Permissions

| Method | Endpoint | Permission |
|--------|----------|------------|
| `GET` | `/api/v1/admin/permissions` | `LIST:PERMISSION` |
| `POST` | `/api/v1/admin/permissions` | `CREATE:PERMISSION` |
| `GET` | `/api/v1/admin/permissions/:id` | `READ:PERMISSION` |
| `PATCH` | `/api/v1/admin/permissions/:id` | `UPDATE:PERMISSION` |
| `DELETE` | `/api/v1/admin/permissions/:id` | `DELETE:PERMISSION` |
| `GET` | `/api/v1/admin/permissions/groups/list` | `LIST:PERMISSION` |
| `POST` | `/api/v1/admin/permissions/check` | `READ:PERMISSION` |
| `POST` | `/api/v1/admin/permissions/user/grant` | `UPDATE:PERMISSION` |
| `POST` | `/api/v1/admin/permissions/user/revoke` | `UPDATE:PERMISSION` |
| `POST` | `/api/v1/admin/permissions/user/sync` | `UPDATE:PERMISSION` |

**Check vs mutate:** `POST /check` is read-only inspection (`READ:PERMISSION`). Grant, revoke, and sync are mutations (`UPDATE:PERMISSION`).

```json
// POST /admin/permissions/check
{ "userId": "uuid", "action": "READ", "resource": "USER" }

// Response
{
  "allowed": true,
  "grants": [
    { "via": "role", "detail": "admin" },
    { "via": "direct", "detail": "expiresAt:1786300000000" }
  ]
}
```

### Audit Log

| Method | Endpoint | Permission |
|--------|----------|------------|
| `GET` | `/api/v1/admin/audit` | `READ:AUDIT_LOG` |

### Admin panel UI

The admin app (`apps/admin`) wires these APIs for day-to-day RBAC management:

| Route | Purpose |
|-------|---------|
| `/users/all` | Paginated user list (`GET /auth/admin/users`) with links to per-user management |
| `/users/[id]` | User profile + `UserAccessPanel` — assign/remove roles, grant/revoke direct permissions, per-user permission checker; **Impersonate** (super-admin) |
| `/settings/access` | Roles & permissions catalog + global permission checker |

Client calls use `api.auth.me`, `api.auth.permissions`, `api.auth.adminUsers`, `api.auth.adminUserDetail`, `api.auth.impersonate`, `api.auth.stopImpersonation`, and `api.admin.roles.*` / `api.admin.permissions.*` from `@workspace/client`. SSR prefetch uses `createServerCaller()` on each page.

After RBAC mutations in the admin UI, call `invalidateSessionAuth(queryClient)` so the current session's `/me` and `/auth/permissions` queries refetch.

---

## Seeding

The seed files in `prisma/seed/` create:

1. **Permissions** — all `Action:Resource` pairs organized by group
2. **Roles** — `SuperAdmin`, `Admin`, `Manager`, `User`
3. **Role hierarchy** — flat by default (no `parentId`). Use hierarchy only for extension roles (e.g. Viewer ← Editor), never User → staff.
4. **Role-permission assignments** — SuperAdmin (full), Admin (admin panel), Manager (limited admin), User (customer app only)
5. **User-role assignments** — each test user gets the appropriate role

Run the full seed cycle:

```bash
npx prisma migrate reset --force
npx prisma migrate dev
npx prisma db seed
npx prisma generate
```

---

## Advanced Features

### Generic capability catalog (`capability_definitions`)

Platform RBAC, merchant portal grants, and sidebar gating share one **dynamic slug catalog** stored in `capability_definitions`:

| Scope | Example slug | Source |
|-------|--------------|--------|
| `PLATFORM` | `platform:user.read` | Synced from `permissions` (`CapabilityDefinitionService.syncPlatformCapabilitiesFromPermissions`) |
| `MERCHANT` | `merchant:manage_api_keys` | Seeded by `pnpm db:seed` (`prisma/seed/capabilities.ts`) + editable via admin (no redeploy) |
| `ADMIN` | (reserved) | Future admin-only slugs |

**API**

- `GET /capabilities/catalog?scope=MERCHANT` — list catalog entries (labels, sort order).
- `GET /navigation/menu?scope=ADMIN|MERCHANT` — DB-driven menu tree with `requiredCapabilities[]` per item.

**Session**

- `GET /auth/permissions` returns `capabilities: string[]` (platform slugs derived from effective permissions).
- Merchant portal uses `GET /merchant/me` → `memberships[].capabilities[]`.

**Frontend**

- Admin role matrix: `/rewardhub/role-capabilities` loads catalog + grants from the API.
- Sidebars hydrate from `GET /navigation/menu` and filter client-side with `hasCapability(slug)`.
- Static JSON menus remain as fallback until the navigation API responds.

**Merchant defaults**

- `merchant_role_capabilities` stores FK → `capability_definitions.id`.
- CASHIER defaults exclude `merchant:manage_api_keys` and `merchant:manage_rewards` (see seed + admin panel).

### Permission Expiry

Direct user permissions can have an `expiresAt` timestamp (epoch ms). An hourly background job (`PermissionExpiryCleanup`) soft-deletes expired grants and invalidates caches.

Expiry is set via the low-level `PermissionService.giveToUser()` or the admin API — not through the fluent `givePermissionTo()` proxy (which grants without expiry):

```ts
// Low-level — grant with 24-hour expiry
const permission = await this.permissionService.findByActionResource("READ", "REPORT");
if (permission !== null) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  await this.permissionService.giveToUser(userId, permission.id, expiresAt);
}
```

Expired grants are excluded during `AuthorizationCheckerService.resolve()`.

### Conflict Detection

The `ConflictDetectionService` defines rules for incompatible roles:

```ts
// Example: "admin" and "readonly" cannot be assigned together
await this.authorization.user(userId).assignRole("admin");
await this.authorization.user(userId).assignRole("readonly"); // throws ConflictException
```

### Permission Preview

Preview the effect of a role change before applying it:

```ts
const preview = await this.authorization.roles.previewRoleChange(roleId, newPermissionIds);
// preview.gained — permissions that would be added
// preview.lost — permissions that would be removed
```

### Role Hierarchy

Roles support parent-child hierarchy. A child role inherits all permissions from its parent:

```ts
// "editor" inherits all permissions from "viewer"
await this.authorization.roles.create({
  name: "editor",
  parentId: viewerRole.id,
});
```

Circular references are detected via full DFS traversal.

### Policy Registry

The `PolicyRegistry` allows resource-specific authorization rules beyond RBAC:

```ts
// Define a policy
this.policyRegistry.register("POST", "UPDATE", async (userId, post) => {
  return post.authorId === userId; // Only update own posts
});
```

### Permission Migration Service

The `PermissionMigrationService` syncs the code registry with the database on startup:

```ts
const result = await this.migrationService.syncFromRegistry();
// result.created — new permissions inserted from PERMISSION_DEFINITIONS
// result.updated — metadata refreshed
// result.orphaned — DB-only rows (e.g. admin-created) not in registry
```

Run on startup or as a CI step.

### Event Emitter

The `AuthorizationEventEmitter` emits typed events when authorization state changes:

```ts
emitter.on(AuthorizationEvents.ROLE_CHANGED, (event) => {
  console.log(`Role ${event.roleName} was ${event.type}`);
});
```

Events: `ROLE_CHANGED`, `PERMISSION_CHANGED`, `USER_ROLE_CHANGED`, `USER_PERMISSION_CHANGED`

### Audit Logging

Every authorization mutation is logged via `AuthorizationAuditService`:

- Role created/updated/deleted/restored
- Permission created/updated/deleted/restored
- User role assigned/removed/synced
- User permission granted/revoked/synced/expired
- Super-admin bypass events

Query via `GET /api/v1/admin/audit` with pagination and filters.

### Rate Limiting

The `AuthRateLimitService` prevents abuse of authorization checks: 1000 checks per 15-minute sliding window per user.

### Health Check

The `AuthorizationHealthIndicator` verifies the authorization system is functioning:

```ts
// In your health check module
const result = await this.authorizationHealth.isHealthy("authz");
```

---

## Directory Structure

### Constants

- `authorization.constants.ts` — Metadata keys for decorators, type definitions for `RequiredPermissionsMetadata` and `RequiredRolesMetadata`

### Decorators

- `require-all-permissions.decorator.ts` — `@RequireAllPermissions([...])` — AND semantics
- `require-any-permission.decorator.ts` — `@RequireAnyPermission([...])` — OR semantics
- `require-all-roles.decorator.ts` — `@RequireAllRoles(...)` — AND semantics
- `require-any-role.decorator.ts` — `@RequireAnyRole(...)` — OR semantics
- `current-user.decorator.ts` — `@CurrentUser()` — extracts authenticated user from request

### Guards

- `authorization.guard.ts` — Unified global guard handling all decorator types

### Services

- `authorization.service.ts` — Spatie-like fluent facade (`authorization.user(id)`, `authorization.role(name)`)
- `authorization-checker.service.ts` — Permission/role evaluation with cache
- `role.service.ts` — Role CRUD, hierarchy, assignment, batch operations
- `permission.service.ts` — Permission CRUD, direct user grants, expiry
- `auth-rate-limit.service.ts` — Sliding window rate limiting
- `conflict-detection.service.ts` — Role conflict rules

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Enum-based permissions (`PermissionAction` + `PermissionResource`) | More type-safe than string-based; TypeScript catches typos at compile time |
| `MANAGE` = wildcard | Single permission covers full CRUD; simpler than `users.*` string matching |
| `hasAdminAccess` in JWT | Next.js proxy needs it synchronously for route gating; single boolean, not a permission list |
| Permissions NOT in JWT | Full resolution at guard time; avoids cookie bloat |
| `tokenVersion` in JWT | Forces re-auth after role/permission mutations; prevents stale authorization |
| Role hierarchy for permissions only | Ancestor roles contribute permissions; role-name checks use direct assignments only |
| In-memory cache + Redis pub/sub invalidation | Local reads stay sync; deployed instances share invalidation via Redis |
| Single-tenant vs multi-tenant RLS bypass | `TENANCY_ENABLED` controls whether staff `hasAdminAccess` bypasses RLS — see [ADR 007](./adr/007-tenancy-and-rls-bypass.md) and [Prisma §10](./prisma.md#10-row-level-security) |
| Soft-delete on all RBAC tables | Audit trail + safe rollback; `isDeleted` flag with `deletedAt` timestamp |
| Explicit junction tables | Composite uniqueness, clear ownership, easier bulk ops, better indexes |
| Super-admin bypass | Short-circuits all permission checks; logged for audit trail |
| `hasRoles` / `hasPermissions` delegate to explicit methods | Guarantees consistent empty-array and AND/OR semantics |
| `COOKIE_DOMAIN=localhost` | Required for local dev where API and apps run on different ports |

---

## Troubleshooting

### Login redirect loop

**Symptom:** After login, user is redirected back to `/auth/login`.

**Cause:** JWT missing `hasAdminAccess`. The Next.js proxy checks `payload?.hasAdminAccess === true` from the JWT. If it's missing or `false`, the proxy redirects to login.

**Fix:** Ensure `hasAdminAccess` is included in `AccessTokenPayload` in `token.service.ts` and `AccessTokenPayloadSchema` in `packages/shared/src/schemas/auth/token.ts`.

### Cookie not visible to proxy

**Symptom:** Cookies are set (visible in DevTools) but proxy can't read them.

**Cause:** API runs on `localhost:8080`, proxy runs on `localhost:3000`/`localhost:3001`. Cookies scoped to `localhost:8080` are not sent to other ports.

**Fix:** Set `COOKIE_DOMAIN=localhost` in `apps/api/.env`. This makes the browser share cookies across all localhost ports.

### Permission check returns false for super-admin

**Symptom:** Super-admin gets 403 on a protected route.

**Cause:** The guard should bypass super-admins before checking permissions.

**Fix:** Verify `isSuperAdmin` is in the JWT and the guard checks it first (line ~75 of `authorization.guard.ts`).

### Cache stale after role change

**Symptom:** User still has old permissions after role is changed.

**Cause:** Cache not invalidated after mutation, or client still using old JWT.

**Fix:**
1. Verify `RoleService` / `PermissionService` call `cache.invalidateUser()` after mutations.
2. Verify `tokenVersion` was bumped — client must refresh token after role/permission changes.
3. Check that the `AuthorizationEventEmitter` is wired correctly.

### TOKEN_VERSION_MISMATCH after admin changes roles

**Symptom:** User gets 401 with `TOKEN_VERSION_MISMATCH` immediately after an admin changes their roles.

**Cause:** Expected behavior. `tokenVersion` in JWT no longer matches DB.

**Fix:** Client should call the refresh-token endpoint or redirect to login. Do not disable the version check.
