---
title: "API reference — Merchant organizations (portal API)"
description: "Everything the merchant portal calls under /orgs/{orgSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics."
order: 5
author: "Generated from the OpenAPI export"
lastUpdated: 1792368000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Merchant organizations (portal API)

Everything the merchant portal calls under /orgs/{orgSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics.

How these endpoints fit together: [Stores and team guide](../../user-guide/03-stores-and-team.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Organizations

### POST /api/v1/admin/organizations/invites

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:MERCHANT_ORG`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationAdminController_createInvite` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization-admin.controller.ts)

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
| `intendedRole` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | no | default `"OWNER"` |
| `slug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Response 201 Created** (`application/json`) — Organization invite created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.inviteToken` | string | yes | at least 1 characters |
| `data.organizationId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/organizations/invites
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
    "organizationId": "01a1557c-c1e4-771b-89c7-d6f91e7751d1",
    "inviteToken": "6b84d2b88eac316d75a8364924b701283426a5a3e07b0b965ef5104cd404ed23"
  },
  "meta": {
    "correlationId": "olhET_ghcS30k3dLaun-_",
    "timestamp": 1792435601918
  }
}
```

### POST /api/v1/orgs/{orgSlug}/access-requests

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_requestAccess` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `message` | string | no | at most 500 characters |

**Response 201 Created** (`application/json`) — Organization access request created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.message` | string \| null | yes |  |
| `data.organizationId` | string (uuid) | yes |  |
| `data.status` | "PENDING" \| "APPROVED" \| "REJECTED" \| "CANCELLED" | yes |  |
| `data.userId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as bob.smith@example.com (web app).

```http
POST /api/v1/orgs/brew-bean-kl/access-requests
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
    "id": "01a1557c-e35a-7844-9af7-99073c3cb119",
    "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "userId": "01a1557a-c0c7-753f-974a-a5d794c564ed",
    "status": "PENDING",
    "message": "I run the Bangsar morning shift",
    "createdAt": 1792435610448
  },
  "meta": {
    "correlationId": "u32rTcBTFBTSOPz7xp0pS",
    "timestamp": 1792435610475
  }
}
```

### POST /api/v1/orgs/{orgSlug}/access-requests/{requestId}/review

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_reviewAccessRequest` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `requestId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `⟨shape 1⟩ approve` | true | yes |  |
| `⟨shape 1⟩ locationIds` | string (uuid)[] | yes | 0–200 items |
| `⟨shape 1⟩ locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `⟨shape 1⟩ role` | "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
| `⟨shape 2⟩ approve` | false | yes |  |

**Response 201 Created** (`application/json`) — Organization access request reviewed

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
POST /api/v1/orgs/brew-bean-kl/access-requests/01a1557c-e35a-7844-9af7-99073c3cb119/review
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
    "correlationId": "w_Z4z6GnyvvQr03Sm4OVP",
    "timestamp": 1792435610644
  }
}
```

### GET /api/v1/orgs/{orgSlug}/context

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_getContext` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Organization context for the signed-in member

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
| `data.locations[].organizationId` | string (uuid) | yes |  |
| `data.locations[].rejectionReason` | string \| null | yes |  |
| `data.locations[].status` | "PENDING_APPROVAL" \| "ACTIVE" \| "REJECTED" \| "INACTIVE" | yes |  |
| `data.locations[].updatedAt` | integer | yes |  |
| `data.membership` | object | yes |  |
| `data.membership.createdAt` | integer | yes |  |
| `data.membership.displayName` | string \| null | yes |  |
| `data.membership.id` | string (uuid) | yes |  |
| `data.membership.locationIds` | string (uuid)[] | yes |  |
| `data.membership.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.membership.organizationId` | string (uuid) | yes |  |
| `data.membership.role` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
| `data.membership.status` | "ACTIVE" \| "SUSPENDED" \| "PENDING" | yes |  |
| `data.membership.updatedAt` | integer | yes |  |
| `data.membership.userId` | string (uuid) | yes |  |
| `data.merchantProfile` | object \| null | yes |  |
| `data.merchantProfile.category` | string \| null | yes |  |
| `data.merchantProfile.city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `data.merchantProfile.contactEmail` | string (email) | yes |  |
| `data.merchantProfile.contactPhone` | string \| null | yes |  |
| `data.merchantProfile.kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |
| `data.merchantProfile.legalName` | string \| null | yes |  |
| `data.merchantProfile.organizationId` | string (uuid) | yes |  |
| `data.organization` | object | yes |  |
| `data.organization.createdAt` | integer | yes |  |
| `data.organization.displayName` | string | yes |  |
| `data.organization.id` | string (uuid) | yes |  |
| `data.organization.lifecycleState` | "PROVISIONING" \| "ACTIVE" \| "RESTRICTED" \| "SUSPENDED" \| "PENDING_DELETION" \| "DELETED" | yes |  |
| `data.organization.logo` | object \| null | yes |  |
| `data.organization.logo.fileId` | string (uuid) | yes |  |
| `data.organization.logo.sources` | object[] | yes |  |
| `data.organization.logo.sources[].url` | string (uri) | yes |  |
| `data.organization.logo.sources[].width` | integer | yes |  |
| `data.organization.logo.url` | string (uri) | yes |  |
| `data.organization.primaryLocationId` | string (uuid) \| null | yes |  |
| `data.organization.slug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.organization.timeZone` | string | yes | length 1–64 |
| `data.organization.updatedAt` | integer | yes |  |
| `data.policyVersion` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/orgs/brew-bean-kl/context
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "organization": {
      "id": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "slug": "brew-bean-kl",
      "displayName": "Brew & Bean KL",
      "lifecycleState": "ACTIVE",
      "primaryLocationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "createdAt": 1792435514595,
      "updatedAt": 1792435514595,
      "timeZone": "Asia/Kuala_Lumpur",
      "logo": null
    },
    "membership": {
      "id": "019b76da-a800-7b1d-b660-30bdb341a50c",
      "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "userId": "019b76da-a800-763a-b64a-fd037629f93f",
      "role": "OWNER",
      "status": "ACTIVE",
      "displayName": "Ahmad (Owner)",
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": [],
      "createdAt": 1792435514638,
      "updatedAt": 1792435514638
    },
    "locations": [
      {
        "id": "019b76da-a800-701a-abbd-a9a411b6958b",
        "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
        "name": "Brew & Bean KL — Bukit Bintang",
        "code": "primary",
        "addressText": "12 Jalan Bukit Bintang, Kuala Lumpur",
        "city": "KUALA_LUMPUR",
        "contactPhone": "+60321456789",
        "status": "ACTIVE",
        "rejectionReason": null,
        "isPrimary": true,
        "createdAt": 1792435514608,
        "updatedAt": 1792435514608
      }
    ],
    "merchantProfile": {
      "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "legalName": "Brew & Bean KL Sdn Bhd",
      "category": "cafe",
      "city": "KUALA_LUMPUR",
      "kybStatus": "APPROVED",
      "contactEmail": "brew.owner@kl-rewards.demo",
      "contactPhone": "+60321456789"
    },
    "policyVersion": 1
  },
  "meta": {
    "correlationId": "JUWPn4K-CX_C51f0Rtshg",
    "timestamp": 1792435605201
  }
}
```

### POST /api/v1/orgs/{orgSlug}/locations

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_createLocation` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressText` | string | yes | length 1–2000 |
| `contactPhone` | string | no | length 1–20 |
| `name` | string | yes | length 1–200 |

**Response 201 Created** (`application/json`) — Organization store location requested

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
| `data.organizationId` | string (uuid) | yes |  |
| `data.rejectionReason` | string \| null | yes |  |
| `data.status` | "PENDING_APPROVAL" \| "ACTIVE" \| "REJECTED" \| "INACTIVE" | yes |  |
| `data.updatedAt` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/orgs/brew-bean-kl/locations
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
    "id": "01a1557c-d78b-7fd2-944c-6be971eedf85",
    "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "name": "Brew & Bean KL — Bangsar",
    "code": "brew-bean-kl-bangsar",
    "addressText": "21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur",
    "city": "KUALA_LUMPUR",
    "contactPhone": "+60 3-2283 1234",
    "status": "PENDING_APPROVAL",
    "rejectionReason": null,
    "isPrimary": false,
    "createdAt": 1792435607436,
    "updatedAt": 1792435607436
  },
  "meta": {
    "correlationId": "w9qf504S4L3rgLm5595xV",
    "timestamp": 1792435607449
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/locations/{locationId}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_updateLocation` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `locationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressText` | string | yes | length 1–2000 |
| `contactPhone` | string | no | length 1–20 |
| `name` | string | yes | length 1–200 |

**Response 200 OK** (`application/json`) — Rejected organization store location resubmitted

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
| `data.organizationId` | string (uuid) | yes |  |
| `data.rejectionReason` | string \| null | yes |  |
| `data.status` | "PENDING_APPROVAL" \| "ACTIVE" \| "REJECTED" \| "INACTIVE" | yes |  |
| `data.updatedAt` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
PATCH /api/v1/orgs/brew-bean-kl/locations/01a1557c-d78b-7fd2-944c-6be971eedf85
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
    "id": "01a1557c-d78b-7fd2-944c-6be971eedf85",
    "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "name": "Brew & Bean KL — Bangsar",
    "code": "brew-bean-kl-bangsar",
    "addressText": "Lot G-21, 21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur",
    "city": "KUALA_LUMPUR",
    "contactPhone": "+60 3-2283 1234",
    "status": "PENDING_APPROVAL",
    "rejectionReason": null,
    "isPrimary": false,
    "createdAt": 1792435607436,
    "updatedAt": 1792435607627
  },
  "meta": {
    "correlationId": "0WbhfxbEMFTNqIw7LDsBC",
    "timestamp": 1792435607638
  }
}
```

### POST /api/v1/orgs/{orgSlug}/locations/{locationId}/close

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_closeLocation` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
| `data.storeId` | string (uuid) | yes |  |
| `data.storeMembershipsRemoved` | integer | yes |  |
| `data.terminalsRemoved` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
POST /api/v1/orgs/brew-bean-kl/locations/01a1557c-d8af-76e2-9fe2-3227d9fadde4/close
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
    "locationId": "01a1557c-d8af-76e2-9fe2-3227d9fadde4",
    "storeId": "01a1557c-d8b5-70ba-947e-683fbd693b57",
    "closedAt": 1792435607870,
    "reason": "Mall lease not renewed",
    "storeMembershipsRemoved": 0,
    "memberScopesRemoved": 0,
    "terminalsRemoved": 0,
    "apiKeysRevoked": 0
  },
  "meta": {
    "correlationId": "BPWrCEwr_OOfu7yYdf9bi",
    "timestamp": 1792435607900
  }
}
```

### GET /api/v1/orgs/{orgSlug}/members

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_listMembers` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, role. Default: createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: role |

**Response 200 OK** (`application/json`) — One page of the organization member roster; pagination is in `meta`

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
| `data[].organizationId` | string (uuid) | yes |  |
| `data[].role` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
| `data[].status` | "ACTIVE" \| "SUSPENDED" \| "PENDING" | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/members
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "019b76da-a800-7887-9947-75f244c2edf0",
      "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "userId": "01a1557a-c131-76ea-aaaf-cce3d7c7afd2",
      "email": "user-02@example.com",
      "fullName": "Olivia Johnson",
      "role": "CASHIER",
      "status": "ACTIVE",
      "displayName": null,
      "locationScopeType": "SELECTED",
      "locationIds": [
        "019b76da-a800-701a-abbd-a9a411b6958b"
      ],
      "createdAt": 1788753600000,
      "updatedAt": 1792435554407
    },
    {
      "id": "019b76da-a800-7b1d-b660-30bdb341a50c",
      "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "userId": "019b76da-a800-763a-b64a-fd037629f93f",
      "email": "brew.owner@kl-rewards.demo",
      "fullName": "Ahmad Brew",
      "role": "OWNER",
      "status": "ACTIVE",
      "displayName": "Ahmad (Owner)",
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": [],
      "createdAt": 1792435514638,
      "updatedAt": 1792435514638
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
    "correlationId": "FDyu-iigkVeZ54ICW02Gk",
    "timestamp": 1792435605478
  }
}
```

### POST /api/v1/orgs/{orgSlug}/members/{membershipId}/stores/{locationId}/remove

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_removeMemberFromStore` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string | yes |  |
| `membershipId` | path | string (uuid) | yes |  |
| `locationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `allowNoStores` | boolean | no | default `false` |

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

**Example** — called as jonker.owner@melaka-rewards.demo (merchant portal). Jonker Street Kitchen removes its cashier from the Bukit Beruang store (the cashier's only store, hence allowNoStores).

```http
POST /api/v1/orgs/jonker-street-kitchen/members/019b76da-a800-7b0f-b2e9-e7ccd28b72af/stores/019b76da-a800-7685-9734-84f5f07eb21f/remove
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "allowNoStores": true
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "membershipId": "019b76da-a800-7b0f-b2e9-e7ccd28b72af",
    "locationId": "019b76da-a800-7685-9734-84f5f07eb21f",
    "removedAt": 1792435608440,
    "remainingLocationIds": []
  },
  "meta": {
    "correlationId": "idttFKYU5ku4Sa1A-kxvv",
    "timestamp": 1792435608460
  }
}
```

### POST /api/v1/orgs/{orgSlug}/members/invite

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_inviteMember` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes | at most 100 characters |
| `locationIds` | string (uuid)[] | no | default `[]` |
| `locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | no | default `"ALL_LOCATIONS"` |
| `role` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |

**Response 201 Created** (`application/json`) — Organization team invitation sent

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
POST /api/v1/orgs/brew-bean-kl/members/invite
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
    "inviteId": "01a1557c-d9ed-7aea-96be-ff164caac32f",
    "message": "Invitation sent"
  },
  "meta": {
    "correlationId": "qfJUQ-5y75E7AyGX9i7DZ",
    "timestamp": 1792435608062
  }
}
```

### GET /api/v1/orgs/{orgSlug}/members/invites

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_listMemberInvites` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, expiresAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** (`application/json`) — One page of the pending organization team invitations; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].email` | string (email) | yes |  |
| `data[].expiresAt` | integer | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].intendedRole` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
| `data[].invitedByName` | string | yes |  |
| `data[].invitedByUserId` | string (uuid) | yes |  |
| `data[].locationIds` | string (uuid)[] | yes |  |
| `data[].locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data[].organizationId` | string (uuid) | yes |  |
| `data[].status` | "PENDING" \| "ACCEPTED" \| "EXPIRED" \| "REVOKED" | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/members/invites
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
      "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "email": "alice.kl@kl-rewards.demo",
      "intendedRole": "CASHIER",
      "locationScopeType": "SELECTED",
      "locationIds": [
        "019b76da-a800-701a-abbd-a9a411b6958b"
      ],
      "status": "PENDING",
      "invitedByUserId": "019b76da-a800-763a-b64a-fd037629f93f",
      "invitedByName": "Ahmad Brew",
      "expiresAt": 1793040314664,
      "createdAt": 1792435514665
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
    "correlationId": "Oy9IQ5fh26ZHhJqsC6QYJ",
    "timestamp": 1792435605563
  }
}
```

### POST /api/v1/orgs/{orgSlug}/members/invites/{inviteId}/revoke

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_revokeMemberInvite` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string | yes |  |
| `inviteId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Organization team invitation revoked

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
POST /api/v1/orgs/brew-bean-kl/members/invites/01a1557c-d9ed-7aea-96be-ff164caac32f/revoke
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
    "correlationId": "jExYLXLyyjxpMHAn06TX-",
    "timestamp": 1792435608240
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/members/me

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationController_updateOwnMembership` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `displayName` | string \| null | yes | length 1–100 |

**Response 200 OK** (`application/json`) — The signed-in member's own membership after setting (or, with null, clearing) their display name in this organization

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.displayName` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.organizationId` | string (uuid) | yes |  |
| `data.role` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
| `data.status` | "ACTIVE" \| "SUSPENDED" \| "PENDING" | yes |  |
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
PATCH /api/v1/orgs/jonker-street-kitchen/members/me
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
    "organizationId": "019b76da-a800-72b9-80b8-91bd729eddbe",
    "userId": "019b76da-a800-727d-bf31-03f65b3b9058",
    "role": "OWNER",
    "status": "ACTIVE",
    "displayName": "Siti (Owner)",
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": [],
    "createdAt": 1792435514648,
    "updatedAt": 1792435608523
  },
  "meta": {
    "correlationId": "cZyhFfst2vudg3ng7fT1L",
    "timestamp": 1792435608528
  }
}
```

### POST /api/v1/orgs/invites/accept

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTeamInviteController_acceptTeamInvite` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization-team-invite.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | length 16–256 |

**Response 201 Created** (`application/json`) — Team invite accepted and membership created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |
| `data.organizationSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.kl@kl-rewards.demo (merchant portal).

```http
POST /api/v1/orgs/invites/accept
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
    "organizationSlug": "brew-bean-kl",
    "message": "Invitation accepted"
  },
  "meta": {
    "correlationId": "s12Hk5C3f2rUCjxlch5v5",
    "timestamp": 1792435609212
  }
}
```

### POST /api/v1/orgs/invites/register-and-accept

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTeamInviteController_registerAndAcceptTeamInvite` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization-team-invite.controller.ts)

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
| `data.⟨shape 1⟩ organizationSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 1⟩ refreshToken` | string | yes | Refresh token — present once to `POST /auth/refresh`; rotated on every use; length 1–4096 |
| `data.⟨shape 1⟩ requiresEnrollment` | true | yes |  |
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
| `data.⟨shape 2⟩ organizationSlug` | string | no | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.⟨shape 2⟩ requiresEnrollment` | true | yes |  |
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
POST /api/v1/orgs/invites/register-and-accept
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
      "createdAt": 1792435609674,
      "updatedAt": 1792435609674,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a1557c-e053-7041-9410-35c6af01b7ac",
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
          "id": "01a1557a-bbc2-7672-b075-9f725142745f",
          "name": "User",
          "description": "Customer app — own profile and own analytics (no admin panel)"
        }
      ]
    },
    "organizationSlug": "brew-bean-kl"
  },
  "meta": {
    "correlationId": "2d5p9UJQYJRLrafO9xEBM",
    "timestamp": 1792435609823
  }
}
```

### POST /api/v1/orgs/invites/validate

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTeamInviteController_validateTeamInvite` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization-team-invite.controller.ts)

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
| `data.intendedRole` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationLabels` | object[] | yes |  |
| `data.locationLabels[].id` | string (uuid) | yes |  |
| `data.locationLabels[].name` | string | yes |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.organizationDisplayName` | string | yes |  |
| `data.organizationSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
POST /api/v1/orgs/invites/validate
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
    "organizationDisplayName": "Brew & Bean KL",
    "organizationSlug": "brew-bean-kl",
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
    "expiresAt": 1793040314664,
    "hasExistingAccount": true
  },
  "meta": {
    "correlationId": "egBleevG1QlzNjIFCvuAx",
    "timestamp": 1792435608653
  }
}
```

## Organization memberships

### GET /api/v1/orgs/memberships

List the current user's organization memberships

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationMembershipsBootstrapController_listMemberships` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization-memberships.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, displayName. Default: createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — One page of the current user's organization memberships; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | no |  |
| `data[].displayName` | string | yes |  |
| `data[].kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |
| `data[].lifecycleState` | "PROVISIONING" \| "ACTIVE" \| "RESTRICTED" \| "SUSPENDED" \| "PENDING_DELETION" \| "DELETED" | yes |  |
| `data[].organizationId` | string (uuid) | yes |  |
| `data[].organizationSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data[].role` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
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
GET /api/v1/orgs/memberships
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "organizationSlug": "brew-bean-kl",
      "displayName": "Brew & Bean KL",
      "role": "OWNER",
      "kybStatus": "APPROVED",
      "lifecycleState": "ACTIVE",
      "createdAt": 1792435514638
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
    "correlationId": "1zchVpZ2USvmduzXQOc39",
    "timestamp": 1792435604969
  }
}
```

## Organization Onboarding

### POST /api/v1/orgs/onboarding/complete

Complete merchant onboarding — links OWNER membership and platform User role

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_completeOnboarding` · [source](../../../apps/api/src/contexts/organizations/presentation/http/merchant-onboarding.controller.ts)

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

**Response 201 Created** (`application/json`) — Organization linked to the account

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.businessName` | string | yes |  |
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data.role` | "OWNER" \| "CASHIER" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as nyonya.house@melaka-rewards.demo (merchant portal).

```http
POST /api/v1/orgs/onboarding/complete
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
    "organizationId": "01a1557c-c113-7083-94bf-ff330c46bb32",
    "organizationSlug": "nyonya-house-melaka",
    "businessName": "Nyonya House Melaka",
    "role": "OWNER"
  },
  "meta": {
    "correlationId": "Mv4zf_D8Ze_eK4aKEtB8p",
    "timestamp": 1792435602435
  }
}
```

### POST /api/v1/orgs/onboarding/documents/status

Scan status of this onboarding's KYB uploads (same document window as the upload endpoints)

- **Public** — no session required.
- Rate limit: 30 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_documentStatus` · [source](../../../apps/api/src/contexts/organizations/presentation/http/merchant-onboarding.controller.ts)

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
POST /api/v1/orgs/onboarding/documents/status
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "fileIds": [
    "01a1557c-c423-70c9-babb-8e4c0774309d",
    "01a1557c-c4bc-79a6-8c6c-8720e1a5f142"
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
        "id": "01a1557c-c423-70c9-babb-8e4c0774309d",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1792435602470
      },
      {
        "id": "01a1557c-c4bc-79a6-8c6c-8720e1a5f142",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1792435602623
      }
    ]
  },
  "meta": {
    "correlationId": "cMg7r9YWqWi-qq3It1DYX",
    "timestamp": 1792435604285
  }
}
```

### POST /api/v1/orgs/onboarding/documents/submit

Attach onboarding KYB documents and submit the merchant for admin review

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_submitDocuments` · [source](../../../apps/api/src/contexts/organizations/presentation/http/merchant-onboarding.controller.ts)

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
POST /api/v1/orgs/onboarding/documents/submit
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "documentFileIds": [
    "01a1557c-c423-70c9-babb-8e4c0774309d",
    "01a1557c-c4bc-79a6-8c6c-8720e1a5f142"
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
    "correlationId": "8W0cmxDGG5JNfi-7YwaAo",
    "timestamp": 1792435604363
  }
}
```

### POST /api/v1/orgs/onboarding/documents/upload-complete

Complete an invite-authorized KYB document upload

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_completeDocumentUpload` · [source](../../../apps/api/src/contexts/organizations/presentation/http/merchant-onboarding.controller.ts)

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
| `data.file.category` | "PRODUCT_IMAGE" \| "STORE_LOGO" \| "STORE_BANNER" \| "USER_AVATAR" \| "MERCHANT_KYB" \| "REWARD_IMAGE" \| "GITHUB_COMMENT_IMAGE" | yes |  |
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
POST /api/v1/orgs/onboarding/documents/upload-complete
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "fileId": "01a1557c-c423-70c9-babb-8e4c0774309d",
  "checksumSha256": "79dc184da4077faf9a1025d14d8cc30faceea511c4fee4ba4deb4de2d486a8a2"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "file": {
      "id": "01a1557c-c423-70c9-babb-8e4c0774309d",
      "category": "MERCHANT_KYB",
      "visibility": "PRIVATE",
      "originalName": "sample.png",
      "mimeType": "image/png",
      "sizeBytes": 2004,
      "status": "SCANNING",
      "scanStatus": "SCANNING",
      "publicUrl": null,
      "uploadedAt": 1792435602470
    }
  },
  "meta": {
    "correlationId": "nOVu4mXvESRe5PCeP9pVZ",
    "timestamp": 1792435602595
  }
}
```

### POST /api/v1/orgs/onboarding/documents/upload-complete-batch

Complete invite-authorized KYB document uploads in one request

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_completeDocumentUploads` · [source](../../../apps/api/src/contexts/organizations/presentation/http/merchant-onboarding.controller.ts)

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
POST /api/v1/orgs/onboarding/documents/upload-complete-batch
X-Client-Type: web
X-Mutation-Intent: same-origin
Content-Type: application/json

{
  "token": "<redacted: one-time secret>",
  "completions": [
    {
      "fileId": "01a1557c-c4bc-79a6-8c6c-8720e1a5f142",
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
      "01a1557c-c4bc-79a6-8c6c-8720e1a5f142"
    ]
  },
  "meta": {
    "correlationId": "r3FFyBj2hK3eltZPBM4qu",
    "timestamp": 1792435602712
  }
}
```

### POST /api/v1/orgs/onboarding/documents/upload-url

Create an invite-authorized KYB document upload ticket

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_createDocumentUploadUrl` · [source](../../../apps/api/src/contexts/organizations/presentation/http/merchant-onboarding.controller.ts)

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
POST /api/v1/orgs/onboarding/documents/upload-url
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
    "fileId": "01a1557c-c423-70c9-babb-8e4c0774309d",
    "objectPath": "staging/kyb/01a1557c-c113-7083-94bf-ff330c46bb32/01a1557c-c423-70c9-babb-8e4c0774309d-sample.png",
    "expiresIn": 300,
    "method": "POST_MULTIPART",
    "uploadUrl": "http://10.155.3.236:8097/api/v1/files/01a1557c-c423-70c9-babb-8e4c0774309d/local-upload",
    "fields": {
      "key": "staging/kyb/01a1557c-c113-7083-94bf-ff330c46bb32/01a1557c-c423-70c9-babb-8e4c0774309d-sample.png",
      "token": "<redacted: one-time secret>"
    }
  },
  "meta": {
    "correlationId": "Kqi6e6ZZ0VIt-DjxsJxHY",
    "timestamp": 1792435602477
  }
}
```

### POST /api/v1/orgs/onboarding/documents/upload-urls

Create invite-authorized KYB document upload tickets in one request

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_createDocumentUploadUrls` · [source](../../../apps/api/src/contexts/organizations/presentation/http/merchant-onboarding.controller.ts)

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
POST /api/v1/orgs/onboarding/documents/upload-urls
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
        "fileId": "01a1557c-c4bc-79a6-8c6c-8720e1a5f142",
        "objectPath": "staging/kyb/01a1557c-c113-7083-94bf-ff330c46bb32/01a1557c-c4bc-79a6-8c6c-8720e1a5f142-sample.png",
        "expiresIn": 300,
        "method": "POST_MULTIPART",
        "uploadUrl": "http://10.155.3.236:8097/api/v1/files/01a1557c-c4bc-79a6-8c6c-8720e1a5f142/local-upload",
        "fields": {
          "key": "staging/kyb/01a1557c-c113-7083-94bf-ff330c46bb32/01a1557c-c4bc-79a6-8c6c-8720e1a5f142-sample.png",
          "token": "<redacted: one-time secret>"
        }
      }
    ]
  },
  "meta": {
    "correlationId": "lPkjLN_nG2VmlWd6MIoYg",
    "timestamp": 1792435602624
  }
}
```

### POST /api/v1/orgs/onboarding/validate

Validate a merchant onboarding invite token

- **Public** — no session required.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `MerchantOnboardingController_validateInvite` · [source](../../../apps/api/src/contexts/organizations/presentation/http/merchant-onboarding.controller.ts)

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
POST /api/v1/orgs/onboarding/validate
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
    "expiresAt": 1793040401683,
    "hasExistingAccount": false
  },
  "meta": {
    "correlationId": "6_P28p2mCZUJw6sBFmF3B",
    "timestamp": 1792435601958
  }
}
```

## Organization KYB

### GET /api/v1/orgs/{orgSlug}/kyb

Get the organization KYB profile (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationKybController_getProfile` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization-kyb.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Organization KYB profile

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
| `data.organizationId` | string (uuid) | yes |  |
| `data.status` | "ONBOARDING" \| "ACTIVE" \| "SUSPENDED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as nyonya.house@melaka-rewards.demo (merchant portal).

```http
GET /api/v1/orgs/nyonya-house-melaka/kyb
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "organizationId": "01a1557c-c113-7083-94bf-ff330c46bb32",
    "businessName": "Nyonya House Melaka",
    "legalName": "Nyonya House Melaka Sdn Bhd",
    "addressText": "88 Jalan Hang Jebat, 75200 Melaka",
    "contactPhone": "+60 6-282 1234",
    "contactEmail": "nyonya.house@melaka-rewards.demo",
    "city": "MELAKA",
    "kybStatus": "PENDING",
    "kybFields": {
      "taxId": "C2584563202",
      "submittedAt": 1792435602369,
      "documentType": "SSM",
      "registrationNo": "202601012345"
    },
    "documents": [
      {
        "id": "01a1557c-c423-70c9-babb-8e4c0774309d",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1792435602470
      },
      {
        "id": "01a1557c-c4bc-79a6-8c6c-8720e1a5f142",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1792435602623
      }
    ],
    "status": "ACTIVE"
  },
  "meta": {
    "correlationId": "HNCIdO-1IOxcpe2H_4tm0",
    "timestamp": 1792435607119
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/kyb

Submit or resubmit business verification details (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationKybController_submitKyb` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization-kyb.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

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

**Response 200 OK** (`application/json`) — Updated organization KYB profile

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
| `data.organizationId` | string (uuid) | yes |  |
| `data.status` | "ONBOARDING" \| "ACTIVE" \| "SUSPENDED" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as nyonya.house@melaka-rewards.demo (merchant portal).

```http
PATCH /api/v1/orgs/nyonya-house-melaka/kyb
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
    "01a1557c-c423-70c9-babb-8e4c0774309d",
    "01a1557c-c4bc-79a6-8c6c-8720e1a5f142"
  ]
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "organizationId": "01a1557c-c113-7083-94bf-ff330c46bb32",
    "businessName": "Nyonya House Melaka",
    "legalName": "Nyonya House Melaka Sdn Bhd",
    "addressText": "88 Jalan Hang Jebat, 75200 Melaka",
    "contactPhone": "+60 6-282 1234",
    "contactEmail": "nyonya.house@melaka-rewards.demo",
    "city": "MELAKA",
    "kybStatus": "PENDING",
    "kybFields": {
      "taxId": "C2584563202",
      "submittedAt": 1792435607216,
      "documentType": "SSM",
      "registrationNo": "202601012345"
    },
    "documents": [
      {
        "id": "01a1557c-c423-70c9-babb-8e4c0774309d",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1792435602470
      },
      {
        "id": "01a1557c-c4bc-79a6-8c6c-8720e1a5f142",
        "fileName": "sample.png",
        "mimeType": "image/png",
        "sizeBytes": 2004,
        "scanStatus": "SCANNING",
        "uploadedAt": 1792435602623
      }
    ],
    "status": "ACTIVE"
  },
  "meta": {
    "correlationId": "Mv_-w1FFWkbfwX8Uks-Ln",
    "timestamp": 1792435607238
  }
}
```

### GET /api/v1/orgs/{orgSlug}/kyb/documents/{documentId}/download

Get a short-lived signed download URL for a CLEAN KYB document (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationKybController_downloadDocument` · [source](../../../apps/api/src/contexts/organizations/presentation/http/organization-kyb.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/kyb/documents/019b76da-a800-7159-b799-9b0589c815e1/download
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
    "downloadUrl": "http://10.155.3.236:8097/api/v1/files/local-download?token=<redacted>",
    "expiresAt": 1792435905758
  },
  "meta": {
    "correlationId": "G4PqKpfAXzvK2R1zZGAMW",
    "timestamp": 1792435605758
  }
}
```

## Organization Rewards

### GET /api/v1/orgs/{orgSlug}/rewards

List organization rewards

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationRewardsController_listRewards` · [source](../../../apps/api/src/contexts/rewards/presentation/http/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, expiryDate, title. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — One page of the organization's rewards; pagination is in `meta`

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
| `data[].organizationId` | string (uuid) | yes |  |
| `data[].organizationLogoSources` | object[] | yes |  |
| `data[].organizationLogoSources[].url` | string (uri) | yes |  |
| `data[].organizationLogoSources[].width` | integer | yes |  |
| `data[].organizationLogoUrl` | string (uri) \| null | yes |  |
| `data[].organizationName` | string | no |  |
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
GET /api/v1/orgs/brew-bean-kl/rewards
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1792435551088,
      "updatedAt": 1792435551088,
      "isDeleted": false,
      "deletedAt": null,
      "id": "019b76da-a800-75d7-95fa-18e695a7ff33",
      "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "organizationName": "Brew & Bean KL",
      "organizationLogoUrl": null,
      "organizationLogoSources": [],
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
          "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/UHD/local-public",
          "width": 3840,
          "height": 2160,
          "sources": [
            {
              "width": 640,
              "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/THUMBNAIL/local-public"
            },
            {
              "width": 1280,
              "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/MEDIUM/local-public"
            }
          ]
        }
      ],
      "quantityTotal": 500,
      "quantityRemaining": 500,
      "quantityReserved": 0,
      "startDate": null,
      "expiryDate": 1795027514222,
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
      "createdAt": 1792435550899,
      "updatedAt": 1792435551075,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a1557b-fab2-7310-b3dc-36fe4e734701",
      "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "organizationName": "Brew & Bean KL",
      "organizationLogoUrl": null,
      "organizationLogoSources": [],
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
          "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7cce-a513-c34650bd2a0e/variants/UHD/local-public",
          "width": 3840,
          "height": 2160,
          "sources": [
            {
              "width": 640,
              "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7cce-a513-c34650bd2a0e/variants/THUMBNAIL/local-public"
            },
            {
              "width": 1280,
              "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7cce-a513-c34650bd2a0e/variants/MEDIUM/local-public"
            }
          ]
        }
      ],
      "quantityTotal": 25,
      "quantityRemaining": 20,
      "quantityReserved": 1,
      "startDate": null,
      "expiryDate": 1796323550898,
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
    "correlationId": "K5sKBt1dL5-JSPYvBTV0Y",
    "timestamp": 1792435610819
  }
}
```

### POST /api/v1/orgs/{orgSlug}/rewards

Create a draft reward

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationRewardsController_createReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

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
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationLogoSources` | object[] | yes |  |
| `data.organizationLogoSources[].url` | string (uri) | yes |  |
| `data.organizationLogoSources[].width` | integer | yes |  |
| `data.organizationLogoUrl` | string (uri) \| null | yes |  |
| `data.organizationName` | string | no |  |
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
POST /api/v1/orgs/brew-bean-kl/rewards
X-Client-Type: merchant
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "imageFileIds": [
    "01a1557c-e595-73bc-9e96-5c157329d77c"
  ],
  "title": "Free Kopi O with any breakfast set",
  "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
  "category": "cafe",
  "rewardType": "FREE_ITEM",
  "rewardValue": 6,
  "quantityTotal": 200,
  "startDate": 1792435612648,
  "expiryDate": 1797619612648,
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
    "createdAt": 1792435612778,
    "updatedAt": 1792435612807,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a1557c-ec6c-7c5c-983d-6cd525177f31",
    "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "organizationLogoSources": [],
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a1557c-e595-73bc-9e96-5c157329d77c",
        "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 200,
    "quantityRemaining": 200,
    "quantityReserved": 0,
    "startDate": 1792435612648,
    "expiryDate": 1797619612648,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a1557c-ec6d-755c-8669-5f451d8efaac",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "UhaKoDxzrorBhMBtptRY1",
    "timestamp": 1792435612845
  }
}
```

### GET /api/v1/orgs/{orgSlug}/rewards/{rewardId}

Read one organization reward (404 when not offered at any of the caller's stores)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationRewardsController_getReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationLogoSources` | object[] | yes |  |
| `data.organizationLogoSources[].url` | string (uri) | yes |  |
| `data.organizationLogoSources[].width` | integer | yes |  |
| `data.organizationLogoUrl` | string (uri) \| null | yes |  |
| `data.organizationName` | string | no |  |
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
GET /api/v1/orgs/brew-bean-kl/rewards/019b76da-a800-75d7-95fa-18e695a7ff33
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792435551088,
    "updatedAt": 1792435551088,
    "isDeleted": false,
    "deletedAt": null,
    "id": "019b76da-a800-75d7-95fa-18e695a7ff33",
    "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "organizationLogoSources": [],
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
        "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/UHD/local-public",
        "width": 3840,
        "height": 2160,
        "sources": [
          {
            "width": 640,
            "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://10.155.3.236:8097/api/v1/files/019b76da-a800-7d08-8be5-bc0104035de1/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 500,
    "quantityRemaining": 500,
    "quantityReserved": 0,
    "startDate": null,
    "expiryDate": 1795027514222,
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
    "correlationId": "4qtiQGI5uNFW08VBBEtus",
    "timestamp": 1792435610971
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/rewards/{rewardId}

Update a draft or pending reward

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationRewardsController_updateReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationLogoSources` | object[] | yes |  |
| `data.organizationLogoSources[].url` | string (uri) | yes |  |
| `data.organizationLogoSources[].width` | integer | yes |  |
| `data.organizationLogoUrl` | string (uri) \| null | yes |  |
| `data.organizationName` | string | no |  |
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
PATCH /api/v1/orgs/brew-bean-kl/rewards/01a1557c-ec6c-7c5c-983d-6cd525177f31
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
    "createdAt": 1792435612778,
    "updatedAt": 1792435612962,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a1557c-ec6c-7c5c-983d-6cd525177f31",
    "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "organizationLogoSources": [],
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a1557c-e595-73bc-9e96-5c157329d77c",
        "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 250,
    "quantityRemaining": 250,
    "quantityReserved": 0,
    "startDate": 1792435612648,
    "expiryDate": 1797619612648,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a1557c-ec6d-755c-8669-5f451d8efaac",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "Aayj-tMBx-fWwi9Qhv1MK",
    "timestamp": 1792435612999
  }
}
```

### POST /api/v1/orgs/{orgSlug}/rewards/{rewardId}/publish

Submit reward for moderation review (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationRewardsController_publishReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationLogoSources` | object[] | yes |  |
| `data.organizationLogoSources[].url` | string (uri) | yes |  |
| `data.organizationLogoSources[].width` | integer | yes |  |
| `data.organizationLogoUrl` | string (uri) \| null | yes |  |
| `data.organizationName` | string | no |  |
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
POST /api/v1/orgs/brew-bean-kl/rewards/01a1557c-ec6c-7c5c-983d-6cd525177f31/publish
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
    "createdAt": 1792435612778,
    "updatedAt": 1792435613083,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a1557c-ec6c-7c5c-983d-6cd525177f31",
    "organizationId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "organizationLogoSources": [],
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a1557c-e595-73bc-9e96-5c157329d77c",
        "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://10.155.3.236:8097/api/v1/files/01a1557c-e595-73bc-9e96-5c157329d77c/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 250,
    "quantityRemaining": 250,
    "quantityReserved": 0,
    "startDate": 1792435612648,
    "expiryDate": 1797619612648,
    "status": "PENDING_REVIEW",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a1557c-ec6d-755c-8669-5f451d8efaac",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "eHwgHRXnK3o5pgRUYudN6",
    "timestamp": 1792435613132
  }
}
```

### GET /api/v1/orgs/{orgSlug}/rewards/summary

Organization reward figures: the count in each status and the units still claimable, over every reward in the store scope

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationRewardsController_summarizeRewards` · [source](../../../apps/api/src/contexts/rewards/presentation/http/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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

## Organization POS Terminals

### GET /api/v1/orgs/{orgSlug}/terminals

List the organization's POS terminals

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTerminalsController_list` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/terminals
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1792435551070,
      "updatedAt": 1792435555274,
      "isDeleted": false,
      "deletedAt": null,
      "id": "019b76da-a800-7cb8-a368-3b87952401bc",
      "terminalId": "KL-REGISTER-03",
      "name": "Counter tablet",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "ACTIVE",
      "pairingCodeExpiresAt": null,
      "pairedAt": 1792176374222,
      "lastSeenAt": 1788253380000
    },
    {
      "createdAt": 1792435550828,
      "updatedAt": 1792435550828,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a1557b-fa6b-768f-86e6-b2b9f08651fe",
      "terminalId": "KL-REGISTER-02",
      "name": "Drive-through",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "AWAITING_PAIRING",
      "pairingCodeExpiresAt": 1792436414222,
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
    "correlationId": "XWZQwaZlw1Nz7sxbuylrC",
    "timestamp": 1792435614578
  }
}
```

### POST /api/v1/orgs/{orgSlug}/terminals

Register a POS terminal at a store and get its one-time pairing code

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTerminalsController_create` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

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
POST /api/v1/orgs/brew-bean-kl/terminals
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
      "createdAt": 1792435615048,
      "updatedAt": 1792435615048,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a1557c-f549-71f1-a3a2-0317494fcc88",
      "terminalId": "KL-BANGSAR-01",
      "name": "Bangsar front counter",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "AWAITING_PAIRING",
      "pairingCodeExpiresAt": 1792436515049,
      "pairedAt": null,
      "lastSeenAt": null
    },
    "pairingCode": "63YNMGZE",
    "pairingCodeExpiresAt": 1792436515049
  },
  "meta": {
    "correlationId": "pg8UCJLdpxc-pQKblr0Lk",
    "timestamp": 1792435615061
  }
}
```

### GET /api/v1/orgs/{orgSlug}/terminals/{id}

Read one POS terminal (404 outside the caller's stores)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTerminalsController_get` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/terminals/01a1557c-f549-71f1-a3a2-0317494fcc88
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792435615048,
    "updatedAt": 1792435615048,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a1557c-f549-71f1-a3a2-0317494fcc88",
    "terminalId": "KL-BANGSAR-01",
    "name": "Bangsar front counter",
    "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
    "locationName": "Brew & Bean KL — Bukit Bintang",
    "status": "AWAITING_PAIRING",
    "pairingCodeExpiresAt": 1792436515049,
    "pairedAt": null,
    "lastSeenAt": null
  },
  "meta": {
    "correlationId": "hOF2JwRxBHdrS30NMNumz",
    "timestamp": 1792435615167
  }
}
```

### DELETE /api/v1/orgs/{orgSlug}/terminals/{id}

Remove a POS terminal and revoke its API key

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTerminalsController_remove` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
DELETE /api/v1/orgs/brew-bean-kl/terminals/01a1557c-f549-71f1-a3a2-0317494fcc88
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
    "correlationId": "KpeCbgaVd9WJe-kuDVfBI",
    "timestamp": 1792435616672
  }
}
```

### POST /api/v1/orgs/{orgSlug}/terminals/{id}/pairing-code

Issue a new pairing code (first pairing, expired code, or re-pair — the old key stops working once the new code is used)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTerminalsController_issuePairingCode` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
POST /api/v1/orgs/brew-bean-kl/terminals/01a1557c-f549-71f1-a3a2-0317494fcc88/pairing-code
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
      "createdAt": 1792435615048,
      "updatedAt": 1792435615264,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a1557c-f549-71f1-a3a2-0317494fcc88",
      "terminalId": "KL-BANGSAR-01",
      "name": "Bangsar front counter",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "AWAITING_PAIRING",
      "pairingCodeExpiresAt": 1792436515264,
      "pairedAt": null,
      "lastSeenAt": null
    },
    "pairingCode": "2K7XZBX8",
    "pairingCodeExpiresAt": 1792436515264
  },
  "meta": {
    "correlationId": "1ZkO7ZFSbWVBzN4o9ofw-",
    "timestamp": 1792435615275
  }
}
```

### GET /api/v1/orgs/{orgSlug}/terminals/settings

Read the organization's POS terminal policy

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTerminalsController_getSettings` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

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
GET /api/v1/orgs/brew-bean-kl/terminals/settings
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
    "correlationId": "QiUSae3k3b4_b9SsLVS8p",
    "timestamp": 1792435614802
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/terminals/settings

Turn 'only allow registered terminals' on or off

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTerminalsController_updateSettings` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

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
PATCH /api/v1/orgs/brew-bean-kl/terminals/settings
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
    "correlationId": "9GF1Uo5_k9ER2R-9vi3Ug",
    "timestamp": 1792435614934
  }
}
```

### GET /api/v1/orgs/{orgSlug}/terminals/summary

Count the organization's live POS terminals per status, within the caller's stores

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationTerminalsController_summary` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/terminals/summary
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
    "correlationId": "t64QkLQtUtrnIkGSUtcMK",
    "timestamp": 1792435614703
  }
}
```

## Organization API Keys

### GET /api/v1/orgs/{orgSlug}/api-keys

List organization API keys

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationApiKeysController_listKeys` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-api-keys.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/api-keys?limit=2
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1792435615315,
      "updatedAt": 1792435615315,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a1557c-f665-741b-9743-c4b5b1570359",
      "name": "Bangsar front counter",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "scope": "POS",
      "revokedAt": null
    },
    {
      "createdAt": 1792435551064,
      "updatedAt": 1792435551064,
      "isDeleted": false,
      "deletedAt": null,
      "id": "019b76da-a800-7bd5-a5dd-45b76d6c72dc",
      "name": "Old register",
      "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "scope": "POS",
      "revokedAt": 1790707514222
    }
  ],
  "meta": {
    "limit": 2,
    "total": 5,
    "page": 1,
    "totalPages": 3,
    "nextCursor": "eyJhdCI6MTc5MjQzNTU1MTA2NCwiaWQiOiIwMTliNzZkYS1hODAwLTdiZDUtYTVkZC00NWI3NmQ2YzcyZGMifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "MAOTNqkCf9sD1gMqnsAO1",
    "timestamp": 1792435616293
  }
}
```

### POST /api/v1/orgs/{orgSlug}/api-keys

Create a POS API key

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationApiKeysController_createKey` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-api-keys.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

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
POST /api/v1/orgs/brew-bean-kl/api-keys
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
    "id": "01a1557c-fab2-7c26-8c53-6c7f11a8c7d6",
    "apiKey": "<redacted: one-time secret>",
    "name": "Back-office sync",
    "scope": "INTEGRATION",
    "locationId": null
  },
  "meta": {
    "correlationId": "Z-9GQZSeff5H_yUT2oJNA",
    "timestamp": 1792435616451
  }
}
```

### POST /api/v1/orgs/{orgSlug}/api-keys/{keyId}/revoke

Revoke a POS API key (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationApiKeysController_revokeKey` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-api-keys.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
POST /api/v1/orgs/brew-bean-kl/api-keys/01a1557c-fab2-7c26-8c53-6c7f11a8c7d6/revoke
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
    "correlationId": "2iVKFugDYR1MJIp4PdQxQ",
    "timestamp": 1792435616563
  }
}
```

## Organization Redemptions

### GET /api/v1/orgs/{orgSlug}/redemptions

List organization redemptions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationRedemptionsController_listRedemptions` · [source](../../../apps/api/src/contexts/pos/presentation/http/organization-redemptions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/redemptions?limit=2
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "redemptionId": "01a1557c-f754-72cb-98f8-580ee7da3f2d",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1792435615507,
      "terminalId": "KL-REGISTER-01",
      "redemptionMethod": "MANUAL"
    },
    {
      "redemptionId": "019b76da-a800-704e-9593-80d298dad1b4",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1792435550926,
      "terminalId": "KL-REGISTER-01",
      "redemptionMethod": "SCAN"
    }
  ],
  "meta": {
    "limit": 2,
    "total": 920,
    "page": 1,
    "totalPages": 460,
    "nextCursor": "eyJhdCI6MTc5MjQzNTU1MDkyNiwiaWQiOiIwMTliNzZkYS1hODAwLTcwNGUtOTU5My04MGQyOThkYWQxYjQifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "fYaL47Cit4QifAISTx349",
    "timestamp": 1792435615758
  }
}
```

## Organization Analytics

### GET /api/v1/orgs/{orgSlug}/analytics

Organization reward performance analytics

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationAnalyticsController_getAnalytics` · [source](../../../apps/api/src/contexts/reporting/presentation/http/organization-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/analytics
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "period": {
      "from": 1788105600000,
      "to": 1792435615874,
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
      "value": 190,
      "changePercent": 2
    },
    "totalRedemptions": {
      "value": 164,
      "changePercent": 5
    },
    "conversionRate": {
      "value": 86.3,
      "changePercent": 3
    },
    "referralCount": {
      "value": 0,
      "changePercent": null
    },
    "claimsOverTime": [
      {
        "date": 1788105600000,
        "claims": 23,
        "redemptions": 22
      },
      {
        "date": 1788710400000,
        "claims": 28,
        "redemptions": 23
      }
    ],
    "topRewards": [
      {
        "rewardId": "019b76da-a800-7a5e-8873-45fa5124324b",
        "title": "Morning brew club — free refill",
        "claims": 96,
        "redemptions": 86
      },
      {
        "rewardId": "019b76da-a800-791e-b43c-eb37c9f12ab4",
        "title": "Istimewa latte seni hujung minggu",
        "claims": 83,
        "redemptions": 74
      }
    ],
    "sales": {
      "currency": "MYR",
      "totalSalesMinor": {
        "value": 478447,
        "changePercent": 4
      },
      "bills": {
        "value": 164,
        "changePercent": 5
      },
      "averageBillMinor": {
        "value": 2917,
        "changePercent": -1
      },
      "overTime": [
        {
          "date": 1788105600000,
          "salesMinor": 55869,
          "bills": 22
        },
        {
          "date": 1788710400000,
          "salesMinor": 63561,
          "bills": 23
        }
      ],
      "firstBillAt": 1760921940000
    }
  },
  "meta": {
    "correlationId": "1KQ5AU0v4rt_HDME5qmeq",
    "timestamp": 1792435615916
  }
}
```

### GET /api/v1/orgs/{orgSlug}/analytics/dashboard

Merchant analytics dashboard: custom range + interval, compared totals, series, store / reward / redemption-method breakdowns

Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); `interval` (day | week | month) defaults from the range length. Every number is computed in Postgres; buckets are cut in `range.timeZone`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `OrganizationAnalyticsController_getDashboard` · [source](../../../apps/api/src/contexts/reporting/presentation/http/organization-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/analytics/dashboard?interval=week
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "range": {
      "from": 1789843616018,
      "to": 1792435616018,
      "timeZone": "Asia/Kuala_Lumpur",
      "interval": "week",
      "previousFrom": 1787251616018,
      "previousTo": 1789843616018
    },
    "currency": "MYR",
    "firstBillAt": 1760921940000,
    "totals": {
      "salesMinor": {
        "value": 300009,
        "previous": 278480,
        "change": 21529,
        "changePercent": 7.7
      },
      "bills": {
        "value": 102,
        "previous": 96,
        "change": 6,
        "changePercent": 6.3
      },
      "averageBillMinor": {
        "value": 2941,
        "previous": 2901,
        "change": 40,
        "changePercent": 1.4
      },
      "claims": {
        "value": 120,
        "previous": 111,
        "change": 9,
        "changePercent": 8.1
      },
      "redemptions": {
        "value": 102,
        "previous": 96,
        "change": 6,
        "changePercent": 6.3
      },
      "conversionRate": {
        "value": 85,
        "previous": 86.5,
        "change": -1.5,
        "changePercent": -1.7
      },
      "customers": {
        "value": 30,
        "previous": 28,
        "change": 2,
        "changePercent": 7.1
      }
    },
    "series": [
      {
        "start": 1789843616018,
        "end": 1789920000000,
        "isPartial": true,
        "salesMinor": 16330,
        "bills": 4,
        "averageBillMinor": 4083,
        "claims": 6,
        "redemptions": 4
      },
      {
        "start": 1789920000000,
        "end": 1790524800000,
        "isPartial": false,
        "salesMinor": 66971,
        "bills": 21,
        "averageBillMinor": 3189,
        "claims": 27,
        "redemptions": 21
      }
    ],
    "byStore": [
      {
        "locationId": "019b76da-a800-701a-abbd-a9a411b6958b",
        "name": "Brew & Bean KL — Bukit Bintang",
        "city": "KUALA_LUMPUR",
        "salesMinor": 300009,
        "bills": 102,
        "averageBillMinor": 2941,
        "redemptions": 102
      },
      {
        "locationId": "01a1557c-d78b-7fd2-944c-6be971eedf85",
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
        "claims": 61,
        "redemptions": 54,
        "conversionRate": 88.5
      },
      {
        "rewardId": "019b76da-a800-7a5e-8873-45fa5124324b",
        "title": "Morning brew club — free refill",
        "claims": 48,
        "redemptions": 44,
        "conversionRate": 91.7
      }
    ],
    "byRedemptionMethod": [
      {
        "method": "SCAN",
        "redemptions": 71
      },
      {
        "method": "MANUAL",
        "redemptions": 31
      }
    ]
  },
  "meta": {
    "correlationId": "fmRXFo5gHmwBmdPOQyUwE",
    "timestamp": 1792435616047
  }
}
```

### GET /api/v1/orgs/{orgSlug}/analytics/export

Download the merchant analytics report (csv | xlsx | pdf) for a date range

The body is the file (Content-Disposition: attachment). Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); both bounds are required. Each export writes an audit row and is limited to 10 per caller per 10 minutes: 429 ANALYTICS_EXPORT_RATE_LIMITED with `Retry-After`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/pdf` · `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` · `text/csv; charset=utf-8` (errors are always `application/json`)
- Operation id `OrganizationAnalyticsController_exportReport` · [source](../../../apps/api/src/contexts/reporting/presentation/http/organization-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/analytics/export?from=1789843616057&to=1792435616057&format=xlsx
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet):

```text
<8680 bytes of application/vnd.openxmlformats-officedocument.spreadsheetml.sheet>
```
