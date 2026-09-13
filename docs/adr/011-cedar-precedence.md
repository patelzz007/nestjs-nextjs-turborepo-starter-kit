---
title: "ADR 011: Cedar ABAC Precedence and Policy Governance"
tags: ["adr", "authorization", "cedar", "abac"]
description: "Architecture decision record for in-process Cedar evaluation with platform guardrails and structured tenant policy authoring."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 11
---

# ADR 011: Cedar ABAC Precedence and Policy Governance

**Status:** Accepted  
**Date:** 2026-09-13  
**Deciders:** Backend Team

## Context

The repository stored `Permission.conditions` JSON but never evaluated ABAC at runtime. Merchant capabilities used fixed role mappings. Production requires dynamic policies with safe publication and sub-second revocation.

## Decision

### Engine

- **Cedar** evaluates authorization in-process inside API and workers.
- Policy bundles are versioned, signed, cached with bounded TTL, and invalidated via outbox + Redis pub/sub.

### Precedence

1. Platform guardrail policies are **non-bypassable** (forbid wins).
2. Tenant policies may only **further restrict** within guardrails.
3. Explicit deny at any layer wins.
4. Undecidable, missing attributes, or engine errors → **deny** (fail closed).

### Authoring

| Layer | Authoring |
| --- | --- |
| Platform guardrails | Developers (immutable at runtime) |
| Platform dynamic | Platform security admins via structured builder |
| Tenant dynamic | Tenant policy admins via structured builder only (no raw Cedar) |

### Publication pipeline

Draft → validate schema → simulate impact (including last-admin checks) → approve → version → publish → audit → rollback.

### List authorization

Constrained policy templates compile to tenant-scoped SQL visibility predicates. Cedar performs final per-resource action decisions. Never fetch-and-filter unbounded tenant datasets through Cedar alone.

## Consequences

### Positive

- Formal semantics for complex authorization.
- Tenant self-service within guardrails.

### Negative

- Significant control-plane complexity vs fixed RBAC.

## References

- `apps/api/src/modules/authorization-cedar/`
- `packages/shared/src/schemas/domain/organization/organization/authorization-policy.ts`
- ADR 001 (RBAC remains for platform catalog; Cedar layers on organization resources)
