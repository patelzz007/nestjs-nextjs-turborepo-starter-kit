---
title: "API reference — Feature flags"
description: "Feature flags v2 (ADR 087): each app's bundle of answers, its live version stream and exposures; and the admin's Releases: flags (rules as revisions, kill switch, overrides, approvals, check a subject), dynamic configs, flag groups, experiments and rule promotion."
order: 20
author: "Generated from the OpenAPI export"
category: "API reference"
date: 1791072000000
lastUpdated: 1793145600000
editedAt: 1793145600000
coverImage: "/images/covers/technical/api-reference/feature-flags.webp"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Feature flags

Feature flags v2 (ADR 087): each app's bundle of answers, its live version stream and exposures; and the admin's Releases: flags (rules as revisions, kill switch, overrides, approvals, check a subject), dynamic configs, flag groups, experiments and rule promotion.

How these endpoints fit together: [Feature flags guide](../feature-flags.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Feature flags

### GET /api/v1/admin/feature-flags

Every declared feature flag: its kill switch, live and pending revision, overrides, exposures and whether it's ready to remove

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_list` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Response 200 OK** (`application/json`) — The flags

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.flags` | object[] | yes |  |
| `data.flags[].apps` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes |  |
| `data.flags[].defaultOn` | boolean | yes |  |
| `data.flags[].description` | string | yes |  |
| `data.flags[].exposures24h` | integer | yes |  |
| `data.flags[].key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `data.flags[].killSwitch` | object | yes |  |
| `data.flags[].killSwitch.changedAt` | integer \| null | yes |  |
| `data.flags[].killSwitch.changedByName` | string \| null | yes |  |
| `data.flags[].killSwitch.on` | boolean | yes |  |
| `data.flags[].killSwitch.reason` | string \| null | yes |  |
| `data.flags[].liveRevision` | integer \| null | yes |  |
| `data.flags[].overrideCount` | integer | yes |  |
| `data.flags[].pendingRevision` | integer \| null | yes |  |
| `data.flags[].readyToRemove` | "ALWAYS_ON" \| "ALWAYS_OFF" \| "KILLED" \| "NEVER_CHECKED" \| null | yes |  |
| `data.flags[].rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.flags[].ruleCount` | integer | yes |  |
| `data.flags[].title` | string | yes |  |
| `data.flags[].updatedAt` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/feature-flags/{key}

One flag: its live and pending rules, overrides, kill switch and exposures over the last day and week

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_detail` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |

**Response 200 OK** (`application/json`) — The flag

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.apps` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes |  |
| `data.defaultOn` | boolean | yes |  |
| `data.description` | string | yes |  |
| `data.exposures` | object | yes |  |
| `data.exposures.last24h` | object[] | yes |  |
| `data.exposures.last24h[].exposures` | integer | yes |  |
| `data.exposures.last24h[].ruleId` | string (uuid) \| null | yes |  |
| `data.exposures.last24h[].source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `data.exposures.last24h[].subjects` | integer | yes |  |
| `data.exposures.last24h[].value` | string | yes |  |
| `data.exposures.last7d` | object[] | yes |  |
| `data.exposures.last7d[].exposures` | integer | yes |  |
| `data.exposures.last7d[].ruleId` | string (uuid) \| null | yes |  |
| `data.exposures.last7d[].source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `data.exposures.last7d[].subjects` | integer | yes |  |
| `data.exposures.last7d[].value` | string | yes |  |
| `data.exposures.lastExposureAt` | integer \| null | yes |  |
| `data.exposures24h` | integer | yes |  |
| `data.key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `data.killSwitch` | object | yes |  |
| `data.killSwitch.changedAt` | integer \| null | yes |  |
| `data.killSwitch.changedByName` | string \| null | yes |  |
| `data.killSwitch.on` | boolean | yes |  |
| `data.killSwitch.reason` | string \| null | yes |  |
| `data.live` | object \| null | yes |  |
| `data.live.authorName` | string \| null | yes |  |
| `data.live.authorUserId` | string (uuid) \| null | yes |  |
| `data.live.content` | object | yes |  |
| `data.live.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.live.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.live.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.live.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.live.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.live.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.live.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.live.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.live.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.live.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.live.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.live.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.live.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.live.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.live.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.live.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.live.createdAt` | integer | yes |  |
| `data.live.decidedAt` | integer \| null | yes |  |
| `data.live.decidedByName` | string \| null | yes |  |
| `data.live.decisionReason` | string \| null | yes |  |
| `data.live.expiresAt` | integer \| null | yes |  |
| `data.live.id` | string (uuid) | yes |  |
| `data.live.number` | integer | yes |  |
| `data.live.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.live.reason` | string | yes |  |
| `data.live.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.live.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |
| `data.liveRevision` | integer \| null | yes |  |
| `data.overrideCount` | integer | yes |  |
| `data.overrides` | object[] | yes |  |
| `data.overrides[].id` | string (uuid) | yes |  |
| `data.overrides[].key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `data.overrides[].on` | boolean | yes |  |
| `data.overrides[].reason` | string | yes |  |
| `data.overrides[].subjectId` | string (uuid) | yes |  |
| `data.overrides[].subjectName` | string \| null | yes |  |
| `data.overrides[].tenantName` | string \| null | yes |  |
| `data.overrides[].unit` | "USER" \| "LOCATION" \| "TENANT" | yes |  |
| `data.overrides[].updatedAt` | integer | yes |  |
| `data.overrides[].updatedByName` | string \| null | yes |  |
| `data.pending` | object \| null | yes |  |
| `data.pending.authorName` | string \| null | yes |  |
| `data.pending.authorUserId` | string (uuid) \| null | yes |  |
| `data.pending.content` | object | yes |  |
| `data.pending.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.pending.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.pending.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.pending.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.pending.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.pending.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.pending.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.pending.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.pending.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.pending.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.pending.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.pending.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.pending.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.pending.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.pending.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.pending.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.pending.createdAt` | integer | yes |  |
| `data.pending.decidedAt` | integer \| null | yes |  |
| `data.pending.decidedByName` | string \| null | yes |  |
| `data.pending.decisionReason` | string \| null | yes |  |
| `data.pending.expiresAt` | integer \| null | yes |  |
| `data.pending.id` | string (uuid) | yes |  |
| `data.pending.number` | integer | yes |  |
| `data.pending.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.pending.reason` | string | yes |  |
| `data.pending.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.pending.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |
| `data.pendingRevision` | integer \| null | yes |  |
| `data.readyToRemove` | "ALWAYS_ON" \| "ALWAYS_OFF" \| "KILLED" \| "NEVER_CHECKED" \| null | yes |  |
| `data.rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.ruleCount` | integer | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/feature-flags/{key}/check

Check a subject: the value one user, store or device would get, and every step that decided it

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_check` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `subject` | object | yes |  |
| `subject.app` | "admin" \| "merchant" \| "web" \| "mobile" \| "api" | yes |  |
| `subject.appVersion` | string \| null | yes | Semantic version of the installed mobile app; at most 64 characters |
| `subject.deviceId` | string (uuid) \| null | yes |  |
| `subject.locale` | "en" \| "ms" \| "zh-Hans" \| "ta" \| null | yes | A shipped language: en, ms, zh-Hans or ta |
| `subject.locationId` | string (uuid) \| null | yes |  |
| `subject.platform` | "web" \| "ios" \| "android" \| null | yes |  |
| `subject.tenantId` | string (uuid) \| null | yes |  |
| `subject.userId` | string (uuid) \| null | yes |  |

**Response 200 OK** (`application/json`) — The value and its trace

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.result` | object | yes |  |
| `data.result.key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `data.result.on` | boolean | yes |  |
| `data.result.revision` | integer \| null | yes |  |
| `data.result.ruleId` | string (uuid) \| null | yes |  |
| `data.result.source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `data.trace` | object[] | yes |  |
| `data.trace[].detail` | string \| null | yes |  |
| `data.trace[].failedAttribute` | "USER_ID" \| "EMAIL_DOMAIN" \| "PLATFORM_STAFF" \| "PERMISSION" \| "TENANT_ID" \| "LOCATION_ID" \| "CUSTOMER_TIER" \| "APP" \| "PLATFORM" \| "APP_VERSION" \| … (+4 more) \| null | yes |  |
| `data.trace[].label` | string | yes |  |
| `data.trace[].matched` | boolean | yes |  |
| `data.trace[].step` | "KILL_SWITCH" \| "OVERRIDE" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/feature-flags/{key}/kill-switch

Throw (off for everyone, at once) or release a flag's kill switch, with a reason — never waits for approval

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_setKillSwitch` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `on` | boolean | yes |  |
| `reason` | string | yes | length 10–500 |

**Response 200 OK** (`application/json`) — The kill switch

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.changedAt` | integer \| null | yes |  |
| `data.changedByName` | string \| null | yes |  |
| `data.on` | boolean | yes |  |
| `data.reason` | string \| null | yes |  |

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

Force a flag on or off for one user, location or tenant (replacing its earlier override), with a reason

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
| `key` | path | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `on` | boolean | yes |  |
| `reason` | string | yes | length 10–500 |
| `subjectId` | string (uuid) | yes |  |
| `unit` | "USER" \| "LOCATION" \| "TENANT" | yes |  |

**Response 200 OK** (`application/json`) — The override

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.id` | string (uuid) | yes |  |
| `data.key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `data.on` | boolean | yes |  |
| `data.reason` | string | yes |  |
| `data.subjectId` | string (uuid) | yes |  |
| `data.subjectName` | string \| null | yes |  |
| `data.tenantName` | string \| null | yes |  |
| `data.unit` | "USER" \| "LOCATION" \| "TENANT" | yes |  |
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

Remove an override (the subject follows the rules again), with a reason — a POST, so the reason can't be dropped

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
| `key` | path | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
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

### GET /api/v1/admin/feature-flags/{key}/revisions

Every revision of a flag's rules, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_revisions` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |

**Response 200 OK** (`application/json`) — The revisions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.revisions` | object[] | yes |  |
| `data.revisions[].authorName` | string \| null | yes |  |
| `data.revisions[].authorUserId` | string (uuid) \| null | yes |  |
| `data.revisions[].content` | object | yes |  |
| `data.revisions[].content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.revisions[].content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.revisions[].content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.revisions[].content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.revisions[].content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.revisions[].content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.revisions[].content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.revisions[].content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.revisions[].content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.revisions[].content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.revisions[].content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.revisions[].content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.revisions[].content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.revisions[].content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.revisions[].content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.revisions[].content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.revisions[].createdAt` | integer | yes |  |
| `data.revisions[].decidedAt` | integer \| null | yes |  |
| `data.revisions[].decidedByName` | string \| null | yes |  |
| `data.revisions[].decisionReason` | string \| null | yes |  |
| `data.revisions[].expiresAt` | integer \| null | yes |  |
| `data.revisions[].id` | string (uuid) | yes |  |
| `data.revisions[].number` | integer | yes |  |
| `data.revisions[].promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.revisions[].reason` | string | yes |  |
| `data.revisions[].source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.revisions[].status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/feature-flags/{key}/revisions

Save a flag's rules as a new revision, with a reason

Live at once, except in production, where it waits up to 7 days for someone else's approval. 409 FEATURE_FLAG_REVISION_CONFLICT when the live revision isn't `basedOn` any more; 422 FEATURE_FLAG_RULES_INVALID when a rule names a group that doesn't exist.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_saveRevision` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `basedOn` | integer \| null | yes |  |
| `reason` | string | yes | length 10–500 |
| `rules` | object[] | yes | 0–50 items |
| `rules[].conditions` | object[] | yes | 0–10 items |
| `rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `rules[].conditions[].⟨shape 4⟩ permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `rules[].conditions[].⟨shape 4⟩ permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+43 more) | yes |  |
| `rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `rules[].id` | string (uuid) | yes |  |
| `rules[].name` | string | yes | length 1–80 |
| `rules[].rollout` | object | yes |  |
| `rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `rules[].rollout.⟨shape 2⟩ steps[].at` | integer | yes |  |
| `rules[].rollout.⟨shape 2⟩ steps[].percentage` | integer | yes | range 0–100 |

**Response 201 Created** (`application/json`) — The new revision

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.authorName` | string \| null | yes |  |
| `data.authorUserId` | string (uuid) \| null | yes |  |
| `data.content` | object | yes |  |
| `data.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.decidedAt` | integer \| null | yes |  |
| `data.decidedByName` | string \| null | yes |  |
| `data.decisionReason` | string \| null | yes |  |
| `data.expiresAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.number` | integer | yes |  |
| `data.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.reason` | string | yes |  |
| `data.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `FEATURE_FLAG_REVISION_CONFLICT` | Stated in the endpoint description. |
| 422 | `FEATURE_FLAG_RULES_INVALID` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/feature-flags/{key}/revisions/{number}/decision

Approve (it goes live) or reject someone else's pending revision, with a reason

403 FEATURE_FLAG_SELF_APPROVAL for one's own.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `APPROVE:FEATURE_FLAG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_decide` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `number` | path | integer | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `decision` | "APPROVE" \| "REJECT" | yes |  |
| `reason` | string | yes | length 10–500 |

**Response 200 OK** (`application/json`) — The decided revision

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.authorName` | string \| null | yes |  |
| `data.authorUserId` | string (uuid) \| null | yes |  |
| `data.content` | object | yes |  |
| `data.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.decidedAt` | integer \| null | yes |  |
| `data.decidedByName` | string \| null | yes |  |
| `data.decisionReason` | string \| null | yes |  |
| `data.expiresAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.number` | integer | yes |  |
| `data.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.reason` | string | yes |  |
| `data.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | `FEATURE_FLAG_SELF_APPROVAL` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/feature-flags/environment

This deployment's environment, and whether rule changes here wait for a second person

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_environment` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Response 200 OK** (`application/json`) — The environment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approvalsRequired` | boolean | yes |  |
| `data.environment` | "development" \| "staging" \| "production" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/feature-flags/promotion/export

A flag's or config's live revision as a promotion file, with the condition groups its rules name

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FlagPromotionController_export` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-promotion.controller.ts)

**Response 200 OK** (`application/json`) — The file

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ content` | object | yes |  |
| `data.⟨shape 1⟩ content.kind` | "FLAG" | yes |  |
| `data.⟨shape 1⟩ content.rules` | object[] | yes | 0–50 items |
| `data.⟨shape 1⟩ content.rules[].conditions` | object[] | yes | 0–10 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ content.rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ content.rules[].id` | string (uuid) | yes |  |
| `data.⟨shape 1⟩ content.rules[].name` | string | yes | length 1–80 |
| `data.⟨shape 1⟩ content.rules[].rollout` | object | yes |  |
| `data.⟨shape 1⟩ content.rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.⟨shape 1⟩ content.rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.⟨shape 1⟩ content.rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.⟨shape 1⟩ content.rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.⟨shape 1⟩ environment` | "development" \| "staging" \| "production" | yes |  |
| `data.⟨shape 1⟩ exportedAt` | integer | yes |  |
| `data.⟨shape 1⟩ formatVersion` | 1 | yes |  |
| `data.⟨shape 1⟩ groups` | object[] | yes |  |
| `data.⟨shape 1⟩ groups[].conditions` | object[] | yes | 1–10 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+43 more) | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.⟨shape 1⟩ groups[].description` | string | yes |  |
| `data.⟨shape 1⟩ groups[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ groups[].name` | string | yes |  |
| `data.⟨shape 1⟩ key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `data.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.⟨shape 1⟩ listedGroupKeys` | string[] | yes |  |
| `data.⟨shape 1⟩ revision` | integer | yes |  |
| `data.⟨shape 2⟩ content` | object | yes |  |
| `data.⟨shape 2⟩ content.kind` | "CONFIG" | yes |  |
| `data.⟨shape 2⟩ content.rules` | object[] | yes | 0–50 items |
| `data.⟨shape 2⟩ content.rules[].conditions` | object[] | yes | 0–10 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ content.rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ content.rules[].id` | string (uuid) | yes |  |
| `data.⟨shape 2⟩ content.rules[].name` | string | yes | length 1–80 |
| `data.⟨shape 2⟩ content.rules[].rollout` | object | yes |  |
| `data.⟨shape 2⟩ content.rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.⟨shape 2⟩ content.rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.⟨shape 2⟩ content.rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.⟨shape 2⟩ content.rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.⟨shape 2⟩ content.rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ content.values` | object[] | yes | 1–20 items |
| `data.⟨shape 2⟩ content.values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ content.values[].value` | object | yes |  |
| `data.⟨shape 2⟩ environment` | "development" \| "staging" \| "production" | yes |  |
| `data.⟨shape 2⟩ exportedAt` | integer | yes |  |
| `data.⟨shape 2⟩ formatVersion` | 1 | yes |  |
| `data.⟨shape 2⟩ groups` | object[] | yes |  |
| `data.⟨shape 2⟩ groups[].conditions` | object[] | yes | 1–10 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+43 more) | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.⟨shape 2⟩ groups[].description` | string | yes |  |
| `data.⟨shape 2⟩ groups[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ groups[].name` | string | yes |  |
| `data.⟨shape 2⟩ key` | "reward-claim-cta" | yes |  |
| `data.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.⟨shape 2⟩ listedGroupKeys` | string[] | yes |  |
| `data.⟨shape 2⟩ revision` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/feature-flags/promotion/import

Import a promotion file as a new revision, with a reason (pending in production)

422 PROMOTION_INVALID for a file from this environment, or naming listed groups this environment lacks.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FlagPromotionController_import` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-promotion.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `file` | object | yes |  |
| `file.⟨shape 1⟩ content` | object | yes |  |
| `file.⟨shape 1⟩ content.kind` | "FLAG" | yes |  |
| `file.⟨shape 1⟩ content.rules` | object[] | yes | 0–50 items |
| `file.⟨shape 1⟩ content.rules[].conditions` | object[] | yes | 0–10 items |
| `file.⟨shape 1⟩ content.rules[].id` | string (uuid) | yes |  |
| `file.⟨shape 1⟩ content.rules[].name` | string | yes | length 1–80 |
| `file.⟨shape 1⟩ content.rules[].rollout` | object | yes |  |
| `file.⟨shape 1⟩ environment` | "development" \| "staging" \| "production" | yes |  |
| `file.⟨shape 1⟩ exportedAt` | integer | yes |  |
| `file.⟨shape 1⟩ formatVersion` | 1 | yes |  |
| `file.⟨shape 1⟩ groups` | object[] | yes |  |
| `file.⟨shape 1⟩ groups[].conditions` | object[] | yes | 1–10 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].description` | string | yes |  |
| `file.⟨shape 1⟩ groups[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 1⟩ groups[].name` | string | yes |  |
| `file.⟨shape 1⟩ key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `file.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `file.⟨shape 1⟩ listedGroupKeys` | string[] | yes |  |
| `file.⟨shape 1⟩ revision` | integer | yes |  |
| `file.⟨shape 2⟩ content` | object | yes |  |
| `file.⟨shape 2⟩ content.kind` | "CONFIG" | yes |  |
| `file.⟨shape 2⟩ content.rules` | object[] | yes | 0–50 items |
| `file.⟨shape 2⟩ content.rules[].conditions` | object[] | yes | 0–10 items |
| `file.⟨shape 2⟩ content.rules[].id` | string (uuid) | yes |  |
| `file.⟨shape 2⟩ content.rules[].name` | string | yes | length 1–80 |
| `file.⟨shape 2⟩ content.rules[].rollout` | object | yes |  |
| `file.⟨shape 2⟩ content.rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 2⟩ content.values` | object[] | yes | 1–20 items |
| `file.⟨shape 2⟩ content.values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 2⟩ content.values[].value` | object | yes |  |
| `file.⟨shape 2⟩ environment` | "development" \| "staging" \| "production" | yes |  |
| `file.⟨shape 2⟩ exportedAt` | integer | yes |  |
| `file.⟨shape 2⟩ formatVersion` | 1 | yes |  |
| `file.⟨shape 2⟩ groups` | object[] | yes |  |
| `file.⟨shape 2⟩ groups[].conditions` | object[] | yes | 1–10 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].description` | string | yes |  |
| `file.⟨shape 2⟩ groups[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 2⟩ groups[].name` | string | yes |  |
| `file.⟨shape 2⟩ key` | "reward-claim-cta" | yes |  |
| `file.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `file.⟨shape 2⟩ listedGroupKeys` | string[] | yes |  |
| `file.⟨shape 2⟩ revision` | integer | yes |  |
| `reason` | string | yes | length 10–500 |

**Response 201 Created** (`application/json`) — The new revision

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.authorName` | string \| null | yes |  |
| `data.authorUserId` | string (uuid) \| null | yes |  |
| `data.content` | object | yes |  |
| `data.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.decidedAt` | integer \| null | yes |  |
| `data.decidedByName` | string \| null | yes |  |
| `data.decisionReason` | string \| null | yes |  |
| `data.expiresAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.number` | integer | yes |  |
| `data.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.reason` | string | yes |  |
| `data.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 422 | `PROMOTION_INVALID` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/feature-flags/promotion/preview

What importing a promotion file would change here: the rules side by side, groups new or changed, listed groups missing

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FlagPromotionController_preview` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-promotion.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `file` | object | yes |  |
| `file.⟨shape 1⟩ content` | object | yes |  |
| `file.⟨shape 1⟩ content.kind` | "FLAG" | yes |  |
| `file.⟨shape 1⟩ content.rules` | object[] | yes | 0–50 items |
| `file.⟨shape 1⟩ content.rules[].conditions` | object[] | yes | 0–10 items |
| `file.⟨shape 1⟩ content.rules[].id` | string (uuid) | yes |  |
| `file.⟨shape 1⟩ content.rules[].name` | string | yes | length 1–80 |
| `file.⟨shape 1⟩ content.rules[].rollout` | object | yes |  |
| `file.⟨shape 1⟩ environment` | "development" \| "staging" \| "production" | yes |  |
| `file.⟨shape 1⟩ exportedAt` | integer | yes |  |
| `file.⟨shape 1⟩ formatVersion` | 1 | yes |  |
| `file.⟨shape 1⟩ groups` | object[] | yes |  |
| `file.⟨shape 1⟩ groups[].conditions` | object[] | yes | 1–10 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 1⟩ groups[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `file.⟨shape 1⟩ groups[].description` | string | yes |  |
| `file.⟨shape 1⟩ groups[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 1⟩ groups[].name` | string | yes |  |
| `file.⟨shape 1⟩ key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `file.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `file.⟨shape 1⟩ listedGroupKeys` | string[] | yes |  |
| `file.⟨shape 1⟩ revision` | integer | yes |  |
| `file.⟨shape 2⟩ content` | object | yes |  |
| `file.⟨shape 2⟩ content.kind` | "CONFIG" | yes |  |
| `file.⟨shape 2⟩ content.rules` | object[] | yes | 0–50 items |
| `file.⟨shape 2⟩ content.rules[].conditions` | object[] | yes | 0–10 items |
| `file.⟨shape 2⟩ content.rules[].id` | string (uuid) | yes |  |
| `file.⟨shape 2⟩ content.rules[].name` | string | yes | length 1–80 |
| `file.⟨shape 2⟩ content.rules[].rollout` | object | yes |  |
| `file.⟨shape 2⟩ content.rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 2⟩ content.values` | object[] | yes | 1–20 items |
| `file.⟨shape 2⟩ content.values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 2⟩ content.values[].value` | object | yes |  |
| `file.⟨shape 2⟩ environment` | "development" \| "staging" \| "production" | yes |  |
| `file.⟨shape 2⟩ exportedAt` | integer | yes |  |
| `file.⟨shape 2⟩ formatVersion` | 1 | yes |  |
| `file.⟨shape 2⟩ groups` | object[] | yes |  |
| `file.⟨shape 2⟩ groups[].conditions` | object[] | yes | 1–10 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `file.⟨shape 2⟩ groups[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `file.⟨shape 2⟩ groups[].description` | string | yes |  |
| `file.⟨shape 2⟩ groups[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `file.⟨shape 2⟩ groups[].name` | string | yes |  |
| `file.⟨shape 2⟩ key` | "reward-claim-cta" | yes |  |
| `file.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `file.⟨shape 2⟩ listedGroupKeys` | string[] | yes |  |
| `file.⟨shape 2⟩ revision` | integer | yes |  |

**Response 200 OK** (`application/json`) — The difference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.current` | object \| null | yes |  |
| `data.current.authorName` | string \| null | yes |  |
| `data.current.authorUserId` | string (uuid) \| null | yes |  |
| `data.current.content` | object | yes |  |
| `data.current.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.current.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.current.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.current.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.current.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.current.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.current.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.current.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.current.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.current.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.current.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.current.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.current.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.current.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.current.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.current.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.current.createdAt` | integer | yes |  |
| `data.current.decidedAt` | integer \| null | yes |  |
| `data.current.decidedByName` | string \| null | yes |  |
| `data.current.decisionReason` | string \| null | yes |  |
| `data.current.expiresAt` | integer \| null | yes |  |
| `data.current.id` | string (uuid) | yes |  |
| `data.current.number` | integer | yes |  |
| `data.current.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.current.reason` | string | yes |  |
| `data.current.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.current.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |
| `data.from` | "development" \| "staging" \| "production" | yes |  |
| `data.groups` | object[] | yes |  |
| `data.groups[].change` | "NEW" \| "CHANGED" \| "SAME" \| "LISTED_HERE" | yes |  |
| `data.groups[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.identical` | boolean | yes |  |
| `data.incoming` | object | yes |  |
| `data.incoming.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.incoming.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.incoming.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.incoming.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.incoming.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.incoming.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.incoming.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.incoming.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.incoming.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.incoming.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.incoming.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.incoming.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.incoming.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.incoming.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.incoming.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.incoming.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" \| "reward-claim-cta" | yes |  |
| `data.kind` | "FLAG" \| "CONFIG" | yes |  |
| `data.missingListedGroups` | string[] | yes |  |
| `data.needsApproval` | boolean | yes |  |
| `data.to` | "development" \| "staging" \| "production" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/feature-flags/subjects

The users, tenants or locations an override can name, by name (up to 20)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsController_subjects` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `unit` | query | "USER" \| "LOCATION" \| "TENANT" | yes |  |
| `search` | query | string | no |  |

**Response 200 OK** (`application/json`) — Matching subjects

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.subjects` | object[] | yes |  |
| `data.subjects[].detail` | string \| null | yes |  |
| `data.subjects[].id` | string (uuid) | yes |  |
| `data.subjects[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/feature-flags/bundle

The caller's evaluated feature flags and dynamic configs for one app

Signed in or not. Send `X-Device-Id` (a random UUID per browser or install) for device-unit flags, `X-Client-Platform` and `X-App-Version` from the mobile app. A `tenantId` / `locationId` count only when the signed-in person works there.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsClientController_bundle` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags-client.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `app` | query | "admin" \| "merchant" \| "web" \| "mobile" | yes |  |
| `tenantId` | query | string (uuid) | no |  |
| `locationId` | query | string (uuid) | no |  |
| `locale` | query | "en" \| "ms" \| "zh-Hans" \| "ta" | no | A shipped language: en, ms, zh-Hans or ta |

**Response 200 OK** (`application/json`) — The values, the catalogue version and when a scheduled rollout next changes them

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.app` | "admin" \| "merchant" \| "web" \| "mobile" | yes |  |
| `data.configs` | object[] | yes |  |
| `data.configs[].experimentId` | string (uuid) \| null | yes |  |
| `data.configs[].key` | "reward-claim-cta" | yes |  |
| `data.configs[].revision` | integer \| null | yes |  |
| `data.configs[].ruleId` | string (uuid) \| null | yes |  |
| `data.configs[].source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `data.configs[].value` | object | yes |  |
| `data.configs[].valueName` | string \| null | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.configs[].variant` | string \| null | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.evaluatedAt` | integer | yes |  |
| `data.flags` | object[] | yes |  |
| `data.flags[].key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `data.flags[].on` | boolean | yes |  |
| `data.flags[].revision` | integer \| null | yes |  |
| `data.flags[].ruleId` | string (uuid) \| null | yes |  |
| `data.flags[].source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `data.nextChangeAt` | integer \| null | yes |  |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/feature-flags/exposures

Record a batch of feature flag exposures

The subject of each comes from the session, `X-Device-Id`, or a store the person works at — never from the body. Signed out, only device-unit flags count. Up to 50 per batch.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: 30 requests per 60 s per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FeatureFlagsClientController_record` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags-client.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `app` | "admin" \| "merchant" \| "web" \| "mobile" | yes |  |
| `exposures` | object[] | yes | 1–50 items |
| `exposures[].⟨shape 1⟩ at` | integer | yes |  |
| `exposures[].⟨shape 1⟩ key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" | yes |  |
| `exposures[].⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `exposures[].⟨shape 1⟩ on` | boolean | yes |  |
| `exposures[].⟨shape 1⟩ revision` | integer \| null | yes |  |
| `exposures[].⟨shape 1⟩ ruleId` | string (uuid) \| null | yes |  |
| `exposures[].⟨shape 1⟩ source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `exposures[].⟨shape 2⟩ at` | integer | yes |  |
| `exposures[].⟨shape 2⟩ experimentId` | string (uuid) \| null | yes |  |
| `exposures[].⟨shape 2⟩ key` | "reward-claim-cta" | yes |  |
| `exposures[].⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `exposures[].⟨shape 2⟩ revision` | integer \| null | yes |  |
| `exposures[].⟨shape 2⟩ ruleId` | string (uuid) \| null | yes |  |
| `exposures[].⟨shape 2⟩ source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `exposures[].⟨shape 2⟩ valueName` | string \| null | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `exposures[].⟨shape 2⟩ variant` | string \| null | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `locationId` | string (uuid) | no |  |
| `tenantId` | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — How many were accepted and how many ignored

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.accepted` | integer | yes |  |
| `data.ignored` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/feature-flags/stream

The feature flag catalogue's version, live (SSE): a `{ version }` frame on connect and whenever it changes; refetch the bundle when it does

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `text/event-stream` (errors are always `application/json`)
- Operation id `FeatureFlagsClientController_stream` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/feature-flags-client.controller.ts)

**Response 200 OK** — A `{ version }` frame per change and a `ping` every 25 s (no envelope) (`text/event-stream`)

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

## Dynamic configs

### GET /api/v1/admin/dynamic-configs

Every declared dynamic config: its value shape, live and pending revision, running experiment and exposures

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:DYNAMIC_CONFIG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DynamicConfigsController_list` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/dynamic-configs.controller.ts)

**Response 200 OK** (`application/json`) — The configs

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.configs` | object[] | yes |  |
| `data.configs[].apps` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes |  |
| `data.configs[].defaultValue` | object | yes |  |
| `data.configs[].description` | string | yes |  |
| `data.configs[].exposures24h` | integer | yes |  |
| `data.configs[].key` | "reward-claim-cta" | yes |  |
| `data.configs[].liveRevision` | integer \| null | yes |  |
| `data.configs[].pendingRevision` | integer \| null | yes |  |
| `data.configs[].rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.configs[].ruleCount` | integer | yes |  |
| `data.configs[].runningExperimentId` | string (uuid) \| null | yes |  |
| `data.configs[].title` | string | yes |  |
| `data.configs[].updatedAt` | integer \| null | yes |  |
| `data.configs[].valueCount` | integer | yes |  |
| `data.configs[].valueJsonSchema` | object | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/dynamic-configs/{key}

One dynamic config: its live and pending values and rules, and exposures

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:DYNAMIC_CONFIG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DynamicConfigsController_detail` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/dynamic-configs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "reward-claim-cta" | yes |  |

**Response 200 OK** (`application/json`) — The config

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.apps` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes |  |
| `data.defaultValue` | object | yes |  |
| `data.description` | string | yes |  |
| `data.exposures` | object | yes |  |
| `data.exposures.last24h` | object[] | yes |  |
| `data.exposures.last24h[].exposures` | integer | yes |  |
| `data.exposures.last24h[].ruleId` | string (uuid) \| null | yes |  |
| `data.exposures.last24h[].source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `data.exposures.last24h[].subjects` | integer | yes |  |
| `data.exposures.last24h[].value` | string | yes |  |
| `data.exposures.last7d` | object[] | yes |  |
| `data.exposures.last7d[].exposures` | integer | yes |  |
| `data.exposures.last7d[].ruleId` | string (uuid) \| null | yes |  |
| `data.exposures.last7d[].source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `data.exposures.last7d[].subjects` | integer | yes |  |
| `data.exposures.last7d[].value` | string | yes |  |
| `data.exposures.lastExposureAt` | integer \| null | yes |  |
| `data.exposures24h` | integer | yes |  |
| `data.key` | "reward-claim-cta" | yes |  |
| `data.live` | object \| null | yes |  |
| `data.live.authorName` | string \| null | yes |  |
| `data.live.authorUserId` | string (uuid) \| null | yes |  |
| `data.live.content` | object | yes |  |
| `data.live.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.live.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.live.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.live.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.live.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.live.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.live.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.live.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.live.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.live.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.live.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.live.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.live.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.live.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.live.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.live.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.live.createdAt` | integer | yes |  |
| `data.live.decidedAt` | integer \| null | yes |  |
| `data.live.decidedByName` | string \| null | yes |  |
| `data.live.decisionReason` | string \| null | yes |  |
| `data.live.expiresAt` | integer \| null | yes |  |
| `data.live.id` | string (uuid) | yes |  |
| `data.live.number` | integer | yes |  |
| `data.live.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.live.reason` | string | yes |  |
| `data.live.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.live.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |
| `data.liveRevision` | integer \| null | yes |  |
| `data.pending` | object \| null | yes |  |
| `data.pending.authorName` | string \| null | yes |  |
| `data.pending.authorUserId` | string (uuid) \| null | yes |  |
| `data.pending.content` | object | yes |  |
| `data.pending.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.pending.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.pending.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.pending.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.pending.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.pending.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.pending.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.pending.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.pending.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.pending.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.pending.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.pending.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.pending.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.pending.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.pending.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.pending.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.pending.createdAt` | integer | yes |  |
| `data.pending.decidedAt` | integer \| null | yes |  |
| `data.pending.decidedByName` | string \| null | yes |  |
| `data.pending.decisionReason` | string \| null | yes |  |
| `data.pending.expiresAt` | integer \| null | yes |  |
| `data.pending.id` | string (uuid) | yes |  |
| `data.pending.number` | integer | yes |  |
| `data.pending.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.pending.reason` | string | yes |  |
| `data.pending.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.pending.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |
| `data.pendingRevision` | integer \| null | yes |  |
| `data.rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.ruleCount` | integer | yes |  |
| `data.runningExperimentId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer \| null | yes |  |
| `data.valueCount` | integer | yes |  |
| `data.valueJsonSchema` | object | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/dynamic-configs/{key}/check

Check a subject: the value one user, store or device would get, and why

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:DYNAMIC_CONFIG`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `DynamicConfigsController_check` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/dynamic-configs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "reward-claim-cta" | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `subject` | object | yes |  |
| `subject.app` | "admin" \| "merchant" \| "web" \| "mobile" \| "api" | yes |  |
| `subject.appVersion` | string \| null | yes | Semantic version of the installed mobile app; at most 64 characters |
| `subject.deviceId` | string (uuid) \| null | yes |  |
| `subject.locale` | "en" \| "ms" \| "zh-Hans" \| "ta" \| null | yes | A shipped language: en, ms, zh-Hans or ta |
| `subject.locationId` | string (uuid) \| null | yes |  |
| `subject.platform` | "web" \| "ios" \| "android" \| null | yes |  |
| `subject.tenantId` | string (uuid) \| null | yes |  |
| `subject.userId` | string (uuid) \| null | yes |  |

**Response 200 OK** (`application/json`) — The value and its trace

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.result` | object | yes |  |
| `data.result.experimentId` | string (uuid) \| null | yes |  |
| `data.result.key` | "reward-claim-cta" | yes |  |
| `data.result.revision` | integer \| null | yes |  |
| `data.result.ruleId` | string (uuid) \| null | yes |  |
| `data.result.source` | "KILL_SWITCH" \| "OVERRIDE_USER" \| "OVERRIDE_LOCATION" \| "OVERRIDE_TENANT" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |
| `data.result.value` | object | yes |  |
| `data.result.valueName` | string \| null | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.result.variant` | string \| null | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.trace` | object[] | yes |  |
| `data.trace[].detail` | string \| null | yes |  |
| `data.trace[].failedAttribute` | "USER_ID" \| "EMAIL_DOMAIN" \| "PLATFORM_STAFF" \| "PERMISSION" \| "TENANT_ID" \| "LOCATION_ID" \| "CUSTOMER_TIER" \| "APP" \| "PLATFORM" \| "APP_VERSION" \| … (+4 more) \| null | yes |  |
| `data.trace[].label` | string | yes |  |
| `data.trace[].matched` | boolean | yes |  |
| `data.trace[].step` | "KILL_SWITCH" \| "OVERRIDE" \| "RULE" \| "EXPERIMENT" \| "DEFAULT" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/dynamic-configs/{key}/revisions

Every revision of a config, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:DYNAMIC_CONFIG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DynamicConfigsController_revisions` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/dynamic-configs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "reward-claim-cta" | yes |  |

**Response 200 OK** (`application/json`) — The revisions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.revisions` | object[] | yes |  |
| `data.revisions[].authorName` | string \| null | yes |  |
| `data.revisions[].authorUserId` | string (uuid) \| null | yes |  |
| `data.revisions[].content` | object | yes |  |
| `data.revisions[].content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.revisions[].content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.revisions[].content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.revisions[].content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.revisions[].content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.revisions[].content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.revisions[].content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.revisions[].content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.revisions[].content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.revisions[].content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.revisions[].content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.revisions[].content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.revisions[].content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.revisions[].content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.revisions[].content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.revisions[].content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.revisions[].createdAt` | integer | yes |  |
| `data.revisions[].decidedAt` | integer \| null | yes |  |
| `data.revisions[].decidedByName` | string \| null | yes |  |
| `data.revisions[].decisionReason` | string \| null | yes |  |
| `data.revisions[].expiresAt` | integer \| null | yes |  |
| `data.revisions[].id` | string (uuid) | yes |  |
| `data.revisions[].number` | integer | yes |  |
| `data.revisions[].promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.revisions[].reason` | string | yes |  |
| `data.revisions[].source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.revisions[].status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/dynamic-configs/{key}/revisions

Save a config's values and rules as a new revision, with a reason

Every value is checked against the config's declared shape (422 FEATURE_FLAG_RULES_INVALID). Waits for approval in production.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:DYNAMIC_CONFIG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `DynamicConfigsController_saveRevision` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/dynamic-configs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "reward-claim-cta" | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `basedOn` | integer \| null | yes |  |
| `content` | object | yes |  |
| `content.kind` | "CONFIG" | yes |  |
| `content.rules` | object[] | yes | 0–50 items |
| `content.rules[].conditions` | object[] | yes | 0–10 items |
| `content.rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `content.rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `content.rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `content.rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `content.rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `content.rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `content.rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `content.rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `content.rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `content.rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `content.rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `content.rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `content.rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `content.rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `content.rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `content.rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `content.rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `content.rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `content.rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `content.rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `content.rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `content.rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `content.rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `content.rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `content.rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `content.rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `content.rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `content.rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `content.rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `content.rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `content.rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `content.rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `content.rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `content.rules[].id` | string (uuid) | yes |  |
| `content.rules[].name` | string | yes | length 1–80 |
| `content.rules[].rollout` | object | yes |  |
| `content.rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `content.rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `content.rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `content.rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `content.rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `content.values` | object[] | yes | 1–20 items |
| `content.values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `content.values[].value` | object | yes |  |
| `reason` | string | yes | length 10–500 |

**Response 201 Created** (`application/json`) — The new revision

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.authorName` | string \| null | yes |  |
| `data.authorUserId` | string (uuid) \| null | yes |  |
| `data.content` | object | yes |  |
| `data.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.decidedAt` | integer \| null | yes |  |
| `data.decidedByName` | string \| null | yes |  |
| `data.decisionReason` | string \| null | yes |  |
| `data.expiresAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.number` | integer | yes |  |
| `data.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.reason` | string | yes |  |
| `data.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 422 | `FEATURE_FLAG_RULES_INVALID` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/dynamic-configs/{key}/revisions/{number}/decision

Approve or reject someone else's pending config revision, with a reason

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `APPROVE:DYNAMIC_CONFIG`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `DynamicConfigsController_decide` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/dynamic-configs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | "reward-claim-cta" | yes |  |
| `number` | path | integer | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `decision` | "APPROVE" \| "REJECT" | yes |  |
| `reason` | string | yes | length 10–500 |

**Response 200 OK** (`application/json`) — The decided revision

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.authorName` | string \| null | yes |  |
| `data.authorUserId` | string (uuid) \| null | yes |  |
| `data.content` | object | yes |  |
| `data.content.⟨shape 1⟩ kind` | "FLAG" | yes |  |
| `data.content.⟨shape 1⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 1⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 1⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 1⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 1⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 1⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 1⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ kind` | "CONFIG" | yes |  |
| `data.content.⟨shape 2⟩ rules` | object[] | yes | 0–50 items |
| `data.content.⟨shape 2⟩ rules[].conditions` | object[] | yes | 0–10 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.content.⟨shape 2⟩ rules[].conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.content.⟨shape 2⟩ rules[].id` | string (uuid) | yes |  |
| `data.content.⟨shape 2⟩ rules[].name` | string | yes | length 1–80 |
| `data.content.⟨shape 2⟩ rules[].rollout` | object | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ kind` | "FIXED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 1⟩ percentage` | integer | yes | range 0–100 |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ kind` | "SCHEDULED" | yes |  |
| `data.content.⟨shape 2⟩ rules[].rollout.⟨shape 2⟩ steps` | object[] | yes | 2–10 items |
| `data.content.⟨shape 2⟩ rules[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values` | object[] | yes | 1–20 items |
| `data.content.⟨shape 2⟩ values[].name` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.content.⟨shape 2⟩ values[].value` | object | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.decidedAt` | integer \| null | yes |  |
| `data.decidedByName` | string \| null | yes |  |
| `data.decisionReason` | string \| null | yes |  |
| `data.expiresAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.number` | integer | yes |  |
| `data.promotedFrom` | "development" \| "staging" \| "production" \| null | yes |  |
| `data.reason` | string | yes |  |
| `data.source` | "CONSOLE" \| "PROMOTION" \| "SEED" | yes |  |
| `data.status` | "LIVE" \| "PENDING" \| "SUPERSEDED" \| "REJECTED" \| "EXPIRED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

## Flag groups

### GET /api/v1/admin/flag-groups

Every flag group: its conditions or member count, and the flags and configs whose rules name it

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG_GROUP`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FlagGroupsController_list` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-groups.controller.ts)

**Response 200 OK** (`application/json`) — The groups

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.groups` | object[] | yes |  |
| `data.groups[].definition` | object | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions` | object[] | yes | 1–10 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.groups[].definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.groups[].definition.⟨shape 1⟩ kind` | "CONDITIONS" | yes |  |
| `data.groups[].definition.⟨shape 2⟩ kind` | "LIST" | yes |  |
| `data.groups[].definition.⟨shape 2⟩ unit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.groups[].description` | string | yes |  |
| `data.groups[].id` | string (uuid) | yes |  |
| `data.groups[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.groups[].memberCount` | integer | yes |  |
| `data.groups[].name` | string | yes |  |
| `data.groups[].updatedAt` | integer | yes |  |
| `data.groups[].updatedByName` | string \| null | yes |  |
| `data.groups[].usedBy` | object[] | yes |  |
| `data.groups[].usedBy[].key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" \| "reward-claim-cta" | yes |  |
| `data.groups[].usedBy[].kind` | "FLAG" \| "CONFIG" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/flag-groups

Create a flag group: conditions, or a list of one rollout unit's subjects (added afterwards)

409 FLAG_GROUP_KEY_TAKEN.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG_GROUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FlagGroupsController_create` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-groups.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `definition` | object | yes |  |
| `definition.⟨shape 1⟩ conditions` | object[] | yes | 1–10 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+43 more) | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `definition.⟨shape 1⟩ kind` | "CONDITIONS" | yes |  |
| `definition.⟨shape 2⟩ kind` | "LIST" | yes |  |
| `definition.⟨shape 2⟩ unit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `description` | string | yes | at most 500 characters |
| `key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `name` | string | yes | length 1–80 |
| `reason` | string | yes | length 10–500 |

**Response 201 Created** (`application/json`) — The group

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.definition` | object | yes |  |
| `data.definition.⟨shape 1⟩ conditions` | object[] | yes | 1–10 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+43 more) | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ kind` | "CONDITIONS" | yes |  |
| `data.definition.⟨shape 2⟩ kind` | "LIST" | yes |  |
| `data.definition.⟨shape 2⟩ unit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.description` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.memberCount` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.updatedByName` | string \| null | yes |  |
| `data.usedBy` | object[] | yes |  |
| `data.usedBy[].key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" \| "reward-claim-cta" | yes |  |
| `data.usedBy[].kind` | "FLAG" \| "CONFIG" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `FLAG_GROUP_KEY_TAKEN` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/flag-groups/{groupId}

One flag group

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG_GROUP`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FlagGroupsController_find` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-groups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `groupId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The group

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.definition` | object | yes |  |
| `data.definition.⟨shape 1⟩ conditions` | object[] | yes | 1–10 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+43 more) | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ kind` | "CONDITIONS" | yes |  |
| `data.definition.⟨shape 2⟩ kind` | "LIST" | yes |  |
| `data.definition.⟨shape 2⟩ unit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.description` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.memberCount` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.updatedByName` | string \| null | yes |  |
| `data.usedBy` | object[] | yes |  |
| `data.usedBy[].key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" \| "reward-claim-cta" | yes |  |
| `data.usedBy[].kind` | "FLAG" \| "CONFIG" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/flag-groups/{groupId}

Change a group's name, description or (a condition group's) conditions, with a reason — its key and kind never change

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG_GROUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FlagGroupsController_update` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-groups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `groupId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `conditions` | object[] \| null | yes | 1–10 items |
| `conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `conditions[].⟨shape 4⟩ permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `conditions[].⟨shape 4⟩ permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+43 more) | yes |  |
| `conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `description` | string | yes | at most 500 characters |
| `name` | string | yes | length 1–80 |
| `reason` | string | yes | length 10–500 |

**Response 200 OK** (`application/json`) — The group

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.definition` | object | yes |  |
| `data.definition.⟨shape 1⟩ conditions` | object[] | yes | 1–10 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ attribute` | "USER_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 1⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ attribute` | "EMAIL_DOMAIN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 2⟩ values` | string[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ attribute` | "PLATFORM_STAFF" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 3⟩ is` | boolean | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ attribute` | "PERMISSION" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ operator` | "HAS" \| "LACKS" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission` | object | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 4⟩ permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+43 more) | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ attribute` | "TENANT_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 5⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ attribute` | "LOCATION_ID" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 6⟩ values` | string (uuid)[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ attribute` | "CUSTOMER_TIER" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 7⟩ values` | "BRONZE" \| "SILVER" \| "GOLD" \| "DIAMOND"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ attribute` | "APP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 8⟩ values` | "admin" \| "merchant" \| "web" \| "mobile" \| "api"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ attribute` | "PLATFORM" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 9⟩ values` | "web" \| "ios" \| "android"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ attribute` | "APP_VERSION" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ operator` | "AT_LEAST" \| "BELOW" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 10⟩ version` | string | yes | Semantic version of the installed mobile app; at most 64 characters |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ attribute` | "LOCALE" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 11⟩ values` | "en" \| "ms" \| "zh-Hans" \| "ta"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ attribute` | "FLAG_GROUP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ groupKey` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 12⟩ operator` | "IN_GROUP" \| "NOT_IN_GROUP" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ attribute` | "TIME" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ from` | integer \| null | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 13⟩ until` | integer \| null | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ attribute` | "ENVIRONMENT" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ operator` | "IN" \| "NOT_IN" | yes |  |
| `data.definition.⟨shape 1⟩ conditions[].⟨shape 14⟩ values` | "development" \| "staging" \| "production"[] | yes | 1–100 items |
| `data.definition.⟨shape 1⟩ kind` | "CONDITIONS" | yes |  |
| `data.definition.⟨shape 2⟩ kind` | "LIST" | yes |  |
| `data.definition.⟨shape 2⟩ unit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.description` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.memberCount` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.updatedByName` | string \| null | yes |  |
| `data.usedBy` | object[] | yes |  |
| `data.usedBy[].key` | "showcase" \| "merchant-invites" \| "till-redemption" \| "customer-tiers" \| "merchant-analytics" \| "web-activity" \| "mobile-analytics" \| "reward-claim-cta" | yes |  |
| `data.usedBy[].kind` | "FLAG" \| "CONFIG" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/flag-groups/{groupId}/members

One page of a listed group's subjects, newest first, with their names

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:FEATURE_FLAG_GROUP`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FlagGroupsController_members` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-groups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `groupId` | path | string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: addedAt. Default: -addedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** (`application/json`) — The members

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].addedAt` | integer | yes |  |
| `data[].addedByName` | string \| null | yes |  |
| `data[].name` | string \| null | yes |  |
| `data[].subjectId` | string (uuid) | yes |  |
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

### POST /api/v1/admin/flag-groups/{groupId}/members

Add or remove up to 1,000 listed subjects at once, with a reason

A group holds at most 10,000. User, tenant and location ids must exist (422 FLAG_GROUP_INVALID).

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG_GROUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FlagGroupsController_changeMembers` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-groups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `groupId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | "ADD" \| "REMOVE" | yes |  |
| `reason` | string | yes | length 10–500 |
| `subjectIds` | string (uuid)[] | yes | 1–1000 items |

**Response 200 OK** (`application/json`) — How many changed, and the group's size

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.changed` | integer | yes |  |
| `data.memberCount` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 422 | `FLAG_GROUP_INVALID` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/flag-groups/{groupId}/remove

Remove a group no rule names any more, with a reason

409 FLAG_GROUP_IN_USE while a live or pending rule names it.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:FEATURE_FLAG_GROUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FlagGroupsController_remove` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/flag-groups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `groupId` | path | string (uuid) | yes |  |

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
| 409 | `FLAG_GROUP_IN_USE` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

## Experiments

### GET /api/v1/admin/experiments

Every experiment, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:EXPERIMENT`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ExperimentsController_list` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/experiments.controller.ts)

**Response 200 OK** (`application/json`) — The experiments

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.experiments` | object[] | yes |  |
| `data.experiments[].conclusion` | string \| null | yes |  |
| `data.experiments[].configKey` | "reward-claim-cta" | yes |  |
| `data.experiments[].controlValueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.experiments[].createdByName` | string \| null | yes |  |
| `data.experiments[].guardrailMetrics` | "reward-claims" \| "reward-redemptions" \| "sign-ins"[] | yes | 0–3 items |
| `data.experiments[].hypothesis` | string | yes | length 1–1000 |
| `data.experiments[].id` | string (uuid) | yes |  |
| `data.experiments[].key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.experiments[].name` | string | yes | length 1–80 |
| `data.experiments[].plannedEndAt` | integer \| null | yes |  |
| `data.experiments[].primaryMetric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.experiments[].rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.experiments[].startedAt` | integer \| null | yes |  |
| `data.experiments[].status` | "DRAFT" \| "RUNNING" \| "STOPPED" | yes |  |
| `data.experiments[].stoppedAt` | integer \| null | yes |  |
| `data.experiments[].trafficPercentage` | integer | yes | range 1–100 |
| `data.experiments[].updatedAt` | integer | yes |  |
| `data.experiments[].variants` | object[] | yes | 2–5 items |
| `data.experiments[].variants[].allocation` | integer | yes | range 0–100 |
| `data.experiments[].variants[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/experiments

Plan an experiment on a dynamic config (a draft), with a reason

Its variants must be values of the config's live revision (422 EXPERIMENT_PLAN_INVALID).

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:EXPERIMENT`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ExperimentsController_create` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/experiments.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `configKey` | "reward-claim-cta" | yes |  |
| `controlValueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `guardrailMetrics` | "reward-claims" \| "reward-redemptions" \| "sign-ins"[] | yes | 0–3 items |
| `hypothesis` | string | yes | length 1–1000 |
| `key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `name` | string | yes | length 1–80 |
| `plannedEndAt` | integer \| null | yes |  |
| `primaryMetric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `reason` | string | yes | length 10–500 |
| `trafficPercentage` | integer | yes | range 1–100 |
| `variants` | object[] | yes | 2–5 items |
| `variants[].allocation` | integer | yes | range 0–100 |
| `variants[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Response 201 Created** (`application/json`) — The experiment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.conclusion` | string \| null | yes |  |
| `data.configKey` | "reward-claim-cta" | yes |  |
| `data.controlValueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.createdByName` | string \| null | yes |  |
| `data.guardrailMetrics` | "reward-claims" \| "reward-redemptions" \| "sign-ins"[] | yes | 0–3 items |
| `data.hypothesis` | string | yes | length 1–1000 |
| `data.id` | string (uuid) | yes |  |
| `data.key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.name` | string | yes | length 1–80 |
| `data.plannedEndAt` | integer \| null | yes |  |
| `data.primaryMetric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results` | object | yes |  |
| `data.results.computedAt` | integer \| null | yes |  |
| `data.results.experimentId` | string (uuid) | yes |  |
| `data.results.results` | object[] | yes |  |
| `data.results.results[].ciHigh` | number \| null | yes |  |
| `data.results.results[].ciLow` | number \| null | yes |  |
| `data.results.results[].delta` | number \| null | yes |  |
| `data.results.results[].mean` | number | yes |  |
| `data.results.results[].metric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results.results[].significant` | boolean | yes |  |
| `data.results.results[].subjects` | integer | yes |  |
| `data.results.results[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "RUNNING" \| "STOPPED" | yes |  |
| `data.stoppedAt` | integer \| null | yes |  |
| `data.trafficPercentage` | integer | yes | range 1–100 |
| `data.updatedAt` | integer | yes |  |
| `data.variants` | object[] | yes | 2–5 items |
| `data.variants[].allocation` | integer | yes | range 0–100 |
| `data.variants[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 422 | `EXPERIMENT_PLAN_INVALID` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/experiments/{experimentId}

One experiment, with its latest results

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:EXPERIMENT`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ExperimentsController_detail` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/experiments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `experimentId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The experiment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.conclusion` | string \| null | yes |  |
| `data.configKey` | "reward-claim-cta" | yes |  |
| `data.controlValueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.createdByName` | string \| null | yes |  |
| `data.guardrailMetrics` | "reward-claims" \| "reward-redemptions" \| "sign-ins"[] | yes | 0–3 items |
| `data.hypothesis` | string | yes | length 1–1000 |
| `data.id` | string (uuid) | yes |  |
| `data.key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.name` | string | yes | length 1–80 |
| `data.plannedEndAt` | integer \| null | yes |  |
| `data.primaryMetric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results` | object | yes |  |
| `data.results.computedAt` | integer \| null | yes |  |
| `data.results.experimentId` | string (uuid) | yes |  |
| `data.results.results` | object[] | yes |  |
| `data.results.results[].ciHigh` | number \| null | yes |  |
| `data.results.results[].ciLow` | number \| null | yes |  |
| `data.results.results[].delta` | number \| null | yes |  |
| `data.results.results[].mean` | number | yes |  |
| `data.results.results[].metric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results.results[].significant` | boolean | yes |  |
| `data.results.results[].subjects` | integer | yes |  |
| `data.results.results[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "RUNNING" \| "STOPPED" | yes |  |
| `data.stoppedAt` | integer \| null | yes |  |
| `data.trafficPercentage` | integer | yes | range 1–100 |
| `data.updatedAt` | integer | yes |  |
| `data.variants` | object[] | yes | 2–5 items |
| `data.variants[].allocation` | integer | yes | range 0–100 |
| `data.variants[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/experiments/{experimentId}

Change a draft's plan, with a reason

409 EXPERIMENT_STATE_INVALID once started.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:EXPERIMENT`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ExperimentsController_update` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/experiments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `experimentId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `controlValueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `guardrailMetrics` | "reward-claims" \| "reward-redemptions" \| "sign-ins"[] | yes | 0–3 items |
| `hypothesis` | string | yes | length 1–1000 |
| `name` | string | yes | length 1–80 |
| `plannedEndAt` | integer \| null | yes |  |
| `primaryMetric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `reason` | string | yes | length 10–500 |
| `trafficPercentage` | integer | yes | range 1–100 |
| `variants` | object[] | yes | 2–5 items |
| `variants[].allocation` | integer | yes | range 0–100 |
| `variants[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Response 200 OK** (`application/json`) — The experiment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.conclusion` | string \| null | yes |  |
| `data.configKey` | "reward-claim-cta" | yes |  |
| `data.controlValueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.createdByName` | string \| null | yes |  |
| `data.guardrailMetrics` | "reward-claims" \| "reward-redemptions" \| "sign-ins"[] | yes | 0–3 items |
| `data.hypothesis` | string | yes | length 1–1000 |
| `data.id` | string (uuid) | yes |  |
| `data.key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.name` | string | yes | length 1–80 |
| `data.plannedEndAt` | integer \| null | yes |  |
| `data.primaryMetric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results` | object | yes |  |
| `data.results.computedAt` | integer \| null | yes |  |
| `data.results.experimentId` | string (uuid) | yes |  |
| `data.results.results` | object[] | yes |  |
| `data.results.results[].ciHigh` | number \| null | yes |  |
| `data.results.results[].ciLow` | number \| null | yes |  |
| `data.results.results[].delta` | number \| null | yes |  |
| `data.results.results[].mean` | number | yes |  |
| `data.results.results[].metric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results.results[].significant` | boolean | yes |  |
| `data.results.results[].subjects` | integer | yes |  |
| `data.results.results[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "RUNNING" \| "STOPPED" | yes |  |
| `data.stoppedAt` | integer \| null | yes |  |
| `data.trafficPercentage` | integer | yes | range 1–100 |
| `data.updatedAt` | integer | yes |  |
| `data.variants` | object[] | yes | 2–5 items |
| `data.variants[].allocation` | integer | yes | range 0–100 |
| `data.variants[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `EXPERIMENT_STATE_INVALID` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/experiments/{experimentId}/start

Start a draft, with a reason

409 EXPERIMENT_CONFIG_BUSY while another runs on the same config.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:EXPERIMENT`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ExperimentsController_start` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/experiments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `experimentId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 10–500 |

**Response 200 OK** (`application/json`) — The experiment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.conclusion` | string \| null | yes |  |
| `data.configKey` | "reward-claim-cta" | yes |  |
| `data.controlValueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.createdByName` | string \| null | yes |  |
| `data.guardrailMetrics` | "reward-claims" \| "reward-redemptions" \| "sign-ins"[] | yes | 0–3 items |
| `data.hypothesis` | string | yes | length 1–1000 |
| `data.id` | string (uuid) | yes |  |
| `data.key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.name` | string | yes | length 1–80 |
| `data.plannedEndAt` | integer \| null | yes |  |
| `data.primaryMetric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results` | object | yes |  |
| `data.results.computedAt` | integer \| null | yes |  |
| `data.results.experimentId` | string (uuid) | yes |  |
| `data.results.results` | object[] | yes |  |
| `data.results.results[].ciHigh` | number \| null | yes |  |
| `data.results.results[].ciLow` | number \| null | yes |  |
| `data.results.results[].delta` | number \| null | yes |  |
| `data.results.results[].mean` | number | yes |  |
| `data.results.results[].metric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results.results[].significant` | boolean | yes |  |
| `data.results.results[].subjects` | integer | yes |  |
| `data.results.results[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "RUNNING" \| "STOPPED" | yes |  |
| `data.stoppedAt` | integer \| null | yes |  |
| `data.trafficPercentage` | integer | yes | range 1–100 |
| `data.updatedAt` | integer | yes |  |
| `data.variants` | object[] | yes | 2–5 items |
| `data.variants[].allocation` | integer | yes | range 0–100 |
| `data.variants[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `EXPERIMENT_CONFIG_BUSY` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/experiments/{experimentId}/stop

Stop a running experiment, with a reason and its conclusion — everyone gets the config's rules again

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:EXPERIMENT`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ExperimentsController_stop` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/experiments.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `experimentId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `conclusion` | string | yes | length 1–2000 |
| `reason` | string | yes | length 10–500 |

**Response 200 OK** (`application/json`) — The experiment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.conclusion` | string \| null | yes |  |
| `data.configKey` | "reward-claim-cta" | yes |  |
| `data.controlValueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.createdByName` | string \| null | yes |  |
| `data.guardrailMetrics` | "reward-claims" \| "reward-redemptions" \| "sign-ins"[] | yes | 0–3 items |
| `data.hypothesis` | string | yes | length 1–1000 |
| `data.id` | string (uuid) | yes |  |
| `data.key` | string | yes | length 1–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.name` | string | yes | length 1–80 |
| `data.plannedEndAt` | integer \| null | yes |  |
| `data.primaryMetric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results` | object | yes |  |
| `data.results.computedAt` | integer \| null | yes |  |
| `data.results.experimentId` | string (uuid) | yes |  |
| `data.results.results` | object[] | yes |  |
| `data.results.results[].ciHigh` | number \| null | yes |  |
| `data.results.results[].ciLow` | number \| null | yes |  |
| `data.results.results[].delta` | number \| null | yes |  |
| `data.results.results[].mean` | number | yes |  |
| `data.results.results[].metric` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.results.results[].significant` | boolean | yes |  |
| `data.results.results[].subjects` | integer | yes |  |
| `data.results.results[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.rolloutUnit` | "USER" \| "TENANT" \| "LOCATION" \| "DEVICE" | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "RUNNING" \| "STOPPED" | yes |  |
| `data.stoppedAt` | integer \| null | yes |  |
| `data.trafficPercentage` | integer | yes | range 1–100 |
| `data.updatedAt` | integer | yes |  |
| `data.variants` | object[] | yes | 2–5 items |
| `data.variants[].allocation` | integer | yes | range 0–100 |
| `data.variants[].valueName` | string | yes | length 1–40; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/experiments/metrics

The metrics an experiment can compare (declared in code)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:EXPERIMENT`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ExperimentsController_metrics` · [source](../../../apps/api/src/contexts/feature-flags/presentation/http/experiments.controller.ts)

**Response 200 OK** (`application/json`) — The metrics

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.metrics` | object[] | yes |  |
| `data.metrics[].description` | string | yes |  |
| `data.metrics[].higherIsBetter` | boolean | yes |  |
| `data.metrics[].key` | "reward-claims" \| "reward-redemptions" \| "sign-ins" | yes |  |
| `data.metrics[].title` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
