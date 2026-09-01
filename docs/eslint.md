---
title: "ESLint Setup & How To Run It"
tags: ["eslint", "linting", "tooling"]
description: "How ESLint is configured repo-wide and how to run it — both globally (via Turborepo) and per project."
order: 6
author: "Acme Inc."
lastUpdated: 1785628800000
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
├── next.js                      ← web + admin (adds React / Hooks / a11y / Next.js rules)
├── react-internal.js            ← packages/ui (React library rules)
└── nestjs.js                    ← apps/api (NestJS + DI-friendly rules)
```

Each workspace's own `eslint.config.js` simply imports one of the above:

| Workspace         | `eslint.config.js` imports         | Shared config used                        |
| ----------------- | ---------------------------------- | ----------------------------------------- |
| `apps/web`        | `nextJsConfig`                     | `@workspace/eslint-config/next-js`        |
| `apps/admin`      | `nextJsConfig`                     | `@workspace/eslint-config/next-js`        |
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
5. **Import rules** (`eslint-plugin-import`) — enforced import ordering
   (builtin → external → internal → parent → sibling → index), no duplicate imports,
   imports first, newline after imports.
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
   `assertionStyle: "never"`. `as const` is automatically exempt (it is not a type
   cast — it narrows literals). For CSS custom properties use the
   `satisfies React.CSSProperties & Record<string, string>` pattern instead of `as`.
9. **Explicit typing rules** —
   - `@typescript-eslint/no-explicit-any` → **error**
   - `@typescript-eslint/explicit-function-return-type` → **error**
   - `@typescript-eslint/explicit-member-accessibility` → **error**
10. **Turbo plugin** — `turbo/no-undeclared-env-vars` warns about env vars used but
    not declared in `turbo.json`.
11. **Prettier plugin** — `prettier/prettier` as an **error**, configured with
    `usePrettierrc: true` so it reads the root `.prettierrc`.
12. **Global ignore patterns** — `dist/`, `.next/`, `.turbo/`, `coverage/`,
    `node_modules/`, `*.config.*`, `*.d.ts`, `prisma/`.

### `next.js` (web + admin)

Everything from `base.js`, plus:

- `eslint-plugin-react` (recommended + jsx-runtime), browser/serviceworker globals
- `react-hooks` recommended rules
- `jsx-a11y` recommended (alt-text, aria-role enforced; some relaxed for shadcn patterns)
- `@next/eslint-plugin-next` (recommended + core-web-vitals)
- Extra React rules: `jsx-no-leaked-render`, `jsx-no-bind`, `jsx-key`,
  `no-unstable-nested-components`, `no-array-index-key` (warn)

### `react-internal.js` (packages/ui)

Everything from `base.js` plus the same React / hooks / a11y rules as `next.js`
**without** the Next.js-specific rules.

### `nestjs.js` (apps/api)

Everything from `base.js` plus:

- **`@darraghor/eslint-plugin-nestjs-typed`** `flatRecommended` — NestJS-specific
  rule set (controllers/services/providers, API property optionality, etc.)
- Relaxations needed for NestJS conventions:
  - `explicit-member-accessibility` off (DI constructor params like
    `private readonly prismaService` are the standard NestJS style — enforced by
    convention, not lint)
  - `require-await` off (interface implementations may not need `await`)
  - `no-extraneous-class` off (DTOs extend `createZodDto(...)`)
  - `no-unused-vars` allows `_`-prefixed args (DI tokens)
  - naming-convention keeps `private readonly x` without underscore

---

## 3. The rules we enforce (and why)

These are the **non-negotiable** project rules and how ESLint enforces them:

| Non-negotiable rule                        | How ESLint enforces it                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| No `any` / `z.any`                         | `no-explicit-any` = error + `strictTypeChecked` (`no-unsafe-*`)             |
| No `unknown` / `z.unknown`                 | `strictTypeChecked` rules flag unsafe `unknown` usage                       |
| No `never` / `z.never`                     | `no-unnecessary-condition` + `strictTypeChecked`                            |
| No type casting / `as Type`                | `consistent-type-assertions` (`assertionStyle: "never"`; `as const` exempt) |
| Avoid `typeof`, infer from Zod             | `strictTypeChecked` + code review; types come from `z.infer<>`              |
| Use generic types (priority 0)             | `stylisticTypeChecked` + code review                                        |
| Always add access modifiers + return types | `explicit-member-accessibility` + `explicit-function-return-type` = error   |
| No `console.log` in production code        | `no-console` = warn (use a logger)                                          |
| Strict equality                            | `eqeqeq` = error (except `== null` null-checks)                             |

---

## 4. Per-repo exceptions

### `apps/api/eslint.config.js`

```js
export default [
	// 1. Skip test files entirely
	{ ignores: ["**/*.spec.ts", "**/*.test.ts"] },
	...nestjsConfig,

	// 2. Allow spec files that aren't in tsconfig.json
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["src/modules/auth/*.spec.ts"],
				},
			},
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

> [!NOTE] **Why?** Prisma's complex generic chains, Zod v4 schema metafields (`.meta()`), and
> dynamic Fastify middleware patterns cannot be fully resolved by `strictTypeChecked`,
> which produces false-positive `no-unsafe-*` errors. These are validated at runtime
> by the libraries themselves, so they're relaxed **only** for those file patterns.

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
2. **Rule only for React apps** → edit `packages/eslint-config/next.js` or
   `react-internal.js`.
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
