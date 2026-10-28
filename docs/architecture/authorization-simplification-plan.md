---
title: "Authorization simplification plan"
tags: ["architecture", "authorization", "rbac", "rebac", "abac", "cedar", "plan"]
description: "What made the authorization system feel complicated, measured in the code, and the phased plan to simplify it while keeping every behaviour the product uses. Phases 1, 2 and 4 are done; phase 3 was declined."
author: "Platform Team"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Authorization simplification plan

Status: **phases 1, 2 and 4 done (2026-10-28); phase 3 declined**, so the JSON rule language and
the demo `ORDER` / `PAYMENT` / `INVENTORY` data stay.

The goal is fewer concepts, fewer files and one obvious way to do each thing, without losing anything
the product (RewardHub) or its tests rely on. [Authorization: start here](../technical/authorization/overview.md)
explains the system as it is now.

## What makes it feel complicated (measured)

| # | Finding | Evidence |
|---|---|---|
| F1 | **Two policy languages** for the same job ("extra conditions on top of a permission"). The platform side uses a home-made JSON rule language; the merchant side uses Cedar, which has a draft / publish / simulate workflow. | `infrastructure/kernel/policy-engine.service.ts` (JSON) and `infrastructure/cedar/` (11 files). The JSON side has no API or screen to manage it: its only rules are 3 seeded demo rows. |
| F2 | **Demo resources that the product does not have.** `ORDER`, `PAYMENT` and `INVENTORY` permissions, 3 demo policies and 4 demo ACL rows exist only to illustrate the kernel. RewardHub has no orders, payments or inventory. | No route, screen or test uses them: used in 7 non-test files, all of them definitions, seeds or samples, and in 0 test files. |
| F3 | **Kernel methods with no caller.** `filter()` (database row filters) and `resourceCapabilities()`. | 0 production callers. The overview still lists `kernel.filter()` as golden rule 8. |
| F4 | **Four decorators with no route.** `@RequireAllPermissions`, `@RequireAnyPermission`, `@RequireAllRoles`, `@RequireAnyRole`. | 0 routes use them. They are only mentioned in their own doc comments and in the guard. |
| F5 | **Two decorators for one checkpoint.** `@RequirePermission` (175 routes) checks a permission; `@Authorize` (25 routes) checks the same thing for one record (`resourceId`). | Same guard, same kernel. A newcomer has to learn when to pick which. On 7 routes the two were stacked on purpose: "the permission broadly **and** this record". |
| F6 | **Ten authorization docs, 2,362 lines**, including a 53 KB tenancy page and a change log. | `docs/technical/authorization/`. |

Two things look complicated but are **deliberate**, and this plan keeps them:

- **Platform RBAC and merchant roles are separate.** Platform staff have data-driven roles (admins
  create them at runtime). Merchant members have one of a few fixed roles per tenant (Owner, Admin,
  Cashier…). They answer different questions, and merging them would make both worse.
- **One folder per command or query** (58 commands, 28 queries). That is the repository's CQRS
  convention (ADR 059), not authorization-specific complexity.

## The plan: four phases, each shippable on its own

Every phase ends with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the API e2e suites that cover
authorization (`test:e2e`, `test:e2e:tenancy`, `test:e2e:rls`) green. Any migration a phase needs is
generated with `db:migrate:create`, never hand-written, and **you** run it.

### Phase 1: remove what nothing uses (low risk), done

- Delete the four unused decorators (F4) and their branches in `AuthorizationGuard`.
- Delete `kernel.filter()` and `kernel.resourceCapabilities()` (F3) from the kernel and its port.
  Rewrite golden rule 8 as "list endpoints filter in the query (the `where` clause and RLS)", which
  is what the code already does.
- The per-record UI permissions (`authorization.can` on a record, `ResourceAuthorization`, the
  `resource` argument of `can()` / `<Can>`) went too: nothing produced them, so no screen used them.
- Tests for the deleted code are deleted with it; every other test stays as it is.

Result: about 10 fewer files, and two fewer concepts in the guard.

### Phase 2: one route decorator (medium risk), done

- `@RequirePermission(action, resource, { resourceId?, attributes?, description? })` replaces
  `@Authorize` on its 25 routes, and a route may **stack** several: every one must pass. That keeps
  the 7 routes that need "the permission broadly and this record" exactly as strict as before:

  ```ts
  @RequirePermission("DELETE", "USER")
  @RequirePermission("DELETE", "USER", { resourceId: "userId", description: "A platform admin bans an account" })
  ```

  Self-service routes keep the record check alone (`{ resourceId: self() }`). The 4 routes that
  repeated one check twice now declare it once.
- `@Authorize` is deleted; `self()`, `fromParam()` and `attributesFromBody()` live in
  `permission-target.ts`. `@RequirePermission` is a method decorator (no controller used it on a class).

### Phase 3: one policy language: Cedar (higher risk, needs a migration), declined

- The JSON rule language (F1) is retired. Cedar, which the merchant side already uses with drafts,
  publishing and simulation, becomes the only way to write conditions.
- The demo resources and their seeded rows (F2) are removed: the `ORDER` / `PAYMENT` / `INVENTORY`
  enum values, the 3 JSON policies and the 4 demo ACL rows. The `PolicyDefinition` table goes;
  `ResourceAcl` stays only if Phase 3's review finds a real user.
- A generated migration drops the table and enum values. You run it, then reseed.
- The kernel shrinks to RBAC, ReBAC (membership and ownership) and Cedar.

Result: one policy language with a UI, and a kernel that only knows about things the product has.
The risk is in the data. A team that already built on the JSON rules would need to port them, so
this phase is the one to approve deliberately.

### Phase 4: fewer, shorter docs (low risk), done

- Eleven pages became five:
  1. *Start here* (`overview.md`, the URL every link already used): the plain-words story, the
     code map, the golden rules and the glossary.
  2. *Backend*: the guard, `@RequirePermission`, the kernel, and the RBAC internals.
  3. *Frontend*: `can()` and the gates.
  4. *Tenancy and RLS*: unchanged.
  5. *Recipes*: with troubleshooting, testing and the dos and don'ts folded in.
- The change log is dropped; git history keeps it.
- The sections phases 1 and 2 touched were rewritten against the code.

## Not in this plan

- Changing what any user can or cannot do. Every permission the product checks today is checked
  the same way after each phase.
- RLS. It is the database's safety net, and it stays exactly as it is.
- Merging platform and merchant roles (see above).
