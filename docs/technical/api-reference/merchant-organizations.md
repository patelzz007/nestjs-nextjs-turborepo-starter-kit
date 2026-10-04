---
title: "API reference — Merchant organizations (portal API)"
description: "Everything the merchant portal calls under /orgs/{orgSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics."
order: 5
author: "Generated from the OpenAPI export"
lastUpdated: 1791072000000
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
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationAdminController_createInvite` · [source](../../../apps/api/src/modules/organization/controllers/organization-admin.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `category` | string | yes | length 1–100 |
| `city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `displayName` | string | yes | length 1–200 |
| `email` | string (email) | yes | at most 100 characters |
| `intendedRole` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | no | default `"OWNER"` |
| `slug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

**Response 201 Created** — Organization invite created

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
    "organizationId": "a27302d4-92a5-41b2-bdab-9b9548ed02a1",
    "inviteToken": "32a733eefcffe53f5b2d860e3d909d6d215751fbdc7631f6cdbc4adb8e2bdaaf"
  },
  "meta": {
    "correlationId": "7YGjdJGAS1TPI3OIIAhjv",
    "timestamp": 1791099729647
  }
}
```

### POST /api/v1/orgs/{orgSlug}/access-requests

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_requestAccess` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `message` | string | no | at most 500 characters |

**Response 201 Created** — Organization access request created

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
    "id": "57026a8e-0f7e-43fc-834f-fd1677086a65",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "userId": "77baf757-d737-4f41-8488-795f24d157eb",
    "status": "PENDING",
    "message": "I run the Bangsar morning shift",
    "createdAt": 1791099737504
  },
  "meta": {
    "correlationId": "8ARqKI5TBx9NetMXfc7T_",
    "timestamp": 1791099737513
  }
}
```

### POST /api/v1/orgs/{orgSlug}/access-requests/{requestId}/review

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_reviewAccessRequest` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

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

**Response 201 Created** — Organization access request reviewed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!NOTE]
> No captured sample: The capture run got 409 ORGANIZATION_ACCESS_REQUEST_ALREADY_REVIEWED instead of a success response; re-run the capture after fixing it.

### GET /api/v1/orgs/{orgSlug}/context

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationController_getContext` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** — Organization context for the signed-in member

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
| `data.organization.primaryLocationId` | string (uuid) \| null | yes |  |
| `data.organization.slug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
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
      "id": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "slug": "brew-bean-kl",
      "displayName": "Brew & Bean KL",
      "lifecycleState": "ACTIVE",
      "primaryLocationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
      "createdAt": 1791099673551,
      "updatedAt": 1791099673551
    },
    "membership": {
      "id": "e178a4d1-6915-4eb3-bf84-6fb14e1feb6e",
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "userId": "326494e1-b45d-4203-b881-05b60ae50b4a",
      "role": "OWNER",
      "status": "ACTIVE",
      "displayName": null,
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": [],
      "createdAt": 1791099673578,
      "updatedAt": 1791099673578
    },
    "locations": [
      {
        "id": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
        "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
        "name": "Brew & Bean KL — Bukit Bintang",
        "code": "primary",
        "addressText": "12 Jalan Bukit Bintang, Kuala Lumpur",
        "city": "KUALA_LUMPUR",
        "contactPhone": "+60321456789",
        "status": "ACTIVE",
        "rejectionReason": null,
        "isPrimary": true,
        "createdAt": 1791099673558,
        "updatedAt": 1791099673558
      }
    ],
    "merchantProfile": {
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
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
    "correlationId": "RTYOek45I_2bGyjxf3AVP",
    "timestamp": 1791099732714
  }
}
```

### POST /api/v1/orgs/{orgSlug}/locations

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_createLocation` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

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

**Response 201 Created** — Organization store location requested

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

> [!NOTE]
> No captured sample: The capture run got 500 INTERNAL_ERROR instead of a success response; re-run the capture after fixing it.

### PATCH /api/v1/orgs/{orgSlug}/locations/{locationId}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_updateLocation` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

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

**Response 200 OK** — Rejected organization store location resubmitted

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

> [!NOTE]
> No captured sample: The capture run got 500 INTERNAL_ERROR instead of a success response; re-run the capture after fixing it.

### POST /api/v1/orgs/{orgSlug}/locations/{locationId}/close

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_closeLocation` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `locationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 1–500 |

**Response 201 Created** — Store closed: soft-deleted with its memberships, terminals and keys revoked

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
POST /api/v1/orgs/brew-bean-kl/locations/23f73bc6-337d-496d-9259-4c72346c71c9/close
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
    "locationId": "23f73bc6-337d-496d-9259-4c72346c71c9",
    "storeId": "7d92e363-7448-4728-aa04-b55b1923a5cb",
    "closedAt": 1791099735037,
    "reason": "Mall lease not renewed",
    "storeMembershipsRemoved": 0,
    "memberScopesRemoved": 0,
    "terminalsRemoved": 0,
    "apiKeysRevoked": 0
  },
  "meta": {
    "correlationId": "ZBqqpdl06PxFKlh-v3CqX",
    "timestamp": 1791099735052
  }
}
```

### GET /api/v1/orgs/{orgSlug}/members

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationController_listMembers` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** — Organization member roster

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
      "id": "e178a4d1-6915-4eb3-bf84-6fb14e1feb6e",
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "userId": "326494e1-b45d-4203-b881-05b60ae50b4a",
      "email": "brew.owner@kl-rewards.demo",
      "fullName": "Ahmad Brew",
      "role": "OWNER",
      "status": "ACTIVE",
      "displayName": null,
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": [],
      "createdAt": 1791099673578,
      "updatedAt": 1791099673578
    },
    {
      "id": "e8875947-75f2-44c2-adf0-713c9e955ed5",
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "userId": "e8079268-f4dd-497f-9d3c-5aaa57429d49",
      "email": "user-02@example.com",
      "fullName": "Olivia Johnson",
      "role": "CASHIER",
      "status": "ACTIVE",
      "displayName": null,
      "locationScopeType": "SELECTED",
      "locationIds": [
        "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d"
      ],
      "createdAt": 1788753600000,
      "updatedAt": 1791099673784
    }
  ],
  "meta": {
    "correlationId": "mOPAFNhmRVvif0OA344C-",
    "timestamp": 1791099732757
  }
}
```

### POST /api/v1/orgs/{orgSlug}/members/{membershipId}/stores/{locationId}/remove

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_removeMemberFromStore` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

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

**Response 201 Created** — Team member removed from one store

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
POST /api/v1/orgs/jonker-street-kitchen/members/157401d5-536e-464f-9ae9-4756b6dd5f64/stores/257401d5-536e-464f-9ae9-4756b6dd5f65/remove
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
    "membershipId": "157401d5-536e-464f-9ae9-4756b6dd5f64",
    "locationId": "257401d5-536e-464f-9ae9-4756b6dd5f65",
    "removedAt": 1791099735251,
    "remainingLocationIds": []
  },
  "meta": {
    "correlationId": "Gui859p1nBJVx0z7knoUF",
    "timestamp": 1791099735253
  }
}
```

### POST /api/v1/orgs/{orgSlug}/members/invite

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_inviteMember` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

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

**Response 201 Created** — Organization team invitation sent

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
    "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "inviteId": "76f4cc8b-4094-48aa-958c-ba3a4bdeece8",
    "message": "Invitation sent"
  },
  "meta": {
    "correlationId": "pYOchXCZMNFNfrMehUdiC",
    "timestamp": 1791099735137
  }
}
```

### GET /api/v1/orgs/{orgSlug}/members/invites

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationController_listMemberInvites` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** — Pending organization team invitations

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
      "id": "3178a4d1-6915-4eb3-bf84-6fb14e1feb71",
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "email": "alice.kl@kl-rewards.demo",
      "intendedRole": "CASHIER",
      "locationScopeType": "SELECTED",
      "locationIds": [
        "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d"
      ],
      "status": "PENDING",
      "invitedByUserId": "326494e1-b45d-4203-b881-05b60ae50b4a",
      "invitedByName": "Ahmad Brew",
      "expiresAt": 1791704473591,
      "createdAt": 1791099673593
    }
  ],
  "meta": {
    "correlationId": "iJVSWH0KzzgInU5ber0Ao",
    "timestamp": 1791099732807
  }
}
```

### POST /api/v1/orgs/{orgSlug}/members/invites/{inviteId}/revoke

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_revokeMemberInvite` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string | yes |  |
| `inviteId` | path | string (uuid) | yes |  |

**Response 201 Created** — Organization team invitation revoked

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
POST /api/v1/orgs/brew-bean-kl/members/invites/76f4cc8b-4094-48aa-958c-ba3a4bdeece8/revoke
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
    "correlationId": "hqzQv2e061wzFgX-erEDM",
    "timestamp": 1791099735183
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/members/me

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationController_updateOwnMembership` · [source](../../../apps/api/src/modules/organization/controllers/organization.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `displayName` | string \| null | yes | length 1–100 |

**Response 200 OK** — The signed-in member's own membership after setting (or, with null, clearing) their display name in this organization

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

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/orgs/invites/accept

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationTeamInviteController_acceptTeamInvite` · [source](../../../apps/api/src/modules/organization/controllers/organization-team-invite.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | length 16–256 |

**Response 201 Created** — Team invite accepted and membership created

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
    "correlationId": "p_JYCVd5DDXKI3LlDT7U0",
    "timestamp": 1791099736030
  }
}
```

### POST /api/v1/orgs/invites/register-and-accept

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `OrganizationTeamInviteController_registerAndAcceptTeamInvite` · [source](../../../apps/api/src/modules/organization/controllers/organization-team-invite.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fullName` | string | yes | at least 2 characters |
| `password` | string | yes | at least 8 characters |
| `token` | string | yes | length 16–256 |

**Response 201 Created** — Create a staff account from a team invite and sign in

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
      "createdAt": 1791099736395,
      "updatedAt": 1791099736395,
      "isDeleted": false,
      "deletedAt": null,
      "id": "45aad3d1-7ec2-45ad-9bac-4d37e7df6c1b",
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
          "id": "1c3e77b3-65d8-4c21-9f3d-a821afaa9363",
          "name": "User",
          "description": "Customer app — own profile, links, tags, and API keys (no admin panel)"
        }
      ]
    },
    "organizationSlug": "brew-bean-kl"
  },
  "meta": {
    "correlationId": "bm8joC-UFN60e-bttusk0",
    "timestamp": 1791099736757
  }
}
```

### POST /api/v1/orgs/invites/validate

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `OrganizationTeamInviteController_validateTeamInvite` · [source](../../../apps/api/src/modules/organization/controllers/organization-team-invite.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | length 16–256 |

**Response 201 Created** — Team invite preview when the token is valid

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
      "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d"
    ],
    "locationLabels": [
      {
        "id": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
        "name": "Brew & Bean KL — Bukit Bintang"
      }
    ],
    "expiresAt": 1791704473591,
    "hasExistingAccount": true
  },
  "meta": {
    "correlationId": "tfD27_7sm6iIDvVvkDN0T",
    "timestamp": 1791099735280
  }
}
```

## Organization RewardHub

### GET /api/v1/orgs/{orgSlug}/memberships

List organization memberships for the current user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationRewardMembershipsController_listMemberships` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** — Organization reward hub memberships

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

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as brew.owner@kl-rewards.demo (merchant portal).

```http
GET /api/v1/orgs/brew-bean-kl/memberships
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "organizationSlug": "brew-bean-kl",
      "displayName": "Brew & Bean KL",
      "role": "OWNER",
      "kybStatus": "APPROVED",
      "lifecycleState": "ACTIVE",
      "createdAt": 1791099673578
    }
  ],
  "meta": {
    "correlationId": "5uZQIdm-Rezw-kh14L6W4",
    "timestamp": 1791099732672
  }
}
```

### GET /api/v1/orgs/memberships

List RewardHub organization memberships for the current user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `OrganizationMembershipsBootstrapController_listMemberships` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Response 200 OK** — Organization reward hub memberships

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

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
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
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "organizationSlug": "brew-bean-kl",
      "displayName": "Brew & Bean KL",
      "role": "OWNER",
      "kybStatus": "APPROVED",
      "lifecycleState": "ACTIVE",
      "createdAt": 1791099673578
    }
  ],
  "meta": {
    "correlationId": "JorgxZ_t96Ad3AoYg7mM_",
    "timestamp": 1791099732645
  }
}
```

## Organization Onboarding

### POST /api/v1/orgs/onboarding/complete

Complete merchant onboarding — links OWNER membership and platform User role

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `MerchantOnboardingController_completeOnboarding` · [source](../../../apps/api/src/modules/rewards/controllers/merchant-onboarding.controller.ts)

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

**Response 201 Created** — Organization linked to the account

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
    "organizationId": "8b632542-54cd-4211-b47a-cfb4f29e3b2a",
    "organizationSlug": "nyonya-house-melaka",
    "businessName": "Nyonya House Melaka",
    "role": "OWNER"
  },
  "meta": {
    "correlationId": "yU2f2zNPvsDviOmp-VtEb",
    "timestamp": 1791099730051
  }
}
```

### POST /api/v1/orgs/onboarding/documents/status

Scan status of this onboarding's KYB uploads (same document window as the upload endpoints)

- **Public** — no session required.
- Rate limit: `ONBOARDING_STATUS_THROTTLE_LIMIT` requests per `ONBOARDING_STATUS_THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `MerchantOnboardingController_documentStatus` · [source](../../../apps/api/src/modules/rewards/controllers/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fileIds` | string (uuid)[] | yes | 1–5 items |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** — This onboarding's requested KYB uploads with their scan status

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
    "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
    "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c"
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
        "id": "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
        "fileName": "welcome.png",
        "mimeType": "image/png",
        "sizeBytes": 61292,
        "scanStatus": "SCANNING",
        "uploadedAt": 1791099730080
      },
      {
        "id": "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c",
        "fileName": "welcome.png",
        "mimeType": "image/png",
        "sizeBytes": 61292,
        "scanStatus": "SCANNING",
        "uploadedAt": 1791099730172
      }
    ]
  },
  "meta": {
    "correlationId": "Q1WMFaJ3TEV5BXfovYBvZ",
    "timestamp": 1791099731783
  }
}
```

### POST /api/v1/orgs/onboarding/documents/submit

Attach onboarding KYB documents and submit the merchant for admin review

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `MerchantOnboardingController_submitDocuments` · [source](../../../apps/api/src/modules/rewards/controllers/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `documentFileIds` | string (uuid)[] | yes | 1–5 items |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** — Onboarding KYB documents submitted for review

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
    "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
    "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c"
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
    "correlationId": "EXK5p2RiQpgCSNzwV0hq1",
    "timestamp": 1791099731849
  }
}
```

### POST /api/v1/orgs/onboarding/documents/upload-complete

Complete an invite-authorized KYB document upload

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `MerchantOnboardingController_completeDocumentUpload` · [source](../../../apps/api/src/modules/rewards/controllers/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `checksumSha256` | string | yes | exactly 64 characters |
| `fileId` | string (uuid) | yes |  |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** — Onboarding KYB document upload finalized

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.file` | object | yes |  |
| `data.file.category` | "PRODUCT_IMAGE" \| "STORE_LOGO" \| "STORE_BANNER" \| "USER_AVATAR" \| "MERCHANT_KYB" | yes |  |
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
  "fileId": "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
  "checksumSha256": "0fe260bfe734b5b3a68f1ecc1e8e55460eb2afece003d430cdf3ba2fe01204bf"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "file": {
      "id": "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
      "category": "MERCHANT_KYB",
      "visibility": "PRIVATE",
      "originalName": "welcome.png",
      "mimeType": "image/png",
      "sizeBytes": 61292,
      "status": "SCANNING",
      "scanStatus": "SCANNING",
      "publicUrl": null,
      "uploadedAt": 1791099730080
    }
  },
  "meta": {
    "correlationId": "udxmrQwvZKm3M2_sEfiEG",
    "timestamp": 1791099730133
  }
}
```

### POST /api/v1/orgs/onboarding/documents/upload-complete-batch

Complete invite-authorized KYB document uploads in one request

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `MerchantOnboardingController_completeDocumentUploads` · [source](../../../apps/api/src/modules/rewards/controllers/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `completions` | object[] | yes | 1–5 items |
| `completions[].checksumSha256` | string | yes | exactly 64 characters |
| `completions[].fileId` | string (uuid) | yes |  |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** — Onboarding KYB document uploads finalized

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
      "fileId": "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c",
      "checksumSha256": "0fe260bfe734b5b3a68f1ecc1e8e55460eb2afece003d430cdf3ba2fe01204bf"
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
      "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c"
    ]
  },
  "meta": {
    "correlationId": "T0Qd4homZ-ts3SeP-YDwY",
    "timestamp": 1791099730223
  }
}
```

### POST /api/v1/orgs/onboarding/documents/upload-url

Create an invite-authorized KYB document upload ticket

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `MerchantOnboardingController_createDocumentUploadUrl` · [source](../../../apps/api/src/modules/rewards/controllers/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `checksumSha256` | string | yes | exactly 64 characters |
| `fileName` | string | yes | length 1–255 |
| `mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `sizeBytes` | integer | yes |  |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** — Signed upload ticket for onboarding KYB documents

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
  "fileName": "welcome.png",
  "mimeType": "image/png",
  "sizeBytes": 61292,
  "checksumSha256": "0fe260bfe734b5b3a68f1ecc1e8e55460eb2afece003d430cdf3ba2fe01204bf"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "fileId": "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
    "objectPath": "staging/kyb/8b632542-54cd-4211-b47a-cfb4f29e3b2a/4e6eb041-0969-4fd1-975a-ca5b42f1d691-welcome.png",
    "expiresIn": 300,
    "method": "POST_MULTIPART",
    "uploadUrl": "http://127.0.0.1:8097/api/v1/files/4e6eb041-0969-4fd1-975a-ca5b42f1d691/local-upload",
    "fields": {
      "key": "staging/kyb/8b632542-54cd-4211-b47a-cfb4f29e3b2a/4e6eb041-0969-4fd1-975a-ca5b42f1d691-welcome.png",
      "token": "<redacted: one-time secret>"
    }
  },
  "meta": {
    "correlationId": "zKB7EFMGpwk20oxsa0Kcw",
    "timestamp": 1791099730081
  }
}
```

### POST /api/v1/orgs/onboarding/documents/upload-urls

Create invite-authorized KYB document upload tickets in one request

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `MerchantOnboardingController_createDocumentUploadUrls` · [source](../../../apps/api/src/modules/rewards/controllers/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `files` | object[] | yes | 1–5 items |
| `files[].checksumSha256` | string | yes | exactly 64 characters |
| `files[].fileName` | string | yes | length 1–255 |
| `files[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `files[].sizeBytes` | integer | yes |  |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** — Signed upload tickets for onboarding KYB documents

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
      "fileName": "welcome.png",
      "mimeType": "image/png",
      "sizeBytes": 61292,
      "checksumSha256": "0fe260bfe734b5b3a68f1ecc1e8e55460eb2afece003d430cdf3ba2fe01204bf"
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
        "fileId": "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c",
        "objectPath": "staging/kyb/8b632542-54cd-4211-b47a-cfb4f29e3b2a/381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c-welcome.png",
        "expiresIn": 300,
        "method": "POST_MULTIPART",
        "uploadUrl": "http://127.0.0.1:8097/api/v1/files/381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c/local-upload",
        "fields": {
          "key": "staging/kyb/8b632542-54cd-4211-b47a-cfb4f29e3b2a/381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c-welcome.png",
          "token": "<redacted: one-time secret>"
        }
      }
    ]
  },
  "meta": {
    "correlationId": "dAsDC6g2fxGNf0y7tcVsH",
    "timestamp": 1791099730174
  }
}
```

### POST /api/v1/orgs/onboarding/validate

Validate a merchant onboarding invite token

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `MerchantOnboardingController_validateInvite` · [source](../../../apps/api/src/modules/rewards/controllers/merchant-onboarding.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes | at least 1 characters |

**Response 201 Created** — Invite preview when the token is valid

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
    "expiresAt": 1791704529565,
    "hasExistingAccount": false
  },
  "meta": {
    "correlationId": "2Uga5RUt54RsEzReuNutH",
    "timestamp": 1791099729675
  }
}
```

## Organization KYB

### GET /api/v1/orgs/{orgSlug}/kyb

Get the organization KYB profile (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationKybController_getProfile` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** — Organization KYB profile

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
    "organizationId": "8b632542-54cd-4211-b47a-cfb4f29e3b2a",
    "businessName": "Nyonya House Melaka",
    "legalName": "Nyonya House Melaka Sdn Bhd",
    "addressText": "88 Jalan Hang Jebat, 75200 Melaka",
    "contactPhone": "+60 6-282 1234",
    "contactEmail": "nyonya.house@melaka-rewards.demo",
    "city": "MELAKA",
    "kybStatus": "PENDING",
    "kybFields": {
      "taxId": "C2584563202",
      "submittedAt": 1791099730027,
      "documentType": "SSM",
      "registrationNo": "202601012345"
    },
    "documents": [
      {
        "id": "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
        "fileName": "welcome.png",
        "mimeType": "image/png",
        "sizeBytes": 61292,
        "scanStatus": "SCANNING",
        "uploadedAt": 1791099730080
      },
      {
        "id": "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c",
        "fileName": "welcome.png",
        "mimeType": "image/png",
        "sizeBytes": 61292,
        "scanStatus": "SCANNING",
        "uploadedAt": 1791099730172
      }
    ],
    "status": "ACTIVE"
  },
  "meta": {
    "correlationId": "S2cNPeUqWDSTr_6KOH0UZ",
    "timestamp": 1791099734614
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/kyb

Submit or resubmit business verification details (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationKybController_submitKyb` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

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

**Response 200 OK** — Updated organization KYB profile

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
    "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
    "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c"
  ]
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "organizationId": "8b632542-54cd-4211-b47a-cfb4f29e3b2a",
    "businessName": "Nyonya House Melaka",
    "legalName": "Nyonya House Melaka Sdn Bhd",
    "addressText": "88 Jalan Hang Jebat, 75200 Melaka",
    "contactPhone": "+60 6-282 1234",
    "contactEmail": "nyonya.house@melaka-rewards.demo",
    "city": "MELAKA",
    "kybStatus": "PENDING",
    "kybFields": {
      "taxId": "C2584563202",
      "submittedAt": 1791099734665,
      "documentType": "SSM",
      "registrationNo": "202601012345"
    },
    "documents": [
      {
        "id": "4e6eb041-0969-4fd1-975a-ca5b42f1d691",
        "fileName": "welcome.png",
        "mimeType": "image/png",
        "sizeBytes": 61292,
        "scanStatus": "SCANNING",
        "uploadedAt": 1791099730080
      },
      {
        "id": "381b73cd-ea6a-4b8e-82e2-553ed1a3fd9c",
        "fileName": "welcome.png",
        "mimeType": "image/png",
        "sizeBytes": 61292,
        "scanStatus": "SCANNING",
        "uploadedAt": 1791099730172
      }
    ],
    "status": "ACTIVE"
  },
  "meta": {
    "correlationId": "aTQ5bsj-mzXaeupYZFEq0",
    "timestamp": 1791099734684
  }
}
```

### GET /api/v1/orgs/{orgSlug}/kyb/documents/{documentId}/download

Get a short-lived signed download URL for a CLEAN KYB document (owner only)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationKybController_downloadDocument` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `documentId` | path | string (uuid) | yes |  |
| `disposition` | query | "inline" \| "attachment" | no |  |

**Response 200 OK** — Signed download URL or scan status

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
GET /api/v1/orgs/brew-bean-kl/kyb/documents/d1597799-9b05-49c8-95e1-864ddfa666a8/download
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "documentId": "d1597799-9b05-49c8-95e1-864ddfa666a8",
    "scanStatus": "SCANNING",
    "downloadUrl": "http://127.0.0.1:8097/api/v1/files/local-download?token=<redacted>",
    "expiresAt": 1791100032900
  },
  "meta": {
    "correlationId": "IIKc1M8MJl8owMqxhSd8M",
    "timestamp": 1791099732900
  }
}
```

## Organization Rewards

### GET /api/v1/orgs/{orgSlug}/rewards

List organization rewards

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Operation id `OrganizationRewardsController_listRewards` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** — Rewards for the organization

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
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].locationIds` | string (uuid)[] | yes |  |
| `data[].locationNames` | string[] | no |  |
| `data[].locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data[].organizationId` | string (uuid) | yes |  |
| `data[].organizationLogoUrl` | string (uri) \| null | yes |  |
| `data[].organizationName` | string | no |  |
| `data[].placeholderImageKey` | string | yes |  |
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
      "createdAt": 1791099673754,
      "updatedAt": 1791099673754,
      "isDeleted": false,
      "deletedAt": null,
      "id": "d5d755fa-18e6-45a7-bf33-d2461e75ba1a",
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "organizationName": "Brew & Bean KL",
      "organizationLogoUrl": null,
      "title": "Free cake for every visit",
      "description": "Unlimited free cake with any purchase.",
      "rewardType": "FREE_ITEM",
      "rewardValue": 1,
      "termsConditions": null,
      "rewardKind": "CONSUMER",
      "category": "cafe",
      "placeholderImageKey": "category-cafe",
      "quantityTotal": 500,
      "quantityRemaining": 500,
      "quantityReserved": 0,
      "startDate": null,
      "expiryDate": 1793691673173,
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
      "createdAt": 1791099673691,
      "updatedAt": 1791099673691,
      "isDeleted": false,
      "deletedAt": null,
      "id": "1ebf1501-cee5-4147-9746-7050a5a58455",
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "organizationName": "Brew & Bean KL",
      "organizationLogoUrl": null,
      "title": "Wellness: Free yoga class voucher",
      "description": "Partner studio next door.",
      "rewardType": "FREE_ITEM",
      "rewardValue": 1,
      "termsConditions": "Subject to store availability.",
      "rewardKind": "CONSUMER",
      "category": "wellness",
      "placeholderImageKey": "category-wellness",
      "quantityTotal": 25,
      "quantityRemaining": 20,
      "quantityReserved": 1,
      "startDate": null,
      "expiryDate": 1794987673690,
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
    "correlationId": "e30eSzbBpYGjmZ1CGh51h",
    "timestamp": 1791099737656
  }
}
```

### POST /api/v1/orgs/{orgSlug}/rewards

Create a draft reward

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationRewardsController_createReward` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

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

**Response 201 Created** — Created reward

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | string | yes |  |
| `data.claimCount` | integer | yes | min -9007199254740991 |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.expiryDate` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationNames` | string[] | no |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationLogoUrl` | string (uri) \| null | yes |  |
| `data.organizationName` | string | no |  |
| `data.placeholderImageKey` | string | yes |  |
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
  "title": "Free Kopi O with any breakfast set",
  "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
  "category": "cafe",
  "rewardType": "FREE_ITEM",
  "rewardValue": 6,
  "quantityTotal": 200,
  "startDate": 1791099737709,
  "expiryDate": 1796283737709,
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
    "createdAt": 1791099737763,
    "updatedAt": 1791099737763,
    "isDeleted": false,
    "deletedAt": null,
    "id": "7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "placeholderImageKey": "category-cafe",
    "quantityTotal": 200,
    "quantityRemaining": 200,
    "quantityReserved": 0,
    "startDate": 1791099737709,
    "expiryDate": 1796283737709,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "a1c61717-ce92-409d-ad5f-04e8c28906c5",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "cSQj_w42AmE1qhNI0fIH-",
    "timestamp": 1791099737780
  }
}
```

### GET /api/v1/orgs/{orgSlug}/rewards/{rewardId}

Read one organization reward (404 when not offered at any of the caller's stores)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Operation id `OrganizationRewardsController_getReward` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `rewardId` | path | string (uuid) | yes |  |

**Response 200 OK** — Reward

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | string | yes |  |
| `data.claimCount` | integer | yes | min -9007199254740991 |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.expiryDate` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationNames` | string[] | no |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationLogoUrl` | string (uri) \| null | yes |  |
| `data.organizationName` | string | no |  |
| `data.placeholderImageKey` | string | yes |  |
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
GET /api/v1/orgs/brew-bean-kl/rewards/d5d755fa-18e6-45a7-bf33-d2461e75ba1a
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791099673754,
    "updatedAt": 1791099673754,
    "isDeleted": false,
    "deletedAt": null,
    "id": "d5d755fa-18e6-45a7-bf33-d2461e75ba1a",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "title": "Free cake for every visit",
    "description": "Unlimited free cake with any purchase.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 1,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "placeholderImageKey": "category-cafe",
    "quantityTotal": 500,
    "quantityRemaining": 500,
    "quantityReserved": 0,
    "startDate": null,
    "expiryDate": 1793691673173,
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
    "correlationId": "gPIVk1EGhRS-FdZg7zweg",
    "timestamp": 1791099737708
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/rewards/{rewardId}

Update a draft or pending reward

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationRewardsController_updateReward` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

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

**Response 200 OK** — Updated reward

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | string | yes |  |
| `data.claimCount` | integer | yes | min -9007199254740991 |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.expiryDate` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationNames` | string[] | no |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationLogoUrl` | string (uri) \| null | yes |  |
| `data.organizationName` | string | no |  |
| `data.placeholderImageKey` | string | yes |  |
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
PATCH /api/v1/orgs/brew-bean-kl/rewards/7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9
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
    "createdAt": 1791099737763,
    "updatedAt": 1791099737763,
    "isDeleted": false,
    "deletedAt": null,
    "id": "7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "placeholderImageKey": "category-cafe",
    "quantityTotal": 250,
    "quantityRemaining": 250,
    "quantityReserved": 0,
    "startDate": 1791099737709,
    "expiryDate": 1796283737709,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "a1c61717-ce92-409d-ad5f-04e8c28906c5",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "SLrzWtFjlj-XHo7EOSIHR",
    "timestamp": 1791099737849
  }
}
```

### POST /api/v1/orgs/{orgSlug}/rewards/{rewardId}/publish

Submit reward for moderation review (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationRewardsController_publishReward` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `rewardId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 201 Created** — Reward pending review

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.category` | string | yes |  |
| `data.claimCount` | integer | yes | min -9007199254740991 |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string | yes |  |
| `data.expiryDate` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.locationIds` | string (uuid)[] | yes |  |
| `data.locationNames` | string[] | no |  |
| `data.locationScopeType` | "ALL_LOCATIONS" \| "SELECTED" | yes |  |
| `data.organizationId` | string (uuid) | yes |  |
| `data.organizationLogoUrl` | string (uri) \| null | yes |  |
| `data.organizationName` | string | no |  |
| `data.placeholderImageKey` | string | yes |  |
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
POST /api/v1/orgs/brew-bean-kl/rewards/7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9/publish
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
    "createdAt": 1791099737763,
    "updatedAt": 1791099737763,
    "isDeleted": false,
    "deletedAt": null,
    "id": "7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "title": "Free Kopi O with any breakfast set",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "placeholderImageKey": "category-cafe",
    "quantityTotal": 250,
    "quantityRemaining": 250,
    "quantityReserved": 0,
    "startDate": 1791099737709,
    "expiryDate": 1796283737709,
    "status": "PENDING_REVIEW",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "a1c61717-ce92-409d-ad5f-04e8c28906c5",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "oAMKeIxWzUHCH4rdDBxHr",
    "timestamp": 1791099737907
  }
}
```

## Organization POS Terminals

### GET /api/v1/orgs/{orgSlug}/terminals

List the organization's POS terminals

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationTerminalsController_list` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

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

**Response 200 OK** — Paginated POS terminals; pagination is in `meta`

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
      "createdAt": 1791099673749,
      "updatedAt": 1791099673749,
      "isDeleted": false,
      "deletedAt": null,
      "id": "1cb82368-3b87-4524-81bc-c78d2b61ed56",
      "terminalId": "KL-REGISTER-03",
      "name": "Counter tablet",
      "locationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "ACTIVE",
      "pairingCodeExpiresAt": null,
      "pairedAt": 1790840533173,
      "lastSeenAt": 1791099553173
    },
    {
      "createdAt": 1791099673653,
      "updatedAt": 1791099673653,
      "isDeleted": false,
      "deletedAt": null,
      "id": "97595cdb-674f-4c6e-84f4-281aad7e8b76",
      "terminalId": "KL-REGISTER-01",
      "name": "Front counter",
      "locationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "UNPAIRED",
      "pairingCodeExpiresAt": null,
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
    "correlationId": "kY9tr8b-oHeIJZ345U2Nj",
    "timestamp": 1791099739061
  }
}
```

### POST /api/v1/orgs/{orgSlug}/terminals

Register a POS terminal at a store and get its one-time pairing code

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationTerminalsController_create` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

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

**Response 201 Created** — Terminal registered; the pairing code is shown once

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
  "locationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
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
      "createdAt": 1791099739225,
      "updatedAt": 1791099739225,
      "isDeleted": false,
      "deletedAt": null,
      "id": "a68aadac-9151-4e05-8096-dc84d14a43c5",
      "terminalId": "KL-BANGSAR-01",
      "name": "Bangsar front counter",
      "locationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "AWAITING_PAIRING",
      "pairingCodeExpiresAt": 1791100639224,
      "pairedAt": null,
      "lastSeenAt": null
    },
    "pairingCode": "Y3PMW66T",
    "pairingCodeExpiresAt": 1791100639224
  },
  "meta": {
    "correlationId": "gLR9OA-PWjVr-fH4_yCiF",
    "timestamp": 1791099739230
  }
}
```

### GET /api/v1/orgs/{orgSlug}/terminals/{id}

Read one POS terminal (404 outside the caller's stores)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationTerminalsController_get` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** — POS terminal

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
GET /api/v1/orgs/brew-bean-kl/terminals/a68aadac-9151-4e05-8096-dc84d14a43c5
X-Client-Type: merchant
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791099739225,
    "updatedAt": 1791099739225,
    "isDeleted": false,
    "deletedAt": null,
    "id": "a68aadac-9151-4e05-8096-dc84d14a43c5",
    "terminalId": "KL-BANGSAR-01",
    "name": "Bangsar front counter",
    "locationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
    "locationName": "Brew & Bean KL — Bukit Bintang",
    "status": "AWAITING_PAIRING",
    "pairingCodeExpiresAt": 1791100639224,
    "pairedAt": null,
    "lastSeenAt": null
  },
  "meta": {
    "correlationId": "YIGZvLqOHxFtrvX8ZCdWZ",
    "timestamp": 1791099739268
  }
}
```

### DELETE /api/v1/orgs/{orgSlug}/terminals/{id}

Remove a POS terminal and revoke its API key

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationTerminalsController_remove` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** — Terminal removed

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
DELETE /api/v1/orgs/brew-bean-kl/terminals/a68aadac-9151-4e05-8096-dc84d14a43c5
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
    "correlationId": "8TGjC2IxS3iyGTUlasinQ",
    "timestamp": 1791099739801
  }
}
```

### POST /api/v1/orgs/{orgSlug}/terminals/{id}/pairing-code

Issue a new pairing code (first pairing, expired code, or re-pair — the old key stops working once the new code is used)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationTerminalsController_issuePairingCode` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 201 Created** — New pairing code (shown once)

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
POST /api/v1/orgs/brew-bean-kl/terminals/a68aadac-9151-4e05-8096-dc84d14a43c5/pairing-code
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
      "createdAt": 1791099739225,
      "updatedAt": 1791099739225,
      "isDeleted": false,
      "deletedAt": null,
      "id": "a68aadac-9151-4e05-8096-dc84d14a43c5",
      "terminalId": "KL-BANGSAR-01",
      "name": "Bangsar front counter",
      "locationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "status": "AWAITING_PAIRING",
      "pairingCodeExpiresAt": 1791100639302,
      "pairedAt": null,
      "lastSeenAt": null
    },
    "pairingCode": "G3NU9BKK",
    "pairingCodeExpiresAt": 1791100639302
  },
  "meta": {
    "correlationId": "8AA587C_PjGYHb7g7Nrtw",
    "timestamp": 1791099739308
  }
}
```

### GET /api/v1/orgs/{orgSlug}/terminals/settings

Read the organization's POS terminal policy

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationTerminalsController_getSettings` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Response 200 OK** — POS terminal settings

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
    "correlationId": "2BAATBIdBXZwR5YGPK-9b",
    "timestamp": 1791099739130
  }
}
```

### PATCH /api/v1/orgs/{orgSlug}/terminals/settings

Turn 'only allow registered terminals' on or off

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationTerminalsController_updateSettings` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `requireRegisteredTerminals` | boolean | yes |  |

**Response 200 OK** — POS terminal settings updated

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
    "correlationId": "hj88bTWR72ZHIkWFZkCBf",
    "timestamp": 1791099739168
  }
}
```

### GET /api/v1/orgs/{orgSlug}/terminals/summary

Count the organization's live POS terminals per status, within the caller's stores

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationTerminalsController_summary` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** — Terminal counts per status and stores covered

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
    "correlationId": "lytqGDxOPBAWtlsTV6E_l",
    "timestamp": 1791099739102
  }
}
```

## Organization API Keys

### GET /api/v1/orgs/{orgSlug}/api-keys

List organization API keys

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Operation id `OrganizationApiKeysController_listKeys` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

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

**Response 200 OK** — Paginated API key summaries; pagination is in `meta`

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
      "createdAt": 1791099739331,
      "updatedAt": 1791099739331,
      "isDeleted": false,
      "deletedAt": null,
      "id": "5da6e84c-f9cc-46a7-8c2c-f1d2936e7718",
      "name": "Bangsar front counter",
      "locationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "scope": "POS",
      "revokedAt": null
    },
    {
      "createdAt": 1791099673748,
      "updatedAt": 1791099673748,
      "isDeleted": false,
      "deletedAt": null,
      "id": "ebd565dd-45b7-4d6c-b2dc-131764ba3baf",
      "name": "Old register",
      "locationId": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
      "locationName": "Brew & Bean KL — Bukit Bintang",
      "scope": "POS",
      "revokedAt": 1789371673173
    }
  ],
  "meta": {
    "limit": 2,
    "total": 5,
    "page": 1,
    "totalPages": 3,
    "nextCursor": "eyJhdCI6MTc5MTA5OTY3Mzc0OCwiaWQiOiJlYmQ1NjVkZC00NWI3LTRkNmMtYjJkYy0xMzE3NjRiYTNiYWYifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "ZJk6kESK0Xi0ww6PIzn1R",
    "timestamp": 1791099739616
  }
}
```

### POST /api/v1/orgs/{orgSlug}/api-keys

Create a POS API key

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationApiKeysController_createKey` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

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

**Response 201 Created** — API key created (shown once)

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
    "id": "ccd5ee11-9fcf-4b39-8936-819b83674d4e",
    "apiKey": "<redacted: one-time secret>",
    "name": "Back-office sync",
    "scope": "INTEGRATION",
    "locationId": null
  },
  "meta": {
    "correlationId": "CnTIbsEOU1tvc2H8m1YGj",
    "timestamp": 1791099739679
  }
}
```

### POST /api/v1/orgs/{orgSlug}/api-keys/{keyId}/revoke

Revoke a POS API key (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `OrganizationApiKeysController_revokeKey` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `keyId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 201 Created** — API key revoked

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
POST /api/v1/orgs/brew-bean-kl/api-keys/ccd5ee11-9fcf-4b39-8936-819b83674d4e/revoke
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
    "correlationId": "kDcw7wo51CH1tJb02L0ww",
    "timestamp": 1791099739756
  }
}
```

## Organization Redemptions

### GET /api/v1/orgs/{orgSlug}/redemptions

List organization redemptions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Operation id `OrganizationRedemptionsController_listRedemptions` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

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

**Response 200 OK** — Paginated redemption history

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
      "redemptionId": "3c5f2558-9602-42d9-ad25-28839a80d14a",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1791099739415,
      "terminalId": "KL-REGISTER-01",
      "redemptionMethod": "MANUAL"
    },
    {
      "redemptionId": "004e9593-80d2-48da-91b4-a19fec069aef",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1791099673721,
      "terminalId": "KL-REGISTER-01",
      "redemptionMethod": "SCAN"
    }
  ],
  "meta": {
    "limit": 2,
    "total": 4,
    "page": 1,
    "totalPages": 2,
    "nextCursor": "eyJhdCI6MTc5MTA5OTY3MzcyMSwiaWQiOiIwMDRlOTU5My04MGQyLTQ4ZGEtOTFiNC1hMTlmZWMwNjlhZWYifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "A_CYJpoqbJpbMXIOmugbp",
    "timestamp": 1791099739504
  }
}
```

## Organization Analytics

### GET /api/v1/orgs/{orgSlug}/analytics

Organization reward performance analytics

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Organization member** — the caller's membership role and store scope are checked per call (merchant capabilities, see [authorization overview](../authorization/overview.md)).
- Also accepts an **INTEGRATION-scope merchant API key**.
- Operation id `OrganizationAnalyticsController_getAnalytics` · [source](../../../apps/api/src/modules/rewards/controllers/organization-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `orgSlug` | path | string \| string (uuid) | yes |  |
| `from` | query | integer | no |  |
| `to` | query | integer | no |  |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** — Summary metrics, trends, and top rewards

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
      "from": 1786291200000,
      "to": 1791099739546,
      "timeZone": "Asia/Kuala_Lumpur"
    },
    "totalRewards": {
      "value": 13,
      "changePercent": 100
    },
    "activeRewards": {
      "value": 8,
      "changePercent": 100
    },
    "totalClaims": {
      "value": 11,
      "changePercent": 100
    },
    "totalRedemptions": {
      "value": 4,
      "changePercent": 100
    },
    "conversionRate": {
      "value": 36.4,
      "changePercent": 100
    },
    "referralCount": {
      "value": 0,
      "changePercent": null
    },
    "claimsOverTime": [
      {
        "date": 1786291200000,
        "claims": 0,
        "redemptions": 0
      },
      {
        "date": 1786896000000,
        "claims": 0,
        "redemptions": 0
      }
    ],
    "topRewards": [
      {
        "rewardId": "c1214e16-bf0f-4410-8871-8d1a9970f75e",
        "title": "Free coffee — Grand Opening",
        "claims": 10,
        "redemptions": 4
      },
      {
        "rewardId": "7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9",
        "title": "Free Kopi O with any breakfast set",
        "claims": 1,
        "redemptions": 0
      }
    ],
    "sales": {
      "currency": "MYR",
      "totalSalesMinor": {
        "value": 7800,
        "changePercent": 100
      },
      "bills": {
        "value": 4,
        "changePercent": 100
      },
      "averageBillMinor": {
        "value": 1950,
        "changePercent": 100
      },
      "overTime": [
        {
          "date": 1786291200000,
          "salesMinor": 0,
          "bills": 0
        },
        {
          "date": 1786896000000,
          "salesMinor": 0,
          "bills": 0
        }
      ],
      "firstBillAt": 1790754073703
    }
  },
  "meta": {
    "correlationId": "jpqdJgnD_takoe9mR1TXX",
    "timestamp": 1791099739561
  }
}
```
