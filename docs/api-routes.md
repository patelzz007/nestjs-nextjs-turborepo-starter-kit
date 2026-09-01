---
title: "API Routes — Single Source of Truth"
tags: ["api", "routes", "contracts", "type-safety", "shared"]
description: "How every API endpoint path is defined once in api-routes.ts and consumed by contracts, controllers, and the client — with compile-time param enforcement and zero duplication."
order: 13
author: "Acme Inc."
lastUpdated: 1787443200000
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

buildRoute(apiRoutes.telescope.requests)                    // → "/telescope/requests"
buildRoute(apiRoutes.telescope.requestDetail, { id: "abc" })  // → "/telescope/requests/abc"
buildRoute(apiRoutes.telescope.requestDetail, {})            // ❌ Compile error: missing "id"
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
    }),
    verifyEmail: defineContract({
      method: "POST",
      path: apiRoutes.auth.verifyEmail.path,  // ← extract .path for param routes
      input: z.object({ token: VerifyEmailTokenParamSchema }).strict(),
    }),
  },
  telescope: {
    requests: defineContract({
      method: "GET",
      path: apiRoutes.telescope.requests,
      input: TelescopeRequestListQuerySchema,
    }),
    requestDetail: defineContract({
      method: "GET",
      path: apiRoutes.telescope.requestDetail.path,  // ← .path for param routes
      input: TelescopeIdInputSchema,
    }),
  },
} as const;
```

> [!TIP]
> **Static routes** — use `apiRoutes.x.y` directly (it's already a string).
> **Parameterized routes** — use `apiRoutes.x.y.path` to extract the path string.

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
      response: envelope(UserResponseSchema),
      queryKey: () => ["auth", "me"],
    }),
  },
  telescope: {
    requests: defineQuery(apiContract.telescope.requests, {
      response: envelope(z.object({ list: TelescopeRequestListResponseSchema }).strict()),
      queryKey: (q) => ["telescope", "requests", q],
    }),
  },
} as const;
```

The path flows from `apiRoutes` → `apiContract` → `apiRouter`. No page ever touches
a raw path string.

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
}),
```

### Step 4: Add the client router entry

```ts
// packages/client/src/lib/api/endpoints.ts
jobHistory: defineQuery(apiContract.telescope.jobHistory, {
  response: envelope(z.object({ list: TelescopeJobHistoryResponseSchema }).strict()),
  queryKey: (q) => ["telescope", "jobs", q.id, "history", q],
}),
```

### Step 5: Add the NestJS controller endpoint

```ts
// apps/api/src/modules/telescope/telescope.controller.ts
@Get(apiRoutes.telescope.jobHistory.path)
@UseGuards(AuthGuard, AdminAccessGuard)
public async getJobHistory(
  @Query() query: CreateZodDto(TelescopeJobHistoryQuerySchema),
): Promise<TelescopeJobHistoryResponse> {
  return this.telescopeService.getJobHistory(query);
}
```

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
   routes (`GET /`, `GET /health`, `POST /notifications/email-webhook`).

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
