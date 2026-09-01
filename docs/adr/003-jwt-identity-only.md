---
title: "ADR 003: JWT Contains Identity Only"
tags: ["adr", "auth", "jwt", "security"]
description: "Architecture decision record for keeping JWT payloads identity-only without embedded permissions."
author: "Backend Team"
lastUpdated: 1772000000000
coverImage: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&h=630&fit=crop"
order: 3
---

# ADR 003: JWT Contains Identity Only

**Status:** Accepted  
**Date:** 2026-08-24 (updated 2026-08-27)  
**Deciders:** Backend Team

## Context

JWTs can contain arbitrary claims. Should we embed user permissions in the JWT to avoid DB lookups on every request?

## Decision

JWT access tokens carry **identity + lightweight flags** — not permission lists:

```json
{
  "sub": "user_123",
  "id": "user_123",
  "email": "admin@example.com",
  "fullName": "Admin User",
  "isActive": true,
  "isSuperAdmin": false,
  "isEmailVerified": true,
  "hasAdminAccess": true,
  "tokenVersion": 3,
  "isImpersonating": true,
  "originalUserId": "super_admin_id"
}
```

**NOT** embedded permissions:

```json
{
  "sub": "user_123",
  "permissions": ["READ:USER", "CREATE:USER"]
}
```

### Session API split

| Endpoint | Payload |
| --- | --- |
| `GET /auth/me` | Profile + roles (`UserResponse`) — **no** `permissions` |
| `GET /auth/permissions` | Roles + permissions + session flags (`SessionPermissionsResponse`) |

Clients refetch `GET /auth/permissions` after RBAC mutations via `invalidateSessionAuth()` without reloading profile on every navigation.

### Why `hasAdminAccess` is still in the JWT

The Next.js proxy (`proxy.ts`) gates admin routes synchronously on every navigation. A single boolean is acceptable; a full permission array is not.

## Consequences

### Positive

- **Immediate effect:** Permission changes take effect on next guarded request (cache + `tokenVersion`)
- **Scalable:** JWT size stays constant regardless of permission count
- **Secure:** Full permission lists are resolved server-side
- **Simple:** No token refresh solely because permissions changed (unless `tokenVersion` bumped)
- **Audit-friendly:** Authorization decisions are logged server-side

### Negative

- **Latency:** Each guarded request requires cache/DB permission resolution
- **Extra round-trip:** UIs that need permissions call `/auth/permissions` in addition to `/me`

### Mitigations

- In-memory authorization cache with 5-minute TTL (per instance)
- Redis pub/sub invalidation across API instances in deployed environments (see ADR 004)
- `tokenVersion` forces refresh when roles/permissions mutate structurally

## Alternatives Considered

1. **JWT with permissions:** Simple but doesn't scale; changes require token refresh or accept stale grants
2. **Permissions only in `/me`:** Forces full profile refetch after every RBAC mutation
3. **Hybrid (JWT + DB):** Complex, hard to reason about consistency
4. **Session-based:** Server-side but doesn't fit stateless API design

## References

- [Authorization guide](./../authorization.md) — JWT design, `/me` vs `/auth/permissions`, impersonation
- JWT Best Practices: https://datatracker.ietf.org/doc/html/rfc8725
