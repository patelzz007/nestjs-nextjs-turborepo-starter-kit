---
title: "ADR 004: Authorization Caching Strategy"
tags: ["adr", "caching", "authorization", "performance"]
description: "Architecture decision record for multi-level authorization caching with in-memory and Redis support."
author: "Backend Team"
lastUpdated: 1772000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 4
---

# ADR 004: Authorization Caching Strategy

**Status:** Accepted (Redis invalidation implemented)  
**Date:** 2026-08-24 (updated 2026-08-27)  
**Deciders:** Backend Team

## Context

Every API request that hits `AuthorizationGuard` may resolve effective permissions. Without caching, this means multiple DB queries per request (roles, hierarchy, direct grants, role permissions).

## Decision

Implement **two-tier caching**:

1. **In-memory Map (every instance):** Primary store for hot-path reads; default in development
2. **Redis pub/sub (deployed):** Cross-instance invalidation when RBAC mutates — not a remote read cache

```typescript
// Cached shape per user
{
  roles: ["admin", "merchant"],
  permissions: [{ action: "READ", resource: "USER" }, ...],
  cachedAt: 1787000000000
}

// TTL: AUTHORIZATION_CACHE_TTL_MS (default 5 minutes)
```

### Backend selection

| `AUTHORIZATION_CACHE_BACKEND` | When used |
| --- | --- |
| `memory` | Explicit local-only |
| `redis` | Requires `REDIS_URL`; local Map + Redis pub/sub |
| `auto` (default) | `redis` when `REDIS_URL` is set and `NODE_ENV !== development` |

Invalidation channel: `rbac:invalidate` — messages `{ type: "user" | "users" | "clear", ... }`.

## Consequences

### Positive

- **Performance:** High cache hit rate; no Redis round-trip on reads
- **Scalability:** Horizontal scaling with consistent invalidation across pods
- **Consistency:** Mutations invalidate affected users immediately (local + broadcast)
- **Simplicity:** Same `AuthorizationCacheService` injection surface for `AuthorizationCheckerService`

### Negative

- **Memory:** Each instance holds active users in a Map
- **Redis dependency:** Deployed environments need Redis for multi-instance consistency
- **Brief staleness:** TTL window if invalidation message is missed (mitigated by short TTL + event invalidation)

### Mitigations

- Short TTL (5 minutes default)
- Event-driven invalidation on all RBAC mutations
- `tokenVersion` on JWT forces re-auth after structural permission changes
- Health indicators for cache diagnostics

## Alternatives Considered

1. **No cache:** Simple but doesn't scale
2. **Redis as primary read store:** Requires async reads or sync blocking — rejected for hot path
3. **JWT permissions:** Doesn't scale; immediate invalidation impossible

## References

- [Authorization guide — Cache Layer](./../authorization.md#cache-layer)
- Redis pub/sub: https://redis.io/docs/manual/pubsub/
