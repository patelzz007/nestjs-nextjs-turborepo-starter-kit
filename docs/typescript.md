---
title: "TypeScript Configs & How To Use Them"
description: "How TypeScript is configured across the monorepo via the shared @workspace/typescript-config package."
order: 5
author: "Acme Inc."
lastUpdated: "2026-08-02"
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80"
---

# TypeScript Configs & How To Use Them

> [!NOTE] This document explains how TypeScript is configured across the monorepo: the shared
> `@workspace/typescript-config` package, the four base configs it ships, and how each
> workspace (`@workspace/web`, `@workspace/admin`, `@workspace/api`, `@workspace/ui`,
> `@workspace/client`, `@workspace/shared`) extends them. Written for a junior developer
> with 6 months of experience.

---

## Table of Contents

1. [How it fits together (architecture)](#1-how-it-fits-together-architecture)
2. [The base configs](#2-the-base-configs)
3. [How each workspace extends them](#3-how-each-workspace-extends-them)
4. [Path aliases](#4-path-aliases)
5. [Typechecking the repo](#5-typechecking-the-repo)
6. [Common tasks & gotchas](#6-common-tasks--gotchas)
7. [Adding / changing configs](#7-adding--changing-configs)

---

## 1. How it fits together (architecture)

All TypeScript configs live in a single shared package:

```
packages/typescript-config/
├── package.json            ← @workspace/typescript-config
├── base.json               ← the "default" strict config (everyone inherits this)
├── nextjs.json             ← for Next.js apps (@workspace/web, @workspace/admin)
├── react-library.json      ← for React component libraries (packages/ui)
└── nestjs.json             ← for NestJS apps (apps/api)
```

Each workspace has a tiny `tsconfig.json` that picks one of these and adds only its
own specifics (paths, include/exclude, outDir). This gives you:

- **One source of truth** for strictness and TS version.
- **Consistent rules** across all repos.
- **Small per-workspace files** — just the differences.

The workspace-level files live at:

- `tsconfig.json` (repo root — used by root tooling only)
- `apps/web/tsconfig.json`
- `apps/admin/tsconfig.json`
- `apps/api/tsconfig.json`
- `packages/client/tsconfig.json`
- `packages/ui/tsconfig.json`
- `packages/shared/tsconfig.json`

---

## 2. The base configs

### `base.json` — the "Default" config

Every other config `extends` this one. It sets the strict baseline:

| Option                     | Value                               | What it does                                                        |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| `strict`                   | `true`                              | All strictness flags on (no implicit any, strict null checks, etc.) |
| `target`                   | `ES2022`                            | Compiles to ES2022 syntax                                           |
| `module`                   | `ESNext`                            | Native ESM module syntax (no CJS emit)                              |
| `moduleResolution`         | `Bundler`                           | Bundler-style resolution — extensionless relative imports allowed   |
| `moduleDetection`          | `force`                             | Treat every file as a module                                        |
| `lib`                      | `["es2022", "DOM", "DOM.Iterable"]` | Available global APIs                                               |
| `declaration`              | `true`                              | Emit `.d.ts` files                                                  |
| `declarationMap`           | `true`                              | Source maps for `.d.ts` files (go-to-definition in editors)         |
| `esModuleInterop`          | `true`                              | `import x from "cjs-module"` works as expected                      |
| `isolatedModules`          | `true`                              | Each file compiles in isolation (safe for bundlers/transpilers)     |
| `resolveJsonModule`        | `true`                              | `import data from "./data.json"` is allowed                         |
| `skipLibCheck`             | `true`                              | Don't type-check `.d.ts` files from node_modules (faster)           |
| `incremental`              | `false`                             | No `.tsbuildinfo` caching by default (overridden in api)            |
| `noUncheckedIndexedAccess` | `true`                              | **Array/object index access is `T                                   | undefined`** — forces handling undefined |

> [!WARNING] `noUncheckedIndexedAccess: true` is the strictest (and most annoying) option.
> `arr[0]` is `T | undefined`, so you must handle the `undefined` case. Some
> workspaces deliberately turn it off (see below) when it produces noise.

### `nextjs.json` — for Next.js apps

Extends `base.json` and overrides for Next.js:

```json title="tsconfig.json"
{
	"extends": "./base.json",
	"compilerOptions": {
		"plugins": [{ "name": "next" }],
		"module": "ESNext",
		"moduleResolution": "Bundler",
		"allowJs": true,
		"jsx": "preserve",
		"noEmit": true
	}
}
```

- `module: ESNext` + `moduleResolution: Bundler` — the Next.js bundler resolves
  imports; extensions are not required on relative imports.
- `jsx: preserve` — Next.js handles JSX transform.
- `noEmit: true` — Next.js doesn't emit JS (it compiles on the fly).
- `plugins: [{ "name": "next" }]` — enables Next.js editor tooling.

### `react-library.json` — for packages/ui

Extends `base.json` and just enables the automatic JSX transform:

```json title="tsconfig.json"
{
	"extends": "./base.json",
	"compilerOptions": {
		"jsx": "react-jsx"
	}
}
```

### `nestjs.json` — for apps/api

Extends `base.json` with NestJS requirements:

```json title="tsconfig.json"
{
	"extends": "./base.json",
	"compilerOptions": {
		"allowSyntheticDefaultImports": true,
		"emitDecoratorMetadata": true,
		"experimentalDecorators": true,
		"forceConsistentCasingInFileNames": true,
		"lib": ["ESNext"],
		"module": "ESNext",
		"moduleResolution": "bundler",
		"noFallthroughCasesInSwitch": true,
		"noUncheckedIndexedAccess": false,
		"removeComments": true,
		"sourceMap": true
	}
}
```

- `experimentalDecorators` + `emitDecoratorMetadata` — required for NestJS decorators
  (`@Injectable()`, `@Controller()`, DI).
- `module: ESNext` + `moduleResolution: bundler` — **but the API is the one
  exception to the extensionless convention**: its **value imports** (runtime
  imports) use explicit `.js` extensions on relative specifiers
  (`import { AppModule } from "./app.module.js"`), the standard Nest ESM
  pattern. The API is never consumed by Turbopack (unlike `@workspace/shared`),
  so `.js` specifiers are safe here — and `nest build` / `nest start` emit them
  verbatim, which means `dist/` is directly runnable by Node with no post-build
  fixer (see `docs/architecture.md`).

  **Type-only imports stay extensionless.** `import type { X } from "./foo"`
  (and `export type`) are erased during compilation — they produce **zero**
  emitted JavaScript — so Node never sees them and the `.js` suffix would be
  dead weight. Rule of thumb: *value imports get `.js`, type-only imports
  don't*. (An inline `import { type X } from "./foo.js"` mixed with value
  specifiers keeps `.js`, because the statement emits a runtime import.)
- `noUncheckedIndexedAccess: false` — turned **off** because NestJS + Prisma code
  hits too many false positives (e.g. `process.env.X!` patterns in the seeder).
- `sourceMap: true` + `removeComments: true` — good for `tsc`-based builds.

---

## 3. How each workspace extends them

| Workspace                 | `tsconfig.json` extends                           | Key additions                                                                                                                 |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                | `@workspace/typescript-config/nextjs.json`        | `@/*`, `@workspace/client/*`, `@workspace/ui/*` path aliases; `customConditions: ["development"]`; Next include globs         |
| `apps/admin`              | `@workspace/typescript-config/nextjs.json`        | Same as web                                                                                                                   |
| `apps/api`                | `@workspace/typescript-config/nestjs.json`        | `outDir: ./dist`, `rootDir: ./src`, `incremental: true`; excludes `src/**/*.spec.ts`                                          |
| `packages/client`         | `@workspace/typescript-config/react-library.json` | `module: ESNext`, `moduleResolution: bundler`; hosts auth / API client code                                                   |
| `packages/ui`             | `@workspace/typescript-config/react-library.json` | `module: ESNext`, `moduleResolution: bundler`, `@workspace/ui/*` alias                                                        |
| `packages/shared`         | `@workspace/typescript-config/base.json`          | `module: ESNext`, `moduleResolution: bundler`, `noEmit: true`, `noUncheckedIndexedAccess: false`, `lib: ["es2022"]` |
| repo root `tsconfig.json` | `@workspace/typescript-config/base.json`          | Nothing extra                                                                                                                 |

> [!NOTE] **Why do `packages/shared`, `packages/client`, and `packages/ui` use `bundler`
> resolution?** They are consumed by bundlers (Next.js) or tooling that resolves
> extensionless imports, so all source files are authored **extensionless** —
> Turbopack cannot map a `.js` specifier back to a `.ts` file, so `.js`-suffixed
> imports in source break web/admin (see the gotcha below).
> `packages/shared` is built to ESM with plain **`tsc`** (`pnpm build` →
> `tsc -p tsconfig.build.json`), then `packages/tooling/scripts/fix-dist-extensions.mjs` rewrites
> `dist/` so every relative import gets its `.js` extension — Node's ESM runtime
> requires them even though source stays extensionless.
>
> **How `@workspace/shared` is resolved:** the package `exports` field exposes a
> `development` condition pointing at the raw `src/index.ts`, and web/admin set
> `customConditions: ["development"]` so dev (and Next.js bundling) resolves source
> directly. The API (no custom condition) resolves the built `dist/` output.

### `apps/api/tsconfig.json` in detail

```json title="tsconfig.json"
{
	"extends": "@workspace/typescript-config/nestjs.json",
	"compilerOptions": {
		"outDir": "./dist",
		"rootDir": "./src",
		"incremental": true
	},
	"include": ["src/**/*"],
	"exclude": ["node_modules", "dist", "src/**/*.spec.ts"]
}
```

- `outDir: ./dist` — compiled output lands in `apps/api/dist`.
- `rootDir: ./src` — only `src/` is compiled; keeps `dist/main.js` etc. at the
  `dist` root so `node dist/main` works.
- `incremental: true` — speeds up watch rebuilds.
- `exclude: ["src/**/*.spec.ts"]` — tests are not part of the build. (ESLint
  handles them via `allowDefaultProject`, see `docs/eslint.md`.)

---

## 4. Path aliases

Web and admin define import shortcuts:

```json title="tsconfig.json"
"paths": {
  "@/*": ["./*"],
  "@workspace/client/*": ["../../packages/client/src/*"],
  "@workspace/ui/*": ["../../packages/ui/src/*"]
}
```

So in `apps/web` you can write:

```ts
import { Button } from "@workspace/ui/components/form/button";
import { useAuth } from "@workspace/client/lib/auth";
import { LoginSchema } from "@workspace/shared";
```

- `@workspace/ui/*` and `@workspace/client/*` resolve straight to the **source**
  files, so package changes are picked up instantly in dev.
- `@workspace/shared` resolves through the package `exports` field (no path alias):
  the `development` condition (enabled via `customConditions` in these tsconfigs)
  maps it to `packages/shared/src/index.ts`; anywhere else it maps to the built
  `dist/` output.

---

## 5. Typechecking the repo

Every workspace exposes a `typecheck` script:

| Workspace           | `typecheck` command                  |
| ------------------- | ------------------------------------ |
| `@workspace/web`    | `tsc --noEmit`                       |
| `@workspace/admin`  | `tsc --noEmit`                       |
| `@workspace/api`    | `tsc --noEmit`                       |
| `@workspace/client` | `tsc --noEmit`                       |
| `@workspace/ui`     | `tsc --noEmit`                       |
| `@workspace/shared` | `tsc --noEmit`                       |

Run them all from the repo root:

```bash
pnpm typecheck                    # turbo typecheck → runs the script in every workspace
pnpm typecheck --filter @workspace/web    # just web
pnpm typecheck --filter @workspace/api    # just api (tsc --noEmit)
```

Or inside one workspace:

```bash
cd apps/web && pnpm typecheck
cd packages/shared && pnpm typecheck
```

> [!NOTE] Turbo caching is disabled (`"cache": false` in `turbo.json`), so typecheck always
> runs fresh.

---

## 6. Common tasks & gotchas

### I see `arr[0]` is `T | undefined`

That's `noUncheckedIndexedAccess: true` from `base.json`. Handle it explicitly:

```ts
const value = arr[0];
if (value === undefined) throw new Error("expected an element");
// or
const value: string = arr[0] ?? "";
```

### Turbopack can't resolve `.js` specifiers in `@workspace/shared` source

If web/admin ever fails with `Export UserResponseSchema doesn't exist in target
module` (or similar) while importing from `@workspace/shared`, a relative import
in `packages/shared/src` gained a `.js` extension (e.g. `./schemas/index.js`).
Turbopack resolves **source** directly through the `development` export condition,
but cannot map a `.js` specifier back to a `.ts` file — it sees an empty module
and reports every export as missing. Source must stay **extensionless**; `.js`
extensions belong in `dist/` only, applied by `packages/tooling/scripts/fix-dist-extensions.mjs`
during `pnpm build`.

### The API is ESM now — CJS named imports need interop care

`apps/api` runs true ESM (both `pnpm dev` and `node dist/main.js`). Most CJS
packages work fine through Node's ESM-CJS interop, but a **named** import only
works if the CJS export is statically detectable. `jsonwebtoken` is the known
case: `import { TokenExpiredError } from "jsonwebtoken"` crashes at runtime, so
`token.service.ts` imports the default (`import jwt from "jsonwebtoken"`) and
destructures the class from it. If you add a new CJS dependency, prefer default
imports and destructure from there.

### TypeScript 7 + the TS6 shims (for JS-API tooling)

The repo runs **TypeScript 7.0** (the Go-native compiler) for `tsc` in the web
apps and packages — but TS7 ships **no JS compiler API** (no `ts.sys`, no
`createProgram`), which breaks every JS-API consumer. Two workspaces therefore
run the **last JS-based release (TypeScript 6.0.2)** side-by-side:

- `@workspace/eslint-config` declares `"typescript": "6.0.2"` — so
  typescript-eslint (resolved through eslint-config) gets the classic compiler
  API it needs.
- `@workspace/api` declares the same `"typescript": "6.0.2"`. The Nest CLI
  (`nest build` / `nest start`) **hard-refuses** TS7 — it throws "the installed
  TypeScript version does not expose the programmatic compiler API … install TS
  6 until [7.1]" — so the API must resolve TS6 to use Nest's built-in commands.
  The emitted ESM output is identical either way.
- `pnpm-workspace.yaml` uses `packageExtensions` to inject `typescript: 6.0.2`
  into `@darraghor/eslint-plugin-nestjs-typed` (which imports `typescript`
  directly). Without it, the plugin would resolve the hoisted TS7 and crash.
- `.syncpackrc.json` exempts `@workspace/eslint-config` and `@workspace/api` from
  the exact-version group so the 6.0.2 vs 7.0.2 difference doesn't count as
  dependency drift.

Note: the lockfile legitimately contains **two** `typescript` versions
(`6.0.2` in the shimmed workspaces, `7.0.2` everywhere else) — that's expected.
After a `pnpm install`, re-run `pnpm db:generate` if Prisma's generated client
types ever look missing (the reinstall can wipe `node_modules/.prisma`).

If you see tooling crash with `Cannot read properties of undefined (reading
'useCaseSensitiveFileNames')` or `ts.sys is undefined`, that's a JS-API consumer
resolving TS7 — give it the TS6 shim the same way.

### `process` is not defined

`@types/node` is installed at the repo root. If a file uses Node globals and you get
this error, make sure the file is included in a tsconfig that has node types, or add
`"types": ["node"]` to that workspace's `compilerOptions`.

### Adding a brand-new workspace

1. Create `packages/typescript-config/<name>.json` (extends `./base.json`).
2. Point the workspace's `tsconfig.json` at it: `"extends": "@workspace/typescript-config/<name>.json"`.
3. Add a `typecheck` script to the workspace's `package.json`.

---

## 7. Adding / changing configs

1. **Shared by everything** → edit `packages/typescript-config/base.json`.
2. **Only for Next.js apps** → edit `nextjs.json`.
3. **Only for the API** → edit `nestjs.json`.
4. **Only for one workspace** → edit that workspace's `tsconfig.json`.
5. Restart your editor (or the TS server) after changing configs, then re-run
   `pnpm typecheck`.

To verify:

```bash
cd packages/ui && npx tsc --noEmit
```

---
## 8. Zod-first type derivation (schema → `z.output`)

**The rule:** every *data shape* in the repo is exported from a zod schema —
`export type X = z.output<typeof XSchema>` (or `z.infer`). Never hand-write an
`interface`/`type` next to a schema that already describes the same data; the
schema is the single source of truth and the type can't drift from it.

**What STAYS plain (deliberately — do not "fix" these):**

- **Function contracts** — `OnRefresh`, `AuthChannel`, `FooterAction`, store
  shapes like `SidebarState` (they carry callbacks/observables zod can't
  validate).
- **Generics** — `PaginatedResponse<T>`, `ApiResponse<T>`, `RequestOptions`.
  A schema can't be generic; where a generic factory exists, derive the type
  from it (below) instead of writing the shape by hand.
- **Third-party `extends`** — `RequestWithTrace extends Request`,
  `ExtendedCookieOptions extends CookieOptions`.
- **Component props** — `ButtonProps`, `LoginFormProps`, …
- **Aliases** — `export type X = Y` re-exports and `typeof someConst`.

**The recursion-anchor pattern** (menus, JSON trees): zod can't infer a
self-referencing schema, so anchor it to a node type and derive the alias:

```ts
interface MenuNode { title: string; children?: readonly MenuNode[] }

export const MenuItemSchema: z.ZodType<MenuNode> = z.lazy(() =>
  z.object({ title: z.string(), children: z.array(z.lazy(() => MenuItemSchema)).optional() }),
);

export type MenuItem = z.output<typeof MenuItemSchema>;
```

> The anchor is exported **only** when another module exports a schema that
> references this one (TypeScript declaration emit needs to name it — TS4023).
> `export type` re-export blocks are fine; hand-written data interfaces are not.

**Generic factories:** when a schema is a factory, derive the type with an
instantiation expression so it can never drift:

```ts
export type PaginatedResponse<T> = z.output<ReturnType<typeof PaginatedResponseSchema<z.ZodType<T>>>>;
```

**Strict vs. strip — pick by boundary:**

- **Decode paths** (JWT claims, raw error bodies) → **non-strict** so adding a
  claim/key can't take down the whole pipeline (`JwtPermissionSchema`,
  `ApiErrorSchema`). Unknown keys are stripped, never rejected.
- **Config at load** (`sidebar-menu.json`) → `.strict()` so renamed keys fail
  loudly at boot instead of silently rendering a broken menu.
- **Transport contracts** (the client's `ApiResponse<T>`) → plain type; no
  schema exists for the raw fetch envelope and it is not parsed from input.

**Runtime validation checklist** — a schema that only derives a type is
half the job. `.parse()`/`.safeParse()` should run wherever external or
hand-assembled data crosses a trust boundary: JSON imports, JWT decodes,
localStorage hydration, frontmatter. (See `sidebar-menu.ts`, `token.service.ts`,
`notifications.ts`, the zustand `merge` fns, `docs/index.ts`.)

---

_Last updated: August 9, 2026_
