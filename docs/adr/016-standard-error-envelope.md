---
title: "ADR 016: Standard Error Envelope and Global Exception Filter"
tags: ["adr", "api", "errors", "nestjs", "contracts"]
description: "Architecture decision record for answering every failed request with one zod-defined error envelope produced by a single global exception filter."
author: "Backend Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=630&fit=crop"
order: 16
---

# ADR 016: Standard Error Envelope and Global Exception Filter

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Backend Team

## Context

Successful responses were wrapped by `ResponseInterceptor` in
`{ success: true, data, meta: { correlationId, timestamp } }`, but failures had no single shape:

- Nest's default exception layer answered `{ statusCode, message, error }` — or, for
  `new UnauthorizedException({ message, error })`, just `{ message, error }` with no status.
- The validation pipe answered `{ message, errors, statusCode }`.
- `@fastify/rate-limit` answered its own `{ statusCode, error, message }`.
- Unexpected errors fell through to Nest's generic 500, and Prisma errors were not translated
  at all (a unique violation surfaced as a 500).
- `StandardErrorResponse` / `ErrorCodes` in `common/errors/standard-error.response.ts` described
  an envelope nothing produced (dead code), and the Swagger `ApiErrorResponseDto` documented a
  shape the API never returned.

Clients therefore needed several parsers, could not rely on a machine code, and had no
correlation id to quote. `rules/02-backend-nestjs.md` already required stable codes and "no
stack traces or provider secrets to clients" — nothing enforced it.

## Decision

1. **One envelope**, defined once as a zod schema in `@workspace/shared`
   (`ApiErrorResponseSchema`, `packages/shared/src/schemas/api/api-error.ts`):
   `{ success: false, error: { code, message, details? }, meta: { correlationId, timestamp } }`.
   `meta` reuses the success envelope's `ApiResponseMetaSchema`, so both shapes share
   `success` + `meta`. `code` is an open `SCREAMING_SNAKE_CASE` string (modules own domain codes);
   the generic codes are the enum `StandardApiErrorCodeSchema`.
2. **One place maps errors**: `GlobalExceptionFilter`, registered via `APP_FILTER`, delegating
   to the pure `mapException()` so the mapping is unit-testable without HTTP. Fastify framework
   errors reach it too, because Nest routes Fastify's error handler through global filters.
3. **A typed `AppError` hierarchy** (`ValidationError`, `AuthenticationError`,
   `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError`,
   `ExternalServiceError`, `DependencyUnavailableError`) whose message/details are client-safe
   by contract; sensitive context goes in `cause`.
4. **Safety defaults**: no stack traces ever; unexpected-error and 5xx `HttpException` messages
   are replaced by generic ones in production; Prisma P2002 → 409, P2025 → 404, initialization
   failures → 503; a `ZodError` raised inside a service is a 500 (server bug), not a 400.
5. **Backwards-compatible client**: the client `ApiError` keeps its public fields (`error` holds
   the code, `statusCode` the HTTP status, lockout fields lifted from `details`) and still
   parses the legacy flat body.

## Alternatives considered

- **RFC 9457 `application/problem+json`.** A real standard, but its shape (`type`, `title`,
  `detail`, `instance`) does not mirror our success envelope, so every client would branch on
  content type and learn two vocabularies. Rejected for now; the envelope can be mapped to
  problem+json later behind content negotiation if an external consumer needs it.
- **Keep Nest's default body and document it.** Rejected: it has no correlation id, its
  `error` field is sometimes a code and sometimes an HTTP reason phrase, and it leaks whatever a
  developer put in an exception message on 5xx.
- **Map errors inside `ResponseInterceptor` (`catchError`).** Rejected: interceptors never see
  guard, middleware, body-parser, 404 or rate-limit failures; only an exception filter covers
  every path.
- **A closed enum for `error.code`.** Rejected: it would force every feature's domain codes
  into one shared file and make adding a code a cross-package change. The pattern-validated
  string plus an enum of standard codes keeps codes stable without central coupling.

## Consequences

### Positive
- One parser for every client; branch on `error.code`; `meta.correlationId` ties a user report
  to the exact server log line.
- Provider/SQL/stack details cannot reach a client by accident.
- Swagger's `ApiErrorResponseDto` now documents what the API actually returns.

### Negative
- **Wire change** for anything that read the old flat body directly (`response.json().error`
  used to be the code; it is now `response.json().error.code`). The shared client and the
  e2e tests were updated; third-party consumers must be told.
- Two ways to throw still coexist (`AppError` and legacy `HttpException`s) until the latter are
  migrated module by module.

### Follow-ups
- Migrate module-level `HttpException`s to `AppError` subclasses as modules are touched.
- Consider RFC 9457 content negotiation if external API consumers appear.

## References

- [Error Model guide](../error-model.md)
- `rules/02-backend-nestjs.md` → "API errors", "Global exception filter — reference"
