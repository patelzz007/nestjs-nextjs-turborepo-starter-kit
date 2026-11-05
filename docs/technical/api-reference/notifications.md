---
title: "API reference — Notifications: inbox, preferences, push devices and broadcasts"
description: "One inbox per app (live over SSE), the preference matrix with quiet hours and digest, marketing consent, push device registration, one-click unsubscribe, Twilio callbacks, the delivery log and catalog for staff, and a tenant's own delivery log and broadcasts."
order: 13
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Notifications: inbox, preferences, push devices and broadcasts

One inbox per app (live over SSE), the preference matrix with quiet hours and digest, marketing consent, push device registration, one-click unsubscribe, Twilio callbacks, the delivery log and catalog for staff, and a tenant's own delivery log and broadcasts.

How these endpoints fit together: [ADR 070: multi-channel notifications](../../adr/070-multi-channel-notifications.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Notifications

### GET /api/v1/notifications

The caller's inbox on one surface, newest first (`filter[readAt][isNull]=true` = unread)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PROFILE`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_inbox` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: readAt, archivedAt, category |
| `surface` | query | "CUSTOMER" \| "MERCHANT" \| "ADMIN" | yes |  |

**Response 200 OK** (`application/json`) — One page of notifications; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].archivedAt` | integer \| null | yes |  |
| `data[].body` | string | yes |  |
| `data[].broadcastId` | string (uuid) \| null | yes |  |
| `data[].category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].groupCount` | integer | yes |  |
| `data[].icon` | string \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].link` | string \| null | yes |  |
| `data[].readAt` | integer \| null | yes |  |
| `data[].richBody` | object \| null | yes |  |
| `data[].richBody.content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data[].richBody.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data[].richBody.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data[].richBody.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data[].richBody.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data[].richBody.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data[].richBody.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data[].richBody.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data[].richBody.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data[].richBody.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data[].richBody.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data[].richBody.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data[].richBody.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data[].richBody.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data[].richBody.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data[].richBody.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data[].richBody.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data[].richBody.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data[].richBody.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data[].richBody.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data[].richBody.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data[].richBody.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data[].richBody.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data[].richBody.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data[].richBody.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data[].richBody.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data[].richBody.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data[].richBody.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data[].richBody.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data[].richBody.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data[].richBody.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data[].richBody.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data[].richBody.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data[].richBody.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data[].richBody.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data[].richBody.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data[].richBody.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data[].richBody.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data[].richBody.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data[].richBody.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data[].richBody.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data[].richBody.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data[].richBody.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data[].richBody.type` | "doc" | yes |  |
| `data[].senderLogoUrl` | string \| null | yes |  |
| `data[].senderName` | string \| null | yes |  |
| `data[].surface` | "CUSTOMER" \| "MERCHANT" \| "ADMIN" | yes |  |
| `data[].title` | string | yes |  |
| `data[].typeKey` | string | yes |  |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/notifications/archive

Archive notifications (they leave the inbox; read too)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_archive` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `notificationIds` | string (uuid)[] | yes | 1–100 items |

**Response 201 Created** (`application/json`) — Archived

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

### POST /api/v1/notifications/consent

Grant or withdraw marketing consent (the platform's, or one tenant's), recorded with its wording version

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_consent` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `granted` | boolean | yes |  |
| `scope` | "PLATFORM" \| "TENANT" | yes |  |
| `source` | "SIGNUP" \| "FIRST_CLAIM" \| "SETTINGS" | yes |  |
| `tenantId` | string (uuid) \| null | yes |  |
| `wordingVersion` | string | yes | length 1–32 |

**Response 201 Created** (`application/json`) — Consent recorded

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

### POST /api/v1/notifications/leave-tenant

Stop hearing from a tenant until claiming from it again (withdraws its consent)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_leaveTenant` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `tenantId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Left

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

### GET /api/v1/notifications/preferences

The preference matrix (category × channel), quiet hours, digest, consent and tenant links

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PROFILE`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_preferences` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Preferences

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.categories` | object[] | yes |  |
| `data.categories[].category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.categories[].channels` | object[] | yes |  |
| `data.categories[].channels[].available` | boolean | yes |  |
| `data.categories[].channels[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data.categories[].channels[].enabled` | boolean | yes |  |
| `data.categories[].channels[].locked` | boolean | yes |  |
| `data.categories[].channels[].reason` | "mandatory" \| "phone-unverified" \| "no-push-device" \| "not-offered" \| "needs-consent" \| null | yes |  |
| `data.platformMarketingConsent` | boolean | yes |  |
| `data.schedule` | object | yes |  |
| `data.schedule.digestFrequency` | "OFF" \| "DAILY" \| "WEEKLY" | yes |  |
| `data.schedule.quietEndMinute` | integer | yes | range 0–1439 |
| `data.schedule.quietHoursEnabled` | boolean | yes |  |
| `data.schedule.quietStartMinute` | integer | yes | range 0–1439 |
| `data.schedule.timeZone` | string | yes | length 1–64 |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.tenants` | object[] | yes |  |
| `data.tenants[].left` | boolean | yes |  |
| `data.tenants[].marketingConsent` | boolean | yes |  |
| `data.tenants[].tenantId` | string (uuid) | yes |  |
| `data.tenants[].tenantName` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/notifications/preferences

Turn categories on or off per channel, everywhere or for one tenant (mandatory channels refuse with 400)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_updatePreferences` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `changes` | object[] | yes | 1–24 items |
| `changes[].category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `changes[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `changes[].enabled` | boolean | yes |  |
| `tenantId` | string (uuid) \| null | yes |  |

**Response 200 OK** (`application/json`) — The preferences after the change

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.categories` | object[] | yes |  |
| `data.categories[].category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.categories[].channels` | object[] | yes |  |
| `data.categories[].channels[].available` | boolean | yes |  |
| `data.categories[].channels[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data.categories[].channels[].enabled` | boolean | yes |  |
| `data.categories[].channels[].locked` | boolean | yes |  |
| `data.categories[].channels[].reason` | "mandatory" \| "phone-unverified" \| "no-push-device" \| "not-offered" \| "needs-consent" \| null | yes |  |
| `data.platformMarketingConsent` | boolean | yes |  |
| `data.schedule` | object | yes |  |
| `data.schedule.digestFrequency` | "OFF" \| "DAILY" \| "WEEKLY" | yes |  |
| `data.schedule.quietEndMinute` | integer | yes | range 0–1439 |
| `data.schedule.quietHoursEnabled` | boolean | yes |  |
| `data.schedule.quietStartMinute` | integer | yes | range 0–1439 |
| `data.schedule.timeZone` | string | yes | length 1–64 |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.tenants` | object[] | yes |  |
| `data.tenants[].left` | boolean | yes |  |
| `data.tenants[].marketingConsent` | boolean | yes |  |
| `data.tenants[].tenantId` | string (uuid) | yes |  |
| `data.tenants[].tenantName` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PATCH /api/v1/notifications/preferences

Set quiet hours, the time zone and the email digest

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_updateSchedule` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `digestFrequency` | "OFF" \| "DAILY" \| "WEEKLY" | yes |  |
| `quietEndMinute` | integer | yes | range 0–1439 |
| `quietHoursEnabled` | boolean | yes |  |
| `quietStartMinute` | integer | yes | range 0–1439 |
| `timeZone` | string | yes | length 1–64 |

**Response 200 OK** (`application/json`) — The preferences after the change

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.categories` | object[] | yes |  |
| `data.categories[].category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.categories[].channels` | object[] | yes |  |
| `data.categories[].channels[].available` | boolean | yes |  |
| `data.categories[].channels[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data.categories[].channels[].enabled` | boolean | yes |  |
| `data.categories[].channels[].locked` | boolean | yes |  |
| `data.categories[].channels[].reason` | "mandatory" \| "phone-unverified" \| "no-push-device" \| "not-offered" \| "needs-consent" \| null | yes |  |
| `data.platformMarketingConsent` | boolean | yes |  |
| `data.schedule` | object | yes |  |
| `data.schedule.digestFrequency` | "OFF" \| "DAILY" \| "WEEKLY" | yes |  |
| `data.schedule.quietEndMinute` | integer | yes | range 0–1439 |
| `data.schedule.quietHoursEnabled` | boolean | yes |  |
| `data.schedule.quietStartMinute` | integer | yes | range 0–1439 |
| `data.schedule.timeZone` | string | yes | length 1–64 |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.tenants` | object[] | yes |  |
| `data.tenants[].left` | boolean | yes |  |
| `data.tenants[].marketingConsent` | boolean | yes |  |
| `data.tenants[].tenantId` | string (uuid) | yes |  |
| `data.tenants[].tenantName` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/notifications/push-devices

The caller's registered push devices

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PROFILE`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_devices` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Response 200 OK** (`application/json`) — Devices

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].appVersion` | string \| null | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].deviceLabel` | string \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isCurrentSession` | boolean | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].lastSeenAt` | integer | yes |  |
| `data[].platform` | "IOS" \| "ANDROID" | yes |  |
| `data[].surface` | "CUSTOMER" \| "MERCHANT" \| "ADMIN" | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/notifications/push-devices

Register this app install for push (bound to the signed-in session); 503 when push is not configured

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_registerDevice` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `appVersion` | string \| null | yes | length 1–32 |
| `deviceLabel` | string \| null | yes | length 1–120 |
| `installationId` | string \| null | no | pattern `^[c-f][A-Za-z0-9_-]{21}$`; default `null` |
| `platform` | "IOS" \| "ANDROID" | yes |  |
| `surface` | "CUSTOMER" \| "MERCHANT" \| "ADMIN" | yes |  |
| `token` | string | yes | length 1–4096 |

**Response 200 OK** (`application/json`) — The registered device

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.appVersion` | string \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.deviceLabel` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isCurrentSession` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.lastSeenAt` | integer | yes |  |
| `data.platform` | "IOS" \| "ANDROID" | yes |  |
| `data.surface` | "CUSTOMER" \| "MERCHANT" \| "ADMIN" | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/notifications/push-devices/{deviceId}

Remove one of the caller's push devices

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_removeDevice` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `deviceId` | path | string (uuid) | yes |  |

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

### POST /api/v1/notifications/push-opened

A push was tapped: it is marked opened and read in every inbox

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_pushOpened` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `deliveryId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Recorded

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

### POST /api/v1/notifications/read

Mark notifications read (by id, or all on one surface); read everywhere, including the phone's tray

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PROFILE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_read` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `markAll` | true | no |  |
| `notificationIds` | string (uuid)[] | no | 1–100 items |
| `surface` | "CUSTOMER" \| "MERCHANT" \| "ADMIN" | yes |  |

**Response 201 Created** (`application/json`) — Marked read

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

### GET /api/v1/notifications/stream

The caller's inbox, live (SSE): a `{ surface, unread }` frame whenever it changes

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PROFILE`.
- Content type: no request body; returns `text/event-stream` (errors are always `application/json`)
- Operation id `NotificationsController_stream` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `surface` | query | "CUSTOMER" \| "MERCHANT" \| "ADMIN" | yes |  |
| `client_type` | query | "web" \| "admin" \| "merchant" \| "mobile" | no |  |

**Response 200 OK** — A `{ surface, unread }` frame per change and a `ping` every 25 s (no envelope) (`text/event-stream`)

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/notifications/unread-count

How many notifications on one surface are unread (the bell badge)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PROFILE`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsController_unreadCount` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `surface` | query | "CUSTOMER" \| "MERCHANT" \| "ADMIN" | yes |  |

**Response 200 OK** (`application/json`) — Unread count

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.unread` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

## Notifications (admin)

### GET /api/v1/admin/notifications/catalog

Every notification type with its category, surfaces, channels and flags

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:NOTIFICATION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsAdminController_catalog` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications-admin.controller.ts)

**Response 200 OK** (`application/json`) — The catalog

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].allowsContactRecipient` | boolean | yes |  |
| `data[].category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data[].channels` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS"[] | yes |  |
| `data[].description` | string | yes |  |
| `data[].digestible` | boolean | yes |  |
| `data[].groups` | boolean | yes |  |
| `data[].key` | string | yes |  |
| `data[].mandatoryChannels` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS"[] | yes |  |
| `data[].sensitive` | boolean | yes |  |
| `data[].surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes |  |
| `data[].urgency` | "immediate" \| "normal" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/notifications/catalog/{key}/preview

How one type renders on every channel, with its sample payload

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:NOTIFICATION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsAdminController_preview` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `key` | path | string | yes |  |

**Response 200 OK** (`application/json`) — Per-channel preview

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.email` | object \| null | yes |  |
| `data.email.html` | string | yes |  |
| `data.email.subject` | string | yes |  |
| `data.email.text` | string | yes |  |
| `data.inApp` | object \| null | yes |  |
| `data.inApp.body` | string | yes |  |
| `data.inApp.link` | string \| null | yes |  |
| `data.inApp.title` | string | yes |  |
| `data.key` | string | yes |  |
| `data.push` | object \| null | yes |  |
| `data.push.body` | string | yes |  |
| `data.push.title` | string | yes |  |
| `data.sms` | object \| null | yes |  |
| `data.sms.segments` | integer | yes |  |
| `data.sms.text` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/notifications/deliveries

Every delivery on every channel, newest first (masked destinations)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:NOTIFICATION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsAdminController_deliveries` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: channel, status, reason, typeKey, tenantId, createdAt |

**Response 200 OK** (`application/json`) — One page of deliveries

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].attempts` | integer | yes |  |
| `data[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].deliveredAt` | integer \| null | yes |  |
| `data[].heldUntil` | integer \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].lastError` | string \| null | yes |  |
| `data[].maskedDestination` | string \| null | yes |  |
| `data[].notificationId` | string (uuid) | yes |  |
| `data[].openedAt` | integer \| null | yes |  |
| `data[].providerMessageId` | string \| null | yes |  |
| `data[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) \| null | yes |  |
| `data[].recipientUserId` | string (uuid) \| null | yes |  |
| `data[].sentAt` | integer \| null | yes |  |
| `data[].status` | "PENDING" \| "HELD" \| "QUEUED" \| "SENDING" \| "SENT" \| "DELIVERED" \| "FAILED" \| "SUPPRESSED" | yes |  |
| `data[].tenantId` | string (uuid) \| null | yes |  |
| `data[].typeKey` | string | yes |  |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/notifications/deliveries/{deliveryId}/retry

Queue a failed push or SMS delivery again (400 for any other)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:NOTIFICATION`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsAdminController_retry` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `deliveryId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Queued again

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.attempts` | integer | yes |  |
| `data.channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.deliveredAt` | integer \| null | yes |  |
| `data.heldUntil` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.lastError` | string \| null | yes |  |
| `data.maskedDestination` | string \| null | yes |  |
| `data.notificationId` | string (uuid) | yes |  |
| `data.openedAt` | integer \| null | yes |  |
| `data.providerMessageId` | string \| null | yes |  |
| `data.reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) \| null | yes |  |
| `data.recipientUserId` | string (uuid) \| null | yes |  |
| `data.sentAt` | integer \| null | yes |  |
| `data.status` | "PENDING" \| "HELD" \| "QUEUED" \| "SENDING" \| "SENT" \| "DELIVERED" \| "FAILED" \| "SUPPRESSED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.typeKey` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/notifications/providers

Which provider each channel uses and whether it delivers for real

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:NOTIFICATION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsAdminController_providers` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications-admin.controller.ts)

**Response 200 OK** (`application/json`) — Providers

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.providers` | object[] | yes |  |
| `data.providers[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data.providers[].configured` | boolean | yes |  |
| `data.providers[].detail` | string | yes |  |
| `data.providers[].live` | boolean | yes |  |
| `data.providers[].provider` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/notifications/suppressions

Addresses and numbers nothing is sent to (bounces, complaints, STOP, unsubscribes)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:NOTIFICATION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsAdminController_suppressions` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: channel, cause, liftedAt |

**Response 200 OK** (`application/json`) — One page of suppressions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].cause` | "HARD_BOUNCE" \| "COMPLAINT" \| "SMS_STOP" \| "INVALID_NUMBER" \| "UNSUBSCRIBED" | yes |  |
| `data[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].liftReason` | string \| null | yes |  |
| `data[].liftedAt` | integer \| null | yes |  |
| `data[].maskedDestination` | string | yes |  |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/notifications/suppressions/{suppressionId}/lift

Lift a suppression, with a reason (audited)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:NOTIFICATION`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsAdminController_lift` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `suppressionId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 10–500 |

**Response 201 Created** (`application/json`) — Lifted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cause` | "HARD_BOUNCE" \| "COMPLAINT" \| "SMS_STOP" \| "INVALID_NUMBER" \| "UNSUBSCRIBED" | yes |  |
| `data.channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.liftReason` | string \| null | yes |  |
| `data.liftedAt` | integer \| null | yes |  |
| `data.maskedDestination` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/notifications/test

Send yourself a test notification on every channel

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `CREATE:NOTIFICATION`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationsAdminController_sendTest` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notifications-admin.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `typeKey` | string | yes | pattern `^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$` |

**Response 201 Created** (`application/json`) — Requested

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

## Notifications (tenant)

### GET /api/v1/tenants/{tenantSlug}/notifications/deliveries

The tenant's deliveries, newest first (masked destinations)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantNotificationsController_deliveries` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-notifications.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: channel, status, reason, typeKey, tenantId, createdAt |

**Response 200 OK** (`application/json`) — One page of the tenant's deliveries; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].attempts` | integer | yes |  |
| `data[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].deliveredAt` | integer \| null | yes |  |
| `data[].heldUntil` | integer \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].lastError` | string \| null | yes |  |
| `data[].maskedDestination` | string \| null | yes |  |
| `data[].notificationId` | string (uuid) | yes |  |
| `data[].openedAt` | integer \| null | yes |  |
| `data[].providerMessageId` | string \| null | yes |  |
| `data[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) \| null | yes |  |
| `data[].recipientUserId` | string (uuid) \| null | yes |  |
| `data[].sentAt` | integer \| null | yes |  |
| `data[].status` | "PENDING" \| "HELD" \| "QUEUED" \| "SENDING" \| "SENT" \| "DELIVERED" \| "FAILED" \| "SUPPRESSED" | yes |  |
| `data[].tenantId` | string (uuid) \| null | yes |  |
| `data[].typeKey` | string | yes |  |
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

## Notification webhooks

### POST /api/v1/notifications/unsubscribe

Unsubscribe with a signed link's token (the web page); 400 for an invalid link

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationUnsubscribeController_unsubscribe` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notification-webhooks.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | length 1–2048 |

**Response 200 OK** (`application/json`) — What was unsubscribed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data.tenantName` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/notifications/unsubscribe/one-click

One-click unsubscribe (RFC 8058, from the List-Unsubscribe header); 400 for an invalid link

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `NotificationUnsubscribeController_oneClickUnsubscribe` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notification-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `token` | query | string | yes |  |

**Request body** (`application/json`, required)

_No fields._

**Response 200 OK** (`application/json`) — What was unsubscribed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channel` | "IN_APP" \| "EMAIL" \| "PUSH" \| "SMS" | yes |  |
| `data.tenantName` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/webhooks/twilio/inbound

Inbound SMS (signature-verified): STOP suppresses the number; 403 for a bad signature, 503 when Twilio is not configured

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TwilioWebhooksController_inbound` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notification-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `x-twilio-signature` | header | string | yes | Twilio's HMAC-SHA1 of the URL and the sorted form fields |

**Request body** (`application/json`, required)

_No fields._

**Response 200 OK** (`application/json`) — Handled

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.received` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/webhooks/twilio/status

Twilio delivery status callback (signature-verified); 403 for a bad signature, 503 when Twilio is not configured

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TwilioWebhooksController_status` · [source](../../../apps/api/src/contexts/notifications/presentation/http/notification-webhooks.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `x-twilio-signature` | header | string | yes | Twilio's HMAC-SHA1 of the URL and the sorted form fields |

**Request body** (`application/json`, required)

_No fields._

**Response 200 OK** (`application/json`) — Recorded

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.received` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

## Broadcasts

### GET /api/v1/admin/broadcast-reports

Reports from recipients, newest first, with the tenant's strikes in the last 90 days

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:BROADCAST_REPORT`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastReportsAdminController_list` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcast-reports-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status |

**Response 200 OK** (`application/json`) — One page of reports

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].broadcastId` | string (uuid) | yes |  |
| `data[].broadcastTitle` | string | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].note` | string \| null | yes |  |
| `data[].reason` | "SPAM" \| "OFFENSIVE" \| "SCAM" | yes |  |
| `data[].reviewedAt` | integer \| null | yes |  |
| `data[].status` | "OPEN" \| "DISMISSED" \| "UPHELD" | yes |  |
| `data[].tenantId` | string (uuid) \| null | yes |  |
| `data[].tenantName` | string \| null | yes |  |
| `data[].tenantStrikesInWindow` | integer | yes |  |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/broadcast-reports/{reportId}/review

Dismiss (resume), uphold (stop it, strike the tenant; three strikes in 90 days stop its broadcasting) or resume

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:BROADCAST_REPORT`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastReportsAdminController_review` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcast-reports-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `reportId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `decision` | "dismiss" \| "uphold" \| "resume" | yes |  |
| `note` | string \| null | yes | at most 500 characters |

**Response 201 Created** (`application/json`) — Decided

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

### GET /api/v1/admin/broadcasts

Platform broadcasts, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:BROADCAST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastsAdminController_list` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcasts-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, tenantId |

**Response 200 OK** (`application/json`) — One page of broadcasts

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].approverUserId` | string (uuid) \| null | yes |  |
| `data[].audience` | object | yes |  |
| `data[].audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data[].audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data[].audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data[].audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data[].audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data[].audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data[].audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data[].audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data[].audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data[].audienceCount` | integer \| null | yes |  |
| `data[].authorUserId` | string (uuid) | yes |  |
| `data[].body` | object | yes |  |
| `data[].body.content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data[].body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data[].body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data[].body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data[].body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data[].body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data[].body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data[].body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data[].body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data[].body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data[].body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data[].body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data[].body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data[].body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data[].body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data[].body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data[].body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data[].body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data[].body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data[].body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data[].body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data[].body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data[].body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data[].body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data[].body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data[].body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data[].body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data[].body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data[].body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data[].body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data[].body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data[].body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data[].body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data[].body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data[].body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data[].body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data[].body.type` | "doc" | yes |  |
| `data[].cancelledAt` | integer \| null | yes |  |
| `data[].category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data[].channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data[].completedAt` | integer \| null | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].localSendAt` | integer \| null | yes |  |
| `data[].openReports` | integer | yes |  |
| `data[].pauseReason` | string \| null | yes |  |
| `data[].pausedAt` | integer \| null | yes |  |
| `data[].results` | object[] | yes |  |
| `data[].results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data[].results[].delivered` | integer | yes |  |
| `data[].results[].engaged` | integer \| null | yes |  |
| `data[].results[].failed` | integer | yes |  |
| `data[].results[].suppressed` | object[] | yes |  |
| `data[].results[].suppressed[].count` | integer | yes |  |
| `data[].results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data[].results[].targeted` | integer | yes |  |
| `data[].sendAt` | integer \| null | yes |  |
| `data[].sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data[].sendingStartedAt` | integer \| null | yes |  |
| `data[].status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data[].tenantId` | string (uuid) \| null | yes |  |
| `data[].title` | string | yes |  |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/broadcasts

Write a platform notice (a draft); 400 names any link that may not be sent

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `CREATE:BROADCAST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastsAdminController_create` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcasts-admin.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `audience` | object | yes |  |
| `audience.⟨shape 1⟩ claimedWithinDays` | integer | no | range 7–365; default `60` |
| `audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | no | 1–500 items; default `null` |
| `audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `audience.⟨shape 1⟩ locationId` | string (uuid) \| null | no | default `null` |
| `audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | no | default `"any"` |
| `audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `audience.⟨shape 2⟩ signedUpAfter` | integer \| null | no | default `null` |
| `audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | no | default `null` |
| `body` | object | yes |  |
| `body.content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `body.type` | "doc" | yes |  |
| `category` | "MARKETING" \| "PRODUCT" \| "ACCOUNT" | yes |  |
| `channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes | 1–3 items |
| `localSendAt` | integer \| null | yes |  |
| `sendAt` | integer \| null | yes |  |
| `sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `title` | string | yes | length 1–200 |

**Response 201 Created** (`application/json`) — The draft

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/broadcasts/{broadcastId}

One broadcast with its results per channel

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:BROADCAST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastsAdminController_get` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcasts-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `broadcastId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The broadcast

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/broadcasts/{broadcastId}

Edit a draft; 409 for any other status

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:BROADCAST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastsAdminController_update` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcasts-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `broadcastId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `audience` | object | yes |  |
| `audience.⟨shape 1⟩ claimedWithinDays` | integer | no | range 7–365; default `60` |
| `audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | no | 1–500 items; default `null` |
| `audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `audience.⟨shape 1⟩ locationId` | string (uuid) \| null | no | default `null` |
| `audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | no | default `"any"` |
| `audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `audience.⟨shape 2⟩ signedUpAfter` | integer \| null | no | default `null` |
| `audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | no | default `null` |
| `body` | object | yes |  |
| `body.content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `body.type` | "doc" | yes |  |
| `category` | "MARKETING" \| "PRODUCT" \| "ACCOUNT" | yes |  |
| `channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes | 1–3 items |
| `localSendAt` | integer \| null | yes |  |
| `sendAt` | integer \| null | yes |  |
| `sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `title` | string | yes | length 1–200 |

**Response 200 OK** (`application/json`) — The draft

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/broadcasts/{broadcastId}/approve

Approve a notice to every user (never your own); 403 for the author

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `APPROVE:BROADCAST`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastsAdminController_approve` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcasts-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `broadcastId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Scheduled

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/broadcasts/{broadcastId}/cancel

Cancel before sending; 409 once it is sending or sent

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `DELETE:BROADCAST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastsAdminController_cancel` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcasts-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `broadcastId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Cancelled

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/broadcasts/{broadcastId}/schedule

Schedule a draft (a notice to every user waits for a second staff member's approval)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `PUBLISH:BROADCAST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastsAdminController_schedule` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcasts-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `broadcastId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Scheduled, or waiting for approval

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/broadcasts/audience-preview

How many users the audience reaches, and how many it leaves out and why (counts only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `CREATE:BROADCAST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastsAdminController_preview` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcasts-admin.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `⟨shape 1⟩ claimedWithinDays` | integer | no | range 7–365; default `60` |
| `⟨shape 1⟩ customerIds` | string (uuid)[] \| null | no | 1–500 items; default `null` |
| `⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `⟨shape 1⟩ locationId` | string (uuid) \| null | no | default `null` |
| `⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | no | default `"any"` |
| `⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `⟨shape 2⟩ signedUpAfter` | integer \| null | no | default `null` |
| `⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | no | default `null` |

**Response 201 Created** (`application/json`) — The count

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.eligible` | integer | yes |  |
| `data.leftOut` | object[] | yes |  |
| `data.leftOut[].count` | integer | yes |  |
| `data.leftOut[].reason` | "no-consent" \| "banned" \| "left" \| "staff" \| "deleted" | yes |  |
| `data.linked` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/broadcasts/{broadcastId}/report

Report a broadcast from your inbox (once per broadcast); 404 for one you did not receive

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:PROFILE (own record only)` — A person reports a broadcast they received.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `BroadcastReportController_report` · [source](../../../apps/api/src/contexts/notifications/presentation/http/broadcast-report.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `broadcastId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `note` | string \| null | yes | at most 500 characters |
| `reason` | "SPAM" \| "OFFENSIVE" \| "SCAM" | yes |  |

**Response 201 Created** (`application/json`) — Reported

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

### GET /api/v1/tenants/{tenantSlug}/broadcasts

The tenant's broadcasts, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_list` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, tenantId |

**Response 200 OK** (`application/json`) — One page of broadcasts

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].approverUserId` | string (uuid) \| null | yes |  |
| `data[].audience` | object | yes |  |
| `data[].audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data[].audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data[].audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data[].audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data[].audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data[].audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data[].audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data[].audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data[].audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data[].audienceCount` | integer \| null | yes |  |
| `data[].authorUserId` | string (uuid) | yes |  |
| `data[].body` | object | yes |  |
| `data[].body.content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data[].body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data[].body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data[].body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data[].body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data[].body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data[].body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data[].body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data[].body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data[].body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data[].body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data[].body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data[].body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data[].body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data[].body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data[].body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data[].body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data[].body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data[].body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data[].body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data[].body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data[].body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data[].body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data[].body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data[].body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data[].body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data[].body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data[].body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data[].body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data[].body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data[].body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data[].body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data[].body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data[].body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data[].body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data[].body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data[].body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data[].body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data[].body.type` | "doc" | yes |  |
| `data[].cancelledAt` | integer \| null | yes |  |
| `data[].category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data[].channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data[].completedAt` | integer \| null | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].localSendAt` | integer \| null | yes |  |
| `data[].openReports` | integer | yes |  |
| `data[].pauseReason` | string \| null | yes |  |
| `data[].pausedAt` | integer \| null | yes |  |
| `data[].results` | object[] | yes |  |
| `data[].results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data[].results[].delivered` | integer | yes |  |
| `data[].results[].engaged` | integer \| null | yes |  |
| `data[].results[].failed` | integer | yes |  |
| `data[].results[].suppressed` | object[] | yes |  |
| `data[].results[].suppressed[].count` | integer | yes |  |
| `data[].results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data[].results[].targeted` | integer | yes |  |
| `data[].sendAt` | integer \| null | yes |  |
| `data[].sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data[].sendingStartedAt` | integer \| null | yes |  |
| `data[].status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data[].tenantId` | string (uuid) \| null | yes |  |
| `data[].title` | string | yes |  |
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

### POST /api/v1/tenants/{tenantSlug}/broadcasts

Write a broadcast to the tenant's customers (a draft); 400 names any link that may not be sent

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_create` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `audience` | object | yes |  |
| `audience.⟨shape 1⟩ claimedWithinDays` | integer | no | range 7–365; default `60` |
| `audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | no | 1–500 items; default `null` |
| `audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `audience.⟨shape 1⟩ locationId` | string (uuid) \| null | no | default `null` |
| `audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | no | default `"any"` |
| `audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `audience.⟨shape 2⟩ signedUpAfter` | integer \| null | no | default `null` |
| `audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | no | default `null` |
| `body` | object | yes |  |
| `body.content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `body.type` | "doc" | yes |  |
| `category` | "MARKETING" \| "PRODUCT" \| "ACCOUNT" | yes |  |
| `channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes | 1–3 items |
| `localSendAt` | integer \| null | yes |  |
| `sendAt` | integer \| null | yes |  |
| `sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `title` | string | yes | length 1–200 |

**Response 201 Created** (`application/json`) — The draft

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/broadcasts/{broadcastId}

One broadcast with its results per channel

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_get` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `broadcastId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The broadcast

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/tenants/{tenantSlug}/broadcasts/{broadcastId}

Edit a draft; 409 for any other status

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_update` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `broadcastId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `audience` | object | yes |  |
| `audience.⟨shape 1⟩ claimedWithinDays` | integer | no | range 7–365; default `60` |
| `audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | no | 1–500 items; default `null` |
| `audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `audience.⟨shape 1⟩ locationId` | string (uuid) \| null | no | default `null` |
| `audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | no | default `"any"` |
| `audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `audience.⟨shape 2⟩ signedUpAfter` | integer \| null | no | default `null` |
| `audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | no | default `null` |
| `body` | object | yes |  |
| `body.content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `body.type` | "doc" | yes |  |
| `category` | "MARKETING" \| "PRODUCT" \| "ACCOUNT" | yes |  |
| `channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes | 1–3 items |
| `localSendAt` | integer \| null | yes |  |
| `sendAt` | integer \| null | yes |  |
| `sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `title` | string | yes | length 1–200 |

**Response 200 OK** (`application/json`) — The draft

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/broadcasts/{broadcastId}/cancel

Cancel before sending; 409 once it is sending or sent

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_cancel` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `broadcastId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Cancelled

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/broadcasts/{broadcastId}/schedule

Schedule a draft; 409 when the weekly allowance is used up or broadcasting is off

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_schedule` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `broadcastId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Scheduled

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.approverUserId` | string (uuid) \| null | yes |  |
| `data.audience` | object | yes |  |
| `data.audience.⟨shape 1⟩ claimedWithinDays` | integer | yes | range 7–365; default `60` |
| `data.audience.⟨shape 1⟩ customerIds` | string (uuid)[] \| null | yes | 1–500 items; default `null` |
| `data.audience.⟨shape 1⟩ kind` | "tenant-customers" | yes |  |
| `data.audience.⟨shape 1⟩ locationId` | string (uuid) \| null | yes | default `null` |
| `data.audience.⟨shape 1⟩ redeemed` | "any" \| "redeemed" \| "not-redeemed" | yes | default `"any"` |
| `data.audience.⟨shape 2⟩ kind` | "platform-users" | yes |  |
| `data.audience.⟨shape 2⟩ signedUpAfter` | integer \| null | yes | default `null` |
| `data.audience.⟨shape 2⟩ surfaces` | "CUSTOMER" \| "MERCHANT" \| "ADMIN"[] | yes | 1–∞ items |
| `data.audience.⟨shape 2⟩ tenantStates` | "ACTIVE" \| "RESTRICTED"[] \| null | yes | default `null` |
| `data.audienceCount` | integer \| null | yes |  |
| `data.authorUserId` | string (uuid) | yes |  |
| `data.body` | object | yes |  |
| `data.body.content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 1⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 2⟩ attrs.level` | 2 \| 3 | yes |  |
| `data.body.content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ marks` | object[] | no |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 1⟩ type` | "text" | yes |  |
| `data.body.content[].⟨shape 2⟩ content[].⟨shape 2⟩ type` | "hardBreak" | yes |  |
| `data.body.content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 3⟩ attrs.language` | string \| null | no | at most 32 characters |
| `data.body.content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].marks` | object[] | no |  |
| `data.body.content[].⟨shape 3⟩ content[].text` | string | yes | at least 1 characters |
| `data.body.content[].⟨shape 3⟩ content[].type` | "text" | yes |  |
| `data.body.content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 4⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 5⟩ attrs.start` | integer | no |  |
| `data.body.content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 5⟩ content[].type` | "listItem" | yes |  |
| `data.body.content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 1⟩ type` | "paragraph" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 2⟩ type` | "heading" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ content` | object[] | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 3⟩ type` | "codeBlock" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 4⟩ type` | "bulletList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ attrs` | object | no |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 5⟩ type` | "orderedList" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ content` | object[] | yes | 1–∞ items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 6⟩ content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.content[].⟨shape 6⟩ type` | "blockquote" | yes |  |
| `data.body.content[].⟨shape 7⟩ type` | "horizontalRule" | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.alt` | string | yes | at most 200 characters |
| `data.body.content[].⟨shape 8⟩ attrs.fileId` | string (uuid) | yes |  |
| `data.body.content[].⟨shape 8⟩ attrs.src` | string (uri) | no |  |
| `data.body.content[].⟨shape 8⟩ type` | "image" | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs` | object | yes |  |
| `data.body.content[].⟨shape 9⟩ attrs.href` | string | yes | at most 2048 characters |
| `data.body.content[].⟨shape 9⟩ attrs.label` | string | yes | length 1–40 |
| `data.body.content[].⟨shape 9⟩ type` | "callToAction" | yes |  |
| `data.body.content[].⟨shape 10⟩ content` | object[] | yes | 1–50 items |
| `data.body.content[].⟨shape 10⟩ content[].content` | object[] | yes | 1–6 items |
| `data.body.content[].⟨shape 10⟩ content[].type` | "tableRow" | yes |  |
| `data.body.content[].⟨shape 10⟩ type` | "table" | yes |  |
| `data.body.type` | "doc" | yes |  |
| `data.cancelledAt` | integer \| null | yes |  |
| `data.category` | "SECURITY" \| "ACCOUNT" \| "TRANSACTIONAL" \| "PRODUCT" \| "MARKETING" \| "OPERATIONS" | yes |  |
| `data.channels` | "IN_APP" \| "EMAIL" \| "PUSH"[] | yes |  |
| `data.completedAt` | integer \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.localSendAt` | integer \| null | yes |  |
| `data.openReports` | integer | yes |  |
| `data.pauseReason` | string \| null | yes |  |
| `data.pausedAt` | integer \| null | yes |  |
| `data.results` | object[] | yes |  |
| `data.results[].channel` | "IN_APP" \| "EMAIL" \| "PUSH" | yes |  |
| `data.results[].delivered` | integer | yes |  |
| `data.results[].engaged` | integer \| null | yes |  |
| `data.results[].failed` | integer | yes |  |
| `data.results[].suppressed` | object[] | yes |  |
| `data.results[].suppressed[].count` | integer | yes |  |
| `data.results[].suppressed[].reason` | "preference" \| "quiet-hours" \| "digest" \| "grouping" \| "cap" \| "no-device" \| "unverified-phone" \| "suppressed-destination" \| "provider-disabled" \| "recipient-deleted" \| … (+6 more) | yes |  |
| `data.results[].targeted` | integer | yes |  |
| `data.sendAt` | integer \| null | yes |  |
| `data.sendMode` | "INSTANT" \| "RECIPIENT_LOCAL_TIME" | yes |  |
| `data.sendingStartedAt` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_APPROVAL" \| "SCHEDULED" \| "SENDING" \| "SENT" \| "CANCELLED" \| "PAUSED" \| "FAILED" | yes |  |
| `data.tenantId` | string (uuid) \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/broadcasts/allowance

Broadcasts used this week, the weekly limit, and whether broadcasting is on

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_allowance` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The allowance

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.broadcastingEnabled` | boolean | yes |  |
| `data.limit` | integer | yes |  |
| `data.used` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/broadcasts/audience-preview

How many customers the audience reaches, and how many it leaves out and why (counts only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_preview` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `claimedWithinDays` | integer | no | range 7–365; default `60` |
| `customerIds` | string (uuid)[] \| null | no | 1–500 items; default `null` |
| `kind` | "tenant-customers" | yes |  |
| `locationId` | string (uuid) \| null | no | default `null` |
| `redeemed` | "any" \| "redeemed" \| "not-redeemed" | no | default `"any"` |

**Response 201 Created** (`application/json`) — The count

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.eligible` | integer | yes |  |
| `data.leftOut` | object[] | yes |  |
| `data.leftOut[].count` | integer | yes |  |
| `data.leftOut[].reason` | "no-consent" \| "banned" \| "left" \| "staff" \| "deleted" | yes |  |
| `data.linked` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/broadcasts/customers

The tenant's customers, to pick recipients by hand (name and masked email; who can receive)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantBroadcastsController_customers` · [source](../../../apps/api/src/contexts/notifications/presentation/http/tenant-broadcasts.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: lastClaimedAt, firstClaimedAt, claimCount. Default: -lastClaimedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: lastClaimedAt |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |
| `reachableOnly` | query | boolean \| "true" \| "false" | no |  |
| `ids` | query | string | no |  |

**Response 200 OK** (`application/json`) — One page of customers

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].claimCount` | integer | yes |  |
| `data[].firstClaimedAt` | integer | yes |  |
| `data[].fullName` | string | yes |  |
| `data[].lastClaimedAt` | integer | yes |  |
| `data[].lastRedeemedAt` | integer \| null | yes |  |
| `data[].maskedEmail` | string \| null | yes |  |
| `data[].unreachableReason` | "no-consent" \| "banned" \| "left" \| "staff" \| null | yes |  |
| `data[].userId` | string (uuid) | yes |  |
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
