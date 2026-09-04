---
title: "Monorepo Architecture"
tags: ["architecture", "system-design", "monorepo"]
description: "The big picture: what each workspace is for, how data flows between frontends and backend, and where new code belongs."
order: 2
author: "Acme Inc."
lastUpdated: 1785628800000
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
4. [The shared contract (packages/shared)](#4-the-shared-contract-packagesshared)
5. [API versioning](#5-api-versioning)
6. [The client layer (packages/client)](#6-the-client-layer-packagesclient)
7. [The UI layer (packages/ui)](#7-the-ui-layer-packagesui)
8. [The apps](#8-the-apps)
9. [How packages are resolved](#9-how-packages-are-resolved)
10. [Rules of thumb](#10-rules-of-thumb)

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

| Path                         | Package name                   | Role                                                                                                                                   | Port |
| ---------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `apps/web`                   | `@workspace/web`               | Customer-facing Next.js app (login, hello page…)                                                                                       | 3000 |
| `apps/admin`                 | `@workspace/admin`             | Admin panel Next.js app (dashboard…)                                                                                                   | 3001 |
| `apps/api`                   | `@workspace/api`               | NestJS backend — all endpoints, auth, Prisma                                                                                           | 8080 |
| `packages/ui`                | `@workspace/ui`                | shadcn/ui components (and `globals.css`)                                                                                               | —    |
| `packages/client`            | `@workspace/client`            | AuthContext, `useApi`, typed endpoint registry, shared auth UI (`LoginForm`, auth bridge)                                              | —    |
| `packages/shared`            | `@workspace/shared`            | Zod schemas + shared types (the API contract)                                                                                          | —    |
| `packages/messaging`         | `@workspace/messaging`         | Generic Redis / BullMQ / Kafka / RabbitMQ Nest wiring (copy to other projects)                                                           | —    |
| `packages/tooling`           | `@workspace/tooling`           | Repo-wide scripts (syncpack dependency hygiene, turbo-backed `deps:*`, build infra in `scripts/`: check-ui-audit, fix-dist-extensions) | —    |
| `packages/eslint-config`     | `@workspace/eslint-config`     | Shared ESLint presets                                                                                                                  | —    |
| `packages/typescript-config` | `@workspace/typescript-config` | Shared tsconfig presets                                                                                                                | —    |

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

- **The API runs on the Fastify adapter** (`@nestjs/platform-fastify`): cookies via
  `@fastify/cookie`, CORS via `@fastify/cors`, Nest middleware through bundled middie,
  and `rawBody: true` for the signature-verified Resend webhook. Express is fully removed.
  Additional native plugins: `@fastify/request-context` (AsyncLocalStorage per-request
  store), `@fastify/rate-limit` (per-IP, tighter cap on the webhook), `@fastify/compress`
  (gzip/brotli), `@fastify/etag`, `@fastify/under-pressure` (event-loop/heap health).
- **Every business endpoint is served under `/api/v1` via EXPLICIT path helpers** —
  no Nest `enableVersioning` machinery (no `VERSION_NEUTRAL`/exclude quirks).
  `API_VERSION_PREFIX` + `apiPath()` in `packages/shared/src/contracts/versioning.ts`
  (re-exported from `contracts/index.ts`) is the single source of truth: server
  controllers build their `@Controller` paths with `apiPath("/auth")` → `/api/v1/auth`,
  and the client transport prepends the same constant to the logical contract paths.
  `GET /`, `GET /health`, `GET /version` and `POST /notifications/email-webhook` stay
  unversioned by not using the helper. Swagger is served at `/v1/docs` (`/docs`
  redirects there). See [section 5](#5-api-versioning) for the full invariants —
  including the version manifest, `Accept-version` rewriting, and how to add a v2.
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
├── index.ts       ← barrel — re-exports everything
├── api-routes.ts  ← SINGLE SOURCE OF TRUTH for all API path templates
├── contracts/     ← apiContract — the shared route contract (method + path + input schema)
└── schemas/
    ├── auth/    ← auth.ts, auth-errors, cookies, session-status, token, user
    ├── api/     ← api-response, common, env, health.schema, message, pagination
    ├── email/   ← email.ts (log/send/webhook), email-templates.ts (render props)
    ├── runtime/ ← json, caught-error, http-headers, prisma-query, primitives (cross-cutting parse helpers)
    └── domain/  ← rbac, enums, events, geo, logs, menu, permissions, …
```

### api-routes.ts — path template registry

`api-routes.ts` is the **single source of truth** for every API endpoint path template.
Contracts (`contracts/index.ts`) reference `apiRoutes` instead of hardcoding path strings.

- **Static routes** are plain strings: `apiRoutes.geo.countries` → `"/geo/countries"`
- **Parameterized routes** are objects: `apiRoutes.geo.countryDetail` → `{ path: "/geo/countries/:id", params: ["id"] }`
- **`buildRoute(route, params)`** resolves a route to a concrete URL at compile time (enforces required params)
- **`buildQuery(base, params)`** appends query parameters safely (URL-encodes, omits null/undefined)

```ts
import { apiRoutes, buildRoute, buildQuery } from "@workspace/shared";

// Static route:
apiRoutes.geo.countries  // → "/geo/countries"

// Parameterized route:
buildRoute(apiRoutes.geo.countryDetail, { id: "42" })
// → "/geo/countries/42"

// With query string:
buildQuery(buildRoute(apiRoutes.geo.countries), { search: "united", page: 2 })
// → "/geo/countries?search=united&page=2"
```

Contracts consume the path string directly:
```ts
import { apiRoutes } from "../api-routes";

countryDetail: defineContract({ method: "GET", path: apiRoutes.geo.countryDetail.path, input: CountryIdParamSchema }),
countries: defineContract({ method: "GET", path: apiRoutes.geo.countries, input: CountryListQuerySchema }),
```

Schemas are grouped by domain (`auth/`, `api/`, `domain/`, `email/`, `runtime/`). The barrel
(`schemas/index.ts`) is the only import surface — consumers always import from
`@workspace/shared`, never from deep schema paths.

**Rules:**

- Every schema uses Zod v4 `.strict()` (unknown fields are rejected) unless documented otherwise (e.g. JWT decode strips unknown keys).
- Every schema exports both the schema and its inferred type, e.g.:
  ```ts
  export const LoginSchema = z.object({…}).strict();
  export type LoginInput = z.output<typeof LoginSchema>;
  ```
- **Application code consumes the type, not the schema** — use `LoginInput` in signatures; import `LoginSchema` only at HTTP boundaries (`ZodValidationPipe`, `createZodDto`), `.parse()` / `.safeParse()`, and tests. Do not re-export schemas from Nest services, email templates, or thin type-alias files. See `docs/typescript.md` §8.
- **Internal event bus** — services emit `AuthFlowEvent`, `SessionActionEvent`, `ImpersonationActionEvent`, etc. Producers call `XxxEventSchema.parse({…})` once before `emit*` so Telescope subscribers always receive contract-valid payloads.
- **No `any`, `unknown`, `never`, no type casting.** Infer everything from Zod.
- **Add new schemas to the barrel** (`src/index.ts`) or they won't be importable.

**The shared contract (`contracts/`)** is the single source of truth for every
route both sides agree on. One leaf per endpoint — method, path template and
the ONE zod input schema:

```ts
export const apiContract = {
	auth: {
		login: defineContract({ method: "POST", path: "/auth/login", input: LoginSchema }),
		// …
	},
	geo: {
		countries: defineContract({ method: "GET", path: "/geo/countries", input: CountryListQuerySchema }),
		// …
	},
} as const;
```

The client router (`packages/client` `endpoints.ts`) derives path/method/input
from `apiContract`; the NestJS controllers validate at the HTTP boundary with
the very same schemas (`ZodValidationPipe(apiContract.geo.countries.input)`)
— the contract is the only place a path or input schema is written, so the two
sides can never drift.

**How it's built:** `packages/shared` compiles to real ESM + `.d.ts` with plain
**`tsc`** (`pnpm --filter @workspace/shared build` → `tsc -p tsconfig.build.json`),
producing per-file `dist/*.js` + `dist/*.d.ts`. There is **no bundler** (no tsup)
and **no NodeNext**: source is authored **extensionless** (Turbopack and the web
apps require that — see `docs/typescript.md`), and a tiny post-build script
(`packages/tooling/scripts/fix-dist-extensions.mjs`) rewrites `dist/` so every relative import
gets its `.js` extension — Node's ESM runtime requires them. Do **not** hand-edit
`dist/` — rebuild with `pnpm --filter @workspace/shared build`.

---

## 5. API versioning

Everything about `/api/v1/…` is described here so the property stays machine-checked,
not tribal knowledge. The `/session` 404 regression — a controller that served an
unversioned path the client transport could never reach — is exactly the failure
mode this section (plus the drift test + lint rule below) exists to prevent.

### The single source of truth

```
packages/shared/src/contracts/versioning.ts   ← the constants (dependency-free)
  API_VERSION        = "v1"   (the current default)
  API_VERSION_PREFIX = "/api/v1"
  apiPath(path, version?)     → "/api/v1/<path>"
  apiDocsPath(version?)       → "/v1/docs"
  UNVERSIONED_ROUTE_PREFIXES  → ["", "health", "notifications/email-webhook", "version"]
  API_DEPRECATED_VERSIONS     → []   (drives the Sunset header)
```

- **Server:** every business controller builds its physical path with the helper:
  `@Controller(apiPath("/auth"))` → serves `/api/v1/auth`. Unversioned routes
  (root `/`, `/health`, the Resend webhook, the `/version` manifest) simply don't
  call `apiPath()`.
- **Client:** the transport prepends `API_VERSION_PREFIX` to the logical contract
  paths (`/auth/login` in `apiContract` → `/api/v1/auth/login` on the wire).

Both sides derive from the same definition, so they can never drift.
`versioning.ts` is deliberately dependency-free — importing the `contracts` barrel from a schema would be a runtime circular import.

### The drift test + lint rule (machine checks)

1. **e2e drift test** (`apps/api/test/app.e2e-spec.ts`): walks every `apiContract`
   leaf, injects an unauthenticated request at `/api/v1/<path>`, and asserts it is
   NOT a 404. A controller that forgets `apiPath()` fails this immediately.
2. **ESLint rule** `no-unversioned-controller` (`apps/api/eslint-rules/`, wired into
   `apps/api/eslint.config.js`): flags any `@Controller("...")` whose path is not
   `apiPath(...)` and not in the unversioned allowlist. `*.probe.ts` test controllers
   are exempt.

### Version manifest + client negotiation

- `GET /version` (unversioned, root) returns `{ current, default, supported[], docs, prefix }`
  — parsed by `ApiVersionManifestSchema` in `@workspace/shared`.
- On a **404** from the pinned version, the client transport (`use-api.ts`) fetches
  the manifest once (cached) and retries against `manifest.current` — the
  "deploy-any-or-die" pattern: web/admin can deploy before the API without breaking.

### Legacy-client escape hatch: `Accept-version`

Clients that can't change their URLs can pin a version with the `Accept-version: v2`
header. `main.ts` rewrites `/api/v1/...` → `/api/v2/...` before routing (only when the
requested version is actually served). Rate-limit buckets key on the version actually
served, so a v2 canary is never starved by v1 traffic during a migration.

### Response metadata

- Every versioned response carries `x-api-version: v1` (plus `x-request-id`).
- Deprecated versions (listed in `API_DEPRECATED_VERSIONS`) also get a `Sunset`
  header with the removal date, so clients can schedule their migration.

### Adding a new major (v2) — the checklist

1. Add `"v2"` to the `ApiVersion` union in `versioning.ts` and flip `API_VERSION`.
2. New/renamed endpoints: annotate the contract leaf `defineContract({ path, version: "v2" })`
   and serve it from a `@Controller(apiPath("/…", "v2"))`. The client transport
   derives `/api/v2/...` and **namespaces the react-query key** (`["v2", …]`), so
   v1 and v2 cache entries can never collide.
3. Keep v1 served during the migration (dual-version): one contract, one controller
   per version. The drift test covers both.
4. When v1 is fully drained, deprecate it: add it to `API_DEPRECATED_VERSIONS` with
   a `sunsetAt`, then remove it entirely after the date.

Swagger always mounts at `apiDocsPath()` — `v1` at `/v1/docs`, `v2` at `/v2/docs` —
with the legacy `/docs` URL 302-redirecting to the current one.

---

## 6. The client layer (packages/client)

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
<AuthLayout
	logo={…}
	brandName="Acme"
	tagline="…"
	features={["…", "…", "…"]}
	title="Welcome back"
	subtitle="Enter your credentials"
>
	<LoginForm mode="admin" redirectPath={…} footer={…} />
</AuthLayout>
```

- `<AuthLayout>` (in `@workspace/ui`) is the shared split-screen auth shell —
  dark brand panel + centered form panel with a theme toggle and back button.
  Both apps render it so their login pages stay pixel-identical.
- `<LoginForm>` takes a `mode` prop (`"web"` | `"admin"`). Admin mode swaps in
  `api.auth.adminLogin`, enforces `hasAdminAccess`, and renders the cookie
  isolation; web mode is the plain credential form. It renders the email +
  password fields, the submit button, an "Or continue with" divider and the
  social-login buttons (Google / Facebook / Twitter / GitHub — UI-only until
  a provider is wired). It imports presentational primitives from
  `@workspace/ui/components/form/*`.
- `<ClientAuthWrapper>` is the `next/navigation`-aware bridge (router push +
  refresh fed into `AuthProvider`), with `cookieNames` + `clientType`
  configurable per app.
- Both live in `packages/client` (not `packages/ui`) because they depend on
  `next/navigation` + the auth context — they are _auth_, not presentation.
  `next` is a peer dependency of `packages/client` so that coupling is honest.
  See rule 3 below for the layering carve-out this implies.

**The router (`endpoints.ts`) is the heart of type-safe API calls** — tRPC-flavoured,
REST under the hood. Every leaf pairs a shared `apiContract` leaf (method + path

- input schema — defined once in `packages/shared`) with the client-only
  concerns: the response envelope schema and the react-query key:

```ts
export const apiRouter = {
	auth: {
		me: defineQuery(apiContract.auth.me, { response: envelope(UserResponseSchema), queryKey: () => ["auth", "me"] }),
		login: defineMutation(apiContract.auth.login, { response: envelope(LoginResponseSchema), queryKey: () => ["auth", "login"] }),
	},
	geo: {
		countries: defineQuery(apiContract.geo.countries, {
			response: envelope(z.array(CountrySchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit, search }) => ["geo", "countries", page, limit, search],
		}),
		// …
	},
} as const;
```

A page uses it like this (input-first, same dot-chain on client and server):

```tsx
const { api } = useAuth();
const meQuery = api.auth.me.useQuery();
const user = meQuery.data?.data; // fully typed

// SSR twin — prefetchPage builds the same tree server-side:
prefetchPage((server) => [server.geo.countries({ page: 1, limit: 20 })]);
```

Because every endpoint carries its own Zod schemas, `useQuery`/`useMutation` results
are typed end-to-end — no manual response interfaces in the pages. `resolveRequest`
(the shared input → URL/body serializer) keeps client and server byte-identical,
so hydration keys always agree. The NestJS side validates the same inputs at the
boundary (`ZodValidationPipe(apiContract.*.input)` — strict 400 on malformed
input, see `apps/api/src/common/pipes/zod-validation.pipe.ts`).

---

## 7. The UI layer (packages/ui)

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

## 8. The apps

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
  `/me`, `/auth/permissions`, SuperAdmin user management), `sessions`
  (refresh / logout / logout-all / active sessions, root `GET /session`),
  `impersonation` (`/auth/impersonate/:userId`, `/auth/stop-impersonation`),
  `authorization` (RBAC admin APIs), `logs`.
- **The old root `AppController` is gone** — its endpoints were dissolved
  into their domain modules: `GET /` + `GET /health`
  → `HealthController`; `GET /session` → `SessionStatusController` (a root-`@Controller()`
  sibling of `SessionsController` in the sessions module). Signup is
  `POST /auth/signup` only (throttled). A module can host multiple
  controllers — use an unprefixed controller for root-pathed endpoints.
- **Configuration lives in a `@Global() ConfigModule** (`src/config/config.module.ts`)
that provides + exports `TypedConfigService`. It MUST be global: Nest instantiates
imported modules before the importing module's own providers, so a locally-provided
`TypedConfigService`is invisible to dynamic modules like`ThrottlerModule.forRootAsync({ inject: [TypedConfigService] })`— booting fails
with`UnknownDependenciesException`(THROTTLER:MODULE_OPTIONS) if it isn't global.
Do NOT re-register`TypedConfigService` in feature modules; inject the global one.
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
- Swagger docs live at `http://localhost:8080/v1/docs` (inferred from the same schemas).
- The `ResponseInterceptor` wraps every response in `{ success, data, meta }`.
- **NestJS v12 + Rspack prod bundle.** `pnpm dev` → `rspack --watch --mode development`
  (built-in SWC + `RunScriptWebpackPlugin` restarts Node after each rebuild →
  `dist/main.js`), `pnpm build` → `rspack build --mode production`, `pnpm start` →
  `node dist/main.js`. Config lives in `rspack.config.mjs` and derives dev vs prod
  from Rspack's CLI `--mode`, not `NODE_ENV` in package scripts.
- **Extensionless imports everywhere.** The API follows the repo's
  extensionless-import convention like every other package. Dev and prod both
  run the Rspack bundle (`dist/main.js`) under plain `node` — relative imports
  are inlined, bare packages stay external via `webpack-node-externals`. `tsx`
  remains for one-off scripts (seeds, CLI tools) only.
- **TypeScript note:** the API's `typescript` is pinned to **6.0.2** for the
  type-aware lint toolchain and `tsc --noEmit` (Rspack does not type-check).
  See `docs/typescript.md` → "TS6 shims".
---

## 9. How packages are resolved

Different consumers resolve `@workspace/*` packages differently — this is intentional:

| Package             | In web/admin (Next.js)                                                             | In api (NestJS/Node)                  |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| `@workspace/shared` | **Source** via the `development` export condition + `customConditions` in tsconfig | **Built** `dist/` output (proper ESM) |
| `@workspace/client` | Source via tsconfig path alias + `transpilePackages`                               | (not used)                            |
| `@workspace/ui`     | Source via tsconfig path alias + `transpilePackages`                               | (not used)                            |

- web/admin `next.config.ts` lists `transpilePackages: ["@workspace/client", "@workspace/ui", "@workspace/shared"]`, so the source files are compiled on the fly.
- The API resolves the built `dist/` of `@workspace/shared` (turbo builds shared first — `dev`/`build` tasks depend on `^build`).

---

## 10. Rules of thumb

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
