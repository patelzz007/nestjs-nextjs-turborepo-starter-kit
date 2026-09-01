---
title: "ADR 006: Module-Level Health Indicators"
tags: ["adr", "health", "monitoring", "observability"]
description: "Architecture decision record for implementing per-module health indicators with aggregated deep health checks."
author: "Backend Team"
lastUpdated: 1756003200000
coverImage: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=630&fit=crop"
order: 6
---

# ADR 006: Module-Level Health Indicators

**Status:** Accepted  
**Date:** 2026-08-24  
**Deciders:** Backend Team

## Context

The `/health` endpoint checks basic DB connectivity. But production systems need deeper observability:
- Is the authorization system operational?
- Are notifications being sent?
- Is the geo data service responsive?

## Decision

Implement **module-level health indicators** that:
1. Each module exposes a `HealthIndicator` class
2. Health indicators are aggregated in a central `HealthService`
3. `/health/deep` returns per-module health status
4. Health checks are lightweight (cached, fast-fail)

```typescript
// Example: AuthorizationHealthIndicator
@Injectable()
export class AuthorizationHealthIndicator {
  async isHealthy(): Promise<boolean> {
    const role = await this.prisma.role.findFirst({ where: { isDeleted: false } });
    return role !== null;
  }
}
```

## Consequences

### Positive
- **Observability:** Per-module health visibility
- **Debugging:** Quick identification of failing components
- **Monitoring:** Integration with Prometheus/Grafana
- **Reliability:** Fast-fail prevents cascade failures

### Negative
- **Complexity:** Each module must implement health indicator
- **Overhead:** Additional DB queries on health checks
- **Maintenance:** Health indicators must be kept up-to-date

### Mitigations
- Health checks are cached (5-minute TTL)
- Health indicators are simple (1-2 queries max)
- Health checks are optional (modules can skip)

## Alternatives Considered

1. **Centralized health check:** Simple but doesn't identify failing modules
2. **External monitoring:** Requires infrastructure, overkill for development
3. **Logging only:** No structured health data

## References

- NestJS Health Checks: https://docs.nestjs.com/recipes/health-check
- Prometheus Health: https://prometheus.io/docs/guides/platforms/
