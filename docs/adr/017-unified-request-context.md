---
title: "ADR 017: One Typed Request Context and a Separate RLS Store"
tags: ["adr", "observability", "logging", "rls", "nestjs"]
description: "Architecture decision record for exactly one AsyncLocalStorage request context (correlation id, principal, tenant, IP, user agent), how it is populated, and why the transaction-scoped RLS store stays separate but is fed from it."
author: "Backend Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=630&fit=crop"
order: 17
---

# ADR 017: One Typed Request Context and a Separate RLS Store

## Status

Accepted

## Context

Three `AsyncLocalStorage` stores described "the current request":

1. `@fastify/request-context` — `correlationId` and `traceId`, mirrored in a
   `preHandler` hook from fields the correlation middleware stamped on the raw
   request.
2. `CorrelationContextService` — a second ALS holding only the correlation id,
   entered by an interceptor (so guards never saw it), read by the outbox.
3. `rlsStorage` (`prisma/rls-context.ts`) — `userId`, `organizationId`,
   `bypass`, `requireExplicitContext`, `systemOperation` for the Postgres
   session variables.

On top of that the correlation id lived on `request.correlationId`, the
verified tenant on `request.authorizationContext`, the pino request id was
Fastify's `request.id` (derived from the raw `X-Request-Id` header), and the
authorization audit read `X-Correlation-Id` straight from the headers. A
client could send an unbounded or unsafe correlation id (newlines, 10 KB).
Logs, the error envelope and the outbox could disagree about which id a
request had.

## Decision

**One typed request context** — `RequestContext` in
`apps/api/src/common/context/request-context.ts`, reached only through
`RequestContextService`:

| Field | Filled by | When |
| --- | --- | --- |
| `correlationId`, `traceId` (= correlation id until W3C trace context is propagated) | `RequestContextMiddleware` | request start (first middleware, before every guard) |
| `ip` (Fastify `request.ip` semantics: `X-Forwarded-For` only with `TRUST_PROXY`), `userAgent` (≤ 512 chars) | `RequestContextMiddleware` | request start |
| `principal.userId`, `principal.impersonatorId` (the real super-admin behind an impersonation token) | `AuthGuard`, `RefreshTokenGuard` | after authentication |
| `tenant.organizationId` / `storeId` / `locationId` — **server-verified ids only** | `AuthorizationGuard` | after tenant resolution |

- The store holds one mutable slot of **immutable snapshots**: each lifecycle
  phase publishes a new snapshot that everything downstream sees; a snapshot
  already read never changes.
- **One correlation id per request**, decided once by `correlationIdFor(raw)`
  (`common/context/correlation-id.ts`): the incoming `X-Correlation-Id` /
  `X-Request-Id` when it passes `CorrelationIdSchema` (1–64 chars of
  `[A-Za-z0-9._:-]`), otherwise a generated nanoid. It is memoized per raw
  request, so Fastify's `genReqId` (→ `request.id`, pino's `correlationId`
  binding), the middleware and the error filter always agree —
  even for failures raised before the middleware (oversized body, bad JSON).
- Consumers: `LogService` (adds `correlationId`, `userId`, `impersonatorId`,
  `organizationId` to every line), `ResponseInterceptor` and
  `GlobalExceptionFilter` (`meta.correlationId`), `PlatformOutboxService`
  (outbox rows / Kafka envelopes), the authorization audit (`requestId`),
  `AuthorizationDecisionsController` and `RlsInterceptor` (tenant).
- Removed: `@fastify/request-context`, `CorrelationContextService` and its
  interceptor/module, `CorrelationIdMiddleware`, `request.correlationId`,
  `request.traceId`, `request.authorizationContext`.

**The RLS store stays separate** (`prisma/rls-context.ts`, unchanged
semantics). `RlsInterceptor` derives the handler's RLS scope from the request
context (verified tenant) plus the user flags on `request.user`.

## Alternatives considered

- **Merge the RLS fields into `RequestContext`.** Rejected. RLS scopes are
  *transaction*-scoped and nest: `RlsPreHandlerMiddleware` opens an allowlisted
  `request.pre_handler` bypass for guards, `RlsInterceptor` narrows it for the
  handler, and `runWithSystemRlsContext()` / `TenantTransactionService` open
  short system-operation scopes *inside* a request and inside queue jobs that
  have no request at all. Folding "which Postgres role/bypass is active right
  now" into "who is this request" would either make request identity mutable
  per transaction or make RLS bypass depend on request plumbing — both are
  security regressions waiting to happen. Two stores with one clear feed
  (request context → RLS scope) keep each invariant local and testable.
- **Keep `@fastify/request-context`.** Rejected: it is initialized in a Fastify
  hook that Nest's e2e/test apps never register, it is untyped (`get(key)`),
  and it duplicated the Nest middleware path. A Nest middleware entering the
  ALS is proven (unit + real-socket probe) to propagate through body parsing,
  guards, interceptors and handlers.
- **Request-scoped Nest providers.** Rejected: `Scope.REQUEST` cascades
  through every dependent provider (rules/02, "Request-scoped providers").

## Consequences

- Code reads the request's identity from `RequestContextService`, never from
  ad-hoc request fields or raw headers.
- `sessionId` is not part of the context yet: access tokens carry no session
  id. Add it when they do.
- A client-supplied correlation id longer than 64 characters or with unsafe
  characters is replaced — clients that relied on echoing such ids get a
  generated one (visible in `X-Correlation-Id`).
- Outside a request (boot, cron, BullMQ workers, the Kafka consumer) the
  context is `undefined`; enrichment calls are no-ops and log lines carry no
  request fields. Background work keeps using `runWithSystemRlsContext`.
- Tests: `common/context/*.spec.ts`, `common/middleware/request-context.middleware.spec.ts`
  (Fastify integration incl. POST bodies), `modules/auth/guards/__tests__/auth-guards-request-context.spec.ts`,
  the authorization-guard and RLS-interceptor specs, `logs.service.spec.ts`,
  `global-exception.filter.spec.ts` and `test/app.e2e-spec.ts`.
