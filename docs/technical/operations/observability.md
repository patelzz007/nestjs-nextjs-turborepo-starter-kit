---
title: "Observability: logs, health and audit"
description: "Correlation ids, the log level, structured logging, health probes (live, ready, deep), memory leak detection, NestJS Observe and the HTTP audit log."
order: 52
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop"
tags: ["operations", "logging", "health", "observability"]
---

# Observability: logs, health and audit

The standards (what to log, metrics, tracing, resilience) are in
[`rules/12-observability-and-operations.md`](../../../rules/12-observability-and-operations.md). This
page describes what the API does today.

## Correlation ids

Every request gets a correlation id (from `X-Correlation-Id` if the caller sent one, otherwise
generated). It is returned in the `X-Correlation-Id` response header and in `meta.correlationId` of
every response — success or error — and stamped on every log line written while handling that
request, together with `userId`, `impersonatorId` and `organizationId` once known (one typed request
context, [ADR 017](../../adr/017-unified-request-context.md)). Quote it in bug reports.

## Logs

- `LogService` (`apps/api/src/modules/logs/`) is the application logger: structured info / warn /
  error lines with metadata, routed through NestJS's logger. Fastify's request logger is pino.
- **One level for everything:** `LOG_LEVEL` (`fatal | error | warn | info | debug | trace | silent`)
  drives both pino and every Nest logger; `debug` / `trace` also enable Prisma query logging. See
  `apps/api/.env.example` for the current default per environment.
- Never log secrets, tokens, codes or full email addresses (emails are masked, e.g. `ali***@example.com`).
- Each use of an RLS bypass is logged as `rls.system_operation` with operation, role, reason,
  actor and correlation id ([Database security](../security/database-security.md)). Outside a
  request (jobs, workers) `TenantTransactionService` generates one correlation id per transaction;
  it is written to the transaction (`app.correlation_id`) and to that log line, and rows that record
  a correlation id (for example `organization_lifecycle_events`, via
  `OrganizationLifecycleEventRecorder`) read it back from the transaction, so the row and the log
  line always agree.

### Redaction

There is exactly **one** list of sensitive field names, `SENSITIVE_FIELD_NAMES`
(`apps/api/src/common/logging/redaction.ts`), and every log sink derives from it:

| Sink | Mechanism | Coverage |
| --- | --- | --- |
| Fastify's pino logger | `redact.paths` from `buildPinoRedactPaths()` | request/response headers + each field at the root and up to 3 levels deep (exact, case-sensitive paths) |
| `LogService` metadata | `redactSecrets(value)` | any depth, inside arrays, case-insensitive, `-`/`_` ignored (`Set-Cookie` = `set_cookie` = `setCookie`), cycle-safe, never mutates the input |
| URLs in access/error log lines | `redactUrl(url)` | query-string values of sensitive parameters (`?token=[REDACTED]&page=2`) |

Covered: passwords, tokens (access, refresh, id, session, CSRF), secrets and API/private keys,
`authorization` / `cookie` / `set-cookie` / `x-api-key` headers, OTP / TOTP / MFA / verification /
recovery / backup codes, `pairingCode`, card numbers, CVC/CVV, IBAN and account numbers — plus any
field whose normalized name **ends with** `password`, `secret`, `token`, `apikey`, `privatekey`,
`otp`, `cvv`, `cvc`, `cardnumber`, `accountnumber` or `pairingcode`. Values become `"[REDACTED]"`.

- `code` is redacted because it is the request-body field for 2FA / email OTP codes: log machine
  error codes as **`errorCode`**, never `code`.
- Free-text log **messages** are not scanned — never interpolate a secret into the message string.
- To protect a new field, add it to `SENSITIVE_FIELD_NAMES` and extend `redaction.spec.ts`; pino,
  `LogService` and URL redaction all pick it up.

## Health probes (unversioned)

| Endpoint | Purpose |
| --- | --- |
| `GET /health/live` | Liveness: the process is up (no dependencies checked) |
| `GET /health/ready` | Readiness: `startup` and `database` are **critical** (503 when down); `queue` (Redis/BullMQ), `kafka` and `rabbitmq` are reported but non-critical |
| `GET /health/deep` | Per-module indicators with details (e.g. Kafka producer `state` / `lastFailure`) — [ADR 006](../../adr/006-module-health-indicators.md) |
| `GET /health`, `GET /` | Legacy summary / hello |
| `GET /version` | API version manifest (raw body, no envelope) |

The Kafka indicator reports unhealthy until the producer has connected; with `KAFKA_BROKERS` unset,
Kafka is simply absent from the checks. Examples: [System API](../api-reference/system.md).

## Memory leak detection

`MemoryMonitorService` measures the heap right after each major GC and warns once per window when the
post-GC heap floor of the later half of `MEMORY_LEAK_WINDOW_MS` is at least
`MEMORY_LEAK_GROWTH_THRESHOLD_MB` above the earlier half's, judged only after `MEMORY_LEAK_WARMUP_MS`
from boot. It is always on in production and opt-in elsewhere (`MEMORY_MONITORING`).

## NestJS Observe

Optional APM (observe.nestjs.com): on in production when `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET`
are set; elsewhere set `OBSERVE_ENABLED=1` (then both are required). `OBSERVE_SERVICE_ID` names the
service.

## Audit log

Every state-changing HTTP request writes exactly one append-only row to `audit_logs`: user,
impersonator, organization, epoch-ms time, method and route, sanitized request and response,
outcome, IP, user agent / device and the system operations used. `app_runtime` cannot `UPDATE` or
`DELETE` it, and rows are **kept forever** ([ADR 025](../../adr/025-global-http-audit-log.md)).
Read it through `GET /api/v1/admin/audit` (`READ:AUDIT_LOG`).

## Queues

Bull Board (`http://localhost:3030` with `pnpm docker:up`) shows BullMQ queues under the `bull`
prefix; set `BULLMQ_PREFIX` per environment or per test run to isolate jobs on a shared Redis
([Messaging](../messaging.md)).
