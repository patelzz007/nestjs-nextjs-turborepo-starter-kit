---
title: "Oxlint & Oxfmt Setup & How To Run Them"
tags: ["oxlint", "oxfmt", "linting", "formatting", "tooling", "import-boundaries"]
description: "How Oxlint and Oxfmt are configured repo-wide, what replaced each ESLint and Prettier piece, and how to run them — globally (via Turborepo) and per project."
order: 6
author: "Platform Team"
lastUpdated: 1792886400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Oxlint & Oxfmt Setup & How To Run Them

> [!NOTE] This document explains how linting (**Oxlint**) and formatting (**Oxfmt**) are
> configured across the monorepo and how to run them — both globally (all workspaces at once
> via Turborepo) and per project. It replaces the ESLint + Prettier setup (ADR 063). It is
> written so that a junior developer with 6 months of experience can follow along.

---

## Table of Contents

1. [What the setup looks like (architecture)](#1-what-the-setup-looks-like-architecture)
2. [The config files — who composes who](#2-the-config-files--who-composes-who)
3. [The rules we enforce (and why)](#3-the-rules-we-enforce-and-why)
   - [3.1 Import boundaries](#31-import-boundaries)
   - [3.2 Env boundary (`process.env`)](#32-env-boundary-processenv)
   - [3.3 Runtime validation and named indices (rules/27, rules/28)](#33-runtime-validation-and-named-indices-rules27-rules28)
   - [3.4 Lint canaries](#34-lint-canaries)
4. [Per-repo exceptions](#4-per-repo-exceptions)
5. [Formatting with Oxfmt](#5-formatting-with-oxfmt)
6. [How to run them](#6-how-to-run-them)
7. [Quick reference cheat sheet](#7-quick-reference-cheat-sheet)
8. [Troubleshooting](#8-troubleshooting)
9. [Adding / changing rules](#9-adding--changing-rules)
10. [What changed from ESLint, and the known gaps](#10-what-changed-from-eslint-and-the-known-gaps)

---

## 1. What the setup looks like (architecture)

Every workspace has an `oxlint.config.ts` (`.mts` in `apps/mobile` and `packages/ui-native`, whose
`package.json` is not `"type": "module"`). Each one composes a **shared config package** so all
workspaces follow the same rules, with small, deliberate deviations per workspace.

```
packages/oxlint-config/          ← the shared config package (@workspace/oxlint-config)
├── base.js                      ← core rules applied to EVERY workspace
├── react-internal.js            ← packages/ui, packages/client, packages/api-client (React library rules)
├── next.js                      ← web + admin + merchant (react-internal + Next.js rules)
├── react-native.js              ← apps/mobile, packages/ui-native (React rules with React Native globals)
├── nestjs.js                    ← apps/api, packages/messaging's Nest code (NestJS rules)
├── import-boundaries.js         ← the import / global boundary blocks (§3.1)
├── restricted-syntax-rules.js   ← the esquery bans: casts, `unknown`/`never`, runtime typeof, `[0]` (§3.3)
├── rules/*.js                   ← the explicit rule lists, one per family (typescript, javascript, react, …)
├── plugin/                      ← the repository's own rules, loaded as the `workspace` JS plugin
├── js-plugins.js                ← where each ESLint-API plugin is loaded from, and under which name
├── compose.js                   ← composeConfigs(): how configs are combined (§2)
├── testing.js                   ← lintAsIf(): the lint-canary helper (§3.4)
└── *.d.ts                       ← declarations, so TypeScript workspaces get real types
```

Three tools do the work:

| Tool | Job | Version |
| --- | --- | --- |
| `oxlint` | The linter (Rust). Runs the native rules and the ESLint-API **JS plugins** | 1.89.0 |
| `oxlint-tsgolint` | Type-aware rules (`no-unsafe-*`, `no-floating-promises`, …) on TypeScript 7's checker | 7.0.2005 |
| `oxfmt` | The formatter (Prettier-compatible output) | 0.74.0 |

Each workspace's `lint` script is:

```bash
oxfmt --check "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}" && oxlint
```

so formatting is checked first, then the rules. `apps/docs` runs `astro sync` first (its
generated types).

**Every category is off.** The rule set is exactly the explicit lists in `rules/*.js`, translated
rule by rule from the ESLint configuration this package replaced. An oxlint upgrade that adds rules
to a category therefore never changes the gate on its own.

**Every rule is an error.** There are no warnings: `__tests__/configs.test.js` fails if any shared
config sets a rule to `warn`.

---

## 2. The config files — who composes who

```ts title="apps/web/oxlint.config.ts (shape)"
import { composeConfigs } from "@workspace/oxlint-config/compose";
import { nextJsConfig } from "@workspace/oxlint-config/next-js";

export default composeConfigs(nextJsConfig, {
	overrides: [/* this app's own blocks */],
});
```

> [!WARNING] **Never use oxlint's `extends`.** Through `extends`, oxlint 1.89 keeps an extended
> config's `rules`, `overrides`, `plugins` and `options` but **silently drops** its `env`,
> `globals`, `settings` and `ignorePatterns` (the React version, the browser globals and every
> ignore pattern vanish — verified with `--print-config`). `composeConfigs` merges explicitly and
> rejects `extends`. Its merge rules (unit-tested in `__tests__/compose.test.js`):
>
> - `plugins`: union, in first-seen order; `jsPlugins`: union by name (a later entry replaces an earlier one);
> - `categories`, `options`, `env`, `globals`, `rules`: merged key by key, the later config winning;
> - `settings`: merged per plugin key;
> - `ignorePatterns`, `overrides`: concatenated in order, so a later override wins for the same files.

| Workspace | Composes | Adds |
| --- | --- | --- |
| `apps/web`, `apps/admin`, `apps/merchant` | `nextJsConfig` | client-only widget allowlist, env boundary (admin: `e2e/**` turbo rule off) |
| `packages/client` | `react-internal` | client-only widget allowlist, env boundary |
| `packages/ui` | `react-internal` | client-only widget allowlist |
| `packages/api-client` | `react-internal` | the portable-client boundaries (`apiClientBoundaryConfigs`) |
| `apps/mobile`, `packages/ui-native` | `react-native` | text components for `no-raw-text`, mobile env boundary |
| `apps/api` | `nestjsConfig` | see [§4](#4-per-repo-exceptions) |
| `packages/messaging` | `base` | NestJS naming + backend boundary for `src/nest/**` |
| `apps/analytics-consumer` | `base` | backend boundary, env boundary, `console` allowed (`log`/`warn`/`error`) |
| `packages/shared` | `base` | zod-schema `no-unsafe-*` relaxations ([§4](#4-per-repo-exceptions)) |
| `apps/docs`, `apps/aws-infrastructure`, `packages/tokens`, `packages/tooling`, `packages/oxlint-config` | `base` | ignores (`.astro/`, `cdk.out/`) |

### `base.js` (everyone gets this)

- **Native plugins** `eslint`, `typescript`, `unicorn`, `oxc`, `import`, with the explicit lists in
  `rules/typescript.js` (TypeScript files) and `rules/javascript.js` (JavaScript files).
- **Type-aware rules** (`options.typeAware: true`): oxlint-tsgolint checks each file against its
  **nearest `tsconfig.json`** — so that tsconfig must include every file the workspace lints
  (specs and tests included). `--tsconfig` does not change this.
- **`workspace/naming-convention`** — the @typescript-eslint naming rules (rules/00): `typeLike` →
  PascalCase; variables → camelCase / PascalCase / UPPER_CASE; functions → camelCase / PascalCase;
  members → camelCase; private members require a leading `_`.
- **`workspace/restricted-syntax`** — casts (`as`, `as const`, `<T>`), `unknown` / `never` outside
  their allowed positions, `z.any()` / `z.unknown()` / `z.never()`, runtime `typeof`,
  `Array.isArray`, numeric-literal indices, hand-typed query keys, argumentless `z.custom<T>()`, and
  `organization*` identifiers (the tenancy vocabulary, ADR 062).
- **`turbo/no-undeclared-env-vars`** (eslint-plugin-turbo as a JS plugin).
- **Universal import boundaries** ([§3.1](#31-import-boundaries)).
- `reportUnusedDisableDirectives: "error"` — a stale `oxlint-disable` fails the lint (and inline
  disables are forbidden anyway, rules/00).
- **Ignore patterns** — `dist/`, `.next/`, `.turbo/`, `coverage/`, `node_modules/`, `*.config.*`,
  `*.d.ts`, `**/prisma/**` (`apps/api` re-includes its hand-written top-level `prisma/`).

### `react-internal.js` (packages/ui, packages/client, packages/api-client — and the base of `next.js`)

Everything from `base.js`, plus native `react` and `jsx-a11y`, the browser + service-worker
globals, and three ESLint-API plugins loaded as JS plugins:

| JS plugin name | Package | Why not the native rule |
| --- | --- | --- |
| `react-hooks-js/*` | eslint-plugin-react-hooks 7 | The **React Compiler** rules (`purity`, `immutability`, `preserve-manual-memoization`, `use-memo`, `static-components`, …): oxlint's native ports diverge (49 false findings on this repo where the reference reports 0) |
| `react-js/*` | eslint-plugin-react | `jsx-no-bind`, `jsx-no-leaked-render`, `no-deprecated`: options the native ports do not implement |
| `jsx-a11y-js/*` | eslint-plugin-jsx-a11y | `aria-role` (native flags `role={undefined}`) and `interactive-supports-focus` (native ignores `tabbable`) |

`settings.react.version` is the **installed** React version (`installedReactVersion()`, read from the
workspace's own `node_modules`): oxlint rejects ESLint's `"detect"`.

It also turns on `workspace/ssr-false-allowlist` with an **empty** allowlist (fails closed: decision
#58) and applies the approved rule exception ([§4](#4-per-repo-exceptions)).

### `next.js` (web + admin + merchant)

`react-internal.js` plus native `nextjs` rules and `next-js/no-location-assign-relative-destination`
(`@next/eslint-plugin-next` as a JS plugin; not ported natively).

### `react-native.js` (apps/mobile, packages/ui-native)

Everything from `base.js` (the same strict TypeScript rules), plus the same React, Hooks and React
Compiler rules as `react-internal.js`, with **React Native globals** (`__DEV__`, `fetch`,
`FormData`, timers, …) instead of the browser's; `eslint-plugin-react-native` as a JS plugin
(`no-raw-text`, `no-inline-styles`, `no-color-literals`, `no-unused-styles`,
`no-single-element-style-arrays`, `split-platform-components`); React Native **accessibility**
selectors in the same `workspace/restricted-syntax` entry (a `Pressable` needs `accessibilityRole`
and `accessibilityLabel`, …); and the mobile import boundaries. jsx-a11y is DOM-only and not loaded.

### `nestjs.js` (apps/api)

Everything from `base.js` plus `@darraghor/eslint-plugin-nestjs-typed` as the `nestjs` JS plugin
(17 rules; `nestjs/api-method-should-specify-api-response` accepts `@ZodResponse`,
`@ZodPaginatedResponse`, `@ZodRawResponse` and `@ZodFileResponse`, ADR 022), the NestJS
relaxations (`no-extraneous-class`, `no-empty-function`, `explicit-member-accessibility`,
`require-await` off; `private readonly` DI parameters without an underscore), the backend import
boundary and the API architecture boundaries (§3.1).

---

## 3. The rules we enforce (and why)

| Non-negotiable rule | How the lint enforces it |
| --- | --- |
| No `any` / `z.any` | `typescript/no-explicit-any` + type-aware `no-unsafe-*` + `workspace/restricted-syntax` |
| No `unknown` / `never` / `z.unknown` / `z.never` | `workspace/restricted-syntax` (allowed positions: catch parameters, `Record<Exclude<…>, never>`, `assertNever`) |
| No `as` casts / `as const` | `typescript/consistent-type-assertions` (`assertionStyle: "never"`) + `workspace/restricted-syntax` |
| No runtime `typeof` / `Array.isArray` / `[0]` | `workspace/restricted-syntax` (§3.3) |
| Access modifiers + return types | `typescript/explicit-member-accessibility` + `typescript/explicit-function-return-type` |
| No `console.log` in production code | `no-console` (only `warn` / `error` allowed) |
| Import only through public entry points | `workspace/restricted-imports` (§3.1) + packages' explicit `exports` |
| Server code never reaches the browser | frontend `workspace/restricted-imports` + `workspace/no-server-import-in-client-component` + `server-only` |
| Env read only through validated modules | `no-restricted-properties` on `process.env` (§3.2) |
| Backends never import frontend code | backend `workspace/restricted-imports` |

### 3.1 Import boundaries

Defined once in `packages/oxlint-config/import-boundaries.js` and enforced with
**`workspace/restricted-imports`**: a port of ESLint core's `no-restricted-imports` (`paths` and
`regex` `patterns`, identical messages — diffed against ESLint on 100 option sets, 717 reports, all
identical). Oxlint's native `no-restricted-imports` is not used: it silently ignores lookahead
regexes, which several boundary patterns need. Every boundary is an `error`.

- **Universal** (every workspace): no app → app imports; no `@workspace/<pkg>/src/…` or `/dist/…`;
  no relative climbs into another workspace; no deep `@workspace/shared/*` paths.
- **Frontend** (Next apps, `packages/client`, `packages/ui`): no `@workspace/messaging` and no
  server-only packages (`@prisma/*`, `@nestjs/*`, `bullmq`, `ioredis`, Kafka, `pg`, `bcrypt`, …);
  **frontend context boundaries**: another context's internals only through its public index.
- **Backend** (`apps/api`, `apps/analytics-consumer`, `packages/messaging`): no
  `@workspace/api-client`, `@workspace/client`, `@workspace/ui`, `@workspace/mobile`, `next`,
  `react`, `react-dom`.
- **API architecture** (`apiArchitectureBoundaryConfigs`, ADR 058): a context's `domain/` imports no
  framework or persistence; `application/` no Prisma; `presentation/` no persistence; jobs dispatch
  through `SystemCommandDispatcher`, not `CommandBus`; platform layers do not import contexts'
  internals; files left under the retired `modules/` fail.
- **API client** (`apiClientBoundaryConfigs`): the client runs in the Next apps **and** React Native
  (mobile plan §4), so no `next`, `react-dom`, `server-only`, Node built-ins, `@workspace/client`,
  `@workspace/ui`; React and TanStack Query only in `src/react/**`; no DOM-only or Node globals
  (`no-restricted-globals`) outside tests.
- **Mobile** (`mobileImportBoundaryConfig`): no web packages, Node built-ins or AsyncStorage
  (unencrypted; use Secure Store); no browser-only / Node-only globals. Node tooling (`*.cjs`) is
  exempt.

**Client Components** — `workspace/no-server-import-in-client-component` reports a *value* import of
a server-only module (`server-only`, `next/headers`, `…/env.server`, `…/server-api`, …) from a file
that starts with `"use client"`. `import type` is allowed.

Because a later override **replaces** an earlier one's options for the same rule, the frontend and
backend blocks re-state the universal patterns (`[...UNIVERSAL, ...FRONTEND]`). A workspace that sets
`workspace/restricted-imports` itself must spread the exported pattern arrays the same way.

### 3.2 Env boundary (`process.env`)

`no-restricted-properties` bans `process.env` except in the env modules that validate it:

| Workspace | Allowed files |
| --- | --- |
| Next apps | `lib/env/env.client.ts`, `lib/env/env.server.ts`, `lib/env/env.runtime.ts` (only checks `NEXT_RUNTIME`), `e2e/browser-env.e2e.ts` |
| `apps/admin` | + `e2e/env.e2e.ts` (opt-in smoke-test switch) |
| `packages/client` | `src/lib/api/config.ts` |
| `apps/api` | `src/config/api-config.ts` |
| `apps/analytics-consumer` | `src/infrastructure/env.ts` |
| `apps/mobile` | `src/lib/env.ts` |

### 3.3 Runtime validation and named indices (rules/27, rules/28)

`workspace/restricted-syntax` (selectors in `restricted-syntax-rules.js`) applies to every
TypeScript file and bans the runtime `typeof` operator in any form, `Array.isArray(x)`,
`Object.prototype.toString` tag sniffing and numeric-literal index access (`items[0]`, `match?.[1]`).
Type-position `typeof` (`z.infer<typeof Schema>`) is a different AST node and stays allowed.

**Do instead:** parse once at the trust boundary with a shared zod schema; use the zod-backed guards
in `@workspace/shared` (`isStringPrimitive`, `isArrayValue`, `isBrowserRuntime()`, …); destructure,
use `LIST_SLOT_INDEX.first`, or a named capture group. Full guides:
[rules/28-runtime-validation.md](../../../rules/28-runtime-validation.md),
[rules/27-array-index-readability.md](../../../rules/27-array-index-readability.md).

### 3.4 Lint canaries

`apps/web/__tests__/lint-boundaries.test.ts`, `packages/client/src/__tests__/lint-boundaries.test.ts`,
`apps/api/src/__tests__/lint-boundaries.spec.ts` and
`apps/analytics-consumer/src/__tests__/lint-boundaries.spec.ts` lint fixture snippets against the
workspace's **real** composed config and assert each boundary fires — and that public entry points,
Server Components and `import type` stay allowed. If a config change silently drops a boundary,
`pnpm run test` fails.

They use `lintAsIf(config, { "lib/env/env.server.ts": code })` from
`@workspace/oxlint-config/testing`: it writes the config as JSON into a fresh temp directory with
each snippet at its relative path (override globs are rooted at the config's directory, so paths
match exactly as in the workspace), runs the real `oxlint` binary there with type-aware rules off,
and returns the reported rule ids. The snippets never touch the workspace. (A config used this way
must load its JS plugins by **absolute** path — `apps/api` resolves its local plugin with
`fileURLToPath(new URL(…, import.meta.url))`.)

The shared package tests its own rules too: `RuleTester` suites for each `workspace/*` rule, the
compose rules, the presets (every rule an error, the approved exception pinned) and the
declarations (`__tests__/declarations.test.js` keeps each `.d.ts` in step with its module's exports).

---

## 4. Per-repo exceptions

### `apps/api/oxlint.config.ts`

| Override | Why |
| --- | --- |
| Re-include the top-level `prisma/` (`!/prisma/`, `!/prisma/**`) | The seed and RLS manifest are hand-written source. Anchored with `/`, so `src/prisma/` stays ignored |
| `src/prisma/**`: `typescript/no-unsafe-*` off | Prisma's generated generic chains the unsafe rules cannot resolve |
| `scripts/**`, `src/config/**`: `turbo/no-undeclared-env-vars` off | Env read at runtime; `turbo.json` does not list every key |
| `src/**` except `src/config/api-config.ts`: `no-restricted-properties` | The env boundary (§3.2) |
| Repositories, storage-queue processors and three cache/queue services: `nestjs/injectable-should-be-provided` off | Registered through spread arrays or conditionally |
| `src/common/ajv-warmup.ts`: `typescript/no-unsafe-argument` off | Walks the dynamic `apiContract` tree |
| `src/**/*.controller.ts` (not `*.probe.ts`): `api/no-unversioned-controller` | Every controller builds its path with `apiPath()` (`lint-rules/no-unversioned-controller.js`) |

The API's type-aware rules use `apps/api/tsconfig.json`, which is the **full** program (src, specs,
test, prisma, scripts, tool configs) with `noEmit`. `tsconfig.typecheck.json` is the production
program (`src/` without specs) and `tsconfig.build.json` extends it for emit; `typecheck` runs tsrs
on both programs.

### `packages/shared/oxlint.config.ts`

`src/schemas/**`: `typescript/no-unsafe-{call,member-access,assignment,argument}` off — zod v4's
generic chains (e.g. `z.iso.datetime()`) produce false positives there. Every other rule applies.

### `approvedRuleExceptions` (`packages/oxlint-config/react-internal.js`)

| File | Rules off | Why |
| --- | --- | --- |
| `packages/ui/src/components/signature-pad.tsx` | `jsx-a11y/no-noninteractive-element-interactions`, `jsx-a11y/no-noninteractive-tabindex` | The drawing area is a focusable `role="application"` with undo / redo shortcuts. WAI-ARIA allows that, but jsx-a11y classifies `application` as non-interactive |

Approved by a maintainer on 2026-10-16 as the only exception. `__tests__/configs.test.js` pins the list
and checks the rules stay errors in every other file. Adding an entry needs a maintainer's approval
and an update to that test. Inline `oxlint-disable` / `eslint-disable` stays forbidden.

---

## 5. Formatting with Oxfmt

- **`.oxfmtrc.json`** (root) holds the formatting config: tabs, print width 175, double quotes,
  trailing commas, `bracketSameLine`, LF, Tailwind class sorting (`sortTailwindcss`, reading
  `packages/ui/src/styles/globals.css`, also inside `cn()` / `cva()`), and the ignore list.
- It was migrated from the old `.prettierrc` (`oxfmt --migrate=prettier`); the output matches
  Prettier's on all but 40 of 7,057 files (line-width edge cases and one arbitrary Tailwind property
  order), which were reformatted once.
- Formatting is **not** a lint rule: the `lint` script runs `oxfmt --check` first, and `pnpm format`
  writes.

```bash
pnpm format                      # oxfmt everywhere (turbo format)
cd apps/web && pnpm format       # one workspace
```

---

## 6. How to run them

### 6.1 Globally (all workspaces)

From the **repo root**:

```bash
pnpm lint                                        # turbo lint: oxfmt --check + oxlint in every workspace
pnpm lint --filter @workspace/web                # one workspace
pnpm format                                      # oxfmt in every workspace
pnpm typecheck                                   # tsrs --noEmit in every workspace
```

Every workspace except `packages/typescript-config` (JSON only) has `lint` and `format` scripts.

### 6.2 Per project

```bash
cd apps/web && pnpm lint
cd apps/api && pnpm lint
```

### 6.3 Raw commands (inside a workspace)

`oxlint` discovers `oxlint.config.ts` in the **current working directory**, so run it from inside
the workspace:

```bash
npx oxlint                          # the whole workspace
npx oxlint src/app/page.tsx         # one file
npx oxlint --fix                    # apply safe fixes
npx oxlint --print-config           # the resolved config (useful when a rule seems missing)
npx oxlint -f json                  # machine-readable output
npx oxfmt --check "src/**/*.ts"     # check formatting of a glob
```

> [!WARNING] `oxlint` discovers `oxlint.config.ts` and `.mts` only (Node strips the types). From the
> repo root there is no config: use `pnpm lint --filter <name>` instead.

---

## 7. Quick reference cheat sheet

| What you want | Command |
| --- | --- |
| Lint everything | `pnpm lint` |
| Lint one workspace | `pnpm lint --filter @workspace/web` |
| Lint + safe fixes (inside workspace) | `npx oxlint --fix` |
| Format everything | `pnpm format` |
| Check formatting only | `npx oxfmt --check "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"` |
| Show the resolved config | `npx oxlint --print-config` |
| Typecheck everything | `pnpm typecheck` |

---

## 8. Troubleshooting

### 8.1 A type-aware rule reports `error`-typed values everywhere

tsgolint checks a file against its **nearest `tsconfig.json`**. If that tsconfig does not include
the file (a spec excluded for the build, a script outside `include`) or lacks its types
(`vitest/globals`), every value becomes `error` and the `no-unsafe-*` rules fire. Make the nearest
tsconfig cover every linted file (as `apps/api/tsconfig.json` does); do not relax the rule.

The same symptom appears when a workspace package resolves to a stale or missing `dist/`: every
tsconfig must set `customConditions: ["development"]`
(`packages/tooling/__tests__/tsconfig-conditions.test.mjs` checks it).

### 8.2 A rule set in a shared config does not apply

Check the workspace composes with `composeConfigs`, not `extends` (§2), then run
`npx oxlint --print-config`.

### 8.3 False-positive `no-unsafe-*` on Prisma / zod code

Add the file pattern to the workspace's existing `no-unsafe-*` override (§4). Never an inline
`oxlint-disable`.

### 8.4 Formatting errors

Run `pnpm format` (or `npx oxfmt <file>` inside the workspace).

### 8.5 New files are not linted

Check the ignore patterns in `base.js` (§2). `ignorePatterns` follow `.gitignore` semantics: anchor
with a leading `/` to mean "at this workspace's root".

---

## 9. Adding / changing rules

1. **Every workspace** → the right family list in `packages/oxlint-config/rules/*.js` (or a
   selector in `restricted-syntax-rules.js`).
2. **React code** → `react-internal.js` (applies to the Next apps too); **only the Next apps** →
   `next.js`; **the API** → `nestjs.js`.
3. **One workspace** → an override in that workspace's `oxlint.config.ts`.
4. **A new repository rule** → `plugin/<rule>.js`, registered in `plugin/index.js`, with a
   `RuleTester` suite in `__tests__/`.
5. Severity is always `"error"`. A rule from an ESLint-API plugin is added to `js-plugins.js` and
   named with a `-js` suffix when it shadows a native plugin name (`react-js`, `jsx-a11y-js`).

---

## 10. What changed from ESLint, and the known gaps

The ESLint configuration was translated rule by rule from its **effective** config
(`eslint --print-config` per workspace): 290 enabled rules, every one mapped or explicitly dropped.

| ESLint piece | Now |
| --- | --- |
| `prettier/prettier` | `oxfmt --check` in the `lint` script |
| `@typescript-eslint/*` (strict + stylistic type-checked) | native `typescript/*` + oxlint-tsgolint |
| `@typescript-eslint/naming-convention` | `workspace/naming-convention` (a port, byte-identical reports on this repo) |
| `no-restricted-syntax` | `workspace/restricted-syntax` |
| `no-restricted-imports` | `workspace/restricted-imports` (§3.1) |
| `react/jsx-uses-vars` | not needed: native `no-unused-vars` understands JSX (verified) |
| `no-octal`, `no-dupe-args` | reported by the oxc parser as syntax errors (verified) |
| `settings.react.version: "detect"` | `installedReactVersion()` |

**Known gaps** (no oxlint equivalent today; each verified not to matter in this repository):

| Rule | Why it is safe for now |
| --- | --- |
| `@typescript-eslint/no-unsafe-enum-assignment` | Not in tsgolint. The repository has no TypeScript `enum` (unions everywhere) |
| `@darraghor/nestjs-typed`: `all-properties-have-explicit-defined`, `api-enum-property-best-practices`, `validated-non-primitive-property-needs-type-decorator` | They need ESLint parser services. They check class-validator / `@ApiProperty` DTOs; the API documents and validates through nestjs-zod and has none |

`@darraghor/eslint-plugin-nestjs-typed` still runs on `@typescript-eslint/utils`, which needs the
TypeScript 6 JS API; `pnpm-workspace.yaml` gives it TypeScript 6.0.3 as a dependency until it supports
TypeScript 7.

---

_Last updated: October 25, 2026_
