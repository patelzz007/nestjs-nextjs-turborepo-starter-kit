---
title: "API reference — Point of sale and integrations (machine-to-machine)"
description: "Terminal pairing, validating a customer's QR / backup code and recording the paid bill, plus the integration API (`/integration/*`: rewards, analytics, redemption history). Authenticated with a merchant API key, which names its own tenant."
order: 7
author: "Generated from the OpenAPI export"
lastUpdated: 1792454400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Point of sale and integrations (machine-to-machine)

Terminal pairing, validating a customer's QR / backup code and recording the paid bill, plus the integration API (`/integration/*`: rewards, analytics, redemption history). Authenticated with a merchant API key, which names its own tenant.

How these endpoints fit together: [POS integration guide](../pos-integration.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## POS

### POST /api/v1/integration/terminals/pair

Pair a POS terminal with the one-time code from the merchant console

Returns the terminal's own API key (shown once). Send it as X-API-Key on every redemption call; X-Terminal-Id is then optional.

- **Public** — no session required.
- Rate limit: 5 requests per `THROTTLE_TTL_MS` ms per client IP (strict limiter).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PosTerminalsController_pair` · [source](../../../apps/api/src/contexts/pos/presentation/http/tenant-terminals.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `pairingCode` | string | yes | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |

**Response 201 Created** (`application/json`) — Terminal paired

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.apiKey` | string | yes |  |
| `data.location` | object | yes |  |
| `data.location.id` | string (uuid) | yes |  |
| `data.location.name` | string | yes |  |
| `data.tenant` | object | yes |  |
| `data.tenant.displayName` | string | yes |  |
| `data.tenant.id` | string (uuid) | yes |  |
| `data.tenant.slug` | string | yes |  |
| `data.terminalId` | string | yes | length 1–100; pattern `^[A-Za-z0-9][A-Za-z0-9._:-]*$` |
| `data.terminalName` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as a new till (pairing code only, no credential yet).

```http
POST /api/v1/integration/terminals/pair
Content-Type: application/json

{
  "pairingCode": "9MZPYEW2"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "apiKey": "<redacted: one-time secret>",
    "terminalId": "KL-BANGSAR-01",
    "terminalName": "Bangsar front counter",
    "tenant": {
      "id": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "slug": "brew-bean-kl",
      "displayName": "Brew & Bean KL"
    },
    "location": {
      "id": "019b76da-a800-701a-abbd-a9a411b6958b",
      "name": "Brew & Bean KL — Bukit Bintang"
    }
  },
  "meta": {
    "correlationId": "zJonxxJnPRDhICYoBfW2F",
    "timestamp": 1792520459541
  }
}
```

## Redemptions

### POST /api/v1/integration/redemptions/checkout

POS checkout: after payment, record the bill and redeem every presented reward (all-or-nothing, idempotent)

Send the bill total in minor units (sen) and up to 10 QR tokens / backup codes of ONE customer. Retrying with the same idempotencyKey and body replays the original result; a different body with a used key is rejected (409 IDEMPOTENCY_KEY_REUSED).

- **Merchant API key** — `X-API-Key: mk_live_…` (or `Authorization: Bearer mk_live_…`). No cookie, no session.
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RedemptionsController_checkout` · [source](../../../apps/api/src/contexts/pos/presentation/http/redemptions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `X-Terminal-Id` | header | string | no | Terminal id. Optional for a key issued by pairing (POST /integration/terminals/pair); required for a manually created key (e.g. KL-REGISTER-01). |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `billTotalMinor` | integer | yes | range 0–100000000 |
| `codes` | object[] | yes | 1–10 items |
| `codes[].backupCode` | string | no | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |
| `codes[].token` | string | no | length 16–512 |
| `currency` | "MYR" | yes |  |
| `idempotencyKey` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Bill recorded and rewards redeemed

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.billTotalMinor` | integer | yes |  |
| `data.currency` | "MYR" | yes |  |
| `data.idempotencyKey` | string (uuid) | yes |  |
| `data.paidAt` | integer | yes |  |
| `data.redemptions` | object[] | yes |  |
| `data.redemptions[].claimId` | string (uuid) | yes |  |
| `data.redemptions[].redemptionId` | string (uuid) | yes |  |
| `data.redemptions[].rewardId` | string (uuid) | yes |  |
| `data.redemptions[].rewardTitle` | string | yes |  |
| `data.saleId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Stated in the endpoint description. |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `MERCHANT_API_KEY_REQUIRED`, `MERCHANT_API_KEY_INVALID` | Missing, unknown or revoked API key. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as the seeded Brew & Bean KL register (POS API key).

```http
POST /api/v1/integration/redemptions/checkout
X-API-Key: mk_live_IwgbQID2Csq4nbnfwUxVUrQT8lwrlhEz7bzagwasKyFtZYSQ42LSH43lzTfRdBkV7tZArdHQQE4EW0wDHpVAroL57w/+5AzsCxRpax2fmu3JqITATsJKJRi4+fifNVj1E3WswonhsleEBinxwcMOlqccH0suhUq6mJWVvaWYkf8=
X-Terminal-Id: KL-REGISTER-01
Content-Type: application/json

{
  "idempotencyKey": "50562029-4404-4b8b-82ac-3475116fe688",
  "billTotalMinor": 2500,
  "currency": "MYR",
  "codes": [
    {
      "backupCode": "ABCD2345"
    }
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "saleId": "01a15a8b-964d-7244-96e6-c89cadaa0ad2",
    "billTotalMinor": 2500,
    "currency": "MYR",
    "paidAt": 1792520459811,
    "idempotencyKey": "50562029-4404-4b8b-82ac-3475116fe688",
    "redemptions": [
      {
        "redemptionId": "01a15a8b-96a0-702a-9d20-5246f4efee9b",
        "claimId": "019b76da-a800-7c1a-9069-f2e16d4af0a3",
        "rewardId": "019b76da-a800-7abc-a318-2ac9fe8ee4ca",
        "rewardTitle": "Free coffee — Grand Opening"
      }
    ]
  },
  "meta": {
    "correlationId": "1CP7HvuGYbp7u5o_afbT5",
    "timestamp": 1792520459984
  }
}
```

### POST /api/v1/integration/redemptions/validate

POS validate QR or backup code

- **Merchant API key** — `X-API-Key: mk_live_…` (or `Authorization: Bearer mk_live_…`). No cookie, no session.
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RedemptionsController_validate` · [source](../../../apps/api/src/contexts/pos/presentation/http/redemptions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `X-Terminal-Id` | header | string | no | Terminal id. Optional for a key issued by pairing (POST /integration/terminals/pair); required for a manually created key (e.g. KL-REGISTER-01). |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupCode` | string | no | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |
| `token` | string | no | length 16–512 |

**Response 201 Created** (`application/json`) — Redemption preview

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.claimExpiresAt` | integer | yes |  |
| `data.claimId` | string (uuid) | yes |  |
| `data.invalidReason` | "ALREADY_REDEEMED" \| "EXPIRED" \| "NOT_VALID_AT_STORE" \| "STORE_REQUIRED" \| null | yes |  |
| `data.minSpendMinor` | integer \| null | yes |  |
| `data.rewardTitle` | string | yes |  |
| `data.rewardType` | "DISCOUNT" \| "FREE_ITEM" \| "CASHBACK" \| "POINTS" \| "BOGO" | yes |  |
| `data.valid` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `MERCHANT_API_KEY_REQUIRED`, `MERCHANT_API_KEY_INVALID` | Missing, unknown or revoked API key. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as the seeded Brew & Bean KL register (POS API key).

```http
POST /api/v1/integration/redemptions/validate
X-API-Key: mk_live_IwgbQID2Csq4nbnfwUxVUrQT8lwrlhEz7bzagwasKyFtZYSQ42LSH43lzTfRdBkV7tZArdHQQE4EW0wDHpVAroL57w/+5AzsCxRpax2fmu3JqITATsJKJRi4+fifNVj1E3WswonhsleEBinxwcMOlqccH0suhUq6mJWVvaWYkf8=
X-Terminal-Id: KL-REGISTER-01
Content-Type: application/json

{
  "token": "seed_qr_token_kl_pending_alice_001"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "claimId": "019b76da-a800-7c1a-9069-f2e16d4af0a3",
    "rewardTitle": "Free coffee — Grand Opening",
    "rewardType": "FREE_ITEM",
    "claimExpiresAt": 1793125194737,
    "valid": true,
    "invalidReason": null,
    "minSpendMinor": 0
  },
  "meta": {
    "correlationId": "ES7Gkae9JldHvfy3FnxTi",
    "timestamp": 1792520459704
  }
}
```

## Integration

### GET /api/v1/integration/analytics

The API key's tenant reward performance analytics

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationAnalyticsController_getAnalytics` · [source](../../../apps/api/src/contexts/reporting/presentation/http/integration-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
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

**Example** — called as an integration API key (the key names its tenant).

```http
GET /api/v1/integration/analytics
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "period": {
      "from": 1788105600000,
      "to": 1792520464240,
      "timeZone": "Asia/Kuala_Lumpur"
    },
    "totalRewards": {
      "value": 17,
      "changePercent": 100
    },
    "activeRewards": {
      "value": 10,
      "changePercent": 100
    },
    "totalClaims": {
      "value": 191,
      "changePercent": 3
    },
    "totalRedemptions": {
      "value": 167,
      "changePercent": 5
    },
    "conversionRate": {
      "value": 87.4,
      "changePercent": 2
    },
    "referralCount": {
      "value": 2,
      "changePercent": 100
    },
    "claimsOverTime": [
      {
        "date": 1788105600000,
        "claims": 21,
        "redemptions": 22
      },
      {
        "date": 1788710400000,
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
        "changePercent": 1
      },
      "bills": {
        "value": 167,
        "changePercent": 5
      },
      "averageBillMinor": {
        "value": 2828,
        "changePercent": -4
      },
      "overTime": [
        {
          "date": 1788105600000,
          "salesMinor": 52410,
          "bills": 22
        },
        {
          "date": 1788710400000,
          "salesMinor": 61748,
          "bills": 22
        }
      ],
      "firstBillAt": 1761008340000
    }
  },
  "meta": {
    "correlationId": "1qZOvRWaiDOHolkK0aSh0",
    "timestamp": 1792520464312
  }
}
```

### GET /api/v1/integration/analytics/dashboard

The API key's tenant analytics dashboard

Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); `interval` (day | week | month) defaults from the range length. Every number is computed in Postgres; buckets are cut in `range.timeZone`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationAnalyticsController_getDashboard` · [source](../../../apps/api/src/contexts/reporting/presentation/http/integration-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
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

**Example** — called as an integration API key (the key names its tenant).

```http
GET /api/v1/integration/analytics/dashboard?interval=week
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "range": {
      "from": 1789928464405,
      "to": 1792520464405,
      "timeZone": "Asia/Kuala_Lumpur",
      "interval": "week",
      "previousFrom": 1787336464405,
      "previousTo": 1789928464405
    },
    "currency": "MYR",
    "firstBillAt": 1761008340000,
    "totals": {
      "salesMinor": {
        "value": 286851,
        "previous": 267951,
        "change": 18900,
        "changePercent": 7.1
      },
      "bills": {
        "value": 101,
        "previous": 95,
        "change": 6,
        "changePercent": 6.3
      },
      "averageBillMinor": {
        "value": 2840,
        "previous": 2821,
        "change": 19,
        "changePercent": 0.7
      },
      "claims": {
        "value": 114,
        "previous": 105,
        "change": 9,
        "changePercent": 8.6
      },
      "redemptions": {
        "value": 101,
        "previous": 95,
        "change": 6,
        "changePercent": 6.3
      },
      "conversionRate": {
        "value": 88.6,
        "previous": 90.5,
        "change": -1.9,
        "changePercent": -2.1
      },
      "customers": {
        "value": 31,
        "previous": 29,
        "change": 2,
        "changePercent": 6.9
      }
    },
    "series": [
      {
        "start": 1789928464405,
        "end": 1790524800000,
        "isPartial": true,
        "salesMinor": 69394,
        "bills": 23,
        "averageBillMinor": 3017,
        "claims": 31,
        "redemptions": 23
      },
      {
        "start": 1790524800000,
        "end": 1791129600000,
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
        "salesMinor": 286851,
        "bills": 101,
        "averageBillMinor": 2840,
        "redemptions": 101
      },
      {
        "locationId": "01a15a8b-6906-7f9a-ac09-e9f7dea0f458",
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
        "claims": 56,
        "redemptions": 50,
        "conversionRate": 89.3
      },
      {
        "rewardId": "019b76da-a800-7a5e-8873-45fa5124324b",
        "title": "Morning brew club — free refill",
        "claims": 47,
        "redemptions": 47,
        "conversionRate": 100
      }
    ],
    "byRedemptionMethod": [
      {
        "method": "SCAN",
        "redemptions": 67
      },
      {
        "method": "MANUAL",
        "redemptions": 34
      }
    ]
  },
  "meta": {
    "correlationId": "umJFyrpM0tCMPJNwZHza8",
    "timestamp": 1792520464435
  }
}
```

### GET /api/v1/integration/analytics/export

Download the API key's tenant analytics report (csv | xlsx | pdf)

The body is the file (Content-Disposition: attachment). Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); both bounds are required. Each export writes an audit row and is limited to 10 per caller per 10 minutes: 429 ANALYTICS_EXPORT_RATE_LIMITED with `Retry-After`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/pdf` · `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` · `text/csv; charset=utf-8` (errors are always `application/json`)
- Operation id `IntegrationAnalyticsController_exportReport` · [source](../../../apps/api/src/contexts/reporting/presentation/http/integration-analytics.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
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

**Example** — called as an integration API key (the key names its tenant). The body is the file itself (Content-Type of the format, Content-Disposition: attachment; filename=…); errors keep the JSON error envelope. See docs/technical/api/analytics.md.

```http
GET /api/v1/integration/analytics/export?from=1789928464459&to=1792520464459&format=csv
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
```

Response `200 OK` (text/csv):

```text
<2151 bytes of text/csv>
```

### GET /api/v1/integration/redemptions

List the API key's own redemptions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationRedemptionsController_listRedemptions` · [source](../../../apps/api/src/contexts/pos/presentation/http/integration-redemptions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: redeemedAt. Default: -redeemedAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: redeemedAt |
| `locationId` | query | string (uuid) | no |  |

**Response 200 OK** (`application/json`) — Paginated redemption history of the key's tenant (and store, for a store-scoped key)

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

**Example** — called as an integration API key (the key names its tenant).

```http
GET /api/v1/integration/redemptions?limit=2
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "redemptionId": "01a15a8b-96a0-702a-9d20-5246f4efee9b",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1792520459811,
      "terminalId": "KL-REGISTER-01",
      "redemptionMethod": "MANUAL"
    },
    {
      "redemptionId": "019b76da-a800-704e-9593-80d298dad1b4",
      "rewardTitle": "Free coffee — Grand Opening",
      "redeemedAt": 1792520394738,
      "terminalId": "KL-REGISTER-01",
      "redemptionMethod": "SCAN"
    }
  ],
  "meta": {
    "limit": 2,
    "total": 918,
    "page": 1,
    "totalPages": 459,
    "nextCursor": "eyJhdCI6MTc5MjUyMDM5NDczOCwiaWQiOiIwMTliNzZkYS1hODAwLTcwNGUtOTU5My04MGQyOThkYWQxYjQifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "G9pJwTlVw018HzXklTx6l",
    "timestamp": 1792520464663
  }
}
```

### GET /api/v1/integration/rewards

List the API key's tenant rewards

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationRewardsController_listRewards` · [source](../../../apps/api/src/contexts/rewards/presentation/http/integration-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
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

**Example** — called as an integration API key (the key names its tenant).

```http
GET /api/v1/integration/rewards?limit=2
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1792520456028,
      "updatedAt": 1792520456217,
      "isDeleted": false,
      "deletedAt": null,
      "id": "01a15a8b-875f-7080-936d-231d770e72e4",
      "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
      "tenantName": "Brew & Bean KL",
      "tenantLogoUrl": null,
      "tenantLogoSources": [],
      "title": "Buy one get one Iced Latte",
      "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
      "rewardType": "BOGO",
      "rewardValue": 13,
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
      "quantityTotal": 200,
      "quantityRemaining": 200,
      "quantityReserved": 0,
      "startDate": 1792520454635,
      "expiryDate": 1797704454635,
      "status": "DRAFT",
      "claimCount": 0,
      "redemptionCount": 0,
      "referralsEnabled": false,
      "referralPoolTotal": null,
      "referralPoolRemaining": null,
      "referrerRewardId": null,
      "rules": {
        "minSpendMyr": 15,
        "maxUsePerUser": 1
      },
      "locationScopeType": "ALL_LOCATIONS",
      "locationIds": []
    },
    {
      "createdAt": 1792520454844,
      "updatedAt": 1792520457455,
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
      "quantityRemaining": 249,
      "quantityReserved": 1,
      "startDate": 1792520454635,
      "expiryDate": 1797704454635,
      "status": "PUBLISHED",
      "claimCount": 1,
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
    }
  ],
  "meta": {
    "limit": 2,
    "total": 16,
    "page": 1,
    "totalPages": 8,
    "nextCursor": "eyJhdCI6MTc5MjUyMDQ1NDg0NCwiaWQiOiIwMWExNWE4Yi04MmM2LTc0ODYtYTAyMC0yZGM2MTU2ZDI1OTMifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "_IQFV0OIN0XmDRlqNitJX",
    "timestamp": 1792520461544
  }
}
```

### POST /api/v1/integration/rewards

Create a draft reward for the API key's tenant

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationRewardsController_createReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/integration-rewards.controller.ts)

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

**Example** — called as an integration API key (the key names its tenant).

```http
POST /api/v1/integration/rewards
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
Content-Type: application/json

{
  "imageFileIds": [
    "01a15a8b-9dce-728d-9a5c-2683515b5214"
  ],
  "title": "Synced from the back office",
  "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
  "category": "cafe",
  "rewardType": "FREE_ITEM",
  "rewardValue": 6,
  "quantityTotal": 200,
  "startDate": 1792520463451,
  "expiryDate": 1797704463451,
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
    "createdAt": 1792520463554,
    "updatedAt": 1792520463655,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-a4c7-78f8-a28a-3d530d5ab78b",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "tenantName": "Brew & Bean KL",
    "tenantLogoUrl": null,
    "tenantLogoSources": [],
    "title": "Synced from the back office",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a15a8b-9dce-728d-9a5c-2683515b5214",
        "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 200,
    "quantityRemaining": 200,
    "quantityReserved": 0,
    "startDate": 1792520463451,
    "expiryDate": 1797704463451,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a15a8b-a4c7-79b0-9add-49e1c1b9a46d",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "nXT1uSRqiuis84qfGQQBg",
    "timestamp": 1792520463784
  }
}
```

### GET /api/v1/integration/rewards/{rewardId}

Read one of the API key's tenant rewards (404 when not offered at the key's store)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationRewardsController_getReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/integration-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
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

**Example** — called as an integration API key (the key names its tenant).

```http
GET /api/v1/integration/rewards/01a15a8b-875f-7080-936d-231d770e72e4
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520456028,
    "updatedAt": 1792520456217,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-875f-7080-936d-231d770e72e4",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "tenantName": "Brew & Bean KL",
    "tenantLogoUrl": null,
    "tenantLogoSources": [],
    "title": "Buy one get one Iced Latte",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "BOGO",
    "rewardValue": 13,
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
    "quantityTotal": 200,
    "quantityRemaining": 200,
    "quantityReserved": 0,
    "startDate": 1792520454635,
    "expiryDate": 1797704454635,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": false,
    "referralPoolTotal": null,
    "referralPoolRemaining": null,
    "referrerRewardId": null,
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "DUR9-66y8rgkG4N0kHy1R",
    "timestamp": 1792520461715
  }
}
```

### PATCH /api/v1/integration/rewards/{rewardId}

Update a draft or pending reward of the API key's tenant

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationRewardsController_updateReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/integration-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
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

**Example** — called as an integration API key (the key names its tenant).

```http
PATCH /api/v1/integration/rewards/01a15a8b-a4c7-78f8-a28a-3d530d5ab78b
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
Content-Type: application/json

{
  "quantityTotal": 120
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520463554,
    "updatedAt": 1792520463868,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-a4c7-78f8-a28a-3d530d5ab78b",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "tenantName": "Brew & Bean KL",
    "tenantLogoUrl": null,
    "tenantLogoSources": [],
    "title": "Synced from the back office",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a15a8b-9dce-728d-9a5c-2683515b5214",
        "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 120,
    "quantityRemaining": 120,
    "quantityReserved": 0,
    "startDate": 1792520463451,
    "expiryDate": 1797704463451,
    "status": "DRAFT",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a15a8b-a4c7-79b0-9add-49e1c1b9a46d",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "ewUv-g6wgP5eKlWo5gZ68",
    "timestamp": 1792520463958
  }
}
```

### POST /api/v1/integration/rewards/{rewardId}/publish

Submit one of the API key's tenant rewards for moderation review (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationRewardsController_publishReward` · [source](../../../apps/api/src/contexts/rewards/presentation/http/integration-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
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

**Example** — called as an integration API key (the key names its tenant).

```http
POST /api/v1/integration/rewards/01a15a8b-a4c7-78f8-a28a-3d530d5ab78b/publish
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
Content-Type: application/json

{}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520463554,
    "updatedAt": 1792520464042,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-a4c7-78f8-a28a-3d530d5ab78b",
    "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
    "tenantName": "Brew & Bean KL",
    "tenantLogoUrl": null,
    "tenantLogoSources": [],
    "title": "Synced from the back office",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "FREE_ITEM",
    "rewardValue": 6,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "images": [
      {
        "fileId": "01a15a8b-9dce-728d-9a5c-2683515b5214",
        "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/LARGE/local-public",
        "width": 1920,
        "height": 1080,
        "sources": [
          {
            "width": 640,
            "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/THUMBNAIL/local-public"
          },
          {
            "width": 1280,
            "url": "http://192.168.100.23:8097/api/v1/files/01a15a8b-9dce-728d-9a5c-2683515b5214/variants/MEDIUM/local-public"
          }
        ]
      }
    ],
    "quantityTotal": 120,
    "quantityRemaining": 120,
    "quantityReserved": 0,
    "startDate": 1792520463451,
    "expiryDate": 1797704463451,
    "status": "PENDING_REVIEW",
    "claimCount": 0,
    "redemptionCount": 0,
    "referralsEnabled": true,
    "referralPoolTotal": 50,
    "referralPoolRemaining": 50,
    "referrerRewardId": "01a15a8b-a4c7-79b0-9add-49e1c1b9a46d",
    "rules": {
      "minSpendMyr": 15,
      "maxUsePerUser": 1
    },
    "locationScopeType": "ALL_LOCATIONS",
    "locationIds": []
  },
  "meta": {
    "correlationId": "APVjXhnZ-ibGHBNPF6tQj",
    "timestamp": 1792520464143
  }
}
```

### GET /api/v1/integration/rewards/summary

The API key's tenant reward figures: the count in each status and the units still claimable

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Also accepts an **INTEGRATION-scope merchant API key**.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `IntegrationRewardsController_summarizeRewards` · [source](../../../apps/api/src/contexts/rewards/presentation/http/integration-rewards.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
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

**Example** — called as an integration API key (the key names its tenant).

```http
GET /api/v1/integration/rewards/summary
X-API-Key: mk_live_<the INTEGRATION key returned by POST /api/v1/tenants/{tenantSlug}/api-keys>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "countsByStatus": {
      "DRAFT": 3,
      "PENDING_REVIEW": 1,
      "PUBLISHED": 10,
      "EXPIRED": 2,
      "DISABLED": 0
    },
    "unitsRemaining": 1587
  },
  "meta": {
    "correlationId": "INvsRndtU_V9kv85TKJlV",
    "timestamp": 1792520461601
  }
}
```
