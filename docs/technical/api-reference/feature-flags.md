---
title: "API reference — Feature flags"
description: "Runtime feature flags: every declared flag with its setting (default, on, off, a share of people) and who changed it, the bare settings the apps evaluate, and a store flag's per-merchant and per-branch settings (a branch's own decides over its merchant's)."
order: 18
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Feature flags

Runtime feature flags: every declared flag with its setting (default, on, off, a share of people) and who changed it, the bare settings the apps evaluate, and a store flag's per-merchant and per-branch settings (a branch's own decides over its merchant's).

How these endpoints fit together: [Feature flags guide](../feature-flags.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Feature flags

### GET /api/v1/admin/feature-flags

Every feature flag: what it is, where its default comes from, its setting and who last changed it

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_list` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Response 200 OK** (`application/json`) — The flags

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.flags` | object[] | yes |  |
| `data.flags[].defaultFrom` | string | yes |  |
| `data.flags[].description` | string | yes |  |
| `data.flags[].key` | "component-gallery" \| "merchant-invites" \| "till-redemption" | yes |  |
| `data.flags[].mode` | "DEFAULT" \| "ON" \| "OFF" \| "PERCENTAGE" | yes |  |
| `data.flags[].percentage` | integer \| null | yes | range 1–99 |
| `data.flags[].reason` | string \| null | yes |  |
| `data.flags[].scope` | "platform" \| "store" | yes |  |
| `data.flags[].title` | string | yes |  |
| `data.flags[].updatedAt` | integer \| null | yes |  |
| `data.flags[].updatedByName` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/feature-flags/{key}

Set a flag: its default, on, off, or on for a percentage of people (with a reason)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_update` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "component-gallery" \| "merchant-invites" \| "till-redemption" | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `mode` | "DEFAULT" \| "ON" \| "OFF" \| "PERCENTAGE" | yes |  |
| `percentage` | integer \| null | yes | range 1–99 |
| `reason` | string | yes | length 10–500 |

**Response 200 OK** (`application/json`) — The flag

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.defaultFrom` | string | yes |  |
| `data.description` | string | yes |  |
| `data.key` | "component-gallery" \| "merchant-invites" \| "till-redemption" | yes |  |
| `data.mode` | "DEFAULT" \| "ON" \| "OFF" \| "PERCENTAGE" | yes |  |
| `data.percentage` | integer \| null | yes | range 1–99 |
| `data.reason` | string \| null | yes |  |
| `data.scope` | "platform" \| "store" | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer \| null | yes |  |
| `data.updatedByName` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/feature-flags/{key}/overrides

A store flag's per-store settings: each merchant's and branch's own value, why, and who set it

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_overrides` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "till-redemption" | yes |  |

**Response 200 OK** (`application/json`) — The per-store settings

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.overrides` | object[] | yes |  |
| `data.overrides[].enabled` | boolean | yes |  |
| `data.overrides[].id` | string (uuid) | yes |  |
| `data.overrides[].key` | "till-redemption" | yes |  |
| `data.overrides[].locationId` | string (uuid) \| null | yes |  |
| `data.overrides[].locationName` | string \| null | yes |  |
| `data.overrides[].reason` | string | yes |  |
| `data.overrides[].tenantId` | string (uuid) | yes |  |
| `data.overrides[].tenantName` | string | yes |  |
| `data.overrides[].updatedAt` | integer | yes |  |
| `data.overrides[].updatedByName` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/feature-flags/{key}/overrides

Set a merchant's or one branch's own value of a store flag (replacing its earlier one), with a reason

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_setOverride` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "till-redemption" | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `enabled` | boolean | yes |  |
| `locationId` | string (uuid) \| null | yes |  |
| `reason` | string | yes | length 10–500 |
| `tenantId` | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The store's setting

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.enabled` | boolean | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.key` | "till-redemption" | yes |  |
| `data.locationId` | string (uuid) \| null | yes |  |
| `data.locationName` | string \| null | yes |  |
| `data.reason` | string | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.tenantName` | string | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.updatedByName` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/feature-flags/{key}/overrides/{overrideId}/remove

Remove a store's own value of a flag (it follows the deployment again), with a reason

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_removeOverride` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "till-redemption" | yes |  |
| `overrideId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 10–500 |

**Response 200 OK** (`application/json`) — Removed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/feature-flags/settings

Every flag's setting, for the console to evaluate (any admin staff member)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_settings` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Response 200 OK** (`application/json`) — The settings

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.settings` | object[] | yes |  |
| `data.settings[].key` | "component-gallery" \| "merchant-invites" \| "till-redemption" | yes |  |
| `data.settings[].mode` | "DEFAULT" \| "ON" \| "OFF" \| "PERCENTAGE" | yes |  |
| `data.settings[].percentage` | integer \| null | yes | range 1–99 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/feature-flags/stores

The stores a store flag can be set for: merchants by name, with their live branches (names only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_stores` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `search` | query | string | no |  |

**Response 200 OK** (`application/json`) — Up to 20 merchants

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.stores` | object[] | yes |  |
| `data.stores[].branches` | object[] | yes |  |
| `data.stores[].branches[].locationId` | string (uuid) | yes |  |
| `data.stores[].branches[].name` | string | yes |  |
| `data.stores[].tenantId` | string (uuid) | yes |  |
| `data.stores[].tenantName` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
