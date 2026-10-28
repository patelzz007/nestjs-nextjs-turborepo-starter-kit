---
title: "Authorization: start here"
tags: ["authorization", "rbac", "rebac", "rls", "tenancy", "overview", "onboarding"]
description: "The whole access system as one story, then where its code lives, the golden rules and the words: who you are, which merchant you act for, what your role lets you do, and the database's own safety net."
order: 20
author: "Platform Team"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Authorization: start here

RLS, RBAC, ReBAC, sharing, the kernel: these sound like separate systems. They are not. They
are **checkpoints on one path** that every request walks, in a fixed order. This page follows one
request down that path. The other four pages in this folder are the detail behind each checkpoint.

## The one picture

```text
  Browser                     API                                         Database
  ───────                     ───                                         ────────
  can() hides the button  →   1. Who are you?          (sign-in)
  (convenience only)          2. Which merchant?       (tenant from the URL, checked)
                              3. What may your role do? (RBAC)
                              4. This record, for you?  (ReBAC / ownership)
                              5. Shared with you?       (a share on this one record)
                              ── the kernel answers 3–5 as one allow / deny ──
                                                                     →    6. Only your merchant's rows
                                                                             (RLS)
```

If any checkpoint says no, the request stops there. Nothing is allowed unless something says yes.

## One request, step by step

Aina is the **owner** of Brew & Bean KL. She creates a reward in the merchant portal. The browser
sends `POST /tenants/brew-bean-kl/rewards`.

| # | Checkpoint | The question | What happens for Aina | Where |
|---|---|---|---|---|
| 0 | **The UI** | Should I show the "Create reward" button? | `can(MERCHANT_CAPABILITY.manageRewards)` is true, so the button shows. This is **not** security: anyone can call the API with curl. | `useAuthorization()` in `packages/client` |
| 1 | **Authentication** | Who is this? | Her session cookie names her user. No valid session: 401. | `auth.guard.ts` |
| 2 | **Tenancy** | Which merchant is she acting for, and is she really in it? | The tenant comes from the URL (`brew-bean-kl`), never from a header the browser chose. She is a member, so it continues. A non-member gets 404, so they can't even learn the merchant exists. | `tenant-reward-auth.service.ts` |
| 3 | **RBAC** (role-based) | Does her **role** — or a live **grant** on top of it — allow this action? | The Owner role holds `reward.update`. A Cashier does not, and gets 403 unless an owner granted it, permanently or for 48 hours. | `AccessControlService` (ADR 067); templates in `TENANT_ROLE_TEMPLATES` |
| 4 | **ReBAC** (relationship-based) | Is she related to **this** record? | For a store-scoped action: is she a member of that store? For "edit my profile": is it hers? Creating a reward for her own merchant passes. | the kernel's grants loader and ownership resolver |
| 5 | **Sharing and ownership** | Was this one record shared with her, or is it hers? | A reward shared with her to edit, until Friday, lets her edit that reward only. | the share and ownership allow paths (ADR 067) |
| 6 | **RLS** (row-level security) | Which rows may this request touch? | Postgres is told "this request is Brew & Bean". The insert is stamped with that tenant, and any read returns only Brew & Bean rows, **even if the code forgot a filter**. | `rls.interceptor.ts`, `prisma/rls-context.ts`, the `rls*.sql` policies |

Steps 3–5 are answered together by one service, the **authorization kernel**. When people say "the
kernel", they mean "the function that decides allow or deny, and logs why". Admin endpoints reach it
through `@RequirePermission(...)`, and merchant endpoints through `requireCapabilityForSlug(...)`.

## The words, in one line each

| Word | In one line |
|---|---|
| **Authentication** | Proving who you are (sign-in, session). |
| **Authorization** | Deciding what you may do: steps 2–5 together. |
| **Tenant** | A merchant, such as Brew & Bean KL. Every merchant's data is kept apart. |
| **RBAC** | Your role gives you permissions (Owner → manage rewards). |
| **ReBAC** | Access because of a relationship to the record (member of this store, owner of this task). |
| **Share** | One record given to one teammate (view or edit), for a while or for good. |
| **Kernel** | The one service that combines role, grant, share and ownership into allow / deny. |
| **RLS** | Postgres rules that hide other merchants' rows: the last safety net. |
| **SuperAdmin** | The platform operator. Skips permission checks, and every use is audited. |

## What do I touch for my task?

| I am… | I add… | And… |
|---|---|---|
| Adding an admin endpoint | `@RequirePermission("ACTION", "RESOURCE")` on the route (add `{ resourceId }` for one record) | A test that a user without it gets 403 |
| Adding a merchant endpoint | `requireCapabilityForSlug(userId, tenantSlug, MERCHANT_CAPABILITY.x)` | A test for a role without it |
| Showing or hiding a button | `can(...)` with the **same** constant as the endpoint | Nothing else: the endpoint is the real check |
| Adding a table that holds a merchant's data | A `tenantId` column and an RLS policy | `pnpm db:migrate`, which applies the policies |
| Giving a role a new permission | An entry in the permission registry / role table | `pnpm db:seed` locally |

Never do these:
- trust a tenant id or a role sent by the browser;
- protect an endpoint only by hiding its button;
- write a raw permission string instead of the `PERMISSION.*` / `MERCHANT_CAPABILITY.*` constant.

## Read next

| I want to… | Read |
|---|---|
| Understand how the API decides allow or deny, and the roles and caches behind it | [Backend](./backend.md) |
| Show or hide things in the UI | [Frontend](./frontend.md) |
| Understand tenants, stores, locations and RLS | [Tenancy and RLS](./tenancy-and-rls.md) |
| Do a task, fix a 403, write the tests, or check a pull request | [Recipes](./recipes.md) |

## Where the code lives

### Backend (NestJS, `apps/api`)

| Piece | File | What it does |
|---|---|---|
| **Kernel** | `src/contexts/authorization/infrastructure/kernel/authorization-kernel.service.ts` | `can()`, `authorize()`, `explain()` |
| Grants loader | `kernel/subject-grants.loader.ts` | Loads roles (+ parents), role permissions, store-membership roles, user overrides |
| Tenant verification | `kernel/tenant-membership.service.ts` | Proves a claimed tenant / store / location belongs to the user |
| Ownership | `kernel/resource-ownership.resolver.ts` | Reads the owner of a USER / PROFILE from the DB |
| ACL | `kernel/acl.service.ts` | Explicit ALLOW / DENY entries per user or role |
| Policies (ABAC) | `kernel/policy-engine.service.ts` | Evaluates the JSON rule language — never `eval` |
| Decision audit | `kernel/authorization-audit-kernel.service.ts` | Writes `AuthorizationAudit` rows |
| Decisions API | `src/contexts/authorization/presentation/http/authorization-decisions.controller.ts` | `POST /authorization/decisions`, `GET /authorization/decisions/explain` |
| **Global guard** | `src/platform/presentation/http/security/guards/authorization.guard.ts` | Runs on every request; enforces every `@RequirePermission` on the route |
| `@RequirePermission` | `src/platform/presentation/http/security/decorators/require-permission.decorator.ts` (record targets: `permission-target.ts`) | Declares what a route needs |
| Request tenant context | `kernel/authorization-context.resolver.ts` | Takes the tenant from `:tenantSlug`, reads the route/query/body location, and verifies them (`x-tenant-id` / `x-location-id` are information only) |
| Privilege escalation | `src/contexts/authorization/domain/policies/rbac-escalation.policy.ts` | Stops admins granting what they do not hold or editing themselves |
| File authorization | `src/contexts/files/domain/policies/file-upload.policy.ts`, `src/contexts/tenancy/application/services/tenant-file-access.rule.ts` | Per-category rules for every `/files` operation (upload, complete, read, download, delete) |
| Merchant capability gate | `src/contexts/tenancy/infrastructure/adapters/tenant-reward-auth.service.ts` (`requireCapabilityForSlug` → `requireMembershipCapability`) | Every `merchant:*` check — the capability's `noun.verb` permission, decided by `AccessControlService` (role, live grant), audited with the path that allowed it |
| RLS context | `src/prisma/rls-context.ts`, `src/prisma/rls-pool.ts`, `src/platform/presentation/http/interceptors/rls.interceptor.ts` | Tells Postgres who is asking |

### Shared vocabulary (`packages/shared`)

| Piece | File |
|---|---|
| `PERMISSION.<RESOURCE>.<ACTION>`, `ACTION`, `RESOURCE`, `MERCHANT_CAPABILITY`, `MERCHANT_CAPABILITY_PERMISSION`, `TENANT_ROLE_TEMPLATES`, implicit self grants | `src/authorization/permission.ts` |
| Policy rule language, context / request / result schemas | `src/authorization/policy-dsl.schema.ts` |
| Decisions endpoint schemas | `src/authorization/decisions.schema.ts` |
| Permission catalogue (seeded to the DB) | `src/schemas/domain/rbac/permissions-registry.ts` |

### Frontend

| App | Provider | Gate helpers |
|---|---|---|
| Shared (`packages/client`) | `CapabilitiesProvider` | `useAuthorization()` → `{ can, cannot, canAll, canAny }`, `<Can>` |
| Admin (`apps/admin`) | mounted in `components/layout/dashboard-layout.tsx` | `RouteAuthorizationGuard`, `DisabledActionButton`, `AccessRestrictedNotice`, `useSuperAdminStatus()` |
| Merchant (`apps/merchant`) | `MerchantAuthorizationProvider` | `guardOrgPage` + `ORG_PAGE_RULES` (server-side page guard), `MerchantCapabilityGate`, `useAuthorization()` |
| Web (`apps/web`) | `WebAuthorizationProvider` (in `app/layout.tsx`) | `AccessGate`, `useWebSession()` |

## The golden rules

1. **Deny by default.** If no rule says "yes", the answer is "no" (spec §66).
2. **The frontend is never security.** Always protect the endpoint too (spec §2, §11).
3. **Never trust tenant ids from the browser.** `tenantId` and `locationId` are *requests*; the server verifies them against memberships (spec §55, §92, §93).
4. **Use `PERMISSION.*` / `MERCHANT_CAPABILITY.*` constants**, never raw strings like `"platform:user.delete"` (spec §7).
5. **Membership is not permission.** Being in a tenant does not grant anything by itself; it only lets permissions scoped to that tenant apply.
6. **Explicit DENY wins** over every ALLOW (spec §39, §88).
7. **Never write executable policies.** Conditions use the validated JSON rule language (spec §43).
8. **List endpoints filter in the database** (the query's `where` and RLS), never by loading everything and filtering in JavaScript.
9. **Only named, allowlisted system operations may bypass RLS.**
10. **Follow the strict TypeScript rules**: no `any` / `unknown` / `never`, no casts, no `as const`, no `!`, no `oxlint-disable` / `eslint-disable` (spec §108).

---

## Glossary

| Term | Meaning in this codebase |
|---|---|
| **Action** | What you want to do: `CREATE`, `READ`, `UPDATE`, `DELETE`, `LIST` and the lifecycle verbs (`PUBLISH`, `APPROVE`, `REJECT`, `SUSPEND`, `BAN`, `UNBAN`, `REACTIVATE`, `UNLOCK`, `REDEEM`). Each is its own permission: no action implies another. |
| **Resource** | The kind of thing: `USER`, `ROLE`, `LOCATION`, `REWARD`, … (enum `PermissionResource`). |
| **Permission** | A row `(action, resource, scope)`. The same action × resource can exist once per scope, e.g. `UPDATE:URL:GLOBAL` (any URL) and `UPDATE:URL:OWN` (only your URLs). |
| **Capability slug** | The string the UI checks, e.g. `platform:user.delete` or `merchant:manage_rewards`. Always obtain it from `PERMISSION.*` / `MERCHANT_CAPABILITY.*`. |
| **Role** | A named bundle of permissions (`Admin`, `Manager`, `User`, `Location Manager`, …). Roles are **data**; admins create them at runtime. Roles are flat: none inherits another's permissions. |
| **Grant** | A permission the subject holds, from a role, a store membership role, a user ALLOW override, or an implicit self grant. |
| **Override** | A `UserPermission` row with `effect` `ALLOW` (extra permission) or `DENY` (takes a permission away, even if a role grants it). |
| **Scope** | Where a grant applies: `GLOBAL`, `TENANT`, `LOCATION`, `OWN`, `RESOURCE`. |
| **ACL** | `ResourceAcl` rows: explicit ALLOW / DENY for one user or role on one resource (or every resource of a type). |
| **Ownership** | "This record belongs to you", read from the database (never from the request body). |
| **ReBAC** | Relationship checks: user → member of tenant → store → location. |
| **Tenant** | A tenant. Stores and locations belong to one. |
| **RLS** | PostgreSQL Row-Level Security — database rules that hide rows from a session. |
| **System operation** | A named, allowlisted reason to bypass RLS (e.g. `queue.job`, `outbox.enqueue`). |
| **SuperAdmin** | The platform operator flag on `User.isSuperAdmin`. Bypasses permission checks, audited. |
