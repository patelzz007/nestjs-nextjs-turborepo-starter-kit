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

- Operation identifier (e.g. `outbox.publish`, `tenant.enumerate`, `policy.publish`)
- Least-privilege database role
- The tables its bypass reaches (see "Per-table scope")
- Required reason / correlation metadata
- Structured audit record

### Enforcement (2026-10)

- The allowlist is a closed zod enum (`SystemOperationSchema`); one narrowly named operation per purpose.
- `role` is enforced with `SET ROLE` (pool checkout and `withSystemOperation`); `app_enumerator` exists and is read-only.
- `app_rls_bypass()` requires a named `app.system_operation`; policies may require a specific operation.
- Correlation ids come from the request context (or are generated per transaction outside a request) — never from callers.
- Every use is audited: an `rls.system_operation` log line, and the request's `audit_logs` row (ADR 025).

### Per-table scope (2026-10-19)

Until this change a named operation bypassed RLS on **every** table: the name and the audit line were
precise, the privilege was not. Each registry entry now declares a `scope`, and PostgreSQL enforces it:

- `app_rls_bypass_on(table)` is generated from the registry into `prisma/rls/00-system-operation-scopes.sql`
  (committed, so a scope change is a reviewable diff; a spec fails when the file is stale). It is
  `app_rls_bypass() AND <the session's operation lists table>`, and an unlisted operation name matches nothing.
- Every policy admits a system operation only through `(SELECT app_rls_bypass_on('<its own table>'))` — the
  sub-select makes it one evaluation per statement. The ownership and tenant helpers (`app_owns`,
  `app_tenant_*`, `app_organization_member_of`) no longer contain a bypass; a policy that admits system
  operations says so explicitly.
- A scope is `tables(…)`, or `allTables` with a typed reason: `request_scope` (guards, `@RlsBypass()` routes,
  the platform staff scopes — the route decides what they touch) or `not_yet_narrowed` (domain commands
  whose every branch has not been verified against a table list yet). A spec pins which operations are
  `request_scope`, so widening one is a visible change.

The platform's own plumbing and readers are table-scoped first (outbox, idempotency, audit readers, email
log, geo, catalog, encryption keys, GitHub webhooks, policy bundles, the tenant enumerator). The remaining
domain commands keep `allTables: not_yet_narrowed` deliberately: their footprints span several contexts
through transactional ports and Prisma `include`s, and narrowing one without exercising every branch would
turn an unexercised production path into an RLS denial. Each is narrowed by listing its tables and running
the API and browser e2e suites.

Eight allowlist names that no code used any more (folded into other operations during the DDD migration)
were removed; the registry spec's dead-entry check now ignores the name list itself, which had hidden them.

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
- A table-scoped operation cannot read or write any table outside its declared list, whatever its code does.
- Cross-tenant enumeration is auditable.

### Negative

- More boilerplate per worker type.
- A table-scoped operation that starts touching a new table fails closed (no rows / RLS error) until its
  registry scope lists the table and the SQL is regenerated.

## References

- `apps/api/src/prisma/system-operation.registry.ts`
- `packages/shared/src/schemas/infrastructure/tenant-job-context.ts`
- ADR 010
