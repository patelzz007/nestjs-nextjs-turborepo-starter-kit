---
title: "ADR 064: Plain-text transaction log through BullMQ"
tags: ["adr", "audit", "logging", "bullmq", "operations"]
description: "Every audit row is also appended to a readable .txt file per UTC day, handed off without waiting (BullMQ when Redis is set, an asynchronous append otherwise), with the AuditLog table staying the record of truth."
author: "Platform Team"
lastUpdated: 1792972800000
coverImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=1600&q=80"
order: 64
---

# ADR 064: Plain-text transaction log through BullMQ

## Status

Accepted (2026-10-26). Extends [ADR 025](./025-global-http-audit-log.md) and changes none of its
guarantees. Operating guide: [Transaction log (.txt)](../technical/operations/transaction-log.md).

## Context

The audit log is a database table, read through the admin panel or its API. Operators also want a
copy they can read with `tail`, `grep` or `less` on the host, ship with any log agent, and keep when
the database is unreachable. Writing a file must not add latency to a request or a way for a request
to fail. The audit row is already written before the response goes out (ADR 025), and that cost is
deliberate. A second synchronous write would double it for no gain in safety.

## Decision

1. **Same rows, same redaction.** `AuditTrailService` hands every row it writes to a
   `TransactionLog` port: a success after its row is written, every failure (even when the table
   refused it), a sensitive-read summary, a system command, and a row a handler appended in its own
   transaction once the request succeeded. The entry is the redacted `HttpAuditEntry`. The file
   holds one thing the table does not: the actor's name and e-mail as their credential carried
   them (amended 2026-10-26, decision 6).
2. **`record` returns at once and never throws.** With Redis, the entry becomes one
   `transaction-log.write` BullMQ job. Its worker appends it and retries a failed write
   (`transactionLogWrite` preset), and a job that runs out of attempts stays in the failed set. The
   queue's global concurrency is 1, so the file stays in order and a shared folder is never written
   by two instances at once. When the job cannot be queued, the instance appends the entry itself,
   so Redis is not a single point of failure. Without Redis, entries are appended asynchronously by
   a chained writer.
3. **Readable text** (redesigned 2026-10-26). Each entry is a block: a `=` rule, a title (time,
   outcome, status, error code, method and path or job), then one labelled line per fact
   (Result, Reason for a failure, Endpoint or Command, Who, Tenant, Client, Trace), then every
   request header and the payloads, pretty-printed as `jq` prints them. Everything inside an
   entry is indented, so only the rule starts a line with `=`. An absent fact is stated
   (`not sent`, `none`), never dropped. The first version, one `key=value` line, proved hard to
   read and hid what was missing. One file per UTC day: `transactions-YYYY-MM-DD.txt` under
   `TRANSACTION_LOG_DIR` (default `logs/transactions`, taken from the repository root since
   2026-10-26; it was relative to the API's working directory, `apps/api`).
4. **Retention per instance.** Day files past `TRANSACTION_LOG_RETENTION_DAYS` (default 30) are
   deleted at boot and hourly, in-process on every instance, because the files live on each
   instance's disk.
5. **On by default, off under tests** (`TRANSACTION_LOG_ENABLED`).
6. **A person, not just an id** (added 2026-10-26). The entry names the actor by the name and
   e-mail their credential carried when the request ran (`HttpAuditEntry.actorIdentity`, not a
   column), so whoever reads the file can tell who acted without the database. The audit table
   keeps the id only, and its viewer looks the current name up. The folder therefore holds
   personal data and is protected and retained like the audit table.

## Consequences

- The table stays authoritative. An entry can be missing from the file (a crash between the audit
  write and the hand-off, or a job that exhausted its attempts), never the other way round.
- A request whose row was appended in its own transaction, and that then fails after that
  transaction committed, gets only its FAILED entry in the file. The service cannot tell a
  committed transaction from a rolled-back one at that point, and it never logs a change that may
  not have happened.
- With several instances, the folder must be shared (EFS or similar) or shipped by a log agent.
  Otherwise each instance's file holds only the entries its worker wrote.
- Throughput is one append per job through a single cluster-wide worker. Under a sustained load
  above that, the queue grows, and requests are not affected.
- Each queued entry carries its formatted text, up to the audit log's payload caps, through Redis
  until the job completes.

## References

- `apps/api/src/platform/infrastructure/transaction-log/`
- `apps/api/src/platform/infrastructure/audit/audit-trail.service.ts`
- `packages/shared/src/schemas/infrastructure/queue.ts` (`transaction-log.write`, `TransactionLogWriteJobSchema`), `queue-job-options.ts` (`transactionLogWrite`)
