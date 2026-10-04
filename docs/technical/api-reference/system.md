---
title: "API reference — System: health and version"
description: "Liveness, readiness and deep health probes and the API version manifest."
order: 12
author: "Generated from the OpenAPI export"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference — System: health and version

Liveness, readiness and deep health probes and the API version manifest.

How these endpoints fit together: [Observability](../operations/observability.md). Conventions shared by every endpoint (envelope, auth, errors, pagination): [API reference overview](./README.md).

## App

### GET /

Welcome message

- **Public** — no session required.
- Operation id `HealthController_getHello` · [source](../../../apps/api/src/modules/health/health.controller.ts)

**Response 200 OK** — Welcome message

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data` | string | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": "Hello from the Freebuff API!",
  "meta": {
    "correlationId": "Z4hyGpPY8pYjIwNtIXb28",
    "timestamp": 1791099694976
  }
}
```

### GET /health

> [!WARNING]
> Deprecated.

Health check (includes DB status) — deprecated alias, prefer /health/live and /health/ready

- **Public** — no session required.
- Operation id `HealthController_getHealth` · [source](../../../apps/api/src/modules/health/health.controller.ts)

**Response 200 OK** — Current service health status

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.db` | string | yes |  |
| `data.status` | string | yes |  |
| `data.timestamp` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /health
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "db": "connected",
    "timestamp": 1791099694989
  },
  "meta": {
    "correlationId": "K9dzySWmwTpvtRInCVVj-",
    "timestamp": 1791099694989
  }
}
```

### GET /health/deep

Deep health check (DB + filesystem + external services)

- **Public** — no session required.
- Operation id `HealthController_getDeepHealth` · [source](../../../apps/api/src/modules/health/health.controller.ts)

**Response 200 OK** — Detailed health status with per-service probes

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.checks` | object | yes |  |
| `data.db` | string | yes |  |
| `data.filesystem` | string | yes |  |
| `data.modules` | object[] | yes |  |
| `data.modules[].details` | object | yes |  |
| `data.modules[].healthy` | boolean | yes |  |
| `data.modules[].name` | string | yes |  |
| `data.status` | string | yes |  |
| `data.timestamp` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /health/deep
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "db": "connected",
    "timestamp": 1791099695017,
    "filesystem": "ok",
    "checks": {},
    "modules": [
      {
        "name": "queue",
        "healthy": true,
        "details": {
          "backend": "bullmq",
          "redis": "configured",
          "prefix": "docs-capture"
        }
      },
      {
        "name": "rabbitmq",
        "healthy": true,
        "details": {
          "backend": "placeholder",
          "url": "configured"
        }
      }
    ]
  },
  "meta": {
    "correlationId": "J9F8CklmaMMs04Pn5HRO-",
    "timestamp": 1791099695017
  }
}
```

### GET /health/live

Liveness probe — process is up (never touches the database)

- **Public** — no session required.
- Operation id `HealthController_getLiveness` · [source](../../../apps/api/src/modules/health/health.controller.ts)

**Response 200 OK** — The process is alive

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.status` | "ok" | yes |  |
| `data.timestamp` | integer | yes |  |
| `data.uptimeSeconds` | number | yes | Seconds since the Node.js process started; range 0–∞ |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /health/live
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptimeSeconds": 12.145588292,
    "timestamp": 1791099694996
  },
  "meta": {
    "correlationId": "63q8i5_IKEuZGURgim0qL",
    "timestamp": 1791099694996
  }
}
```

### GET /health/ready

Readiness probe — startup finished, database and critical dependencies reachable

- **Public** — no session required.
- Operation id `HealthController_getReadiness` · [source](../../../apps/api/src/modules/health/health.controller.ts)

**Response 200 OK** — The instance can serve traffic

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.checks` | object[] | yes |  |
| `data.checks[].critical` | boolean | yes | Whether a failing probe makes the API not-ready (HTTP 503) |
| `data.checks[].details` | object | no | Module indicator report (same as `/health/deep`), e.g. Kafka `state` / `lastFailure` |
| `data.checks[].name` | string | yes | Probe name (startup, database, or a module indicator) |
| `data.checks[].status` | "up" \| "down" | yes |  |
| `data.status` | "ready" | yes |  |
| `data.timestamp` | integer | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 503 | — | Not ready — `error.details.checks` lists every probe |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /health/ready
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "success": true,
  "data": {
    "status": "ready",
    "checks": [
      {
        "name": "startup",
        "status": "up",
        "critical": true
      },
      {
        "name": "database",
        "status": "up",
        "critical": true
      }
    ],
    "timestamp": 1791099695007
  },
  "meta": {
    "correlationId": "FZoI2OKNuieGwJHSS-P5u",
    "timestamp": 1791099695008
  }
}
```

## System

### GET /version

API version manifest (current, supported, docs)

- **Public** — no session required.
- Operation id `VersionController_getVersion` · [source](../../../apps/api/src/modules/health/version.controller.ts)

**Response 200 OK** — Version negotiation manifest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `current` | "v1" \| "v2" | yes |  |
| `default` | "v1" \| "v2" | yes |  |
| `docs` | string | yes |  |
| `prefix` | string | yes |  |
| `supported` | object[] | yes |  |
| `supported[].sunsetAt` | string | no |  |
| `supported[].version` | "v1" \| "v2" | yes |  |

**Errors** (standard envelope, branch on `error.code`)

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | Too many requests from this client; retry after `error.details.retryAfterSeconds`. |

**Example** — called as no session.

```http
GET /version
X-Client-Type: web
```

Response `200 OK` (application/json):

```json
{
  "current": "v1",
  "default": "v1",
  "supported": [
    {
      "version": "v1"
    }
  ],
  "docs": "/v1/docs",
  "prefix": "/api/v1"
}
```
