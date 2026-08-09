---
title: "Monorepo Architecture"
description: "The big picture: what each workspace is for, how data flows between frontends and backend, and where new code belongs."
order: 2
author: "Acme Inc."
lastUpdated: "2026-08-02"
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
---

# Monorepo Architecture

> [!NOTE] **Start here.** This document explains the big picture: what each workspace is for,
> how data flows between the frontends and the backend, and how to decide where new
> code belongs. Written for a junior developer with ~6 months of experience.

---

## Table of Contents

1. [The mental model](#1-the-mental-model)
2. [Workspace map](#2-workspace-map)
3. [How data flows](#3-how-data-flows)
4. [The shared contract (packages/shared)](#4-the-shared-contract-packages-shared)
5. [The client layer (packages/client)](#5-the-client-layer-packages-client)
6. [The UI layer (packages/ui)](#6-the-ui-layer-packages-ui)
7. [The apps](#7-the-apps)
8. [How packages are resolved](#8-how-packages-are-resolved)
9. [Rules of thumb](#9-rules-of-thumb)

---

## 1. The mental model

Think of the monorepo as **three layers**, each depending only on the layer below it:

```
┌─────────────────────────────────────────────────────────-───┐
│                       APPS (deployable)                     │
│   @workspace/web (Next.js :3000)  @workspace/admin (3001)   │
│   @workspace/api  (NestJS :8080)                            │
├────────────────────────────────────────────────────────────-┤
│                        CLIENT LAYER                         │
│   @workspace/client  →  auth, useApi hook, endpoint map    │
│   @workspace/ui     →  shadcn components (presentational)  │
├───────────────────────────────────────────────────────────-─┤
│                        SHARED CONTRACT                      │
│   @workspace/shared →  Zod schemas + shared types          │
└────────────────────────────────────────────────────────────-┘
```

- **`@workspace/shared`** is the _contract_ — what the API accepts and returns. Both
  the API and the frontends import from it, so a schema change is caught by the
  TypeScript compiler everywhere at once.
- **`@workspace/client`** is the _data layer for the frontends_ — authentication
  state, the typed fetch hook, and the registry of known API endpoints.
- **`@workspace/ui`** is _pure presentational_ shadcn components. It knows nothing
  about your data, auth, or API.
- **The apps** compose everything: pages fetch data through `@workspace/client`,
  render it with `@workspace/ui`, and validate the shapes with `@workspace/shared`.

---

## 2. Workspace map

| Path                         | Package name                   | Role                                                                   | Port |
| ---------------------------- | ------------------------------ | ---------------------------------------------------------------------- | ---- |
| `apps/web`                   | `@workspace/web`               | Customer-facing Next.js app (login, hello page…)                       | 3000 |
| `apps/admin`                 | `@workspace/admin`             | Admin panel Next.js app (dashboard…)                                   | 3001 |
| `apps/api`                   | `@workspace/api`               | NestJS backend — all endpoints, auth, Prisma                           | 8080 |
| `packages/ui`                | `@workspace/ui`                | shadcn/ui components (and `globals.css`)                               | —    |
| `packages/client`            | `@workspace/client`            | AuthContext, `useApi`, typed endpoint registry                         | —    |
| `packages/shared`            | `@workspace/shared`            | Zod schemas + shared types (the API contract)                          | —    |
| `packages/tooling`           | `@workspace/tooling`           | Repo-wide scripts (syncpack dependency hygiene, turbo-backed `deps:*`) | —    |
| `packages/eslint-config`     | `@workspace/eslint-config`     | Shared ESLint presets                                                  | —    |
| `packages/typescript-config` | `@workspace/typescript-config` | Shared tsconfig presets                                                | —    |

> [!NOTE] **Why are the apps named `@workspace/web` / `@workspace/admin` / `@workspace/api`
> instead of just `web` / `admin` / `api`?** So every `pnpm --filter <name>` and
> import follows one consistent naming scheme: `@workspace/*` everywhere.

---

## 3. How data flows

```
 Browser (web / admin)
        │  fetch() with credentials: "include" (httpOnly cookies)
        ▼
 @workspace/client  ← useApi() hook (typed via Zod response schemas)
        │  calls an endpoint defined in lib/endpoints.ts
        ▼
 @workspace/api     ← NestJS controller → DTO (createZodDto) → service → Prisma
        │  response passes through the ResponseInterceptor:
        │  { success: true, data, meta: { correlationId, timestamp } }
        ▼
 @workspace/shared  ← response schema validates the envelope + data
        │
        ▼
 Frontend renders with @workspace/ui components
```

Key points:

- **Authentication is cookie-based.** The API sets `httpOnly` cookies on login; the
  frontends never store tokens in JS. `useApi` sends `credentials: "include"`, so the
  browser attaches the cookies automatically.
- **No hardcoded URLs in shared packages.** `packages/client/src/lib/config.ts`
  exports `API_BASE_URL`, resolved from `NEXT_PUBLIC_API_URL` (localhost fallback for
  dev). Each app sets its own value in `apps/web/.env` / `apps/admin/.env`, so a
  deployed web app points at the production API without code changes. The API reads
  `PORT` and `CORS_ORIGINS` (comma-separated) from `apps/api/.env` instead of
  hardcoding `8080` and localhost origins.
- **The API response is always wrapped** by the `ResponseInterceptor`:
  `{ success: true, data, meta }` (or `{ success: false, error, meta }` on failure).
  The typed endpoint registry in `@workspace/client` models this exact envelope.
- **`@workspace/shared` schemas are the single source of truth** for request/response
  shapes: the API's DTOs extend them (via `createZodDto`), Swagger infers from them,
  and the frontend's typed hooks validate responses with them.

---

## 4. The shared contract (packages/shared)

```
packages/shared/src/
├── index.ts            ← barrel — re-exports everything
└── schemas/
    ├── auth.ts         ← login, signup, refresh, session…
    ├── user.ts         ← user responses, profiles…
    ├── api-response.ts ← the { success, data, meta } envelope
    ├── common.ts       ← BaseResponse, DateString…
    ├── enums.ts        ← PermissionAction, PermissionResource…
    └── …               ← one file per domain (rbac, urls, clicks…)
```

**Rules:**

- Every schema uses Zod v4 `.strict()` (unknown fields are rejected).
- Every schema exports both the schema and its inferred type, e.g.:
  ```ts
  export const LoginSchema = z.object({…}).strict();
  export type LoginInput = z.output<typeof LoginSchema>;
  ```
- **No `any`, `unknown`, `never`, no type casting.** Infer everything from Zod.
- **Add new schemas to the barrel** (`src/index.ts`) or they won't be importable.

**How it's built:** `packages/shared` compiles to real ESM + `.d.ts` with plain
**`tsc`** (`pnpm --filter @workspace/shared build` → `tsc -p tsconfig.build.json`),
producing per-file `dist/*.js` + `dist/*.d.ts`. There is **no bundler** (no tsup)
and **no NodeNext**: source is authored **extensionless** (Turbopack and the web
apps require that — see `docs/typescript.md`), and a tiny post-build script
(`scripts/fix-dist-extensions.mjs`) rewrites `dist/` so every relative import
gets its `.js` extension — Node's ESM runtime requires them. Do **not** hand-edit
`dist/` — rebuild with `pnpm --filter @workspace/shared build`.

---

## 5. The client layer (packages/client)

```
packages/client/src/lib/
├── auth.tsx           ← AuthProvider / useAuth (reads cookies, drives login state)
├── use-api.ts         ← useApi() hook — typed fetch wrapper on TanStack Query
├── endpoints.ts       ← THE endpoint registry: path + method + request/response schemas
├── query-provider.tsx ← TanStack Query provider used by both apps
├── jwt.ts             ← decodeJwtPayload (edge-safe, used by proxy.ts)
└── proxy-refresh.ts   ← Edge-safe server-side refresh helpers (used by both proxies)
```

**The endpoint registry (`endpoints.ts`) is the heart of type-safe API calls:**

```ts
export const authEndpoints = {
	me: { path: "/auth/me", method: "GET", queryKey: ["auth", "me"], responseSchema: envelope(UserResponseSchema) },
	login: { path: "/auth/login", method: "POST", bodySchema: LoginSchema, responseSchema: envelope(LoginResponseSchema) },
	// …
};
```

A page uses it like this:

```tsx
const { api } = useAuth();
const meQuery = api.procedure(authEndpoints.me).useQuery();
const user = meQuery.data?.data; // fully typed
```

Because every endpoint carries its own Zod schemas, `useQuery`/`useMutation` results
are typed end-to-end — no manual response interfaces in the pages.

---

## 6. The UI layer (packages/ui)

```
packages/ui/src/
├── styles/globals.css  ← design tokens (imported by both apps)
└── components/         ← shadcn components (button, dialog, table, input…)
```

**This package is presentational only.** It must not:

- know about authentication (that's `@workspace/client`),
- fetch data (that's `@workspace/client`),
- contain Zod schemas (that's `@workspace/shared`).

If you catch yourself writing data logic inside a `packages/ui` component, stop and
move it up to the page (smart component) or into `@workspace/client`.

---

## 7. The apps

### `@workspace/web` (port 3000)

- Customer-facing app: `/auth/login`, `/auth/signup`, `/auth/forgot-password`,
  `/hello`, …
- `proxy.ts` guards routes: redirects unauthenticated users to `/auth/login`,
  redirects authenticated users away from auth pages. On **document
  navigations** it also performs a **server-side silent refresh**: the proxy
  runs server-side, so it can read the httpOnly cookies — when the access
  token is expired (or within 30s of expiring) it calls `POST /auth/refresh`
  itself and forwards the rotated `Set-Cookie` headers with the response, so
  the first API call after the navigation never 401s. A rejected refresh
  token means the session is genuinely dead: the proxy clears the stale
  cookies and redirects to login (breaking the dead-session bounce loop that
  neither the client nor the API guard can break).
- Uses cookie names `accessToken` / `refreshToken`.
- Runs on the **Node.js runtime** (Next.js 16 runs `proxy.ts` on Node by
  design; only legacy `middleware.ts` can opt into Edge), so no Edge setup
  is needed on Node hosts (DigitalOcean / Linode droplets, etc.).

### `@workspace/admin` (port 3001)

- Admin app: `/auth/login`, `/dashboard`, …
- `proxy.ts` guards routes **and** checks the `hasAdminAccess` claim in the JWT —
  non-admins are redirected back to login. Like the web proxy it silently
  refreshes expired sessions server-side on document navigations (sending
  `X-Client-Type: admin` so the admin cookie set rotates) and re-evaluates
  `hasAdminAccess` against the **rotated** token, so the gating decision
  reflects the session the browser is about to hold.
- Uses **isolated** cookie names `adminAccessToken` / `adminRefreshToken`, so a web
  login doesn't grant admin access (and vice versa).
- Sends `X-Client-Type: admin` on login so the backend sets the right cookie set.
- Runs on the **Node.js runtime** (Next.js 16 runs `proxy.ts` on Node by
  design; only legacy `middleware.ts` can opt into Edge), so no Edge setup
  is needed on Node hosts (DigitalOcean / Linode droplets, etc.).

### `@workspace/api` (port 8080)

- NestJS app. Routes are grouped in `src/modules/` (auth, rbac, urls, …).
- Controllers use DTOs built with `createZodDto(<Schema from @workspace/shared>)`.
- Swagger docs live at `http://localhost:8080/docs` (inferred from the same schemas).
- The `ResponseInterceptor` wraps every response in `{ success, data, meta }`.
- **Uses Nest's standard build/run commands**: `pnpm dev` → `nest start --watch`,
  `pnpm build` → `nest build`, `pnpm start` → `nest start --prod`,
  `pnpm start:prod` → `node dist/main.js` (what a process manager runs).
- **ESM, with `.js` on value imports only.** The API is the one exception to
  the repo's extensionless-import convention: **runtime (value) imports** are
  written as `./app.module.js` (standard Nest ESM pattern). **Type-only
  imports** (`import type … from "./foo"`) stay extensionless — they're erased
  during compilation, so Node never sees them. The API is never consumed by
  Turbopack (unlike `@workspace/shared`), so `.js` specifiers are safe here —
  and both `nest build` and `tsc` emit them verbatim, so `dist/` is directly
  runnable by Node with **no post-build fixer and no resolver hook**.
- **TypeScript note:** the API's `typescript` is pinned to **6.0.2** (the last
  JS-based release) because the Nest CLI **hard-refuses** TS7 (TS7 has no
  compiler API until 7.1). See `docs/typescript.md` → "TS6 shims". `tsc` there
  runs TS6, but the emitted ESM is identical to a TS7 build.

---

## 8. How packages are resolved

Different consumers resolve `@workspace/*` packages differently — this is intentional:

| Package             | In web/admin (Next.js)                                                             | In api (NestJS/Node)                  |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| `@workspace/shared` | **Source** via the `development` export condition + `customConditions` in tsconfig | **Built** `dist/` output (proper ESM) |
| `@workspace/client` | Source via tsconfig path alias + `transpilePackages`                               | (not used)                            |
| `@workspace/ui`     | Source via tsconfig path alias + `transpilePackages`                               | (not used)                            |

- web/admin `next.config.ts` lists `transpilePackages: ["@workspace/client", "@workspace/ui", "@workspace/shared"]`, so the source files are compiled on the fly.
- The API resolves the built `dist/` of `@workspace/shared` (turbo builds shared first — `dev`/`build` tasks depend on `^build`).

---

## 9. Rules of thumb

1. **Schema changes go in `packages/shared`** — never define a request/response shape
   inside an app or a module.
2. **Never import `@workspace/client` from `@workspace/ui`** — UI must stay presentational.
3. **Never import `@workspace/ui` from `@workspace/client`** — keep the layers one-way.
4. **Pages are the smart components.** Pages fetch data (via `useApi` / endpoint
   registry), own the state, and pass plain props down to dumb UI components.
5. **No `any` / `unknown` / `never`, no casts.** If you need a type, derive it from a
   Zod schema in `@workspace/shared`.
6. **New endpoints get a typed entry in `packages/client/src/lib/endpoints.ts`** — don't
   call raw `fetch` in a page.
7. **Access modifiers + return types on every class method / function** (enforced by ESLint).
8. **Keep docs updated** — if you change how the layers interact, update this file.

---

_Last updated: July 31, 2026_
