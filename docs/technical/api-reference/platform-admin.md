---
title: "API reference — Platform administration (merchants, rewards review, analytics)"
description: "What platform admins do in the admin panel: invite merchants, review KYB and store requests, approve rewards, read platform sales."
order: 4
author: "Generated from the OpenAPI export"
lastUpdated: 1791158400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Platform administration (merchants, rewards review, analytics)

What platform admins do in the admin panel: invite merchants, review KYB and store requests, approve rewards, read platform sales.

How these endpoints fit together: [Merchant onboarding guide](../../user-guide/02-merchant-onboarding.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Rewards Admin

### GET /api/v1/admin/analytics/dashboard

Platform analytics dashboard: custom range + interval, compared totals, series, top merchants, categories, cities, new vs returning customers

Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); `interval` (day | week | month) defaults from the range length. Every number is computed in Postgres; buckets are cut in `range.timeZone`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:ANALYTICS`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminAnalyticsController_getDashboard` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `from` | query | integer | no | Range start, epoch ms, inclusive. Default: 30 days before `to`. |
| `to` | query | integer | no | Range end, epoch ms, EXCLUSIVE. Default: now. At most 366 days after `from`. |
| `interval` | query | "day" \| "week" \| "month" | no | Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length. |

**Response 200 OK** — Platform analytics dashboard

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.byCategory` | object[] | yes |  |
| `data.byCategory[].bills` | integer | yes |  |
| `data.byCategory[].category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" \| null | yes |  |
| `data.byCategory[].merchants` | integer | yes |  |
| `data.byCategory[].salesMinor` | integer | yes |  |
| `data.byCity` | object[] | yes |  |
| `data.byCity[].bills` | integer | yes |  |
| `data.byCity[].city` | "KUALA_LUMPUR" \| "MELAKA" \| null | yes |  |
| `data.byCity[].merchants` | integer | yes |  |
| `data.byCity[].salesMinor` | integer | yes |  |
| `data.currency` | "MYR" | yes |  |
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
| `data.series[].newCustomers` | integer | yes |  |
| `data.series[].redemptions` | integer | yes |  |
| `data.series[].returningCustomers` | integer | yes |  |
| `data.series[].salesMinor` | integer | yes |  |
| `data.series[].start` | integer | yes |  |
| `data.topMerchants` | object[] | yes |  |
| `data.topMerchants[].averageBillMinor` | integer | yes |  |
| `data.topMerchants[].bills` | integer | yes |  |
| `data.topMerchants[].category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" \| null | yes |  |
| `data.topMerchants[].name` | string | yes |  |
| `data.topMerchants[].organizationId` | string (uuid) | yes |  |
| `data.topMerchants[].salesMinor` | integer | yes |  |
| `data.totals` | object | yes |  |
| `data.totals.activeMerchants` | object | yes |  |
| `data.totals.activeMerchants.change` | number | yes |  |
| `data.totals.activeMerchants.changePercent` | number \| null | yes |  |
| `data.totals.activeMerchants.previous` | number | yes |  |
| `data.totals.activeMerchants.value` | number | yes |  |
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
| `data.totals.newCustomers` | object | yes |  |
| `data.totals.newCustomers.change` | number | yes |  |
| `data.totals.newCustomers.changePercent` | number \| null | yes |  |
| `data.totals.newCustomers.previous` | number | yes |  |
| `data.totals.newCustomers.value` | number | yes |  |
| `data.totals.redemptions` | object | yes |  |
| `data.totals.redemptions.change` | number | yes |  |
| `data.totals.redemptions.changePercent` | number \| null | yes |  |
| `data.totals.redemptions.previous` | number | yes |  |
| `data.totals.redemptions.value` | number | yes |  |
| `data.totals.returningCustomers` | object | yes |  |
| `data.totals.returningCustomers.change` | number | yes |  |
| `data.totals.returningCustomers.changePercent` | number \| null | yes |  |
| `data.totals.returningCustomers.previous` | number | yes |  |
| `data.totals.returningCustomers.value` | number | yes |  |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/analytics/dashboard?interval=week
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "range": {
      "from": 1788601329586,
      "to": 1791193329586,
      "timeZone": "UTC",
      "interval": "week",
      "previousFrom": 1786009329586,
      "previousTo": 1788601329586
    },
    "currency": "MYR",
    "totals": {
      "salesMinor": {
        "value": 1349641,
        "previous": 1368484,
        "change": -18843,
        "changePercent": -1.4
      },
      "bills": {
        "value": 226,
        "previous": 213,
        "change": 13,
        "changePercent": 6.1
      },
      "averageBillMinor": {
        "value": 5972,
        "previous": 6425,
        "change": -453,
        "changePercent": -7.1
      },
      "claims": {
        "value": 260,
        "previous": 260,
        "change": 0,
        "changePercent": 0
      },
      "redemptions": {
        "value": 226,
        "previous": 213,
        "change": 13,
        "changePercent": 6.1
      },
      "conversionRate": {
        "value": 86.9,
        "previous": 81.9,
        "change": 5,
        "changePercent": 6.1
      },
      "activeMerchants": {
        "value": 2,
        "previous": 2,
        "change": 0,
        "changePercent": 0
      },
      "customers": {
        "value": 33,
        "previous": 30,
        "change": 3,
        "changePercent": 10
      },
      "newCustomers": {
        "value": 3,
        "previous": 4,
        "change": -1,
        "changePercent": -25
      },
      "returningCustomers": {
        "value": 30,
        "previous": 26,
        "change": 4,
        "changePercent": 15.4
      }
    },
    "series": [
      {
        "start": 1788601329586,
        "end": 1788739200000,
        "isPartial": true,
        "salesMinor": 82725,
        "bills": 12,
        "averageBillMinor": 6894,
        "claims": 11,
        "redemptions": 12,
        "newCustomers": 0,
        "returningCustomers": 9
      },
      {
        "start": 1788739200000,
        "end": 1789344000000,
        "isPartial": false,
        "salesMinor": 314959,
        "bills": 51,
        "averageBillMinor": 6176,
        "claims": 69,
        "redemptions": 51,
        "newCustomers": 0,
        "returningCustomers": 24
      }
    ],
    "topMerchants": [
      {
        "organizationId": "b57401d5-536e-464f-9ae9-4756b6dd5f61",
        "name": "Jonker Street Kitchen",
        "category": "restaurant",
        "salesMinor": 1056936,
        "bills": 125,
        "averageBillMinor": 8455
      },
      {
        "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
        "name": "Brew & Bean KL",
        "category": "cafe",
        "salesMinor": 292705,
        "bills": 101,
        "averageBillMinor": 2898
      }
    ],
    "byCategory": [
      {
        "category": "restaurant",
        "salesMinor": 1056936,
        "bills": 125,
        "merchants": 1
      },
      {
        "category": "cafe",
        "salesMinor": 292705,
        "bills": 101,
        "merchants": 1
      }
    ],
    "byCity": [
      {
        "city": "MELAKA",
        "salesMinor": 1056936,
        "bills": 125,
        "merchants": 1
      },
      {
        "city": "KUALA_LUMPUR",
        "salesMinor": 292705,
        "bills": 101,
        "merchants": 1
      }
    ]
  },
  "meta": {
    "correlationId": "3mqd--ujXE5RmdYhXzK9c",
    "timestamp": 1791193329601
  }
}
```

### GET /api/v1/admin/analytics/export

Download the platform analytics report (csv | xlsx | pdf) for a date range

The body is the file (Content-Disposition: attachment). Range: `from` (inclusive) / `to` (exclusive) epoch ms, at most 366 days (else 400 VALIDATION_ERROR); both bounds are required. Each export writes an audit row and is limited to 10 per caller per 10 minutes: 429 ANALYTICS_EXPORT_RATE_LIMITED with `Retry-After`. A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:ANALYTICS`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminAnalyticsController_exportReport` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `from` | query | integer | yes | Range start, epoch ms, inclusive. |
| `to` | query | integer | yes | Range end, epoch ms, EXCLUSIVE. At most 366 days after `from`. |
| `interval` | query | "day" \| "week" \| "month" | no | Bucket width of the time series: `day`, `week` (Monday 00:00) or `month` (the 1st), cut in the report's time zone. Default: derived from the range length. |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel). The body is the file itself (Content-Type of the format, Content-Disposition: attachment; filename=…); errors keep the JSON error envelope. See docs/technical/api/analytics.md.

```http
GET /api/v1/admin/analytics/export?from=1788601329603&to=1791193329603&format=csv
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (text/csv):

```text
<2313 bytes of text/csv>
```

### GET /api/v1/admin/analytics/sales

Platform-wide sales: paid POS bills, compared with the previous period, plus top merchants

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:ANALYTICS`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminAnalyticsController_getSales` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `from` | query | integer | no |  |
| `to` | query | integer | no |  |

**Response 200 OK** — Platform sales analytics

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.activeMerchants` | object | yes |  |
| `data.activeMerchants.changePercent` | number \| null | yes |  |
| `data.activeMerchants.value` | number | yes |  |
| `data.period` | object | yes |  |
| `data.period.from` | integer | yes |  |
| `data.period.timeZone` | string | yes | length 1–64 |
| `data.period.to` | integer | yes |  |
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
| `data.topMerchants` | object[] | yes |  |
| `data.topMerchants[].bills` | integer | yes |  |
| `data.topMerchants[].category` | "cafe" \| "restaurant" \| "retail" \| "wellness" \| "entertainment" \| "food" \| "beverage" \| null | yes |  |
| `data.topMerchants[].name` | string | yes |  |
| `data.topMerchants[].organizationId` | string (uuid) | yes |  |
| `data.topMerchants[].salesMinor` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/analytics/sales
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "period": {
      "from": 1786924800000,
      "to": 1791193329535,
      "timeZone": "UTC"
    },
    "sales": {
      "currency": "MYR",
      "totalSalesMinor": {
        "value": 2264953,
        "changePercent": 11
      },
      "bills": {
        "value": 366,
        "changePercent": 12
      },
      "averageBillMinor": {
        "value": 6188,
        "changePercent": -1
      },
      "overTime": [
        {
          "date": 1786924800000,
          "salesMinor": 336839,
          "bills": 52
        },
        {
          "date": 1787529600000,
          "salesMinor": 310258,
          "bills": 48
        }
      ],
      "firstBillAt": 1759625940000
    },
    "activeMerchants": {
      "value": 2,
      "changePercent": 0
    },
    "topMerchants": [
      {
        "organizationId": "b57401d5-536e-464f-9ae9-4756b6dd5f61",
        "name": "Jonker Street Kitchen",
        "category": "restaurant",
        "salesMinor": 1800933,
        "bills": 204
      },
      {
        "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
        "name": "Brew & Bean KL",
        "category": "cafe",
        "salesMinor": 464020,
        "bills": 162
      }
    ]
  },
  "meta": {
    "correlationId": "BnsbcMHYg-vqXzFbgfC1W",
    "timestamp": 1791193329572
  }
}
```

### POST /api/v1/admin/invites

Create merchant invite

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `MANAGE:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RewardsAdminInvitesController_createInvite` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `businessName` | string | yes | length 1–200 |
| `city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `email` | string (email) | yes | at most 100 characters |

**Response 201 Created** — Invite created with token

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.expiresAt` | integer | yes |  |
| `data.inviteId` | string (uuid) | yes |  |
| `data.inviteToken` | string | yes | at least 1 characters |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/invites
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "email": "nyonya.house@melaka-rewards.demo",
  "businessName": "Nyonya House Melaka",
  "city": "MELAKA"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "inviteId": "53605450-6cb2-4571-a094-c3f6a7dc3a3a",
    "inviteToken": "b941ccc7b3fba7399ccda90880d0dcfec8eb3f651fa32d9fd1740a2c99d7e96e",
    "expiresAt": 1791798129682
  },
  "meta": {
    "correlationId": "CN6KJumUVqCnaZe0iAK03",
    "timestamp": 1791193329718
  }
}
```

### GET /api/v1/admin/invites/preview-email

Preview merchant invite email (does not send)

Renders the invite email for a business name and pilot city, for a live preview while the invite is composed. The template's sample business name stands in when none is given. The recipient is not an input: the email body never shows it.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `MANAGE:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminInvitesController_previewInviteEmail` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `businessName` | query | string | no |  |
| `city` | query | "KUALA_LUMPUR" \| "MELAKA" | yes |  |

**Response 200 OK** — Rendered invite email preview

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.description` | string | yes | at least 1 characters |
| `data.html` | string | yes | at least 1 characters |
| `data.key` | "verification" \| "password-reset" \| "password-changed" \| "account-locked" \| "welcome" \| "security-alert" \| "two-factor-enabled" \| "two-factor-disabled" \| "admin-alert" \| "api-key-created" \| … (+5 more) | yes |  |
| `data.label` | string | yes | at least 1 characters |
| `data.previewText` | string | yes | at least 1 characters |
| `data.props` | object | yes |  |
| `data.subject` | string | yes | at least 1 characters |
| `data.text` | string | yes | at least 1 characters |
| `data.to` | string (email) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/invites/preview-email?businessName=Nyonya+House+Melaka&city=MELAKA
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "key": "merchant-invite",
    "label": "Merchant Invite",
    "description": "Onboarding invite sent when an admin creates a merchant invite.",
    "subject": "You're invited to join the rewards marketplace",
    "to": "owner@cafe.demo",
    "previewText": "Complete onboarding for Nyonya House Melaka in Melaka.",
    "html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <meta name=\"color-scheme\" content=\"light dark\">\n  <meta name=\"supported-color-schemes\" content=\"light dark\">\n  <meta name=\"x-apple-disable-message-reformatting\">\n  <title>You&#39;re invited to join the rewards marketplace</title>\n  <style>\n    @media (max-width: 620px) {\n      .email-card-inner { padding: 28px 22px 24px 22px !important; }\n      .email-h1 { font-size: 22px !important; }\n    }\n    @media (prefers-color-scheme: dark) {\n      .email-body, .email-canvas { background-color: #091018 !important; }\n      .email-card { background-color: #0f1923 !important; border-color: #1f2c3b !important; }\n      .email-heading, .email-h1, .email-brand-name { color: #edf2f8 !important; }\n      .email-text { color: #c7d2de !important; }\n      .email-muted, .email-footer { color: #97a7b7 !important; }\n      .email-panel, .email-otp-tile { background-color: #16212d !important; border-color: #1f2c3b !important; color: #edf2f8 !important; }\n      .email-rule { border-top-color: #1f2c3b !important; }\n      .email-link { color: #6594fa !important; }\n    }\n  </style>\n</head>\n<body class=\"email-body\" style=\"margin: 0; padding: 0; background-color: #f3f6fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;\">\n  <span style=\"display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden; mso-hide: all;\">Complete onboarding for Nyonya House Melaka in Melaka.</span>\n  <table role=\"presentation\" class=\"email-canvas\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" bgcolor=\"#f3f6fb\" style=\"width: 100%; background-color: #f3f6fb;\">\n    <tr>\n      <td align=\"center\" style=\"padding: 32px 12px 40px 12px;\">\n        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width: 600px; margin: 0 auto;\">\n          <tr>\n            <td style=\"padding: 0 4px 18px 4px;\">\n              <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\">\n                <tr>\n                  <td align=\"center\" style=\"width: 34px; height: 34px; border-radius: 9px; background: #2d5ed4; color: #ffffff; font-size: 17px; font-weight: 700; line-height: 34px; text-align: center;\">N</td>\n                  <td class=\"email-brand-name\" style=\"padding-left: 10px; color: #0f172a; font-size: 17px; font-weight: 700; letter-spacing: -0.01em;\">NestJS + NextJS Turborepo Starter Template</td>\n                </tr>\n              </table>\n            </td>\n          </tr>\n          <tr>\n            <td class=\"email-card\" style=\"background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;\">\n              <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">\n                <tr><td style=\"height: 4px; line-height: 4px; font-size: 0; background: #d97706;\">&nbsp;</td></tr>\n                <tr>\n                  <td class=\"email-card-inner\" style=\"padding: 36px 40px 32px 40px;\">\n                    <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin: 0 0 14px 0;\">\n                      <tr><td style=\"background: #fffbeb; border-radius: 999px; padding: 5px 12px; color: #92400e; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;\">Merchant onboarding</td></tr>\n                    </table>\n                    <h1 class=\"email-h1\" style=\"margin: 0 0 18px 0; color: #0f172a; font-size: 26px; font-weight: 700; line-height: 1.25; letter-spacing: -0.015em;\">Set up your merchant account</h1>\n                    <p class=\"email-text\" style=\"margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.65;\">You're invited to bring <strong style=\"color: #0f172a;\" class=\"email-heading\">Nyonya House Melaka</strong> onto the <strong style=\"color: #0f172a;\" class=\"email-heading\">Melaka</strong> pilot.</p>\n        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin: 4px 0 20px 0;\">\n          <tr>\n            <td class=\"email-panel\" style=\"background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px;\">\n              <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">\n              <tr>\n                <td class=\"email-muted\" style=\"padding: 0 0 0 0; width: 38%; vertical-align: top; color: #64748b; font-size: 13px; line-height: 1.5;\">Business</td>\n                <td class=\"email-heading\" style=\"padding: 0 0 0 12px; vertical-align: top; color: #0f172a; font-size: 14px; font-weight: 600; line-height: 1.5; word-break: break-word;\">Nyonya House Melaka</td>\n              </tr>\n              <tr>\n                <td class=\"email-muted\" style=\"padding: 10px 0 0 0; width: 38%; vertical-align: top; color: #64748b; font-size: 13px; line-height: 1.5;\">City</td>\n                <td class=\"email-heading\" style=\"padding: 10px 0 0 12px; vertical-align: top; color: #0f172a; font-size: 14px; font-weight: 600; line-height: 1.5; word-break: break-word;\">Melaka</td>\n              </tr>\n              <tr>\n                <td class=\"email-muted\" style=\"padding: 10px 0 0 0; width: 38%; vertical-align: top; color: #64748b; font-size: 13px; line-height: 1.5;\">Invite expires</td>\n                <td class=\"email-heading\" style=\"padding: 10px 0 0 12px; vertical-align: top; color: #0f172a; font-size: 14px; font-weight: 600; line-height: 1.5; word-break: break-word;\">In 7 days</td>\n              </tr>\n              </table>\n            </td>\n          </tr>\n        </table><p class=\"email-text\" style=\"margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.65;\">Create your merchant account and complete verification (KYB) to start publishing offers.</p>\n        <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin: 8px 0 24px 0;\">\n          <tr>\n            <td class=\"email-cta\" style=\"background: #2d5ed4; border-radius: 10px;\">\n              <a href=\"http://localhost:3003/onboarding?token=<redacted>\" style=\"display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;\">Start onboarding &rarr;</a>\n            </td>\n          </tr>\n        </table>\n        <p class=\"email-muted\" style=\"margin: 0 0 6px 0; color: #64748b; font-size: 12px; line-height: 1.5;\">Button not working? Paste this link into your browser:</p>\n        <p class=\"email-panel\" style=\"margin: 0 0 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5; color: #334155; word-break: break-all;\">http://localhost:3003/onboarding?token=<redacted> class=\"email-muted\" style=\"margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 1.6;\">Weren't expecting this? You can ignore this email.</p>\n                    \n                    <hr class=\"email-rule\" style=\"border: none; border-top: 1px solid #e2e8f0; margin: 8px 0 18px 0;\">\n                    <p class=\"email-muted\" style=\"margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;\">Sent by NestJS + NextJS Turborepo Starter Template · <a href=\"http://localhost:3000\" style=\"color: #64748b; text-decoration: underline;\">localhost:3000</a></p>\n                  </td>\n                </tr>\n              </table>\n            </td>\n          </tr>\n          <tr>\n            <td class=\"email-footer\" align=\"center\" style=\"padding: 20px 16px 0 16px; color: #94a3b8; font-size: 12px; line-height: 1.6; text-align: center;\">\n              <p style=\"margin: 0;\">You're receiving this because you have an account with NestJS + NextJS Turborepo Starter Template.</p>\n              <p class=\"email-muted\" style=\"margin: 4px 0 0 0;\">Questions? Reach us at <a href=\"mailto:noreply@example.com\" style=\"color: #64748b; text-decoration: underline;\">noreply@example.com</a></p>\n              <p style=\"margin: 4px 0 0 0;\">&copy; 2026 NestJS + NextJS Turborepo Starter Template. All rights reserved.</p>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>",
    "text": "NestJS + NextJS Turborepo Starter Template — Merchant onboarding\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nSet up your merchant account\n\nYou've been invited to onboard Nyonya House Melaka in the Melaka pilot.\n\nOpen this link to start onboarding:\nhttp://localhost:3003/onboarding?token=<redacted>\n\nThis invite expires in 7 days.\nIf you weren't expecting this, you can ignore this email.\n\nAction: Start onboarding\n\nhttp://localhost:3003/onboarding?token=<redacted>\n\nQuestions? noreply@example.com\n\n© 2026 NestJS + NextJS Turborepo Starter Template. All rights reserved.",
    "props": {
      "to": "owner@cafe.demo",
      "businessName": "Nyonya House Melaka",
      "cityLabel": "Melaka",
      "inviteUrl": "http://localhost:3003/onboarding?token=<redacted>",
      "expiresInDays": 7
    }
  },
  "meta": {
    "correlationId": "WPzB7u9Ph7AAloEPWHE2b",
    "timestamp": 1791457023225
  }
}
```

### GET /api/v1/admin/location-requests

List pending organization store location requests

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminLocationRequestsController_listLocationRequests` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 50, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, name. Default: createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: status |

**Response 200 OK** — Paginated location requests

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].addressText` | string \| null | yes |  |
| `data[].city` | "KUALA_LUMPUR" \| "MELAKA" \| null | yes |  |
| `data[].code` | string | yes |  |
| `data[].contactPhone` | string \| null | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isPrimary` | boolean | yes |  |
| `data[].name` | string | yes |  |
| `data[].organizationDisplayName` | string | yes |  |
| `data[].organizationId` | string (uuid) | yes |  |
| `data[].organizationSlug` | string | yes | length 2–64; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `data[].rejectionReason` | string \| null | yes |  |
| `data[].requestedByUserId` | string (uuid) \| null | yes |  |
| `data[].status` | "PENDING_APPROVAL" \| "ACTIVE" \| "REJECTED" \| "INACTIVE" | yes |  |
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
GET /api/v1/admin/location-requests
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "a392fbb5-7761-4bdf-9b4a-7dfb5ed94c2a",
      "organizationId": "b57401d5-536e-464f-9ae9-4756b6dd5f61",
      "organizationSlug": "jonker-street-kitchen",
      "organizationDisplayName": "Jonker Street Kitchen",
      "name": "Jonker Street Kitchen — Taman Desa (Rejected)",
      "code": "taman-desa-rejected",
      "addressText": "5 Jalan Taman Desa, 75450 Melaka",
      "city": "MELAKA",
      "contactPhone": "+6062831111",
      "status": "REJECTED",
      "rejectionReason": "The address could not be matched to the SSM business registration. Resubmit with a utility bill for 5 Jalan Taman Desa.",
      "isPrimary": false,
      "requestedByUserId": "b9cda090-b9e8-42e4-b7b1-b6d00294f022",
      "createdAt": 1788249600000
    },
    {
      "id": "257401d5-536e-464f-9ae9-4756b6dd5f65",
      "organizationId": "b57401d5-536e-464f-9ae9-4756b6dd5f61",
      "organizationSlug": "jonker-street-kitchen",
      "organizationDisplayName": "Jonker Street Kitchen",
      "name": "Jonker Street Kitchen — Bukit Beruang",
      "code": "bukit-beruang",
      "addressText": "88 Jalan Bukit Beruang, 75450 Melaka",
      "city": "MELAKA",
      "contactPhone": "+6062815678",
      "status": "ACTIVE",
      "rejectionReason": null,
      "isPrimary": false,
      "requestedByUserId": "b9cda090-b9e8-42e4-b7b1-b6d00294f022",
      "createdAt": 1791193151223
    }
  ],
  "meta": {
    "limit": 50,
    "total": 3,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "fCXQ3mxWgdqmjRNIqcnTf",
    "timestamp": 1791193329522
  }
}
```

### GET /api/v1/admin/merchants

List merchant organizations

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminMerchantsController_listMerchants` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt, displayName. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: city, kybStatus, status |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** — Paginated merchant org list

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].addressText` | string \| null | yes |  |
| `data[].businessName` | string | yes |  |
| `data[].category` | string | yes |  |
| `data[].city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `data[].contactEmail` | string | yes |  |
| `data[].contactPhone` | string \| null | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data[].id` | string (uuid) | yes |  |
| `data[].isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data[].kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |
| `data[].legalName` | string \| null | yes |  |
| `data[].ownerUserId` | string (uuid) \| null | no |  |
| `data[].status` | "ONBOARDING" \| "ACTIVE" \| "SUSPENDED" | yes |  |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/merchants?limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1791193151217,
      "updatedAt": 1791193151217,
      "isDeleted": false,
      "deletedAt": null,
      "id": "b57401d5-536e-464f-9ae9-4756b6dd5f61",
      "businessName": "Jonker Street Kitchen",
      "legalName": "Jonker Kitchen Melaka",
      "category": "restaurant",
      "addressText": "12 Jalan Bukit Katil, 75450 Melaka",
      "city": "MELAKA",
      "kybStatus": "PENDING",
      "status": "ACTIVE",
      "contactEmail": "jonker.owner@melaka-rewards.demo",
      "contactPhone": "+6062812345",
      "ownerUserId": "b9cda090-b9e8-42e4-b7b1-b6d00294f022"
    },
    {
      "createdAt": 1791193151201,
      "updatedAt": 1791193151201,
      "isDeleted": false,
      "deletedAt": null,
      "id": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "businessName": "Brew & Bean KL",
      "legalName": "Brew & Bean KL Sdn Bhd",
      "category": "cafe",
      "addressText": "12 Jalan Bukit Bintang, Kuala Lumpur",
      "city": "KUALA_LUMPUR",
      "kybStatus": "APPROVED",
      "status": "ACTIVE",
      "contactEmail": "brew.owner@kl-rewards.demo",
      "contactPhone": "+60321456789",
      "ownerUserId": "326494e1-b45d-4203-b881-05b60ae50b4a"
    }
  ],
  "meta": {
    "limit": 2,
    "total": 3,
    "page": 1,
    "totalPages": 2,
    "nextCursor": "eyJhdCI6MTc5MTE5MzE1MTIwMSwiaWQiOiJhMTc4YTRkMS02OTE1LTRlYjMtYmY4NC02ZmIxNGUxZmViNmMifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "Os1cKGZemDi-lUOESlYLp",
    "timestamp": 1791193329449
  }
}
```

### GET /api/v1/admin/merchants/{organizationId}

Get merchant organization detail for KYB review

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminMerchantsController_getMerchant` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `organizationId` | path | string (uuid) | yes |  |

**Response 200 OK** — Merchant org detail with KYB payload

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.addressText` | string \| null | yes |  |
| `data.businessName` | string | yes |  |
| `data.category` | string | yes |  |
| `data.city` | "KUALA_LUMPUR" \| "MELAKA" | yes |  |
| `data.contactEmail` | string | yes |  |
| `data.contactPhone` | string \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.documents` | object[] | yes |  |
| `data.documents[].fileName` | string | yes | length 1–255 |
| `data.documents[].id` | string (uuid) | yes |  |
| `data.documents[].mimeType` | "application/pdf" \| "image/jpeg" \| "image/png" \| "image/webp" \| "image/avif" | yes |  |
| `data.documents[].scanStatus` | "SCANNING" \| "CLEAN" \| "NOT_SCANNED" \| "INFECTED" \| "SCAN_FAILED" | yes |  |
| `data.documents[].sizeBytes` | integer | yes | range 0–26214400 |
| `data.documents[].uploadedAt` | integer | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.kybFields` | any JSON \| null | yes |  |
| `data.kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |
| `data.legalName` | string \| null | yes |  |
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
| `data.memberCount` | integer | yes |  |
| `data.ownerEmail` | string \| null | yes |  |
| `data.ownerFullName` | string \| null | yes |  |
| `data.ownerUserId` | string (uuid) \| null | yes |  |
| `data.status` | "ONBOARDING" \| "ACTIVE" \| "SUSPENDED" | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/merchants/a178a4d1-6915-4eb3-bf84-6fb14e1feb6c
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193151201,
    "updatedAt": 1791193151201,
    "isDeleted": false,
    "deletedAt": null,
    "id": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "businessName": "Brew & Bean KL",
    "legalName": "Brew & Bean KL Sdn Bhd",
    "category": "cafe",
    "addressText": "12 Jalan Bukit Bintang, Kuala Lumpur",
    "city": "KUALA_LUMPUR",
    "kybStatus": "APPROVED",
    "status": "ACTIVE",
    "contactEmail": "brew.owner@kl-rewards.demo",
    "contactPhone": "+60321456789",
    "ownerUserId": "326494e1-b45d-4203-b881-05b60ae50b4a",
    "kybFields": {
      "taxId": "C12345678",
      "registrationNo": "201901012345"
    },
    "documents": [
      {
        "id": "d1597799-9b05-49c8-95e1-864ddfa666a8",
        "fileName": "brew-bean-business-licence.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 69,
        "scanStatus": "SCANNING",
        "uploadedAt": 1789465153348
      }
    ],
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
        "createdAt": 1791193151207,
        "updatedAt": 1791193151207
      }
    ],
    "ownerEmail": "brew.owner@kl-rewards.demo",
    "ownerFullName": "Ahmad Brew",
    "memberCount": 3
  },
  "meta": {
    "correlationId": "QCw1OtZvM2KEsSoFi11zX",
    "timestamp": 1791193329484
  }
}
```

### GET /api/v1/admin/merchants/{organizationId}/documents/{documentId}/download

Get a short-lived signed download URL for a merchant KYB document

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminMerchantsController_downloadDocument` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `organizationId` | path | string (uuid) | yes |  |
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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/merchants/a178a4d1-6915-4eb3-bf84-6fb14e1feb6c/documents/d1597799-9b05-49c8-95e1-864ddfa666a8/download
X-Client-Type: admin
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
    "expiresAt": 1791193629504
  },
  "meta": {
    "correlationId": "E359Qq2C9jfCBlfH5QHKo",
    "timestamp": 1791193329504
  }
}
```

### PATCH /api/v1/admin/merchants/{organizationId}/kyb

Update merchant KYB status (REJECTED / ACTION_REQUIRED require kybFields.rejectionReason)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `MANAGE:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RewardsAdminMerchantsController_updateKyb` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `organizationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kybFields` | object | no |  |
| `kybFields.documentType` | string | no | length 1–100 |
| `kybFields.registrationNo` | string | no | length 1–100 |
| `kybFields.rejectionReason` | string | no | length 1–2000 |
| `kybFields.reviewNotes` | string | no | length 1–2000 |
| `kybFields.reviewedAt` | integer | no |  |
| `kybFields.submittedAt` | integer | no |  |
| `kybFields.taxId` | string | no | length 1–100 |
| `kybStatus` | "PENDING" \| "APPROVED" \| "REJECTED" \| "ACTION_REQUIRED" | yes |  |

**Response 200 OK** — KYB updated

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.ok` | true | yes | The action was accepted |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/admin/merchants/62cc685a-d679-4b51-8a57-2715674d1906/kyb
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "kybStatus": "APPROVED",
  "kybFields": {
    "reviewNotes": "SSM certificate matches the registered name"
  }
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "ok": true
  },
  "meta": {
    "correlationId": "XOSr6hrwgmZzaGnwb5bEQ",
    "timestamp": 1791193334854
  }
}
```

### POST /api/v1/admin/merchants/{organizationId}/locations

Create an organization store location

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `MANAGE:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RewardsAdminMerchantsController_createLocation` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `organizationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `addressText` | string | yes | length 1–2000 |
| `approveImmediately` | boolean | no | default `true` |
| `city` | "KUALA_LUMPUR" \| "MELAKA" | no |  |
| `contactPhone` | string | no | length 1–20 |
| `name` | string | yes | length 1–200 |

**Response 201 Created** — Organization location created

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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/merchants/a178a4d1-6915-4eb3-bf84-6fb14e1feb6c/locations
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Brew & Bean KL — Mid Valley",
  "addressText": "Lingkaran Syed Putra, Mid Valley City, 59200 Kuala Lumpur",
  "city": "KUALA_LUMPUR",
  "approveImmediately": true
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "6cbdc605-bea0-4d7b-bb73-209d1812064b",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "name": "Brew & Bean KL — Mid Valley",
    "code": "brew-bean-kl-mid-valley",
    "addressText": "Lingkaran Syed Putra, Mid Valley City, 59200 Kuala Lumpur",
    "city": "KUALA_LUMPUR",
    "contactPhone": null,
    "status": "ACTIVE",
    "rejectionReason": null,
    "isPrimary": false,
    "createdAt": 1791193335079,
    "updatedAt": 1791193335079
  },
  "meta": {
    "correlationId": "FJgsR-WDQykRjAqvIRfIv",
    "timestamp": 1791193335085
  }
}
```

### PATCH /api/v1/admin/merchants/{organizationId}/locations/{locationId}/review

Approve or reject an organization store location request

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `MANAGE:MERCHANT_ORG`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RewardsAdminMerchantsController_reviewLocation` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `organizationId` | path | string (uuid) | yes |  |
| `locationId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `approve` | boolean | yes |  |
| `rejectionReason` | string | no | length 1–2000 |

**Response 200 OK** — Organization location reviewed

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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/admin/merchants/a178a4d1-6915-4eb3-bf84-6fb14e1feb6c/locations/7856bea1-dcf7-4112-81e4-5e91034ef1ed/review
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "approve": false,
  "rejectionReason": "Add the unit number to the address"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "7856bea1-dcf7-4112-81e4-5e91034ef1ed",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "name": "Brew & Bean KL — Bangsar",
    "code": "brew-bean-kl-bangsar",
    "addressText": "21 Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur",
    "city": "KUALA_LUMPUR",
    "contactPhone": "+60 3-2283 1234",
    "status": "REJECTED",
    "rejectionReason": "Add the unit number to the address",
    "isPrimary": false,
    "createdAt": 1791193334906,
    "updatedAt": 1791193334941
  },
  "meta": {
    "correlationId": "CeszNt0Uv5HK6bJDJEKdD",
    "timestamp": 1791193334947
  }
}
```

### POST /api/v1/admin/rewards/{rewardId}/approve

Approve a pending reward (no body required)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `MANAGE:REWARD`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RewardsAdminRewardsController_approveReward` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `rewardId` | path | string (uuid) | yes |  |

**Request body** (`application/json`)

_No fields._

**Response 201 Created** — Approved reward

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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/rewards/f88793c9-c817-46be-a9cb-d86b77e861bb/approve
X-Client-Type: admin
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
    "correlationId": "H6Ifq3e5LvOL8k-5eLs-e",
    "timestamp": 1791193338364
  }
}
```

### POST /api/v1/admin/rewards/{rewardId}/reject

Reject a pending reward

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `MANAGE:REWARD`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RewardsAdminRewardsController_rejectReward` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `rewardId` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | no | at most 2000 characters |
| `rewardId` | string (uuid) | yes |  |

**Response 201 Created** — Reward returned to draft

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
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/rewards/c3a98194-259f-4357-a73e-8cc933eb4e87/reject
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "rewardId": "c3a98194-259f-4357-a73e-8cc933eb4e87",
  "reason": "Add the participating stores and the daily limit to the terms"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193338412,
    "updatedAt": 1791193338412,
    "isDeleted": false,
    "deletedAt": null,
    "id": "c3a98194-259f-4357-a73e-8cc933eb4e87",
    "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
    "organizationName": "Brew & Bean KL",
    "organizationLogoUrl": null,
    "title": "Buy one get one Iced Latte",
    "description": "One free Kopi O when you order any breakfast set at Brew & Bean KL.",
    "rewardType": "BOGO",
    "rewardValue": 13,
    "termsConditions": null,
    "rewardKind": "CONSUMER",
    "category": "cafe",
    "placeholderImageKey": "category-cafe",
    "quantityTotal": 200,
    "quantityRemaining": 200,
    "quantityReserved": 0,
    "startDate": 1791193338104,
    "expiryDate": 1796377338104,
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
    "correlationId": "OPtzoK-2qtKz7Z8UNAy1j",
    "timestamp": 1791193338457
  }
}
```

### GET /api/v1/admin/rewards/pending

List rewards pending moderation (oldest first, paginated)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `MANAGE:REWARD`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `RewardsAdminRewardsController_listPendingRewards` · [source](../../../apps/api/src/modules/rewards/controllers/rewards-admin.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: none |

**Response 200 OK** — One page of pending rewards

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
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/rewards/pending
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1791193151316,
      "updatedAt": 1791193151316,
      "isDeleted": false,
      "deletedAt": null,
      "id": "c25c75db-a700-499b-9649-dc965aa21264",
      "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
      "organizationName": "Brew & Bean KL",
      "organizationLogoUrl": null,
      "title": "20% off weekend brunch",
      "description": "Awaiting admin moderation or auto-publish.",
      "rewardType": "DISCOUNT",
      "rewardValue": 0,
      "termsConditions": null,
      "rewardKind": "CONSUMER",
      "category": "cafe",
      "placeholderImageKey": "category-cafe",
      "quantityTotal": 80,
      "quantityRemaining": 80,
      "quantityReserved": 0,
      "startDate": null,
      "expiryDate": 1793785151314,
      "status": "PENDING_REVIEW",
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
      "status": "PENDING_REVIEW",
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
    }
  ],
  "meta": {
    "limit": 10,
    "total": 2,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "v2mZ9zu_QVum0Bbx2JgAY",
    "timestamp": 1791193338326
  }
}
```
