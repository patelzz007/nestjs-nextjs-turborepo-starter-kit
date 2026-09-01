---
title: "ADR 005: Telescope In-Memory Store with Optional Postgres Persistence"
tags: ["adr", "telescope", "storage", "observability"]
description: "Architecture decision record for dual-mode Telescope storage with in-memory default and Postgres option."
author: "Backend Team"
lastUpdated: 1756003200000
coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop"
order: 5
---

# ADR 005: Telescope In-Memory Store with Optional Postgres Persistence

**Status:** Superseded (telescope module removed)  
**Date:** 2026-08-24  
**Deciders:** Backend Team

> **Note:** The telescope module was removed from the codebase on 2026-08-26. This ADR is retained for historical context only.

## Context

Telescope captures HTTP requests, jobs, and events for debugging. The storage strategy must balance:
1. Performance (low latency for capture)
2. Persistence (survive restarts)
3. Simplicity (no external dependencies)
4. Scalability (horizontal scaling)

## Decision

Implement **dual-mode storage**:

1. **In-memory (default):** Fast, simple, no persistence
2. **Postgres (optional):** Persistent, queryable, scalable

```typescript
// Configuration
TELESCOPE_MODE=memory|postgres

// In-memory store
- Max 1000 requests (configurable)
- LRU eviction
- No persistence (data lost on restart)

// Postgres store
- Persistent across restarts
- Queryable with Prisma
- Retention pruning (configurable)
```

## Consequences

### Positive
- **Performance:** In-memory store has <1ms capture latency
- **Simplicity:** No external dependencies for development
- **Flexibility:** Postgres store for production persistence
- **Scalability:** Postgres store supports horizontal scaling

### Negative
- **Complexity:** Two storage backends to maintain
- **Consistency:** In-memory store loses data on restart
- **Memory:** In-memory store grows with traffic

### Mitigations
- LRU eviction prevents memory leaks
- Retention pruning for Postgres store
- Health indicators for store monitoring
- Configuration-driven (TELESCOPE_MODE)

## Alternatives Considered

1. **Redis only:** Requires infrastructure, overkill for development
2. **Postgres only:** Slower capture latency, requires DB for development
3. **File-based:** Complex, doesn't scale

## References

- Laravel Telescope: https://laravel.com/docs/telescope
- Prisma Streaming: https://www.prisma.io/docs/concepts/components/prisma-client/change-data-capture
