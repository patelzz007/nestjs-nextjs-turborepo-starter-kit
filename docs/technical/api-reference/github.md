---
title: "API reference — GitHub contributions"
description: "Read-only summary, commit history with line counts and contributor totals of the GitHub repositories the API is configured with."
order: 11
author: "Generated from the OpenAPI export"
lastUpdated: 1791158400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — GitHub contributions

Read-only summary, commit history with line counts and contributor totals of the GitHub repositories the API is configured with.

How these endpoints fit together: [GitHub contributions guide](../github-contributions.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## GitHub

### GET /api/v1/github/repositories

List the GitHub repositories the API may read

`configured`: the ones pinned in GITHUB_REPOSITORIES, in that order. `discovered` (GITHUB_REPOSITORIES empty): the token account's own public repositories (no forks) and the public repositories it recently contributed to, most recently pushed first. `off`: no GITHUB_TOKEN, an empty list. Discovery reads GitHub: 503 SERVICE_UNAVAILABLE / 502 EXTERNAL_SERVICE_ERROR when it fails and no earlier list can be served.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GITHUB`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubController_listRepositories` · [source](../../../apps/api/src/modules/github/github.controller.ts)

**Response 200 OK** (`application/json`) — The repositories the API may read (empty when the integration is off)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.account` | string \| null | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.repositories` | object[] | yes | 0–100 items |
| `data.repositories[].fullName` | string | yes | at most 140 characters |
| `data.repositories[].owner` | string | yes | GitHub user or organization; length 1–39; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$` |
| `data.repositories[].pushedAt` | integer \| null | yes |  |
| `data.repositories[].relationship` | "configured" \| "owned" \| "contributed" | yes |  |
| `data.repositories[].repository` | string | yes | GitHub repository name; length 1–100; pattern `^[A-Za-z0-9._-]+$` |
| `data.source` | "off" \| "configured" \| "discovered" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/repositories/{owner}/{repository}

Summary of a configured repository: stars, forks, languages, commit count, last push

404 NOT_FOUND when the repository is not in the list (GET /github/repositories), or GitHub no longer shows it to the API's token. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting the token, and 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer (up to an hour past its cache lifetime) can be served instead.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GITHUB`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubController_getRepositorySummary` · [source](../../../apps/api/src/modules/github/github.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or organization |
| `repository` | path | string | yes | GitHub repository name |

**Response 200 OK** (`application/json`) — Repository summary

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.defaultBranch` | string \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.forks` | integer | yes |  |
| `data.fullName` | string | yes |  |
| `data.htmlUrl` | string (uri) | yes |  |
| `data.languages` | object[] | yes | 0–10 items |
| `data.languages[].bytes` | integer | yes |  |
| `data.languages[].color` | string \| null | yes | pattern `^#[0-9A-Fa-f]{6}$` |
| `data.languages[].name` | string | yes | length 1–100 |
| `data.languages[].percent` | number | yes | range 0–100 |
| `data.openIssues` | integer | yes |  |
| `data.owner` | string | yes | GitHub user or organization; length 1–39; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$` |
| `data.primaryLanguage` | string \| null | yes |  |
| `data.pushedAt` | integer \| null | yes |  |
| `data.repository` | string | yes | GitHub repository name; length 1–100; pattern `^[A-Za-z0-9._-]+$` |
| `data.stars` | integer | yes |  |
| `data.totalCommits` | integer | yes |  |
| `data.watchers` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/repositories/{owner}/{repository}/commits

One page of a configured repository's commit history with lines added/deleted per commit

Newest first; pass `nextCursor` back as `cursor` for the next (older) page. 404 NOT_FOUND when the repository is not in the list (GET /github/repositories), or GitHub no longer shows it to the API's token. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting the token, and 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer (up to an hour past its cache lifetime) can be served instead.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GITHUB`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubController_getCommitPage` · [source](../../../apps/api/src/modules/github/github.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or organization |
| `repository` | path | string | yes | GitHub repository name |
| `cursor` | query | string | no | `nextCursor` of the previous page; omit for the newest commits |
| `limit` | query | integer | no | Commits per page (1-50) |

**Response 200 OK** (`application/json`) — Commits, newest first, and the cursor of the next page

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
| `data.nextCursor` | string \| null | yes | at most 200 characters |
| `data.totalCommits` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/repositories/{owner}/{repository}/commits/{sha}

One commit of a configured repository: its message, parents and every changed file with its diff

Diffs are unified patches (hunks only). A file's diff is `too-large` past 20,000 characters or once the commit's diffs reach 200,000 together, and `unavailable` when GitHub sends none (binary files). At most 100 files; `filesTruncated` says the commit changed more. 404 NOT_FOUND also when the repository has no commit with this SHA. 404 NOT_FOUND when the repository is not in the list (GET /github/repositories), or GitHub no longer shows it to the API's token. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting the token, and 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer (up to an hour past its cache lifetime) can be served instead.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GITHUB`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubController_getCommit` · [source](../../../apps/api/src/modules/github/github.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or organization |
| `repository` | path | string | yes | GitHub repository name |
| `sha` | path | string | yes | Full commit SHA (40 lowercase hex characters) |

**Response 200 OK** (`application/json`) — The commit and its changed files

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
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/github/repositories/{owner}/{repository}/contributors

Commits and lines added/deleted per contributor of a configured repository

From GitHub's contributor statistics (`basis.kind: "statistics"`, the whole default branch). GitHub recomputes those after every push; until they are ready the API counts the default branch's latest commits itself, at most 1,000 (`basis.kind: "history"`, `complete` when that is all of them). Merge commits and commits by authors without a GitHub account are credited to no one. 404 NOT_FOUND when the repository is not in the list (GET /github/repositories), or GitHub no longer shows it to the API's token. 503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting the token, and 502 EXTERNAL_SERVICE_ERROR when it answers with an error — both only when no earlier answer (up to an hour past its cache lifetime) can be served instead.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GITHUB`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `GithubController_getContributorStats` · [source](../../../apps/api/src/modules/github/github.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `owner` | path | string | yes | GitHub user or organization |
| `repository` | path | string | yes | GitHub repository name |

**Response 200 OK** (`application/json`) — Contributor totals, most commits first, and what they were counted from

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.basis` | object | yes |  |
| `data.basis.⟨shape 1⟩ kind` | "statistics" | yes |  |
| `data.basis.⟨shape 2⟩ commitsCounted` | integer | yes | range 0–1000 |
| `data.basis.⟨shape 2⟩ complete` | boolean | yes |  |
| `data.basis.⟨shape 2⟩ kind` | "history" | yes |  |
| `data.contributors` | object[] | yes | 0–100 items |
| `data.contributors[].additions` | integer | yes |  |
| `data.contributors[].avatarUrl` | string (uri) \| null | yes |  |
| `data.contributors[].commits` | integer | yes |  |
| `data.contributors[].deletions` | integer | yes |  |
| `data.contributors[].htmlUrl` | string (uri) | yes |  |
| `data.contributors[].login` | string | yes | GitHub account login; length 1–44; pattern `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\[bot\])?$` |
| `data.status` | "ready" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Stated in the endpoint description. |
| 503 | `SERVICE_UNAVAILABLE` | Stated in the endpoint description. |
| 502 | `EXTERNAL_SERVICE_ERROR` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
