---
title: "API reference — Sample catalog (products and categories)"
description: "The reference CRUD modules every new feature copies: list/detail/create/update/soft delete/restore/bulk."
order: 13
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Sample catalog (products and categories)

The reference CRUD modules every new feature copies: list/detail/create/update/soft delete/restore/bulk.

How these endpoints fit together: [Golden reference implementations](../../../rules/24-golden-reference-implementations.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Product

### GET /api/v1/product

List Products

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:PRODUCT`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ProductController_list` · [source](../../../apps/api/src/contexts/catalog/presentation/http/product.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: name, price, compareAtPrice, sku, slug, stockQuantity, createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: isActive, isFeatured, categoryId, brand, price, stockQuantity, createdAt |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — Paginated list of products

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].brand` | string \| null | yes |  |
| `data[].categoryId` | string (uuid) | yes |  |
| `data[].compareAtPrice` | number \| null | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].deletedAt` | integer \| null | yes |  |
| `data[].description` | string \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].imageUrl` | string \| null | yes |  |
| `data[].isActive` | boolean | yes |  |
| `data[].isFeatured` | boolean | yes |  |
| `data[].name` | string | yes |  |
| `data[].price` | number | yes |  |
| `data[].shortDescription` | string \| null | yes |  |
| `data[].sku` | string | yes |  |
| `data[].slug` | string | yes |  |
| `data[].stockQuantity` | integer | yes | min -9007199254740991 |
| `data[].updatedAt` | integer | yes |  |
| `data[].version` | integer | yes |  |
| `data[].weightGrams` | integer \| null | yes | min -9007199254740991 |
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
GET /api/v1/product?limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "019b76da-a800-7091-8df2-0f6d4f883841",
      "brand": "FreshField",
      "categoryId": "019b76da-a800-74d1-86c3-d6127e984dc7",
      "compareAtPrice": null,
      "description": "Full description for Demo Product 070. Designed for admin list, search, and pagination demos across categories and inventory.",
      "imageUrl": null,
      "isActive": true,
      "isFeatured": false,
      "name": "Demo Product 070",
      "price": 156.99,
      "shortDescription": "FreshField demo listing #70 for pagination testing.",
      "sku": "SKU-0070",
      "slug": "demo-product-070",
      "stockQuantity": 233,
      "weightGrams": 845,
      "version": 0,
      "deletedAt": null,
      "createdAt": 1792672385289,
      "updatedAt": 1793190785288
    },
    {
      "id": "019b76da-a800-7036-b802-0712c9ec5c0f",
      "brand": "UrbanThread",
      "categoryId": "019b76da-a800-7a84-baeb-0ade2d257c8d",
      "compareAtPrice": 167.49,
      "description": "Full description for Demo Product 069. Designed for admin list, search, and pagination demos across categories and inventory.",
      "imageUrl": null,
      "isActive": true,
      "isFeatured": false,
      "name": "Demo Product 069",
      "price": 152.49,
      "shortDescription": "UrbanThread demo listing #69 for pagination testing.",
      "sku": "SKU-0069",
      "slug": "demo-product-069",
      "stockQuantity": 226,
      "weightGrams": 820,
      "version": 2,
      "deletedAt": null,
      "createdAt": 1792585985289,
      "updatedAt": 1793190785288
    }
  ],
  "meta": {
    "limit": 2,
    "total": 71,
    "page": 1,
    "totalPages": 36,
    "nextCursor": "eyJjcmVhdGVkQXQiOjE3OTI1ODU5ODUyODksImlkIjoiMDE5Yjc2ZGEtYTgwMC03MDM2LWI4MDItMDcxMmM5ZWM1YzBmIn0",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "yOsTlGCicMfec45u_uEKK",
    "timestamp": 1793190875992
  }
}
```

### POST /api/v1/product

Create Product (send an Idempotency-Key header to make retries safe)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `CREATE:PRODUCT`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ProductController_create` · [source](../../../apps/api/src/contexts/catalog/presentation/http/product.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `Idempotency-Key` | header | string | no | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `brand` | string \| null | no |  |
| `categoryId` | string (uuid) | yes |  |
| `compareAtPrice` | number \| null | no | range 0–999999999999.99 |
| `description` | string \| null | no |  |
| `imageUrl` | string (uri) \| null | no | at most 2048 characters |
| `isActive` | boolean | no |  |
| `isFeatured` | boolean | no |  |
| `name` | string | yes |  |
| `price` | number | yes | range 0–999999999999.99 |
| `shortDescription` | string \| null | no |  |
| `sku` | string | yes | length 1–64; pattern `^[A-Za-z0-9][A-Za-z0-9._-]*$` |
| `slug` | string | yes | length 1–200; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `stockQuantity` | integer | no |  |
| `weightGrams` | integer \| null | no |  |

**Response 201 Created** (`application/json`) — Created product

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.brand` | string \| null | yes |  |
| `data.categoryId` | string (uuid) | yes |  |
| `data.compareAtPrice` | number \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.deletedAt` | integer \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.imageUrl` | string \| null | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isFeatured` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.price` | number | yes |  |
| `data.shortDescription` | string \| null | yes |  |
| `data.sku` | string | yes |  |
| `data.slug` | string | yes |  |
| `data.stockQuantity` | integer | yes | min -9007199254740991 |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes |  |
| `data.weightGrams` | integer \| null | yes | min -9007199254740991 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/product
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Demo Product 070 (Bundle)",
  "slug": "demo-product-070-bundle",
  "sku": "SKU-0070-B",
  "price": 156.99,
  "categoryId": "019b76da-a800-74d1-86c3-d6127e984dc7"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-53a3-732a-a911-acd0fb3466a2",
    "brand": null,
    "categoryId": "019b76da-a800-74d1-86c3-d6127e984dc7",
    "compareAtPrice": null,
    "description": null,
    "imageUrl": null,
    "isActive": true,
    "isFeatured": false,
    "name": "Demo Product 070 (Bundle)",
    "price": 156.99,
    "shortDescription": null,
    "sku": "SKU-0070-B",
    "slug": "demo-product-070-bundle",
    "stockQuantity": 0,
    "weightGrams": null,
    "version": 0,
    "deletedAt": null,
    "createdAt": 1793190876057,
    "updatedAt": 1793190876057
  },
  "meta": {
    "correlationId": "jDXkmLbvspjjvlBGfACa5",
    "timestamp": 1793190876074
  }
}
```

### GET /api/v1/product/{id}

Get Product by id

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PRODUCT`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ProductController_get` · [source](../../../apps/api/src/contexts/catalog/presentation/http/product.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Product detail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.brand` | string \| null | yes |  |
| `data.categoryId` | string (uuid) | yes |  |
| `data.compareAtPrice` | number \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.deletedAt` | integer \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.imageUrl` | string \| null | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isFeatured` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.price` | number | yes |  |
| `data.shortDescription` | string \| null | yes |  |
| `data.sku` | string | yes |  |
| `data.slug` | string | yes |  |
| `data.stockQuantity` | integer | yes | min -9007199254740991 |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes |  |
| `data.weightGrams` | integer \| null | yes | min -9007199254740991 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/product/019b76da-a800-7091-8df2-0f6d4f883841
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "019b76da-a800-7091-8df2-0f6d4f883841",
    "brand": "FreshField",
    "categoryId": "019b76da-a800-74d1-86c3-d6127e984dc7",
    "compareAtPrice": null,
    "description": "Full description for Demo Product 070. Designed for admin list, search, and pagination demos across categories and inventory.",
    "imageUrl": null,
    "isActive": true,
    "isFeatured": false,
    "name": "Demo Product 070",
    "price": 156.99,
    "shortDescription": "FreshField demo listing #70 for pagination testing.",
    "sku": "SKU-0070",
    "slug": "demo-product-070",
    "stockQuantity": 233,
    "weightGrams": 845,
    "version": 0,
    "deletedAt": null,
    "createdAt": 1792672385289,
    "updatedAt": 1793190785288
  },
  "meta": {
    "correlationId": "y5fQtkDu4mvrwSCcl0b5g",
    "timestamp": 1793190876032
  }
}
```

### PATCH /api/v1/product/{id}

Update Product

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PRODUCT`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ProductController_update` · [source](../../../apps/api/src/contexts/catalog/presentation/http/product.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `brand` | string \| null | no |  |
| `categoryId` | string (uuid) | no |  |
| `compareAtPrice` | number \| null | no | range 0–999999999999.99 |
| `description` | string \| null | no |  |
| `imageUrl` | string (uri) \| null | no | at most 2048 characters |
| `isActive` | boolean | no |  |
| `isFeatured` | boolean | no |  |
| `name` | string | no |  |
| `price` | number | no | range 0–999999999999.99 |
| `shortDescription` | string \| null | no |  |
| `sku` | string | no | length 1–64; pattern `^[A-Za-z0-9][A-Za-z0-9._-]*$` |
| `slug` | string | no | length 1–200; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `stockQuantity` | integer | no |  |
| `version` | integer | yes | The product `version` this edit is based on (optimistic lock) |
| `weightGrams` | integer \| null | no |  |

**Response 200 OK** (`application/json`) — Updated product

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.brand` | string \| null | yes |  |
| `data.categoryId` | string (uuid) | yes |  |
| `data.compareAtPrice` | number \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.deletedAt` | integer \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.imageUrl` | string \| null | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isFeatured` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.price` | number | yes |  |
| `data.shortDescription` | string \| null | yes |  |
| `data.sku` | string | yes |  |
| `data.slug` | string | yes |  |
| `data.stockQuantity` | integer | yes | min -9007199254740991 |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes |  |
| `data.weightGrams` | integer \| null | yes | min -9007199254740991 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/product/01a18281-53a3-732a-a911-acd0fb3466a2
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "isFeatured": true,
  "version": 0
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-53a3-732a-a911-acd0fb3466a2",
    "brand": null,
    "categoryId": "019b76da-a800-74d1-86c3-d6127e984dc7",
    "compareAtPrice": null,
    "description": null,
    "imageUrl": null,
    "isActive": true,
    "isFeatured": true,
    "name": "Demo Product 070 (Bundle)",
    "price": 156.99,
    "shortDescription": null,
    "sku": "SKU-0070-B",
    "slug": "demo-product-070-bundle",
    "stockQuantity": 0,
    "weightGrams": null,
    "version": 1,
    "deletedAt": null,
    "createdAt": 1793190876057,
    "updatedAt": 1793190876106
  },
  "meta": {
    "correlationId": "pRLqPpCZ0t-QChXPH6Mb7",
    "timestamp": 1793190876114
  }
}
```

### DELETE /api/v1/product/{id}

Soft delete Product

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `DELETE:PRODUCT`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ProductController_delete` · [source](../../../apps/api/src/contexts/catalog/presentation/http/product.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Product deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.success` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/product/01a18281-53a3-732a-a911-acd0fb3466a2
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "success": true
  },
  "meta": {
    "correlationId": "MspK8oQ0QbWuQGBBBq0WY",
    "timestamp": 1793190876145
  }
}
```

### POST /api/v1/product/{id}/restore

Restore Product

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PRODUCT`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `ProductController_restore` · [source](../../../apps/api/src/contexts/catalog/presentation/http/product.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Restored product

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.brand` | string \| null | yes |  |
| `data.categoryId` | string (uuid) | yes |  |
| `data.compareAtPrice` | number \| null | yes |  |
| `data.createdAt` | integer | yes |  |
| `data.deletedAt` | integer \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.imageUrl` | string \| null | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isFeatured` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.price` | number | yes |  |
| `data.shortDescription` | string \| null | yes |  |
| `data.sku` | string | yes |  |
| `data.slug` | string | yes |  |
| `data.stockQuantity` | integer | yes | min -9007199254740991 |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes |  |
| `data.weightGrams` | integer \| null | yes | min -9007199254740991 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/product/01a18281-53a3-732a-a911-acd0fb3466a2/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-53a3-732a-a911-acd0fb3466a2",
    "brand": null,
    "categoryId": "019b76da-a800-74d1-86c3-d6127e984dc7",
    "compareAtPrice": null,
    "description": null,
    "imageUrl": null,
    "isActive": true,
    "isFeatured": true,
    "name": "Demo Product 070 (Bundle)",
    "price": 156.99,
    "shortDescription": null,
    "sku": "SKU-0070-B",
    "slug": "demo-product-070-bundle",
    "stockQuantity": 0,
    "weightGrams": null,
    "version": 1,
    "deletedAt": null,
    "createdAt": 1793190876057,
    "updatedAt": 1793190876168
  },
  "meta": {
    "correlationId": "PB_VTNJ-7A6ei9W8_Ha_c",
    "timestamp": 1793190876176
  }
}
```

### POST /api/v1/product/bulk

Bulk create products

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `CREATE:PRODUCT`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ProductController_bulkCreate` · [source](../../../apps/api/src/contexts/catalog/presentation/http/product.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `items` | object[] | yes | 1–100 items |
| `items[].brand` | string \| null | no |  |
| `items[].categoryId` | string (uuid) | yes |  |
| `items[].compareAtPrice` | number \| null | no | range 0–999999999999.99 |
| `items[].description` | string \| null | no |  |
| `items[].imageUrl` | string (uri) \| null | no | at most 2048 characters |
| `items[].isActive` | boolean | no |  |
| `items[].isFeatured` | boolean | no |  |
| `items[].name` | string | yes |  |
| `items[].price` | number | yes | range 0–999999999999.99 |
| `items[].shortDescription` | string \| null | no |  |
| `items[].sku` | string | yes | length 1–64; pattern `^[A-Za-z0-9][A-Za-z0-9._-]*$` |
| `items[].slug` | string | yes | length 1–200; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `items[].stockQuantity` | integer | no |  |
| `items[].weightGrams` | integer \| null | no |  |

**Response 201 Created** (`application/json`) — Created products

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].brand` | string \| null | yes |  |
| `data[].categoryId` | string (uuid) | yes |  |
| `data[].compareAtPrice` | number \| null | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].deletedAt` | integer \| null | yes |  |
| `data[].description` | string \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].imageUrl` | string \| null | yes |  |
| `data[].isActive` | boolean | yes |  |
| `data[].isFeatured` | boolean | yes |  |
| `data[].name` | string | yes |  |
| `data[].price` | number | yes |  |
| `data[].shortDescription` | string \| null | yes |  |
| `data[].sku` | string | yes |  |
| `data[].slug` | string | yes |  |
| `data[].stockQuantity` | integer | yes | min -9007199254740991 |
| `data[].updatedAt` | integer | yes |  |
| `data[].version` | integer | yes |  |
| `data[].weightGrams` | integer \| null | yes | min -9007199254740991 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/product/bulk
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "items": [
    {
      "name": "Demo Product 069 (Bundle)",
      "slug": "demo-product-069-bundle",
      "sku": "SKU-0069-B",
      "price": 152.49,
      "categoryId": "019b76da-a800-7a84-baeb-0ade2d257c8d"
    }
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "01a18281-542c-7246-bee6-b07d60a8e69e",
      "brand": null,
      "categoryId": "019b76da-a800-7a84-baeb-0ade2d257c8d",
      "compareAtPrice": null,
      "description": null,
      "imageUrl": null,
      "isActive": true,
      "isFeatured": false,
      "name": "Demo Product 069 (Bundle)",
      "price": 152.49,
      "shortDescription": null,
      "sku": "SKU-0069-B",
      "slug": "demo-product-069-bundle",
      "stockQuantity": 0,
      "weightGrams": null,
      "version": 0,
      "deletedAt": null,
      "createdAt": 1793190876201,
      "updatedAt": 1793190876201
    }
  ],
  "meta": {
    "correlationId": "pTVEfu9E_v7QeW_YU-bnm",
    "timestamp": 1793190876210
  }
}
```

### POST /api/v1/product/bulk-delete

Bulk soft delete products

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `DELETE:PRODUCT`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `ProductController_bulkDelete` · [source](../../../apps/api/src/contexts/catalog/presentation/http/product.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ids` | string (uuid)[] | yes | 1–100 items |

**Response 201 Created** (`application/json`) — Bulk delete result

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.deletedCount` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/product/bulk-delete
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "ids": [
    "01a18281-53a3-732a-a911-acd0fb3466a2",
    "01a18281-542c-7246-bee6-b07d60a8e69e"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "deletedCount": 2
  },
  "meta": {
    "correlationId": "qP33DUH54QX5mWVFdQ_QO",
    "timestamp": 1793190876246
  }
}
```

## SampleCategory

### GET /api/v1/sample-category

List SampleCategories

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:SAMPLE_CATEGORY`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SampleCategoryController_list` · [source](../../../apps/api/src/contexts/catalog/presentation/http/sample-category.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: name, slug, sortOrder, createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: isActive, createdAt |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — Paginated list of samplecategories

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].deletedAt` | integer \| null | yes |  |
| `data[].description` | string \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isActive` | boolean | yes |  |
| `data[].name` | string | yes |  |
| `data[].slug` | string | yes |  |
| `data[].sortOrder` | integer | yes | min -9007199254740991 |
| `data[].updatedAt` | integer | yes |  |
| `data[].version` | integer | yes |  |
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
GET /api/v1/sample-category?limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "019b76da-a800-74d1-86c3-d6127e984dc7",
      "description": "Curated pet supplies — collection 5 for the demo storefront.",
      "isActive": true,
      "name": "Pet Supplies — Collection 5",
      "slug": "pet-supplies-collection-5",
      "sortOrder": 70,
      "version": 0,
      "deletedAt": null,
      "createdAt": 1791376385010,
      "updatedAt": 1793190785009
    },
    {
      "id": "019b76da-a800-7a84-baeb-0ade2d257c8d",
      "description": "Curated health & wellness — collection 5 for the demo storefront.",
      "isActive": true,
      "name": "Health & Wellness — Collection 5",
      "slug": "health-and-wellness-collection-5",
      "sortOrder": 69,
      "version": 0,
      "deletedAt": null,
      "createdAt": 1791289985010,
      "updatedAt": 1793190785009
    }
  ],
  "meta": {
    "limit": 2,
    "total": 70,
    "page": 1,
    "totalPages": 35,
    "nextCursor": "eyJjcmVhdGVkQXQiOjE3OTEyODk5ODUwMTAsImlkIjoiMDE5Yjc2ZGEtYTgwMC03YTg0LWJhZWItMGFkZTJkMjU3YzhkIn0",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "5HYtQHYt_8MF1LT58V5MB",
    "timestamp": 1793190875690
  }
}
```

### POST /api/v1/sample-category

Create SampleCategory

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `CREATE:SAMPLE_CATEGORY`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Idempotent: send an `Idempotency-Key` header; a retry with the same key replays the first response.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SampleCategoryController_create` · [source](../../../apps/api/src/contexts/catalog/presentation/http/sample-category.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `Idempotency-Key` | header | string | no | Client-generated key (8–128 chars of [A-Za-z0-9._:-], e.g. a UUID), scoped to the caller, tenant and endpoint. An identical retry within 24h replays the stored response (`Idempotent-Replayed: true`); a different request with the same key → 409 IDEMPOTENCY_KEY_REUSED; a concurrent duplicate waits up to 5 s for the first request and replays its response (or runs, if the first one failed), else 409 IDEMPOTENCY_REQUEST_IN_PROGRESS; a non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE. |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string \| null | no |  |
| `isActive` | boolean | no |  |
| `name` | string | yes |  |
| `slug` | string | yes | length 1–200; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `sortOrder` | integer | no |  |

**Response 201 Created** (`application/json`) — Created samplecategory

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.deletedAt` | integer \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.slug` | string | yes |  |
| `data.sortOrder` | integer | yes | min -9007199254740991 |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/sample-category
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Pet Supplies — Collection 5 Archive",
  "slug": "pet-supplies-collection-5-archive",
  "description": "Curated pet supplies — collection 5 for the demo storefront."
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-525c-7570-911a-42d093216a58",
    "description": "Curated pet supplies — collection 5 for the demo storefront.",
    "isActive": true,
    "name": "Pet Supplies — Collection 5 Archive",
    "slug": "pet-supplies-collection-5-archive",
    "sortOrder": 0,
    "version": 0,
    "deletedAt": null,
    "createdAt": 1793190875740,
    "updatedAt": 1793190875740
  },
  "meta": {
    "correlationId": "kpO4TXIn_m2GcGTGl6OR2",
    "timestamp": 1793190875745
  }
}
```

### GET /api/v1/sample-category/{id}

Get SampleCategory by id

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:SAMPLE_CATEGORY`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SampleCategoryController_get` · [source](../../../apps/api/src/contexts/catalog/presentation/http/sample-category.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — SampleCategory detail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.deletedAt` | integer \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.slug` | string | yes |  |
| `data.sortOrder` | integer | yes | min -9007199254740991 |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/sample-category/019b76da-a800-74d1-86c3-d6127e984dc7
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "019b76da-a800-74d1-86c3-d6127e984dc7",
    "description": "Curated pet supplies — collection 5 for the demo storefront.",
    "isActive": true,
    "name": "Pet Supplies — Collection 5",
    "slug": "pet-supplies-collection-5",
    "sortOrder": 70,
    "version": 0,
    "deletedAt": null,
    "createdAt": 1791376385010,
    "updatedAt": 1793190785009
  },
  "meta": {
    "correlationId": "yczf-_J8QFyxHgLXYTmCQ",
    "timestamp": 1793190875717
  }
}
```

### PATCH /api/v1/sample-category/{id}

Update SampleCategory

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:SAMPLE_CATEGORY`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SampleCategoryController_update` · [source](../../../apps/api/src/contexts/catalog/presentation/http/sample-category.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string \| null | no |  |
| `isActive` | boolean | no |  |
| `name` | string | no |  |
| `slug` | string | no | length 1–200; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `sortOrder` | integer | no |  |
| `version` | integer | yes | The category `version` this edit is based on (optimistic lock) |

**Response 200 OK** (`application/json`) — Updated samplecategory

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.deletedAt` | integer \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.slug` | string | yes |  |
| `data.sortOrder` | integer | yes | min -9007199254740991 |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/sample-category/01a18281-525c-7570-911a-42d093216a58
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "isActive": false,
  "version": 0
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-525c-7570-911a-42d093216a58",
    "description": "Curated pet supplies — collection 5 for the demo storefront.",
    "isActive": false,
    "name": "Pet Supplies — Collection 5 Archive",
    "slug": "pet-supplies-collection-5-archive",
    "sortOrder": 0,
    "version": 1,
    "deletedAt": null,
    "createdAt": 1793190875740,
    "updatedAt": 1793190875780
  },
  "meta": {
    "correlationId": "lhTYMV4FVbPTAQ4Vs2jK8",
    "timestamp": 1793190875787
  }
}
```

### DELETE /api/v1/sample-category/{id}

Soft delete SampleCategory

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `DELETE:SAMPLE_CATEGORY`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SampleCategoryController_delete` · [source](../../../apps/api/src/contexts/catalog/presentation/http/sample-category.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — SampleCategory deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.success` | true | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/sample-category/01a18281-525c-7570-911a-42d093216a58
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "success": true
  },
  "meta": {
    "correlationId": "G3WszAWJUaDEF-kRbyGBW",
    "timestamp": 1793190875828
  }
}
```

### POST /api/v1/sample-category/{id}/restore

Restore SampleCategory

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:SAMPLE_CATEGORY`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `SampleCategoryController_restore` · [source](../../../apps/api/src/contexts/catalog/presentation/http/sample-category.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Restored samplecategory

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes |  |
| `data.deletedAt` | integer \| null | yes |  |
| `data.description` | string \| null | yes |  |
| `data.id` | string (uuid) | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.name` | string | yes |  |
| `data.slug` | string | yes |  |
| `data.sortOrder` | integer | yes | min -9007199254740991 |
| `data.updatedAt` | integer | yes |  |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/sample-category/01a18281-525c-7570-911a-42d093216a58/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a18281-525c-7570-911a-42d093216a58",
    "description": "Curated pet supplies — collection 5 for the demo storefront.",
    "isActive": false,
    "name": "Pet Supplies — Collection 5 Archive",
    "slug": "pet-supplies-collection-5-archive",
    "sortOrder": 0,
    "version": 1,
    "deletedAt": null,
    "createdAt": 1793190875740,
    "updatedAt": 1793190875863
  },
  "meta": {
    "correlationId": "dxbxS7sgt-PXkvO9w-myy",
    "timestamp": 1793190875873
  }
}
```

### POST /api/v1/sample-category/bulk

Bulk create samplecategories

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `CREATE:SAMPLE_CATEGORY`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SampleCategoryController_bulkCreate` · [source](../../../apps/api/src/contexts/catalog/presentation/http/sample-category.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `items` | object[] | yes | 1–100 items |
| `items[].description` | string \| null | no |  |
| `items[].isActive` | boolean | no |  |
| `items[].name` | string | yes |  |
| `items[].slug` | string | yes | length 1–200; pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `items[].sortOrder` | integer | no |  |

**Response 201 Created** (`application/json`) — Created samplecategories

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].createdAt` | integer | yes |  |
| `data[].deletedAt` | integer \| null | yes |  |
| `data[].description` | string \| null | yes |  |
| `data[].id` | string (uuid) | yes |  |
| `data[].isActive` | boolean | yes |  |
| `data[].name` | string | yes |  |
| `data[].slug` | string | yes |  |
| `data[].sortOrder` | integer | yes | min -9007199254740991 |
| `data[].updatedAt` | integer | yes |  |
| `data[].version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/sample-category/bulk
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "items": [
    {
      "name": "Health & Wellness — Collection 5 Archive",
      "slug": "health-and-wellness-collection-5-archive"
    }
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "01a18281-52fd-739c-a93a-742a116d7d69",
      "description": null,
      "isActive": true,
      "name": "Health & Wellness — Collection 5 Archive",
      "slug": "health-and-wellness-collection-5-archive",
      "sortOrder": 0,
      "version": 0,
      "deletedAt": null,
      "createdAt": 1793190875901,
      "updatedAt": 1793190875901
    }
  ],
  "meta": {
    "correlationId": "p5Pl696CRhfUVxvc_lsGA",
    "timestamp": 1793190875906
  }
}
```

### POST /api/v1/sample-category/bulk-delete

Bulk soft delete samplecategories

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `DELETE:SAMPLE_CATEGORY`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `SampleCategoryController_bulkDelete` · [source](../../../apps/api/src/contexts/catalog/presentation/http/sample-category.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ids` | string (uuid)[] | yes | 1–100 items |

**Response 201 Created** (`application/json`) — Bulk delete result

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.deletedCount` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/sample-category/bulk-delete
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "ids": [
    "01a18281-525c-7570-911a-42d093216a58",
    "01a18281-52fd-739c-a93a-742a116d7d69"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "deletedCount": 2
  },
  "meta": {
    "correlationId": "6zisfkxfxc9i_5B4HSdWB",
    "timestamp": 1793190875956
  }
}
```
