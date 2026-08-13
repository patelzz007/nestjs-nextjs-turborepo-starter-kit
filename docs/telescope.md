---
title: "Telescope for NestJS"
description: "An in-house, Laravel-Telescope-style observability console for the NestJS API — requests, SQL, exceptions, mail and logs — with the dashboard built into the admin app. Full blueprint: capture layer, data model, API, and UI."
order: 18
author: "Acme Inc."
lastUpdated: "2026-08-12"
coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80"
---

# Telescope for NestJS

> [!NOTE] **The one feature worth building.** Laravel Telescope gives PHP developers a beautiful
> application-debugging dashboard out of the box — requests, queries, jobs, exceptions, logs,
> mail, scheduled tasks, events — and NestJS has no equivalent first-party experience. Assembling
> OpenTelemetry + Grafana + Jaeger + Sentry + BullMQ + Prisma logging works, but that's exactly
> the problem: **you have to assemble it.** This document is the blueprint for building our own
> Telescope-shaped observability console into this monorepo, with the dashboard living in the
> **admin app** (`localhost:3001/telescope`).
>
> **Why this one:** every Node team ends up with a frankenstein of `console.log` +
> `JSON.stringify`, a 400-line `debug.ts`, and pino logs they `tail -f` — Datadog in prod,
> nothing in dev. The Laravel Telescope experience (opinionated, visual, near-zero
> config) is strictly better. We build it **for ourselves, in this monorepo**, NestJS +
> Express only — and if it's as good as it should be, the extraction path (§13) is clean.
> If we build only one developer-experience feature, this is the one.
>
> **Ground truth** (verified 2026-08-12):
>
> - `CorrelationIdMiddleware` already stamps `req.correlationId` + `X-Correlation-Id`.
> - `ResponseInterceptor` already captures `request.responseData` and wraps every response in
>   `{ success, data, meta: { correlationId, timestamp } }`.
> - `LogService` (`apps/api/src/modules/logs/logs.service.ts`) is the one logging entry point;
>   `docs/logging.md` is the blueprint for a Datadog-style log store with a `Log` table.
> - `PrismaService` is a `@Global()` provider; `TypedConfigService` comes from the `@Global()
>   ConfigModule` (`src/config/config.module.ts`) — inject it anywhere, never re-register it.
> - `EmailSenderService` already writes `EmailLog` rows (resendId, status, to, template) —
>   Telescope's **Mail** tab reuses that table; do not duplicate it.
> - The admin app already has the `DataTable` (search, filters, sorting, pagination, export,
>   column visibility, bulk actions, inline editing, drag rows) — Telescope's list pages are
>   thin shells over it.

> [!IMPORTANT] **Implementation status — shipped 2026-08-12 (v1) + 20 improvements
> batch (same day).** Milestones M0–M5 (§11) are implemented, lint/typecheck/test-clean,
> and verified end-to-end (boot the API, hit an endpoint, open `/telescope` in the admin
> app). A second batch then shipped **all 20 roadmap improvements** (§15.1): the Postgres
> store (§6.2), the SSE live stream (§9.4), smarter eviction, retention cron, sampling,
> request diffing, the N+1 detector, the waterfall timeline, console capture, the
> `telescope` CLI, an ESLint ban on `any/unknown/never` in the module, and a doc-gen
> script (§20). Suite is now **117 API + 353 admin tests**, all green. The only remaining
> ⏳ items are the standalone exception filter (§5.4 — folded into the interceptor on
> purpose) (the §15.2 new-feature backlog — all 20 — shipped with the §15.4 batch).

---

## Table of Contents

1. [The vision](#1-the-vision)
2. [What "Telescope" means in this repo](#2-what-telescope-means-in-this-repo)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [Data model](#4-data-model)
5. [Capture layer — how data gets recorded](#5-capture-layer--how-data-gets-recorded)
6. [Storage strategy](#6-storage-strategy)
7. [Telescope API](#7-telescope-api)
8. [Admin dashboard UI](#8-admin-dashboard-ui)
9. [Design & UX spec](#9-design--ux-spec)
10. [Security & hygiene](#10-security--hygiene)
11. [Phased implementation plan](#11-phased-implementation-plan)
12. [Testing plan](#12-testing-plan)
13. [Out of scope & future work](#13-out-of-scope--future-work)
14. [Appendix](#14-appendix)

---

## 1. The vision

Open `http://localhost:3001/telescope` in the admin app and get:

```
Telescope                                    [Last 30 min ▾]  [Live ▸]
─────────────────────────────────────────────────────────────────────
  Requests       SQL           Exceptions      Mail        Logs
  ──────────────  ─────────────  ─────────────  ─────────   ─────────
  124 req/min     812 queries    3 new          7 sent      1.2k rows
  avg 82ms        slowest 731ms  /api/orders×2  1 delivered
  slowest 842ms
─────────────────────────────────────────────────────────────────────
  Requests                          status  method  path            ms
  POST /api/orders                  200     POST    /api/orders     842ms
  GET  /api/users                   200     GET     /api/users      124ms
  GET  /api/products                404     GET     /api/products   42ms
```

Click `POST /api/orders` and get the full story:

```
Request                                  POST /api/orders   842ms   200
├── Headers        (sanitized)
├── Body           (sanitized)
├── User           { id, email (masked), roles }
├── Response       { success: true, data: {…}, meta: { correlationId } }
├── Timeline
│   ├── Middleware       2ms
│   ├── Auth             4ms
│   ├── Guards           1ms
│   ├── Prisma         731ms
│   ├── Service logic   62ms
│   ├── Queue           12ms
│   └── Serialization    5ms
└── SQL queries          6 queries, 731ms total
    ├── SELECT * FROM "orders" WHERE …          412ms
    ├── SELECT * FROM "users"  WHERE …          228ms
    └── …
```

That single screen answers the three questions every debugging session starts with:
**what happened, how long did each piece take, and what did the database do.**

### The guiding principles

1. **Local-dev first.** Telescope is a *development* console. It is not a production APM.
   It **fail-closes**: `NODE_ENV=production` auto-disables capture unless
   `TELESCOPE_ENABLED=true` is set explicitly — and even then it samples hard (§6.4).
   The complexity budget is sized for "explain a request on my laptop", not
   "monitor 10k rps".
2. **Zero external SaaS, zero required infrastructure.** The default store is an
   in-process **memory ring buffer** — no database, no migrations, no cleanup jobs
   (§6.1). Postgres persistence is an opt-in upgrade for the cases that need it
   (staging debugging, sharing a failing request). No Grafana, no Jaeger, no Sentry,
   no DataDog.
3. **Invisible by default.** Capturing must never add perceptible latency to a request
   (fire-and-forget writes, batched flushes) and must never crash a request (a capture
   failure logs and moves on).
4. **Reuse everything.** `LogService`, `EmailLog`, `CorrelationIdMiddleware`,
   `ResponseInterceptor`, the `DataTable`, the chart components, the auth guards. Telescope
   is a *consumer* of existing infrastructure, not a parallel universe.
5. **One framework, owned.** v1 targets NestJS on the **Express adapter** — nothing else.
   Different frameworks have different lifecycles, middleware order, DI, error handling
   and async-context propagation; a cross-framework v1 would work nowhere well. The
   capture layer is isolated in `modules/telescope/`, so a later port (Express-only
   lib, Hono) is a rewrite of the instrumenters — not the store, API, or UI.

---

## 2. What "Telescope" means in this repo

| Telescope (Laravel) | Our equivalent | Where it comes from |
| ------------------- | -------------- | ------------------- |
| **Requests** tab    | Request log + per-request **timeline** + body/headers | `RequestLog` shape (§4.1) — in memory or Postgres |
| **Queries** tab     | SQL query log (slow-query view) | Prisma `query` event → `QueryLog` shape (§4.2) |
| **Exceptions** tab  | Grouped exception inbox | New global `ExceptionFilter` → `ExceptionLog` shape (§4.3) |
| **Mail** tab        | Email outbox with status badges | **Existing `EmailLog` table** — reuse, don't duplicate (§4.4) |
| **Logs** tab        | Structured log viewer | The `Log` table from `docs/logging.md` (§4.5) |
| **Dumps** tab       | `dd()`-style debug dump endpoint | `POST /telescope/dump` (optional, §5.6) |
| **Jobs** tab        | Queue job viewer | Future — BullMQ integration (§13) |
| **Cache** tab       | Cache key inspector | Future (§13) |
| **Scheduled tasks** | Cron run history | Future — wraps `TaskScheduleService` (§13) |
| **Events** tab      | Event dispatch history | Future — Nest `EventEmitter2` wrapper (§13) |

> [!TIP] **Why one doc instead of sprinkling this into `logging.md`?** `logging.md` owns the
> *log pipeline* (terminal + `Log` table + dashboard). Telescope owns the *request-level
> instrumentation* (timeline spans, SQL, request/response capture) and the *developer
> console UI*. They share the queue + retention infrastructure — Telescope imports
> `LogService` and the same flush pattern — but they are different layers. Think of
> `logging.md` as "the log store" and this doc as "the microscope."

---

## 3. Architecture at a glance

```
                ┌────────────────────────── apps/api (NestJS, :8080) ──────────────────────────┐
 Browser ──▶    │                                                                              │
 (admin)  │     │   CorrelationIdMiddleware ──▶ Guards ──▶ Controller ──▶ Service ──▶ Prisma   │
          │     │        │                        │           │               │         │      │
          │     │        ▼                        ▼           ▼               ▼         ▼      │
          │     │   ┌─ Instrumentation layer (AsyncLocalStorage-backed, fire-and-forget) ─┐   │
          │     │   │  RequestSpanContext (timeline spans)                                │   │
          │     │   │  Prisma query listener  ·  ExceptionFilter  ·  Email hook           │   │
          │     │   └──────────────────────────────────┬──────────────────────────────────┘   │
          │     │                                     ▼                                        │
          │     │                          TelescopeQueueService (batched flush)               │
          │     │                                     │                                        │
          │     └─────────────────────────────────────┼────────────────────────────────────────┘
          │                                           ▼
          │                              ┌─────────────────────┐
          ▼                              │  Telescope store    │
  ┌───────────────────┐                  │ RequestLog         │
  │ apps/admin (:3001)│  GET /telescope/ │ QueryLog           │
  │ /telescope/*      │◀─── SuperAdmin───│ ExceptionLog       │
  │ (this doc §8)     │      REST API    │ EmailLog (exists)  │
  └───────────────────┘                  │ Log (from logging) │
                                         └─────────────────────┘
```

Data flows one way: **NestJS instruments → Telescope store (in-memory by default, Postgres
opt-in) → Telescope API → admin dashboard.** The admin app never touches the capture
layer; it only reads the read-model via typed endpoints (`packages/client/lib/endpoints.ts`).

### Layering rules (repo rules 9–11, applied)

- **Capture code lives in the API** (`apps/api/src/modules/telescope/`). It knows about
  Nest, Prisma, and AsyncLocalStorage.
- **Shared schemas live in `packages/shared`** (`schemas/domain/telescope.ts`). Both the
  API's DTOs (via `createZodDto`) and the admin's response validation import from here.
- **The dashboard lives in the admin app.** Pages (`apps/admin/app/(panel)/telescope/**`)
  are the smart components — they fetch via `useAuth().api.procedure(...)`. Components
  (`apps/admin/components/telescope/**`) are dumb — they receive data through props and
  render it. No component fetches.
- **Endpoint registry entries** go in `packages/client/src/lib/endpoints.ts`
  (`telescopeEndpoints`), so every page call is typed end-to-end with Zod.

### The module contract — one config surface

The entire Telescope behaviour is declared at **module registration** — one place, typed
options (a Zod schema in `packages/shared`, inferred — no hand-written option types):

```ts
// packages/shared/src/schemas/domain/telescope.ts
const TelescopeOptionsSchema = z
  .object({
    enabled: z.boolean().default(true), // NODE_ENV=production flips this to false at boot (§6.4)
    storage: z.enum(["memory", "postgres"]).default("memory"),
    maxRequests: z.number().int().positive().default(10000), // memory ring-buffer cap
    captureBody: z.enum(["none", "headers", "full"]).default("headers"),
    captureHeaders: z
      .array(z.string())
      .default(["content-type", "user-agent", "x-client-type"]),
    ignorePaths: z.array(z.string()).default(["/health", "/docs", "/telescope"]),
    sampling: z
      .object({
        dev: z.number().min(0).max(1).default(1),
        prod: z.number().min(0).max(1).default(0.01),
      })
      .strict(),
  })
  .strict();

export type TelescopeOptions = z.output<typeof TelescopeOptionsSchema>;
```

```ts
// apps/api/src/app.module.ts
TelescopeModule.register({
  storage: "memory", // "postgres" = persisted upgrade (§6.2)
  captureBody: "headers",
  captureHeaders: ["content-type", "user-agent", "x-client-type"],
  ignorePaths: ["/health", "/docs"],
  sampling: { dev: 1.0, prod: 0.01 },
}),
```

`register()` merges these options with `TypedConfigService` env values (env wins at boot;
see §14.1) and is the **only** knobs the module reads — capture code never touches
`process.env` directly. **The instrumentation surface must stabilize before any UI is
built on it** — the shared Zod schemas *are* the contract the UI consumes (see the §11
M3 gate).

---

## 4. Data model

The Prisma models in this section are required **only for `storage: "postgres"` mode**
(§6.2) — memory mode uses the exact same shapes as in-process typed objects, so the
schemas are the single source of truth either way. Models go in
`apps/api/prisma/schema.prisma`; all API shapes go in
`packages/shared/src/schemas/domain/telescope.ts` and are re-exported from the barrel.
Every schema is `.strict()`, exports both the schema and the inferred type, and follows
the repo rules (no `any`/`unknown`/`never`, no casts — infer from Zod).

### 4.1 `RequestLog` — one row per HTTP request

```prisma
model RequestLog {
  id            String   @id @default(cuid())
  correlationId String   @unique               // joins with Log, QueryLog, ExceptionLog
  method        String                          // GET | POST | …
  path          String                          // /api/orders (no query string)
  queryString   String?
  statusCode    Int?
  ip            String?
  userAgent     String?
  userId        String?                         // from AuthGuard, when present
  durationMs    Int
  requestBody   Json?
  responseBody  Json?
  requestHeaders Json?                          // sanitized at capture time
  responseHeaders Json?
  // Timeline spans — one row per phase, joined by requestId:
  // (alternatively a Json[] column; see note below)
  createdAt     DateTime @default(now())
  @@index([createdAt(sort: Desc)])
  @@index([method])
  @@index([path])
  @@index([statusCode])
  @@index([userId])
  @@index([durationMs])
}
```

> [!NOTE] **Spans: child rows vs. a JSON column.** Two defensible shapes. **(a) Child table**
> `RequestSpan(requestId, name, kind, startOffsetMs, durationMs)` — queryable ("show me the
> slowest Prisma spans"), slightly more joins. **(b) `Json[]` column** on `RequestLog` —
> simpler, and the detail page renders the whole timeline in one read. **Recommendation:
> start with (b)** (a `spans Json[]` column) because the detail page is the only consumer;
> promote to a child table later if dashboard-wide span filtering becomes a feature. The
> Zod schema below matches (b).

```ts
// packages/shared/src/schemas/domain/telescope.ts (excerpt)
import { z } from "zod";

export const SpanKindSchema = z.enum([
  "middleware",
  "guard",
  "interceptor",
  "service",
  "prisma",
  "queue",
  "serialization",
  "other",
]);

export const RequestSpanSchema = z
  .object({
    name: z.string(),                       // e.g. "auth:verify-jwt"
    kind: SpanKindSchema,
    startOffsetMs: z.number().nonnegative(), // ms from request start
    durationMs: z.number().nonnegative(),
  })
  .strict();

export const RequestLogSchema = z
  .object({
    id: z.string(),
    correlationId: z.string(),
    method: z.string(),
    path: z.string(),
    queryString: z.string().nullable(),
    statusCode: z.number().int().nullable(),
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
    userId: z.string().nullable(),
    durationMs: z.number().int().nonnegative(),
    requestBody: z.unknown().nullable(),      // JSON value — see §10 sanitization
    responseBody: z.unknown().nullable(),
    spans: z.array(RequestSpanSchema).readonly(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type RequestLogEntry = z.output<typeof RequestLogSchema>;
```

> [!WARNING] `z.unknown()` appears here for the *JSON document bodies* — repo rule 2 bans
> `z.unknown` in **domain types**, but a raw JSON payload is legitimately an arbitrary JSON
> value. If the no-`unknown` rule is interpreted strictly, use
> `z.json()` (Zod v4's built-in JSON value schema) — it is the rule-compliant way to type
> "some JSON." `z.json()` is preferred; `z.unknown()` is listed only so the tradeoff is
> explicit in review.

### 4.2 `QueryLog` — one row per Prisma operation

```prisma
model QueryLog {
  id            String   @id @default(cuid())
  correlationId String
  requestId     String?                       // FK to RequestLog when available
  model         String                        // "Order", "User", …
  operation     String                        // findMany, create, update, …
  query         String                        // raw SQL from Prisma's query event
  params        String?                       // JSON string — SANITIZED before store
  durationMs    Int
  createdAt     DateTime @default(now())
  @@index([correlationId])
  @@index([model, operation])
  @@index([durationMs])
  @@index([createdAt(sort: Desc)])
}
```

### 4.3 `ExceptionLog` — one row per caught exception

```prisma
model ExceptionLog {
  id            String   @id @default(cuid())
  correlationId String
  requestId     String?
  errorGroup    String                        // hash of (class + message + first frame)
  name          String                        // BadRequestException, PrismaClientKnownRequestError, …
  message       String
  stack         String?
  statusCode    Int?
  path          String?
  method        String?
  userId        String?
  tags          String[]
  metadata      Json?                         // sanitized
  occurrences   Int      @default(1)          // incremented on dedupe (same group in window)
  createdAt     DateTime @default(now())
  @@index([errorGroup])
  @@index([createdAt(sort: Desc)])
}
```

### 4.4 `EmailLog` — **already exists**, do not touch

The **Mail** tab reads `EmailLog` (template_key, to, status, resendId, timestamps) —
see `docs/email.md` for its full shape. Telescope only needs a read endpoint
(`GET /telescope/mail`), which proxies the existing email-log query.

### 4.5 `Log` — already exists, per `docs/logging.md`

The **Logs** tab is the log-viewer from `logging.md` §21 (`GET /logs`). Telescope links to
it rather than re-implementing it. If `logging.md` is not yet shipped, the Logs tab can be
cut from Telescope v1 without loss — the other four tabs are the core.

---

## 5. Capture layer — how data gets recorded

All capture is **passive**: it wraps existing flows (middleware, interceptors, the Prisma
client, the exception filter, the mail service) and never changes their behavior.

### 5.1 Request capture (middleware + interceptor)

**What:** one `RequestLog` row per HTTP request, written when the response finishes.
**Why:** this is the backbone — every other telescope view joins back to it by
`correlationId`.
**How:**

- Extend `CorrelationIdMiddleware` (or add a sibling `TelescopeCaptureMiddleware`) to
  snapshot `method`, `path`, `queryString`, `ip`, `userAgent` and the request body
  (when the `captureBody` option allows, §3) into the `AsyncLocalStorage` store.
- Extend `ResponseInterceptor.intercept()`: `finalize()` (rxjs) runs after the response is
  serialized — capture `statusCode`, `responseBody` (`request.responseData`, already
  there), compute `durationMs` from a start timestamp captured at middleware time, close
  the span list, and push the row to `TelescopeQueueService`.
- **Ordering matters:** middleware starts the clock *before* guards, so the timeline is
  measured from the first byte in, not from the controller. Nest's `next()` for
  middleware runs before guards/interceptors — but capture of the *duration* happens in
  the interceptor, which wraps the controller. Span starts/offsets come from
  `performance.now()` snapshots in each instrumented phase (below).

### 5.2 Timeline spans (the killer feature)

**What:** the `Middleware 2ms → Auth 4ms → Prisma 731ms → Serialization 5ms` breakdown.
**Why:** "the request took 842ms" is useless without "731ms of it was Prisma." This is the
screen that makes Telescope worth building.
**How:** a tiny `RequestSpanContext` class backed by `AsyncLocalStorage`:

```ts
// apps/api/src/modules/telescope/request-span-context.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import type { RequestSpan } from "@workspace/shared";

export interface SpanStore {
  readonly correlationId: string;
  readonly startedAt: number;      // performance.now() at request start
  readonly spans: RequestSpan[];
}

export class RequestSpanContext {
  public static readonly storage: AsyncLocalStorage<SpanStore> = new AsyncLocalStorage();

  /** Begin a request scope. Must be awaited by the caller (usually a middleware). */
  public static run<T>(correlationId: string, fn: () => Promise<T>): Promise<T> {
    return this.storage.run({ correlationId, startedAt: performance.now(), spans: [] }, fn);
  }

  /** Open a span for the duration of `fn`. */
  public static async span<T>(name: string, kind: RequestSpan["kind"], fn: () => Promise<T>): Promise<T> {
    const store = this.storage.getStore();
    if (store === undefined) {
      return fn(); // not inside a captured request — don't pay the cost
    }
    const start = performance.now();
    try {
      return await fn();
    } finally {
      store.spans.push({
        name,
        kind,
        startOffsetMs: Math.round(start - store.startedAt),
        durationMs: Math.round(performance.now() - start),
      });
    }
  }
}
```

Phases instrumented with `RequestSpanContext.span(...)`:

| Phase | Instrumented where | Notes |
| ----- | ------------------ | ----- |
| `middleware` | `CorrelationIdMiddleware` | wrap `next()` — covers cookie parsing, body parsing |
| `guard` | the auth guards (`AuthGuard` et al.) | wrap `canActivate` — shows token verify cost |
| `interceptor` | `ResponseInterceptor` | the time between controller return and serialized response |
| `prisma` | Prisma query event (§5.3) | per-query spans auto-nested under the request span |
| `service` | (optional) explicit `RequestSpanContext.span("orders:calculate-total", "service", …)` | opt-in for expensive business logic |
| `queue` | the job processor wrapper (§5.5, future) | when BullMQ lands |

> [!NOTE] **How Prisma spans nest:** Prisma's query event fires *inside* whatever async
> context the query ran in — because AsyncLocalStorage tracks the async chain, a `span`
> opened in the interceptor around `await controller()` automatically becomes the parent
> of every Prisma query span. No manual wiring. This is the single biggest reason to use
> ALS over passing timers around by hand.

### 5.3 SQL capture (Prisma `query` event)

**What:** every Prisma operation → `QueryLog` row with raw SQL, duration, model/operation.
**Why:** the SQL tab and the per-request "6 queries, 731ms total" list are the second most
valuable view — slow queries are the #1 cause of slow endpoints.
**How:** enable Prisma's query event and forward it through the span context:

```ts
// apps/api/src/prisma/prisma.service.ts (excerpt)
new PrismaClient({
  log: [
    { emit: "event", level: "query" },   // gives { query, params, duration, timestamp }
    { emit: "event", level: "error" },
  ],
});
```

Then a listener in the telescope module:

```ts
// apps/api/src/modules/telescope/telescope-prisma-listener.ts
public attach(client: PrismaClient): void {
  client.$on("query", (event: Prisma.QueryEvent): void => {
    const store = RequestSpanContext.storage.getStore();
    const correlationId = store?.correlationId ?? "no-request";
    const durationMs = event.duration;

    // Nested span so the request timeline shows Prisma cost by query:
    if (store !== undefined) {
      store.spans.push({
        name: `${event.model ?? "?"}.${event.operation}`,
        kind: "prisma",
        startOffsetMs: Math.round(performance.now() - store.startedAt) - durationMs,
        durationMs,
      });
    }

    this.queue.push({
      correlationId,
      model: event.model ?? "",
      operation: event.operation,
      query: event.query,
      params: sanitizeQueryParams(event.params),   // §10
      durationMs,
    });
  });
}
```

> [!TIP] **Prisma 7 caveat:** the `query` event emits *params* as a JSON string of the
> interpolated bind values. Never store them raw — they contain user PII (emails, names).
> Run them through the same sanitizer as bodies (§10). When Prisma's event doesn't expose
> `model`/`operation` cleanly, derive them by parsing the SQL prefix (known limitation,
> fine for v1) or drop them — the raw SQL + duration is what matters.

### 5.4 Exception capture (global filter)

**What:** every thrown exception → `ExceptionLog` row; 5xx grouped by `errorGroup`.
**Why:** "3 new exceptions, /api/orders×2" — the exceptions tab is the bug inbox.
**How:**

- New `TelescopeExceptionFilter` (`@Catch()`), registered via `APP_FILTER` (or composed
  with the existing global filter if one exists — check `app.module.ts` first; if the
  project has a `LogService`-backed filter already, add the `ExceptionLog` write to it
  instead of stacking a second filter).
- Dedupe: hash `(name + message + first stack frame)` → `errorGroup`; if the same group
  exists within a 5-minute window, increment `occurrences` instead of inserting (keeps the
  inbox clean — see §6 retention).
- Always attach `correlationId` from the store, `path`/`method` from the request, and
  `userId` when auth populated it.
- Never rethrow / never swallow: the filter logs and passes the exception through
  untouched (`return next.handle()` semantics preserved — implement as a filter that calls
  the existing error path after writing).

> [!NOTE] **Shipped shape (2026-08-12):** exception capture lives in the error branch of
> `TelescopeInterceptor` (`source.error(...)` → `toCapturedError` → `pushException`), not
> in a separate filter. One interceptor owns both the `RequestLog` and `ExceptionLog`
> rows, so ordering and `correlationId` are trivially consistent. A standalone
> `TelescopeExceptionFilter` stays an option if we ever want exceptions captured for
> requests that never reach the interceptor — not needed today.

### 5.5 Mail capture (reuse `EmailLog`)

The **Mail** tab reads `EmailLog` rows that `EmailSenderService` already writes. No new
capture needed. If a per-request join is wanted ("which request sent this mail?"), stamp
`correlationId` onto the `EmailLog` row at send time — one optional column, add it in the
same migration.

### 5.6 Optional: `POST /telescope/dump` (the `dd()` equivalent)

**What:** a dev-only endpoint that records an arbitrary value under a name and shows up in
the telescope UI: `POST /telescope/dump { name, value }` → "💾 dump: cart.items".
**Why:** PHP's `dd()`/`dump()` is the most-loved part of Telescope. A `DumpLog` table +
one endpoint + one UI filter gives the same "I put a probe in my code" loop.
**How:** `DumpLog(id, name, value Json, correlationId, userId?, createdAt)`; a
`dumpToTelescope(name, value)` helper in the API that fire-and-forgets the row; the
requests/detail UI shows dumps whose `correlationId` matches. **Ship only if cheap** —
it's the first candidate for the cut list if scope overruns.

> [!NOTE] **Shipped (2026-08-12):** `POST /telescope/dump` exists (`TelescopeController`),
> dumps are keyed by `correlationId` and surfaced on the request-detail page — verified
> with a live probe during the M5 smoke test. It turned out to be ~40 lines, so it beat
> the cut list. The body is validated at the boundary via
> `ZodValidationPipe(TelescopeDumpInputSchema)` (repo convention) and the service takes
> the schema-inferred `TelescopeDumpInput` — no `unknown`/`any` in the module's own
> signatures (repo rule 2).

---

## 6. Storage strategy

The single biggest design decision — and the one that keeps Telescope *zero-config*:

### 6.1 Default: in-memory ring buffer (no database)

- A `TelescopeMemoryStore` — a bounded array (`maxRequests` entries, default 10000) with
  LRU eviction. Requests, queries, spans and exceptions are held as typed objects (the
  shared Zod schemas), not rows.
- **No migrations, no tables, no cleanup jobs.** An API restart clears the buffer — that
  is a *feature* for a dev tool (a fresh debugging session, always).
- The read API (§7) is backed by a `TelescopeStore` interface with two implementations
  (`MemoryStore`, `PostgresStore`) — controllers and the admin UI cannot tell which one
  is mounted.

### 6.2 Opt-in: Postgres persistence (`storage: "postgres"`, **shipped 2026-08-12**)

- The four §4 models + one migration (`20260812000000_add_telescope_tables`).
  `EmailLog`/`Log` are read-only dependencies, untouched.
- Used when history must survive restarts: debugging a staging request, sharing a failing
  request with a teammate, a day-long exceptions inbox.
- The retention cron (§6.4) applies **only** in this mode — the memory buffer is
  self-limiting by design.
- **Implementation:** `telescope-postgres.store.ts` implements the same `TelescopeStore`
  interface as the memory buffer (batched insert flush, `findMany` reads, mapping from
  JSON columns back to the shared Zod shapes). Select it with `TELESCOPE_MODE=postgres`;
  default stays `memory` so dev remains zero-config.

### 6.3 Sampling (never capture everything in prod)

- `sampling: { dev: 1.0, prod: 0.01 }` from the module contract. Applied once per request
  at *capture* time; a sampled-out request captures **nothing** — not its body, not its
  queries, not its spans (the ALS store carries the decision).
- In dev the rate is a debugging lever (`dev: 0.5` → half the requests).

### 6.4 The write path is always async + isolated (both stores)

1. **Never `await` a capture write inline.** All capture calls are `void` fire-and-forget.
2. **Shipped shape (memory mode):** writes are synchronous pushes into the ring buffer —
   in-memory writes are sub-microsecond, so no queue was needed; the plan's
   `TelescopeQueueService` (`TELESCOPE_FLUSH_MS` / `TELESCOPE_FLUSH_BATCH`) is **deferred**
   and becomes the batch-insert flush of the future `PostgresStore`.
3. **Isolation of failures:** capture code catches its own errors and warns — a broken
   store never takes down the API.
4. **Retention cron (shipped 2026-08-12):** `TelescopeRetentionService` runs at boot
   plus every 30 minutes, pruning rows older than `TELESCOPE_RETENTION_MINUTES` (default
   **1440** = 24 h) in **both** stores — Postgres `DELETE`s and a memory-buffer prune.
   Memory mode is otherwise self-limiting by the ring-buffer cap.
5. **Fail-closed disable:** `TELESCOPE_ENABLED=false` — or `NODE_ENV=production` without an
   explicit `TELESCOPE_ENABLED=true` — short-circuits every capture point at the cheapest
   check (a boot-time boolean; `RequestSpanContext` returns early when the store is
   absent anyway). Asking for the unimplemented `storage: "postgres"` logs a loud warning
   and falls back to memory (`warnUnsupportedStorage`).

---

## 7. Telescope API

All routes under `/telescope`, **SuperAdmin + admin-access gated** (same guard as other
admin APIs — reuse the existing role/RBAC guard, and make sure the `TelescopeController`
never leaks request bodies through the Swagger docs: mark it `@ApiExcludeController()`
or a `devOnly` tag). All responses go through the standard `ResponseInterceptor` envelope
(`{ success, data, meta }`) — except `GET /telescope/stream`, which is `@Sse()` and is
bypassed by the interceptor via the `text/event-stream` Accept header so frames aren't
nested in the envelope. Query params are parsed through the **shared Zod filter schemas**
(coerced, tolerant) inside `TelescopeService`, not via per-DTO `createZodDto` classes.
Controllers are implemented against the `TelescopeStore` interface (§6) — responses are
identical whether the backing store is memory or Postgres, so the admin UI and the
endpoint registry never know which is mounted. The controller is registered only when
Telescope is enabled.

| Endpoint | Purpose | Key query params (Zod) |
| -------- | ------- | ---------------------- |
| `GET /telescope/overview` | Stat cards for the landing view | `range` (`15m\|1h\|6h\|24h`), `from`, `to` |
| `GET /telescope/requests` | Request list (the DataTable feed) | `page`, `pageSize`, `method`, `path`, `status`, `minDurationMs`, `userId`, `correlationId`, `from`, `to`, `sort` |
| `GET /telescope/requests/:id` | Request detail (spans + body + headers) | — |
| `GET /telescope/requests/:id/sql` | Queries for one request | — |
| `GET /telescope/sql` | Query list (slow-query view) | `page`, `pageSize`, `model`, `operation`, `minDurationMs`, `from`, `to` |
| `GET /telescope/exceptions` | Grouped exception inbox | `page`, `pageSize`, `errorGroup`, `statusCode`, `from`, `to`, `grouped=true` |
| `GET /telescope/exceptions/:id` | One exception + stack | — |
| `GET /telescope/mail` | Mail outbox (proxies `EmailLog`) | `page`, `pageSize`, `status`, `templateKey` |
| `GET /telescope/logs` | Log viewer feed (proxies `Log` — optional) | same as `GET /logs` |
| `POST /telescope/dump` | Dev dump probe (optional) | body: `{ name, value }` |

Response shapes (in `packages/shared`):

```ts
export const TelescopeOverviewSchema = z.object({
  range: z.string(),
  requests: z.number().int(),
  avgDurationMs: z.number(),
  p95DurationMs: z.number(),
  slowest: z.object({ id: z.string(), method: z.string(), path: z.string(), durationMs: z.number() }).nullable(),
  errorCount: z.number().int(),
  sqlCount: z.number().int(),
  slowSqlCount: z.number().int(),
  mailSent: z.number().int(),
  mailDelivered: z.number().int(),
  exceptionGroups: z.number().int(),
}).strict();

export const TelescopeRequestListSchema = z.object({
  items: z.array(RequestLogSummarySchema).readonly(),  // id, method, path, status, durationMs, userId, createdAt
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
}).strict();
```

> [!NOTE] **Pagination contract:** the request list is consumed by the `DataTable` in
> **manual/server-side mode** (`manual={true}`, `totalCount={total}`) — the DataTable
> already supports that mode (built for this exact case).

### Filter semantics (shared, used by every list endpoint)

`TelescopeFilterQuerySchema` — one Zod schema in `packages/shared`:

```ts
export const TelescopePaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const TelescopeTimeRangeSchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
```

Every list endpoint composes these with its own filters. The admin pages never construct
raw query strings — they pass filter objects through the typed endpoint registry.

---

## 8. Admin dashboard UI

### 8.1 Route map

All routes live under the `(panel)` group (behind the admin proxy + JWT gate):

| Route | Page (smart) | Purpose |
| ----- | ------------ | ------- |
| `/telescope` | `app/(panel)/telescope/page.tsx` | Overview: stat cards + recent requests + mini charts |
| `/telescope/requests` | `.../telescope/requests/page.tsx` | Full request table (DataTable, server-side) |
| `/telescope/requests/[id]` | `.../telescope/requests/[id]/page.tsx` | Detail: headers, body, user, response, **timeline**, SQL |
| `/telescope/sql` | `.../telescope/sql/page.tsx` | Query table, sortable by duration, slow-filter |
| `/telescope/exceptions` | `.../telescope/exceptions/page.tsx` | Grouped exception inbox + detail drawer |
| `/telescope/mail` | `.../telescope/mail/page.tsx` | Reuses the email-log page/table (status badges) |
| `/telescope/logs` | (optional) | Links to `logging.md` §21 viewer |

### 8.2 Component map (dumb components, props-in / events-out)

```
apps/admin/components/telescope/
├── stat-card.tsx            ← icon, label, value, delta, trend color  (props only)
├── stat-card-grid.tsx       ← arranges StatCards; responsive grid
├── request-timeline.tsx     ← the horizontal span bar + per-span rows (§9.4)
├── request-detail-panel.tsx ← headers/body/user/response sections (accordion)
├── sql-query-list.tsx       ← per-query rows with duration + copy-SQL button
├── exception-group-card.tsx ← group header, count, sparkline, first/last seen
├── range-picker.tsx         ← 15m / 1h / 6h / 24h segmented control
└── request-filters.tsx      ← method/status/path filter bar (feeds DataTable filters)
```

Rules honored: **no fetching inside components** (pages fetch), no Zod imports in
components (pages validate, pass plain props or already-inferred types), full dark/light
theme support via design tokens, mobile responsive.

> [!NOTE] **Shipped component set (2026-08-12):** `stat-card.tsx`, `range-picker.tsx`,
> `timeline.tsx` (horizontal span bar + per-span rows), `sql-list.tsx` (per-query rows
> with duration tone + copy-SQL), `exception-card.tsx` — the five that earned their keep.
> The grid wrapper, detail accordion and filter bar were folded into the pages instead
> (`request-filters` became the DataTable's native filter props, which the DataTable
> already supports). The `/telescope/logs` route stays future work — the mail page notes
> it mirrors the live `/email-log` view.

### 8.3 Pages

**Overview (`/telescope`)** — smart page composes:

- `StatCardGrid` fed by `GET /telescope/overview`: Requests, Avg duration, P95, Errors,
  SQL queries, Slow SQL, Mail sent/delivered, Exception groups.
- A "Recent requests" `DataTable` (manual mode, `pageSize={5}`, no bulk actions) — the
  same table used on the requests page, just smaller.
- Optional mini chart (`ChartAreaInteractive` / recharts, already in the repo) for
  requests-per-minute over the selected range — reuse the existing chart components.

**Requests (`/telescope/requests`)** — the workhorse:

```tsx
// app/(panel)/telescope/requests/page.tsx  (smart)
"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/endpoints";
import { DataTable } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";

// column defs live in lib/telescope/request-columns.ts (no JSX-in-lib rule: .tsx)
// …
```

- Columns: Method (badge, colored), Path (mono), Status (colored badge), Duration
  (colored by threshold §9.3), User, Time (relative + tooltip). `enableColumnVisibility`,
  `exportable`, `searchKeys={["path"]}`, filters for method/status, `manual` + `totalCount`
  for server-side pagination — all existing `DataTable` props.
- `onRowClick` → `router.push(\`/telescope/requests/${id}\`)`.

**Request detail (`/telescope/requests/[id]`)** — the money screen:

- Header: `POST /api/orders` · `842ms` · `200` · `correlationId` (copy button) · `userId`.
- **RequestTimeline** (§9.4): the horizontal bar and per-span rows.
- **SQL queries**: `SqlQueryList` fed by `GET /telescope/requests/:id/sql`, each row shows
  duration (colored), operation/model badge, and the SQL in a `<pre>` with a copy button.
- Accordion sections for Headers / Body / User / Response (rendered as pretty JSON via the
  existing code-block/highlight infra — `lib/highlight.tsx` + `CodeBlock`).
- "View in logs" link → `/logs?correlationId=<id>` when the log viewer exists.

**SQL (`/telescope/sql`)** — DataTable over `GET /telescope/sql`, default sort
`durationMs desc`, a "slow only" filter (`minDurationMs`), columns: Query (truncated +
expandable), Model, Op, Duration, Time. Row click → the owning request detail (join via
`requestId`).

**Exceptions (`/telescope/exceptions`)** — a card list, not a table:

- Each `ExceptionGroupCard`: `name` + `message` (first 120 chars), `errorGroup` hash,
  `occurrences` badge, status code badge, first/last seen, a tiny occurrence sparkline.
- Click → drawer/dialog (`@workspace/ui` dialog) with the full stack trace, the linked
  request (if any), and "jump to request detail."

**Mail (`/telescope/mail`)** — the existing email-log page, reused as-is (it already lists
`EmailLog` with status badges). Telescope's menu entry links here; do not build a second
email table.

### 8.4 Wiring the endpoint registry

```ts
// packages/client/src/lib/endpoints.ts (excerpt)
export const telescopeEndpoints = {
  overview: {
    path: "/telescope/overview",
    method: "GET",
    queryKey: ["telescope", "overview"],
    responseSchema: envelope(TelescopeOverviewSchema),
  },
  listRequests: {
    path: "/telescope/requests",
    method: "GET",
    queryKey: ["telescope", "requests"],
    responseSchema: envelope(TelescopeRequestListSchema),
  },
  requestDetail: {
    path: "/telescope/requests/:id",
    method: "GET",
    queryKey: ["telescope", "request"],
    responseSchema: envelope(RequestLogDetailSchema),
  },
  // …sql, exceptions, mail
} as const satisfies Record<string, EndpointDefinition>;
```

Pages call them exactly like the existing `authEndpoints.me` pattern:

```tsx
const { api } = useAuth();
const requests = api.procedure(telescopeEndpoints.listRequests, { query: filters }).useQuery();
```

---

## 9. Design & UX spec

> [!NOTE] **Where the UI effort goes.** The request detail screen — timeline + SQL — is
> the differentiator: it answers *why a request is slow in your specific request context*,
> which is what OpenTelemetry/Grafana show but don't explain. Budget the polish
> accordingly: roughly 80% of the UI effort goes into that screen (§9.3); every other
> view is table stakes.

### 9.1 Visual language

- **Theme:** dark + light, exclusively via design tokens (`bg-card`, `text-muted-foreground`,
  `border`, `bg-primary/10`…) — **no hardcoded Tailwind colors** (repo rule 22). The whole
  dashboard must look right in both modes; verify both at each milestone.
- **Layout:** reuse the existing dashboard shell (`dashboard-layout.tsx` + sidebar). A new
  `Telescope` sidebar section (icon: `Telescope` or `Radar` from lucide) with children:
  Overview, Requests, SQL, Exceptions, Mail.
- **Typography:** mono (`font-mono`, JetBrains Mono is already loaded) for paths, SQL,
  correlation ids, durations. Proportional for everything else.
- **Table headers:** the DataTable renders a muted band (`bg-muted/30`) with small
  uppercase tracking-wide labels and a subtle sort icon — consistent across every
  telescope table; columns are uniformly left-aligned (the Time column matches the rest).
- **Motion:** subtle — hover lifts on table rows (existing), an animated progress bar on
  the timeline, a gentle "live" pulse dot when polling is on. No gratuitous animation.

### 9.2 Status & duration coloring (design tokens)

| Duration | Color token | Meaning |
| -------- | ----------- | ------- |
| `< 100ms` | `text-emerald-500` / `bg-emerald-500/10` | fast |
| `100–500ms` | `text-amber-500` / `bg-amber-500/10` | watch |
| `> 500ms` | `text-red-500` / `bg-red-500/10` | slow |

Status codes: `2xx` emerald, `3xx` sky, `4xx` amber, `5xx` red — same token pattern.
Implement as one `lib/telescope/duration-tone.ts` / `status-tone.ts` helper returning
token classnames, so the palette lives in exactly one place.

### 9.3 The timeline visualization

The horizontal bar is the signature of the whole feature — get it right:

```
┌───────────────────────────────────────────────────────────────────── 842ms ─┐
│  ██ Middleware 2ms │  █ Auth 4ms │  ██████████████████████████ Prisma 731ms │
│                     ██ Guards 1ms │  ███ Service 62ms │  █ Queue 12ms █ Ser 5ms│
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Implementation:** a flex row of segments; each segment's `width% = durationMs / total *
  100`, min-width `2px` for visibility, `title` tooltip with the exact name+ms, colored by
  §9.2 tone. Below the bar, the per-span rows (`name · kind · start offset · duration`).
- **Span palette:** one categorical hue per stage (`lib/telescope.ts` `SPAN_KIND_META`) —
  deliberately **no purple/indigo family** (adjacent indigo/violet/sky bars previously read
  as a single purple gradient). Rows carry a small color chip and `space-y-2.5` breathing
  room so the stack is scannable.
- **Accessibility:** the bar is `role="img"` with an `aria-label` summarizing
  ("Timeline: Middleware 2ms, Auth 4ms, Prisma 731ms…"); the per-span rows are the
  accessible source of truth (also screen-reader friendly).
- **Long-tail handling:** cap the total displayed at, say, 10 spans (top-N by duration,
  "+N more"), so a 40-query request doesn't render a 40-segment bar.

### 9.4 Live updates (no manual refresh)

- ✅ **Polling — shipped.** The overview page polls every `POLL_MS` (10s) via React Query's
  `refetchInterval` and keeps the previous snapshot as `placeholderData`, so the layout
  never blanks between polls.
- ✅ **SSE — shipped.** `GET /telescope/stream` (Nest `@Sse()`) pushes new request ids
  through an `Observable` (`telescope-event-bus.ts` is the pub/sub seam; memory store
  publishes on push). The overview page subscribes via `lib/use-telescope-live.ts` and
  inserts fresh rows at the top with a "● Live" pulse — no manual refresh. A `refetch`
  triggers as a fallback when the stream drops.
- ✅ **SSE on the Jobs + Schedules pages — shipped (2026-08-13).** The stream schema
  now carries `job` and `schedule` frame types (in addition to `request` / `exception`).
  `TelescopeJobRunner` publishes a `job` frame when a job finishes; the scheduler
  publishes a `schedule` frame after each cron run. Both pages subscribe via the same
  `useTelescopeLive` hook and refetch **only** on their own frame type (other frames
  are ignored), so a finished job or a card flipping to `succeeded`/`failed` appears
  instantly — no manual refresh, no polling. Each page header shows the same
  ● live / paused / reconnecting chip as the overview.
- ✅ **Strict frame contract + in-page feeds — shipped (2026-08-13, v2).**
  `TelescopeStreamEventSchema` is now a **strict `z.discriminatedUnion`**: each
  `type` has its own schema (`.strict()`), so a `job` frame can never carry
  request-only fields and vice versa — mixed frames are rejected at parse time.
  Consumers narrow on `event.type` and get precise per-variant typing. The
  overview, Jobs and Schedules pages share one **"Live activity"** card
  (`LiveFeedCard`) with **frame-type filter chips** (All / Requests / Exceptions
  / Jobs / Schedules) that show live per-type counts. Clicking a row navigates
  via the shared `streamEventTarget` helper: request → its detail, exception →
  the exceptions list, **job → the correlated request** (`?correlation=`, via
  the `correlationId` now carried on job frames; jobs without a correlation stay
  static); schedule rows are informational.

### 9.5 Empty, loading, error states

- Empty: the `Empty`/`EmptyState` components (already used by the DataTable) — "No requests
  in the last 15 minutes. Hit an endpoint, then come back."
- Loading: skeletons (existing `Skeleton`), never a blank page.
- Error: the existing toast + inline error pattern; a capture-broken API must degrade to
  "Telescope unavailable" rather than crashing the admin app.

---

## 10. Security & hygiene

1. **Admin-only:** every telescope route goes through the same auth + admin-access gate as
   the rest of the admin panel. Add an explicit check that `hasAdminAccess` is true at the
   controller level too (defense in depth), and mark the controller `@ApiExcludeController()`
   so request/response bodies never leak into the public Swagger document.
2. **Headers: whitelist first, denylist underneath.** Capture *only* the headers
   configured in `captureHeaders` (default: `content-type`, `user-agent`,
   `x-client-type`) — nothing else by default. Underneath the whitelist, an immutable
   denylist (`authorization`, `cookie`, `set-cookie`, `x-api-key`, any `*token*` /
   `*secret*`) is stripped **even if explicitly whitelisted** — credentials can never
   be captured by accident. Bodies, Prisma params and exception metadata pass the same
   sanitizer (`sanitizeMetadata`/`sanitizeBody`, reusing the logging.md §17 denylist)
   before anything is stored.
3. **PII:** mask emails in stored bodies/params the same way `logging.md` §18 does
   (`maskEmail` helper in shared). Dev tool or not — a laptop with a DB full of emails is
   a breach waiting for a `git push` mistake.
4. **Bodies are opt-in and truncated:** `captureBody = none | headers | full` (default
   `headers`). Even at `full`, bodies are truncated to the first 2000 characters (4KB
   serialized) — a giant upload must not become a giant row, and the PII surface stays
   bounded.
5. **Never capture `/telescope/*` requests themselves** (infinite loop) and skip
   `GET /health`, `GET /docs`, static assets — a `shouldCapture(path)` denylist in the
   capture middleware.
6. **Rate/size guard:** cap stored body size (truncation per item 4) and query-string
   length; a giant file upload must not become a giant `RequestLog` row.
7. **Authentication is not optional.** Admin JWT gate + `hasAdminAccess` check (defense
   in depth). If Telescope is ever mounted outside the admin origin, add a
   `TELESCOPE_TOKEN` header check — a random 32+ char string compared in constant time.

---

## 11. Phased implementation plan

> [!NOTE] Each milestone ends in something visible and shippable. Do not merge a milestone
> until its tests pass and both themes are checked in the browser.
>
> **Status key:** ✅ shipped (2026-08-12) · ⏳ deferred / future

### M0 — Module contract + memory store ✅ (½ day)

- ✅ `packages/shared`: `schemas/domain/telescope.ts` (all §4 schemas + `TelescopeOptionsSchema`) + barrel exports.
- ✅ `TelescopeModule.register(options)` — Zod-typed options merged with `TypedConfigService` env values (§3). `TelescopeMemoryStore` ring buffer with LRU eviction behind the `TelescopeStore` interface (§6.1) + unit tests.
- ✅ Env: `TELESCOPE_*` vars in `apps/api/.env`, `.env.example`, and the `turbo.json` env lists (the parity rule from the email work).
- ✅ `apps/api/src/modules/telescope/` skeleton: module, options, store, `RequestSpanContext`.

### M1 — Request + SQL capture ✅ (1–2 days)

- ✅ `RequestSpanContext` (ALS) — the scope is opened by a dedicated `TelescopeCaptureMiddleware` (registered *after* `CorrelationIdMiddleware` in the same `apply().forRoutes("*")` chain), not by editing the correlation middleware itself.
- ✅ `TelescopeInterceptor` writes the `RequestLog` row when the response finalizes (fire-and-forget — never awaited).
- ✅ Prisma `query` listener → query log + nested `prisma` spans (§5.3).
- ✅ Sanitizers + `shouldCapture` denylist with unit tests first (§10).
- 🐛 **Runtime gotcha found during M1 verification:** inside a Nest router-level middleware, `req.path` is `/` (the router has already stripped the path) — the real path is in `req.originalUrl`. `shouldCapture` must parse `originalUrl`, or **every request** (including `/telescope/*` itself) passes the ignore check and gets captured. Fixed + verified headlessly: `/telescope/*` and `/health` are excluded; only real traffic is captured.

### M2 — Exceptions + mail ✅ (Postgres half deferred)

- ✅ Exception capture — folded into `TelescopeInterceptor`'s error branch (`errorGroup` hash + `pushException`) rather than a standalone filter (§5.4 shipped note).
- ✅ Mail tab — read-only proxy over the existing `EmailLog` table (`GET /telescope/mail`), no new capture, no `EmailLog` schema changes.
- ✅ **`PostgresStore` shipped (2026-08-12)** — the §4 Prisma models, migration `20260812000000_add_telescope_tables`, batch-insert flush and the retention cron (§6.2/§6.4).

### M3 — Telescope API ✅ (1 day) — the stability gate

- ✅ `TelescopeController` (admin-gated by `TelescopeAdminGuard`, `@ApiExcludeController()` so bodies never leak into public Swagger): overview, requests list, request detail (with queries + dumps), sql list, exceptions list/detail, mail proxy, `POST /telescope/dump`.
- ✅ `telescopeEndpoints` registry in `packages/client/src/lib/api/endpoints.ts` — every page call typed end-to-end with Zod.
- ✅ Store filter tests (`telescope.store.spec.ts`: predicate mapping, correlationId joins for queries + dumps).

> [!IMPORTANT] **Gate — no UI before this.** Nothing in §8 starts until the API is fully
> consumable headlessly: curl a request list, a detail, a SQL list, an exception; every
> response validates against the shared schemas. The instrumentation surface *will*
> change as real usage lands — the UI must sit on this stable contract, not on the
> changing internals. (The "find the first users before writing UI" lesson, applied to
> our own daily usage of the API.) — **Passed:** the UI shipped only after this smoke
> test.

### M4 — Admin dashboard v1 ✅ (2–3 days) — UI as a thin wrapper

The pages here are pure consumers of the §7 API + §8.4 registry — no capture logic, no
storage knowledge. The shared schemas validate every response at the boundary.

- ✅ Sidebar **Developer** section (icon: `Radar`) — Overview / Requests / SQL / Exceptions / Mail.
- ✅ Overview page (stat cards + recent requests + **10s polling** via `refetchInterval` with `placeholderData` keeping the previous snapshot).
- ✅ Requests page — DataTable in **manual/server-side mode**: a new `onManualPaginationChange(page, pageSize)` callback was added to the DataTable (backwards-compatible) so page changes round-trip to the API; `pageSizeOptions` is `readonly` in the contract. Filters, export, row-click → detail.
- ✅ Request detail page: header (method/path · duration · status · correlationId with copy button · userId), **timeline**, SQL list, body/header accordions reusing the code-block/highlight infra.
- ✅ Pages fetch via `useAuth().api.procedure(telescopeEndpoints.*)`; components are props-only. Envelope handling (`data.data.list`) matches the existing email-log page pattern.

### M5 — Exceptions + SQL + Mail pages + polish ✅ (2 days)

- ✅ Exceptions card list + detail (grouped inbox with `errorGroup` + occurrences).
- ✅ SQL slow-query page (default sort `durationMs desc`, `minDurationMs` slow filter).
- ✅ Mail page — read-only mirror of the email-log table (the live-updating view remains `/email-log`).
- ✅ Empty/loading/error states, design-token theming (dark + light), `jsx-no-bind`-clean handlers, accessibility on the timeline (`role="img"` + `aria-label`).
- ✅ This doc — shipped items marked ✅/⏳ and the runbook (§14.4) validated against the real build.

---

## 12. Testing plan

| Layer | What | Where |
| ----- | ---- | ----- |
| Pure helpers | sanitizers, `shouldCapture`, duration/status tone mapping, `errorGroup` hashing, span truncation | colocated `*.test.ts` in `apps/api/src/modules/telescope/` (API vitest — same setup used for the webhook throttler) |
| Span context | ALS nests correctly across awaited async boundaries; store absent → zero-cost no-op | `request-span-context.test.ts` |
| Queue | batch flush inserts, failure isolation (broken table → warn, no crash), sampling short-circuit | `telescope-queue.test.ts` (mock Prisma) |
| API | filters → `where` translation table test; envelope shape; admin gate returns 401/403 for non-admins | integration specs like `webhook-rate-limit.spec.ts` (boot a `TestingModule` with the controller + mock service) |
| Admin UI | `request-timeline` renders segments proportional to duration; tone classes; empty state | `apps/admin/components/telescope/*.test.tsx` (vitest + testing-library, existing admin setup) |
| E2E (manual, per milestone) | boot API + admin, trigger a request, open `/telescope/requests/<id>`, screenshot dark + light | browser pass |

**Golden rule:** capture helpers are pure functions with no I/O — they get real unit tests
before the wiring lands. The wiring (interceptor/filter/event listener) is thin and
verified by integration specs + the manual run in M1.

---

## 13. Out of scope & future work

Deliberately **not** in v1 (each is its own future feature — the point of this doc is that
none of them are required to ship value):

| Future item | Sketch |
| ----------- | ------ |
| **Jobs tab** | When BullMQ (or the `@nestjs/bullmq`) lands, wrap the processor with a span + `JobLog` table (status, attempts, duration, error, queue name). Telescope's Queue span already reserves the shape. |
| **Cache tab** | Wrap cache-manager `get`/`set` with instrumentation → `CacheLog`; keys + hit/miss + latency. |
| **Scheduled tasks** | Wrap `TaskScheduleService` crons: run start/end/error + duration → `CronRunLog`. |
| **Events tab** | Subscribe to the Nest event emitter (if adopted) → `EventLog`. |
| ~~**CLI**~~ — **shipped 2026-08-12** | `pnpm --filter @workspace/api telescope:cli view <id>` — dump one request (headers, timeline, SQL) to the terminal; also `requests` (recent list) and `compare <idA> <idB>`. Works headlessly against the live API (`TELESCOPE_TOKEN` supported). |
| **Export to OTel** | When the app grows past dev scope: a writer that forwards captured spans to an OTel collector (Jaeger/Grafana) — Telescope's data model maps 1:1 onto OTel spans/traces, so this is an adapter, not a rewrite. |
| **Sentry parity** | Source-map uploads + symbolicated stacks in the exceptions tab. |
| **Production mode** | Real sampling, t-digest percentiles, read-replica reads. Explicitly a later concern. |
| **Productization** | If we ever extract this as an npm package (`@tsforge/telescope`), the module is already isolated + schema-driven. The shape would follow the standard playbook: free (memory storage + basic UI), pro (share links, saved filters, annotations), enterprise (persistence, sampling policies, SSO). **Not a v1 concern** — this is an in-house tool first; the extraction path just stays clean. |

---

## 14. Appendix

### 14.1 Env vars (all with defaults — dev works with zero config)

| Var | Default | Meaning |
| --- | ------- | ------- |
| `TELESCOPE_ENABLED` | `true` | Master switch; **`NODE_ENV=production` forces `false` at boot unless explicitly `true`** |
| `TELESCOPE_MODE` | `memory` | `memory` \| `postgres` — Postgres store shipped (§6.2); default stays memory |
| `TELESCOPE_MAX_REQUESTS` | `10000` | Ring-buffer cap in memory mode (raised from 1000 so the overview's "slowest request" drill-down survives polling churn) |
| `TELESCOPE_SAMPLE_RATE` | `1.0` | 0–1; fraction of requests captured (prod default: `0.01`) |
| `TELESCOPE_BODY_CAPTURE` | `headers` | `none` \| `headers` \| `full` (truncated) |
| `TELESCOPE_BODY_LIMIT_CHARS` | `2000` | Body truncation budget (improvement #10) |
| `TELESCOPE_RETENTION_MINUTES` | `1440` | Rows older than this are pruned by the retention cron (§6.4) |
| `TELESCOPE_CAPTURE_PATHS` | `*` | Comma-separated path prefixes to capture (allowlist) |
| `TELESCOPE_REDACT_PATHS` | — | Comma-separated path prefixes never captured (denylist) |
| `TELESCOPE_TOKEN` | — | Optional bearer token for CLI/CI access (constant-time compare, §10.7) |
| `TELESCOPE_ALERT_WEBHOOK_URL` | — | Feature 18 — webhook URL; alerts fire only when set (§15.4.18) |
| `TELESCOPE_ALERT_DURATION_MS` | `2000` | Feature 18 — duration threshold (ms) that triggers a `duration` alert |
| `TELESCOPE_ALERT_WINDOW_MINUTES` | `5` | Feature 18 — per-route+reason dedupe window for alerts |
| `TELESCOPE_REPLAY_TARGETS` | — | Feature 7 — `name:baseUrl` pairs for request replay (`local` always exists) |
| `TELESCOPE_LOCAL_BASE_URL` | `http://localhost:8080` | Feature 7 — the API's own origin used as the `local` replay target |

### 14.2 File map (everything this doc creates)

```
packages/shared/src/schemas/domain/telescope.ts      ← all Zod schemas (+ barrel export)
packages/client/src/lib/api/endpoints.ts             ← telescopeEndpoints registry (+ response schemas)
apps/api/src/modules/telescope/
├── telescope.module.ts                              ← register(options) — the only config surface (§3)
├── telescope.options.ts                             ← TelescopeOptionsSchema + env merge (§3)
├── telescope.store.ts                               ← TelescopeStore interface + MemoryStore ring buffer (§6.1, smarter eviction)
├── telescope-postgres.store.ts                      ← PostgresStore — the §6.2 drop-in (shipped)
├── telescope-retention.service.ts                   ← retention cron (boot + 30 min), both stores
├── telescope-event-bus.ts                           ← pub/sub seam for the SSE stream
├── telescope-console-capture.ts                     ← console.log/warn/error → per-request logs
├── n1-detector.ts (+ spec)                          ← N+1 query detector
├── telescope.service.ts                             ← read queries against TelescopeStore (§6), compare, replay, annotation
├── telescope.controller.ts                          ← /telescope/* (admin-gated, @ApiExcludeController), incl. POST /dump + SSE /stream
├── telescope-admin.guard.ts                         ← SuperAdmin + admin-access gate + TELESCOPE_TOKEN (§10)
├── telescope-capture.middleware.ts                  ← opens the ALS scope, snapshots the request, applies shouldCapture
├── telescope.interceptor.ts                         ← finalizes RequestLog + ExceptionLog + handler span + PII scan (§5.4, §15.4)
├── request-span-context.ts                          ← AsyncLocalStorage span store (§5.2)
├── telescope-prisma-listener.ts                     ← Prisma query event → QueryLog + nested spans + startOffsetMs (§5.3, §15.4.11)
├── pii-scanner.ts (+ spec)                          ← Feature 17 — PII detect + redact (default) at capture
├── telescope-job-runner.ts                          ← Feature 3 — async job producer → TelescopeJobLogEntry
├── telescope-scheduler.ts                           ← Feature 4 — cron-style schedule registry
├── telescope-cache-tracer.ts                        ← Feature 5 — per-request cache-op trace API
├── telescope-alert.service.ts (+ spec)              ← Feature 18 — threshold alerts + optional webhook
├── telescope-demo.service.ts                        ← dev-only demo: telescope-demo schedule → demo-job (§15.4.4)
├── sanitize.ts                                      ← bodies/params/headers sanitizer + truncation (§10)
├── should-capture.ts                                ← path denylist/allowlist (§10.5) — parse req.originalUrl, not req.path
└── *.spec.ts                                        ← colocated unit tests
apps/api/scripts/telescope-cli.ts                    ← `telescope:cli requests|view|compare|replay` (CLI, shipped)
apps/api/scripts/gen-telescope-docs.ts               ← `telescope:docs` — regenerates §14.1 from code
apps/admin/app/(panel)/telescope/**                  ← 10 routes: overview, requests, requests/[id], compare, sql, exceptions, mail, jobs, schedules, logs
apps/admin/components/telescope/**                   ← stat-card, range-picker, timeline (waterfall + query overlay), sql-list, exception-card,
│                                                    ←   live-feed (SSE activity feed), traffic-sparkline, animated-number, error-rate-chart,
│                                                    ←   leaderboard-panel, saved-filters, annotation-panel, replay-dialog, snippet-menu, alerts-panel
apps/admin/lib/telescope.ts                          ← tone helpers, formatters, env/PII helpers, buildRequestSnippet (§15.4.16)
apps/admin/lib/saved-filters.ts                     ← Feature 9 — localStorage filter bookmarks (zod-validated)
apps/admin/lib/use-telescope-live.ts                 ← SSE EventSource hook (events buffer, counters, pause/resume, tab-hidden auto-pause)
apps/admin/lib/navigation/sidebar-menu.json + menu-icons.ts ← Developer section (Radar icon + Jobs/Schedules/Logs children)
packages/ui/src/components/display/data-table.tsx    ← + onManualPaginationChange callback; readonly pageSizeOptions
apps/api/.env, .env.example, turbo.json              ← TELESCOPE_* env vars
docs/telescope.md                                    ← this document
```

### 14.3 Wireframe: request detail (mobile)

```
┌──────────────────────────────┐
│ ← Requests    POST /api/orders│
│ 842ms · 200 · #corrId [copy] │
├──────────────────────────────┤
│ Timeline                     │
│ ██ 2ms ██ 4ms ████████████████│
│ Middleware       2ms         │
│ Auth             4ms         │
│ Guards           1ms         │
│ Prisma         731ms         │
│ Service         62ms         │
│ Queue           12ms         │
│ Serialization    5ms         │
├──────────────────────────────┤
│ SQL · 6 queries · 731ms      │
│ ▸ SELECT "orders" …  412ms   │
│ ▸ SELECT "users" …   228ms   │
│ ▸ +4 more                   │
├──────────────────────────────┤
│ ▸ Headers  ▸ Body  ▸ User    │
│ ▸ Response                   │
└──────────────────────────────┘
```

### 14.4 Runbook (grows as milestones ship)

1. **"An endpoint is slow — where do I look?"** Open `/telescope/requests`, sort by
   duration desc, click the row → the Timeline immediately shows whether it's Prisma,
   auth, or serialization. If Prisma: open the SQL list for that request, find the fat
   query, copy it (mono + copy button), explain it.
2. **"An error happened twice but I don't know why."** `/telescope/exceptions` groups by
   `errorGroup` — the count badge tells you it happened twice, the stack tells you where,
   and the linked request tells you what payload triggered it.
3. **"Did my email send?"** `/telescope/mail` — status badges (sent/delivered/bounced/
   failed) from `EmailLog`.
4. **"Clear the noise."** Memory mode: restart the API — the buffer resets (that's a
   feature). Postgres mode: restart with `TELESCOPE_RETENTION_DAYS=1`, or drop the
   three telescope tables for a hard reset (dev only).

### 14.5 Telescope CLI cheat-sheet

> Inspect captured Telescope data from the terminal — no browser needed. The script
> is `apps/api/scripts/telescope-cli.ts` (improvement 14), invoked via the
> `telescope:cli` package script. It is **read-only**: it never captures or mutates
> anything. The API must be running and capturing (`TELESCOPE_ENABLED`, on by
> default in dev).

```bash
# List recent captured requests (default 20)
pnpm --filter @workspace/api telescope:cli requests

# …with a custom limit
pnpm --filter @workspace/api telescope:cli requests --limit 50

# Full detail for one request (spans, headers, bodies, SQL, dumps, console logs)
pnpm --filter @workspace/api telescope:cli view <requestId>

# Scalar diff between two requests
pnpm --filter @workspace/api telescope:cli compare <idA> <idB>

# Feature 7 — replay a captured request against a named target (default: local)
pnpm --filter @workspace/api telescope:cli replay <requestId>
pnpm --filter @workspace/api telescope:cli replay <requestId> staging

# No/invalid args → prints the usage block
pnpm --filter @workspace/api telescope:cli
```

**Typical workflow:**

1. `telescope:cli requests --limit 5` → grab an `id` from the printed items.
2. `telescope:cli view <id>` → pretty-printed JSON of the same payload the UI shows
   at `/telescope/requests/:id`.
3. Pipe through `jq` to pull out only what you need:

   ```bash
   pnpm --filter @workspace/api telescope:cli view <id> | jq '.data.request.durationMs, .data.request.spans'
   ```

4. `telescope:cli compare <idA> <idB>` → same-field diffs (great for "why is this
   one slow and this one fast?").

**Auth & config (env vars):**

| Var | Purpose | Default |
| --- | ------- | ------- |
| `TELESCOPE_TOKEN` | **Recommended** — sent as `Authorization: Bearer <token>`; skips the login round-trip, CI-friendly | — |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Fallback: CLI logs in and reuses the `adminAccessToken` cookie | `admin@example.com` / `Admin@123` |
| `TELESCOPE_URL` | Point at a remote API instead of localhost | `http://localhost:8080` |

Auth is resolved in order of preference: `TELESCOPE_TOKEN` first, then an admin
login. To run against a deployed API:

```bash
TELESCOPE_URL=https://api.example.com TELESCOPE_TOKEN=whsec... pnpm --filter @workspace/api telescope:cli requests
```

---

## 15. Roadmap — 20 improvements + 20 new features

> Collated 2026-08-12 after the v1 ship. Improvements polish what exists;
> features are net-new surfaces. **All 20 improvements (15.1) shipped the same
> day** — each is annotated with how it landed. §15.2 remains the backlog.

### 15.1 Improvements (polish what exists) — **all 20 shipped 2026-08-12** ✅

1. ✅ **Durable history** — `TelescopePostgresStore` implements the drop-in
   `TelescopeStore` seam (§6.2): the four Prisma models, migration
   `20260812000000_add_telescope_tables`, batch-insert flush and the retention
   cron. Switch with `TELESCOPE_MODE=postgres`.
2. ✅ **Real-time, not 10s polling** — `GET /telescope/stream` (`@Sse()`, §9.4)
   pushes new request ids over an `EventSource`; the overview page subscribes
   via `lib/use-telescope-live.ts` and inserts rows at the top instantly.
3. ✅ **Smarter eviction** — the memory ring buffer never evicts requests that
   threw or took longer than a configurable floor; it evicts oldest-fastest
   first (`telescope.store.ts` `evictIfNeeded`).
4. ✅ **Retention + cleanup cron** — `TelescopeRetentionService` runs every 30
   minutes (and once at boot): `TELESCOPE_RETENTION_MINUTES` (default 1440 =
   24 h) prunes both the Postgres tables and the memory buffer.
5. ✅ **Sampling controls** — `TELESCOPE_SAMPLE_RATE` (0–1) is applied at
   capture time in both stores; prod defaults to `0.01` without an explicit
   opt-in (`TELESCOPE_ENABLED=true`).
6. ✅ **Request diffing** — `GET /telescope/compare?a=<id>&b=<id>` returns
   same-field diffs; the requests table gains a **Compare** bulk action that
   routes to `/telescope/compare?a=…&b=…`.
7. ✅ **N+1 detector** — `n1-detector.ts` groups queries by model/operation;
   a request hitting the same shape repeatedly in a tight loop surfaces an
   "N+1 detected" warning on the detail page (unit-tested).
8. ✅ **Slow-query threshold** — the SQL page filters with `minDurationMs`
   defaulting to **100 ms**, so slow queries surface without sorting.
9. ✅ **Waterfall timeline** — `components/telescope/timeline.tsx` renders
   lane-packed overlapping bars with hover tooltips showing exact ms per
   span (duplicate span names no longer collide — index-keyed lanes).
10. ✅ **Bigger body caps** — `TELESCOPE_BODY_LIMIT_CHARS` (default 2000) is
    the truncation budget; the detail page renders bodies via the shared
    shiki `CodeBlock` (pretty-printed JSON).
11. ✅ **Path-level capture rules** — `TELESCOPE_CAPTURE_PATHS` /
    `TELESCOPE_REDACT_PATHS` (comma-separated prefixes) layered on top of the
    existing sanitizer; `should-capture.ts` honours both.
12. ✅ **Programmatic auth** — optional `TELESCOPE_TOKEN` checked by
    `TelescopeAdminGuard` in constant time (defense-in-depth alongside the
    admin JWT); `NODE_ENV=production` still auto-disables capture.
13. ✅ **Export/share** — "Copy as JSON" button on the request-detail page
    dumps the full entry (headers, body, spans, logs, SQL) to the clipboard.
14. ✅ **CLI inspection** — `pnpm --filter @workspace/api telescope:cli view
    <id>` prints one request (headers, timeline, SQL) to the terminal; also
    `requests` (recent list) and `compare <idA> <idB>`.
15. ✅ **Exception grouping quality** — exceptions carry `firstSeenAt` /
    `lastSeenAt` and dedupe into groups by `errorGroup`; the exceptions page
    shows first/last seen columns.
16. ✅ **Per-request console capture** — `telescope-console-capture.ts` patches
    `console.log/warn/error` inside the request's ALS store; the detail page
    renders them under **Console output**.
17. ✅ **Mail page depth** — clicking a mail row opens a detail dialog
    (template key, to, sent/updated times, resend id, status badge).
18. ✅ **Regression coverage** — new specs for smarter eviction
    (`telescope.store.spec.ts`), the N+1 detector (`n1-detector.spec.ts`) and
    the reworked capture rules (`request-span-context.spec.ts`). Suite is now
    **96 API tests + 353 admin tests**, all green.
19. ✅ **Type-hygiene enforcement** — `apps/api/eslint.config.js` bans
    `any`/`unknown`/`never` in `src/modules/telescope/**` and
    `scripts/telescope-cli.ts` + `scripts/gen-telescope-docs.ts` via the
    `no-restricted-syntax` rule — a CI failure instead of a code review note.
20. ✅ **Self-generating docs** — `pnpm --filter @workspace/api
    telescope:docs` runs `scripts/gen-telescope-docs.ts` and regenerates the
    §14.1 env table + endpoint list from code so they cannot drift.

### 15.2 New features (net-new surfaces) — **all 20 shipped 2026-08-13** ✅

> The §15.4 batch below implements the remaining backlog in one pass. Each
> entry is annotated with where it landed.

1. ✅ **Postgres store** — shipped earlier with the §15.1 batch (§6.2).
2. ✅ **SSE live stream** — shipped earlier (§9.4); the overview page subscribes
   via `use-telescope-live.ts`.
3. ✅ **Queue/job inspection** — `TelescopeJobRunner` + `pushJob`/`listJobs`/
   `getJob` in the store; `/telescope/jobs` page (`app/(panel)/telescope/jobs`)
   with status badges, duration, payload size and per-job detail. Jobs are
   pushed by the runner (or any `telescope.job()` producer) — §15.4.3.
4. ✅ **Scheduled-task view** — `TelescopeScheduler` registers cron schedules;
   `upsertSchedule`/`listSchedules` + `/telescope/schedules` page showing
   cron expression, last-run duration and next-run time — §15.4.4.
5. ✅ **Cache inspection** — `TelescopeCacheTracer.trace()` records per-request
   cache ops (hit/miss/set/del, key + duration) into `request.cacheOps`;
   surfaced on the request detail page and the requests table — §15.4.5.
6. ✅ **Route-handler spans** — the interceptor now captures a `handler` span
   with resolved route params (`handlerParams`) between guards and the
   service phase — §15.4.6.
7. ✅ **Request replay** — `POST /telescope/replay/:id` + `ReplayDialog` on the
   detail page re-sends a captured request to a named target (credentials
   never forwarded; `local` default; `TELESCOPE_REPLAY_TARGETS` for more) —
   §15.4.7.
8. ✅ **Environment tags** — every capture carries `environment`
   (`NODE_ENV` + hostname); the requests table + detail header render a
   dev/prod badge (`envLabel`/`envTone` helpers) — §15.4.8.
9. ✅ **Saved filters** — `lib/saved-filters.ts` (localStorage, zod-validated)
   + `SavedFilters` chip bar on the requests page: save/apply/delete a filter
   bookmark in one click — §15.4.9.
10. ✅ **Share links** — the detail page has a **Share** button that copies the
    deep link (`/telescope/requests/<id>`) for teammates — §15.4.10.
11. ✅ **Query overlay** — `Timeline` renders each SQL query as a proportional
    bar lane under the spans with a hover tooltip of the SQL text (using the
    new `startOffsetMs` captured by the Prisma listener) — §15.4.11.
12. ✅ **Slow-endpoint leaderboard** — `GET /telescope/leaderboard` (grouped
    by route, p95/avg/max/count/errors) + `LeaderboardPanel` on the overview —
    §15.4.12.
13. ✅ **Error-rate dashboard** — `GET /telescope/trends` (6h/24h buckets)
    + `ErrorRateChart` (recharts line chart of error-rate %) on the overview —
    §15.4.13.
14. ✅ **Request annotations** — `PUT /telescope/requests/:id/annotation`
    (star + comment) + `AnnotationPanel` on the detail page; stars bubble up
    to the requests table (`starred`) — §15.4.14.
15. ✅ **Side-by-side diff** — `/telescope/compare?a=<id>&b=<id>` shows the two
    requests side-by-side with the scalar diff table (shipped with §15.1);
    the detail pages remain one click away — §15.4.15.
16. ✅ **cURL/SDK export** — `SnippetMenu` on the detail page copies the request
    as **cURL / fetch / axios** via `buildRequestSnippet()` (feature 16 —
    supersedes the §15.3 single-format "Copy cURL") — §15.4.16.
17. ✅ **PII scanner** — `pii-scanner.ts` flags + redacts email/phone/JWT/SSN/
    credit-card patterns at capture (`request.piiFlags`, redaction is the
    default); the detail page shows the PII badge — §15.4.17.
18. ✅ **Threshold alerts** — `TelescopeAlertService` fires duration/error
    alerts (deduped per route+reason) into `/telescope/alerts` + an optional
    webhook (`TELESCOPE_ALERT_WEBHOOK_URL`); `AlertsPanel` on the overview —
    §15.4.18.
19. ✅ **Telescope CLI** — `telescope:cli requests|view|compare|replay`;
    `replay` shipped with this batch (§14.5 cheat-sheet) — §15.4.19.
20. ✅ **`/telescope/logs` page** — `GET /telescope/logs` flattens console
    output across requests (level filter + text search + correlation link);
    `app/(panel)/telescope/logs` — §15.4.20.

### 15.3 Improvements v2 — SSE live UI polish batch (shipped 2026-08-13) ✅

> Second polish batch: no net-new surfaces — everything below refines what
> already exists. All 20 shipped; each annotated with how it landed.

1. ✅ **Traffic time-series** — `TelescopeOverview.traffic` (24 fixed buckets of
   `{t, requests, errors}`) computed in `TelescopeMemoryStore.overviewStats`
   (`buildTraffic`) — the postgres store delegates overview stats to memory,
   so both modes get it for free. Powers the overview sparkline.
2. ✅ **Traffic sparkline** — `components/telescope/traffic-sparkline.tsx`
   (recharts `AreaChart` via `ChartContainer`) renders requests + errors over
   the range with an HH:mm tooltip; recharts was already in the stack.
3. ✅ **Status-class bars** — `TelescopeOverview.statusCounts` (2xx/3xx/4xx/5xx/
   other) from `buildStatusCounts`; the overview renders proportional mini-bars.
4. ✅ **Enriched SSE payload** — `TelescopeStreamEvent` now carries a compact
   summary (request: method/path/status/duration; exception: name/message/status)
   so the live feed renders instantly with **no refetch round-trip**.
5. ✅ **Live activity feed** — `components/telescope/live-feed.tsx` renders the
   SSE buffer as an animated (framer-motion) scrollable list; rows link to
   detail (requests) or the exceptions page; `aria-live` region.
6. ✅ **Live hook upgrade** — `use-telescope-live.ts` returns the event buffer
   (last 50, `seq`-keyed), `eventCount`, `lastEventAt`, `reconnectCount`,
   `paused` + `pause()`/`resume()`; frames parsed via the shared schema.
7. ✅ **Auto-pause on hidden tab** — the EventSource closes on
   `visibilitychange` (hidden) and reopens on focus; no background socket.
8. ✅ **Pause/resume control** — overview header button + `p` keyboard
   shortcut; a paused stream shows "paused" in the chip and an empty-state
   hint in the feed.
9. ✅ **Connection chip details** — the overview chip shows live state, total
   events, last-event age (ticking `timeAgo`), and reconnect count.
10. ✅ **Skeleton loaders** — first paint uses `Skeleton` blocks instead of a
    spinner while the overview payload loads.
11. ✅ **Animated stat values** — `components/telescope/animated-number.tsx`
    (framer-motion spring count-up); `StatCard.value` is now `ReactNode` so
    pages pass `<AnimatedNumber />` for request/error/sql counts.
12. ✅ **Error pulse** — the Errors card flashes (spring scale on `pulseKey`)
    when the error count increases between SSE pushes.
13. ✅ **Range in the URL** — the overview reads/writes `?range=` so a refresh
    keeps the same window (wrapped in the required `Suspense`).
14. ✅ **Keyboard shortcuts** — `r` = refresh, `p` = pause/resume (ignored
    while typing).
15. ✅ **Requests page live pill** — the requests table subscribes to the SSE
    stream and shows "N new requests — Refresh"; the dev clicks to refetch
    (no auto-refetch churn on a manual-paginated table).
16. ✅ **Duration color coding** — `durationTone()` (muted < 500ms, amber
    ≥ 500ms, red ≥ 2s) applied to the requests table + mobile cards, matching
    the SQL page.
17. ✅ **SQL duration presets** — one-click ≥100ms/≥500ms/≥1s/≥2s chips next
    to the min-duration input (default stays 100ms).
18. ✅ **Mail relative time** — the mail page's "Sent at" cell gains a
    "2m ago" sub-line via `timeAgo()`.
19. ✅ **Copy cURL** — the request-detail header gains a "Copy cURL" button
    that builds a ready-to-run `curl -X … -H … -d …` command from the capture
    (method, path+query, sanitized headers, body).
20. ✅ **Docs + regressions** — §15.3 below; store spec covers traffic
    bucketing + status counts; hook/feed/helpers typecheck + lint clean.

---

### 15.4 New features batch — the §15.2 backlog (shipped 2026-08-13) ✅

> One pass through the remaining 18 backlog items (3–20). Everything is wired
> end-to-end: shared schemas → store → API → client registry → admin pages.

#### 15.4.1 Shared schema layer

`packages/shared/src/schemas/domain/telescope.ts` gained the shapes for every
new surface: `TelescopeEnvironment`, `TelescopeCacheOp` (+`TelescopeCacheOpKind`),
`TelescopePiiFlag` (+`TelescopePiiCategory`), `TelescopeJobLogEntry`,
`TelescopeScheduleLog`, `TelescopeAnnotation` (+input), `TelescopeLeaderboardEntry`,
`TelescopeTrendPoint`, `TelescopeLogRow`, `TelescopeAlertEntry` (+reason), and the
query/response DTOs for each list endpoint. `TelescopeRequestLogEntrySchema` was
extended with `environment`, `starred`, `handlerParams`, `cacheOps`, `piiFlags`
and `logs` (all optional/defaulted so old persisted rows still parse).
`TelescopeOptionsSchema` gained `alertWebhookUrl`, `alertDurationMs`,
`alertWindowMinutes`, `replayTargets` and the `sampling` block.

#### 15.4.2 Store

`TelescopeStore` interface + memory store grew: `pushJob`/`listJobs`/`getJob`
(jobs ring buffer), `upsertSchedule`/`listSchedules` (name-keyed map),
`setAnnotation`/`getAnnotation` (per-request), `listLogs` (flattens each
request's console output into rows with level/text/correlation filters),
`leaderboard` (group by method+path over a window, p95/avg/max/count/errors),
`trends` (fixed-count buckets over a window), `pushAlert`/`listAlerts`. The
Postgres store delegates these read surfaces to a memory instance for parity
(rows are hydrated from Postgres first where applicable).

#### 15.4.3 Jobs (feature 3)

`telescope-job-runner.ts` runs an async job with a fixed payload and records a
`TelescopeJobLogEntry` (enqueued/started/finished timestamps, duration, payload
size, error, optional correlation). The `/telescope/jobs` admin page lists them
in a DataTable (status badges via `jobStatusTone`); clicking a row shows the
full entry. Any producer can push a job by calling the runner — no BullMQ
dependency required.

**Demo wiring (live):** `EmailSenderService` wraps every real send in
`this.jobRunner.run("send-email:<templateKey>", …)` (payload sized but never
stored — PII stays out), so the jobs page shows each email send with its
status + duration. `TelescopeModule` is now `@Global()`, so `TelescopeJobRunner`
can be injected from any module.

```typescript
// anywhere in the API — inject TelescopeJobRunner
await this.jobRunner.run("my-job", async (): Promise<void> => {
  // your work
}, { source: "manual" });
```

**Live (SSE):** the runner publishes a `job` frame on `TelescopeEventBus` when
a job finishes (terminal status + duration; the initial "running" snapshot is
persisted but not re-pushed, so long jobs don't double-refetch). The frame now
carries the job's `correlationId`, so clicking the job in the "Live activity"
card jumps straight to the request it ran inside (`/telescope/requests
?correlation=<id>`, the same drill-down the jobs table uses). The jobs page
refetches on push — a row appears or flips status without refreshing.

#### 15.4.4 Schedules (feature 4)

`telescope-scheduler.ts` keeps a cron-style registry (name, expression, last
run status/duration/error, next run). The `/telescope/schedules` page renders
one card per schedule with a `scheduleStatusTone` badge. The registry is
read-only from the UI; tasks register themselves at module boot.

**Demo wiring (live):** `TelescopeDemoService` (registered in
`TelescopeModule.register()` alongside the feature services) registers a
`telescope-demo` schedule (`*/1 * * * *`) that fires a `demo-job` every minute,
so both pages populate out of the box in local dev. It is fail-closed in
production (`NODE_ENV=production` disables the whole module).

```typescript
// register your own cron task from any module's onModuleInit:
this.scheduler.register("nightly-report", "0 3 * * *", async (): Promise<void> => {
  // periodic work
});
```

**Live (SSE):** the scheduler publishes a `schedule` frame after every run
(including failures), so the schedules page refetches on push and a card flips
from `pending` to `succeeded`/`failed` within a second of the run finishing —
and its "Live activity" card shows the run in real time.

Stream frames are a **strict discriminated union** (`TelescopeStreamEventSchema`,
four variants in `packages/shared/src/schemas/domain/telescope.ts`):
`request`, `exception`, `job`, `schedule` — each `.strict()` on its own fields,
so job/schedule frames can never mix request fields. Locked by unit tests in
`telescope-stream-event.spec.ts`.

##### Jobs vs Schedules — the mental model

**Jobs ≠ cron.** `TelescopeJobRunner` is a recording seam for **any** unit of
async work — one-off *or* recurring, queue-agnostic on purpose. It answers
*"what work ran, how long, did it fail, when?"* for anything that happened,
whether it was triggered by:

- a user action (sending an email, generating a PDF export),
- a queue worker (a BullMQ-style consumer pulling from a queue),
- or a cron tick (see below).

**Schedules = cron, specifically.** `TelescopeSchedulerService` is the **only**
piece that speaks cron. It parses real 5-field cron expressions, ticks every
30s, and fires due tasks. The schedules page answers *"what runs on a timer,
when does it run next, what was the last outcome?"*

**How they compose:** a schedule *triggers* work; that work should flow through
the job runner so you get observability on both pages at once:

```
┌────────────────────────────────────────────────────────────┐
│  Cron tick (every minute)                                  │
│  └─ telescope-demo schedule fires  ──►  schedules page     │
│       └─ jobRunner.run("demo-job")  ──►  jobs page        │
│                                                            │
│  HTTP request → email send                                 │
│       └─ jobRunner.run("send-email")  ──►  jobs page      │
│            (no schedule involved)                          │
└────────────────────────────────────────────────────────────┘
```

**TL;DR:** **Jobs** = observability for any async work (one-off *or* recurring).
**Schedules** = the cron engine for recurring work. They're separate surfaces;
the demo shows them composing (cron fires → job runs → both pages update). If
you later adopt a real queue/worker system (BullMQ, etc.), keep
`TelescopeJobRunner` as the recording adapter inside the workers — the jobs
page keeps working regardless of the underlying scheduler.

#### 15.4.5 Cache inspection (feature 5)

`telescope-cache-tracer.ts` exposes `trace(kind, key, durationMs)` which
appends a `TelescopeCacheOp` to the current request's async-local store.
Capture sites (e.g. a future Redis/Node-cache wrapper) call it; the op shows
up in `request.cacheOps` on the detail page.

#### 15.4.6 Handler spans (feature 6)

The interceptor records a `handler` span between guards and the service phase
and resolves `request.params` into `handlerParams` (route params only). The
timeline colors it with the existing `spanKindMeta` palette ("Interceptor" →
cyan; a `handler` span falls under the interceptor phase).

#### 15.4.7 Replay (feature 7)

`POST /telescope/replay/:id` rebuilds the request against a named target
(`local` = the API's own origin via `TELESCOPE_LOCAL_BASE_URL`, plus any
`TELESCOPE_REPLAY_TARGETS` name→baseUrl pairs). Credentials headers
(authorization/cookie/set-cookie) are never forwarded. The detail page's
`ReplayDialog` confirms before firing (a replay hits live endpoints) and shows
the status/duration/response-preview result.

#### 15.4.8 Environment tags (feature 8)

The capture middleware stamps `environment = { nodeEnv, host }` on every
request. The requests table and detail header render a dev/prod pill via
`envLabel()`/`envTone()` in `apps/admin/lib/telescope.ts`.

#### 15.4.9 Saved filters (feature 9)

`apps/admin/lib/saved-filters.ts` persists filter bookmarks in localStorage
behind a zod schema (corrupt data degrades to `[]`). The `SavedFilters` chip
bar on the requests page applies/saves/deletes bookmarks with toasts; the
filter state stays entirely in the page (URL/query), so no API change was
needed.

#### 15.4.10 Share links (feature 10)

The detail page header has a **Share** button that copies the current deep link
(`/telescope/requests/<id>`) to the clipboard with a toast — one click, same
clipboard+toast pattern as Copy JSON. No API change was needed because request
IDs were already URL-addressable.

#### 15.4.11 Query overlay (feature 11)

The Prisma listener now stamps `startOffsetMs` (elapsed since request start)
on every captured query. `Timeline` renders a second lane under the spans:
one proportional bar per query, hover tooltip with the SQL text, colored by
duration tone — so N+1 loops and slow queries are visible right on the
waterfall.

#### 15.4.12 Leaderboard (feature 12)

`GET /telescope/leaderboard?range=1h` returns the top-10 slowest routes by p95
(count/avg/max/errors). `LeaderboardPanel` on the overview links each row into
the filtered requests list. Also exposed as a DataTable column on the requests
page (`sort=duration`).

#### 15.4.13 Error-rate dashboard (feature 13)

`GET /telescope/trends?range=6h|24h` returns hourly-style buckets of
requests/errors/error-rate%. `ErrorRateChart` (recharts `LineChart`) on the
overview plots the % over the window — the coarser, longer lens the
24-bucket sparkline can't show.

#### 15.4.14 Annotations (feature 14)

`PUT /telescope/requests/:id/annotation` merges `{ starred?, comment? }` into
the request's annotation (idempotent; `updatedAt` bumps). `AnnotationPanel` on
the detail page toggles the star and saves a comment via mutations; the star
bubbles up to the requests table and the overview feed.

#### 15.4.15 Side-by-side diff (feature 15)

Shipped with §15.1 (`/telescope/compare`). The §15.4 batch keeps the two
request cards side-by-side with quick links into each full detail page.

#### 15.4.16 Snippet export (feature 16)

`buildRequestSnippet(request, format)` in `apps/admin/lib/telescope.ts` builds
cURL / fetch / axios snippets. `SnippetMenu` on the detail page copies the
selected format to the clipboard with a toast. Supersedes the single-format
"Copy cURL" button from §15.3 (both remain, the menu is the richer path).

#### 15.4.17 PII scanner (feature 17)

`pii-scanner.ts` (`scanPii`/`redactPii`/`scanPiiHeaders`/`redactPiiHeaders`)
detects email/phone/JWT/SSN/credit-card patterns. At capture the interceptor
scans bodies+headers, stores `piiFlags`, and **redacts by default** (masks
replace matches, so raw values never persist — the sanitizer still runs
first). Detail shows a PII badge per category. Covered by `pii-scanner.spec.ts`.

#### 15.4.18 Threshold alerts (feature 18)

`TelescopeAlertService` evaluates every captured request: 5xx → `error`;
`durationMs ≥ TELESCOPE_ALERT_DURATION_MS` → `duration`. Alerts are **always
stored** (deduped per route+reason within `TELESCOPE_ALERT_WINDOW_MINUTES` so
a failing endpoint doesn't flood the dashboard), so `/telescope/alerts` and
the overview's `AlertsPanel` populate out of the box. When
`TELESCOPE_ALERT_WEBHOOK_URL` is set, the service additionally POSTs a JSON
payload (5s timeout, failures only warn) — the webhook is the opt-in part,
storage is not. Covered by `telescope-alert.service.spec.ts`.

#### 15.4.19 CLI replay (feature 19)

The CLI gained a fourth command: `telescope:cli replay <requestId> --target
<name>` re-sends a captured request through the same `POST /telescope/replay`
API (read-only capture stays untouched). See the §14.5 cheat-sheet.

#### 15.4.20 Logs browser (feature 20)

`GET /telescope/logs` flattens console output across captured requests into
rows (`level` filter, `q` text search, `correlationId` filter, paginated).
`app/(panel)/telescope/logs` renders a DataTable with level badges and links
back to the owning request.

---

_Last updated: 2026-08-13 (v1 + 20-improvement batch + §15.3 SSE live polish + §15.4 new-features batch). **Shipped** — M0–M5, Postgres persistence (§6.2), SSE live stream (§9.4), all 20 §15.1 improvements, §15.3 SSE live UI polish, and all 20 §15.2 new features. Remaining ⏳: standalone exception filter (§5.4 — intentionally folded into the interceptor)._
