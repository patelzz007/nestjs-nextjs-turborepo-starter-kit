---
title: "ADR 058: DDD Modular Monolith and Bounded Contexts"
tags: ["adr", "ddd", "architecture", "contexts"]
description: "The API is one deployable modular monolith. Business code lives in bounded contexts. Zod stays the shared contract, including inside the domain."
author: "Platform Team"
lastUpdated: 1792281600000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 58
---

# ADR 058: DDD Modular Monolith and Bounded Contexts

## Status

Accepted (2026-10-18).

## Context

The API had grown as Nest modules under `src/modules/`. A module could import another module's services, repositories and Prisma models. That made "who owns this row?" a guess, and it made a later split into services expensive because the boundary was not in the code.

The product is still one deployable API. A network of microservices is not the goal. The goal is a modular monolith: one process, explicit boundaries, so a context can be extracted later without first inventing the boundary.

## Decision

1. Business code lives in `apps/api/src/contexts/<name>/{domain,application,infrastructure,presentation}`. Shared technical code lives in `apps/api/src/platform/` with the same four layers. `src/modules/` is retired.
2. A context imports another context only through that context's `public-api.ts`. Domain and application do not import another context's internals, and they do not import Prisma.
3. The domain may import zod and `@workspace/shared` schemas and the types inferred from them. This deliberately differs from a pure domain model that would re-declare every rule. Frontend and backend share one contract. A second set of domain-only rules would drift from the contract the client already validates.
4. Application services and handlers receive an `ActorContext`. AsyncLocalStorage stays in infrastructure (amends ADR 017).
5. Resource-level authorization moves toward handlers through a port. The global guard remains the coarse filter (amends ADR 026).

## Consequences

- Lint rejects a context that reaches into another context's `domain`, `application`, `infrastructure` or `presentation`, and it rejects any new file under `src/modules/`.
- Catalog and the reward lifecycle are the reference shapes. Older flows still live under a context folder in a `runtime` (or `auth` / `rbac`) nest until each use case is a command or query. That remaining split is tracked in `docs/architecture/ddd-cqrs-migration-gaps.md`.
- One contract package (`@workspace/shared`) stays the source of request and response types. The domain does not grow a parallel type language.
