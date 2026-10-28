---
title: "API reference — Merchant tenants (portal API)"
description: "Everything the merchant portal calls under /tenants/{tenantSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics."
order: 5
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Merchant tenants (portal API)

Everything the merchant portal calls under /tenants/{tenantSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics.

How these endpoints fit together: [Stores and team guide](../../user-guide/03-stores-and-team.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Tenants

### POST /api/v1/admin/tenants/invites

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:MERCHANT_ORG`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAdminController_createInvite` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `Idempotency-Key` | header | string | no | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `category` | string | yes | length 1–100 |
| `city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `displayName` | string | yes | length 1–200 |
| `email` | string (email) | yes | at most 100 characters |
| `intendedRole` | "OWNER" \| "MANAGER" \| "CASHIER" | no | default `"OWNER"` |
| `slug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Response 201 Created** (`application/json`) — Tenant invite created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.inviteToken` | string | yes | at least 1 characters |
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
POST /api/v1/admin/tenants/invites
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "email": "kopi.corner@kl-rewards.demo",
  "displayName": "Kopi Corner KL",
  "slug": "kopi-corner-kl",
  "category": "cafe",
  "city": "KUALA_LUMPUR",
  "intendedRole": "OWNER"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "tenantId": "01a18281-663c-7ca1-9844-2e01e638f1a0",
    "inviteToken": "76a13692c247b8f5d510e3ab07be19ce0eb7a21a88b5ee3258f99c27ca91ce74"
  },
  "meta": {
    "correlationId": "ydQgTD_LAw9WkSJFGVLyZ",
    "timestamp": 1793190880886
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/access-requests

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_requestAccess` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `message` | string | no | at most 500 characters |

**Response 201 Created** (`application/json`) — Tenant access request created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.message` | string \| null | yes |  |
| `data.status` | "PENDING" \| "APPROVED" \| "REJECTED" \| "CANCELLED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.userId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as bob.smith@example.com (web app).

```http
POST /api/v1/tenants/brew-bean-kl/access-requests
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "message": "I run the Bangsar morning shift"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-86d6-7fed-92d7-5aa43dff74e3",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "userId": "01a1827f-436d-762c-9572-99777d235aed",
    "status": "PENDING",
    "message": "I run the Bangsar morning shift",
    "createdAt": 1793190889171
  },
  "meta": {
    "correlationId": "1CCHbCio8L-cJklQG4buy",
    "timestamp": 1793190889181
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/access-requests/{requestId}/review

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_reviewAccessRequest` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `requestId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `⟨shape 1⟩ approve` | true | yes |  |
| `⟨shape 1⟩ locationIds` | string (uuid)[] | yes | 0–200 items |
| `⟨shape 1⟩ locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `⟨shape 1⟩ role` | "MANAGER" \| "CASHIER" | yes |  |
| `⟨shape 2⟩ approve` | false | yes |  |

**Response 201 Created** (`application/json`) — Tenant access request reviewed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/access-requests/01a18281-86d6-7fed-92d7-5aa43dff74e3/review
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "approve": true,
  "role": "CASHIER",
  "locationScopeType": "SELECTED",
  "locationIds": [
    "019b76da-a800-701a-abbd-a9a411b6958b"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Access request reviewed"
  },
  "meta": {
    "correlationId": "TMsYX0BOuNv2Gw81YtuYD",
    "timestamp": 1793190889346
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/context

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_getContext` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Tenant context for the signed-in member

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.locations` | object[] | yes |  |
| `data.locations[].addressText` | string \| null | yes |  |
| `data.locations[].city` | "KUALA_LUMPUR" \| "MELAKA" \| null | yes |  |
| `data.locations[].code` | string | yes |  |
| `data.locations[].contactPhone` | string \| null | yes |  |
| `data.locations[].createdAt` | integer | yes |  |
| `data.locations[].id` | string (uuid) | yes |  |
| `data.locations[].isPrimary` | boolean | yes |  |
| `data.locations[].name` | string | yes |  |
| `data.locations[].rejectionReason` | string \| null | yes |  |
| `data.locations[].status` | "PENDING_APPROVAL" \| "ACTIVE" \| "REJECTED" \| "INACTIVE" | yes |  |
| `data.locations[].tenantId` | string (uuid) | yes |  |
| `data.locations[].updatedAt` | integer | yes |  |
| `data.membership` | object | yes |  |
| `data.membership.createdAt` | integer | yes |  |
| `data.membership.displayName` | string \| null | yes |  |
| `data.membership.id` | string (uuid) | yes |  |
| `data.membership.locationIds` | string (uuid)[] | yes |  |
| `data.membership.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.membership.role` | "OWNER" \| "MANAGER" \| "CASHIER" | yes |  |
| `data.membership.status` | "ACTIVE" \| "SUSPENDED" \| "PENDING" | yes |  |
| `data.membership.tenantId` | string (uuid) | yes |  |
| `data.membership.updatedAt` | integer | yes |  |
| `data.membership.userId` | string (uuid) | yes |  |
| `data.merchantProfile` | object \| null | yes |  |
| `data.merchantProfile.category` | string \| null | yes |  |
| `data.merchantProfile.city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `data.merchantProfile.contactEmail` | string (email) | yes |  |
| `data.merchantProfile.contactPhone` | string \| null | yes |  |
| `data.merchantProfile.kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |
| `data.merchantProfile.legalName` | string \| null | yes |  |
| `data.merchantProfile.tenantId` | string (uuid) | yes |  |
| `data.tenant` | object | yes |  |
| `data.tenant.createdAt` | integer | yes |  |
| `data.tenant.displayName` | string | yes |  |
| `data.tenant.id` | string (uuid) | yes |  |
| `data.tenant.lifecycleState` | "PROVISIONING" \| "ACTIVE" \| "RESTRICTED" \| "SUSPENDED" \| "BANNED" \| "PENDING_DELETION" \| "DELETED" | yes |  |
| `data.tenant.logo` | object \| null | yes |  |
| `data.tenant.logo.fileId` | string (uuid) | yes |  |
| `data.tenant.logo.sources` | object[] | yes |  |
| `data.tenant.logo.sources[].url` | string (uri) | yes |  |
| `data.tenant.logo.sources[].width` | integer | yes |  |
| `data.tenant.logo.url` | string (uri) | yes |  |
| `data.tenant.primaryLocationId` | string (uuid) \| null | yes |  |
| `data.tenant.slug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.tenant.timeZone` | string | yes | length 1–64 |
| `data.tenant.updatedAt` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/context
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "slug": "brew-bean-kl",
      "displayName": "Brew & Bean KL",
      "lifecycleState": "ACTIVE",
      "primaryLocationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "createdAt": 1793190786158,
      "updatedAt": 1793190786158,
      "timeZone": "Asia/Kuala_Lumpur",
      "logo": null
    },
    "membership": {
      "id": "019b76da-a800-7b1d-b660-30bdb341a50c",
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "userId": "019b76da-a800-763a-b64a-fd037629f93f",
      "role": "OWNER",
      "status": "ACTIVE",
      "displayName": "Ahmad (Owner)",
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": [],
      "createdAt": 1793190786251,
      "updatedAt": 1793190786251
    },
    "locations": [
      {
        "id": "019b76da-a800-701a-abbd-a9a411b6958b",
        "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
        "name": "Brew & Bean KL — Bukit Bintang",
        "code": "primary",
        "addressText": "12 Jalan Bukit Bintang, Kuala Lumpur",
        "city": "KUALA_LUMPUR",
        "contactPhone": "+60321456789",
        "status": "ACTIVE",
        "rejectionReason": null,
        "isPrimary": true,
        "createdAt": 1793190786180,
        "updatedAt": 1793190786180
      }
    ],
    "merchantProfile": {
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "legalName": "Brew & Bean KL Sdn Bhd",
      "category": "cafe",
      "city": "KUALA_LUMPUR",
      "kybStatus": "APPROVED",
      "contactEmail": "brew.owner@kl-rewards.demo",
      "contactPhone": "+60321456789"
    }
  },
  "meta": {
    "correlationId": "28_lmjWJQG-zu_2zBWULk",
    "timestamp": 1793190883980
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/lifecycle

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_getLifecycle` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The tenant's lifecycle state, current suspension and appeals

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.appeals` | object[] | yes |  |
| `data.appeals[].createdAt` | integer | yes |  |
| `data.appeals[].id` | string (uuid) | yes |  |
| `data.appeals[].message` | string | yes |  |
| `data.appeals[].reviewNote` | string \| null | yes |  |
| `data.appeals[].reviewedAt` | integer \| null | yes |  |
| `data.appeals[].status` | "PENDING" \| "ACCEPTED" \| "REJECTED" | yes |  |
| `data.appeals[].submittedBy` | object \| null | yes |  |
| `data.appeals[].submittedBy.fullName` | string | yes |  |
| `data.appeals[].submittedBy.id` | string (uuid) | yes |  |
| `data.ban` | object \| null | yes |  |
| `data.ban.bannedAt` | integer | yes |  |
| `data.ban.reason` | string \| null | yes |  |
| `data.deletionGraceEndsAt` | integer \| null | yes |  |
| `data.lifecycleState` | "PROVISIONING" \| "ACTIVE" \| "RESTRICTED" \| "SUSPENDED" \| "BANNED" \| "PENDING_DELETION" \| "DELETED" | yes |  |
| `data.suspension` | object \| null | yes |  |
| `data.suspension.reason` | string \| null | yes |  |
| `data.suspension.suspendedAt` | integer | yes |  |
| `data.tenantId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/lifecycle/appeals

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_submitAppeal` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `message` | string | yes | length 1–1000 |

**Response 201 Created** (`application/json`) — Appeal submitted (409 TENANT_APPEAL_PENDING when one is already waiting)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.appeals` | object[] | yes |  |
| `data.appeals[].createdAt` | integer | yes |  |
| `data.appeals[].id` | string (uuid) | yes |  |
| `data.appeals[].message` | string | yes |  |
| `data.appeals[].reviewNote` | string \| null | yes |  |
| `data.appeals[].reviewedAt` | integer \| null | yes |  |
| `data.appeals[].status` | "PENDING" \| "ACCEPTED" \| "REJECTED" | yes |  |
| `data.appeals[].submittedBy` | object \| null | yes |  |
| `data.appeals[].submittedBy.fullName` | string | yes |  |
| `data.appeals[].submittedBy.id` | string (uuid) | yes |  |
| `data.ban` | object \| null | yes |  |
| `data.ban.bannedAt` | integer | yes |  |
| `data.ban.reason` | string \| null | yes |  |
| `data.deletionGraceEndsAt` | integer \| null | yes |  |
| `data.lifecycleState` | "PROVISIONING" \| "ACTIVE" \| "RESTRICTED" \| "SUSPENDED" \| "BANNED" \| "PENDING_DELETION" \| "DELETED" | yes |  |
| `data.suspension` | object \| null | yes |  |
| `data.suspension.reason` | string \| null | yes |  |
| `data.suspension.suspendedAt` | integer | yes |  |
| `data.tenantId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/lifecycle/reactivate

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_reactivate` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Pending deletion cancelled: the tenant is active again

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.appeals` | object[] | yes |  |
| `data.appeals[].createdAt` | integer | yes |  |
| `data.appeals[].id` | string (uuid) | yes |  |
| `data.appeals[].message` | string | yes |  |
| `data.appeals[].reviewNote` | string \| null | yes |  |
| `data.appeals[].reviewedAt` | integer \| null | yes |  |
| `data.appeals[].status` | "PENDING" \| "ACCEPTED" \| "REJECTED" | yes |  |
| `data.appeals[].submittedBy` | object \| null | yes |  |
| `data.appeals[].submittedBy.fullName` | string | yes |  |
| `data.appeals[].submittedBy.id` | string (uuid) | yes |  |
| `data.ban` | object \| null | yes |  |
| `data.ban.bannedAt` | integer | yes |  |
| `data.ban.reason` | string \| null | yes |  |
| `data.deletionGraceEndsAt` | integer \| null | yes |  |
| `data.lifecycleState` | "PROVISIONING" \| "ACTIVE" \| "RESTRICTED" \| "SUSPENDED" \| "BANNED" \| "PENDING_DELETION" \| "DELETED" | yes |  |
| `data.suspension` | object \| null | yes |  |
| `data.suspension.reason` | string \| null | yes |  |
| `data.suspension.suspendedAt` | integer | yes |  |
| `data.tenantId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/locations

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_createLocation` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressText` | string | yes | length 1–2000 |
| `contactPhone` | string | no | length 1–20 |
| `name` | string | yes | length 1–200 |

**Response 201 Created** (`application/json`) — Tenant store location requested

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.addressText` | string \| null | yes |  |
| `data.city` | "KUALA_LUMPUR" \| "MELAKA" \| null | yes |  |
| `data.code` | string | yes |  |
| `data.contactPhone` | string \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isPrimary` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.rejectionReason` | string \| null | yes |  |
| `data.status` | "PENDING_APPROVAL" \| "ACTIVE" \| "REJECTED" \| "INACTIVE" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.updatedAt` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/locations
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Brew & Bean KL — Bangsar",
  "addressText": "21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur",
  "contactPhone": "+60 3-2283 1234"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-7b12-75fd-aa8e-86a3847fec12",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "name": "Brew & Bean KL — Bangsar",
    "code": "brew-bean-kl-bangsar",
    "addressText": "21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur",
    "city": "KUALA_LUMPUR",
    "contactPhone": "+60 3-2283 1234",
    "status": "PENDING_APPROVAL",
    "rejectionReason": null,
    "isPrimary": false,
    "createdAt": 1793190886164,
    "updatedAt": 1793190886164
  },
  "meta": {
    "correlationId": "2fmWb3ipUUgqPr4C7am6M",
    "timestamp": 1793190886171
  }
}
```

### PATCH /api/v1/tenants/{tenantSlug}/locations/{locationId}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_updateLocation` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `locationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressText` | string | yes | length 1–2000 |
| `contactPhone` | string | no | length 1–20 |
| `name` | string | yes | length 1–200 |

**Response 200 OK** (`application/json`) — Rejected tenant store location resubmitted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.addressText` | string \| null | yes |  |
| `data.city` | "KUALA_LUMPUR" \| "MELAKA" \| null | yes |  |
| `data.code` | string | yes |  |
| `data.contactPhone` | string \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isPrimary` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.rejectionReason` | string \| null | yes |  |
| `data.status` | "PENDING_APPROVAL" \| "ACTIVE" \| "REJECTED" \| "INACTIVE" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.updatedAt` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
PATCH /api/v1/tenants/brew-bean-kl/locations/01a18281-7b12-75fd-aa8e-86a3847fec12
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Brew & Bean KL — Bangsar",
  "addressText": "Lot G-21, 21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur",
  "contactPhone": "+60 3-2283 1234"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-7b12-75fd-aa8e-86a3847fec12",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "name": "Brew & Bean KL — Bangsar",
    "code": "brew-bean-kl-bangsar",
    "addressText": "Lot G-21, 21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur",
    "city": "KUALA_LUMPUR",
    "contactPhone": "+60 3-2283 1234",
    "status": "PENDING_APPROVAL",
    "rejectionReason": null,
    "isPrimary": false,
    "createdAt": 1793190886164,
    "updatedAt": 1793190886389
  },
  "meta": {
    "correlationId": "3NnWxjRo4GL20tdvuPFp3",
    "timestamp": 1793190886398
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/locations/{locationId}/close

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_closeLocation` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `locationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 1–500 |

**Response 201 Created** (`application/json`) — Store closed: soft-deleted with its memberships, terminals and keys revoked

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.apiKeysRevoked` | integer | yes |  |
| `data.closedAt` | integer | yes |  |
| `data.locationId` | string (uuid) | yes |  |
| `data.memberScopesRemoved` | integer | yes |  |
| `data.reason` | string | yes |  |
| `data.terminalsRemoved` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/locations/01a18281-7c4a-7d15-b5c7-444379944334/close
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "reason": "Mall lease not renewed"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "locationId": "01a18281-7c4a-7d15-b5c7-444379944334",
    "closedAt": 1793190886657,
    "reason": "Mall lease not renewed",
    "memberScopesRemoved": 0,
    "terminalsRemoved": 0,
    "apiKeysRevoked": 0
  },
  "meta": {
    "correlationId": "rpzWQWYKB9gb2wBDYkdlO",
    "timestamp": 1793190886688
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/members

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_listMembers` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, role. Default: createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: role |

**Response 200 OK** (`application/json`) — One page of the tenant member roster; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].displayName` | string \| null | yes |  |
| `data[].email` | string (email) | yes |  |
| `data[].fullName` | string | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].locationIds` | string (uuid)[] | yes |  |
| `data[].locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data[].role` | "OWNER" \| "MANAGER" \| "CASHIER" | yes |  |
| `data[].roleId` | string (uuid) | yes |  |
| `data[].status` | "ACTIVE" \| "SUSPENDED" \| "PENDING" | yes |  |
| `data[].tenantId` | string (uuid) | yes |  |
| `data[].updatedAt` | integer | yes |  |
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
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/members
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "019b76da-a800-7546-81bf-a03bddee6096",
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "userId": "01a1827f-43fb-702a-a7ac-eea5f8e2f406",
      "email": "user-02@example.com",
      "fullName": "Olivia Johnson",
      "role": "CASHIER",
      "roleId": "01a1827f-f4fc-766d-99bb-ca55b0fda2c8",
      "status": "ACTIVE",
      "displayName": null,
      "locationScopeType": "SELECTED",
      "locationIds": [
        "019b76da-a800-701a-abbd-a9a411b6958b"
      ],
      "createdAt": 1788753600000,
      "updatedAt": 1793190818746
    },
    {
      "id": "019b76da-a800-7b1d-b660-30bdb341a50c",
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "userId": "019b76da-a800-763a-b64a-fd037629f93f",
      "email": "brew.owner@kl-rewards.demo",
      "fullName": "Ahmad Brew",
      "role": "OWNER",
      "roleId": "01a1827f-f4e0-7092-89b1-a6dc003f94d7",
      "status": "ACTIVE",
      "displayName": "Ahmad (Owner)",
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": [],
      "createdAt": 1793190786251,
      "updatedAt": 1793190786251
    }
  ],
  "meta": {
    "limit": 20,
    "total": 3,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "BCz-4WuPE3aLHNb1g109V",
    "timestamp": 1793190884108
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/members/{membershipId}/locations/{locationId}/remove

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_removeMemberFromLocation` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string | yes |  |
| `membershipId` | path | string (uuid) | yes |  |
| `locationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `allowNoLocations` | boolean | no | default `false` |

**Response 201 Created** (`application/json`) — Team member removed from one store

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.locationId` | string (uuid) | yes |  |
| `data.membershipId` | string (uuid) | yes |  |
| `data.remainingLocationIds` | string (uuid)[] | yes |  |
| `data.removedAt` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as jonker.owner@melaka-rewards.demo (merchant portal). Jonker Street Kitchen removes its cashier from the Bukit Beruang store (the cashier's only store, hence allowNoLocations).

```http
POST /api/v1/tenants/jonker-street-kitchen/members/019b76da-a800-7b0f-b2e9-e7ccd28b72af/locations/019b76da-a800-7685-9734-84f5f07eb21f/remove
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "allowNoLocations": true
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "membershipId": "019b76da-a800-7b0f-b2e9-e7ccd28b72af",
    "locationId": "019b76da-a800-7685-9734-84f5f07eb21f",
    "removedAt": 1793190887269,
    "remainingLocationIds": []
  },
  "meta": {
    "correlationId": "tX735HKesyA9taQ9xnOBj",
    "timestamp": 1793190887277
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/members/invite

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_inviteMember` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | at most 100 characters |
| `locationIds` | string (uuid)[] | no | default `[]` |
| `locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | no | default `"ALL_LOCATIONS"` |
| `role` | "OWNER" \| "MANAGER" \| "CASHIER" | yes |  |

**Response 201 Created** (`application/json`) — Tenant team invitation sent

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.inviteId` | string (uuid) | yes |  |
| `data.message` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/members/invite
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "email": "barista.bangsar@kl-rewards.demo",
  "role": "CASHIER",
  "locationScopeType": "SELECTED",
  "locationIds": [
    "019b76da-a800-701a-abbd-a9a411b6958b"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "inviteId": "01a18281-7dff-7e90-9866-0ba298f5c8e9",
    "message": "Invitation sent"
  },
  "meta": {
    "correlationId": "DMfn_sADd9ke4Ikz0tY_D",
    "timestamp": 1793190886947
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/members/invites

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_listMemberInvites` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, expiresAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** (`application/json`) — One page of the pending tenant team invitations; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].email` | string (email) | yes |  |
| `data[].expiresAt` | integer | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].intendedRole` | "OWNER" \| "MANAGER" \| "CASHIER" | yes |  |
| `data[].invitedByName` | string | yes |  |
| `data[].invitedByUserId` | string (uuid) | yes |  |
| `data[].locationIds` | string (uuid)[] | yes |  |
| `data[].locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data[].status` | "PENDING" \| "ACCEPTED" \| "EXPIRED" \| "REVOKED" | yes |  |
| `data[].tenantId` | string (uuid) | yes |  |
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

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/members/invites
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "019b76da-a800-7926-8bff-ff84232b77f0",
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "email": "alice.kl@kl-rewards.demo",
      "intendedRole": "CASHIER",
      "locationScopeType": "SELECTED",
      "locationIds": [
        "019b76da-a800-701a-abbd-a9a411b6958b"
      ],
      "status": "PENDING",
      "invitedByUserId": "019b76da-a800-763a-b64a-fd037629f93f",
      "invitedByName": "Ahmad Brew",
      "expiresAt": 1793795586427,
      "createdAt": 1793190786434
    }
  ],
  "meta": {
    "limit": 20,
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "lCHKBUZK8xBnsUKKmCCXL",
    "timestamp": 1793190884244
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/members/invites/{inviteId}/revoke

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_revokeMemberInvite` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string | yes |  |
| `inviteId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Tenant team invitation revoked

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/members/invites/01a18281-7dff-7e90-9866-0ba298f5c8e9/revoke
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Invitation revoked"
  },
  "meta": {
    "correlationId": "Yw7dY24cIdMNHZ_ZpJSnF",
    "timestamp": 1793190887131
  }
}
```

### PATCH /api/v1/tenants/{tenantSlug}/members/me

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_updateOwnMembership` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `displayName` | string \| null | yes | length 1–100 |

**Response 200 OK** (`application/json`) — The signed-in member's own membership after setting (or, with null, clearing) their display name in this tenant

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.displayName` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.role` | "OWNER" \| "MANAGER" \| "CASHIER" | yes |  |
| `data.status` | "ACTIVE" \| "SUSPENDED" \| "PENDING" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.updatedAt` | integer | yes |  |
| `data.userId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as jonker.owner@melaka-rewards.demo (merchant portal). Jonker Street Kitchen's owner sets her display name; it is trimmed. `{ "displayName": null }` clears it.

```http
PATCH /api/v1/tenants/jonker-street-kitchen/members/me
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "displayName": "  Siti (Owner)  "
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "019b76da-a800-7d4c-924e-c4e9e246a509",
    "tenantId": "019b76da-a800-72b9-80b8-91bd729eddbe",
    "userId": "019b76da-a800-727d-bf31-03f65b3b9058",
    "role": "OWNER",
    "status": "ACTIVE",
    "displayName": "Siti (Owner)",
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": [],
    "createdAt": 1793190786339,
    "updatedAt": 1793190887374
  },
  "meta": {
    "correlationId": "rI4DYDL-fLcI_ybQXHG3K",
    "timestamp": 1793190887382
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/members/me/leave

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantController_leave` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Left the tenant (409 TENANT_OWNER_CANNOT_LEAVE for the owner)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.leftAt` | integer | yes |  |
| `data.membershipId` | string (uuid) | yes |  |
| `data.tenantId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/invites/accept

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTeamInviteController_acceptTeamInvite` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-team-invite.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | length 16–256 |

**Response 201 Created** (`application/json`) — Team invite accepted and membership created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |
| `data.tenantSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.kl@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/invites/accept
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "token": "seed_team_invite_token_kl_alice"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "tenantSlug": "brew-bean-kl",
    "message": "Invitation accepted"
  },
  "meta": {
    "correlationId": "ZlTBYRSc_tK9JLu2APfzz",
    "timestamp": 1793190888010
  }
}
```

### POST /api/v1/tenants/invites/register-and-accept

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTeamInviteController_registerAndAcceptTeamInvite` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-team-invite.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fullName` | string | yes | at least 2 characters |
| `password` | string | yes | at least 8 characters |
| `token` | string | yes | length 16–256 |

**Response 201 Created** (`application/json`) — Create a staff account from a team invite and sign in

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

**Example** — called as barista (merchant portal).

```http
POST /api/v1/tenants/invites/register-and-accept
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "fullName": "Bangsar Barista",
  "password": "Barista@123"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "requiresEnrollment": true,
    "enrollmentReason": "email_verification",
    "message": "Verify your email address to continue.",
    "user": {
      "createdAt": 1793190888489,
      "updatedAt": 1793190888489,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a18281-8435-7c2c-b780-5c9f2b409b9a",
      "email": "barista.bangsar@kl-rewards.demo",
      "fullName": "Bangsar Barista",
      "isActive": true,
      "isSuperAdmin": false,
      "isEmailVerified": false,
      "twoFactorEnabled": false,
      "hasAdminAccess": false,
      "tokenVersion": 0,
      "roles": [
        {
          "id": "01a1827f-3e0a-715a-a7b4-c46bb0b36e4d",
          "name": "User",
          "description": "Customer app — own profile and own analytics (no admin panel)"
        }
      ]
    },
    "tenantSlug": "brew-bean-kl"
  },
  "meta": {
    "correlationId": "wVk-a6PCoEYFqCfPfJnRF",
    "timestamp": 1793190888632
  }
}
```

### POST /api/v1/tenants/invites/validate

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTeamInviteController_validateTeamInvite` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-team-invite.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | length 16–256 |

**Response 201 Created** (`application/json`) — Team invite preview when the token is valid

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.email` | string (email) | yes |  |
| `data.expiresAt` | integer | yes |  |
| `data.hasExistingAccount` | boolean | yes |  |
| `data.intendedRole` | "OWNER" \| "MANAGER" \| "CASHIER" | yes |  |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationLabels` | object[] | yes |  |
| `data.locationLabels[].id` | string (uuid) | yes |  |
| `data.locationLabels[].name` | string | yes |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.tenantDisplayName` | string | yes |  |
| `data.tenantSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/tenants/invites/validate
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "seed_team_invite_token_kl_alice"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "email": "alice.kl@kl-rewards.demo",
    "tenantDisplayName": "Brew & Bean KL",
    "tenantSlug": "brew-bean-kl",
    "intendedRole": "CASHIER",
    "locationScopeType": "SELECTED",
    "locationIds": [
      "019b76da-a800-701a-abbd-a9a411b6958b"
    ],
    "locationLabels": [
      {
        "id": "019b76da-a800-701a-abbd-a9a411b6958b",
        "name": "Brew & Bean KL — Bukit Bintang"
      }
    ],
    "expiresAt": 1793795586427,
    "hasExistingAccount": true
  },
  "meta": {
    "correlationId": "d7sa-CqWhPoGznrtx4GV0",
    "timestamp": 1793190887487
  }
}
```

## Tenant memberships

### GET /api/v1/tenants/memberships

List the current user's tenant memberships

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `MembershipsBootstrapController_listMemberships` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-memberships.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, displayName. Default: createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — One page of the current user's tenant memberships; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].capabilities` | "merchant:view_dashboard" \| "merchant:view_rewards" \| "merchant:manage_rewards" \| "merchant:view_redemptions" \| "merchant:manage_api_keys" \| "merchant:view_analytics" \| "merchant:manage_team" \| "merchant:view_locations" \| "merchant:manage_locations" \| "merchant:manage_verification"[] | no |  |
| `data[].createdAt` | integer | no |  |
| `data[].displayName` | string | yes |  |
| `data[].kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |
| `data[].lifecycleState` | "PROVISIONING" \| "ACTIVE" \| "RESTRICTED" \| "SUSPENDED" \| "BANNED" \| "PENDING_DELETION" \| "DELETED" | yes |  |
| `data[].role` | "OWNER" \| "MANAGER" \| "CASHIER" | yes |  |
| `data[].tenantId` | string (uuid) | yes |  |
| `data[].tenantSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
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

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/memberships
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "tenantSlug": "brew-bean-kl",
      "displayName": "Brew & Bean KL",
      "role": "OWNER",
      "kybStatus": "APPROVED",
      "lifecycleState": "ACTIVE",
      "createdAt": 1793190786251
    }
  ],
  "meta": {
    "limit": 20,
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "HE2aagtTrZa_pFFH7Omwg",
    "timestamp": 1793190883820
  }
}
```

## Tenant Onboarding

### POST /api/v1/tenants/onboarding/complete

Complete merchant onboarding — links OWNER membership and platform User role

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_completeOnboarding` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `additionalLocations` | object[] | no | 0–10 items; default `[]` |
| `additionalLocations[].addressText` | string | yes | length 1–2000 |
| `additionalLocations[].contactPhone` | string | no | length 1–20 |
| `additionalLocations[].name` | string | yes | length 1–200 |
| `category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" | yes |  |
| `documentType` | string | yes | length 1–100 |
| `fullName` | string | yes | length 2–200 |
| `legalName` | string | yes | length 1–200 |
| `password` | string | yes | at least 8 characters |
| `primaryLocation` | object | yes |  |
| `primaryLocation.addressText` | string | yes | length 1–2000 |
| `primaryLocation.contactPhone` | string | yes | length 5–20 |
| `primaryLocation.name` | string | yes | length 1–200 |
| `registrationNo` | string | yes | length 1–100 |
| `taxId` | string | yes | length 1–100 |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Tenant linked to the account

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.businessName` | string | yes |  |
| `data.role` | "OWNER" \| "CASHIER" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.tenantSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as nyonya.house@melaka-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/onboarding/complete
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "category": "restaurant",
  "legalName": "Nyonya House Melaka Sdn Bhd",
  "registrationNo": "202601012345",
  "taxId": "C2584563202",
  "documentType": "SSM",
  "fullName": "Nyonya House Owner",
  "password": "NyonyaHouse@123",
  "primaryLocation": {
    "name": "Nyonya House — Jonker Walk",
    "addressText": "88 Jalan Hang Jebat, 75200 Melaka",
    "contactPhone": "+60 6-282 1234"
  }
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "tenantId": "01a18281-65dc-78d4-818d-688a106c1a31",
    "tenantSlug": "nyonya-house-melaka",
    "businessName": "Nyonya House Melaka",
    "role": "OWNER"
  },
  "meta": {
    "correlationId": "iZeMSQ87Wexttc3qEfkEf",
    "timestamp": 1793190881338
  }
}
```

### POST /api/v1/tenants/onboarding/documents/status

Scan status of this onboarding's KYB uploads (same document window as the upload endpoints)

- **Public** — no session required.
- Rate limit: 30 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_documentStatus` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fileIds` | string (uuid)[] | yes | 1–5 items |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — This onboarding's requested KYB uploads with their scan status

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.documents` | object[] | yes |  |
| `data.documents[].fileName` | string | yes | length 1–255 |
| `data.documents[].id` | string (uuid) | yes |  |
| `data.documents[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.documents[].scanStatus` | "SCANNING" \| "CLEAN" \| "NOT_SCANNED" \| "INFECTED" \| "SCAN_FAILED" | yes |  |
| `data.documents[].sizeBytes` | integer | yes | range 0–26214400 |
| `data.documents[].uploadedAt` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/tenants/onboarding/documents/status
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "fileIds": [
    "01a18281-6861-7ea3-9d37-fa4f323f642c",
    "01a18281-6908-7906-bcfa-379bd92fb8b9"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "01a18281-6861-7ea3-9d37-fa4f323f642c",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1793190881378
      },
      {
        "id": "01a18281-6908-7906-bcfa-379bd92fb8b9",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1793190881545
      }
    ]
  },
  "meta": {
    "correlationId": "JADkNO98nCDHVrbVXHS5q",
    "timestamp": 1793190883201
  }
}
```

### POST /api/v1/tenants/onboarding/documents/submit

Attach onboarding KYB documents and submit the merchant for admin review

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_submitDocuments` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `documentFileIds` | string (uuid)[] | yes | 1–5 items |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Onboarding KYB documents submitted for review

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.success` | true | yes | The action completed |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/tenants/onboarding/documents/submit
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "documentFileIds": [
    "01a18281-6861-7ea3-9d37-fa4f323f642c",
    "01a18281-6908-7906-bcfa-379bd92fb8b9"
  ]
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
    "correlationId": "7my3_pF0i-h0UdTDYaZkX",
    "timestamp": 1793190883296
  }
}
```

### POST /api/v1/tenants/onboarding/documents/upload-complete

Complete an invite-authorized KYB document upload

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_completeDocumentUpload` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `checksumSha256` | string | yes | exactly 64 characters |
| `fileId` | string (uuid) | yes |  |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Onboarding KYB document upload finalized

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
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/tenants/onboarding/documents/upload-complete
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "fileId": "01a18281-6861-7ea3-9d37-fa4f323f642c",
  "checksumSha256": "79dc184da4077faf9a1025d14d8cc30faceea511c4fee4ba4deb4de2d486a8a2"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "file": {
      "id": "01a18281-6861-7ea3-9d37-fa4f323f642c",
      "category": "MERCHANT_KYB",
      "visibility": "PRIVATE",
      "originalName": "sample.png",
      "mimeType": "image/png",
      "sizeBytes": 2004,
      "status": "SCANNING",
      "scanStatus": "SCANNING",
      "publicUrl": null,
      "uploadedAt": 1793190881378
    }
  },
  "meta": {
    "correlationId": "rBF3ZwYIBglu9yznXi7Lp",
    "timestamp": 1793190881525
  }
}
```

### POST /api/v1/tenants/onboarding/documents/upload-complete-batch

Complete invite-authorized KYB document uploads in one request

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_completeDocumentUploads` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `completions` | object[] | yes | 1–5 items |
| `completions[].checksumSha256` | string | yes | exactly 64 characters |
| `completions[].fileId` | string (uuid) | yes |  |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Onboarding KYB document uploads finalized

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.fileIds` | string (uuid)[] | yes | 1–∞ items |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/tenants/onboarding/documents/upload-complete-batch
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "completions": [
    {
      "fileId": "01a18281-6908-7906-bcfa-379bd92fb8b9",
      "checksumSha256": "79dc184da4077faf9a1025d14d8cc30faceea511c4fee4ba4deb4de2d486a8a2"
    }
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "fileIds": [
      "01a18281-6908-7906-bcfa-379bd92fb8b9"
    ]
  },
  "meta": {
    "correlationId": "qplnfHi3JOclY74sW_a_k",
    "timestamp": 1793190881635
  }
}
```

### POST /api/v1/tenants/onboarding/documents/upload-url

Create an invite-authorized KYB document upload ticket

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_createDocumentUploadUrl` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `checksumSha256` | string | yes | exactly 64 characters |
| `fileName` | string | yes | length 1–255 |
| `mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `sizeBytes` | integer | yes |  |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Signed upload ticket for onboarding KYB documents

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
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/tenants/onboarding/documents/upload-url
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "fileName": "sample.png",
  "mimeType": "image/png",
  "sizeBytes": 2004,
  "checksumSha256": "79dc184da4077faf9a1025d14d8cc30faceea511c4fee4ba4deb4de2d486a8a2"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "fileId": "01a18281-6861-7ea3-9d37-fa4f323f642c",
    "objectPath": "staging/kyb/01a18281-65dc-78d4-818d-688a106c1a31/01a18281-6861-7ea3-9d37-fa4f323f642c-sample.png",
    "expiresIn": 300,
    "method": "POST_MULTIPART",
    "uploadUrl": "http://10.117.81.236:8097/api/v1/files/01a18281-6861-7ea3-9d37-fa4f323f642c/local-upload",
    "fields": {
      "key": "staging/kyb/01a18281-65dc-78d4-818d-688a106c1a31/01a18281-6861-7ea3-9d37-fa4f323f642c-sample.png",
      "token": "<redacted: one-time secret>"
    }
  },
  "meta": {
    "correlationId": "ePKwIkaMPhGQ8zca2Bkbx",
    "timestamp": 1793190881383
  }
}
```

### POST /api/v1/tenants/onboarding/documents/upload-urls

Create invite-authorized KYB document upload tickets in one request

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_createDocumentUploadUrls` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `files` | object[] | yes | 1–5 items |
| `files[].checksumSha256` | string | yes | exactly 64 characters |
| `files[].fileName` | string | yes | length 1–255 |
| `files[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `files[].sizeBytes` | integer | yes |  |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Signed upload tickets for onboarding KYB documents

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.uploads` | object[] | yes | 1–∞ items |
| `data.uploads[].expiresIn` | integer | yes |  |
| `data.uploads[].fields` | object | no |  |
| `data.uploads[].fileId` | string (uuid) | yes |  |
| `data.uploads[].headers` | object | no |  |
| `data.uploads[].method` | "POST_MULTIPART" \| "PUT" | yes |  |
| `data.uploads[].objectPath` | string | yes | at least 1 characters |
| `data.uploads[].uploadUrl` | string (uri) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/tenants/onboarding/documents/upload-urls
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "files": [
    {
      "fileName": "sample.png",
      "mimeType": "image/png",
      "sizeBytes": 2004,
      "checksumSha256": "79dc184da4077faf9a1025d14d8cc30faceea511c4fee4ba4deb4de2d486a8a2"
    }
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "uploads": [
      {
        "fileId": "01a18281-6908-7906-bcfa-379bd92fb8b9",
        "objectPath": "staging/kyb/01a18281-65dc-78d4-818d-688a106c1a31/01a18281-6908-7906-bcfa-379bd92fb8b9-sample.png",
        "expiresIn": 300,
        "method": "POST_MULTIPART",
        "uploadUrl": "http://10.117.81.236:8097/api/v1/files/01a18281-6908-7906-bcfa-379bd92fb8b9/local-upload",
        "fields": {
          "key": "staging/kyb/01a18281-65dc-78d4-818d-688a106c1a31/01a18281-6908-7906-bcfa-379bd92fb8b9-sample.png",
          "token": "<redacted: one-time secret>"
        }
      }
    ]
  },
  "meta": {
    "correlationId": "RsbfEqVRh5kprnbFmyt8M",
    "timestamp": 1793190881548
  }
}
```

### POST /api/v1/tenants/onboarding/validate

Validate a merchant onboarding invite token

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_validateInvite` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Invite preview when the token is valid

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.businessName` | string | yes |  |
| `data.city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `data.email` | string (email) | yes |  |
| `data.expiresAt` | integer | yes |  |
| `data.hasExistingAccount` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/tenants/onboarding/validate
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
    "email": "nyonya.house@melaka-rewards.demo",
    "businessName": "Nyonya House Melaka",
    "city": "MELAKA",
    "expiresAt": 1793795680732,
    "hasExistingAccount": false
  },
  "meta": {
    "correlationId": "QJUDQHcNcM6ePGpYKXbSS",
    "timestamp": 1793190880912
  }
}
```

## Tenant KYB

### GET /api/v1/tenants/{tenantSlug}/kyb

Get the tenant KYB profile (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantKybController_getProfile` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-kyb.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Tenant KYB profile

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.addressText` | string \| null | yes |  |
| `data.businessName` | string | yes |  |
| `data.city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `data.contactEmail` | string | yes |  |
| `data.contactPhone` | string \| null | yes |  |
| `data.documents` | object[] | yes |  |
| `data.documents[].fileName` | string | yes | length 1–255 |
| `data.documents[].id` | string (uuid) | yes |  |
| `data.documents[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.documents[].scanStatus` | "SCANNING" \| "CLEAN" \| "NOT_SCANNED" \| "INFECTED" \| "SCAN_FAILED" | yes |  |
| `data.documents[].sizeBytes` | integer | yes | range 0–26214400 |
| `data.documents[].uploadedAt` | integer | yes |  |
| `data.kybFields` | any JSON \| null | yes |  |
| `data.kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |
| `data.legalName` | string \| null | yes |  |
| `data.status` | "ONBOARDING" \| "ACTIVE" \| "SUSPENDED" \| "BANNED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as nyonya.house@melaka-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/nyonya-house-melaka/kyb
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "tenantId": "01a18281-65dc-78d4-818d-688a106c1a31",
    "businessName": "Nyonya House Melaka",
    "legalName": "Nyonya House Melaka Sdn Bhd",
    "addressText": "88 Jalan Hang Jebat, 75200 Melaka",
    "contactPhone": "+60 6-282 1234",
    "contactEmail": "nyonya.house@melaka-rewards.demo",
    "city": "MELAKA",
    "kybStatus": "PENDING",
    "kybFields": {
      "taxId": "C2584563202",
      "submittedAt": 1793190881296,
      "documentType": "SSM",
      "registrationNo": "202601012345"
    },
    "documents": [
      {
        "id": "01a18281-6861-7ea3-9d37-fa4f323f642c",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1793190881378
      },
      {
        "id": "01a18281-6908-7906-bcfa-379bd92fb8b9",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1793190881545
      }
    ],
    "status": "ACTIVE"
  },
  "meta": {
    "correlationId": "Lj8mqVAx93pXkGnE8rFEU",
    "timestamp": 1793190885821
  }
}
```

### PATCH /api/v1/tenants/{tenantSlug}/kyb

Submit or resubmit business verification details (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantKybController_submitKyb` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-kyb.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressText` | string | yes | length 1–500 |
| `businessName` | string | yes | length 1–200 |
| `contactPhone` | string | yes | length 5–20 |
| `documentFileIds` | string (uuid)[] | yes | 1–5 items |
| `documentType` | string | yes | length 1–100 |
| `legalName` | string | yes | length 1–200 |
| `registrationNo` | string | yes | length 1–100 |
| `taxId` | string | yes | length 1–100 |

**Response 200 OK** (`application/json`) — Updated tenant KYB profile

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.addressText` | string \| null | yes |  |
| `data.businessName` | string | yes |  |
| `data.city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `data.contactEmail` | string | yes |  |
| `data.contactPhone` | string \| null | yes |  |
| `data.documents` | object[] | yes |  |
| `data.documents[].fileName` | string | yes | length 1–255 |
| `data.documents[].id` | string (uuid) | yes |  |
| `data.documents[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.documents[].scanStatus` | "SCANNING" \| "CLEAN" \| "NOT_SCANNED" \| "INFECTED" \| "SCAN_FAILED" | yes |  |
| `data.documents[].sizeBytes` | integer | yes | range 0–26214400 |
| `data.documents[].uploadedAt` | integer | yes |  |
| `data.kybFields` | any JSON \| null | yes |  |
| `data.kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |
| `data.legalName` | string \| null | yes |  |
| `data.status` | "ONBOARDING" \| "ACTIVE" \| "SUSPENDED" \| "BANNED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as nyonya.house@melaka-rewards.demo (merchant portal).

```http
PATCH /api/v1/tenants/nyonya-house-melaka/kyb
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "businessName": "Nyonya House Melaka",
  "legalName": "Nyonya House Melaka Sdn Bhd",
  "registrationNo": "202601012345",
  "taxId": "C2584563202",
  "documentType": "SSM",
  "addressText": "88 Jalan Hang Jebat, 75200 Melaka",
  "contactPhone": "+60 6-282 1234",
  "documentFileIds": [
    "01a18281-6861-7ea3-9d37-fa4f323f642c",
    "01a18281-6908-7906-bcfa-379bd92fb8b9"
  ]
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "tenantId": "01a18281-65dc-78d4-818d-688a106c1a31",
    "businessName": "Nyonya House Melaka",
    "legalName": "Nyonya House Melaka Sdn Bhd",
    "addressText": "88 Jalan Hang Jebat, 75200 Melaka",
    "contactPhone": "+60 6-282 1234",
    "contactEmail": "nyonya.house@melaka-rewards.demo",
    "city": "MELAKA",
    "kybStatus": "PENDING",
    "kybFields": {
      "taxId": "C2584563202",
      "submittedAt": 1793190885952,
      "documentType": "SSM",
      "registrationNo": "202601012345"
    },
    "documents": [
      {
        "id": "01a18281-6861-7ea3-9d37-fa4f323f642c",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1793190881378
      },
      {
        "id": "01a18281-6908-7906-bcfa-379bd92fb8b9",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1793190881545
      }
    ],
    "status": "ACTIVE"
  },
  "meta": {
    "correlationId": "dK1sAMNen-_YsMmRoZ0CQ",
    "timestamp": 1793190885978
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/kyb/documents/{documentId}/download

Get a short-lived signed download URL for a CLEAN KYB document (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantKybController_downloadDocument` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-kyb.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `documentId` | path | string (uuid) | yes |  |
| `disposition` | query | "inline" \| "attachment" | no |  |

**Response 200 OK** (`application/json`) — Signed download URL or scan status

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.documentId` | string (uuid) | yes |  |
| `data.downloadUrl` | string (uri) \| null | yes |  |
| `data.expiresAt` | integer \| null | yes |  |
| `data.scanStatus` | "SCANNING" \| "CLEAN" \| "NOT_SCANNED" \| "INFECTED" \| "SCAN_FAILED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/kyb/documents/019b76da-a800-7159-b799-9b0589c815e1/download
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "documentId": "019b76da-a800-7159-b799-9b0589c815e1",
    "scanStatus": "SCANNING",
    "downloadUrl": "http://10.117.81.236:8097/api/v1/files/local-download?token=<redacted>",
    "expiresAt": 1793191184490
  },
  "meta": {
    "correlationId": "3W1_2MJmM8tMioZhCnsPe",
    "timestamp": 1793190884490
  }
}
```

## Tenant Rewards

### GET /api/v1/tenants/{tenantSlug}/rewards

List tenant rewards

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantRewardsController_listRewards` · [source](../../../apps/api/src/contexts/rewards/presentation/http/tenant-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, expiryDate, title. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — One page of the tenant's rewards; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].category` | string | yes |  |
| `data[].claimCount` | integer | yes | min -9007199254740991 |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].description` | string | yes |  |
| `data[].expiryDate` | integer | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].images` | object[] | yes | 1–10 items |
| `data[].images[].fileId` | string (uuid) | yes |  |
| `data[].images[].height` | integer | yes |  |
| `data[].images[].sources` | object[] | yes | 1–∞ items |
| `data[].images[].sources[].url` | string (uri) | yes |  |
| `data[].images[].sources[].width` | integer | yes |  |
| `data[].images[].url` | string (uri) | yes |  |
| `data[].images[].width` | integer | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].locationIds` | string (uuid)[] | yes |  |
| `data[].locationNames` | string[] | no |  |
| `data[].locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data[].quantityRemaining` | integer | yes | min -9007199254740991 |
| `data[].quantityReserved` | integer | yes | min -9007199254740991 |
| `data[].quantityTotal` | integer | yes | min -9007199254740991 |
| `data[].redemptionCount` | integer | yes | min -9007199254740991 |
| `data[].referralPoolRemaining` | integer \| null | yes | min -9007199254740991 |
| `data[].referralPoolTotal` | integer \| null | yes | min -9007199254740991 |
| `data[].referralsEnabled` | boolean | yes |  |
| `data[].referrerRewardId` | string (uuid) \| null | yes |  |
| `data[].rewardKind` | "CONSUMER" \| "REFERRER" | yes |  |
| `data[].rewardType` | "DISCOUNT" \| "FREE_ITEM" \| "CASHBACK" \| "POINTS" \| "BOGO" | yes |  |
| `data[].rewardValue` | integer | yes |  |
| `data[].rules` | object \| null | yes |  |
| `data[].rules.maxUsePerUser` | integer | no |  |
| `data[].rules.minSpendMyr` | number | no | range 0–∞ |
| `data[].shareUrl` | string (uri) | no |  |
| `data[].startDate` | integer \| null | yes |  |
| `data[].status` | "DRAFT" \| "PENDING_REVIEW" \| "PUBLISHED" \| "EXPIRED" \| "DISABLED" | yes |  |
| `data[].tenantId` | string (uuid) | yes |  |
| `data[].tenantLogoSources` | object[] | yes |  |
| `data[].tenantLogoSources[].url` | string (uri) | yes |  |
| `data[].tenantLogoSources[].width` | integer | yes |  |
| `data[].tenantLogoUrl` | string (uri) \| null | yes |  |
| `data[].tenantName` | string | no |  |
| `data[].termsConditions` | string \| null | yes |  |
| `data[].title` | string | yes |  |
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
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/rewards
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1793190816176,
      "updatedAt": 1793190816176,
      "isDeleted": false,
      "deletedAt": null,
      "id": "019b76da-a800-75d7-95fa-18e695a7ff33",
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "tenantName": "Brew & Bean KL",
      "tenantLogoUrl": null,
      "tenantLogoSources": [],
      "title": "Free cake for every visit",
      "description": "Unlimited free cake with any purchase.",
      "rewardType": "FREE_ITEM",
      "rewardValue": 1,
      "termsConditions": null,
      "rewardKind": "CONSUMER",
      "category": "cafe",
      "images": [
        {
          "fileId": "019b76da-a800-7d08-8be5-bc0104035de1",
          "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/UHD/local-public",
          "width": 3840,
          "height": 2160,
          "sources": [
            {
              "width": 640,
              "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/THUMBNAIL/local-public"
            },
            {
              "width": 1280,
              "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/MEDIUM/local-public"
            }
          ]
        }
      ],
      "quantityTotal": 500,
      "quantityRemaining": 500,
      "quantityReserved": 0,
      "startDate": null,
      "expiryDate": 1795782785684,
      "status": "DRAFT",
      "claimCount": 0,
      "redemptionCount": 0,
      "referralsEnabled": false,
      "referralPoolTotal": null,
      "referralPoolRemaining": null,
      "referrerRewardId": null,
      "rules": null,
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": []
    },
    {
      "createdAt": 1793190815822,
      "updatedAt": 1793190816165,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a18280-684d-770b-b881-29851babd38e",
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "tenantName": "Brew & Bean KL",
      "tenantLogoUrl": null,
      "tenantLogoSources": [],
      "title": "Wellness: Free yoga class voucher",
      "description": "One free drop-in class at our partner yoga studio next door.",
      "rewardType": "FREE_ITEM",
      "rewardValue": 1,
      "termsConditions": "Subject to store availability.",
      "rewardKind": "CONSUMER",
      "category": "wellness",
      "images": [
        {
          "fileId": "019b76da-a800-7cce-a513-c34650bd2a0e",
          "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7cce-a513-c34650bd2a0e/variants/UHD/local-public",
          "width": 3840,
          "height": 2160,
          "sources": [
            {
              "width": 640,
              "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7cce-a513-c34650bd2a0e/variants/THUMBNAIL/local-public"
            },
            {
              "width": 1280,
              "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7cce-a513-c34650bd2a0e/variants/MEDIUM/local-public"
            }
          ]
        }
      ],
      "quantityTotal": 25,
      "quantityRemaining": 20,
      "quantityReserved": 1,
      "startDate": null,
      "expiryDate": 1797078815821,
      "status": "PUBLISHED",
      "claimCount": 0,
      "redemptionCount": 0,
      "referralsEnabled": false,
      "referralPoolTotal": null,
      "referralPoolRemaining": null,
      "referrerRewardId": null,
      "rules": null,
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": []
    }
  ],
  "meta": {
    "limit": 20,
    "total": 14,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "Kx_SeXLs3Sl0kDoYYNHRp",
    "timestamp": 1793190889618
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/rewards

Create a draft reward

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantRewardsController_createReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/tenant-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" | yes |  |
| `description` | string | yes | length 1–5000 |
| `expiryDate` | integer | yes |  |
| `imageFileIds` | string (uuid)[] | yes | 1–10 items |
| `locationIds` | string (uuid)[] | no | default `[]` |
| `locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | no | default `"ALL_LOCATIONS"` |
| `quantityTotal` | integer | yes | min 1 |
| `referralPoolTotal` | integer | no | min 1 |
| `referralsEnabled` | boolean | no | default `false` |
| `referrerRewardTitle` | string | no | length 1–200 |
| `rewardType` | "DISCOUNT" \| "FREE_ITEM" \| "CASHBACK" \| "POINTS" \| "BOGO" | yes |  |
| `rewardValue` | number | yes | range 0–∞ |
| `rules` | object | no |  |
| `rules.maxUsePerUser` | integer | no |  |
| `rules.minSpendMyr` | number | no | range 0–∞ |
| `saveAsDraft` | boolean | no | default `true` |
| `startDate` | integer | no |  |
| `termsConditions` | string | no | at most 5000 characters |
| `title` | string | yes | length 1–200 |

**Response 201 Created** (`application/json`) — Created reward

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | string | yes |  |
| `data.claimCount` | integer | yes | min -9007199254740991 |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.expiryDate` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.images` | object[] | yes | 1–10 items |
| `data.images[].fileId` | string (uuid) | yes |  |
| `data.images[].height` | integer | yes |  |
| `data.images[].sources` | object[] | yes | 1–∞ items |
| `data.images[].sources[].url` | string (uri) | yes |  |
| `data.images[].sources[].width` | integer | yes |  |
| `data.images[].url` | string (uri) | yes |  |
| `data.images[].width` | integer | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationNames` | string[] | no |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.quantityRemaining` | integer | yes | min -9007199254740991 |
| `data.quantityReserved` | integer | yes | min -9007199254740991 |
| `data.quantityTotal` | integer | yes | min -9007199254740991 |
| `data.redemptionCount` | integer | yes | min -9007199254740991 |
| `data.referralPoolRemaining` | integer \| null | yes | min -9007199254740991 |
| `data.referralPoolTotal` | integer \| null | yes | min -9007199254740991 |
| `data.referralsEnabled` | boolean | yes |  |
| `data.referrerRewardId` | string (uuid) \| null | yes |  |
| `data.rewardKind` | "CONSUMER" \| "REFERRER" | yes |  |
| `data.rewardType` | "DISCOUNT" \| "FREE_ITEM" \| "CASHBACK" \| "POINTS" \| "BOGO" | yes |  |
| `data.rewardValue` | integer | yes |  |
| `data.rules` | object \| null | yes |  |
| `data.rules.maxUsePerUser` | integer | no |  |
| `data.rules.minSpendMyr` | number | no | range 0–∞ |
| `data.shareUrl` | string (uri) | no |  |
| `data.startDate` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_REVIEW" \| "PUBLISHED" \| "EXPIRED" \| "DISABLED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.tenantLogoSources` | object[] | yes |  |
| `data.tenantLogoSources[].url` | string (uri) | yes |  |
| `data.tenantLogoSources[].width` | integer | yes |  |
| `data.tenantLogoUrl` | string (uri) \| null | yes |  |
| `data.tenantName` | string | no |  |
| `data.termsConditions` | string \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/rewards
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "imageFileIds": [
    "01a18281-89e3-761c-9766-ef5c90059d9f"
  ],
  "title": "Free Kopi O with any breakfast set",
  "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
  "category": "cafe",
  "rewardType": "FREE_ITEM",
  "rewardValue": 6,
  "quantityTotal": 200,
  "startDate": 1793190891590,
  "expiryDate": 1798374891590,
  "locationScopeType": "ALL_LOCATIONS",
  "rules": {
    "maxUsePerUser": 1,
    "minSpendMyr": 15
  },
  "referralsEnabled": true,
  "referralPoolTotal": 50,
  "referrerRewardTitle": "RM5 off your next order",
  "saveAsDraft": true
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190891864,
    "updatedAt": 1793190891911,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-915c-71cb-a2a2-867c0e7b89e1",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "tenantName": "Brew & Bean KL",
    "tenantLogoUrl": null,
    "tenantLogoSources": [],
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a18281-89e3-761c-9766-ef5c90059d9f",
        "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 200,
    "quantityRemaining": 200,
    "quantityReserved": 0,
    "startDate": 1793190891590,
    "expiryDate": 1798374891590,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a18281-915c-7dcf-8d6e-77e86bf5df31",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "bZoTyUH2XhDG32OG4jkic",
    "timestamp": 1793190892005
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/rewards/{rewardId}

Read one tenant reward (404 when not offered at any of the caller's stores)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantRewardsController_getReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/tenant-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `rewardId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Reward

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | string | yes |  |
| `data.claimCount` | integer | yes | min -9007199254740991 |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.expiryDate` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.images` | object[] | yes | 1–10 items |
| `data.images[].fileId` | string (uuid) | yes |  |
| `data.images[].height` | integer | yes |  |
| `data.images[].sources` | object[] | yes | 1–∞ items |
| `data.images[].sources[].url` | string (uri) | yes |  |
| `data.images[].sources[].width` | integer | yes |  |
| `data.images[].url` | string (uri) | yes |  |
| `data.images[].width` | integer | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationNames` | string[] | no |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.quantityRemaining` | integer | yes | min -9007199254740991 |
| `data.quantityReserved` | integer | yes | min -9007199254740991 |
| `data.quantityTotal` | integer | yes | min -9007199254740991 |
| `data.redemptionCount` | integer | yes | min -9007199254740991 |
| `data.referralPoolRemaining` | integer \| null | yes | min -9007199254740991 |
| `data.referralPoolTotal` | integer \| null | yes | min -9007199254740991 |
| `data.referralsEnabled` | boolean | yes |  |
| `data.referrerRewardId` | string (uuid) \| null | yes |  |
| `data.rewardKind` | "CONSUMER" \| "REFERRER" | yes |  |
| `data.rewardType` | "DISCOUNT" \| "FREE_ITEM" \| "CASHBACK" \| "POINTS" \| "BOGO" | yes |  |
| `data.rewardValue` | integer | yes |  |
| `data.rules` | object \| null | yes |  |
| `data.rules.maxUsePerUser` | integer | no |  |
| `data.rules.minSpendMyr` | number | no | range 0–∞ |
| `data.shareUrl` | string (uri) | no |  |
| `data.startDate` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_REVIEW" \| "PUBLISHED" \| "EXPIRED" \| "DISABLED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.tenantLogoSources` | object[] | yes |  |
| `data.tenantLogoSources[].url` | string (uri) | yes |  |
| `data.tenantLogoSources[].width` | integer | yes |  |
| `data.tenantLogoUrl` | string (uri) \| null | yes |  |
| `data.tenantName` | string | no |  |
| `data.termsConditions` | string \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/rewards/019b76da-a800-75d7-95fa-18e695a7ff33
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190816176,
    "updatedAt": 1793190816176,
    "isDeleted": false,
    "deletedAt": null,
    "id": "019b76da-a800-75d7-95fa-18e695a7ff33",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "tenantName": "Brew & Bean KL",
    "tenantLogoUrl": null,
    "tenantLogoSources": [],
    "title": "Free cake for every visit",
    "description": "Unlimited free cake with any purchase.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 1,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "019b76da-a800-7d08-8be5-bc0104035de1",
        "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/UHD/local-public",
        "width": 3840,
        "height": 2160,
        "sources": [
          {
            "width": 640,
            "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://10.117.81.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 500,
    "quantityRemaining": 500,
    "quantityReserved": 0,
    "startDate": null,
    "expiryDate": 1795782785684,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": false,
    "referralPoolTotal": null,
    "referralPoolRemaining": null,
    "referrerRewardId": null,
    "rules": null,
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "5ulIZGmsLE6dcnCg-bfxP",
    "timestamp": 1793190889873
  }
}
```

### PATCH /api/v1/tenants/{tenantSlug}/rewards/{rewardId}

Update a draft or pending reward

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantRewardsController_updateReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/tenant-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `rewardId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string | no | length 1–5000 |
| `expiryDate` | integer | no |  |
| `imageFileIds` | string (uuid)[] | no | 1–10 items |
| `quantityTotal` | integer | no | min 1 |
| `referralPoolTotal` | integer | no | min 1 |
| `referralsEnabled` | boolean | no |  |
| `referrerRewardTitle` | string | no | length 1–200 |
| `rewardType` | "DISCOUNT" \| "FREE_ITEM" \| "CASHBACK" \| "POINTS" \| "BOGO" | no |  |
| `rewardValue` | number | no | range 0–∞ |
| `rules` | object | no |  |
| `rules.maxUsePerUser` | integer | no |  |
| `rules.minSpendMyr` | number | no | range 0–∞ |
| `startDate` | integer \| null | no |  |
| `termsConditions` | string \| null | no | at most 5000 characters |
| `title` | string | no | length 1–200 |

**Response 200 OK** (`application/json`) — Updated reward

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | string | yes |  |
| `data.claimCount` | integer | yes | min -9007199254740991 |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.expiryDate` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.images` | object[] | yes | 1–10 items |
| `data.images[].fileId` | string (uuid) | yes |  |
| `data.images[].height` | integer | yes |  |
| `data.images[].sources` | object[] | yes | 1–∞ items |
| `data.images[].sources[].url` | string (uri) | yes |  |
| `data.images[].sources[].width` | integer | yes |  |
| `data.images[].url` | string (uri) | yes |  |
| `data.images[].width` | integer | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationNames` | string[] | no |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.quantityRemaining` | integer | yes | min -9007199254740991 |
| `data.quantityReserved` | integer | yes | min -9007199254740991 |
| `data.quantityTotal` | integer | yes | min -9007199254740991 |
| `data.redemptionCount` | integer | yes | min -9007199254740991 |
| `data.referralPoolRemaining` | integer \| null | yes | min -9007199254740991 |
| `data.referralPoolTotal` | integer \| null | yes | min -9007199254740991 |
| `data.referralsEnabled` | boolean | yes |  |
| `data.referrerRewardId` | string (uuid) \| null | yes |  |
| `data.rewardKind` | "CONSUMER" \| "REFERRER" | yes |  |
| `data.rewardType` | "DISCOUNT" \| "FREE_ITEM" \| "CASHBACK" \| "POINTS" \| "BOGO" | yes |  |
| `data.rewardValue` | integer | yes |  |
| `data.rules` | object \| null | yes |  |
| `data.rules.maxUsePerUser` | integer | no |  |
| `data.rules.minSpendMyr` | number | no | range 0–∞ |
| `data.shareUrl` | string (uri) | no |  |
| `data.startDate` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_REVIEW" \| "PUBLISHED" \| "EXPIRED" \| "DISABLED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.tenantLogoSources` | object[] | yes |  |
| `data.tenantLogoSources[].url` | string (uri) | yes |  |
| `data.tenantLogoSources[].width` | integer | yes |  |
| `data.tenantLogoUrl` | string (uri) \| null | yes |  |
| `data.tenantName` | string | no |  |
| `data.termsConditions` | string \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
PATCH /api/v1/tenants/brew-bean-kl/rewards/01a18281-915c-71cb-a2a2-867c0e7b89e1
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "quantityTotal": 250
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190891864,
    "updatedAt": 1793190892149,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-915c-71cb-a2a2-867c0e7b89e1",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "tenantName": "Brew & Bean KL",
    "tenantLogoUrl": null,
    "tenantLogoSources": [],
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a18281-89e3-761c-9766-ef5c90059d9f",
        "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 250,
    "quantityRemaining": 250,
    "quantityReserved": 0,
    "startDate": 1793190891590,
    "expiryDate": 1798374891590,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a18281-915c-7dcf-8d6e-77e86bf5df31",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "rFe9BNW35Lo75sYpf8aKI",
    "timestamp": 1793190892243
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/rewards/{rewardId}/publish

Submit reward for moderation review (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantRewardsController_publishReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/tenant-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `rewardId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 201 Created** (`application/json`) — Reward pending review

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | string | yes |  |
| `data.claimCount` | integer | yes | min -9007199254740991 |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.expiryDate` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.images` | object[] | yes | 1–10 items |
| `data.images[].fileId` | string (uuid) | yes |  |
| `data.images[].height` | integer | yes |  |
| `data.images[].sources` | object[] | yes | 1–∞ items |
| `data.images[].sources[].url` | string (uri) | yes |  |
| `data.images[].sources[].width` | integer | yes |  |
| `data.images[].url` | string (uri) | yes |  |
| `data.images[].width` | integer | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationNames` | string[] | no |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.quantityRemaining` | integer | yes | min -9007199254740991 |
| `data.quantityReserved` | integer | yes | min -9007199254740991 |
| `data.quantityTotal` | integer | yes | min -9007199254740991 |
| `data.redemptionCount` | integer | yes | min -9007199254740991 |
| `data.referralPoolRemaining` | integer \| null | yes | min -9007199254740991 |
| `data.referralPoolTotal` | integer \| null | yes | min -9007199254740991 |
| `data.referralsEnabled` | boolean | yes |  |
| `data.referrerRewardId` | string (uuid) \| null | yes |  |
| `data.rewardKind` | "CONSUMER" \| "REFERRER" | yes |  |
| `data.rewardType` | "DISCOUNT" \| "FREE_ITEM" \| "CASHBACK" \| "POINTS" \| "BOGO" | yes |  |
| `data.rewardValue` | integer | yes |  |
| `data.rules` | object \| null | yes |  |
| `data.rules.maxUsePerUser` | integer | no |  |
| `data.rules.minSpendMyr` | number | no | range 0–∞ |
| `data.shareUrl` | string (uri) | no |  |
| `data.startDate` | integer \| null | yes |  |
| `data.status` | "DRAFT" \| "PENDING_REVIEW" \| "PUBLISHED" \| "EXPIRED" \| "DISABLED" | yes |  |
| `data.tenantId` | string (uuid) | yes |  |
| `data.tenantLogoSources` | object[] | yes |  |
| `data.tenantLogoSources[].url` | string (uri) | yes |  |
| `data.tenantLogoSources[].width` | integer | yes |  |
| `data.tenantLogoUrl` | string (uri) \| null | yes |  |
| `data.tenantName` | string | no |  |
| `data.termsConditions` | string \| null | yes |  |
| `data.title` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/rewards/01a18281-915c-71cb-a2a2-867c0e7b89e1/publish
X-Client-Type: merchant
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
    "createdAt": 1793190891864,
    "updatedAt": 1793190892395,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-915c-71cb-a2a2-867c0e7b89e1",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "tenantName": "Brew & Bean KL",
    "tenantLogoUrl": null,
    "tenantLogoSources": [],
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a18281-89e3-761c-9766-ef5c90059d9f",
        "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://10.117.81.236:8097/api/v1/files/01a18281-89e3-761c-9766-ef5c90059d9f/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 250,
    "quantityRemaining": 250,
    "quantityReserved": 0,
    "startDate": 1793190891590,
    "expiryDate": 1798374891590,
    "status": "PENDING_REVIEW",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a18281-915c-7dcf-8d6e-77e86bf5df31",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "dEw770NoN17mR3Nd0prE8",
    "timestamp": 1793190892490
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/rewards/summary

Tenant reward figures: the count in each status and the units still claimable, over every reward in the store scope

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantRewardsController_summarizeRewards` · [source](../../../apps/api/src/contexts/rewards/presentation/http/tenant-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Reward catalog figures

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countsByStatus` | object | yes |  |
| `data.unitsRemaining` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

## Tenant POS Terminals

### GET /api/v1/tenants/{tenantSlug}/terminals

List the tenant's POS terminals

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTerminalsController_list` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 100, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, name. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Paginated POS terminals; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].lastSeenAt` | integer \| null | yes |  |
| `data[].locationId` | string (uuid) | yes |  |
| `data[].locationName` | string | yes |  |
| `data[].name` | string | yes |  |
| `data[].pairedAt` | integer \| null | yes |  |
| `data[].pairingCodeExpiresAt` | integer \| null | yes |  |
| `data[].status` | "AWAITING_PAIRING" \| "ACTIVE" \| "UNPAIRED" | yes |  |
| `data[].terminalId` | string | yes | length 1–100; pattern `^[A-Za-z0-9][A-Za-z0-9._:-]*$` |
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
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/terminals
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1793190816158,
      "updatedAt": 1793190824255,
      "isDeleted": false,
      "deletedAt": null,
      "id": "019b76da-a800-7cb8-a368-3b87952401bc",
      "terminalId": "KL-REGISTER-03",
      "name": "Counter tablet",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "ACTIVE",
      "pairingCodeExpiresAt": null,
      "pairedAt": 1792931645684,
      "lastSeenAt": 1788253380000
    },
    {
      "createdAt": 1793190815733,
      "updatedAt": 1793190815733,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a18280-67f4-755f-b1d1-44c604b90203",
      "terminalId": "KL-REGISTER-02",
      "name": "Drive-through",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "AWAITING_PAIRING",
      "pairingCodeExpiresAt": 1793191685684,
      "pairedAt": null,
      "lastSeenAt": null
    }
  ],
  "meta": {
    "limit": 100,
    "total": 3,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "2M3zJ9x-6snpUbzDD9agb",
    "timestamp": 1793190894390
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/terminals

Register a POS terminal at a store and get its one-time pairing code

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTerminalsController_create` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `locationId` | string (uuid) | yes |  |
| `name` | string | yes | length 1–100 |
| `terminalId` | string | no | length 1–100; pattern `^[A-Za-z0-9][A-Za-z0-9._:-]*$` |

**Response 201 Created** (`application/json`) — Terminal registered; the pairing code is shown once

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.pairingCode` | string | yes | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |
| `data.pairingCodeExpiresAt` | integer | yes |  |
| `data.terminal` | object | yes |  |
| `data.terminal.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.terminal.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.terminal.id` | string (uuid) | yes |  |
| `data.terminal.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.terminal.lastSeenAt` | integer \| null | yes |  |
| `data.terminal.locationId` | string (uuid) | yes |  |
| `data.terminal.locationName` | string | yes |  |
| `data.terminal.name` | string | yes |  |
| `data.terminal.pairedAt` | integer \| null | yes |  |
| `data.terminal.pairingCodeExpiresAt` | integer \| null | yes |  |
| `data.terminal.status` | "AWAITING_PAIRING" \| "ACTIVE" \| "UNPAIRED" | yes |  |
| `data.terminal.terminalId` | string | yes | length 1–100; pattern `^[A-Za-z0-9][A-Za-z0-9._:-]*$` |
| `data.terminal.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/terminals
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
  "name": "Bangsar front counter",
  "terminalId": "KL-BANGSAR-01"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "terminal": {
      "createdAt": 1793190895036,
      "updatedAt": 1793190895036,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a18281-9dbd-7b21-8811-5b1ad4eb1bd7",
      "terminalId": "KL-BANGSAR-01",
      "name": "Bangsar front counter",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "AWAITING_PAIRING",
      "pairingCodeExpiresAt": 1793191795037,
      "pairedAt": null,
      "lastSeenAt": null
    },
    "pairingCode": "5XNZAU6Z",
    "pairingCodeExpiresAt": 1793191795037
  },
  "meta": {
    "correlationId": "iS8glguxx7D6OzPsBAQwx",
    "timestamp": 1793190895047
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/terminals/{id}

Read one POS terminal (404 outside the caller's stores)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTerminalsController_get` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — POS terminal

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.lastSeenAt` | integer \| null | yes |  |
| `data.locationId` | string (uuid) | yes |  |
| `data.locationName` | string | yes |  |
| `data.name` | string | yes |  |
| `data.pairedAt` | integer \| null | yes |  |
| `data.pairingCodeExpiresAt` | integer \| null | yes |  |
| `data.status` | "AWAITING_PAIRING" \| "ACTIVE" \| "UNPAIRED" | yes |  |
| `data.terminalId` | string | yes | length 1–100; pattern `^[A-Za-z0-9][A-Za-z0-9._:-]*$` |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/terminals/01a18281-9dbd-7b21-8811-5b1ad4eb1bd7
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190895036,
    "updatedAt": 1793190895036,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-9dbd-7b21-8811-5b1ad4eb1bd7",
    "terminalId": "KL-BANGSAR-01",
    "name": "Bangsar front counter",
    "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
    "locationName": "Brew & Bean KL — Bukit Bintang",
    "status": "AWAITING_PAIRING",
    "pairingCodeExpiresAt": 1793191795037,
    "pairedAt": null,
    "lastSeenAt": null
  },
  "meta": {
    "correlationId": "OFh-CjVoKX_KnUlnc3vHr",
    "timestamp": 1793190895186
  }
}
```

### DELETE /api/v1/tenants/{tenantSlug}/terminals/{id}

Remove a POS terminal and revoke its API key

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTerminalsController_remove` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Terminal removed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
DELETE /api/v1/tenants/brew-bean-kl/terminals/01a18281-9dbd-7b21-8811-5b1ad4eb1bd7
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "ok": true
  },
  "meta": {
    "correlationId": "7C2iEYeXzpOYr79wcXdhq",
    "timestamp": 1793190901024
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/terminals/{id}/pairing-code

Issue a new pairing code (first pairing, expired code, or re-pair — the old key stops working once the new code is used)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTerminalsController_issuePairingCode` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 201 Created** (`application/json`) — New pairing code (shown once)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.pairingCode` | string | yes | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |
| `data.pairingCodeExpiresAt` | integer | yes |  |
| `data.terminal` | object | yes |  |
| `data.terminal.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.terminal.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.terminal.id` | string (uuid) | yes |  |
| `data.terminal.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.terminal.lastSeenAt` | integer \| null | yes |  |
| `data.terminal.locationId` | string (uuid) | yes |  |
| `data.terminal.locationName` | string | yes |  |
| `data.terminal.name` | string | yes |  |
| `data.terminal.pairedAt` | integer \| null | yes |  |
| `data.terminal.pairingCodeExpiresAt` | integer \| null | yes |  |
| `data.terminal.status` | "AWAITING_PAIRING" \| "ACTIVE" \| "UNPAIRED" | yes |  |
| `data.terminal.terminalId` | string | yes | length 1–100; pattern `^[A-Za-z0-9][A-Za-z0-9._:-]*$` |
| `data.terminal.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/terminals/01a18281-9dbd-7b21-8811-5b1ad4eb1bd7/pairing-code
X-Client-Type: merchant
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
    "terminal": {
      "createdAt": 1793190895036,
      "updatedAt": 1793190895343,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a18281-9dbd-7b21-8811-5b1ad4eb1bd7",
      "terminalId": "KL-BANGSAR-01",
      "name": "Bangsar front counter",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "AWAITING_PAIRING",
      "pairingCodeExpiresAt": 1793191795343,
      "pairedAt": null,
      "lastSeenAt": null
    },
    "pairingCode": "5H3VY7P3",
    "pairingCodeExpiresAt": 1793191795343
  },
  "meta": {
    "correlationId": "IDWz7cdPo0lOQOAbYB3TJ",
    "timestamp": 1793190895354
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/terminals/settings

Read the tenant's POS terminal policy

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTerminalsController_getSettings` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — POS terminal settings

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.requireRegisteredTerminals` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/terminals/settings
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "requireRegisteredTerminals": false
  },
  "meta": {
    "correlationId": "9RPNmTDilpn1gX_JxHI6i",
    "timestamp": 1793190894717
  }
}
```

### PATCH /api/v1/tenants/{tenantSlug}/terminals/settings

Turn 'only allow registered terminals' on or off

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTerminalsController_updateSettings` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `requireRegisteredTerminals` | boolean | yes |  |

**Response 200 OK** (`application/json`) — POS terminal settings updated

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.requireRegisteredTerminals` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
PATCH /api/v1/tenants/brew-bean-kl/terminals/settings
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "requireRegisteredTerminals": false
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "requireRegisteredTerminals": false
  },
  "meta": {
    "correlationId": "fDeqGujhXgdUGiB_3OOco",
    "timestamp": 1793190894870
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/terminals/summary

Count the tenant's live POS terminals per status, within the caller's stores

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantTerminalsController_summary` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Terminal counts per status and stores covered

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.byStatus` | object | yes |  |
| `data.byStatus.ACTIVE` | integer | yes |  |
| `data.byStatus.AWAITING_PAIRING` | integer | yes |  |
| `data.byStatus.UNPAIRED` | integer | yes |  |
| `data.storesWithTerminals` | integer | yes |  |
| `data.total` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/terminals/summary
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "total": 3,
    "byStatus": {
      "AWAITING_PAIRING": 1,
      "ACTIVE": 1,
      "UNPAIRED": 1
    },
    "storesWithTerminals": 1
  },
  "meta": {
    "correlationId": "7Spen3J8TBWioQFY3tS2V",
    "timestamp": 1793190894552
  }
}
```

## Tenant API Keys

### GET /api/v1/tenants/{tenantSlug}/api-keys

List tenant API keys

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantApiKeysController_listKeys` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-api-keys.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 100, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, name. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: revokedAt |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Paginated API key summaries; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].locationId` | string (uuid) \| null | yes |  |
| `data[].locationName` | string \| null | yes |  |
| `data[].name` | string | yes |  |
| `data[].revokedAt` | integer \| null | yes |  |
| `data[].scope` | "POS" \| "INTEGRATION" | yes |  |
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
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/api-keys?limit=2
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1793190895383,
      "updatedAt": 1793190895383,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a18281-9f22-70f1-a1f1-c7c02cfce4ec",
      "name": "Bangsar front counter",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "scope": "POS",
      "revokedAt": null
    },
    {
      "createdAt": 1793190816152,
      "updatedAt": 1793190816152,
      "isDeleted": false,
      "deletedAt": null,
      "id": "019b76da-a800-7bd5-a5dd-45b76d6c72dc",
      "name": "Old register",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "scope": "POS",
      "revokedAt": 1791462785684
    }
  ],
  "meta": {
    "limit": 2,
    "total": 5,
    "page": 1,
    "totalPages": 3,
    "nextCursor": "eyJhdCI6MTc5MzE5MDgxNjE1MiwiaWQiOiIwMTliNzZkYS1hODAwLTdiZDUtYTVkZC00NWI3NmQ2YzcyZGMifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "AnTFQgqBoY5TdYEMhApT1",
    "timestamp": 1793190897532
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/api-keys

Create a POS API key

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantApiKeysController_createKey` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-api-keys.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `locationId` | string (uuid) | no |  |
| `name` | string | no | length 1–100 |
| `scope` | "POS" \| "INTEGRATION" | no | default `"POS"` |

**Response 201 Created** (`application/json`) — API key created (shown once)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.apiKey` | string | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.locationId` | string (uuid) \| null | yes |  |
| `data.name` | string | yes |  |
| `data.scope` | "POS" \| "INTEGRATION" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/api-keys
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Back-office sync",
  "scope": "INTEGRATION"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-a818-79df-8fe2-e38e555c7548",
    "apiKey": "<redacted: one-time secret>",
    "name": "Back-office sync",
    "scope": "INTEGRATION",
    "locationId": null
  },
  "meta": {
    "correlationId": "7cO0t3gAriOYAj2dC9VP1",
    "timestamp": 1793190897697
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/api-keys/{keyId}/revoke

Revoke a POS API key (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantApiKeysController_revokeKey` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-api-keys.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `keyId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 201 Created** (`application/json`) — API key revoked

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/api-keys/01a18281-a818-79df-8fe2-e38e555c7548/revoke
X-Client-Type: merchant
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
    "ok": true
  },
  "meta": {
    "correlationId": "s5k7zjQuiZWXYCcNr2yqB",
    "timestamp": 1793190900851
  }
}
```

## Tenant Redemptions

### GET /api/v1/tenants/{tenantSlug}/redemptions

List tenant redemptions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantRedemptionsController_listRedemptions` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-redemptions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: redeemedAt. Default: -redeemedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: redeemedAt |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Paginated redemption history

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].customerBanned` | boolean | yes |  |
| `data[].redeemedAt` | integer | yes |  |
| `data[].redemptionId` | string (uuid) | yes |  |
| `data[].redemptionMethod` | "SCAN" \| "MANUAL" | yes |  |
| `data[].rewardTitle` | string | yes |  |
| `data[].terminalId` | string | yes |  |
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

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/redemptions?limit=2
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "redemptionId": "01a18281-9fdc-7158-8117-226b815c6e9b",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1793190895511,
      "terminalId": "KL-REGISTER-01",
      "redemptionMethod": "MANUAL",
      "customerBanned": false
    },
    {
      "redemptionId": "019b76da-a800-704e-9593-80d298dad1b4",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1793190815855,
      "terminalId": "KL-REGISTER-01",
      "redemptionMethod": "SCAN",
      "customerBanned": false
    }
  ],
  "meta": {
    "limit": 2,
    "total": 914,
    "page": 1,
    "totalPages": 457,
    "nextCursor": "eyJhdCI6MTc5MzE5MDgxNTg1NSwiaWQiOiIwMTliNzZkYS1hODAwLTcwNGUtOTU5My04MGQyOThkYWQxYjQifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "BlRgujIWFS1KsSbGG39ZA",
    "timestamp": 1793190895989
  }
}
```

## Tenant Customer Bans

### GET /api/v1/tenants/{tenantSlug}/customer-bans

List the tenant's active customer bans, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantCustomerBansController_list` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-customer-bans.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: bannedAt. Default: -bannedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** (`application/json`) — One page of active customer bans; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].bannedAt` | integer | yes |  |
| `data[].bannedBy` | object \| null | yes |  |
| `data[].bannedBy.fullName` | string | yes |  |
| `data[].bannedBy.id` | string (uuid) | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].reason` | string | yes |  |
| `data[].source` | object \| null | yes |  |
| `data[].source.redeemedAt` | integer | yes |  |
| `data[].source.redemptionId` | string (uuid) | yes |  |
| `data[].source.rewardTitle` | string | yes |  |
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

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/customer-bans?limit=2
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "01a18281-a1ec-7f84-897d-eb8d0e06d2f8",
      "reason": "Showed a screenshot of a voucher already redeemed.",
      "bannedAt": 1793190896108,
      "bannedBy": {
        "id": "019b76da-a800-763a-b64a-fd037629f93f",
        "fullName": "Ahmad Brew"
      },
      "source": {
        "redemptionId": "01a18281-9fdc-7158-8117-226b815c6e9b",
        "rewardTitle": "Free coffee — Grand Opening",
        "redeemedAt": 1793190895511
      }
    },
    {
      "id": "019b76da-a800-73e4-9126-129dae4f7e20",
      "reason": "Tried to redeem the same voucher twice by showing a screenshot to two cashiers.",
      "bannedAt": 1793018018442,
      "bannedBy": {
        "id": "019b76da-a800-763a-b64a-fd037629f93f",
        "fullName": "Ahmad Brew"
      },
      "source": {
        "redemptionId": "019b76da-a800-7ddb-afb6-f82344454a64",
        "rewardTitle": "Morning brew club — free refill",
        "redeemedAt": 1789974720000
      }
    }
  ],
  "meta": {
    "limit": 2,
    "total": 2,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "wjCawLxphEqenTI24PaQB",
    "timestamp": 1793190896257
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/customer-bans

Ban the customer behind one of the tenant's redemptions

404 TENANT_REDEMPTION_NOT_FOUND for a redemption outside the caller's stores; 409 TENANT_CUSTOMER_ALREADY_BANNED when the customer already has an active ban.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantCustomerBansController_ban` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-customer-bans.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 1–500 |
| `redemptionId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Customer banned

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.bannedAt` | integer | yes |  |
| `data.bannedBy` | object \| null | yes |  |
| `data.bannedBy.fullName` | string | yes |  |
| `data.bannedBy.id` | string (uuid) | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.reason` | string | yes |  |
| `data.source` | object \| null | yes |  |
| `data.source.redeemedAt` | integer | yes |  |
| `data.source.redemptionId` | string (uuid) | yes |  |
| `data.source.rewardTitle` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 404 | `TENANT_REDEMPTION_NOT_FOUND` | Stated in the endpoint description. |
| 409 | `TENANT_CUSTOMER_ALREADY_BANNED` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/customer-bans
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "redemptionId": "01a18281-9fdc-7158-8117-226b815c6e9b",
  "reason": "Showed a screenshot of a voucher already redeemed."
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-a1ec-7f84-897d-eb8d0e06d2f8",
    "reason": "Showed a screenshot of a voucher already redeemed.",
    "bannedAt": 1793190896108,
    "bannedBy": {
      "id": "019b76da-a800-763a-b64a-fd037629f93f",
      "fullName": "Ahmad Brew"
    },
    "source": {
      "redemptionId": "01a18281-9fdc-7158-8117-226b815c6e9b",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1793190895511
    }
  },
  "meta": {
    "correlationId": "21acIomu3H5BOP394Tsac",
    "timestamp": 1793190896123
  }
}
```

### POST /api/v1/tenants/{tenantSlug}/customer-bans/{banId}/lift

Lift a customer ban: the customer may claim and redeem again

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantCustomerBansController_lift` · [source](../../../apps/api/src/contexts/tenancy/presentation/http/tenant-customer-bans.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `banId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Ban lifted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/tenants/brew-bean-kl/customer-bans/01a18281-a1ec-7f84-897d-eb8d0e06d2f8/lift
X-Client-Type: merchant
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
    "ok": true
  },
  "meta": {
    "correlationId": "9Z_cpkC7sABpeEh9pmKkA",
    "timestamp": 1793190896408
  }
}
```

## Tenant Access

### DELETE /api/v1/tenants/{tenantSlug}/access/grants/{grantId}

Take an extra permission back (its granter always may)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_revokeGrant` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `grantId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Permission revoked

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/access/members/{membershipId}

One member's access: their role and stores

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_member` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `membershipId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The member

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.email` | string (email) | yes |  |
| `data.fullName` | string | yes |  |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.membershipId` | string (uuid) | yes |  |
| `data.roleId` | string (uuid) | yes |  |
| `data.roleName` | string | yes |  |
| `data.templateKey` | "OWNER" \| "MANAGER" \| "CASHIER" \| null | yes |  |
| `data.userId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/tenants/{tenantSlug}/access/members/{membershipId}

Remove a member: their role, grants and shares stop at once

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_removeMember` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `membershipId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Member removed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/access/members/{membershipId}/grants

A member's extra permissions still in force, newest first, with their end time

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_grants` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `membershipId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The member's grants

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].expiresAt` | integer \| null | yes |  |
| `data[].grantedAt` | integer | yes |  |
| `data[].grantedBy` | string \| null | yes |  |
| `data[].grantedVia` | string \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].locationId` | string (uuid) \| null | yes |  |
| `data[].membershipId` | string (uuid) | yes |  |
| `data[].permission` | object | yes |  |
| `data[].permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data[].permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/access/members/{membershipId}/grants

Give a member an extra permission, permanent or until `expiresAt`

Only a permission the caller's own role gives, within the caller's stores.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_grant` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `membershipId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `expiresAt` | integer | no |  |
| `locationId` | string (uuid) | no |  |
| `permission` | object | yes |  |
| `permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |

**Response 201 Created** (`application/json`) — Permission granted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.expiresAt` | integer \| null | yes |  |
| `data.grantedAt` | integer | yes |  |
| `data.grantedBy` | string \| null | yes |  |
| `data.grantedVia` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.locationId` | string (uuid) \| null | yes |  |
| `data.membershipId` | string (uuid) | yes |  |
| `data.permission` | object | yes |  |
| `data.permission.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.permission.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PUT /api/v1/tenants/{tenantSlug}/access/members/{membershipId}/role

Change a member's role

Only an Owner makes an Owner; the last Owner keeps the Owner role.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_changeMemberRole` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `membershipId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleId` | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Member's role changed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/access/roles

The tenant's roles, with their permissions and how many members hold each

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_roles` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The tenant's roles

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].holderCount` | integer | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].name` | string | yes |  |
| `data[].permissions` | object[] | yes |  |
| `data[].permissions[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data[].permissions[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |
| `data[].templateKey` | "OWNER" \| "MANAGER" \| "CASHIER" \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/access/roles

Create a role from tenant permissions the caller's own role holds

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_createRole` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | length 1–100 |
| `permissions` | object[] | yes | 0–200 items |
| `permissions[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `permissions[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |

**Response 201 Created** (`application/json`) — Role created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.holderCount` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.name` | string | yes |  |
| `data.permissions` | object[] | yes |  |
| `data.permissions[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.permissions[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |
| `data.templateKey` | "OWNER" \| "MANAGER" \| "CASHIER" \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### PATCH /api/v1/tenants/{tenantSlug}/access/roles/{roleId}

Rename a role or replace its permissions (never the Owner role)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_updateRole` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `roleId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | no | length 1–100 |
| `permissions` | object[] | no | 0–200 items |
| `permissions[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `permissions[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |

**Response 200 OK** (`application/json`) — Role updated

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.holderCount` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.name` | string | yes |  |
| `data.permissions` | object[] | yes |  |
| `data.permissions[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.permissions[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |
| `data.templateKey` | "OWNER" \| "MANAGER" \| "CASHIER" \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/tenants/{tenantSlug}/access/roles/{roleId}

Delete a role no member holds

409 with `holderCount` and `holdersVersion` while members hold it: reassign them first.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_deleteRole` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `roleId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Role deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 409 | — | Members still hold the role |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/access/roles/{roleId}/holders

The members holding a role, and the version of that list to quote when reassigning them

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_holders` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `roleId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The role's holders

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.holders` | object[] | yes |  |
| `data.holders[].email` | string (email) | yes |  |
| `data.holders[].fullName` | string | yes |  |
| `data.holders[].membershipId` | string (uuid) | yes |  |
| `data.holders[].userId` | string (uuid) | yes |  |
| `data.holdersVersion` | string | yes | at least 1 characters |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/access/roles/{roleId}/reassign

Move every holder of a role to a new role in one step

409 when the holders changed since `holdersVersion` was read.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_reassign` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `roleId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `assignments` | object[] | yes | 1–1000 items |
| `assignments[].membershipId` | string (uuid) | yes |  |
| `assignments[].roleId` | string (uuid) | yes |  |
| `holdersVersion` | string | yes | at least 1 characters |

**Response 201 Created** (`application/json`) — Holders reassigned

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 409 | — | The role's holders changed |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/access/roles/{roleId}/reset

Make a role equal the template it was copied from again

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_resetRole` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `roleId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Role reset to its template

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.holderCount` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.name` | string | yes |  |
| `data.permissions` | object[] | yes |  |
| `data.permissions[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.permissions[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+27 more) | yes |  |
| `data.templateKey` | "OWNER" \| "MANAGER" \| "CASHIER" \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/tenants/{tenantSlug}/access/shares

The records shared with single members, newest first

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_shares` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The tenant's shares

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].expiresAt` | integer \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].level` | "VIEW" \| "EDIT" | yes |  |
| `data[].membershipId` | string (uuid) | yes |  |
| `data[].resource` | "REWARD" | yes |  |
| `data[].resourceId` | string (uuid) | yes |  |
| `data[].sharedAt` | integer | yes |  |
| `data[].sharedBy` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/tenants/{tenantSlug}/access/shares

Share one record with one member, to view or edit, permanent or until `expiresAt`

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_share` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `expiresAt` | integer | no |  |
| `level` | "VIEW" \| "EDIT" | yes |  |
| `membershipId` | string (uuid) | yes |  |
| `resource` | "REWARD" | yes |  |
| `resourceId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Record shared

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.expiresAt` | integer \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.level` | "VIEW" \| "EDIT" | yes |  |
| `data.membershipId` | string (uuid) | yes |  |
| `data.resource` | "REWARD" | yes |  |
| `data.resourceId` | string (uuid) | yes |  |
| `data.sharedAt` | integer | yes |  |
| `data.sharedBy` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### DELETE /api/v1/tenants/{tenantSlug}/access/shares/{shareId}

Stop sharing a record (its sharer always may)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAccessController_unshare` · [source](../../../apps/api/src/contexts/authorization/presentation/http/tenant-access.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `shareId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Share removed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 403 | — | The caller's role does not allow this, or it would give more than their own role or stores |
| 404 | — | No such tenant, role, member, grant or share in it |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

## Tenant Analytics

### GET /api/v1/tenants/{tenantSlug}/analytics

Tenant reward performance analytics

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAnalyticsController_getAnalytics` · [source](../../../apps/api/src/contexts/reporting/presentation/http/tenant-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `from` | query | integer | no |  |
| `to` | query | integer | no |  |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Summary metrics, trends, and top rewards

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.activeRewards` | object | yes |  |
| `data.activeRewards.changePercent` | number \| null | yes |  |
| `data.activeRewards.value` | number | yes |  |
| `data.claimsOverTime` | object[] | yes |  |
| `data.claimsOverTime[].claims` | integer | yes |  |
| `data.claimsOverTime[].date` | integer | yes |  |
| `data.claimsOverTime[].redemptions` | integer | yes |  |
| `data.conversionRate` | object | yes |  |
| `data.conversionRate.changePercent` | number \| null | yes |  |
| `data.conversionRate.value` | number | yes |  |
| `data.period` | object | yes |  |
| `data.period.from` | integer | yes |  |
| `data.period.timeZone` | string | yes | length 1–64 |
| `data.period.to` | integer | yes |  |
| `data.referralCount` | object | yes |  |
| `data.referralCount.changePercent` | number \| null | yes |  |
| `data.referralCount.value` | number | yes |  |
| `data.sales` | object | yes |  |
| `data.sales.averageBillMinor` | object | yes |  |
| `data.sales.averageBillMinor.changePercent` | number \| null | yes |  |
| `data.sales.averageBillMinor.value` | number | yes |  |
| `data.sales.bills` | object | yes |  |
| `data.sales.bills.changePercent` | number \| null | yes |  |
| `data.sales.bills.value` | number | yes |  |
| `data.sales.currency` | "MYR" | yes |  |
| `data.sales.firstBillAt` | integer \| null | yes |  |
| `data.sales.overTime` | object[] | yes |  |
| `data.sales.overTime[].bills` | integer | yes |  |
| `data.sales.overTime[].date` | integer | yes |  |
| `data.sales.overTime[].salesMinor` | integer | yes |  |
| `data.sales.totalSalesMinor` | object | yes |  |
| `data.sales.totalSalesMinor.changePercent` | number \| null | yes |  |
| `data.sales.totalSalesMinor.value` | number | yes |  |
| `data.topRewards` | object[] | yes |  |
| `data.topRewards[].claims` | integer | yes |  |
| `data.topRewards[].redemptions` | integer | yes |  |
| `data.topRewards[].rewardId` | string (uuid) | yes |  |
| `data.topRewards[].title` | string | yes |  |
| `data.totalClaims` | object | yes |  |
| `data.totalClaims.changePercent` | number \| null | yes |  |
| `data.totalClaims.value` | number | yes |  |
| `data.totalRedemptions` | object | yes |  |
| `data.totalRedemptions.changePercent` | number \| null | yes |  |
| `data.totalRedemptions.value` | number | yes |  |
| `data.totalRewards` | object | yes |  |
| `data.totalRewards.changePercent` | number \| null | yes |  |
| `data.totalRewards.value` | number | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/analytics
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "period": {
      "from": 1788710400000,
      "to": 1793190896626,
      "timeZone": "Asia/Kuala_Lumpur"
    },
    "totalRewards": {
      "value": 16,
      "changePercent": 100
    },
    "activeRewards": {
      "value": 10,
      "changePercent": 100
    },
    "totalClaims": {
      "value": 191,
      "changePercent": -2
    },
    "totalRedemptions": {
      "value": 167,
      "changePercent": 3
    },
    "conversionRate": {
      "value": 87.4,
      "changePercent": 5
    },
    "referralCount": {
      "value": 0,
      "changePercent": null
    },
    "claimsOverTime": [
      {
        "date": 1788710400000,
        "claims": 21,
        "redemptions": 22
      },
      {
        "date": 1789315200000,
        "claims": 28,
        "redemptions": 22
      }
    ],
    "topRewards": [
      {
        "rewardId": "019b76da-a800-7a5e-8873-45fa5124324b",
        "title": "Morning brew club — free refill",
        "claims": 94,
        "redemptions": 89
      },
      {
        "rewardId": "019b76da-a800-791e-b43c-eb37c9f12ab4",
        "title": "Istimewa latte seni hujung minggu",
        "claims": 86,
        "redemptions": 74
      }
    ],
    "sales": {
      "currency": "MYR",
      "totalSalesMinor": {
        "value": 472309,
        "changePercent": -1
      },
      "bills": {
        "value": 167,
        "changePercent": 3
      },
      "averageBillMinor": {
        "value": 2828,
        "changePercent": -4
      },
      "overTime": [
        {
          "date": 1788710400000,
          "salesMinor": 52410,
          "bills": 22
        },
        {
          "date": 1789315200000,
          "salesMinor": 61748,
          "bills": 22
        }
      ],
      "firstBillAt": 1761613140000
    }
  },
  "meta": {
    "correlationId": "_1yfQ86VY61BEDaYA3xEO",
    "timestamp": 1793190896811
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/analytics/dashboard

Merchant analytics dashboard: custom range + interval, compared totals, series, store / reward / redemption-method breakdowns

Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); `interval` (day | week | month) defaults from the range length. Every number is computed in Postgres; buckets are cut in `range.timeZone`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `TenantAnalyticsController_getDashboard` · [source](../../../apps/api/src/contexts/reporting/presentation/http/tenant-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `from` | query | integer | no | Range start, epoch ms, inclusive. Default: 30 days before `to`. |
| `to` | query | integer | no | Range end, epoch ms, EXCLUSIVE. Default: now. At most 366 days after `from`. |
| `interval` | query | "day" \| "week" \| "month" | no | Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length. |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Merchant analytics dashboard

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.byRedemptionMethod` | object[] | yes |  |
| `data.byRedemptionMethod[].method` | "SCAN" \| "MANUAL" | yes |  |
| `data.byRedemptionMethod[].redemptions` | integer | yes |  |
| `data.byReward` | object[] | yes |  |
| `data.byReward[].claims` | integer | yes |  |
| `data.byReward[].conversionRate` | number | yes | range 0–∞ |
| `data.byReward[].redemptions` | integer | yes |  |
| `data.byReward[].rewardId` | string (uuid) | yes |  |
| `data.byReward[].title` | string | yes |  |
| `data.byStore` | object[] | yes |  |
| `data.byStore[].averageBillMinor` | integer | yes |  |
| `data.byStore[].bills` | integer | yes |  |
| `data.byStore[].city` | "KUALA_LUMPUR" \| "MELAKA" \| null | yes |  |
| `data.byStore[].locationId` | string (uuid) \| null | yes |  |
| `data.byStore[].name` | string \| null | yes |  |
| `data.byStore[].redemptions` | integer | yes |  |
| `data.byStore[].salesMinor` | integer | yes |  |
| `data.currency` | "MYR" | yes |  |
| `data.firstBillAt` | integer \| null | yes |  |
| `data.range` | object | yes |  |
| `data.range.from` | integer | yes |  |
| `data.range.interval` | "day" \| "week" \| "month" | yes | Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length. |
| `data.range.previousFrom` | integer | yes |  |
| `data.range.previousTo` | integer | yes |  |
| `data.range.timeZone` | string | yes | length 1–64 |
| `data.range.to` | integer | yes |  |
| `data.series` | object[] | yes |  |
| `data.series[].averageBillMinor` | integer | yes |  |
| `data.series[].bills` | integer | yes |  |
| `data.series[].claims` | integer | yes |  |
| `data.series[].end` | integer | yes |  |
| `data.series[].isPartial` | boolean | yes |  |
| `data.series[].redemptions` | integer | yes |  |
| `data.series[].salesMinor` | integer | yes |  |
| `data.series[].start` | integer | yes |  |
| `data.totals` | object | yes |  |
| `data.totals.averageBillMinor` | object | yes |  |
| `data.totals.averageBillMinor.change` | number | yes |  |
| `data.totals.averageBillMinor.changePercent` | number \| null | yes |  |
| `data.totals.averageBillMinor.previous` | number | yes |  |
| `data.totals.averageBillMinor.value` | number | yes |  |
| `data.totals.bills` | object | yes |  |
| `data.totals.bills.change` | number | yes |  |
| `data.totals.bills.changePercent` | number \| null | yes |  |
| `data.totals.bills.previous` | number | yes |  |
| `data.totals.bills.value` | number | yes |  |
| `data.totals.claims` | object | yes |  |
| `data.totals.claims.change` | number | yes |  |
| `data.totals.claims.changePercent` | number \| null | yes |  |
| `data.totals.claims.previous` | number | yes |  |
| `data.totals.claims.value` | number | yes |  |
| `data.totals.conversionRate` | object | yes |  |
| `data.totals.conversionRate.change` | number | yes |  |
| `data.totals.conversionRate.changePercent` | number \| null | yes |  |
| `data.totals.conversionRate.previous` | number | yes |  |
| `data.totals.conversionRate.value` | number | yes |  |
| `data.totals.customers` | object | yes |  |
| `data.totals.customers.change` | number | yes |  |
| `data.totals.customers.changePercent` | number \| null | yes |  |
| `data.totals.customers.previous` | number | yes |  |
| `data.totals.customers.value` | number | yes |  |
| `data.totals.redemptions` | object | yes |  |
| `data.totals.redemptions.change` | number | yes |  |
| `data.totals.redemptions.changePercent` | number \| null | yes |  |
| `data.totals.redemptions.previous` | number | yes |  |
| `data.totals.redemptions.value` | number | yes |  |
| `data.totals.salesMinor` | object | yes |  |
| `data.totals.salesMinor.change` | number | yes |  |
| `data.totals.salesMinor.changePercent` | number \| null | yes |  |
| `data.totals.salesMinor.previous` | number | yes |  |
| `data.totals.salesMinor.value` | number | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Stated in the endpoint description. |
| 503 | `ANALYTICS_QUERY_TIMEOUT` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/tenants/brew-bean-kl/analytics/dashboard?interval=week
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "range": {
      "from": 1790598897020,
      "to": 1793190897020,
      "timeZone": "Asia/Kuala_Lumpur",
      "interval": "week",
      "previousFrom": 1788006897020,
      "previousTo": 1790598897020
    },
    "currency": "MYR",
    "firstBillAt": 1761613140000,
    "totals": {
      "salesMinor": {
        "value": 278677,
        "previous": 265158,
        "change": 13519,
        "changePercent": 5.1
      },
      "bills": {
        "value": 98,
        "previous": 94,
        "change": 4,
        "changePercent": 4.3
      },
      "averageBillMinor": {
        "value": 2844,
        "previous": 2821,
        "change": 23,
        "changePercent": 0.8
      },
      "claims": {
        "value": 108,
        "previous": 107,
        "change": 1,
        "changePercent": 0.9
      },
      "redemptions": {
        "value": 98,
        "previous": 94,
        "change": 4,
        "changePercent": 4.3
      },
      "conversionRate": {
        "value": 90.7,
        "previous": 87.9,
        "change": 2.8,
        "changePercent": 3.2
      },
      "customers": {
        "value": 30,
        "previous": 29,
        "change": 1,
        "changePercent": 3.4
      }
    },
    "series": [
      {
        "start": 1790598897020,
        "end": 1791129600000,
        "isPartial": true,
        "salesMinor": 61220,
        "bills": 20,
        "averageBillMinor": 3061,
        "claims": 25,
        "redemptions": 20
      },
      {
        "start": 1791129600000,
        "end": 1791734400000,
        "isPartial": false,
        "salesMinor": 64001,
        "bills": 22,
        "averageBillMinor": 2909,
        "claims": 24,
        "redemptions": 22
      }
    ],
    "byStore": [
      {
        "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
        "name": "Brew & Bean KL — Bukit Bintang",
        "city": "KUALA_LUMPUR",
        "salesMinor": 278677,
        "bills": 98,
        "averageBillMinor": 2844,
        "redemptions": 98
      },
      {
        "locationId": "01a18281-7b12-75fd-aa8e-86a3847fec12",
        "name": "Brew & Bean KL — Bangsar",
        "city": "KUALA_LUMPUR",
        "salesMinor": 0,
        "bills": 0,
        "averageBillMinor": 0,
        "redemptions": 0
      }
    ],
    "byReward": [
      {
        "rewardId": "019b76da-a800-791e-b43c-eb37c9f12ab4",
        "title": "Istimewa latte seni hujung minggu",
        "claims": 53,
        "redemptions": 49,
        "conversionRate": 92.5
      },
      {
        "rewardId": "019b76da-a800-7a5e-8873-45fa5124324b",
        "title": "Morning brew club — free refill",
        "claims": 44,
        "redemptions": 45,
        "conversionRate": 102.3
      }
    ],
    "byRedemptionMethod": [
      {
        "method": "SCAN",
        "redemptions": 65
      },
      {
        "method": "MANUAL",
        "redemptions": 33
      }
    ]
  },
  "meta": {
    "correlationId": "goUAzybKgNwSBfKsmCQOQ",
    "timestamp": 1793190897085
  }
}
```

### GET /api/v1/tenants/{tenantSlug}/analytics/export

Download the merchant analytics report (csv | xlsx | pdf) for a date range

The body is the file (Content-Disposition: attachment). Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); both bounds are required. Each export writes an audit row and is limited to 10 per caller per 10 minutes: 429 ANALYTICS_EXPORT_RATE_LIMITED with `Retry-After`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Tenant member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/pdf` · `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` · `text/csv; charset=utf-8` (errors are always `application/json`)
- Operation id `TenantAnalyticsController_exportReport` · [source](../../../apps/api/src/contexts/reporting/presentation/http/tenant-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `tenantSlug` | path | string \| string (uuid) | yes |  |
| `from` | query | integer | yes | Range start, epoch ms, inclusive. |
| `to` | query | integer | yes | Range end, epoch ms, EXCLUSIVE. At most 366 days after `from`. |
| `interval` | query | "day" \| "week" \| "month" | no | Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length. |
| `locationId` | query | string (uuid) | no |  |
| `format` | query | "csv" \| "xlsx" \| "pdf" | yes | File format of the export |

**Response 200 OK** — The report file (Content-Disposition: attachment) (`application/pdf` · `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` · `text/csv; charset=utf-8`)

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Stated in the endpoint description. |
| 429 | `ANALYTICS_EXPORT_RATE_LIMITED` | Stated in the endpoint description. |
| 503 | `ANALYTICS_QUERY_TIMEOUT` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal). The body is the file itself (Content-Type of the format, Content-Disposition: attachment; filename=…); errors keep the JSON error envelope. See docs/technical/api/analytics.md.

```http
GET /api/v1/tenants/brew-bean-kl/analytics/export?from=1790598897096&to=1793190897096&format=xlsx
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet):

```text
<8672 bytes of application/vnd.openxmlformats-officedocument.spreadsheetml.sheet>
```
