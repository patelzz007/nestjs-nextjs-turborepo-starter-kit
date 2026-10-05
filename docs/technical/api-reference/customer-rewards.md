---
title: "API reference — Customer rewards and claims"
description: "The consumer app's API: browse rewards, accept the legal terms, claim with a one-time code, show the QR code, read notifications and spending analytics."
order: 6
author: "Generated from the OpenAPI export"
lastUpdated: 1791158400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Customer rewards and claims

The consumer app's API: browse rewards, accept the legal terms, claim with a one-time code, show the QR code, read notifications and spending analytics.

How these endpoints fit together: [Customer claims guide](../../user-guide/05-customer-claims.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Rewards

### GET /api/v1/rewards

Browse published consumer rewards

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `ConsumerRewardsController_listRewards` · [source](../../../apps/api/src/modules/rewards/controllers/consumer-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, expiryDate, title. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: category, city |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** — Paginated marketplace rewards

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
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /api/v1/rewards?limit=2
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1791193338159,
      "updatedAt": 1791193338159,
      "isDeleted": false,
      "deletedAt": null,
      "id": "f88793c9-c817-46be-a9cb-d86b77e861bb",
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
      "startDate": 1791193338104,
      "expiryDate": 1796377338104,
      "status": "PUBLISHED",
      "claimCount": 0,
      "redemptionCount": 0,
      "referralsEnabled": true,
      "referralPoolTotal": 50,
      "referralPoolRemaining": 50,
      "referrerRewardId": "be614d3b-97e7-4101-8178-6435a65ce629",
      "rules": {
        "minSpendMyr": 15,
        "maxUsePerUser": 1
      },
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": []
    },
    {
      "createdAt": 1791193151330,
      "updatedAt": 1791193151330,
      "isDeleted": false,
      "deletedAt": null,
      "id": "e830ae78-08b7-4b32-b524-2780a5c71bab",
      "organizationId": "b57401d5-536e-464f-9ae9-4756b6dd5f61",
      "organizationName": "Jonker Street Kitchen",
      "organizationLogoUrl": null,
      "title": "Friday night entertainment discount",
      "description": "RM15 off live music dinner. Bukit Beruang only.",
      "rewardType": "FREE_ITEM",
      "rewardValue": 1,
      "termsConditions": "While stocks last.",
      "rewardKind": "CONSUMER",
      "category": "entertainment",
      "placeholderImageKey": "category-entertainment",
      "quantityTotal": 35,
      "quantityRemaining": 28,
      "quantityReserved": 2,
      "startDate": null,
      "expiryDate": 1794217151329,
      "status": "PUBLISHED",
      "claimCount": 0,
      "redemptionCount": 0,
      "referralsEnabled": false,
      "referralPoolTotal": null,
      "referralPoolRemaining": null,
      "referrerRewardId": null,
      "rules": null,
      "locationScopeType": "SELECTED",
      "locationIds": [
        "257401d5-536e-464f-9ae9-4756b6dd5f65"
      ],
      "locationNames": [
        "Jonker Street Kitchen — Bukit Beruang"
      ]
    }
  ],
  "meta": {
    "limit": 2,
    "total": 17,
    "page": 1,
    "totalPages": 9,
    "nextCursor": "eyJhdCI6MTc5MTE5MzE1MTMzMCwiaWQiOiJlODMwYWU3OC0wOGI3LTRiMzItYjUyNC0yNzgwYTVjNzFiYWIifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "LkGjeJGCWnUp4S1fM8dnp",
    "timestamp": 1791193338481
  }
}
```

### GET /api/v1/rewards/{rewardId}

Get published reward detail

- **Public** — no session required.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `ConsumerRewardsController_getReward` · [source](../../../apps/api/src/modules/rewards/controllers/consumer-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `rewardId` | path | string (uuid) | yes |  |

**Response 200 OK** — Reward detail

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
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /api/v1/rewards/f88793c9-c817-46be-a9cb-d86b77e861bb
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193338159,
    "updatedAt": 1791193338159,
    "isDeleted": false,
    "deletedAt": null,
    "id": "f88793c9-c817-46be-a9cb-d86b77e861bb",
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
    "startDate": 1791193338104,
    "expiryDate": 1796377338104,
    "status": "PUBLISHED",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "be614d3b-97e7-4101-8178-6435a65ce629",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "K-l_Z_Nh2k--VVfk76RhN",
    "timestamp": 1791193338496
  }
}
```

## Claims

### GET /api/v1/claims

List my reward claims

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `ConsumerClaimsController_listClaims` · [source](../../../apps/api/src/modules/rewards/controllers/consumer-claims.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: claimedAt, createdAt. Default: -claimedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status |

**Response 200 OK** — Paginated claims

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].claimExpiresAt` | integer | yes |  |
| `data[].claimedAt` | integer | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].isReferrerCredit` | boolean | yes |  |
| `data[].redeemedAt` | integer \| null | yes |  |
| `data[].rewardId` | string (uuid) | yes |  |
| `data[].rewardTitle` | string | yes |  |
| `data[].status` | "PENDING" \| "REDEEMED" \| "EXPIRED" | yes |  |
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

**Example** — called as alice.johnson@example.com (web app).

```http
GET /api/v1/claims?limit=2
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1791193339350,
      "updatedAt": 1791193339350,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01110696-4751-4c2e-834b-915b53339fa0",
      "rewardId": "f88793c9-c817-46be-a9cb-d86b77e861bb",
      "rewardTitle": "Free Kopi O with any breakfast set",
      "status": "PENDING",
      "claimedAt": 1791193339345,
      "claimExpiresAt": 1791798139345,
      "redeemedAt": null,
      "isReferrerCredit": false
    },
    {
      "createdAt": 1791193151337,
      "updatedAt": 1791193151337,
      "isDeleted": false,
      "deletedAt": null,
      "id": "74199f6f-877f-4d87-8a02-78941a4ae1af",
      "rewardId": "c1214e16-bf0f-4410-8871-8d1a9970f75e",
      "rewardTitle": "Free coffee — Grand Opening",
      "status": "PENDING",
      "claimedAt": 1791106751336,
      "claimExpiresAt": 1791797951336,
      "redeemedAt": null,
      "isReferrerCredit": false
    }
  ],
  "meta": {
    "limit": 2,
    "total": 192,
    "page": 1,
    "totalPages": 96,
    "nextCursor": "eyJhdCI6MTc5MTEwNjc1MTMzNiwiaWQiOiI3NDE5OWY2Zi04NzdmLTRkODctOGEwMi03ODk0MWE0YWUxYWYifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "KMZGbkQvsNEP62GHdY0tW",
    "timestamp": 1791193339404
  }
}
```

### POST /api/v1/claims

Claim a reward after OTP verification

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `ConsumerClaimsController_createClaim` · [source](../../../apps/api/src/modules/rewards/controllers/consumer-claims.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `captchaToken` | string | no | at least 1 characters |
| `otp` | string | no | exactly 6 characters; pattern `^\d{6}$` |
| `phone` | string | yes | length 8–20 |
| `rewardId` | string (uuid) | yes |  |

**Response 201 Created** — Claim created with backup code

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.backupCode` | string | yes | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |
| `data.claim` | object | yes |  |
| `data.claim.claimExpiresAt` | integer | yes |  |
| `data.claim.claimedAt` | integer | yes |  |
| `data.claim.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.claim.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.claim.id` | string (uuid) | yes |  |
| `data.claim.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.claim.isReferrerCredit` | boolean | yes |  |
| `data.claim.redeemedAt` | integer \| null | yes |  |
| `data.claim.rewardId` | string (uuid) | yes |  |
| `data.claim.rewardTitle` | string | yes |  |
| `data.claim.status` | "PENDING" \| "REDEEMED" \| "EXPIRED" | yes |  |
| `data.claim.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.qrDeepLink` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
POST /api/v1/claims
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "rewardId": "f88793c9-c817-46be-a9cb-d86b77e861bb",
  "phone": "+60123456789",
  "otp": "110800"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "claim": {
      "createdAt": 1791193339350,
      "updatedAt": 1791193339350,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01110696-4751-4c2e-834b-915b53339fa0",
      "rewardId": "f88793c9-c817-46be-a9cb-d86b77e861bb",
      "rewardTitle": "Free Kopi O with any breakfast set",
      "status": "PENDING",
      "claimedAt": 1791193339345,
      "claimExpiresAt": 1791798139345,
      "redeemedAt": null,
      "isReferrerCredit": false
    },
    "qrDeepLink": "/rewards/claims/01110696-4751-4c2e-834b-915b53339fa0/qr",
    "backupCode": "PUDEZW79"
  },
  "meta": {
    "correlationId": "0vlZP81M9WmX03Kqu2fG4",
    "timestamp": 1791193339371
  }
}
```

### GET /api/v1/claims/{claimId}/qr

Refresh QR payload for an active claim

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `ConsumerClaimsController_getClaimQr` · [source](../../../apps/api/src/modules/rewards/controllers/consumer-claims.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `claimId` | path | string (uuid) | yes |  |

**Response 200 OK** — QR payload and backup code

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.backupCode` | string | yes | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |
| `data.claimExpiresAt` | integer | yes |  |
| `data.claimId` | string (uuid) | yes |  |
| `data.qrPayload` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
GET /api/v1/claims/01110696-4751-4c2e-834b-915b53339fa0/qr
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "claimId": "01110696-4751-4c2e-834b-915b53339fa0",
    "qrPayload": "lfrOK5Aq43GkTC89VDklOJFTOzVXhJlcpUMNcYLYkwg",
    "backupCode": "MMLMWHEY",
    "claimExpiresAt": 1791798139345
  },
  "meta": {
    "correlationId": "6C-xQmcpnq3bNtvqnCg4v",
    "timestamp": 1791193339432
  }
}
```

### GET /api/v1/claims/analytics

Reward activity analytics for the signed-in user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `ConsumerClaimsController_getAnalytics` · [source](../../../apps/api/src/modules/rewards/controllers/consumer-claims.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `from` | query | integer | no |  |
| `to` | query | integer | no |  |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** — Claims, redemptions, and referral metrics

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.byStatus` | object[] | yes |  |
| `data.byStatus[].count` | integer | yes |  |
| `data.byStatus[].status` | "PENDING" \| "REDEEMED" \| "EXPIRED" | yes |  |
| `data.claimsOverTime` | object[] | yes |  |
| `data.claimsOverTime[].claims` | integer | yes |  |
| `data.claimsOverTime[].date` | integer | yes |  |
| `data.claimsOverTime[].redemptions` | integer | yes |  |
| `data.conversionRate` | object | yes |  |
| `data.conversionRate.changePercent` | number \| null | yes |  |
| `data.conversionRate.value` | number | yes |  |
| `data.expiredClaims` | object | yes |  |
| `data.expiredClaims.changePercent` | number \| null | yes |  |
| `data.expiredClaims.value` | number | yes |  |
| `data.pendingClaims` | object | yes |  |
| `data.pendingClaims.changePercent` | number \| null | yes |  |
| `data.pendingClaims.value` | number | yes |  |
| `data.period` | object | yes |  |
| `data.period.from` | integer | yes |  |
| `data.period.timeZone` | string | yes | length 1–64 |
| `data.period.to` | integer | yes |  |
| `data.redeemedClaims` | object | yes |  |
| `data.redeemedClaims.changePercent` | number \| null | yes |  |
| `data.redeemedClaims.value` | number | yes |  |
| `data.referralsCredited` | object | yes |  |
| `data.referralsCredited.changePercent` | number \| null | yes |  |
| `data.referralsCredited.value` | number | yes |  |
| `data.referralsSent` | object | yes |  |
| `data.referralsSent.changePercent` | number \| null | yes |  |
| `data.referralsSent.value` | number | yes |  |
| `data.spending` | object | yes |  |
| `data.spending.byCategory` | object[] | yes |  |
| `data.spending.byCategory[].category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" \| null | yes |  |
| `data.spending.byCategory[].totalMinor` | integer | yes |  |
| `data.spending.byCategory[].visits` | integer | yes |  |
| `data.spending.byMerchant` | object[] | yes |  |
| `data.spending.byMerchant[].category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" \| null | yes |  |
| `data.spending.byMerchant[].merchantName` | string | yes |  |
| `data.spending.byMerchant[].organizationId` | string (uuid) | yes |  |
| `data.spending.byMerchant[].totalMinor` | integer | yes |  |
| `data.spending.byMerchant[].visits` | integer | yes |  |
| `data.spending.currency` | "MYR" | yes |  |
| `data.spending.totalSpentMinor` | object | yes |  |
| `data.spending.totalSpentMinor.changePercent` | number \| null | yes |  |
| `data.spending.totalSpentMinor.value` | number | yes |  |
| `data.spending.visits` | object | yes |  |
| `data.spending.visits.changePercent` | number \| null | yes |  |
| `data.spending.visits.value` | number | yes |  |
| `data.totalClaims` | object | yes |  |
| `data.totalClaims.changePercent` | number \| null | yes |  |
| `data.totalClaims.value` | number | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
GET /api/v1/claims/analytics
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "period": {
      "from": 1786924800000,
      "to": 1791193340481,
      "timeZone": "UTC"
    },
    "totalClaims": {
      "value": 20,
      "changePercent": 43
    },
    "pendingClaims": {
      "value": 2,
      "changePercent": 100
    },
    "redeemedClaims": {
      "value": 17,
      "changePercent": 31
    },
    "expiredClaims": {
      "value": 1,
      "changePercent": 0
    },
    "referralsSent": {
      "value": 1,
      "changePercent": 100
    },
    "referralsCredited": {
      "value": 0,
      "changePercent": null
    },
    "conversionRate": {
      "value": 85,
      "changePercent": -9
    },
    "claimsOverTime": [
      {
        "date": 1786924800000,
        "claims": 3,
        "redemptions": 3
      },
      {
        "date": 1787529600000,
        "claims": 3,
        "redemptions": 2
      }
    ],
    "byStatus": [
      {
        "status": "PENDING",
        "count": 2
      },
      {
        "status": "REDEEMED",
        "count": 17
      }
    ],
    "spending": {
      "currency": "MYR",
      "totalSpentMinor": {
        "value": 78798,
        "changePercent": -19
      },
      "visits": {
        "value": 17,
        "changePercent": 31
      },
      "byMerchant": [
        {
          "organizationId": "b57401d5-536e-464f-9ae9-4756b6dd5f61",
          "merchantName": "Jonker Street Kitchen",
          "category": "restaurant",
          "totalMinor": 57356,
          "visits": 8
        },
        {
          "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
          "merchantName": "Brew & Bean KL",
          "category": "cafe",
          "totalMinor": 21442,
          "visits": 9
        }
      ],
      "byCategory": [
        {
          "category": "restaurant",
          "totalMinor": 57356,
          "visits": 8
        },
        {
          "category": "cafe",
          "totalMinor": 21442,
          "visits": 9
        }
      ]
    }
  },
  "meta": {
    "correlationId": "n7Q9zq_gakhPRJEMvIfWk",
    "timestamp": 1791193340489
  }
}
```

### GET /api/v1/claims/analytics/dashboard

My analytics dashboard: custom range + interval, compared totals, series, spending by category / merchant over time

Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); `interval` (day | week | month) defaults from the range length. Every number is computed in Postgres; buckets are cut in `range.timeZone`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `ConsumerClaimsController_getAnalyticsDashboard` · [source](../../../apps/api/src/modules/rewards/controllers/consumer-claims.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `from` | query | integer | no | Range start, epoch ms, inclusive. Default: 30 days before `to`. |
| `to` | query | integer | no | Range end, epoch ms, EXCLUSIVE. Default: now. At most 366 days after `from`. |
| `interval` | query | "day" \| "week" \| "month" | no | Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length. |

**Response 200 OK** — Customer analytics dashboard

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.claimsByStatus` | object[] | yes |  |
| `data.claimsByStatus[].claims` | integer | yes |  |
| `data.claimsByStatus[].status` | "PENDING" \| "REDEEMED" \| "EXPIRED" | yes |  |
| `data.currency` | "MYR" | yes |  |
| `data.range` | object | yes |  |
| `data.range.from` | integer | yes |  |
| `data.range.interval` | "day" \| "week" \| "month" | yes | Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length. |
| `data.range.previousFrom` | integer | yes |  |
| `data.range.previousTo` | integer | yes |  |
| `data.range.timeZone` | string | yes | length 1–64 |
| `data.range.to` | integer | yes |  |
| `data.series` | object[] | yes |  |
| `data.series[].claims` | integer | yes |  |
| `data.series[].end` | integer | yes |  |
| `data.series[].isPartial` | boolean | yes |  |
| `data.series[].redemptions` | integer | yes |  |
| `data.series[].spentMinor` | integer | yes |  |
| `data.series[].start` | integer | yes |  |
| `data.series[].visits` | integer | yes |  |
| `data.spendingByCategory` | object[] | yes |  |
| `data.spendingByCategory[].category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" \| null | yes |  |
| `data.spendingByCategory[].series` | object[] | yes |  |
| `data.spendingByCategory[].series[].start` | integer | yes |  |
| `data.spendingByCategory[].series[].totalMinor` | integer | yes |  |
| `data.spendingByCategory[].totalMinor` | integer | yes |  |
| `data.spendingByCategory[].visits` | integer | yes |  |
| `data.spendingByMerchant` | object[] | yes |  |
| `data.spendingByMerchant[].category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" \| null | yes |  |
| `data.spendingByMerchant[].merchantName` | string | yes |  |
| `data.spendingByMerchant[].organizationId` | string (uuid) | yes |  |
| `data.spendingByMerchant[].series` | object[] | yes |  |
| `data.spendingByMerchant[].series[].start` | integer | yes |  |
| `data.spendingByMerchant[].series[].totalMinor` | integer | yes |  |
| `data.spendingByMerchant[].totalMinor` | integer | yes |  |
| `data.spendingByMerchant[].visits` | integer | yes |  |
| `data.totals` | object | yes |  |
| `data.totals.averageBillMinor` | object | yes |  |
| `data.totals.averageBillMinor.change` | number | yes |  |
| `data.totals.averageBillMinor.changePercent` | number \| null | yes |  |
| `data.totals.averageBillMinor.previous` | number | yes |  |
| `data.totals.averageBillMinor.value` | number | yes |  |
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
| `data.totals.merchants` | object | yes |  |
| `data.totals.merchants.change` | number | yes |  |
| `data.totals.merchants.changePercent` | number \| null | yes |  |
| `data.totals.merchants.previous` | number | yes |  |
| `data.totals.merchants.value` | number | yes |  |
| `data.totals.redemptions` | object | yes |  |
| `data.totals.redemptions.change` | number | yes |  |
| `data.totals.redemptions.changePercent` | number \| null | yes |  |
| `data.totals.redemptions.previous` | number | yes |  |
| `data.totals.redemptions.value` | number | yes |  |
| `data.totals.referralRewardsEarned` | object | yes |  |
| `data.totals.referralRewardsEarned.change` | number | yes |  |
| `data.totals.referralRewardsEarned.changePercent` | number \| null | yes |  |
| `data.totals.referralRewardsEarned.previous` | number | yes |  |
| `data.totals.referralRewardsEarned.value` | number | yes |  |
| `data.totals.referralsCredited` | object | yes |  |
| `data.totals.referralsCredited.change` | number | yes |  |
| `data.totals.referralsCredited.changePercent` | number \| null | yes |  |
| `data.totals.referralsCredited.previous` | number | yes |  |
| `data.totals.referralsCredited.value` | number | yes |  |
| `data.totals.referralsSent` | object | yes |  |
| `data.totals.referralsSent.change` | number | yes |  |
| `data.totals.referralsSent.changePercent` | number \| null | yes |  |
| `data.totals.referralsSent.previous` | number | yes |  |
| `data.totals.referralsSent.value` | number | yes |  |
| `data.totals.spentMinor` | object | yes |  |
| `data.totals.spentMinor.change` | number | yes |  |
| `data.totals.spentMinor.changePercent` | number \| null | yes |  |
| `data.totals.spentMinor.previous` | number | yes |  |
| `data.totals.spentMinor.value` | number | yes |  |
| `data.totals.visits` | object | yes |  |
| `data.totals.visits.change` | number | yes |  |
| `data.totals.visits.changePercent` | number \| null | yes |  |
| `data.totals.visits.previous` | number | yes |  |
| `data.totals.visits.value` | number | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Stated in the endpoint description. |
| 503 | `ANALYTICS_QUERY_TIMEOUT` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
GET /api/v1/claims/analytics/dashboard?interval=month
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "range": {
      "from": 1788601340509,
      "to": 1791193340509,
      "timeZone": "UTC",
      "interval": "month",
      "previousFrom": 1786009340509,
      "previousTo": 1788601340509
    },
    "currency": "MYR",
    "totals": {
      "spentMinor": {
        "value": 46707,
        "previous": 39569,
        "change": 7138,
        "changePercent": 18
      },
      "visits": {
        "value": 11,
        "previous": 7,
        "change": 4,
        "changePercent": 57.1
      },
      "averageBillMinor": {
        "value": 4246,
        "previous": 5653,
        "change": -1407,
        "changePercent": -24.9
      },
      "claims": {
        "value": 13,
        "previous": 8,
        "change": 5,
        "changePercent": 62.5
      },
      "redemptions": {
        "value": 11,
        "previous": 7,
        "change": 4,
        "changePercent": 57.1
      },
      "conversionRate": {
        "value": 84.6,
        "previous": 87.5,
        "change": -2.9,
        "changePercent": -3.3
      },
      "merchants": {
        "value": 2,
        "previous": 2,
        "change": 0,
        "changePercent": 0
      },
      "referralsSent": {
        "value": 1,
        "previous": 0,
        "change": 1,
        "changePercent": null
      },
      "referralsCredited": {
        "value": 0,
        "previous": 0,
        "change": 0,
        "changePercent": null
      },
      "referralRewardsEarned": {
        "value": 0,
        "previous": 0,
        "change": 0,
        "changePercent": null
      }
    },
    "series": [
      {
        "start": 1788601340509,
        "end": 1790812800000,
        "isPartial": true,
        "spentMinor": 41419,
        "visits": 9,
        "claims": 11,
        "redemptions": 9
      },
      {
        "start": 1790812800000,
        "end": 1791193340509,
        "isPartial": true,
        "spentMinor": 5288,
        "visits": 2,
        "claims": 2,
        "redemptions": 2
      }
    ],
    "spendingByCategory": [
      {
        "category": "restaurant",
        "totalMinor": 35635,
        "visits": 6,
        "series": [
          {
            "start": 1788601340509,
            "totalMinor": 35635
          },
          {
            "start": 1790812800000,
            "totalMinor": 0
          }
        ]
      },
      {
        "category": "cafe",
        "totalMinor": 11072,
        "visits": 5,
        "series": [
          {
            "start": 1788601340509,
            "totalMinor": 5784
          },
          {
            "start": 1790812800000,
            "totalMinor": 5288
          }
        ]
      }
    ],
    "spendingByMerchant": [
      {
        "organizationId": "b57401d5-536e-464f-9ae9-4756b6dd5f61",
        "merchantName": "Jonker Street Kitchen",
        "category": "restaurant",
        "totalMinor": 35635,
        "visits": 6,
        "series": [
          {
            "start": 1788601340509,
            "totalMinor": 35635
          },
          {
            "start": 1790812800000,
            "totalMinor": 0
          }
        ]
      },
      {
        "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
        "merchantName": "Brew & Bean KL",
        "category": "cafe",
        "totalMinor": 11072,
        "visits": 5,
        "series": [
          {
            "start": 1788601340509,
            "totalMinor": 5784
          },
          {
            "start": 1790812800000,
            "totalMinor": 5288
          }
        ]
      }
    ],
    "claimsByStatus": [
      {
        "status": "PENDING",
        "claims": 2
      },
      {
        "status": "REDEEMED",
        "claims": 10
      }
    ]
  },
  "meta": {
    "correlationId": "Q_1q5YUaJDKvgzYgfngIU",
    "timestamp": 1791193340518
  }
}
```

### POST /api/v1/claims/otp

Request claim OTP (emailed to your account — no SMS in dev)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `ConsumerClaimsController_requestOtp` · [source](../../../apps/api/src/modules/rewards/controllers/consumer-claims.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `phone` | string | yes | length 8–20 |
| `rewardId` | string (uuid) | yes |  |

**Response 201 Created** — OTP sent

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
POST /api/v1/claims/otp
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "rewardId": "f88793c9-c817-46be-a9cb-d86b77e861bb",
  "phone": "+60123456789"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "ok": true
  },
  "meta": {
    "correlationId": "WA9cWcHl6C61uwyz9l8Wa",
    "timestamp": 1791193339303
  }
}
```

## Legal

### POST /api/v1/legal/accept

Accept rewards terms and privacy policy

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RewardLegalController_acceptLegal` · [source](../../../apps/api/src/modules/rewards/controllers/reward-legal.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `privacyVersion` | string | yes | length 1–32 |
| `termsVersion` | string | yes | length 1–32 |

**Response 201 Created** — Legal acceptance recorded

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
POST /api/v1/legal/accept
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "termsVersion": "2026-01-01",
  "privacyVersion": "2026-01-01"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "ok": true
  },
  "meta": {
    "correlationId": "KvslkQVDQU7La6x_yZUm1",
    "timestamp": 1791193339265
  }
}
```

### GET /api/v1/legal/status

Get rewards legal acceptance and verified phone status

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `RewardLegalController_getStatus` · [source](../../../apps/api/src/modules/rewards/controllers/reward-legal.controller.ts)

**Response 200 OK** — Claim checkout status for the signed-in user

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.hasAcceptedLegal` | boolean | yes |  |
| `data.phone` | string \| null | yes |  |
| `data.phoneVerified` | boolean | yes |  |
| `data.privacyVersion` | string \| null | yes |  |
| `data.termsVersion` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
GET /api/v1/legal/status
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "hasAcceptedLegal": true,
    "termsVersion": "2026-01-01",
    "privacyVersion": "2026-01-01",
    "phone": null,
    "phoneVerified": false
  },
  "meta": {
    "correlationId": "FNAghOvIOjlBOGU5QovoW",
    "timestamp": 1791193339221
  }
}
```

## Reward Notifications

### GET /api/v1/reward-notifications

List in-app reward notifications

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Operation id `RewardNotificationsController_listNotifications` · [source](../../../apps/api/src/modules/rewards/controllers/reward-notifications.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: readAt |

**Response 200 OK** — Notifications with unread count

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.hasNext` | boolean | yes |  |
| `data.items` | object[] | yes |  |
| `data.items[].body` | string | yes |  |
| `data.items[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.items[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.items[].id` | string (uuid) | yes |  |
| `data.items[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.items[].metadata` | any JSON \| null | yes |  |
| `data.items[].readAt` | integer \| null | yes |  |
| `data.items[].title` | string | yes |  |
| `data.items[].type` | string | yes |  |
| `data.items[].updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.nextCursor` | string \| null | yes |  |
| `data.unreadCount` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
GET /api/v1/reward-notifications?limit=2
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "createdAt": 1791106751377,
        "updatedAt": 1791193151379,
        "isDeleted": false,
        "deletedAt": null,
        "id": "de9c47f5-3bf2-445b-b48e-e72971f53e2a",
        "type": "claim_confirmed",
        "title": "Claim confirmed",
        "body": "Your free coffee reward is ready. Show QR at Brew & Bean KL.",
        "readAt": null,
        "metadata": {
          "claimId": "74199f6f-877f-4d87-8a02-78941a4ae1af"
        }
      }
    ],
    "unreadCount": 1,
    "nextCursor": null,
    "hasNext": false
  },
  "meta": {
    "correlationId": "AalD--4X1IuvCzWW4atAx",
    "timestamp": 1791193340543
  }
}
```

### POST /api/v1/reward-notifications/read

Mark reward notifications as read

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RewardNotificationsController_markRead` · [source](../../../apps/api/src/modules/rewards/controllers/reward-notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `markAll` | boolean | no |  |
| `notificationIds` | string (uuid)[] | no |  |

**Response 201 Created** — Notifications marked read

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as alice.johnson@example.com (web app).

```http
POST /api/v1/reward-notifications/read
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "markAll": true
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "ok": true
  },
  "meta": {
    "correlationId": "uI2i9v-3uNDmXDOLXnrzY",
    "timestamp": 1791193340565
  }
}
```
