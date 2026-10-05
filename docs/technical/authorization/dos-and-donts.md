---
title: "Authorization dos and don'ts"
tags: ["authorization", "checklist", "code-review", "rbac", "rls"]
description: "The authorization pull-request checklist with the reason behind every rule: backend, frontend, database and RLS."
order: 25
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Authorization dos and don'ts

> [!TIP]
> Use this page as a pull-request checklist. Each rule says **why** — rules you understand are rules
> you keep. The repo-wide checklist is [Dos and don'ts](../dos-and-donts.md); the TypeScript rules
> are in [`rules/00`](../../../rules/00-non-negotiables.md).

## Backend

| ✅ Do | Why |
| --- | --- |
| Put a decorator (`@RequirePermission`, `@Authorize`, `@SuperAdminOnly`) or a `kernel.authorize()` call on **every** mutation and privileged read | The frontend can be bypassed with `curl`. |
| Use `@Authorize({ …, resourceId })` or `kernel.authorize()` with the record when the answer depends on **which** record | A permission is a capability "somewhere", not "on every record". |
| Pass the record's `organizationId` / `storeId` / `locationId` as resource attributes | Tenant-scoped grants fail closed without them ([kernel §5.2](./backend.md#52-what-each-scope-means)). |
| Read the tenant from the request context (`requestContext.current()?.tenant`) | It is verified; headers and bodies are not ([tenancy §2](./tenancy-and-rls.md#2-client-tenant-ids-are-requests-not-facts)). |
| Use `kernel.filter()` for list endpoints | One query, no data leak, no N+1. |
| Keep business validation separate from authorization | "May they?" and "is this state change valid?" are different questions with different errors. |
| Use `self()` for self-service routes | Implicit own-account grants apply only to the caller's own record. |
| Parse policy and ACL conditions with `PolicyConditionsSchema` before saving | A malformed rule must never reach the database. |
| Add a new, specific system-operation name for new background work | Every RLS bypass stays explicit and auditable ([ADR 012](../../adr/012-system-operations.md)). |
| Change stores only through `OrganizationLocationRepository` | A store mirrors its location in the same transaction. |
| Return the generic 403 (`AuthorizationException`) | Never tell an attacker which rule failed; use `explain()` to debug. |
| Change roles and permissions only through `RoleService` / `PermissionService` with the real actor | One audited transaction, escalation checks, token revocation and cache invalidation come with it ([mutation contract](./backend.md#111-the-rbac-mutation-contract)). |

| ❌ Don't | Why |
| --- | --- |
| `if (user.role === "ADMIN")` in business code (merchant: `role === "OWNER"`, role lists) | Roles are data; permissions are the vocabulary. Use the kernel; merchant code uses `MERCHANT_CAPABILITY.*` (`requireMembershipCapability`). |
| Treat organization membership as permission | Membership only lets **scoped** permissions apply; it grants nothing by itself. |
| Trust `organizationId` / `storeId` / `ownerId` from the body or headers | Forged tenant ids and ownership claims are the classic multi-tenant bug. |
| Load all rows and filter in JavaScript | Leaks data into memory and logs, and is slow. |
| Store JavaScript or SQL as policies, or `eval` anything | Remote code execution. Conditions use the validated JSON rule language. |
| Create an RLS policy per role | Roles are dynamic; RLS protects stable tenant concepts. |
| Inject `SystemPrismaService` into feature code | It ignores RLS entirely. Use a named system operation. |
| Hard-code `actorId: "system"` in audits | Audits name the real actor: `{ kind: "USER", userId }`, or `{ kind: "SYSTEM_OPERATION", operation }` for a scheduled job. |
| Let an admin grant what they do not hold, or edit their own roles | Privilege escalation. `PrivilegeEscalationService` enforces this — never bypass it. |
| Put permissions or roles into the JWT | Tokens grow and go stale ([ADR 003](../../adr/003-jwt-identity-only.md)). |
| Add a decision cache "just in case" | Measure first; grants are already cached per user ([RBAC internals](./rbac.md#caches-and-invalidation)). |
| Add CASL / Oso / Cerbos / OpenFGA next to the kernel | One engine ([ADR 026](../../adr/026-kernel-first-authorization.md)). |

## Frontend

| ✅ Do | Why |
| --- | --- |
| Use `useAuthorization().can(...)` or `<Can>` | One API in every app. |
| Use `PERMISSION.*` / `MERCHANT_CAPABILITY.*` constants | A typo fails at compile time instead of silently denying forever. |
| Mirror the **exact** permission of the API route the component calls | UI and API stay consistent. |
| Gate in container (smart) components | Presentational components stay reusable. |
| Hide navigation; hide or disable actions with a reason; show a fallback for whole sections | Consistent UX ([frontend §3](./frontend.md#3-ux-rules--what-to-do-when-something-is-not-allowed)). |
| Render nothing or a skeleton while permissions load | Allowed users never see a denial flash. |
| Use server-provided per-record `authorization.can` for complex record decisions | The browser must not re-implement ownership, scope or policy. |
| Add new admin pages to the menu config **and** `ADMIN_MENU_AUTHORIZATION` | Sidebar, palette and route guard stay in sync. |

| ❌ Don't | Why |
| --- | --- |
| Treat a hidden button as protection | UX only. |
| `user.role === "MANAGER" && user.storeId === order.storeId` in a component | Re-implements the kernel badly. |
| Type slug strings (`"platform:user.delete"`) | See the constants rule above. |
| Call the API for every `can()` | Checks are local; use the decisions endpoint only for batches of per-record checks. |
| Mark unauthorized menu items `disabled` | `disabled` means "switched off", not "forbidden" — hide them. |
| Encode feature flags or subscription plans as permissions | Separate concerns, separate lifecycles. |
| Put authorization logic inside the sidebar component | Filter the config first, render second. |

## Database and RLS

| ✅ Do | ❌ Don't |
| --- | --- |
| Add every new tenant table to `prisma/rls/manifest-index.ts` and give it policies ([profiles](./tenancy-and-rls.md#8-policy-profiles-and-sql-helpers)) | Ship a table without RLS "for now" |
| Run `pnpm --filter @workspace/api db:check-rls-manifest` | Rely on application filters alone |
| Stop the API before `db:reset` / `db:apply-security` | Run RLS DDL while workers hammer the same tables |
| `pnpm build:shared` before seeding | Seed against a stale shared build (new permissions go missing) |
| Use `TenantTransactionService` for multi-statement tenant work | Call `set_config` yourself |
