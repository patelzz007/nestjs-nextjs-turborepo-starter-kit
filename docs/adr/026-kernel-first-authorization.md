---
title: "ADR 026: One In-House Authorization Kernel Behind One Global Guard"
tags: ["adr", "authorization", "rbac", "acl", "abac", "kernel"]
description: "Every authorization decision goes through AuthorizationKernelService, called by the single global AuthorizationGuard or by services; no second engine, no feature flag between old and new paths, no manual checks in controllers, and no third-party policy engine for the platform kernel."
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 26
---

# ADR 026: One In-House Authorization Kernel Behind One Global Guard

## Status

Accepted (2026-10-01). Current design: [Backend: the Authorization Kernel](../technical/authorization/backend.md).
Refines [ADR 001](./001-permission-first-rbac.md); tenant policies stay with Cedar ([ADR 011](./011-cedar-precedence.md)).

## Context

The permission-first RBAC of ADR 001 answered "does this user hold `ACTION:RESOURCE`?" but not
*where* (organization, store, location, own record), *which record* (ACL exceptions, ownership) or
*under what conditions* (ABAC). A kernel that answered those questions was added next to it, and for
a while the two ran side by side:

- `AuthorizationGuard` chose between the kernel and the legacy `AuthorizationCheckerService` with a
  `useKernel` flag, so the same route could be decided by different rules;
- controllers carried a decorator **and** a manual `KernelIntegrationHelper` call for the same
  check, and nobody could say which one was the truth;
- services mixed the checker, the kernel and the helper.

## Decision

1. **One decision engine.** `AuthorizationKernelService` (`modules/authorization/kernel/`) is the only
   code that decides allow / deny, with one fixed precedence: SuperAdmin → validation → tenant
   verification → explicit DENY (override, ACL) → explicit ACL ALLOW → scoped grants → policies →
   default deny.
2. **One entry point per kind of check.** The global `AuthorizationGuard` enforces every decorator
   (`@RequirePermission`, `@RequireAll/AnyPermissions`, `@RequireAll/AnyRole`, `@Authorize`) through
   the kernel; services call `kernel.authorize()` / `filter()` when the decision needs data the route
   does not have. The legacy flag and `KernelIntegrationHelper` are deleted; no controller re-checks
   what its decorator declared.
3. **Built in-house, not installed.** The kernel borrows ideas from CASL, Oso, Cerbos and OpenFGA but
   installs none of them for platform RBAC: the rules must share the zod vocabulary in
   `packages/shared`, run inside the request's transaction and RLS context, and stay auditable row by
   row.
4. **Policies are data, never code.** Conditions use a zod-validated JSON rule language
   (`PolicyConditionsSchema`); no `eval`, no stored JavaScript or SQL.
5. **RLS policies are generic.** PostgreSQL policies use user, organization, store and location —
   never role names — so creating or changing a role never needs a migration.
6. **`AuthorizationCheckerService` stays for the session payload only** (`/auth/me`,
   `/auth/permissions`, the admin "check" endpoint), never for a security decision
   ([RBAC internals](../technical/authorization/rbac.md#two-readers-of-the-same-data)).

## Alternatives considered

- **Keep both paths behind a flag** — rejected: two sources of truth, and every bug fix had to be
  made twice.
- **Adopt a hosted or embedded policy engine (Cerbos, Oso, OpenFGA) for everything** — rejected for
  the platform kernel: a second schema language beside zod, a network or sidecar hop on every request,
  and decisions outside the RLS transaction. Cedar is used where it pays off — tenant-authored
  merchant policies that may only narrow the role table (ADR 011).
- **Imperative checks in controllers** — rejected: undeclared authorization cannot be reviewed or
  listed per endpoint (`rules/10`).

## Consequences

- One place to read, test and audit every decision; `explain()` shows the exact step that decided.
- Adding a scope, an owner type or a policy operator is a kernel change with kernel tests, not a
  search through controllers.
- The kernel is code this repository maintains — its precedence, filters and audits are covered by
  unit and e2e tests ([Testing authorization](../technical/authorization/testing.md)).
- Adding another authorization engine is a rule violation
  ([dos and don'ts](../technical/authorization/dos-and-donts.md)).
