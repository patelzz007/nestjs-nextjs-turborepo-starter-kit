---
title: "Backend: the Authorization Kernel"
tags: ["authorization", "nestjs", "kernel", "rbac", "acl", "abac", "audit"]
description: "How the API decides allow or deny: the guard and @RequirePermission, the kernel's precedence, scopes, overrides, ACLs, ownership, policies, explain, audit, privilege-escalation protection, and the roles, permissions and caches behind it."
order: 21
author: "Platform Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Backend: the Authorization Kernel

> [!NOTE]
> Read the [overview](./overview.md) first. This page explains **how the API decides**.
> All paths are relative to `apps/api/src/` unless stated otherwise.

---

## 1. The request journey

This is what happens to every HTTP request, step by step (spec §74):

```text
 1. RequestContextMiddleware  binds the request context (guards open their own auth lookups)
 2. ApiKeyAuthGuard           optional merchant/POS API key
 3. AuthGuard                 validates the JWT → request.user
 4. RestrictedSessionGuard    blocks restricted sessions (email / MFA not done)
 5. AuthorizationGuard        ← THIS PAGE
      a. validate the token version (revoked tokens → 401)
      b. resolve + verify the tenant (:tenantSlug) and any location (route, query, body)
      c. SuperAdmin? → audited bypass
      d. enforce every decorator through the Kernel (audited)
      e. compute hasAdminAccess
 6. RlsInterceptor            narrows the RLS scope to this user + verified tenant
 7. Controller → Service → Prisma → PostgreSQL (RLS applies)
```

The guard is **global** (`APP_GUARD` in `app.module.ts`). You never add it by hand; you only
**declare** what a route needs with a decorator.

---

## 2. Declaring what a route needs

### 2.1 The decorators

| Decorator | Use it when | Example |
|---|---|---|
| `@RequirePermission(action, resource)` | The route acts on a whole collection, or on no record | `@RequirePermission("LIST", "ROLE")` |
| `@RequirePermission(action, resource, { resourceId })` | The decision depends on **one record** (ownership, ACL, scope, policy) | see below |
| `@SuperAdminOnly()` | Platform-operator-only operations | impersonation, MFA recovery review |
| `@Public()` | No authentication at all (health, login, public reward pages) | — |

`@RequirePermission` lives in `platform/presentation/http/security/decorators/require-permission.decorator.ts`.
A route may stack several, and **every one must pass**. An admin acting on someone else's record
declares the permission and the record, so a self-only grant (everyone may update their own user)
can never satisfy it:

```ts
@RequirePermission("DELETE", "USER")
@RequirePermission("DELETE", "USER", { resourceId: "userId", description: "A platform admin bans an account" })
```

### 2.2 Record targets

```ts
import { attributesFromBody, fromParam, self } from "../../../../platform/presentation/http/security/decorators/permission-target";

// The record id is a route param name:
@RequirePermission("UPDATE", "PERMISSION", { resourceId: "id" })                     // PATCH /permissions/:id

// The caller acts on their own account (self-service):
@RequirePermission("UPDATE", "USER", { resourceId: self() })                          // POST /auth/change-password

// Explicit extractor + policy attributes from the body:
@RequirePermission("UPDATE", "REWARD", { resourceId: fromParam("rewardId"), attributes: attributesFromBody(["status"]) })
```

`description` is optional and only documents the route (audits and docs show it). Rules the guard
applies (`platform/presentation/http/security/guards/authorization.guard.ts`):

- **Fail closed:** if you declare `resourceId` and it cannot be resolved (missing param, anonymous caller for `self()`), the request is **denied**. It is never silently turned into a collection check.
- **Tenant attributes win:** the tenant / store / location the request targets are added to the resource attributes **after** your `attributes`, so a body cannot override the routed tenant.
- `attributesFromBody` only keeps policy-safe scalar values (string, number, boolean, null, lists).

### 2.3 What a denial looks like

Every authorization failure throws the same `AuthorizationException`:

```json
{ "statusCode": 403, "message": "You do not have permission to perform this action.", "error": "PERMISSION_DENIED" }
```

It **never** says which rule failed (that would help attackers). Use
[`explain()`](#8-explain--why-was-this-allowed-or-denied) to debug.

Missing or invalid authentication is `401`, not `403` (spec §99).

---

## 3. The Kernel's public API

`AuthorizationKernelService` (`contexts/authorization/infrastructure/kernel/authorization-kernel.service.ts`),
reached through the `AuthorizationKernelPort`:

| Method | Returns | Use it for |
|---|---|---|
| `can(request)` | `"ALLOW" \| "DENY"` | Conditional logic inside services, tests |
| `authorize(request, auditMetadata?)` | `void`, throws 403 | **Security boundaries.** Audits the decision. |
| `explain(request)` | full `AuthorizationResult` with ordered steps | Debugging, admin tooling, tests |

An `AuthorizationRequest` looks like:

```ts
{
  subject: { userId: "u-1", tenantId: "tenant-a", locationId: "location-1", isSuperAdmin: false },
  action: "UPDATE",
  resource: "ORDER",
  resourceId: "order-123",                          // optional
  resourceAttributes: { tenantId: "tenant-a", locationId: "location-1", status: "PENDING" }, // optional
}
```

> [!IMPORTANT]
> `subject.tenantId` and `locationId` are **claims**. The kernel
> re-verifies them against memberships every time. Passing a forged tenant gets
> `DENY`, not "access to that tenant".

---

## 4. Decision precedence (the most important section)

The kernel evaluates in this exact order (spec §39, §65). The first step that decides wins.

```text
 1. SuperAdmin                              → ALLOW   (platform bypass; the guard audits it)
 2. Unknown action or resource              → DENY    (fail closed)
 3. Tenant verification                     → DENY if the claimed tenant / store /
                                                        location is not proven by membership
 4. AccessControlService (ADR 067), the first allow path that says yes wins:
      a. role       — the member's role holds the `noun.verb` permission (in the store asked about)
      b. grant      — a live extra permission (timed or permanent) on top of the role
      c. share      — this one record was shared with the member (view / edit), still in force
      d. ownership  — the record is the caller's own (the ownership registry)
 5. Otherwise                               → DENY    (default deny; nothing ever says "deny")
```

### Worked examples

| Situation | Result | Deciding step |
|---|---|---|
| Role grants `REWARD:DELETE`; a leftover `DENY` row exists for it | **ALLOW** — there is no explicit DENY (ADR 067) | role |
| No role permission; a live grant of `ANALYTICS:READ` until tomorrow | **ALLOW** until it ends, then DENY | grant |
| No role permission; reward #7 shared with the member to view | **ALLOW** to read #7 only | share |
| Member of Org A with no roles asks to `DELETE TENANT` | **DENY** — membership alone grants nothing | 5 |
| `UPDATE:ORDER:TENANT` grant, order belongs to Org B | **DENY** — wrong tenant | 3 |
| `/tenants/:tenantSlug` of a tenant you're not in | **404** before the kernel even runs | guard |

---

## 5. Grants and scopes

### 5.1 Where grants come from

`SubjectGrantsLoader` (`kernel/subject-grants.loader.ts`) collects, in a fixed number of
batched queries (no N+1, spec §58):

| Source | Scope used |
|---|---|
| Role permissions (`UserRole` → `RolePermission`; roles are flat, nothing is inherited) | the permission row's scope |
| Location roles (`MembershipLocationScope.roleId`) | **always `LOCATION`, bound to that location** — a location role can never grant tenant- or platform-wide access |
| User `ALLOW` overrides (`user_permissions.effect = ALLOW`) | the permission row's scope |
| Implicit self grants | `OWN` — see below |
| User `DENY` overrides | collected separately as **denials** |

**Implicit self grants** (`IMPLICIT_SELF_GRANTS` in `packages/shared/src/authorization/permission.ts`):
every signed-in user may `READ`/`UPDATE` their **own** `USER` and `PROFILE`. That is the
complete list. Deleting your own account still needs an assigned permission.

### 5.2 What each scope means

| Scope | Satisfied when | Typical holder |
|---|---|---|
| `GLOBAL` | always | platform staff (`Admin`, `Manager`) |
| `TENANT` | the request has a **verified** tenant **and** (for a specific record) the record's `tenantId` matches | tenant-wide roles |
| `LOCATION` | the request has a **verified** location, the grant is bound to it (a location role) or covers it, and the record's `locationId` matches | `Location Manager`, `Location Staff` |
| `OWN` | a specific record is targeted **and** the DB says the caller owns it | customers (`User` role) |
| `RESOURCE` | never by itself — only through explicit ACL entries | — |

> [!WARNING]
> For `TENANT` / `LOCATION` grants on a **specific record**, the kernel
> needs to know the record's tenant (`resourceAttributes.tenantId` /
> `locationId`). If you do not pass it, the grant does **not** apply (fail closed).

### 5.3 Ownership

`ResourceOwnershipResolver` reads the owner from the database for `USER` and `PROFILE`.
Ownership is **never** read from the request body, so a client cannot
claim ownership by sending `ownerId`. Other resource types have no ownership model; `OWN`
grants on them never match. To add one, extend the resolver's `switch` (see
[recipes](./recipes.md#6-give-a-new-resource-an-owner)).

### 5.4 Per-user overrides (ALLOW / DENY)

`UserPermission` rows have an `effect` column:

- `ALLOW` — adds a permission on top of the user's roles.
- `DENY` — removes that exact permission even if a role grants it (spec §40).

Admin API: `POST /admin/permissions/user/grant` with `{ userId, permissionId, effect?: "ALLOW" | "DENY", expiresAt? }`.
Overrides can expire (`expiresAt`); expired rows are ignored.

---

## 6. ACL — resource-level exceptions

`ResourceAcl` rows (managed by `AclService`) say "subject X may / may not do action Y on
resource Z". Use them **only for exceptions** (spec §124), not for ordinary access.

| Column | Meaning |
|---|---|
| `subjectType` + `subjectId` | a `USER` id, or a `ROLE` id (applies to everyone holding that role) |
| `action` | the exact action |
| `resourceType` + `resourceId` | `resourceId = null` means **every** resource of that type |
| `effect` | `ALLOW` or `DENY` (DENY always wins) |
| `tenantId` / `locationId` | optional: the entry only applies inside that verified tenant |
| `conditions` | optional JSON rule (same language as policies) |
| `expiresAt`, `isDeleted` | expired or deleted entries never match |

---

## 7. Conditional rules — removed

There is no policy language any more. Cedar (tenant and platform policies, drafts, simulation,
publishing) and the JSON condition engine (`PolicyDefinition`, `Permission.conditions`,
`ResourceAcl.conditions`) were removed in ADR 067 Phase 4: every job they did is covered by roles,
grants, shares, ownership, store scope and the guardrails in `tenant-access.policy.ts`. A rule that
really depends on a record's state ("a completed order is read-only") is a plain check in that
record's command handler, with a test, where the next reader will find it.

Older `AuthorizationAudit` rows can still name `source: "policy"` and carry `policyIds`: they
record decisions made before the removal and are kept as history.

---

## 8. `explain()` — why was this allowed or denied?

```ts
const result = await kernel.explain(request);
// result.decision  → "DENY"
// result.evaluation →
// [
//   { source: "acl",   effect: "NO_MATCH", reason: "No explicit ACL entry" },
//   { source: "scope", effect: "DENY", reason: "Resource belongs to another tenant" },
//   { source: "default", effect: "DENY", reason: "No grant applies in this scope — default deny" }
// ]
```

Over HTTP (admins with `READ:PERMISSION` only):

```http
GET /api/v1/authorization/decisions/explain?action=UPDATE&resource=ORDER&resourceId=order-123&userId=<someone>
```

`source` is one of `superadmin`, `validation`, `tenant`, `override`, `acl`, `role`, `scope`,
`ownership`, `relationship`, `policy`, `default`.

---

## 9. List endpoints

Never load everything and filter in JavaScript. A list endpoint narrows its query in the
database: the route's `@RequirePermission("LIST", …)` decides whether the caller may list at all,
the repository's `where` clause narrows to what the screen asks for (tenant, store, owner), and
[RLS](./tenancy-and-rls.md) hides every other tenant's rows underneath, even if the `where` forgets.

---

## 10. Auditing

`AuthorizationAuditKernelService` writes to `AuthorizationAudit` (spec §63):

| Decision | Logged? |
|---|---|
| Any `DENY` | ✅ always |
| `CREATE`, `UPDATE`, `DELETE` and the lifecycle verbs (`APPROVE`, `REJECT`, `SUSPEND`, `BAN`, …) (allowed) | ✅ always |
| `READ` / `LIST` of `USER`, `ROLE`, `PERMISSION`, `AUDIT_LOG`, `SYSTEM_SETTINGS` | ✅ (sensitive reads) |
| Other reads | ❌ |

Each row has the actor, tenant, action, resource, decision, reason, policy / ACL ids, the full
evaluation, IP, user agent, request id and duration. The table is **bypass-only** under RLS,
so it is written through `SystemPrismaService` (see [tenancy guide](./tenancy-and-rls.md#7-the-two-database-clients)).
An audit failure is logged but never fails the request.

SuperAdmin bypasses are recorded separately in `PermissionAuditLog`
(`SUPER_ADMIN_BYPASS`), together with every role / permission change.

---

## 11. Protecting authorization administration (privilege escalation)

`PrivilegeEscalationService` runs on every role / permission mutation in
`modules/authorization/admin/*.controller.ts` (spec §68, §69). Platform SuperAdmins are exempt.

| Rule | Blocks |
|---|---|
| **No self-escalation** | changing your own role assignments or direct permissions; editing or re-activating a role you hold |
| **Subset rule** | granting or assigning any permission you do not yourself hold with `GLOBAL` reach |
| Revoking an override counts as granting | revoking a `DENY` override lifts a restriction |
| `DENY` overrides are allowed without holding the permission | they only restrict |

The real actor id is written to the audit log (never `"system"`).

### 11.1 The RBAC mutation contract

Every role / permission / assignment change goes through `RoleService` / `PermissionService`
(injected directly — both are exported by the global `AuthorizationModule`) and needs the
authenticated actor — there is no actor-less or `"system"` overload:

```ts
// actor = the AuthenticatedUser from @CurrentUser() ({ id, isSuperAdmin })
await this.roles.assignToUser(actor, userId, roleId);              // RoleService
await this.roles.syncPermissions(actor, roleId, permissionIds);    // RoleService
await this.permissions.giveToUser(actor, { userId, permissionId, effect: "ALLOW", expiresAt: undefined }); // PermissionService
```

Account provisioning (signup, merchant onboarding, invite registration) is the only other path: it
assigns the default `User` role with the new account as its own audited actor — see
[automatic role provisioning](#automatic-role-provisioning).

1. **One transaction** (`RbacMutationRunner`, system operation `authorization.rbac.mutate`): RBAC
   advisory lock → privilege-escalation checks → the write → post-write invariants → refresh-token
   revocation + `tokenVersion` bump for every affected user → the `PermissionAuditLog` row
   (actor, correlation id, impersonator). Any failure, the audit insert included, rolls everything back.
2. **After commit only:** cached authorization and access-token state are invalidated on every API
   instance (`AuthorizationInvalidationService`, Redis channel `authz:invalidate` when the Redis
   authorization backend is configured). The next request with an old JWT gets
   `401 TOKEN_VERSION_MISMATCH`; clients refresh or sign in again — nobody invalidates by hand.
3. **Escalation** (SuperAdmins exempt): no self-changes; only a SuperAdmin changes a SuperAdmin
   account; the actor must hold (GLOBAL) every permission it grants **or removes** — assignment and
   removal, role sync, ALLOW **and DENY** overrides, revokes, role permission sync, role delete /
   update / re-parent / restore, permission delete / restore. Role lineages are walked through
   deleted and inactive ancestors too, because a restore or re-activation brings them back.
4. **Invariants** (`ConflictDetectionService`, `409 CONFLICT`, rolled back): `SuperAdmin` and
   `Admin` (`LAST_HOLDER_PROTECTED_ROLE_NAMES`) always keep an active holder; separation-of-duty
   pairs (`ROLE_SEPARATION_OF_DUTY_RULES`) hold on a user's effective role set; a direct-permission
   sync replaces ALLOW grants only, never touches DENY overrides, and rejects a permission the user
   holds a live DENY for. A DENY shadowing a role grant is not a conflict — that is its purpose.
5. **Server-controlled flags:** `Role.isSystem` / `Permission.isSystem` are never client-settable;
   system roles cannot be renamed, deactivated, re-parented, re-permissioned or deleted, and system
   permissions cannot be edited or deleted. Expired direct grants are excluded from resolution and
   cleaned up hourly. `POST /admin/roles/preview` dry-runs a role replacement.

---

## 12. Merchant capabilities

Merchant endpoints use **merchant capabilities** (`merchant:*` slugs, `MERCHANT_CAPABILITY.*`)
instead of platform permissions — **never** membership role names. Every check goes through
one method, `TenantRewardAuthService.requireMembershipCapability()`
(`modules/tenant/services/tenant-reward-auth.service.ts`), reached via
`MerchantContextService.requireActorCapability()` / `requireUserCapability()` (rewards, API
keys, analytics, KYB) or directly (team, store locations). It checks, in order:

1. **POS API keys** (`requireActorCapability` only) — only `view_rewards`, `manage_rewards`,
   `view_redemptions`, `view_analytics`. A key can never manage the team, locations,
   verification, other keys or terminals. (A till *gets* its key by pairing:
   `POST /integration/terminals/pair` exchanges a one-time code a member issued for a key bound to
   that terminal — see [POS integration](../pos-integration.md).)
2. **The access decision** (ADR 067): each capability is one `noun.verb` permission
   (`MERCHANT_CAPABILITY_PERMISSION`, `packages/shared/src/authorization/permission.ts`), decided by
   `AccessControlService` — the member's tenant role, then a live grant; deny by default — and
   audited (`authorize.<capability>` in `TenantAuditLog`, with `allowedBy`). The merchant app reads the
   same answer (`membership.capabilities`), so the UI hides exactly what the API denies. Denial:
   `403 TENANT_ROLE_CAPABILITY_REQUIRED`; a slug no permission backs fails closed
   (`403 TENANT_CAPABILITY_UNKNOWN`).

   What each tenant role's **template** gives (`TENANT_ROLE_TEMPLATES`); a tenant edits its own copies
   on `/tenants/:tenantSlug/access/roles`, and grants add to them per member:

   | Capability | Permission | Owner | Manager | Cashier | API rule it guards |
   |---|---|:-:|:-:|:-:|---|
   | `merchant:view_dashboard` | `tenant.read` | ✅ | ✅ | ✅ | none — membership context (UX only) |
   | `merchant:view_rewards` | `reward.read` | ✅ | ✅ | ✅ | `GET /tenants/:tenantSlug/rewards` |
   | `merchant:manage_rewards` | `reward.update` | ✅ | ✅ | — | create / update / publish rewards |
   | `merchant:view_redemptions` | `redemption.read` | ✅ | ✅ | ✅ | `GET /tenants/:tenantSlug/redemptions` |
   | `merchant:manage_api_keys` | `api_key.create` | ✅ | ✅ | — | `/tenants/:tenantSlug/api-keys`, `/tenants/:tenantSlug/terminals` |
   | `merchant:view_analytics` | `analytics.read` | ✅ | ✅ | grant | `GET /tenants/:tenantSlug/analytics` |
   | `merchant:manage_team` | `member.update` | ✅ | ✅ | — | the team roster, invitations, `…/access/*` |
   | `merchant:view_locations` | `location.read` | ✅ | ✅ | ✅ | none — locations come from `GET /tenants/:tenantSlug/context` (UX only) |
   | `merchant:manage_locations` | `location.update` | ✅ | ✅ | — | store create / update; store logo / banner uploads |
   | `merchant:manage_verification` | `kyb.update` | ✅ | — | — | KYB read, update, documents |

> [!NOTE]
> Team, store-location and KYB endpoints used to check hard-coded role lists
> (`assertCanManageTeam`, `assertCanManageLocations`, `requireOwnerRole`) that returned
> `TENANT_TEAM_FORBIDDEN`, `TENANT_LOCATION_FORBIDDEN` and
> `TENANT_OWNER_REQUIRED`. They now return `TENANT_ROLE_CAPABILITY_REQUIRED`
> (still `403`), for the same allowed roles.

---

## 13. Files

Every authenticated `/files` operation is authorized per file category by `FileCategoryAccessRegistry`
(`contexts/files/application/ports/file-category-access.port.ts`), into which each category's owner
registers its rule. Tenant-owned categories upload through `POST /tenants/:tenantSlug/files/upload-url`:
the tenant is the one the route resolved and the guard verified, never a body field.

| Category | Upload (`POST /files/upload-url`, tenant categories `POST /tenants/:tenantSlug/files/upload-url`), complete, delete | Read (`GET /files/:id`, `GET /files/:id/download-url`) |
|---|---|---|
| `USER_AVATAR` | upload: own account only; afterwards the uploader | the uploader |
| `PRODUCT_IMAGE` | upload: `PRODUCT:UPDATE` on that product (kernel); afterwards the uploader | the uploader |
| `STORE_LOGO`, `STORE_BANNER` | `merchant:manage_locations` (Owner, Manager) | any active member (`merchant:view_locations`) |
| `MERCHANT_KYB` | `merchant:manage_verification` (`OWNER`) | `merchant:manage_verification` (`OWNER`) |
| `REWARD_IMAGE` | `merchant:manage_rewards` | `merchant:view_rewards` (the published copy and its renditions are public); reviewers open the reward (`GET /admin/rewards/:rewardId`, any status) and download the original through `GET /admin/rewards/:rewardId/images/:fileId/download`, or all of a reward's originals as one ZIP through `GET /admin/rewards/:rewardId/images/archive` (`MANAGE REWARD`) |
| SuperAdmin | any | any |

- **Same check as the rest of the merchant API.** Tenant capabilities that guard an action go
  through `TenantRewardAuthService.requireMembershipCapability`: the access decision (role, then
  grant), with an audited decision that records the allow path.
- **Re-checked at completion.** Completing a branding upload rebinds the tenant's logo or banner,
  so a member demoted after requesting the ticket cannot finish it.
- **Tenant files belong to the tenant.** Whoever holds the capability *now* may delete
  them; a former member who uploaded them may not. Non-members never get a download URL.
- The caller's role is read through the allowlisted system operation `files.authorization`.

Merchant onboarding uploads use their own invite-token endpoints and never reach this check.

---

## 14. The decisions endpoint (for UIs)

```http
POST /api/v1/authorization/decisions
{ "checks": [ { "action": "UPDATE", "resource": "USER", "resourceId": "<id>" }, { "action": "UPDATE", "resource": "ROLE" } ] }
→ { "results": [ { …, "allowed": true }, { …, "allowed": false } ] }
```

- Up to 50 checks per call.
- The subject is **always** the caller, with the tenant the guard verified from headers.
- Resource attributes are **not** accepted from the client (the server resolves them).

---

## 15. Seeded defaults

| Role | Holds |
|---|---|
| `SuperAdmin` | every permission row (the user flag `isSuperAdmin` bypasses anyway) |
| `Admin` | admin-panel permissions (users, reports, geo, rewards, merchants, stores, …) — `GLOBAL` |
| `Manager` | limited admin panel — `GLOBAL` |
| `User` | customers: **`OWN`-scoped** `PROFILE`, `ANALYTICS` |
| `Location Manager` | `LOCATION`-scoped: location read / update, rewards read / list, redemptions create / read / list |
| `Location Staff` | `LOCATION`-scoped: location read, rewards read / list, redemptions create |

Seeded ABAC examples (`prisma/seed/authorization-kernel.ts`): *completed orders are immutable*
(DENY), *payment update limit* (conditional ALLOW), *inventory same tenant* (conditional ALLOW).

Permission rows are defined in code in `PERMISSION_DEFINITIONS`
(`packages/shared/src/schemas/domain/rbac/permissions-registry.ts`), one row per
`(action, resource, scope)`. **Roles are data** — admins create them at runtime; a new role
never needs a deployment or a new RLS policy (spec §49, §50).

---

## 16. Roles, permissions and caches (RBAC internals)

The model in one sentence: **roles are groups of permissions; permissions are what authorize
actions** ([ADR 001](../../adr/001-permission-first-rbac.md)). Controllers ask for a permission
(`@RequirePermission("CREATE", "USER")`), never for a role name. Paths below are relative to
`apps/api/src/contexts/authorization/`.

### The permission registry

`PERMISSION_DEFINITIONS` (`packages/shared/src/schemas/domain/rbac/permissions-registry.ts`) is the
code catalogue: one row per `(action, resource, scope)`, with a description and a group.

- **Registry → database, one direction.** On every API start
  `presentation/jobs/authorization-catalog-sync.bootstrap.ts` runs the `sync-permission-registry`
  command: missing rows are inserted, stale descriptions and groups are updated, and the caches are
  cleared when anything changed. The seed and `db:sync-reference-data` use the same list.
- **Nothing is written back to TypeScript.** Rows that are not in the registry (created in the admin
  panel) are reported as orphaned, never deleted.
- A permission created in the admin panel exists only in the database. It does nothing until code
  checks that `action:resource`, or a role holding it is assigned. A new protected route needs a
  registry row **and** a `@RequirePermission` ([recipe](./recipes.md#1-add-a-new-permission)).

### No wildcard action, no role inheritance (ADR 067)

- **Every route names the verb it performs** (`APPROVE REWARD` for moderation, `SUSPEND MERCHANT_ORG`,
  `UPDATE KANBAN_BOARD` for the board's columns, …) and a role holds each verb it may use. There is no
  `MANAGE` that stands in for every action: what a role can do is the list of its permissions, nothing
  more.
- **Roles are flat.** No role inherits another's permissions; a role that should hold another's
  permissions lists them itself (the seeded *Support Agent* lists *Support Viewer*'s permissions plus
  `UPDATE USER`). A change to a role reaches exactly its holders.

### Two readers of the same data

| Reader | File | Used for |
| --- | --- | --- |
| **Authorization kernel** | `infrastructure/kernel/authorization-kernel.service.ts` | Every security decision (this page) |
| **`AuthorizationCheckerService`** | `infrastructure/read/authorization-checker.service.ts` | The session payload, not decisions: the capability slugs the UIs receive (`/auth/me`, `/auth/permissions`, login) and the admin "why does this user have it?" check |

`hasAdminAccess` on `request.user` is recomputed by `AuthorizationGuard` on every request through
the kernel (`READ:ADMIN_DASHBOARD`, or SuperAdmin). Never trust the JWT's copy on a protected route.

### Caches and invalidation

| Cache | Holds | Setting (default) |
| --- | --- | --- |
| Authorization cache | user id → roles, permissions, capabilities | `AUTHORIZATION_CACHE_TTL_MS` (5 min), `AUTHORIZATION_CACHE_MAX_ENTRIES`; `AUTHORIZATION_CACHE_BACKEND` decides whether invalidations are broadcast over Redis |
| User session cache | the `/auth/me` and `/auth/permissions` payloads | `USER_SESSION_CACHE_TTL_MS` (30 min), `USER_SESSION_CACHE_BACKEND` (memory or Redis) |
| Access-token state | user id → token version, active, deleted | `ACCESS_TOKEN_STATE_CACHE_TTL_MS` (30 s) |

Reads stay in-process; Redis only tells the other API instances what to drop
([ADR 004](../../adr/004-authorization-caching.md)). After an RBAC change commits, the affected users
are dropped locally and announced on the `authz:invalidate` channel. A lost message is bounded by
the TTLs above. Nobody invalidates by hand: change roles and permissions through the authorization
commands ([mutation contract](#111-the-rbac-mutation-contract)). A user's next request with an old
token gets `401 TOKEN_VERSION_MISMATCH` and refreshes.

### Background jobs (`presentation/jobs/`)

| Job | Schedule | Does |
| --- | --- | --- |
| `permission-expiry.cron.ts` | hourly | Soft-deletes expired per-user overrides (they are already ignored at read time) |
| `audit-log-retention.cron.ts` | hourly | Soft-deletes authorization audit rows older than 90 days |
| `support-access-expiry.cron.ts` | every 5 min | Expires support-access grants |

### Automatic role provisioning

New accounts get their platform role when they are created, never by hand: signup, merchant
onboarding and a team invite's new account all get the default `User` role (`application/services/provisioning-role-assigner.ts`,
the `assign-default-role` command), with the new account as its own audited actor. A missing `User`
role is a deployment error (500), not a client error.
