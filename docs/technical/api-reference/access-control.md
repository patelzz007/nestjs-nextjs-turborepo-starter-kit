---
title: "API reference — Roles, permissions and audit"
description: "Platform RBAC administration, authorization decisions, the capability catalog and the HTTP audit log."
order: 3
author: "Generated from the OpenAPI export"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm tools docs:api -->

# API reference — Roles, permissions and audit

Platform RBAC administration, authorization decisions, the capability catalog and the HTTP audit log.

How these endpoints fit together: [Authorization overview](../authorization/overview.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## Roles

### GET /api/v1/admin/roles

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:ROLE`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_list` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: name, createdAt. Default: name |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: isActive |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — One page of the roles; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].description` | string \| null | yes |  |
| `data[].id` | string | yes |  |
| `data[].isActive` | boolean | yes |  |
| `data[].kind` | "PLATFORM" \| "TEMPLATE" \| "TENANT" | yes |  |
| `data[].name` | string | yes |  |
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
GET /api/v1/admin/roles
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "01a1827f-3e06-7438-92b4-3fbb54409b4f",
      "name": "Admin",
      "description": "Admin panel — manage users, settings, and platform data",
      "isActive": true,
      "kind": "PLATFORM"
    },
    {
      "id": "01a1827f-3e19-72d4-b0e2-fb46b7f9fd35",
      "name": "Cashier",
      "description": "Tenant role template — every tenant's Cashier starts as a copy of this",
      "isActive": true,
      "kind": "TEMPLATE"
    }
  ],
  "meta": {
    "limit": 20,
    "total": 10,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "2yuXLCmeMSppbpLbEgsG1",
    "timestamp": 1793190873743
  }
}
```

### POST /api/v1/admin/roles

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `CREATE:ROLE`.
- **Policy** `CREATE:ROLE` — Create new role.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_create` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string | no | Role description |
| `name` | string | yes | Role name; at most 100 characters |

**Response 201 Created** (`application/json`) — Created role

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data._count` | object | no |  |
| `data._count.rolePermissions` | number | yes |  |
| `data._count.userRoles` | number | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.rolePermissions` | object[] | no |  |
| `data.rolePermissions[].permission` | object | yes |  |
| `data.rolePermissions[].permission.action` | string | yes |  |
| `data.rolePermissions[].permission.description` | string \| null | yes |  |
| `data.rolePermissions[].permission.group` | string \| null | yes |  |
| `data.rolePermissions[].permission.id` | string | yes |  |
| `data.rolePermissions[].permission.resource` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.userRoles` | object[] | no |  |
| `data.userRoles[].user` | object | yes |  |
| `data.userRoles[].user.email` | string | yes |  |
| `data.userRoles[].user.fullName` | string | yes |  |
| `data.userRoles[].user.id` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/roles
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Store Auditor",
  "description": "Reads geography and audit data for store reviews"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190873832,
    "updatedAt": 1793190873832,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-4aee-763a-bba6-e9d25c590423",
    "name": "Store Auditor",
    "description": "Reads geography and audit data for store reviews",
    "isActive": true,
    "isSystem": false
  },
  "meta": {
    "correlationId": "7M3LbOrUQ6r2HlvxLdznu",
    "timestamp": 1793190873858
  }
}
```

### GET /api/v1/admin/roles/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:ROLE`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_detail` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Role detail (404 NOT_FOUND when no live role has that id)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data._count` | object | no |  |
| `data._count.rolePermissions` | number | yes |  |
| `data._count.userRoles` | number | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.rolePermissions` | object[] | no |  |
| `data.rolePermissions[].permission` | object | yes |  |
| `data.rolePermissions[].permission.action` | string | yes |  |
| `data.rolePermissions[].permission.description` | string \| null | yes |  |
| `data.rolePermissions[].permission.group` | string \| null | yes |  |
| `data.rolePermissions[].permission.id` | string | yes |  |
| `data.rolePermissions[].permission.resource` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.userRoles` | object[] | no |  |
| `data.userRoles[].user` | object | yes |  |
| `data.userRoles[].user.email` | string | yes |  |
| `data.userRoles[].user.fullName` | string | yes |  |
| `data.userRoles[].user.id` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/roles/01a1827f-3e16-778b-9a2c-cbe82254ecbc
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190739449,
    "updatedAt": 1793190739449,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a1827f-3e16-778b-9a2c-cbe82254ecbc",
    "name": "Manager",
    "description": "Tenant role template — every tenant's Manager starts as a copy of this",
    "isActive": true,
    "isSystem": true
  },
  "meta": {
    "correlationId": "pEnJ5cX1FytSqNJZ0_Gtd",
    "timestamp": 1793190873810
  }
}
```

### PATCH /api/v1/admin/roles/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_update` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string | no | Updated role description |
| `isActive` | boolean | no | Whether the role is active |
| `name` | string | no | Updated role name; at most 100 characters |

**Response 200 OK** (`application/json`) — Updated role

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data._count` | object | no |  |
| `data._count.rolePermissions` | number | yes |  |
| `data._count.userRoles` | number | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.rolePermissions` | object[] | no |  |
| `data.rolePermissions[].permission` | object | yes |  |
| `data.rolePermissions[].permission.action` | string | yes |  |
| `data.rolePermissions[].permission.description` | string \| null | yes |  |
| `data.rolePermissions[].permission.group` | string \| null | yes |  |
| `data.rolePermissions[].permission.id` | string | yes |  |
| `data.rolePermissions[].permission.resource` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.userRoles` | object[] | no |  |
| `data.userRoles[].user` | object | yes |  |
| `data.userRoles[].user.email` | string | yes |  |
| `data.userRoles[].user.fullName` | string | yes |  |
| `data.userRoles[].user.id` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
PATCH /api/v1/admin/roles/01a18281-4aee-763a-bba6-e9d25c590423
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "description": "Reads geography, audit and analytics data for store reviews"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190873832,
    "updatedAt": 1793190873898,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-4aee-763a-bba6-e9d25c590423",
    "name": "Store Auditor",
    "description": "Reads geography, audit and analytics data for store reviews",
    "isActive": true,
    "isSystem": false
  },
  "meta": {
    "correlationId": "086teHKYxsFdFThLKWD0i",
    "timestamp": 1793190873919
  }
}
```

### DELETE /api/v1/admin/roles/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `DELETE:ROLE`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_remove` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Role deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/admin/roles/01a18281-4aee-763a-bba6-e9d25c590423
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Role deleted successfully"
  },
  "meta": {
    "correlationId": "5RYjAnh1l8hsWkgslBi_R",
    "timestamp": 1793190874253
  }
}
```

### POST /api/v1/admin/roles/{id}/permissions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_syncPermissions` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `permissionIds` | string (uuid)[] | yes | List of permission IDs to assign or remove; 1–∞ items |

**Response 201 Created** (`application/json`) — Role permissions synced

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/roles/01a18281-4aee-763a-bba6-e9d25c590423/permissions
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "permissionIds": [
    "01a1827f-3dca-7779-86bc-9da9624f54ac"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Role permissions synced successfully"
  },
  "meta": {
    "correlationId": "DnTARoqMhniT0pxAW6bXv",
    "timestamp": 1793190874004
  }
}
```

### POST /api/v1/admin/roles/{id}/restore

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_restore` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Restored role

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data._count` | object | no |  |
| `data._count.rolePermissions` | number | yes |  |
| `data._count.userRoles` | number | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.rolePermissions` | object[] | no |  |
| `data.rolePermissions[].permission` | object | yes |  |
| `data.rolePermissions[].permission.action` | string | yes |  |
| `data.rolePermissions[].permission.description` | string \| null | yes |  |
| `data.rolePermissions[].permission.group` | string \| null | yes |  |
| `data.rolePermissions[].permission.id` | string | yes |  |
| `data.rolePermissions[].permission.resource` | string | yes |  |
| `data.updatedAt` | integer | yes | Epoch milliseconds when the record was last updated |
| `data.userRoles` | object[] | no |  |
| `data.userRoles[].user` | object | yes |  |
| `data.userRoles[].user.email` | string | yes |  |
| `data.userRoles[].user.fullName` | string | yes |  |
| `data.userRoles[].user.id` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/roles/01a18281-4aee-763a-bba6-e9d25c590423/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190873832,
    "updatedAt": 1793190874278,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-4aee-763a-bba6-e9d25c590423",
    "name": "Store Auditor",
    "description": "Reads geography, audit and analytics data for store reviews",
    "isActive": true,
    "isSystem": false
  },
  "meta": {
    "correlationId": "JLpoDYC89pam5MUDUsZHa",
    "timestamp": 1793190874298
  }
}
```

### POST /api/v1/admin/roles/{id}/validate-assignment

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_validateAssignment` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleIds` | string (uuid)[] | yes | Role IDs to simulate assigning |
| `userId` | string (uuid) | yes | User ID to validate assignment for |

**Response 201 Created** (`application/json`) — Conflict validation result

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes |  |
| `data.valid` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/roles/01a18281-4aee-763a-bba6-e9d25c590423/validate-assignment
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4385-71c6-8700-5468cf8e851b",
  "roleIds": [
    "01a18281-4aee-763a-bba6-e9d25c590423"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "valid": true,
    "message": "No conflicts detected"
  },
  "meta": {
    "correlationId": "mbhHSBzzqhqDfsCUJJQQU",
    "timestamp": 1793190874032
  }
}
```

### POST /api/v1/admin/roles/preview

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:ROLE`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_preview` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleIds` | string (uuid)[] | yes | Role IDs to simulate assigning |
| `userId` | string (uuid) | yes | User ID to validate assignment for |

**Response 201 Created** (`application/json`) — Preview of what permissions would change

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.currentRoles` | string[] | yes |  |
| `data.newRoles` | string[] | yes |  |
| `data.permissionsGained` | string[] | yes |  |
| `data.permissionsLost` | string[] | yes |  |
| `data.roleAdded` | string[] | yes |  |
| `data.roleRemoved` | string[] | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/roles/preview
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4385-71c6-8700-5468cf8e851b",
  "roleIds": [
    "01a1827f-3e0a-715a-a7b4-c46bb0b36e4d",
    "01a18281-4aee-763a-bba6-e9d25c590423"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "currentRoles": [
      "User"
    ],
    "newRoles": [
      "User",
      "Store Auditor"
    ],
    "roleAdded": [
      "Store Auditor"
    ],
    "roleRemoved": [],
    "permissionsGained": [
      "READ:GEO"
    ],
    "permissionsLost": []
  },
  "meta": {
    "correlationId": "vHVWdqyDJIUGmhI2vVFgw",
    "timestamp": 1793190874077
  }
}
```

### POST /api/v1/admin/roles/user/assign

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- **Permission** `UPDATE:USER`.
- **Policy** `UPDATE:USER` — Assign role to user.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_assignRoleToUser` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleId` | string (uuid) | yes | Role ID |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** (`application/json`) — Role assigned to user

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/roles/user/assign
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4385-71c6-8700-5468cf8e851b",
  "roleId": "01a18281-4aee-763a-bba6-e9d25c590423"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Role assigned to user successfully"
  },
  "meta": {
    "correlationId": "kP0DNpP93ntpL-ZmpiVqJ",
    "timestamp": 1793190874114
  }
}
```

### POST /api/v1/admin/roles/user/remove

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_removeRoleFromUser` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleId` | string (uuid) | yes | Role ID |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** (`application/json`) — Role removed from user

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/roles/user/remove
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4385-71c6-8700-5468cf8e851b",
  "roleId": "01a18281-4aee-763a-bba6-e9d25c590423"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Role removed from user successfully"
  },
  "meta": {
    "correlationId": "NZI7vndtTej4jWeujIypB",
    "timestamp": 1793190874152
  }
}
```

### POST /api/v1/admin/roles/user/sync

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_syncUserRoles` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleIds` | string (uuid)[] | yes | Complete list of role IDs the user should have |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** (`application/json`) — User roles synced

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/roles/user/sync
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4385-71c6-8700-5468cf8e851b",
  "roleIds": [
    "01a1827f-3e0a-715a-a7b4-c46bb0b36e4d"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "User roles synced successfully"
  },
  "meta": {
    "correlationId": "e8FnCK4_MNhonweF19-xe",
    "timestamp": 1793190874201
  }
}
```

## Permissions

### GET /api/v1/admin/permissions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:PERMISSION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_list` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 100, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: group, resource, action, createdAt. Default: group,resource,action |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: group, resource |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — One page of the permissions; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data[].description` | string \| null | yes |  |
| `data[].group` | string \| null | yes |  |
| `data[].id` | string | yes |  |
| `data[].isSystem` | boolean | yes |  |
| `data[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes |  |
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
GET /api/v1/admin/permissions?limit=3
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "01a1827f-3dca-7779-86bc-6ffee5c8163d",
      "action": "READ",
      "resource": "ADMIN_DASHBOARD",
      "description": "Access admin dashboard",
      "group": "Admin Dashboard",
      "isSystem": false
    },
    {
      "id": "01a1827f-3dca-7779-86bc-80b34a484280",
      "action": "READ",
      "resource": "ANALYTICS",
      "description": "View analytics data",
      "group": "Analytics",
      "isSystem": false
    }
  ],
  "meta": {
    "limit": 3,
    "total": 118,
    "page": 1,
    "totalPages": 40,
    "nextCursor": null,
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "sbq2dIMSqU8lc3uRLHMKB",
    "timestamp": 1793190873222
  }
}
```

### POST /api/v1/admin/permissions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `CREATE:PERMISSION`.
- **Policy** `CREATE:PERMISSION` — Create new permission.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_create` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes | The action this permission grants |
| `description` | string | no | Permission description |
| `group` | string | no | Permission group/category |
| `resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes | The resource this permission applies to |

**Response 201 Created** (`application/json`) — Created permission

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.group` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | yes |  |
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes |  |
| `data.scope` | "GLOBAL" \| "TENANT" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
POST /api/v1/admin/permissions
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "action": "DELETE",
  "resource": "INVENTORY",
  "group": "Reports",
  "description": "Delete inventory records"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190873407,
    "updatedAt": 1793190873407,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-4941-7fbd-952e-017351b53118",
    "action": "DELETE",
    "resource": "INVENTORY",
    "description": "Delete inventory records",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL"
  },
  "meta": {
    "correlationId": "E4fjX4Qt1Qit__E285Hol",
    "timestamp": 1793190873424
  }
}
```

### GET /api/v1/admin/permissions/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PERMISSION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_detail` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Permission detail (404 NOT_FOUND when no live permission has that id)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.group` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | yes |  |
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes |  |
| `data.scope` | "GLOBAL" \| "TENANT" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
GET /api/v1/admin/permissions/01a1827f-3dca-7779-86bc-9da9624f54ac
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190739358,
    "updatedAt": 1793190739358,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a1827f-3dca-7779-86bc-9da9624f54ac",
    "action": "READ",
    "resource": "GEO",
    "description": "View geographic data (regions, countries, states, cities)",
    "group": "Geo",
    "isSystem": false,
    "scope": "GLOBAL"
  },
  "meta": {
    "correlationId": "XxNCCwwtsoJz7EKjTXIIR",
    "timestamp": 1793190873288
  }
}
```

### PATCH /api/v1/admin/permissions/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- **Policy** `UPDATE:PERMISSION` — Update permission.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_update` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string | no | Updated permission description |
| `group` | string | no | Updated permission group |

**Response 200 OK** (`application/json`) — Updated permission

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.group` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | yes |  |
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes |  |
| `data.scope` | "GLOBAL" \| "TENANT" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
PATCH /api/v1/admin/permissions/01a18281-4941-7fbd-952e-017351b53118
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "description": "Delete any inventory record"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190873407,
    "updatedAt": 1793190873452,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-4941-7fbd-952e-017351b53118",
    "action": "DELETE",
    "resource": "INVENTORY",
    "description": "Delete any inventory record",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL"
  },
  "meta": {
    "correlationId": "CVupvOPIM2zuBgwdbQEzt",
    "timestamp": 1793190873464
  }
}
```

### DELETE /api/v1/admin/permissions/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `DELETE:PERMISSION`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_remove` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — Permission deleted

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
DELETE /api/v1/admin/permissions/01a18281-4941-7fbd-952e-017351b53118
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Permission deleted successfully"
  },
  "meta": {
    "correlationId": "kcA3R1JI6X36lpf-FHt__",
    "timestamp": 1793190873522
  }
}
```

### POST /api/v1/admin/permissions/{id}/restore

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_restore` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Restored permission

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.group` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | yes |  |
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes |  |
| `data.scope` | "GLOBAL" \| "TENANT" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
POST /api/v1/admin/permissions/01a18281-4941-7fbd-952e-017351b53118/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1793190873407,
    "updatedAt": 1793190873544,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a18281-4941-7fbd-952e-017351b53118",
    "action": "DELETE",
    "resource": "INVENTORY",
    "description": "Delete any inventory record",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL"
  },
  "meta": {
    "correlationId": "yG0I4f0S2xzccmdE1knwa",
    "timestamp": 1793190873565
  }
}
```

### POST /api/v1/admin/permissions/check

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PERMISSION`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_checkPermission` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes | The action to check |
| `resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes | The resource to check against |
| `userId` | string (uuid) | yes | User ID to check permissions for |

**Response 201 Created** (`application/json`) — Permission check result with grant provenance

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.allowed` | boolean | yes |  |
| `data.grants` | object[] | yes |  |
| `data.grants[].detail` | string | no |  |
| `data.grants[].via` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/permissions/check
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4353-705c-94eb-387f9c3967f8",
  "action": "READ",
  "resource": "GEO"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "allowed": true,
    "grants": [
      {
        "via": "role",
        "detail": "Assigned role: Admin"
      }
    ]
  },
  "meta": {
    "correlationId": "zDCCL4ejR6-tQ1dMrUqe2",
    "timestamp": 1793190873372
  }
}
```

### GET /api/v1/admin/permissions/groups/list

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:PERMISSION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_listGroups` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Response 200 OK** (`application/json`) — List of permission groups

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.groups` | string[] | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/admin/permissions/groups/list
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "groups": [
      "User Management",
      "Profile Management"
    ]
  },
  "meta": {
    "correlationId": "s5WoH2pUGdZDlZD2kVjlD",
    "timestamp": 1793190873316
  }
}
```

### POST /api/v1/admin/permissions/user/grant

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_grantToUser` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `effect` | "ALLOW" \| "DENY" | no | ALLOW grants the permission; DENY revokes it even when a role grants it (default ALLOW) |
| `expiresAt` | integer | no | Optional epoch-ms timestamp when the grant expires |
| `permissionId` | string (uuid) | yes | Permission ID |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** (`application/json`) — Direct permission granted to user

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/permissions/user/grant
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4353-705c-94eb-387f9c3967f8",
  "permissionId": "01a1827f-3dca-7779-86bc-9da9624f54ac",
  "effect": "ALLOW"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Permission granted to user successfully"
  },
  "meta": {
    "correlationId": "IC2hkd1J6owLJjZZF2ede",
    "timestamp": 1793190873611
  }
}
```

### POST /api/v1/admin/permissions/user/revoke

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_revokeFromUser` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `effect` | "ALLOW" \| "DENY" | no | ALLOW grants the permission; DENY revokes it even when a role grants it (default ALLOW) |
| `expiresAt` | integer | no | Optional epoch-ms timestamp when the grant expires |
| `permissionId` | string (uuid) | yes | Permission ID |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** (`application/json`) — Direct permission revoked from user

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/permissions/user/revoke
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4353-705c-94eb-387f9c3967f8",
  "permissionId": "01a1827f-3dca-7779-86bc-9da9624f54ac"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "Permission revoked from user"
  },
  "meta": {
    "correlationId": "hHZYkUyV78Hagj25P7Me6",
    "timestamp": 1793190873654
  }
}
```

### POST /api/v1/admin/permissions/user/sync

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PermissionsController_syncUserPermissions` · [source](../../../apps/api/src/contexts/authorization/presentation/http/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `permissionIds` | string (uuid)[] | yes | Complete list of permission IDs the user should have |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** (`application/json`) — User permissions synced

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.message` | string | yes | Status message about the RBAC operation |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/admin/permissions/user/sync
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a1827f-4353-705c-94eb-387f9c3967f8",
  "permissionIds": [
    "01a1827f-3dca-7779-86bc-9da9624f54ac"
  ]
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "message": "User permissions synced successfully"
  },
  "meta": {
    "correlationId": "MJjGW4NKC-MxkLGtQMWm5",
    "timestamp": 1793190873712
  }
}
```

## Authorization

### POST /api/v1/authorization/decisions

Evaluate capability checks for the current user (UI hints — the API re-authorizes every operation)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Rate limit: `THROTTLE_DEFAULT_LIMIT` requests per `THROTTLE_TTL_MS` ms per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `AuthorizationDecisionsController_decide` · [source](../../../apps/api/src/contexts/authorization/presentation/http/authorization-decisions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `checks` | object[] | yes | 1–50 items |
| `checks[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `checks[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes |  |
| `checks[].resourceId` | string | no | length 1–64 |

**Response 200 OK** (`application/json`) — One decision per requested check, in request order

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.results` | object[] | yes |  |
| `data.results[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `data.results[].allowed` | boolean | yes |  |
| `data.results[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes |  |
| `data.results[].resourceId` | string | no | length 1–64 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/authorization/decisions
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "checks": [
    {
      "action": "READ",
      "resource": "GEO"
    },
    {
      "action": "READ",
      "resource": "ANALYTICS"
    }
  ]
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "action": "READ",
        "resource": "GEO",
        "allowed": true
      },
      {
        "action": "READ",
        "resource": "ANALYTICS",
        "allowed": true
      }
    ]
  },
  "meta": {
    "correlationId": "MMp9FvgLOvmd4IeA-OCW4",
    "timestamp": 1793190874314
  }
}
```

### GET /api/v1/authorization/decisions/explain

Admin: step-by-step explanation of an authorization decision

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PERMISSION`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuthorizationDecisionsController_explain` · [source](../../../apps/api/src/contexts/authorization/presentation/http/authorization-decisions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `action` | query | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "PUBLISH" \| "APPROVE" \| "REJECT" \| "SUSPEND" \| "BAN" \| … (+4 more) | yes |  |
| `resource` | query | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+30 more) | yes |  |
| `resourceId` | query | string | no |  |
| `userId` | query | string | no |  |
| `tenantId` | query | string | no |  |
| `locationId` | query | string | no |  |

**Response 200 OK** (`application/json`) — The decision with every evaluation step

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.decision` | "ALLOW" \| "DENY" | yes |  |
| `data.durationMs` | integer | no |  |
| `data.evaluation` | object[] | yes |  |
| `data.evaluation[].details` | object | no |  |
| `data.evaluation[].effect` | "ALLOW" \| "DENY" \| "NO_MATCH" | yes |  |
| `data.evaluation[].reason` | string | no |  |
| `data.evaluation[].source` | "superadmin" \| "validation" \| "tenant" \| "override" \| "acl" \| "role" \| "grant" \| "share" \| "scope" \| "policy" \| … (+3 more) | yes |  |
| `data.request` | object | yes |  |
| `data.request.action` | string | yes |  |
| `data.request.resource` | string | yes |  |
| `data.request.resourceAttributes` | object | no |  |
| `data.request.resourceId` | string | no |  |
| `data.request.subject` | object | yes |  |
| `data.request.subject.attributes` | object | no |  |
| `data.request.subject.isSuperAdmin` | boolean | no |  |
| `data.request.subject.locationId` | string | no |  |
| `data.request.subject.roles` | string[] | no |  |
| `data.request.subject.tenantId` | string | no |  |
| `data.request.subject.userId` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/authorization/decisions/explain?action=READ&resource=GEO&userId=01a1827f-4353-705c-94eb-387f9c3967f8
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "decision": "ALLOW",
    "request": {
      "subject": {
        "userId": "01a1827f-4353-705c-94eb-387f9c3967f8",
        "isSuperAdmin": false
      },
      "action": "READ",
      "resource": "GEO"
    },
    "evaluation": [
      {
        "source": "role",
        "effect": "ALLOW",
        "reason": "Allowed by role"
      }
    ],
    "durationMs": 29
  },
  "meta": {
    "correlationId": "Ny0aoCZCdo_oTI2HHK1_T",
    "timestamp": 1793190874369
  }
}
```

## Capabilities

### GET /api/v1/capabilities/catalog

List capability catalog entries (optionally filtered by scope)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `CapabilitiesCatalogController_listCatalog` · [source](../../../apps/api/src/contexts/authorization/presentation/http/capabilities-catalog.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `scope` | query | "PLATFORM" \| "MERCHANT" \| "ADMIN" | no |  |

**Response 200 OK** (`application/json`) — Capability definitions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].description` | string \| null | yes |  |
| `data[].groupName` | string \| null | yes |  |
| `data[].id` | string | yes |  |
| `data[].isSystem` | boolean | yes |  |
| `data[].label` | string | yes |  |
| `data[].scope` | "PLATFORM" \| "MERCHANT" \| "ADMIN" | yes |  |
| `data[].slug` | string | yes | length 1–100; pattern `^[a-z0-9]+(?::[a-z0-9_]+)+(\.[a-z0-9_]+)?$` |
| `data[].sortOrder` | integer | yes | min -9007199254740991 |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
GET /api/v1/capabilities/catalog
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "id": "01a1827f-3f1b-7670-b196-48666cfbd5c6",
      "slug": "merchant:view_dashboard",
      "scope": "MERCHANT",
      "label": "View dashboard",
      "description": "Access the merchant home dashboard and summary widgets.",
      "groupName": "Overview",
      "sortOrder": 0,
      "isSystem": true
    },
    {
      "id": "01a1827f-3ed4-738c-8829-d4ca8d7fdcb0",
      "slug": "platform:access_request.approve",
      "scope": "PLATFORM",
      "label": "Tenant permission access_request.approve",
      "description": "Tenant permission access_request.approve",
      "groupName": "Tenant",
      "sortOrder": 0,
      "isSystem": false
    }
  ],
  "meta": {
    "correlationId": "a4wupV8FNPC4IDStW0AWd",
    "timestamp": 1793190874385
  }
}
```

## Audit Log

### GET /api/v1/admin/audit

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:AUDIT_LOG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuditController_list` · [source](../../../apps/api/src/contexts/authorization/presentation/http/audit.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: action, actorId, targetUserId, targetRoleId, createdAt |

**Response 200 OK** (`application/json`) — Paginated audit log entries (newest first); pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].action` | string | yes |  |
| `data[].actor` | object | yes |  |
| `data[].actor.⟨shape 1⟩ impersonatorId` | string \| null | yes |  |
| `data[].actor.⟨shape 1⟩ kind` | "USER" | yes |  |
| `data[].actor.⟨shape 1⟩ userId` | string | yes |  |
| `data[].actor.⟨shape 2⟩ kind` | "SYSTEM_OPERATION" | yes |  |
| `data[].actor.⟨shape 2⟩ operation` | string | yes | length 1–100 |
| `data[].createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data[].detail` | string \| null | yes |  |
| `data[].id` | string | yes |  |
| `data[].permissionId` | string \| null | yes |  |
| `data[].targetRoleId` | string \| null | yes |  |
| `data[].targetUserId` | string \| null | yes |  |
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
GET /api/v1/admin/audit?limit=2
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": [
    {
      "createdAt": 1793190874428,
      "updatedAt": 1793190874428,
      "id": "01a18281-4d3c-7679-813f-e123b5369e67",
      "actor": {
        "kind": "USER",
        "userId": "01a1827f-433b-7236-8894-c37cafdb5f34",
        "impersonatorId": null
      },
      "targetUserId": null,
      "targetRoleId": null,
      "permissionId": null,
      "action": "SUPER_ADMIN_BYPASS",
      "detail": "Bypassed authorization for list at GET /api/v1/admin/audit?limit=2"
    },
    {
      "createdAt": 1793190874334,
      "updatedAt": 1793190874334,
      "id": "01a18281-4cde-7789-8125-f844a486921c",
      "actor": {
        "kind": "USER",
        "userId": "01a1827f-433b-7236-8894-c37cafdb5f34",
        "impersonatorId": null
      },
      "targetUserId": null,
      "targetRoleId": null,
      "permissionId": null,
      "action": "SUPER_ADMIN_BYPASS",
      "detail": "Bypassed authorization for explain at GET /api/v1/authorization/decisions/explain?action=READ&resource=GEO&userId=01a1827f-4353-705c-94eb-387f9c3967f8"
    }
  ],
  "meta": {
    "limit": 2,
    "total": 107,
    "page": 1,
    "totalPages": 54,
    "nextCursor": "eyJhdCI6MTc5MzE5MDg3NDMzNCwiaWQiOiIwMWExODI4MS00Y2RlLTc3ODktODEyNS1mODQ0YTQ4NjkyMWMifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "pbL8naiM1_1e9cs9Bxc4Y",
    "timestamp": 1793190874442
  }
}
```

### GET /api/v1/admin/audit-logs

List audit records (newest first)

Request metadata only — open one record for its redacted payloads.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:AUDIT_LOG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuditLogsController_list` · [source](../../../apps/api/src/contexts/audit/presentation/http/audit-logs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: occurredAt, responseStatus, method, endpoint. Default: -occurredAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: outcome, method, authMethod, responseStatus, endpoint, errorCode, actorUserId, impersonatorUserId, tenantId, apiKeyId, ipAddress, ipScope, deviceType, browserName, osName, geoCountry, correlationId, occurredAt |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — Paginated audit records; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].actor` | object \| null | yes |  |
| `data[].actor.email` | string \| null | yes |  |
| `data[].actor.fullName` | string \| null | yes |  |
| `data[].actor.id` | string | yes | length 1–64 |
| `data[].apiKeyId` | string \| null | yes | length 1–64 |
| `data[].authMethod` | "BEARER_TOKEN" \| "SESSION_COOKIE" \| "REFRESH_COOKIE" \| "REFRESH_BODY" \| "API_KEY" \| null | yes |  |
| `data[].browserName` | string \| null | yes | at most 64 characters |
| `data[].browserVersion` | string \| null | yes | at most 32 characters |
| `data[].clientType` | string \| null | yes | at most 32 characters |
| `data[].completedAt` | integer | yes |  |
| `data[].correlationId` | string | yes | length 1–64 |
| `data[].deviceModel` | string \| null | yes | at most 64 characters |
| `data[].deviceType` | "DESKTOP" \| "MOBILE" \| "TABLET" \| "BOT" \| "UNKNOWN" \| null | yes |  |
| `data[].durationMs` | integer | yes |  |
| `data[].endpoint` | string | yes | length 1–512 |
| `data[].errorCode` | string \| null | yes | at most 64 characters |
| `data[].geoCity` | string \| null | yes | at most 128 characters |
| `data[].geoCountry` | string \| null | yes | exactly 2 characters |
| `data[].geoRegion` | string \| null | yes | at most 64 characters |
| `data[].geoTimeZone` | string \| null | yes | at most 64 characters |
| `data[].id` | string (uuid) | yes |  |
| `data[].impersonator` | object \| null | yes |  |
| `data[].impersonator.email` | string \| null | yes |  |
| `data[].impersonator.fullName` | string \| null | yes |  |
| `data[].impersonator.id` | string | yes | length 1–64 |
| `data[].ipAddress` | string \| null | yes | at most 64 characters |
| `data[].ipScope` | "PUBLIC" \| "PRIVATE" \| "LOOPBACK" \| "LINK_LOCAL" \| "SHARED" \| "DOCUMENTATION" \| "MULTICAST" \| "RESERVED" \| null | yes |  |
| `data[].ipVersion` | 4 \| 6 \| null | yes |  |
| `data[].locationId` | string \| null | yes | length 1–64 |
| `data[].method` | string | yes | length 1–10 |
| `data[].occurredAt` | integer | yes |  |
| `data[].osName` | string \| null | yes | at most 64 characters |
| `data[].osVersion` | string \| null | yes | at most 32 characters |
| `data[].outcome` | "SUCCEEDED" \| "FAILED" | yes |  |
| `data[].path` | string | yes | length 1–2048 |
| `data[].responseStatus` | integer | yes | range 100–599 |
| `data[].tenant` | object \| null | yes |  |
| `data[].tenant.id` | string | yes | length 1–64 |
| `data[].tenant.name` | string \| null | yes |  |
| `data[].terminalId` | string \| null | yes | length 1–64 |
| `data[].userAgent` | string \| null | yes | at most 512 characters |
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

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/audit-logs/{id}

Get one complete audit record

Includes the redacted request params, request body and response body.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:AUDIT_LOG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuditLogsController_get` · [source](../../../apps/api/src/contexts/audit/presentation/http/audit-logs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The complete audit record

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptLanguage` | string \| null | yes | at most 256 characters |
| `data.actor` | object \| null | yes |  |
| `data.actor.email` | string \| null | yes |  |
| `data.actor.fullName` | string \| null | yes |  |
| `data.actor.id` | string | yes | length 1–64 |
| `data.apiKeyId` | string \| null | yes | length 1–64 |
| `data.authMethod` | "BEARER_TOKEN" \| "SESSION_COOKIE" \| "REFRESH_COOKIE" \| "REFRESH_BODY" \| "API_KEY" \| null | yes |  |
| `data.browserName` | string \| null | yes | at most 64 characters |
| `data.browserVersion` | string \| null | yes | at most 32 characters |
| `data.claimedLocationId` | string \| null | yes | at most 64 characters |
| `data.claimedTenantId` | string \| null | yes | at most 64 characters |
| `data.clientType` | string \| null | yes | at most 32 characters |
| `data.completedAt` | integer | yes |  |
| `data.correlationId` | string | yes | length 1–64 |
| `data.createdAt` | integer | yes |  |
| `data.deviceModel` | string \| null | yes | at most 64 characters |
| `data.deviceType` | "DESKTOP" \| "MOBILE" \| "TABLET" \| "BOT" \| "UNKNOWN" \| null | yes |  |
| `data.durationMs` | integer | yes |  |
| `data.endpoint` | string | yes | length 1–512 |
| `data.errorCode` | string \| null | yes | at most 64 characters |
| `data.errorDetail` | object \| null | yes |  |
| `data.errorDetail.causes` | object[] | yes | 0–5 items |
| `data.errorDetail.causes[].code` | string \| null | yes | length 1–64 |
| `data.errorDetail.causes[].message` | string | yes | at most 2048 characters |
| `data.errorDetail.causes[].type` | string | yes | length 1–128 |
| `data.errorDetail.code` | string \| null | yes | length 1–64 |
| `data.errorDetail.message` | string | yes | at most 2048 characters |
| `data.errorDetail.stack` | string[] | yes | 0–12 items |
| `data.errorDetail.type` | string | yes | length 1–128 |
| `data.geoCity` | string \| null | yes | at most 128 characters |
| `data.geoCountry` | string \| null | yes | exactly 2 characters |
| `data.geoRegion` | string \| null | yes | at most 64 characters |
| `data.geoTimeZone` | string \| null | yes | at most 64 characters |
| `data.host` | string \| null | yes | at most 255 characters |
| `data.httpVersion` | string \| null | yes | at most 8 characters |
| `data.id` | string (uuid) | yes |  |
| `data.idempotencyKey` | string \| null | yes | at most 255 characters |
| `data.impersonationSessionId` | string \| null | yes | length 1–64 |
| `data.impersonator` | object \| null | yes |  |
| `data.impersonator.email` | string \| null | yes |  |
| `data.impersonator.fullName` | string \| null | yes |  |
| `data.impersonator.id` | string | yes | length 1–64 |
| `data.ipAddress` | string \| null | yes | at most 64 characters |
| `data.ipScope` | "PUBLIC" \| "PRIVATE" \| "LOOPBACK" \| "LINK_LOCAL" \| "SHARED" \| "DOCUMENTATION" \| "MULTICAST" \| "RESERVED" \| null | yes |  |
| `data.ipVersion` | 4 \| 6 \| null | yes |  |
| `data.locationId` | string \| null | yes | length 1–64 |
| `data.method` | string | yes | length 1–10 |
| `data.occurredAt` | integer | yes |  |
| `data.origin` | string \| null | yes | at most 512 characters |
| `data.osName` | string \| null | yes | at most 64 characters |
| `data.osVersion` | string \| null | yes | at most 32 characters |
| `data.outcome` | "SUCCEEDED" \| "FAILED" | yes |  |
| `data.path` | string | yes | length 1–2048 |
| `data.referer` | string \| null | yes | at most 2048 characters |
| `data.requestBody` | any JSON \| null | yes |  |
| `data.requestBytes` | integer \| null | yes |  |
| `data.requestContentType` | string \| null | yes | at most 256 characters |
| `data.requestHeaders` | object \| null | yes |  |
| `data.requestParams` | any JSON \| null | yes |  |
| `data.responseBody` | any JSON \| null | yes |  |
| `data.responseStatus` | integer | yes | range 100–599 |
| `data.sessionId` | string \| null | yes | length 1–64 |
| `data.supportAccessGrantId` | string \| null | yes | length 1–64 |
| `data.systemOperations` | string[] | yes |  |
| `data.tenant` | object \| null | yes |  |
| `data.tenant.id` | string | yes | length 1–64 |
| `data.tenant.name` | string \| null | yes |  |
| `data.terminalId` | string \| null | yes | length 1–64 |
| `data.traceId` | string \| null | yes | length 1–64 |
| `data.userAgent` | string \| null | yes | at most 512 characters |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/audit-trail

List the audit trail (newest first)

HTTP requests (with how many rows each changed) and background database writes as one timeline.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:AUDIT_LOG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `AuditTrailController_list` · [source](../../../apps/api/src/contexts/audit/presentation/http/audit-trail.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: occurredAt. Default: -occurredAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: kind, actorUserId, tenantId, correlationId, tableName, rowId, occurredAt, outcome, method, authMethod, deviceType, ipScope, actorKind |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — Paginated timeline entries; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].⟨shape 1⟩ actor` | object \| null | yes |  |
| `data[].⟨shape 1⟩ actor.email` | string \| null | yes |  |
| `data[].⟨shape 1⟩ actor.fullName` | string \| null | yes |  |
| `data[].⟨shape 1⟩ actor.id` | string | yes | length 1–64 |
| `data[].⟨shape 1⟩ apiKeyId` | string \| null | yes | length 1–64 |
| `data[].⟨shape 1⟩ authMethod` | "BEARER_TOKEN" \| "SESSION_COOKIE" \| "REFRESH_COOKIE" \| "REFRESH_BODY" \| "API_KEY" \| null | yes |  |
| `data[].⟨shape 1⟩ browserName` | string \| null | yes | at most 64 characters |
| `data[].⟨shape 1⟩ browserVersion` | string \| null | yes | at most 32 characters |
| `data[].⟨shape 1⟩ changeCount` | integer | yes |  |
| `data[].⟨shape 1⟩ changedTables` | string[] | yes | 0–10 items |
| `data[].⟨shape 1⟩ clientType` | string \| null | yes | at most 32 characters |
| `data[].⟨shape 1⟩ completedAt` | integer | yes |  |
| `data[].⟨shape 1⟩ correlationId` | string | yes | length 1–64 |
| `data[].⟨shape 1⟩ deviceModel` | string \| null | yes | at most 64 characters |
| `data[].⟨shape 1⟩ deviceType` | "DESKTOP" \| "MOBILE" \| "TABLET" \| "BOT" \| "UNKNOWN" \| null | yes |  |
| `data[].⟨shape 1⟩ durationMs` | integer | yes |  |
| `data[].⟨shape 1⟩ endpoint` | string | yes | length 1–512 |
| `data[].⟨shape 1⟩ errorCode` | string \| null | yes | at most 64 characters |
| `data[].⟨shape 1⟩ geoCity` | string \| null | yes | at most 128 characters |
| `data[].⟨shape 1⟩ geoCountry` | string \| null | yes | exactly 2 characters |
| `data[].⟨shape 1⟩ geoRegion` | string \| null | yes | at most 64 characters |
| `data[].⟨shape 1⟩ geoTimeZone` | string \| null | yes | at most 64 characters |
| `data[].⟨shape 1⟩ id` | string (uuid) | yes |  |
| `data[].⟨shape 1⟩ impersonator` | object \| null | yes |  |
| `data[].⟨shape 1⟩ impersonator.email` | string \| null | yes |  |
| `data[].⟨shape 1⟩ impersonator.fullName` | string \| null | yes |  |
| `data[].⟨shape 1⟩ impersonator.id` | string | yes | length 1–64 |
| `data[].⟨shape 1⟩ ipAddress` | string \| null | yes | at most 64 characters |
| `data[].⟨shape 1⟩ ipScope` | "PUBLIC" \| "PRIVATE" \| "LOOPBACK" \| "LINK_LOCAL" \| "SHARED" \| "DOCUMENTATION" \| "MULTICAST" \| "RESERVED" \| null | yes |  |
| `data[].⟨shape 1⟩ ipVersion` | 4 \| 6 \| null | yes |  |
| `data[].⟨shape 1⟩ kind` | "REQUEST" | yes |  |
| `data[].⟨shape 1⟩ locationId` | string \| null | yes | length 1–64 |
| `data[].⟨shape 1⟩ method` | string | yes | length 1–10 |
| `data[].⟨shape 1⟩ occurredAt` | integer | yes |  |
| `data[].⟨shape 1⟩ osName` | string \| null | yes | at most 64 characters |
| `data[].⟨shape 1⟩ osVersion` | string \| null | yes | at most 32 characters |
| `data[].⟨shape 1⟩ outcome` | "SUCCEEDED" \| "FAILED" | yes |  |
| `data[].⟨shape 1⟩ path` | string | yes | length 1–2048 |
| `data[].⟨shape 1⟩ responseStatus` | integer | yes | range 100–599 |
| `data[].⟨shape 1⟩ tenant` | object \| null | yes |  |
| `data[].⟨shape 1⟩ tenant.id` | string | yes | length 1–64 |
| `data[].⟨shape 1⟩ tenant.name` | string \| null | yes |  |
| `data[].⟨shape 1⟩ terminalId` | string \| null | yes | length 1–64 |
| `data[].⟨shape 1⟩ userAgent` | string \| null | yes | at most 512 characters |
| `data[].⟨shape 2⟩ actor` | object \| null | yes |  |
| `data[].⟨shape 2⟩ actor.email` | string \| null | yes |  |
| `data[].⟨shape 2⟩ actor.fullName` | string \| null | yes |  |
| `data[].⟨shape 2⟩ actor.id` | string | yes | length 1–64 |
| `data[].⟨shape 2⟩ actorKind` | "USER" \| "API_KEY" \| "SYSTEM" \| "UNATTRIBUTED" | yes |  |
| `data[].⟨shape 2⟩ apiKeyId` | string \| null | yes | length 1–64 |
| `data[].⟨shape 2⟩ changeCount` | integer | yes |  |
| `data[].⟨shape 2⟩ changedTables` | string[] | yes | 0–10 items |
| `data[].⟨shape 2⟩ correlationId` | string \| null | yes | length 1–64 |
| `data[].⟨shape 2⟩ databaseRole` | string | yes | length 1–63 |
| `data[].⟨shape 2⟩ id` | string (uuid) | yes |  |
| `data[].⟨shape 2⟩ kind` | "BACKGROUND" | yes |  |
| `data[].⟨shape 2⟩ occurredAt` | integer | yes |  |
| `data[].⟨shape 2⟩ operation` | "INSERT" \| "UPDATE" \| "DELETE" \| "TRUNCATE" | yes |  |
| `data[].⟨shape 2⟩ rowId` | string \| null | yes | at most 512 characters |
| `data[].⟨shape 2⟩ systemOperation` | string \| null | yes | length 1–100 |
| `data[].⟨shape 2⟩ tenant` | object \| null | yes |  |
| `data[].⟨shape 2⟩ tenant.id` | string | yes | length 1–64 |
| `data[].⟨shape 2⟩ tenant.name` | string \| null | yes |  |
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

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/audit-trail/events

Live audit trail update stream (SSE)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:AUDIT_LOG`.
- Content type: no request body; returns `text/event-stream` (errors are always `application/json`)
- Operation id `AuditTrailController_stream` · [source](../../../apps/api/src/contexts/audit/presentation/http/audit-trail.controller.ts)

**Response 200 OK** — One `{ updatedAt }` frame per burst of new entries, a `ping` every 25 s (no envelope, no response contract) (`text/event-stream`)

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/data-changes

List row changes (newest first)

Change metadata only — open one record for the redacted row before and after.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:AUDIT_LOG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DataChangesController_list` · [source](../../../apps/api/src/contexts/audit/presentation/http/data-changes.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: occurredAt. Default: -occurredAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: tableName, operation, actorKind, actorUserId, tenantId, apiKeyId, systemOperation, correlationId, rowId, transactionId, occurredAt |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** (`application/json`) — Paginated row-change records; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].actor` | object \| null | yes |  |
| `data[].actor.email` | string \| null | yes |  |
| `data[].actor.fullName` | string \| null | yes |  |
| `data[].actor.id` | string | yes | length 1–64 |
| `data[].actorKind` | "USER" \| "API_KEY" \| "SYSTEM" \| "UNATTRIBUTED" | yes |  |
| `data[].apiKeyId` | string \| null | yes | length 1–64 |
| `data[].changeSequence` | integer | yes |  |
| `data[].changedColumns` | string[] | yes | 0–1600 items |
| `data[].correlationId` | string \| null | yes | length 1–64 |
| `data[].databaseRole` | string | yes | length 1–63 |
| `data[].id` | string (uuid) | yes |  |
| `data[].occurredAt` | integer | yes |  |
| `data[].operation` | "INSERT" \| "UPDATE" \| "DELETE" \| "TRUNCATE" | yes |  |
| `data[].rowId` | string \| null | yes | at most 512 characters |
| `data[].systemOperation` | string \| null | yes | length 1–100 |
| `data[].tableName` | string | yes | length 1–63 |
| `data[].tenant` | object \| null | yes |  |
| `data[].tenant.id` | string | yes | length 1–64 |
| `data[].tenant.name` | string \| null | yes |  |
| `data[].transactionId` | integer | yes |  |
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

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.

### GET /api/v1/admin/data-changes/{id}

Get one complete row-change record

Includes the redacted row images before and after the change.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `READ:AUDIT_LOG`.
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `DataChangesController_get` · [source](../../../apps/api/src/contexts/audit/presentation/http/data-changes.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** (`application/json`) — The complete row-change record

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.actor` | object \| null | yes |  |
| `data.actor.email` | string \| null | yes |  |
| `data.actor.fullName` | string \| null | yes |  |
| `data.actor.id` | string | yes | length 1–64 |
| `data.actorKind` | "USER" \| "API_KEY" \| "SYSTEM" \| "UNATTRIBUTED" | yes |  |
| `data.actorPurpose` | string \| null | yes | length 1–512 |
| `data.apiKeyId` | string \| null | yes | length 1–64 |
| `data.applicationName` | string \| null | yes | length 1–64 |
| `data.changeSequence` | integer | yes |  |
| `data.changedColumns` | string[] | yes | 0–1600 items |
| `data.clientAddress` | string \| null | yes | length 1–64 |
| `data.correlationId` | string \| null | yes | length 1–64 |
| `data.createdAt` | integer | yes |  |
| `data.databaseRole` | string | yes | length 1–63 |
| `data.id` | string (uuid) | yes |  |
| `data.loginRole` | string | yes | length 1–63 |
| `data.newData` | any JSON \| null | yes |  |
| `data.occurredAt` | integer | yes |  |
| `data.oldData` | any JSON \| null | yes |  |
| `data.operation` | "INSERT" \| "UPDATE" \| "DELETE" \| "TRUNCATE" | yes |  |
| `data.rowId` | string \| null | yes | at most 512 characters |
| `data.systemOperation` | string \| null | yes | length 1–100 |
| `data.tableName` | string | yes | length 1–63 |
| `data.tenant` | object \| null | yes |  |
| `data.tenant.id` | string | yes | length 1–64 |
| `data.tenant.name` | string \| null | yes |  |
| `data.transactionId` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

> [!WARNING]
> No captured sample. Add this endpoint to `apps/docs/scripts/capture-api-samples.mjs` and re-run the capture.
