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
| `packages/client`            | `@workspace/client`            | AuthContext, `useApi`, typed endpoint registry, shared auth UI (`LoginForm`, auth bridge) | —    |
| `packages/shared`            | `@workspace/shared`            | Zod schemas + shared types (the API contract)                          | —    |
| `packages/tooling`           | `@workspace/tooling`           | Repo-wide scripts (syncpack dependency hygiene, turbo-backed `deps:*`, build infra in `scripts/`: check-ui-audit, fix-dist-extensions) | —    |
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
├── index.ts   ← barrel — re-exports everything
└── schemas/
    ├── auth/    ← auth.ts, auth-errors, session-status, user
    ├── api/     ← api-response, common, env, health.schema, message, pagination
    └── domain/  ← rbac, enums, menu, url, clicks, tags, logs, api-keys
```

Schemas are grouped by domain (`auth/`, `api/`, `domain/`). The barrel
(`schemas/index.ts`) is the only import surface — consumers always import from
`@workspace/shared`, never from deep schema paths.

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
(`packages/tooling/scripts/fix-dist-extensions.mjs`) rewrites `dist/` so every relative import
gets its `.js` extension — Node's ESM runtime requires them. Do **not** hand-edit
`dist/` — rebuild with `pnpm --filter @workspace/shared build`.

---

## 5. The client layer (packages/client)

```
packages/client/src/lib/
├── auth/  ← auth domain: index.tsx (AuthProvider/useAuth — public path @workspace/client/lib/auth),
│            auth-errors, auth-sync, client-auth-wrapper, login-form, jwt, password, proxy-refresh
├── api/   ← API domain: use-api, endpoints (the endpoint registry), query-provider, config
└── test-utils.ts  ← shared test helpers (colocated, used by both domains)
```

Tests are colocated next to their source (`auth/auth.test.tsx`, `api/use-api.test.ts`,
…). The public deep paths mirror the folders: `@workspace/client/lib/auth` (the
provider entry, via a dedicated exports entry), `@workspace/client/lib/auth/login-form`,
`@workspace/client/lib/api/endpoints`, …

**The client layer also hosts the shared, Next-coupled auth UI.** The old
arrangement duplicated `login-form.tsx` and `client-auth-wrapper.tsx` in each
app with ~15 lines of divergence (admin cookie isolation, `adminLogin` endpoint,
admin-access gate). Both are now **one prop-driven implementation here**:

```tsx
<LoginForm
	logo={…}
	title="Acme"
	heading="Admin Login"
	subtitle="…"
	mode="admin"        // "admin" → adminLogin endpoint + requires admin access
	redirectPath={…}
	footer={…}
/>
```

- `<LoginForm>` takes a `mode` prop (`"web"` | `"admin"`). Admin mode swaps in
  `authEndpoints.adminLogin`, enforces `hasAdminAccess`, and renders the cookie
  isolation; web mode is the plain credential form. It imports presentational
  primitives from `@workspace/ui/components/form/*`.
- `<ClientAuthWrapper>` is the `next/navigation`-aware bridge (router push +
  refresh fed into `AuthProvider`), with `cookieNames` + `clientType`
  configurable per app.
- Both live in `packages/client` (not `packages/ui`) because they depend on
  `next/navigation` + the auth context — they are *auth*, not presentation.
  `next` is a peer dependency of `packages/client` so that coupling is honest.
  See rule 3 below for the layering carve-out this implies.

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
├── styles/globals.css   ← design tokens (imported by both apps)
├── hooks/               ← use-media-query, use-mobile
├── lib/                 ← cn() and other shared helpers
└── components/
    ├── form/            ← button, input, select, checkbox, field…
    ├── overlay/         ← dialog, popover, tooltip, sheet, drawer…
    ├── navigation/      ← breadcrumb*, sidebar, tabs, pagination…
    ├── feedback/        ← alert, toast, badge, skeleton, spinner…
    ├── chat/            ← message, attachment, bubble…
    ├── display/         ← card, table, chart, avatar, calendar…
    └── theme-provider.tsx  ← the one flat provider (imported by both apps)
```

**Component grouping rule:** public import paths are `@workspace/ui/components/<group>/<name>`
(e.g. `@workspace/ui/components/form/button`) — the `exports` map in `package.json`
mirrors each group. When adding a component, put it in the most natural group;
create a new group only when 3+ components share a domain.

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
- Login/forgot pages render the **shared** `LoginForm` / auth bridge from
  `@workspace/client` (`mode="web"`).
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
- Login page renders the **shared** `LoginForm` from `@workspace/client`
  (`mode="admin"` → `adminLogin` endpoint + admin-access gate).
- Runs on the **Node.js runtime** (Next.js 16 runs `proxy.ts` on Node by
  design; only legacy `middleware.ts` can opt into Edge), so no Edge setup
  is needed on Node hosts (DigitalOcean / Linode droplets, etc.).

### `@workspace/api` (port 8080)

- NestJS app. Routes are grouped in `src/modules/` — `health` (`GET /` +
  `GET /health`), `auth` (credentials, email verification, password reset,
  `/me`, SuperAdmin user management, root `POST /users`), `sessions`
  (refresh / logout / logout-all / active sessions, root `GET /session`),
  `impersonation`, `rbac`, `logs`.
- **The old root `AppController` is gone** — its four endpoints were dissolved
  into their domain modules with **URL paths unchanged**: `GET /` + `GET /health`
  → `HealthController`; `GET /session` → `SessionStatusController` (a root-`@Controller()`
  sibling of `SessionsController` in the sessions module); `POST /users` →
  `RootUsersController` in the auth module. A module can host multiple
  controllers — use an unprefixed controller for root-pathed endpoints.
- **Configuration lives in a `@Global() ConfigModule** (`src/config/config.module.ts`)
  that provides + exports `TypedConfigService`. It MUST be global: Nest instantiates
  imported modules before the importing module's own providers, so a locally-provided
  `TypedConfigService` is invisible to dynamic modules like
  `ThrottlerModule.forRootAsync({ inject: [TypedConfigService] })` — booting fails
  with `UnknownDependenciesException` (THROTTLER:MODULE_OPTIONS) if it isn't global.
  Do NOT re-register `TypedConfigService` in feature modules; inject the global one.
- **`common/` only holds truly shared HTTP plumbing.** The auth-domain files
  (guards, auth decorators, set/clear-auth-cookies interceptors, cookie
  config, cookie service) live in `modules/auth/{guards,decorators,interceptors,constants,services}`
  and are re-exported by `AuthModule` so `sessions`/`impersonation` still
  resolve them. What remains in `common/`: `response.interceptor`,
  `correlation-id.middleware`, `zod-validation.pipe`, `utils/` (expiry,
  client-info — shared by 2+ modules), `dto/` (the shared envelope
  `api-response` + `response-wrapper`), `interfaces/json.ts`. **DTO rule:**
  modules own their DTOs (`modules/auth/dtos/`, …); `common/dto/` is only for
  shapes shared by 2+ modules.
- **Module layout convention (point 18):** the controller sits at the module
  root; subfolders (`dtos/`, `services/`, `guards/`, …) appear only when a
  kind has more than one file. `auth` uses them (12 DTOs, 4 services, plus
  decorators/guards/interceptors/constants); `sessions` is flat except for
  `dtos/`; `rbac` hosts its own response schemas (`schemas/`); `health` is
  fully flat; `logs` is a single service. Splitting a module? Keep the same
  URL paths and move only the endpoint + its service methods.
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
3. **`@workspace/client` may import `@workspace/ui`, never the other way.** The shared
   auth UI (`login-form.tsx`, `client-auth-wrapper.tsx`) composes presentational
   `@workspace/ui` primitives — that is a legal downward dependency (apps →
   client → ui → shared). The forbidden edge is `ui → client`: a `packages/ui`
   component must never touch auth, data, or `next/navigation`.
4. **Pages are the smart components.** Pages fetch data (via `useApi` / endpoint
   registry), own the state, and pass plain props down to dumb UI components.
5. **No `any` / `unknown` / `never`, no casts.** If you need a type, derive it from a
   Zod schema in `@workspace/shared`.
6. **New endpoints get a typed entry in `packages/client/src/lib/endpoints.ts`** — don't
   call raw `fetch` in a page.
7. **Access modifiers + return types on every class method / function** (enforced by ESLint).
8. **Keep docs updated** — if you change how the layers interact, update this file.
9. **Tests live next to their source** (colocated) — `foo.ts` has `foo.test.ts` in
   the same folder. `packages/ui` runs its own vitest suite (`pnpm --filter @workspace/ui test`);
   the admin app runs its vitest suite (which includes the opt-in `e2e/` smoke);
   the API runs `test:e2e` for full-stack specs (needs Postgres).
10. **App folders group by domain, not by type** — `components/showcase/` for demos,
    `components/dashboard/` for real dashboard widgets, `components/docs/` for
    doc renderers, `lib/navigation/` / `lib/palette/` / `lib/docs/` for lib
    domains, `stores/` for zustand. Components shared by both apps live in
    `packages/ui`; app-only thin wrappers stay in the app they configure.
11. **`components/` is `.tsx` only.** Pure logic/constants/types with no JSX
    live in `lib/` (e.g. `lib/dashboard/data-table-constants.ts`) — a `.ts`
    inside `components/` is a smell, not a rule.
12. **JSON data has one home per kind** — `apps/admin/data/` holds fixtures;
    runtime config JSON lives next to its consumers (e.g.
    `lib/navigation/sidebar-menu.json` beside the compile logic). There is no
    top-level `config/` folder.
13. **No single-file folders.** If a folder would hold exactly one file, put
    that file in its parent (or merge it with a sibling kind). Exception:
    ambient `.d.ts` declarations may live in `src/types/`.
14. **Repo-wide shell scripts live in `packages/tooling/scripts/`** (e.g.
    `check-ui-audit.mjs`, `fix-dist-extensions.mjs`) — referenced as
    `node ../../packages/tooling/scripts/<name>.mjs` from package scripts.

---

_Last updated: July 31, 2026_
