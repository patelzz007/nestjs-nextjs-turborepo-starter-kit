---
title: "ADR 010: Transaction-Local RLS Contract"
tags: ["adr", "rls", "postgres", "security"]
description: "Architecture decision record for fail-closed tenant units of work with transaction-local PostgreSQL session context."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 10
---

# ADR 010: Transaction-Local RLS Contract

**Status:** Accepted  
**Date:** 2026-09-13  
**Deciders:** Backend Team

## Context

The prior implementation set RLS session variables on **pool checkout** (`RlsPool`). Missing AsyncLocalStorage context defaulted to `bypass: true`, which is unsafe for production multi-tenancy.

## Decision

### Tenant unit of work

All tenant-scoped database access runs inside `withTenantTransaction` (or `withSystemOperation` for allowlisted bypass):

1. Begin PostgreSQL transaction.
2. `SET LOCAL ROLE app_runtime` (or a narrower worker role).
3. Set transaction-local settings: `app.current_user_id`, `app.current_organization_id`, `app.rls_bypass`, `app.system_operation`, `app.actor_purpose`.
4. Execute repository work on a scoped client.
5. Commit or rollback.

### Fail-closed default

- Missing tenant context **rejects** database access.
- `@RlsBypass()` and implicit bypass on missing `request.user` are removed for tenant paths.
- System bypass requires an allowlisted operation name, reason code, and audit event.

### Database roles

| Role | Purpose |
| --- | --- |
| Migration owner | DDL, policy changes |
| `app_runtime` | HTTP tenant requests (`NOBYPASSRLS`, `FORCE RLS`) |
| `app_enumerator` | Cross-tenant schedule fan-out metadata only |
| `app_worker` | Tenant-scoped job execution |

### Composite constraints

Tenant-owned foreign keys include `organizationId` in parent and child keys to prevent cross-tenant references even if application code has bugs.

## Consequences

### Positive

- Eliminates connection-pool context bleed.
- RLS enforcement is testable per transaction.

### Negative

- Repositories must accept scoped clients; migration touches many services.

## References

- `apps/api/src/prisma/tenant-transaction.service.ts`
- `apps/api/prisma/rls.sql`
- ADR 007 (superseded bypass defaults for tenant paths)
