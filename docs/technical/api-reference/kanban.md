---
title: "API reference — Kanban boards"
description: "The platform staff's two linked boards: the epic → feature → story → task → subtask hierarchy with item keys, moves under the board lock (optimistic locking), Move to… (a new parent), ranked item search, WIP limits, checklists, links, watchers, history, comments with files, CSV import and attachments."
order: 14
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Kanban boards

The platform staff's two linked boards: the epic → feature → story → task → subtask hierarchy with item keys, moves under the board lock (optimistic locking), Move to… (a new parent), ranked item search, WIP limits, checklists, links, watchers, history, comments with files, CSV import and attachments.

How these endpoints fit together: [Kanban boards guide](../kanban.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Kanban

### GET /api/v1/admin/kanban/board

One board: its columns left to right, each with its items top to bottom

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:KANBAN_TASK`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_board` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `board` | query | "PLANNING" \| "EXECUTION" | yes |  |

**Response 200 OK** (`application/json`) — The board

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.board` | "PLANNING" \| "EXECUTION" | yes |  |
| `data.columns` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.columns[].⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 1⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 1⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 1⟩ title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.columns[].⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 2⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 2⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 2⟩ title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ wipLimit` | integer \| null | yes | Soft work-in-progress limit on stories and tasks (subtasks never count), or null for none |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PATCH /api/v1/admin/kanban/columns/{columnId}

Set or clear a column's soft WIP limit (optimistic lock: send the version you read); answers that board

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_BOARD`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_updateColumn` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `columnId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `version` | integer | yes | The column `version` this edit is based on (optimistic lock) |
| `wipLimit` | integer \| null | yes | range 1–200 |

**Response 200 OK** (`application/json`) — The board after the edit

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.board` | "PLANNING" \| "EXECUTION" | yes |  |
| `data.columns` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.columns[].⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 1⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 1⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 1⟩ title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.columns[].⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 2⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 2⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 2⟩ title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ wipLimit` | integer \| null | yes | Soft work-in-progress limit on stories and tasks (subtasks never count), or null for none |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/kanban/columns/{columnId}/move

Move a column right of another on its board (or first); answers that board

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_BOARD`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_moveColumn` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `columnId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `afterColumnId` | string (uuid) \| null | yes |  |
| `version` | integer | yes | The column `version` this move is based on (optimistic lock) |

**Response 201 Created** (`application/json`) — The board after the move

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.board` | "PLANNING" \| "EXECUTION" | yes |  |
| `data.columns` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.columns[].⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 1⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 1⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 1⟩ title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.columns[].⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 2⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 2⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 2⟩ title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ wipLimit` | integer \| null | yes | Soft work-in-progress limit on stories and tasks (subtasks never count), or null for none |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/kanban/items

Live items of either board, by type and title (a parent or link picker), paginated

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:KANBAN_TASK`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_items` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: title, createdAt. Default: title |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: type |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — One page of items

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].assignee` | object \| null | yes |  |
| `data[].assignee.id` | string (uuid) | yes |  |
| `data[].assignee.name` | string | yes |  |
| `data[].column` | object | yes |  |
| `data[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data[].column.⟨shape 1⟩ title` | string | yes |  |
| `data[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data[].column.⟨shape 2⟩ title` | string | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data[].title` | string | yes |  |
| `data[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `meta.hasNext` | boolean | yes | Whether a next page exists |
| `meta.hasPrevious` | boolean | yes | Whether a previous page exists |
| `meta.limit` | integer | yes | Items per page; range 1–100 |
| `meta.nextCursor` | string \| null | yes | Opaque cursor for the next page, or null when there are no more rows |
| `meta.page` | integer | yes | Current page (1-indexed); min 1 |
| `meta.total` | integer | yes | Total rows matching the current filters |
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

### GET /api/v1/admin/kanban/people

Everyone an item or a subtask can be assigned to (holds READ on KANBAN_TASK), by name

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:KANBAN_TASK`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_people` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Response 200 OK** (`application/json`) — The people

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.people` | object[] | yes |  |
| `data.people[].id` | string (uuid) | yes |  |
| `data.people[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/kanban/search

Live items ranked for a lookup: the exact key first, then keys that start with the text, then titles that contain it

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:KANBAN_TASK`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_search` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `q` | query | string | yes |  |
| `type` | query | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | no |  |
| `limit` | query | integer | no |  |

**Response 200 OK** (`application/json`) — The best matches, best first

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.results` | object[] | yes |  |
| `data.results[].ancestors` | object[] | yes |  |
| `data.results[].ancestors[].id` | string (uuid) | yes |  |
| `data.results[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.results[].ancestors[].title` | string | yes |  |
| `data.results[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.results[].assignee` | object \| null | yes |  |
| `data.results[].assignee.id` | string (uuid) | yes |  |
| `data.results[].assignee.name` | string | yes |  |
| `data.results[].column` | object | yes |  |
| `data.results[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.results[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.results[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.results[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.results[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.results[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.results[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.results[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.results[].id` | string (uuid) | yes |  |
| `data.results[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.results[].match` | "KEY" \| "KEY_PREFIX" \| "TITLE" | yes |  |
| `data.results[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.results[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.results[].title` | string | yes |  |
| `data.results[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/kanban/tasks

Create an item at the bottom of a column of its board; the caller reports and watches it

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `CREATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_createTask` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `Idempotency-Key` | header | string | no | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `assigneeId` | string (uuid) \| null | no | default `null` |
| `columnId` | string (uuid) | yes |  |
| `description` | string | yes | at most 2000 characters |
| `dueAt` | integer \| null | no | default `null` |
| `labels` | string[] | no | 0–8 items; default `[]` |
| `parentId` | string (uuid) \| null | no | default `null` |
| `priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `progress` | integer | yes | range 0–100 |
| `startAt` | integer \| null | no | default `null` |
| `storyPoints` | 1 \| 2 \| 3 \| 5 \| 8 \| 13 \| 21 \| null | no | default `null` |
| `team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `title` | string | yes |  |
| `type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |

**Response 201 Created** (`application/json`) — The created task

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/kanban/tasks/{taskId}

One item with its column, children, links, checklists, watchers and attachments

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:KANBAN_TASK`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_task` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The task

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PATCH /api/v1/admin/kanban/tasks/{taskId}

Edit an item's fields and checklists (optimistic lock: send the version you read; 409 KANBAN_TASK_STALE otherwise)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_updateTask` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `acceptanceCriteria` | object[] | no | 0–20 items |
| `acceptanceCriteria[].id` | string (uuid) | no |  |
| `acceptanceCriteria[].isDone` | boolean | yes |  |
| `acceptanceCriteria[].title` | string | yes |  |
| `assigneeId` | string (uuid) \| null | no |  |
| `description` | string | no | at most 2000 characters |
| `dueAt` | integer \| null | no |  |
| `labels` | string[] | no | 0–8 items |
| `priority` | "HIGH" \| "MEDIUM" \| "LOW" | no |  |
| `progress` | integer | no | range 0–100 |
| `startAt` | integer \| null | no |  |
| `steps` | object[] | no | 0–50 items |
| `steps[].assigneeId` | string (uuid) \| null | yes |  |
| `steps[].depth` | integer | yes | range 0–1 |
| `steps[].id` | string (uuid) | no |  |
| `steps[].isDone` | boolean | yes |  |
| `steps[].title` | string | yes |  |
| `storyPoints` | 1 \| 2 \| 3 \| 5 \| 8 \| 13 \| 21 \| null | no |  |
| `team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | no |  |
| `title` | string | no |  |
| `version` | integer | yes | The item `version` this edit is based on (optimistic lock) |

**Response 200 OK** (`application/json`) — The edited task

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `KANBAN_TASK_STALE` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/admin/kanban/tasks/{taskId}

Soft-delete an item with no live children; the items below it move up

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `DELETE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_deleteTask` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Task deleted

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

### GET /api/v1/admin/kanban/tasks/{taskId}/activity

An item's history, newest first (paginated)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:KANBAN_TASK`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_activity` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** (`application/json`) — One page of history

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].actor` | object | yes |  |
| `data[].actor.id` | string (uuid) | yes |  |
| `data[].actor.name` | string | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].field` | "TITLE" \| "DESCRIPTION" \| "PRIORITY" \| "TEAM" \| "START" \| "DUE" \| "STORY_POINTS" \| "PROGRESS" \| "ASSIGNEE" \| "PARENT" \| … (+4 more) \| null | yes |  |
| `data[].from` | string \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].kind` | "CREATED" \| "UPDATED" \| "MOVED" \| "COMMENTED" \| "ATTACHED" \| "DETACHED" \| "LINKED" \| "UNLINKED" \| "CHECKED" \| "UNCHECKED" | yes |  |
| `data[].taskId` | string (uuid) | yes |  |
| `data[].to` | string \| null | yes |  |
| `meta.hasNext` | boolean | yes | Whether a next page exists |
| `meta.hasPrevious` | boolean | yes | Whether a previous page exists |
| `meta.limit` | integer | yes | Items per page; range 1–100 |
| `meta.nextCursor` | string \| null | yes | Opaque cursor for the next page, or null when there are no more rows |
| `meta.page` | integer | yes | Current page (1-indexed); min 1 |
| `meta.total` | integer | yes | Total rows matching the current filters |
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

### POST /api/v1/admin/kanban/tasks/{taskId}/attachments

Attach a READY KANBAN_TASK_ATTACHMENT file the caller uploaded (POST /files/upload-url)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_attachFile` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |
| `Idempotency-Key` | header | string | no | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fileId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — The attachment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.commentId` | string (uuid) \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.fileId` | string (uuid) | yes |  |
| `data.fileName` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.sizeBytes` | integer | yes |  |
| `data.uploadedBy` | object | yes |  |
| `data.uploadedBy.id` | string (uuid) | yes |  |
| `data.uploadedBy.name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/admin/kanban/tasks/{taskId}/attachments/{attachmentId}

Remove an attachment: its file is deleted and its stored copy purged

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_removeAttachment` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |
| `attachmentId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Attachment removed

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

### GET /api/v1/admin/kanban/tasks/{taskId}/attachments/{attachmentId}/download

A short-lived signed URL that downloads an attachment's original upload

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:KANBAN_TASK`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_attachmentDownload` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |
| `attachmentId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Signed download URL of the attachment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.attachmentId` | string (uuid) | yes |  |
| `data.downloadUrl` | string | yes | at least 1 characters |
| `data.expiresAt` | integer | yes |  |
| `data.fileName` | string | yes | at least 1 characters |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PATCH /api/v1/admin/kanban/tasks/{taskId}/checklist/{itemId}

Tick a subtask or an acceptance criterion off, or on again (a set, safe to retry); answers the item

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_setChecklistItem` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |
| `itemId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `isDone` | boolean | yes |  |

**Response 200 OK** (`application/json`) — The item

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/kanban/tasks/{taskId}/comments

A task's comments, newest first (paginated)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:KANBAN_TASK`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_comments` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** (`application/json`) — One page of comments

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].attachments` | object[] | yes |  |
| `data[].attachments[].commentId` | string (uuid) \| null | yes |  |
| `data[].attachments[].createdAt` | integer | yes |  |
| `data[].attachments[].fileId` | string (uuid) | yes |  |
| `data[].attachments[].fileName` | string | yes |  |
| `data[].attachments[].id` | string (uuid) | yes |  |
| `data[].attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data[].attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data[].attachments[].sizeBytes` | integer | yes |  |
| `data[].attachments[].uploadedBy` | object | yes |  |
| `data[].attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data[].attachments[].uploadedBy.name` | string | yes |  |
| `data[].author` | object | yes |  |
| `data[].author.id` | string (uuid) | yes |  |
| `data[].author.name` | string | yes |  |
| `data[].body` | string | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].taskId` | string (uuid) | yes |  |
| `meta.hasNext` | boolean | yes | Whether a next page exists |
| `meta.hasPrevious` | boolean | yes | Whether a previous page exists |
| `meta.limit` | integer | yes | Items per page; range 1–100 |
| `meta.nextCursor` | string \| null | yes | Opaque cursor for the next page, or null when there are no more rows |
| `meta.page` | integer | yes | Current page (1-indexed); min 1 |
| `meta.total` | integer | yes | Total rows matching the current filters |
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

### POST /api/v1/admin/kanban/tasks/{taskId}/comments

Comment on a task as the signed-in staff member

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_addComment` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |
| `Idempotency-Key` | header | string | no | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `body` | string | yes | at most 2000 characters |
| `fileIds` | string (uuid)[] | no | 0–5 items; default `[]` |

**Response 201 Created** (`application/json`) — The comment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.author` | object | yes |  |
| `data.author.id` | string (uuid) | yes |  |
| `data.author.name` | string | yes |  |
| `data.body` | string | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.taskId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/kanban/tasks/{taskId}/links

Link the item to another live item (blocks, blocked by, relates to); 409 when already linked. Answers the item

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_addLink` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `targetTaskId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — The item with its new link

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/admin/kanban/tasks/{taskId}/links/{linkId}

Remove one of the item's links (either end); answers the item

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_removeLink` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |
| `linkId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The item without the link

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/kanban/tasks/{taskId}/move

Move an item into a column of its board, right below another item (or to the top); answers that board

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_moveTask` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `afterTaskId` | string (uuid) \| null | yes |  |
| `columnId` | string (uuid) | yes |  |
| `version` | integer | yes | The item `version` this move is based on (optimistic lock) |

**Response 201 Created** (`application/json`) — The board after the move

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.board` | "PLANNING" \| "EXECUTION" | yes |  |
| `data.columns` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.columns[].⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 1⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 1⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 1⟩ title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.columns[].⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 2⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 2⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 2⟩ title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ wipLimit` | integer \| null | yes | Soft work-in-progress limit on stories and tasks (subtasks never count), or null for none |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/kanban/tasks/{taskId}/parent

Move to…: put an item under another parent one level up; it keeps its column and place

Send the item `version` you read (409 KANBAN_TASK_STALE otherwise). The history records the old and the new parent; undo is the same call back.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_moveToParent` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `parentId` | string (uuid) \| null | yes |  |
| `version` | integer | yes | The item `version` this move is based on (optimistic lock) |

**Response 201 Created** (`application/json`) — The item under its new parent

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `KANBAN_TASK_STALE` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/admin/kanban/tasks/{taskId}/watch

Watch the item as the signed-in staff member (idempotent); answers the item

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_watch` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The item

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/admin/kanban/tasks/{taskId}/watch

Stop watching the item (idempotent); answers the item

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_unwatch` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `taskId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The item

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptanceCriteria` | object | yes |  |
| `data.acceptanceCriteria.done` | integer | yes |  |
| `data.acceptanceCriteria.total` | integer | yes |  |
| `data.acceptanceCriterionItems` | object[] | yes |  |
| `data.acceptanceCriterionItems[].id` | string (uuid) | yes |  |
| `data.acceptanceCriterionItems[].isDone` | boolean | yes |  |
| `data.acceptanceCriterionItems[].title` | string | yes |  |
| `data.ancestors` | object[] | yes |  |
| `data.ancestors[].dueAt` | integer \| null | yes |  |
| `data.ancestors[].id` | string (uuid) | yes |  |
| `data.ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.ancestors[].startAt` | integer \| null | yes |  |
| `data.ancestors[].title` | string | yes |  |
| `data.ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.assignee` | object \| null | yes |  |
| `data.assignee.id` | string (uuid) | yes |  |
| `data.assignee.name` | string | yes |  |
| `data.attachments` | object[] | yes |  |
| `data.attachments[].commentId` | string (uuid) \| null | yes |  |
| `data.attachments[].createdAt` | integer | yes |  |
| `data.attachments[].fileId` | string (uuid) | yes |  |
| `data.attachments[].fileName` | string | yes |  |
| `data.attachments[].id` | string (uuid) | yes |  |
| `data.attachments[].kind` | "ATTACHMENT" \| "DOCUMENT" | yes |  |
| `data.attachments[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.attachments[].sizeBytes` | integer | yes |  |
| `data.attachments[].uploadedBy` | object | yes |  |
| `data.attachments[].uploadedBy.id` | string (uuid) | yes |  |
| `data.attachments[].uploadedBy.name` | string | yes |  |
| `data.children` | object[] | yes |  |
| `data.children[].assignee` | object \| null | yes |  |
| `data.children[].assignee.id` | string (uuid) | yes |  |
| `data.children[].assignee.name` | string | yes |  |
| `data.children[].column` | object | yes |  |
| `data.children[].column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.children[].column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.children[].column.⟨shape 1⟩ title` | string | yes |  |
| `data.children[].column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.children[].column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.children[].column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.children[].column.⟨shape 2⟩ title` | string | yes |  |
| `data.children[].id` | string (uuid) | yes |  |
| `data.children[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.children[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.children[].storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.children[].title` | string | yes |  |
| `data.children[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.column` | object | yes |  |
| `data.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.column.⟨shape 1⟩ title` | string | yes |  |
| `data.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.column.⟨shape 2⟩ title` | string | yes |  |
| `data.columnId` | string (uuid) | yes |  |
| `data.counts` | object | yes |  |
| `data.counts.attachments` | integer | yes |  |
| `data.counts.comments` | integer | yes |  |
| `data.counts.documents` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.description` | string | yes |  |
| `data.dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.id` | string (uuid) | yes |  |
| `data.isBlocked` | boolean | yes |  |
| `data.isWatching` | boolean | yes |  |
| `data.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.labels` | string[] | yes |  |
| `data.links` | object[] | yes |  |
| `data.links[].id` | string (uuid) | yes |  |
| `data.links[].item` | object | yes |  |
| `data.links[].item.assignee` | object \| null | yes |  |
| `data.links[].item.assignee.id` | string (uuid) | yes |  |
| `data.links[].item.assignee.name` | string | yes |  |
| `data.links[].item.column` | object | yes |  |
| `data.links[].item.column.⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.links[].item.column.⟨shape 1⟩ title` | string | yes |  |
| `data.links[].item.column.⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.links[].item.column.⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.links[].item.column.⟨shape 2⟩ title` | string | yes |  |
| `data.links[].item.id` | string (uuid) | yes |  |
| `data.links[].item.key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.links[].item.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.links[].item.storyPoints` | integer \| null | yes | min -9007199254740991 |
| `data.links[].item.title` | string | yes |  |
| `data.links[].item.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.links[].kind` | "BLOCKS" \| "BLOCKED_BY" \| "RELATES_TO" | yes |  |
| `data.owner` | object | yes |  |
| `data.owner.id` | string (uuid) | yes |  |
| `data.owner.name` | string | yes |  |
| `data.parentId` | string (uuid) \| null | yes |  |
| `data.priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.progress` | integer | yes | range 0–100 |
| `data.rollup` | object | yes |  |
| `data.rollup.children` | object | yes |  |
| `data.rollup.children.done` | integer | yes |  |
| `data.rollup.children.total` | integer | yes |  |
| `data.rollup.points` | object | yes |  |
| `data.rollup.points.done` | integer | yes |  |
| `data.rollup.points.total` | integer | yes |  |
| `data.startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.stepItems` | object[] | yes |  |
| `data.stepItems[].assignee` | object \| null | yes |  |
| `data.stepItems[].assignee.id` | string (uuid) | yes |  |
| `data.stepItems[].assignee.name` | string | yes |  |
| `data.stepItems[].depth` | integer | yes | range 0–1 |
| `data.stepItems[].id` | string (uuid) | yes |  |
| `data.stepItems[].isDone` | boolean | yes |  |
| `data.stepItems[].title` | string | yes |  |
| `data.steps` | object | yes |  |
| `data.steps.done` | integer | yes |  |
| `data.steps.total` | integer | yes |  |
| `data.storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.title` | string | yes |  |
| `data.type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.watchers` | object[] | yes |  |
| `data.watchers[].id` | string (uuid) | yes |  |
| `data.watchers[].name` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/admin/kanban/tasks/import

Create several items on one board at once (a CSV import), each at the bottom of its column; all or none. Answers that board

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `CREATE:KANBAN_TASK`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `KanbanController_importTasks` · [source](../../../apps/api/src/contexts/kanban/presentation/http/kanban.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `Idempotency-Key` | header | string | no | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `board` | "PLANNING" \| "EXECUTION" | yes |  |
| `tasks` | object[] | yes | 1–100 items |
| `tasks[].assigneeId` | string (uuid) \| null | no | default `null` |
| `tasks[].columnId` | string (uuid) | yes |  |
| `tasks[].description` | string | yes | at most 2000 characters |
| `tasks[].dueAt` | integer \| null | no | default `null` |
| `tasks[].labels` | string[] | no | 0–8 items; default `[]` |
| `tasks[].parentId` | string (uuid) \| null | no | default `null` |
| `tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `tasks[].progress` | integer | yes | range 0–100 |
| `tasks[].startAt` | integer \| null | no | default `null` |
| `tasks[].storyPoints` | 1 \| 2 \| 3 \| 5 \| 8 \| 13 \| 21 \| null | no | default `null` |
| `tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `tasks[].title` | string | yes |  |
| `tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |

**Response 201 Created** (`application/json`) — The board after the import

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.board` | "PLANNING" \| "EXECUTION" | yes |  |
| `data.columns` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ board` | "PLANNING" | yes |  |
| `data.columns[].⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ stage` | "BACKLOG" \| "REFINING" \| "READY" \| "PLANNED" \| "DELIVERED" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 1⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 1⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 1⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 1⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 1⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 1⟩ title` | string | yes |  |
| `data.columns[].⟨shape 1⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ board` | "EXECUTION" | yes |  |
| `data.columns[].⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ state` | "TODO" \| "IN_PROGRESS" \| "REVIEW" \| "DONE" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].acceptanceCriteria.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors` | object[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].dueAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].startAt` | integer \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].ancestors[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee` | object \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].assignee.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].columnId` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.attachments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.comments` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].counts.documents` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].createdAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].description` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].dueAt` | integer \| null | yes | Epoch milliseconds the item is due, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].isBlocked` | boolean | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].key` | string \| null | yes | The item's key (`STORY-142`), or null before the conversion keys it |
| `data.columns[].⟨shape 2⟩ tasks[].labels` | string[] | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.id` | string (uuid) | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].owner.name` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].parentId` | string (uuid) \| null | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].priority` | "HIGH" \| "MEDIUM" \| "LOW" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].progress` | integer | yes | range 0–100 |
| `data.columns[].⟨shape 2⟩ tasks[].rollup` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.children` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].rollup.points` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].startAt` | integer \| null | yes | Epoch milliseconds the item starts, or null (a task or subtask inherits its story's) |
| `data.columns[].⟨shape 2⟩ tasks[].steps` | object | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.done` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].steps.total` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].storyPoints` | integer \| null | yes | A story's estimate, or null (epics and features show `rollup.points`); min -9007199254740991 |
| `data.columns[].⟨shape 2⟩ tasks[].team` | "BACKEND" \| "DATA" \| "DESIGN" \| "PLATFORM" \| "PRODUCT" \| "QA" \| "SECURITY" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].type` | "EPIC" \| "FEATURE" \| "STORY" \| "TASK" \| "SUBTASK" | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].updatedAt` | integer | yes |  |
| `data.columns[].⟨shape 2⟩ tasks[].version` | integer | yes | Optimistic-lock token: send it back with an edit or a move |
| `data.columns[].⟨shape 2⟩ title` | string | yes |  |
| `data.columns[].⟨shape 2⟩ version` | integer | yes | Optimistic-lock token: send it back with a column move or edit |
| `data.columns[].⟨shape 2⟩ wipLimit` | integer \| null | yes | Soft work-in-progress limit on stories and tasks (subtasks never count), or null for none |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
