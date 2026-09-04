---
title: "Messaging & Events Architecture (ELI5)"
tags: ["infrastructure", "messaging", "kafka", "bullmq", "redis"]
description: "Plain-language guide to how data moves through Redis, BullMQ, Kafka, and the transactional outbox in this monorepo."
author: "Backend Team"
lastUpdated: 1788643200000
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
| **Transactional outbox** | The “don’t lose this” tray | DB table (`outbox_events`). Events are **written with your business data** so they survive crashes. |
| **Kafka** | The delivery truck to the warehouse | Durable **platform events** for analytics / downstream systems. |
| **RabbitMQ** | Empty loading dock (reserved) | In Docker for future non-Node workers — **not wired to the API yet**. |
| **analytics-consumer** | Warehouse clerk | Separate small app: reads Kafka → writes `analytics_events`. |

**Rule of thumb**

- **BullMQ** = work *this API* must do later (send email, sweep outbox).
- **Kafka** = facts *the whole company* might want later (login, claim, email sent).
- **Outbox** = bridge so Kafka messages are never lost if the API dies mid-request.

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
│  └─ infrastructure/outbox/  app-specific event bridge       │
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
| Redis clients, BullMQ root, Kafka producer | `APP_MESSAGING_CONFIG` (queue names, client id) |
| Outbox **schemas** (topic = string) | `PlatformEventOutboxBridgeService` (which events to capture) |
| RabbitMQ placeholder + health | Prisma `outbox_events` model, processors |
| Correlation-friendly Kafka publish | Reward/email/auth event payloads in `@workspace/shared` |

To reuse in another project: copy `packages/messaging`, add one config file, register `MessagingInfrastructureModule`, add your own processors.

---

## Request lifecycle (with correlation ID)

1. Browser calls `POST /api/v1/claims`.
2. `CorrelationIdMiddleware` sets `X-Correlation-Id` (or generates one).
3. `CorrelationContextInterceptor` stores it in AsyncLocalStorage.
4. `ClaimService` writes claim + decrements inventory in Postgres.
5. Domain code may emit in-process events → outbox row includes the same correlation id.
6. Later, outbox worker publishes to Kafka with that id in the envelope.

**Why it matters:** You can trace one user action from HTTP logs → outbox row → Kafka message → analytics row.

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

  API->>DB: Business write + outbox_events INSERT
  Note over API,DB: Same request; row status=PENDING
  Bull->>Worker: Every 5s sweep job
  Worker->>DB: SELECT pending rows
  Worker->>Kafka: publish(topic, envelope)
  Worker->>DB: status=PUBLISHED
  Kafka->>WH: consume platform.*
  WH->>DB: INSERT analytics_events
```

**ELI5:** Write the “letter” in the ledger before mailing it. A worker picks up unsent letters every few seconds.

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

**Pattern:** Infrastructure registers queue **names**; feature modules register **processors** (`@Processor(QUEUE_NAMES[n])`).

---

## Kafka topics (this app)

Defined in `packages/shared` → `KAFKA_TOPICS`. Envelope shape: `PlatformEventEnvelopeSchema`.

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
2. Add name to `APP_MESSAGING_CONFIG.queueNames` (same tuple).
3. Create `@Processor` in the **owning feature module**.
4. Register processor in a static `@Module({ providers: [...] })` child module (ESLint).
5. Update `compose.yml` Bull Board `QUEUE_NAMES` env.

### New Kafka event

1. Add topic to `KAFKA_TOPICS` if needed.
2. Extend `PlatformEventEnvelopeSchema` in `@workspace/shared`.
3. Emit from domain service → bridge writes outbox.
4. Teach `analytics-consumer` if you need warehouse storage.

### New project from this kit

1. Copy `packages/messaging` unchanged.
2. Create `app-messaging.config.ts` with your `clientId` + `queueNames`.
3. `registerMessagingInfrastructureModule(config)` in `AppModule`.
4. Keep processors in **your** feature modules.

---

## Related docs

- [Messaging operations](./messaging.md)
- [`@workspace/messaging` package README](../../packages/messaging/README.md)
- [RabbitMQ ADR](../adr/rabbitmq-placeholder.md)
- [Authorization cache ADR](../adr/004-authorization-caching.md)
