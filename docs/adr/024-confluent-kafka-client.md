---
title: "ADR 024: Confluent Kafka Client (librdkafka) Instead of kafkajs"
tags: ["adr", "kafka", "messaging", "analytics-consumer", "security"]
description: "Both Kafka clients (the API producer and the analytics consumer) use @confluentinc/kafka-javascript through its KafkaJS-compatible API; kafkajs and its local patch are gone. Topics are provisioned explicitly, TLS/SASL is configurable, publishing never fakes success."
author: "Platform Team"
lastUpdated: 1791000000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 24
---

# ADR 024: Confluent Kafka Client (librdkafka) Instead of kafkajs

## Status

Accepted (2026-10-03). Operational guide: [Messaging infrastructure](../technical/messaging.md#kafka-client).

## Context

The repo used `kafkajs@2.2.4` — its final release; the project is unmaintained. A local
pnpm patch (`patches/kafkajs@2.2.4.patch`) only clamped a negative `setTimeout` delay to hide
Node's `TimeoutNegativeWarning`. The underlying behaviour stayed: an idle broker connection
re-scheduled its pending-request check roughly every millisecond (a busy loop per connection),
the dependency range was `^2.2.4`, and none of it was documented. Around it:

- the analytics consumer auto-created missing topics with 1 partition and replication factor 1;
- there was no TLS / SASL configuration at all;
- `KafkaProducerService.publish()` returned successfully when the producer was not connected
  (or Kafka was disabled), so a caller could believe an event was delivered when it was not.

## Decision

1. **Client:** `@confluentinc/kafka-javascript` (exact pin `1.10.1`), Confluent's maintained
   binding over librdkafka, used through its `KafkaJS` compatibility namespace in
   `packages/messaging` (producer, shared config) and `apps/analytics-consumer` (consumer). It
   ships prebuilt librdkafka binaries (linux / darwin / win, x64 / arm64), installed by its
   `install` script — allowed in `pnpm-workspace.yaml` → `allowBuilds`. `kafkajs`, the patch and
   the `patchedDependencies` entry are removed. An idle connection costs ~1 ms CPU over 3 s
   (measured), not a 1 ms reschedule loop.
2. **Security:** one env contract for every client — `KAFKA_SSL`, `KAFKA_SSL_CA_LOCATION`,
   `KAFKA_SASL_MECHANISM` (`plain` / `scram-sha-256` / `scram-sha-512`), `KAFKA_SASL_USERNAME`,
   `KAFKA_SASL_PASSWORD` (`KafkaSecurityEnvShape` in `@workspace/messaging/kafka`). Combinations
   that would be ignored, or SASL/PLAIN without TLS, fail boot. Certificate verification
   cannot be switched off.
3. **Topics are provisioned, never auto-created.** Producer and consumer set
   `allowAutoTopicCreation: false`; `kafka:provision-topics` creates the `platform.*` topics from
   `KAFKA_TOPIC_PARTITIONS` / `KAFKA_TOPIC_REPLICATION_FACTOR` (required) and
   `KAFKA_TOPIC_RETENTION_DAYS`, verifies existing ones and reports drift instead of altering them.
4. **Publishing never fakes success.** `publish()` rejects with `KafkaProducerDisabledError`,
   `KafkaProducerNotConnectedError` or `KafkaPublishError`; delivery is bounded by
   `KAFKA_DELIVERY_TIMEOUT_MS` (`message.timeout.ms`). Health reports the producer state.
5. **Producer semantics kept:** idempotent producer, `acks = all`. Partitioning is librdkafka's
   Java-compatible `murmur2_random`.

## Consequences

- **Key → partition mapping changed** (kafkajs used its `LegacyPartitioner`). On a topic with
  more than one partition, events for one key may land on a different partition than before the
  switch; per-key order is only guaranteed again from the switch onward. Consumers dedupe on
  `eventId`, so nothing is applied twice. Deploy with the outbox dispatcher drained if strict
  per-key ordering across the switch matters.
- Consumer offsets: `fromBeginning` is a consumer-level setting (`ANALYTICS_CONSUMER_START_FROM`),
  not a `subscribe()` option; auto-commit commits only offsets stored after `eachMessage`
  resolved (at-least-once).
- A native addon: an unsupported platform falls back to a `node-gyp` build (needs a C/C++
  toolchain). CI (ubuntu) and macOS use the prebuilt binary.
- New environments must run `kafka:provision-topics` before starting the consumer (it refuses to
  start when a topic is missing) and before the API can publish (a publish to a missing topic
  fails with `KafkaPublishError` after the delivery timeout).

## Files

- `packages/messaging/src/kafka/` (security env, client config, logger adapter, topic provisioning)
- `packages/messaging/src/nest/kafka/kafka-producer.service.ts`
- `apps/analytics-consumer/src/kafka.ts`, `src/cli/provision-kafka-topics.ts`
- `pnpm-workspace.yaml` (`allowBuilds`), `docs/infrastructure/messaging.md`
