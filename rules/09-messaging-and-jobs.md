# 09 — Kafka, RabbitMQ, BullMQ & Redis

These systems are not interchangeable — picking the wrong one for the semantics you need is a common, expensive mistake that's painful to unwind later. Decide from the matrix below, not from familiarity or what's already imported in the file you're editing.

## Decision matrix

| Technology | Primary role | Durable | Typical use |
|---|---|---:|---|
| Kafka | Event streaming/log | Yes | Domain/integration events, analytics pipelines, replayable streams |
| RabbitMQ | Message broker | Yes | Work distribution, routing, commands, request/task messaging |
| BullMQ | Job processing | Redis-backed | Delayed/retry/background jobs in Node |
| Redis | Cache/coordination | Depends on config | Cache, rate limits, locks, ephemeral state |

## Kafka

Use when multiple consumers need the event, replay matters, ordering/partitioning matters, event history is valuable, or stream processing is required. Do not use Kafka merely because the task is asynchronous — that's what BullMQ/RabbitMQ are for.

```text
❌ DON'T — using Kafka to send a single "welcome email" job that has
   exactly one consumer and no replay/history value. This is BullMQ's job.

✅ DO — using Kafka for "order.created," which multiple independent
   consumers care about (inventory, analytics, notifications, a
   downstream reporting pipeline) and where replaying historical events
   might matter for a new consumer added later.
```

Events are versioned: `reward.published.v1`, `order.created.v1`. Consumer logic must be idempotent — see the idempotency section below.

## RabbitMQ

Use for task/work distribution, routing, commands between services, acknowledgements, dead-lettering. Do not treat RabbitMQ as a permanent event store — that's Kafka's job; RabbitMQ messages are typically consumed once and gone.

## BullMQ

Use for emails, report generation, image processing, scheduled jobs, retries, delayed work. Job payloads must be serializable, versioned where needed, small, and idempotency-aware.

```ts
// ❌ DON'T — the entire order object, captured at enqueue time, is put
// into the job payload. By the time the job runs (maybe minutes later,
// after retries), the order may have changed, and the processor is
// acting on stale data it doesn't know is stale.
await queue.add('send-confirmation', { order: fullOrderObject });

// ✅ DO — pass an ID, let the processor look up CURRENT state when it runs
await queue.add('send-confirmation', { orderId: order.id });
// in the processor:
const order = await ordersRepository.findById(job.data.orderId); // fresh, current data
```

## Redis

Use for cache, rate limiting, distributed locks, ephemeral coordination, and as BullMQ's backend. Do not use Redis as the source of truth for business data — it's not backed by the same durability/backup guarantees as Postgres, and treating it as authoritative means an eviction or a restart can silently lose data nobody thought was "just a cache."

## Outbox pattern

For an operation that must atomically commit a DB write and publish an event:

```text
BEGIN
  business write
  outbox insert
COMMIT

outbox worker → Kafka/RabbitMQ → consumer
```

This avoids the classic failure of "DB commit succeeds, event publish fails" (or the reverse) leaving the system in an inconsistent state that's hard to detect and hard to reconcile after the fact.

```ts
// ❌ DON'T — publish directly inside the request, after the transaction commits
const order = await prisma.order.create({ data: dto });
await kafka.publish('order.created', order); // if this line throws, the order EXISTS but no event was ever sent — nobody downstream ever finds out

// ✅ DO — the event is written to the SAME transaction as the business
// data, so it's guaranteed to exist if (and only if) the order does;
// a separate outbox worker reliably publishes it afterward, with retry
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: dto });
  await tx.outbox.create({ data: { eventType: 'order.created', payload: order } });
  return order;
});
```

## Idempotency — mandatory wherever a duplicate effect would be wrong

Every consumer/job handler must consider duplicate delivery — at-least-once delivery is the default assumption for Kafka, RabbitMQ, and BullMQ retries alike, which means **your code will, eventually, be asked to process the exact same message twice.** Use an idempotency key or a durable "already processed" record where business correctness depends on not double-applying an effect.

```ts
// ❌ DON'T — a consumer that sends an email every time it's invoked, with
// no guard against being invoked twice for the same event (which WILL
// happen eventually under at-least-once delivery — a customer gets two
// "your order shipped" emails, which is annoying but survivable... unless
// the same pattern is used somewhere that ISN'T survivable, like a charge)
async function handleOrderShipped(event: OrderShippedEvent): Promise<void> {
  await emailProvider.send(event.customerEmail, shippingTemplate(event));
}

// ✅ DO — durable idempotency record, checked before acting
async function handleOrderShipped(event: OrderShippedEvent): Promise<void> {
  const alreadyProcessed = await processedEvents.exists(event.id);
  if (alreadyProcessed) return; // safe no-op on a duplicate delivery
  await emailProvider.send(event.customerEmail, shippingTemplate(event));
  await processedEvents.record(event.id);
}
```

### Payment gateway operations — idempotency is mandatory, not optional

Anything that calls a payment gateway (charge, refund, payout, subscription change) or that processes a payment-provider webhook must be idempotent by construction, because retries here are not just a performance nuisance — a missed idempotency guard means a customer gets double-charged or a refund is applied twice, which is a real financial and trust problem, not a cosmetic bug.

```ts
// ❌ DON'T — no idempotency key at all; a network blip causing the client
// to retry the "charge" request results in two separate real charges
await stripe.charges.create({ amount, currency, customer: customerId });

// ✅ DO — idempotency key generated at the point of user intent (when
// they click "Pay"), passed through to the gateway's own idempotency
// mechanism, so a retried request with the SAME key is guaranteed by
// Stripe itself to only ever result in one actual charge
const idempotencyKey = generateIdempotencyKey(orderId, 'charge');
await stripe.charges.create(
  { amount, currency, customer: customerId },
  { idempotencyKey },
);
```

- Generate the idempotency key **at the point of intent** (when the user clicks "Pay"), not freshly on every retry attempt — a new key on every retry defeats the entire purpose.
- Persist the mapping of `idempotencyKey → result` durably before or atomically with the external call, so a retry after a crash mid-call can look up "did this already happen?" rather than blindly re-attempting.
- Webhook handlers for payment events must be idempotent on the provider's own event ID — store processed event IDs and short-circuit on a duplicate delivery, since providers explicitly document that webhooks can be sent more than once for the same event.
- Never treat "the HTTP call to the payment provider timed out" as "the payment didn't happen" — a timeout means *unknown* state, not *failed* state. Reconcile via the provider's status/lookup API using the idempotency key rather than blindly retrying a raw charge, which could create a second one.

## Retry

Retries must distinguish transient failures (network blip, temporary provider outage — safe to retry), permanent failures (malformed payload, a business rule that will never pass — retrying changes nothing), malformed messages, authorization failures, and dependency outages. Never retry an invalid payload forever — route it to a dead letter instead.

## Dead letters

```text
failed → retry policy → dead letter → alert → operator remediation
```

Every dead-lettered message/job needs an operational path a human can act on, not a silent black hole nobody ever looks at.

## Avoiding single points of failure in messaging infrastructure

A messaging layer that itself becomes a single point of failure defeats the purpose of decoupling work through it in the first place. Concrete practices:

- **Don't let a synchronous request-response flow depend on a queue/broker being up.** If Redis, Kafka, or RabbitMQ is down, a *user-facing, synchronous* request (e.g. "place an order") should still succeed for the parts that don't genuinely need the queue — degrade gracefully (e.g. write the outbox row and let the worker catch up later) rather than failing the entire request because a downstream message couldn't be published immediately.
- **Run consumers/workers with more than one instance** wherever the workload justifies it, so a single worker crashing doesn't stall an entire queue.
- **Design for the "what if this dependency is down right now" question explicitly**, for every external dependency, not just messaging — see `12-observability-and-operations.md`'s "Resilience" section for the full checklist (timeouts, circuit breaking, fallback behavior) that applies here too.
- **Don't build a critical path that has no fallback if Redis is unavailable** — e.g. if a distributed lock via Redis is used to prevent duplicate processing, decide up front what happens if Redis itself is briefly unreachable (fail closed and reject the request cleanly, vs. fail open and risk a duplicate) rather than leaving it as undefined behavior that whichever code path happens to run first will determine.

## Observability

Every message/job carries correlation context where practical: request ID, trace ID, event ID, tenant/org context where safe, producer metadata. See `12-observability-and-operations.md`.

## Message schema evolution

```text
❌ DON'T — change an existing Kafka event's schema in a way that breaks
   an existing consumer, without any versioning. A consumer that's still
   deployed with the old expectation will either crash or (worse) silently
   misinterpret the new shape.

✅ DO — treat event schema changes with the same discipline as public API
   changes (05-contracts-zod-api.md's versioning section): additive
   changes (a new optional field) are safe; anything else ships as a new
   versioned event type (order.created.v2) published ALONGSIDE the old
   one until every consumer has migrated, then the old version is
   deprecated on an explicit timeline.
```

## Consumer groups

For Kafka, be deliberate about consumer group design: consumers in the same group split the partitions of a topic between them (for horizontal scaling of processing), while consumers in different groups each get their own full copy of every message. A common, costly mistake is accidentally putting two logically-different consumers (e.g. "send notification" and "update analytics") in the SAME consumer group, which means only one of them actually processes each message — the other silently never runs, because Kafka thinks they're two instances of the same worker.

```text
❌ DON'T — two functionally different consumers share one groupId by accident
   (often because it was copy-pasted from another service's config).

✅ DO — a distinct, clearly-named consumer group per logically independent
   consumer: notification-service-order-events, analytics-service-order-events.
```

## Exactly-once vs at-least-once — know which one you actually have

True exactly-once delivery is hard to achieve end-to-end across independent systems and this stack does not assume it anywhere by default — **assume at-least-once delivery everywhere**, which is why idempotency (above) is mandatory rather than a nice-to-have. If a specific pipeline genuinely needs exactly-once semantics (rare, and usually reserved for the most sensitive financial reconciliation paths), that's a deliberate, explicitly-designed exception — implemented via idempotent processing plus a durable dedup ledger, effectively simulating exactly-once ON TOP of at-least-once delivery, not by assuming the transport itself guarantees it.

## Job priority and concurrency configuration

```ts
// ❌ DON'T — every BullMQ queue processed with the same default
// concurrency, regardless of whether the work is CPU-bound (image
// processing — should have LOW concurrency to avoid starving the event
// loop) or I/O-bound (sending an email — can have much higher concurrency)
new Worker('image-processing', processor); // default concurrency: 1, but is that actually right here?

// ✅ DO — concurrency tuned deliberately per queue, based on the actual
// nature of the work
new Worker('image-processing', processor, { concurrency: 2 }); // CPU-heavy, keep low
new Worker('send-email', processor, { concurrency: 20 });        // I/O-bound, can go higher
```

Use BullMQ's priority support for queues where some jobs are genuinely more urgent than others (e.g. a password-reset email should jump ahead of a bulk marketing email in the same queue) — don't build a separate queue for every priority level if BullMQ's built-in priority mechanism already solves it.

## Scheduled/recurring jobs

```ts
// ✅ DO — BullMQ's repeatable jobs for anything that runs on a schedule
// (a nightly reconciliation job, an hourly cleanup), rather than a
// separate, unrelated cron mechanism the rest of the job infrastructure
// (retry, dead-letter, observability — all covered above) doesn't apply to
await queue.add('nightly-reconciliation', {}, { repeat: { pattern: '0 2 * * *' } });
```

Every scheduled job needs the same idempotency consideration as any other job — a job scheduler occasionally double-firing (due to a deploy overlap, a clock skew, a retry after a crash right at trigger time) is a real, expected scenario, not a hypothetical edge case.

## Message ordering

Kafka guarantees ordering only WITHIN a single partition, not across an entire topic. If a consumer's correctness depends on processing events for a given entity (e.g. all events for one specific order) in the order they happened, that entity's ID must be used as the partition key, so all of its events land on the same partition and are processed in order relative to each other. Don't assume global ordering across a topic — it doesn't exist, and code that silently depends on it will work fine in local testing (usually one partition) and misbehave unpredictably in production (multiple partitions, genuinely concurrent consumers).

## RabbitMQ exchange types — chosen deliberately, not defaulted

```text
❌ DON'T — default to a direct exchange (or whatever the first tutorial
   you read used) for every queue, regardless of the actual routing
   need — this either forces awkward workarounds later or silently
   under-delivers messages to consumers that should have received them.

✅ DO — choose the exchange type that actually matches the routing
   semantics needed:
   - direct: route by an exact routing key match (e.g. "send this
     specific job type to this specific worker queue")
   - topic: route by a pattern match on a dot-separated routing key
     (e.g. "order.*.created" reaching multiple interested queues based
     on a wildcard) — the right choice when several distinct consumers
     care about different SLICES of the same event space
   - fanout: broadcast to every bound queue, no routing key logic at
     all — the right choice when every consumer genuinely needs every message
```

Document the chosen exchange topology explicitly (`01-repository-architecture.md`'s ADR guidance) rather than leaving it to be reverse-engineered from broker configuration later.

## BullMQ flows — dependent, multi-step jobs

```ts
// ❌ DON'T — chain jobs manually by having one job's processor enqueue
// the next job as its last line, which loses BullMQ's built-in
// dependency tracking, makes partial-failure recovery ad hoc, and
// scatters the actual multi-step WORKFLOW across several separate
// processor files with no single place that shows the full sequence
async function processImage(job) {
  await resize(job.data);
  await queue.add('generate-thumbnail', job.data); // implicit, hidden chaining
}

// ✅ DO — BullMQ's FlowProducer for genuinely dependent multi-step work,
// where the dependency structure is explicit and the whole flow's state
// (which step succeeded, which is pending, which failed) is queryable
// as one coherent unit
const flow = new FlowProducer();
await flow.add({
  name: 'process-order',
  queueName: 'orders',
  data: { orderId },
  children: [
    { name: 'charge-payment', queueName: 'payments', data: { orderId } },
    { name: 'reserve-inventory', queueName: 'inventory', data: { orderId } },
  ],
});
```

## Kafka schema registry

For a Kafka deployment of any real scale, register event schemas in a schema registry (Confluent Schema Registry or equivalent) rather than relying purely on the zod schema living in `packages/contracts` as the only enforcement point — a schema registry additionally protects against a producer accidentally publishing a schema-incompatible message that a consumer written in a completely different language/stack (outside this TypeScript monorepo) would have no way to validate against the same zod schema. Treat the zod schema in `packages/contracts` and the registry schema as two views of the same contract, kept in sync deliberately, not as redundant, independently-evolving sources of truth (echoing `05-contracts-zod-api.md`'s "never hand-maintain a second source of truth" principle, applied at the cross-service level).

## Poison messages and quarantine

```text
❌ DON'T — a consumer that crash-loops indefinitely on a single
   malformed/unprocessable message, blocking every message BEHIND it in
   the same partition/queue from ever being processed, because the
   retry policy just keeps redelivering the same poison message forever.

✅ DO — after a bounded number of failed attempts (per this document's
   retry guidance above), a message is explicitly quarantined
   (dead-lettered) rather than retried indefinitely, so the rest of the
   queue/partition can keep flowing. The dead-letter entry captures
   enough context (the payload, the error, the number of attempts) for
   a human to diagnose it later without needing to reproduce the crash
   from scratch.
```

## Backpressure

```text
❌ DON'T let a producer publish/enqueue work faster than consumers can
   possibly keep up with, indefinitely, with no feedback loop — this
   just shifts the problem downstream into an ever-growing, unbounded
   queue that eventually exhausts memory/storage on the broker itself.

✅ DO — for a producer that CAN meaningfully slow down (as opposed to,
   say, a fixed-rate stream of real-world events it doesn't control),
   apply backpressure: monitor queue depth/consumer lag
   (12-observability-and-operations.md) and either slow the producer or
   scale consumers in response, rather than letting the queue grow unboundedly.
```

## Testing message consumers against realistic broker behavior

Beyond the general integration-testing guidance (`11-testing-vitest.md`), specifically test a consumer's behavior under the conditions that are easy to get wrong in code review but hard to spot without deliberately simulating them: a message redelivered after a consumer crash mid-processing (does the idempotency guard actually prevent a double-effect?), an out-of-order delivery within a partition boundary that shouldn't normally happen but a bug elsewhere could cause, and a consumer receiving a message shaped according to an OLDER schema version (does it degrade gracefully, or crash?).

## A reference outbox worker

```ts
@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false; // prevents overlapping polls in this instance

  public constructor(private readonly prisma: PrismaService, private readonly publisher: EventPublisher) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => { void this.tick(); }, OUTBOX_POLL_INTERVAL_MS);
  }
  public onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      // FOR UPDATE SKIP LOCKED lets several worker instances share the table
      // without double-processing the same row — no single-worker SPOF.
      const rows = await this.prisma.$queryRaw<OutboxRow[]>`
        SELECT * FROM "Outbox" WHERE "publishedAt" IS NULL
        ORDER BY "createdAt" ASC LIMIT ${OUTBOX_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED`;
      for (const row of rows) {
        await this.publisher.publish(OutboxEventSchema.parse(row.payload)); // re-validated before publish
        await this.prisma.outbox.update({ where: { id: row.id }, data: { publishedAt: new Date() } });
      }
    } catch (error) {
      logger.error({ event: 'outbox.tick_failed', error: describeError(error) }); // next tick retries; consumers are idempotent
    } finally {
      this.isProcessing = false;
    }
  }
}
```

Points to notice: at-least-once (publish then mark — a crash between them republishes, hence idempotent consumers), `SKIP LOCKED` for horizontal scaling, named constants for interval/batch size, payload re-validated, failures logged and retried rather than swallowed. Add a metric for `unpublished outbox rows` and its oldest age — growth is the earliest warning that publishing is broken.

## Idempotent consumer — reference

```ts
public async handle(event: OrderShippedEvent): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    try {
      await tx.processedEvent.create({ data: { eventId: event.id, consumer: 'shipping-notifier' } }); // unique(eventId, consumer)
    } catch (error) {
      if (isUniqueConstraintError(error)) return; // duplicate delivery: safe no-op
      throw error;
    }
    await this.notifications.enqueue(event); // side effect only on first processing
  });
}
```

The unique constraint is the idempotency guarantee — not an `if (exists)` check, which is itself a race.

## Retry classification — reference

```ts
export type FailureKind = 'transient' | 'permanent' | 'malformed' | 'unauthorized' | 'dependency_down';

export function classifyFailure(error: Error): FailureKind {
  if (error instanceof SchemaValidationError) return 'malformed';      // retrying cannot help → dead letter now
  if (error instanceof ForbiddenError) return 'unauthorized';           // retrying cannot help → dead letter + alert
  if (error instanceof BusinessRuleViolation) return 'permanent';       // deterministic failure → dead letter
  if (error instanceof DependencyUnavailableError) return 'dependency_down'; // back off longer; consider circuit open
  return 'transient';                                                   // network blip, deadlock, timeout → retry with backoff + jitter
}
```

```text
Backoff: exponential with jitter (base delay × 2^attempt ± random), capped, with a MAX attempt count.
❌ Fixed 1s retry loop forever (retry storm against a struggling dependency).
✅ Exponential backoff + jitter + cap + dead letter, and a metric on retries per queue.
```

## Event catalog

Maintain a catalog (in `packages/contracts`, next to the schemas) listing every event: name+version, producer, consumers, partition key, retention, and the schema. "Who consumes `order.created.v1`?" must be answerable by search, before you change it.
