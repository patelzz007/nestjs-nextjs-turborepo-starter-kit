---
title: "HTTP server (Fastify)"
description: "How the API's Fastify layer is configured: adapter options, plugins, hooks, middleware timing, raw bodies, SSE, query strings, compiled validation, serialization and e2e tests — with the traps that are specific to Fastify."
order: 46
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
tags: ["api", "fastify", "nestjs", "http", "performance"]
---

# HTTP server (Fastify)

The API runs NestJS on the **Fastify** adapter (`@nestjs/platform-fastify`); Express is not
installed. Why: [ADR 027](../../adr/027-fastify-http-adapter.md). Everything below is wired in
`apps/api/src/bootstrap/` — `bootstrap-app.ts` (adapter, CORS, Swagger),
`register-fastify-plugins.ts` and `register-fastify-hooks.ts`. The request lifecycle as a whole is in
[Architecture §3](../architecture.md#3-request-lifecycle-api).

## Adapter options

| Option | Value | Why |
| --- | --- | --- |
| `bodyLimit` | 1 MiB | Bounded JSON bodies; file bytes go straight to object storage ([Storage](../storage/overview.md)) |
| `rawBody` (Nest option) | `true` | The Resend webhook verifies its signature over the **exact** bytes received (`req.rawBody`); re-serialized JSON would break it |
| `trustProxy` | only the proxies in `TRUST_PROXY` | `request.ip`, rate-limit keys and audit rows agree, and `X-Forwarded-For` from an untrusted peer is ignored |
| `genReqId` | the validated correlation id | `request.id` **is** the correlation id ([ADR 017](../../adr/017-unified-request-context.md)) |
| `logger` | pino at `LOG_LEVEL`, redaction from `SENSITIVE_FIELD_NAMES` | [Observability](../operations/observability.md#redaction) |
| `keepAliveTimeout` | 65 s | Longer than common load-balancer idle timeouts, so the LB never reuses a socket the API just closed |
| `exposeHeadRoutes` | `true` | Every `GET` answers `HEAD` (cheap uptime probes) |

## Plugins

| Plugin | When | Notes |
| --- | --- | --- |
| `@fastify/cookie` | always | Auth cookies (`reply.setCookie` / `clearCookie`, `request.cookies`) |
| `@fastify/multipart` | always | At most 5 files of 5 MiB per request |
| CORS (`app.enableCors`) | always | `CORS_ORIGINS`, credentials, and the explicitly allowed non-safelisted headers (`X-Client-Type`, `X-Mutation-Intent`, `Idempotency-Key`, …) |
| `@fastify/compress`, `@fastify/etag` | outside development | Skipped in dev to keep boot and per-route hooks light |
| `@fastify/rate-limit` | security hardening on | Global 300 requests/min keyed by **IP + API version**; the email webhook route 60/min (the route's own per-IP limiter, `WEBHOOK_RATE_LIMIT_PER_MINUTE`, default 120, `0` = off, applies on top in every environment); errors use the standard envelope (`RATE_LIMITED` + `Retry-After`) |
| `@fastify/under-pressure` | security hardening on | `503` when event-loop delay > 1 s or heap > 512 MiB |
| `@fastify/helmet` | security hardening on | CSP with nonces, HSTS (1 year, preload), `no-referrer` |

Security hardening is on in production and opt-in elsewhere with `SECURITY_HARDENING_ENABLED=1`
(set it in staging). Per-route auth throttling (`@nestjs/throttler`, Redis storage) is separate and
always on ([Authentication](../security/authentication.md#login-hardening)).

## Hooks

| Hook | Does |
| --- | --- |
| `onRoute` | Per-route config: the webhook rate limit, and `requestTimeout: 0` for streaming routes (`…/stream`, `…/events`) so SSE connections are not cut |
| `onRequest` | `Accept-version: v2` rewrites `/api/v1/…` to that version's prefix ([Architecture §6](../architecture.md#6-api-versioning)) |
| `onSend` | `x-request-id`, `x-api-version` and `Sunset` headers; CSP nonces stamped into HTML (Swagger UI) |
| `onResponse` | One access line through `LogService`: method, version, redacted URL, status, duration, request id |
| `onError` | An error-level line with stack for **5xx only** (4xx are already in the access line) |
| `preSerialization` | Converts `bigint` (Prisma epoch-ms columns) to `number`, so `JSON.stringify` never throws |

## Fastify-specific traps

- **Nest middleware runs before the body is parsed.** Nest bundles `middie`, so `NestMiddleware`
  works, but it runs during Fastify's `onRequest` against the raw Node `IncomingMessage` — there is
  no `req.body` yet. The two middlewares (`RequestContextMiddleware`, `RlsPreHandlerMiddleware`) only
  need headers. Anything that needs the parsed body belongs in a guard, pipe or interceptor.
- **Query strings are flat.** Fastify does not parse `?filter[status][in]=A,B` into nested objects;
  bracket keys stay literal and a repeated key becomes an array. List endpoints run
  `BracketQueryPipe` (through `@ZodListQuery`), which nests them with a prototype-pollution-safe
  parser — no global parser change ([List queries](./list-queries.md)).
- **Raw body for signatures.** Read `req.rawBody` (`RawBodyRequest<FastifyRequest>`), never
  `JSON.stringify(req.body)`, when verifying a signature.
- **SSE.** `@Sse()` works on Fastify (`GET /api/v1/notifications/email-log/events`); the route
  must match the `onRoute` streaming rule above or the request timeout ends the stream.
- **Register plugins before routes** that depend on them; `registerFastifyPlugins` runs before CORS
  and the hooks for that reason. Register on `app.getHttpAdapter().getInstance()` — Nest's own
  `app.register()` typings do not match the `@fastify/*` module augmentations.
- **Types:** `FastifyRequest` / `FastifyReply` everywhere; middleware takes `IncomingMessage` /
  `ServerResponse`. Never import `express`.

## Validation and serialization

`ZodValidationPipe` (`common/pipes/zod-validation.pipe.ts`) compiles each shared zod schema to
JSON Schema once and validates with **Ajv** (type coercion for query and path values), then runs
`schema.safeParse()` on the coerced value, so transforms, defaults and refinements still apply —
zod stays the single contract. `@ZodListQuery` uses zod only, because its bracket grammar is
normalized first. Every JSON-Schema `format` the contracts emit must be registered in
`AJV_STRING_FORMATS` (a guard test fails otherwise). `warmupAjvValidators` compiles the validators
right after the server starts listening.

## Tests

API e2e tests (`apps/api/test/*.e2e-spec.ts`) call `app.inject()` (light-my-request) on a
`NestFastifyApplication` — no port, no supertest. See [Testing authorization](../authorization/testing.md)
for the database-backed suites.
