---
title: "ADR 063: Oxlint, Oxfmt, TypeScript 7 and tsrs"
tags: ["adr", "tooling", "linting", "formatting", "typescript"]
description: "ESLint and Prettier are replaced by Oxlint (with oxlint-tsgolint for type-aware rules) and Oxfmt; the workspaces move to TypeScript 7; tsrs type-checks and builds every TypeScript workspace."
author: "Platform Team"
lastUpdated: 1792886400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
order: 63
---

# ADR 063: Oxlint, Oxfmt, TypeScript 7 and tsrs

## Status

Accepted (2026-10-25). Replaces the ESLint + Prettier setup described by the former
`docs/technical/tooling/eslint.md` (now [oxlint.md](../technical/tooling/oxlint.md)) and the
TypeScript 6 hold recorded in `pnpm-workspace.yaml`. ADR 018's strictness rules are unchanged; only
the tools that enforce them change.

## Context

- **Speed and the TypeScript 7 blocker.** Typed ESLint ran the TypeScript 6 compiler in-process and
  held every program in one heap (the API needed one carefully chosen program to stay under V8's
  limit). typescript-eslint peers `typescript <6.1.0`, and TypeScript 7 (the Go-native compiler)
  ships no classic JS API, so ESLint kept the whole repository on TypeScript 6.
- **Type checking had already moved.** Every `typecheck` script ran tsrs (a Rust drop-in for the
  TypeScript 7 `tsc` CLI), while builds and watchers still ran TypeScript 6's `tsc`.
- **The rules are the asset, not the tool.** The non-negotiables (no casts, no `unknown`, no runtime
  `typeof`, import and env boundaries, naming) had to survive the move exactly.

Alternatives considered:

- **Biome** (one linter + formatter). Kept as the alternative if an all-in-one tool ever matters more
  than plugin compatibility. Rejected for now: it cannot run the ESLint-API plugins the gate depends
  on (React Compiler rules, `@darraghor/eslint-plugin-nestjs-typed`, `eslint-plugin-react-native`,
  `eslint-plugin-turbo`), and has no esquery selector rule for the `restricted-syntax` bans.
- **Staying on ESLint** with TypeScript 6 pinned until typescript-eslint supports 7: no date, and
  the memory ceiling stays.

## Decision

1. **Oxlint 1.89 lints every workspace** through the shared `@workspace/oxlint-config`. Every
   category is off; the rule set is the explicit per-family lists translated from ESLint's effective
   config (290 enabled rules, each mapped or explicitly dropped). Every rule is an error.
2. **Type-aware rules run through oxlint-tsgolint** (TypeScript 7's checker) against each file's
   nearest `tsconfig.json`. A workspace's `tsconfig.json` therefore covers every file it lints;
   `apps/api` split its configs into `tsconfig.json` (full program, `noEmit`),
   `tsconfig.typecheck.json` (production program) and `tsconfig.build.json` (emit).
3. **ESLint-API plugins run as Oxlint JS plugins** where the native port diverges or is missing:
   eslint-plugin-react-hooks (React Compiler rules; the native ports reported 49 false findings),
   eslint-plugin-react and eslint-plugin-jsx-a11y (options the native rules ignore),
   `@next/eslint-plugin-next`, eslint-plugin-react-native, eslint-plugin-turbo and
   `@darraghor/eslint-plugin-nestjs-typed`.
4. **Repository rules are a `workspace` JS plugin**: `restricted-imports` (a port of ESLint's
   `no-restricted-imports`; the native rule silently ignores lookahead regexes),
   `restricted-syntax`, `naming-convention` (a port of @typescript-eslint's), `ssr-false-allowlist`
   and `no-server-import-in-client-component`. The ports were diffed against the originals on this
   repository (identical reports) and carry RuleTester suites.
5. **Configs compose with `composeConfigs`, never `extends`**: Oxlint's `extends` drops `env`,
   `globals`, `settings` and `ignorePatterns`.
6. **Oxfmt 0.74 formats**, configured by `.oxfmtrc.json` (migrated from `.prettierrc`, including
   Tailwind class sorting). Each `lint` script runs `oxfmt --check` before Oxlint.
7. **TypeScript 7.0.2 everywhere**, except where something still executes the TypeScript JS API:
   - `apps/docs` stays on 6.0.3 (`astro check` runs on Volar; `@astrojs/check` 0.9.12 peers `^5 || ^6`),
     pinned by a syncpack version group;
   - `@darraghor/eslint-plugin-nestjs-typed` gets TypeScript 6.0.3 as an injected dependency
     (`packageExtensions`), so it and its typescript-eslint dependencies resolve 6 locally;
   - `@nestjs/swagger`'s optional peer (`^5.5 || ^6`) is for its CLI plugin, which the repository does
     not use; `peerDependencyRules` records that.
   The global `typescript: 6.0.3` override is gone.
8. **tsrs builds and watches** `packages/shared`, `packages/api-client`, `packages/messaging` and
   `apps/aws-infrastructure` (`tsc-alias` still rewrites extensions). Verified before the switch:
   the same files emitted, identical JavaScript, `.d.ts` differing only in union-member order;
   `--watch --preserveWatchOutput` re-emits on change; an up-to-date incremental build emits nothing.
   The one remaining `tsc` call, `tsc --showConfig` in `tsconfig-conditions.test.mjs`, resolves
   configs, which tsrs does not implement.

## Consequences

- Type-aware lint no longer holds TypeScript programs in a Node heap (tsgolint runs TypeScript 7's
  Go checker), so the API's tsconfigs are no longer shaped around V8's memory limit.
- **Known gaps** (documented in [oxlint.md §10](../technical/tooling/oxlint.md#10-what-changed-from-eslint-and-the-known-gaps)):
  `@typescript-eslint/no-unsafe-enum-assignment` (the repository has no TypeScript enums) and three
  `@darraghor` rules that need parser services (the API has no class-validator / `@ApiProperty` DTOs).
  Re-check both on every Oxlint upgrade.
- JS plugins are slower than native rules; a rule moves to its native port once that port matches.
- The TypeScript 6 holdouts above are removed as soon as their upstreams support TypeScript 7.
- Lint canaries no longer use ESLint's API: `@workspace/oxlint-config/testing` lints snippets with
  the real binary and the workspace's real composed config.
