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

export const APP_MESSAGING_CONFIG: MessagingModuleOptions = {
  clientId: process.env.MESSAGING_CLIENT_ID ?? "my-api",
  connectionName: process.env.MESSAGING_CONNECTION_NAME ?? "my-api",
  queueNames: ["email.send", "reports.generate"], // your queues
  bullPrefix: "bull",
  healthQueueName: "email.send",
};
```

4. Register in `AppModule`:

```typescript
import { registerMessagingInfrastructureModule } from "@workspace/messaging/nest";
import { APP_MESSAGING_CONFIG } from "./messaging/app-messaging.config";

@Module({
  imports: [
    registerMessagingInfrastructureModule(APP_MESSAGING_CONFIG),
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
| `@workspace/messaging` | Redis/Bull helpers, outbox schemas, env parsing |
| `@workspace/messaging/nest` | `MessagingInfrastructureModule`, health indicators, tokens |

### Nest modules (all via `registerMessagingInfrastructureModule`)

- **Redis** — `REDIS_PUBLISHER`, `REDIS_SUBSCRIBER` (ioredis, or `null` if no URL)
- **BullMQ** — registers all `queueNames`, exports `BullModule`
- **Kafka** — `KafkaProducerService.publish(topic, envelope)` or no-op
- **RabbitMQ** — placeholder service + health (logs when URL set, no consumers)

---

## Environment variables (defaults)

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Enables Redis + BullMQ |
| `KAFKA_BROKERS` | Comma-separated brokers |
| `RABBITMQ_URL` | Placeholder health only |

Override env key names via `envKeys` in `MessagingModuleOptions`.

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

---

## Docker (reference)

This repo’s `compose.yml` is app-agnostic except Bull Board’s `QUEUE_NAMES` list — keep that in sync with your app config.

---

## Design rules

1. **Processors never live in this package** — only connection plumbing.
2. **Queue names are configured, not hardcoded** — pass `queueNames: [...]`.
3. **Kafka topics are strings** — app validates with its own Zod enums.
4. **Disabled = safe no-op** — missing env vars disable brokers without crashing boot.

---

## See also

- [Architecture ELI5](../../docs/infrastructure/architecture-eli5.md)
- [Messaging ops](../../docs/infrastructure/messaging.md)
