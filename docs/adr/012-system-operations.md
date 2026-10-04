---
title: "ADR 012: Allowlisted System Operations"
tags: ["adr", "tenancy", "rls", "operations"]
description: "Architecture decision record for least-privilege system database access outside tenant request context."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 12
---

# ADR 012: Allowlisted System Operations

**Status:** Accepted  
**Date:** 2026-09-13  
**Deciders:** Backend Team

## Context

Background jobs, seed scripts, analytics consumers, and cross-tenant schedulers previously used implicit RLS bypass or superuser database connections.

## Decision

### Allowlist

Only named system operations may bypass tenant RLS, each with:

- Operation identifier (e.g. `outbox.publish`, `tenant.enumerate`, `organization.erase`)
- Least-privilege database role
- Required reason / correlation metadata
- Structured audit record

### Enforcement (2026-10)

- The allowlist is a closed zod enum (`SystemOperationSchema`); one narrowly named operation per purpose.
- `role` is enforced with `SET ROLE` (pool checkout and `withSystemOperation`); `app_enumerator` exists and is read-only.
- `app_rls_bypass()` requires a named `app.system_operation`; policies may require a specific operation.
- Correlation ids come from the request context (or are generated per transaction outside a request) — never from callers.
- Every use is audited: an `rls.system_operation` log line, and the request's `audit_logs` row (ADR 025).

### Cross-tenant schedules

Schedulers use `app_enumerator` to list active organization IDs, then enqueue **one tenant-scoped job per organization**. Workers re-authorize at execution using signed job context.

### Workers

- No implicit bypass when HTTP AsyncLocalStorage is empty.
- Job payload carries `organizationId`, `initiatingActorId`, `purpose`, `policyVersion`, and signature.
- Execution opens `withTenantTransaction` or `withSystemOperation` explicitly.

### Analytics consumer

Must use tenant-tagged inserts or metadata-only operational events — not superuser unrestricted writes.

## Consequences

### Positive

- Blast radius of worker compromise is limited.
- Cross-tenant enumeration is auditable.

### Negative

- More boilerplate per worker type.

## References

- `apps/api/src/prisma/system-operation.registry.ts`
- `packages/shared/src/schemas/infrastructure/tenant-job-context.ts`
- ADR 010
