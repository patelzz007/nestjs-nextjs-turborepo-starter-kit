---
title: "API reference — Saved views on admin lists"
description: "Named filters staff keep on an admin list, stored as the list's URL query: your own, and the ones other staff shared."
order: 19
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Saved views on admin lists

Named filters staff keep on an admin list, stored as the list's URL query: your own, and the ones other staff shared.

How these endpoints fit together: [Saved views guide](../saved-views.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Saved views

### GET /api/v1/me/saved-views

A list's saved views: your own, then the ones other staff shared

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SavedViewsController_list` · [source](../../../apps/api/src/contexts/saved-views/presentation/http/saved-views.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `listKey` | query | "admin.users" \| "admin.audit-logs" | yes |  |

**Response 200 OK** (`application/json`) — The views

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.views` | object[] | yes |  |
| `data.views[].createdAt` | integer | yes |  |
| `data.views[].id` | string (uuid) | yes |  |
| `data.views[].listKey` | "admin.users" \| "admin.audit-logs" | yes |  |
| `data.views[].mine` | boolean | yes |  |
| `data.views[].name` | string | yes |  |
| `data.views[].ownerName` | string \| null | yes |  |
| `data.views[].query` | string | yes | at most 2000 characters; pattern `^(?:\?[^\s#]*)?$` |
| `data.views[].shared` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/me/saved-views

Save the list's current filters under a name (optionally shared with the other staff); 409 for a name you already use

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SavedViewsController_create` · [source](../../../apps/api/src/contexts/saved-views/presentation/http/saved-views.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `listKey` | "admin.users" \| "admin.audit-logs" | yes |  |
| `name` | string | yes | length 1–80 |
| `query` | string | yes | at most 2000 characters; pattern `^(?:\?[^\s#]*)?$` |
| `shared` | boolean | no | default `false` |

**Response 201 Created** (`application/json`) — The view

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.listKey` | "admin.users" \| "admin.audit-logs" | yes |  |
| `data.mine` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.ownerName` | string \| null | yes |  |
| `data.query` | string | yes | at most 2000 characters; pattern `^(?:\?[^\s#]*)?$` |
| `data.shared` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/me/saved-views/{viewId}

Remove one of your saved views; 404 for anyone else's

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SavedViewsController_remove` · [source](../../../apps/api/src/contexts/saved-views/presentation/http/saved-views.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `viewId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Removed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.success` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
