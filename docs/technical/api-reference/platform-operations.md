---
title: "API reference — Platform operations (servers, backups, load tests)"
description: "The admin panel's operations console (ADR 068): servers and their history, instances, dependencies, alerts, database backups and load tests — and the endpoint a server agent reports to."
order: 15
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Platform operations (servers, backups, load tests)

The admin panel's operations console (ADR 068): servers and their history, instances, dependencies, alerts, database backups and load tests — and the endpoint a server agent reports to.

How these endpoints fit together: [Platform operations console](../operations/platform-operations-console.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Operations

### GET /api/v1/admin/operations/alert-settings

The alert thresholds and the extra recipients

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_alertSettings` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Response 200 OK** (`application/json`) — The settings

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cpuPercent` | integer | yes | range 50–100 |
| `data.cpuSustainMinutes` | integer | yes | range 1–60 |
| `data.diskPercent` | integer | yes | range 50–100 |
| `data.extraRecipients` | string (email)[] | yes | 0–20 items |
| `data.memoryPercent` | integer | yes | range 50–100 |
| `data.silentAfterMinutes` | integer | yes | range 1–60 |
| `data.tlsWarnDays` | integer | yes | range 1–90 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/operations/alert-settings

SuperAdmin: change the alert thresholds and the extra recipients (every SuperAdmin always gets alerts)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_updateAlertSettings` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `cpuPercent` | integer | yes | range 50–100 |
| `cpuSustainMinutes` | integer | yes | range 1–60 |
| `diskPercent` | integer | yes | range 50–100 |
| `extraRecipients` | string (email)[] | yes | 0–20 items |
| `memoryPercent` | integer | yes | range 50–100 |
| `silentAfterMinutes` | integer | yes | range 1–60 |
| `tlsWarnDays` | integer | yes | range 1–90 |

**Response 200 OK** (`application/json`) — The saved settings

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cpuPercent` | integer | yes | range 50–100 |
| `data.cpuSustainMinutes` | integer | yes | range 1–60 |
| `data.diskPercent` | integer | yes | range 50–100 |
| `data.extraRecipients` | string (email)[] | yes | 0–20 items |
| `data.memoryPercent` | integer | yes | range 50–100 |
| `data.silentAfterMinutes` | integer | yes | range 1–60 |
| `data.tlsWarnDays` | integer | yes | range 1–90 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/alerts

Alerts: open (default), resolved, or all — newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_alerts` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `status` | query | "OPEN" \| "RESOLVED" \| "ALL" | no |  |

**Response 200 OK** (`application/json`) — The alerts

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.alerts` | object[] | yes |  |
| `data.alerts[].id` | string (uuid) | yes |  |
| `data.alerts[].lastValue` | number \| null | yes |  |
| `data.alerts[].message` | string | yes |  |
| `data.alerts[].openedAt` | integer | yes |  |
| `data.alerts[].peakValue` | number \| null | yes |  |
| `data.alerts[].resolvedAt` | integer \| null | yes |  |
| `data.alerts[].rule` | "CPU_HIGH" \| "MEMORY_HIGH" \| "DISK_HIGH" \| "SILENT" \| "DEPENDENCY_DOWN" \| "ENDPOINT_DOWN" \| "TLS_EXPIRING" | yes |  |
| `data.alerts[].subjectId` | string | yes |  |
| `data.alerts[].subjectKind` | "SERVER" \| "INSTANCE" \| "DEPENDENCY" \| "ENDPOINT" | yes |  |
| `data.alerts[].subjectName` | string | yes |  |
| `data.alerts[].thresholdValue` | number \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/backups

SuperAdmin: the backups, the schedule and when the next one runs

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `LIST:DATABASE_BACKUP`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsBackupsController_backups` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-backups.controller.ts)

**Response 200 OK** (`application/json`) — The backups

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.backups` | object[] | yes |  |
| `data.backups[].checksum` | string \| null | yes |  |
| `data.backups[].createdAt` | integer | yes |  |
| `data.backups[].error` | string \| null | yes |  |
| `data.backups[].finishedAt` | integer \| null | yes |  |
| `data.backups[].id` | string (uuid) | yes |  |
| `data.backups[].pgDumpVersion` | string \| null | yes |  |
| `data.backups[].pinned` | boolean | yes |  |
| `data.backups[].requestedByName` | string \| null | yes |  |
| `data.backups[].serverVersion` | string \| null | yes |  |
| `data.backups[].sizeBytes` | integer \| null | yes |  |
| `data.backups[].startedAt` | integer \| null | yes |  |
| `data.backups[].status` | "QUEUED" \| "RUNNING" \| "SUCCEEDED" \| "FAILED" | yes |  |
| `data.backups[].trigger` | "MANUAL" \| "SCHEDULED" | yes |  |
| `data.nextScheduledAt` | integer | yes |  |
| `data.schedule` | object | yes |  |
| `data.schedule.backupHour` | integer | yes | range 0–23 |
| `data.schedule.retentionDays` | integer | yes | range 1–365 |
| `data.storageConfigured` | boolean | yes |  |
| `data.timeZone` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/operations/backups

SuperAdmin: back the database up now (one backup at a time)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:DATABASE_BACKUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsBackupsController_create` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-backups.controller.ts)

**Response 201 Created** (`application/json`) — The queued backup

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.checksum` | string \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.error` | string \| null | yes |  |
| `data.finishedAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.pgDumpVersion` | string \| null | yes |  |
| `data.pinned` | boolean | yes |  |
| `data.requestedByName` | string \| null | yes |  |
| `data.serverVersion` | string \| null | yes |  |
| `data.sizeBytes` | integer \| null | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "QUEUED" \| "RUNNING" \| "SUCCEEDED" \| "FAILED" | yes |  |
| `data.trigger` | "MANUAL" \| "SCHEDULED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/admin/operations/backups/{backupId}

SuperAdmin: delete a finished or failed backup and its file

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `DELETE:DATABASE_BACKUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsBackupsController_remove` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-backups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `backupId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Deleted

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

### POST /api/v1/admin/operations/backups/{backupId}/download

SuperAdmin: a one-time, five-minute download link (needs a fresh second-factor proof)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `READ:DATABASE_BACKUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsBackupsController_download` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-backups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `backupId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — The link

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.expiresAt` | integer | yes |  |
| `data.fileName` | string | yes |  |
| `data.url` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/operations/backups/{backupId}/pin

SuperAdmin: keep a backup past the retention (pinned), or let it go

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `UPDATE:DATABASE_BACKUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsBackupsController_pin` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-backups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `backupId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `pinned` | boolean | yes |  |

**Response 200 OK** (`application/json`) — The backup

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.checksum` | string \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.error` | string \| null | yes |  |
| `data.finishedAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.pgDumpVersion` | string \| null | yes |  |
| `data.pinned` | boolean | yes |  |
| `data.requestedByName` | string \| null | yes |  |
| `data.serverVersion` | string \| null | yes |  |
| `data.sizeBytes` | integer \| null | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "QUEUED" \| "RUNNING" \| "SUCCEEDED" \| "FAILED" | yes |  |
| `data.trigger` | "MANUAL" \| "SCHEDULED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/operations/backups/schedule

SuperAdmin: when the daily backup runs (platform time zone) and how long backups are kept

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:DATABASE_BACKUP`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsBackupsController_schedule` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-backups.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupHour` | integer | yes | range 0–23 |
| `retentionDays` | integer | yes | range 1–365 |

**Response 200 OK** (`application/json`) — The saved schedule

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.backupHour` | integer | yes | range 0–23 |
| `data.retentionDays` | integer | yes | range 1–365 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/dependencies

The latest check of every dependency (PostgreSQL, Redis, queues, Kafka, RabbitMQ, public endpoints)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_dependencies` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Response 200 OK** (`application/json`) — The dependencies

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.dependencies` | object[] | yes |  |
| `data.dependencies[].checkedAt` | integer | yes |  |
| `data.dependencies[].configured` | boolean | yes |  |
| `data.dependencies[].dependency` | "POSTGRES" \| "REDIS" \| "QUEUES" \| "KAFKA" \| "RABBITMQ" \| "ENDPOINTS" | yes |  |
| `data.dependencies[].error` | string \| null | yes |  |
| `data.dependencies[].health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.dependencies[].latencyMs` | number \| null | yes | range 0–∞ |
| `data.dependencies[].stats` | object \| null | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ cacheHitPercent` | number \| null | yes | range 0–100 |
| `data.dependencies[].stats.⟨shape 1⟩ connectionsMax` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ connectionsUsed` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ deadlocks` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ dependency` | "POSTGRES" | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ growthBytesPerDay` | number \| null | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ largestTables` | object[] | yes | 0–5 items |
| `data.dependencies[].stats.⟨shape 1⟩ largestTables[].bytes` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ largestTables[].name` | string | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ longestQuerySeconds` | number \| null | yes | range 0–∞ |
| `data.dependencies[].stats.⟨shape 1⟩ sizeBytes` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ slowQueries` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ connectedClients` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ dependency` | "REDIS" | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ evictedKeys` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ hitRatePercent` | number \| null | yes | range 0–100 |
| `data.dependencies[].stats.⟨shape 2⟩ maxMemoryBytes` | integer \| null | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ opsPerSecond` | number | yes | range 0–∞ |
| `data.dependencies[].stats.⟨shape 2⟩ usedMemoryBytes` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ dependency` | "QUEUES" | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues` | object[] | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].active` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].delayed` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].failed` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].name` | string | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].waiting` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 4⟩ brokers` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 4⟩ consumerLag` | integer \| null | yes |  |
| `data.dependencies[].stats.⟨shape 4⟩ dependency` | "KAFKA" | yes |  |
| `data.dependencies[].stats.⟨shape 5⟩ connected` | boolean | yes |  |
| `data.dependencies[].stats.⟨shape 5⟩ dependency` | "RABBITMQ" | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ dependency` | "ENDPOINTS" | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints` | object[] | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].latencyMs` | number \| null | yes | range 0–∞ |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].status` | integer \| null | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].tlsDaysLeft` | integer \| null | yes | min -9007199254740991 |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].up` | boolean | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].url` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/dependencies/{dependency}/history

One dependency's history over a range

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_dependencyHistory` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `dependency` | path | "POSTGRES" \| "REDIS" \| "QUEUES" \| "KAFKA" \| "RABBITMQ" \| "ENDPOINTS" | yes |  |
| `range` | query | "1h" \| "6h" \| "24h" \| "7d" \| "30d" \| "1y" | no |  |

**Response 200 OK** (`application/json`) — The history

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.from` | integer | yes |  |
| `data.points` | object[] | yes |  |
| `data.points[].backlog` | integer \| null | yes |  |
| `data.points[].bucketStart` | integer | yes |  |
| `data.points[].connectionsUsed` | integer \| null | yes |  |
| `data.points[].failed` | integer \| null | yes |  |
| `data.points[].latencyMsAvg` | number \| null | yes | range 0–∞ |
| `data.points[].memoryUsedBytes` | integer \| null | yes |  |
| `data.points[].sizeBytes` | integer \| null | yes |  |
| `data.points[].upPercent` | number | yes | range 0–100 |
| `data.range` | "1h" \| "6h" \| "24h" \| "7d" \| "30d" \| "1y" | yes |  |
| `data.resolution` | "MINUTE" \| "HOUR" | yes |  |
| `data.to` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/instances

Every instance's latest heartbeat (API and analytics-consumer processes)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_instances` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Response 200 OK** (`application/json`) — The instances

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.instances` | object[] | yes |  |
| `data.instances[].activeHandles` | integer | yes |  |
| `data.instances[].clientErrorsPerMinute` | integer | yes |  |
| `data.instances[].cpuPercent` | number | yes | range 0–∞ |
| `data.instances[].dbPoolInUse` | integer \| null | yes |  |
| `data.instances[].dbPoolWaiting` | integer \| null | yes |  |
| `data.instances[].eventLoopLagP99Ms` | number | yes | range 0–∞ |
| `data.instances[].gcPauseMs` | number | yes | range 0–∞ |
| `data.instances[].health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.instances[].heapTotalBytes` | integer | yes |  |
| `data.instances[].heapUsedBytes` | integer | yes |  |
| `data.instances[].hostname` | string | yes |  |
| `data.instances[].instanceId` | string | yes |  |
| `data.instances[].latencyP50Ms` | number \| null | yes | range 0–∞ |
| `data.instances[].latencyP95Ms` | number \| null | yes | range 0–∞ |
| `data.instances[].latencyP99Ms` | number \| null | yes | range 0–∞ |
| `data.instances[].pid` | integer | yes |  |
| `data.instances[].requestsPerMinute` | integer | yes |  |
| `data.instances[].rssBytes` | integer | yes |  |
| `data.instances[].sampledAt` | integer | yes |  |
| `data.instances[].serverErrorsPerMinute` | integer | yes |  |
| `data.instances[].service` | "api" \| "analytics-consumer" | yes |  |
| `data.instances[].slowestEndpoints` | object[] | yes | 0–10 items |
| `data.instances[].slowestEndpoints[].count` | integer | yes |  |
| `data.instances[].slowestEndpoints[].endpoint` | string | yes |  |
| `data.instances[].slowestEndpoints[].p95Ms` | number | yes | range 0–∞ |
| `data.instances[].startedAt` | integer | yes |  |
| `data.instances[].version` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/instances/{instanceId}/history

One instance's history over a range

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_instanceHistory` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `instanceId` | path | string | yes |  |
| `range` | query | "1h" \| "6h" \| "24h" \| "7d" \| "30d" \| "1y" | no |  |

**Response 200 OK** (`application/json`) — The history

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.from` | integer | yes |  |
| `data.points` | object[] | yes |  |
| `data.points[].bucketStart` | integer | yes |  |
| `data.points[].clientErrorCount` | integer | yes |  |
| `data.points[].cpuPercentAvg` | number | yes | range 0–∞ |
| `data.points[].cpuPercentMax` | number | yes | range 0–∞ |
| `data.points[].eventLoopLagP99Ms` | number | yes | range 0–∞ |
| `data.points[].gcPauseMs` | number | yes | range 0–∞ |
| `data.points[].heapUsedBytes` | integer | yes |  |
| `data.points[].latencyP50Ms` | number \| null | yes | range 0–∞ |
| `data.points[].latencyP95Ms` | number \| null | yes | range 0–∞ |
| `data.points[].latencyP99Ms` | number \| null | yes | range 0–∞ |
| `data.points[].requestCount` | integer | yes |  |
| `data.points[].rssBytes` | integer | yes |  |
| `data.points[].serverErrorCount` | integer | yes |  |
| `data.range` | "1h" \| "6h" \| "24h" \| "7d" \| "30d" \| "1y" | yes |  |
| `data.resolution` | "MINUTE" \| "HOUR" | yes |  |
| `data.to` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/load-tests

Whether load tests can run here, the caps, the endpoints and the runs

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:LOAD_TEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsLoadTestsController_overview` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-load-tests.controller.ts)

**Response 200 OK** (`application/json`) — The load tests

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.caps` | object | yes |  |
| `data.caps.maxMinutes` | integer | yes | range 1–120 |
| `data.caps.maxRequestsPerSecond` | integer | yes | range 1–5000 |
| `data.caps.maxSoakMinutes` | integer | yes | range 1–720 |
| `data.caps.maxVirtualUsers` | integer | yes | range 1–2000 |
| `data.disabledReason` | string \| null | yes |  |
| `data.enabled` | boolean | yes |  |
| `data.endpoints` | string[] | yes |  |
| `data.loadTestUsers` | integer | yes |  |
| `data.runs` | object[] | yes |  |
| `data.runs[].abortReason` | string \| null | yes |  |
| `data.runs[].createdAt` | integer | yes |  |
| `data.runs[].durationSeconds` | integer | yes |  |
| `data.runs[].endpoint` | string \| null | yes |  |
| `data.runs[].error` | string \| null | yes |  |
| `data.runs[].failedRequests` | integer \| null | yes |  |
| `data.runs[].finishedAt` | integer \| null | yes |  |
| `data.runs[].id` | string (uuid) | yes |  |
| `data.runs[].mixWeights` | object \| null | yes |  |
| `data.runs[].name` | string | yes |  |
| `data.runs[].p50Ms` | number \| null | yes | range 0–∞ |
| `data.runs[].p95Ms` | number \| null | yes | range 0–∞ |
| `data.runs[].p99Ms` | number \| null | yes | range 0–∞ |
| `data.runs[].peakRps` | number \| null | yes | range 0–∞ |
| `data.runs[].requestedByName` | string | yes |  |
| `data.runs[].requestsPerSecond` | integer | yes |  |
| `data.runs[].scenario` | "sign-in" \| "browse-marketplace" \| "claim-reward" \| "merchant-dashboard" \| "merchant-rewards" \| null | yes |  |
| `data.runs[].shape` | "CONSTANT" \| "RAMP" \| "SPIKE" \| "SOAK" | yes |  |
| `data.runs[].startedAt` | integer \| null | yes |  |
| `data.runs[].status` | "QUEUED" \| "RUNNING" \| "PASSED" \| "FAILED" \| "ABORTED" \| "ERROR" | yes |  |
| `data.runs[].target` | "SCENARIO" \| "MIX" \| "ENDPOINT" | yes |  |
| `data.runs[].thresholdErrorPercent` | number | yes | range 0–∞ |
| `data.runs[].thresholdP95Ms` | integer | yes |  |
| `data.runs[].totalRequests` | integer \| null | yes |  |
| `data.runs[].virtualUsers` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/operations/load-tests

Start a load test (one at a time, within the caps, inside the Load Test tenant)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `CREATE:LOAD_TEST`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsLoadTestsController_start` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-load-tests.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `durationSeconds` | integer | yes | range 10–43200 |
| `endpoint` | string \| null | yes | at most 300 characters; pattern `^\/` |
| `mixWeights` | object \| null | yes |  |
| `name` | string | yes | length 1–100 |
| `requestsPerSecond` | integer | yes | range 1–5000 |
| `scenario` | "sign-in" \| "browse-marketplace" \| "claim-reward" \| "merchant-dashboard" \| "merchant-rewards" \| null | yes |  |
| `shape` | "CONSTANT" \| "RAMP" \| "SPIKE" \| "SOAK" | yes |  |
| `target` | "SCENARIO" \| "MIX" \| "ENDPOINT" | yes |  |
| `thresholdErrorPercent` | number | yes | range 0–100 |
| `thresholdP95Ms` | integer | yes | range 1–60000 |
| `virtualUsers` | integer | yes | range 1–2000 |

**Response 201 Created** (`application/json`) — The queued run

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.abortReason` | string \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.durationSeconds` | integer | yes |  |
| `data.endpoint` | string \| null | yes |  |
| `data.error` | string \| null | yes |  |
| `data.failedRequests` | integer \| null | yes |  |
| `data.finishedAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.mixWeights` | object \| null | yes |  |
| `data.name` | string | yes |  |
| `data.p50Ms` | number \| null | yes | range 0–∞ |
| `data.p95Ms` | number \| null | yes | range 0–∞ |
| `data.p99Ms` | number \| null | yes | range 0–∞ |
| `data.peakRps` | number \| null | yes | range 0–∞ |
| `data.requestedByName` | string | yes |  |
| `data.requestsPerSecond` | integer | yes |  |
| `data.scenario` | "sign-in" \| "browse-marketplace" \| "claim-reward" \| "merchant-dashboard" \| "merchant-rewards" \| null | yes |  |
| `data.shape` | "CONSTANT" \| "RAMP" \| "SPIKE" \| "SOAK" | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "QUEUED" \| "RUNNING" \| "PASSED" \| "FAILED" \| "ABORTED" \| "ERROR" | yes |  |
| `data.target` | "SCENARIO" \| "MIX" \| "ENDPOINT" | yes |  |
| `data.thresholdErrorPercent` | number | yes | range 0–∞ |
| `data.thresholdP95Ms` | integer | yes |  |
| `data.totalRequests` | integer \| null | yes |  |
| `data.virtualUsers` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/load-tests/{runId}

One load test: its seconds, its steps and the servers' load over the same time

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:LOAD_TEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsLoadTestsController_run` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-load-tests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `runId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The run

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.points` | object[] | yes |  |
| `data.points[].at` | integer | yes |  |
| `data.points[].failures` | integer | yes |  |
| `data.points[].p50Ms` | number \| null | yes | range 0–∞ |
| `data.points[].p95Ms` | number \| null | yes | range 0–∞ |
| `data.points[].p99Ms` | number \| null | yes | range 0–∞ |
| `data.points[].requests` | integer | yes |  |
| `data.points[].second` | integer | yes |  |
| `data.points[].virtualUsers` | integer | yes |  |
| `data.run` | object | yes |  |
| `data.run.abortReason` | string \| null | yes |  |
| `data.run.createdAt` | integer | yes |  |
| `data.run.durationSeconds` | integer | yes |  |
| `data.run.endpoint` | string \| null | yes |  |
| `data.run.error` | string \| null | yes |  |
| `data.run.failedRequests` | integer \| null | yes |  |
| `data.run.finishedAt` | integer \| null | yes |  |
| `data.run.id` | string (uuid) | yes |  |
| `data.run.mixWeights` | object \| null | yes |  |
| `data.run.name` | string | yes |  |
| `data.run.p50Ms` | number \| null | yes | range 0–∞ |
| `data.run.p95Ms` | number \| null | yes | range 0–∞ |
| `data.run.p99Ms` | number \| null | yes | range 0–∞ |
| `data.run.peakRps` | number \| null | yes | range 0–∞ |
| `data.run.requestedByName` | string | yes |  |
| `data.run.requestsPerSecond` | integer | yes |  |
| `data.run.scenario` | "sign-in" \| "browse-marketplace" \| "claim-reward" \| "merchant-dashboard" \| "merchant-rewards" \| null | yes |  |
| `data.run.shape` | "CONSTANT" \| "RAMP" \| "SPIKE" \| "SOAK" | yes |  |
| `data.run.startedAt` | integer \| null | yes |  |
| `data.run.status` | "QUEUED" \| "RUNNING" \| "PASSED" \| "FAILED" \| "ABORTED" \| "ERROR" | yes |  |
| `data.run.target` | "SCENARIO" \| "MIX" \| "ENDPOINT" | yes |  |
| `data.run.thresholdErrorPercent` | number | yes | range 0–∞ |
| `data.run.thresholdP95Ms` | integer | yes |  |
| `data.run.totalRequests` | integer \| null | yes |  |
| `data.run.virtualUsers` | integer | yes |  |
| `data.servers` | object[] | yes |  |
| `data.servers[].name` | string | yes |  |
| `data.servers[].points` | object[] | yes |  |
| `data.servers[].points[].at` | integer | yes |  |
| `data.servers[].points[].cpuPercent` | number | yes | range 0–100 |
| `data.servers[].points[].memoryPercent` | number | yes | range 0–100 |
| `data.servers[].serverId` | string (uuid) | yes |  |
| `data.steps` | object[] | yes |  |
| `data.steps[].failures` | integer | yes |  |
| `data.steps[].p50Ms` | number \| null | yes | range 0–∞ |
| `data.steps[].p95Ms` | number \| null | yes | range 0–∞ |
| `data.steps[].p99Ms` | number \| null | yes | range 0–∞ |
| `data.steps[].requests` | integer | yes |  |
| `data.steps[].step` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/operations/load-tests/{runId}/abort

Abort a queued or running load test

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:LOAD_TEST`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsLoadTestsController_abort` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-load-tests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `runId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — The run

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.abortReason` | string \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.durationSeconds` | integer | yes |  |
| `data.endpoint` | string \| null | yes |  |
| `data.error` | string \| null | yes |  |
| `data.failedRequests` | integer \| null | yes |  |
| `data.finishedAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.mixWeights` | object \| null | yes |  |
| `data.name` | string | yes |  |
| `data.p50Ms` | number \| null | yes | range 0–∞ |
| `data.p95Ms` | number \| null | yes | range 0–∞ |
| `data.p99Ms` | number \| null | yes | range 0–∞ |
| `data.peakRps` | number \| null | yes | range 0–∞ |
| `data.requestedByName` | string | yes |  |
| `data.requestsPerSecond` | integer | yes |  |
| `data.scenario` | "sign-in" \| "browse-marketplace" \| "claim-reward" \| "merchant-dashboard" \| "merchant-rewards" \| null | yes |  |
| `data.shape` | "CONSTANT" \| "RAMP" \| "SPIKE" \| "SOAK" | yes |  |
| `data.startedAt` | integer \| null | yes |  |
| `data.status` | "QUEUED" \| "RUNNING" \| "PASSED" \| "FAILED" \| "ABORTED" \| "ERROR" | yes |  |
| `data.target` | "SCENARIO" \| "MIX" \| "ENDPOINT" | yes |  |
| `data.thresholdErrorPercent` | number | yes | range 0–∞ |
| `data.thresholdP95Ms` | integer | yes |  |
| `data.totalRequests` | integer \| null | yes |  |
| `data.virtualUsers` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/operations/load-tests/caps

SuperAdmin: the load-test caps (virtual users, requests per second, minutes)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsLoadTestsController_caps` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-load-tests.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `maxMinutes` | integer | yes | range 1–120 |
| `maxRequestsPerSecond` | integer | yes | range 1–5000 |
| `maxSoakMinutes` | integer | yes | range 1–720 |
| `maxVirtualUsers` | integer | yes | range 1–2000 |

**Response 200 OK** (`application/json`) — The saved caps

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.maxMinutes` | integer | yes | range 1–120 |
| `data.maxRequestsPerSecond` | integer | yes | range 1–5000 |
| `data.maxSoakMinutes` | integer | yes | range 1–720 |
| `data.maxVirtualUsers` | integer | yes | range 1–2000 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/admin/operations/load-tests/data

SuperAdmin: permanently delete what load tests created in the Load Test tenant (ADR 068, exception 2)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `DELETE:LOAD_TEST`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsLoadTestsController_purge` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-load-tests.controller.ts)

**Response 200 OK** (`application/json`) — What was deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.deletedRows` | integer | yes |  |
| `data.tables` | object[] | yes |  |
| `data.tables[].rows` | integer | yes |  |
| `data.tables[].table` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/overview

Every server, instance and dependency with its live numbers, and the open alerts

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_overview` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Response 200 OK** (`application/json`) — The overview

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cloudProviders` | "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER"[] | yes |  |
| `data.dependencies` | object[] | yes |  |
| `data.dependencies[].checkedAt` | integer | yes |  |
| `data.dependencies[].configured` | boolean | yes |  |
| `data.dependencies[].dependency` | "POSTGRES" \| "REDIS" \| "QUEUES" \| "KAFKA" \| "RABBITMQ" \| "ENDPOINTS" | yes |  |
| `data.dependencies[].error` | string \| null | yes |  |
| `data.dependencies[].health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.dependencies[].latencyMs` | number \| null | yes | range 0–∞ |
| `data.dependencies[].stats` | object \| null | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ cacheHitPercent` | number \| null | yes | range 0–100 |
| `data.dependencies[].stats.⟨shape 1⟩ connectionsMax` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ connectionsUsed` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ deadlocks` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ dependency` | "POSTGRES" | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ growthBytesPerDay` | number \| null | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ largestTables` | object[] | yes | 0–5 items |
| `data.dependencies[].stats.⟨shape 1⟩ largestTables[].bytes` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ largestTables[].name` | string | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ longestQuerySeconds` | number \| null | yes | range 0–∞ |
| `data.dependencies[].stats.⟨shape 1⟩ sizeBytes` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 1⟩ slowQueries` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ connectedClients` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ dependency` | "REDIS" | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ evictedKeys` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ hitRatePercent` | number \| null | yes | range 0–100 |
| `data.dependencies[].stats.⟨shape 2⟩ maxMemoryBytes` | integer \| null | yes |  |
| `data.dependencies[].stats.⟨shape 2⟩ opsPerSecond` | number | yes | range 0–∞ |
| `data.dependencies[].stats.⟨shape 2⟩ usedMemoryBytes` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ dependency` | "QUEUES" | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues` | object[] | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].active` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].delayed` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].failed` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].name` | string | yes |  |
| `data.dependencies[].stats.⟨shape 3⟩ queues[].waiting` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 4⟩ brokers` | integer | yes |  |
| `data.dependencies[].stats.⟨shape 4⟩ consumerLag` | integer \| null | yes |  |
| `data.dependencies[].stats.⟨shape 4⟩ dependency` | "KAFKA" | yes |  |
| `data.dependencies[].stats.⟨shape 5⟩ connected` | boolean | yes |  |
| `data.dependencies[].stats.⟨shape 5⟩ dependency` | "RABBITMQ" | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ dependency` | "ENDPOINTS" | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints` | object[] | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].latencyMs` | number \| null | yes | range 0–∞ |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].status` | integer \| null | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].tlsDaysLeft` | integer \| null | yes | min -9007199254740991 |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].up` | boolean | yes |  |
| `data.dependencies[].stats.⟨shape 6⟩ endpoints[].url` | string | yes |  |
| `data.instances` | object[] | yes |  |
| `data.instances[].activeHandles` | integer | yes |  |
| `data.instances[].clientErrorsPerMinute` | integer | yes |  |
| `data.instances[].cpuPercent` | number | yes | range 0–∞ |
| `data.instances[].dbPoolInUse` | integer \| null | yes |  |
| `data.instances[].dbPoolWaiting` | integer \| null | yes |  |
| `data.instances[].eventLoopLagP99Ms` | number | yes | range 0–∞ |
| `data.instances[].gcPauseMs` | number | yes | range 0–∞ |
| `data.instances[].health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.instances[].heapTotalBytes` | integer | yes |  |
| `data.instances[].heapUsedBytes` | integer | yes |  |
| `data.instances[].hostname` | string | yes |  |
| `data.instances[].instanceId` | string | yes |  |
| `data.instances[].latencyP50Ms` | number \| null | yes | range 0–∞ |
| `data.instances[].latencyP95Ms` | number \| null | yes | range 0–∞ |
| `data.instances[].latencyP99Ms` | number \| null | yes | range 0–∞ |
| `data.instances[].pid` | integer | yes |  |
| `data.instances[].requestsPerMinute` | integer | yes |  |
| `data.instances[].rssBytes` | integer | yes |  |
| `data.instances[].sampledAt` | integer | yes |  |
| `data.instances[].serverErrorsPerMinute` | integer | yes |  |
| `data.instances[].service` | "api" \| "analytics-consumer" | yes |  |
| `data.instances[].slowestEndpoints` | object[] | yes | 0–10 items |
| `data.instances[].slowestEndpoints[].count` | integer | yes |  |
| `data.instances[].slowestEndpoints[].endpoint` | string | yes |  |
| `data.instances[].slowestEndpoints[].p95Ms` | number | yes | range 0–∞ |
| `data.instances[].startedAt` | integer | yes |  |
| `data.instances[].version` | string | yes |  |
| `data.openAlerts` | object[] | yes |  |
| `data.openAlerts[].id` | string (uuid) | yes |  |
| `data.openAlerts[].lastValue` | number \| null | yes |  |
| `data.openAlerts[].message` | string | yes |  |
| `data.openAlerts[].openedAt` | integer | yes |  |
| `data.openAlerts[].peakValue` | number \| null | yes |  |
| `data.openAlerts[].resolvedAt` | integer \| null | yes |  |
| `data.openAlerts[].rule` | "CPU_HIGH" \| "MEMORY_HIGH" \| "DISK_HIGH" \| "SILENT" \| "DEPENDENCY_DOWN" \| "ENDPOINT_DOWN" \| "TLS_EXPIRING" | yes |  |
| `data.openAlerts[].subjectId` | string | yes |  |
| `data.openAlerts[].subjectKind` | "SERVER" \| "INSTANCE" \| "DEPENDENCY" \| "ENDPOINT" | yes |  |
| `data.openAlerts[].subjectName` | string | yes |  |
| `data.openAlerts[].thresholdValue` | number \| null | yes |  |
| `data.servers` | object[] | yes |  |
| `data.servers[].cpuCores` | integer \| null | yes |  |
| `data.servers[].cpuModel` | string \| null | yes |  |
| `data.servers[].health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.servers[].hostname` | string \| null | yes |  |
| `data.servers[].id` | string (uuid) | yes |  |
| `data.servers[].lastSeenAt` | integer \| null | yes |  |
| `data.servers[].live` | object \| null | yes |  |
| `data.servers[].live.cpuPercent` | number | yes | range 0–100 |
| `data.servers[].live.diskReadBytesPerSec` | number | yes | range 0–∞ |
| `data.servers[].live.diskReadIops` | number \| null | yes | range 0–∞ |
| `data.servers[].live.diskWriteBytesPerSec` | number | yes | range 0–∞ |
| `data.servers[].live.diskWriteIops` | number \| null | yes | range 0–∞ |
| `data.servers[].live.disks` | object[] | yes | 0–32 items |
| `data.servers[].live.disks[].inodesPercent` | number \| null | yes | range 0–100 |
| `data.servers[].live.disks[].mount` | string | yes | length 1–200 |
| `data.servers[].live.disks[].totalBytes` | integer | yes |  |
| `data.servers[].live.disks[].usedBytes` | integer | yes |  |
| `data.servers[].live.iowaitPercent` | number \| null | yes | range 0–100 |
| `data.servers[].live.load1` | number | yes | range 0–∞ |
| `data.servers[].live.load15` | number | yes | range 0–∞ |
| `data.servers[].live.load5` | number | yes | range 0–∞ |
| `data.servers[].live.memoryTotalBytes` | integer | yes |  |
| `data.servers[].live.memoryUsedBytes` | integer | yes |  |
| `data.servers[].live.netRxBytesPerSec` | number | yes | range 0–∞ |
| `data.servers[].live.netTxBytesPerSec` | number | yes | range 0–∞ |
| `data.servers[].live.openFiles` | integer \| null | yes |  |
| `data.servers[].live.perCorePercent` | number[] | yes | 0–512 items |
| `data.servers[].live.processCount` | integer | yes |  |
| `data.servers[].live.sampledAt` | integer | yes |  |
| `data.servers[].live.stealPercent` | number \| null | yes | range 0–100 |
| `data.servers[].live.swapTotalBytes` | integer | yes |  |
| `data.servers[].live.swapUsedBytes` | integer | yes |  |
| `data.servers[].live.tcpConnections` | integer | yes |  |
| `data.servers[].live.topProcesses` | object[] | yes | 0–5 items |
| `data.servers[].live.topProcesses[].cpuPercent` | number | yes | range 0–∞ |
| `data.servers[].live.topProcesses[].memoryBytes` | integer | yes |  |
| `data.servers[].live.topProcesses[].name` | string | yes | length 1–120 |
| `data.servers[].live.topProcesses[].pid` | integer | yes |  |
| `data.servers[].memoryTotalBytes` | integer \| null | yes |  |
| `data.servers[].name` | string | yes |  |
| `data.servers[].openAlerts` | integer | yes |  |
| `data.servers[].os` | string \| null | yes |  |
| `data.servers[].provider` | "LOCAL" \| "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" \| "OTHER" | yes |  |
| `data.servers[].providerServerId` | string \| null | yes |  |
| `data.servers[].uptimeSeconds` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/servers

Every registered server with its latest sample

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_servers` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Response 200 OK** (`application/json`) — The servers

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.servers` | object[] | yes |  |
| `data.servers[].cpuCores` | integer \| null | yes |  |
| `data.servers[].cpuModel` | string \| null | yes |  |
| `data.servers[].health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.servers[].hostname` | string \| null | yes |  |
| `data.servers[].id` | string (uuid) | yes |  |
| `data.servers[].lastSeenAt` | integer \| null | yes |  |
| `data.servers[].live` | object \| null | yes |  |
| `data.servers[].live.cpuPercent` | number | yes | range 0–100 |
| `data.servers[].live.diskReadBytesPerSec` | number | yes | range 0–∞ |
| `data.servers[].live.diskReadIops` | number \| null | yes | range 0–∞ |
| `data.servers[].live.diskWriteBytesPerSec` | number | yes | range 0–∞ |
| `data.servers[].live.diskWriteIops` | number \| null | yes | range 0–∞ |
| `data.servers[].live.disks` | object[] | yes | 0–32 items |
| `data.servers[].live.disks[].inodesPercent` | number \| null | yes | range 0–100 |
| `data.servers[].live.disks[].mount` | string | yes | length 1–200 |
| `data.servers[].live.disks[].totalBytes` | integer | yes |  |
| `data.servers[].live.disks[].usedBytes` | integer | yes |  |
| `data.servers[].live.iowaitPercent` | number \| null | yes | range 0–100 |
| `data.servers[].live.load1` | number | yes | range 0–∞ |
| `data.servers[].live.load15` | number | yes | range 0–∞ |
| `data.servers[].live.load5` | number | yes | range 0–∞ |
| `data.servers[].live.memoryTotalBytes` | integer | yes |  |
| `data.servers[].live.memoryUsedBytes` | integer | yes |  |
| `data.servers[].live.netRxBytesPerSec` | number | yes | range 0–∞ |
| `data.servers[].live.netTxBytesPerSec` | number | yes | range 0–∞ |
| `data.servers[].live.openFiles` | integer \| null | yes |  |
| `data.servers[].live.perCorePercent` | number[] | yes | 0–512 items |
| `data.servers[].live.processCount` | integer | yes |  |
| `data.servers[].live.sampledAt` | integer | yes |  |
| `data.servers[].live.stealPercent` | number \| null | yes | range 0–100 |
| `data.servers[].live.swapTotalBytes` | integer | yes |  |
| `data.servers[].live.swapUsedBytes` | integer | yes |  |
| `data.servers[].live.tcpConnections` | integer | yes |  |
| `data.servers[].live.topProcesses` | object[] | yes | 0–5 items |
| `data.servers[].live.topProcesses[].cpuPercent` | number | yes | range 0–∞ |
| `data.servers[].live.topProcesses[].memoryBytes` | integer | yes |  |
| `data.servers[].live.topProcesses[].name` | string | yes | length 1–120 |
| `data.servers[].live.topProcesses[].pid` | integer | yes |  |
| `data.servers[].memoryTotalBytes` | integer \| null | yes |  |
| `data.servers[].name` | string | yes |  |
| `data.servers[].openAlerts` | integer | yes |  |
| `data.servers[].os` | string \| null | yes |  |
| `data.servers[].provider` | "LOCAL" \| "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" \| "OTHER" | yes |  |
| `data.servers[].providerServerId` | string \| null | yes |  |
| `data.servers[].uptimeSeconds` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/operations/servers

SuperAdmin: register a server and issue its agent token (shown once)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_register` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | length 1–100 |
| `provider` | "LOCAL" \| "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" \| "OTHER" | yes |  |
| `providerServerId` | string \| null | yes | at most 64 characters; pattern `^[A-Za-z0-9-]+$` |

**Response 201 Created** (`application/json`) — The server, its agent token and the command that starts the agent

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.agentToken` | string | yes |  |
| `data.installCommand` | string | yes |  |
| `data.server` | object | yes |  |
| `data.server.agentVersion` | string \| null | yes |  |
| `data.server.cloud` | object \| null | yes |  |
| `data.server.cloud.createdAt` | integer \| null | yes |  |
| `data.server.cloud.diskGb` | integer | yes |  |
| `data.server.cloud.memoryMb` | integer | yes |  |
| `data.server.cloud.name` | string | yes |  |
| `data.server.cloud.plan` | string | yes |  |
| `data.server.cloud.provider` | "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" | yes |  |
| `data.server.cloud.publicIpv4` | string \| null | yes |  |
| `data.server.cloud.region` | string | yes |  |
| `data.server.cloud.running` | boolean | yes |  |
| `data.server.cloud.status` | string | yes |  |
| `data.server.cloud.vcpus` | integer | yes |  |
| `data.server.cloudError` | string \| null | yes |  |
| `data.server.cpuCores` | integer \| null | yes |  |
| `data.server.cpuModel` | string \| null | yes |  |
| `data.server.health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.server.hostname` | string \| null | yes |  |
| `data.server.id` | string (uuid) | yes |  |
| `data.server.kernel` | string \| null | yes |  |
| `data.server.lastSeenAt` | integer \| null | yes |  |
| `data.server.live` | object \| null | yes |  |
| `data.server.live.cpuPercent` | number | yes | range 0–100 |
| `data.server.live.diskReadBytesPerSec` | number | yes | range 0–∞ |
| `data.server.live.diskReadIops` | number \| null | yes | range 0–∞ |
| `data.server.live.diskWriteBytesPerSec` | number | yes | range 0–∞ |
| `data.server.live.diskWriteIops` | number \| null | yes | range 0–∞ |
| `data.server.live.disks` | object[] | yes | 0–32 items |
| `data.server.live.disks[].inodesPercent` | number \| null | yes | range 0–100 |
| `data.server.live.disks[].mount` | string | yes | length 1–200 |
| `data.server.live.disks[].totalBytes` | integer | yes |  |
| `data.server.live.disks[].usedBytes` | integer | yes |  |
| `data.server.live.iowaitPercent` | number \| null | yes | range 0–100 |
| `data.server.live.load1` | number | yes | range 0–∞ |
| `data.server.live.load15` | number | yes | range 0–∞ |
| `data.server.live.load5` | number | yes | range 0–∞ |
| `data.server.live.memoryTotalBytes` | integer | yes |  |
| `data.server.live.memoryUsedBytes` | integer | yes |  |
| `data.server.live.netRxBytesPerSec` | number | yes | range 0–∞ |
| `data.server.live.netTxBytesPerSec` | number | yes | range 0–∞ |
| `data.server.live.openFiles` | integer \| null | yes |  |
| `data.server.live.perCorePercent` | number[] | yes | 0–512 items |
| `data.server.live.processCount` | integer | yes |  |
| `data.server.live.sampledAt` | integer | yes |  |
| `data.server.live.stealPercent` | number \| null | yes | range 0–100 |
| `data.server.live.swapTotalBytes` | integer | yes |  |
| `data.server.live.swapUsedBytes` | integer | yes |  |
| `data.server.live.tcpConnections` | integer | yes |  |
| `data.server.live.topProcesses` | object[] | yes | 0–5 items |
| `data.server.live.topProcesses[].cpuPercent` | number | yes | range 0–∞ |
| `data.server.live.topProcesses[].memoryBytes` | integer | yes |  |
| `data.server.live.topProcesses[].name` | string | yes | length 1–120 |
| `data.server.live.topProcesses[].pid` | integer | yes |  |
| `data.server.memoryTotalBytes` | integer \| null | yes |  |
| `data.server.name` | string | yes |  |
| `data.server.openAlerts` | integer | yes |  |
| `data.server.os` | string \| null | yes |  |
| `data.server.provider` | "LOCAL" \| "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" \| "OTHER" | yes |  |
| `data.server.providerServerId` | string \| null | yes |  |
| `data.server.registeredAt` | integer | yes |  |
| `data.server.tokenPrefix` | string | yes |  |
| `data.server.uptimeSeconds` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/operations/servers/{serverId}

One server: its host facts, live sample and its cloud provider's view

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_server` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `serverId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The server

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.agentVersion` | string \| null | yes |  |
| `data.cloud` | object \| null | yes |  |
| `data.cloud.createdAt` | integer \| null | yes |  |
| `data.cloud.diskGb` | integer | yes |  |
| `data.cloud.memoryMb` | integer | yes |  |
| `data.cloud.name` | string | yes |  |
| `data.cloud.plan` | string | yes |  |
| `data.cloud.provider` | "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" | yes |  |
| `data.cloud.publicIpv4` | string \| null | yes |  |
| `data.cloud.region` | string | yes |  |
| `data.cloud.running` | boolean | yes |  |
| `data.cloud.status` | string | yes |  |
| `data.cloud.vcpus` | integer | yes |  |
| `data.cloudError` | string \| null | yes |  |
| `data.cpuCores` | integer \| null | yes |  |
| `data.cpuModel` | string \| null | yes |  |
| `data.health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.hostname` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.kernel` | string \| null | yes |  |
| `data.lastSeenAt` | integer \| null | yes |  |
| `data.live` | object \| null | yes |  |
| `data.live.cpuPercent` | number | yes | range 0–100 |
| `data.live.diskReadBytesPerSec` | number | yes | range 0–∞ |
| `data.live.diskReadIops` | number \| null | yes | range 0–∞ |
| `data.live.diskWriteBytesPerSec` | number | yes | range 0–∞ |
| `data.live.diskWriteIops` | number \| null | yes | range 0–∞ |
| `data.live.disks` | object[] | yes | 0–32 items |
| `data.live.disks[].inodesPercent` | number \| null | yes | range 0–100 |
| `data.live.disks[].mount` | string | yes | length 1–200 |
| `data.live.disks[].totalBytes` | integer | yes |  |
| `data.live.disks[].usedBytes` | integer | yes |  |
| `data.live.iowaitPercent` | number \| null | yes | range 0–100 |
| `data.live.load1` | number | yes | range 0–∞ |
| `data.live.load15` | number | yes | range 0–∞ |
| `data.live.load5` | number | yes | range 0–∞ |
| `data.live.memoryTotalBytes` | integer | yes |  |
| `data.live.memoryUsedBytes` | integer | yes |  |
| `data.live.netRxBytesPerSec` | number | yes | range 0–∞ |
| `data.live.netTxBytesPerSec` | number | yes | range 0–∞ |
| `data.live.openFiles` | integer \| null | yes |  |
| `data.live.perCorePercent` | number[] | yes | 0–512 items |
| `data.live.processCount` | integer | yes |  |
| `data.live.sampledAt` | integer | yes |  |
| `data.live.stealPercent` | number \| null | yes | range 0–100 |
| `data.live.swapTotalBytes` | integer | yes |  |
| `data.live.swapUsedBytes` | integer | yes |  |
| `data.live.tcpConnections` | integer | yes |  |
| `data.live.topProcesses` | object[] | yes | 0–5 items |
| `data.live.topProcesses[].cpuPercent` | number | yes | range 0–∞ |
| `data.live.topProcesses[].memoryBytes` | integer | yes |  |
| `data.live.topProcesses[].name` | string | yes | length 1–120 |
| `data.live.topProcesses[].pid` | integer | yes |  |
| `data.memoryTotalBytes` | integer \| null | yes |  |
| `data.name` | string | yes |  |
| `data.openAlerts` | integer | yes |  |
| `data.os` | string \| null | yes |  |
| `data.provider` | "LOCAL" \| "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" \| "OTHER" | yes |  |
| `data.providerServerId` | string \| null | yes |  |
| `data.registeredAt` | integer | yes |  |
| `data.tokenPrefix` | string | yes |  |
| `data.uptimeSeconds` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/admin/operations/servers/{serverId}

SuperAdmin: stop monitoring a server (its token stops working; its history stays until retention)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_revoke` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `serverId` | path | string (uuid) | yes |  |

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

### GET /api/v1/admin/operations/servers/{serverId}/history

One server's history over a range (minutes up to a day, hours beyond)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:SERVER_METRIC`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_serverHistory` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `serverId` | path | string (uuid) | yes |  |
| `range` | query | "1h" \| "6h" \| "24h" \| "7d" \| "30d" \| "1y" | no |  |

**Response 200 OK** (`application/json`) — The history

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.from` | integer | yes |  |
| `data.points` | object[] | yes |  |
| `data.points[].bucketStart` | integer | yes |  |
| `data.points[].cpuPercentAvg` | number | yes | range 0–100 |
| `data.points[].cpuPercentMax` | number | yes | range 0–100 |
| `data.points[].diskPercentMax` | number | yes | range 0–100 |
| `data.points[].diskReadBytesPerSec` | number | yes | range 0–∞ |
| `data.points[].diskTotalBytes` | integer | yes |  |
| `data.points[].diskUsedBytes` | integer | yes |  |
| `data.points[].diskWriteBytesPerSec` | number | yes | range 0–∞ |
| `data.points[].inodesPercentMax` | number \| null | yes | range 0–100 |
| `data.points[].iowaitPercentAvg` | number \| null | yes | range 0–100 |
| `data.points[].load1Avg` | number | yes | range 0–∞ |
| `data.points[].memoryPercentMax` | number | yes | range 0–100 |
| `data.points[].memoryTotalBytes` | integer | yes |  |
| `data.points[].memoryUsedBytes` | integer | yes |  |
| `data.points[].netRxBytesPerSec` | number | yes | range 0–∞ |
| `data.points[].netTxBytesPerSec` | number | yes | range 0–∞ |
| `data.points[].processCount` | integer | yes |  |
| `data.points[].stealPercentAvg` | number \| null | yes | range 0–100 |
| `data.points[].swapUsedBytes` | integer | yes |  |
| `data.points[].tcpConnections` | integer | yes |  |
| `data.range` | "1h" \| "6h" \| "24h" \| "7d" \| "30d" \| "1y" | yes |  |
| `data.resolution` | "MINUTE" \| "HOUR" | yes |  |
| `data.to` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/operations/servers/{serverId}/token

SuperAdmin: a new agent token for a server; the old one stops working

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsController_rotateToken` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `serverId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — The server and its new agent token (shown once)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.agentToken` | string | yes |  |
| `data.installCommand` | string | yes |  |
| `data.server` | object | yes |  |
| `data.server.agentVersion` | string \| null | yes |  |
| `data.server.cloud` | object \| null | yes |  |
| `data.server.cloud.createdAt` | integer \| null | yes |  |
| `data.server.cloud.diskGb` | integer | yes |  |
| `data.server.cloud.memoryMb` | integer | yes |  |
| `data.server.cloud.name` | string | yes |  |
| `data.server.cloud.plan` | string | yes |  |
| `data.server.cloud.provider` | "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" | yes |  |
| `data.server.cloud.publicIpv4` | string \| null | yes |  |
| `data.server.cloud.region` | string | yes |  |
| `data.server.cloud.running` | boolean | yes |  |
| `data.server.cloud.status` | string | yes |  |
| `data.server.cloud.vcpus` | integer | yes |  |
| `data.server.cloudError` | string \| null | yes |  |
| `data.server.cpuCores` | integer \| null | yes |  |
| `data.server.cpuModel` | string \| null | yes |  |
| `data.server.health` | "UP" \| "DEGRADED" \| "DOWN" \| "UNKNOWN" | yes |  |
| `data.server.hostname` | string \| null | yes |  |
| `data.server.id` | string (uuid) | yes |  |
| `data.server.kernel` | string \| null | yes |  |
| `data.server.lastSeenAt` | integer \| null | yes |  |
| `data.server.live` | object \| null | yes |  |
| `data.server.live.cpuPercent` | number | yes | range 0–100 |
| `data.server.live.diskReadBytesPerSec` | number | yes | range 0–∞ |
| `data.server.live.diskReadIops` | number \| null | yes | range 0–∞ |
| `data.server.live.diskWriteBytesPerSec` | number | yes | range 0–∞ |
| `data.server.live.diskWriteIops` | number \| null | yes | range 0–∞ |
| `data.server.live.disks` | object[] | yes | 0–32 items |
| `data.server.live.disks[].inodesPercent` | number \| null | yes | range 0–100 |
| `data.server.live.disks[].mount` | string | yes | length 1–200 |
| `data.server.live.disks[].totalBytes` | integer | yes |  |
| `data.server.live.disks[].usedBytes` | integer | yes |  |
| `data.server.live.iowaitPercent` | number \| null | yes | range 0–100 |
| `data.server.live.load1` | number | yes | range 0–∞ |
| `data.server.live.load15` | number | yes | range 0–∞ |
| `data.server.live.load5` | number | yes | range 0–∞ |
| `data.server.live.memoryTotalBytes` | integer | yes |  |
| `data.server.live.memoryUsedBytes` | integer | yes |  |
| `data.server.live.netRxBytesPerSec` | number | yes | range 0–∞ |
| `data.server.live.netTxBytesPerSec` | number | yes | range 0–∞ |
| `data.server.live.openFiles` | integer \| null | yes |  |
| `data.server.live.perCorePercent` | number[] | yes | 0–512 items |
| `data.server.live.processCount` | integer | yes |  |
| `data.server.live.sampledAt` | integer | yes |  |
| `data.server.live.stealPercent` | number \| null | yes | range 0–100 |
| `data.server.live.swapTotalBytes` | integer | yes |  |
| `data.server.live.swapUsedBytes` | integer | yes |  |
| `data.server.live.tcpConnections` | integer | yes |  |
| `data.server.live.topProcesses` | object[] | yes | 0–5 items |
| `data.server.live.topProcesses[].cpuPercent` | number | yes | range 0–∞ |
| `data.server.live.topProcesses[].memoryBytes` | integer | yes |  |
| `data.server.live.topProcesses[].name` | string | yes | length 1–120 |
| `data.server.live.topProcesses[].pid` | integer | yes |  |
| `data.server.memoryTotalBytes` | integer \| null | yes |  |
| `data.server.name` | string | yes |  |
| `data.server.openAlerts` | integer | yes |  |
| `data.server.os` | string \| null | yes |  |
| `data.server.provider` | "LOCAL" \| "DIGITALOCEAN" \| "LINODE" \| "VULTR" \| "HETZNER" \| "OTHER" | yes |  |
| `data.server.providerServerId` | string \| null | yes |  |
| `data.server.registeredAt` | integer | yes |  |
| `data.server.tokenPrefix` | string | yes |  |
| `data.server.uptimeSeconds` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/operations/agent/report

A server agent's report (bearer: the server's agent token)

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OperationsAgentController_report` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-agent.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `agentVersion` | string | yes | length 1–40 |
| `host` | object | yes |  |
| `host.cpuCores` | integer | yes | range 1–512 |
| `host.cpuModel` | string | yes | length 1–200 |
| `host.hostname` | string | yes | length 1–200 |
| `host.kernel` | string | yes | length 1–200 |
| `host.memoryTotalBytes` | integer | yes |  |
| `host.os` | string | yes | length 1–200 |
| `host.uptimeSeconds` | integer | yes |  |
| `live` | object | yes |  |
| `live.cpuPercent` | number | yes | range 0–100 |
| `live.diskReadBytesPerSec` | number | yes | range 0–∞ |
| `live.diskReadIops` | number \| null | yes | range 0–∞ |
| `live.diskWriteBytesPerSec` | number | yes | range 0–∞ |
| `live.diskWriteIops` | number \| null | yes | range 0–∞ |
| `live.disks` | object[] | yes | 0–32 items |
| `live.disks[].inodesPercent` | number \| null | yes | range 0–100 |
| `live.disks[].mount` | string | yes | length 1–200 |
| `live.disks[].totalBytes` | integer | yes |  |
| `live.disks[].usedBytes` | integer | yes |  |
| `live.iowaitPercent` | number \| null | yes | range 0–100 |
| `live.load1` | number | yes | range 0–∞ |
| `live.load15` | number | yes | range 0–∞ |
| `live.load5` | number | yes | range 0–∞ |
| `live.memoryTotalBytes` | integer | yes |  |
| `live.memoryUsedBytes` | integer | yes |  |
| `live.netRxBytesPerSec` | number | yes | range 0–∞ |
| `live.netTxBytesPerSec` | number | yes | range 0–∞ |
| `live.openFiles` | integer \| null | yes |  |
| `live.perCorePercent` | number[] | yes | 0–512 items |
| `live.processCount` | integer | yes |  |
| `live.sampledAt` | integer | yes |  |
| `live.stealPercent` | number \| null | yes | range 0–100 |
| `live.swapTotalBytes` | integer | yes |  |
| `live.swapUsedBytes` | integer | yes |  |
| `live.tcpConnections` | integer | yes |  |
| `live.topProcesses` | object[] | yes | 0–5 items |
| `live.topProcesses[].cpuPercent` | number | yes | range 0–∞ |
| `live.topProcesses[].memoryBytes` | integer | yes |  |
| `live.topProcesses[].name` | string | yes | length 1–120 |
| `live.topProcesses[].pid` | integer | yes |  |
| `minute` | object \| null | yes |  |
| `minute.bucketStart` | integer | yes |  |
| `minute.cpuPercentAvg` | number | yes | range 0–100 |
| `minute.cpuPercentMax` | number | yes | range 0–100 |
| `minute.diskPercentMax` | number | yes | range 0–100 |
| `minute.diskReadBytesPerSec` | number | yes | range 0–∞ |
| `minute.diskTotalBytes` | integer | yes |  |
| `minute.diskUsedBytes` | integer | yes |  |
| `minute.diskWriteBytesPerSec` | number | yes | range 0–∞ |
| `minute.inodesPercentMax` | number \| null | yes | range 0–100 |
| `minute.iowaitPercentAvg` | number \| null | yes | range 0–100 |
| `minute.load1Avg` | number | yes | range 0–∞ |
| `minute.memoryPercentMax` | number | yes | range 0–100 |
| `minute.memoryTotalBytes` | integer | yes |  |
| `minute.memoryUsedBytes` | integer | yes |  |
| `minute.netRxBytesPerSec` | number | yes | range 0–∞ |
| `minute.netTxBytesPerSec` | number | yes | range 0–∞ |
| `minute.processCount` | integer | yes |  |
| `minute.stealPercentAvg` | number \| null | yes | range 0–100 |
| `minute.swapUsedBytes` | integer | yes |  |
| `minute.tcpConnections` | integer | yes |  |

**Response 200 OK** (`application/json`) — When to report next

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.nextReportInMs` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/operations/backups/{backupId}/file

The backup file, for a one-time ticket from POST …/download

- **Public** — no session required.
- Rate limit: 3 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: no request body; returns `application/octet-stream` (errors are always `application/json`)
- Operation id `OperationsBackupFileController_file` · [source](../../../apps/api/src/contexts/operations/presentation/http/operations-backups.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `backupId` | path | string (uuid) | yes |  |
| `ticket` | query | string | yes |  |

**Response 200 OK** — The `pg_dump --format=custom` file (Content-Disposition: attachment) (`application/octet-stream`)

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
