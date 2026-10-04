---
title: "Backend: the Authorization Kernel"
tags: ["authorization", "nestjs", "kernel", "rbac", "acl", "abac", "audit"]
description: "How the API decides allow or deny: the guard, the kernel's precedence, scopes, overrides, ACLs, ownership, policies, list filters, explain, audit, and privilege-escalation protection."
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
 1. RlsPreHandlerMiddleware   opens the "request.pre_handler" RLS scope (see tenancy guide)
 2. ApiKeyAuthGuard           optional merchant/POS API key
 3. AuthGuard                 validates the JWT → request.user
 4. RestrictedSessionGuard    blocks restricted sessions (email / MFA not done)
 5. AuthorizationGuard        ← THIS PAGE
      a. validate the token version (revoked tokens → 401)
      b. resolve + verify the tenant (x-organization-id / x-store-id / x-location-id)
      c. SuperAdmin? → audited bypass
      d. enforce every decorator through the Kernel (audited)
      e. compute hasAdminAccess
 6. RlsInterceptor            narrows the RLS scope to this user + verified organization
 7. Controller → Service → Prisma → PostgreSQL (RLS applies)
```

The guard is **global** (`APP_GUARD` in `app.module.ts`). You never add it by hand; you only
**declare** what a route needs with a decorator.

---

## 2. Declaring what a route needs

### 2.1 The decorators

| Decorator | Use it when | Example |
|---|---|---|
| `@RequirePermission(action, resource)` | One permission, no specific record | `@RequirePermission("LIST", "ROLE")` |
| `@RequireAllPermissions([a, r], …)` | Every listed permission is needed | `@RequireAllPermissions(["READ", "ROLE"], ["READ", "PERMISSION"])` |
| `@RequireAnyPermission([a, r], …)` | Any one of them is enough | `@RequireAnyPermission(["UPDATE", "ROLE"], ["UPDATE", "PERMISSION"])` |
| `@RequireAllRoles(...names)` / `@RequireAnyRole(...names)` | Rare. Prefer permissions (spec §110 "do not hardcode roles") | `@RequireAnyRole("Auditor")` |
| `@Authorize({ action, resource, resourceId?, attributes? })` | The decision depends on **a specific record** (ownership, ACL, scope, policy) | see below |
| `@SuperAdminOnly()` | Platform-operator-only operations | impersonation, MFA recovery review |
| `@Public()` | No authentication at all (health, login, public reward pages) | — |

`@RequirePermission` lives in `modules/auth/decorators/require-permission.decorator.ts`; the
others in `modules/authorization/decorators/`. When a route has several decorators, **all**
of them must pass.

### 2.2 `@Authorize` in detail

```ts
import { Authorize, fromParam, self, attributesFromBody } from "../authorization/decorators/authorize.decorator";

// The record id is a route param name:
@Authorize({ action: "DELETE", resource: "ORDER", resourceId: "id" })          // DELETE /orders/:id

// The caller acts on their own account (self-service):
@Authorize({ action: "UPDATE", resource: "USER", resourceId: self() })          // POST /auth/change-password

// Explicit extractor + policy attributes from the body:
@Authorize({ action: "UPDATE", resource: "ORDER", resourceId: fromParam("orderId"), attributes: attributesFromBody(["status"]) })
```

Rules the guard applies (see `guards/authorization.guard.ts`):

- **Fail closed:** if you declare `resourceId` and it cannot be resolved (missing param, anonymous caller for `self()`), the request is **denied**. It is never silently turned into a global check.
- **Tenant attributes win:** the organization / store / location the request targets are added to the resource attributes **after** your `attributes`, so a body cannot override the routed tenant.
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

`AuthorizationKernelService` (`modules/authorization/kernel/authorization-kernel.service.ts`):

| Method | Returns | Use it for |
|---|---|---|
| `can(request)` | `"ALLOW" \| "DENY"` | Conditional logic inside services, tests |
| `authorize(request, auditMetadata?)` | `void`, throws 403 | **Security boundaries.** Audits the decision. |
| `explain(request)` | full `AuthorizationResult` with ordered steps | Debugging, admin tooling, tests |
| `filter(context, action, resource)` | a Prisma `where` fragment | **List endpoints** |
| `resourceCapabilities(subject, resource, id, attrs, actions?)` | `{ can: { read, update, delete, … } }` | Per-record UI hints in API responses (spec §12 option C) |
| `hasRoles(userId, names, mode)` | `boolean` | Role decorators only |

An `AuthorizationRequest` looks like:

```ts
{
  subject: { userId: "u-1", organizationId: "org-a", storeId: "store-1", isSuperAdmin: false },
  action: "UPDATE",
  resource: "ORDER",
  resourceId: "order-123",                          // optional
  resourceAttributes: { organizationId: "org-a", storeId: "store-1", status: "PENDING" }, // optional
}
```

> [!IMPORTANT]
> `subject.organizationId`, `storeId` and `locationId` are **claims**. The kernel
> re-verifies them against memberships every time. Passing a forged organization gets
> `DENY`, not "access to that organization".

---

## 4. Decision precedence (the most important section)

The kernel evaluates in this exact order (spec §39, §65). The first step that decides wins.

```text
 1. SuperAdmin                              → ALLOW   (platform bypass; the guard audits it)
 2. Unknown action or resource              → DENY    (fail closed)
 3. Tenant verification                     → DENY if the claimed organization / store /
                                                        location is not proven by membership
 4. Explicit DENY — per-user override       → DENY
 5. Explicit DENY — ACL entry               → DENY
 6. Explicit ALLOW — ACL entry              → ALLOW
 7. Grants: does the subject hold the permission (MANAGE counts) …
      … AND does at least one grant's SCOPE fit this request?
      … AND do that grant's stored conditions hold?
                                            → if no grant fits: DENY
 8. Policies (ABAC)                         → DENY if a DENY policy matches, or if
                                              conditional ALLOW policies exist and none match
 9. Otherwise                               → ALLOW
    (nothing matched at step 7)             → DENY  (default deny)
```

### Worked examples

| Situation | Result | Deciding step |
|---|---|---|
| Manager role grants `ORDER:DELETE`, user has a `DENY` override for it | **DENY** | 4 |
| Role grants `ORDER:DELETE`, ACL `DENY` on order #9 for this user | **DENY** on #9, ALLOW elsewhere | 5 |
| No role permission, ACL `ALLOW` on order #7 | **ALLOW** on #7 only | 6 |
| Member of Org A with no roles asks to `DELETE ORGANIZATION` | **DENY** — membership alone grants nothing | 7 |
| `UPDATE:ORDER:ORGANIZATION` grant, order belongs to Org B | **DENY** — wrong tenant | 7 |
| Grant OK, policy "completed orders are immutable" matches | **DENY** | 8 |
| Header `x-organization-id` for an org you're not in | **403** before the kernel even runs | guard |

---

## 5. Grants and scopes

### 5.1 Where grants come from

`SubjectGrantsLoader` (`kernel/subject-grants.loader.ts`) collects, in a fixed number of
batched queries (no N+1, spec §58):

| Source | Scope used |
|---|---|
| Role permissions (`user_roles` → `role_permissions`), **including parent roles** | the permission row's scope |
| Store membership roles (`store_memberships.roleId`) | **always `STORE`, bound to that store** — a store role can never grant platform-wide access |
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
| `ORGANIZATION` | the request has a **verified** organization **and** (for a specific record) the record's `organizationId` matches | organization-wide roles |
| `STORE` | the request has a **verified** store, the grant is bound to that store (store memberships), and the record's `storeId` matches | `Store Manager`, `Store Staff` |
| `LOCATION` | verified location, record's `locationId` matches | location-scoped roles |
| `OWN` | a specific record is targeted **and** the DB says the caller owns it | customers (`User` role) |
| `RESOURCE` | never by itself — only through explicit ACL entries | — |

> [!WARNING]
> For `ORGANIZATION` / `STORE` / `LOCATION` grants on a **specific record**, the kernel
> needs to know the record's tenant (`resourceAttributes.organizationId` / `storeId` /
> `locationId`). If you do not pass it, the grant does **not** apply (fail closed).

### 5.3 Ownership

`ResourceOwnershipResolver` reads the owner from the database for `USER`, `PROFILE`, `URL`,
`TAG` and `API_KEY`. Ownership is **never** read from the request body, so a client cannot
claim ownership by sending `ownerId`. Other resource types have no ownership model; `OWN`
grants on them never match. To add one, extend the resolver's `switch` (see
[recipes](./recipes.md#6-give-a-new-resource-an-owner)).

### 5.4 Per-user overrides (ALLOW / DENY)

`user_permissions` rows have an `effect` column:

- `ALLOW` — adds a permission on top of the user's roles.
- `DENY` — removes it even if a role grants it (spec §40). A `DENY` on `MANAGE` removes
  every action on that resource.

Admin API: `POST /admin/permissions/user/grant` with `{ userId, permissionId, effect?: "ALLOW" | "DENY", expiresAt? }`.
Overrides can expire (`expiresAt`); expired rows are ignored.

---

## 6. ACL — resource-level exceptions

`resource_acls` rows (managed by `AclService`) say "subject X may / may not do action Y on
resource Z". Use them **only for exceptions** (spec §124), not for ordinary access.

| Column | Meaning |
|---|---|
| `subjectType` + `subjectId` | a `USER` id, or a `ROLE` id (applies to everyone holding that role, including inherited roles) |
| `action` | exact action; an entry with `MANAGE` covers every action |
| `resourceType` + `resourceId` | `resourceId = null` means **every** resource of that type |
| `effect` | `ALLOW` or `DENY` (DENY always wins) |
| `organizationId` / `locationId` | optional: the entry only applies inside that verified tenant |
| `conditions` | optional JSON rule (same language as policies) |
| `expiresAt`, `isDeleted` | expired or deleted entries never match |

---

## 7. Policies (ABAC) — the safe rule language

Policies live in `policy_definitions`. Their `conditions` use a **validated JSON rule
language** (`PolicyConditionsSchema` in `packages/shared/src/authorization/policy-dsl.schema.ts`).
There is **no** `eval`, no stored JavaScript (spec §43).

```json
{
  "all": [
    { "condition": { "field": "order.organizationId", "operator": "equals", "valueRef": "$user.organizationId" } },
    { "condition": { "field": "order.status", "operator": "not_equals", "value": "COMPLETED" } }
  ]
}
```

- A rule node has **exactly one** of `all`, `any`, `condition`. Unknown keys are rejected.
- **Operators:** `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`,
  `starts_with`, `ends_with`, `greater_than`, `greater_than_or_equals`, `less_than`,
  `less_than_or_equals`, `exists`, `not_exists`.
- **Fields:** `$user.<key>` (subject: `userId`, `organizationId`, `storeId`, `locationId`,
  `roles`, `isSuperAdmin`, or custom attributes), `$resource.<key>`, `<resource>.<key>`
  (e.g. `order.status`), or a bare key (resource attribute).
- `value` is a literal; `valueRef` points at another field.

How policies combine:

| Situation | Outcome |
|---|---|
| No active policy targets this action + resource | policy layer **abstains** |
| A `DENY` policy's conditions match | **DENY** |
| `ALLOW` policies exist, none match | **DENY** (conditional grant not met) |
| An `ALLOW` policy matches and no `DENY` matched | **ALLOW** |
| Stored conditions fail validation | treated as **matching** for DENY policies, **not matching** for ALLOW (fail closed) |

The same language is used for **permission conditions** (`permissions.conditions`) and **ACL
conditions**.

---

## 8. `explain()` — why was this allowed or denied?

```ts
const result = await kernel.explain(request);
// result.decision  → "DENY"
// result.evaluation →
// [
//   { source: "acl",   effect: "NO_MATCH", reason: "No explicit ACL entry" },
//   { source: "scope", effect: "DENY", reason: "Resource belongs to another organization" },
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

## 9. `filter()` — list endpoints

Never load everything and filter in JavaScript (spec §32, §57). Ask the kernel for a
`where` fragment:

```ts
const where = await kernel.filter({ userId, organizationId, storeId }, "LIST", "REDEMPTION");
return prisma.rewardRedemption.findMany({ where: { AND: [where, { /* your own filters */ }] } });
```

| Subject holds | `filter()` returns |
|---|---|
| SuperAdmin, a `GLOBAL` grant, or a type-wide ACL `ALLOW` | `{}` (no restriction — RLS still applies) |
| `ORGANIZATION` grant + verified org | `{ organizationId }` |
| `STORE` grants | `{ organizationId, storeId }` per store (only the active store when one is selected) |
| `LOCATION` grant | `{ organizationId, locationId }` |
| `OWN` grant | `{ userId }` (`{ id: { in: [userId] } }` for `USER` / `PROFILE`) |
| resource-specific ACL `ALLOW`s | `{ id: { in: [...] } }` |
| several of the above | `{ OR: [...] }` |
| resource-specific ACL `DENY`s | wrapped as `{ AND: [base, { NOT: { id: { in: [...] } } }] }` |
| nothing / DENY override / type-wide ACL DENY / unconditional DENY policy / forged tenant | `{ id: { in: [] } }` → **no rows** |

> Your table must use these column names (`organizationId`, `storeId`, `locationId`,
> `userId`, `id`) for the filter to apply. Row-level **conditions** (e.g. "status must be
> PAID") are enforced per operation with `authorize()`, not in the filter.

---

## 10. Auditing

`AuthorizationAuditKernelService` writes to `authorization_audits` (spec §63):

| Decision | Logged? |
|---|---|
| Any `DENY` | ✅ always |
| `CREATE`, `UPDATE`, `DELETE`, `MANAGE` (allowed) | ✅ always |
| `READ` / `LIST` of `USER`, `ROLE`, `PERMISSION`, `AUDIT_LOG`, `SYSTEM_SETTINGS` | ✅ (sensitive reads) |
| Other reads | ❌ |

Each row has the actor, tenant, action, resource, decision, reason, policy / ACL ids, the full
evaluation, IP, user agent, request id and duration. The table is **bypass-only** under RLS,
so it is written through `SystemPrismaService` (see [tenancy guide](./tenancy-and-rls.md#7-the-two-database-clients)).
An audit failure is logged but never fails the request.

SuperAdmin bypasses are recorded separately in `permission_audit_logs`
(`SUPER_ADMIN_BYPASS`), together with every role / permission change.

---

## 11. Protecting authorization administration (privilege escalation)

`PrivilegeEscalationService` runs on every role / permission mutation in
`modules/authorization/admin/*.controller.ts` (spec §68, §69). Platform SuperAdmins are exempt.

| Rule | Blocks |
|---|---|
| **No self-escalation** | changing your own role assignments or direct permissions; editing, re-parenting, re-activating a role you hold (directly or via inheritance) |
| **Subset rule** | granting, assigning or making inheritable any permission you do not yourself hold with `GLOBAL` reach |
| Revoking an override counts as granting | revoking a `DENY` override lifts a restriction |
| `DENY` overrides are allowed without holding the permission | they only restrict |

The real actor id is written to the audit log (never `"system"`).

### 11.1 The RBAC mutation contract

Every role / permission / assignment change goes through `RoleService` / `PermissionService`
(exposed as `authorization.roles` / `authorization.permissions`; the user proxy is read-only) and
needs the authenticated actor — there is no actor-less or `"system"` overload:

```ts
// actor = the AuthenticatedUser from @CurrentUser() ({ id, isSuperAdmin })
await this.authorization.roles.assignToUser(actor, userId, roleId);
await this.authorization.roles.syncPermissions(actor, roleId, permissionIds);
await this.authorization.permissions.giveToUser(actor, { userId, permissionId, effect: "ALLOW", expiresAt: undefined });
```

1. **One transaction** (`RbacMutationRunner`, system operation `authorization.rbac.mutate`): RBAC
   advisory lock → privilege-escalation checks → the write → post-write invariants → refresh-token
   revocation + `tokenVersion` bump for every affected user → the `permission_audit_logs` row
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
5. **Server-controlled flags:** `roles.isSystem` / `permissions.isSystem` are never client-settable;
   system roles cannot be renamed, deactivated, re-parented, re-permissioned or deleted, and system
   permissions cannot be edited or deleted. Expired direct grants are excluded from resolution and
   cleaned up hourly. `POST /admin/roles/preview` dry-runs a role replacement.

---

## 12. Merchant (Reward Hub) capabilities

Merchant endpoints use **merchant capabilities** (`merchant:*` slugs, `MERCHANT_CAPABILITY.*`)
instead of platform permissions — **never** membership role names. Every check goes through
one method, `OrganizationRewardAuthService.requireMembershipCapability()`
(`modules/organization/services/organization-reward-auth.service.ts`), reached via
`MerchantContextService.requireActorCapability()` / `requireUserCapability()` (rewards, API
keys, analytics, KYB) or directly (team, store locations). It checks, in order:

1. **POS API keys** (`requireActorCapability` only) — only `view_rewards`, `manage_rewards`,
   `view_redemptions`, `view_analytics`. A key can never manage the team, locations,
   verification, other keys or terminals. (A till *gets* its key by pairing:
   `POST /pos/terminals/pair` exchanges a one-time code a member issued for a key bound to
   that terminal — see [POS integration](../pos-integration.md).)
2. **The role table** `MERCHANT_ROLE_CAPABILITIES` (`packages/shared/src/authorization/permission.ts`,
   shared with the merchant app, so the UI hides exactly what the API denies). Denial:
   `403 ORGANIZATION_ROLE_CAPABILITY_REQUIRED`.

   | Capability | `OWNER` | `ADMIN` | `CASHIER` | `POLICY_ADMIN` | `MEMBER` | API rule it guards |
   |---|:-:|:-:|:-:|:-:|:-:|---|
   | `merchant:view_dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | none — membership context (UX only) |
   | `merchant:view_rewards` | ✅ | ✅ | ✅ | — | — | `GET /orgs/:orgSlug/rewards` |
   | `merchant:manage_rewards` | ✅ | ✅ | — | — | — | create / update / publish rewards |
   | `merchant:view_redemptions` | ✅ | ✅ | ✅ | — | — | `GET /orgs/:orgSlug/redemptions` |
   | `merchant:manage_api_keys` | ✅ | ✅ | — | — | — | `/orgs/:orgSlug/api-keys`, `/orgs/:orgSlug/terminals` (POS terminal registration and pairing) |
   | `merchant:view_analytics` | ✅ | ✅ | ✅ | — | — | `GET /orgs/:orgSlug/analytics` |
   | `merchant:manage_team` | ✅ | ✅ | — | — | — | `GET /orgs/:orgSlug/members[/invites]`, `POST …/members/invite`, `POST …/invites/:id/revoke` |
   | `merchant:view_locations` | ✅ | ✅ | ✅ | ✅ | ✅ | none — locations come from the member-wide `GET /orgs/:orgSlug/context` (UX only) |
   | `merchant:manage_locations` | ✅ | ✅ | — | — | — | `POST /orgs/:orgSlug/locations`, `PATCH …/locations/:id`; store logo / banner uploads |
   | `merchant:manage_verification` | ✅ | — | — | — | — | `GET` / `PATCH /orgs/:orgSlug/kyb`, KYB document download and upload |

3. **Tenant Cedar policies** — the capability's Cedar action
   (`MERCHANT_CAPABILITY_CEDAR_ACTIONS`, `modules/organization/constants/merchant-capability-cedar-actions.ts`,
   e.g. `merchant:manage_team` → `rewardhub:manage_team`) is evaluated against the
   organization's published policy and audited (`authorize.<action>` in
   `organization_audit_logs`). Cedar may only **narrow** the table; the default tenant policy
   (`REWARDHUB_DEFAULT_TENANT_CEDAR`) permits `OWNER` / `ADMIN` / `CASHIER` for every action, so
   it never denies what the table grants (a unit test proves the two agree). Denial:
   `403 ORGANIZATION_ACTION_FORBIDDEN`.

Capabilities mapped to `null` in `MERCHANT_CAPABILITY_CEDAR_ACTIONS` (`view_dashboard`,
`view_locations`) guard no API action; asking the API to enforce one fails closed
(`403 ORGANIZATION_CAPABILITY_UNKNOWN`). The map is a `Record` over the shared vocabulary, so a
new capability does not compile until it is mapped.

> [!NOTE]
> Team, store-location and KYB endpoints used to check hard-coded role lists
> (`assertCanManageTeam`, `assertCanManageLocations`, `requireOwnerRole`) that returned
> `ORGANIZATION_TEAM_FORBIDDEN`, `ORGANIZATION_LOCATION_FORBIDDEN` and
> `ORGANIZATION_OWNER_REQUIRED`. They now return `ORGANIZATION_ROLE_CAPABILITY_REQUIRED`
> (still `403`), for the same allowed roles.

---

## 13. Files

Every authenticated `/files` operation is authorized per file category by `FileAuthorizationService`
(`modules/files/services/file-authorization.service.ts`). The controller loads the file, asks the
service, then acts.

| Category | Upload (`POST /files/upload-url`), complete, delete | Read (`GET /files/:id`, `GET /files/:id/download-url`) |
|---|---|---|
| `USER_AVATAR` | upload: own account only; afterwards the uploader | the uploader |
| `PRODUCT_IMAGE` | upload: `PRODUCT:UPDATE` on that product (kernel); afterwards the uploader | the uploader |
| `STORE_LOGO`, `STORE_BANNER` | `merchant:manage_locations` (`OWNER`, `ADMIN`) | any active member (`merchant:view_locations`) |
| `MERCHANT_KYB` | `merchant:manage_verification` (`OWNER`) | `merchant:manage_verification` (`OWNER`) |
| SuperAdmin | any | any |

- **Same check as the rest of the merchant API.** Organization capabilities that guard an action go
  through `OrganizationRewardAuthService.requireMembershipCapability`: the shared role table, then the
  tenant Cedar policy, with an audited decision. Membership-only capabilities (Cedar action `null`,
  e.g. reading store branding) use the role table alone.
- **Re-checked at completion.** Completing a branding upload rebinds the organization's logo or banner,
  so a member demoted after requesting the ticket cannot finish it.
- **Organization files belong to the organization.** Whoever holds the capability *now* may delete
  them; a former member who uploaded them may not. Non-members never get a download URL.
- The caller's role is read through the allowlisted system operation `files.authorization`.

Merchant onboarding uploads use their own invite-token endpoints and never reach this check.

---

## 14. The decisions endpoint (for UIs)

```http
POST /api/v1/authorization/decisions
{ "checks": [ { "action": "UPDATE", "resource": "USER", "resourceId": "<id>" }, { "action": "MANAGE", "resource": "ROLE" } ] }
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
| `User` | customers: **`OWN`-scoped** `PROFILE`, `URL`, `TAG`, `API_KEY`, `ANALYTICS` |
| `Store Manager` | `STORE`-scoped: store read / update, rewards read / list, redemptions create / read / list |
| `Store Staff` | `STORE`-scoped: store read, rewards read / list, redemptions create |

Seeded ABAC examples (`prisma/seed/authorization-kernel.ts`): *completed orders are immutable*
(DENY), *payment update limit* (conditional ALLOW), *inventory same organization* (conditional ALLOW).

Permission rows are defined in code in `PERMISSION_DEFINITIONS`
(`packages/shared/src/schemas/domain/rbac/permissions-registry.ts`), one row per
`(action, resource, scope)`. **Roles are data** — admins create them at runtime; a new role
never needs a deployment or a new RLS policy (spec §49, §50).
