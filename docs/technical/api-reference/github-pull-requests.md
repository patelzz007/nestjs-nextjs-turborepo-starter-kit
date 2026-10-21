---
title: "API reference — GitHub pull requests"
description: "Admins link their own fine-grained GitHub token, then list and read pull requests — conversation, commits, files with diffs, line-comment threads and edit histories — as themselves."
order: 12
author: "Generated from the OpenAPI export"
lastUpdated: 1792540800000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — GitHub pull requests

Admins link their own fine-grained GitHub token, then list and read pull requests — conversation, commits, files with diffs, line-comment threads and edit histories — as themselves.

How these endpoints fit together: [GitHub pull requests guide](../github-pull-requests.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## GitHub pull requests

### GET /api/v1/github/account

Your GitHub link

`off` when this server has no GITHUB_CREDENTIAL_ENCRYPTION_KEYS (pull requests are not set up), `unlinked` before you link a token, otherwise the account your token belongs to — never the token.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubAccountController_status` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-account.controller.ts)

**Response 200 OK** (`application/json`) — Your GitHub link

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ status` | "off" | yes |  |
| `data.⟨shape 2⟩ status` | "unlinked" | yes |  |
| `data.⟨shape 3⟩ avatarUrl` | string (uri) \| null | yes |  |
| `data.⟨shape 3⟩ health` | "active" \| "rejected" | yes |  |
| `data.⟨shape 3⟩ linkedAt` | integer | yes |  |
| `data.⟨shape 3⟩ login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.⟨shape 3⟩ status` | "linked" | yes |  |
| `data.⟨shape 3⟩ tokenExpiresAt` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/github/account

Link (or replace) your fine-grained GitHub token

GitHub is asked who the token belongs to and when it expires before it is stored, encrypted. Needs Pull requests (read and write), Contents (read) and Metadata (read); add Webhooks (read and write) for live updates. 400 GITHUB_TOKEN_INVALID when GitHub refuses the token; 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for it.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `GithubAccountController_link` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-account.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `personalAccessToken` | string | yes | A fine-grained personal access token — never returned or logged; length 12–255; pattern `^github_pat_[A-Za-z0-9_]+$` |

**Response 200 OK** (`application/json`) — The linked account

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ status` | "off" | yes |  |
| `data.⟨shape 2⟩ status` | "unlinked" | yes |  |
| `data.⟨shape 3⟩ avatarUrl` | string (uri) \| null | yes |  |
| `data.⟨shape 3⟩ health` | "active" \| "rejected" | yes |  |
| `data.⟨shape 3⟩ linkedAt` | integer | yes |  |
| `data.⟨shape 3⟩ login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.⟨shape 3⟩ status` | "linked" | yes |  |
| `data.⟨shape 3⟩ tokenExpiresAt` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `GITHUB_TOKEN_INVALID` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/github/account

Forget your GitHub token

The token is wiped; nothing about your pull requests is stored to begin with.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubAccountController_unlink` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-account.controller.ts)

**Response 200 OK** (`application/json`) — `unlinked`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ status` | "off" | yes |  |
| `data.⟨shape 2⟩ status` | "unlinked" | yes |  |
| `data.⟨shape 3⟩ avatarUrl` | string (uri) \| null | yes |  |
| `data.⟨shape 3⟩ health` | "active" \| "rejected" | yes |  |
| `data.⟨shape 3⟩ linkedAt` | integer | yes |  |
| `data.⟨shape 3⟩ login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.⟨shape 3⟩ status` | "linked" | yes |  |
| `data.⟨shape 3⟩ tokenExpiresAt` | integer \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/content-edits/{nodeId}

Every saved version of a comment, review or pull request description

Newest first; the last entry is the original. A version GitHub removed from the history has no text. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubContentEditsController_contentEdits` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-content-edits.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `nodeId` | path | string | yes | GitHub node id |

**Response 200 OK** (`application/json`) — The saved versions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.edits` | object[] | yes | 0–50 items |
| `data.edits[].body` | string \| null | yes | at most 65536 characters |
| `data.edits[].editedAt` | integer | yes |  |
| `data.edits[].editor` | object \| null | yes |  |
| `data.edits[].editor.avatarUrl` | string (uri) \| null | yes |  |
| `data.edits[].editor.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.totalCount` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/live-updates/{owner}/{repository}

Whether a repository's pull requests update live

`off`: this server receives no webhooks; `disabled`; `enabled`.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubLiveUpdatesController_status` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-live-updates.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |

**Response 200 OK** (`application/json`) — Live updates of the repository

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ status` | "off" | yes |  |
| `data.⟨shape 2⟩ status` | "disabled" | yes |  |
| `data.⟨shape 3⟩ enabledAt` | integer | yes |  |
| `data.⟨shape 3⟩ status` | "enabled" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/github/live-updates/{owner}/{repository}

Turn a repository's live updates on

Registers a webhook on the repository with your token (it needs "Webhooks: Read and write"). Already on changes nothing, so a retry is safe without an Idempotency-Key. 503 `GITHUB_LIVE_UPDATES_OFF` when this server receives no webhooks. Posted to GitHub as your linked account. Send an Idempotency-Key header: a retry with the same key answers the first result instead of posting twice (400 IDEMPOTENCY_KEY_REQUIRED without one). 409 GITHUB_WRITE_REJECTED when GitHub refuses it — approving your own pull request, a locked conversation, or a token without "Pull requests: Read and write" — with GitHub's reason as the message. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubLiveUpdatesController_enable` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-live-updates.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |

**Response 200 OK** (`application/json`) — Live updates are on

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ status` | "off" | yes |  |
| `data.⟨shape 2⟩ status` | "disabled" | yes |  |
| `data.⟨shape 3⟩ enabledAt` | integer | yes |  |
| `data.⟨shape 3⟩ status` | "enabled" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Stated in the endpoint description. |
| 409 | `GITHUB_WRITE_REJECTED` | Stated in the endpoint description. |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/github/live-updates/{owner}/{repository}

Turn a repository's live updates off

Deletes its webhook on GitHub with your token. Already off changes nothing. Posted to GitHub as your linked account. Send an Idempotency-Key header: a retry with the same key answers the first result instead of posting twice (400 IDEMPOTENCY_KEY_REQUIRED without one). 409 GITHUB_WRITE_REJECTED when GitHub refuses it — approving your own pull request, a locked conversation, or a token without "Pull requests: Read and write" — with GitHub's reason as the message. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubLiveUpdatesController_disable` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-live-updates.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |

**Response 200 OK** (`application/json`) — Live updates are off

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ status` | "off" | yes |  |
| `data.⟨shape 2⟩ status` | "disabled" | yes |  |
| `data.⟨shape 3⟩ enabledAt` | integer | yes |  |
| `data.⟨shape 3⟩ status` | "enabled" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Stated in the endpoint description. |
| 409 | `GITHUB_WRITE_REJECTED` | Stated in the endpoint description. |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/live-updates/{owner}/{repository}/events

One repository's pull-request changes, live (SSE)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `text/event-stream` (errors are always `application/json`)
- Operation id `GithubLiveUpdatesController_stream` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-live-updates.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |

**Response 200 OK** — A `{ owner, repository, number }` frame per change, `resync` when changes may have been missed, a `ping` every 25 s (no envelope, no response contract) (`text/event-stream`)

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pictures/file

A picture kept in a repository, read with your GitHub token

409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPicturesController_file` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pictures.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | query | string | yes | GitHub user or tenant |
| `repository` | query | string | yes | GitHub repository name |
| `ref` | query | string | yes |  |
| `path` | query | string | yes |  |

**Response 200 OK** — The picture's bytes

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pictures/uploads/{attachmentId}

An upload to a private repository, shown in a comment

`node` is the pull request, comment, review or line comment whose body shows it: that body is read with your GitHub token, and the picture through GitHub's fresh signed link in it. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPicturesController_upload` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pictures.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `attachmentId` | path | string | yes | GitHub upload id |
| `node` | query | string | yes | GitHub node id |

**Response 200 OK** — The picture's bytes

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pull-requests

One page of your pull requests

`filter`: `yours` (in repositories your GitHub account owns), `created`, `reviewRequested`, `assigned`, `mentioned`; `state`: open or closed. Most recently updated first. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_list` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `filter` | query | "yours" \| "created" \| "reviewRequested" \| "assigned" \| "mentioned" | no |  |
| `state` | query | "open" \| "closed" | no |  |
| `cursor` | query | string | no | `nextCursor` of the previous page; omit for the most recently updated |

**Response 200 OK** (`application/json`) — Pull requests and the cursor of the next page

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.items` | object[] | yes | 0–25 items |
| `data.items[].author` | object \| null | yes |  |
| `data.items[].author.avatarUrl` | string (uri) \| null | yes |  |
| `data.items[].author.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.items[].commentCount` | integer | yes |  |
| `data.items[].createdAt` | integer | yes |  |
| `data.items[].htmlUrl` | string (uri) | yes |  |
| `data.items[].isDraft` | boolean | yes |  |
| `data.items[].labels` | object[] | yes | 0–20 items |
| `data.items[].labels[].color` | string | yes | pattern `^[0-9a-fA-F]{6}$` |
| `data.items[].labels[].name` | string | yes | length 1–50 |
| `data.items[].number` | integer | yes | Pull request number in its repository; range 1–2147483647 |
| `data.items[].owner` | string | yes | GitHub user or tenant; length 1–39; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$` |
| `data.items[].repository` | string | yes | GitHub repository name; length 1–100; pattern `^[A-Za-z0-9._-]+$` |
| `data.items[].reviewDecision` | "approved" \| "changesRequested" \| "reviewRequired" \| null | yes |  |
| `data.items[].state` | "open" \| "closed" \| "merged" | yes |  |
| `data.items[].title` | string | yes | at most 256 characters |
| `data.items[].updatedAt` | integer | yes |  |
| `data.nextCursor` | string \| null | yes | length 1–200 |
| `data.totalCount` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pull-requests/{owner}/{repository}/{number}

One pull request with the first page of its conversation

409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_detail` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |

**Response 200 OK** (`application/json`) — The pull request

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.additions` | integer | yes |  |
| `data.author` | object \| null | yes |  |
| `data.author.avatarUrl` | string (uri) \| null | yes |  |
| `data.author.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.baseRef` | string | yes | length 1–255 |
| `data.body` | string | yes | at most 65536 characters |
| `data.bodyImages` | object[] | yes | 0–100 items |
| `data.bodyImages[].source` | string (uri) | yes |  |
| `data.bodyImages[].url` | string (uri) | yes |  |
| `data.bodyLastEditedAt` | integer \| null | yes |  |
| `data.changedFiles` | integer | yes |  |
| `data.closedAt` | integer \| null | yes |  |
| `data.commentCount` | integer | yes |  |
| `data.commitCount` | integer | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.deletions` | integer | yes |  |
| `data.headOwner` | string \| null | yes | GitHub user or tenant; length 1–39; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$` |
| `data.headRef` | string | yes | length 1–255 |
| `data.htmlUrl` | string (uri) | yes |  |
| `data.id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.isDraft` | boolean | yes |  |
| `data.labels` | object[] | yes | 0–20 items |
| `data.labels[].color` | string | yes | pattern `^[0-9a-fA-F]{6}$` |
| `data.labels[].name` | string | yes | length 1–50 |
| `data.mergedAt` | integer \| null | yes |  |
| `data.number` | integer | yes | Pull request number in its repository; range 1–2147483647 |
| `data.owner` | string | yes | GitHub user or tenant; length 1–39; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$` |
| `data.reactions` | object[] | yes | 0–8 items |
| `data.reactions[].content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `data.reactions[].count` | integer | yes |  |
| `data.reactions[].viewerHasReacted` | boolean | yes |  |
| `data.repository` | string | yes | GitHub repository name; length 1–100; pattern `^[A-Za-z0-9._-]+$` |
| `data.requestedReviewers` | object[] | yes | 0–20 items |
| `data.requestedReviewers[].avatarUrl` | string (uri) \| null | yes |  |
| `data.requestedReviewers[].login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.reviewDecision` | "approved" \| "changesRequested" \| "reviewRequired" \| null | yes |  |
| `data.state` | "open" \| "closed" \| "merged" | yes |  |
| `data.timeline` | object | yes |  |
| `data.timeline.items` | object[] | yes | 0–50 items |
| `data.timeline.items[].⟨shape 1⟩ comment` | object | yes |  |
| `data.timeline.items[].⟨shape 1⟩ comment.author` | object \| null | yes |  |
| `data.timeline.items[].⟨shape 1⟩ comment.body` | string | yes | at most 65536 characters |
| `data.timeline.items[].⟨shape 1⟩ comment.createdAt` | integer | yes |  |
| `data.timeline.items[].⟨shape 1⟩ comment.htmlUrl` | string (uri) | yes |  |
| `data.timeline.items[].⟨shape 1⟩ comment.id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.timeline.items[].⟨shape 1⟩ comment.images` | object[] | yes | 0–100 items |
| `data.timeline.items[].⟨shape 1⟩ comment.lastEditedAt` | integer \| null | yes |  |
| `data.timeline.items[].⟨shape 1⟩ comment.reactionSubject` | object \| null | yes |  |
| `data.timeline.items[].⟨shape 1⟩ comment.reactions` | object[] | yes | 0–8 items |
| `data.timeline.items[].⟨shape 1⟩ comment.viewerCanUpdate` | boolean | yes |  |
| `data.timeline.items[].⟨shape 1⟩ comment.viewerDidAuthor` | boolean | yes |  |
| `data.timeline.items[].⟨shape 1⟩ type` | "comment" | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review` | object | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.author` | object \| null | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.body` | string | yes | at most 65536 characters |
| `data.timeline.items[].⟨shape 2⟩ review.commentCount` | integer | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.comments` | object[] | yes | 0–20 items |
| `data.timeline.items[].⟨shape 2⟩ review.createdAt` | integer | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.htmlUrl` | string (uri) | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.timeline.items[].⟨shape 2⟩ review.images` | object[] | yes | 0–100 items |
| `data.timeline.items[].⟨shape 2⟩ review.lastEditedAt` | integer \| null | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.reactionSubject` | object \| null | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.reactions` | object[] | yes | 0–8 items |
| `data.timeline.items[].⟨shape 2⟩ review.state` | "approved" \| "changesRequested" \| "commented" \| "dismissed" \| "pending" | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.submittedAt` | integer \| null | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.viewerCanUpdate` | boolean | yes |  |
| `data.timeline.items[].⟨shape 2⟩ review.viewerDidAuthor` | boolean | yes |  |
| `data.timeline.items[].⟨shape 2⟩ type` | "review" | yes |  |
| `data.timeline.items[].⟨shape 3⟩ commit` | object | yes |  |
| `data.timeline.items[].⟨shape 3⟩ commit.author` | object | yes |  |
| `data.timeline.items[].⟨shape 3⟩ commit.committedAt` | integer | yes |  |
| `data.timeline.items[].⟨shape 3⟩ commit.headline` | string | yes |  |
| `data.timeline.items[].⟨shape 3⟩ commit.sha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |
| `data.timeline.items[].⟨shape 3⟩ commit.shortSha` | string | yes | length 1–40; pattern `^[0-9a-f]+$` |
| `data.timeline.items[].⟨shape 3⟩ type` | "commit" | yes |  |
| `data.timeline.items[].⟨shape 4⟩ actor` | object \| null | yes |  |
| `data.timeline.items[].⟨shape 4⟩ actor.avatarUrl` | string (uri) \| null | yes |  |
| `data.timeline.items[].⟨shape 4⟩ actor.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.timeline.items[].⟨shape 4⟩ createdAt` | integer | yes |  |
| `data.timeline.items[].⟨shape 4⟩ detail` | string \| null | yes | at most 300 characters |
| `data.timeline.items[].⟨shape 4⟩ kind` | "closed" \| "reopened" \| "merged" \| "readyForReview" \| "convertedToDraft" \| "reviewRequested" \| "labeled" \| "unlabeled" \| "headRefForcePushed" \| "renamed" | yes |  |
| `data.timeline.items[].⟨shape 4⟩ type` | "event" | yes |  |
| `data.timeline.nextCursor` | string \| null | yes | length 1–200 |
| `data.title` | string | yes | at most 256 characters |
| `data.updatedAt` | integer | yes |  |
| `data.viewerCanUpdate` | boolean | yes |  |
| `data.viewerDidAuthor` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/github/pull-requests/{owner}/{repository}/{number}/comments

Comment on a pull request's conversation

Posted to GitHub as your linked account. Send an Idempotency-Key header: a retry with the same key answers the first result instead of posting twice (400 IDEMPOTENCY_KEY_REQUIRED without one). 409 GITHUB_WRITE_REJECTED when GitHub refuses it — approving your own pull request, a locked conversation, or a token without "Pull requests: Read and write" — with GitHub's reason as the message. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_addComment` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |
| `Idempotency-Key` | header | string | yes | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `body` | string | yes | Markdown, as GitHub renders it; length 1–65536 |

**Response 201 Created** (`application/json`) — The comment, as GitHub saved it

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.author` | object \| null | yes |  |
| `data.author.avatarUrl` | string (uri) \| null | yes |  |
| `data.author.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.body` | string | yes | at most 65536 characters |
| `data.createdAt` | integer | yes |  |
| `data.htmlUrl` | string (uri) | yes |  |
| `data.id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.images` | object[] | yes | 0–100 items |
| `data.images[].source` | string (uri) | yes |  |
| `data.images[].url` | string (uri) | yes |  |
| `data.lastEditedAt` | integer \| null | yes |  |
| `data.reactionSubject` | object \| null | yes |  |
| `data.reactionSubject.⟨shape 1⟩ type` | "pullRequest" | yes |  |
| `data.reactionSubject.⟨shape 2⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.reactionSubject.⟨shape 2⟩ type` | "issueComment" | yes |  |
| `data.reactionSubject.⟨shape 3⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.reactionSubject.⟨shape 3⟩ type` | "reviewComment" | yes |  |
| `data.reactions` | object[] | yes | 0–8 items |
| `data.reactions[].content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `data.reactions[].count` | integer | yes |  |
| `data.reactions[].viewerHasReacted` | boolean | yes |  |
| `data.viewerCanUpdate` | boolean | yes |  |
| `data.viewerDidAuthor` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Stated in the endpoint description. |
| 409 | `GITHUB_WRITE_REJECTED` | Stated in the endpoint description. |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pull-requests/{owner}/{repository}/{number}/commits

A pull request's commits, oldest first

409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_commits` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |
| `cursor` | query | string | no | `nextCursor` of the previous page; omit for the first page |

**Response 200 OK** (`application/json`) — Commits and the cursor of the next page

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.items` | object[] | yes | 0–50 items |
| `data.items[].additions` | integer | yes |  |
| `data.items[].author` | object | yes |  |
| `data.items[].author.avatarUrl` | string (uri) \| null | yes |  |
| `data.items[].author.login` | string \| null | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.items[].author.name` | string | yes |  |
| `data.items[].changedFiles` | integer \| null | yes |  |
| `data.items[].committedAt` | integer | yes |  |
| `data.items[].deletions` | integer | yes |  |
| `data.items[].headline` | string | yes |  |
| `data.items[].htmlUrl` | string (uri) | yes |  |
| `data.items[].sha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |
| `data.items[].shortSha` | string | yes | length 1–40; pattern `^[0-9a-f]+$` |
| `data.nextCursor` | string \| null | yes | length 1–200 |
| `data.totalCount` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pull-requests/{owner}/{repository}/{number}/commits/{sha}

One of a pull request's commits with its changed files and diffs

Read with your own token, so any repository it can see. The first 100 files, with the same diff limits as the files page. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_commit` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |
| `sha` | path | string | yes | Full commit SHA (40 lowercase hex characters) |

**Response 200 OK** (`application/json`) — The commit and its diff

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.additions` | integer | yes |  |
| `data.author` | object | yes |  |
| `data.author.avatarUrl` | string (uri) \| null | yes |  |
| `data.author.login` | string \| null | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.author.name` | string | yes |  |
| `data.changedFiles` | integer \| null | yes |  |
| `data.committedAt` | integer | yes |  |
| `data.deletions` | integer | yes |  |
| `data.files` | object[] | yes | 0–100 items |
| `data.files[].additions` | integer | yes |  |
| `data.files[].deletions` | integer | yes |  |
| `data.files[].diff` | object | yes |  |
| `data.files[].diff.⟨shape 1⟩ kind` | "patch" | yes |  |
| `data.files[].diff.⟨shape 1⟩ patch` | string | yes | length 1–20000 |
| `data.files[].diff.⟨shape 2⟩ kind` | "too-large" | yes |  |
| `data.files[].diff.⟨shape 3⟩ kind` | "unavailable" | yes |  |
| `data.files[].path` | string | yes | length 1–4096 |
| `data.files[].previousPath` | string \| null | yes | length 1–4096 |
| `data.files[].status` | "added" \| "removed" \| "modified" \| "renamed" \| "copied" \| "changed" \| "unchanged" | yes |  |
| `data.filesTruncated` | boolean | yes |  |
| `data.headline` | string | yes |  |
| `data.htmlUrl` | string (uri) | yes |  |
| `data.message` | string | yes | at most 10000 characters |
| `data.parents` | object[] | yes | 0–8 items |
| `data.parents[].sha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |
| `data.parents[].shortSha` | string | yes | length 1–40; pattern `^[0-9a-f]+$` |
| `data.sha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |
| `data.shortSha` | string | yes | length 1–40; pattern `^[0-9a-f]+$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pull-requests/{owner}/{repository}/{number}/files

One page of a pull request's changed files with their diffs

100 files a page (GitHub lists at most 3,000). Same diff rules as a commit: a file's diff is `too-large` past 20,000 characters or once the page's diffs reach 200,000 together, `unavailable` when GitHub sends none. `headSha` is the commit the diffs belong to. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_files` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |
| `page` | query | integer | no | Page of changed files, from 1 |

**Response 200 OK** (`application/json`) — Changed files and the next page number

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.files` | object[] | yes | 0–100 items |
| `data.files[].additions` | integer | yes |  |
| `data.files[].deletions` | integer | yes |  |
| `data.files[].diff` | object | yes |  |
| `data.files[].diff.⟨shape 1⟩ kind` | "patch" | yes |  |
| `data.files[].diff.⟨shape 1⟩ patch` | string | yes | length 1–20000 |
| `data.files[].diff.⟨shape 2⟩ kind` | "too-large" | yes |  |
| `data.files[].diff.⟨shape 3⟩ kind` | "unavailable" | yes |  |
| `data.files[].path` | string | yes | length 1–4096 |
| `data.files[].previousPath` | string \| null | yes | length 1–4096 |
| `data.files[].status` | "added" \| "removed" \| "modified" \| "renamed" \| "copied" \| "changed" \| "unchanged" | yes |  |
| `data.headSha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |
| `data.nextPage` | integer \| null | yes | range 2–30 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/github/pull-requests/{owner}/{repository}/{number}/merge

Merge a pull request, and optionally delete its branch

Merges as you (your token needs "Contents: Read and write") with `merge`, `squash` or `rebase` — whichever the repository allows — only if its head is still `expectedHeadSha`. GitHub's refusals (not mergeable, the head moved on, a rule such as required reviews) answer 409 `GITHUB_WRITE_REJECTED` with GitHub's reason. With `deleteBranch`, a branch of this repository is deleted afterwards; that never undoes the merge — `branch.outcome` says how it went. Posted to GitHub as your linked account. Send an Idempotency-Key header: a retry with the same key answers the first result instead of posting twice (400 IDEMPOTENCY_KEY_REQUIRED without one). 409 GITHUB_WRITE_REJECTED when GitHub refuses it — approving your own pull request, a locked conversation, or a token without "Pull requests: Read and write" — with GitHub's reason as the message. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_merge` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |
| `Idempotency-Key` | header | string | yes | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `commitMessage` | string | no | at most 65536 characters; default `""` |
| `commitTitle` | string | no | at most 256 characters; default `""` |
| `deleteBranch` | boolean | yes |  |
| `expectedHeadSha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |
| `method` | "merge" \| "squash" \| "rebase" | yes |  |

**Response 201 Created** (`application/json`) — The merge commit, and what happened to the branch

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.branch` | object | yes |  |
| `data.branch.⟨shape 1⟩ outcome` | "deleted" | yes |  |
| `data.branch.⟨shape 2⟩ outcome` | "kept" | yes |  |
| `data.branch.⟨shape 3⟩ outcome` | "failed" | yes |  |
| `data.branch.⟨shape 3⟩ reason` | string | yes | at most 300 characters |
| `data.sha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Stated in the endpoint description. |
| 409 | `GITHUB_WRITE_REJECTED` | Stated in the endpoint description. |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/github/pull-requests/{owner}/{repository}/{number}/pictures

Commit an uploaded picture to the repository, to link from a comment

`fileId` is your own READY `GITHUB_COMMENT_IMAGE` upload (`POST /files/upload-url`). It is committed to the repository's `github-comment-assets` branch as you (your token needs "Contents: Read and write" there), and the upload is deleted. Link the answered `url` from the comment: GitHub shows it to whoever may read the repository. Posted to GitHub as your linked account. Send an Idempotency-Key header: a retry with the same key answers the first result instead of posting twice (400 IDEMPOTENCY_KEY_REQUIRED without one). 409 GITHUB_WRITE_REJECTED when GitHub refuses it — approving your own pull request, a locked conversation, or a token without "Pull requests: Read and write" — with GitHub's reason as the message. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_attachPicture` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |
| `Idempotency-Key` | header | string | yes | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fileId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Where the picture now is in the repository

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.path` | string | yes | length 1–4096 |
| `data.url` | string (uri) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Stated in the endpoint description. |
| 409 | `GITHUB_WRITE_REJECTED` | Stated in the endpoint description. |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/github/pull-requests/{owner}/{repository}/{number}/reactions

Set your emoji reaction on a pull request or one of its comments, on or off

The subject is the pull request, a conversation comment or a line comment (a review's summary takes no reactions from an API). Setting a reaction to what it already is changes nothing, so a retry needs no Idempotency-Key. Posted to GitHub as your linked account. Send an Idempotency-Key header: a retry with the same key answers the first result instead of posting twice (400 IDEMPOTENCY_KEY_REQUIRED without one). 409 GITHUB_WRITE_REJECTED when GitHub refuses it — approving your own pull request, a locked conversation, or a token without "Pull requests: Read and write" — with GitHub's reason as the message. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_setReaction` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `reacted` | boolean | yes |  |
| `subject` | object | yes |  |
| `subject.⟨shape 1⟩ type` | "pullRequest" | yes |  |
| `subject.⟨shape 2⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `subject.⟨shape 2⟩ type` | "issueComment" | yes |  |
| `subject.⟨shape 3⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `subject.⟨shape 3⟩ type` | "reviewComment" | yes |  |

**Response 200 OK** (`application/json`) — The reaction as it now stands on GitHub

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `data.reacted` | boolean | yes |  |
| `data.subject` | object | yes |  |
| `data.subject.⟨shape 1⟩ type` | "pullRequest" | yes |  |
| `data.subject.⟨shape 2⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.subject.⟨shape 2⟩ type` | "issueComment" | yes |  |
| `data.subject.⟨shape 3⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.subject.⟨shape 3⟩ type` | "reviewComment" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Stated in the endpoint description. |
| 409 | `GITHUB_WRITE_REJECTED` | Stated in the endpoint description. |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pull-requests/{owner}/{repository}/{number}/review-threads

The conversations on lines of a pull request's diff

At most 100 threads of 50 comments each. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_reviewThreads` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |

**Response 200 OK** (`application/json`) — Line-comment threads

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.threads` | object[] | yes | 0–100 items |
| `data.threads[].comments` | object[] | yes | 0–50 items |
| `data.threads[].comments[].author` | object \| null | yes |  |
| `data.threads[].comments[].author.avatarUrl` | string (uri) \| null | yes |  |
| `data.threads[].comments[].author.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.threads[].comments[].body` | string | yes | at most 65536 characters |
| `data.threads[].comments[].createdAt` | integer | yes |  |
| `data.threads[].comments[].diffHunk` | string | yes | at most 20000 characters |
| `data.threads[].comments[].htmlUrl` | string (uri) | yes |  |
| `data.threads[].comments[].id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.threads[].comments[].images` | object[] | yes | 0–100 items |
| `data.threads[].comments[].images[].source` | string (uri) | yes |  |
| `data.threads[].comments[].images[].url` | string (uri) | yes |  |
| `data.threads[].comments[].lastEditedAt` | integer \| null | yes |  |
| `data.threads[].comments[].line` | integer \| null | yes |  |
| `data.threads[].comments[].originalLine` | integer \| null | yes |  |
| `data.threads[].comments[].path` | string | yes | length 1–4096 |
| `data.threads[].comments[].reactionSubject` | object \| null | yes |  |
| `data.threads[].comments[].reactionSubject.⟨shape 1⟩ type` | "pullRequest" | yes |  |
| `data.threads[].comments[].reactionSubject.⟨shape 2⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.threads[].comments[].reactionSubject.⟨shape 2⟩ type` | "issueComment" | yes |  |
| `data.threads[].comments[].reactionSubject.⟨shape 3⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.threads[].comments[].reactionSubject.⟨shape 3⟩ type` | "reviewComment" | yes |  |
| `data.threads[].comments[].reactions` | object[] | yes | 0–8 items |
| `data.threads[].comments[].reactions[].content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `data.threads[].comments[].reactions[].count` | integer | yes |  |
| `data.threads[].comments[].reactions[].viewerHasReacted` | boolean | yes |  |
| `data.threads[].comments[].viewerCanUpdate` | boolean | yes |  |
| `data.threads[].comments[].viewerDidAuthor` | boolean | yes |  |
| `data.threads[].id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.threads[].isOutdated` | boolean | yes |  |
| `data.threads[].isResolved` | boolean | yes |  |
| `data.threads[].line` | integer \| null | yes |  |
| `data.threads[].originalLine` | integer \| null | yes |  |
| `data.threads[].path` | string | yes | length 1–4096 |
| `data.threads[].side` | "left" \| "right" | yes |  |
| `data.truncated` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/github/pull-requests/{owner}/{repository}/{number}/reviews

Review a pull request: comment, approve or request changes

A summary is required to comment or request changes. Posted to GitHub as your linked account. Send an Idempotency-Key header: a retry with the same key answers the first result instead of posting twice (400 IDEMPOTENCY_KEY_REQUIRED without one). 409 GITHUB_WRITE_REJECTED when GitHub refuses it — approving your own pull request, a locked conversation, or a token without "Pull requests: Read and write" — with GitHub's reason as the message. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `UPDATE:GITHUB_PULL_REQUEST`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_submitReview` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |
| `Idempotency-Key` | header | string | yes | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `body` | string | no | at most 65536 characters; default `""` |
| `event` | "comment" \| "approve" \| "requestChanges" | yes |  |

**Response 201 Created** (`application/json`) — The review, as GitHub saved it

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.author` | object \| null | yes |  |
| `data.author.avatarUrl` | string (uri) \| null | yes |  |
| `data.author.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.body` | string | yes | at most 65536 characters |
| `data.commentCount` | integer | yes |  |
| `data.comments` | object[] | yes | 0–20 items |
| `data.comments[].author` | object \| null | yes |  |
| `data.comments[].author.avatarUrl` | string (uri) \| null | yes |  |
| `data.comments[].author.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.comments[].body` | string | yes | at most 65536 characters |
| `data.comments[].createdAt` | integer | yes |  |
| `data.comments[].diffHunk` | string | yes | at most 20000 characters |
| `data.comments[].htmlUrl` | string (uri) | yes |  |
| `data.comments[].id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.comments[].images` | object[] | yes | 0–100 items |
| `data.comments[].images[].source` | string (uri) | yes |  |
| `data.comments[].images[].url` | string (uri) | yes |  |
| `data.comments[].lastEditedAt` | integer \| null | yes |  |
| `data.comments[].line` | integer \| null | yes |  |
| `data.comments[].originalLine` | integer \| null | yes |  |
| `data.comments[].path` | string | yes | length 1–4096 |
| `data.comments[].reactionSubject` | object \| null | yes |  |
| `data.comments[].reactionSubject.⟨shape 1⟩ type` | "pullRequest" | yes |  |
| `data.comments[].reactionSubject.⟨shape 2⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.comments[].reactionSubject.⟨shape 2⟩ type` | "issueComment" | yes |  |
| `data.comments[].reactionSubject.⟨shape 3⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.comments[].reactionSubject.⟨shape 3⟩ type` | "reviewComment" | yes |  |
| `data.comments[].reactions` | object[] | yes | 0–8 items |
| `data.comments[].reactions[].content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `data.comments[].reactions[].count` | integer | yes |  |
| `data.comments[].reactions[].viewerHasReacted` | boolean | yes |  |
| `data.comments[].viewerCanUpdate` | boolean | yes |  |
| `data.comments[].viewerDidAuthor` | boolean | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.htmlUrl` | string (uri) | yes |  |
| `data.id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.images` | object[] | yes | 0–100 items |
| `data.images[].source` | string (uri) | yes |  |
| `data.images[].url` | string (uri) | yes |  |
| `data.lastEditedAt` | integer \| null | yes |  |
| `data.reactionSubject` | object \| null | yes |  |
| `data.reactionSubject.⟨shape 1⟩ type` | "pullRequest" | yes |  |
| `data.reactionSubject.⟨shape 2⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.reactionSubject.⟨shape 2⟩ type` | "issueComment" | yes |  |
| `data.reactionSubject.⟨shape 3⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.reactionSubject.⟨shape 3⟩ type` | "reviewComment" | yes |  |
| `data.reactions` | object[] | yes | 0–8 items |
| `data.reactions[].content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `data.reactions[].count` | integer | yes |  |
| `data.reactions[].viewerHasReacted` | boolean | yes |  |
| `data.state` | "approved" \| "changesRequested" \| "commented" \| "dismissed" \| "pending" | yes |  |
| `data.submittedAt` | integer \| null | yes |  |
| `data.viewerCanUpdate` | boolean | yes |  |
| `data.viewerDidAuthor` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Stated in the endpoint description. |
| 409 | `GITHUB_WRITE_REJECTED` | Stated in the endpoint description. |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pull-requests/{owner}/{repository}/{number}/status

A pull request's merge box: checks and conflicts

The head commit's checks as GitHub rolls them up (`none` without checks, `unavailable` when GitHub will not show them to your token) and whether the branch merges cleanly (`unknown` while GitHub works it out). 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_status` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |

**Response 200 OK** (`application/json`) — Checks and mergeability

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.checks` | object | yes |  |
| `data.checks.⟨shape 1⟩ kind` | "none" | yes |  |
| `data.checks.⟨shape 2⟩ kind` | "unavailable" | yes |  |
| `data.checks.⟨shape 3⟩ failed` | integer | yes |  |
| `data.checks.⟨shape 3⟩ kind` | "summary" | yes |  |
| `data.checks.⟨shape 3⟩ pending` | integer | yes |  |
| `data.checks.⟨shape 3⟩ skipped` | integer | yes |  |
| `data.checks.⟨shape 3⟩ state` | "success" \| "failure" \| "pending" | yes |  |
| `data.checks.⟨shape 3⟩ successful` | integer | yes |  |
| `data.merge` | object | yes |  |
| `data.merge.canDeleteHeadBranch` | boolean | yes |  |
| `data.merge.defaultMethod` | "merge" \| "squash" \| "rebase" \| null | yes |  |
| `data.merge.deletesBranchOnMerge` | boolean | yes |  |
| `data.merge.headBranch` | string | yes | length 1–255 |
| `data.merge.headSha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |
| `data.merge.methods` | "merge" \| "squash" \| "rebase"[] | yes | 0–3 items |
| `data.merge.state` | "clean" \| "unstable" \| "hasHooks" \| "behind" \| "blocked" \| "dirty" \| "draft" \| "unknown" | yes |  |
| `data.mergeability` | "mergeable" \| "conflicting" \| "unknown" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/pull-requests/{owner}/{repository}/{number}/timeline

A later page of a pull request's conversation

Pass the previous page's `nextCursor` as `cursor`. 409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). 404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:GITHUB_PULL_REQUEST`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubPullRequestsController_timeline` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-pull-requests.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or tenant |
| `repository` | path | string | yes | GitHub repository name |
| `number` | path | integer | yes | Pull request number in its repository |
| `cursor` | query | string | no | `nextCursor` of the previous page; omit for the first page |

**Response 200 OK** (`application/json`) — Conversation entries, oldest first

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.items` | object[] | yes | 0–50 items |
| `data.items[].⟨shape 1⟩ comment` | object | yes |  |
| `data.items[].⟨shape 1⟩ comment.author` | object \| null | yes |  |
| `data.items[].⟨shape 1⟩ comment.author.avatarUrl` | string (uri) \| null | yes |  |
| `data.items[].⟨shape 1⟩ comment.author.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.items[].⟨shape 1⟩ comment.body` | string | yes | at most 65536 characters |
| `data.items[].⟨shape 1⟩ comment.createdAt` | integer | yes |  |
| `data.items[].⟨shape 1⟩ comment.htmlUrl` | string (uri) | yes |  |
| `data.items[].⟨shape 1⟩ comment.id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.items[].⟨shape 1⟩ comment.images` | object[] | yes | 0–100 items |
| `data.items[].⟨shape 1⟩ comment.images[].source` | string (uri) | yes |  |
| `data.items[].⟨shape 1⟩ comment.images[].url` | string (uri) | yes |  |
| `data.items[].⟨shape 1⟩ comment.lastEditedAt` | integer \| null | yes |  |
| `data.items[].⟨shape 1⟩ comment.reactionSubject` | object \| null | yes |  |
| `data.items[].⟨shape 1⟩ comment.reactionSubject.⟨shape 1⟩ type` | "pullRequest" | yes |  |
| `data.items[].⟨shape 1⟩ comment.reactionSubject.⟨shape 2⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.items[].⟨shape 1⟩ comment.reactionSubject.⟨shape 2⟩ type` | "issueComment" | yes |  |
| `data.items[].⟨shape 1⟩ comment.reactionSubject.⟨shape 3⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.items[].⟨shape 1⟩ comment.reactionSubject.⟨shape 3⟩ type` | "reviewComment" | yes |  |
| `data.items[].⟨shape 1⟩ comment.reactions` | object[] | yes | 0–8 items |
| `data.items[].⟨shape 1⟩ comment.reactions[].content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `data.items[].⟨shape 1⟩ comment.reactions[].count` | integer | yes |  |
| `data.items[].⟨shape 1⟩ comment.reactions[].viewerHasReacted` | boolean | yes |  |
| `data.items[].⟨shape 1⟩ comment.viewerCanUpdate` | boolean | yes |  |
| `data.items[].⟨shape 1⟩ comment.viewerDidAuthor` | boolean | yes |  |
| `data.items[].⟨shape 1⟩ type` | "comment" | yes |  |
| `data.items[].⟨shape 2⟩ review` | object | yes |  |
| `data.items[].⟨shape 2⟩ review.author` | object \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.author.avatarUrl` | string (uri) \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.author.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.items[].⟨shape 2⟩ review.body` | string | yes | at most 65536 characters |
| `data.items[].⟨shape 2⟩ review.commentCount` | integer | yes |  |
| `data.items[].⟨shape 2⟩ review.comments` | object[] | yes | 0–20 items |
| `data.items[].⟨shape 2⟩ review.comments[].author` | object \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.comments[].body` | string | yes | at most 65536 characters |
| `data.items[].⟨shape 2⟩ review.comments[].createdAt` | integer | yes |  |
| `data.items[].⟨shape 2⟩ review.comments[].diffHunk` | string | yes | at most 20000 characters |
| `data.items[].⟨shape 2⟩ review.comments[].htmlUrl` | string (uri) | yes |  |
| `data.items[].⟨shape 2⟩ review.comments[].id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.items[].⟨shape 2⟩ review.comments[].images` | object[] | yes | 0–100 items |
| `data.items[].⟨shape 2⟩ review.comments[].lastEditedAt` | integer \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.comments[].line` | integer \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.comments[].originalLine` | integer \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.comments[].path` | string | yes | length 1–4096 |
| `data.items[].⟨shape 2⟩ review.comments[].reactionSubject` | object \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.comments[].reactions` | object[] | yes | 0–8 items |
| `data.items[].⟨shape 2⟩ review.comments[].viewerCanUpdate` | boolean | yes |  |
| `data.items[].⟨shape 2⟩ review.comments[].viewerDidAuthor` | boolean | yes |  |
| `data.items[].⟨shape 2⟩ review.createdAt` | integer | yes |  |
| `data.items[].⟨shape 2⟩ review.htmlUrl` | string (uri) | yes |  |
| `data.items[].⟨shape 2⟩ review.id` | string | yes | GitHub node id; length 1–100; pattern `^[A-Za-z0-9_=-]+$` |
| `data.items[].⟨shape 2⟩ review.images` | object[] | yes | 0–100 items |
| `data.items[].⟨shape 2⟩ review.images[].source` | string (uri) | yes |  |
| `data.items[].⟨shape 2⟩ review.images[].url` | string (uri) | yes |  |
| `data.items[].⟨shape 2⟩ review.lastEditedAt` | integer \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.reactionSubject` | object \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.reactionSubject.⟨shape 1⟩ type` | "pullRequest" | yes |  |
| `data.items[].⟨shape 2⟩ review.reactionSubject.⟨shape 2⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.items[].⟨shape 2⟩ review.reactionSubject.⟨shape 2⟩ type` | "issueComment" | yes |  |
| `data.items[].⟨shape 2⟩ review.reactionSubject.⟨shape 3⟩ commentId` | string | yes | GitHub's numeric id of the comment; pattern `^[1-9][0-9]{0,19}$` |
| `data.items[].⟨shape 2⟩ review.reactionSubject.⟨shape 3⟩ type` | "reviewComment" | yes |  |
| `data.items[].⟨shape 2⟩ review.reactions` | object[] | yes | 0–8 items |
| `data.items[].⟨shape 2⟩ review.reactions[].content` | "thumbsUp" \| "thumbsDown" \| "laugh" \| "hooray" \| "confused" \| "heart" \| "rocket" \| "eyes" | yes |  |
| `data.items[].⟨shape 2⟩ review.reactions[].count` | integer | yes |  |
| `data.items[].⟨shape 2⟩ review.reactions[].viewerHasReacted` | boolean | yes |  |
| `data.items[].⟨shape 2⟩ review.state` | "approved" \| "changesRequested" \| "commented" \| "dismissed" \| "pending" | yes |  |
| `data.items[].⟨shape 2⟩ review.submittedAt` | integer \| null | yes |  |
| `data.items[].⟨shape 2⟩ review.viewerCanUpdate` | boolean | yes |  |
| `data.items[].⟨shape 2⟩ review.viewerDidAuthor` | boolean | yes |  |
| `data.items[].⟨shape 2⟩ type` | "review" | yes |  |
| `data.items[].⟨shape 3⟩ commit` | object | yes |  |
| `data.items[].⟨shape 3⟩ commit.author` | object | yes |  |
| `data.items[].⟨shape 3⟩ commit.author.avatarUrl` | string (uri) \| null | yes |  |
| `data.items[].⟨shape 3⟩ commit.author.login` | string \| null | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.items[].⟨shape 3⟩ commit.author.name` | string | yes |  |
| `data.items[].⟨shape 3⟩ commit.committedAt` | integer | yes |  |
| `data.items[].⟨shape 3⟩ commit.headline` | string | yes |  |
| `data.items[].⟨shape 3⟩ commit.sha` | string | yes | Full commit SHA (40 lowercase hex characters); exactly 40 characters; pattern `^[0-9a-f]+$` |
| `data.items[].⟨shape 3⟩ commit.shortSha` | string | yes | length 1–40; pattern `^[0-9a-f]+$` |
| `data.items[].⟨shape 3⟩ type` | "commit" | yes |  |
| `data.items[].⟨shape 4⟩ actor` | object \| null | yes |  |
| `data.items[].⟨shape 4⟩ actor.avatarUrl` | string (uri) \| null | yes |  |
| `data.items[].⟨shape 4⟩ actor.login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.items[].⟨shape 4⟩ createdAt` | integer | yes |  |
| `data.items[].⟨shape 4⟩ detail` | string \| null | yes | at most 300 characters |
| `data.items[].⟨shape 4⟩ kind` | "closed" \| "reopened" \| "merged" \| "readyForReview" \| "convertedToDraft" \| "reviewRequested" \| "labeled" \| "unlabeled" \| "headRefForcePushed" \| "renamed" | yes |  |
| `data.items[].⟨shape 4⟩ type` | "event" | yes |  |
| `data.nextCursor` | string \| null | yes | length 1–200 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `GITHUB_ACCOUNT_NOT_LINKED` | Stated in the endpoint description. |
| 409 | `GITHUB_TOKEN_REJECTED` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 503 | `GITHUB_PULL_REQUESTS_OFF` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/webhook

What this address is (GitHub posts webhook deliveries here)

- **Public** — no session required.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubWebhookController_info` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-webhook.controller.ts)

**Response 200 OK** (`application/json`) — A short explanation

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/github/webhook

Receive a GitHub webhook delivery

- **Public** — no session required.
- Rate limit: `WEBHOOK_RATE_LIMIT_PER_MINUTE` requests per 60 s per client IP (webhook limiter).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubWebhookController_receive` · [source](../../../apps/api/src/contexts/integrations-github/presentation/http/github-webhook.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `X-GitHub-Delivery` | header | string | yes | The delivery's id — a redelivery is recognised by it |
| `X-GitHub-Event` | header | string | yes | The event's kind |
| `X-Hub-Signature-256` | header | string | yes | `sha256=` + HMAC-SHA256 of the raw body with the webhook secret |

**Response 200 OK** (`application/json`) — The delivery was verified

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.outcome` | "recorded" \| "duplicate" \| "ping" \| "ignored" | yes |  |
| `data.received` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
