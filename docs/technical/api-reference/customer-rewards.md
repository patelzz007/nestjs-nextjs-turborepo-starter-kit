---
title: "API reference — Customer rewards and claims"
description: "The consumer app's API: browse rewards, accept the legal terms, claim with a one-time code, show the QR code, read notifications and spending analytics."
order: 6
author: "Generated from the OpenAPI export"
lastUpdated: 1792454400000
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
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerRewardsController_listRewards` · [source](../../../apps/api/src/contexts/rewards/presentation/http/consumer-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, expiryDate, title. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: category, city, tenantId |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — Paginated marketplace rewards

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
      "createdAt": 1792520454844,
      "updatedAt": 1792520455786,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a8b-82c6-7486-a020-2dc6156d2593",
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
          "fileId": "01a15a8b-7b4f-7637-b0d1-a42f040b6e31",
          "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-7b4f-7637-b0d1-a42f040b6e31/variants/LARGE/local-public",
          "width": 1920,
          "height": 1080,
          "sources": [
            {
              "width": 640,
              "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-7b4f-7637-b0d1-a42f040b6e31/variants/THUMBNAIL/local-public"
            },
            {
              "width": 1280,
              "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-7b4f-7637-b0d1-a42f040b6e31/variants/MEDIUM/local-public"
            }
          ]
        }
      ],
      "quantityTotal": 250,
      "quantityRemaining": 250,
      "quantityReserved": 0,
      "startDate": 1792520454635,
      "expiryDate": 1797704454635,
      "status": "PUBLISHED",
      "claimCount": 0,
      "redemptionCount": 0,
      "referralsEnabled": true,
      "referralPoolTotal": 50,
      "referralPoolRemaining": 50,
      "referrerRewardId": "01a15a8b-82c6-7d80-9792-bf78bab3e1d2",
      "rules": {
        "minSpendMyr": 15,
        "maxUsePerUser": 1
      },
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": []
    },
    {
      "createdAt": 1792520394718,
      "updatedAt": 1792520395154,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a8a-97dd-740a-8955-1d4ab2274453",
      "tenantId": "019b76da-a800-72b9-80b8-91bd729eddbe",
      "tenantName": "Jonker Street Kitchen",
      "tenantLogoUrl": null,
      "tenantLogoSources": [],
      "title": "15% off Friday live-music dinner",
      "description": "15% off your dinner bill on live-music Friday nights. Bukit Beruang only.",
      "rewardType": "DISCOUNT",
      "rewardValue": 15,
      "termsConditions": "While stocks last.",
      "rewardKind": "CONSUMER",
      "category": "entertainment",
      "images": [
        {
          "fileId": "019b76da-a800-70dc-9177-0760966cda25",
          "url": "http://192.168.100.23:8097/api/v1/files/019b76da-a800-70dc-9177-0760966cda25/variants/UHD/local-public",
          "width": 3840,
          "height": 2160,
          "sources": [
            {
              "width": 640,
              "url": "http://192.168.100.23:8097/api/v1/files/019b76da-a800-70dc-9177-0760966cda25/variants/THUMBNAIL/local-public"
            },
            {
              "width": 1280,
              "url": "http://192.168.100.23:8097/api/v1/files/019b76da-a800-70dc-9177-0760966cda25/variants/MEDIUM/local-public"
            }
          ]
        },
        {
          "fileId": "019b76da-a800-7633-a97f-40ecb63158b4",
          "url": "http://192.168.100.23:8097/api/v1/files/019b76da-a800-7633-a97f-40ecb63158b4/variants/UHD/local-public",
          "width": 3840,
          "height": 2160,
          "sources": [
            {
              "width": 640,
              "url": "http://192.168.100.23:8097/api/v1/files/019b76da-a800-7633-a97f-40ecb63158b4/variants/THUMBNAIL/local-public"
            },
            {
              "width": 1280,
              "url": "http://192.168.100.23:8097/api/v1/files/019b76da-a800-7633-a97f-40ecb63158b4/variants/MEDIUM/local-public"
            }
          ]
        }
      ],
      "quantityTotal": 35,
      "quantityRemaining": 28,
      "quantityReserved": 2,
      "startDate": null,
      "expiryDate": 1795544394714,
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
        "019b76da-a800-7685-9734-84f5f07eb21f"
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
    "nextCursor": "eyJhdCI6MTc5MjUyMDM5NDcxOCwiaWQiOiIwMWExNWE4YS05N2RkLTc0MGEtODk1NS0xZDRhYjIyNzQ0NTMifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "8LyKtWO-UMx6kkAat91r3",
    "timestamp": 1792520456467
  }
}
```

### GET /api/v1/rewards/{rewardId}

Get published reward detail

- **Public** — no session required.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerRewardsController_getReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/consumer-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `rewardId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Reward detail

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
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /api/v1/rewards/01a15a8b-82c6-7486-a020-2dc6156d2593
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520454844,
    "updatedAt": 1792520455786,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-82c6-7486-a020-2dc6156d2593",
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
        "fileId": "01a15a8b-7b4f-7637-b0d1-a42f040b6e31",
        "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-7b4f-7637-b0d1-a42f040b6e31/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-7b4f-7637-b0d1-a42f040b6e31/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-7b4f-7637-b0d1-a42f040b6e31/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 250,
    "quantityRemaining": 250,
    "quantityReserved": 0,
    "startDate": 1792520454635,
    "expiryDate": 1797704454635,
    "status": "PUBLISHED",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a15a8b-82c6-7d80-9792-bf78bab3e1d2",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "2BtPRC_hrkXaNM_Y8Hf8V",
    "timestamp": 1792520456602
  }
}
```

## Claims

### GET /api/v1/claims

List my reward claims

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerClaimsController_listClaims` · [source](../../../apps/api/src/contexts/claims/presentation/http/consumer-claims.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: claimedAt, createdAt. Default: -claimedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status |

**Response 200 OK** (`application/json`) — Paginated claims

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
      "createdAt": 1792520457455,
      "updatedAt": 1792520457455,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a8b-8d71-7b6b-9beb-dc66e8bd7d13",
      "rewardId": "01a15a8b-82c6-7486-a020-2dc6156d2593",
      "rewardTitle": "Free Kopi O with any breakfast set",
      "status": "PENDING",
      "claimedAt": 1792520457455,
      "claimExpiresAt": 1793125257455,
      "redeemedAt": null,
      "isReferrerCredit": false
    },
    {
      "createdAt": 1792520394741,
      "updatedAt": 1792520394741,
      "isDeleted": false,
      "deletedAt": null,
      "id": "019b76da-a800-7c1a-9069-f2e16d4af0a3",
      "rewardId": "019b76da-a800-7abc-a318-2ac9fe8ee4ca",
      "rewardTitle": "Free coffee — Grand Opening",
      "status": "PENDING",
      "claimedAt": 1792433994737,
      "claimExpiresAt": 1793125194737,
      "redeemedAt": null,
      "isReferrerCredit": false
    }
  ],
  "meta": {
    "limit": 2,
    "total": 203,
    "page": 1,
    "totalPages": 102,
    "nextCursor": "eyJhdCI6MTc5MjQzMzk5NDczNywiaWQiOiIwMTliNzZkYS1hODAwLTdjMWEtOTA2OS1mMmUxNmQ0YWYwYTMifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "EPRTfPXHgkGJmOWIqX4Nk",
    "timestamp": 1792520457749
  }
}
```

### POST /api/v1/claims

Claim a reward after OTP verification

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerClaimsController_createClaim` · [source](../../../apps/api/src/contexts/claims/presentation/http/consumer-claims.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `captchaToken` | string | no | at least 1 characters |
| `otp` | string | no | exactly 6 characters; pattern `^\d{6}$` |
| `phone` | string | yes | length 8–20 |
| `rewardId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Claim created with backup code

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
  "rewardId": "01a15a8b-82c6-7486-a020-2dc6156d2593",
  "phone": "+60123456789",
  "otp": "274251"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "claim": {
      "createdAt": 1792520457455,
      "updatedAt": 1792520457455,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a8b-8d71-7b6b-9beb-dc66e8bd7d13",
      "rewardId": "01a15a8b-82c6-7486-a020-2dc6156d2593",
      "rewardTitle": "Free Kopi O with any breakfast set",
      "status": "PENDING",
      "claimedAt": 1792520457455,
      "claimExpiresAt": 1793125257455,
      "redeemedAt": null,
      "isReferrerCredit": false
    },
    "qrDeepLink": "/rewards/claims/01a15a8b-8d71-7b6b-9beb-dc66e8bd7d13/qr",
    "backupCode": "2E9XGYTF"
  },
  "meta": {
    "correlationId": "PWmZ1R6gLxzYRak7ue4VL",
    "timestamp": 1792520457627
  }
}
```

### GET /api/v1/claims/{claimId}

One of my claims (never carries the codes)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerClaimsController_getClaim` · [source](../../../apps/api/src/contexts/claims/presentation/http/consumer-claims.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `claimId` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The claim

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.claimExpiresAt` | integer | yes |  |
| `data.claimedAt` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isReferrerCredit` | boolean | yes |  |
| `data.redeemedAt` | integer \| null | yes |  |
| `data.rewardId` | string (uuid) | yes |  |
| `data.rewardTitle` | string | yes |  |
| `data.status` | "PENDING" \| "REDEEMED" \| "EXPIRED" | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### POST /api/v1/claims/{claimId}/qr

Issue fresh QR and backup codes for an active claim (the previous codes stop working)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerClaimsController_issueQrCodes` · [source](../../../apps/api/src/contexts/claims/presentation/http/consumer-claims.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `claimId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — QR payload and backup code

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
POST /api/v1/claims/01a15a8b-8d71-7b6b-9beb-dc66e8bd7d13/qr
X-Client-Type: web
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "claimId": "01a15a8b-8d71-7b6b-9beb-dc66e8bd7d13",
    "qrPayload": "KcSFR59OJEj1d09TSC_Ow8WENIvR6kkWB0VHULD828U",
    "backupCode": "GZTKXWZ6",
    "claimExpiresAt": 1793125257455
  },
  "meta": {
    "correlationId": "ZCyrPyd7mLS3jzJiba4tb",
    "timestamp": 1792520457846
  }
}
```

### GET /api/v1/claims/analytics

Reward activity analytics for the signed-in user

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerAnalyticsController_getAnalytics` · [source](../../../apps/api/src/contexts/reporting/presentation/http/consumer-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `from` | query | integer | no |  |
| `to` | query | integer | no |  |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Claims, redemptions, and referral metrics

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
| `data.spending.byMerchant[].tenantId` | string (uuid) | yes |  |
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
      "from": 1788134400000,
      "to": 1792520464964,
      "timeZone": "UTC"
    },
    "totalClaims": {
      "value": 20,
      "changePercent": 11
    },
    "pendingClaims": {
      "value": 2,
      "changePercent": 100
    },
    "redeemedClaims": {
      "value": 17,
      "changePercent": 6
    },
    "expiredClaims": {
      "value": 1,
      "changePercent": -50
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
      "changePercent": -4
    },
    "claimsOverTime": [
      {
        "date": 1788134400000,
        "claims": 3,
        "redemptions": 3
      },
      {
        "date": 1788739200000,
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
        "value": 99046,
        "changePercent": -6
      },
      "visits": {
        "value": 17,
        "changePercent": 6
      },
      "byMerchant": [
        {
          "tenantId": "019b76da-a800-72b9-80b8-91bd729eddbe",
          "merchantName": "Jonker Street Kitchen",
          "category": "restaurant",
          "totalMinor": 80392,
          "visits": 9
        },
        {
          "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
          "merchantName": "Brew & Bean KL",
          "category": "cafe",
          "totalMinor": 18654,
          "visits": 8
        }
      ],
      "byCategory": [
        {
          "category": "restaurant",
          "totalMinor": 80392,
          "visits": 9
        },
        {
          "category": "cafe",
          "totalMinor": 18654,
          "visits": 8
        }
      ]
    }
  },
  "meta": {
    "correlationId": "gwPvg7hfemjMHa5dxCPk7",
    "timestamp": 1792520464984
  }
}
```

### GET /api/v1/claims/analytics/dashboard

My analytics dashboard: custom range + interval, compared totals, series, spending by category / merchant over time

Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); `interval` (day | week | month) defaults from the range length. Every number is computed in Postgres; buckets are cut in `range.timeZone`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerAnalyticsController_getAnalyticsDashboard` · [source](../../../apps/api/src/contexts/reporting/presentation/http/consumer-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `from` | query | integer | no | Range start, epoch ms, inclusive. Default: 30 days before `to`. |
| `to` | query | integer | no | Range end, epoch ms, EXCLUSIVE. Default: now. At most 366 days after `from`. |
| `interval` | query | "day" \| "week" \| "month" | no | Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length. |

**Response 200 OK** (`application/json`) — Customer analytics dashboard

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
| `data.spendingByMerchant[].series` | object[] | yes |  |
| `data.spendingByMerchant[].series[].start` | integer | yes |  |
| `data.spendingByMerchant[].series[].totalMinor` | integer | yes |  |
| `data.spendingByMerchant[].tenantId` | string (uuid) | yes |  |
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
      "from": 1789928465028,
      "to": 1792520465028,
      "timeZone": "UTC",
      "interval": "month",
      "previousFrom": 1787336465028,
      "previousTo": 1789928465028
    },
    "currency": "MYR",
    "totals": {
      "spentMinor": {
        "value": 59135,
        "previous": 47389,
        "change": 11746,
        "changePercent": 24.8
      },
      "visits": {
        "value": 10,
        "previous": 8,
        "change": 2,
        "changePercent": 25
      },
      "averageBillMinor": {
        "value": 5914,
        "previous": 5924,
        "change": -10,
        "changePercent": -0.2
      },
      "claims": {
        "value": 11,
        "previous": 9,
        "change": 2,
        "changePercent": 22.2
      },
      "redemptions": {
        "value": 10,
        "previous": 8,
        "change": 2,
        "changePercent": 25
      },
      "conversionRate": {
        "value": 90.9,
        "previous": 88.9,
        "change": 2,
        "changePercent": 2.2
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
        "start": 1789928465028,
        "end": 1790812800000,
        "isPartial": true,
        "spentMinor": 11237,
        "visits": 4,
        "claims": 3,
        "redemptions": 4
      },
      {
        "start": 1790812800000,
        "end": 1792520465028,
        "isPartial": true,
        "spentMinor": 47898,
        "visits": 6,
        "claims": 8,
        "redemptions": 6
      }
    ],
    "spendingByCategory": [
      {
        "category": "restaurant",
        "totalMinor": 50851,
        "visits": 6,
        "series": [
          {
            "start": 1789928465028,
            "totalMinor": 5453
          },
          {
            "start": 1790812800000,
            "totalMinor": 45398
          }
        ]
      },
      {
        "category": "cafe",
        "totalMinor": 8284,
        "visits": 4,
        "series": [
          {
            "start": 1789928465028,
            "totalMinor": 5784
          },
          {
            "start": 1790812800000,
            "totalMinor": 2500
          }
        ]
      }
    ],
    "spendingByMerchant": [
      {
        "tenantId": "019b76da-a800-72b9-80b8-91bd729eddbe",
        "merchantName": "Jonker Street Kitchen",
        "category": "restaurant",
        "totalMinor": 50851,
        "visits": 6,
        "series": [
          {
            "start": 1789928465028,
            "totalMinor": 5453
          },
          {
            "start": 1790812800000,
            "totalMinor": 45398
          }
        ]
      },
      {
        "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
        "merchantName": "Brew & Bean KL",
        "category": "cafe",
        "totalMinor": 8284,
        "visits": 4,
        "series": [
          {
            "start": 1789928465028,
            "totalMinor": 5784
          },
          {
            "start": 1790812800000,
            "totalMinor": 2500
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
        "claims": 8
      }
    ]
  },
  "meta": {
    "correlationId": "hKdgBGLrd6TBJEgBOJBQJ",
    "timestamp": 1792520465054
  }
}
```

### POST /api/v1/claims/otp

Request claim OTP (emailed to your account — no SMS in dev)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ConsumerClaimsController_requestOtp` · [source](../../../apps/api/src/contexts/claims/presentation/http/consumer-claims.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `phone` | string | yes | length 8–20 |
| `rewardId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — OTP sent

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
  "rewardId": "01a15a8b-82c6-7486-a020-2dc6156d2593",
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
    "correlationId": "XQg52tUFNlfacypp8ZQxN",
    "timestamp": 1792520457366
  }
}
```

## Legal

### POST /api/v1/legal/accept

Accept rewards terms and privacy policy

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RewardLegalController_acceptLegal` · [source](../../../apps/api/src/contexts/rewards/presentation/http/reward-legal.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `privacyVersion` | string | yes | length 1–32 |
| `termsVersion` | string | yes | length 1–32 |

**Response 201 Created** (`application/json`) — Legal acceptance recorded

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
    "correlationId": "wwYUVbUK3E3Us1s3oA-Yi",
    "timestamp": 1792520457245
  }
}
```

### GET /api/v1/legal/status

Get rewards legal acceptance and verified phone status

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `RewardLegalController_getStatus` · [source](../../../apps/api/src/contexts/rewards/presentation/http/reward-legal.controller.ts)

**Response 200 OK** (`application/json`) — Claim checkout status for the signed-in user

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
    "correlationId": "I58kKZFfsr-l4h4ksQdma",
    "timestamp": 1792520457136
  }
}
```

## Reward Notifications

### GET /api/v1/reward-notifications

List in-app reward notifications

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `RewardNotificationsController_listNotifications` · [source](../../../apps/api/src/contexts/claims/presentation/http/reward-notifications.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: readAt |

**Response 200 OK** (`application/json`) — One page of notifications, newest first; pagination is in `meta` (`filter[readAt][isNull]=true` counts the unread)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].body` | string | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].metadata` | any JSON \| null | yes |  |
| `data[].readAt` | integer \| null | yes |  |
| `data[].title` | string | yes |  |
| `data[].type` | string | yes |  |
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
GET /api/v1/reward-notifications?limit=2
X-Client-Type: web
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1792433994917,
      "updatedAt": 1792520394920,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a8a-98a7-71cf-82b2-e627bd7f9677",
      "type": "claim_confirmed",
      "title": "Claim confirmed",
      "body": "Your free coffee reward is ready. Show QR at Brew & Bean KL.",
      "readAt": null,
      "metadata": {
        "claimId": "019b76da-a800-7c1a-9069-f2e16d4af0a3"
      }
    }
  ],
  "meta": {
    "limit": 2,
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "r1VMb4eF4zE5bkb9uAJhd",
    "timestamp": 1792520465108
  }
}
```

### POST /api/v1/reward-notifications/read

Mark reward notifications as read

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RewardNotificationsController_markRead` · [source](../../../apps/api/src/contexts/claims/presentation/http/reward-notifications.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `markAll` | boolean | no |  |
| `notificationIds` | string (uuid)[] | no |  |

**Response 201 Created** (`application/json`) — Notifications marked read

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
    "correlationId": "w6ksG5fDA6KSmV8kgM9QU",
    "timestamp": 1792520465159
  }
}
```
