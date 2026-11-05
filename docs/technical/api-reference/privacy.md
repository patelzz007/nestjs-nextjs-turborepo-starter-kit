---
title: "API reference — Privacy: your own data"
description: "\"Download my data\": one ZIP of everything the platform holds about the signed-in person (a manifest and one JSON file per section), audited, once a day, never while impersonating."
order: 10
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Privacy: your own data

"Download my data": one ZIP of everything the platform holds about the signed-in person (a manifest and one JSON file per section), audited, once a day, never while impersonating.

How these endpoints fit together: [ADR 077: personal-data export and erasure](../../adr/077-personal-data-export-and-erasure.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Privacy

### GET /api/v1/admin/users/{userId}/erasure

Support: an account's open (or latest) erasure request

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Policy** `DELETE:USER` — Support reads an account's erasure request.
- Requires a **verified email address**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AdminAccountErasureController_status` · [source](../../../apps/api/src/contexts/privacy/presentation/http/admin-account-erasure.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The request, or none

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.erasure` | object \| null | yes |  |
| `data.erasure.cancelledAt` | integer \| null | yes |  |
| `data.erasure.completedAt` | integer \| null | yes |  |
| `data.erasure.id` | string | yes |  |
| `data.erasure.reason` | string \| null | yes |  |
| `data.erasure.requestedAt` | integer | yes |  |
| `data.erasure.requestedBy` | "self" \| "support" | yes |  |
| `data.erasure.scheduledFor` | integer | yes |  |
| `data.erasure.status` | "PENDING" \| "CANCELLED" \| "COMPLETED" | yes |  |
| `data.erasure.userId` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/users/{userId}/erasure

Support: erase an account for someone who asked another way, with a recorded reason (30-day grace; the person is signed out now)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Policy** `DELETE:USER` — Support erases an account for someone who asked another way.
- Requires a **verified email address**.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AdminAccountErasureController_request` · [source](../../../apps/api/src/contexts/privacy/presentation/http/admin-account-erasure.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 10–500 |

**Response 201 Created** (`application/json`) — The request

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.id` | string | yes |  |
| `data.reason` | string \| null | yes |  |
| `data.requestedAt` | integer | yes |  |
| `data.requestedBy` | "self" \| "support" | yes |  |
| `data.scheduledFor` | integer | yes |  |
| `data.status` | "PENDING" \| "CANCELLED" \| "COMPLETED" | yes |  |
| `data.userId` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/users/{userId}/erasure/cancel

Support: cancel an account's erasure during its grace period

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Policy** `DELETE:USER` — Support cancels an account's erasure.
- Requires a **verified email address**.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AdminAccountErasureController_cancel` · [source](../../../apps/api/src/contexts/privacy/presentation/http/admin-account-erasure.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The cancelled request

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.id` | string | yes |  |
| `data.reason` | string \| null | yes |  |
| `data.requestedAt` | integer | yes |  |
| `data.requestedBy` | "self" \| "support" | yes |  |
| `data.scheduledFor` | integer | yes |  |
| `data.status` | "PENDING" \| "CANCELLED" \| "COMPLETED" | yes |  |
| `data.userId` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/me/data-export

Download everything the platform holds about you, as one ZIP (once a day; never while impersonating)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: 1 requests per `PERSONAL_DATA_EXPORT_WINDOW_MS` ms per signed-in principal (default limiter).
- Content type: no request body; returns `application/zip` (errors are always `application/json`)
- Operation id `PersonalDataController_dataExport` · [source](../../../apps/api/src/contexts/privacy/presentation/http/personal-data.controller.ts)

**Response 200 OK** — The ZIP: manifest.json and one JSON file per section (Content-Disposition: attachment) (`application/zip`)

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/me/erasure

Your account's erasure request: open, cancelled, or none

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AccountErasureController_status` · [source](../../../apps/api/src/contexts/privacy/presentation/http/account-erasure.controller.ts)

**Response 200 OK** (`application/json`) — The open (or most recent) request

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.erasure` | object \| null | yes |  |
| `data.erasure.cancelledAt` | integer \| null | yes |  |
| `data.erasure.completedAt` | integer \| null | yes |  |
| `data.erasure.id` | string | yes |  |
| `data.erasure.reason` | string \| null | yes |  |
| `data.erasure.requestedAt` | integer | yes |  |
| `data.erasure.requestedBy` | "self" \| "support" | yes |  |
| `data.erasure.scheduledFor` | integer | yes |  |
| `data.erasure.status` | "PENDING" \| "CANCELLED" \| "COMPLETED" | yes |  |
| `data.erasure.userId` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/me/erasure

Delete my account: confirmed with your password; every session ends now, and the account is erased after 30 days unless you cancel

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: 3 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AccountErasureController_requestOwn` · [source](../../../apps/api/src/contexts/privacy/presentation/http/account-erasure.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `password` | string | yes | length 1–256 |

**Response 201 Created** (`application/json`) — The request, with the date it will be carried out

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.id` | string | yes |  |
| `data.reason` | string \| null | yes |  |
| `data.requestedAt` | integer | yes |  |
| `data.requestedBy` | "self" \| "support" | yes |  |
| `data.scheduledFor` | integer | yes |  |
| `data.status` | "PENDING" \| "CANCELLED" \| "COMPLETED" | yes |  |
| `data.userId` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/me/erasure/cancel

Change your mind: cancel your account's erasure during the grace period

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AccountErasureController_cancelOwn` · [source](../../../apps/api/src/contexts/privacy/presentation/http/account-erasure.controller.ts)

**Response 200 OK** (`application/json`) — The cancelled request

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.id` | string | yes |  |
| `data.reason` | string \| null | yes |  |
| `data.requestedAt` | integer | yes |  |
| `data.requestedBy` | "self" \| "support" | yes |  |
| `data.scheduledFor` | integer | yes |  |
| `data.status` | "PENDING" \| "CANCELLED" \| "COMPLETED" | yes |  |
| `data.userId` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
