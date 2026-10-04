---
title: "API reference — Auth, sessions and account security"
description: "Login, signup, email verification, password reset, two-factor authentication, MFA recovery, sessions, impersonation and support access."
order: 2
author: "Generated from the OpenAPI export"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Auth, sessions and account security

Login, signup, email verification, password reset, two-factor authentication, MFA recovery, sessions, impersonation and support access.

How these endpoints fit together: [Account security guide](../../user-guide/10-account-and-security.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Auth

### GET /api/v1/auth/2fa/backup-codes/remaining

Count unused backup codes for the authenticated user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `TwoFactorController_getBackupCodesRemaining` · [source](../../../apps/api/src/modules/auth/two-factor.controller.ts)

**Response 200 OK** — Unused backup code count

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.remaining` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as david.lee@example.com (web app).

```http
GET /api/v1/auth/2fa/backup-codes/remaining
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "remaining": 8
  },
  "meta": {
    "correlationId": "TUGdmgGuEBm3tRfCPBriJ",
    "timestamp": 1791099700727
  }
}
```

### POST /api/v1/auth/2fa/enable

Confirm 2FA enrollment with a TOTP code

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can enable their own 2FA.
- Rate limit: 5 requests per 60 s per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `TwoFactorController_enableTwoFactor` · [source](../../../apps/api/src/modules/auth/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | exactly 6 characters; pattern `^\d{6}$` |

**Response 200 OK** — 2FA enabled

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as henry.moore@example.com (web app).

```http
POST /api/v1/auth/2fa/enable
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "token": "<redacted: one-time secret>"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Two-factor authentication enabled successfully"
  },
  "meta": {
    "correlationId": "ntti8Pe1nGalV1rPaUOw9",
    "timestamp": 1791099703402
  }
}
```

### POST /api/v1/auth/2fa/rotate

Rotate 2FA after confirming password and current TOTP or backup code

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can rotate their own 2FA.
- Rate limit: 5 requests per 60 s per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `TwoFactorController_rotateTwoFactor` · [source](../../../apps/api/src/modules/auth/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupCode` | string | no | exactly 16 characters; pattern `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$` |
| `password` | string | yes | at least 1 characters |
| `token` | string | no | exactly 6 characters; pattern `^\d{6}$` |

**Response 200 OK** — New TOTP secret, QR code and backup codes

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.backupCodes` | string[] | yes | 10–10 items |
| `data.qrCodeDataUrl` | string | yes | at least 1 characters |
| `data.secret` | string | yes | at least 1 characters |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as henry.moore@example.com (web app).

```http
POST /api/v1/auth/2fa/rotate
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "password": "Henry@123",
  "backupCode": "UT2ZJA5Q77TD9975"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "secret": "<redacted: one-time secret>",
    "qrCodeDataUrl": "<redacted: one-time secret>",
    "backupCodes": [
      "<redacted: one-time secret>",
      "<redacted: one-time secret>"
    ]
  },
  "meta": {
    "correlationId": "66Z56x_ZeyoeeGNgmX7Kk",
    "timestamp": 1791099722279
  }
}
```

### POST /api/v1/auth/2fa/setup

Start 2FA enrollment: generate a pending TOTP secret, QR code and backup codes

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can start their own 2FA enrollment.
- Rate limit: 5 requests per 60 s per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `TwoFactorController_startSetup` · [source](../../../apps/api/src/modules/auth/two-factor.controller.ts)

**Request body** (`application/json`, required)

_No fields._

**Response 201 Created** — TOTP secret, QR code and backup codes (pending until confirmed via /2fa/enable)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.backupCodes` | string[] | yes | 10–10 items |
| `data.qrCodeDataUrl` | string | yes | at least 1 characters |
| `data.secret` | string | yes | at least 1 characters |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as henry.moore@example.com (web app).

```http
POST /api/v1/auth/2fa/setup
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "secret": "<redacted: one-time secret>",
    "qrCodeDataUrl": "<redacted: one-time secret>",
    "backupCodes": [
      "<redacted: one-time secret>",
      "<redacted: one-time secret>"
    ]
  },
  "meta": {
    "correlationId": "uEY63yxgPGN-aKzzyojSv",
    "timestamp": 1791099703325
  }
}
```

### POST /api/v1/auth/2fa/verify-backup-code

Verify a backup code while authenticated

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `TwoFactorController_verifyBackupCode` · [source](../../../apps/api/src/modules/auth/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupCode` | string | yes | exactly 16 characters; pattern `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$` |

**Response 200 OK** — Whether the backup code was valid

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.valid` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as henry.moore@example.com (web app).

```http
POST /api/v1/auth/2fa/verify-backup-code
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "backupCode": "5K79S5RCBWJD4CFV"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "valid": true
  },
  "meta": {
    "correlationId": "6tTWaPmMKic0_JxZ92rD9",
    "timestamp": 1791099720760
  }
}
```

### GET /api/v1/auth/admin/mfa/recovery/requests

SuperAdmin: list MFA recovery requests

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Operation id `MfaRecoveryController_listRecoveryRequests` · [source](../../../apps/api/src/modules/auth/mfa-recovery.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: requestedAt, createdAt. Default: -requestedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, userId |

**Response 200 OK** — Paginated MFA recovery requests

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].completedAt` | integer \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].notes` | string \| null | yes |  |
| `data[].requestedAt` | integer | yes |  |
| `data[].reviewedAt` | integer \| null | yes |  |
| `data[].reviewedBy` | string (uuid) \| null | yes |  |
| `data[].scheduledUnlockAt` | integer \| null | yes |  |
| `data[].status` | "PENDING" \| "APPROVED" \| "DENIED" \| "COMPLETED" | yes |  |
| `data[].userEmail` | string | yes |  |
| `data[].userFullName` | string | yes |  |
| `data[].userId` | string (uuid) | yes |  |
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

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/auth/admin/mfa/recovery/requests
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "d7cc8161-5611-44b0-bcf5-c0c69055cd11",
      "userId": "afe1a273-0c88-4409-8925-f7f0d11ea2f9",
      "userEmail": "david.lee@example.com",
      "userFullName": "David Lee",
      "status": "PENDING",
      "requestedAt": 1791099722346,
      "reviewedBy": null,
      "reviewedAt": null,
      "scheduledUnlockAt": null,
      "completedAt": null,
      "notes": "Lost my phone"
    },
    {
      "id": "db7f4a2d-246a-40f7-8c91-c6e16596fa40",
      "userId": "77baf757-d737-4f41-8488-795f24d157eb",
      "userEmail": "bob.smith@example.com",
      "userFullName": "Bob Smith",
      "status": "COMPLETED",
      "requestedAt": 1790235794480,
      "reviewedBy": "1e06b347-4142-4ea4-ab85-7fbca1d1f1c0",
      "reviewedAt": 1790322074480,
      "scheduledUnlockAt": 1790408474480,
      "completedAt": 1790408474480,
      "notes": "Lost authenticator device; identity verified by video call against government ID."
    }
  ],
  "meta": {
    "limit": 20,
    "total": 2,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "qa3WKAgYySMPWQAwGNRg8",
    "timestamp": 1791099722428
  }
}
```

### POST /api/v1/auth/admin/mfa/recovery/review

SuperAdmin: approve or deny an MFA recovery request

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Policy** `UPDATE:USER` — SuperAdmin can review MFA recovery requests.
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `MfaRecoveryController_reviewRecovery` · [source](../../../apps/api/src/modules/auth/mfa-recovery.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | "approve" \| "deny" | yes |  |
| `notes` | string | no |  |
| `requestId` | string (uuid) | yes |  |

**Response 200 OK** — Reviewed recovery request status

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |
| `data.scheduledUnlockAt` | integer | no |  |
| `data.status` | "PENDING" \| "APPROVED" \| "DENIED" \| "COMPLETED" \| "NONE" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/auth/admin/mfa/recovery/review
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "requestId": "d7cc8161-5611-44b0-bcf5-c0c69055cd11",
  "action": "deny",
  "notes": "Identity not confirmed"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "status": "DENIED",
    "message": "Your MFA recovery request was denied."
  },
  "meta": {
    "correlationId": "PB6B7hK0VkWj7VhXlj7SI",
    "timestamp": 1791099722460
  }
}
```

### GET /api/v1/auth/admin/users

SuperAdmin: list all users with roles and lockout status

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `LIST:USER`.
- Operation id `AuthController_getAdminUsersList` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: fullName, email, createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, role |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** — Paginated admin user list

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].directPermissionIds` | string[] | yes | Permission IDs granted directly to this user (not via roles) |
| `data[].email` | string | yes |  |
| `data[].failedLoginAttempts` | integer | yes | Number of consecutive failed login attempts |
| `data[].fullName` | string | yes |  |
| `data[].hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data[].id` | string | yes |  |
| `data[].isActive` | boolean | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].isEmailVerified` | boolean | yes |  |
| `data[].isSuperAdmin` | boolean | yes |  |
| `data[].lockedUntil` | integer \| null | yes | Epoch ms when the account lockout expires (null = not locked) |
| `data[].permissions` | object[] | yes |  |
| `data[].permissions[].action` | string | yes |  |
| `data[].permissions[].description` | string \| null | yes |  |
| `data[].permissions[].group` | string \| null | yes |  |
| `data[].permissions[].id` | string | yes |  |
| `data[].permissions[].resource` | string | yes |  |
| `data[].roles` | object[] | yes |  |
| `data[].roles[].description` | string \| null | yes |  |
| `data[].roles[].id` | string | yes |  |
| `data[].roles[].name` | string | yes |  |
| `data[].tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data[].twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data[].updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
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
| 403 | — | SuperAdmin privileges required |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/auth/admin/users?limit=5&search=example.com
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1791099631657,
      "updatedAt": 1791099631657,
      "isDeleted": false,
      "deletedAt": null,
      "id": "ec589838-11e3-4131-bc30-542924e99da9",
      "email": "user-20@example.com",
      "fullName": "Abigail Lee",
      "isActive": false,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": false,
      "hasAdminAccess": false,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "1c3e77b3-65d8-4c21-9f3d-a821afaa9363",
          "name": "User",
          "description": "Customer app — own profile, links, tags, and API keys (no admin panel)"
        }
      ],
      "permissions": [],
      "failedLoginAttempts": 0,
      "lockedUntil": null,
      "directPermissionIds": []
    },
    {
      "createdAt": 1791099630545,
      "updatedAt": 1791099630545,
      "isDeleted": false,
      "deletedAt": null,
      "id": "c04d98e9-9f80-4d7b-b4cf-374ed31d7f10",
      "email": "user-19@example.com",
      "fullName": "Daniel Lewis",
      "isActive": false,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": false,
      "hasAdminAccess": false,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "1c3e77b3-65d8-4c21-9f3d-a821afaa9363",
          "name": "User",
          "description": "Customer app — own profile, links, tags, and API keys (no admin panel)"
        }
      ],
      "permissions": [],
      "failedLoginAttempts": 0,
      "lockedUntil": null,
      "directPermissionIds": []
    }
  ],
  "meta": {
    "limit": 5,
    "total": 35,
    "page": 1,
    "totalPages": 7,
    "nextCursor": "eyJhdCI6MTc5MTA5OTYyNzAxNywiaWQiOiI5YjJmODVkNi1mZTUxLTQ3NGQtYmNiNy02MDY3MDJiMTdlMmIifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "mER5WgRmKXUPGPRmVaaqJ",
    "timestamp": 1791099697129
  }
}
```

### GET /api/v1/auth/admin/users/{userId}

SuperAdmin: get detailed user info including security state

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `READ:USER`.
- Operation id `AuthController_getAdminUserDetail` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 200 OK** — Full user detail with lockout status

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.directPermissionIds` | string[] | yes | Permission IDs granted directly to this user (not via roles) |
| `data.email` | string | yes |  |
| `data.failedLoginAttempts` | integer | yes | Number of consecutive failed login attempts |
| `data.fullName` | string | yes |  |
| `data.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isEmailVerified` | boolean | yes |  |
| `data.isSuperAdmin` | boolean | yes |  |
| `data.lockedUntil` | integer \| null | yes | Epoch ms when the account lockout expires (null = not locked) |
| `data.permissions` | object[] | yes |  |
| `data.permissions[].action` | string | yes |  |
| `data.permissions[].description` | string \| null | yes |  |
| `data.permissions[].group` | string \| null | yes |  |
| `data.permissions[].id` | string | yes |  |
| `data.permissions[].resource` | string | yes |  |
| `data.roles` | object[] | yes |  |
| `data.roles[].description` | string \| null | yes |  |
| `data.roles[].id` | string | yes |  |
| `data.roles[].name` | string | yes |  |
| `data.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 404 | — | User not found |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/auth/admin/users/50f966ee-c2db-4828-a6ef-3e088d34e080
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791099608530,
    "updatedAt": 1791099608530,
    "isDeleted": false,
    "deletedAt": null,
    "id": "50f966ee-c2db-4828-a6ef-3e088d34e080",
    "email": "grace.wilson@example.com",
    "fullName": "Grace Wilson",
    "isActive": true,
    "isSuperAdmin": false,
    "isEmailVerified": false,
    "twoFactorEnabled": false,
    "hasAdminAccess": false,
    "tokenVersion": 0,
    "roles": [
      {
        "id": "1c3e77b3-65d8-4c21-9f3d-a821afaa9363",
        "name": "User",
        "description": "Customer app — own profile, links, tags, and API keys (no admin panel)"
      }
    ],
    "permissions": [
      {
        "id": "89942508-ed71-4c14-abdc-3212fc486d3d",
        "action": "READ",
        "resource": "PROFILE",
        "description": "View own profile",
        "group": "Own Records"
      },
      {
        "id": "0a018761-0bba-48d0-afc0-710bac7d55f4",
        "action": "UPDATE",
        "resource": "PROFILE",
        "description": "Update own profile",
        "group": "Own Records"
      }
    ],
    "failedLoginAttempts": 5,
    "lockedUntil": 1791100574480,
    "directPermissionIds": []
  },
  "meta": {
    "correlationId": "gvZKVGNp89sXhv2mtslgE",
    "timestamp": 1791099697205
  }
}
```

### PATCH /api/v1/auth/admin/users/{userId}/unlock

SuperAdmin: unlock a locked user account

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `UPDATE:USER`.
- **Policy** `UPDATE:USER` — SuperAdmin can unlock any user account.
- Requires a **verified email address**.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `AuthController_unlockUser` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 200 OK** — Account unlocked

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 404 | — | User not found |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/auth/admin/users/50f966ee-c2db-4828-a6ef-3e088d34e080/unlock
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "User account has been unlocked successfully."
  },
  "meta": {
    "correlationId": "tIzd36lVCZf2FrWS2KGSs",
    "timestamp": 1791099697222
  }
}
```

### POST /api/v1/auth/change-password

Change password for the authenticated user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can only change their own password.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `AuthController_changePassword` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `confirmPassword` | string | yes | at least 1 characters |
| `currentPassword` | string | yes | at least 1 characters |
| `newPassword` | string | yes | at least 8 characters |

**Response 200 OK** — Password changed successfully

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.cashier@kl-rewards.demo (merchant portal).

```http
POST /api/v1/auth/change-password
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "currentPassword": "BrewCashier@123",
  "newPassword": "BrewCashier@2026",
  "confirmPassword": "BrewCashier@2026"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  },
  "meta": {
    "correlationId": "eE6LbMEDOuF5NDN0JC7m4",
    "timestamp": 1791099699598
  }
}
```

### POST /api/v1/auth/forgot-password

Request a password reset email

- **Public** — no session required.
- Rate limit: 3 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `AuthController_forgotPassword` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_type` | query | "web" \| "admin" \| "merchant" | no | Which frontend initiated the action (fallback for the X-Client-Type header). |
| `x-client-type` | header | string | no | Set to 'admin' or 'merchant' so the reset link targets the correct frontend. Defaults to the web app. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | The email address associated with the user account; at most 100 characters |

**Response 200 OK** — Password reset email sent (if account exists)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/auth/forgot-password
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "email": "isla.taylor@example.com"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "If an account with that email exists, a password reset link has been sent."
  },
  "meta": {
    "correlationId": "6hzbinYKWFK2qg-isfXPG",
    "timestamp": 1791099697581
  }
}
```

### POST /api/v1/auth/login

Authenticate with email and password

- **Public** — no session required.
- Rate limit: 5 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `AuthController_login` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_type` | query | "web" \| "admin" \| "merchant" | no | Which frontend initiated the action (fallback for the X-Client-Type header). |
| `x-client-type` | header | string | no | Set to 'admin' when logging in from the admin panel. Only users with isSuperAdmin === true or the ADMIN_DASHBOARD permission may use this. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | User email address; at most 100 characters |
| `password` | string | yes | User password; at least 1 characters |

**Response 201 Created** — Login result — tokens are set as httpOnly cookies and never appear in the body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ organizationSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 1⟩ user` | object | no |  |
| `data.⟨shape 1⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 1⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 1⟩ user.email` | string | yes |  |
| `data.⟨shape 1⟩ user.fullName` | string | yes |  |
| `data.⟨shape 1⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 1⟩ user.id` | string | yes |  |
| `data.⟨shape 1⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 1⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 1⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 1⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 1⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 1⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 1⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 1⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 1⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 1⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 1⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 2⟩ message` | string | yes |  |
| `data.⟨shape 2⟩ requiresTwoFactor` | true | yes |  |
| `data.⟨shape 2⟩ tempToken` | string | yes | at least 1 characters |
| `data.⟨shape 3⟩ message` | string | yes |  |
| `data.⟨shape 3⟩ requiresVerification` | true | yes |  |
| `data.⟨shape 3⟩ verificationId` | string | yes | at least 1 characters |
| `data.⟨shape 4⟩ user` | object | yes |  |
| `data.⟨shape 4⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 4⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 4⟩ user.email` | string | yes |  |
| `data.⟨shape 4⟩ user.fullName` | string | yes |  |
| `data.⟨shape 4⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 4⟩ user.id` | string | yes |  |
| `data.⟨shape 4⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 4⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 4⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 4⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 4⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 4⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 4⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 4⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 4⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 4⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 4⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | — | Invalid credentials / Account locked |
| 403 | — | Admin access required (when X-Client-Type: admin and user is not superadmin) |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/auth/login
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "email": "superadmin@example.com",
  "password": "SuperAdmin@123"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "user": {
      "createdAt": 1791099608504,
      "updatedAt": 1791099608504,
      "isDeleted": false,
      "deletedAt": null,
      "id": "1e06b347-4142-4ea4-ab85-7fbca1d1f1c0",
      "email": "superadmin@example.com",
      "fullName": "Super Admin",
      "isActive": true,
      "isSuperAdmin": true,
      "isEmailVerified": true,
      "twoFactorEnabled": false,
      "hasAdminAccess": true,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "866b0d60-4c13-452b-b621-aa1d883330b2",
          "name": "SuperAdmin",
          "description": "Full system access (platform operator)"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "uqhQbx8xghOOjD_DIwcC1",
    "timestamp": 1791099695755
  }
}
```

### POST /api/v1/auth/login/2fa

Complete login with a TOTP code

- **Public** — no session required.
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `TwoFactorController_loginWithTwoFactor` · [source](../../../apps/api/src/modules/auth/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `tempToken` | string | yes | at least 1 characters |
| `token` | string | yes | exactly 6 characters; pattern `^\d{6}$` |

**Response 200 OK** — Login result — tokens are set as httpOnly cookies and never appear in the body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ organizationSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 1⟩ user` | object | no |  |
| `data.⟨shape 1⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 1⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 1⟩ user.email` | string | yes |  |
| `data.⟨shape 1⟩ user.fullName` | string | yes |  |
| `data.⟨shape 1⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 1⟩ user.id` | string | yes |  |
| `data.⟨shape 1⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 1⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 1⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 1⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 1⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 1⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 1⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 1⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 1⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 1⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 1⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 2⟩ message` | string | yes |  |
| `data.⟨shape 2⟩ requiresTwoFactor` | true | yes |  |
| `data.⟨shape 2⟩ tempToken` | string | yes | at least 1 characters |
| `data.⟨shape 3⟩ message` | string | yes |  |
| `data.⟨shape 3⟩ requiresVerification` | true | yes |  |
| `data.⟨shape 3⟩ verificationId` | string | yes | at least 1 characters |
| `data.⟨shape 4⟩ user` | object | yes |  |
| `data.⟨shape 4⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 4⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 4⟩ user.email` | string | yes |  |
| `data.⟨shape 4⟩ user.fullName` | string | yes |  |
| `data.⟨shape 4⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 4⟩ user.id` | string | yes |  |
| `data.⟨shape 4⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 4⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 4⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 4⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 4⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 4⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 4⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 4⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 4⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 4⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 4⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as david.lee@example.com (web app).

```http
POST /api/v1/auth/login/2fa
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "tempToken": "<redacted: one-time secret>",
  "token": "<redacted: one-time secret>"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "requiresEnrollment": true,
    "enrollmentReason": "email_verification",
    "message": "Verify your email address to continue.",
    "user": {
      "createdAt": 1791099608526,
      "updatedAt": 1791099700339,
      "isDeleted": false,
      "deletedAt": null,
      "id": "afe1a273-0c88-4409-8925-f7f0d11ea2f9",
      "email": "david.lee@example.com",
      "fullName": "David Lee",
      "isActive": true,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": true,
      "hasAdminAccess": true,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "3cdd637e-5cd8-416d-9df1-9475e825e66f",
          "name": "Manager",
          "description": "Admin panel — read/update users and reports (no RBAC or system settings)"
        },
        {
          "id": "2856e233-c666-402b-8dc9-a3cb9d306d15",
          "name": "Support Agent",
          "description": "Support desk — Support Viewer plus correcting customer account details"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "k2Y8jMlhrK1WmsKPppwyI",
    "timestamp": 1791099700694
  }
}
```

### POST /api/v1/auth/login/backup-code

Complete login with a one-time backup code

- **Public** — no session required.
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `TwoFactorController_loginWithBackupCode` · [source](../../../apps/api/src/modules/auth/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupCode` | string | yes | exactly 16 characters; pattern `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$` |
| `tempToken` | string | yes | at least 1 characters |

**Response 200 OK** — Login result — tokens are set as httpOnly cookies and never appear in the body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ organizationSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 1⟩ user` | object | no |  |
| `data.⟨shape 1⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 1⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 1⟩ user.email` | string | yes |  |
| `data.⟨shape 1⟩ user.fullName` | string | yes |  |
| `data.⟨shape 1⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 1⟩ user.id` | string | yes |  |
| `data.⟨shape 1⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 1⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 1⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 1⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 1⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 1⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 1⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 1⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 1⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 1⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 1⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 2⟩ message` | string | yes |  |
| `data.⟨shape 2⟩ requiresTwoFactor` | true | yes |  |
| `data.⟨shape 2⟩ tempToken` | string | yes | at least 1 characters |
| `data.⟨shape 3⟩ message` | string | yes |  |
| `data.⟨shape 3⟩ requiresVerification` | true | yes |  |
| `data.⟨shape 3⟩ verificationId` | string | yes | at least 1 characters |
| `data.⟨shape 4⟩ user` | object | yes |  |
| `data.⟨shape 4⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 4⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 4⟩ user.email` | string | yes |  |
| `data.⟨shape 4⟩ user.fullName` | string | yes |  |
| `data.⟨shape 4⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 4⟩ user.id` | string | yes |  |
| `data.⟨shape 4⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 4⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 4⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 4⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 4⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 4⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 4⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 4⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 4⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 4⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 4⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as david.lee@example.com (web app).

```http
POST /api/v1/auth/login/backup-code
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "tempToken": "<redacted: one-time secret>",
  "backupCode": "43JYH5JPNXH44GV2"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "requiresEnrollment": true,
    "enrollmentReason": "email_verification",
    "message": "Verify your email address to continue.",
    "user": {
      "createdAt": 1791099608526,
      "updatedAt": 1791099701375,
      "isDeleted": false,
      "deletedAt": null,
      "id": "afe1a273-0c88-4409-8925-f7f0d11ea2f9",
      "email": "david.lee@example.com",
      "fullName": "David Lee",
      "isActive": true,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": true,
      "hasAdminAccess": true,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "3cdd637e-5cd8-416d-9df1-9475e825e66f",
          "name": "Manager",
          "description": "Admin panel — read/update users and reports (no RBAC or system settings)"
        },
        {
          "id": "2856e233-c666-402b-8dc9-a3cb9d306d15",
          "name": "Support Agent",
          "description": "Support desk — Support Viewer plus correcting customer account details"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "Q5pxeCOytSS1zCsS67uYr",
    "timestamp": 1791099701696
  }
}
```

### GET /api/v1/auth/me

Get the currently authenticated user's profile

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `AuthController_getMe` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Response 200 OK** — Current user profile

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.email` | string | yes |  |
| `data.fullName` | string | yes |  |
| `data.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isEmailVerified` | boolean | yes |  |
| `data.isSuperAdmin` | boolean | yes |  |
| `data.roles` | object[] | yes |  |
| `data.roles[].description` | string \| null | yes |  |
| `data.roles[].id` | string | yes |  |
| `data.roles[].name` | string | yes |  |
| `data.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | — | Access token missing / invalid |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/auth/me
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791099608504,
    "updatedAt": 1791099608504,
    "isDeleted": false,
    "deletedAt": null,
    "id": "1e06b347-4142-4ea4-ab85-7fbca1d1f1c0",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "isActive": true,
    "isSuperAdmin": true,
    "isEmailVerified": true,
    "twoFactorEnabled": false,
    "hasAdminAccess": true,
    "tokenVersion": 0,
    "roles": [
      {
        "id": "866b0d60-4c13-452b-b621-aa1d883330b2",
        "name": "SuperAdmin",
        "description": "Full system access (platform operator)"
      }
    ]
  },
  "meta": {
    "correlationId": "0iTy3lc82DZ0ZR_BaAWEZ",
    "timestamp": 1791099696451
  }
}
```

### POST /api/v1/auth/mfa/recovery

Initiate an admin-reviewed MFA recovery request

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can initiate MFA recovery for their own account.
- Rate limit: 3 requests per 60 s per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `MfaRecoveryController_initiateRecovery` · [source](../../../apps/api/src/modules/auth/mfa-recovery.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | no |  |

**Response 200 OK** — Recovery request status

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |
| `data.scheduledUnlockAt` | integer | no |  |
| `data.status` | "PENDING" \| "APPROVED" \| "DENIED" \| "COMPLETED" \| "NONE" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as david.lee@example.com (web app).

```http
POST /api/v1/auth/mfa/recovery
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "reason": "Lost my phone"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "status": "PENDING",
    "message": "MFA recovery request submitted. An administrator will review it shortly."
  },
  "meta": {
    "correlationId": "uGJpZ_plqbTEcDvN4-AUb",
    "timestamp": 1791099722376
  }
}
```

### GET /api/v1/auth/mfa/recovery/status

Get the current MFA recovery request status

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `MfaRecoveryController_getRecoveryStatus` · [source](../../../apps/api/src/modules/auth/mfa-recovery.controller.ts)

**Response 200 OK** — Recovery request status

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |
| `data.scheduledUnlockAt` | integer | no |  |
| `data.status` | "PENDING" \| "APPROVED" \| "DENIED" \| "COMPLETED" \| "NONE" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as david.lee@example.com (web app).

```http
GET /api/v1/auth/mfa/recovery/status
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "status": "PENDING",
    "message": "Your MFA recovery request is pending administrator review."
  },
  "meta": {
    "correlationId": "8fB_xH-LgVNlJgyUitHrb",
    "timestamp": 1791099722415
  }
}
```

### GET /api/v1/auth/permissions

Get the current session's roles and permissions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `AuthController_getSessionPermissions` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Response 200 OK** — Session RBAC payload

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.capabilities` | string[] | yes |  |
| `data.enrollmentReason` | "email_verification" \| "mfa_enrollment" | no |  |
| `data.hasAdminAccess` | boolean | yes |  |
| `data.isImpersonating` | boolean | no |  |
| `data.originalUserId` | string | no |  |
| `data.permissions` | object[] | yes |  |
| `data.permissions[].action` | string | yes |  |
| `data.permissions[].description` | string \| null | yes |  |
| `data.permissions[].group` | string \| null | yes |  |
| `data.permissions[].id` | string | yes |  |
| `data.permissions[].resource` | string | yes |  |
| `data.roles` | object[] | yes |  |
| `data.roles[].description` | string \| null | yes |  |
| `data.roles[].id` | string | yes |  |
| `data.roles[].name` | string | yes |  |
| `data.sessionScope` | "full" \| "restricted" | yes |  |
| `data.tokenVersion` | integer | yes | min -9007199254740991 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | — | Access token missing / invalid |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/auth/permissions
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "id": "866b0d60-4c13-452b-b621-aa1d883330b2",
        "name": "SuperAdmin",
        "description": "Full system access (platform operator)"
      }
    ],
    "permissions": [
      {
        "id": "a8b52efa-4f50-41ca-82b9-a5f664c74f75",
        "action": "CREATE",
        "resource": "USER",
        "description": "Create new users",
        "group": "User Management"
      },
      {
        "id": "81cfabb8-c5d4-4197-8ae1-509f32d53d25",
        "action": "READ",
        "resource": "USER",
        "description": "View user details",
        "group": "User Management"
      }
    ],
    "tokenVersion": 0,
    "hasAdminAccess": true,
    "capabilities": [
      "platform:user.create",
      "platform:user.read"
    ],
    "sessionScope": "full"
  },
  "meta": {
    "correlationId": "nZPIFXTcm1YFh20e4i7WK",
    "timestamp": 1791099696456
  }
}
```

### GET /api/v1/auth/profile

Get the signed-in user's own profile (name, avatar, optimistic-lock version)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `READ:PROFILE (own record only)` — A user reads their own profile.
- Operation id `ProfileController_getOwnProfile` · [source](../../../apps/api/src/modules/auth/profile/profile.controller.ts)

**Response 200 OK** — The signed-in user's own profile

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.avatar` | object \| null | yes | The live avatar, or null when the user has none |
| `data.avatar.fileId` | string (uuid) | yes | The stored file (`GET /files/:fileId`, `DELETE /files/:fileId`) |
| `data.avatar.updatedAt` | integer | yes | When this avatar was bound to the profile (epoch ms) |
| `data.avatar.url` | string (uri) | yes | Public URL of the avatar image |
| `data.createdAt` | integer | yes |  |
| `data.email` | string | yes | Sign-in email (read-only here) |
| `data.fullName` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with `PATCH /auth/profile` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/auth/profile
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "1e06b347-4142-4ea4-ab85-7fbca1d1f1c0",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "avatar": null,
    "version": 0,
    "createdAt": 1791099608504,
    "updatedAt": 1791099608504
  },
  "meta": {
    "correlationId": "JefNAQ01u1c9_xBZFS9Fn",
    "timestamp": 1791099697078
  }
}
```

### PATCH /api/v1/auth/profile

Edit the signed-in user's own profile

Send the `version` read from GET /auth/profile: the change applies only while the profile is still at that version (409 CONFLICT otherwise — reload and retry). Refused (403 PROFILE_UPDATE_DURING_IMPERSONATION) for an impersonation session. The avatar is managed through /files (category USER_AVATAR).

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:PROFILE (own record only)` — A user edits their own profile (never during impersonation).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `ProfileController_updateOwnProfile` · [source](../../../apps/api/src/modules/auth/profile/profile.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fullName` | string | no | The user's full name (trimmed) |
| `version` | integer | yes | The profile `version` this edit is based on (optimistic lock) |

**Response 200 OK** — The updated profile, with its new version

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.avatar` | object \| null | yes | The live avatar, or null when the user has none |
| `data.avatar.fileId` | string (uuid) | yes | The stored file (`GET /files/:fileId`, `DELETE /files/:fileId`) |
| `data.avatar.updatedAt` | integer | yes | When this avatar was bound to the profile (epoch ms) |
| `data.avatar.url` | string (uri) | yes | Public URL of the avatar image |
| `data.createdAt` | integer | yes |  |
| `data.email` | string | yes | Sign-in email (read-only here) |
| `data.fullName` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes | Optimistic-lock token: send it back with `PATCH /auth/profile` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Stated in the endpoint description. |
| 403 | `PROFILE_UPDATE_DURING_IMPERSONATION` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/auth/profile
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "fullName": "Super Admin",
  "version": 0
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "1e06b347-4142-4ea4-ab85-7fbca1d1f1c0",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "avatar": null,
    "version": 1,
    "createdAt": 1791099608504,
    "updatedAt": 1791099697096
  },
  "meta": {
    "correlationId": "g_yjMUTTr_8tKjfgkHurf",
    "timestamp": 1791099697105
  }
}
```

### POST /api/v1/auth/resend-verification

Resend email verification link

- **Public** — no session required.
- Rate limit: 3 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `AuthController_resendVerification` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_type` | query | "web" \| "admin" \| "merchant" | no | Which frontend initiated the action (fallback for the X-Client-Type header). |
| `x-client-type` | header | string | no | Set to 'merchant' so the verification link targets the merchant app. Defaults to the web app. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | The email address to resend verification to; at most 100 characters |

**Response 200 OK** — Verification email resent

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/auth/resend-verification
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "email": "alice.johnson@example.com"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "If an account with that email exists, a verification email has been sent."
  },
  "meta": {
    "correlationId": "4m8_6524YSN9MjHv77qu7",
    "timestamp": 1791099697249
  }
}
```

### POST /api/v1/auth/reset-password

Reset password using a valid reset token

- **Public** — no session required.
- Rate limit: 5 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `AuthController_resetPassword` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `password` | string | yes | New password (min 8 chars, upper+lower+number+special); at least 8 characters |
| `token` | string | yes | The password reset token received via email; at least 1 characters |

**Response 200 OK** — Password reset successful

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | — | Invalid or expired reset token |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/auth/reset-password
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "password": "Isla@123-Reset"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully. Please log in with your new password."
  },
  "meta": {
    "correlationId": "FvOkNzHUHxtr_BdB5cBoV",
    "timestamp": 1791099698459
  }
}
```

### POST /api/v1/auth/signup

Register a new user account

- **Public** — no session required.
- Rate limit: 3 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `AuthController_signup` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_type` | query | "web" \| "admin" \| "merchant" | no | Which frontend initiated the action (fallback for the X-Client-Type header). |
| `x-client-type` | header | string | no | Set to 'merchant' so the verification link targets the merchant app. Defaults to the web app. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | at most 100 characters |
| `fullName` | string | yes | User's full name; at least 2 characters |
| `password` | string | yes | User password (must meet complexity requirements); at least 8 characters |

**Response 201 Created** — User registered

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | — | Email already in use |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as signup (web app). Signs up the seed's pending Jonker Street Kitchen invitee (pending.invite@melaka-rewards.demo), who has no account yet.

```http
POST /api/v1/auth/signup
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "email": "pending.invite@melaka-rewards.demo",
  "fullName": "Nyonya Pending Invitee",
  "password": "Nyonya@123"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "If this email is available, check your inbox for verification instructions."
  },
  "meta": {
    "correlationId": "Gu-kWEdh9BUfs-uj0tvVj",
    "timestamp": 1791099699935
  }
}
```

### POST /api/v1/auth/validate-reset-token

Validate a password reset token without consuming it

- **Public** — no session required.
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `AuthController_validateResetToken` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | at least 1 characters |

**Response 200 OK** — Whether the reset token is valid

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.valid` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/auth/validate-reset-token
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "valid": true
  },
  "meta": {
    "correlationId": "U_R46jEjTIOtniyQFGVFs",
    "timestamp": 1791099697872
  }
}
```

### POST /api/v1/auth/verify-email

Verify email address using a verification token

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `AuthController_verifyEmail` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** — Email verified

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.alreadyVerified` | boolean | yes |  |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/auth/verify-email
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully",
    "alreadyVerified": false
  },
  "meta": {
    "correlationId": "YAcESQRyW2n02ldseTCx9",
    "timestamp": 1791099697275
  }
}
```

### POST /api/v1/auth/verify-login

Complete login with an email verification code

- **Public** — no session required.
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `AuthController_verifyLogin` · [source](../../../apps/api/src/modules/auth/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `code` | string | yes | exactly 6 characters; pattern `^\d{6}$` |
| `verificationId` | string | yes | at least 1 characters |

**Response 200 OK** — Login result after verification — tokens are set as httpOnly cookies

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ organizationSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 1⟩ user` | object | no |  |
| `data.⟨shape 1⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 1⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 1⟩ user.email` | string | yes |  |
| `data.⟨shape 1⟩ user.fullName` | string | yes |  |
| `data.⟨shape 1⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 1⟩ user.id` | string | yes |  |
| `data.⟨shape 1⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 1⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 1⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 1⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 1⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 1⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 1⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 1⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 1⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 1⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 1⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 2⟩ message` | string | yes |  |
| `data.⟨shape 2⟩ requiresTwoFactor` | true | yes |  |
| `data.⟨shape 2⟩ tempToken` | string | yes | at least 1 characters |
| `data.⟨shape 3⟩ message` | string | yes |  |
| `data.⟨shape 3⟩ requiresVerification` | true | yes |  |
| `data.⟨shape 3⟩ verificationId` | string | yes | at least 1 characters |
| `data.⟨shape 4⟩ user` | object | yes |  |
| `data.⟨shape 4⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 4⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 4⟩ user.email` | string | yes |  |
| `data.⟨shape 4⟩ user.fullName` | string | yes |  |
| `data.⟨shape 4⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 4⟩ user.id` | string | yes |  |
| `data.⟨shape 4⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 4⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 4⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 4⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 4⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 4⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 4⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 4⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 4⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 4⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 4⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!NOTE]
> No captured sample: Needs the emailed new-device code; the capture API runs with LOGIN_VERIFICATION_MODE=disabled. Request: { verificationId (from the login response), code (from the email) }.

## Sessions

### POST /api/v1/auth/logout

Logout from the current device (idempotent — always clears the auth cookies)

- **Refresh-token cookie** — sent automatically by the browser after login.
- Operation id `SessionsController_logout` · [source](../../../apps/api/src/modules/sessions/sessions.controller.ts)

**Response 201 Created** — Logged out from current device

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as bob.smith@example.com (web app).

```http
POST /api/v1/auth/logout
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "meta": {
    "correlationId": "ht0tVWFoqaaaNZBOQesQf",
    "timestamp": 1791099723167
  }
}
```

### POST /api/v1/auth/logout-all

Logout from all devices

- **Refresh-token cookie** — sent automatically by the browser after login.
- Operation id `SessionsController_logoutAll` · [source](../../../apps/api/src/modules/sessions/sessions.controller.ts)

**Response 201 Created** — Logged out from all devices

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as frank.miller@example.com (admin panel).

```http
POST /api/v1/auth/logout-all
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Logged out from all devices"
  },
  "meta": {
    "correlationId": "Phcm7DCIWGRnOisI2hONi",
    "timestamp": 1791099723875
  }
}
```

### POST /api/v1/auth/refresh

Refresh access token using refresh token cookie

- **Refresh-token cookie** — sent automatically by the browser after login.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Operation id `SessionsController_refreshToken` · [source](../../../apps/api/src/modules/sessions/sessions.controller.ts)

**Response 200 OK** — Tokens refreshed — set as httpOnly cookies, never in the body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | — | Invalid or expired refresh token |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/auth/refresh
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Tokens refreshed successfully"
  },
  "meta": {
    "correlationId": "tM4ZT47W5YgkXWXDhcIAV",
    "timestamp": 1791099697048
  }
}
```

### GET /api/v1/auth/sessions

Get all active sessions for the current user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `SessionsController_getSessions` · [source](../../../apps/api/src/modules/sessions/sessions.controller.ts)

**Response 200 OK** — List of active sessions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].deviceInfo` | string \| null | yes |  |
| `data[].expiresAt` | integer | yes |  |
| `data[].id` | string | yes |  |
| `data[].ipAddress` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/auth/sessions
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "7aca9ae0-1a57-4492-895a-f99625cffa44",
      "deviceInfo": "node",
      "ipAddress": "203.0.113.10",
      "expiresAt": 1793691696128,
      "createdAt": 1791099696130
    },
    {
      "id": "0e775225-0536-4f2a-8506-b39c7d962d52",
      "deviceInfo": "node",
      "ipAddress": "203.0.113.10",
      "expiresAt": 1793691695426,
      "createdAt": 1791099695429
    }
  ],
  "meta": {
    "correlationId": "_Yr_SzHkbs0-skOgPdYxb",
    "timestamp": 1791099696479
  }
}
```

### GET /api/v1/session

Current session status (requires a valid access token)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `SessionStatusController_getSession` · [source](../../../apps/api/src/modules/sessions/session-status.controller.ts)

**Response 200 OK** — Authenticated session identity + token expiry

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.checkedAt` | integer | yes | Epoch ms when this status was produced (server clock) |
| `data.email` | string (email) | yes | The authenticated user's email (JWT `email`) |
| `data.expiresAt` | integer \| null | yes | Epoch ms when the current access token expires (JWT `exp`), or null when the token carries no expiry |
| `data.fullName` | string | yes | The authenticated user's full name (JWT `fullName`) |
| `data.userId` | string | yes | The authenticated user's id (JWT `sub`) |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | — | Access token missing / invalid / expired |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/session
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "userId": "1e06b347-4142-4ea4-ab85-7fbca1d1f1c0",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "expiresAt": 1791108696000,
    "checkedAt": 1791099696473
  },
  "meta": {
    "correlationId": "i2efYGQeIV_7DF2A50EKb",
    "timestamp": 1791099696473
  }
}
```

## Impersonation

### POST /api/v1/auth/impersonate/{userId}

SuperAdmin: impersonate another user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:USER`.
- **Policy** `CREATE:USER` — SuperAdmin can impersonate any user.
- Requires a **verified email address**.
- Requires a **full session** (email verified and, where required, 2FA enrolled).
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `ImpersonationController_impersonate` · [source](../../../apps/api/src/modules/impersonation/impersonation.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 201 Created** — Impersonation started — the impersonation token is set as an httpOnly cookie

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.impersonating` | true | yes |  |
| `data.message` | string | yes |  |
| `data.originalUserId` | string | yes |  |
| `data.user` | object | yes |  |
| `data.user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.user.email` | string | yes |  |
| `data.user.fullName` | string | yes |  |
| `data.user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.user.id` | string | yes |  |
| `data.user.isActive` | boolean | yes |  |
| `data.user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.user.isEmailVerified` | boolean | yes |  |
| `data.user.isSuperAdmin` | boolean | yes |  |
| `data.user.roles` | object[] | yes |  |
| `data.user.roles[].description` | string \| null | yes |  |
| `data.user.roles[].id` | string | yes |  |
| `data.user.roles[].name` | string | yes |  |
| `data.user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | SuperAdmin privileges required |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/auth/impersonate/90f3721b-e99a-4ec8-9f71-c0c679b69f67
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Now impersonating user@example.com",
    "impersonating": true,
    "originalUserId": "1e06b347-4142-4ea4-ab85-7fbca1d1f1c0",
    "user": {
      "createdAt": 1791099608520,
      "updatedAt": 1791099608520,
      "isDeleted": false,
      "deletedAt": null,
      "id": "90f3721b-e99a-4ec8-9f71-c0c679b69f67",
      "email": "user@example.com",
      "fullName": "Regular User",
      "isActive": true,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": false,
      "hasAdminAccess": false,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "1c3e77b3-65d8-4c21-9f3d-a821afaa9363",
          "name": "User",
          "description": "Customer app — own profile, links, tags, and API keys (no admin panel)"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "ug17x6XK2-xnB4hnDF8hP",
    "timestamp": 1791099750666
  }
}
```

### POST /api/v1/auth/stop-impersonation

Stop impersonating and restore the original admin session

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `ImpersonationController_stopImpersonation` · [source](../../../apps/api/src/modules/impersonation/impersonation.controller.ts)

**Response 201 Created** — Impersonation ended — the admin token is restored as an httpOnly cookie

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/auth/stop-impersonation
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Impersonation ended. Original session restored."
  },
  "meta": {
    "correlationId": "9Wc_gbuVgFnWq0YyZH0U2",
    "timestamp": 1791099750714
  }
}
```

## Support Access

### POST /api/v1/support-access/{grantId}/approve

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `SupportAccessController_approve` · [source](../../../apps/api/src/modules/support-access/support-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `grantId` | path | string (uuid) | yes |  |

**Response 201 Created** — Support access grant approved

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | Caller is not an active owner of the grant's organization |
| 409 | — | Grant is not pending approval (decided, revoked, expired, or self-requested) |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/support-access/86f5acfd-a6d1-412d-b13c-09da95857ebe/approve
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Support access approved"
  },
  "meta": {
    "correlationId": "pX4K8p876RC_7D7ynYkJO",
    "timestamp": 1791099739952
  }
}
```

### POST /api/v1/support-access/{grantId}/revoke

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Policy** `DELETE:USER` — SuperAdmin can revoke support access.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `SupportAccessController_revoke` · [source](../../../apps/api/src/modules/support-access/support-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `grantId` | path | string (uuid) | yes |  |

**Response 201 Created** — Support access grant revoked

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | — | Grant is already revoked, expired, or denied |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/support-access/86f5acfd-a6d1-412d-b13c-09da95857ebe/revoke
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Support access revoked"
  },
  "meta": {
    "correlationId": "IvzsgLUJ7nilGcY0--UU8",
    "timestamp": 1791099739979
  }
}
```

### POST /api/v1/support-access/request

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:USER`.
- **Policy** `CREATE:USER` — SuperAdmin can request support access.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `SupportAccessController_requestGrant` · [source](../../../apps/api/src/modules/support-access/support-access.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `durationMinutes` | integer | no | range 15–480; default `60` |
| `mode` | "READ_ONLY" \| "WRITE_ELEVATED" | no | default `"READ_ONLY"` |
| `organizationId` | string (uuid) | yes |  |
| `reason` | string | yes | length 10–2000 |
| `ticketRef` | string | no | at most 120 characters |

**Response 201 Created** — Support access grant requested

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.expiresAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.mode` | "READ_ONLY" \| "WRITE_ELEVATED" | yes |  |
| `data.organizationId` | string (uuid) | yes |  |
| `data.status` | "PENDING_APPROVAL" \| "PENDING_TENANT_APPROVAL" \| "ACTIVE" \| "EXPIRED" \| "REVOKED" \| "DENIED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/support-access/request
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
  "reason": "Investigate a missing POS checkout",
  "ticketRef": "SUP-1042",
  "mode": "READ_ONLY",
  "durationMinutes": 60
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "86f5acfd-a6d1-412d-b13c-09da95857ebe",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "mode": "READ_ONLY",
    "status": "PENDING_TENANT_APPROVAL",
    "expiresAt": 1791103339903,
    "createdAt": 1791099739905
  },
  "meta": {
    "correlationId": "0cp37xqOoj_F9Ghi745-h",
    "timestamp": 1791099739911
  }
}
```
