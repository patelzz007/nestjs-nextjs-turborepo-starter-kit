---
title: "ADR 018: Strict TypeScript Flags Everywhere and the `as const` Ban"
tags: ["adr", "typescript", "eslint", "code-quality"]
description: "Every workspace compiles with exactOptionalPropertyTypes, noUncheckedIndexedAccess, noImplicitOverride and noFallthroughCasesInSwitch, and ESLint bans `as const` and z.any/unknown/never."
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 18
---

# ADR 018: Strict TypeScript Flags Everywhere and the `as const` Ban

## Status

Accepted (2026-10-01)

## Context

The platform spec (§2.1, §2.3) requires `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride` and `noFallthroughCasesInSwitch`, and forbids
`as const`. `AGENTS.md` and `rules/00-non-negotiables.md` already forbade `as const`, but the
ESLint config deliberately allowed it, and:

- `exactOptionalPropertyTypes` and `noImplicitOverride` were off everywhere except `apps/docs`;
- `noUncheckedIndexedAccess` was switched **off** for `apps/api`, `packages/shared` and
  `packages/messaging`;
- `noFallthroughCasesInSwitch` was only on for NestJS workspaces;
- the rules doc claimed `z.any()` / `z.unknown()` / `z.never()` were lint-banned, but the only
  selectors lived in a block that targeted a deleted module.

## Decision

- All four flags live in `packages/typescript-config/base.json`; no workspace may override them.
- `packages/eslint-config/base.js` §9 bans `as const`, `<const>` and `z.any/unknown/never` via
  `no-restricted-syntax`, next to the existing `consistent-type-assertions: never`.
- Literal types are declared explicitly instead: typed tuples, explicit unions, or `satisfies`.
- For `exactOptionalPropertyTypes`, a value that may be absent **or** `undefined` is declared
  `key?: T | undefined` in our own types; `undefined` is never passed where a library means
  "absent" (omit the key instead). Zod object shapes that must satisfy such interfaces use
  `.exactOptional()`.

## Consequences

- One compiler contract across the monorepo: a snippet that compiles in one workspace compiles in
  all of them, and "undefined vs absent" bugs (e.g. Prisma's `undefined` = "leave unchanged" vs
  `null` = "clear") surface at compile time.
- Upfront cost: ~500 compiler errors fixed across `apps/api`, the three Next apps, `packages/ui`
  and `packages/client` when the flags were enabled.
- Third-party typings occasionally disagree with themselves under `exactOptionalPropertyTypes`
  (e.g. ioredis `RedisOptions.replyMapping`); we adapt at the boundary (e.g. `Omit<…>`), never with
  casts.
- The flags apply to **test code too**. Vitest strips types without checking them, so `apps/api`'s
  `typecheck` script runs three programs: `tsconfig.typecheck.json` (production `src/`),
  `tsconfig.check.json` (unit specs, `test/**` e2e + support, `prisma/**` seed and RLS manifest,
  tool configs, and scripts that import the Nest source graph) and `tsconfig.scripts.json`
  (node-only scripts, `NodeNext`). Specs and the seed are linted with the same rules as `src/`.
  Test doubles are built with their real constructor arguments
  (`apps/api/test/support/test-service-graph.ts`), never cast into shape.
- The `unknown` / `never` **type keywords** remain review-enforced, because catch clauses need
  `unknown` and exhaustiveness checks need `never`.
