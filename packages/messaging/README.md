# `@workspace/messaging`

Portable **Redis, BullMQ, Kafka, and RabbitMQ (placeholder)** wiring for NestJS apps in this monorepo — or any other repo you copy this package into.

**No domain logic lives here.** Queue names, event schemas, and processors belong in your application.

---

## Install in another project

1. Copy the entire `packages/messaging` folder into your monorepo (or publish it privately).
2. Add workspace dependency:

```json
{
  "dependencies": {
    "@workspace/messaging": "workspace:*"
  }
}
```

3. Create app config (only file you edit per project):

```typescript
// apps/api/src/messaging/app-messaging.config.ts
import type { MessagingModuleOptions } from "@workspace/messaging/nest";

// Values come from YOUR app's validated config — this package never reads process.env.
export function buildAppMessagingConfig(config: MyAppConfig["messaging"]): MessagingModuleOptions {
  return {
    clientId: config.clientId,
    connectionName: config.connectionName,
    queueNames: ["email.send", "reports.generate"], // your queues
    bullPrefix: "bull",
    healthQueueName: "email.send",
    redisUrl: config.redisUrl, // undefined → Redis + BullMQ disabled
    kafkaBrokers: config.kafkaBrokers, // undefined → Kafka producer is a no-op
    rabbitmqUrl: config.rabbitmqUrl, // undefined → RabbitMQ placeholder disabled
  };
}
```

4. Register in `AppModule`:

```typescript
import { registerMessagingInfrastructureModule } from "@workspace/messaging/nest";
import { buildAppMessagingConfig } from "./messaging/app-messaging.config";

@Module({
  imports: [
    registerMessagingInfrastructureModule(buildAppMessagingConfig(appConfig.messaging)),
  ],
})
export class AppModule {}
```

5. Add processors in **your** feature modules:

```typescript
@Processor("email.send")
@Injectable()
export class EmailSendProcessor extends WorkerHost {
  public async process(job: Job): Promise<void> {
    // your logic
  }
}
```

---

## What you get

| Export | Purpose |
|--------|---------|
| `@workspace/messaging` | Redis/Bull helpers, outbox schemas |
| `@workspace/messaging/nest` | `MessagingInfrastructureModule`, health indicators, tokens |

### Nest modules (all via `registerMessagingInfrastructureModule`)

- **Redis** — `REDIS_PUBLISHER`, `REDIS_SUBSCRIBER` (ioredis, or `null` if no URL)
- **BullMQ** — registers all `queueNames`, exports `BullModule`
- **Kafka** — `KafkaProducerService.publish(topic, envelope, partitionKey?)` or no-op. Every message carries the envelope's stable `eventId` in the body and in the `event-id` header (`KAFKA_EVENT_ID_HEADER`), plus `event-type` (`KAFKA_EVENT_TYPE_HEADER`)
- **RabbitMQ** — placeholder service + health (logs when URL set, no consumers)

---

## Configuration (explicit, no environment reads)

This package **never reads `process.env`**. The app validates its own
environment (apps/api: `REDIS_URL`, `KAFKA_BROKERS`, `RABBITMQ_URL`,
`MESSAGING_CLIENT_ID`, `MESSAGING_CONNECTION_NAME` — see
[API configuration](../../docs/api-configuration.md)) and passes the values
through `MessagingModuleOptions`:

| Option | Purpose |
|--------|---------|
| `redisUrl` | Enables Redis + BullMQ (`undefined` disables) |
| `kafkaBrokers` | Kafka bootstrap servers (`undefined` disables) |
| `rabbitmqUrl` | Placeholder health only (`undefined` disables) |

---

## Core schemas (framework-agnostic)

```typescript
import {
  OutboxEnqueueInputSchema,
  MessageEnvelopeSchema,
  DEFAULT_QUEUE_JOB_OPTIONS,
  EmptyQueuePayloadSchema,
} from "@workspace/messaging";
```

Use these for transactional outbox tables and Kafka payloads in any app.

`MessageEnvelopeSchema` requires `eventId` (uuid): the producer-assigned, stable id of the event — in the transactional outbox pattern it is the outbox row id. A message republished after a crash keeps the same `eventId`, so consumers dedupe on it in an inbox table (`INSERT … ON CONFLICT DO NOTHING` in the same transaction as their side effect). See [ADR 015](../../docs/adr/015-transactional-outbox-and-inbox.md).

---

## Docker (reference)

This repo’s `compose.yml` is app-agnostic except Bull Board’s `QUEUE_NAMES` list — keep that in sync with your app config.

---

## Design rules

1. **Processors never live in this package** — only connection plumbing.
2. **Queue names are configured, not hardcoded** — pass `queueNames: [...]`.
3. **Kafka topics are strings** — app validates with its own Zod enums.
4. **Disabled = safe no-op** — an `undefined` connection setting disables that broker without crashing boot.
5. **No environment reads** — connection settings arrive through options, validated by the app.

---

## See also

- [Architecture ELI5](../../docs/infrastructure/architecture-eli5.md)
- [Messaging ops](../../docs/infrastructure/messaging.md)
