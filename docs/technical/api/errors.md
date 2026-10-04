---
title: "Error Model — One Envelope for Every Failure"
tags: ["api", "errors", "nestjs", "contracts", "observability"]
description: "How the API turns every thrown value — AppError, Nest HttpException, Prisma errors, framework errors, bugs — into one stable, client-safe error envelope, and how clients read it."
order: 14
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Error Model — One Envelope for Every Failure

> [!NOTE]
> **TL;DR.** Every failed request (HTTP 4xx/5xx) answers with exactly one JSON shape:
>
> ```json
> {
>   "success": false,
>   "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": { "issues": [] } },
>   "meta": { "correlationId": "pAQjAusSsiam-6VkWxOYb", "timestamp": 1790812800000 }
> }
> ```
>
> It mirrors the success envelope (`{ success: true, data, meta }`). Branch on `error.code`,
> never on `error.message`. Quote `meta.correlationId` in bug reports — it is the key to the
> server log line. The decision and its alternatives are recorded in
> [ADR 016](../../adr/016-standard-error-envelope.md).

---

## Table of Contents

1. [The contract](#1-the-contract)
2. [Throwing errors in the API](#2-throwing-errors-in-the-api)
3. [How every thrown value is mapped](#3-how-every-thrown-value-is-mapped)
4. [What is never sent to a client](#4-what-is-never-sent-to-a-client)
5. [Logging and correlation](#5-logging-and-correlation)
6. [Reading errors on the client](#6-reading-errors-on-the-client)
7. [Standard codes](#7-standard-codes)
8. [Testing](#8-testing)

---

## 1. The contract

The envelope is a zod schema in `packages/shared/src/schemas/api/api-error.ts`
(`ApiErrorResponseSchema`), shared by the API (serialization + Swagger `ApiErrorResponseDto`)
and every client (parsing).

| Field | Type | Meaning |
|---|---|---|
| `success` | `false` | Always `false` for errors, always `true` for successes. |
| `error.code` | `SCREAMING_SNAKE_CASE` string (≤ 64 chars) | Stable, machine-matchable. Either a [standard code](#7-standard-codes) or a module's domain code (`ACCESS_TOKEN_EXPIRED`, `REWARD_OUT_OF_STOCK`, `PERMISSION_DENIED`, …). |
| `error.message` | non-empty string | Human-readable and client-safe. May change wording at any time — do not match on it. |
| `error.details` | JSON object, optional | Client-safe structured data: `issues` for validation errors, `lockedUntil`/`remainingSeconds` on `ACCOUNT_LOCKED`, `retryAfterSeconds` on 429/409-in-progress, `checks` on readiness 503. |
| `meta.correlationId` | string | Same id as the `X-Correlation-Id` response header and the server log line. |
| `meta.timestamp` | epoch ms | When the error response was produced. |

The HTTP status code is the status line — it is not repeated in the body.

---

## 2. Throwing errors in the API

Throw a typed `AppError` subclass from `apps/api/src/common/errors/app-error.ts`. Its
`message` and `details` **must** be safe to show a client; put anything sensitive in `cause`
(logged server-side only).

| Class | Status | Default code |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthenticationError` | 401 | `UNAUTHORIZED` |
| `AuthorizationError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `RateLimitError` | 429 | `RATE_LIMITED` |
| `ExternalServiceError` | 502 | `EXTERNAL_SERVICE_ERROR` |
| `DependencyUnavailableError` | 503 | `SERVICE_UNAVAILABLE` |

```ts
// ❌ DON'T — a bare Error becomes an opaque 500, and English prose is not matchable
throw new Error("Email already in use");

// ✅ DO — a stable code, a safe message, structured details
throw new ConflictError({ code: "EMAIL_TAKEN", message: "Email already in use", details: { field: "email" } });

// ✅ DO — keep the provider failure for the logs, not for the client
throw new ExternalServiceError({ message: "Could not send the email. Please retry.", cause: providerError });
```

Existing Nest `HttpException`s (`new UnauthorizedException({ message, error: "ACCESS_TOKEN_EXPIRED" })`,
`AuthorizationException`, the `ZodValidationPipe`) keep working unchanged — the filter reads their
`error` field as the code. New code should prefer `AppError`.

Domain-specific errors extend a subclass (see `platform/idempotency/idempotency.errors.ts` and
`platform/persistence/persistence.errors.ts` for examples).

---

## 3. How every thrown value is mapped

`GlobalExceptionFilter` (`apps/api/src/common/errors/global-exception.filter.ts`, registered via
`APP_FILTER`) is the **only** place a thrown value becomes an HTTP response. It delegates to the
pure function `mapException()` (`exception-mapper.ts`):

| Thrown value | Status | `error.code` | `error.message` |
|---|---|---|---|
| `AppError` (any subclass) | its `httpStatus` | its `code` | its `message` (always shown) |
| `HttpException` with `{ message, error: "SOME_CODE" }` | its status | `SOME_CODE` | the message |
| `HttpException` with Nest's default body (`error: "Bad Request"`) or a string | its status | [standard code](#7-standard-codes) for the status | the message |
| `ZodValidationPipe` failure (`{ errors: [{ path, message, code }] }`) | 400 | `VALIDATION_ERROR` | `Validation failed` + `details.issues` |
| Nest's array-of-messages validation body | 400 | `VALIDATION_ERROR` | `Validation failed.` + `details.issues` |
| `HttpException` 5xx | its status | its code | **production:** generic message, no details · **development/test:** authored message |
| Prisma `P2002` (unique violation) | 409 | `CONFLICT` | generic — column names never leak |
| Prisma `P2025` (record not found) | 404 | `NOT_FOUND` | generic |
| Prisma initialization error (database unreachable) | 503 | `SERVICE_UNAVAILABLE` | generic |
| Fastify framework errors (oversized body, bad content type, unknown route) | 413 / 415 / 404 … | standard code | the framework's safe message |
| Malformed JSON body | 400 | `BAD_REQUEST` | generic |
| `@fastify/rate-limit` rejection | 429 | `RATE_LIMITED` | retry hint + `details.retryAfterSeconds` + `Retry-After` header |
| Anything else (a bug, a `ZodError` from server-side parsing, a thrown string) | 500 | `INTERNAL_ERROR` | generic (`development` adds `details.debug.{name,message}`, never a stack) |

A server-side `ZodError` is deliberately a **500**: client input is validated by the pipe before
the handler runs, so a `ZodError` inside a service means the server produced or received
malformed data — a bug, not a bad request.

---

## 4. What is never sent to a client

- Stack traces (in any environment).
- SQL, Prisma/driver messages, constraint or column names.
- File paths, hostnames, connection strings, provider SDK messages.
- The message of an unexpected (non-`AppError`) 5xx in production.

The envelope itself is validated with `ApiErrorResponseSchema` before it is sent; a mapping bug
degrades to a generic `INTERNAL_ERROR` envelope instead of emitting something malformed.

---

## 5. Logging and correlation

- **Unexpected 5xx** (bugs, provider failures): `LogService.error` with the full stack, error
  name/message, HTTP status, `errorCode`, the (query-redacted) URL, `userId` and
  `correlationId`.
- **Expected 5xx** (`AppError` such as the readiness 503 while draining): `LogService.warn`
  without a stack, so probes do not flood the error stream.
- **4xx**: not logged by the filter — the access-log line (`onResponse` hook) already records
  method, URL, status and request id.
- All metadata passes through the centralized redaction list — see
  [Observability → Logs](../operations/observability.md#logs).

The correlation id comes from `X-Correlation-Id` / `X-Request-Id` when the caller sends a valid
one (1–64 characters of `A–Z a–z 0–9 . _ : -`), otherwise it is generated per request. It is
decided once per request and read from the one request context
([ADR 017](../../adr/017-unified-request-context.md)), so `meta.correlationId`, the
`X-Correlation-Id` / `x-request-id` response headers, the log lines and pino's `correlationId`
binding always carry the same value — including failures raised before the handler (oversized
body, malformed JSON).

---

## 6. Reading errors on the client

`packages/client/src/lib/api/api-request.ts` parses the envelope into an `ApiError`:

| `ApiError` field | Source |
|---|---|
| `message` | `error.message` |
| `code` **and** `error` (legacy name) | `error.code` |
| `statusCode` | the HTTP status |
| `details` | `error.details` |
| `lockedUntil`, `remainingSeconds` | lifted from `details` on `ACCOUNT_LOCKED` |
| `correlationId` | `meta.correlationId` |

Existing UI code (`error.error === "INVALID_CREDENTIALS"`, `statusCode === 401`,
`isAccountLockedError`) works unchanged. The parser also still accepts the legacy flat body
(`{ message, error?, statusCode? }`) for responses that do not come through the filter.

```ts
// ✅ DO — branch on the code
if (error instanceof ApiError && error.code === "IDEMPOTENCY_KEY_REUSED") { … }

// ❌ DON'T — string-match the message
if (error.message.includes("already used")) { … }
```

---

## 7. Standard codes

Exported as `StandardApiErrorCodeSchema` / `ApiErrorCodes` from `@workspace/shared`:

| Code | Typical status |
|---|---|
| `BAD_REQUEST` | 400 (also the fallback for unmapped 4xx) |
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 |
| `UNPROCESSABLE_ENTITY` | 422 |
| `RATE_LIMITED` | 429 |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 |
| `IDEMPOTENCY_KEY_REUSED` | 409 |
| `IDEMPOTENCY_REQUEST_IN_PROGRESS` | 409 |
| `INTERNAL_ERROR` | 500 (also the fallback for unmapped 5xx) |
| `EXTERNAL_SERVICE_ERROR` | 502 |
| `SERVICE_UNAVAILABLE` | 503 |
| `GATEWAY_TIMEOUT` | 504 |

The idempotency codes are described in [API Routes → Idempotency](./routes.md#10-idempotency).

---

## 8. Testing

- `apps/api/src/common/errors/exception-mapper.spec.ts` — every mapping row above.
- `apps/api/src/common/errors/global-exception.filter.spec.ts` — a real Fastify + Nest app:
  validation pipe, `AuthorizationException`, malformed JSON, oversized body, unknown route,
  Prisma P2002, unexpected errors (logged, not leaked), rate limiting.
- `packages/shared/src/schemas/api/api-error.test.ts` — the envelope schema.
- `packages/client/src/lib/api/api-error.test.ts` — client parsing and backwards compatibility.
- `apps/api/test/app.e2e-spec.ts` — the envelope from the real `AppModule`.
