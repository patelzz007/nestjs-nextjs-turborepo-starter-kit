---
title: "Authorization System — Start Here"
tags: ["authorization", "rbac", "acl", "abac", "rebac", "rls", "security", "overview"]
description: "The one-page map of the authorization system: the mental model, every layer, where the code lives, and which guide to read next."
order: 20
author: "Platform Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Authorization System — Start Here

> [!NOTE]
> This is the entry point for everything about **who can do what** in this monorepo.
> It is written for a developer with ~6 months of experience. If a word is new to you,
> check the [glossary](#glossary) at the bottom.
>
> The design follows the internal spec *"Production Authorization System — Complete
> Architecture & Implementation Specification"*. Section numbers like **(spec §65)** point to it.

---

## 1. The 30-second version

There are **three layers**, and each one has exactly one job:

| Layer | Question it answers | Where it lives | Is it security? |
|---|---|---|---|
| **Frontend `can()`** | "Should I **show** this button / page / menu item?" | `packages/client/src/lib/auth/can.tsx` + each app | ❌ **No** — it is UX only |
| **Backend Authorization Kernel** | "May this request **execute**?" | `apps/api/src/modules/authorization/**` | ✅ **Yes** — the real gate |
| **PostgreSQL Row-Level Security (RLS)** | "Which **rows** can the database return or change?" | `apps/api/prisma/rls*.sql`, `apps/api/src/prisma/**` | ✅ **Yes** — the last line of defence |

```text
Browser ──► Frontend can()        "show or hide"        (a user can bypass this with curl)
            │
            ▼
API ─────► AuthorizationGuard ──► Authorization Kernel  "allow or 403"
            │
            ▼
Prisma ──► PostgreSQL RLS         "which rows exist for this request"
```

**Never reverse these responsibilities (spec §2).** Hiding a button does not protect an
endpoint. Every endpoint must be protected on the backend, and every tenant table must be
protected by RLS.

---

## 2. The mental model — seven questions

Every authorization decision answers these questions **in this order** (spec §1, §130):

```text
1. WHO are you?                  → Authentication (JWT / session)
2. WHAT may you do in general?   → Permissions from roles (RBAC) + per-user overrides
3. WHERE may you do it?          → Scope: GLOBAL / ORGANIZATION / STORE / LOCATION / OWN / RESOURCE
4. WHICH record?                 → Ownership, ACL entries, relationships (membership)
5. UNDER WHAT CONDITIONS?        → Policies (ABAC) written in a safe JSON rule language
6. SHOULD THE UI SHOW IT?        → Frontend can() / <Can>
7. WHICH ROWS EXIST FOR YOU?     → PostgreSQL RLS
```

A permission such as `ORDER:DELETE` is a **capability**, not a blank cheque. It only means
"this person may delete orders **somewhere**". The **scope** says where.

> **Example.** Alice and Bob both hold `REDEMPTION:CREATE`. Alice's comes from a
> *Store Staff* membership in **Store KL**; Bob's from one in **Store PJ**. Alice can redeem
> in KL but not in PJ. Same permission, different scope.

---

## 3. Where everything lives

### Backend (NestJS, `apps/api`)

| Piece | File | What it does |
|---|---|---|
| **Kernel** | `src/modules/authorization/kernel/authorization-kernel.service.ts` | `can()`, `authorize()`, `explain()`, `filter()`, `resourceCapabilities()`, `hasRoles()` |
| Grants loader | `kernel/subject-grants.loader.ts` | Loads roles (+ parents), role permissions, store-membership roles, user overrides |
| Tenant verification | `kernel/tenant-membership.service.ts` | Proves a claimed organization / store / location belongs to the user |
| Ownership | `kernel/resource-ownership.resolver.ts` | Reads the owner of a USER / PROFILE / URL / TAG / API_KEY from the DB |
| ACL | `kernel/acl.service.ts` | Explicit ALLOW / DENY entries per user or role |
| Policies (ABAC) | `kernel/policy-engine.service.ts` | Evaluates the JSON rule language — never `eval` |
| Decision audit | `kernel/authorization-audit-kernel.service.ts` | Writes `authorization_audits` rows |
| Decisions API | `kernel/authorization-decisions.controller.ts` | `POST /authorization/decisions`, `GET /authorization/decisions/explain` |
| **Global guard** | `guards/authorization.guard.ts` | Runs on every request; enforces all authorization decorators |
| Decorators | `decorators/authorize.decorator.ts`, `modules/auth/decorators/require-permission.decorator.ts`, `decorators/require-*.decorator.ts` | Declare what a route needs |
| Request tenant context | `services/authorization-context.resolver.ts` | Reads `x-organization-id` / `x-store-id` / `x-location-id` and verifies them |
| Privilege escalation | `services/privilege-escalation.service.ts` | Stops admins granting what they do not hold or editing themselves |
| File authorization | `modules/files/services/file-authorization.service.ts` | Per-category rules for every `/files` operation (upload, complete, read, download, delete) |
| Merchant capability gate | `modules/organization/services/organization-reward-auth.service.ts` (`requireMembershipCapability`), via `modules/rewards/services/merchant-context.service.ts` | Every `merchant:*` check — role table → tenant Cedar policy (team, locations, KYB, rewards, API keys, analytics) |
| RLS context | `src/prisma/rls-context.ts`, `rls-pool.ts`, `common/interceptors/rls.interceptor.ts`, `common/middleware/rls-pre-handler.middleware.ts` | Tells Postgres who is asking |

### Shared vocabulary (`packages/shared`)

| Piece | File |
|---|---|
| `PERMISSION.<RESOURCE>.<ACTION>`, `ACTION`, `RESOURCE`, `MERCHANT_CAPABILITY`, `MERCHANT_ROLE_CAPABILITIES`, implicit self grants, resource capability maps | `src/authorization/permission.ts` |
| Policy rule language, context / request / result schemas, row-filter shapes | `src/authorization/policy-dsl.schema.ts` |
| Decisions endpoint schemas | `src/authorization/decisions.schema.ts` |
| Permission catalogue (seeded to the DB) | `src/schemas/domain/rbac/permissions-registry.ts` |

### Frontend

| App | Provider | Gate helpers |
|---|---|---|
| Shared (`packages/client`) | `CapabilitiesProvider` | `useAuthorization()` → `{ can, cannot, canAll, canAny }`, `<Can>` |
| Admin (`apps/admin`) | mounted in `components/layout/dashboard-layout.tsx` | `RouteAuthorizationGuard`, `DisabledActionButton`, `AccessRestrictedNotice`, `useSuperAdminStatus()` |
| Merchant (`apps/merchant`) | `MerchantAuthorizationProvider` | `guardOrgPage` + `ORG_PAGE_RULES` (server-side page guard), `MerchantCapabilityGate`, `useAuthorization()` |
| Web (`apps/web`) | `WebAuthorizationProvider` (in `app/layout.tsx`) | `AccessGate`, `useWebSession()` |

---

## 4. Which guide should I read?

| I want to… | Read |
|---|---|
| Understand how the backend decides allow / deny | [Backend: the Authorization Kernel](./backend.md) |
| Understand organizations, stores, locations and RLS | [Tenancy, stores and RLS](./tenancy-and-rls.md) |
| Show / hide things in the UI | [Frontend authorization](./frontend.md) |
| Do a concrete task ("add a permission", "protect an endpoint") | [Recipes](./recipes.md) |
| Know the rules before opening a PR | [Dos and don'ts](../dos-and-donts.md) |
| Write or run authorization tests | [Testing](./testing.md) |
| Fix "why am I getting 403?" or a failing reset | [Troubleshooting & FAQ](./troubleshooting.md) |
| See exactly what changed in the authorization overhaul | [Change log](./changelog.md) |

---

## 5. The golden rules (read these even if you read nothing else)

1. **Deny by default.** If no rule says "yes", the answer is "no" (spec §66).
2. **The frontend is never security.** Always protect the endpoint too (spec §2, §11).
3. **Never trust tenant ids from the browser.** `organizationId`, `storeId` and `locationId` are *requests*; the server verifies them against memberships (spec §55, §92, §93).
4. **Use `PERMISSION.*` / `MERCHANT_CAPABILITY.*` constants**, never raw strings like `"platform:user.delete"` (spec §7).
5. **Membership is not permission.** Being in an organization does not grant anything by itself; it only lets permissions scoped to that organization apply.
6. **Explicit DENY wins** over every ALLOW (spec §39, §88).
7. **Never write executable policies.** Conditions use the validated JSON rule language (spec §43).
8. **List endpoints filter in the database** with `kernel.filter()`, never by loading everything and filtering in JavaScript (spec §32).
9. **Only named, allowlisted system operations may bypass RLS.**
10. **Follow the strict TypeScript rules**: no `any` / `unknown` / `never`, no casts, no `as const`, no `!`, no `eslint-disable` (spec §108).

---

## Glossary

| Term | Meaning in this codebase |
|---|---|
| **Action** | What you want to do: `CREATE`, `READ`, `UPDATE`, `DELETE`, `LIST`, `MANAGE`. `MANAGE` implies every other action on the same resource. |
| **Resource** | The kind of thing: `USER`, `ROLE`, `STORE`, `REWARD`, … (enum `PermissionResource`). |
| **Permission** | A row `(action, resource, scope)`. The same action × resource can exist once per scope, e.g. `UPDATE:URL:GLOBAL` (any URL) and `UPDATE:URL:OWN` (only your URLs). |
| **Capability slug** | The string the UI checks, e.g. `platform:user.delete` or `merchant:manage_rewards`. Always obtain it from `PERMISSION.*` / `MERCHANT_CAPABILITY.*`. |
| **Role** | A named bundle of permissions (`Admin`, `Manager`, `User`, `Store Manager`, …). Roles are **data**; admins create them at runtime. Roles may have a parent and inherit its permissions. |
| **Grant** | A permission the subject holds, from a role, a store membership role, a user ALLOW override, or an implicit self grant. |
| **Override** | A `user_permissions` row with `effect` `ALLOW` (extra permission) or `DENY` (takes a permission away, even if a role grants it). |
| **Scope** | Where a grant applies: `GLOBAL`, `ORGANIZATION`, `STORE`, `LOCATION`, `OWN`, `RESOURCE`. |
| **ACL** | `resource_acls` rows: explicit ALLOW / DENY for one user or role on one resource (or every resource of a type). |
| **Ownership** | "This record belongs to you", read from the database (never from the request body). |
| **Policy (ABAC)** | A `policy_definitions` row with JSON conditions such as "status is not COMPLETED". |
| **ReBAC** | Relationship checks: user → member of organization → store → location. |
| **Tenant** | An organization. Stores and locations belong to one. |
| **Store** | A shop of an organization, linked 1:1 to an `OrganizationLocation`. Staff join a store through a **store membership** with a role. |
| **RLS** | PostgreSQL Row-Level Security — database rules that hide rows from a session. |
| **System operation** | A named, allowlisted reason to bypass RLS (e.g. `queue.job`, `outbox.enqueue`). |
| **SuperAdmin** | The platform operator flag on `users.isSuperAdmin`. Bypasses permission checks, audited. |
