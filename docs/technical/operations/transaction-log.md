---
title: "Transaction log (.txt)"
description: "A plain-text copy of every audit row: one readable entry per request, failure and system command, in a .txt file per UTC day, written through BullMQ off the request path."
order: 53
author: "Platform Team"
lastUpdated: 1792972800000
coverImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&h=630&fit=crop"
tags: ["operations", "logging", "audit", "bullmq"]
---

# Transaction log (.txt)

Every transaction the API records in its audit log also lands in a plain-text file that you can
read with `tail`, `less` or `grep`, with no database or admin panel in between. One file holds one
UTC day:

```text
logs/transactions/transactions-2026-10-26.txt        (at the repository root)
```

The `AuditLog` table ([ADR 025](../../adr/025-global-http-audit-log.md), read under
**Platform → Audit log**) stays the record of truth. The text file is a convenience copy, and it
can never slow down or fail a request.

## What goes in

The same rows as the audit log, with the same redaction: secrets become `[REDACTED]`, personal data
is masked, and each payload is size-capped before it is written.

| Row | Written when |
| --- | --- |
| A request that succeeded (reads included) | The audit row was written. A success the audit table refused is not logged, because that request fails with a 500 instead. |
| A request that failed (guards, validation, 404, 500, …) | Always, even when the audit table could not take the row. |
| A sensitive read (an export, the audit viewer) | With its summary, as in the audit log. |
| A row a handler appended inside its own transaction | Once the request succeeded, so the transaction committed. |
| A system command (job, cron, CLI, consumer) | The audit row was written. |

The health probes are left out, as they are from the audit log.

## What an entry looks like

Each entry is a block you read top to bottom: a title, then one labelled line per fact, then the
headers and payloads. A failed background job:

```text
================================================================================
2026-10-25 18:06:58.211 UTC  FAILED 500 INTERNAL_ERROR  JOB claims.expire-referrer
--------------------------------------------------------------------------------
  Result       FAILED: answered 500 INTERNAL_ERROR after 0 ms
  Reason       Error: Expiring referrer claims failed
               caused by Error [P1001]: Can't reach database server at `localhost:5432`
               at ExpireOverdueReferrerClaimsHandler.execute (src/contexts/…/handler.ts:42:13)
  Command      ExpireOverdueReferrerClaimsCommand (job claims.expire-referrer)
  Who          the system, no user (background work)
               system operation queue.claims.expire_referrer
               why: Expire overdue referrer-credit reward claims
  Tenant       none: platform-wide
  Trace        correlation e4Qgk8WgtinpKxUMz6ZN6
               system operations: queue.claims.expire_referrer

  Command input
    { … }

  Command result
    { … }

```

A merchant request:

```text
================================================================================
2026-10-26 08:48:16.172 UTC  SUCCEEDED 200  PATCH /api/v1/tenants/brew-bean-kl/locations/c2e1…
--------------------------------------------------------------------------------
  Result       SUCCEEDED: answered 200 after 106 ms
  Endpoint     PATCH /api/v1/tenants/:tenantSlug/locations/:locationId
  Who          Brew Owner <brew.owner@kl-rewards.demo>
               user 019b76da-…, session 0193aa10-…, signed in with SESSION_COOKIE
  Tenant       019b76da-… (brew-bean-kl), location c2e1…, verified by the API
               X-Tenant-Id 019b76da-… (matches), X-Location-Id not sent
  Client       merchant app, Chrome 155.0.0.0 on macOS 10.15.7 (DESKTOP)
               IP 127.0.0.1 (LOOPBACK)
               origin http://localhost:3002
  Trace        correlation hkb1P6jg…
               system operations: auth.principal.lookup, tenant.context.resolve_membership

  Request headers
    accept: application/json
    cookie: [REDACTED] (merchant_access_token)
    x-client-type: merchant
    x-tenant-id: 019b76da-…

  Request params and query
    { … }

  Request body
    {
      "name": "Bukit Bintang"
    }

```

| Line | What it says |
| --- | --- |
| Title | When (UTC), how it ended (outcome, status, error code), and what was asked: the method and path, or the job, cron or script. |
| **Result** | The outcome, the status and error code the caller got, and how long it took. |
| **Reason** | Failures only. What the server knew, not just the code the caller saw: the exception's class, its own message, the machine code it carried (`P2025`, `ECONNREFUSED`), its `cause` chain and, for a 5xx or a job, the first stack frames. URL credentials are redacted and e-mail addresses masked. |
| **Endpoint** / **Command** | The route template, or the command class and its origin. |
| **Who** | The person, by name and e-mail as their credential carried them when the request ran, then their user id, device session and credential type. An impersonator or support grant behind them, an API key and POS terminal, or "anonymous". For a job: the system, the user it ran for (if any), its system operation and why it ran. |
| **Tenant** | The tenant (and its slug, on a tenant route) and location the API verified. Underneath, the `X-Tenant-Id` and `X-Location-Id` the client sent, compared with the verified ones: `matches`, `DIFFERS from the verified one`, `not verified` or `not sent`. A request outside any tenant says `none`. |
| **Client** | The app (`X-Client-Type`), browser, OS and device, the address and its class, the CDN location, `Origin` and `Referer`. |
| **Trace** | The correlation id (the key to the audit row, the server logs and the database changes), the trace id when it differs, the `Idempotency-Key`, and the system operations (RLS bypasses) the request used. |
| Request headers | Every header, as sent. `Authorization`, `X-Api-Key` and every other credential read `[REDACTED]`; a `Cookie` header lists the cookie names only. |
| Payloads | Route params and query, request body, response body: redacted, size-capped, pretty-printed the way `jq` prints them. |

A fact that is missing says so (`not sent`, `none`, `not recorded`) instead of disappearing, so you
never have to wonder whether it was left out.

**Reading the file.** Every entry opens with a line of `=` at the start of a line. Nothing else
starts with `=`: every fact, header and payload line is indented. The title under the rule always
starts with the date.

```bash
grep -c '^=\{80\}$' transactions-2026-10-26.txt                     # entries today
grep -E '^[0-9-]+ [0-9:.]+ UTC  FAILED' transactions-2026-10-26.txt   # failures, one title each
# One whole entry, by correlation id (or any text in it: a user id, an e-mail, a tenant id):
awk '/^=+$/{if (e ~ /hkb1P6jg/) printf "%s", e; e=""} {e = e $0 "\n"} END{if (e ~ /hkb1P6jg/) printf "%s", e}' transactions-2026-10-26.txt
```

**Personal data.** The file names people (the actor's name and e-mail) so a reader can tell who
acted without a database at hand. Treat the folder like the audit table: restrict who can read it,
and keep `TRANSACTION_LOG_RETENTION_DAYS` within your retention policy. The audit table itself keeps
only the user id; the admin viewer looks the name up when you open a record.

## How it is written without blocking

```text
request ──► AuditTrailService ──► AuditLog row (database)
                    │
                    └─► TransactionLog.record(entry)   returns at once
                           │
             Redis set ────┼──► BullMQ  transaction-log.write ──► worker ──► append to the day file
                           │
             no Redis  ────┴──► asynchronous append (the I/O thread pool)
```

- **`TransactionLog.record` never waits and never throws.** It formats the entry, hands it off and
  returns. The response does not wait for Redis or the disk.
- **With Redis**, each entry becomes one `transaction-log.write` job. The worker
  (`TransactionLogWriteProcessor`) appends it. A failed write is retried 5 times with exponential
  backoff (the `transactionLogWrite` preset in `QUEUE_JOB_OPTIONS`). A job that runs out of
  attempts stays in Bull Board's failed list, where you can replay it.
- **One worker at a time, cluster-wide.** The queue's global concurrency is 1, so entries reach the
  file in the order they were queued, and two instances never append to the same file at once.
- **Redis unreachable is no single point of failure.** When a job cannot be queued, that instance
  appends the entry itself and logs `transaction_log.enqueue_failed`.
- **Without Redis** (development, a single instance, the CLI), entries are appended directly. The
  appends are chained, so entries land whole and in order.
- **Shutdown** waits for the appends still in flight.

## Retention

Each API instance deletes day files older than `TRANSACTION_LOG_RETENTION_DAYS` at boot and then
hourly (`TransactionLogRetentionScheduler`). It touches only files named
`transactions-YYYY-MM-DD.txt`. This runs in-process on every instance on purpose: the files live on
each instance's disk, so a cluster-wide job would clean only the disk of the instance that picked
it up. On a shared folder, concurrent runs are harmless.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `TRANSACTION_LOG_ENABLED` | on (off under `NODE_ENV=test`) | `true` / `false`. |
| `TRANSACTION_LOG_DIR` | `logs/transactions` | Folder of the day files. A relative path is taken from the repository root (the folder holding `pnpm-workspace.yaml`), so `<repo>/logs/transactions` whichever folder the API runs from (git-ignored). Without a repository around it, as in a deployed bundle, it is taken from the working directory. Before 2026-10-26 the default landed in `apps/api/logs/transactions`; older files there are not moved. |
| `TRANSACTION_LOG_RETENTION_DAYS` | `30` | Day files older than this many days are deleted (min 1). |

## Running more than one instance

The worker that appends an entry can run on any instance, so give every instance the same folder,
a shared volume such as EFS, or each instance's file holds only the entries it happened to write.
Global concurrency 1 keeps a shared file free of interleaved writes. On a container platform
without a shared volume, ship the folder to your log store instead (a sidecar or the platform's
log agent). The file is plain text, so any agent can read it.

**Throughput.** One worker cluster-wide appends one entry per job. That is far more than a starter
deployment produces. If the queue's waiting count keeps growing in Bull Board, the file is falling
behind, never the requests.

## Code

| Piece | Where |
| --- | --- |
| Port, plus the no-op used when the log is off | `apps/api/src/platform/infrastructure/transaction-log/transaction-log.port.ts` |
| Entry format and day files (pure) | `…/transaction-log-format.ts` |
| The failure reason (exception, causes, stack) | `apps/api/src/platform/infrastructure/audit/audit-error-detail.ts` |
| Where a relative folder points | `apps/api/src/platform/infrastructure/utils/workspace-root.ts` |
| Appends and retention | `…/transaction-log-file-writer.ts` |
| BullMQ producer (direct-write fallback), the worker, direct appends | `…/queued-transaction-log.ts`, `…/transaction-log-write.processor.ts`, `…/direct-transaction-log.ts` |
| Wiring: off / with Redis / without Redis | `…/transaction-log.module.ts` (imported by `AuditLogModule`) |
| Where rows are handed over | `apps/api/src/platform/infrastructure/audit/audit-trail.service.ts` |
| Queue name and job payload | `packages/shared` → `QUEUE_NAMES.transactionLogWrite`, `TransactionLogWriteJobSchema` |
