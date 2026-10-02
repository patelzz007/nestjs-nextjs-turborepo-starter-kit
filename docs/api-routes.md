---
title: "API Routes — Single Source of Truth"
tags: ["api", "routes", "contracts", "type-safety", "shared"]
description: "How every API endpoint path is defined once in api-routes.ts and consumed by contracts, controllers, and the client — with compile-time param enforcement and zero duplication."
order: 13
author: "Acme Inc."
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# API Routes — Single Source of Truth

> [!NOTE]
> **TL;DR.** Every API endpoint path lives in one place: `packages/shared/src/api-routes.ts`.
> Contracts, controllers, and the client transport all reference this tree instead of
> hardcoding path strings. This means: change a path once → it propagates everywhere at
> compile time. No drift. No typos. Full autocomplete.

---

## Table of Contents

1. [The problem](#1-the-problem)
2. [The solution](#2-the-solution)
3. [Architecture](#3-architecture)
4. [API reference](#4-api-reference)
5. [How contracts consume apiRoutes](#5-how-contracts-consume-apiroutes)
6. [How controllers consume apiRoutes](#6-how-controllers-consume-apiroutes)
7. [How the client consumes apiRoutes](#7-how-the-client-consumes-apiroutes)
8. [Adding a new endpoint](#8-adding-a-new-endpoint)
9. [Removing an endpoint](#9-removing-an-endpoint)
10. [Testing](#10-testing)
11. [Rules](#11-rules)
12. [Health probes](#12-health-probes)
13. [API docs (Swagger)](#13-api-docs-swagger)
14. [Idempotency](#14-idempotency)

---

## 1. The problem

Before `api-routes.ts`, every API endpoint path was a **hardcoded string** in two places:

```ts
// packages/shared/src/contracts/index.ts
requests: defineContract({ method: "GET", path: "/telescope/requests", input: TelescopeRequestListQuerySchema }),

// apps/api/src/modules/telescope/telescope.controller.ts
@Get(apiPath("/telescope/requests"))
```

If a controller path changed, you had to **manually find and update** every hardcoded string.
There was no compiler check — a typo or a missed update would silently break the endpoint
or cause a 404.

**With 40+ endpoints, this was a real risk.**

---

## 2. The solution

One file — `packages/shared/src/api-routes.ts` — defines **every API path template** once.

```ts
export const apiRoutes = {
  auth: {
    me: "/auth/me",
    permissions: "/auth/permissions",
    impersonate: { path: "/auth/impersonate/:userId", params: ["userId"] },
    stopImpersonation: "/auth/stop-impersonation",
    verifyEmail: { path: "/auth/verify-email/:token", params: ["token"] },
  },
  telescope: {
    requests: "/telescope/requests",                       // static
    requestDetail: { path: "/telescope/requests/:id", params: ["id"] },    // parameterized
  },
} as const satisfies Record<string, Record<string, RouteDef>>;
```

**Static routes** are plain strings. **Parameterized routes** are objects with `path` and `params`.

The `buildRoute()` function resolves parameterized routes to concrete URLs **with compile-time enforcement** — forget a required param and TypeScript catches it before you run the code.

```ts
import { apiRoutes, buildRoute } from "@workspace/shared";

buildRoute(apiRoutes.email.previewList)                          // → "/notifications/email-preview"
buildRoute(apiRoutes.email.previewDetail, { key: "welcome" })    // → "/notifications/email-preview/welcome"
buildRoute(apiRoutes.email.previewDetail, {})                    // ❌ Compile error: missing "key"
```

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    packages/shared/src/                          │
│                                                                 │
│   api-routes.ts        ← SINGLE SOURCE OF TRUTH                │
│   │                      defines every API path template        │
│   │                                                              │
│   ├── contracts/index.ts  ← consumes apiRoutes for paths        │
│   │   apiContract.auth.me  →  path: apiRoutes.auth.me           │
│   │                                                              │
│   └── schemas/            ← Zod input/output schemas           │
│                             (unchanged — these validate bodies, │
│                              not paths)                         │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
┌────────────────────┐              ┌────────────────────────────┐
│   apps/api/        │              │   packages/client/         │
│   NestJS controllers│             │   endpoints.ts             │
│   @Get(apiPath(    │              │   apiRouter.auth.me        │
│     apiRoutes.*))  │              │     .path === apiRoutes.*  │
└────────────────────┘              └────────────────────────────┘
         │                                        │
         ▼                                        ▼
    REST API                              Next.js pages
   (port 8080)                          (web:3000, admin:3001)
```

### What changes vs. what stays the same

| Layer | Before | After |
|-------|--------|-------|
| **`api-routes.ts`** | Did not exist | **New** — single source of truth for paths |
| **`contracts/index.ts`** | Hardcoded path strings (`"/telescope/requests"`) | References `apiRoutes.telescope.requests` |
| **NestJS controllers** | Hardcoded path strings in `@Get()` / `@Post()` | References `apiRoutes.*` (path is derived) |
| **Client `endpoints.ts`** | Imports `apiContract` which already has the path | **Unchanged** — it reads the path from `apiContract` |
| **Swagger** | Inferred from `apiContract` | **Unchanged** — Swagger reads the same path |
| **Zod schemas** | Validate request/response bodies | **Unchanged** — schemas don't know about paths |

---

## 4. API reference

### Types

```ts
/** A parameterized route with named params. */
interface ParamRoute<ParamNames extends string[]> {
  readonly path: string;     // e.g. "/backup/:id/download"
  readonly params: ParamNames;  // e.g. ["id"]
}

/** A static route (plain string) or a parameterized route. */
type RouteDef = string | ParamRoute<string[]>;

/** Extract the `path` string from any RouteDef. */
type RoutePath<T extends RouteDef> = T extends ParamRoute<string[]> ? T["path"] : T;

/** A value that can appear in a query string. */
type QueryValue = string | number | boolean;
```

### `buildRoute(route, params?)`

Resolves a route definition to a concrete URL string.

**Static routes** — returned as-is, no second argument needed:
```ts
buildRoute(apiRoutes.telescope.requests)  // → "/telescope/requests"
buildRoute(apiRoutes.auth.me)             // → "/auth/me"
```

**Parameterized routes** — all params are required at compile time:
```ts
buildRoute(apiRoutes.telescope.requestDetail, { id: "abc-123" })
// → "/telescope/requests/abc-123"

buildRoute(apiRoutes.backup.toggleSchedule, { id: "sch-1" })
// → "/backup/schedules/sch-1/toggle"
```

**Numeric params** are stringified automatically:
```ts
buildRoute(apiRoutes.telescope.requestDetail, { id: 42 })
// → "/telescope/requests/42"
```

**Missing params** throw at runtime (and fail at compile time):
```ts
buildRoute(apiRoutes.telescope.requestDetail, {})
// ❌ TypeScript error: Property "id" is missing
// Runtime: throws "Missing required parameter: id"
```

**Extra params** are silently ignored (safe for spread operators):
```ts
buildRoute(apiRoutes.telescope.requestDetail, { id: "x", extra: "ignored" })
// → "/telescope/requests/x"
```

### `buildQuery(base, params)`

Appends query parameters to a base path. Null/undefined values are **omitted** (no empty
`?key=` in the URL). Special characters are URL-encoded.

```ts
buildQuery("/telescope/requests", { sort: "duration", page: 2 })
// → "/telescope/requests?sort=duration&page=2"

buildQuery("/telescope/requests", { sort: "duration", filter: null })
// → "/telescope/requests?sort=duration"   (null is omitted)

buildQuery("/search", { q: "hello world&foo=bar" })
// → "/search?q=hello%20world%26foo%3Dbar"  (encoded)
```

### Combining `buildRoute` + `buildQuery`

```ts
const base = buildRoute(apiRoutes.telescope.requestDetail, { id: "req-123" });
const url = buildQuery(base, { tab: "sql" });
// → "/telescope/requests/req-123?tab=sql"
```

---

## 5. How contracts consume apiRoutes

In `packages/shared/src/contracts/index.ts`, every `defineContract()` call references
`apiRoutes` instead of a hardcoded string:

```ts
import { apiRoutes } from "../api-routes";

export const apiContract = {
  auth: {
    me: defineContract({
      method: "GET",
      path: apiRoutes.auth.me,           // ← reference, not a string
      input: z.undefined(),
      response: singleResponse(UserResponseSchema),     // ← what the endpoint answers (ADR 022)
    }),
    verifyEmail: defineContract({
      method: "POST",
      path: apiRoutes.auth.verifyEmail.path,  // ← extract .path for param routes
      input: VerifyEmailSchema,
      response: singleResponse(VerifyEmailResponseSchema),
    }),
  },
  product: {
    list: defineContract({
      method: "GET",
      path: apiRoutes.product.list,
      input: ProductListQuerySchema,
      response: paginatedResponse(ProductSchema),       // ← list grammar → paginated envelope
    }),
    detail: defineContract({
      method: "GET",
      path: apiRoutes.product.detail.path,  // ← .path for param routes
      input: ProductIdParamSchema,
      response: singleResponse(ProductSchema),
    }),
  },
};
```

> [!TIP]
> **Static routes** — use `apiRoutes.x.y` directly (it's already a string).
> **Parameterized routes** — use `apiRoutes.x.y.path` to extract the path string.
> **Response** — `singleResponse(Schema)` (`{ success, data, meta }`) or
> `paginatedResponse(ItemSchema)` (`{ success, data: Item[], meta: { …pagination } }`); the
> API handler uses the **same** schema reference (see [§13](#13-api-docs-swagger)).

---

## 6. How controllers consume apiRoutes

NestJS controllers import `apiRoutes` and use `apiPath()` to build the versioned
controller prefix, then reference the route path for individual endpoints:

```ts
import { apiRoutes } from "@workspace/shared";
import { apiPath } from "@workspace/shared";

@Controller(apiPath("/telescope"))
export class TelescopeController {
  @Get(apiRoutes.telescope.requests)           // → @Get("/telescope/requests")
  async listRequests(...) { ... }

  @Get(apiRoutes.telescope.requestDetail.path) // → @Get("/telescope/requests/:id")
  async getRequestDetail(...) { ... }
}
```

> [!NOTE]
> `apiPath()` prefixes with `/api/v1` — so the full wire path becomes
> `/api/v1/telescope/requests`. The `apiRoutes` path does **not** include the version
> prefix — that's `apiPath()`'s job.

---

## 7. How the client consumes apiRoutes

The client doesn't import `apiRoutes` directly — it reads the path from `apiContract`,
which already references `apiRoutes`. This is a **three-hop chain** that ensures no
duplication:

```
api-routes.ts  →  contracts/index.ts  →  client/endpoints.ts
     │                    │                      │
  path template      apiContract leaf      apiRouter.*.path
```

```ts
// packages/client/src/lib/api/endpoints.ts
import { apiContract } from "@workspace/shared";

export const apiRouter = {
  auth: {
    me: defineQuery(apiContract.auth.me, {
      queryKey: () => ["auth", "me"],
    }),
  },
  product: {
    list: defineQuery(apiContract.product.list, {
      queryKey: (input) => listQueryKey(["product", "list"], input),
    }),
  },
};
```

The path flows from `apiRoutes` → `apiContract` → `apiRouter`. No page ever touches
a raw path string. The response envelope flows the same way: `defineQuery` / `defineMutation`
take `contract.response.envelope`, and the fetch layer parses every body with it
(`parseResponseContract`, `packages/client/src/lib/api/response-contract.ts`) — a body that does
not match becomes a typed `ApiResponseContractError` instead of reaching a component.

---

## 8. Adding a new endpoint

### Step 1: Add the route to `api-routes.ts`

```ts
// packages/shared/src/api-routes.ts
export const apiRoutes = {
  // ... existing routes
  telescope: {
    // ... existing routes
    /** NEW: fetch a single job's execution history. */
    jobHistory: { path: "/telescope/jobs/:id/history", params: ["id"] },
  },
} as const satisfies Record<string, Record<string, RouteDef>>;
```

### Step 2: Add the Zod input schema (if needed)

If the endpoint has a unique input shape, create a schema in `packages/shared/src/schemas/domain/telescope.ts`:

```ts
export const TelescopeJobHistoryQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
}).strict();
```

### Step 3: Add the contract leaf

```ts
// packages/shared/src/contracts/index.ts
import { TelescopeJobHistoryQuerySchema } from "../schemas/domain/telescope";

// Inside apiContract.telescope:
jobHistory: defineContract({
  method: "GET",
  path: apiRoutes.telescope.jobHistory.path,
  input: TelescopeJobHistoryQuerySchema,
  response: singleResponse(TelescopeJobHistoryResponseSchema), // a named, NON-strict shared schema
}),
```

### Step 4: Add the client router entry

```ts
// packages/client/src/lib/api/endpoints.ts — the response comes from the contract leaf
jobHistory: defineQuery(apiContract.telescope.jobHistory, {
  queryKey: (q) => ["telescope", "jobs", q.id, "history", q],
}),
```

### Step 5: Add the NestJS controller endpoint

```ts
// apps/api/src/modules/telescope/telescope.controller.ts
import { ZodParams, ZodQuery } from "../../common/decorators/zod-request.decorators";

@Get(apiRoutes.telescope.jobHistory.path)
@UseGuards(AuthGuard, AdminAccessGuard)
@ZodResponse(TelescopeJobHistoryResponseSchema)
public async getJobHistory(
  @ZodParams(TelescopeJobIdParamSchema) params: TelescopeJobIdParam,
  @ZodQuery(apiContract.telescope.jobHistory.input) query: TelescopeJobHistoryQuery,
): Promise<TelescopeJobHistoryResponse> {
  return this.telescopeService.getJobHistory(params.id, query);
}
```

Every `@Body` / `@Query` / `@Param` input goes through a Zod request decorator — it validates
**and** documents the input from the same schema — and every handler carries exactly one
response decorator (`@ZodResponse` / `@ZodPaginatedResponse` / `@ZodRawResponse`) with the
schema of its contract leaf (see [§13](#13-api-docs-swagger)). A `POST` that creates something
passes `{ status: HttpStatus.CREATED }`; never add a separate `@HttpCode`.

### Step 6: Update tests

```ts
// packages/shared/src/api-routes.test.ts
it("resolves job history route", () => {
  expect(buildRoute(apiRoutes.telescope.jobHistory, { id: "job-1" }))
    .toBe("/telescope/jobs/job-1/history");
});
```

---

## 9. Removing an endpoint

1. Remove the route from `api-routes.ts`
2. Remove the contract leaf from `contracts/index.ts`
3. Remove the client router entry from `endpoints.ts`
4. Remove the controller method
5. Remove any tests referencing the route
6. Run `npx tsc --noEmit` — the compiler will catch any dangling references

Because everything references the single source, removing a route from `api-routes.ts`
causes **compile errors everywhere it's used** — you can't have a stale reference.

---

## 10. Testing

The test suite (`packages/shared/src/api-routes.test.ts`) covers:

| Test | What it checks |
|------|---------------|
| **Shape** | All top-level groups exist (`auth`, `email`, `backup`, `telescope`) |
| **Static routes** | Plain strings are returned as-is by `buildRoute` |
| **Single param** | `:id` is substituted correctly |
| **Numeric params** | Numbers are stringified (`42` → `"42"`) |
| **Multiple params** | Both `:key` and other params are substituted |
| **Missing params** | Throws `"Missing required parameter: <name>"` |
| **Extra params** | Silently ignored (safe for `...rest`) |
| **Query strings** | Null/undefined omitted, special chars encoded |
| **Combined** | `buildRoute` + `buildQuery` chain works end-to-end |

Run the tests:
```bash
pnpm --filter @workspace/shared test
```

---

## 11. Rules

1. **Every API path must be defined in `api-routes.ts`.** No hardcoded path strings in
   contracts, controllers, or client code. The only exception is truly unversioned root
   routes (`GET /`, `GET /health`, `GET /health/live`, `GET /health/ready`,
   `GET /health/deep`, `GET /version`, `POST /notifications/email-webhook`).

2. **Static routes are plain strings. Parameterized routes are `{ path, params }` objects.**
   The `params` array lists every `:paramName` segment in the path — in order.

3. **Contracts reference `apiRoutes` directly.** Use `.path` for parameterized routes,
   use the string directly for static routes.

4. **`buildRoute()` enforces params at compile time.** If a route requires `{ id }`, you
   **must** pass `{ id }` — TypeScript won't let you forget.

5. **`buildQuery()` omits null/undefined.** Pass `null` or `undefined` for optional query
   params — they won't appear in the URL.

6. **Tests live alongside the implementation.** Every route in `api-routes.ts` should have
   a corresponding test in `api-routes.test.ts`.

7. **The route tree mirrors the contract tree.** `apiRoutes.auth.*` → `apiContract.auth.*`
   → `apiRouter.auth.*`. Same shape, same nesting, same naming.

---

_Last updated: August 20, 2026_

---

## 12. Health probes

Unversioned, public (`@Public()`), served by `HealthController`
(`apps/api/src/modules/health`). All answer in the standard envelope; failures use the
[error envelope](./error-model.md).

| Route | Probe | Touches the DB | 200 when | Fails with |
|---|---|---|---|---|
| `GET /health/live` | **liveness** (restart policy) | never | the process answers | — (no answer = dead) |
| `GET /health/ready` | **readiness** (load-balancer rotation) | `SELECT 1`, 2 s timeout | startup finished, not draining, DB up, every **critical** indicator up | 503 `SERVICE_UNAVAILABLE`, `error.details.checks` lists every probe |
| `GET /health` | *deprecated alias* for existing uptime monitors | yes | started (reports `db: "connected" \| "disconnected"`) | 503 while starting/draining only |
| `GET /health/deep` | human/ops diagnostics with module reports | yes | started | 503 while starting/draining only |

Why liveness never touches dependencies: restarting a process does not fix a database outage,
and killing an instance that is draining (`markNotReady()` during graceful shutdown) drops
in-flight requests.

Module indicators (queue/BullMQ, Kafka, RabbitMQ) are registered in
`module-health-indicators.provider.ts` as **non-critical**: they are reported by
`/health/ready` and `/health/deep` but never flip readiness, because every instance would fail
a shared broker probe at the same moment and a broker blip would become a full API outage
(jobs and events are buffered by BullMQ retries and the transactional outbox). Mark an
indicator `critical: true` only when the API truly cannot serve requests without it. See
[ADR 006](./adr/006-module-health-indicators.md).

Kubernetes example:

```yaml
livenessProbe:  { httpGet: { path: /health/live,  port: 8080 }, periodSeconds: 10 }
readinessProbe: { httpGet: { path: /health/ready, port: 8080 }, periodSeconds: 5, failureThreshold: 2 }
```

---

## 13. API docs (Swagger)

Swagger UI is mounted at `apiDocsPath()` (`/v1/docs`; `/docs` redirects there) with the
OpenAPI document at `/v1/docs-json` / `/v1/docs-yaml`. Exposure is decided by
`resolveApiDocsPolicy()` in `apps/api/src/config/api-config.schema.ts`:

| `SWAGGER_ENABLED` | Every `NODE_ENV` |
|---|---|
| unset | **on**, public |
| `1` / `true` | on, public |
| `0` / `false` | off |

The docs are **public by design** — no login, no role. They describe the contract, not data:
every endpoint enforces its own authentication and authorization (`AuthGuard`, the
authorization kernel), so hiding the description behind a token protects nothing and only
makes the API harder to integrate with.

**Calling protected endpoints from Swagger UI — no token to paste.** `AuthGuard` accepts a
`Bearer` token or a session cookie, and picks the cookie by `X-Client-Type`
(`admin` → `adminAccessToken`, `merchant` → `merchantAccessToken`, otherwise `accessToken`).
Swagger UI sends **`X-Client-Type: admin` by default** (`swaggerClientTypeInterceptor` in
`apps/api/src/common/api-docs.ts`), so:

1. Log in to the admin panel (or call `POST /auth/login` from Swagger — it then sets the
   admin cookies), and open the docs on the **same host as the cookie**:
   `http://localhost:8080/v1/docs` (with `COOKIE_DOMAIN=localhost` the browser never sends
   the cookies to `http://127.0.0.1:8080`).
2. "Try it out" — the browser attaches the httpOnly `adminAccessToken` cookie
   (`withCredentials`).

To act as a web or merchant session instead, set **X-Client-Type** under **Authorize** to
`web` / `merchant` (persisted across reloads). A token entered under **bearer** takes
priority over any cookie. Every operation declares this, derived from the same `@Public()`
metadata `AuthGuard` enforces (`applyOperationSecurity`): protected routes accept the bearer
token *or* the selected session cookie; `@Public()` routes require nothing. A blank
`Authorization: Bearer ` header is ignored, so it never hides a valid cookie. Turn the docs off per deployment with `SWAGGER_ENABLED=0`; any other value
(e.g. `yes`) fails boot. The same document is committed as `docs/generated/openapi.json`
([response contracts](./response-contracts.md)).

### Request bodies, query strings and path params — declared once, from zod

TypeScript types are erased at runtime, so a handler written as
`@Body(new ZodValidationPipe(Schema)) body: z.output<typeof Schema>` is validated but invisible to
Swagger (it reflects `Object` → no `requestBody`, no parameters, nothing to "Try it out"). Declare
every request input with the decorators in `apps/api/src/common/decorators/zod-request.decorators.ts`
instead — one schema, two jobs:

| Input | Decorator | Documented as |
|---|---|---|
| JSON body | `@ZodBody(Schema) body: Input` | `requestBody` (`application/json`) |
| Query string (object schema) | `@ZodQuery(Schema) query: Query` | one `in: query` parameter per key |
| Paginated list query (`defineListQuery(...).schema`) | `@ZodListQuery(Schema) query: ListQuery` | `page`, `limit`, `cursor`, `sort`, `filter`, `search` (+ resource params) as `in: query` parameters |
| All route params (object schema) | `@ZodParams(Schema) params: Params` | one `in: path` parameter per key |
| One route param (value schema) | `@ZodParam("id", UuidParamSchema) id: string` | `in: path` parameter `id` |

```ts
@Post()
public create(@ZodBody(CreateProductSchema) body: z.output<typeof CreateProductSchema>) { … }

@Get(":id")
public get(@ZodParams(ProductIdParamSchema) params: { id: string }) { … }
```

- **Validation is unchanged.** Each decorator applies the existing `ZodValidationPipe` (compiled
  Ajv, `400 { message: "Validation failed", errors: [{ path, message, code }] }` → the
  `VALIDATION_ERROR` envelope in `docs/error-model.md`).
- **Documentation is derived.** The schema is attached through Nest 12's native
  `@Body({ schema, pipes })` option; `buildOpenApiDocument()` (`apps/api/src/common/api-docs.ts`)
  converts it with `zodStandardSchemaConverter` (`common/openapi/zod-openapi-schema.ts`, zod's
  `z.toJSONSchema(..., { target: "openapi-3.0", io: "input" })`). Required keys, types, enums,
  formats, min/max, defaults, `nullable`, and `.describe()` / `.meta({ description, example })`
  all land in the document; Swagger UI pre-fills "Try it out" from them. `io: "input"` means a
  `.default()` key is shown as optional — that is what a client may omit.
- **Describe fields in the schema, not the controller.** Add `.describe("…")` or
  `.meta({ description: "…", example: … })` to the shared zod schema. Do not add `@ApiBody`,
  `@ApiQuery` or `@ApiParam` that restate the schema — they are a second source of truth
  (rules/05-contracts-zod-api.md). Keep `@ApiBody` only for inputs no zod schema validates
  (e.g. a raw webhook body verified by signature).
- **Recursive schemas** (`z.lazy`, e.g. `JsonValueSchema`) become `components.schemas` entries
  named `ZodSchema_<hash>`; the names are deterministic, so identical schemas share one component.
- **List endpoints use `@ZodListQuery`.** It nests `filter[field][op]` bracket keys
  (`BracketQueryPipe`, prototype-pollution safe) and parses with zod so the handler receives the
  typed filter AST; the `sort` / `filter` parameter descriptions list the whitelisted fields. The
  grammar, the Prisma translators and the client adapter are in [List queries](./list-queries.md).
- `@ZodParams(schema)` validates the whole `params` object, so its schema must cover **every**
  `:segment` of the route (extend `OrganizationSlugParamSchema` rather than mixing it with a bare
  `@Param("otherId")`).

### Responses — documented AND enforced, from the same zod schema

Every route handler declares its response with exactly one decorator from
`apps/api/src/common/decorators/zod-response.decorators.ts` (ADR 022, guide:
[Response contracts](./response-contracts.md)):

| Handler returns | Decorator | Client receives |
|---|---|---|
| one value | `@ZodResponse(Schema)` | `{ success: true, data, meta: { correlationId, timestamp } }` |
| one list-grammar page (`PaginatedServiceResult`) | `@ZodPaginatedResponse(ItemSchema)` | `{ success: true, data: Item[], meta: { limit, total, page, totalPages, nextCursor, hasNext, hasPrevious, correlationId, timestamp } }` |
| a body consumed outside the typed client with a fixed raw shape (the unversioned `GET /version` manifest) | `@ZodRawResponse(Schema)` | the value itself, no envelope |

Options: `{ status?: HttpStatus, description?: string }` — `status` (default `200`) is both sent
(`HttpCode`) and documented.

```ts
@Post()
@ZodResponse(ProductSchema, { status: HttpStatus.CREATED, description: "Created product" })
public create(@ZodBody(CreateProductSchema) body: CreateProductInput): Promise<Product> { … }

@Get()
@ZodPaginatedResponse(ProductSchema, { description: "Paginated list of products" })
public list(@ZodListQuery(ProductListQuerySchema) query: ProductListQuery): Promise<PaginatedServiceResult<Product>> { … }
```

- **Documented** — the success status with the full envelope (converted with
  `zodStandardSchemaConverter`, `io: "output"`), plus `4XX` and `5XX` → the standard error envelope
  (`ApiErrorResponseDto`, [Error model](./error-model.md)). Keep specific error docs
  (`@ApiResponse({ status: 409, type: ApiErrorResponseDto, description })`) where they help.
- **Enforced** — the global `ResponseInterceptor` parses the handler result with the schema, once.
  Unknown keys are **stripped** (an internal field — a hash, a token, a cost price — can never reach
  the wire); a mismatch is a server bug: logged at `error` with the route and failing paths (never
  the values), answered with `500 INTERNAL_ERROR`. A JSON route **without** a contract is refused
  the same way before its handler runs.
- **Type-checked** — the decorator only compiles on a handler whose return type is assignable to
  the schema's input: a controller returning a Prisma row with `bigint` / `Date` columns does not
  build. Map to the contract DTO (epoch-ms numbers) in the service or repository.
- **Response schemas are never `.strict()`** — the API strips, and clients must ignore fields added
  later (rules/05 change-safety matrix). The response document therefore never says
  `additionalProperties: false`; request bodies still do.
- **Pass-through, deliberately**: `@Sse()` streams and `@SkipEnvelope()` routes that write their own
  reply (binary downloads) — currently `EmailLogController.stream` and
  `FilesController.localDownload`. Adding another is a reviewed decision; the e2e test pins the list.

`apps/api/test/openapi-document.e2e-spec.ts` builds the real document and fails when any
`@Body` / `@Query` / `@Param` is not validated by `ZodValidationPipe` with its schema attached, when
an operation that takes a body has no `requestBody`, when a validated query/path key or a
`{templated}` path segment is undocumented, or when a `$ref` dangles — and, for responses, when a
JSON route has no contract, when the sent status differs from the documented one, when the success
/ `4XX` / `5XX` responses are missing, when a response schema is closed (`.strict()`), or when an
`apiContract` leaf and its handler use different response schemas. Snapshots of
`POST /api/v1/product` and `POST /api/v1/auth/login` pin representative bodies.

### Exported artifact — `docs/generated/openapi.json`

The same document is committed as `docs/generated/openapi.json`: keys sorted at every depth,
two-space indent, trailing newline (`serializeOpenApiArtifact`,
`apps/api/src/common/openapi/openapi-artifact.ts`), so it is reproducible byte for byte and every
API change shows up as a reviewable diff. Regenerate it after changing a route, a request schema
or a response contract:

```bash
pnpm openapi:export          # = turbo run openapi:export --filter=@workspace/api (needs Postgres + Redis, like test:e2e)
```

`apps/api/test/openapi-artifact.e2e-spec.ts` (part of `pnpm --filter @workspace/api test:e2e`)
fails while the committed file is stale; `openapi:export` is that spec run with `--update`.

---

## 14. Idempotency

Non-idempotent endpoints that clients may retry (creates, charges, submits) opt in with
`@Idempotent()` (`apps/api/src/platform/idempotency/idempotent.decorator.ts`); `POST /product`
is the reference usage. The owning module must import `PlatformResourceModule`.

The client sends an `Idempotency-Key` header — any 8–128 characters of `[A-Za-z0-9._:-]`,
typically a UUID generated once per user action and reused for every retry of that action.

| Situation | Response |
|---|---|
| No header | Runs normally (`@Idempotent({ required: true })` → 400 `IDEMPOTENCY_KEY_REQUIRED`). |
| Malformed header / sent twice | 400 `VALIDATION_ERROR` |
| No authenticated principal | 401 — keys are namespaced per caller, anonymous keys are refused. |
| First request with a key | Runs; a successful JSON result is stored for **24 h**. |
| Identical retry (same caller, route, URL, canonical body) | The stored result is **replayed without running the handler**, same status, header `Idempotent-Replayed: true`, fresh `meta.correlationId`. |
| Same key, different method/URL/body | 409 `IDEMPOTENCY_KEY_REUSED` |
| Same key while the first request is still running | 409 `IDEMPOTENCY_REQUEST_IN_PROGRESS` + `Retry-After: 1` — retry and you get the replay. |
| The handler failed (any error) | The key is released — errors are **not** cached, so a retry with the same key re-executes. |

How it works: the ledger is `platform_resource_idempotency_records` (RLS bypass-only, accessed
under the allowlisted `http.idempotency` system operation). A row is `IN_PROGRESS` with a
60-second **lease** (`expiresAt`) while the handler runs, then `COMPLETED` with the response and a
24-hour replay window. The unique `(scope, idempotency_key)` index guarantees exactly one of two
concurrent requests acquires a key; expired rows (abandoned lease or finished window) are taken
over with a conditional update — requests never delete rows. An hourly BullMQ job
(`idempotency.retention` queue, `idempotency.retention` system operation) deletes rows that expired
more than 1 hour ago, in batches of 500 with a 60-second budget per run; an expired row is already
equivalent to an unused key, so this changes nothing a client can observe (see
[Messaging — Retention](infrastructure/messaging.md#retention)). The request fingerprint is a SHA-256 of the
method, full URL and the body serialized with sorted keys, so `{a,b}` and `{b,a}` are the same
request.

> [!WARNING]
> HTTP-layer idempotency is **at-least-once under crashes**: the business write and the ledger
> update are separate transactions, so a process that dies after committing the write but before
> storing the response frees the key after the lease and the retry runs again. For payments and
> other operations that must be exactly-once, write the business row and the idempotency record
> in the **same** transaction (`PlatformResourceMutationService.runMutation`) and back it with a
> unique business key — see `rules/09-messaging-and-jobs.md`.

The IETF draft (`draft-ietf-httpapi-idempotency-key-header`) suggests 422 for a reused key; this
API uses 409 for both conflicts and distinguishes them by `error.code`.
