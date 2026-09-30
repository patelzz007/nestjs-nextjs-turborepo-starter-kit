# 12 — Observability & Operations

## Three pillars

Logs, metrics, traces — all structured, not ad hoc prose strings someone has to grep and eyeball to understand.

## Correlation

A request should be traceable through: `HTTP → NestJS → DB → job/event → consumer → external provider`. Carry correlation/trace identifiers through every hop the transport supports, so a single confusing production incident can be reconstructed end to end instead of investigated as five separate, disconnected mysteries.

```ts
// ❌ DON'T — a log line with no way to tie it back to the specific
// request that caused it, among thousands of concurrent requests
logger.log('Order created');

// ✅ DO — structured, correlated
logger.log({ event: 'order.created', requestId, orderId, userId, durationMs });
```

## Logging

Structured fields, not concatenated prose. Useful fields: `timestamp`, `level`, `service`, `environment`, `requestId`, `traceId`, `userId` (where appropriate), `tenantId`/`orgId` (where appropriate), `operation`, `duration`, `outcome`.

```ts
// ❌ DON'T
console.log(`User ${userId} created order ${orderId} at ${new Date()}`); // unstructured, unqueryable, hard to filter at scale

// ✅ DO
logger.info({ event: 'order.created', userId, orderId, timestampEpochMs: Date.now() });
```

Never log: passwords, access tokens, refresh tokens, payment secrets/card data, or unnecessary sensitive personal data — this includes not logging full request/response bodies for endpoints that touch payment or PII data without explicit redaction, the same redaction discipline required for audit logs (`10-security-auth-authorization.md`).

```ts
// ❌ DON'T
logger.debug({ requestBody: req.body }); // req.body might contain a password or card number

// ✅ DO
logger.debug({ requestBody: redactSensitiveFields(req.body) });
```

## Metrics

Track request latency, error rate, throughput, queue depth, job failure rate, Kafka consumer lag, RabbitMQ queue depth, Redis health, and database connection pressure. Look at percentiles (p50/p95/p99), not just averages — an average can look perfectly healthy while a meaningful fraction of real users have a terrible experience.

## Health checks

Separate liveness from readiness. Readiness should reflect whether the application can actually serve traffic (DB reachable, required downstream dependencies healthy), not just "the process is running" — a process that's up but can't reach its database should be marked not-ready so a load balancer stops sending it traffic, rather than serving a wave of failed requests.

## Failure behavior and resilience — avoiding single points of failure

A system with no single point of failure is one where any one dependency being down degrades the system gracefully instead of taking the whole thing down with it. This needs to be designed in deliberately — it does not happen by accident.

### For every external dependency, decide explicitly

```text
For each dependency (database, Redis, Kafka, RabbitMQ, a payment
gateway, S3/object storage, a third-party API), answer BEFORE shipping:

1. What's the timeout? (never leave a call with no timeout — an
   unresponsive dependency should not be able to hang a request forever)
2. Is it safe to retry, and how many times, with what backoff?
3. Should this open a circuit breaker after repeated failures, so a
   struggling dependency doesn't get hammered with a retry storm that
   makes its recovery even harder?
4. Is there a fallback (serve stale cached data, degrade a feature
   gracefully) — or is failure here genuinely fatal to the request?
5. How does the failure propagate to the user — a clear, honest error,
   not a hang or a generic 500 with no useful information?
```

```ts
// ❌ DON'T — no timeout at all; if the payment provider's API hangs,
// this request hangs indefinitely, holding a connection/thread the
// whole time, and eventually the whole API becomes unresponsive because
// every worker is stuck waiting on the same slow dependency
const result = await fetch('https://payment-provider.example.com/charge', { method: 'POST', body });

// ✅ DO — explicit timeout, explicit fallback/error behavior
const result = await fetchWithTimeout('https://payment-provider.example.com/charge', {
  method: 'POST', body, timeoutMs: 5000,
});
```

### No single point of failure — architectural practices

- **Run more than one instance of anything on the request-serving critical path** (API servers, message consumers/workers) so one instance crashing doesn't take the whole capability down.
- **Don't let a single Redis instance with no replica be a hard dependency for something user-facing and synchronous** — decide explicitly what degraded behavior looks like if it's briefly unavailable (see `09-messaging-and-jobs.md`'s messaging-specific SPOF guidance).
- **Avoid a single database connection pool exhaustion point** — bound concurrent queries per request, avoid long-held connections, and monitor connection pressure as a first-class metric.
- **Don't hardcode a single region/availability zone assumption** into application logic if the infrastructure is meant to be resilient to a zone outage — that's an infrastructure-level decision, but application code shouldn't silently assume "the database is always reachable at this one specific host with no failover."
- **A background job system going down should degrade, not corrupt** — jobs should be safely retryable from where they left off (idempotency, `09-messaging-and-jobs.md`) rather than assuming they always complete in one uninterrupted run.

The underlying discipline: for every dependency your code touches, ask "if this is down right now, what happens?" — and make sure the honest answer is "a clear, bounded degradation," not "an indefinite hang" or "silent data corruption."

## Failure behavior — closing the loop

Never allow an external provider to hang a request indefinitely. Every external dependency should have an intentional failure strategy: timeout, retry where safe, circuit breaking where appropriate, fallback where appropriate, and clear error propagation. This applies to payment gateways, S3/object storage, and third-party APIs alike (`20-object-storage.md`, `09-messaging-and-jobs.md`).

## Alerting — thresholds and signal-to-noise

```text
❌ DON'T — alert on every single error or anomaly, regardless of
   severity or actionability. An on-call engineer who gets paged 40
   times a night for things that don't need immediate action will,
   predictably and rationally, start ignoring alerts altogether — which
   means the ONE alert that genuinely mattered gets missed too.

✅ DO — page a human only for something that is both genuinely urgent
   AND genuinely actionable right now. Route everything else (a warning
   worth reviewing in the morning, a slow but non-critical degradation)
   to a lower-urgency channel. Define this distinction explicitly per
   alert when it's created, not left to whoever happens to be on call
   to guess in the moment.
```

Every alert that pages someone should link directly to (or be accompanied by) a runbook (`14-documentation.md`) telling them what to actually do — an alert with no corresponding action a human can take is either not a real alert, or is missing the documentation that would make it one.

## SLOs — define them before you need them

Define, for each user-facing capability that matters, an explicit Service Level Objective (e.g. "99.5% of order-creation requests complete in under 2 seconds") before an incident forces the conversation. An SLO gives "is this bad enough to page someone" an actual, agreed-upon answer instead of a judgment call made differently by whoever's on call that week, and gives performance work (`19-performance-and-scalability.md`) a concrete target instead of an open-ended "make it faster."

## Incident response and postmortems

```text
❌ DON'T treat an incident as resolved the moment the symptom goes away
   (the error rate drops, the service comes back up) with no further
   follow-up — this guarantees the same root cause resurfaces later,
   usually at a worse time.

✅ DO write a blameless postmortem for any incident meeting an agreed
   severity bar: timeline, root cause (not just the immediate trigger —
   the actual underlying reason it was possible), impact, and concrete
   follow-up action items with owners and dates. "Blameless" means the
   postmortem asks "what about our SYSTEMS and PROCESSES allowed this to
   happen," not "who made the mistake" — a culture that punishes the
   person who happened to be the one to trigger a latent issue teaches
   people to hide problems instead of surfacing them.
```

## Deployment monitoring

Watch error rate and key latency/health metrics immediately following every deploy, for a deliberate window (not just "check it looks fine and move on") — this is what makes it possible to catch and roll back a bad deploy within minutes rather than discovering it hours later from a user complaint. Where the infrastructure supports it, prefer a canary or gradual rollout (a small percentage of traffic first) for higher-risk changes, specifically so a bad deploy's blast radius is bounded before it reaches every user.

## Distributed tracing

```text
❌ DON'T rely on correlated LOGS alone to reconstruct what happened
   across a request that spans the API, a database call, a published
   Kafka event, and a downstream consumer — piecing this together from
   log lines across several services, by hand, during an active
   incident, is slow exactly when speed matters most.

✅ DO instrument the system with real distributed tracing (OpenTelemetry,
   exported to whatever backend this project has standardized on — e.g.
   Jaeger, Honeycomb, Datadog APM), propagating a trace context across
   every hop described in this document's "Correlation" section above,
   so a single request's full path across every service is a single,
   visually-inspectable trace rather than a manual log-correlation exercise.
```

```ts
// ✅ DO — trace context propagated explicitly across an async boundary
// (a Kafka event), not just within a single synchronous request, so the
// trace doesn't silently end the moment work becomes asynchronous
await kafka.publish('order.created', { ...payload, traceContext: getActiveTraceContext() });
// in the consumer:
await withTraceContext(event.traceContext, async () => { await processOrderCreated(event); });
```

## Dashboards — one canonical view per service, not ad hoc

Every service/app should have one canonical, actively-maintained dashboard (not several competing, half-abandoned ones) showing its key health signals at a glance: the metrics from this document's "Metrics" section above (latency percentiles, error rate, throughput), plus anything specific to that service (queue depth for a worker, cache hit rate for a caching layer). A dashboard nobody looks at because it's stale or wrong is worse than no dashboard — it creates false confidence that monitoring exists when it doesn't actually reflect reality.

## A filled-out runbook example, for calibration

```markdown
# Runbook: Kafka consumer lag alert (order-events consumer group)

## Symptom
Alert fires when consumer lag for the `order-events` consumer group
exceeds 10,000 messages for more than 5 minutes.

## Likely causes, in order of likelihood
1. A downstream dependency the consumer calls (e.g. the email provider)
   is slow/down, causing each message to take much longer than normal.
2. A bad deploy introduced a bug causing the consumer to crash-loop on a
   specific message shape.
3. Genuine traffic spike exceeding normal processing capacity.

## Immediate steps
1. Check the consumer's own error rate/logs for the last 30 minutes —
   is it crash-looping, or just slow?
2. If crash-looping on a specific message: identify the offending
   message via the dead-letter queue (09-messaging-and-jobs.md), and
   manually skip/quarantine it to unblock the rest of the partition.
3. If slow due to a downstream dependency: check that dependency's own
   health dashboard. If it's degraded, this is expected backpressure —
   monitor for recovery rather than intervening further.
4. If genuine traffic spike: consider temporarily scaling up consumer
   instances (see 09-messaging-and-jobs.md's SPOF/scaling guidance).

## Escalation
If lag continues to grow after 20 minutes of the above, page the
on-call lead for the orders team (#orders-oncall in the incident channel).

## Post-incident
File a postmortem per this document's "Incident response and
postmortems" section if user-facing impact exceeded 15 minutes.
```

## Synthetic monitoring

Beyond real-user metrics and alerting on actual traffic, run synthetic checks (a scripted "log in, place an order" probe, executed on a schedule from outside the production network) against critical user journeys — this catches a full outage or a broken critical path even during genuinely low-traffic periods where real-user monitoring alone might not generate enough signal to trip an alert quickly. This is the operational counterpart to `11-testing-vitest.md`'s small, focused E2E suite — the same critical journeys, but continuously verified in production, not just at merge time.

## Capacity planning

```text
❌ DON'T — scale reactively only, waiting for a resource-pressure alert
   (`12`'s metrics section above) to fire before ever thinking about
   capacity, so every scaling event is an unplanned, stressful scramble.

✅ DO — periodically (e.g. quarterly, or ahead of any known
   traffic-driving event) review actual growth trends against current
   capacity headroom for the resources most likely to become a
   bottleneck first (database connections, queue throughput, storage
   cost trend from `20-object-storage.md`), and plan/provision ahead of
   need rather than purely in reaction to an alert.
```

## Chaos engineering / failure injection

For a system mature enough to warrant it, deliberately and safely test the resilience practices described earlier in this document (timeouts, circuit breakers, fallback behavior, no-single-point-of-failure) by actually injecting failure in a controlled way (killing an instance, introducing artificial latency to a dependency, in a non-production or carefully-scoped production environment) rather than only ever finding out whether these safeguards actually work during a real, uncontrolled incident. A resilience mechanism that has never actually been exercised is a hypothesis, not a verified property of the system.

## Log levels — what belongs at each

```text
error — something failed that a human should look at (a request 5xx, a dead-lettered message,
        an unhandled exception). If nobody should ever act on it, it is not an error.
warn  — unexpected but handled; trend worth watching (a retry succeeded on attempt 3,
        a deprecated API version still being called, a cache miss storm).
info  — one line per meaningful business event (order.created, reward.published) with ids.
debug — developer detail; OFF in production by default; still redacted.
```

```ts
// ❌ DON'T — everything at error (alert fatigue) or everything at info (no signal)
logger.error('user clicked button');
logger.info('database connection failed');

// ✅ DO
logger.info({ event: 'reward.published', rewardId, organizationId, requestId });
logger.error({ event: 'payment.charge_failed', orderId, requestId, errorCode });
```

## A standard structured log shape

```ts
export const LogEntrySchema = z.object({
  timestampEpochMs: z.number().int().positive(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  service: z.string(),
  environment: z.enum(['local', 'test', 'staging', 'production']),
  event: z.string(),               // dotted, stable, greppable: "order.created"
  requestId: z.string().optional(),
  traceId: z.string().optional(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  outcome: z.enum(['success', 'failure']).optional(),
});
```

Stable `event` names are an API for your future self: dashboards and alerts key off them. Renaming one silently breaks every alert built on it — treat renames like a contract change.

## Data classification for logs

```text
PUBLIC     — safe anywhere (ids, statuses, counts)
INTERNAL   — fine in logs (user id, org id, request id)
SENSITIVE  — redact (email, phone, address, IP if your policy says so)
SECRET     — never logged, ever (passwords, tokens, card data, API keys, signing keys)
```

Redaction is implemented once in a shared function (`redactSensitiveFields`) that is unit-tested with a fixture containing every secret shape you know about. A redaction helper with no tests is a leak waiting for the first new field name it doesn't recognize — so prefer an **allowlist** of loggable fields for request/response bodies over a denylist of forbidden ones.

## Golden signals — what to instrument for every service

```text
Latency      — p50/p95/p99, split by endpoint and by success vs error
Traffic      — requests/sec; messages/sec per topic/queue
Errors       — rate by endpoint and by stable error code (4xx vs 5xx tracked separately)
Saturation   — DB connections in use, event-loop lag, memory, queue depth, consumer lag, disk/storage growth
```

```text
❌ Alerting on CPU > 80% for a moment (noisy, rarely actionable).
✅ Alert on symptoms users feel (error rate, latency SLO burn) and on saturation that predicts an outage
   (queue depth growing for N minutes, connection pool near exhaustion, outbox age rising).
```

## Business-event metrics

Beyond infrastructure metrics, emit counters for the business events that matter (`orders.created`, `payments.failed`, `rewards.published`). A healthy infrastructure dashboard with a flat-lined `orders.created` is an outage that infrastructure metrics alone will never show.
