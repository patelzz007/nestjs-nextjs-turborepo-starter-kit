---
title: "API reference — Customer tiers"
description: "Bronze, Silver, Gold and Diamond, earned by redemptions: whether tiers are on and the caller's tier, a customer's own progress and history, and the admin's tier rules (changed with a reason), a customer's standing and the tier distribution."
order: 7
author: "Generated from the OpenAPI export"
category: "API reference"
date: 1791072000000
lastUpdated: 1793145600000
editedAt: 1793145600000
coverImage: "/images/covers/technical/api-reference/customer-tiers.webp"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Customer tiers

Bronze, Silver, Gold and Diamond, earned by redemptions: whether tiers are on and the caller's tier, a customer's own progress and history, and the admin's tier rules (changed with a reason), a customer's standing and the tier distribution.

How these endpoints fit together: [ADR 085: customer tiers](../../adr/085-customer-tiers.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Tiers

### GET /api/v1/admin/tiers/distribution

How many customers stand at each tier (everyone who has claimed at a store; without a higher standing, Bronze)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:ANALYTICS`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AdminTiersController_distribution` · [source](../../../apps/api/src/contexts/tiers/presentation/http/admin-tiers.controller.ts)

**Response 200 OK** (`application/json`) — Customers per tier

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.counts` | object | yes |  |
| `data.total` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/tiers/settings

The tier rules in force: thresholds, tier window, per-merchant cap, tier hold and warning days, and who last changed them

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:SYSTEM_SETTINGS`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AdminTiersController_read` · [source](../../../apps/api/src/contexts/tiers/presentation/http/admin-tiers.controller.ts)

**Response 200 OK** (`application/json`) — The tier rules

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.diamondThreshold` | integer | yes | range 1–10000 |
| `data.goldThreshold` | integer | yes | range 1–10000 |
| `data.holdDays` | integer | yes | range 0–365 |
| `data.perMerchantCap` | integer | yes | range 1–10000 |
| `data.reason` | string \| null | yes |  |
| `data.silverThreshold` | integer | yes | range 1–10000 |
| `data.updatedAt` | integer \| null | yes |  |
| `data.updatedByName` | string \| null | yes |  |
| `data.warningDays` | integer | yes | range 1–90 |
| `data.windowDays` | integer | yes | range 30–1095 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/tiers/settings

Change the tier rules, with a reason; the next nightly review applies them (a warning always comes first)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:SYSTEM_SETTINGS`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AdminTiersController_update` · [source](../../../apps/api/src/contexts/tiers/presentation/http/admin-tiers.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `diamondThreshold` | integer | yes | range 1–10000 |
| `goldThreshold` | integer | yes | range 1–10000 |
| `holdDays` | integer | yes | range 0–365 |
| `perMerchantCap` | integer | yes | range 1–10000 |
| `reason` | string | yes | length 10–500 |
| `silverThreshold` | integer | yes | range 1–10000 |
| `warningDays` | integer | yes | range 1–90 |
| `windowDays` | integer | yes | range 30–1095 |

**Response 200 OK** (`application/json`) — The new tier rules

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.diamondThreshold` | integer | yes | range 1–10000 |
| `data.goldThreshold` | integer | yes | range 1–10000 |
| `data.holdDays` | integer | yes | range 0–365 |
| `data.perMerchantCap` | integer | yes | range 1–10000 |
| `data.reason` | string \| null | yes |  |
| `data.silverThreshold` | integer | yes | range 1–10000 |
| `data.updatedAt` | integer \| null | yes |  |
| `data.updatedByName` | string \| null | yes |  |
| `data.warningDays` | integer | yes | range 1–90 |
| `data.windowDays` | integer | yes | range 30–1095 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/users/{userId}/tier

A customer's tier, tier hold, pending demotion warning and tier history

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Policy** `READ:USER` — Staff read a customer's tier and tier history.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AdminUserTierController_tier` · [source](../../../apps/api/src/contexts/tiers/presentation/http/admin-tiers.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The customer's tier

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countedRedemptions` | integer | yes |  |
| `data.demotionWarning` | object \| null | yes |  |
| `data.demotionWarning.dueAt` | integer | yes |  |
| `data.demotionWarning.redemptionsToKeep` | integer | yes |  |
| `data.demotionWarning.toTier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |
| `data.evaluatedAt` | integer \| null | yes |  |
| `data.history` | object[] | yes |  |
| `data.history[].countedRedemptions` | integer | yes |  |
| `data.history[].fromTier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |
| `data.history[].id` | string (uuid) | yes |  |
| `data.history[].occurredAt` | integer | yes |  |
| `data.history[].reason` | "PROMOTION" \| "DEMOTION" | yes |  |
| `data.history[].toTier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |
| `data.holdUntil` | integer \| null | yes |  |
| `data.tier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tiers/availability

Whether customer tiers are on (the customer-tiers flag) and, while they are, the caller's tier — Bronze when signed out

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TiersController_availability` · [source](../../../apps/api/src/contexts/tiers/presentation/http/tiers.controller.ts)

**Response 200 OK** (`application/json`) — Whether tiers are on, and the caller's tier

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ enabled` | false | yes |  |
| `data.⟨shape 2⟩ enabled` | true | yes |  |
| `data.⟨shape 2⟩ viewerTier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tiers/me

The signed-in customer's tier: progress to the next, the counted redemptions per merchant, the tier hold, a pending demotion warning, what leaves the window soon, and the tier history

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TiersController_me` · [source](../../../apps/api/src/contexts/tiers/presentation/http/tiers.controller.ts)

**Response 200 OK** (`application/json`) — The customer's tier page

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countedRedemptions` | integer | yes |  |
| `data.demotionWarning` | object \| null | yes |  |
| `data.demotionWarning.dueAt` | integer | yes |  |
| `data.demotionWarning.redemptionsToKeep` | integer | yes |  |
| `data.demotionWarning.toTier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |
| `data.history` | object[] | yes |  |
| `data.history[].countedRedemptions` | integer | yes |  |
| `data.history[].fromTier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |
| `data.history[].id` | string (uuid) | yes |  |
| `data.history[].occurredAt` | integer | yes |  |
| `data.history[].reason` | "PROMOTION" \| "DEMOTION" | yes |  |
| `data.history[].toTier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |
| `data.holdUntil` | integer \| null | yes |  |
| `data.merchants` | object[] | yes |  |
| `data.merchants[].counted` | integer | yes |  |
| `data.merchants[].remainingUnderCap` | integer | yes |  |
| `data.merchants[].tenantId` | string (uuid) | yes |  |
| `data.merchants[].tenantName` | string | yes |  |
| `data.nextTier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" \| null | yes |  |
| `data.redemptionsToNextTier` | integer \| null | yes |  |
| `data.rules` | object | yes |  |
| `data.rules.diamondThreshold` | integer | yes | range 1–10000 |
| `data.rules.goldThreshold` | integer | yes | range 1–10000 |
| `data.rules.holdDays` | integer | yes | range 0–365 |
| `data.rules.perMerchantCap` | integer | yes | range 1–10000 |
| `data.rules.silverThreshold` | integer | yes | range 1–10000 |
| `data.rules.warningDays` | integer | yes | range 1–90 |
| `data.rules.windowDays` | integer | yes | range 30–1095 |
| `data.tier` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND" | yes |  |
| `data.upcomingDropOffs` | object[] | yes |  |
| `data.upcomingDropOffs[].count` | integer | yes |  |
| `data.upcomingDropOffs[].on` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
