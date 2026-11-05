---
title: "API reference — Webhooks (outgoing and received)"
description: "A business's endpoints for signed event deliveries (create, update, switch on or off, rotate the secret, send a test), the delivery log and redelivery (owner-only, `merchant:manage_webhooks`), and the admin's log of every webhook the platform received."
order: 9
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Webhooks (outgoing and received)

A business's endpoints for signed event deliveries (create, update, switch on or off, rotate the secret, send a test), the delivery log and redelivery (owner-only, `merchant:manage_webhooks`), and the admin's log of every webhook the platform received.

How these endpoints fit together: [Outgoing webhooks guide](../api/outgoing-webhooks.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Tenant Webhooks

### GET /api/v1/tenants/{tenantSlug}/webhooks/deliveries

The delivery log, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_listDeliveries` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 25, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, eventType, endpointId |

**Response 200 OK** (`application/json`) — Deliveries; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].attempts` | integer | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].deliveredAt` | integer \| null | yes |  |
| `data[].endpointId` | string (uuid) | yes |  |
| `data[].endpointUrl` | string | yes | length 1–2048 |
| `data[].eventId` | string (uuid) | yes |  |
| `data[].eventType` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded" \| "webhook.test" | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].lastAttemptAt` | integer \| null | yes |  |
| `data[].lastDurationMs` | integer \| null | yes |  |
| `data[].lastError` | string \| null | yes | at most 500 characters |
| `data[].lastStatusCode` | integer \| null | yes | min -9007199254740991 |
| `data[].nextAttemptAt` | integer \| null | yes |  |
| `data[].status` | "PENDING" \| "FAILED" \| "SUCCEEDED" \| "DEAD" \| "CANCELLED" | yes |  |
| `meta.hasNext` | boolean | yes | Whether a next page exists |
| `meta.hasPrevious` | boolean | yes | Whether a previous page exists |
| `meta.limit` | integer | yes | Items per page; range 1–100 |
| `meta.nextCursor` | string \| null | yes | Opaque cursor for the next page, or null when there are no more rows |
| `meta.page` | integer | yes | Current page (1-indexed); min 1 |
| `meta.total` | integer | yes | Total rows matching the current filters |
| `meta.totalIsCapped` | boolean | no | True when `total` is a lower bound: counting stopped at the list's cap, so there are at least this many rows (page through with `nextCursor`). Absent or false: `total` is exact. |
| `meta.totalPages` | integer | yes | Total pages for the current filters and page size; min 1 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/webhooks/deliveries/{deliveryId}/redeliver

Send a settled delivery again (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_redeliver` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `deliveryId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 202 Accepted** (`application/json`) — The queued delivery

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.attempts` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.deliveredAt` | integer \| null | yes |  |
| `data.endpointId` | string (uuid) | yes |  |
| `data.endpointUrl` | string | yes | length 1–2048 |
| `data.eventId` | string (uuid) | yes |  |
| `data.eventType` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded" \| "webhook.test" | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.lastAttemptAt` | integer \| null | yes |  |
| `data.lastDurationMs` | integer \| null | yes |  |
| `data.lastError` | string \| null | yes | at most 500 characters |
| `data.lastStatusCode` | integer \| null | yes | min -9007199254740991 |
| `data.nextAttemptAt` | integer \| null | yes |  |
| `data.status` | "PENDING" \| "FAILED" \| "SUCCEEDED" \| "DEAD" \| "CANCELLED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/webhooks/endpoints

List the tenant's webhook endpoints

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_listEndpoints` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status |

**Response 200 OK** (`application/json`) — The tenant's endpoints (at most ten)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].consecutiveFailures` | integer | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].description` | string | yes | at most 200 characters |
| `data[].disabledAt` | integer \| null | yes |  |
| `data[].disabledReason` | "MANUAL" \| "FAILING" \| null | yes |  |
| `data[].eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].lastDeliveryAt` | integer \| null | yes |  |
| `data[].previousSecretExpiresAt` | integer \| null | yes |  |
| `data[].secretHint` | string | yes | exactly 4 characters |
| `data[].status` | "ACTIVE" \| "DISABLED" | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data[].url` | string | yes | length 1–2048 |
| `data[].version` | integer | yes |  |
| `meta.hasNext` | boolean | yes | Whether a next page exists |
| `meta.hasPrevious` | boolean | yes | Whether a previous page exists |
| `meta.limit` | integer | yes | Items per page; range 1–100 |
| `meta.nextCursor` | string \| null | yes | Opaque cursor for the next page, or null when there are no more rows |
| `meta.page` | integer | yes | Current page (1-indexed); min 1 |
| `meta.total` | integer | yes | Total rows matching the current filters |
| `meta.totalIsCapped` | boolean | no | True when `total` is a lower bound: counting stopped at the list's cap, so there are at least this many rows (page through with `nextCursor`). Absent or false: `total` is exact. |
| `meta.totalPages` | integer | yes | Total pages for the current filters and page size; min 1 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/webhooks/endpoints

Register a webhook endpoint (its signing secret is answered once)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_createEndpoint` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string | no | at most 200 characters; default `""` |
| `eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | yes | 1–9 items |
| `url` | string (uri) | yes | at most 2048 characters |

**Response 201 Created** (`application/json`) — Endpoint registered, with its secret

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.endpoint` | object | yes |  |
| `data.endpoint.consecutiveFailures` | integer | yes |  |
| `data.endpoint.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.endpoint.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.endpoint.description` | string | yes | at most 200 characters |
| `data.endpoint.disabledAt` | integer \| null | yes |  |
| `data.endpoint.disabledReason` | "MANUAL" \| "FAILING" \| null | yes |  |
| `data.endpoint.eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | yes |  |
| `data.endpoint.id` | string (uuid) | yes |  |
| `data.endpoint.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.endpoint.lastDeliveryAt` | integer \| null | yes |  |
| `data.endpoint.previousSecretExpiresAt` | integer \| null | yes |  |
| `data.endpoint.secretHint` | string | yes | exactly 4 characters |
| `data.endpoint.status` | "ACTIVE" \| "DISABLED" | yes |  |
| `data.endpoint.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.endpoint.url` | string | yes | length 1–2048 |
| `data.endpoint.version` | integer | yes |  |
| `data.secret` | string | yes | pattern `^whsec_` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/webhooks/endpoints/{endpointId}

Get one webhook endpoint

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_getEndpoint` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `endpointId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The endpoint

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.consecutiveFailures` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes | at most 200 characters |
| `data.disabledAt` | integer \| null | yes |  |
| `data.disabledReason` | "MANUAL" \| "FAILING" \| null | yes |  |
| `data.eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.lastDeliveryAt` | integer \| null | yes |  |
| `data.previousSecretExpiresAt` | integer \| null | yes |  |
| `data.secretHint` | string | yes | exactly 4 characters |
| `data.status` | "ACTIVE" \| "DISABLED" | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.url` | string | yes | length 1–2048 |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PATCH /api/v1/tenants/{tenantSlug}/webhooks/endpoints/{endpointId}

Change a webhook endpoint's address, description or event types

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_updateEndpoint` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `endpointId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string | no | at most 200 characters |
| `eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | no | 1–9 items |
| `url` | string (uri) | no | at most 2048 characters |

**Response 200 OK** (`application/json`) — The changed endpoint

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.consecutiveFailures` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes | at most 200 characters |
| `data.disabledAt` | integer \| null | yes |  |
| `data.disabledReason` | "MANUAL" \| "FAILING" \| null | yes |  |
| `data.eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.lastDeliveryAt` | integer \| null | yes |  |
| `data.previousSecretExpiresAt` | integer \| null | yes |  |
| `data.secretHint` | string | yes | exactly 4 characters |
| `data.status` | "ACTIVE" \| "DISABLED" | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.url` | string | yes | length 1–2048 |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/tenants/{tenantSlug}/webhooks/endpoints/{endpointId}

Remove a webhook endpoint (its deliveries stay in the log)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_deleteEndpoint` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `endpointId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Endpoint removed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.success` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/webhooks/endpoints/{endpointId}/disable

Switch a webhook endpoint off (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_disableEndpoint` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `endpointId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 200 OK** (`application/json`) — The endpoint, switched off

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.consecutiveFailures` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes | at most 200 characters |
| `data.disabledAt` | integer \| null | yes |  |
| `data.disabledReason` | "MANUAL" \| "FAILING" \| null | yes |  |
| `data.eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.lastDeliveryAt` | integer \| null | yes |  |
| `data.previousSecretExpiresAt` | integer \| null | yes |  |
| `data.secretHint` | string | yes | exactly 4 characters |
| `data.status` | "ACTIVE" \| "DISABLED" | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.url` | string | yes | length 1–2048 |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/webhooks/endpoints/{endpointId}/enable

Switch a webhook endpoint on (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_enableEndpoint` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `endpointId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 200 OK** (`application/json`) — The endpoint, switched on

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.consecutiveFailures` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes | at most 200 characters |
| `data.disabledAt` | integer \| null | yes |  |
| `data.disabledReason` | "MANUAL" \| "FAILING" \| null | yes |  |
| `data.eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.lastDeliveryAt` | integer \| null | yes |  |
| `data.previousSecretExpiresAt` | integer \| null | yes |  |
| `data.secretHint` | string | yes | exactly 4 characters |
| `data.status` | "ACTIVE" \| "DISABLED" | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.url` | string | yes | length 1–2048 |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/webhooks/endpoints/{endpointId}/rotate-secret

Replace a webhook endpoint's signing secret (the new one is answered once)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_rotateSecret` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `endpointId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `keepPreviousForHours` | integer | no | range 0–72; default `24` |

**Response 200 OK** (`application/json`) — The endpoint, with its new secret

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.endpoint` | object | yes |  |
| `data.endpoint.consecutiveFailures` | integer | yes |  |
| `data.endpoint.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.endpoint.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.endpoint.description` | string | yes | at most 200 characters |
| `data.endpoint.disabledAt` | integer \| null | yes |  |
| `data.endpoint.disabledReason` | "MANUAL" \| "FAILING" \| null | yes |  |
| `data.endpoint.eventTypes` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded"[] | yes |  |
| `data.endpoint.id` | string (uuid) | yes |  |
| `data.endpoint.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.endpoint.lastDeliveryAt` | integer \| null | yes |  |
| `data.endpoint.previousSecretExpiresAt` | integer \| null | yes |  |
| `data.endpoint.secretHint` | string | yes | exactly 4 characters |
| `data.endpoint.status` | "ACTIVE" \| "DISABLED" | yes |  |
| `data.endpoint.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.endpoint.url` | string | yes | length 1–2048 |
| `data.endpoint.version` | integer | yes |  |
| `data.secret` | string | yes | pattern `^whsec_` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/webhooks/endpoints/{endpointId}/test

Send a webhook endpoint a test event (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantWebhooksController_sendTest` · [source](../../../apps/api/src/contexts/webhooks/outbound/presentation/http/tenant-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `endpointId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 202 Accepted** (`application/json`) — The queued test delivery

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.attempts` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.deliveredAt` | integer \| null | yes |  |
| `data.endpointId` | string (uuid) | yes |  |
| `data.endpointUrl` | string | yes | length 1–2048 |
| `data.eventId` | string (uuid) | yes |  |
| `data.eventType` | "reward.published" \| "reward.rejected" \| "claim.created" \| "claim.redeemed" \| "claim.expired" \| "sale.completed" \| "payment.succeeded" \| "payment.failed" \| "payment.refunded" \| "webhook.test" | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.lastAttemptAt` | integer \| null | yes |  |
| `data.lastDurationMs` | integer \| null | yes |  |
| `data.lastError` | string \| null | yes | at most 500 characters |
| `data.lastStatusCode` | integer \| null | yes | min -9007199254740991 |
| `data.nextAttemptAt` | integer \| null | yes |  |
| `data.status` | "PENDING" \| "FAILED" \| "SUCCEEDED" \| "DEAD" \| "CANCELLED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

## Received webhooks

### GET /api/v1/admin/webhooks/received

List received webhooks (newest first)

Filter by provider, outcome or verification; search the delivery id, event or correlation id.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:AUDIT_LOG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ReceivedWebhooksController_list` · [source](../../../apps/api/src/contexts/webhooks/inbound/presentation/http/received-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: receivedAt. Default: -receivedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: provider, outcome, verification, receivedAt |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — Paginated received webhooks; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].attempts` | integer | yes |  |
| `data[].completedAt` | integer \| null | yes |  |
| `data[].correlationId` | string \| null | yes | at least 1 characters |
| `data[].duplicateCount` | integer | yes |  |
| `data[].eventType` | string \| null | yes | length 1–100 |
| `data[].httpStatus` | integer \| null | yes | min -9007199254740991 |
| `data[].id` | string (uuid) | yes |  |
| `data[].lastReceivedAt` | integer | yes |  |
| `data[].outcome` | "PROCESSING" \| "RECORDED" \| "DUPLICATE" \| "IGNORED" \| "REJECTED" \| "FAILED" | yes |  |
| `data[].provider` | "GITHUB" \| "RESEND" \| "BILLPLZ" \| "CHIP" \| "FAKE_PAYMENTS" \| "TWILIO" | yes |  |
| `data[].providerDeliveryId` | string \| null | yes | length 1–255 |
| `data[].receivedAt` | integer | yes |  |
| `data[].verification` | "VALID" \| "INVALID" \| "MISSING" \| "NOT_CONFIGURED" | yes |  |
| `meta.hasNext` | boolean | yes | Whether a next page exists |
| `meta.hasPrevious` | boolean | yes | Whether a previous page exists |
| `meta.limit` | integer | yes | Items per page; range 1–100 |
| `meta.nextCursor` | string \| null | yes | Opaque cursor for the next page, or null when there are no more rows |
| `meta.page` | integer | yes | Current page (1-indexed); min 1 |
| `meta.total` | integer | yes | Total rows matching the current filters |
| `meta.totalIsCapped` | boolean | no | True when `total` is a lower bound: counting stopped at the list's cap, so there are at least this many rows (page through with `nextCursor`). Absent or false: `total` is exact. |
| `meta.totalPages` | integer | yes | Total pages for the current filters and page size; min 1 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/webhooks/received/{id}

Get one received webhook

Includes the payload's SHA-256 and size, the kept headers and why it was refused or failed.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:AUDIT_LOG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ReceivedWebhooksController_get` · [source](../../../apps/api/src/contexts/webhooks/inbound/presentation/http/received-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The complete received webhook

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.attempts` | integer | yes |  |
| `data.claimedAt` | integer \| null | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.correlationId` | string \| null | yes | at least 1 characters |
| `data.duplicateCount` | integer | yes |  |
| `data.errorSummary` | string \| null | yes | length 1–500 |
| `data.eventType` | string \| null | yes | length 1–100 |
| `data.headers` | object | yes |  |
| `data.httpStatus` | integer \| null | yes | min -9007199254740991 |
| `data.id` | string (uuid) | yes |  |
| `data.lastReceivedAt` | integer | yes |  |
| `data.outcome` | "PROCESSING" \| "RECORDED" \| "DUPLICATE" \| "IGNORED" \| "REJECTED" \| "FAILED" | yes |  |
| `data.payloadBytes` | integer | yes |  |
| `data.payloadSha256` | string | yes | exactly 64 characters |
| `data.provider` | "GITHUB" \| "RESEND" \| "BILLPLZ" \| "CHIP" \| "FAKE_PAYMENTS" \| "TWILIO" | yes |  |
| `data.providerDeliveryId` | string \| null | yes | length 1–255 |
| `data.receivedAt` | integer | yes |  |
| `data.verification` | "VALID" \| "INVALID" \| "MISSING" \| "NOT_CONFIGURED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
