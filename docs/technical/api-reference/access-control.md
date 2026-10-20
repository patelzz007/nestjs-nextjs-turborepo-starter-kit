---
title: "API reference — Roles, permissions, policies and audit"
description: "Platform RBAC administration, authorization decisions, Cedar policy drafts, the capability catalog and the HTTP audit log."
order: 3
author: "Generated from the OpenAPI export"
lastUpdated: 1792454400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — Roles, permissions, policies and audit

Platform RBAC administration, authorization decisions, Cedar policy drafts, the capability catalog and the HTTP audit log.

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
| `data[].name` | string | yes |  |
| `data[].parentId` | string \| null | yes |  |
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
      "id": "01a15a89-6ad1-7113-96cd-976eb40ab187",
      "name": "Admin",
      "description": "Admin panel — manage users, settings, and platform data",
      "isActive": true,
      "parentId": null
    },
    {
      "id": "01a15a89-6ad2-74db-81c9-f881b1e6d66c",
      "name": "Manager",
      "description": "Admin panel — read/update users and reports (no RBAC or system settings)",
      "isActive": true,
      "parentId": null
    }
  ],
  "meta": {
    "limit": 20,
    "total": 8,
    "page": 1,
    "totalPages": 1,
    "nextCursor": null,
    "hasNext": false,
    "hasPrevious": false,
    "correlationId": "EzeTFTmtiODmX4FzbHIne",
    "timestamp": 1792520433941
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
| `parentId` | string (uuid) | no | Parent role ID for role hierarchy |

**Response 201 Created** (`application/json`) — Created role

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data._count` | object | no |  |
| `data._count.rolePermissions` | number | yes |  |
| `data._count.userRoles` | number | yes |  |
| `data.children` | object[] | no |  |
| `data.children[].id` | string | yes |  |
| `data.children[].isActive` | boolean | yes |  |
| `data.children[].name` | string | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.parent` | object \| null | no |  |
| `data.parent.id` | string | yes |  |
| `data.parent.name` | string | yes |  |
| `data.parentId` | string \| null | yes |  |
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
  "description": "Reads geography and audit data for store reviews",
  "parentId": "01a15a89-6ad6-72cd-8e42-f9e9bfec3693"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520434083,
    "updatedAt": 1792520434083,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-31a6-7def-b26b-228d8e661457",
    "name": "Store Auditor",
    "description": "Reads geography and audit data for store reviews",
    "isActive": true,
    "isSystem": false,
    "parentId": "01a15a89-6ad6-72cd-8e42-f9e9bfec3693"
  },
  "meta": {
    "correlationId": "AlCH12HuO5nZ6ORpYVqZ7",
    "timestamp": 1792520434119
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
| `data.children` | object[] | no |  |
| `data.children[].id` | string | yes |  |
| `data.children[].isActive` | boolean | yes |  |
| `data.children[].name` | string | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.parent` | object \| null | no |  |
| `data.parent.id` | string | yes |  |
| `data.parent.name` | string | yes |  |
| `data.parentId` | string \| null | yes |  |
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
GET /api/v1/admin/roles/01a15a89-6ad2-74db-81c9-f881b1e6d66c
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520317639,
    "updatedAt": 1792520317639,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a89-6ad2-74db-81c9-f881b1e6d66c",
    "name": "Manager",
    "description": "Admin panel — read/update users and reports (no RBAC or system settings)",
    "isActive": true,
    "isSystem": true,
    "parentId": null
  },
  "meta": {
    "correlationId": "tnodvqN0FN5uIq_mmnpE7",
    "timestamp": 1792520434037
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
| `data.children` | object[] | no |  |
| `data.children[].id` | string | yes |  |
| `data.children[].isActive` | boolean | yes |  |
| `data.children[].name` | string | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.parent` | object \| null | no |  |
| `data.parent.id` | string | yes |  |
| `data.parent.name` | string | yes |  |
| `data.parentId` | string \| null | yes |  |
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
PATCH /api/v1/admin/roles/01a15a8b-31a6-7def-b26b-228d8e661457
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
    "createdAt": 1792520434083,
    "updatedAt": 1792520434166,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-31a6-7def-b26b-228d8e661457",
    "name": "Store Auditor",
    "description": "Reads geography, audit and analytics data for store reviews",
    "isActive": true,
    "isSystem": false,
    "parentId": "01a15a89-6ad6-72cd-8e42-f9e9bfec3693"
  },
  "meta": {
    "correlationId": "sE531RG7cebx8lK1hLoKu",
    "timestamp": 1792520434182
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
DELETE /api/v1/admin/roles/01a15a8b-31a6-7def-b26b-228d8e661457
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
    "correlationId": "3nfIJPx4ymjaMMYEtc2Gh",
    "timestamp": 1792520434778
  }
}
```

### PATCH /api/v1/admin/roles/{id}/parent

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `RolesController_setParent` · [source](../../../apps/api/src/contexts/authorization/presentation/http/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `parentId` | string (uuid) \| null | yes | New parent role ID (null to remove parent) |

**Response 200 OK** (`application/json`) — Parent role updated

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data._count` | object | no |  |
| `data._count.rolePermissions` | number | yes |  |
| `data._count.userRoles` | number | yes |  |
| `data.children` | object[] | no |  |
| `data.children[].id` | string | yes |  |
| `data.children[].isActive` | boolean | yes |  |
| `data.children[].name` | string | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.parent` | object \| null | no |  |
| `data.parent.id` | string | yes |  |
| `data.parent.name` | string | yes |  |
| `data.parentId` | string \| null | yes |  |
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
PATCH /api/v1/admin/roles/01a15a8b-31a6-7def-b26b-228d8e661457/parent
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "parentId": "01a15a89-6ad2-74db-81c9-f881b1e6d66c"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520434083,
    "updatedAt": 1792520434226,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-31a6-7def-b26b-228d8e661457",
    "name": "Store Auditor",
    "description": "Reads geography, audit and analytics data for store reviews",
    "isActive": true,
    "isSystem": false,
    "parentId": "01a15a89-6ad2-74db-81c9-f881b1e6d66c"
  },
  "meta": {
    "correlationId": "jtvrkSPgvjP37y4lijeoB",
    "timestamp": 1792520434245
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
POST /api/v1/admin/roles/01a15a8b-31a6-7def-b26b-228d8e661457/permissions
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "permissionIds": [
    "01a15a89-6a9b-736d-96cc-f840d067ccf7"
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
    "correlationId": "2CVkPLVTiIjWL_MpcsCYm",
    "timestamp": 1792520434313
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
| `data.children` | object[] | no |  |
| `data.children[].id` | string | yes |  |
| `data.children[].isActive` | boolean | yes |  |
| `data.children[].name` | string | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isActive` | boolean | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | no |  |
| `data.name` | string | yes |  |
| `data.parent` | object \| null | no |  |
| `data.parent.id` | string | yes |  |
| `data.parent.name` | string | yes |  |
| `data.parentId` | string \| null | yes |  |
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
POST /api/v1/admin/roles/01a15a8b-31a6-7def-b26b-228d8e661457/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520434083,
    "updatedAt": 1792520434827,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-31a6-7def-b26b-228d8e661457",
    "name": "Store Auditor",
    "description": "Reads geography, audit and analytics data for store reviews",
    "isActive": true,
    "isSystem": false,
    "parentId": "01a15a89-6ad2-74db-81c9-f881b1e6d66c"
  },
  "meta": {
    "correlationId": "BBUyLfizkvrGDe5kByjeg",
    "timestamp": 1792520434843
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
POST /api/v1/admin/roles/01a15a8b-31a6-7def-b26b-228d8e661457/validate-assignment
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "01a15a89-7039-7528-be2d-f1389ef5d2ef",
  "roleIds": [
    "01a15a8b-31a6-7def-b26b-228d8e661457"
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
    "correlationId": "HXBNZqQRd97AueeifLrvK",
    "timestamp": 1792520434351
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
  "userId": "01a15a89-7039-7528-be2d-f1389ef5d2ef",
  "roleIds": [
    "01a15a89-6ad6-72cd-8e42-f9e9bfec3693",
    "01a15a8b-31a6-7def-b26b-228d8e661457"
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
      "READ:GEO",
      "READ:USER"
    ],
    "permissionsLost": []
  },
  "meta": {
    "correlationId": "B__4WvZumtv7_aTZNeK9c",
    "timestamp": 1792520434399
  }
}
```

### POST /api/v1/admin/roles/user/assign

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
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
  "userId": "01a15a89-7039-7528-be2d-f1389ef5d2ef",
  "roleId": "01a15a8b-31a6-7def-b26b-228d8e661457"
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
    "correlationId": "ZJbyvhrMRa4KyjqF3zynM",
    "timestamp": 1792520434479
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
  "userId": "01a15a89-7039-7528-be2d-f1389ef5d2ef",
  "roleId": "01a15a8b-31a6-7def-b26b-228d8e661457"
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
    "correlationId": "EbKIA7DoloMUTrxf2Twqb",
    "timestamp": 1792520434568
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
  "userId": "01a15a89-7039-7528-be2d-f1389ef5d2ef",
  "roleIds": [
    "01a15a89-6ad6-72cd-8e42-f9e9bfec3693"
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
    "correlationId": "u-lI085V2FjqHiorfXS7x",
    "timestamp": 1792520434693
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
| `data[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `data[].description` | string \| null | yes |  |
| `data[].group` | string \| null | yes |  |
| `data[].id` | string | yes |  |
| `data[].isSystem` | boolean | yes |  |
| `data[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes |  |
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
      "id": "01a15a89-6a9a-75d3-a976-b8a6f9c313cd",
      "action": "READ",
      "resource": "ADMIN_DASHBOARD",
      "description": "Access admin dashboard",
      "group": "Admin Dashboard",
      "isSystem": false
    },
    {
      "id": "01a15a89-6a9a-75d3-a976-bf7aadd18471",
      "action": "MANAGE",
      "resource": "ADMIN_DASHBOARD",
      "description": "Full admin dashboard access",
      "group": "Admin Dashboard",
      "isSystem": false
    }
  ],
  "meta": {
    "limit": 3,
    "total": 96,
    "page": 1,
    "totalPages": 32,
    "nextCursor": null,
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "kTjvd4ALWiwWjE7EzHESL",
    "timestamp": 1792520433193
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
| `action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes | The action this permission grants |
| `description` | string | no | Permission description |
| `group` | string | no | Permission group/category |
| `resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes | The resource this permission applies to |

**Response 201 Created** (`application/json`) — Created permission

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `data.conditions` | any JSON \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.group` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | yes |  |
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes |  |
| `data.scope` | "GLOBAL" \| "TENANT" \| "STORE" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
  "action": "MANAGE",
  "resource": "INVENTORY",
  "group": "Reports",
  "description": "Manage inventory records"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520433388,
    "updatedAt": 1792520433388,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-2eef-78cf-8581-eba28029e25d",
    "action": "MANAGE",
    "resource": "INVENTORY",
    "description": "Manage inventory records",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL",
    "conditions": null
  },
  "meta": {
    "correlationId": "_ApbveAX9kEDTsbjBcpeD",
    "timestamp": 1792520433401
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
| `data.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `data.conditions` | any JSON \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.group` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | yes |  |
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes |  |
| `data.scope` | "GLOBAL" \| "TENANT" \| "STORE" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
GET /api/v1/admin/permissions/01a15a89-6a9b-736d-96cc-f840d067ccf7
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520317552,
    "updatedAt": 1792520317552,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a89-6a9b-736d-96cc-f840d067ccf7",
    "action": "READ",
    "resource": "GEO",
    "description": "View geographic data (regions, countries, states, cities)",
    "group": "Geo",
    "isSystem": false,
    "scope": "GLOBAL",
    "conditions": null
  },
  "meta": {
    "correlationId": "khMhBt5NE_0PorVzvzZhQ",
    "timestamp": 1792520433273
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
| `data.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `data.conditions` | any JSON \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.group` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | yes |  |
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes |  |
| `data.scope` | "GLOBAL" \| "TENANT" \| "STORE" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
PATCH /api/v1/admin/permissions/01a15a8b-2eef-78cf-8581-eba28029e25d
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "description": "Manage every inventory record"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520433388,
    "updatedAt": 1792520433440,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-2eef-78cf-8581-eba28029e25d",
    "action": "MANAGE",
    "resource": "INVENTORY",
    "description": "Manage every inventory record",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL",
    "conditions": null
  },
  "meta": {
    "correlationId": "m7EM4GgMBXAg3_N-Bkh-L",
    "timestamp": 1792520433453
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
DELETE /api/v1/admin/permissions/01a15a8b-2eef-78cf-8581-eba28029e25d
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
    "correlationId": "A_dwf4kaEWFfMtv3JHYHR",
    "timestamp": 1792520433507
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
| `data.action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `data.conditions` | any JSON \| null | yes |  |
| `data.createdAt` | integer | yes | Epoch milliseconds when the record was created |
| `data.deletedAt` | integer \| null | yes | Epoch milliseconds when soft-delete occurred, or null if active |
| `data.description` | string \| null | yes |  |
| `data.group` | string \| null | yes |  |
| `data.id` | string | yes |  |
| `data.isDeleted` | boolean | yes | Soft-delete flag — false means the record is active |
| `data.isSystem` | boolean | yes |  |
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes |  |
| `data.scope` | "GLOBAL" \| "TENANT" \| "STORE" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
POST /api/v1/admin/permissions/01a15a8b-2eef-78cf-8581-eba28029e25d/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1792520433388,
    "updatedAt": 1792520433551,
    "isDeleted": false,
    "deletedAt": null,
    "id": "01a15a8b-2eef-78cf-8581-eba28029e25d",
    "action": "MANAGE",
    "resource": "INVENTORY",
    "description": "Manage every inventory record",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL",
    "conditions": null
  },
  "meta": {
    "correlationId": "qD5KGkBtC-Q-W-HQk9j5q",
    "timestamp": 1792520433579
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
| `action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes | The action to check |
| `resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes | The resource to check against |
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
  "userId": "01a15a89-7005-7762-9f2f-9abce72a4081",
  "action": "READ",
  "resource": "GEO"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "allowed": false,
    "grants": []
  },
  "meta": {
    "correlationId": "6Hu7omBkCl5quLANG_Ikd",
    "timestamp": 1792520433352
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
    "correlationId": "blTRtT-5shfBjI0U-8HYp",
    "timestamp": 1792520433301
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
  "userId": "01a15a89-7005-7762-9f2f-9abce72a4081",
  "permissionId": "01a15a89-6a9b-736d-96cc-f840d067ccf7",
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
    "correlationId": "FZFc3JoDyhcIjwXMVGpfe",
    "timestamp": 1792520433654
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
  "userId": "01a15a89-7005-7762-9f2f-9abce72a4081",
  "permissionId": "01a15a89-6a9b-736d-96cc-f840d067ccf7"
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
    "correlationId": "SHAzUSmvy-htWR7OB-J4i",
    "timestamp": 1792520433745
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
  "userId": "01a15a89-7005-7762-9f2f-9abce72a4081",
  "permissionIds": [
    "01a15a89-6a9b-736d-96cc-f840d067ccf7"
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
    "correlationId": "5LxliEAhFirIMT6erVb_z",
    "timestamp": 1792520433898
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
| `checks[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `checks[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes |  |
| `checks[].resourceId` | string | no | length 1–64 |

**Response 200 OK** (`application/json`) — One decision per requested check, in request order

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.results` | object[] | yes |  |
| `data.results[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `data.results[].allowed` | boolean | yes |  |
| `data.results[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes |  |
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
    "correlationId": "UcX_iMiUC_sqrrNTkxuaB",
    "timestamp": 1792520434877
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
| `action` | query | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `resource` | query | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "ANALYTICS" \| "AUDIT_LOG" \| "REPORT" \| "EMAIL" \| … (+15 more) | yes |  |
| `resourceId` | query | string | no |  |
| `userId` | query | string | no |  |
| `tenantId` | query | string | no |  |
| `storeId` | query | string | no |  |
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
| `data.evaluation[].source` | "superadmin" \| "validation" \| "tenant" \| "override" \| "acl" \| "role" \| "scope" \| "policy" \| "ownership" \| "relationship" \| … (+1 more) | yes |  |
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
| `data.request.subject.storeId` | string | no |  |
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
GET /api/v1/authorization/decisions/explain?action=READ&resource=GEO&userId=01a15a89-7005-7762-9f2f-9abce72a4081
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
        "userId": "01a15a89-7005-7762-9f2f-9abce72a4081",
        "isSuperAdmin": false
      },
      "action": "READ",
      "resource": "GEO"
    },
    "evaluation": [
      {
        "source": "acl",
        "effect": "NO_MATCH",
        "reason": "No explicit ACL entry"
      },
      {
        "source": "scope",
        "effect": "ALLOW",
        "reason": "GLOBAL grant",
        "details": {
          "grantSource": "override",
          "grantScope": "GLOBAL"
        }
      }
    ],
    "durationMs": 36
  },
  "meta": {
    "correlationId": "PeZpWrqrwrVhL9l9Uf-BS",
    "timestamp": 1792520434948
  }
}
```

## Authorization Policies

### POST /api/v1/policies/drafts

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `MANAGE:SYSTEM_SETTINGS`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PolicyControlPlaneController_createDraft` · [source](../../../apps/api/src/contexts/authorization/presentation/http/policy-control-plane.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `builderPayload` | object | yes |  |
| `builderPayload.parameters` | object | yes |  |
| `builderPayload.templateId` | string | yes |  |
| `description` | string | no | at most 2000 characters |
| `name` | string | yes | length 1–120 |
| `scope` | "PLATFORM_GUARDRAIL" \| "PLATFORM" \| "TENANT" | yes |  |
| `tenantId` | string (uuid) | no |  |

**Response 201 Created** (`application/json`) — Policy draft created

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.draftId` | string (uuid) | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/policies/drafts
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "name": "Brew & Bean KL — owners and admins manage rewards",
  "description": "Tenant role-capability policy for Brew & Bean KL",
  "scope": "TENANT",
  "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
  "builderPayload": {
    "templateId": "tenant.role_capability",
    "parameters": {
      "allowedRoles": [
        "OWNER",
        "ADMIN"
      ]
    }
  }
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "draftId": "01a15a8b-35be-787d-8e88-0fd6f7918dbf"
  },
  "meta": {
    "correlationId": "AvGK_flpV_mhB-7rVFV1w",
    "timestamp": 1792520435153
  }
}
```

### POST /api/v1/policies/drafts/{draftId}/simulate

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `MANAGE:SYSTEM_SETTINGS`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: no request body; returns `application/json` (errors are always `application/json`)
- Operation id `PolicyControlPlaneController_simulate` · [source](../../../apps/api/src/contexts/authorization/presentation/http/policy-control-plane.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `draftId` | path | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Policy simulation result

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.affectedPrincipalCount` | integer | yes |  |
| `data.decisionChanges` | object[] | yes |  |
| `data.decisionChanges[].action` | string | yes |  |
| `data.decisionChanges[].after` | "Allow" \| "Deny" | yes |  |
| `data.decisionChanges[].before` | "Allow" \| "Deny" | yes |  |
| `data.decisionChanges[].membershipRole` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
| `data.decisionChanges[].tenantId` | string (uuid) | yes |  |
| `data.decisionChanges[].userId` | string (uuid) | yes |  |
| `data.decisionChangesTruncated` | boolean | yes |  |
| `data.errors` | string[] | yes |  |
| `data.evaluatedPrincipalCount` | integer | yes |  |
| `data.passed` | boolean | yes |  |
| `data.simulationId` | string (uuid) | yes |  |
| `data.warnings` | string[] | yes |  |
| `data.wouldLockOutOwners` | boolean | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel).

```http
POST /api/v1/policies/drafts/01a15a8b-35be-787d-8e88-0fd6f7918dbf/simulate
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "simulationId": "01a15a8b-3616-7ee2-a058-a38eb2a8f181",
    "passed": true,
    "warnings": [
      "2 principal(s) would get at least one different decision"
    ],
    "errors": [],
    "evaluatedPrincipalCount": 3,
    "affectedPrincipalCount": 2,
    "wouldLockOutOwners": false,
    "decisionChanges": [
      {
        "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
        "userId": "019b76da-a800-7965-b8a4-624b6c755c16",
        "membershipRole": "CASHIER",
        "action": "tenant:view_rewards",
        "before": "Allow",
        "after": "Deny"
      },
      {
        "tenantId": "019b76da-a800-7a94-a198-23ad1b4cfdd9",
        "userId": "019b76da-a800-7965-b8a4-624b6c755c16",
        "membershipRole": "CASHIER",
        "action": "tenant:manage_rewards",
        "before": "Allow",
        "after": "Deny"
      }
    ],
    "decisionChangesTruncated": false
  },
  "meta": {
    "correlationId": "sJQWbDdn6f6tvzOAdG3fB",
    "timestamp": 1792520435234
  }
}
```

### POST /api/v1/policies/publish

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `MANAGE:SYSTEM_SETTINGS`.
- Rate limit: 10 requests per 60 s per signed-in principal (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Content type: accepts `application/json`; returns `application/json` (errors are always `application/json`)
- Operation id `PolicyControlPlaneController_publish` · [source](../../../apps/api/src/contexts/authorization/presentation/http/policy-control-plane.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `approvalNote` | string | no | at most 500 characters |
| `draftId` | string (uuid) | yes |  |

**Response 201 Created** (`application/json`) — Published policy version (approved by a second SuperAdmin)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.version` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | The path, query or body failed the shared zod schema; `error.details.issues` lists each field. |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `TOKEN_VERSION_MISMATCH`, … | No valid session — sign in again or refresh. |
| 403 | `PERMISSION_DENIED`, `SUPER_ADMIN_REQUIRED`, … | The caller lacks the permission or role above. |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as superadmin@example.com (admin panel). Four-eyes rule: a draft is published by a SECOND SuperAdmin. The seed has one SuperAdmin, so this sample shows the author being refused; a different SuperAdmin gets 201 with the published policy.

```http
POST /api/v1/policies/publish
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "draftId": "01a15a8b-35be-787d-8e88-0fd6f7918dbf",
  "approvalNote": "Reviewed against the tenant guardrails"
}
```

Response `403 Forbidden` (application/json):

```json
{
  "success": false,
  "error": {
    "code": "POLICY_SELF_APPROVAL_FORBIDDEN",
    "message": "A policy draft must be approved by a SuperAdmin other than its author"
  },
  "meta": {
    "correlationId": "xc-BD-M4gPEa2LZjfDO5o",
    "timestamp": 1792520435272
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
      "id": "01a15a89-6bb6-76bf-bc44-b95bb58b4fc4",
      "slug": "merchant:view_dashboard",
      "scope": "MERCHANT",
      "label": "View dashboard",
      "description": "Access the merchant home dashboard and summary widgets.",
      "groupName": "Overview",
      "sortOrder": 0,
      "isSystem": true
    },
    {
      "id": "01a15a89-6b49-7732-9645-0e0079486864",
      "slug": "platform:admin_dashboard.manage",
      "scope": "PLATFORM",
      "label": "Full admin dashboard access",
      "description": "Full admin dashboard access",
      "groupName": "Admin Dashboard",
      "sortOrder": 0,
      "isSystem": false
    }
  ],
  "meta": {
    "correlationId": "3i2VeEyUrZibmTBFsArTz",
    "timestamp": 1792520434996
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
      "createdAt": 1792520435061,
      "updatedAt": 1792520435061,
      "id": "01a15a8b-3576-77b9-8491-a4dab3c6e217",
      "actor": {
        "kind": "USER",
        "userId": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
        "impersonatorId": null
      },
      "targetUserId": null,
      "targetRoleId": null,
      "permissionId": null,
      "action": "SUPER_ADMIN_BYPASS",
      "detail": "Bypassed authorization for list at GET /api/v1/admin/audit?limit=2"
    },
    {
      "createdAt": 1792520434901,
      "updatedAt": 1792520434901,
      "id": "01a15a8b-34d6-768e-af09-39fdf215cea7",
      "actor": {
        "kind": "USER",
        "userId": "01a15a89-6fe5-753f-8ef2-a28d8210e0e0",
        "impersonatorId": null
      },
      "targetUserId": null,
      "targetRoleId": null,
      "permissionId": null,
      "action": "SUPER_ADMIN_BYPASS",
      "detail": "Bypassed authorization for explain at GET /api/v1/authorization/decisions/explain?action=READ&resource=GEO&userId=01a15a89-7005-7762-9f2f-9abce72a4081"
    }
  ],
  "meta": {
    "limit": 2,
    "total": 110,
    "page": 1,
    "totalPages": 55,
    "nextCursor": "eyJhdCI6MTc5MjUyMDQzNDkwMSwiaWQiOiIwMWExNWE4Yi0zNGQ2LTc2OGUtYWYwOS0zOWZkZjIxNWNlYTcifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "gWRj83ml4-vzF1rurGBiI",
    "timestamp": 1792520435077
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
| `data[].storeId` | string \| null | yes | length 1–64 |
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
| `data.clientType` | string \| null | yes | at most 32 characters |
| `data.completedAt` | integer | yes |  |
| `data.correlationId` | string | yes | length 1–64 |
| `data.createdAt` | integer | yes |  |
| `data.deviceModel` | string \| null | yes | at most 64 characters |
| `data.deviceType` | "DESKTOP" \| "MOBILE" \| "TABLET" \| "BOT" \| "UNKNOWN" \| null | yes |  |
| `data.durationMs` | integer | yes |  |
| `data.endpoint` | string | yes | length 1–512 |
| `data.errorCode` | string \| null | yes | at most 64 characters |
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
| `data.requestParams` | any JSON \| null | yes |  |
| `data.responseBody` | any JSON \| null | yes |  |
| `data.responseStatus` | integer | yes | range 100–599 |
| `data.storeId` | string \| null | yes | length 1–64 |
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
| `data[].⟨shape 1⟩ storeId` | string \| null | yes | length 1–64 |
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
