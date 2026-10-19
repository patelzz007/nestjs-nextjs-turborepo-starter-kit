---
title: "API reference — Sample catalog (products and categories)"
description: "The reference CRUD modules every new feature copies: list/detail/create/update/soft delete/restore/bulk."
order: 13
author: "Generated from the OpenAPI export"
lastUpdated: 1792368000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

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
      "createdAt": 1791917114087,
      "updatedAt": 1792435514086
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
      "createdAt": 1791830714087,
      "updatedAt": 1792435514086
    }
  ],
  "meta": {
    "limit": 2,
    "total": 71,
    "page": 1,
    "totalPages": 36,
    "nextCursor": "eyJjcmVhdGVkQXQiOjE3OTE4MzA3MTQwODcsImlkIjoiMDE5Yjc2ZGEtYTgwMC03MDM2LWI4MDItMDcxMmM5ZWM1YzBmIn0",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "0w5sgb2mH02zgTr8zssJn",
    "timestamp": 1792435597243
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
    "id": "01a1557c-affe-7339-9c15-5bc561770ccc",
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
    "createdAt": 1792435597306,
    "updatedAt": 1792435597306
  },
  "meta": {
    "correlationId": "CgJxNjK_llJxf0KZwhBK3",
    "timestamp": 1792435597316
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
    "createdAt": 1791917114087,
    "updatedAt": 1792435514086
  },
  "meta": {
    "correlationId": "0KixPQtyjs_V75XiaPbaF",
    "timestamp": 1792435597273
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
PATCH /api/v1/product/01a1557c-affe-7339-9c15-5bc561770ccc
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
    "id": "01a1557c-affe-7339-9c15-5bc561770ccc",
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
    "createdAt": 1792435597306,
    "updatedAt": 1792435597353
  },
  "meta": {
    "correlationId": "bqbkdrzzdWox_NeqGKbrq",
    "timestamp": 1792435597365
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
DELETE /api/v1/product/01a1557c-affe-7339-9c15-5bc561770ccc
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
    "correlationId": "Tura2x8YOflclFKaNdsUW",
    "timestamp": 1792435597401
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
POST /api/v1/product/01a1557c-affe-7339-9c15-5bc561770ccc/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a1557c-affe-7339-9c15-5bc561770ccc",
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
    "createdAt": 1792435597306,
    "updatedAt": 1792435597484
  },
  "meta": {
    "correlationId": "7OXdixJ_JFoepE0ZKmDsf",
    "timestamp": 1792435597489
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
      "id": "01a1557c-b0d4-72d9-aec0-41fab7fa0b33",
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
      "createdAt": 1792435597522,
      "updatedAt": 1792435597522
    }
  ],
  "meta": {
    "correlationId": "uLkadJHR3eJvt4X15jziN",
    "timestamp": 1792435597528
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
    "01a1557c-affe-7339-9c15-5bc561770ccc",
    "01a1557c-b0d4-72d9-aec0-41fab7fa0b33"
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
    "correlationId": "LcCPNJ89jrDdIxklzjkPC",
    "timestamp": 1792435597560
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
      "createdAt": 1790621114024,
      "updatedAt": 1792435514023
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
      "createdAt": 1790534714024,
      "updatedAt": 1792435514023
    }
  ],
  "meta": {
    "limit": 2,
    "total": 70,
    "page": 1,
    "totalPages": 35,
    "nextCursor": "eyJjcmVhdGVkQXQiOjE3OTA1MzQ3MTQwMjQsImlkIjoiMDE5Yjc2ZGEtYTgwMC03YTg0LWJhZWItMGFkZTJkMjU3YzhkIn0",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "QOe8ucD_POAcHjOs6mavA",
    "timestamp": 1792435596926
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
    "id": "01a1557c-aec3-73b7-810a-775b7e8c1807",
    "description": "Curated pet supplies — collection 5 for the demo storefront.",
    "isActive": true,
    "name": "Pet Supplies — Collection 5 Archive",
    "slug": "pet-supplies-collection-5-archive",
    "sortOrder": 0,
    "version": 0,
    "deletedAt": null,
    "createdAt": 1792435596995,
    "updatedAt": 1792435596995
  },
  "meta": {
    "correlationId": "_PwlC84624Ly-tZ8JMaFY",
    "timestamp": 1792435596999
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
    "createdAt": 1790621114024,
    "updatedAt": 1792435514023
  },
  "meta": {
    "correlationId": "H-cWj6d5YqgK1N4f0a7rm",
    "timestamp": 1792435596970
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
PATCH /api/v1/sample-category/01a1557c-aec3-73b7-810a-775b7e8c1807
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
    "id": "01a1557c-aec3-73b7-810a-775b7e8c1807",
    "description": "Curated pet supplies — collection 5 for the demo storefront.",
    "isActive": false,
    "name": "Pet Supplies — Collection 5 Archive",
    "slug": "pet-supplies-collection-5-archive",
    "sortOrder": 0,
    "version": 1,
    "deletedAt": null,
    "createdAt": 1792435596995,
    "updatedAt": 1792435597045
  },
  "meta": {
    "correlationId": "TKJ3v662riq02ZZe5V26N",
    "timestamp": 1792435597049
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
DELETE /api/v1/sample-category/01a1557c-aec3-73b7-810a-775b7e8c1807
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
    "correlationId": "cMb6-oOVSliIiWfC5LwjN",
    "timestamp": 1792435597082
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
POST /api/v1/sample-category/01a1557c-aec3-73b7-810a-775b7e8c1807/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": "01a1557c-aec3-73b7-810a-775b7e8c1807",
    "description": "Curated pet supplies — collection 5 for the demo storefront.",
    "isActive": false,
    "name": "Pet Supplies — Collection 5 Archive",
    "slug": "pet-supplies-collection-5-archive",
    "sortOrder": 0,
    "version": 1,
    "deletedAt": null,
    "createdAt": 1792435596995,
    "updatedAt": 1792435597116
  },
  "meta": {
    "correlationId": "k09dpuodeKnu2K5lZP0Ng",
    "timestamp": 1792435597121
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
      "id": "01a1557c-af6e-73be-bbe3-594ca7f6b544",
      "description": null,
      "isActive": true,
      "name": "Health & Wellness — Collection 5 Archive",
      "slug": "health-and-wellness-collection-5-archive",
      "sortOrder": 0,
      "version": 0,
      "deletedAt": null,
      "createdAt": 1792435597163,
      "updatedAt": 1792435597163
    }
  ],
  "meta": {
    "correlationId": "dTs8l-pDauPhrFLhEbj4x",
    "timestamp": 1792435597169
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
    "01a1557c-aec3-73b7-810a-775b7e8c1807",
    "01a1557c-af6e-73be-bbe3-594ca7f6b544"
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
    "correlationId": "zpiUR8zLm18bUikerbVey",
    "timestamp": 1792435597209
  }
}
```
