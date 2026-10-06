---
title: "API reference — Roles, permissions, policies and audit"
description: "Platform RBAC administration, authorization decisions, Cedar policy drafts, the capability catalog and the HTTP audit log."
order: 3
author: "Generated from the OpenAPI export"
lastUpdated: 1791158400000
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
- Operation id `RolesController_list` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Response 200 OK** — List of roles

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.items` | object[] | yes |  |
| `data.items[].description` | string \| null | yes |  |
| `data.items[].id` | string | yes |  |
| `data.items[].isActive` | boolean | yes |  |
| `data.items[].name` | string | yes |  |
| `data.items[].parentId` | string \| null | yes |  |
| `data.total` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
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
  "data": {
    "items": [
      {
        "id": "6b129548-41be-4834-b36a-a15cf3b7e855",
        "name": "Admin",
        "description": "Admin panel — manage users, settings, and platform data",
        "isActive": true,
        "parentId": null
      },
      {
        "id": "ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca",
        "name": "Manager",
        "description": "Admin panel — read/update users and reports (no RBAC or system settings)",
        "isActive": true,
        "parentId": null
      }
    ],
    "total": 8
  },
  "meta": {
    "correlationId": "id2-7M4N2wJXVGrslt3XW",
    "timestamp": 1791193324303
  }
}
```

### POST /api/v1/admin/roles

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `CREATE:ROLE`.
- **Policy** `CREATE:ROLE` — Create new role.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_create` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string | no | Role description |
| `name` | string | yes | Role name; at most 100 characters |
| `parentId` | string (uuid) | no | Parent role ID for role hierarchy |

**Response 201 Created** — Created role

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
  "parentId": "4c3114ed-b0a8-48af-b3eb-900d1e7ce1ec"
}
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193324349,
    "updatedAt": 1791193324349,
    "isDeleted": false,
    "deletedAt": null,
    "id": "4c089d88-90b8-4b32-970a-fc37eee785ec",
    "name": "Store Auditor",
    "description": "Reads geography and audit data for store reviews",
    "isActive": true,
    "isSystem": false,
    "parentId": "4c3114ed-b0a8-48af-b3eb-900d1e7ce1ec"
  },
  "meta": {
    "correlationId": "MILfVfWwlOqyNoZgZB41w",
    "timestamp": 1791193324362
  }
}
```

### GET /api/v1/admin/roles/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:ROLE`.
- Operation id `RolesController_detail` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** — Role detail (404 NOT_FOUND when no live role has that id)

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
GET /api/v1/admin/roles/ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193087695,
    "updatedAt": 1791193087695,
    "isDeleted": false,
    "deletedAt": null,
    "id": "ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca",
    "name": "Manager",
    "description": "Admin panel — read/update users and reports (no RBAC or system settings)",
    "isActive": true,
    "isSystem": true,
    "parentId": null
  },
  "meta": {
    "correlationId": "tCFI7LMubyhOg22WSyIIr",
    "timestamp": 1791193324333
  }
}
```

### PATCH /api/v1/admin/roles/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_update` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

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

**Response 200 OK** — Updated role

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
PATCH /api/v1/admin/roles/4c089d88-90b8-4b32-970a-fc37eee785ec
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
    "createdAt": 1791193324349,
    "updatedAt": 1791193324389,
    "isDeleted": false,
    "deletedAt": null,
    "id": "4c089d88-90b8-4b32-970a-fc37eee785ec",
    "name": "Store Auditor",
    "description": "Reads geography, audit and analytics data for store reviews",
    "isActive": true,
    "isSystem": false,
    "parentId": "4c3114ed-b0a8-48af-b3eb-900d1e7ce1ec"
  },
  "meta": {
    "correlationId": "-T66j1FN7u9cy_GHqcLQQ",
    "timestamp": 1791193324392
  }
}
```

### DELETE /api/v1/admin/roles/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `DELETE:ROLE`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_remove` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** — Role deleted

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
DELETE /api/v1/admin/roles/4c089d88-90b8-4b32-970a-fc37eee785ec
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
    "correlationId": "SvIrd9BgQ2S7klSKjVVyK",
    "timestamp": 1791193324648
  }
}
```

### PATCH /api/v1/admin/roles/{id}/parent

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_setParent` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `parentId` | string (uuid) \| null | yes | New parent role ID (null to remove parent) |

**Response 200 OK** — Parent role updated

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
PATCH /api/v1/admin/roles/4c089d88-90b8-4b32-970a-fc37eee785ec/parent
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "parentId": "ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca"
}
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193324349,
    "updatedAt": 1791193324424,
    "isDeleted": false,
    "deletedAt": null,
    "id": "4c089d88-90b8-4b32-970a-fc37eee785ec",
    "name": "Store Auditor",
    "description": "Reads geography, audit and analytics data for store reviews",
    "isActive": true,
    "isSystem": false,
    "parentId": "ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca"
  },
  "meta": {
    "correlationId": "bWKsbEdUz9Hf1CY4nmQQO",
    "timestamp": 1791193324427
  }
}
```

### POST /api/v1/admin/roles/{id}/permissions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_syncPermissions` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `permissionIds` | string (uuid)[] | yes | List of permission IDs to assign or remove; 1–∞ items |

**Response 201 Created** — Role permissions synced

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
POST /api/v1/admin/roles/4c089d88-90b8-4b32-970a-fc37eee785ec/permissions
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "permissionIds": [
    "365034f1-9de4-4a8d-bd96-0eb1ea9c2cb8"
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
    "correlationId": "gOyyWOElMLy98DpOdmQCs",
    "timestamp": 1791193324461
  }
}
```

### POST /api/v1/admin/roles/{id}/restore

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_restore` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 201 Created** — Restored role

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
POST /api/v1/admin/roles/4c089d88-90b8-4b32-970a-fc37eee785ec/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193324349,
    "updatedAt": 1791193324669,
    "isDeleted": false,
    "deletedAt": null,
    "id": "4c089d88-90b8-4b32-970a-fc37eee785ec",
    "name": "Store Auditor",
    "description": "Reads geography, audit and analytics data for store reviews",
    "isActive": true,
    "isSystem": false,
    "parentId": "ef3530bc-8d3d-463c-bc1c-ecc62fd0dcca"
  },
  "meta": {
    "correlationId": "y9ohp1XVe5u96A0jQFSKE",
    "timestamp": 1791193324673
  }
}
```

### POST /api/v1/admin/roles/{id}/validate-assignment

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_validateAssignment` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleIds` | string (uuid)[] | yes | Role IDs to simulate assigning |
| `userId` | string (uuid) | yes | User ID to validate assignment for |

**Response 201 Created** — Conflict validation result

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
POST /api/v1/admin/roles/4c089d88-90b8-4b32-970a-fc37eee785ec/validate-assignment
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
Content-Type: application/json

{
  "userId": "e8ae4ca8-7cca-4400-955d-bdfb154f0f96",
  "roleIds": [
    "4c089d88-90b8-4b32-970a-fc37eee785ec"
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
    "correlationId": "_u06krdI3-dl4bSnlJWqJ",
    "timestamp": 1791193324490
  }
}
```

### POST /api/v1/admin/roles/preview

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:ROLE`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_preview` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleIds` | string (uuid)[] | yes | Role IDs to simulate assigning |
| `userId` | string (uuid) | yes | User ID to validate assignment for |

**Response 201 Created** — Preview of what permissions would change

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
  "userId": "e8ae4ca8-7cca-4400-955d-bdfb154f0f96",
  "roleIds": [
    "4c3114ed-b0a8-48af-b3eb-900d1e7ce1ec",
    "4c089d88-90b8-4b32-970a-fc37eee785ec"
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
    "correlationId": "Xloz3yYDCLoO5GCLN8xht",
    "timestamp": 1791193324527
  }
}
```

### POST /api/v1/admin/roles/user/assign

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- **Policy** `UPDATE:USER` — Assign role to user.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_assignRoleToUser` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleId` | string (uuid) | yes | Role ID |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** — Role assigned to user

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
  "userId": "e8ae4ca8-7cca-4400-955d-bdfb154f0f96",
  "roleId": "4c089d88-90b8-4b32-970a-fc37eee785ec"
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
    "correlationId": "Y3pqxIFNk7Ug4XUWn-nem",
    "timestamp": 1791193324560
  }
}
```

### POST /api/v1/admin/roles/user/remove

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_removeRoleFromUser` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleId` | string (uuid) | yes | Role ID |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** — Role removed from user

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
  "userId": "e8ae4ca8-7cca-4400-955d-bdfb154f0f96",
  "roleId": "4c089d88-90b8-4b32-970a-fc37eee785ec"
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
    "correlationId": "84auXSzPaaEoZdbl-xpC6",
    "timestamp": 1791193324586
  }
}
```

### POST /api/v1/admin/roles/user/sync

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:ROLE`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `RolesController_syncUserRoles` · [source](../../../apps/api/src/modules/authorization/admin/roles.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `roleIds` | string (uuid)[] | yes | Complete list of role IDs the user should have |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** — User roles synced

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
  "userId": "e8ae4ca8-7cca-4400-955d-bdfb154f0f96",
  "roleIds": [
    "4c3114ed-b0a8-48af-b3eb-900d1e7ce1ec"
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
    "correlationId": "XlF3BLyp8EOyfFO06LXPn",
    "timestamp": 1791193324618
  }
}
```

## Permissions

### GET /api/v1/admin/permissions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:PERMISSION`.
- Operation id `PermissionsController_list` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Response 200 OK** — List of permissions

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.items` | object[] | yes |  |
| `data.items[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `data.items[].description` | string \| null | yes |  |
| `data.items[].group` | string \| null | yes |  |
| `data.items[].id` | string | yes |  |
| `data.items[].isSystem` | boolean | yes |  |
| `data.items[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes |  |
| `data.total` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
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
  "data": {
    "items": [
      {
        "id": "8645327b-3853-40e8-a895-897b948f3b7d",
        "action": "CREATE",
        "resource": "USER",
        "description": "Create new users",
        "group": "User Management",
        "isSystem": false
      },
      {
        "id": "7c220360-19dc-4546-950c-d0a48cad6177",
        "action": "READ",
        "resource": "USER",
        "description": "View user details",
        "group": "User Management",
        "isSystem": false
      }
    ],
    "total": 126
  },
  "meta": {
    "correlationId": "n82Rse82ereJh2n4a-HN0",
    "timestamp": 1791193323935
  }
}
```

### POST /api/v1/admin/permissions

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `CREATE:PERMISSION`.
- **Policy** `CREATE:PERMISSION` — Create new permission.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PermissionsController_create` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes | The action this permission grants |
| `description` | string | no | Permission description |
| `group` | string | no | Permission group/category |
| `resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes | The resource this permission applies to |

**Response 201 Created** — Created permission

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
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes |  |
| `data.scope` | "GLOBAL" \| "ORGANIZATION" \| "STORE" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
    "createdAt": 1791193324078,
    "updatedAt": 1791193324078,
    "isDeleted": false,
    "deletedAt": null,
    "id": "bbde0c64-3f12-436b-affb-0c607834e398",
    "action": "MANAGE",
    "resource": "INVENTORY",
    "description": "Manage inventory records",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL",
    "conditions": null
  },
  "meta": {
    "correlationId": "_6OCalHSER3qFH4r5NF5X",
    "timestamp": 1791193324086
  }
}
```

### GET /api/v1/admin/permissions/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PERMISSION`.
- Operation id `PermissionsController_detail` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** — Permission detail (404 NOT_FOUND when no live permission has that id)

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
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes |  |
| `data.scope` | "GLOBAL" \| "ORGANIZATION" \| "STORE" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
GET /api/v1/admin/permissions/365034f1-9de4-4a8d-bd96-0eb1ea9c2cb8
X-Client-Type: admin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193087621,
    "updatedAt": 1791193087621,
    "isDeleted": false,
    "deletedAt": null,
    "id": "365034f1-9de4-4a8d-bd96-0eb1ea9c2cb8",
    "action": "READ",
    "resource": "GEO",
    "description": "View geographic data (regions, countries, states, cities)",
    "group": "Geo",
    "isSystem": false,
    "scope": "GLOBAL",
    "conditions": null
  },
  "meta": {
    "correlationId": "TjgWgMuhhw2c8cIePIFX4",
    "timestamp": 1791193324003
  }
}
```

### PATCH /api/v1/admin/permissions/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- **Policy** `UPDATE:PERMISSION` — Update permission.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PermissionsController_update` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `description` | string | no | Updated permission description |
| `group` | string | no | Updated permission group |

**Response 200 OK** — Updated permission

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
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes |  |
| `data.scope` | "GLOBAL" \| "ORGANIZATION" \| "STORE" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
PATCH /api/v1/admin/permissions/bbde0c64-3f12-436b-affb-0c607834e398
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
    "createdAt": 1791193324078,
    "updatedAt": 1791193324115,
    "isDeleted": false,
    "deletedAt": null,
    "id": "bbde0c64-3f12-436b-affb-0c607834e398",
    "action": "MANAGE",
    "resource": "INVENTORY",
    "description": "Manage every inventory record",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL",
    "conditions": null
  },
  "meta": {
    "correlationId": "gyKro0TG_ehKGLk6-HBq5",
    "timestamp": 1791193324118
  }
}
```

### DELETE /api/v1/admin/permissions/{id}

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `DELETE:PERMISSION`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PermissionsController_remove` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** — Permission deleted

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
DELETE /api/v1/admin/permissions/bbde0c64-3f12-436b-affb-0c607834e398
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
    "correlationId": "Rz_2M6xCu21F4HhMgZWUf",
    "timestamp": 1791193324147
  }
}
```

### POST /api/v1/admin/permissions/{id}/restore

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PermissionsController_restore` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 201 Created** — Restored permission

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
| `data.resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes |  |
| `data.scope` | "GLOBAL" \| "ORGANIZATION" \| "STORE" \| "LOCATION" \| "RESOURCE" \| "OWN" | yes |  |
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
POST /api/v1/admin/permissions/bbde0c64-3f12-436b-affb-0c607834e398/restore
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "createdAt": 1791193324078,
    "updatedAt": 1791193324177,
    "isDeleted": false,
    "deletedAt": null,
    "id": "bbde0c64-3f12-436b-affb-0c607834e398",
    "action": "MANAGE",
    "resource": "INVENTORY",
    "description": "Manage every inventory record",
    "group": "Reports",
    "isSystem": false,
    "scope": "GLOBAL",
    "conditions": null
  },
  "meta": {
    "correlationId": "Ha7Tms9WDs3IBK4iUSf-D",
    "timestamp": 1791193324181
  }
}
```

### POST /api/v1/admin/permissions/check

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PERMISSION`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PermissionsController_checkPermission` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes | The action to check |
| `resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes | The resource to check against |
| `userId` | string (uuid) | yes | User ID to check permissions for |

**Response 201 Created** — Permission check result with grant provenance

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
  "userId": "048bb0a7-bec4-4453-a311-d54f51a211e5",
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
    "correlationId": "aTD5044dD48_V9l1aP6-d",
    "timestamp": 1791193324052
  }
}
```

### GET /api/v1/admin/permissions/groups/list

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `LIST:PERMISSION`.
- Operation id `PermissionsController_listGroups` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Response 200 OK** — List of permission groups

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
    "correlationId": "bxrqF5X0RxsYjoeI03lyi",
    "timestamp": 1791193324018
  }
}
```

### POST /api/v1/admin/permissions/user/grant

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PermissionsController_grantToUser` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `effect` | "ALLOW" \| "DENY" | no | ALLOW grants the permission; DENY revokes it even when a role grants it (default ALLOW) |
| `expiresAt` | integer | no | Optional epoch-ms timestamp when the grant expires |
| `permissionId` | string (uuid) | yes | Permission ID |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** — Direct permission granted to user

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
  "userId": "048bb0a7-bec4-4453-a311-d54f51a211e5",
  "permissionId": "365034f1-9de4-4a8d-bd96-0eb1ea9c2cb8",
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
    "correlationId": "c97eL_XAbln3cewePWRz3",
    "timestamp": 1791193324215
  }
}
```

### POST /api/v1/admin/permissions/user/revoke

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PermissionsController_revokeFromUser` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `effect` | "ALLOW" \| "DENY" | no | ALLOW grants the permission; DENY revokes it even when a role grants it (default ALLOW) |
| `expiresAt` | integer | no | Optional epoch-ms timestamp when the grant expires |
| `permissionId` | string (uuid) | yes | Permission ID |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** — Direct permission revoked from user

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
  "userId": "048bb0a7-bec4-4453-a311-d54f51a211e5",
  "permissionId": "365034f1-9de4-4a8d-bd96-0eb1ea9c2cb8"
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
    "correlationId": "l1scB6ETGjYZ5gdYQ9XnE",
    "timestamp": 1791193324246
  }
}
```

### POST /api/v1/admin/permissions/user/sync

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `UPDATE:PERMISSION`.
- Rate limit: 10 requests per 60 s per client IP (default limiter).
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PermissionsController_syncUserPermissions` · [source](../../../apps/api/src/modules/authorization/admin/permissions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `permissionIds` | string (uuid)[] | yes | Complete list of permission IDs the user should have |
| `userId` | string (uuid) | yes | User ID |

**Response 201 Created** — User permissions synced

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
  "userId": "048bb0a7-bec4-4453-a311-d54f51a211e5",
  "permissionIds": [
    "365034f1-9de4-4a8d-bd96-0eb1ea9c2cb8"
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
    "correlationId": "5TuVevGnch1oIMvEs6Ot3",
    "timestamp": 1791193324283
  }
}
```

## Authorization

### POST /api/v1/authorization/decisions

Evaluate capability checks for the current user (UI hints — the API re-authorizes every operation)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `AuthorizationDecisionsController_decide` · [source](../../../apps/api/src/modules/authorization/kernel/authorization-decisions.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `checks` | object[] | yes | 1–50 items |
| `checks[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `checks[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes |  |
| `checks[].resourceId` | string | no | length 1–64 |

**Response 200 OK** — One decision per requested check, in request order

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.results` | object[] | yes |  |
| `data.results[].action` | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `data.results[].allowed` | boolean | yes |  |
| `data.results[].resource` | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes |  |
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
    "correlationId": "OPC3NHuIKvl1W3C_kZnYZ",
    "timestamp": 1791193324688
  }
}
```

### GET /api/v1/authorization/decisions/explain

Admin: step-by-step explanation of an authorization decision

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:PERMISSION`.
- Operation id `AuthorizationDecisionsController_explain` · [source](../../../apps/api/src/modules/authorization/kernel/authorization-decisions.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `action` | query | "CREATE" \| "READ" \| "UPDATE" \| "DELETE" \| "LIST" \| "MANAGE" | yes |  |
| `resource` | query | "USER" \| "PROFILE" \| "ROLE" \| "PERMISSION" \| "ADMIN_DASHBOARD" \| "SYSTEM_SETTINGS" \| "URL" \| "TAG" \| "API_KEY" \| "ANALYTICS" \| … (+16 more) | yes |  |
| `resourceId` | query | string | no |  |
| `userId` | query | string | no |  |
| `organizationId` | query | string | no |  |
| `storeId` | query | string | no |  |
| `locationId` | query | string | no |  |

**Response 200 OK** — The decision with every evaluation step

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
| `data.request.subject.organizationId` | string | no |  |
| `data.request.subject.roles` | string[] | no |  |
| `data.request.subject.storeId` | string | no |  |
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
GET /api/v1/authorization/decisions/explain?action=READ&resource=GEO&userId=048bb0a7-bec4-4453-a311-d54f51a211e5
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
        "userId": "048bb0a7-bec4-4453-a311-d54f51a211e5",
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
    "durationMs": 18
  },
  "meta": {
    "correlationId": "0j6mMqWqICIqOsq9esJWd",
    "timestamp": 1791193324727
  }
}
```

## Authorization Policies

### POST /api/v1/policies/drafts

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `MANAGE:SYSTEM_SETTINGS`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PolicyControlPlaneController_createDraft` · [source](../../../apps/api/src/modules/authorization-cedar/controllers/policy-control-plane.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `builderPayload` | object | yes |  |
| `builderPayload.parameters` | object | yes |  |
| `builderPayload.templateId` | string | yes |  |
| `description` | string | no | at most 2000 characters |
| `name` | string | yes | length 1–120 |
| `organizationId` | string (uuid) | no |  |
| `scope` | "PLATFORM_GUARDRAIL" \| "PLATFORM" \| "TENANT" | yes |  |

**Response 201 Created** — Policy draft created

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
  "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
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
    "draftId": "8e527d9e-8481-4fbf-ad5a-aaf654b61bb1"
  },
  "meta": {
    "correlationId": "7hR-WmQZvukl0mSvvlcGd",
    "timestamp": 1791193324815
  }
}
```

### POST /api/v1/policies/drafts/{draftId}/simulate

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `MANAGE:SYSTEM_SETTINGS`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PolicyControlPlaneController_simulate` · [source](../../../apps/api/src/modules/authorization-cedar/controllers/policy-control-plane.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `draftId` | path | string (uuid) | yes |  |

**Response 201 Created** — Policy simulation result

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.affectedPrincipalCount` | integer | yes |  |
| `data.decisionChanges` | object[] | yes |  |
| `data.decisionChanges[].action` | string | yes |  |
| `data.decisionChanges[].after` | "Allow" \| "Deny" | yes |  |
| `data.decisionChanges[].before` | "Allow" \| "Deny" | yes |  |
| `data.decisionChanges[].membershipRole` | "OWNER" \| "ADMIN" \| "MEMBER" \| "POLICY_ADMIN" \| "CASHIER" | yes |  |
| `data.decisionChanges[].organizationId` | string (uuid) | yes |  |
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
POST /api/v1/policies/drafts/8e527d9e-8481-4fbf-ad5a-aaf654b61bb1/simulate
X-Client-Type: admin
X-Mutation-Intent: same-origin
Cookie: <session cookies from POST /api/v1/auth/login>
```

Response `201 Created` (application/json):

```json
{
  "success": true,
  "data": {
    "simulationId": "0d9feff4-cb54-4d52-a7d5-cab22ea32709",
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
        "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
        "userId": "937f5e43-9b11-47d0-866c-91fec89bc250",
        "membershipRole": "CASHIER",
        "action": "rewardhub:view_rewards",
        "before": "Allow",
        "after": "Deny"
      },
      {
        "organizationId": "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
        "userId": "937f5e43-9b11-47d0-866c-91fec89bc250",
        "membershipRole": "CASHIER",
        "action": "rewardhub:manage_rewards",
        "before": "Allow",
        "after": "Deny"
      }
    ],
    "decisionChangesTruncated": false
  },
  "meta": {
    "correlationId": "RVI_owThglKLDX6siZNnT",
    "timestamp": 1791193324890
  }
}
```

### POST /api/v1/policies/publish

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **SuperAdmin only.**
- **Permission** `MANAGE:SYSTEM_SETTINGS`.
- Browser calls must send `X-Mutation-Intent: same-origin` from an allowed origin (CSRF protection).
- Operation id `PolicyControlPlaneController_publish` · [source](../../../apps/api/src/modules/authorization-cedar/controllers/policy-control-plane.controller.ts)

**Request body** (`application/json`, required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `approvalNote` | string | no | at most 500 characters |
| `draftId` | string (uuid) | yes |  |

**Response 201 Created** — Published policy version (approved by a second SuperAdmin)

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
  "draftId": "8e527d9e-8481-4fbf-ad5a-aaf654b61bb1",
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
    "correlationId": "Kqnoi7YZXlc7-oX1GEbM8",
    "timestamp": 1791193324923
  }
}
```

## Capabilities

### GET /api/v1/capabilities/catalog

List capability catalog entries (optionally filtered by scope)

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- Runs as an allow-listed **system operation** (row-level security bypass, audited) — see [database security](../security/database-security.md).
- Operation id `CapabilitiesCatalogController_listCatalog` · [source](../../../apps/api/src/modules/authorization/controllers/capabilities-catalog.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `scope` | query | "PLATFORM" \| "MERCHANT" \| "ADMIN" | no |  |

**Response 200 OK** — Capability definitions

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
      "id": "f62c2e12-af2a-4838-b271-d61b1130d6be",
      "slug": "merchant:view_dashboard",
      "scope": "MERCHANT",
      "label": "View dashboard",
      "description": "Access the merchant home dashboard and summary widgets.",
      "groupName": "Overview",
      "sortOrder": 0,
      "isSystem": true
    },
    {
      "id": "4a25b76a-1b01-4f10-aa2e-d3310468eb41",
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
    "correlationId": "y-0i8oHsIprRqsfAAmP3q",
    "timestamp": 1791193324748
  }
}
```

## Audit Log

### GET /api/v1/admin/audit

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Permission** `READ:AUDIT_LOG`.
- Operation id `AuditController_list` · [source](../../../apps/api/src/modules/authorization/admin/audit.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: createdAt. Default: -createdAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: action, actorId, targetUserId, targetRoleId, createdAt |

**Response 200 OK** — Paginated audit log entries (newest first); pagination is in `meta`

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
      "createdAt": 1791193324764,
      "updatedAt": 1791193324764,
      "id": "03538d88-06e0-4dff-9a17-e47562c96482",
      "actor": {
        "kind": "USER",
        "userId": "9194a7c0-e721-4833-95cc-eca2f319f542",
        "impersonatorId": null
      },
      "targetUserId": null,
      "targetRoleId": null,
      "permissionId": null,
      "action": "SUPER_ADMIN_BYPASS",
      "detail": "Bypassed authorization for list at GET /api/v1/admin/audit?limit=2"
    },
    {
      "createdAt": 1791193324701,
      "updatedAt": 1791193324701,
      "id": "6c442714-97d4-40f6-84fd-ae3f8fbcbb9b",
      "actor": {
        "kind": "USER",
        "userId": "9194a7c0-e721-4833-95cc-eca2f319f542",
        "impersonatorId": null
      },
      "targetUserId": null,
      "targetRoleId": null,
      "permissionId": null,
      "action": "SUPER_ADMIN_BYPASS",
      "detail": "Bypassed authorization for explain at GET /api/v1/authorization/decisions/explain?action=READ&resource=GEO&userId=048bb0a7-bec4-4453-a311-d54f51a211e5"
    }
  ],
  "meta": {
    "limit": 2,
    "total": 109,
    "page": 1,
    "totalPages": 55,
    "nextCursor": "eyJhdCI6MTc5MTE5MzMyNDcwMSwiaWQiOiI2YzQ0MjcxNC05N2Q0LTQwZjYtODRmZC1hZTNmOGZiY2JiOWIifQ",
    "hasNext": true,
    "hasPrevious": false,
    "correlationId": "F5WRU9zo1FaadnwjxaU3p",
    "timestamp": 1791193324777
  }
}
```

### GET /api/v1/admin/audit-logs

List audit records (newest first)

Request metadata only — open one record for its redacted payloads.

- **Signed-in session** — the httpOnly cookies from `POST /api/v1/auth/login` (send `X-Client-Type: web | admin | merchant`) or `Authorization: Bearer <access token>`.
- **Admin-panel access** (SuperAdmin or the `ADMIN_DASHBOARD` permission).
- **Permission** `LIST:AUDIT_LOG`.
- Operation id `AuditLogsController_list` · [source](../../../apps/api/src/modules/audit-logs/audit-logs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `page` | query | integer | no | Page number (1-indexed) for offset pagination |
| `limit` | query | integer | no | Page size (default 20, max 100) |
| `cursor` | query | string | no | Opaque keyset cursor from the previous response's `meta.nextCursor`. Only valid with the default sort order. |
| `sort` | query | string | no | Comma-separated sort fields, `-` prefix = descending (max 3). Sortable: occurredAt, responseStatus, method, endpoint. Default: -occurredAt |
| `filter` | query | object | no | Filters as `filter[field]=value` or `filter[field][operator]=value`. Filterable: outcome, method, authMethod, responseStatus, endpoint, errorCode, actorUserId, impersonatorUserId, organizationId, apiKeyId, ipAddress, ipScope, deviceType, browserName, osName, geoCountry, correlationId, occurredAt |
| `search` | query | string | no | Case-insensitive free-text search over the resource's search columns |

**Response 200 OK** — Paginated audit records; pagination is in `meta`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | object[] | yes |  |
| `data[].actor` | object \| null | yes |  |
| `data[].actor.email` | string \| null | yes |  |
| `data[].actor.fullName` | string \| null | yes |  |
| `data[].actor.id` | string | yes | length 1–64 |
| `data[].apiKeyId` | string \| null | yes | length 1–64 |
| `data[].authMethod` | "BEARER_TOKEN" \| "SESSION_COOKIE" \| "REFRESH_COOKIE" \| "API_KEY" \| null | yes |  |
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
| `data[].organization` | object \| null | yes |  |
| `data[].organization.id` | string | yes | length 1–64 |
| `data[].organization.name` | string \| null | yes |  |
| `data[].osName` | string \| null | yes | at most 64 characters |
| `data[].osVersion` | string \| null | yes | at most 32 characters |
| `data[].outcome` | "SUCCEEDED" \| "FAILED" | yes |  |
| `data[].path` | string | yes | length 1–2048 |
| `data[].responseStatus` | integer | yes | range 100–599 |
| `data[].storeId` | string \| null | yes | length 1–64 |
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
- Operation id `AuditLogsController_get` · [source](../../../apps/api/src/modules/audit-logs/audit-logs.controller.ts)

**Parameters**

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `id` | path | string (uuid) | yes |  |

**Response 200 OK** — The complete audit record

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.acceptLanguage` | string \| null | yes | at most 256 characters |
| `data.actor` | object \| null | yes |  |
| `data.actor.email` | string \| null | yes |  |
| `data.actor.fullName` | string \| null | yes |  |
| `data.actor.id` | string | yes | length 1–64 |
| `data.apiKeyId` | string \| null | yes | length 1–64 |
| `data.authMethod` | "BEARER_TOKEN" \| "SESSION_COOKIE" \| "REFRESH_COOKIE" \| "API_KEY" \| null | yes |  |
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
| `data.organization` | object \| null | yes |  |
| `data.organization.id` | string | yes | length 1–64 |
| `data.organization.name` | string \| null | yes |  |
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
| `data.systemOperations` | string[] | yes |  |
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
