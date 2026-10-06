---
title: "ADR 025: One Global, Append-Only HTTP Audit Log"
tags: ["adr", "security", "audit", "rls", "nestjs"]
description: "Every HTTP request — reads included — produces exactly one complete, redacted, append-only audit row — written by a global interceptor (success) and the global exception filter (failure), or inside the handler's own transaction."
author: "Backend Team"
lastUpdated: 1791244800000
coverImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=630&fit=crop"
order: 25
---

# ADR 025: One Global, Append-Only HTTP Audit Log

**Status:** Accepted (retention decision added 2026-10-04; request metadata, the admin viewer, auditing every request and device / location / search added 2026-10-06)
**Date:** 2026-10-03
**Deciders:** Backend Team

## Context

`rules/10` makes a complete audit entry (organization/tenant, user, impersonator, epoch
timestamp, endpoint, request, response, IP, device) mandatory for every state-changing
request. The API only had domain audit tables (organization, reward, permission,
impersonation, authorization decisions) written by hand in some services; most mutations
left no record, and failed or guard-rejected attempts left none at all.

## Decision

- **One table, `audit_logs`**, one row per HTTP request, successful or failed. Originally only
  `POST`/`PUT`/`PATCH`/`DELETE`; since 2026-10-06 **every request is audited, reads included**
  (see "Auditing every request" below). Columns: correlation id, `occurred_at`/`completed_at` (epoch ms), method, route
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
- **Request metadata (added 2026-10-06).** Each row also records the trace id, the
  impersonation session id, how the caller authenticated (`auth_method`: `SESSION_COOKIE`,
  `BEARER_TOKEN`, `REFRESH_COOKIE`, `API_KEY`; NULL = anonymous — set by the auth guards on the
  request context, never read from a client header), the claimed client app (`X-Client-Type`),
  HTTP version, `Host`, `Origin`, `Referer` (sensitive query parameters redacted like `path`),
  `Accept-Language`, request `Content-Type`, declared request size (`Content-Length`) and the
  `Idempotency-Key`. Header values are bounded to their columns and stored as sent: they describe
  what the client claimed, which is itself evidence. Rows written before these columns existed
  keep NULL there.
- **Auditing every request (added 2026-10-06).** Reads are audited exactly like writes: a GET
  gets one SUCCEEDED row with the (redacted, 16 KiB-capped) response it released, and a refused
  or unmatched read (401, 403, 404, 429 …) gets a FAILED row. Two exemptions, both deliberate:
  the automated **health probes** (`/health/live`, `/health/ready`, legacy `/health` —
  `common/http/probe-routes.ts`), which load balancers and monitors call every few seconds with no
  principal; and **SSE streams** (`@Sse()`), which have no single response — their failures are
  still recorded. A handler that releases data in bulk (an export, the audit viewer) records a
  **summary** of what it released (`recordSensitiveRead`) and that summary *is* the request's row —
  the interceptor does not add the full response as a second one.
- **Device, network and location (added 2026-10-06), no third-party code.**
  - Device: the User-Agent is parsed by `common/http/user-agent.ts` (an ordered rule set: browsers,
    the Expo apps' CFNetwork / okhttp, HTTP tools and SDKs, crawlers) into browser + version,
    OS + version, device type (`DESKTOP`/`MOBILE`/`TABLET`/`BOT`/`UNKNOWN`) and model. It
    describes what the client *claimed*; the raw User-Agent is stored next to it.
  - Network: `common/http/ip-classification.ts` classifies the address against the IANA
    special-purpose ranges with Node's `net.BlockList` → IP version and `ip_scope` (`PUBLIC`,
    `PRIVATE`, `LOOPBACK`, `LINK_LOCAL`, `SHARED` (carrier NAT), `DOCUMENTATION`, `MULTICAST`,
    `RESERVED`).
  - Location: an address says nothing about geography without a GeoIP database, which would be a
    third-party data set. Instead the API reads the geo headers the **CDN edge** adds
    (CloudFront `CloudFront-Viewer-*`, Cloudflare `CF-IPCountry` / `CF-IPCity` / …, Vercel
    `X-Vercel-IP-*`) → country, region, city, time zone — and only when the TCP peer is a
    **trusted proxy** (`TRUST_PROXY`), so a direct client cannot claim a location. Without a
    geo-locating CDN in front, the geo columns stay NULL. The edge must overwrite these headers
    (CloudFront, Cloudflare and Vercel do).
- **Search (added 2026-10-06).** The viewer's `?search=` (case-insensitive substring over path,
  route template, error code, IP and User-Agent; exact correlation id) is served by `pg_trgm`
  GIN indexes (`audit_logs_*_trgm_idx`), so it does not scan the table.
- **Reading it (added 2026-10-06).** `GET /admin/audit-logs` (list, no payloads) and
  `GET /admin/audit-logs/:id` (complete record) serve the admin viewer (`/audit-logs` in the admin
  panel). They require admin-panel access plus `LIST:AUDIT_LOG` / `READ:AUDIT_LOG` (Admin,
  Manager and SuperAdmin hold both) and read under the dedicated `audit.http_request.read` system
  operation, which also resolves the actor / impersonator names and the organization name (no
  foreign keys: an id that no longer resolves is still shown). **Every read is itself recorded**
  as a sensitive read (`AuditTrailService.recordSensitiveRead`) BEFORE the data is released; if
  that row cannot be written the read fails.
- **Domain audit tables stay.** They record domain events (a role assigned, a policy published,
  an impersonation started) with domain fields. `audit_logs` records the HTTP request that caused
  them; both carry the same `correlation_id`, which is how an investigator joins them.

## Consequences

- **Every request costs one extra INSERT before its response is released** — reads included —
  and the table grows with total traffic, not only with writes (each row also carries the
  response body, capped at 16 KiB). Watch its size; partition by `occurred_at` or archive before
  it hurts. Five trigram GIN indexes make each INSERT slightly more expensive in exchange for
  index-backed search.
- Background polling by the frontends (query refetch on focus) shows up as GET rows; that is the
  intended record of who looked at what, not noise to suppress.
- **Retention: kept forever** (decided 2026-10-04). Nothing deletes or archives `audit_logs`
  rows, and `app_runtime` cannot. A product with a legal maximum retention period must record its
  own ADR and add an archival/purge job running as a dedicated system operation; until then the
  table grows with traffic — partition or archive it before it hurts.

## References

- `apps/api/src/common/audit/` — entry builder, repository, trail service, interceptor
- `apps/api/src/common/http/` — `user-agent.ts`, `ip-classification.ts`, `edge-location.ts`, `probe-routes.ts`
- `apps/api/src/modules/audit-logs/` — the read side (viewer API); `packages/shared/src/schemas/domain/platform/http-audit-log.ts` — its contract
- `apps/admin/app/(panel)/audit-logs/` — the admin viewer
- `apps/api/src/common/errors/global-exception.filter.ts`
- `apps/api/prisma/rls.sql` (`audit_logs_*` policies), `prisma/rls/withheld-privileges.ts`
- ADR 012 (system operations), ADR 016 (error envelope), ADR 017 (request context)
