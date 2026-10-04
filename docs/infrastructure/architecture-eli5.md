---
title: "Messaging & Events Architecture (ELI5)"
tags: ["infrastructure", "messaging", "kafka", "bullmq", "redis"]
description: "Plain-language guide to how data moves through Redis, BullMQ, Kafka, the transactional outbox, and the consumer inbox in this monorepo."
author: "Backend Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
---

# Messaging & events architecture (ELI5)

This document explains **how data moves through the system** in plain language. For copy-paste setup in a new repo, see [`packages/messaging/README.md`](../../packages/messaging/README.md).

---

## The cast of characters (ELI5)

Imagine a busy restaurant:

| System | Kid-friendly analogy | What it actually does here |
|--------|----------------------|----------------------------|
| **HTTP API** | The front door | Users and merchants talk to NestJS. Orders (claims, logins) happen here. |
| **PostgreSQL** | The ledger in the back office | Source of truth: users, rewards, claims, outbox rows. |
| **Redis** | A shared whiteboard + timer | Fast memory: BullMQ job storage, auth-cache pub/sub. |
| **BullMQ** | Kitchen ticket rail | Internal **async jobs** inside the API process (email send, expire claims, sweep outbox). |
| **Transactional outbox** | The “don’t lose this” tray | DB table (`outbox_events`). Events are written **in the same transaction** as your business data: both are saved, or neither is. |
| **Kafka** | The delivery truck to the warehouse | Durable **platform events** for analytics / downstream systems. |
| **RabbitMQ** | Empty loading dock (reserved) | In Docker for future non-Node workers — **not wired to the API yet**. |
| **Consumer inbox** | The clerk’s “already filed” list | DB table (`inbox_processed_events`). A message delivered twice is filed once. |
| **analytics-consumer** | Warehouse clerk | Separate small app: reads Kafka → checks the inbox → writes `analytics_events`. |

**Rule of thumb**

- **BullMQ** = work *this API* must do later (send email, sweep outbox).
- **Kafka** = facts *the whole company* might want later (login, claim, email sent).
- **Outbox** = bridge so Kafka messages are never lost if the API dies mid-request — and never sent for a change that was rolled back.
- **Inbox** = guard so a message that arrives twice is only counted once.

---

## Layer cake (where code lives)

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web, apps/merchant, apps/admin  (UI)                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP
┌───────────────────────────▼─────────────────────────────────┐
│  apps/api  (NestJS)                                         │
│  ├─ modules/*          domain: rewards, auth, notifications │
│  ├─ messaging/         ONE config file for this app           │
│  └─ infrastructure/outbox/  outbox producer + dispatcher    │
└───────┬───────────────────────┬─────────────────────────────┘
        │                       │
        │ uses                  │ uses
┌───────▼──────────┐    ┌───────▼──────────────────────────┐
│ @workspace/      │    │ @workspace/shared                 │
│ messaging        │    │ Zod schemas, queue names, events  │
│ (generic)        │    │ (this app’s contracts)            │
└───────┬──────────┘    └──────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────┐
│  Docker: Redis, Kafka, RabbitMQ (placeholder), Bull Board    │
└──────────────────────────────────────────────────────────────┘
```

**Generic vs app-specific**

| Generic (`@workspace/messaging`) | App-specific (`apps/api`) |
|----------------------------------|---------------------------|
| Redis clients, BullMQ root, Kafka producer (connection settings passed in — the package never reads env) | `buildAppMessagingConfig(config.messaging)` (queue names, client id, validated `REDIS_URL` / `KAFKA_BROKERS` / `RABBITMQ_URL`) |
| Outbox **schemas** (topic = string, `eventId`) | `PlatformOutboxService.enqueueInTransaction` call sites (which events, in which transaction) |
| RabbitMQ placeholder + health | Prisma `outbox_events` model, processors |
| Correlation-friendly Kafka publish | Reward/email/auth event payloads in `@workspace/shared` |

To reuse in another project: copy `packages/messaging`, add one config file, register `MessagingInfrastructureModule`, add your own processors.

---

## Request lifecycle (with correlation ID)

1. Browser calls `POST /api/v1/claims`.
2. `RequestContextMiddleware` opens the one request context ([ADR 017](../adr/017-unified-request-context.md)): a valid incoming `X-Correlation-Id` (≤ 64 safe characters) or a generated one, echoed in the `X-Correlation-Id` header.
3. Guards add the authenticated principal and the verified tenant to the same context.
4. `ClaimService` writes claim + decrements inventory in Postgres.
5. In the **same database transaction**, the service calls `outbox.enqueueInTransaction(tx, event)` → the outbox row gets the correlation id and its own stable `eventId`.
6. Later, the outbox dispatcher publishes to Kafka with both ids in the message.

**Why it matters:** You can trace one user action from HTTP logs → outbox row → Kafka message → analytics row (`analytics_events.id` = `eventId`).

---

## Must-not-lose events (outbox pattern)

```mermaid
sequenceDiagram
  participant API as NestJS handler
  participant DB as PostgreSQL
  participant Bull as BullMQ outbox.publish
  participant Worker as OutboxPublishProcessor
  participant Kafka as Kafka
  participant WH as analytics-consumer

  API->>DB: BEGIN; business write; outbox_events INSERT; COMMIT
  Note over API,DB: One transaction — both rows or neither
  Bull->>Worker: Every 5s sweep job
  Worker->>DB: Claim due PENDING rows (lease, SKIP LOCKED)
  Worker->>Kafka: publish(topic, envelope + eventId)
  Worker->>DB: status=PUBLISHED (or retry with backoff / FAILED)
  Kafka->>WH: consume platform.*
  WH->>DB: BEGIN; inbox claim (ON CONFLICT DO NOTHING); analytics_events INSERT if new; COMMIT
```

**ELI5:** Write the “letter” in the ledger *on the same page* as the business entry, so you can never have one without the other. A worker mails unsent letters every few seconds, and the warehouse clerk ticks each letter’s number off a list — if the same letter arrives twice, the second copy goes in the bin.

### What can go wrong (and why it is fine)

| Oops | What happens |
|------|--------------|
| The API crashes after the business write | Impossible to lose the event: it was saved in the same transaction. |
| The business write fails / rolls back | The event rolls back with it — no event for a change that never happened. |
| The worker crashes after publishing, before marking the row | The lease runs out, the row is published again **with the same `eventId`**, and the inbox skips the duplicate. |
| Kafka is down | Rows wait (`PENDING`) and are retried with growing delays; after 8 tries they become `FAILED` for a human to look at. API requests keep working. |
| A garbage message reaches the consumer | It is parked in `inbox_dead_letters` with the reason; the consumer keeps going instead of crashing on it forever. |

---

## BullMQ queues (this app)

Configured in `apps/api/src/messaging/app-messaging.config.ts` → `QUEUE_NAMES` in `@workspace/shared`.

| Queue | Owner module | Job |
|-------|--------------|-----|
| `email.send` | `NotificationsQueueModule` | Send one email |
| `rewards.auto-publish` | `RewardsQueueModule` | Publish reviewed rewards |
| `claims.expire-pending` | `RewardsQueueModule` | Expire consumer claims |
| `claims.expire-referrer` | `RewardsQueueModule` | Expire referrer credits |
| `outbox.publish` | `OutboxQueueModule` | Sweep outbox → Kafka |
| `storage.cleanup` / `storage.delete` | `FilesModule` (processors) | Clean stale uploads / delete objects |
| `idempotency.retention` | `IdempotencyRetentionQueueModule` | Hourly purge of expired `Idempotency-Key` records |

**Pattern:** Infrastructure registers queue **names**; feature modules register **processors** (`@Processor(QUEUE_NAMES[n])`).

---

## Kafka topics (this app)

Defined in `packages/shared` → `KAFKA_TOPICS`; `PLATFORM_EVENT_TOPICS` maps each event type to its topic. Stored envelope: `PlatformEventEnvelopeSchema`; wire message: `PlatformEventMessageSchema` (envelope + `eventId`).

| Topic | Examples |
|-------|----------|
| `platform.auth` | signup, login |
| `platform.sessions` | refresh, logout |
| `platform.impersonation` | start/stop impersonation |
| `platform.email` | email log updates |
| `platform.rewards` | claim expired, reward published |

---

## Redis (two jobs)

1. **BullMQ backend** — job payloads, delayed/repeat metadata.
2. **Authorization cache pub/sub** — `REDIS_PUBLISHER` / `REDIS_SUBSCRIBER` invalidate RBAC across API instances.

Same `REDIS_URL`, different usage. Generic wiring is in `@workspace/messaging/nest`.

---

## RabbitMQ (placeholder)

- Runs in `compose.yml` (management UI on port 15672).
- `RABBITMQ_URL` is read for health reporting only.
- See [ADR: RabbitMQ placeholder](../adr/rabbitmq-placeholder.md).

Use when you add Python/Go workers that should not share the Node process.

---

## Environment variables

| Variable | Required | Effect |
|----------|----------|--------|
| `REDIS_URL` | Prod: yes; dev: optional | Enables BullMQ + Redis auth cache |
| `KAFKA_BROKERS` | Optional | Enables Kafka producer + outbox publish |
| `RABBITMQ_URL` | Optional | Health placeholder only |
| `MESSAGING_CLIENT_ID` | Optional | Kafka client id (default `hello-world-api`) |
| `MESSAGING_CONNECTION_NAME` | Optional | Redis connection name in logs |

---

## Local dev quick start

```bash
pnpm docker:up
pnpm db:migrate
pnpm dev:api
pnpm --filter @workspace/analytics-consumer start   # optional
```

- Bull Board: http://localhost:3030  
- RabbitMQ UI: http://localhost:15672 (guest/guest or see compose)

---

## Adding something new (checklist)

### New BullMQ job

1. Add queue name to `QUEUE_NAMES` in `@workspace/shared`.
2. `buildAppMessagingConfig` (`apps/api/src/messaging/app-messaging.config.ts`) already registers every `QUEUE_NAMES` entry — nothing to add there.
3. Create `@Processor` in the **owning feature module**.
4. Register processor in a static `@Module({ providers: [...] })` child module (ESLint).
5. Update `compose.yml` Bull Board `QUEUE_NAMES` env.

### New Kafka event

1. Add topic to `KAFKA_TOPICS` if needed.
2. Add an envelope member in `packages/shared/src/schemas/infrastructure/kafka.ts` (it feeds `PlatformEventEnvelopeSchema`, `PlatformEventInputSchema`, and `PlatformEventMessageSchema`) and map its type in `PLATFORM_EVENT_TOPICS`.
3. In the domain service, call `outbox.enqueueInTransaction(tx, { type, payload })` **inside the transaction that makes the change** (or `outbox.recordTelemetry(...)` if the event describes no DB write). Add its partition key to `resolvePartitionKey`.
4. Teach `analytics-consumer` if you need warehouse storage — any new consumer claims `(consumer, eventId)` in the inbox in the same transaction as its side effect.

### New project from this kit

1. Copy `packages/messaging` unchanged.
2. Create `app-messaging.config.ts` with your `clientId` + `queueNames`.
3. `registerMessagingInfrastructureModule(config)` in `AppModule`.
4. Keep processors in **your** feature modules.

---

## Related docs

- [Messaging operations](../technical/messaging.md)
- [ADR 015 — Transactional outbox + consumer inbox](../adr/015-transactional-outbox-and-inbox.md)
- [`@workspace/messaging` package README](../../packages/messaging/README.md)
- [RabbitMQ ADR](../adr/rabbitmq-placeholder.md)
- [Authorization cache ADR](../adr/004-authorization-caching.md)
