---
title: "Messaging Infrastructure"
tags: ["infrastructure", "messaging", "kafka", "bullmq", "redis", "outbox", "inbox", "idempotency"]
description: "Operational reference for Redis, BullMQ, Kafka, queues, the transactional outbox, and the consumer inbox."
author: "Backend Team"
lastUpdated: 1790841600000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
---

# Messaging infrastructure

Operational reference. For the big picture (ELI5 + diagrams), read [architecture-eli5.md](./architecture-eli5.md).

## Package layout

| Location | Role |
|----------|------|
| `packages/messaging` | **Generic** Redis / BullMQ / Kafka / RabbitMQ Nest modules |
| `apps/api/src/messaging/app-messaging.config.ts` | **This app’s** client id + queue list |
| `apps/api/src/messaging/app-messaging.module.ts` | Wires generic package + outbox workers |
| `apps/api/src/infrastructure/outbox/` | Transactional outbox: producer API + dispatcher (app-specific) |
| `apps/api/src/modules/*/ *-queue.module.ts` | Domain BullMQ processors |
| `apps/analytics-consumer` | Kafka → inbox (dedupe) → `analytics_events` |

## Overview

| System | Role in this repo |
|--------|-------------------|
| **Redis** | Authorization cache pub/sub + BullMQ backend |
| **BullMQ** | Internal jobs (`email.send`, rewards maintenance, outbox sweep, storage cleanup, idempotency retention) |
| **Kafka** | Durable platform events (analytics / warehouse) |
| **RabbitMQ** | Docker placeholder — see [ADR](../adr/rabbitmq-placeholder.md) |

## Local development

```bash
pnpm docker:up          # Redis, Kafka, RabbitMQ, Bull Board
pnpm db:migrate         # outbox_events, inbox_processed_events, inbox_dead_letters, analytics_events + RLS
pnpm dev:api
pnpm dev:analytics-consumer   # optional — loads apps/api/.env and creates Kafka topics if missing
```

The analytics consumer reads `DATABASE_URL` and `KAFKA_BROKERS` from `apps/api/.env` automatically. On first start it creates any missing `platform.*` Kafka topics before subscribing (required on KRaft — subscribing to non-existent topics fails).

Required env (API):

- `REDIS_URL=redis://localhost:6379` — required outside `NODE_ENV=development`
- `KAFKA_BROKERS=localhost:9092` — enables Kafka producer + outbox publish worker

Optional:

- `MESSAGING_CLIENT_ID` / `MESSAGING_CONNECTION_NAME` — broker client labels
- `RABBITMQ_URL` — placeholder health only
- `ANALYTICS_INBOX_RETENTION_DAYS` — analytics consumer only (read from the same `apps/api/.env`): days an inbox claim is kept, default 14, minimum 8 (must exceed Kafka topic retention — see [Retention](#retention))

## Event flow (must-not-lose)

Decision record: [ADR 015 — Transactional outbox + consumer inbox](../adr/015-transactional-outbox-and-inbox.md).

1. **Same transaction.** The domain code that changes state writes its platform event with `PlatformOutboxService.enqueueInTransaction(tx, { type, payload })` **inside the transaction that performs the change**. Commit ⇒ the event row exists; rollback ⇒ it never existed. The row id is the event's stable `eventId`.
2. **Sweep.** The BullMQ `outbox.publish` scheduler runs every 5s. `OutboxPublishProcessor` runs `OutboxDispatcher` under the `outbox.publish` system operation.
3. **Claim with a lease.** `OutboxDispatchRepository.claimDue` pushes `available_at` of up to 50 due `PENDING` rows past a 2-minute lease (`FOR UPDATE SKIP LOCKED`), so several API instances can sweep without claiming the same row.
4. **Publish, then mark.** Each row is re-validated (`PlatformEventEnvelopeSchema`, topic ↔ type), published to Kafka as `PlatformEventMessage` (envelope + `eventId`, plus `event-id` / `event-type` headers), then marked `PUBLISHED`.
5. **Consume idempotently.** `apps/analytics-consumer` validates each message with `PlatformEventMessageSchema`, then in **one** transaction claims `(consumer, eventId)` in `inbox_processed_events` (`INSERT … ON CONFLICT DO NOTHING`) and — only for a new claim — inserts the `analytics_events` row (id = `eventId`).

### Guarantees

| Property | Guarantee | How |
|----------|-----------|-----|
| DB change ⇔ event | Atomic | Outbox row written in the domain transaction |
| Delivery to Kafka | At-least-once | Publish → mark; a crash in between republishes the same `eventId` after the lease lapses |
| Effect in a consumer | Exactly-once per consumer | Inbox primary key `(consumer, event_id)` in the same transaction as the side effect |
| Ordering | Best-effort per partition key | Rows publish in `created_at` order, but a row in retry backoff can be overtaken — consumers must not depend on cross-event order |
| Broker down | API requests unaffected | Only the outbox row is written in-request; the dispatcher catches up |

### Which API to call

| Situation | Call |
|-----------|------|
| The event describes a DB change (reward published, claim expired, session revoked, impersonation audited, email logged) | `outbox.enqueueInTransaction(tx, event)` inside that change's transaction. Repositories that own the transaction take a `withinTransaction: (tx) => Promise<void>` hook (e.g. `RewardRepository.autoPublishInTransaction`, `RefreshTokenRepository.revokeById`, `UserSessionRevocationService.revokeAllSessionsForUsers`). |
| The event describes **no** DB write (a rejected refresh, auth-flow outcome telemetry via `@TrackAuthFlow`) | `outbox.recordTelemetry(event)` — its own awaited transaction under `outbox.enqueue`; never throws, returns `{ recorded: false, error }` and logs `outbox.telemetry_record_failed` so telemetry can never replace the caller's real outcome. |

There is **no fire-and-forget path**: never `void` an outbox call, and never publish to Kafka directly from a request.

### RLS

`outbox_events` reads/updates are bypass-only. A separate `outbox_events_append` policy lets **any** app session `INSERT` a fresh row (`status = 'PENDING'`, `attempts = 0`, no `published_at` / `last_error`) — that is what lets the event share a user/tenant-scoped transaction. The producer assigns the id and inserts with `createMany` (no `RETURNING`, so no SELECT visibility is needed). `inbox_processed_events` and `inbox_dead_letters` are bypass-only; the consumer writes them as `app_runtime` with `app.rls_bypass = true` and `app.system_operation = 'analytics.ingest'` — never as the superuser.

### Failure handling

| Where | Failure | Behaviour |
|-------|---------|-----------|
| Dispatcher | Publish error | `attempts + 1`, retry after exponential backoff with ±20% jitter (base 1.5s × 2ⁿ, capped at 5 min — attempts/base from the `outboxPublish` preset). The rest of the batch is released, not attempted, so a down broker is not hit once per row. |
| Dispatcher | `attempts` reaches 8 (`QUEUE_JOB_OPTIONS.outboxPublish.attempts`) | Dead-lettered: `status = 'FAILED'`, `last_error` kept, `outbox.dead_lettered` error log. |
| Dispatcher | Stored row malformed (bad envelope, topic ↔ type mismatch) | Dead-lettered immediately — retrying cannot help, and it never blocks the rows behind it. |
| Consumer | Empty value, invalid JSON, schema violation, wrong topic | Parked in `inbox_dead_letters` (reason + raw value), offset committed — no crash loop. Parking the same record twice is a no-op (unique Kafka coordinates). |
| Consumer | DB rejects this record's data (SQLSTATE class 22 / 23) | Parked as `PERMANENT_PROCESSING_ERROR`. |
| Consumer | Transient error (connection loss, deadlock, serialization, permissions) | Transaction rolls back (claim included), handler rethrows, Kafka redelivers after kafkajs' retry backoff. The partition waits rather than dropping the event. |

## Operations runbook

**Structured log events** (one JSON object / structured Nest log per line):

| Event | Level | Meaning |
|-------|-------|---------|
| `outbox.published` | log | One row published (`eventId`, `topic`, `attempt`, `durationMs`) |
| `outbox.dispatch_summary` | log | Per sweep: `claimed`, `published`, `retried`, `deadLettered`, `released` |
| `outbox.publish_failed` | warn | Retry scheduled (`attempt`, `retryInMs`, `error`) |
| `outbox.dead_lettered` | error | Row moved to `FAILED` — **alert on this** |
| `outbox.backlog_stale` | warn | Oldest `PENDING` row older than 5 min — publishing is stuck (`pendingCount`, `oldestPendingAgeMs`, `deadLetteredCount`) |
| `outbox.telemetry_record_failed` | error | A no-write telemetry event could not be stored |
| `analytics.event_ingested` / `analytics.event_duplicate` | info | Applied / skipped as a redelivery |
| `analytics.message_parked` | warn | Poison message parked — **alert on this** |
| `analytics.processing_failed_transient` | error | Will be redelivered |

**Backlog check**

```sql
SELECT status, COUNT(*), MIN(created_at) AS oldest_created_at FROM outbox_events GROUP BY status;
```

**Re-queue a dead-lettered outbox row** once the cause is fixed (it keeps its `eventId`, so consumers still dedupe):

```sql
UPDATE outbox_events
SET status = 'PENDING', attempts = 0, last_error = NULL,
    available_at = (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    updated_at = (EXTRACT(EPOCH FROM now()) * 1000)::bigint
WHERE id = '<event id>' AND status = 'FAILED';
```

**Inspect parked consumer messages**

```sql
SELECT received_at, topic, partition, "offset", reason, event_id, error FROM inbox_dead_letters
WHERE consumer = 'analytics-warehouse' ORDER BY received_at DESC LIMIT 50;
```

Fix the producer or the consumer, then replay `raw_value` (re-produce it to its topic); delete the dead-letter row once handled.

## Retention

Two ledgers would otherwise grow forever. Each is purged by the process that owns it, in bounded batches (`purgeInBatches` in `@workspace/shared` — one short transaction per batch, a per-run time budget, the rest left for the next run), and each run logs one summary line.

| Table | Job | Where / schedule | Deletes | Concurrency guard |
|-------|-----|------------------|---------|-------------------|
| `platform_resource_idempotency_records` | `IdempotencyRetentionService` (`apps/api/src/platform/idempotency/`) | API, BullMQ queue `idempotency.retention`, job scheduler `idempotency-retention`, hourly | Rows with `expires_at` more than **1 hour** in the past — COMPLETED rows past their 24 h replay window and abandoned IN_PROGRESS rows past their 60 s lease. 500 rows/batch, 60 s budget. | One BullMQ scheduler cluster-wide (`upsertJobScheduler` with a fixed id), so each tick is ONE job on ONE worker; the 60 s budget is far below the 1 h interval. Runs under the registered `idempotency.retention` system operation. |
| `inbox_processed_events` | `runInboxRetention` (`apps/analytics-consumer/src/inbox-retention.ts`) | analytics-consumer, in-process timer: first run 1 min after start, then hourly | Claims with `processed_at` older than `ANALYTICS_INBOX_RETENTION_DAYS` (default **14**, minimum 8). 1 000 rows/batch, 60 s budget, `FOR UPDATE SKIP LOCKED`. | Postgres advisory lock `pg_try_advisory_lock(hashtextextended('analytics.inbox_retention', 0))` on a dedicated connection — a second consumer instance skips the run instead of waiting. Deletes run as `app_runtime` + bypass tagged `app.system_operation = 'analytics.inbox_retention'`. |
| `inbox_dead_letters` | none — **never auto-deleted** | — | Operators delete a row once its message is replayed or judged irrelevant. | — |

**Why the idempotency grace is 1 hour.** An expired record is already equivalent to a missing one — the service takes it over in place — so the grace does not change what a client sees. It keeps the purge clear of a request that is taking over a just-expired row, and absorbs clock skew between API instances (each stamps `expires_at` from its own clock). The DELETE also re-checks `expires_at < cutoff` on the rows it locks, so a row taken over in the meantime (new lease in the future) survives. If the purge removes a row between a request's failed insert and its read, `begin()` simply acquires the key again.

**Why the inbox window must exceed Kafka's redelivery horizon.** The inbox only dedupes ids it still holds. Kafka can hand a record back for as long as it is in the topic log: a rebalance or a crash before the offset commit, a lagging group, or an operator resetting offsets (`--to-earliest`) all replay from the log, which is bounded by topic retention — `log.retention.hours` = 168 (7 days) by default, and the compose broker uses the default. So the window must be strictly longer than topic retention: the schema rejects less than 8 days, and the default is 14 days to also cover an operator re-queuing a `FAILED` outbox row days later (it republishes the same `eventId`) and a topic whose retention was raised afterwards. **If you raise `retention.ms` on a `platform.*` topic, raise `ANALYTICS_INBOX_RETENTION_DAYS` above it.** Defence in depth: `analytics_events.id` is the `eventId` and is inserted `ON CONFLICT DO NOTHING`, so even a purged claim does not produce a duplicate analytics row.

**Why dead letters are kept.** They are unresolved work items, one row per poison Kafka record (low volume by construction), and the only copy of `raw_value` once the topic has rolled over. Deleting them automatically would silently discard evidence and replayable data. Alert on `analytics.message_parked`, and delete rows by hand once handled.

**Without Redis** (allowed in development), the BullMQ idempotency job does not run — like every other BullMQ job. Expired rows are harmless (taken over in place); they are purged once Redis is configured.

**Log events**

| Event | Level | Meaning |
|-------|-------|---------|
| `idempotency.retention_summary` | log / warn | Per run: `deleted`, `batches`, `durationMs`, `stoppedBy` (`drained` / `time_budget`), `cutoffEpochMs`. `warn` when the time budget stopped it — repeated warnings mean the table grows faster than one run per hour drains it. |
| `analytics.inbox_retention_summary` | info / warn | Same fields plus `retentionDays`. |
| `analytics.inbox_retention_skipped` | info | Another consumer instance holds the retention lock. |
| `analytics.inbox_retention_failed` | error | The run failed (e.g. database down); retried on the next tick. The consumer keeps consuming. |

**Check the backlog**

```sql
SELECT COUNT(*) FILTER (WHERE expires_at < (EXTRACT(EPOCH FROM now()) * 1000)::bigint - 3600000) AS purgeable, COUNT(*) AS total
FROM platform_resource_idempotency_records;

SELECT consumer, COUNT(*), MIN(processed_at) AS oldest FROM inbox_processed_events GROUP BY consumer;
```

## Queues

| Queue | Purpose |
|-------|---------|
| `email.send` | Async email delivery |
| `rewards.auto-publish` | Auto-publish reviewed rewards |
| `claims.expire-pending` | Expire consumer claims |
| `claims.expire-referrer` | Expire referrer credit claims |
| `outbox.publish` | Sweep outbox → Kafka |
| `storage.cleanup` / `storage.delete` | Stale upload cleanup / object deletion |
| `idempotency.retention` | Hourly purge of expired `Idempotency-Key` records (see [Retention](#retention)) |

Job retry defaults: `packages/shared` → `QUEUE_JOB_OPTIONS` (mirrors `@workspace/messaging` presets).

### Periodic (scheduler) jobs

Every periodic job — outbox sweep, rewards maintenance, storage cleanup, idempotency
retention — is registered with `registerMaintenanceScheduler`
(`apps/api/src/infrastructure/jobs/maintenance-scheduler.ts`):

- **One scheduler cluster-wide.** `upsertJobScheduler` with a fixed id: every API instance
  calls it at boot and there is still one job per tick.
- **Bounded Redis.** The job template carries `QUEUE_JOB_OPTIONS.maintenance`, whose
  `removeOnComplete` / `removeOnFail` keep only the most recent finished runs. Without them
  every tick is kept forever — the 5 s outbox sweep alone adds ~17 000 jobs a day.
- **Legacy cleanup only.** At boot it removes leftovers of BullMQ's legacy repeatable API
  (keys of the `name:id:…` shape) and jobs with a corrupt timestamp. The scheduler's own
  iterations (`repeat:<schedulerId>:<millis>`) are never touched, and nothing is logged
  unless something was actually removed.

### Graceful shutdown

On `SIGTERM` / `SIGINT` / `SIGHUP` the API (`common/lifecycle/graceful-shutdown.ts`) marks
itself not-ready, then **drains the BullMQ workers** (`BullMqWorkerDrainService` from
`@workspace/messaging/nest`: no new jobs, running jobs finish) and only then calls
`app.close()`. The order matters: Nest's teardown ends the Prisma pool and the Kafka / Redis
clients in `onModuleDestroy`, while `@nestjs/bullmq` closes its workers only in the last phase
(`onApplicationShutdown`) — a job still running then fails with "Cannot use a pool after
calling end on the pool".

## Correlation IDs

HTTP requests set `X-Correlation-Id`. `CorrelationContextInterceptor` propagates the value into outbox rows and Kafka envelopes (clamped to 64 characters so an over-long client header can never fail the event insert — and with it the domain transaction). The `eventId` is the per-event id; the correlation id ties it back to the request.

## Reusing in another project

Copy `packages/messaging` and follow [packages/messaging/README.md](../../packages/messaging/README.md). Do **not** copy `apps/api/src/infrastructure/outbox` unless you need the same outbox pattern.
