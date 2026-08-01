# TypeScript Configs & How To Use Them

> This document explains how TypeScript is configured across the monorepo: the shared
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

| Option | Value | What it does |
| ------ | ----- | ------------ |
| `strict` | `true` | All strictness flags on (no implicit any, strict null checks, etc.) |
| `target` | `ES2022` | Compiles to ES2022 syntax |
| `module` | `NodeNext` | ESM/CJS resolution based on `package.json` `"type"` |
| `moduleResolution` | `NodeNext` | Modern Node-style resolution |
| `moduleDetection` | `force` | Treat every file as a module |
| `lib` | `["es2022", "DOM", "DOM.Iterable"]` | Available global APIs |
| `declaration` | `true` | Emit `.d.ts` files |
| `declarationMap` | `true` | Source maps for `.d.ts` files (go-to-definition in editors) |
| `esModuleInterop` | `true` | `import x from "cjs-module"` works as expected |
| `isolatedModules` | `true` | Each file compiles in isolation (safe for bundlers/transpilers) |
| `resolveJsonModule` | `true` | `import data from "./data.json"` is allowed |
| `skipLibCheck` | `true` | Don't type-check `.d.ts` files from node_modules (faster) |
| `incremental` | `false` | No `.tsbuildinfo` caching by default (overridden in api) |
| `noUncheckedIndexedAccess` | `true` | **Array/object index access is `T | undefined`** — forces handling undefined |

> ⚠️ `noUncheckedIndexedAccess: true` is the strictest (and most annoying) option.
> `arr[0]` is `T | undefined`, so you must handle the `undefined` case. Some
> workspaces deliberately turn it off (see below) when it produces noise.

### `nextjs.json` — for Next.js apps

Extends `base.json` and overrides for Next.js:

```json
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

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

### `nestjs.json` — for apps/api

Extends `base.json` with NestJS requirements:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ESNext"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": false,
    "removeComments": true,
    "sourceMap": true
  }
}
```

- `experimentalDecorators` + `emitDecoratorMetadata` — required for NestJS decorators
  (`@Injectable()`, `@Controller()`, DI).
- `module: nodenext` + `moduleResolution: nodenext` — Node-native ESM resolution.
- `noUncheckedIndexedAccess: false` — turned **off** because NestJS + Prisma code
  hits too many false positives (e.g. `process.env.X!` patterns in the seeder).
- `sourceMap: true` + `removeComments: true` — good for `nest build`.

---

## 3. How each workspace extends them

| Workspace | `tsconfig.json` extends | Key additions |
| --------- | ----------------------- | ------------- |
| `apps/web` | `@workspace/typescript-config/nextjs.json` | `@/*`, `@workspace/client/*`, `@workspace/ui/*` path aliases; `customConditions: ["development"]`; Next include globs |
| `apps/admin` | `@workspace/typescript-config/nextjs.json` | Same as web |
| `apps/api` | `@workspace/typescript-config/nestjs.json` | `outDir: ./dist`, `rootDir: ./src`, `incremental: true`; excludes `src/**/*.spec.ts` |
| `packages/client` | `@workspace/typescript-config/react-library.json` | `module: ESNext`, `moduleResolution: bundler`; hosts auth / API client code |
| `packages/ui` | `@workspace/typescript-config/react-library.json` | `module: ESNext`, `moduleResolution: bundler`, `@workspace/ui/*` alias |
| `packages/shared` | `@workspace/typescript-config/base.json` | `module: ESNext`, `moduleResolution: bundler`, `noEmit: true`, `noUncheckedIndexedAccess: false`, `ignoreDeprecations: "6.0"` |
| repo root `tsconfig.json` | `@workspace/typescript-config/base.json` | Nothing extra |

> **Why do `packages/shared`, `packages/client`, and `packages/ui` use `bundler`
> resolution?** They are consumed by bundlers (Next.js, tsup/esbuild), so
> extensionless relative imports are fine. `packages/shared` is built to ESM with
> **tsup** (`pnpm build` → `tsup`, which emits `dist/index.js` + `dist/index.d.ts`
> with proper `.js` extensions — no post-build rewrite script needed).
>
> **How `@workspace/shared` is resolved:** the package `exports` field exposes a
> `development` condition pointing at the raw `src/index.ts`, and web/admin set
> `customConditions: ["development"]` so dev (and Next.js bundling) resolves source
> directly. The API (no custom condition) resolves the built `dist/` output.

### `apps/api/tsconfig.json` in detail

```json
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

```json
"paths": {
  "@/*": ["./*"],
  "@workspace/client/*": ["../../packages/client/src/*"],
  "@workspace/ui/*": ["../../packages/ui/src/*"]
}
```

So in `apps/web` you can write:

```ts
import { Button } from "@workspace/ui/components/button";
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

| Workspace | `typecheck` command |
| --------- | ------------------- |
| `@workspace/web` | `tsc --noEmit` |
| `@workspace/admin` | `tsc --noEmit` |
| `@workspace/api` | `nest build` (compiles = typechecks) |
| `@workspace/client` | `tsc --noEmit` |
| `@workspace/ui` | `tsc --noEmit` |
| `@workspace/shared` | `tsc --noEmit` |

Run them all from the repo root:

```bash
pnpm typecheck                    # turbo typecheck → runs the script in every workspace
pnpm typecheck --filter @workspace/web    # just web
pnpm typecheck --filter @workspace/api    # just api (runs nest build)
```

Or inside one workspace:

```bash
cd apps/web && pnpm typecheck
cd packages/shared && pnpm typecheck
```

> Turbo caching is disabled (`"cache": false` in `turbo.json`), so typecheck always
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

### "Relative import paths need explicit file extensions in ECMAScript imports"

This error appears under `moduleResolution: nodenext` (used by `apps/api`). Two
ways to deal with it:

- In `apps/api` (source), imports like `./auth.service` are fine because Nest's
  own build pipeline (`nest build`) transpiles and resolves them without strict
  Node ESM resolution at dev/build time — but if you hit this error, the fix is
  to use a `.js` extension (e.g. `./auth.service.js`) even though the source is
  `.ts`.
- In `packages/shared`, the source uses extensionless imports with `bundler`
  resolution, and **tsup** emits the built `dist/` files with proper `.js`
  extensions, so Node ESM consumers (the API) import them without issues.
  Do **not** hand-edit `dist/` — rebuild with `pnpm --filter @workspace/shared build`.

### `TS5101: Option 'baseUrl' is deprecated`

This appears when tsup's DTS bundler runs under TypeScript 6 — it generates a temp
config with `baseUrl` (deprecated). `packages/shared/tsconfig.json` sets
`"ignoreDeprecations": "6.0"` to silence it. If you ever remove it and the build
breaks, add it back.

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

_Last updated: July 31, 2026_
