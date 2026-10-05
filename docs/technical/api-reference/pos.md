---
title: "API reference — Point of sale (machine-to-machine)"
description: "Terminal pairing, validating a customer's QR / backup code and recording the paid bill. Authenticated with a merchant API key."
order: 7
author: "Generated from the OpenAPI export"
lastUpdated: 1791158400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Point of sale (machine-to-machine)

Terminal pairing, validating a customer's QR / backup code and recording the paid bill. Authenticated with a merchant API key.

How these endpoints fit together: [POS integration guide](../pos-integration.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## POS

### POST /api/v1/pos/terminals/pair

Pair a POS terminal with the one-time code from the merchant console

Returns the terminal's own API key (shown once). Send it as X-API-Key on every redemption call; X-Terminal-Id is then optional.

- **Public** — no session required.
- Rate limit: `PAIRING_ATTEMPTS_PER_WINDOW` requests per `PAIRING_WINDOW_MS` ms per client IP (strict limiter).
- Operation id `PosTerminalsController_pair` · [source](../../../apps/api/src/modules/rewards/controllers/organization-terminals.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `pairingCode` | string | yes | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |

**Response 201 Created** — Terminal paired

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.apiKey` | string | yes |  |
| `data.location` | object | yes |  |
| `data.location.id` | string (uuid) | yes |  |
| `data.location.name` | string | yes |  |
| `data.organization` | object | yes |  |
| `data.organization.displayName` | string | yes |  |
| `data.organization.slug` | string | yes |  |
| `data.terminalId` | string | yes | length 1–100; pattern `^[A-Za-z0-9][A-Za-z0-9._:-]*$` |
| `data.terminalName` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as a new till (pairing code only, no credential yet).

```http
POST /api/v1/pos/terminals/pair
Content-Type: application/json

{
  "pairingCode": "TADMREEM"
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
    "organization": {
      "slug": "brew-bean-kl",
      "displayName": "Brew & Bean KL"
    },
    "location": {
      "id": "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
      "name": "Brew & Bean KL — Bukit Bintang"
    }
  },
  "meta": {
    "correlationId": "61AeUu7DbdvCsykliVPXU",
    "timestamp": 1791193339789
  }
}
```

## Redemptions

### POST /api/v1/redemptions/checkout

POS checkout: after payment, record the bill and redeem every presented reward (all-or-nothing, idempotent)

Send the bill total in minor units (sen) and up to 10 QR tokens / backup codes of ONE customer. Retrying with the same idempotencyKey and body replays the original result; a different body with a used key is rejected (409 IDEMPOTENCY_KEY_REUSED).

- **Merchant API key** — `X-API-Key: mk_live_…` (or `Authorization: Bearer mk_live_…`). No cookie, no session.
- Operation id `RedemptionsController_checkout` · [source](../../../apps/api/src/modules/rewards/controllers/redemptions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `X-Terminal-Id` | header | string | no | Terminal id. Optional for a key issued by pairing (POST /pos/terminals/pair); required for a manually created key (e.g. KL-REGISTER-01). |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `billTotalMinor` | integer | yes | range 0–100000000 |
| `codes` | object[] | yes | 1–10 items |
| `codes[].backupCode` | string | no | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |
| `codes[].token` | string | no | length 16–512 |
| `currency` | "MYR" | yes |  |
| `idempotencyKey` | string (uuid) | yes |  |

**Response 201 Created** — Bill recorded and rewards redeemed

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
POST /api/v1/redemptions/checkout
X-API-Key: mk_live_IwgbQID2Csq4nbnfwUxVUrQT8lwrlhEz7bzagwasKyFtZYSQ42LSH43lzTfRdBkV7tZArdHQQE4EW0wDHpVAroL57w/+5AzsCxRpax2fmu3JqITATsJKJRi4+fifNVj1E3WswonhsleEBinxwcMOlqccH0suhUq6mJWVvaWYkf8=
X-Terminal-Id: KL-REGISTER-01
Content-Type: application/json

{
  "idempotencyKey": "f815f2d6-2049-4703-94ac-b79e5b21cf1c",
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
    "saleId": "388bfe2d-4b41-4904-9468-85e8bfdbd808",
    "billTotalMinor": 2500,
    "currency": "MYR",
    "paidAt": 1791193339862,
    "idempotencyKey": "f815f2d6-2049-4703-94ac-b79e5b21cf1c",
    "redemptions": [
      {
        "redemptionId": "6b43c61d-2092-43bc-beed-cd4a75de8122",
        "claimId": "74199f6f-877f-4d87-8a02-78941a4ae1af",
        "rewardId": "c1214e16-bf0f-4410-8871-8d1a9970f75e",
        "rewardTitle": "Free coffee — Grand Opening"
      }
    ]
  },
  "meta": {
    "correlationId": "85STI5qqDySqXtFTtYj7P",
    "timestamp": 1791193339893
  }
}
```

### POST /api/v1/redemptions/validate

POS validate QR or backup code

- **Merchant API key** — `X-API-Key: mk_live_…` (or `Authorization: Bearer mk_live_…`). No cookie, no session.
- Operation id `RedemptionsController_validate` · [source](../../../apps/api/src/modules/rewards/controllers/redemptions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `X-Terminal-Id` | header | string | no | Terminal id. Optional for a key issued by pairing (POST /pos/terminals/pair); required for a manually created key (e.g. KL-REGISTER-01). |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `backupCode` | string | no | exactly 8 characters; pattern `^[A-HJ-NP-Z2-9]{8}$` |
| `token` | string | no | length 16–512 |

**Response 201 Created** — Redemption preview

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
POST /api/v1/redemptions/validate
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
    "claimId": "74199f6f-877f-4d87-8a02-78941a4ae1af",
    "rewardTitle": "Free coffee — Grand Opening",
    "rewardType": "FREE_ITEM",
    "claimExpiresAt": 1791797951336,
    "valid": true,
    "invalidReason": null,
    "minSpendMinor": 0
  },
  "meta": {
    "correlationId": "UrL8x1g3o-dPmgn-TFhRj",
    "timestamp": 1791193339830
  }
}
```
