---
title: "API reference — Customer rewards and claims"
description: "The consumer app's API: browse rewards, accept the legal terms, claim with a one-time code, show the QR code, read notifications and spending analytics."
order: 6
author: "Generated from the OpenAPI export"
lastUpdated: 1791072000000
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
      "status": "PUBLISHED",
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
    {
      "createdAt": 1791099673694,
      "updatedAt": 1791099673694,
      "isDeleted": false,
      "deletedAt": null,
      "id": "6157d369-0a3f-4841-9944-80b69666af02",
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
      "expiryDate": 1794123673694,
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
    "total": 13,
    "page": 1,
    "totalPages": 7,
    "nextCursor": "eyJhdCI6MTc5MTA5OTY3MzY5NCwiaWQiOiI2MTU3ZDM2OS0wYTNmLTQ4NDEtOTk0NC04MGI2OTY2NmFmMDIifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "efwzxFpogS4wSriE0_OUu",
    "timestamp": 1791099738080
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
GET /api/v1/rewards/7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9
X-Client-Type: web
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
    "status": "PUBLISHED",
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
    "correlationId": "RxROOtZROXaI2lARJlFh6",
    "timestamp": 1791099738098
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
      "createdAt": 1791099738919,
      "updatedAt": 1791099738919,
      "isDeleted": false,
      "deletedAt": null,
      "id": "3f95c140-8fb1-4c61-a3f3-fa853d0081ab",
      "rewardId": "7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9",
      "rewardTitle": "Free Kopi O with any breakfast set",
      "status": "PENDING",
      "claimedAt": 1791099738915,
      "claimExpiresAt": 1791704538915,
      "redeemedAt": null,
      "isReferrerCredit": false
    },
    {
      "createdAt": 1791099673700,
      "updatedAt": 1791099673700,
      "isDeleted": false,
      "deletedAt": null,
      "id": "74199f6f-877f-4d87-8a02-78941a4ae1af",
      "rewardId": "c1214e16-bf0f-4410-8871-8d1a9970f75e",
      "rewardTitle": "Free coffee — Grand Opening",
      "status": "PENDING",
      "claimedAt": 1791013273699,
      "claimExpiresAt": 1791704473699,
      "redeemedAt": null,
      "isReferrerCredit": false
    }
  ],
  "meta": {
    "limit": 2,
    "total": 3,
    "page": 1,
    "totalPages": 2,
    "nextCursor": "eyJhdCI6MTc5MTAxMzI3MzY5OSwiaWQiOiI3NDE5OWY2Zi04NzdmLTRkODctOGEwMi03ODk0MWE0YWUxYWYifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "ce_8ei5u-PnHB64Z7H3g6",
    "timestamp": 1791099738964
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
  "rewardId": "7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9",
  "phone": "+60123456789",
  "otp": "465611"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "claim": {
      "createdAt": 1791099738919,
      "updatedAt": 1791099738919,
      "isDeleted": false,
      "deletedAt": null,
      "id": "3f95c140-8fb1-4c61-a3f3-fa853d0081ab",
      "rewardId": "7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9",
      "rewardTitle": "Free Kopi O with any breakfast set",
      "status": "PENDING",
      "claimedAt": 1791099738915,
      "claimExpiresAt": 1791704538915,
      "redeemedAt": null,
      "isReferrerCredit": false
    },
    "qrDeepLink": "/rewards/claims/3f95c140-8fb1-4c61-a3f3-fa853d0081ab/qr",
    "backupCode": "Y4EEP3E8"
  },
  "meta": {
    "correlationId": "BhU14HGUO7eDe_0_NPI_L",
    "timestamp": 1791099738932
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
GET /api/v1/claims/3f95c140-8fb1-4c61-a3f3-fa853d0081ab/qr
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "claimId": "3f95c140-8fb1-4c61-a3f3-fa853d0081ab",
    "qrPayload": "rDD-OcYvLLMQUff8cuAhFA5SgMl9dWmrfy7sfXZ3adE",
    "backupCode": "U9CTEZN9",
    "claimExpiresAt": 1791704538915
  },
  "meta": {
    "correlationId": "jc5GpISqVNzhUAykI20Xf",
    "timestamp": 1791099738997
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
      "from": 1786320000000,
      "to": 1791099739824,
      "timeZone": "UTC"
    },
    "totalClaims": {
      "value": 3,
      "changePercent": 100
    },
    "pendingClaims": {
      "value": 2,
      "changePercent": 100
    },
    "redeemedClaims": {
      "value": 1,
      "changePercent": 100
    },
    "expiredClaims": {
      "value": 0,
      "changePercent": null
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
      "value": 33.3,
      "changePercent": 100
    },
    "claimsOverTime": [
      {
        "date": 1786320000000,
        "claims": 0,
        "redemptions": 0
      },
      {
        "date": 1786924800000,
        "claims": 0,
        "redemptions": 0
      }
    ],
    "byStatus": [
      {
        "status": "PENDING",
        "count": 2
      },
      {
        "status": "REDEEMED",
        "count": 1
      }
    ],
    "spending": {
      "currency": "MYR",
      "totalSpentMinor": {
        "value": 2500,
        "changePercent": 100
      },
      "visits": {
        "value": 1,
        "changePercent": 100
      },
      "byMerchant": [
        {
          "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
          "merchantName": "Brew & Bean KL",
          "category": "cafe",
          "totalMinor": 2500,
          "visits": 1
        }
      ],
      "byCategory": [
        {
          "category": "cafe",
          "totalMinor": 2500,
          "visits": 1
        }
      ]
    }
  },
  "meta": {
    "correlationId": "umwGM_8Ad9vDi4QIb1A7o",
    "timestamp": 1791099739837
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
  "rewardId": "7e1cfc68-9fcb-4b12-b6c5-35e9c017dcd9",
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
    "correlationId": "e3jOJjIenNnMhLL5fH0bU",
    "timestamp": 1791099738876
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
    "correlationId": "BR62HUxYnFBspq_EgvK0u",
    "timestamp": 1791099738840
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
    "correlationId": "yPe0GcYypjJPJfUJsCEHh",
    "timestamp": 1791099738801
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
        "createdAt": 1791013273741,
        "updatedAt": 1791099673742,
        "isDeleted": false,
        "deletedAt": null,
        "id": "d795660f-90af-4307-a9ef-efefe8e96349",
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
    "correlationId": "7qGNM2ojcN9AdbcjteMN5",
    "timestamp": 1791099739861
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
    "correlationId": "_tGADyzB2z26gEZJ6b8Mi",
    "timestamp": 1791099739884
  }
}
```
