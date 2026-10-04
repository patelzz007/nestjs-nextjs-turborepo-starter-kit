---
title: "Dos and don'ts"
description: "The pull-request checklist for engineers building on the starter kit: the non-negotiables, backend, contracts, database and RLS, authorization, frontend, messaging, storage, testing and docs — with links to the full rule."
order: 4
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=630&fit=crop"
tags: ["best-practices", "code-review", "rules"]
---

# Dos and don'ts

A one-page checklist. Each line links to the rule that explains *why*; the rulebook in
[`rules/`](../../rules/26-junior-onboarding-guide.md) is authoritative, and
[`rules/00-non-negotiables.md`](../../rules/00-non-negotiables.md) wins any conflict. For quick
"which pattern?" answers see [`rules/23`](../../rules/23-quick-reference-decision-trees.md); for
❌/✅ pairs by area see [`rules/25`](../../rules/25-anti-pattern-catalog.md).

## The completion gate

- ✅ Finish every task with `pnpm run lint` (zero errors **and** warnings) and `pnpm run test`, after
  your last edit. Add `pnpm run typecheck` when you touch `packages/shared` or the Prisma schema.
- ❌ Never make it pass with `eslint-disable`, `@ts-ignore` / `@ts-expect-error`, config changes,
  `.skip` / `.only`, weakened assertions or `--no-verify`. If a rule seems wrong, raise it with a
  human ([`AGENTS.md`](../../AGENTS.md)).

## TypeScript ([rules/00](../../rules/00-non-negotiables.md), [ADR 018](../adr/018-strict-typescript-and-as-const-ban.md))

| ❌ Never | ✅ Instead |
| --- | --- |
| `any`, `unknown`, `never` (outside exhaustiveness checks) | Concrete or zod-inferred types, generics that carry real information |
| `z.any()`, `z.unknown()`, `z.never()`, argument-less `z.custom()` | A precise schema |
| `value as Type`, `as const`, `value!` | `safeParse`, type guards, `satisfies`, typed tuples, a `requireRow()`-style helper |
| `typeof x === "string"` as domain validation | The shared zod schema |
| Magic numbers / unexplained constants | Named constants (`const MS_PER_DAY = …`) |
| Missing return types or access modifiers | Explicit everywhere (lint-enforced) |

`catch (error)` may be typed `unknown` only in the catch clause itself, then narrowed.

## Backend ([rules/02](../../rules/02-backend-nestjs.md), [rules/21](../../rules/21-oop-and-solid-principles.md))

- ✅ Controller → service → repository; controllers only map HTTP, never query Prisma.
- ✅ `@ZodBody` / `@ZodQuery` / `@ZodParams` + `@ZodResponse` on every route, schemas from
  `@workspace/shared` ([response contracts](./api/response-contracts.md)).
- ✅ Throw `AppError` subclasses with stable codes; clients branch on `error.code` ([errors](./api/errors.md)).
- ✅ Paths come from `apiRoutes`; controllers use `apiPath()` ([routes](./api/routes.md)).
- ✅ Read configuration through `TypedConfigService`; add new variables to the zod env schema,
  `.env.example` and the docs ([configuration](./configuration/api.md)).
- ❌ No `process.env` outside `src/config`; no silent fallbacks for secrets.
- ❌ No hard deletes of business entities — `isDeleted`, `deletedAt`, `deletedBy`.

## Contracts and API ([rules/05](../../rules/05-contracts-zod-api.md))

- ✅ One schema per shape in `packages/shared`, used by server validation, the client and Swagger.
- ✅ Validate on the server always; on the client too (same schema) for UX.
- ✅ Lists use the one grammar: whitelisted sort, filter AST, keyset cursors ([list queries](./api/list-queries.md)).
- ✅ After any route or schema change: `pnpm --filter @workspace/api openapi:export`, then
  `pnpm docs:api` ([API reference](./api-reference/README.md)).
- ❌ Never trust the frontend; never accept tenant ids or ownership from the body as facts.

## Authorization ([rules/10](../../rules/10-security-auth-authorization.md), [authorization](./authorization/overview.md))

- ✅ A decorator (`@RequirePermission`, `@Authorize`, `@SuperAdminOnly`) or a kernel call on every
  mutation and privileged read; record-dependent checks pass the record (`resourceId`, org/store).
- ✅ Merchant code checks `MERCHANT_CAPABILITY.*`, never role names; list endpoints filter in the
  query (`kernel.filter()`), never in JavaScript.
- ✅ Return the generic 403; use `self()` for own-account routes; audits name the real actor.
- ❌ No `if (user.role === "ADMIN")`; membership is not permission; no permissions in JWTs; no second
  authorization engine; never bypass `PrivilegeEscalationService`.

## Database and RLS ([rules/08](../../rules/08-database-prisma.md), [database](./database.md), [database security](./security/database-security.md))

- ✅ Edit `schema.prisma`, generate the migration, never hand-write or edit committed SQL.
- ✅ Every new table: RLS manifest entry + policies + seed rows (seed coverage fails otherwise).
- ✅ Tenant work in `TenantTransactionService`; background work through a named system operation.
- ✅ Protect concurrent writes explicitly (conditional updates / compare-and-set, unique constraints,
  row locks) — see how checkout and invites do it.
- ✅ Money as integer minor units; timestamps as epoch ms.
- ❌ No RLS policy per role; no `SystemPrismaService` in feature code; no session-level `set_config`.

## Frontend ([rules/03](../../rules/03-web-nextjs.md), [rules/06](../../rules/06-tanstack-state-forms-tables.md), [rules/07](../../rules/07-ui-system.md))

- ✅ Smart components (pages/containers) fetch and transform; `@workspace/ui` components are
  stateless, controlled, accessible, themeable and forward refs.
- ✅ TanStack Query through the typed client (`apiRouter`), TanStack Form, TanStack Table, Zustand
  feature stores ([ADR 019](../adr/019-tanstack-form-standard.md), [ADR 023](../adr/023-client-state-feature-stores.md)).
- ✅ `can()` / `<Can>` with `PERMISSION.*` / `MERCHANT_CAPABILITY.*` constants, mirroring the API's
  rule; hide navigation, disable actions with a reason.
- ✅ URL state for filters and pagination ([routing](./frontend/routing.md)).
- ❌ No raw `fetch` in pages; no hand-typed query keys; a hidden button is not protection.

## Messaging, jobs and payments ([rules/09](../../rules/09-messaging-and-jobs.md), [messaging](./messaging.md))

- ✅ Domain events go through the transactional outbox in the same transaction as the write.
- ✅ Consumers are idempotent (inbox / dedupe keys); payment-like operations are idempotent by
  construction (idempotency keys, as POS checkout does).
- ❌ No direct Kafka publish after a DB write; no job without a retry/backoff decision.

## Files ([rules/20](../../rules/20-object-storage.md), [storage](./storage/overview.md))

- ✅ Direct-to-storage uploads with tickets; verify size, checksum and type on completion.
- ❌ Never stream uploads through the API; never mark a file `CLEAN` without a scanner verdict.

## Security and operations

- ✅ Every state-changing request is audited (automatic — do not bypass the interceptor).
- ✅ No single point of failure without an explicit fallback decision ([rules/12](../../rules/12-observability-and-operations.md)).
- ❌ Never log secrets, tokens, one-time codes or full emails.

## Tests and docs ([rules/11](../../rules/11-testing-vitest.md), [rules/14](../../rules/14-documentation.md))

- ✅ Test everything, including tiny functions; e2e for authorization and RLS boundaries.
- ✅ Update docs in the same change: guides here, ADRs for decisions, runbooks for operations.
