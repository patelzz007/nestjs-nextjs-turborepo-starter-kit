---
title: "ESLint Setup & How To Run It"
tags: ["eslint", "linting", "tooling", "import-boundaries"]
description: "How ESLint is configured repo-wide and how to run it — both globally (via Turborepo) and per project."
order: 6
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# ESLint Setup & How To Run It

> [!NOTE] This document explains how ESLint is configured across the entire monorepo and
> how to run it — both globally (all workspaces at once via Turborepo) and per project.
> It is written so that even a junior developer with 6 months of experience can
> follow along.

---

## Table of Contents

1. [What the setup looks like (architecture)](#1-what-the-setup-looks-like-architecture)
2. [The config files — who extends who](#2-the-config-files--who-extends-who)
3. [The rules we enforce (and why)](#3-the-rules-we-enforce-and-why)
   - [3.1 Import boundaries](#31-import-boundaries)
   - [3.2 Env boundary (`process.env`)](#32-env-boundary-processenv)
   - [3.3 Lint canaries](#33-lint-canaries)
4. [Per-repo exceptions](#4-per-repo-exceptions)
5. [Prettier integration](#5-prettier-integration)
6. [How to run ESLint](#6-how-to-run-eslint)
   - [6.1 Globally (all workspaces)](#61-globally-all-workspaces)
   - [6.2 Per project](#62-per-project)
   - [6.3 Raw ESLint commands](#63-raw-eslint-commands)
   - [6.4 Auto-fixing](#64-auto-fixing)
7. [Quick reference cheat sheet](#7-quick-reference-cheat-sheet)
8. [Troubleshooting](#8-troubleshooting)
9. [Adding / changing rules](#9-adding--changing-rules)

---

## 1. What the setup looks like (architecture)

ESLint uses the **flat config** format (`eslint.config.js` at the root of every
workspace). We use a **shared config package** so all repos follow the exact same
rules — with small, deliberate deviations per repo.

```
packages/eslint-config/          ← the shared config package (@workspace/eslint-config)
├── base.js                      ← core rules applied to EVERY repo
├── next.js                      ← web + admin + merchant (react-internal.js + Next.js rules)
├── react-internal.js            ← packages/ui + packages/client (React library rules)
├── nestjs.js                    ← apps/api (NestJS + DI-friendly rules)
└── import-boundaries.js         ← import-boundary patterns + the local `workspace-boundaries` rule
                                   (imported by base / next / react-internal / nestjs; also exported as
                                   `@workspace/eslint-config/import-boundaries` for the Node workers)
```

Each workspace's own `eslint.config.js` simply imports one of the above:

| Workspace         | `eslint.config.js` imports         | Shared config used                        |
| ----------------- | ---------------------------------- | ----------------------------------------- |
| `apps/web`        | `nextJsConfig` (+ env boundary)    | `@workspace/eslint-config/next-js`        |
| `apps/admin`      | `nextJsConfig` (+ env boundary)    | `@workspace/eslint-config/next-js`        |
| `apps/merchant`   | `nextJsConfig` (+ env boundary)    | `@workspace/eslint-config/next-js`        |
| `packages/client` | `config` (+ env boundary)          | `@workspace/eslint-config/react-internal` |
| `apps/api`        | `nestjsConfig` (+ local overrides) | `@workspace/eslint-config/nestjs`         |
| `packages/ui`     | `config`                           | `@workspace/eslint-config/react-internal` |
| `packages/shared` | `baseConfig` (+ Zod exception)     | `@workspace/eslint-config/base`           |

The package `packages/eslint-config/package.json` maps these import paths:

```json title="packages/eslint-config/package.json"
{
	"exports": {
		"./base": "./base.js",
		"./next-js": "./next.js",
		"./react-internal": "./react-internal.js",
		"./nestjs": "./nestjs.js"
	}
}
```

> [!NOTE] **Note:** `apps/api` also declares `ignores: ["**/*.spec.ts", "**/*.test.ts"]`
> and a couple of local overrides — see [Section 4](#4-per-repo-exceptions).

---

## 2. The config files — who extends who

### `base.js` (everyone gets this)

This is the heart of the setup. It stacks these layers, in order:

1. **`@eslint/js` recommended** — baseline JavaScript correctness rules.
2. **`eslint-config-prettier`** — turns OFF all rules that conflict with Prettier,
   so Prettier is the single source of truth for formatting.
3. **`typescript-eslint` strict type-checked rules** (`strictTypeChecked`) —
   catches null/undefined misuse, unsafe access, promise mishandling, and type
   narrowing gaps. Requires `projectService: true` so each workspace uses its own
   `tsconfig.json` for type information.
4. **`typescript-eslint` stylistic type-checked rules** (`stylisticTypeChecked`) —
   consistent type style (prefer interfaces, explicit `void` returns, no `{}` type).
5. **Import rules** (`eslint-plugin-import`) — no duplicate imports, imports
   first (ordering is left to Prettier). Plus the **universal import
   boundaries** (`no-restricted-imports`): no app → app imports, no reaching into
   a package's `src/`/`dist/`, no relative climbs into another workspace, no deep
   `@workspace/shared/*` paths. See [3.1 Import boundaries](#31-import-boundaries).
6. **Naming conventions** (`@typescript-eslint/naming-convention`) — `typeLike` →
   PascalCase, variables → camelCase/PascalCase/UPPER_CASE, functions → camelCase/PascalCase,
   class members → camelCase, private members require leading `_`.
7. **Safety & quality rules** —
   - `eqeqeq` (`===`/`!==`, but `== null` / `!= null` is allowed for null-checks)
   - `no-unused-vars` (prefix with `_` to ignore)
   - `no-console` (warning — use a logger instead)
   - `no-debugger`, `no-empty`, `require-await`
   - `@typescript-eslint/no-unnecessary-condition`, `no-unnecessary-boolean-literal-compare`,
     `no-inferrable-types`, `prefer-readonly`, `return-await`
8. **Type assertion ban** — `@typescript-eslint/consistent-type-assertions` with
   `assertionStyle: "never"`, plus `no-restricted-syntax` selectors that also ban
   `as const` / `<const>` (the assertion rule exempts them) and `z.any()` /
   `z.unknown()` / `z.never()`. Declare literal types explicitly instead: a typed tuple
   (`const SIZES: readonly ["sm", "md"] = ["sm", "md"]`), an explicit union, or
   `satisfies`. For CSS custom properties use a typed variable
   (`React.CSSProperties & Record<\`--${string}\`, string>`) instead of `as`.
9. **Explicit typing rules** —
   - `@typescript-eslint/no-explicit-any` → **error**
   - `@typescript-eslint/explicit-function-return-type` → **error**
   - `@typescript-eslint/explicit-member-accessibility` → **error**
10. **Turbo plugin** — `turbo/no-undeclared-env-vars` warns about env vars used but
    not declared in `turbo.json`.
11. **Prettier plugin** — `prettier/prettier` as an **error**, configured with
    `usePrettierrc: true` so it reads the root `.prettierrc`.
12. **Global ignore patterns** — `dist/`, `.next/`, `.turbo/`, `coverage/`,
    `node_modules/`, `*.config.*`, `*.d.ts`, `prisma/`. (`apps/api` re-includes its hand-written
    `prisma/**/*.ts` seed and RLS manifest — see [Per-repo exceptions](#4-per-repo-exceptions).)

### `react-internal.js` (packages/ui, packages/client — and the base of `next.js`)

Everything from `base.js`, plus:

- **Frontend import boundaries** — the universal patterns plus a ban on
  server-only packages, and the `workspace-boundaries/no-server-import-in-client-component`
  rule (see [3.1](#31-import-boundaries))

- `eslint-plugin-react` (recommended + jsx-runtime), browser/serviceworker globals
- `react-hooks` recommended rules
- `jsx-a11y` recommended (alt-text, aria-role enforced; some relaxed for shadcn patterns)
- Extra React rules: `jsx-no-leaked-render`, `jsx-no-bind`, `jsx-key`,
  `no-unstable-nested-components`, `no-array-index-key`

### `next.js` (web + admin + merchant)

Spreads `react-internal.js` (so the Next apps and the React libraries cannot drift apart) and adds
only the Next-specific part:

- `@next/eslint-plugin-next` (recommended + core-web-vitals)
- `react/require-default-props` off (TypeScript handles optional props)

### `nestjs.js` (apps/api)

Everything from `base.js` plus:

- **`@darraghor/eslint-plugin-nestjs-typed`** `flatRecommended` — NestJS-specific
  rule set (controllers/services/providers, API property optionality, etc.).
  `api-method-should-specify-api-response` stays an error and also accepts the
  `@ZodResponse` / `@ZodPaginatedResponse` / `@ZodRawResponse` decorators via
  `additionalCustomApiResponseDecorators`. They document the responses in
  Swagger from the shared contract
  ([ADR 022](../../adr/022-response-contracts.md)).
- Relaxations needed for NestJS conventions:
  - `explicit-member-accessibility` off (DI constructor params like
    `private readonly prismaService` are the standard NestJS style — enforced by
    convention, not lint)
  - `require-await` off (interface implementations may not need `await`)
  - `no-extraneous-class` off (DTOs extend `createZodDto(...)`)
  - `no-unused-vars` allows `_`-prefixed args (DI tokens)
  - naming-convention keeps `private readonly x` without underscore
- **Backend import boundaries** (`backendImportBoundaryConfig`) — see
  [3.1](#31-import-boundaries): no `@workspace/client`, `@workspace/ui`, `next`,
  `react`, `react-dom` (or their subpaths) in a Node backend.

---

## 3. The rules we enforce (and why)

These are the **non-negotiable** project rules and how ESLint enforces them:

| Non-negotiable rule                        | How ESLint enforces it                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| No `any` / `z.any`                         | `no-explicit-any` = error + `strictTypeChecked` (`no-unsafe-*`)             |
| No `unknown` / `z.unknown`                 | `strictTypeChecked` rules flag unsafe `unknown` usage                       |
| No `never` / `z.never`                     | `no-unnecessary-condition` + `strictTypeChecked`                            |
| No type casting / `as Type` / `as const`   | `consistent-type-assertions` (`assertionStyle: "never"`) + `no-restricted-syntax` (`as const`, `<const>`, `z.any/unknown/never`) |
| Avoid `typeof`, infer from Zod             | `strictTypeChecked` + code review; types come from `z.infer<>`              |
| Use generic types (priority 0)             | `stylisticTypeChecked` + code review                                        |
| Always add access modifiers + return types | `explicit-member-accessibility` + `explicit-function-return-type` = error   |
| No `console.log` in production code        | `no-console` = warn (use a logger)                                          |
| Strict equality                            | `eqeqeq` = error (except `== null` null-checks)                             |
| Import only through public entry points    | `no-restricted-imports` patterns (below) + packages' explicit `exports`      |
| Server code never reaches the browser      | frontend `no-restricted-imports` + `workspace-boundaries/*` + `server-only`  |
| Env read only through validated modules    | `no-restricted-properties` on `process.env` (apps, analytics-consumer, api `src/**`, packages/client) |
| Backends never import frontend code        | backend `no-restricted-imports` (`nestjs.js`, analytics-consumer)            |

### 3.1 Import boundaries

Defined once in `packages/eslint-config/import-boundaries.js` and enforced with
ESLint core `no-restricted-imports` (`regex` patterns) plus one small local rule,
so no extra plugin is installed. Every rule is `error`.

**Universal** (every workspace, via `base.js`):

| Pattern                                              | Why                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `@workspace/{web,admin,merchant,api,docs,…}`          | Apps are deployment units, never libraries. Share code through a `packages/*` workspace.    |
| `@workspace/<pkg>/src/…`, `@workspace/<pkg>/dist/…`   | Internals are private. Import the package's `exports` entry points.                         |
| `../../packages/…`, `../../apps/…` (relative climbs)  | Same boundary, bypassed with a relative path.                                               |
| `@workspace/shared/…` (any subpath)                   | `@workspace/shared` has a single public entry point — add the symbol to its barrel instead. |

**Frontend** (`next.js` and `react-internal.js` — the Next apps, `packages/client`,
`packages/ui`) adds:

| Pattern                                                                               | Why                                                        |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `@workspace/messaging`                                                                 | Node-only (Kafka / BullMQ / Redis clients).                |
| `@prisma/*`, `prisma`, `@nestjs/*`, `bullmq`, `ioredis`, `@confluentinc/kafka-javascript`, `kafkajs`, `amqplib`, `pg`, `bcrypt` | Server-only dependencies; the browser talks to the API. |

**Backend** (`nestjs.js` → `apps/api`; also `apps/analytics-consumer` via
`@workspace/eslint-config/import-boundaries`) adds:

| Pattern                                          | Why                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `@workspace/client`, `@workspace/ui` (+ subpaths) | Frontend-only (browser API client, React components). Share contracts via `@workspace/shared`. |
| `next`, `react`, `react-dom` (+ subpaths)         | Frontend runtime; a Node backend never renders React or runs Next.js.                  |

`packages/shared` no longer depends on the Node-only `@workspace/messaging`
(nothing in it imported the package), so the shared package stays safe for
both sides.

**Client Components** — `workspace-boundaries/no-server-import-in-client-component`
reports a *value* import of a server-only module from any file that starts with
`"use client"`. Server-only is detected by specifier: `server-only`,
`next/headers`, and the naming convention `…/env.server`, `…/server`,
`…/auth-server`, `…-server-api`, `…/server-api`, `…/server-request`.
`import type` is allowed (erased at build). Lint only sees direct imports; a
server module that starts with `import "server-only"` also makes `next build`
fail on transitive imports.

Because a later flat-config block **replaces** an earlier block's
`no-restricted-imports` options, the frontend and backend blocks re-state the
universal patterns (`[...UNIVERSAL, ...FRONTEND]`, `[...UNIVERSAL, ...BACKEND]`). If a workspace config ever sets
`no-restricted-imports` itself, spread the exported pattern arrays the same way
instead of overriding them.

The matching **public entry points**: `@workspace/client` now lists every public
module explicitly in `package.json#exports` (no `./lib/*` wildcard), the apps'
`tsconfig.json` no longer maps `@workspace/{client,ui,shared}/*` to `src/*`, and
vitest configs no longer alias around `exports` — TypeScript, Turbopack and
Vitest all resolve through the same `exports` map. To make a new module public,
add an explicit `exports` entry (a deliberate API decision), never a path alias.

### 3.2 Env boundary (`process.env`)

`no-restricted-properties` bans `process.env` in `apps/web`, `apps/admin`,
`apps/merchant`, `packages/client`, `apps/api/src/**` and
`apps/analytics-consumer/src/**`, except in the env modules that validate it:

| Workspace                 | Allowed files                                                   |
| ------------------------- | --------------------------------------------------------------- |
| Next apps                 | `lib/env/env.client.ts`, `lib/env/env.server.ts`, `lib/env/env.runtime.ts` (only checks `NEXT_RUNTIME`) |
| `apps/admin`              | + `e2e/env.e2e.ts` (opt-in smoke-test switch)                   |
| `packages/client`         | `src/lib/api/config.ts`                                         |
| `apps/api`                | `src/config/api-config.ts` (scripts/, prisma/ and test/ are outside `src/**`) |
| `apps/analytics-consumer` | `src/env.ts`                                                    |

Everything else imports `clientEnv` / `serverEnv` (Next), injects
`TypedConfigService` (API) or calls `loadConsumerEnv()` (consumer). See
[Configuration](../configuration/frontend.md) and [API Configuration](../configuration/api.md). (`next.config.ts` and
`vitest.config.ts` are build-tool files and are globally ignored by `base.js`.)

### 3.3 Lint canaries

`apps/web/eslint-boundaries.test.ts`, `packages/client/src/eslint-boundaries.test.ts`,
`apps/api/src/eslint-boundaries.spec.ts` and `apps/analytics-consumer/src/eslint-boundaries.spec.ts`
lint fixture snippets against the workspace's **real** effective config (only the
boundary rules run, via `ruleFilter`) and assert each boundary fires — and that
public entry points, Server Components and `import type` stay allowed. If a config
change silently drops a boundary, `pnpm run test` fails.

---

## 4. Per-repo exceptions

### `apps/api/eslint.config.js`

```js
export default [
	{ ignores: ["eslint-rules/**"] },
	...nestjsConfig,

	// 1. Un-ignore the hand-written Prisma seed + RLS manifest (base.js ignores `**/prisma/**`).
	//    Must come AFTER the spread: a negated ignore only re-includes what an earlier object ignored.
	{ ignores: ["!prisma/", "!prisma/**/", "!prisma/**/*.ts"] },

	// 2. Specs, test/**, prisma/** and source-graph scripts are outside tsconfig.json,
	//    so they are parsed with the strict program `typecheck` also runs.
	{
		files: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**/*.ts", "test/**/*.ts", "prisma/**/*.ts", "scripts/render-email-previews.ts"],
		languageOptions: {
			parserOptions: { project: "./tsconfig.check.json", tsconfigRootDir: import.meta.dirname, projectService: false },
		},
	},

	// 3. Relax no-unsafe-* for runtime-type patterns (Prisma / Zod / Fastify)
	{
		files: [
			"src/prisma/**/*.ts",
			"src/modules/**/*.ts",
			"src/common/**/*.ts",
			"src/common/guards/**/*.ts",
			"src/common/interceptors/**/*.ts",
			"src/common/middleware/**/*.ts",
			"src/app.controller.ts",
			"src/main.ts",
			"src/common/dto/**/*.ts",
			"src/common/services/**/*.ts",
			"src/main.ts",
		],
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},
];
```

Test code is linted exactly like production code (spec files, e2e specs, test support, the Prisma
seed): the only spec-specific allowance is the one in `rules/13-ci-cd-and-quality-gates.md`.

> [!NOTE] **Why?** Prisma's complex generic chains, Zod v4 schema metafields (`.meta()`), and
> dynamic Fastify middleware patterns cannot be fully resolved by `strictTypeChecked`,
> which produces false-positive `no-unsafe-*` errors. These are validated at runtime
> by the libraries themselves, so they're relaxed **only** for those file patterns.

The API config also adds (tightening, not relaxing) the env boundary: a
`no-restricted-properties` ban on `process.env` for `src/**/*.ts` except
`src/config/api-config.ts` — see [3.2](#32-env-boundary-processenv).

### `packages/shared/eslint.config.js`

```js
export default [
	...baseConfig,
	{
		files: ["src/schemas/**/*.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
		},
	},
];
```

> [!NOTE] **Why?** Zod v4 uses extremely complex generic type chains (e.g. `z.iso.datetime()`)
> that `strictTypeChecked` cannot resolve, producing false positives. Relaxed only for
> `src/schemas/**` — the non-negotiable rules (no `any`, explicit return types, etc.)
> still apply everywhere.

---

## 5. Prettier integration

ESLint and Prettier work together in this repo:

- **`.prettierrc`** (root) holds the formatting config — tabs, 175 print width,
  `prettier-plugin-tailwindcss` for class sorting.
- ESLint runs **`prettier/prettier` as an error** and reads `.prettierrc` via
  `usePrettierrc: true`. This means formatting violations are reported by ESLint.
- `eslint-config-prettier` is loaded early in `base.js` to **turn off** any ESLint
  rules that would fight with Prettier (e.g. `quotes`, `semi`, `max-len`).

So you have two equivalent ways to fix formatting:

```bash
pnpm format                # prettier --write everywhere
npx eslint --fix .         # ESLint auto-fixes, including prettier/prettier violations
```

---

## 6. How to run ESLint

### 6.1 Globally (all workspaces)

From the **repo root**:

```bash
pnpm lint
```

This runs `turbo lint`, which executes the `lint` script in **every workspace that
has one** (web, admin, api, ui).

> [!WARNING] **Important:** `packages/shared` does **not** have a `lint` script in its
> `package.json`, so `pnpm lint` skips it. To lint shared, run it directly —
> see [Section 6.2](#62-per-project).

Other useful global commands (from root):

```bash
pnpm lint       --filter @workspace/web --filter @workspace/admin   # only specific workspaces
pnpm format                                    # prettier --write everywhere (see note below)
pnpm typecheck                                 # tsc --noEmit everywhere
```

> [!WARNING] Like `pnpm lint`, `pnpm format` only reaches workspaces that define a `format`
> script (web, admin, api, ui). `packages/shared` has **no** `format` script either —
> format it directly: `cd packages/shared && npx prettier --write "src/**/*.ts"`.

> [!NOTE] **Caching is disabled** for lint/format/typecheck/build/dev in `turbo.json`
> (`"cache": false`), so every run is always fresh — you'll never see stale results.

### 6.2 Per project

**Option A — Turbo filter (from root):**

```bash
pnpm lint --filter @workspace/web     # lint apps/web only
pnpm lint --filter @workspace/admin   # lint apps/admin only
pnpm lint --filter @workspace/api     # lint apps/api only
pnpm lint --filter @workspace/ui  # lint packages/ui only
```

**Option B — inside the workspace directory:**

```bash
cd apps/web && pnpm lint
cd apps/admin && pnpm lint
cd apps/api && pnpm lint
cd packages/ui && pnpm lint
```

**Option C — packages/shared (no lint script, run ESLint directly):**

```bash
cd packages/shared && npx eslint src
```

or without `cd`, using pnpm to run the command inside the workspace:

```bash
pnpm --filter @workspace/shared exec eslint src
```

> [!NOTE] **Why can't I just run `npx eslint packages/shared/src` from the root?**
> The repo root does **not** have its own `eslint.config.js` — only each workspace does.
> ESLint flat config looks for the config relative to the **current working directory**,
> not the files being linted, so running from root fails with
> `ESLint couldn't find an eslint.config.(js|mjs|cjs) file`. Always `cd` into the
> workspace first (or use `pnpm --filter <name> exec`).

### 6.3 Raw ESLint commands

If you want more control, run `eslint` directly **from inside the workspace directory** (each workspace has its own `eslint.config.js`; the repo root does not):

```bash
npx eslint .                                # lint the whole workspace (respects .gitignore + config ignores)
npx eslint src                              # lint a folder
npx eslint "src/**/*.{ts,tsx}"              # lint a glob of files
npx eslint src/app/page.tsx                 # lint a single file
npx eslint --no-cache .                     # bypass ESLint's cache
npx eslint --no-ignore src                  # ALSO lint ignored files (dist, d.ts, prisma) — usually not what you want
npx eslint --fix .                          # auto-fix everything fixable
npx eslint --max-warnings 0 .               # fail CI if there are any warnings
```

> [!WARNING] **Flat config caveat:** ESLint loads `eslint.config.js` based on the current
> working directory, so you must run these commands from inside the workspace
> (e.g. `cd apps/web`). There is **no root config file** — `npx eslint apps/web/...`
> from the repo root will fail. If you're at the root, use `pnpm lint --filter <name>`
> or `pnpm --filter <name> exec eslint <path>` instead.

### 6.4 Auto-fixing

Most rules (import ordering, prettier, quotes, unused vars, naming) are auto-fixable:

```bash
# Fix everything in one workspace
cd apps/web && npx eslint --fix .

# Fix everything in the whole repo — run the same command in each workspace:
# (web already shown above, then admin, api, ui, shared)
cd apps/admin && npx eslint --fix .
cd apps/api && npx eslint --fix .
cd packages/ui && npx eslint --fix .
cd packages/shared && npx eslint --fix src
```

> [!WARNING] The all-in-one `npx eslint --fix apps/web apps/admin ...` from the root will NOT
> work — there is no root config (see the flat-config caveat in [Section 6.3](#63-raw-eslint-commands)).

Always re-run the check afterward to confirm 0 problems:

```bash
npx eslint .      # should end with "✖ 0 problems (0 errors, 0 warnings)"
```

---

## 7. Quick reference cheat sheet

| What you want                          | Command                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Lint everything                        | `pnpm lint`                                                                                                            |
| Lint one workspace                     | `pnpm lint --filter @workspace/web` (or `@workspace/admin` / `@workspace/api` / `@workspace/ui` / `@workspace/client`) |
| Lint shared (no script)                | `cd packages/shared && npx eslint src` (or `pnpm --filter @workspace/shared exec eslint src`)                          |
| Lint + auto-fix (inside workspace)     | `npx eslint --fix .`                                                                                                   |
| Format with Prettier                   | `pnpm format`                                                                                                          |
| Typecheck everything                   | `pnpm typecheck`                                                                                                       |
| Fail on any warning (inside workspace) | `npx eslint --max-warnings 0 .`                                                                                        |
| Bypass cache (inside workspace)        | `npx eslint --no-cache .`                                                                                              |

> [!WARNING] Rows that run raw `npx eslint` must be executed **from inside a workspace**
> (each workspace has its own `eslint.config.js`; the repo root does not).
> Commands starting with `pnpm` are run from the repo root.

---

## 8. Troubleshooting

### 8.1 "ESLint couldn't find an eslint.config.(js|mjs|cjs) file"

You ran ESLint from a directory that has no `eslint.config.js` — usually the repo
root. Flat config resolves the config from the **current working directory**.
`cd` into the workspace (or use `pnpm lint --filter <name>`), then re-run.

### 8.2 "Cannot resolve parserOptions.project" / file not part of the project

Type-checked rules need a file to be part of the nearest `tsconfig.json`. If a file
is intentionally **not** in `tsconfig.json` (e.g. spec files), add it to the
`projectService.allowDefaultProject` list in the workspace's `eslint.config.js`
(see the api config in [Section 4](#4-per-repo-exceptions)).

### 8.3 False-positive `no-unsafe-*` errors on Prisma / Zod / Fastify code

These are false positives from `strictTypeChecked` on dynamic library code. Add the
file pattern to the workspace's existing `no-unsafe-*` override block (see
[Section 4](#4-per-repo-exceptions)). Do **not** sprinkle `// eslint-disable` comments.

### 8.4 "prettier/prettier" errors

Run `npx eslint --fix .` or `pnpm format`. If it still fails, your file deviates
from `.prettierrc` in a non-auto-fixable way — check manually.

### 8.5 New files are ignored / not linted

Check the ignore patterns in `base.js` (`dist/`, `.next/`, `*.config.*`, `*.d.ts`,
`prisma/`, etc.). If your file genuinely shouldn't be linted, that's expected.

### 8.6 ESLint is slow on the api workspace

Type-checked rules run the TypeScript compiler. `projectService: true` caches the
project, so the second run is much faster. Use `--no-cache` only when you suspect
stale results.

---

## 9. Adding / changing rules

1. **Rule that should apply to every repo** → edit `packages/eslint-config/base.js`.
2. **Rule only for React code** → edit `packages/eslint-config/react-internal.js` (applies to
   the Next apps too); a rule only for the Next apps goes in `next.js`.
3. **Rule only for the API** → edit `packages/eslint-config/nestjs.js`.
4. **Rule only for one workspace** → add an override block in that workspace's
   `eslint.config.js`.
5. After changing config, **restart your editor** (or the ESLint server) so the new
   rules load, then re-run the linter.

To verify a rule works as expected (remember: run from inside the workspace):

```bash
cd packages/ui && npx eslint src/components/form/button.tsx
```

---

_Last updated: July 31, 2026_
