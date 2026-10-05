---
title: "Messaging Infrastructure"
tags: ["infrastructure", "messaging", "kafka", "bullmq", "redis", "outbox", "inbox", "idempotency"]
description: "Operational reference for Redis, BullMQ, Kafka, queues, the transactional outbox, and the consumer inbox."
author: "Backend Team"
lastUpdated: 1790841600000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
---

# Messaging infrastructure

Operational reference. For the big picture, read [Architecture](./architecture.md); every endpoint that emits events is in the [API reference](./api-reference/README.md).

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
| **BullMQ** | Internal jobs (`email.send`, rewards maintenance, outbox sweep, outbox retention, storage cleanup, idempotency retention) |
| **Kafka** | Durable platform events (analytics / warehouse) |
| **RabbitMQ** | Docker placeholder — see [ADR](../adr/rabbitmq-placeholder.md) |

## Local development

```bash
pnpm docker:up          # Redis, Kafka, RabbitMQ, Bull Board
pnpm db:migrate         # outbox_events, inbox_* tables, analytics_events + RLS (creates the analytics_consumer role)
cp apps/analytics-consumer/.env.example apps/analytics-consumer/.env   # then set a real password
pnpm --filter @workspace/analytics-consumer db:provision-login        # the consumer's own least-privilege DB login
pnpm --filter @workspace/analytics-consumer kafka:provision-topics    # create platform.* topics explicitly
pnpm dev:api
pnpm dev:analytics-consumer   # optional
```

Required env (API):

- `REDIS_URL=redis://localhost:6379` — required outside `NODE_ENV=development`
- `KAFKA_BROKERS=127.0.0.1:9092` — enables Kafka producer + outbox publish worker (locally use the IPv4 literal the compose broker publishes and advertises; `localhost` may resolve to `::1` first)

Optional (API): `MESSAGING_CLIENT_ID` / `MESSAGING_CONNECTION_NAME`, `RABBITMQ_URL` (placeholder health only), Kafka TLS / SASL (`KAFKA_SSL`, `KAFKA_SSL_CA_LOCATION`, `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`) and `KAFKA_DELIVERY_TIMEOUT_MS` — see [API configuration](./configuration/api.md).

## Kafka client

Both the API producer and the analytics consumer use **`@confluentinc/kafka-javascript`** (Confluent's maintained librdkafka binding, through its KafkaJS-compatible `KafkaJS` namespace) — decision record: [ADR 024](../adr/024-confluent-kafka-client.md). Shared pieces live in `@workspace/messaging/kafka`: the TLS / SASL env contract (`KafkaSecurityEnvShape`, cross-field rules in `listKafkaSecurityEnvIssues`), `buildKafkaClientConfig`, a structured logger adapter, `AggregatingKafkaLogSink`, and `provisionKafkaTopics`.

- **Client diagnostics.** librdkafka's own log lines go through the app logger as `kafka.client_log` at WARN and above. `buildKafkaClientConfig` sets the compat `logLevel` from the same value as the logger adapter — without it every client resets the logger to INFO on connect. `AggregatingKafkaLogSink` collapses a retry storm: the first occurrence of a diagnostic is logged at once, further identical ones (ignoring librdkafka's per-retry `after Nms` detail) are counted and logged as ONE line with `repeatCount` / `repeatWindowMs` at the end of the window (60 s); pending counts are flushed when the client shuts down. Nothing is dropped.
- **Boot never waits for Kafka; "connected" is honest.** `KafkaProducerService.onModuleInit` starts a background connect loop and returns, so a configured-but-unreachable broker does not stop the API from starting. Each attempt needs a real metadata round trip (admin `listTopics`, bounded by 5 s) and then the producer connect; a failure logs `kafka.connect_failed` (`attempt`, `retryInMs`, `error`) and retries after capped exponential backoff with jitter (`DEFAULT_KAFKA_CONNECT_BACKOFF`: 1 s, 2 s, 4 s … max 30 s, ±20 %; override with the validated `kafkaConnectBackoff` messaging option). Until the first success the state is `connecting`; then `kafka.producer_connected` is logged and the state is `connected` — no restart needed. Shutdown aborts the backoff wait at once and waits at most for the attempt in flight.

- **No auto-created topics.** Producer and consumer set `allowAutoTopicCreation: false`. Topics are created by `pnpm --filter @workspace/analytics-consumer kafka:provision-topics` from `KAFKA_TOPIC_PARTITIONS`, `KAFKA_TOPIC_REPLICATION_FACTOR` (both required, no defaults) and `KAFKA_TOPIC_RETENTION_DAYS` (sets `retention.ms`, default 7). It is idempotent, never alters an existing topic, and fails with `KafkaTopicDriftError` if a topic has fewer partitions / replicas than configured (e.g. one a broker auto-created with 1 / 1) — fix it with `kafka-topics.sh --alter` / a reassignment, deliberately. The consumer refuses to start if a platform topic is missing.
- **Producer** (`KafkaProducerService`): idempotent, `acks = all`, Java-compatible `murmur2_random` partitioner, `message.timeout.ms = KAFKA_DELIVERY_TIMEOUT_MS`. `publish()` resolves only on broker acknowledgement and otherwise rejects with `KafkaProducerDisabledError` (no brokers), `KafkaProducerNotConnectedError` (before init / after shutdown) or `KafkaPublishError` (not acknowledged — timeout, missing topic, authorization). `GET /health/ready` reports the `kafka` check `down` while the producer is connecting (or a metadata request fails) and `up` after the first successful round trip; the check carries `details.state` and `details.lastFailure` (e.g. `producer connecting: Local: Broker transport failure`). Kafka stays a NON-critical readiness check: it never turns `/health/ready` into 503 on its own, because every instance would fail it at once and a broker outage would become a full API outage — the outbox absorbs it.
- **Outbox during a Kafka outage.** A publish while not connected fails with `KafkaProducerNotConnectedError`; the outbox adapter maps it to `OutboxPublisherUnavailableError` ("nothing was sent"), and the dispatcher releases the batch for `baseDelayMs` WITHOUT spending an attempt (`outbox.publisher_unavailable` warning). Rows stay `PENDING` however long the outage lasts and publish once Kafka connects; only real publish failures (timeouts, authorization, missing topic) count towards `maxAttempts` / `FAILED`.

## Analytics consumer

`apps/analytics-consumer` reads only its own environment (`apps/analytics-consumer/.env` locally via `dotenv -e .env`, the deployment env in production) — never `apps/api/.env`, never the API's secrets. Every variable is listed in `apps/analytics-consumer/.env.example`; the important ones:

| Variable | Default | Meaning |
|----------|---------|---------|
| `ANALYTICS_CONSUMER_DATABASE_URL` | — (required) | Login of the least-privilege `analytics_consumer` role. Never the superuser. |
| `ANALYTICS_CONSUMER_DB_ADMIN_URL` | — | Only for `db:provision-login` and the e2e suites (a role allowed to `CREATE ROLE`). |
| `ANALYTICS_DB_POOL_MAX` / `ANALYTICS_DB_CONNECTION_TIMEOUT_MS` / `ANALYTICS_DB_IDLE_TIMEOUT_MS` / `ANALYTICS_DB_STATEMENT_TIMEOUT_MS` | 5 / 10 000 / 30 000 / 30 000 | Bounded pool and waits (server-side `statement_timeout`). |
| `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_SSL*`, `KAFKA_SASL_*`, `KAFKA_ADMIN_TIMEOUT_MS` | `analytics-consumer`, 30 000 | Same security contract as the API. |
| `ANALYTICS_CONSUMER_START_FROM` | `earliest` | Where a group with **no committed offset** starts: `earliest` consumes the whole retained backlog, `latest` only new records. A group with a committed offset always resumes from it. |
| `ANALYTICS_MAX_PROCESSING_ATTEMPTS`, `ANALYTICS_RETRY_BASE_DELAY_MS`, `ANALYTICS_RETRY_MAX_DELAY_MS` | 5, 500, 10 000 | Bounded retry of transient failures (see [Failure handling](#failure-handling)). |
| `KAFKA_TOPIC_RETENTION_DAYS` | 7 | Retention of the platform topics — the redelivery horizon. |
| `ANALYTICS_INBOX_RETENTION_DAYS` | topic retention × 2 | Must be **greater** than `KAFKA_TOPIC_RETENTION_DAYS` (boot fails otherwise). |
| `ANALYTICS_DEAD_LETTER_RETENTION_DAYS` | 30 | Parked messages older than this are purged. |
| `ANALYTICS_DEAD_LETTER_MAX_PAYLOAD_BYTES` | 1 048 576 | Cap on the stored copy of a parked value (see below). |
| `SHUTDOWN_TIMEOUT_MS` | 15 000 | Graceful-shutdown budget. |

Scripts: `dev` / `start` (worker), `db:provision-login` (creates or updates the LOGIN role named in `ANALYTICS_CONSUMER_DATABASE_URL`, with that URL's password, as a member of `analytics_consumer`; refuses a superuser or the admin's own role), `kafka:provision-topics`, `test` (unit), `test:e2e` (Postgres + Kafka; part of the root `pnpm test:e2e` and of the CI job `analytics-consumer-e2e`).

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

### Topics

`KafkaTopicSchema` and `PLATFORM_EVENT_TOPICS` (`packages/shared/src/schemas/infrastructure/kafka.ts`)
map every event type to one topic:

| Topic | Event types |
| --- | --- |
| `platform.auth` | `auth.flow` (signup, login and other auth-flow outcomes) |
| `platform.sessions` | `session.action` (refresh, logout, revocation) |
| `platform.impersonation` | `impersonation.action` |
| `platform.email` | `email.log.updated` |
| `platform.rewards` | `reward.platform` (reward published, claim expired, …) |

**Adding an event:** add an envelope member to the `PlatformEventEnvelopeSchema` union in that file
(it also feeds the input and wire-message schemas), map its type in `PLATFORM_EVENT_TOPICS` (a full
`Record`, so an unmapped type does not compile), give it a partition key in `resolvePartitionKey`
(`platform-outbox.service.ts`), and enqueue it as below. A new topic is added to `KafkaTopicSchema`
and provisioned with `kafka:provision-topics` — topics are never auto-created.

### Which API to call

| Situation | Call |
|-----------|------|
| The event describes a DB change (reward published, claim expired, session revoked, impersonation audited, email logged) | `outbox.enqueueInTransaction(tx, event)` inside that change's transaction. Repositories that own the transaction take a `withinTransaction: (tx) => Promise<void>` hook (e.g. `RewardRepository.autoPublishInTransaction`, `RefreshTokenRepository.revokeById`, `UserSessionRevocationService.revokeAllSessionsForUsers`). |
| The event describes **no** DB write (a rejected refresh, auth-flow outcome telemetry via `@TrackAuthFlow`) | `outbox.recordTelemetry(event)` — its own awaited transaction under `outbox.enqueue`; never throws, returns `{ recorded: false, error }` and logs `outbox.telemetry_record_failed` so telemetry can never replace the caller's real outcome. |

There is **no fire-and-forget path**: never `void` an outbox call, and never publish to Kafka directly from a request.

### RLS

`outbox_events` reads/updates are bypass-only. A separate `outbox_events_append` policy lets **any** app session `INSERT` a fresh row (`status = 'PENDING'`, `attempts = 0`, no `published_at` / `last_error`) — that is what lets the event share a user/tenant-scoped transaction. The producer assigns the id and inserts with `createMany` (no `RETURNING`, so no SELECT visibility is needed). `inbox_processed_events`, `inbox_dead_letters` and `analytics_events` keep a bypass policy for `app_runtime` only (operator tooling). The consumer connects as its own login, a member of the NOLOGIN role `analytics_consumer` (`apps/api/prisma/rls/90-analytics-consumer.sql`): SELECT / INSERT / DELETE on `inbox_processed_events` and `inbox_dead_letters` (rows of consumer `analytics-warehouse` only), INSERT plus `SELECT (id)` on `analytics_events` (the `ON CONFLICT (id)` arbiter), nothing else — no other table, no UPDATE, no `SET ROLE`. Setting `app.rls_bypass` from that session grants nothing. It never runs as the superuser and never sets the bypass flag.

### Failure handling

| Where | Failure | Behaviour |
|-------|---------|-----------|
| Dispatcher | Publish error | `attempts + 1`, retry after exponential backoff with ±20% jitter (base 1.5s × 2ⁿ, capped at 5 min — attempts/base from the `outboxPublish` preset). The rest of the batch is released, not attempted, so a down broker is not hit once per row. |
| Dispatcher | `attempts` reaches 8 (`QUEUE_JOB_OPTIONS.outboxPublish.attempts`) | Dead-lettered: `status = 'FAILED'`, `last_error` kept, `outbox.dead_lettered` error log. |
| Dispatcher | Stored row malformed (bad envelope, topic ↔ type mismatch) | Dead-lettered immediately — retrying cannot help, and it never blocks the rows behind it. |
| Consumer | Empty value, invalid UTF-8 / JSON, schema violation, wrong topic | Parked in `inbox_dead_letters` at once (reason, `attempts = 1`, raw bytes), offset committed — no crash loop. Parking the same record twice is a no-op (unique Kafka coordinates). |
| Consumer | DB rejects this record's data (SQLSTATE class 22 / 23) | Parked as `PERMANENT_PROCESSING_ERROR`, no retry. |
| Consumer | Any other failure (connection loss, timeout, deadlock, serialization, missing privilege, a bug) | Transaction rolls back (claim included) and the handler retries **in place** with exponential backoff + ±20 % jitter (`ANALYTICS_RETRY_BASE_DELAY_MS` × 2ⁿ, capped at `ANALYTICS_RETRY_MAX_DELAY_MS`), at most `ANALYTICS_MAX_PROCESSING_ATTEMPTS` attempts — then parks it as `RETRIES_EXHAUSTED` and logs `analytics.retries_exhausted` (error). Never retried forever. |
| Consumer | The dead-letter write itself fails (database unreachable) | `analytics.park_failed` (error); the offset is NOT committed and the record is redelivered — nothing is lost, the partition waits for the database. |
| Consumer | Shutdown during a retry wait | The wait is aborted, the record stays uncommitted and is redelivered after restart. |

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
| `analytics.message_parked` | warn | Record parked (`reason`, `attempts`, `payloadBytes`, `payloadTruncated`) — **alert on this** |
| `analytics.processing_retry` | warn | Transient failure, retrying (`attempt`, `maxAttempts`, `retryInMs`, `sqlState`) |
| `analytics.retries_exhausted` | error | Retry budget spent, record parked as `RETRIES_EXHAUSTED` — **alert on this** |
| `analytics.park_failed` | error | Could not write the dead letter; record will be redelivered — **alert on this** |
| `analytics.db_pool_error` | error | An idle pooled connection failed |
| `kafka.client_log` | warn / error | The Kafka client's own diagnostics (`namespace`, `facility`, `message`) |

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
SELECT received_at, topic, partition, "offset", reason, attempts, event_id, error,
       raw_value_size_bytes, raw_value_truncated, raw_value_sha256,
       convert_from(raw_value, 'UTF8') AS raw_text   -- fails for a non-UTF-8 value; use encode(raw_value, 'base64') then
FROM inbox_dead_letters
WHERE consumer = 'analytics-warehouse' ORDER BY received_at DESC LIMIT 50;
```

`raw_value` is the record's exact bytes. If `raw_value_truncated` is true it holds only the first `ANALYTICS_DEAD_LETTER_MAX_PAYLOAD_BYTES`; `raw_value_size_bytes` / `raw_value_sha256` always describe the original (re-fetch it from the topic by its coordinates while still retained). Fix the producer or the consumer, then replay the value (re-produce it to its topic); delete the row once handled — rows older than `ANALYTICS_DEAD_LETTER_RETENTION_DAYS` are purged automatically.

## Retention

Three ledgers would otherwise grow forever. Each is purged by the process that owns it, in bounded batches (`purgeInBatches` in `@workspace/shared` — one short transaction per batch, a per-run time budget, the rest left for the next run), and each run logs one summary line.

| Table | Job | Where / schedule | Deletes | Concurrency guard |
|-------|-----|------------------|---------|-------------------|
| `platform_resource_idempotency_records` | `IdempotencyRetentionService` (`apps/api/src/platform/idempotency/`) | API, BullMQ queue `idempotency.retention`, job scheduler `idempotency-retention`, hourly | Rows with `expires_at` more than **1 hour** in the past — COMPLETED rows past their 24 h replay window and abandoned IN_PROGRESS rows past their 60 s lease. 500 rows/batch, 60 s budget. | One BullMQ scheduler cluster-wide (`upsertJobScheduler` with a fixed id), so each tick is ONE job on ONE worker; the 60 s budget is far below the 1 h interval. Runs under the registered `idempotency.retention` system operation. |
| `outbox_events` | `OutboxRetentionService` (`apps/api/src/infrastructure/outbox/`) | API, BullMQ queue `outbox.retention`, job scheduler `outbox-retention`, hourly | `PUBLISHED` rows whose `published_at` is older than **7 days**, and dead-lettered `FAILED` rows whose `updated_at` is older than **30 days** (logged at `warn`: an event nobody replayed). `PENDING` rows are never deleted. 500 rows/batch, 60 s budget per status. | One BullMQ scheduler cluster-wide (fixed id); every batch is a conditional DELETE re-checking status + settle time, so an operator resetting a row to `PENDING` mid-run keeps it. Runs under the registered `outbox.retention` system operation. |
| `inbox_processed_events` | `runLedgerRetention("inbox_claims")` (`packages/messaging/src/inbox/inbox-retention.ts`) | analytics-consumer, in-process timer: first run 1 min after start, then hourly | The `analytics-warehouse` claims with `processed_at` older than `ANALYTICS_INBOX_RETENTION_DAYS` (default `KAFKA_TOPIC_RETENTION_DAYS` × 2 = **14**; must exceed the topic retention). 1 000 rows/batch, 60 s budget. | Transaction-level advisory lock `pg_try_advisory_xact_lock(hashtextextended('analytics.inbox_retention', 0))` taken inside EACH batch transaction (released by its COMMIT — correct behind PgBouncer transaction pooling). A second instance skips the run; if it takes the lock between two batches the first one stops (`outcome = yielded`). Runs as the `analytics_consumer` role. |
| `inbox_dead_letters` | `runLedgerRetention("dead_letters")` (same file) | same timer, after the inbox ledger | Parked records with `received_at` older than `ANALYTICS_DEAD_LETTER_RETENTION_DAYS` (default **30**). Same batching. | Same pattern, lock `analytics.dead_letter_retention`. |

**Why the idempotency grace is 1 hour.** An expired record is already equivalent to a missing one — the service takes it over in place — so the grace does not change what a client sees. It keeps the purge clear of a request that is taking over a just-expired row, and absorbs clock skew between API instances (each stamps `expires_at` from its own clock). The DELETE also re-checks `expires_at < cutoff` on the rows it locks, so a row taken over in the meantime (new lease in the future) survives. If the purge removes a row between a request's failed insert and its read, `begin()` simply acquires the key again.

**Why the inbox window must exceed Kafka's redelivery horizon.** The inbox only dedupes ids it still holds. Kafka can hand a record back for as long as it is in the topic log: a rebalance or a crash before the offset commit, a lagging group, or an operator resetting offsets (`--to-earliest`) all replay from the log, which is bounded by topic retention. That retention is configuration, not an assumption: `KAFKA_TOPIC_RETENTION_DAYS` (default 7) is what `kafka:provision-topics` sets as `retention.ms`, and the consumer refuses to boot unless `ANALYTICS_INBOX_RETENTION_DAYS` is strictly greater. The default window (twice the topic retention) also covers an operator re-queuing a `FAILED` outbox row days later (it republishes the same `eventId`). **If you change `retention.ms` on a `platform.*` topic, change `KAFKA_TOPIC_RETENTION_DAYS` to match** — the Kafka admin API used here cannot read an existing topic's config, so the variable is the single declared value. Defence in depth: `analytics_events.id` is the `eventId` and is inserted `ON CONFLICT DO NOTHING`, so even a purged claim does not produce a duplicate analytics row.

**Why dead letters have a (long) retention.** They are work items and often the only copy of a record once the topic rolled over, so the window is generous (30 days by default) and every park is alerted (`analytics.message_parked`, `analytics.retries_exhausted`). But they also hold raw payloads, so they must not be kept forever: handle them inside the window (replay, then delete), or raise `ANALYTICS_DEAD_LETTER_RETENTION_DAYS`.

**Without Redis** (allowed in development), the BullMQ idempotency job does not run — like every other BullMQ job. Expired rows are harmless (taken over in place); they are purged once Redis is configured.

**Log events**

| Event | Level | Meaning |
|-------|-------|---------|
| `idempotency.retention_summary` | log / warn | Per run: `deleted`, `batches`, `durationMs`, `stoppedBy` (`drained` / `time_budget`), `cutoffEpochMs`. `warn` when the time budget stopped it — repeated warnings mean the table grows faster than one run per hour drains it. |
| `outbox.retention_summary` | log / warn | Per run: `published` and `deadLettered` (`deleted`, `batches`, `durationMs`, `stoppedBy`, `cutoffEpochMs`). `warn` when a time budget stopped it or a dead letter was deleted. |
| `analytics.retention_summary` | info / warn | Per ledger (`ledger` = `inbox_claims` / `dead_letters`): same fields plus `retentionDays` and `outcome` (`completed` / `yielded`). |
| `analytics.retention_skipped` | info | Another consumer instance holds that ledger's lock. |
| `analytics.retention_failed` | error | The ledger's run failed (e.g. database down); retried on the next tick. The other ledger still runs and the consumer keeps consuming. |

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
| `rewards.referral-credit-notify` | Deliver pending "referrer reward credited" emails (credit committed by the POS checkout; `reward_referrals.credit_notified_at IS NULL`) |
| `outbox.publish` | Sweep outbox → Kafka |
| `storage.cleanup` / `storage.delete` | Stale upload cleanup / object deletion |
| `idempotency.retention` | Hourly purge of expired `Idempotency-Key` records (see [Retention](#retention)) |
| `outbox.retention` | Hourly purge of settled `outbox_events` rows (see [Retention](#retention)) |
| `storage.scan` | Malware scan of uploaded objects |
| `storage.cdn-invalidate` | CDN (CloudFront) cache purge after a public file is withdrawn, so the delete request never waits on the CDN (one job per file) |

Job retry defaults: `packages/shared` → `QUEUE_JOB_OPTIONS` (mirrors `@workspace/messaging` presets).

**Adding a queue**

1. Add the name to `QueueNameSchema` / `QUEUE_NAMES` (`packages/shared/src/schemas/infrastructure/queue.ts`).
   `buildAppMessagingConfig` registers every name — nothing to add there.
2. Write the `@Processor(QUEUE_NAMES.<name>)` in the **owning feature module** (infrastructure owns
   names, features own processors), registered in that feature's queue module (e.g. `rewards-queue.module.ts`).
3. Add the name to Bull Board's `QUEUE_NAMES` list in `compose.yml` so it shows in the dashboard.
4. Database work in the processor runs under a registered system operation
   ([RLS](#rls)); add the queue to the table above.

### Key prefix and isolation (`BULLMQ_PREFIX`)

Every queue AND worker key lives under one prefix, `BULLMQ_PREFIX` (API env, validated:
letters, digits, `:`, `_`, `-`, max 64; default `bull` = Bull Board's `BULL_PREFIX` in
`compose.yml`). It is set in exactly one place — `BullModule.forRoot({ prefix })` in
`@workspace/messaging`'s `BullMqInfrastructureModule`, fed from `buildAppMessagingConfig`
(`apps/api/src/messaging/app-messaging.config.ts`) — and every `registerQueue` /
`@Processor` inherits it. Never set a prefix on an individual queue or worker.

Two processes on one Redis share jobs **only** if they share the prefix. So:

- **e2e runs are isolated per run.** `apps/api/test/global-setup-e2e.ts` (Vitest
  `globalSetup`, once per run) picks `e2e:<uuid>` (or the runner's `E2E_BULLMQ_PREFIX`;
  `pnpm ci:local` passes `ci-local:<runId>`) and `provide`s it; `test/setup-env.ts` forces
  `BULLMQ_PREFIX` from it in every test file before the app config is parsed. A dev API
  running on `bull` can no longer steal an e2e run's jobs (or the reverse). The same global
  setup deletes the run's `<prefix>:*` keys when the run ends.
- Several environments on one Redis (staging + preview) must use different prefixes.
- Changing the prefix of a running deployment orphans the jobs queued under the old one —
  drain first.

### Redis namespace for keys and pub/sub (`REDIS_NAMESPACE`)

Every raw Redis key and pub/sub channel the API uses outside BullMQ — the
`authz:invalidate` channel, the Redis user-session cache (`auth:me:*`,
`auth:permissions:*`), throttler counters, login-verification state and email rate
limits — is built in ONE place, `RedisNamespace` (`apps/api/src/infrastructure/redis/redis-namespace.ts`,
obtained from `TypedConfigService.redisNamespace`), as `<REDIS_NAMESPACE>:<name>`. Never
write a raw key or channel name to Redis without it.

- `REDIS_NAMESPACE`: same rules as `BULLMQ_PREFIX`. Default `<APP_NAME slug>:<NODE_ENV>`
  (deterministic, so every instance of one deployment agrees without extra config).
  Chosen over "required" so existing environments keep booting; the default is only
  unsafe when two APIs on **different databases** share a Redis with the same APP_NAME
  and NODE_ENV (a second local API, staging next to production) — set it explicitly there.
- APIs hear each other's authorization invalidations and share cached sessions **only**
  within one namespace. Before this, an e2e / ci:local / docs-capture API on the shared
  local Redis invalidated the dev API's caches (`DEBUG [AuthorizationCacheService]
  Invalidated authorization cache for 1 user(s)` with no action in the dev app).
- e2e: `global-setup-e2e.ts` provides `<run prefix>-kv` (e.g. `e2e:<uuid>-kv`,
  `ci-local:<runId>-kv`), `setup-env.ts` forces it, and teardown purges `<namespace>:*`
  alongside the run's BullMQ keys.
- Diagnose: `redis-cli PSUBSCRIBE '*authz:invalidate'` shows every namespace's
  invalidations; each message carries `origin` (instance id) and `trigger`. With
  `LOG_LEVEL=debug` the API logs `trigger=…, origin=this instance <id> | remote instance <id>`.

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
