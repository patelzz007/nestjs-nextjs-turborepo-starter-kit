---
title: "API reference — Auth, sessions and account security"
description: "Login, signup, email verification, password reset, two-factor authentication, MFA recovery, sessions, impersonation and support access."
order: 2
author: "Generated from the OpenAPI export"
lastUpdated: 1792454400000
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
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TwoFactorController_getBackupCodesRemaining` · [source](../../../apps/api/src/contexts/identity/presentation/http/two-factor.controller.ts)

**Response 200 OK** (`application/json`) — Unused backup code count

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
    "correlationId": "J4SU3uWOL8y0UzyyKjTdg",
    "timestamp": 1792520420994
  }
}
```

### POST /api/v1/auth/2fa/enable

Confirm 2FA enrollment with a TOTP code

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can enable their own 2FA.
- Rate limit: 5 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TwoFactorController_enableTwoFactor` · [source](../../../apps/api/src/contexts/identity/presentation/http/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | exactly 6 characters; pattern `^\d{6}$` |

**Response 200 OK** (`application/json`) — 2FA enabled

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
    "correlationId": "HU0MCKgAx6hMG8Q1IaPrs",
    "timestamp": 1792520423332
  }
}
```

### POST /api/v1/auth/2fa/rotate

Rotate 2FA after confirming password and current TOTP or backup code

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can rotate their own 2FA.
- Rate limit: 5 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TwoFactorController_rotateTwoFactor` · [source](../../../apps/api/src/contexts/identity/presentation/http/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupCode` | string | no | exactly 16 characters; pattern `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$` |
| `password` | string | yes | at least 1 characters |
| `token` | string | no | exactly 6 characters; pattern `^\d{6}$` |

**Response 200 OK** (`application/json`) — New TOTP secret, QR code, otpauth:// key URI and backup codes

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.backupCodes` | string[] | yes | 10–10 items |
| `data.otpAuthUrl` | string | yes | at most 2048 characters; pattern `^otpauth:\/\/` |
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
  "backupCode": "V2NHKNWGD3XU4U5K"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "secret": "<redacted: one-time secret>",
    "qrCodeDataUrl": "<redacted: one-time secret>",
    "otpAuthUrl": "otpauth://totp/<redacted: authenticator secret>",
    "backupCodes": [
      "<redacted: one-time secret>",
      "<redacted: one-time secret>"
    ]
  },
  "meta": {
    "correlationId": "OoMfQz3rc36NQMl-yoWO9",
    "timestamp": 1792520432022
  }
}
```

### POST /api/v1/auth/2fa/setup

Start 2FA enrollment: generate a pending TOTP secret, QR code and backup codes

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can start their own 2FA enrollment.
- Rate limit: 5 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TwoFactorController_startSetup` · [source](../../../apps/api/src/contexts/identity/presentation/http/two-factor.controller.ts)

**Request body** (`application/json`, required)

_No fields._

**Response 201 Created** (`application/json`) — TOTP secret, QR code, otpauth:// key URI and backup codes (pending until confirmed via /2fa/enable)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.backupCodes` | string[] | yes | 10–10 items |
| `data.otpAuthUrl` | string | yes | at most 2048 characters; pattern `^otpauth:\/\/` |
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
    "otpAuthUrl": "otpauth://totp/<redacted: authenticator secret>",
    "backupCodes": [
      "<redacted: one-time secret>",
      "<redacted: one-time secret>"
    ]
  },
  "meta": {
    "correlationId": "A1JfeAtEt2CjHitxcUVAp",
    "timestamp": 1792520423209
  }
}
```

### POST /api/v1/auth/2fa/verify-backup-code

Verify a backup code while authenticated

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TwoFactorController_verifyBackupCode` · [source](../../../apps/api/src/contexts/identity/presentation/http/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupCode` | string | yes | exactly 16 characters; pattern `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$` |

**Response 200 OK** (`application/json`) — Whether the backup code was valid

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
  "backupCode": "NZ7UP9UK995V8H2Z"
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
    "correlationId": "Aq5mv1YPm2HYpgLG78rhf",
    "timestamp": 1792520430430
  }
}
```

### GET /api/v1/auth/admin/mfa/recovery/requests

SuperAdmin: list MFA recovery requests

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- Rate limit: 10 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `MfaRecoveryController_listRecoveryRequests` · [source](../../../apps/api/src/contexts/identity/presentation/http/mfa-recovery.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: requestedAt, createdAt. Default: -requestedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, userId |

**Response 200 OK** (`application/json`) — Paginated MFA recovery requests

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
      "id": "01a15a8b-29e6-741f-a717-b550a70cb94f",
      "userId": "01a15a89-7026-7248-b00e-c6e46d03d186",
      "userEmail": "david.lee@example.com",
      "userFullName": "David Lee",
      "status": "PENDING",
      "requestedAt": 1792520432102,
      "reviewedBy": null,
      "reviewedAt": null,
      "scheduledUnlockAt": null,
      "completedAt": null,
      "notes": "Lost my phone"
    },
    {
      "id": "019b76da-a800-7b7f-8a2d-246a20f7cc91",
      "userId": "01a15a89-701f-77be-925b-403c7abefb5b",
      "userEmail": "bob.smith@example.com",
      "userFullName": "Bob Smith",
      "status": "COMPLETED",
      "requestedAt": 1791656520317,
      "reviewedBy": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
      "reviewedAt": 1791742800317,
      "scheduledUnlockAt": 1791829200317,
      "completedAt": 1791829200317,
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
    "correlationId": "dC_aeEp9rRp9gNchHdURn",
    "timestamp": 1792520432198
  }
}
```

### POST /api/v1/auth/admin/mfa/recovery/review

SuperAdmin: approve or deny an MFA recovery request

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Policy** `UPDATE:USER` — SuperAdmin can review MFA recovery requests.
- Rate limit: 10 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MfaRecoveryController_reviewRecovery` · [source](../../../apps/api/src/contexts/identity/presentation/http/mfa-recovery.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | "approve" \| "deny" | yes |  |
| `notes` | string | no |  |
| `requestId` | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Reviewed recovery request status

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
  "requestId": "01a15a8b-29e6-741f-a717-b550a70cb94f",
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
    "correlationId": "aSBE9qsd9KxC9bzllw0xZ",
    "timestamp": 1792520432255
  }
}
```

### GET /api/v1/auth/admin/users

SuperAdmin: list all users with roles and lockout status

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `LIST:USER`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_getAdminUsersList` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: fullName, email, createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status, role, referrerId, referralStatus |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — Paginated admin user list

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
| `data[].signupReferralStatus` | "not_redeemed" \| "redeemed" \| null | yes | Whether the user's signup referral has been redeemed at checkout |
| `data[].signupReferrer` | object \| null | yes | Who referred this user at signup, if anyone |
| `data[].signupReferrer.fullName` | string | yes |  |
| `data[].signupReferrer.id` | string (uuid) | yes |  |
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
      "createdAt": 1791713334739,
      "updatedAt": 1792520397510,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a89-7005-7762-9f2f-9abce72a4081",
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
          "id": "01a15a89-6ad2-74db-81c9-f881b1e6d66c",
          "name": "Manager",
          "description": "Admin panel — read/update users and reports (no RBAC or system settings)"
        }
      ],
      "permissions": [],
      "failedLoginAttempts": 0,
      "lockedUntil": null,
      "directPermissionIds": [],
      "signupReferrer": {
        "id": "01a15a89-701c-7219-85d9-09163e2d3180",
        "fullName": "Alice Johnson"
      },
      "signupReferralStatus": "redeemed"
    },
    {
      "createdAt": 1790930994738,
      "updatedAt": 1792520417617,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
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
          "id": "01a15a89-6ace-709d-94a0-98948cf34e1a",
          "name": "SuperAdmin",
          "description": "Full system access (platform operator)"
        }
      ],
      "permissions": [],
      "failedLoginAttempts": 0,
      "lockedUntil": null,
      "directPermissionIds": [],
      "signupReferrer": null,
      "signupReferralStatus": null
    }
  ],
  "meta": {
    "limit": 5,
    "total": 35,
    "page": 1,
    "totalPages": 7,
    "nextCursor": "eyJhdCI6MTc4ODM2NTA0MDAwMCwiaWQiOiIwMWExNWE4OS03MTk0LTc0YmYtYjhlYS00NmE0NGU3MWZiNDIifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "S9UYdwiQPESzua6_IhipK",
    "timestamp": 1792520417699
  }
}
```

### GET /api/v1/auth/admin/users/{userId}

SuperAdmin: get detailed user info including security state

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `READ:USER`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_getAdminUserDetail` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Full user detail with lockout status

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
| `data.signupReferralStatus` | "not_redeemed" \| "redeemed" \| null | yes | Whether the user's signup referral has been redeemed at checkout |
| `data.signupReferrer` | object \| null | yes | Who referred this user at signup, if anyone |
| `data.signupReferrer.fullName` | string | yes |  |
| `data.signupReferrer.id` | string (uuid) | yes |  |
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
GET /api/v1/auth/admin/users/01a15a89-7032-751b-9ecd-21d831697ced
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1767846060000,
    "updatedAt": 1792520409610,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a89-7032-751b-9ecd-21d831697ced",
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
        "id": "01a15a89-6ad6-72cd-8e42-f9e9bfec3693",
        "name": "User",
        "description": "Customer app — own profile and own analytics (no admin panel)"
      }
    ],
    "permissions": [
      {
        "id": "01a15a89-6a9b-736d-96cd-28130ffb8f70",
        "action": "READ",
        "resource": "GITHUB",
        "description": "View contributions of the configured GitHub repositories",
        "group": "GitHub"
      },
      {
        "id": "01a15a89-6a9b-736d-96cd-9337db5542a2",
        "action": "READ",
        "resource": "PROFILE",
        "description": "View own profile",
        "group": "Own Records"
      }
    ],
    "failedLoginAttempts": 5,
    "lockedUntil": 1792521300317,
    "directPermissionIds": [],
    "signupReferrer": null,
    "signupReferralStatus": null
  },
  "meta": {
    "correlationId": "r8C_vYEIdnoNq_OJTfdbA",
    "timestamp": 1792520417814
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
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_unlockUser` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Account unlocked

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
PATCH /api/v1/auth/admin/users/01a15a89-7032-751b-9ecd-21d831697ced/unlock
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
    "correlationId": "GYR-LoaTUkPEuDzb7Frmk",
    "timestamp": 1792520417840
  }
}
```

### POST /api/v1/auth/change-password

Change password for the authenticated user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can only change their own password.
- Rate limit: 3 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_changePassword` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `confirmPassword` | string | yes | at least 1 characters |
| `currentPassword` | string | yes | at least 1 characters |
| `newPassword` | string | yes | at least 8 characters |

**Response 200 OK** (`application/json`) — Password changed successfully

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
    "correlationId": "NdaPIglfU-ILdKzyCYAJX",
    "timestamp": 1792520420087
  }
}
```

### POST /api/v1/auth/forgot-password

Request a password reset email

- **Public** — no session required.
- Rate limit: 3 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_forgotPassword` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_type` | query | "web" \| "admin" \| "merchant" \| "mobile" | no | Which frontend initiated the action (fallback for the X-Client-Type header). |
| `x-client-type` | header | string | no | Set to 'admin' or 'merchant' so the reset link targets the correct frontend. Defaults to the web app. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | The email address associated with the user account; at most 100 characters |

**Response 200 OK** (`application/json`) — Password reset email sent (if account exists)

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
    "correlationId": "WenR4ll4tkd4OSy28FXvW",
    "timestamp": 1792520418224
  }
}
```

### POST /api/v1/auth/login

Authenticate with email and password

- **Public** — no session required.
- Rate limit: 5 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_login` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_type` | query | "web" \| "admin" \| "merchant" \| "mobile" | no | Which frontend initiated the action (fallback for the X-Client-Type header). |
| `x-client-type` | header | string | no | Set to 'admin' when logging in from the admin panel (only users with isSuperAdmin === true or the ADMIN_DASHBOARD permission may use this), 'merchant' from the merchant portal, or 'mobile' from the mobile app (tokens in the body, no cookies; requires X-App-Version). |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | User email address; at most 100 characters |
| `password` | string | yes | User password; at least 1 characters |

**Response 201 Created** (`application/json`) — Login result — browser client types: tokens set as httpOnly cookies, never in the body; client type mobile: tokens returned in the body with tokenTransport: body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 1⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 1⟩ tenantSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
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
| `data.⟨shape 2⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 2⟩ message` | string | yes |  |
| `data.⟨shape 2⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 2⟩ tenantSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ user` | object | no |  |
| `data.⟨shape 2⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 2⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 2⟩ user.email` | string | yes |  |
| `data.⟨shape 2⟩ user.fullName` | string | yes |  |
| `data.⟨shape 2⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 2⟩ user.id` | string | yes |  |
| `data.⟨shape 2⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 2⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 2⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 2⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 2⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 2⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 2⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 2⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 2⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 2⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 2⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 3⟩ message` | string | yes |  |
| `data.⟨shape 3⟩ requiresTwoFactor` | true | yes |  |
| `data.⟨shape 3⟩ tempToken` | string | yes | at least 1 characters |
| `data.⟨shape 4⟩ message` | string | yes |  |
| `data.⟨shape 4⟩ requiresVerification` | true | yes |  |
| `data.⟨shape 4⟩ verificationId` | string | yes | at least 1 characters |
| `data.⟨shape 5⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 5⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 5⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
| `data.⟨shape 5⟩ user` | object | yes |  |
| `data.⟨shape 5⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 5⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 5⟩ user.email` | string | yes |  |
| `data.⟨shape 5⟩ user.fullName` | string | yes |  |
| `data.⟨shape 5⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 5⟩ user.id` | string | yes |  |
| `data.⟨shape 5⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 5⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 5⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 5⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 5⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 5⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 5⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 5⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 5⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 5⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 5⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 6⟩ user` | object | yes |  |
| `data.⟨shape 6⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 6⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 6⟩ user.email` | string | yes |  |
| `data.⟨shape 6⟩ user.fullName` | string | yes |  |
| `data.⟨shape 6⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 6⟩ user.id` | string | yes |  |
| `data.⟨shape 6⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 6⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 6⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 6⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 6⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 6⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 6⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 6⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 6⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 6⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 6⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

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
      "createdAt": 1790930994738,
      "updatedAt": 1792520397493,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
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
          "id": "01a15a89-6ace-709d-94a0-98948cf34e1a",
          "name": "SuperAdmin",
          "description": "Full system access (platform operator)"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "yAI-w7ykv_51XO37yr-cv",
    "timestamp": 1792520416891
  }
}
```

### POST /api/v1/auth/login/2fa

Complete login with a TOTP code

- **Public** — no session required.
- Rate limit: 10 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TwoFactorController_loginWithTwoFactor` · [source](../../../apps/api/src/contexts/identity/presentation/http/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `tempToken` | string | yes | at least 1 characters |
| `token` | string | yes | exactly 6 characters; pattern `^\d{6}$` |

**Response 200 OK** (`application/json`) — Login result — browser client types: tokens set as httpOnly cookies, never in the body; client type mobile: tokens returned in the body with tokenTransport: body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 1⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 1⟩ tenantSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
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
| `data.⟨shape 2⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 2⟩ message` | string | yes |  |
| `data.⟨shape 2⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 2⟩ tenantSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ user` | object | no |  |
| `data.⟨shape 2⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 2⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 2⟩ user.email` | string | yes |  |
| `data.⟨shape 2⟩ user.fullName` | string | yes |  |
| `data.⟨shape 2⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 2⟩ user.id` | string | yes |  |
| `data.⟨shape 2⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 2⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 2⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 2⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 2⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 2⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 2⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 2⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 2⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 2⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 2⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 3⟩ message` | string | yes |  |
| `data.⟨shape 3⟩ requiresTwoFactor` | true | yes |  |
| `data.⟨shape 3⟩ tempToken` | string | yes | at least 1 characters |
| `data.⟨shape 4⟩ message` | string | yes |  |
| `data.⟨shape 4⟩ requiresVerification` | true | yes |  |
| `data.⟨shape 4⟩ verificationId` | string | yes | at least 1 characters |
| `data.⟨shape 5⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 5⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 5⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
| `data.⟨shape 5⟩ user` | object | yes |  |
| `data.⟨shape 5⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 5⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 5⟩ user.email` | string | yes |  |
| `data.⟨shape 5⟩ user.fullName` | string | yes |  |
| `data.⟨shape 5⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 5⟩ user.id` | string | yes |  |
| `data.⟨shape 5⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 5⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 5⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 5⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 5⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 5⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 5⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 5⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 5⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 5⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 5⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 6⟩ user` | object | yes |  |
| `data.⟨shape 6⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 6⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 6⟩ user.email` | string | yes |  |
| `data.⟨shape 6⟩ user.fullName` | string | yes |  |
| `data.⟨shape 6⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 6⟩ user.id` | string | yes |  |
| `data.⟨shape 6⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 6⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 6⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 6⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 6⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 6⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 6⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 6⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 6⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 6⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 6⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

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
      "createdAt": 1764570600000,
      "updatedAt": 1792520420877,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a89-7026-7248-b00e-c6e46d03d186",
      "email": "david.lee@example.com",
      "fullName": "David Lee",
      "isActive": true,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": true,
      "hasAdminAccess": true,
      "tokenVersion": 4,
      "roles": [
        {
          "id": "01a15a89-6ad2-74db-81c9-f881b1e6d66c",
          "name": "Manager",
          "description": "Admin panel — read/update users and reports (no RBAC or system settings)"
        },
        {
          "id": "019b76da-a800-7856-a233-c666b02b0dc9",
          "name": "Support Agent",
          "description": "Support desk — Support Viewer plus correcting customer account details"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "AxuvHZWlI7x5bu9ACJ341",
    "timestamp": 1792520420939
  }
}
```

### POST /api/v1/auth/login/backup-code

Complete login with a one-time backup code

- **Public** — no session required.
- Rate limit: 10 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TwoFactorController_loginWithBackupCode` · [source](../../../apps/api/src/contexts/identity/presentation/http/two-factor.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupCode` | string | yes | exactly 16 characters; pattern `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$` |
| `tempToken` | string | yes | at least 1 characters |

**Response 200 OK** (`application/json`) — Login result — browser client types: tokens set as httpOnly cookies, never in the body; client type mobile: tokens returned in the body with tokenTransport: body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 1⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 1⟩ tenantSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
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
| `data.⟨shape 2⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 2⟩ message` | string | yes |  |
| `data.⟨shape 2⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 2⟩ tenantSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ user` | object | no |  |
| `data.⟨shape 2⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 2⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 2⟩ user.email` | string | yes |  |
| `data.⟨shape 2⟩ user.fullName` | string | yes |  |
| `data.⟨shape 2⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 2⟩ user.id` | string | yes |  |
| `data.⟨shape 2⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 2⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 2⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 2⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 2⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 2⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 2⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 2⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 2⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 2⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 2⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 3⟩ message` | string | yes |  |
| `data.⟨shape 3⟩ requiresTwoFactor` | true | yes |  |
| `data.⟨shape 3⟩ tempToken` | string | yes | at least 1 characters |
| `data.⟨shape 4⟩ message` | string | yes |  |
| `data.⟨shape 4⟩ requiresVerification` | true | yes |  |
| `data.⟨shape 4⟩ verificationId` | string | yes | at least 1 characters |
| `data.⟨shape 5⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 5⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 5⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
| `data.⟨shape 5⟩ user` | object | yes |  |
| `data.⟨shape 5⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 5⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 5⟩ user.email` | string | yes |  |
| `data.⟨shape 5⟩ user.fullName` | string | yes |  |
| `data.⟨shape 5⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 5⟩ user.id` | string | yes |  |
| `data.⟨shape 5⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 5⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 5⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 5⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 5⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 5⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 5⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 5⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 5⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 5⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 5⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 6⟩ user` | object | yes |  |
| `data.⟨shape 6⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 6⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 6⟩ user.email` | string | yes |  |
| `data.⟨shape 6⟩ user.fullName` | string | yes |  |
| `data.⟨shape 6⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 6⟩ user.id` | string | yes |  |
| `data.⟨shape 6⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 6⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 6⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 6⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 6⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 6⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 6⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 6⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 6⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 6⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 6⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

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
  "backupCode": "JSQ689N7QD3V57YM"
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
      "createdAt": 1764570600000,
      "updatedAt": 1792520421384,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a89-7026-7248-b00e-c6e46d03d186",
      "email": "david.lee@example.com",
      "fullName": "David Lee",
      "isActive": true,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": true,
      "hasAdminAccess": true,
      "tokenVersion": 4,
      "roles": [
        {
          "id": "01a15a89-6ad2-74db-81c9-f881b1e6d66c",
          "name": "Manager",
          "description": "Admin panel — read/update users and reports (no RBAC or system settings)"
        },
        {
          "id": "019b76da-a800-7856-a233-c666b02b0dc9",
          "name": "Support Agent",
          "description": "Support desk — Support Viewer plus correcting customer account details"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "m3kSSMgjR4EYbkC9bTeXP",
    "timestamp": 1792520421760
  }
}
```

### GET /api/v1/auth/me

Get the currently authenticated user's profile

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_getMe` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Response 200 OK** (`application/json`) — Current user profile

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
    "createdAt": 1790930994738,
    "updatedAt": 1792520397493,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
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
        "id": "01a15a89-6ace-709d-94a0-98948cf34e1a",
        "name": "SuperAdmin",
        "description": "Full system access (platform operator)"
      }
    ]
  },
  "meta": {
    "correlationId": "e_WwoukKtERfoSQEeDx0i",
    "timestamp": 1792520417342
  }
}
```

### POST /api/v1/auth/mfa/recovery

Initiate an admin-reviewed MFA recovery request

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — User can initiate MFA recovery for their own account.
- Rate limit: 3 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MfaRecoveryController_initiateRecovery` · [source](../../../apps/api/src/contexts/identity/presentation/http/mfa-recovery.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | no |  |

**Response 200 OK** (`application/json`) — Recovery request status

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
    "correlationId": "uWg_XLNBjSI_e7ZDEOWVi",
    "timestamp": 1792520432127
  }
}
```

### GET /api/v1/auth/mfa/recovery/status

Get the current MFA recovery request status

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `MfaRecoveryController_getRecoveryStatus` · [source](../../../apps/api/src/contexts/identity/presentation/http/mfa-recovery.controller.ts)

**Response 200 OK** (`application/json`) — Recovery request status

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
    "correlationId": "G4XnzFKSgQDr_Ubz1OaLs",
    "timestamp": 1792520432173
  }
}
```

### GET /api/v1/auth/permissions

Get the current session's roles and permissions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_getSessionPermissions` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Response 200 OK** (`application/json`) — Session RBAC payload

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
        "id": "01a15a89-6ace-709d-94a0-98948cf34e1a",
        "name": "SuperAdmin",
        "description": "Full system access (platform operator)"
      }
    ],
    "permissions": [
      {
        "id": "01a15a89-6a9a-75d3-a976-59c5ad38b740",
        "action": "CREATE",
        "resource": "USER",
        "description": "Create new users",
        "group": "User Management"
      },
      {
        "id": "01a15a89-6a9a-75d3-a976-5cd9582d0df2",
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
    "correlationId": "EO_UA48QIbOo588FPvaip",
    "timestamp": 1792520417356
  }
}
```

### GET /api/v1/auth/profile

Get the signed-in user's own profile (name, avatar, optimistic-lock version)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `READ:PROFILE (own record only)` — A user reads their own profile.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ProfileController_getOwnProfile` · [source](../../../apps/api/src/contexts/identity/presentation/http/profile.controller.ts)

**Response 200 OK** (`application/json`) — The signed-in user's own profile

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.avatar` | object \| null | yes | The live avatar, or null when the user has none |
| `data.avatar.fileId` | string (uuid) | yes | The stored file (`GET /files/:fileId`, `DELETE /files/:fileId`) |
| `data.avatar.sources` | object[] | yes | Its served sizes, smallest first, for `srcset` (empty for an avatar uploaded before avatars had renditions) |
| `data.avatar.sources[].url` | string (uri) | yes |  |
| `data.avatar.sources[].width` | integer | yes |  |
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
    "id": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "avatar": null,
    "version": 0,
    "createdAt": 1790930994738,
    "updatedAt": 1792520397493
  },
  "meta": {
    "correlationId": "0uhZr802k5nzbAOpM9gFW",
    "timestamp": 1792520417584
  }
}
```

### PATCH /api/v1/auth/profile

Edit the signed-in user's own profile

Send the `version` read from GET /auth/profile: the change applies only while the profile is still at that version (409 CONFLICT otherwise — reload and retry). Refused (403 PROFILE_UPDATE_DURING_IMPERSONATION) for an impersonation session. The avatar is managed through /files (category USER_AVATAR).

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:PROFILE (own record only)` — A user edits their own profile (never during impersonation).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ProfileController_updateOwnProfile` · [source](../../../apps/api/src/contexts/identity/presentation/http/profile.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fullName` | string | no | The user's full name (trimmed) |
| `version` | integer | yes | The profile `version` this edit is based on (optimistic lock) |

**Response 200 OK** (`application/json`) — The updated profile, with its new version

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.avatar` | object \| null | yes | The live avatar, or null when the user has none |
| `data.avatar.fileId` | string (uuid) | yes | The stored file (`GET /files/:fileId`, `DELETE /files/:fileId`) |
| `data.avatar.sources` | object[] | yes | Its served sizes, smallest first, for `srcset` (empty for an avatar uploaded before avatars had renditions) |
| `data.avatar.sources[].url` | string (uri) | yes |  |
| `data.avatar.sources[].width` | integer | yes |  |
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
    "id": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "avatar": null,
    "version": 1,
    "createdAt": 1790930994738,
    "updatedAt": 1792520417617
  },
  "meta": {
    "correlationId": "oH8s9G1qwMOOvnePQgVTO",
    "timestamp": 1792520417671
  }
}
```

### POST /api/v1/auth/resend-verification

Resend email verification link

- **Public** — no session required.
- Rate limit: 3 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_resendVerification` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_type` | query | "web" \| "admin" \| "merchant" \| "mobile" | no | Which frontend initiated the action (fallback for the X-Client-Type header). |
| `x-client-type` | header | string | no | Set to 'merchant' so the verification link targets the merchant app. Defaults to the web app. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | The email address to resend verification to; at most 100 characters |

**Response 200 OK** (`application/json`) — Verification email resent

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
    "correlationId": "zpeG8TL9st_G9V1Zf9Wg9",
    "timestamp": 1792520417865
  }
}
```

### POST /api/v1/auth/reset-password

Reset password using a valid reset token

- **Public** — no session required.
- Rate limit: 5 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_resetPassword` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `password` | string | yes | New password (min 8 chars, upper+lower+number+special); at least 8 characters |
| `token` | string | yes | The password reset token received via email; at least 1 characters |

**Response 200 OK** (`application/json`) — Password reset successful

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
    "correlationId": "AnNMIAyEs7IKi9WxhAcuJ",
    "timestamp": 1792520419133
  }
}
```

### POST /api/v1/auth/signup

Register a new user account

- **Public** — no session required.
- Rate limit: 3 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_signup` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `client_type` | query | "web" \| "admin" \| "merchant" \| "mobile" | no | Which frontend initiated the action (fallback for the X-Client-Type header). |
| `x-client-type` | header | string | no | Set to 'merchant' so the verification link targets the merchant app. Defaults to the web app. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | at most 100 characters |
| `fullName` | string | yes | User's full name; at least 2 characters |
| `password` | string | yes | User password (must meet complexity requirements); at least 8 characters |
| `referralCode` | string \| null | no | Optional signup referral code from another user (consumer web signup only); at most 8 characters |

**Response 201 Created** (`application/json`) — User registered

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
    "correlationId": "OLXeGBe5r3AMv83L6d3KA",
    "timestamp": 1792520420433
  }
}
```

### GET /api/v1/auth/signup-referrals/dashboard

Referrer dashboard: current code and shareability

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SignupReferralController_dashboard` · [source](../../../apps/api/src/contexts/referrals/presentation/http/signup-referral.controller.ts)

**Response 200 OK** (`application/json`) — Signup referral code state

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.code` | string \| null | yes | exactly 8 characters |
| `data.codeState` | "active" \| "expired" \| "unavailable" \| "pending" | yes |  |
| `data.expiresAt` | integer \| null | yes |  |
| `data.shareable` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/auth/signup-referrals/referees

People who registered with the caller's referral code

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SignupReferralController_referees` · [source](../../../apps/api/src/contexts/referrals/presentation/http/signup-referral.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** (`application/json`) — Signup referral referees

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].fullName` | string | yes |  |
| `data[].status` | "not_redeemed" \| "redeemed" | yes |  |
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
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/auth/validate-reset-token

Validate a password reset token without consuming it

- **Public** — no session required.
- Rate limit: 10 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_validateResetToken` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | at least 1 characters |

**Response 200 OK** (`application/json`) — Whether the reset token is valid

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
    "correlationId": "1VjaJ4UquRDiBIMP28c3b",
    "timestamp": 1792520418518
  }
}
```

### POST /api/v1/auth/verify-email

Verify email address using a verification token

- **Public** — no session required.
- Rate limit: 3 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_verifyEmail` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Email verified

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
    "correlationId": "nUqrXtBdDiyYYh2075jsP",
    "timestamp": 1792520417901
  }
}
```

### POST /api/v1/auth/verify-login

Complete login with an email verification code

- **Public** — no session required.
- Rate limit: 10 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthController_verifyLogin` · [source](../../../apps/api/src/contexts/identity/presentation/http/auth.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `code` | string | yes | exactly 6 characters; pattern `^\d{6}$` |
| `verificationId` | string | yes | at least 1 characters |

**Response 200 OK** (`application/json`) — Login result after verification — browser client types: tokens set as httpOnly cookies, never in the body; client type mobile: tokens returned in the body with tokenTransport: body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 1⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 1⟩ tenantSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
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
| `data.⟨shape 2⟩ enrollmentReason` | "email_verification" \| "mfa_enrollment" | yes |  |
| `data.⟨shape 2⟩ message` | string | yes |  |
| `data.⟨shape 2⟩ requiresEnrollment` | true | yes |  |
| `data.⟨shape 2⟩ tenantSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ user` | object | no |  |
| `data.⟨shape 2⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 2⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 2⟩ user.email` | string | yes |  |
| `data.⟨shape 2⟩ user.fullName` | string | yes |  |
| `data.⟨shape 2⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 2⟩ user.id` | string | yes |  |
| `data.⟨shape 2⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 2⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 2⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 2⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 2⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 2⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 2⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 2⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 2⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 2⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 2⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 3⟩ message` | string | yes |  |
| `data.⟨shape 3⟩ requiresTwoFactor` | true | yes |  |
| `data.⟨shape 3⟩ tempToken` | string | yes | at least 1 characters |
| `data.⟨shape 4⟩ message` | string | yes |  |
| `data.⟨shape 4⟩ requiresVerification` | true | yes |  |
| `data.⟨shape 4⟩ verificationId` | string | yes | at least 1 characters |
| `data.⟨shape 5⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 5⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 5⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
| `data.⟨shape 5⟩ user` | object | yes |  |
| `data.⟨shape 5⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 5⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 5⟩ user.email` | string | yes |  |
| `data.⟨shape 5⟩ user.fullName` | string | yes |  |
| `data.⟨shape 5⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 5⟩ user.id` | string | yes |  |
| `data.⟨shape 5⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 5⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 5⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 5⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 5⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 5⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 5⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 5⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 5⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 5⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 5⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.⟨shape 6⟩ user` | object | yes |  |
| `data.⟨shape 6⟩ user.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.⟨shape 6⟩ user.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.⟨shape 6⟩ user.email` | string | yes |  |
| `data.⟨shape 6⟩ user.fullName` | string | yes |  |
| `data.⟨shape 6⟩ user.hasAdminAccess` | boolean | yes | Whether the user can access the admin panel |
| `data.⟨shape 6⟩ user.id` | string | yes |  |
| `data.⟨shape 6⟩ user.isActive` | boolean | yes |  |
| `data.⟨shape 6⟩ user.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.⟨shape 6⟩ user.isEmailVerified` | boolean | yes |  |
| `data.⟨shape 6⟩ user.isSuperAdmin` | boolean | yes |  |
| `data.⟨shape 6⟩ user.roles` | object[] | yes |  |
| `data.⟨shape 6⟩ user.roles[].description` | string \| null | yes |  |
| `data.⟨shape 6⟩ user.roles[].id` | string | yes |  |
| `data.⟨shape 6⟩ user.roles[].name` | string | yes |  |
| `data.⟨shape 6⟩ user.tokenVersion` | number | yes | Incremented on role/permission mutations; JWTs with a stale version are rejected |
| `data.⟨shape 6⟩ user.twoFactorEnabled` | boolean | yes | Whether TOTP two-factor authentication is enabled; default `false` |
| `data.⟨shape 6⟩ user.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!NOTE]
> No captured sample: Needs the emailed new-device code; the capture API runs with LOGIN_VERIFICATION_MODE=disabled. Request: { verificationId (from the login response), code (from the email) }.

## Sessions

### POST /api/v1/auth/logout

Logout from the current device (idempotent — always clears a browser client's auth cookies; client type mobile presents its refresh token as { refreshToken })

- **Refresh-token cookie** — sent automatically by the browser after login.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SessionsController_logout` · [source](../../../apps/api/src/contexts/identity/presentation/http/sessions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `refreshToken` | string | no | Required for client type `mobile`; must be absent for browser client types (their refresh token is the httpOnly cookie); length 1–4096 |

**Response 201 Created** (`application/json`) — Logged out from current device

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
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
    "correlationId": "VSmFD9oCJYvkjgEoKPRFm",
    "timestamp": 1792520432701
  }
}
```

### POST /api/v1/auth/logout-all

Logout from all devices, on every client type (refresh token: the httpOnly cookie for browser client types, { refreshToken } for client type mobile)

- **Refresh-token cookie** — sent automatically by the browser after login.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SessionsController_logoutAll` · [source](../../../apps/api/src/contexts/identity/presentation/http/sessions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `refreshToken` | string | no | Required for client type `mobile`; must be absent for browser client types (their refresh token is the httpOnly cookie); length 1–4096 |

**Response 201 Created** (`application/json`) — Logged out from all devices

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
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
    "correlationId": "TAiEDPou6BZoEOSazse-n",
    "timestamp": 1792520433167
  }
}
```

### POST /api/v1/auth/refresh

Rotate the session tokens (refresh token: the httpOnly cookie for browser client types, the { refreshToken } body for client type mobile)

- **Refresh-token cookie** — sent automatically by the browser after login.
- Rate limit: 10 requests per 60 s per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SessionsController_refreshToken` · [source](../../../apps/api/src/contexts/identity/presentation/http/sessions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `refreshToken` | string | no | Required for client type `mobile`; must be absent for browser client types (their refresh token is the httpOnly cookie); length 1–4096 |

**Response 200 OK** (`application/json`) — Tokens rotated — browser client types: tokens set as httpOnly cookies, never in the body; client type mobile: tokens returned in the body with tokenTransport: body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.⟨shape 1⟩ accessToken` | string | yes | Access token — send as `Authorization: Bearer`; length 1–8192 |
| `data.⟨shape 1⟩ message` | string | yes |  |
| `data.⟨shape 1⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 1⟩ tokenTransport` | "body" | yes | The tokens travel in this body (client type `mobile`) |
| `data.⟨shape 2⟩ message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | — | Missing, invalid, expired, reused or wrong-source refresh token |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
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
    "correlationId": "iE0M8tyVtEcUd-hgST6Wy",
    "timestamp": 1792520417476
  }
}
```

### GET /api/v1/auth/sessions

List the caller's signed-in devices (every client type), most recently active first; `isCurrent` marks this one

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `READ:USER (own record only)` — A user lists their own device sessions.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SessionsController_getSessions` · [source](../../../apps/api/src/contexts/identity/presentation/http/sessions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: lastActiveAt, createdAt. Default: -lastActiveAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** (`application/json`) — One page of the caller's active device sessions; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].appVersion` | string \| null | yes | Mobile app version |
| `data[].browserName` | string \| null | yes |  |
| `data[].browserVersion` | string \| null | yes |  |
| `data[].clientType` | "web" \| "admin" \| "merchant" \| "mobile" \| null | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].deviceModel` | string \| null | yes |  |
| `data[].deviceName` | string \| null | yes |  |
| `data[].deviceType` | "DESKTOP" \| "MOBILE" \| "TABLET" \| "BOT" \| "UNKNOWN" \| null | yes |  |
| `data[].expiresAt` | integer | yes |  |
| `data[].id` | string | yes | The session id — the `sid` of its access tokens |
| `data[].ipAddress` | string \| null | yes | IP at sign-in |
| `data[].isCurrent` | boolean | yes | This request's own session (from the access token's `sid`) |
| `data[].label` | string | yes | Display name built by the server from the device details |
| `data[].lastActiveAt` | integer | yes |  |
| `data[].lastIpAddress` | string \| null | yes | IP of the most recent refresh |
| `data[].location` | object \| null | yes |  |
| `data[].location.city` | string \| null | yes | length 1–128 |
| `data[].location.country` | string | yes | ISO 3166-1 alpha-2 country; pattern `^[A-Z]{2}$` |
| `data[].location.region` | string \| null | yes | length 1–64 |
| `data[].osName` | string \| null | yes |  |
| `data[].osVersion` | string \| null | yes |  |
| `data[].signInMethod` | "PASSWORD" \| "PASSWORD_NEW_DEVICE_CODE" \| "PASSWORD_TOTP" \| "PASSWORD_TOTP_NEW_DEVICE_CODE" \| "PASSWORD_BACKUP_CODE" \| "PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE" \| "TEAM_INVITE_REGISTRATION" \| "TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE" \| null | yes |  |
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
      "id": "01a15a8a-f00a-7e40-8d9e-33c639685433",
      "label": "Node.js",
      "isCurrent": true,
      "clientType": "admin",
      "browserName": "Node.js",
      "browserVersion": null,
      "osName": null,
      "osVersion": null,
      "deviceType": "UNKNOWN",
      "deviceModel": null,
      "deviceName": null,
      "appVersion": null,
      "signInMethod": "PASSWORD",
      "ipAddress": "203.0.113.10",
      "lastIpAddress": "203.0.113.10",
      "location": null,
      "createdAt": 1792520417270,
      "lastActiveAt": 1792520417270,
      "expiresAt": 1795112417270
    },
    {
      "id": "01a15a8a-ee3c-7816-bff1-a1127660462e",
      "label": "Node.js",
      "isCurrent": false,
      "clientType": "admin",
      "browserName": "Node.js",
      "browserVersion": null,
      "osName": null,
      "osVersion": null,
      "deviceType": "UNKNOWN",
      "deviceModel": null,
      "deviceName": null,
      "appVersion": null,
      "signInMethod": "PASSWORD",
      "ipAddress": "203.0.113.10",
      "lastIpAddress": "203.0.113.10",
      "location": null,
      "createdAt": 1792520416802,
      "lastActiveAt": 1792520416802,
      "expiresAt": 1795112416802
    }
  ],
  "meta": {
    "limit": 20,
    "total": 4,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "qSc4A9d-cL2V7aCNuSy31",
    "timestamp": 1792520417427
  }
}
```

### POST /api/v1/auth/sessions/{sessionId}/revoke

Sign out one of the caller's devices

Revokes one of the caller's device sessions: its refresh token stops working at once and its access tokens on their next request. Revoking the current session signs this device out (a browser's auth cookies are cleared; the mobile app drops its tokens). Idempotent. 404 SESSION_NOT_FOUND for any id that is not one of the caller's sessions; 403 SESSION_REVOKE_DURING_IMPERSONATION during impersonation.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Policy** `UPDATE:USER (own record only)` — A user signs out one of their own devices (never during impersonation).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SessionsController_revokeSession` · [source](../../../apps/api/src/contexts/identity/presentation/http/sessions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `sessionId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — The session is revoked (or already was)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |
| `data.revokedCurrentSession` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | SESSION_REVOKE_DURING_IMPERSONATION — an impersonation session cannot sign out the user's devices |
| 404 | — | SESSION_NOT_FOUND — no session with that id belongs to the caller |
| 404 | `SESSION_NOT_FOUND` | Stated in the endpoint description. |
| 403 | `SESSION_REVOKE_DURING_IMPERSONATION` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/session

Current session status (requires a valid access token)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SessionStatusController_getSession` · [source](../../../apps/api/src/contexts/identity/presentation/http/session-status.controller.ts)

**Response 200 OK** (`application/json`) — Authenticated session identity + token expiry

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
    "userId": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
    "email": "superadmin@example.com",
    "fullName": "Super Admin",
    "expiresAt": 1792529417000,
    "checkedAt": 1792520417386
  },
  "meta": {
    "correlationId": "AKXznEUmbEO5tVgjtUjQ2",
    "timestamp": 1792520417387
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
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ImpersonationController_impersonate` · [source](../../../apps/api/src/contexts/identity/presentation/http/impersonation.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `userId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Impersonation started — the impersonation token is set as an httpOnly cookie

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
POST /api/v1/auth/impersonate/01a15a89-700f-700b-8610-c7a5ad5addc2
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
    "originalUserId": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
    "user": {
      "createdAt": 1759126680000,
      "updatedAt": 1792520400097,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a89-700f-700b-8610-c7a5ad5addc2",
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
          "id": "01a15a89-6ad6-72cd-8e42-f9e9bfec3693",
          "name": "User",
          "description": "Customer app — own profile and own analytics (no admin panel)"
        }
      ]
    }
  },
  "meta": {
    "correlationId": "xzd4tCyPOu7LZm4JWpoQf",
    "timestamp": 1792520490381
  }
}
```

### POST /api/v1/auth/stop-impersonation

Stop impersonating and restore the original admin session

Needs the administrator's own refresh token (the app's refresh cookie; client type mobile: `{ refreshToken }` in the body). The restored access token is bound to that device session (`sid`).

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: 10 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ImpersonationController_stopImpersonation` · [source](../../../apps/api/src/contexts/identity/presentation/http/impersonation.controller.ts)

**Response 201 Created** (`application/json`) — Impersonation ended — the admin token is restored as an httpOnly cookie

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
    "correlationId": "sUKDg_eGsVPf4tiPc_mG8",
    "timestamp": 1792520490560
  }
}
```

## Support Access

### POST /api/v1/support-access/{grantId}/approve

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SupportAccessController_approve` · [source](../../../apps/api/src/contexts/authorization/presentation/http/support-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `grantId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Support access grant approved

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | Caller is not an active owner of the grant's tenant |
| 409 | — | Grant is not pending approval (decided, revoked, expired, or self-requested) |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/support-access/01a15a8b-ab35-75d3-baa2-2e4bbceb25ad/approve
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
    "correlationId": "f_F5te-6U0Zu0vbbGrhQV",
    "timestamp": 1792520465307
  }
}
```

### POST /api/v1/support-access/{grantId}/revoke

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Policy** `DELETE:USER` — SuperAdmin can revoke support access.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SupportAccessController_revoke` · [source](../../../apps/api/src/contexts/authorization/presentation/http/support-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `grantId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Support access grant revoked

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
POST /api/v1/support-access/01a15a8b-ab35-75d3-baa2-2e4bbceb25ad/revoke
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
    "correlationId": "FTB0Bztqg0eNhyAgMNjO5",
    "timestamp": 1792520465381
  }
}
```

### POST /api/v1/support-access/request

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:USER`.
- **Policy** `CREATE:USER` — SuperAdmin can request support access.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SupportAccessController_requestGrant` · [source](../../../apps/api/src/contexts/authorization/presentation/http/support-access.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `durationMinutes` | integer | no | range 15–480; default `60` |
| `mode` | "READ_ONLY" \| "WRITE_ELEVATED" | no | default `"READ_ONLY"` |
| `reason` | string | yes | length 10–2000 |
| `tenantId` | string (uuid) | yes |  |
| `ticketRef` | string | no | at most 120 characters |

**Response 201 Created** (`application/json`) — Support access grant requested

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.expiresAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.mode` | "READ_ONLY" \| "WRITE_ELEVATED" | yes |  |
| `data.status` | "PENDING_APPROVAL" \| "PENDING_TENANT_APPROVAL" \| "ACTIVE" \| "EXPIRED" \| "REVOKED" \| "DENIED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |

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
  "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
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
    "id": "01a15a8b-ab35-75d3-baa2-2e4bbceb25ad",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "mode": "READ_ONLY",
    "status": "PENDING_TENANT_APPROVAL",
    "expiresAt": 1792524065206,
    "createdAt": 1792520465195
  },
  "meta": {
    "correlationId": "hko5pKCSSUtgaLRgrBaZm",
    "timestamp": 1792520465218
  }
}
```
