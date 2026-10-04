---
title: "ADR 015: Transactional Outbox and Consumer Inbox"
tags: ["adr", "messaging", "kafka", "outbox", "inbox", "idempotency", "rls"]
description: "Architecture decision record for writing platform events in the same database transaction as the domain change, publishing them at-least-once with a stable event id, and deduplicating them in a consumer inbox."
author: "Backend Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 15
---

# ADR 015: Transactional Outbox and Consumer Inbox

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Backend Team

## Context

Platform events (`auth.flow`, `session.action`, `impersonation.action`, `email.log.updated`, `reward.platform`) are published to Kafka for analytics and downstream systems. The previous implementation had an `outbox_events` table and a BullMQ sweep, but it was not transactional:

- Domain services emitted in-process `EventEmitter` events after their writes. `PlatformEventOutboxBridgeService` subscribed and called `void enqueueEnvelope(...)` — fire-and-forget, **outside** the domain transaction. A commit could succeed while the event was lost (process exit, a failed insert nobody awaited), and an event could be written for a change that later rolled back.
- Kafka messages had no stable id. `apps/analytics-consumer` inserted every message with a fresh `randomUUID()`, so a redelivered or republished message was counted twice, and a malformed message crashed the consumer on every redelivery.
- The sweep published rows in one failing batch: one bad row failed the job and blocked every row behind it.

## Decision

### 1. Producer: the event is written in the domain transaction

`PlatformOutboxService.enqueueInTransaction(tx, { type, payload })` is the only way to record an event for a database change. It runs inside the transaction that performs the change, so the change and its event commit or roll back together. Repositories that own their transaction expose a `withinTransaction: (tx) => Promise<void>` hook (reward auto-publish / claim expiry, refresh-token rotation / revocation, email-log insert, session revocation); services that open their own transaction pass `tx` directly (impersonation audit).

Events that describe **no** database write — a rejected refresh, auth-flow outcome telemetry recorded by `@TrackAuthFlow` — use `recordTelemetry(event)`: an awaited, standalone transaction under the allowlisted `outbox.enqueue` system operation. It never throws; failure is logged (`outbox.telemetry_record_failed`) and returned as a typed result so telemetry cannot replace the caller's real outcome. There is no fire-and-forget path.

The producer assigns the row id (`randomUUID()`), which **is the event's stable `eventId`**. The row is inserted with `createMany` (no `RETURNING`).

### 2. RLS: append-only producer policy

The domain transaction usually runs under a user/tenant-scoped, non-bypass session, while `outbox_events` was bypass-only. A new permissive policy `outbox_events_append` allows any app session to `INSERT` a row only when `status = 'PENDING' AND attempts = 0 AND published_at IS NULL AND last_error IS NULL`. Reads and updates stay bypass-only, which is why the insert must not use `RETURNING` (it would require SELECT visibility).

### 3. Dispatcher: at-least-once, per-row retry, dead letter

`OutboxDispatcher` (driven by the existing `outbox.publish` BullMQ scheduler, under the `outbox.publish` system operation):

- claims up to 50 due rows by moving `available_at` past a 2-minute lease (`FOR UPDATE SKIP LOCKED`), so instances do not double-claim and a crashed worker's rows are reclaimed after the lease;
- re-validates each row (envelope schema, topic ↔ type) and publishes `PlatformEventMessage` = envelope + `eventId` (also in the `event-id` Kafka header), then marks it `PUBLISHED`;
- on a publish error: `attempts + 1`, exponential backoff with jitter, attempts and base delay taken from the `outboxPublish` preset (`QUEUE_JOB_OPTIONS`), capped at 5 minutes; the rest of the batch is released unattempted;
- dead-letters (`status = 'FAILED'`) a malformed row immediately, and any row that reaches the preset's maximum attempts;
- logs `outbox.published`, `outbox.publish_failed`, `outbox.dead_lettered`, `outbox.dispatch_summary`, and `outbox.backlog_stale` (oldest pending older than 5 minutes).

### 4. Consumer: inbox dedupe and poison parking

`apps/analytics-consumer` validates every message with `PlatformEventMessageSchema` at the boundary. In one transaction it claims `(consumer, event_id)` in `inbox_processed_events` with `INSERT … ON CONFLICT DO NOTHING` and inserts the `analytics_events` row (id = `eventId`) only when the claim is new. The composite primary key — not an `if (exists)` check — is the guarantee.

Messages that can never be applied (empty value, invalid UTF-8 / JSON, schema violation, wrong topic, SQLSTATE class 22/23) are parked in `inbox_dead_letters` with a reason and the raw bytes (plus original size, SHA-256 and a truncation flag), unique per Kafka coordinates, and their offset is committed. Any other failure rolls back (including the claim) and is retried in place with bounded exponential backoff; when the attempts run out the record is parked as `RETRIES_EXHAUSTED` — never retried forever. Only a failed dead-letter write leaves the offset uncommitted (redelivery). The consumer connects as its own least-privilege login (role `analytics_consumer`, `prisma/rls/90-analytics-consumer.sql`) — not as the superuser and without any RLS bypass.

## Alternatives considered

- **Keep the in-process EventEmitter and make the bridge await the write.** Still a separate transaction, so still not atomic with the domain change.
- **Publish to Kafka directly after commit.** Loses the event if the process dies between commit and publish, and couples request latency to the broker.
- **Temporarily set `app.rls_bypass = true` inside the domain transaction for the outbox insert.** Widens the bypass to the rest of the transaction and bypasses ADR 012's allowlist; the append-only policy grants exactly one capability.
- **Dedupe on Kafka coordinates `(topic, partition, offset)`.** Catches consumer redelivery but not producer republish (a new offset for the same event).
- **Kafka exactly-once transactions.** Do not cover the Postgres side effect; an idempotent consumer over at-least-once delivery is simpler and matches `rules/09-messaging-and-jobs.md`.

## Consequences

### Positive

- A committed change always has its event; a rolled-back change never does.
- A redelivered or republished event is applied exactly once per consumer.
- A poison row or message no longer blocks everything behind it.

### Negative

- Every producer must carry a transaction to its outbox write; repositories grew `withinTransaction` hooks.
- `auth.flow` events are outcome telemetry recorded after the flow, in their own transaction — a crash between a successful flow's commit and the telemetry write loses that one telemetry event. Follow-up: move auth flows onto a unit of work if `auth.flow` ever becomes a state-bearing event.
- `auth.flow` events (written by `@TrackAuthFlow`) carry the user the flow acted on — the decorated method names it with `identifyAuthFlowSubject(userId)` as soon as it resolves the user, so failures for a known user (wrong password, lockout, reused password) carry it too — and `error` is the stable error code the API returns (`INVALID_CREDENTIALS`, `UNAUTHORIZED`, `INTERNAL_ERROR`, …), never a message. A decorated class without `authEvents` throws `AuthFlowTrackingError` instead of silently recording nothing.
- `inbox_processed_events` grows with traffic, so the consumer purges claims older than `ANALYTICS_INBOX_RETENTION_DAYS` (default: twice `KAFKA_TOPIC_RETENTION_DAYS`, and boot fails unless it is strictly longer than that configured topic retention — the horizon inside which a record can still be redelivered) hourly, under a transaction-level Postgres advisory lock per batch. A redelivery after that window would be re-applied; `analytics_events`' `ON CONFLICT (id) DO NOTHING` still keeps it from duplicating the analytics row. `inbox_dead_letters` rows are purged after `ANALYTICS_DEAD_LETTER_RETENTION_DAYS` (default 30). Details: [Messaging — Retention](../technical/messaging.md#retention). Kafka client: [ADR 024](./024-confluent-kafka-client.md).
- Per-key ordering is best-effort: a row in retry backoff can be overtaken by a later row with the same key.

### Rollout

The wire message now requires `eventId`, and both sides use strict schemas. Deploy the API and `analytics-consumer` together: stop the consumer, run `pnpm db:deploy` (migration + RLS), start the new API, then the new consumer. Messages produced before the switch carry no `eventId`; the new consumer parks them as `SCHEMA_VIOLATION` (raw value kept for replay) instead of crashing on them. Existing `PENDING` outbox rows need nothing — the row id becomes their `eventId` at publish time.

## References

- `apps/api/src/infrastructure/outbox/` (`platform-outbox.service.ts`, `outbox-dispatcher.ts`, `outbox-dispatch.repository.ts`)
- `apps/analytics-consumer/src/` (`message-handler.ts`, `pg-inbox-store.ts`, `inbox-retention.ts`)
- `packages/shared/src/schemas/infrastructure/kafka.ts` (`PlatformEventMessageSchema`, `PLATFORM_EVENT_TOPICS`)
- `apps/api/prisma/rls.sql` (`outbox_events_append`, inbox policies)
- `apps/api/test/transactional-outbox.e2e-spec.ts`, `apps/analytics-consumer/src/pg-inbox-store.e2e-spec.ts`
- [Messaging operations](../technical/messaging.md), ADR 010, ADR 012
