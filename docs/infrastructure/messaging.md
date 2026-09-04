---
title: "Messaging Infrastructure"
tags: ["infrastructure", "messaging", "kafka", "bullmq", "redis", "outbox"]
description: "Operational reference for Redis, BullMQ, Kafka, queues, and the transactional outbox in the API."
author: "Backend Team"
lastUpdated: 1788643200000
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
| `apps/api/src/infrastructure/outbox/` | Transactional outbox + Kafka bridge (app-specific) |
| `apps/api/src/modules/*/ *-queue.module.ts` | Domain BullMQ processors |
| `apps/analytics-consumer` | Kafka → `analytics_events` |

## Overview

| System | Role in this repo |
|--------|-------------------|
| **Redis** | Authorization cache pub/sub + BullMQ backend |
| **BullMQ** | Internal jobs (`email.send`, rewards maintenance, outbox sweep) |
| **Kafka** | Durable platform events (analytics / warehouse) |
| **RabbitMQ** | Docker placeholder — see [ADR](../adr/rabbitmq-placeholder.md) |

## Local development

```bash
pnpm docker:up          # Redis, Kafka, RabbitMQ, Bull Board
pnpm db:migrate         # includes outbox_events + analytics_events
pnpm dev:api
pnpm --filter @workspace/analytics-consumer start   # optional
```

Required env (API):

- `REDIS_URL=redis://localhost:6379` — required outside `NODE_ENV=development`
- `KAFKA_BROKERS=localhost:9092` — enables Kafka producer + outbox publish worker

Optional:

- `MESSAGING_CLIENT_ID` / `MESSAGING_CONNECTION_NAME` — broker client labels
- `RABBITMQ_URL` — placeholder health only

## Event flow (must-not-lose)

1. Domain code emits in-process events (`AuthEventsService`, `RewardsPlatformEventsService`, …).
2. `PlatformEventOutboxBridgeService` writes rows to `outbox_events`.
3. BullMQ `outbox.publish` scheduler sweeps pending rows every 5s.
4. `OutboxPublishProcessor` publishes to Kafka with retries.
5. `apps/analytics-consumer` reads Kafka topics and inserts into `analytics_events`.

## Queues

| Queue | Purpose |
|-------|---------|
| `email.send` | Async email delivery |
| `rewards.auto-publish` | Auto-publish reviewed rewards |
| `claims.expire-pending` | Expire consumer claims |
| `claims.expire-referrer` | Expire referrer credit claims |
| `outbox.publish` | Sweep outbox → Kafka |

Job retry defaults: `packages/shared` → `QUEUE_JOB_OPTIONS` (mirrors `@workspace/messaging` presets).

## Correlation IDs

HTTP requests set `X-Correlation-Id`. `CorrelationContextInterceptor` propagates the value into outbox rows and Kafka envelopes.

## Reusing in another project

Copy `packages/messaging` and follow [packages/messaging/README.md](../../packages/messaging/README.md). Do **not** copy `apps/api/src/infrastructure/outbox` unless you need the same outbox pattern.
