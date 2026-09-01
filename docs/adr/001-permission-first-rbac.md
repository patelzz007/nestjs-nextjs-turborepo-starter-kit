---
title: "ADR 001: Permission-First RBAC Architecture"
tags: ["adr", "authorization", "rbac"]
description: "Architecture decision record for implementing permission-first RBAC with Spatie Laravel Permission patterns."
author: "Backend Team"
lastUpdated: 1756003200000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 1
---

# ADR 001: Permission-First RBAC Architecture

**Status:** Accepted  
**Date:** 2026-08-24  
**Deciders:** Backend Team

## Context

The application needs role-based access control (RBAC) that:
1. Supports multiple roles per user
2. Supports direct user permissions
3. Provides immediate authorization changes without JWT regeneration
4. Scales to hundreds of permissions per user
5. Follows Spatie Laravel Permission patterns (proven at scale)

## Decision

Implement **permission-first RBAC** where:
- Permissions are the atomic authorization units (`users.create`, `roles.view`)
- Roles are collections of permissions (e.g., `admin` = `users.* + roles.*`)
- Users can have both roles AND direct permissions
- JWT contains only identity (`sub`, `sessionId`) — no permissions
- Authorization state lives in PostgreSQL with optional Redis cache
- Guards evaluate permissions at request time (not embedded in tokens)

## Consequences

### Positive
- **Immediate effect:** Permission changes take effect on next request (no token refresh)
- **Scalable:** Hundreds of permissions don't bloat JWT size
- **Flexible:** Users can have role-based + direct permissions
- **Maintainable:** Single source of truth in DB, not scattered in tokens
- **Spatie-compatible:** Laravel developers understand the pattern instantly

### Negative
- **Latency:** Each request requires DB/cache lookup for permissions
- **Complexity:** More infrastructure (guards, cache, invalidation)
- **Debugging:** Permission state is distributed, not in a single token

### Mitigations
- In-memory cache with TTL (5 minutes) reduces DB queries
- Redis cache for horizontal scaling (future)
- Structured logging for permission checks
- Health indicators for authorization system

## Alternatives Considered

1. **JWT with permissions:** Simple but doesn't scale, changes require token refresh
2. **Session-based:** Server-side sessions but doesn't fit stateless API design
3. **ABAC (Attribute-Based):** More flexible but overkill for current needs

## References

- Spatie Laravel Permission: https://spatie.be/docs/laravel-permission/
- NestJS Guards: https://docs.nestjs.com/guards
- Prisma Relations: https://www.prisma.io/docs/concepts/components/prisma-schema/relations
