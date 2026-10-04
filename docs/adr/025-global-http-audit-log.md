---
title: "ADR 025: One Global, Append-Only HTTP Audit Log"
tags: ["adr", "security", "audit", "rls", "nestjs"]
description: "Every state-changing HTTP request produces exactly one complete, redacted, append-only audit row — written by a global interceptor (success) and the global exception filter (failure), or inside the handler's own transaction."
author: "Backend Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=630&fit=crop"
order: 25
---

# ADR 025: One Global, Append-Only HTTP Audit Log

**Status:** Accepted (retention decision added 2026-10-04)
**Date:** 2026-10-03
**Deciders:** Backend Team

## Context

`rules/10` makes a complete audit entry (organization/tenant, user, impersonator, epoch
timestamp, endpoint, request, response, IP, device) mandatory for every state-changing
request. The API only had domain audit tables (organization, reward, permission,
impersonation, authorization decisions) written by hand in some services; most mutations
left no record, and failed or guard-rejected attempts left none at all.

## Decision

- **One table, `audit_logs`**, one row per `POST`/`PUT`/`PATCH`/`DELETE`, successful or
  failed. Columns: correlation id, `occurred_at`/`completed_at` (epoch ms), method, route
  template (`endpoint`), redacted path, outcome (`SUCCEEDED`/`FAILED`), response status,
  error code, actor user, impersonator, API key + terminal (machine callers), organization /
  store / location (server-verified, ADR 017), IP (`TRUST_PROXY` rules), User-Agent, redacted
  params/query, request body, response body, and the system operations (RLS bypasses) the
  request ran. The organization is the tenant, so there is no separate tenant column.
- **Who writes it:**
  - success → `AuditLogInterceptor` (global, outside `ResponseInterceptor`, so it stores the
    exact wire body). The response is released only after the row is written; if the write
    fails the request answers **500** — an unaudited change is never acknowledged as a clean
    success.
  - failure → `GlobalExceptionFilter`, for every error including guard rejections, validation
    errors and unknown routes, BEFORE the error is sent. If that write fails, the client still
    gets the original error and the full redacted entry is logged at `error`.
  - same transaction (opt-in) → a handler whose change runs in a system-operation transaction
    calls `AuditTrailService.recordInTransaction(tx, result)`; the row commits or rolls back with
    the change and the interceptor does not write a second success row. Geo writes use this.
- **Redaction before storage:** secrets → `[REDACTED]` (`common/logging/redaction.ts`), personal
  data masked (emails keep first character + domain, other PII → `[PII]`), only JSON bodies stored
  (others become `{ omitted, contentType }`), each payload capped at 16 KiB (larger → a
  `{ truncated, originalBytes }` marker).
- **Append-only, bypass-only:** `audit_logs` accepts INSERTs only under a named system operation
  (`audit.http_request.record`, or the operation of the handler's transaction); SELECT is
  bypass-only; UPDATE/DELETE are withheld from `app_runtime` (`prisma/rls/withheld-privileges.ts`).
- **Domain audit tables stay.** They record domain events (a role assigned, a policy published,
  an impersonation started) with domain fields. `audit_logs` records the HTTP request that caused
  them; both carry the same `correlation_id`, which is how an investigator joins them.

## Consequences

- Every mutation costs one extra INSERT (own transaction, or the handler's).
- **Retention: kept forever** (decided 2026-10-04). Nothing deletes or archives `audit_logs`
  rows, and `app_runtime` cannot. A product with a legal maximum retention period must record its
  own ADR and add an archival/purge job running as a dedicated system operation; until then the
  table grows with traffic — partition or archive it before it hurts.

## References

- `apps/api/src/common/audit/` — entry builder, repository, trail service, interceptor
- `apps/api/src/common/errors/global-exception.filter.ts`
- `apps/api/prisma/rls.sql` (`audit_logs_*` policies), `prisma/rls/withheld-privileges.ts`
- ADR 012 (system operations), ADR 016 (error envelope), ADR 017 (request context)
