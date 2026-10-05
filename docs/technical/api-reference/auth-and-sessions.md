---
title: "API reference — Auth, sessions and account security"
description: "Login, signup, email verification, password reset, two-factor authentication, MFA recovery, sessions, impersonation and support access."
order: 2
author: "Generated from the OpenAPI export"
lastUpdated: 1791158400000
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
    "correlationId": "47QinlzyRJlV_qKbT4lvl",
    "timestamp": 1791193305928
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
    "correlationId": "KBvuSo4hBIWtya6MgmEU5",
    "timestamp": 1791193308669
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
  "backupCode": "ZYCGVR3V5K9RSHN4"
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
    "correlationId": "kX6FbqOkl5Qbi2uUYKJUR",
    "timestamp": 1791193322290
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
    "correlationId": "bHs5DhaOQoyi7sSoDCcc5",
    "timestamp": 1791193308579
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
  "backupCode": "PFXPWESS8DF7RNN9"
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
    "correlationId": "neICtDVFtRANyQBEnSztC",
    "timestamp": 1791193320746
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
      "id": "cc3ee822-7bdd-4bbb-a7a7-9033ca8e8d21",
      "userId": "97da204d-674e-4aec-bb78-729c4f07b9e4",
      "userEmail": "david.lee@example.com",
      "userFullName": "David Lee",
      "status": "PENDING",
      "requestedAt": 1791193322356,
      "reviewedBy": null,
      "reviewedAt": null,
      "scheduledUnlockAt": null,
      "completedAt": null,
      "notes": "Lost my phone"
    },
    {
      "id": "db7f4a2d-246a-40f7-8c91-c6e16596fa40",
      "userId": "c9600578-399b-4d47-81b0-6d84531ea8ea",
      "userEmail": "bob.smith@example.com",
      "userFullName": "Bob Smith",
      "status": "COMPLETED",
      "requestedAt": 1790329273624,
      "reviewedBy": "9194a7c0-e721-4833-95cc-eca2f319f542",
      "reviewedAt": 1790415553624,
      "scheduledUnlockAt": 1790501953624,
      "completedAt": 1790501953624,
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
    "correlationId": "jYuo4IYkFSbBzknbcSIw4",
    "timestamp": 1791193322425
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
  "requestId": "cc3ee822-7bdd-4bbb-a7a7-9033ca8e8d21",
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
    "correlationId": "vfeIxPXvWzOlwiE1HeYLr",
    "timestamp": 1791193322461
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
      "createdAt": 1790707211336,
      "updatedAt": 1791193088857,
      "isDeleted": false,
      "deletedAt": null,
      "id": "048bb0a7-bec4-4453-a311-d54f51a211e5",
      "email": "manager@example.com",
      "fullName": "Manager User",
      "isActive": true,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": false,
      "hasAdminAccess": true,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca",
          "name": "Manager",
          "description": "Admin panel — read/update users and reports (no RBAC or system settings)"
        }
      ],
      "permissions": [],
      "failedLoginAttempts": 0,
      "lockedUntil": null,
      "directPermissionIds": []
    },
    {
      "createdAt": 1790312891336,
      "updatedAt": 1791193088854,
      "isDeleted": false,
      "deletedAt": null,
      "id": "9af46920-bdda-4924-9aba-113055a21a2f",
      "email": "admin@example.com",
      "fullName": "Admin User",
      "isActive": true,
      "isSuperAdmin": false,
      "isEmailVerified": true,
      "twoFactorEnabled": false,
      "hasAdminAccess": true,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "6b129548-41be-4834-b36a-a15cf3b7e855",
          "name": "Admin",
          "description": "Admin panel — manage users, settings, and platform data"
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
    "nextCursor": "eyJhdCI6MTc4NzcyMzM0MDAwMCwiaWQiOiI4MDQ3NTk1Yi1iYTg5LTRlMjctYmUyNy0xYmEzYjkxNTlhZTQifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "-IasGzEF9QYYLe8FYgdt_",
    "timestamp": 1791193302229
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
GET /api/v1/auth/admin/users/363565ab-118f-4983-aeff-0b7eb1634f47
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1766561160000,
    "updatedAt": 1791193088873,
    "isDeleted": false,
    "deletedAt": null,
    "id": "363565ab-118f-4983-aeff-0b7eb1634f47",
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
        "id": "4c3114ed-b0a8-48af-b3eb-900d1e7ce1ec",
        "name": "User",
        "description": "Customer app — own profile, links, tags, and API keys (no admin panel)"
      }
    ],
    "permissions": [
      {
        "id": "b61ea7ad-24e9-4233-8715-a8778243215f",
        "action": "READ",
        "resource": "PROFILE",
        "description": "View own profile",
        "group": "Own Records"
      },
      {
        "id": "8f159dec-62e8-4b7e-a8cb-27078dc4ac39",
        "action": "UPDATE",
        "resource": "PROFILE",
        "description": "Update own profile",
        "group": "Own Records"
      }
    ],
    "failedLoginAttempts": 5,
    "lockedUntil": 1791194053624,
    "directPermissionIds": []
  },
  "meta": {
    "correlationId": "FbXskSGFXfRfjodqJkJsS",
    "timestamp": 1791193302317
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
PATCH /api/v1/auth/admin/users/363565ab-118f-4983-aeff-0b7eb1634f47/unlock
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
    "correlationId": "J4oZICXcO6G8idMClfSlG",
    "timestamp": 1791193302338
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
    "correlationId": "JMWhNEtIvuiq9z6eNMjJW",
    "timestamp": 1791193304792
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
    "correlationId": "_9fCnk0GNWvfTyI2IlVCK",
    "timestamp": 1791193302723
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
      "createdAt": 1790015951336,
      "updatedAt": 1791193088846,
      "isDeleted": false,
      "deletedAt": null,
      "id": "9194a7c0-e721-4833-95cc-eca2f319f542",
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
          "id": "7c9e04fb-139e-418c-8d71-8e0f57f636e4",
          "name": "SuperAdmin",
          "description": "Full system access (platform operator)"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "LrLNFS_tWavVt4HfAnBhN",
    "timestamp": 1791193300809
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
      "createdAt": 1762667100000,
      "updatedAt": 1791193305536,
      "isDeleted": false,
      "deletedAt": null,
      "id": "97da204d-674e-4aec-bb78-729c4f07b9e4",
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
          "id": "ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca",
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
    "correlationId": "ym0tl3v0d_Tuc-__mH5W5",
    "timestamp": 1791193305881
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
  "backupCode": "5SW7U77684HH2XU6"
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
      "createdAt": 1762667100000,
      "updatedAt": 1791193306593,
      "isDeleted": false,
      "deletedAt": null,
      "id": "97da204d-674e-4aec-bb78-729c4f07b9e4",
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
          "id": "ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca",
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
    "correlationId": "h8qUmaA1WcotVEeOxYJq2",
    "timestamp": 1791193306926
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
    "createdAt": 1790015951336,
    "updatedAt": 1791193088846,
    "isDeleted": false,
    "deletedAt": null,
    "id": "9194a7c0-e721-4833-95cc-eca2f319f542",
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
        "id": "7c9e04fb-139e-418c-8d71-8e0f57f636e4",
        "name": "SuperAdmin",
        "description": "Full system access (platform operator)"
      }
    ]
  },
  "meta": {
    "correlationId": "ZHd7Zs8XeqCbTYib1LLl3",
    "timestamp": 1791193301531
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
    "correlationId": "dcxZjl389nCxGQ8Ox4NdE",
    "timestamp": 1791193322381
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
    "correlationId": "3ptUFiGCxcKfa7-CHBxTN",
    "timestamp": 1791193322415
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
        "id": "7c9e04fb-139e-418c-8d71-8e0f57f636e4",
        "name": "SuperAdmin",
        "description": "Full system access (platform operator)"
      }
    ],
    "permissions": [
      {
        "id": "8645327b-3853-40e8-a895-897b948f3b7d",
        "action": "CREATE",
        "resource": "USER",
        "description": "Create new users",
        "group": "User Management"
      },
      {
        "id": "7c220360-19dc-4546-950c-d0a48cad6177",
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
    "correlationId": "DJYOStMELjZUvJfgSqu9I",
    "timestamp": 1791193301534
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
    "id": "9194a7c0-e721-4833-95cc-eca2f319f542",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "avatar": null,
    "version": 0,
    "createdAt": 1790015951336,
    "updatedAt": 1791193088846
  },
  "meta": {
    "correlationId": "uISsjp3LfeM6Rf9pTP6RB",
    "timestamp": 1791193302177
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
    "id": "9194a7c0-e721-4833-95cc-eca2f319f542",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "avatar": null,
    "version": 1,
    "createdAt": 1790015951336,
    "updatedAt": 1791193302197
  },
  "meta": {
    "correlationId": "n_zIt2nSmKDo0EA5NqydA",
    "timestamp": 1791193302206
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
    "correlationId": "PQV5xmLGDkWXI-PX6bjee",
    "timestamp": 1791193302383
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
    "correlationId": "Zc23LE9oWldow7YRWIBzY",
    "timestamp": 1791193303616
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
    "correlationId": "C5un2kHsU0onQUp7B2sxO",
    "timestamp": 1791193305135
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
    "correlationId": "26WNRMQdlR27cLwzklRyi",
    "timestamp": 1791193303014
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
    "correlationId": "R0YSzpdKajxXpcLvYljfn",
    "timestamp": 1791193302408
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
    "correlationId": "LUDBsAGh8ZsiXyJKpJK9-",
    "timestamp": 1791193323179
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
    "correlationId": "J5-gqnS9QVqa4W7cvNlAm",
    "timestamp": 1791193323915
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
    "correlationId": "6-xhauabu_Q9nykHDHPJZ",
    "timestamp": 1791193302145
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
      "id": "dd03c4ab-25b6-4c2c-9039-6768e254f6de",
      "deviceInfo": "node",
      "ipAddress": "203.0.113.10",
      "expiresAt": 1793785301195,
      "createdAt": 1791193301197
    },
    {
      "id": "30f63e1f-2087-40ee-a1da-7fe8ec2a71c1",
      "deviceInfo": "node",
      "ipAddress": "203.0.113.10",
      "expiresAt": 1793785300475,
      "createdAt": 1791193300479
    }
  ],
  "meta": {
    "correlationId": "M9UFQnlbWteKvj9k87L7-",
    "timestamp": 1791193301558
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
    "userId": "9194a7c0-e721-4833-95cc-eca2f319f542",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "expiresAt": 1791202301000,
    "checkedAt": 1791193301552
  },
  "meta": {
    "correlationId": "L_h3CNonnxxi8nl6YkumK",
    "timestamp": 1791193301552
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
POST /api/v1/auth/impersonate/98cd0ea1-f072-4e9d-9b56-e92f4fcf8605
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
    "originalUserId": "9194a7c0-e721-4833-95cc-eca2f319f542",
    "user": {
      "createdAt": 1758886680000,
      "updatedAt": 1791193088860,
      "isDeleted": false,
      "deletedAt": null,
      "id": "98cd0ea1-f072-4e9d-9b56-e92f4fcf8605",
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
          "id": "4c3114ed-b0a8-48af-b3eb-900d1e7ce1ec",
          "name": "User",
          "description": "Customer app — own profile, links, tags, and API keys (no admin panel)"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "YQ5XoRw3zlLp20bnmBOE1",
    "timestamp": 1791193350533
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
    "correlationId": "n78Zkm-VCSjP8M97WhdE9",
    "timestamp": 1791193350583
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
POST /api/v1/support-access/0a67729a-f5e2-44a6-a36b-46e581696eaf/approve
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
    "correlationId": "MPYYR7SxO2q02113VZ_37",
    "timestamp": 1791193340624
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
POST /api/v1/support-access/0a67729a-f5e2-44a6-a36b-46e581696eaf/revoke
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
    "correlationId": "NiLb3EL1sDhs8uL_CRzvm",
    "timestamp": 1791193340652
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
    "id": "0a67729a-f5e2-44a6-a36b-46e581696eaf",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "mode": "READ_ONLY",
    "status": "PENDING_TENANT_APPROVAL",
    "expiresAt": 1791196940582,
    "createdAt": 1791193340584
  },
  "meta": {
    "correlationId": "ViTlMHCNP_oT0vWP6wqjj",
    "timestamp": 1791193340588
  }
}
```
