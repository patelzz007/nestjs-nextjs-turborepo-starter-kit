---
title: "API reference — Payments (Billplz, CHIP)"
description: "A tenant asks for a payment through a configured gateway (an `Idempotency-Key` header makes a retry return the same payment), follows it and refunds it; the gateways' signed callbacks mark it paid. Amounts are in sen."
order: 8
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Payments (Billplz, CHIP)

A tenant asks for a payment through a configured gateway (an `Idempotency-Key` header makes a retry return the same payment), follows it and refunds it; the gateways' signed callbacks mark it paid. Amounts are in sen.

How these endpoints fit together: [ADR 020: payments](../../adr/020-payments-provider-port.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Payments

### POST /api/v1/payments/callbacks/billplz

Billplz's bill callback (form-encoded, x_signature verified)

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PaymentCallbacksController_billplz` · [source](../../../apps/api/src/contexts/payments/presentation/http/payment-callbacks.controller.ts)

**Response 200 OK** (`application/json`) — Received

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.received` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/payments/callbacks/chip

CHIP's purchase callback (JSON, X-Signature verified with the company public key)

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PaymentCallbacksController_chip` · [source](../../../apps/api/src/contexts/payments/presentation/http/payment-callbacks.controller.ts)

**Response 200 OK** (`application/json`) — Received

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.received` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/payments/callbacks/fake

The fake gateway's callback (development and tests only; refused where it isn't configured)

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PaymentCallbacksController_fake` · [source](../../../apps/api/src/contexts/payments/presentation/http/payment-callbacks.controller.ts)

**Response 200 OK** (`application/json`) — Received

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.received` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/payments

The tenant's payments, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantPaymentsController_list` · [source](../../../apps/api/src/contexts/payments/presentation/http/tenant-payments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, provider |

**Response 200 OK** (`application/json`) — One page of payments

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].amountMinor` | integer | yes | min -9007199254740991 |
| `data[].checkoutUrl` | string \| null | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].currency` | "MYR" | yes |  |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].description` | string | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].paidAt` | integer \| null | yes |  |
| `data[].payerEmail` | string | yes |  |
| `data[].payerName` | string | yes |  |
| `data[].provider` | "BILLPLZ" \| "CHIP" \| "FAKE" | yes |  |
| `data[].providerPaymentId` | string \| null | yes |  |
| `data[].refundable` | boolean | yes |  |
| `data[].status` | "PENDING" \| "PAID" \| "FAILED" \| "CANCELLED" \| "REFUNDED" | yes |  |
| `data[].tenantId` | string (uuid) | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
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

### POST /api/v1/tenants/{tenantSlug}/payments

Ask for a payment: opens a checkout at the gateway (the same Idempotency-Key returns the same payment, never a second one)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantPaymentsController_create` · [source](../../../apps/api/src/contexts/payments/presentation/http/tenant-payments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `Idempotency-Key` | header | string | yes | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `amountMinor` | integer | yes | range 100–10000000 |
| `currency` | "MYR" | no | default `"MYR"` |
| `description` | string | yes | length 1–200 |
| `payerEmail` | string (email) | yes |  |
| `payerName` | string | yes | length 1–255 |
| `provider` | "BILLPLZ" \| "CHIP" \| "FAKE" | yes |  |
| `returnUrl` | string (uri) | yes |  |

**Response 201 Created** (`application/json`) — The payment, with the checkout to send the payer to

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.amountMinor` | integer | yes | min -9007199254740991 |
| `data.checkoutUrl` | string \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.currency` | "MYR" | yes |  |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.paidAt` | integer \| null | yes |  |
| `data.payerEmail` | string | yes |  |
| `data.payerName` | string | yes |  |
| `data.provider` | "BILLPLZ" \| "CHIP" \| "FAKE" | yes |  |
| `data.providerPaymentId` | string \| null | yes |  |
| `data.refundable` | boolean | yes |  |
| `data.status` | "PENDING" \| "PAID" \| "FAILED" \| "CANCELLED" \| "REFUNDED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/payments/{paymentId}

One payment

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantPaymentsController_get` · [source](../../../apps/api/src/contexts/payments/presentation/http/tenant-payments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `paymentId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The payment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.amountMinor` | integer | yes | min -9007199254740991 |
| `data.checkoutUrl` | string \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.currency` | "MYR" | yes |  |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.paidAt` | integer \| null | yes |  |
| `data.payerEmail` | string | yes |  |
| `data.payerName` | string | yes |  |
| `data.provider` | "BILLPLZ" \| "CHIP" \| "FAKE" | yes |  |
| `data.providerPaymentId` | string \| null | yes |  |
| `data.refundable` | boolean | yes |  |
| `data.status` | "PENDING" \| "PAID" \| "FAILED" \| "CANCELLED" \| "REFUNDED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/payments/{paymentId}/refund

Refund a paid payment in full through its gateway (CHIP; Billplz refunds in its own dashboard)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantPaymentsController_refund` · [source](../../../apps/api/src/contexts/payments/presentation/http/tenant-payments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `paymentId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Refunded, or pending at the gateway

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.outcome` | "refunded" \| "pending" | yes |  |
| `data.payment` | object | yes |  |
| `data.payment.amountMinor` | integer | yes | min -9007199254740991 |
| `data.payment.checkoutUrl` | string \| null | yes |  |
| `data.payment.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.payment.currency` | "MYR" | yes |  |
| `data.payment.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.payment.description` | string | yes |  |
| `data.payment.id` | string (uuid) | yes |  |
| `data.payment.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.payment.paidAt` | integer \| null | yes |  |
| `data.payment.payerEmail` | string | yes |  |
| `data.payment.payerName` | string | yes |  |
| `data.payment.provider` | "BILLPLZ" \| "CHIP" \| "FAKE" | yes |  |
| `data.payment.providerPaymentId` | string \| null | yes |  |
| `data.payment.refundable` | boolean | yes |  |
| `data.payment.status` | "PENDING" \| "PAID" \| "FAILED" \| "CANCELLED" \| "REFUNDED" | yes |  |
| `data.payment.tenantId` | string (uuid) | yes |  |
| `data.payment.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/payments/providers

The gateways this deployment can take payments through, and whether each refunds through its API

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantPaymentsController_providers` · [source](../../../apps/api/src/contexts/payments/presentation/http/tenant-payments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The configured gateways

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.providers` | object[] | yes |  |
| `data.providers[].name` | "BILLPLZ" \| "CHIP" \| "FAKE" | yes |  |
| `data.providers[].refunds` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
