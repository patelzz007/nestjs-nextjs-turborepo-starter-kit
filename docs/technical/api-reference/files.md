---
title: "API reference — Files and object storage"
description: "Direct-to-storage uploads (upload ticket → upload → complete), signed downloads, deletion and the scanner callback."
order: 8
author: "Generated from the OpenAPI export"
lastUpdated: 1792540800000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Files and object storage

Direct-to-storage uploads (upload ticket → upload → complete), signed downloads, deletion and the scanner callback.

How these endpoints fit together: [Object storage guide](../storage/overview.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Files

### GET /api/v1/files/{fileId}

Get file metadata

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FilesController_getFile` · [source](../../../apps/api/src/contexts/files/presentation/http/files.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `fileId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — File metadata

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.file` | object | yes |  |
| `data.file.category` | "PRODUCT_IMAGE" \| "STORE_LOGO" \| "STORE_BANNER" \| "USER_AVATAR" \| "MERCHANT_KYB" \| "REWARD_IMAGE" \| "GITHUB_COMMENT_IMAGE" \| "KANBAN_TASK_ATTACHMENT" | yes |  |
| `data.file.id` | string (uuid) | yes |  |
| `data.file.mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.file.originalName` | string | yes |  |
| `data.file.publicUrl` | string \| null | yes |  |
| `data.file.scanStatus` | "SCANNING" \| "CLEAN" \| "INFECTED" \| "NOT_SCANNED" \| null | yes |  |
| `data.file.sizeBytes` | integer | yes |  |
| `data.file.status` | "PENDING" \| "UPLOADED" \| "PROCESSING" \| "SCANNING" \| "READY" \| "FAILED" \| "QUARANTINED" \| "DELETED" | yes |  |
| `data.file.uploadedAt` | integer | yes |  |
| `data.file.visibility` | "PUBLIC" \| "PRIVATE" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/files/01a15e74-65f3-72b2-9b47-dc2b68df560b
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "file": {
      "id": "01a15e74-65f3-72b2-9b47-dc2b68df560b",
      "category": "USER_AVATAR",
      "visibility": "PUBLIC",
      "originalName": "sample.png",
      "mimeType": "image/png",
      "sizeBytes": 2004,
      "status": "READY",
      "scanStatus": "NOT_SCANNED",
      "publicUrl": "http://192.168.100.23:8097/api/v1/files/01a15e74-65f3-72b2-9b47-dc2b68df560b/local-public",
      "uploadedAt": 1792586049019
    }
  },
  "meta": {
    "correlationId": "uJXH39CVAYv7WaW7oWAlD",
    "timestamp": 1792586050834
  }
}
```

### DELETE /api/v1/files/{fileId}

Soft-delete a file and queue physical deletion

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FilesController_deleteFile` · [source](../../../apps/api/src/contexts/files/presentation/http/files.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `fileId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — File queued for deletion

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.success` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/files/01a15e74-6daf-7588-9cd9-de687eaf77f1
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "success": true
  },
  "meta": {
    "correlationId": "4M_BoordRXXZIKdNGwWWl",
    "timestamp": 1792586052972
  }
}
```

### POST /api/v1/files/{fileId}/complete

Complete a direct upload after browser upload

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FilesController_completeUpload` · [source](../../../apps/api/src/contexts/files/presentation/http/files.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `fileId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `checksumSha256` | string | yes | exactly 64 characters |

**Response 201 Created** (`application/json`) — Upload verified and queued for processing

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.file` | object | yes |  |
| `data.file.category` | "PRODUCT_IMAGE" \| "STORE_LOGO" \| "STORE_BANNER" \| "USER_AVATAR" \| "MERCHANT_KYB" \| "REWARD_IMAGE" \| "GITHUB_COMMENT_IMAGE" \| "KANBAN_TASK_ATTACHMENT" | yes |  |
| `data.file.id` | string (uuid) | yes |  |
| `data.file.mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.file.originalName` | string | yes |  |
| `data.file.publicUrl` | string \| null | yes |  |
| `data.file.scanStatus` | "SCANNING" \| "CLEAN" \| "INFECTED" \| "NOT_SCANNED" \| null | yes |  |
| `data.file.sizeBytes` | integer | yes |  |
| `data.file.status` | "PENDING" \| "UPLOADED" \| "PROCESSING" \| "SCANNING" \| "READY" \| "FAILED" \| "QUARANTINED" \| "DELETED" | yes |  |
| `data.file.uploadedAt` | integer | yes |  |
| `data.file.visibility` | "PUBLIC" \| "PRIVATE" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/files/01a15e74-65f3-72b2-9b47-dc2b68df560b/complete
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "checksumSha256": "79dc184da4077faf9a1025d14d8cc30faceea511c4fee4ba4deb4de2d486a8a2"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "file": {
      "id": "01a15e74-65f3-72b2-9b47-dc2b68df560b",
      "category": "USER_AVATAR",
      "visibility": "PUBLIC",
      "originalName": "sample.png",
      "mimeType": "image/png",
      "sizeBytes": 2004,
      "status": "SCANNING",
      "scanStatus": "SCANNING",
      "publicUrl": null,
      "uploadedAt": 1792586049019
    }
  },
  "meta": {
    "correlationId": "5PaZNe6jc30HVgZ9i7ZVT",
    "timestamp": 1792586049255
  }
}
```

### GET /api/v1/files/{fileId}/download-url

Get a short-lived download URL for a private file

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `FilesController_getDownloadUrl` · [source](../../../apps/api/src/contexts/files/presentation/http/files.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `fileId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Signed download URL

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.downloadUrl` | string \| null | yes |  |
| `data.expiresAt` | integer \| null | yes |  |
| `data.fileId` | string (uuid) | yes |  |
| `data.status` | "PENDING" \| "UPLOADED" \| "PROCESSING" \| "SCANNING" \| "READY" \| "FAILED" \| "QUARANTINED" \| "DELETED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/files/01a15e74-65f3-72b2-9b47-dc2b68df560b/download-url
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "fileId": "01a15e74-65f3-72b2-9b47-dc2b68df560b",
    "status": "READY",
    "downloadUrl": "http://192.168.100.23:8097/api/v1/files/local-download?token=<redacted>",
    "expiresAt": 1792586350887
  },
  "meta": {
    "correlationId": "7vlUyXHqDyIfAVBwOkWCH",
    "timestamp": 1792586050887
  }
}
```

### GET /api/v1/files/{fileId}/local-public

Serve a READY public asset from local storage (development only)

- **Public** — no session required.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `LocalStorageTransferController_localPublic` · [source](../../../apps/api/src/contexts/files/presentation/http/local-storage-transfer.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `fileId` | path | string (uuid) | yes |  |

**Response 200 OK** — Object bytes

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /api/v1/files/01a15e74-6daf-7588-9cd9-de687eaf77f1/local-public
X-Client-Type: web
```

Response `200 OK` (image/png):

```text
<2003 bytes of image/png>
```

### POST /api/v1/files/{fileId}/local-upload

Receive a browser multipart upload for a signed local-storage ticket (development only)

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `LocalStorageTransferController_localUpload` · [source](../../../apps/api/src/contexts/files/presentation/http/local-storage-transfer.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `fileId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Local upload stored

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.success` | true | yes | The action completed |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as the browser, posting to the upload ticket (no session needed).

```http
POST /api/v1/files/01a15e74-65f3-72b2-9b47-dc2b68df560b/local-upload
Content-Type: multipart/form-data

{
  "multipart/form-data": {
    "key": "staging/users/01a15e72-17fb-723a-bb91-d4b541411c4e/avatar/01a15e74-65f3-72b2-9b47-dc2b68df560b-sample.png",
    "token": "<redacted: one-time secret>",
    "file": "<the image bytes: sample.png, image/png>"
  }
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "success": true
  },
  "meta": {
    "correlationId": "t74RpBtyXuMeOlbSMv_zX",
    "timestamp": 1792586049094
  }
}
```

### GET /api/v1/files/{fileId}/variants/{variant}/local-public

Serve a rendition of a READY public image from local storage (development only)

- **Public** — no session required.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `LocalStorageTransferController_localPublicVariant` · [source](../../../apps/api/src/contexts/files/presentation/http/local-storage-transfer.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `fileId` | path | string (uuid) | yes |  |
| `variant` | path | "ORIGINAL" \| "THUMBNAIL" \| "MEDIUM" \| "LARGE" \| "XLARGE" \| "UHD" | yes |  |

**Response 200 OK** — Object bytes

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/files/local-download

Download a private object through a signed, expiring local-storage link (development only)

- **Public** — no session required.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `LocalStorageTransferController_localDownload` · [source](../../../apps/api/src/contexts/files/presentation/http/local-storage-transfer.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `token` | query | string | yes |  |

**Response 200 OK** — Object bytes

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as the browser, following the signed download link (no session needed).

```http
GET /api/v1/files/local-download?token=%3Credacted%3A+one-time+secret%3E
```

Response `200 OK` (image/png):

```text
<2003 bytes of image/png>
```

### POST /api/v1/files/processing-callback

External processing callback for file lifecycle updates

Applies an out-of-process scanner/processing result. Accepted only while the file is awaiting a verdict (SCANNING); any later delivery — including a replay — is rejected with 409.

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FilesController_processingCallback` · [source](../../../apps/api/src/contexts/files/presentation/http/files.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fileId` | string (uuid) | yes |  |
| `finalStoragePath` | string | no | at least 1 characters |
| `scanResult` | string | no |  |
| `scanStatus` | "SCANNING" \| "CLEAN" \| "INFECTED" \| "NOT_SCANNED" | no |  |
| `status` | "READY" \| "FAILED" \| "QUARANTINED" | yes |  |
| `variants` | object[] | no |  |
| `variants[].id` | string (uuid) | yes |  |
| `variants[].kind` | "ORIGINAL" \| "THUMBNAIL" \| "MEDIUM" \| "LARGE" \| "XLARGE" \| "UHD" | yes |  |
| `variants[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `variants[].publicUrl` | string \| null | yes |  |
| `variants[].sizeBytes` | integer | yes |  |

**Response 201 Created** (`application/json`) — Processing result applied

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.success` | true | yes | The action completed |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as the malware-scanning service (shared callback secret). The file was already READY (MALWARE_SCANNER=none finalizes on complete), so this shows the state-conflict answer; a scanner posts while the file is SCANNING.

```http
POST /api/v1/files/processing-callback
Content-Type: application/json

{
  "fileId": "01a15e74-6daf-7588-9cd9-de687eaf77f1",
  "status": "READY",
  "scanStatus": "CLEAN"
}
```

Response `401 Unauthorized` (application/json):

```json
{
  "success": false,
  "error": {
    "code": "CALLBACK_UNAUTHORIZED",
    "message": "Invalid processing callback secret"
  },
  "meta": {
    "correlationId": "90sEazRTBcq0msPgL2szH",
    "timestamp": 1792586052753
  }
}
```

### POST /api/v1/files/upload-url

Create a browser upload ticket

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `FilesController_createUploadUrl` · [source](../../../apps/api/src/contexts/files/presentation/http/files.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `category` | "PRODUCT_IMAGE" \| "USER_AVATAR" \| "GITHUB_COMMENT_IMAGE" \| "KANBAN_TASK_ATTACHMENT" | yes |  |
| `checksumSha256` | string | yes | exactly 64 characters |
| `fileName` | string | yes | length 1–255 |
| `mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `productId` | string (uuid) | no |  |
| `sizeBytes` | integer | yes |  |
| `userId` | string (uuid) | no |  |

**Response 201 Created** (`application/json`) — Browser upload ticket created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.expiresIn` | integer | yes |  |
| `data.fields` | object | no |  |
| `data.fileId` | string (uuid) | yes |  |
| `data.headers` | object | no |  |
| `data.method` | "POST_MULTIPART" \| "PUT" | yes |  |
| `data.objectPath` | string | yes | at least 1 characters |
| `data.uploadUrl` | string (uri) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/files/upload-url
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "category": "USER_AVATAR",
  "fileName": "sample.png",
  "mimeType": "image/png",
  "sizeBytes": 2004,
  "checksumSha256": "79dc184da4077faf9a1025d14d8cc30faceea511c4fee4ba4deb4de2d486a8a2",
  "userId": "01a15e72-17fb-723a-bb91-d4b541411c4e"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "fileId": "01a15e74-65f3-72b2-9b47-dc2b68df560b",
    "objectPath": "staging/users/01a15e72-17fb-723a-bb91-d4b541411c4e/avatar/01a15e74-65f3-72b2-9b47-dc2b68df560b-sample.png",
    "expiresIn": 300,
    "method": "POST_MULTIPART",
    "uploadUrl": "http://192.168.100.23:8097/api/v1/files/01a15e74-65f3-72b2-9b47-dc2b68df560b/local-upload",
    "fields": {
      "key": "staging/users/01a15e72-17fb-723a-bb91-d4b541411c4e/avatar/01a15e74-65f3-72b2-9b47-dc2b68df560b-sample.png",
      "token": "<redacted: one-time secret>"
    }
  },
  "meta": {
    "correlationId": "wqEOyDfO1gHDKfzmmqNV5",
    "timestamp": 1792586049029
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/files/upload-url

Create a browser upload ticket for a tenant-owned file

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantFilesController_createUploadUrl` · [source](../../../apps/api/src/contexts/files/presentation/http/files.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `assetType` | "LOGO" \| "BANNER" | no |  |
| `category` | "STORE_LOGO" \| "STORE_BANNER" \| "REWARD_IMAGE" \| "MERCHANT_KYB" | yes |  |
| `checksumSha256` | string | yes | exactly 64 characters |
| `fileName` | string | yes | length 1–255 |
| `mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `sizeBytes` | integer | yes |  |

**Response 201 Created** (`application/json`) — Browser upload ticket created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.expiresIn` | integer | yes |  |
| `data.fields` | object | no |  |
| `data.fileId` | string (uuid) | yes |  |
| `data.headers` | object | no |  |
| `data.method` | "POST_MULTIPART" \| "PUT" | yes |  |
| `data.objectPath` | string | yes | at least 1 characters |
| `data.uploadUrl` | string (uri) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/files/upload-url
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "category": "REWARD_IMAGE",
  "fileName": "reward.png",
  "mimeType": "image/png",
  "sizeBytes": 8743,
  "checksumSha256": "090ebe74d4090444f1b587e07a6b7023423f3754ee6c40ffc4be4b0162272f4a"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "fileId": "01a15e74-c81e-78e9-9c75-6c80102ffff1",
    "objectPath": "staging/stores/019b76da-a800-7a94-a198-23ad1b4cfdd9/reward-images/01a15e74-c81e-78e9-9c75-6c80102ffff1-reward.png",
    "expiresIn": 300,
    "method": "POST_MULTIPART",
    "uploadUrl": "http://192.168.100.23:8097/api/v1/files/01a15e74-c81e-78e9-9c75-6c80102ffff1/local-upload",
    "fields": {
      "key": "staging/stores/019b76da-a800-7a94-a198-23ad1b4cfdd9/reward-images/01a15e74-c81e-78e9-9c75-6c80102ffff1-reward.png",
      "token": "<redacted: one-time secret>"
    }
  },
  "meta": {
    "correlationId": "DaVg_zEPb85yIL-1F2I9G",
    "timestamp": 1792586074146
  }
}
```
