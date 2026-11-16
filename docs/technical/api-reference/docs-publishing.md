---
title: "API reference — Docs publishing"
description: "The Notion webhook, what the docs sync reports, and the Operations console's Docs sync page: the setup, the run history, starting a sync and the webhook verification token."
order: 10
author: "Generated from the OpenAPI export"
category: "API reference"
date: 1791072000000
lastUpdated: 1793145600000
editedAt: 1793145600000
coverImage: "/images/covers/technical/api-reference/docs-publishing.webp"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Docs publishing

The Notion webhook, what the docs sync reports, and the Operations console's Docs sync page: the setup, the run history, starting a sync and the webhook verification token.

How these endpoints fit together: [Docs publishing runbook](../operations/docs-publishing.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Docs publishing

### GET /api/v1/admin/docs-publishing/overview

What is set up, and how the latest sync went

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:DOCS_SYNC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DocsPublishingAdminController_overview` · [source](../../../apps/api/src/contexts/docs-publishing/presentation/http/docs-publishing-admin.controller.ts)

**Response 200 OK** (`application/json`) — The overview

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.dispatchConfigured` | boolean | yes |  |
| `data.handshakePending` | boolean | yes |  |
| `data.latestGoodRun` | object \| null | yes |  |
| `data.latestGoodRun.commitSha` | string \| null | yes | length 1–64 |
| `data.latestGoodRun.converterVersion` | integer | yes |  |
| `data.latestGoodRun.errorSummary` | string \| null | yes | length 1–500 |
| `data.latestGoodRun.finishedAt` | integer | yes |  |
| `data.latestGoodRun.id` | string (uuid) | yes |  |
| `data.latestGoodRun.pagesHeldBack` | integer | yes |  |
| `data.latestGoodRun.pagesProcessed` | integer | yes |  |
| `data.latestGoodRun.pagesRemoved` | integer | yes |  |
| `data.latestGoodRun.pagesUnchanged` | integer | yes |  |
| `data.latestGoodRun.pullRequestUrl` | string (uri) \| null | yes | at most 2048 characters |
| `data.latestGoodRun.runId` | string | yes | length 1–64; pattern `^[a-zA-Z0-9-]+$` |
| `data.latestGoodRun.source` | "NOTION" | yes |  |
| `data.latestGoodRun.startedAt` | integer | yes |  |
| `data.latestGoodRun.status` | "SUCCEEDED" \| "PARTIAL" \| "BLOCKED" \| "FAILED" | yes |  |
| `data.latestGoodRun.trigger` | "WEBHOOK" \| "SCHEDULE" \| "NIGHTLY" \| "MANUAL" | yes |  |
| `data.latestGoodRun.warnings` | integer | yes |  |
| `data.latestRun` | object \| null | yes |  |
| `data.latestRun.commitSha` | string \| null | yes | length 1–64 |
| `data.latestRun.converterVersion` | integer | yes |  |
| `data.latestRun.errorSummary` | string \| null | yes | length 1–500 |
| `data.latestRun.finishedAt` | integer | yes |  |
| `data.latestRun.id` | string (uuid) | yes |  |
| `data.latestRun.pagesHeldBack` | integer | yes |  |
| `data.latestRun.pagesProcessed` | integer | yes |  |
| `data.latestRun.pagesRemoved` | integer | yes |  |
| `data.latestRun.pagesUnchanged` | integer | yes |  |
| `data.latestRun.pullRequestUrl` | string (uri) \| null | yes | at most 2048 characters |
| `data.latestRun.runId` | string | yes | length 1–64; pattern `^[a-zA-Z0-9-]+$` |
| `data.latestRun.source` | "NOTION" | yes |  |
| `data.latestRun.startedAt` | integer | yes |  |
| `data.latestRun.status` | "SUCCEEDED" \| "PARTIAL" \| "BLOCKED" \| "FAILED" | yes |  |
| `data.latestRun.trigger` | "WEBHOOK" \| "SCHEDULE" \| "NIGHTLY" \| "MANUAL" | yes |  |
| `data.latestRun.warnings` | integer | yes |  |
| `data.reportingConfigured` | boolean | yes |  |
| `data.webhookConfigured` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/docs-publishing/runs

List docs sync runs (newest first)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:DOCS_SYNC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DocsPublishingAdminController_runs` · [source](../../../apps/api/src/contexts/docs-publishing/presentation/http/docs-publishing-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: startedAt. Default: -startedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, trigger, source |

**Response 200 OK** (`application/json`) — Paginated runs; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].commitSha` | string \| null | yes | length 1–64 |
| `data[].converterVersion` | integer | yes |  |
| `data[].errorSummary` | string \| null | yes | length 1–500 |
| `data[].finishedAt` | integer | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].pagesHeldBack` | integer | yes |  |
| `data[].pagesProcessed` | integer | yes |  |
| `data[].pagesRemoved` | integer | yes |  |
| `data[].pagesUnchanged` | integer | yes |  |
| `data[].pullRequestUrl` | string (uri) \| null | yes | at most 2048 characters |
| `data[].runId` | string | yes | length 1–64; pattern `^[a-zA-Z0-9-]+$` |
| `data[].source` | "NOTION" | yes |  |
| `data[].startedAt` | integer | yes |  |
| `data[].status` | "SUCCEEDED" \| "PARTIAL" \| "BLOCKED" \| "FAILED" | yes |  |
| `data[].trigger` | "WEBHOOK" \| "SCHEDULE" \| "NIGHTLY" \| "MANUAL" | yes |  |
| `data[].warnings` | integer | yes |  |
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

### GET /api/v1/admin/docs-publishing/runs/{id}

Get one docs sync run with its held-back pages

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:DOCS_SYNC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DocsPublishingAdminController_run` · [source](../../../apps/api/src/contexts/docs-publishing/presentation/http/docs-publishing-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The run

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.commitSha` | string \| null | yes | length 1–64 |
| `data.converterVersion` | integer | yes |  |
| `data.errorSummary` | string \| null | yes | length 1–500 |
| `data.finishedAt` | integer | yes |  |
| `data.heldBack` | object[] | yes | 0–200 items |
| `data.heldBack[].issues` | object[] | yes | 1–50 items |
| `data.heldBack[].issues[].blockId` | string \| null | yes | length 1–500 |
| `data.heldBack[].issues[].blockType` | string \| null | yes | length 1–500 |
| `data.heldBack[].issues[].fix` | string | yes | length 1–500 |
| `data.heldBack[].issues[].reason` | string | yes | length 1–500 |
| `data.heldBack[].slug` | string \| null | yes | length 1–500 |
| `data.heldBack[].sourceId` | string | yes | length 1–500 |
| `data.heldBack[].sourceUrl` | string (uri) \| null | yes | at most 2048 characters |
| `data.heldBack[].title` | string | yes | length 1–500 |
| `data.id` | string (uuid) | yes |  |
| `data.pagesHeldBack` | integer | yes |  |
| `data.pagesProcessed` | integer | yes |  |
| `data.pagesRemoved` | integer | yes |  |
| `data.pagesUnchanged` | integer | yes |  |
| `data.pullRequestUrl` | string (uri) \| null | yes | at most 2048 characters |
| `data.runId` | string | yes | length 1–64; pattern `^[a-zA-Z0-9-]+$` |
| `data.source` | "NOTION" | yes |  |
| `data.startedAt` | integer | yes |  |
| `data.status` | "SUCCEEDED" \| "PARTIAL" \| "BLOCKED" \| "FAILED" | yes |  |
| `data.trigger` | "WEBHOOK" \| "SCHEDULE" \| "NIGHTLY" \| "MANUAL" | yes |  |
| `data.warnings` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/docs-publishing/sync

Start a docs sync now

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `CREATE:DOCS_SYNC`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `DocsPublishingAdminController_startSync` · [source](../../../apps/api/src/contexts/docs-publishing/presentation/http/docs-publishing-admin.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `full` | boolean | no | default `false` |

**Response 200 OK** (`application/json`) — GitHub accepted the request

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.started` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/docs-publishing/webhook-handshake/reveal

Show the waiting webhook verification token

A POST so that reading a secret is audited.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:DOCS_SYNC`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DocsPublishingAdminController_revealHandshake` · [source](../../../apps/api/src/contexts/docs-publishing/presentation/http/docs-publishing-admin.controller.ts)

**Response 200 OK** (`application/json`) — The token

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.receivedAt` | integer | yes |  |
| `data.source` | "NOTION" | yes |  |
| `data.verificationToken` | string | yes | length 1–500 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/docs-publishing/sync-runs

A docs sync's report (bearer: DOCS_SYNC_REPORT_TOKEN)

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `DocsSyncReportController_report` · [source](../../../apps/api/src/contexts/docs-publishing/presentation/http/docs-sync-report.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `commitSha` | string \| null | yes | length 1–64 |
| `converterVersion` | integer | yes |  |
| `errorSummary` | string \| null | yes | length 1–500 |
| `finishedAt` | integer | yes |  |
| `heldBack` | object[] | yes | 0–200 items |
| `heldBack[].issues` | object[] | yes | 1–50 items |
| `heldBack[].issues[].blockId` | string \| null | yes | length 1–500 |
| `heldBack[].issues[].blockType` | string \| null | yes | length 1–500 |
| `heldBack[].issues[].fix` | string | yes | length 1–500 |
| `heldBack[].issues[].reason` | string | yes | length 1–500 |
| `heldBack[].slug` | string \| null | yes | length 1–500 |
| `heldBack[].sourceId` | string | yes | length 1–500 |
| `heldBack[].sourceUrl` | string (uri) \| null | yes | at most 2048 characters |
| `heldBack[].title` | string | yes | length 1–500 |
| `pagesHeldBack` | integer | yes |  |
| `pagesProcessed` | integer | yes |  |
| `pagesRemoved` | integer | yes |  |
| `pagesUnchanged` | integer | yes |  |
| `pullRequestUrl` | string (uri) \| null | yes | at most 2048 characters |
| `runId` | string | yes | length 1–64; pattern `^[a-zA-Z0-9-]+$` |
| `source` | "NOTION" | yes |  |
| `startedAt` | integer | yes |  |
| `status` | "SUCCEEDED" \| "PARTIAL" \| "BLOCKED" \| "FAILED" | yes |  |
| `trigger` | "WEBHOOK" \| "SCHEDULE" \| "NIGHTLY" \| "MANUAL" | yes |  |
| `warnings` | integer | yes |  |

**Response 200 OK** (`application/json`) — The run was recorded

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.recorded` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/integrations/notion/webhook

Receive a Notion webhook event

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `NotionWebhookController_receive` · [source](../../../apps/api/src/contexts/docs-publishing/presentation/http/notion-webhook.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `X-Notion-Signature` | header | string | no | `sha256=` + HMAC-SHA256 of the raw body with the verification token; not checked on the first handshake, which delivers that token |

**Response 200 OK** (`application/json`) — The event was verified, or the handshake was kept

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.outcome` | "handshake" \| "dispatched" \| "duplicate" \| "ignored" | yes |  |
| `data.received` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
