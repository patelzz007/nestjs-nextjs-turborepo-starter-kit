---
title: "Authorization Dos and Don'ts"
tags: ["authorization", "best-practices", "security", "code-review"]
description: "The rules to check before opening a pull request that touches permissions, tenants, RLS, or gated UI — each with a short why."
order: 25
author: "Platform Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Authorization Dos and Don'ts

> [!TIP]
> Use this page as a **pull-request checklist**. Each rule says *why*, because rules you
> understand are rules you will keep.

---

## Backend

### ✅ Do

| Do | Why |
|---|---|
| Put a decorator (`@RequirePermission`, `@Authorize`, …) or a `kernel.authorize()` call on **every** mutation and privileged read | The frontend can be bypassed with curl (spec §2). |
| Use `@Authorize({ …, resourceId })` or `kernel.authorize()` with the record when the answer depends on **which** record | A global permission does not mean "every record" (spec §5, §94). |
| Pass the record's `organizationId` / `storeId` / `locationId` as `resourceAttributes` | Tenant-scoped grants fail closed without them. |
| Read the tenant from the request context (`RequestContextService.current()?.tenant`) | It is verified; headers and bodies are not (spec §55). |
| Use `kernel.filter()` for list endpoints | One query, no data leak, no N+1 (spec §32, §58). |
| Keep business validation separate from authorization | "May they?" and "is this state change valid?" are different questions (spec §96). |
| Use `self()` for self-service routes | Implicit own-account grants only apply to the caller's own record. |
| Parse policy / ACL conditions with `PolicyConditionsSchema` before saving | Malformed rules must never reach the database. |
| Add a new, specific system-operation name for new background work | Every RLS bypass stays explicit and auditable. |
| Keep stores in sync only through `OrganizationLocationRepository` | Stores mirror locations in the same transaction. |
| Return the generic 403 (`AuthorizationException`) | Never tell an attacker which rule failed. |

### ❌ Don't

| Don't | Why |
|---|---|
| `if (user.role === "ADMIN")` in business code (merchant: `role === "OWNER"`, role lists) | Roles are data; permissions are the vocabulary (spec §67, §110). Use `kernel.can()`; merchant code uses `MERCHANT_CAPABILITY.*` (`requireMembershipCapability`, `can()`). |
| Treat organization membership as permission | Membership only lets **scoped** permissions apply. It grants nothing by itself. |
| Trust `organizationId` / `storeId` / `ownerId` from the request body or headers | Forged tenant ids and ownership claims are the classic multi-tenant bug (spec §55, §92). |
| Load all rows and filter in JavaScript | Leaks data into memory and logs, and is slow (spec §57). |
| Store JavaScript / SQL snippets as policies, or `eval` anything | Remote code execution risk (spec §43). |
| Create an RLS policy per role | Roles are dynamic; RLS protects stable tenant concepts (spec §50). |
| Inject `SystemPrismaService` into feature code | It ignores RLS entirely. Use a named system operation. |
| Hardcode `actorId: "system"` in audits | Audits must name the real actor. |
| Let an admin grant permissions they do not hold, or edit their own roles | Privilege escalation (spec §68, §69). `PrivilegeEscalationService` enforces this — do not bypass it. |
| Put permissions into the JWT | Tokens get huge and stale (spec §60). |
| Add Redis caching for decisions "just in case" | Measure first (spec §59). |
| Add CASL / Oso / Cerbos / OpenFGA next to the kernel | One engine (spec §48). |

---

## Frontend

### ✅ Do

| Do | Why |
|---|---|
| Use `useAuthorization().can(...)` or `<Can>` | One API everywhere (spec §9, §27). |
| Use `PERMISSION.*` / `MERCHANT_CAPABILITY.*` constants | Typos fail at compile time (spec §7, §118). |
| Mirror the **exact** permission of the API route the component calls | UI and API stay consistent. |
| Gate in container components | Presentational components stay reusable (spec §26, §82). |
| Hide navigation; hide or disable actions (with a reason); show a fallback for whole sections | Consistent UX (spec §117). |
| Render nothing / a skeleton while permissions load | Allowed users should never see a denial flash. |
| Use server-provided `authorization.can` on records for complex per-record decisions | The browser must not re-implement ownership / scope / policy (spec §12, §13). |
| Add new pages to the menu config **and** `ADMIN_MENU_AUTHORIZATION` | Sidebar, palette and route guard stay in sync. |

### ❌ Don't

| Don't | Why |
|---|---|
| Treat a hidden button as protection | UX only (spec §2, §11). |
| `user.role === "MANAGER" && user.storeId === order.storeId` in a component | Re-implements the kernel badly (spec §9, §84). |
| Type slug strings (`"platform:user.delete"`) | A typo silently denies forever. |
| Call the API for every `can()` | Checks are local (spec §112). Use the decisions endpoint only for batches of per-record checks. |
| Mark unauthorized menu items `disabled` | `disabled` means "switched off", not "forbidden" (spec §25). |
| Encode feature flags or subscription plans as permissions | Separate concerns (spec §70, §71). |
| Put authorization logic inside the sidebar component | Filter the config first, render second (spec §26). |

---

## Database and RLS

| ✅ Do | ❌ Don't |
|---|---|
| Add every new tenant table to `prisma/rls/manifest-index.ts` and give it policies | Ship a table without RLS "for now" |
| Run `pnpm --filter @workspace/api db:check-rls-manifest` | Rely on application filters alone (spec §110) |
| Stop the API before `db:reset` / `db:apply-security` | Run RLS DDL while workers hammer the same tables |
| `pnpm build:shared` before seeding | Seed against a stale shared build (new permissions go missing) |
| Use `TenantTransactionService` for multi-statement tenant work | Use session-level `set_config` yourself |

---

## TypeScript rules (enforced in review)

| ❌ Never | ✅ Instead |
|---|---|
| `any`, `unknown`, `never` written as types | concrete types, Zod-inferred types, generics |
| `z.any()`, `z.unknown()`, `z.never()` | an explicit schema |
| `value as Type`, `as unknown as Type` | `safeParse`, type guards, `satisfies` |
| `as const` | explicit literal-union or readonly tuple types, `z.enum([...]).options` |
| `value!` | handle `undefined` (or a small `requireRow(...)` helper that throws) |
| `// eslint-disable…` | fix the code, or a documented file-scoped rule in the eslint config |
| `catch (e: unknown)` | `catch (error)` without annotation, then narrow with Zod or `instanceof Error` |
