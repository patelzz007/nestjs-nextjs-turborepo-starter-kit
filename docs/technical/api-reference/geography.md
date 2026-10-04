---
title: "API reference — Geography reference data"
description: "Regions, subregions, countries, states and cities: CRUD, autocomplete, import and export."
order: 10
author: "Generated from the OpenAPI export"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Geography reference data

Regions, subregions, countries, states and cities: CRUD, autocomplete, import and export.

How these endpoints fit together: [List query grammar](../api/list-queries.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Geo

### GET /api/v1/geo/autocomplete

Autocomplete search across all geo entities

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_autocomplete` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `q` | query | string | yes | Search query |
| `country` | query | string | no | ISO 3166-1 alpha-2 country code to scope results |
| `limit` | query | integer | no | Max results (1-20) |

**Response 200 OK** — Matching geo items

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].countryCode` | string \| null | no |  |
| `data[].emoji` | string \| null | no |  |
| `data[].entityType` | "region" \| "subregion" \| "country" \| "state" \| "city" | yes |  |
| `data[].id` | integer | yes |  |
| `data[].latitude` | number \| null | no |  |
| `data[].longitude` | number \| null | no |  |
| `data[].name` | string | yes |  |
| `data[].stateCode` | string \| null | no |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/autocomplete?q=Melaka&limit=3
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [],
  "meta": {
    "correlationId": "jLE3WqtkivMyPVfZPQOFZ",
    "timestamp": 1791099725172
  }
}
```

### GET /api/v1/geo/cascade-preview

Preview cascade delete impact

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_cascadePreview` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `entity` | query | "region" \| "subregion" \| "country" \| "state" | yes | Entity type (region, subregion, country, state) |
| `id` | query | integer | yes | Entity ID |

**Response 200 OK** — Cascade preview with affected entity counts

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.entity` | string | yes |  |
| `data.id` | number | yes |  |
| `data.name` | string | yes |  |
| `data.willDelete` | object | yes |  |
| `data.willDelete.cities` | number \| null | no |  |
| `data.willDelete.countries` | number \| null | no |  |
| `data.willDelete.states` | number \| null | no |  |
| `data.willDelete.subregions` | number \| null | no |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/cascade-preview?entity=state&id=2485
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "entity": "state",
    "id": 2485,
    "name": "Johor",
    "willDelete": {
      "cities": 31
    }
  },
  "meta": {
    "correlationId": "IGYXWynxaEZ6JsLKZDD-D",
    "timestamp": 1791099725190
  }
}
```

### GET /api/v1/geo/cities

List cities

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_listCities` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: id, name, countryCode, stateCode. Default: id |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: id, stateId, countryId, countryCode, stateCode, flag |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |
| `include` | query | string | no | Comma-separated related entities to include (e.g. states,cities) |

**Response 200 OK** — Paginated list of cities

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].country` | object | no |  |
| `data[].country.capital` | string \| null | yes |  |
| `data[].country.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].country.currency` | string \| null | yes |  |
| `data[].country.currencyName` | string \| null | yes |  |
| `data[].country.currencySymbol` | string \| null | yes |  |
| `data[].country.emoji` | string \| null | yes |  |
| `data[].country.emojiU` | string \| null | yes |  |
| `data[].country.flag` | boolean | yes |  |
| `data[].country.gdp` | number \| null | yes |  |
| `data[].country.id` | integer | yes |  |
| `data[].country.iso2` | string \| null | yes |  |
| `data[].country.iso3` | string \| null | yes |  |
| `data[].country.latitude` | number \| null | yes |  |
| `data[].country.longitude` | number \| null | yes |  |
| `data[].country.name` | string | yes |  |
| `data[].country.nationality` | string \| null | yes |  |
| `data[].country.native` | string \| null | yes |  |
| `data[].country.numericCode` | string \| null | yes |  |
| `data[].country.phonecode` | string \| null | yes |  |
| `data[].country.population` | number \| null | yes |  |
| `data[].country.region` | string \| null | yes |  |
| `data[].country.regionId` | integer \| null | yes |  |
| `data[].country.subregion` | string \| null | yes |  |
| `data[].country.subregionId` | integer \| null | yes |  |
| `data[].country.timezones` | any JSON \| null | yes |  |
| `data[].country.tld` | string \| null | yes |  |
| `data[].country.translations` | any JSON \| null | yes |  |
| `data[].country.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].country.wikiDataId` | string \| null | yes |  |
| `data[].countryCode` | string | yes |  |
| `data[].countryId` | integer | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].flag` | boolean | yes |  |
| `data[].id` | integer | yes |  |
| `data[].latitude` | number | yes |  |
| `data[].longitude` | number | yes |  |
| `data[].name` | string | yes |  |
| `data[].native` | string \| null | yes |  |
| `data[].state` | object | no |  |
| `data[].state.countryCode` | string | yes |  |
| `data[].state.countryId` | integer | yes |  |
| `data[].state.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].state.fipsCode` | string \| null | yes |  |
| `data[].state.flag` | boolean | yes |  |
| `data[].state.id` | integer | yes |  |
| `data[].state.iso2` | string \| null | yes |  |
| `data[].state.iso3166_2` | string \| null | yes |  |
| `data[].state.latitude` | number \| null | yes |  |
| `data[].state.level` | integer \| null | yes | min -9007199254740991 |
| `data[].state.longitude` | number \| null | yes |  |
| `data[].state.name` | string | yes |  |
| `data[].state.native` | string \| null | yes |  |
| `data[].state.parentId` | integer \| null | yes |  |
| `data[].state.timezone` | string \| null | yes |  |
| `data[].state.translations` | any JSON \| null | yes |  |
| `data[].state.type` | string \| null | yes |  |
| `data[].state.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].state.wikiDataId` | string \| null | yes |  |
| `data[].stateCode` | string | yes |  |
| `data[].stateId` | integer | yes |  |
| `data[].timezone` | string \| null | yes |  |
| `data[].translations` | any JSON \| null | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].wikiDataId` | string \| null | yes |  |
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
GET /api/v1/geo/cities?filter%5BcountryCode%5D=MY&sort=name&limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": 71051,
      "name": "Alor Gajah",
      "stateCode": "04",
      "countryCode": "MY",
      "latitude": 2.3804,
      "longitude": 102.2089,
      "native": null,
      "timezone": "Asia/Kuala_Lumpur",
      "translations": null,
      "wikiDataId": null,
      "flag": true,
      "stateId": 2490,
      "countryId": 130,
      "createdAt": 1388577661000,
      "updatedAt": 1791099660000
    },
    {
      "id": 71028,
      "name": "Alor Setar",
      "stateCode": "02",
      "countryCode": "MY",
      "latitude": 6.12104,
      "longitude": 100.36014,
      "native": null,
      "timezone": "Asia/Kuala_Lumpur",
      "translations": null,
      "wikiDataId": null,
      "flag": true,
      "stateId": 2486,
      "countryId": 130,
      "createdAt": 1388577661000,
      "updatedAt": 1791099660000
    }
  ],
  "meta": {
    "limit": 2,
    "total": 223,
    "page": 1,
    "totalPages": 112,
    "nextCursor": null,
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "ZUtsaZhnfCuXZk9haaoj3",
    "timestamp": 1791099725092
  }
}
```

### POST /api/v1/geo/cities

Create a city

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_createCity` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `countryCode` | string | yes | exactly 2 characters |
| `countryId` | integer | yes |  |
| `flag` | boolean | no | default `true` |
| `latitude` | number | yes | range -90–90 |
| `longitude` | number | yes | range -180–180 |
| `name` | string | yes | length 1–255 |
| `native` | string | no | at most 255 characters |
| `stateCode` | string | yes | at most 255 characters |
| `stateId` | integer | yes |  |
| `timezone` | string | no | at most 255 characters |
| `translations` | any JSON | no |  |
| `wikiDataId` | string | no | at most 255 characters |

**Response 201 Created** — Created city

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countryCode` | string | yes |  |
| `data.countryId` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.latitude` | number | yes |  |
| `data.longitude` | number | yes |  |
| `data.name` | string | yes |  |
| `data.native` | string \| null | yes |  |
| `data.stateCode` | string | yes |  |
| `data.stateId` | integer | yes |  |
| `data.timezone` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/geo/cities
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Alor Gajah (copy)",
  "stateId": 5257,
  "stateCode": "01",
  "countryId": 252,
  "countryCode": "MY",
  "latitude": 2.3804,
  "longitude": 102.2089
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 153315,
    "name": "Alor Gajah (copy)",
    "stateCode": "01",
    "countryCode": "MY",
    "latitude": 2.3804,
    "longitude": 102.2089,
    "native": null,
    "timezone": null,
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "stateId": 5257,
    "countryId": 252,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "QTywYlaNkhco_-V_VWqJ2",
    "timestamp": 1791099725447
  }
}
```

### GET /api/v1/geo/cities/{id}

Get city by ID

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_getCity` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — City detail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countryCode` | string | yes |  |
| `data.countryId` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.latitude` | number | yes |  |
| `data.longitude` | number | yes |  |
| `data.name` | string | yes |  |
| `data.native` | string \| null | yes |  |
| `data.stateCode` | string | yes |  |
| `data.stateId` | integer | yes |  |
| `data.timezone` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/cities/71051
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 71051,
    "name": "Alor Gajah",
    "stateCode": "04",
    "countryCode": "MY",
    "latitude": 2.3804,
    "longitude": 102.2089,
    "native": null,
    "timezone": "Asia/Kuala_Lumpur",
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "stateId": 2490,
    "countryId": 130,
    "createdAt": 1388577661000,
    "updatedAt": 1791099660000
  },
  "meta": {
    "correlationId": "EPho25SSyAMZOcWlcb6JC",
    "timestamp": 1791099725107
  }
}
```

### PATCH /api/v1/geo/cities/{id}

Update a city

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `UPDATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_updateCity` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `countryCode` | string | no | exactly 2 characters |
| `countryId` | integer | no |  |
| `flag` | boolean | no |  |
| `latitude` | number | no | range -90–90 |
| `longitude` | number | no | range -180–180 |
| `name` | string | no | length 1–255 |
| `native` | string \| null | no | at most 255 characters |
| `stateCode` | string | no | at most 255 characters |
| `stateId` | integer | no |  |
| `timezone` | string \| null | no | at most 255 characters |
| `translations` | any JSON \| null | no |  |
| `wikiDataId` | string \| null | no | at most 255 characters |

**Response 200 OK** — Updated city

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countryCode` | string | yes |  |
| `data.countryId` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.latitude` | number | yes |  |
| `data.longitude` | number | yes |  |
| `data.name` | string | yes |  |
| `data.native` | string \| null | yes |  |
| `data.stateCode` | string | yes |  |
| `data.stateId` | integer | yes |  |
| `data.timezone` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/geo/cities/153315
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "timezone": "Asia/Kuala_Lumpur"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 153315,
    "name": "Alor Gajah (copy)",
    "stateCode": "01",
    "countryCode": "MY",
    "latitude": 2.3804,
    "longitude": 102.2089,
    "native": null,
    "timezone": "Asia/Kuala_Lumpur",
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "stateId": 5257,
    "countryId": 252,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "07OtqAOzTkt-LgPnd0ASR",
    "timestamp": 1791099725472
  }
}
```

### DELETE /api/v1/geo/cities/{id}

Delete a city

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `DELETE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_deleteCity` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — City deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/geo/cities/153315
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "City #153315 deleted"
  },
  "meta": {
    "correlationId": "qUHEPOXPKlg9FBpUhFJAx",
    "timestamp": 1791099725490
  }
}
```

### GET /api/v1/geo/countries

List countries

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_listCountries` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: id, name, iso2. Default: id |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: id, iso2, regionId, subregionId, flag |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |
| `include` | query | string | no | Comma-separated related entities to include (e.g. states,cities) |

**Response 200 OK** — Paginated list of countries

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].capital` | string \| null | yes |  |
| `data[].cities` | object[] | no |  |
| `data[].cities[].countryCode` | string | yes |  |
| `data[].cities[].countryId` | integer | yes |  |
| `data[].cities[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].cities[].flag` | boolean | yes |  |
| `data[].cities[].id` | integer | yes |  |
| `data[].cities[].latitude` | number | yes |  |
| `data[].cities[].longitude` | number | yes |  |
| `data[].cities[].name` | string | yes |  |
| `data[].cities[].native` | string \| null | yes |  |
| `data[].cities[].stateCode` | string | yes |  |
| `data[].cities[].stateId` | integer | yes |  |
| `data[].cities[].timezone` | string \| null | yes |  |
| `data[].cities[].translations` | any JSON \| null | yes |  |
| `data[].cities[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].cities[].wikiDataId` | string \| null | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].currency` | string \| null | yes |  |
| `data[].currencyName` | string \| null | yes |  |
| `data[].currencySymbol` | string \| null | yes |  |
| `data[].emoji` | string \| null | yes |  |
| `data[].emojiU` | string \| null | yes |  |
| `data[].flag` | boolean | yes |  |
| `data[].gdp` | number \| null | yes |  |
| `data[].id` | integer | yes |  |
| `data[].iso2` | string \| null | yes |  |
| `data[].iso3` | string \| null | yes |  |
| `data[].latitude` | number \| null | yes |  |
| `data[].longitude` | number \| null | yes |  |
| `data[].name` | string | yes |  |
| `data[].nationality` | string \| null | yes |  |
| `data[].native` | string \| null | yes |  |
| `data[].numericCode` | string \| null | yes |  |
| `data[].phonecode` | string \| null | yes |  |
| `data[].population` | number \| null | yes |  |
| `data[].region` | string \| null | yes |  |
| `data[].regionId` | integer \| null | yes |  |
| `data[].regionRelation` | object \| null | no |  |
| `data[].regionRelation.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].regionRelation.flag` | boolean | yes |  |
| `data[].regionRelation.id` | integer | yes |  |
| `data[].regionRelation.name` | string | yes |  |
| `data[].regionRelation.translations` | any JSON \| null | yes |  |
| `data[].regionRelation.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].regionRelation.wikiDataId` | string \| null | yes |  |
| `data[].states` | object[] | no |  |
| `data[].states[].countryCode` | string | yes |  |
| `data[].states[].countryId` | integer | yes |  |
| `data[].states[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].states[].fipsCode` | string \| null | yes |  |
| `data[].states[].flag` | boolean | yes |  |
| `data[].states[].id` | integer | yes |  |
| `data[].states[].iso2` | string \| null | yes |  |
| `data[].states[].iso3166_2` | string \| null | yes |  |
| `data[].states[].latitude` | number \| null | yes |  |
| `data[].states[].level` | integer \| null | yes | min -9007199254740991 |
| `data[].states[].longitude` | number \| null | yes |  |
| `data[].states[].name` | string | yes |  |
| `data[].states[].native` | string \| null | yes |  |
| `data[].states[].parentId` | integer \| null | yes |  |
| `data[].states[].timezone` | string \| null | yes |  |
| `data[].states[].translations` | any JSON \| null | yes |  |
| `data[].states[].type` | string \| null | yes |  |
| `data[].states[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].states[].wikiDataId` | string \| null | yes |  |
| `data[].subregion` | string \| null | yes |  |
| `data[].subregionId` | integer \| null | yes |  |
| `data[].subregionRelation` | object \| null | no |  |
| `data[].subregionRelation.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].subregionRelation.flag` | boolean | yes |  |
| `data[].subregionRelation.id` | integer | yes |  |
| `data[].subregionRelation.name` | string | yes |  |
| `data[].subregionRelation.regionId` | integer | yes |  |
| `data[].subregionRelation.translations` | any JSON \| null | yes |  |
| `data[].subregionRelation.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].subregionRelation.wikiDataId` | string \| null | yes |  |
| `data[].timezones` | any JSON \| null | yes |  |
| `data[].tld` | string \| null | yes |  |
| `data[].translations` | any JSON \| null | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].wikiDataId` | string \| null | yes |  |
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
GET /api/v1/geo/countries?filter%5Biso2%5D=MY&limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": 130,
      "name": "Malaysia",
      "iso3": "MYS",
      "numericCode": "458",
      "iso2": "MY",
      "phonecode": "60",
      "capital": "Kuala Lumpur",
      "currency": "MYR",
      "currencyName": "Malaysian ringgit",
      "currencySymbol": "RM",
      "tld": ".my",
      "native": "Malaysia",
      "population": 34231700,
      "gdp": 444984,
      "region": "Asia",
      "subregion": "South-Eastern Asia",
      "nationality": "Malaysian",
      "timezones": [
        {
          "tzName": "Malaysia Time",
          "zoneName": "Asia/Kuala_Lumpur",
          "gmtOffset": 28800,
          "abbreviation": "MYT",
          "gmtOffsetName": "UTC+08:00"
        },
        {
          "tzName": "Malaysia Time",
          "zoneName": "Asia/Kuching",
          "gmtOffset": 28800,
          "abbreviation": "MYT",
          "gmtOffsetName": "UTC+08:00"
        }
      ],
      "translations": {
        "ar": "ماليزيا",
        "br": "Malaysia",
        "de": "Malaysia",
        "es": "Malasia",
        "fa": "مالزی",
        "fr": "Malaisie",
        "hi": "मलेशिया",
        "hr": "Malezija",
        "it": "Malesia",
        "ja": "マレーシア",
        "ko": "말레이시아",
        "nl": "Maleisië",
        "pl": "Malezja",
        "pt": "Malásia",
        "ru": "Малайзия",
        "tr": "Malezya",
        "uk": "Малайзія",
        "pt-BR": "Malásia",
        "zh-CN": "马来西亚"
      },
      "latitude": 2.5,
      "longitude": 112.5,
      "emoji": "🇲🇾",
      "emojiU": "U+1F1F2 U+1F1FE",
      "wikiDataId": "Q833",
      "flag": true,
      "regionId": 3,
      "subregionId": 16,
      "createdAt": 1388577661000,
      "updatedAt": 1791099644000
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
    "correlationId": "8vBs_Bk6k5S8CZCr9ntnS",
    "timestamp": 1791099724926
  }
}
```

### POST /api/v1/geo/countries

Create a country

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_createCountry` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `capital` | string | no | at most 255 characters |
| `currency` | string | no | at most 255 characters |
| `currencyName` | string | no | at most 255 characters |
| `currencySymbol` | string | no | at most 255 characters |
| `emoji` | string | no | at most 191 characters |
| `emojiU` | string | no | at most 191 characters |
| `flag` | boolean | no | default `true` |
| `gdp` | integer | no |  |
| `iso2` | string | no | exactly 2 characters |
| `iso3` | string | no | exactly 3 characters |
| `latitude` | number | no | range -90–90 |
| `longitude` | number | no | range -180–180 |
| `name` | string | yes | length 1–255 |
| `nationality` | string | no | at most 255 characters |
| `native` | string | no | at most 255 characters |
| `numericCode` | string | no | exactly 3 characters |
| `phonecode` | string | no | at most 255 characters |
| `population` | integer | no |  |
| `region` | string | no | at most 255 characters |
| `regionId` | integer \| null | no |  |
| `subregion` | string | no | at most 255 characters |
| `subregionId` | integer \| null | no |  |
| `timezones` | any JSON | no |  |
| `tld` | string | no | at most 255 characters |
| `translations` | any JSON | no |  |
| `wikiDataId` | string | no | at most 255 characters |

**Response 201 Created** — Created country

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.capital` | string \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.currency` | string \| null | yes |  |
| `data.currencyName` | string \| null | yes |  |
| `data.currencySymbol` | string \| null | yes |  |
| `data.emoji` | string \| null | yes |  |
| `data.emojiU` | string \| null | yes |  |
| `data.flag` | boolean | yes |  |
| `data.gdp` | number \| null | yes |  |
| `data.id` | integer | yes |  |
| `data.iso2` | string \| null | yes |  |
| `data.iso3` | string \| null | yes |  |
| `data.latitude` | number \| null | yes |  |
| `data.longitude` | number \| null | yes |  |
| `data.name` | string | yes |  |
| `data.nationality` | string \| null | yes |  |
| `data.native` | string \| null | yes |  |
| `data.numericCode` | string \| null | yes |  |
| `data.phonecode` | string \| null | yes |  |
| `data.population` | number \| null | yes |  |
| `data.region` | string \| null | yes |  |
| `data.regionId` | integer \| null | yes |  |
| `data.subregion` | string \| null | yes |  |
| `data.subregionId` | integer \| null | yes |  |
| `data.timezones` | any JSON \| null | yes |  |
| `data.tld` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/geo/countries
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Malaysia (copy)",
  "regionId": 8,
  "subregionId": 24
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 252,
    "name": "Malaysia (copy)",
    "iso3": null,
    "numericCode": null,
    "iso2": null,
    "phonecode": null,
    "capital": null,
    "currency": null,
    "currencyName": null,
    "currencySymbol": null,
    "tld": null,
    "native": null,
    "population": null,
    "gdp": null,
    "region": null,
    "subregion": null,
    "nationality": null,
    "timezones": null,
    "translations": null,
    "latitude": null,
    "longitude": null,
    "emoji": null,
    "emojiU": null,
    "wikiDataId": null,
    "flag": true,
    "regionId": 8,
    "subregionId": 24,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "i1adWcvjBy-saUUFO6hzZ",
    "timestamp": 1791099725350
  }
}
```

### GET /api/v1/geo/countries/{id}

Get country by ID

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_getCountry` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — Country detail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.capital` | string \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.currency` | string \| null | yes |  |
| `data.currencyName` | string \| null | yes |  |
| `data.currencySymbol` | string \| null | yes |  |
| `data.emoji` | string \| null | yes |  |
| `data.emojiU` | string \| null | yes |  |
| `data.flag` | boolean | yes |  |
| `data.gdp` | number \| null | yes |  |
| `data.id` | integer | yes |  |
| `data.iso2` | string \| null | yes |  |
| `data.iso3` | string \| null | yes |  |
| `data.latitude` | number \| null | yes |  |
| `data.longitude` | number \| null | yes |  |
| `data.name` | string | yes |  |
| `data.nationality` | string \| null | yes |  |
| `data.native` | string \| null | yes |  |
| `data.numericCode` | string \| null | yes |  |
| `data.phonecode` | string \| null | yes |  |
| `data.population` | number \| null | yes |  |
| `data.region` | string \| null | yes |  |
| `data.regionId` | integer \| null | yes |  |
| `data.subregion` | string \| null | yes |  |
| `data.subregionId` | integer \| null | yes |  |
| `data.timezones` | any JSON \| null | yes |  |
| `data.tld` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/countries/130
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 130,
    "name": "Malaysia",
    "iso3": "MYS",
    "numericCode": "458",
    "iso2": "MY",
    "phonecode": "60",
    "capital": "Kuala Lumpur",
    "currency": "MYR",
    "currencyName": "Malaysian ringgit",
    "currencySymbol": "RM",
    "tld": ".my",
    "native": "Malaysia",
    "population": 34231700,
    "gdp": 444984,
    "region": "Asia",
    "subregion": "South-Eastern Asia",
    "nationality": "Malaysian",
    "timezones": [
      {
        "tzName": "Malaysia Time",
        "zoneName": "Asia/Kuala_Lumpur",
        "gmtOffset": 28800,
        "abbreviation": "MYT",
        "gmtOffsetName": "UTC+08:00"
      },
      {
        "tzName": "Malaysia Time",
        "zoneName": "Asia/Kuching",
        "gmtOffset": 28800,
        "abbreviation": "MYT",
        "gmtOffsetName": "UTC+08:00"
      }
    ],
    "translations": {
      "ar": "ماليزيا",
      "br": "Malaysia",
      "de": "Malaysia",
      "es": "Malasia",
      "fa": "مالزی",
      "fr": "Malaisie",
      "hi": "मलेशिया",
      "hr": "Malezija",
      "it": "Malesia",
      "ja": "マレーシア",
      "ko": "말레이시아",
      "nl": "Maleisië",
      "pl": "Malezja",
      "pt": "Malásia",
      "ru": "Малайзия",
      "tr": "Malezya",
      "uk": "Малайзія",
      "pt-BR": "Malásia",
      "zh-CN": "马来西亚"
    },
    "latitude": 2.5,
    "longitude": 112.5,
    "emoji": "🇲🇾",
    "emojiU": "U+1F1F2 U+1F1FE",
    "wikiDataId": "Q833",
    "flag": true,
    "regionId": 3,
    "subregionId": 16,
    "createdAt": 1388577661000,
    "updatedAt": 1791099644000
  },
  "meta": {
    "correlationId": "UI06CcUyQuDjWhnW6znwj",
    "timestamp": 1791099724942
  }
}
```

### PATCH /api/v1/geo/countries/{id}

Update a country

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `UPDATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_updateCountry` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `capital` | string \| null | no | at most 255 characters |
| `currency` | string \| null | no | at most 255 characters |
| `currencyName` | string \| null | no | at most 255 characters |
| `currencySymbol` | string \| null | no | at most 255 characters |
| `emoji` | string \| null | no | at most 191 characters |
| `emojiU` | string \| null | no | at most 191 characters |
| `flag` | boolean | no |  |
| `gdp` | integer \| null | no |  |
| `iso2` | string | no | exactly 2 characters |
| `iso3` | string | no | exactly 3 characters |
| `latitude` | number \| null | no | range -90–90 |
| `longitude` | number \| null | no | range -180–180 |
| `name` | string | no | length 1–255 |
| `nationality` | string \| null | no | at most 255 characters |
| `native` | string \| null | no | at most 255 characters |
| `numericCode` | string \| null | no | exactly 3 characters |
| `phonecode` | string \| null | no | at most 255 characters |
| `population` | integer \| null | no |  |
| `region` | string \| null | no | at most 255 characters |
| `regionId` | integer \| null | no |  |
| `subregion` | string \| null | no | at most 255 characters |
| `subregionId` | integer \| null | no |  |
| `timezones` | any JSON \| null | no |  |
| `tld` | string \| null | no | at most 255 characters |
| `translations` | any JSON \| null | no |  |
| `wikiDataId` | string \| null | no | at most 255 characters |

**Response 200 OK** — Updated country

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.capital` | string \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.currency` | string \| null | yes |  |
| `data.currencyName` | string \| null | yes |  |
| `data.currencySymbol` | string \| null | yes |  |
| `data.emoji` | string \| null | yes |  |
| `data.emojiU` | string \| null | yes |  |
| `data.flag` | boolean | yes |  |
| `data.gdp` | number \| null | yes |  |
| `data.id` | integer | yes |  |
| `data.iso2` | string \| null | yes |  |
| `data.iso3` | string \| null | yes |  |
| `data.latitude` | number \| null | yes |  |
| `data.longitude` | number \| null | yes |  |
| `data.name` | string | yes |  |
| `data.nationality` | string \| null | yes |  |
| `data.native` | string \| null | yes |  |
| `data.numericCode` | string \| null | yes |  |
| `data.phonecode` | string \| null | yes |  |
| `data.population` | number \| null | yes |  |
| `data.region` | string \| null | yes |  |
| `data.regionId` | integer \| null | yes |  |
| `data.subregion` | string \| null | yes |  |
| `data.subregionId` | integer \| null | yes |  |
| `data.timezones` | any JSON \| null | yes |  |
| `data.tld` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/geo/countries/252
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "capital": "Kuala Lumpur"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 252,
    "name": "Malaysia (copy)",
    "iso3": null,
    "numericCode": null,
    "iso2": null,
    "phonecode": null,
    "capital": "Kuala Lumpur",
    "currency": null,
    "currencyName": null,
    "currencySymbol": null,
    "tld": null,
    "native": null,
    "population": null,
    "gdp": null,
    "region": null,
    "subregion": null,
    "nationality": null,
    "timezones": null,
    "translations": null,
    "latitude": null,
    "longitude": null,
    "emoji": null,
    "emojiU": null,
    "wikiDataId": null,
    "flag": true,
    "regionId": 8,
    "subregionId": 24,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "AxeZZZALfUGHc8WqGlBzJ",
    "timestamp": 1791099725376
  }
}
```

### DELETE /api/v1/geo/countries/{id}

Delete a country

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `DELETE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_deleteCountry` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — Country deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/geo/countries/252
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Country #252 deleted"
  },
  "meta": {
    "correlationId": "0Z5q9alTjVYWaq59y7WJk",
    "timestamp": 1791099725530
  }
}
```

### GET /api/v1/geo/export

Export the cities of the matching countries (rows are always JSON; `format=csv` is not rendered server-side)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_exportData` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `format` | query | "json" \| "csv" | no | Export format (json or csv) |
| `countryCode` | query | string | no | Filter by ISO 3166-1 alpha-2 country code |
| `regionId` | query | integer | no | Filter by region ID |

**Response 200 OK** — City rows of every country matching countryCode / regionId

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].countryCode` | string | yes |  |
| `data[].countryId` | integer | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].flag` | boolean | yes |  |
| `data[].id` | integer | yes |  |
| `data[].latitude` | number | yes |  |
| `data[].longitude` | number | yes |  |
| `data[].name` | string | yes |  |
| `data[].native` | string \| null | yes |  |
| `data[].stateCode` | string | yes |  |
| `data[].stateId` | integer | yes |  |
| `data[].timezone` | string \| null | yes |  |
| `data[].translations` | any JSON \| null | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/export?format=json&countryCode=MY
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": 71051,
      "name": "Alor Gajah",
      "stateCode": "04",
      "countryCode": "MY",
      "latitude": 2.3804,
      "longitude": 102.2089,
      "native": null,
      "timezone": "Asia/Kuala_Lumpur",
      "translations": null,
      "wikiDataId": null,
      "flag": true,
      "stateId": 2490,
      "countryId": 130,
      "createdAt": 1388577661000,
      "updatedAt": 1791099660000
    },
    {
      "id": 71028,
      "name": "Alor Setar",
      "stateCode": "02",
      "countryCode": "MY",
      "latitude": 6.12104,
      "longitude": 100.36014,
      "native": null,
      "timezone": "Asia/Kuala_Lumpur",
      "translations": null,
      "wikiDataId": null,
      "flag": true,
      "stateId": 2486,
      "countryId": 130,
      "createdAt": 1388577661000,
      "updatedAt": 1791099660000
    }
  ],
  "meta": {
    "correlationId": "10nQa3ksJpokwerqCW10O",
    "timestamp": 1791099725211
  }
}
```

### POST /api/v1/geo/import

Bulk import geo data

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:GEO`.
- **Policy** `CREATE:GEO` — Import geo data.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_importData` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes | 1–10000 items |
| `entity` | "region" \| "subregion" \| "country" \| "state" \| "city" | yes |  |
| `upsert` | boolean | no | default `false` |

**Response 201 Created** — Import result with created/updated/skipped counts

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.created` | number | yes |  |
| `data.errors` | object[] | yes |  |
| `data.errors[].message` | string | yes |  |
| `data.errors[].row` | number | yes |  |
| `data.skipped` | number | yes |  |
| `data.updated` | number | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/geo/import
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "entity": "region",
  "data": [
    {
      "name": "Africa",
      "wikiDataId": "Q15"
    }
  ],
  "upsert": true
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "created": 0,
    "updated": 1,
    "skipped": 0,
    "errors": []
  },
  "meta": {
    "correlationId": "kNtmKA1eUxItBZ2b-fglg",
    "timestamp": 1791099725621
  }
}
```

### POST /api/v1/geo/import/validate

Validate geo import data without inserting

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_validateImport` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes | 1–10000 items |
| `entity` | "region" \| "subregion" \| "country" \| "state" \| "city" | yes |  |

**Response 201 Created** — Validation result with row-level errors

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.errors` | object[] | yes |  |
| `data.errors[].field` | string \| null | yes |  |
| `data.errors[].message` | string | yes |  |
| `data.errors[].row` | number | yes |  |
| `data.totalRows` | number | yes |  |
| `data.valid` | boolean | yes |  |
| `data.validRows` | number | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/geo/import/validate
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "entity": "region",
  "data": [
    {
      "name": "Africa",
      "wikiDataId": "Q15"
    }
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "valid": true,
    "totalRows": 1,
    "validRows": 1,
    "errors": []
  },
  "meta": {
    "correlationId": "4RarJD3i8ZbY9nVHlDR6o",
    "timestamp": 1791099725591
  }
}
```

### GET /api/v1/geo/regions

List regions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_listRegions` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: id, name. Default: id |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: id, flag |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |
| `include` | query | string | no | Comma-separated related entities to include (e.g. states,cities) |

**Response 200 OK** — Paginated list of regions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].countries` | object[] | no |  |
| `data[].countries[].capital` | string \| null | yes |  |
| `data[].countries[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].countries[].currency` | string \| null | yes |  |
| `data[].countries[].currencyName` | string \| null | yes |  |
| `data[].countries[].currencySymbol` | string \| null | yes |  |
| `data[].countries[].emoji` | string \| null | yes |  |
| `data[].countries[].emojiU` | string \| null | yes |  |
| `data[].countries[].flag` | boolean | yes |  |
| `data[].countries[].gdp` | number \| null | yes |  |
| `data[].countries[].id` | integer | yes |  |
| `data[].countries[].iso2` | string \| null | yes |  |
| `data[].countries[].iso3` | string \| null | yes |  |
| `data[].countries[].latitude` | number \| null | yes |  |
| `data[].countries[].longitude` | number \| null | yes |  |
| `data[].countries[].name` | string | yes |  |
| `data[].countries[].nationality` | string \| null | yes |  |
| `data[].countries[].native` | string \| null | yes |  |
| `data[].countries[].numericCode` | string \| null | yes |  |
| `data[].countries[].phonecode` | string \| null | yes |  |
| `data[].countries[].population` | number \| null | yes |  |
| `data[].countries[].region` | string \| null | yes |  |
| `data[].countries[].regionId` | integer \| null | yes |  |
| `data[].countries[].subregion` | string \| null | yes |  |
| `data[].countries[].subregionId` | integer \| null | yes |  |
| `data[].countries[].timezones` | any JSON \| null | yes |  |
| `data[].countries[].tld` | string \| null | yes |  |
| `data[].countries[].translations` | any JSON \| null | yes |  |
| `data[].countries[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].countries[].wikiDataId` | string \| null | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].flag` | boolean | yes |  |
| `data[].id` | integer | yes |  |
| `data[].name` | string | yes |  |
| `data[].subregions` | object[] | no |  |
| `data[].subregions[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].subregions[].flag` | boolean | yes |  |
| `data[].subregions[].id` | integer | yes |  |
| `data[].subregions[].name` | string | yes |  |
| `data[].subregions[].regionId` | integer | yes |  |
| `data[].subregions[].translations` | any JSON \| null | yes |  |
| `data[].subregions[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].subregions[].wikiDataId` | string \| null | yes |  |
| `data[].translations` | any JSON \| null | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].wikiDataId` | string \| null | yes |  |
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
GET /api/v1/geo/regions?limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Africa",
      "translations": {
        "br": "Afrika",
        "de": "Afrika",
        "es": "África",
        "fa": "آفریقا",
        "fr": "Afrique",
        "hr": "Afrika",
        "it": "Africa",
        "ja": "アフリカ",
        "ko": "아프리카",
        "nl": "Afrika",
        "pl": "Afryka",
        "pt": "África",
        "ru": "Африка",
        "tr": "Afrika",
        "uk": "Африка",
        "pt-BR": "África",
        "zh-CN": "非洲"
      },
      "wikiDataId": "Q15",
      "flag": true,
      "createdAt": 1388577661000,
      "updatedAt": 1791099643000
    },
    {
      "id": 2,
      "name": "Americas",
      "translations": {
        "br": "Amerika",
        "de": "Amerika",
        "es": "América",
        "fa": "قاره آمریکا",
        "fr": "Amérique",
        "hr": "Amerika",
        "it": "America",
        "ja": "アメリカ州",
        "ko": "아메리카",
        "nl": "Amerika",
        "pl": "Ameryka",
        "pt": "América",
        "ru": "Америка",
        "tr": "Amerika",
        "uk": "Америка",
        "pt-BR": "América",
        "zh-CN": "美洲"
      },
      "wikiDataId": "Q828",
      "flag": true,
      "createdAt": 1388577661000,
      "updatedAt": 1791099643000
    }
  ],
  "meta": {
    "limit": 2,
    "total": 6,
    "page": 1,
    "totalPages": 3,
    "nextCursor": "eyJpZCI6Mn0",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "dJqOQbwjijjXheB9nug7I",
    "timestamp": 1791099724869
  }
}
```

### POST /api/v1/geo/regions

Create a region

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_createRegion` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `flag` | boolean | no | default `true` |
| `name` | string | yes | length 1–255 |
| `translations` | any JSON | no |  |
| `wikiDataId` | string | no | at most 255 characters |

**Response 201 Created** — Created region

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/geo/regions
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Africa (copy)"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 8,
    "name": "Africa (copy)",
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "0TbTdXr4vcAcqg3cXKenu",
    "timestamp": 1791099725270
  }
}
```

### GET /api/v1/geo/regions/{id}

Get region by ID

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_getRegion` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — Region detail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/regions/1
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Africa",
    "translations": {
      "br": "Afrika",
      "de": "Afrika",
      "es": "África",
      "fa": "آفریقا",
      "fr": "Afrique",
      "hr": "Afrika",
      "it": "Africa",
      "ja": "アフリカ",
      "ko": "아프리카",
      "nl": "Afrika",
      "pl": "Afryka",
      "pt": "África",
      "ru": "Африка",
      "tr": "Afrika",
      "uk": "Африка",
      "pt-BR": "África",
      "zh-CN": "非洲"
    },
    "wikiDataId": "Q15",
    "flag": true,
    "createdAt": 1388577661000,
    "updatedAt": 1791099643000
  },
  "meta": {
    "correlationId": "uuH2EPtOm7_-vWLM8hCjf",
    "timestamp": 1791099724882
  }
}
```

### PATCH /api/v1/geo/regions/{id}

Update a region

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `UPDATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_updateRegion` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `flag` | boolean | no |  |
| `name` | string | no | length 1–255 |
| `translations` | any JSON | no |  |
| `wikiDataId` | string \| null | no | at most 255 characters |

**Response 200 OK** — Updated region

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/geo/regions/8
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Africa (renamed copy)"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 8,
    "name": "Africa (renamed copy)",
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "bMyC34cs2xZA3PaehTyAG",
    "timestamp": 1791099725289
  }
}
```

### DELETE /api/v1/geo/regions/{id}

Delete a region

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `DELETE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_deleteRegion` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — Region deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/geo/regions/8
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Region #8 deleted"
  },
  "meta": {
    "correlationId": "Et-D1BKo4mx-n09aAA4G7",
    "timestamp": 1791099725578
  }
}
```

### GET /api/v1/geo/states

List states

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_listStates` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: id, name, countryCode, iso2. Default: id |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: id, countryId, countryCode, flag |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |
| `include` | query | string | no | Comma-separated related entities to include (e.g. states,cities) |

**Response 200 OK** — Paginated list of states

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].cities` | object[] | no |  |
| `data[].cities[].countryCode` | string | yes |  |
| `data[].cities[].countryId` | integer | yes |  |
| `data[].cities[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].cities[].flag` | boolean | yes |  |
| `data[].cities[].id` | integer | yes |  |
| `data[].cities[].latitude` | number | yes |  |
| `data[].cities[].longitude` | number | yes |  |
| `data[].cities[].name` | string | yes |  |
| `data[].cities[].native` | string \| null | yes |  |
| `data[].cities[].stateCode` | string | yes |  |
| `data[].cities[].stateId` | integer | yes |  |
| `data[].cities[].timezone` | string \| null | yes |  |
| `data[].cities[].translations` | any JSON \| null | yes |  |
| `data[].cities[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].cities[].wikiDataId` | string \| null | yes |  |
| `data[].country` | object | no |  |
| `data[].country.capital` | string \| null | yes |  |
| `data[].country.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].country.currency` | string \| null | yes |  |
| `data[].country.currencyName` | string \| null | yes |  |
| `data[].country.currencySymbol` | string \| null | yes |  |
| `data[].country.emoji` | string \| null | yes |  |
| `data[].country.emojiU` | string \| null | yes |  |
| `data[].country.flag` | boolean | yes |  |
| `data[].country.gdp` | number \| null | yes |  |
| `data[].country.id` | integer | yes |  |
| `data[].country.iso2` | string \| null | yes |  |
| `data[].country.iso3` | string \| null | yes |  |
| `data[].country.latitude` | number \| null | yes |  |
| `data[].country.longitude` | number \| null | yes |  |
| `data[].country.name` | string | yes |  |
| `data[].country.nationality` | string \| null | yes |  |
| `data[].country.native` | string \| null | yes |  |
| `data[].country.numericCode` | string \| null | yes |  |
| `data[].country.phonecode` | string \| null | yes |  |
| `data[].country.population` | number \| null | yes |  |
| `data[].country.region` | string \| null | yes |  |
| `data[].country.regionId` | integer \| null | yes |  |
| `data[].country.subregion` | string \| null | yes |  |
| `data[].country.subregionId` | integer \| null | yes |  |
| `data[].country.timezones` | any JSON \| null | yes |  |
| `data[].country.tld` | string \| null | yes |  |
| `data[].country.translations` | any JSON \| null | yes |  |
| `data[].country.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].country.wikiDataId` | string \| null | yes |  |
| `data[].countryCode` | string | yes |  |
| `data[].countryId` | integer | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].fipsCode` | string \| null | yes |  |
| `data[].flag` | boolean | yes |  |
| `data[].id` | integer | yes |  |
| `data[].iso2` | string \| null | yes |  |
| `data[].iso3166_2` | string \| null | yes |  |
| `data[].latitude` | number \| null | yes |  |
| `data[].level` | integer \| null | yes | min -9007199254740991 |
| `data[].longitude` | number \| null | yes |  |
| `data[].name` | string | yes |  |
| `data[].native` | string \| null | yes |  |
| `data[].parentId` | integer \| null | yes |  |
| `data[].timezone` | string \| null | yes |  |
| `data[].translations` | any JSON \| null | yes |  |
| `data[].type` | string \| null | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].wikiDataId` | string \| null | yes |  |
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
GET /api/v1/geo/states?filter%5BcountryCode%5D=MY&sort=name&limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": 2485,
      "name": "Johor",
      "countryCode": "MY",
      "fipsCode": "01",
      "iso2": "01",
      "iso3166_2": "MY-01",
      "type": "state",
      "level": 1,
      "parentId": null,
      "native": "Johor",
      "latitude": 2.0228821,
      "longitude": 103.3114564,
      "timezone": "Asia/Kuala_Lumpur",
      "translations": {
        "ar": "جوهور",
        "br": "Johor",
        "de": "Johor",
        "es": "Johor",
        "fa": "جوهور",
        "fr": "Johor",
        "hi": "जोहोर",
        "hr": "Džohor",
        "it": "Johor",
        "ja": "ジョホール",
        "ko": "조호르",
        "nl": "Johor",
        "pl": "Johor",
        "pt": "Johor",
        "ru": "Джохор",
        "tr": "Johor",
        "uk": "Джохор",
        "pt-BR": "Johor",
        "zh-CN": "柔佛"
      },
      "wikiDataId": "Q183032",
      "flag": true,
      "countryId": 130,
      "createdAt": 1388577661000,
      "updatedAt": 1791099646000
    },
    {
      "id": 2486,
      "name": "Kedah",
      "countryCode": "MY",
      "fipsCode": "02",
      "iso2": "02",
      "iso3166_2": "MY-02",
      "type": "state",
      "level": 1,
      "parentId": null,
      "native": "Kedah",
      "latitude": 5.8098265,
      "longitude": 100.6715035,
      "timezone": "Asia/Kuala_Lumpur",
      "translations": {
        "ar": "قدح",
        "br": "Kedah",
        "de": "Kedah",
        "es": "Kedah",
        "fa": "کداح",
        "fr": "Kedah",
        "hi": "केदाह",
        "hr": "Kedah",
        "it": "Kedah",
        "ja": "ケダ州",
        "ko": "케다",
        "nl": "Kedah",
        "pl": "Kedah",
        "pt": "Kedah",
        "ru": "Кедах",
        "tr": "Kedah",
        "uk": "Кедах",
        "pt-BR": "Kedah",
        "zh-CN": "吉打州"
      },
      "wikiDataId": "Q188947",
      "flag": true,
      "countryId": 130,
      "createdAt": 1388577661000,
      "updatedAt": 1791099646000
    }
  ],
  "meta": {
    "limit": 2,
    "total": 16,
    "page": 1,
    "totalPages": 8,
    "nextCursor": null,
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "o6J1A7JqIbsY71zoEFwLl",
    "timestamp": 1791099724970
  }
}
```

### POST /api/v1/geo/states

Create a state

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_createState` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `countryCode` | string | yes | exactly 2 characters |
| `countryId` | integer | yes |  |
| `fipsCode` | string | no | at most 255 characters |
| `flag` | boolean | no | default `true` |
| `iso2` | string | no | at most 255 characters |
| `iso3166_2` | string | no | at most 255 characters |
| `latitude` | number | no | range -90–90 |
| `level` | integer | no | min -9007199254740991 |
| `longitude` | number | no | range -180–180 |
| `name` | string | yes | length 1–255 |
| `native` | string | no | at most 255 characters |
| `parentId` | integer \| null | no |  |
| `timezone` | string | no | at most 255 characters |
| `translations` | any JSON | no |  |
| `type` | string | no | at most 191 characters |
| `wikiDataId` | string | no | at most 255 characters |

**Response 201 Created** — Created state

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countryCode` | string | yes |  |
| `data.countryId` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.fipsCode` | string \| null | yes |  |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.iso2` | string \| null | yes |  |
| `data.iso3166_2` | string \| null | yes |  |
| `data.latitude` | number \| null | yes |  |
| `data.level` | integer \| null | yes | min -9007199254740991 |
| `data.longitude` | number \| null | yes |  |
| `data.name` | string | yes |  |
| `data.native` | string \| null | yes |  |
| `data.parentId` | integer \| null | yes |  |
| `data.timezone` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.type` | string \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/geo/states
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Johor (copy)",
  "countryId": 252,
  "countryCode": "MY"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 5257,
    "name": "Johor (copy)",
    "countryCode": "MY",
    "fipsCode": null,
    "iso2": null,
    "iso3166_2": null,
    "type": null,
    "level": null,
    "parentId": null,
    "native": null,
    "latitude": null,
    "longitude": null,
    "timezone": null,
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "countryId": 252,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "ZRxddb51X31RaOjRYVr1t",
    "timestamp": 1791099725395
  }
}
```

### GET /api/v1/geo/states/{id}

Get state by ID

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_getState` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — State detail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countryCode` | string | yes |  |
| `data.countryId` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.fipsCode` | string \| null | yes |  |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.iso2` | string \| null | yes |  |
| `data.iso3166_2` | string \| null | yes |  |
| `data.latitude` | number \| null | yes |  |
| `data.level` | integer \| null | yes | min -9007199254740991 |
| `data.longitude` | number \| null | yes |  |
| `data.name` | string | yes |  |
| `data.native` | string \| null | yes |  |
| `data.parentId` | integer \| null | yes |  |
| `data.timezone` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.type` | string \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/states/2485
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 2485,
    "name": "Johor",
    "countryCode": "MY",
    "fipsCode": "01",
    "iso2": "01",
    "iso3166_2": "MY-01",
    "type": "state",
    "level": 1,
    "parentId": null,
    "native": "Johor",
    "latitude": 2.0228821,
    "longitude": 103.3114564,
    "timezone": "Asia/Kuala_Lumpur",
    "translations": {
      "ar": "جوهور",
      "br": "Johor",
      "de": "Johor",
      "es": "Johor",
      "fa": "جوهور",
      "fr": "Johor",
      "hi": "जोहोर",
      "hr": "Džohor",
      "it": "Johor",
      "ja": "ジョホール",
      "ko": "조호르",
      "nl": "Johor",
      "pl": "Johor",
      "pt": "Johor",
      "ru": "Джохор",
      "tr": "Johor",
      "uk": "Джохор",
      "pt-BR": "Johor",
      "zh-CN": "柔佛"
    },
    "wikiDataId": "Q183032",
    "flag": true,
    "countryId": 130,
    "createdAt": 1388577661000,
    "updatedAt": 1791099646000
  },
  "meta": {
    "correlationId": "hg5p8wcf_fiXUWLn4eLuU",
    "timestamp": 1791099724985
  }
}
```

### PATCH /api/v1/geo/states/{id}

Update a state

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `UPDATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_updateState` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `countryCode` | string | no | exactly 2 characters |
| `countryId` | integer | no |  |
| `fipsCode` | string \| null | no | at most 255 characters |
| `flag` | boolean | no |  |
| `iso2` | string \| null | no | at most 255 characters |
| `iso3166_2` | string \| null | no | at most 255 characters |
| `latitude` | number \| null | no | range -90–90 |
| `level` | integer \| null | no | min -9007199254740991 |
| `longitude` | number \| null | no | range -180–180 |
| `name` | string | no | length 1–255 |
| `native` | string \| null | no | at most 255 characters |
| `parentId` | integer \| null | no |  |
| `timezone` | string \| null | no | at most 255 characters |
| `translations` | any JSON \| null | no |  |
| `type` | string \| null | no | at most 191 characters |
| `wikiDataId` | string \| null | no | at most 255 characters |

**Response 200 OK** — Updated state

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.countryCode` | string | yes |  |
| `data.countryId` | integer | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.fipsCode` | string \| null | yes |  |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.iso2` | string \| null | yes |  |
| `data.iso3166_2` | string \| null | yes |  |
| `data.latitude` | number \| null | yes |  |
| `data.level` | integer \| null | yes | min -9007199254740991 |
| `data.longitude` | number \| null | yes |  |
| `data.name` | string | yes |  |
| `data.native` | string \| null | yes |  |
| `data.parentId` | integer \| null | yes |  |
| `data.timezone` | string \| null | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.type` | string \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/geo/states/5257
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "timezone": "Asia/Kuala_Lumpur"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 5257,
    "name": "Johor (copy)",
    "countryCode": "MY",
    "fipsCode": null,
    "iso2": null,
    "iso3166_2": null,
    "type": null,
    "level": null,
    "parentId": null,
    "native": null,
    "latitude": null,
    "longitude": null,
    "timezone": "Asia/Kuala_Lumpur",
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "countryId": 252,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "xigiFDQ92b-zcc5qmyBtH",
    "timestamp": 1791099725422
  }
}
```

### DELETE /api/v1/geo/states/{id}

Delete a state

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `DELETE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_deleteState` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — State deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/geo/states/5257
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "State #5257 deleted"
  },
  "meta": {
    "correlationId": "ZHiVNsdPc2UkjajjIRDUd",
    "timestamp": 1791099725508
  }
}
```

### GET /api/v1/geo/stats

Get geo entity counts

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_getStats` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Response 200 OK** — Entity counts for regions, subregions, countries, states, and cities

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.cities` | integer | yes |  |
| `data.countries` | integer | yes |  |
| `data.regions` | integer | yes |  |
| `data.states` | integer | yes |  |
| `data.subregions` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/stats
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "regions": 6,
    "subregions": 22,
    "countries": 250,
    "states": 5255,
    "cities": 153312
  },
  "meta": {
    "correlationId": "-ugiPZm998i4TPeRFb8xc",
    "timestamp": 1791099724854
  }
}
```

### GET /api/v1/geo/subregions

List subregions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_listSubregions` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 10, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: id, name. Default: id |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: id, regionId, flag |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |
| `include` | query | string | no | Comma-separated related entities to include (e.g. states,cities) |

**Response 200 OK** — Paginated list of subregions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].countries` | object[] | no |  |
| `data[].countries[].capital` | string \| null | yes |  |
| `data[].countries[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].countries[].currency` | string \| null | yes |  |
| `data[].countries[].currencyName` | string \| null | yes |  |
| `data[].countries[].currencySymbol` | string \| null | yes |  |
| `data[].countries[].emoji` | string \| null | yes |  |
| `data[].countries[].emojiU` | string \| null | yes |  |
| `data[].countries[].flag` | boolean | yes |  |
| `data[].countries[].gdp` | number \| null | yes |  |
| `data[].countries[].id` | integer | yes |  |
| `data[].countries[].iso2` | string \| null | yes |  |
| `data[].countries[].iso3` | string \| null | yes |  |
| `data[].countries[].latitude` | number \| null | yes |  |
| `data[].countries[].longitude` | number \| null | yes |  |
| `data[].countries[].name` | string | yes |  |
| `data[].countries[].nationality` | string \| null | yes |  |
| `data[].countries[].native` | string \| null | yes |  |
| `data[].countries[].numericCode` | string \| null | yes |  |
| `data[].countries[].phonecode` | string \| null | yes |  |
| `data[].countries[].population` | number \| null | yes |  |
| `data[].countries[].region` | string \| null | yes |  |
| `data[].countries[].regionId` | integer \| null | yes |  |
| `data[].countries[].subregion` | string \| null | yes |  |
| `data[].countries[].subregionId` | integer \| null | yes |  |
| `data[].countries[].timezones` | any JSON \| null | yes |  |
| `data[].countries[].tld` | string \| null | yes |  |
| `data[].countries[].translations` | any JSON \| null | yes |  |
| `data[].countries[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].countries[].wikiDataId` | string \| null | yes |  |
| `data[].createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].flag` | boolean | yes |  |
| `data[].id` | integer | yes |  |
| `data[].name` | string | yes |  |
| `data[].region` | object | no |  |
| `data[].region.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].region.flag` | boolean | yes |  |
| `data[].region.id` | integer | yes |  |
| `data[].region.name` | string | yes |  |
| `data[].region.translations` | any JSON \| null | yes |  |
| `data[].region.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].region.wikiDataId` | string \| null | yes |  |
| `data[].regionId` | integer | yes |  |
| `data[].translations` | any JSON \| null | yes |  |
| `data[].updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data[].wikiDataId` | string \| null | yes |  |
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
GET /api/v1/geo/subregions?limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Australia and New Zealand",
      "translations": {
        "br": "Aostralia ha Zeland-Nevez",
        "de": "Australasien",
        "es": "Australasia",
        "fa": "استرالزی",
        "fr": "Australasie",
        "hr": "Australazija",
        "it": "Australasia",
        "ja": "オーストララシア",
        "ko": "오스트랄라시아",
        "nl": "Australazië",
        "pl": "Australia i Nowa Zelandia",
        "pt": "Australásia",
        "ru": "Австралия и Новая Зеландия",
        "uk": "Австралія та Нова Зеландія",
        "zh-CN": "澳大拉西亞"
      },
      "wikiDataId": "Q45256",
      "flag": true,
      "regionId": 5,
      "createdAt": 1388577661000,
      "updatedAt": 1791099643000
    },
    {
      "id": 2,
      "name": "Caribbean",
      "translations": {
        "br": "Karib",
        "de": "Karibik",
        "es": "Caribe",
        "fa": "کارائیب",
        "fr": "Caraïbes",
        "hr": "Karibi",
        "it": "Caraibi",
        "ja": "カリブ海地域",
        "ko": "카리브",
        "nl": "Caraïben",
        "pl": "Karaiby",
        "pt": "Caraíbas",
        "ru": "Карибы",
        "uk": "Кариби",
        "zh-CN": "加勒比地区"
      },
      "wikiDataId": "Q664609",
      "flag": true,
      "regionId": 2,
      "createdAt": 1388577661000,
      "updatedAt": 1791099643000
    }
  ],
  "meta": {
    "limit": 2,
    "total": 22,
    "page": 1,
    "totalPages": 11,
    "nextCursor": "eyJpZCI6Mn0",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "66aAYPt-pF-bx9-jRtEly",
    "timestamp": 1791099724894
  }
}
```

### POST /api/v1/geo/subregions

Create a subregion

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `CREATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_createSubregion` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `flag` | boolean | no | default `true` |
| `name` | string | yes | length 1–255 |
| `regionId` | integer | yes |  |
| `translations` | any JSON | no |  |
| `wikiDataId` | string | no | at most 255 characters |

**Response 201 Created** — Created subregion

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.regionId` | integer | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/geo/subregions
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Australia and New Zealand (copy)",
  "regionId": 8
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 24,
    "name": "Australia and New Zealand (copy)",
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "regionId": 8,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "9HZQ0DghlLgqlILRKBjZu",
    "timestamp": 1791099725310
  }
}
```

### GET /api/v1/geo/subregions/{id}

Get subregion by ID

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:GEO`.
- Operation id `GeoController_getSubregion` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — Subregion detail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.regionId` | integer | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/geo/subregions/1
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Australia and New Zealand",
    "translations": {
      "br": "Aostralia ha Zeland-Nevez",
      "de": "Australasien",
      "es": "Australasia",
      "fa": "استرالزی",
      "fr": "Australasie",
      "hr": "Australazija",
      "it": "Australasia",
      "ja": "オーストララシア",
      "ko": "오스트랄라시아",
      "nl": "Australazië",
      "pl": "Australia i Nowa Zelandia",
      "pt": "Australásia",
      "ru": "Австралия и Новая Зеландия",
      "uk": "Австралія та Нова Зеландія",
      "zh-CN": "澳大拉西亞"
    },
    "wikiDataId": "Q45256",
    "flag": true,
    "regionId": 5,
    "createdAt": 1388577661000,
    "updatedAt": 1791099643000
  },
  "meta": {
    "correlationId": "NRgKhKkKILOBkmdBMiEmc",
    "timestamp": 1791099724910
  }
}
```

### PATCH /api/v1/geo/subregions/{id}

Update a subregion

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `UPDATE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_updateSubregion` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `flag` | boolean | no |  |
| `name` | string | no | length 1–255 |
| `regionId` | integer | no |  |
| `translations` | any JSON | no |  |
| `wikiDataId` | string \| null | no | at most 255 characters |

**Response 200 OK** — Updated subregion

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.createdAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.flag` | boolean | yes |  |
| `data.id` | integer | yes |  |
| `data.name` | string | yes |  |
| `data.regionId` | integer | yes |  |
| `data.translations` | any JSON \| null | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds (UTC) |
| `data.wikiDataId` | string \| null | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/geo/subregions/24
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Australia and New Zealand (renamed copy)"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "id": 24,
    "name": "Australia and New Zealand (renamed copy)",
    "translations": null,
    "wikiDataId": null,
    "flag": true,
    "regionId": 8,
    "createdAt": 1388577661000,
    "updatedAt": 1791099725000
  },
  "meta": {
    "correlationId": "e8ZBm67TBadMpZH3o_vLa",
    "timestamp": 1791099725330
  }
}
```

### DELETE /api/v1/geo/subregions/{id}

Delete a subregion

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `DELETE:GEO`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `GeoController_deleteSubregion` · [source](../../../apps/api/src/modules/geo/geo.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | integer | yes |  |

**Response 200 OK** — Subregion deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Human-readable status message |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/geo/subregions/24
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Subregion #24 deleted"
  },
  "meta": {
    "correlationId": "oXwGglW-X0oFWpfUMkQQD",
    "timestamp": 1791099725553
  }
}
```
