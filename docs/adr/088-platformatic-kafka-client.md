---
title: "ADR 088: Pure-JavaScript Kafka Client (@platformatic/kafka)"
tags: ["adr", "kafka", "messaging", "analytics-consumer", "node"]
description: "Both Kafka clients (the API producer and the analytics consumer) use @platformatic/kafka, a maintained pure-JavaScript client, instead of Confluent's librdkafka binding — which ships no build for Node 26 and could not be compiled in CI. Topics stay provisioned, security stays configurable, publishing still never fakes success."
author: "Platform Team"
category: "Architecture decisions"
date: 1794960000000
lastUpdated: 1794960000000
editedAt: 1794960000000
coverImage: "/images/covers/adr/088-platformatic-kafka-client.webp"
order: 88
---

# ADR 088: Pure-JavaScript Kafka Client (@platformatic/kafka)

## Status

Accepted (2026-11-18). Supersedes the client choice of [ADR 024](./024-confluent-kafka-client.md); its
other decisions (provisioned topics, the security env contract, typed publish failures) stand.
Operational guide: [Messaging infrastructure](../technical/messaging.md#kafka-client).

## Context

The repository moved to Node 26 (`.nvmrc` 26.13.1). `@confluentinc/kafka-javascript` 1.11.0 — its
latest release — publishes prebuilt librdkafka binaries only up to Node 24 (ABI 137). On Node 26
(ABI 147) every install fell back to compiling librdkafka and its OpenSSL, zlib, zstd and curl
from source: about five minutes on a laptop, a C/C++ toolchain in every Docker build, and in
GitHub Actions the compile failed after nine minutes, failing the install step of every CI job.

`kafkajs` is not an option either: its last release (2.2.4) is from February 2023 (ADR 024).

## Decision

1. **Client:** [`@platformatic/kafka`](https://github.com/platformatic/kafka) (exact pin
   `2.16.0`), a maintained Kafka client written in JavaScript — no native addon, no install
   script, nothing to compile, the same on every Node release and platform. It is used directly
   (its own API) in `packages/messaging` (shared client options, provisioning, the producer) and
   `apps/analytics-consumer` (admin and consumer). `@confluentinc/kafka-javascript`, its
   `allowBuilds` entry and the Docker build tools it needed are removed.
2. **Shared client options** (`buildKafkaClientOptions`): brokers, client id, a per-request
   timeout, TLS (verified against `KAFKA_SSL_CA_LOCATION` or the system trust store — no switch
   turns verification off) and SASL (`PLAIN`, `SCRAM-SHA-256`, `SCRAM-SHA-512`). The env
   contract of ADR 024 is unchanged. **Retries are always set explicitly** (3, 250 ms apart):
   with the client's defaults, a send to — or a metadata read of — a topic the broker does not
   know never settled (measured on 2.16.0: still pending after 140 s); with them it fails in
   under a second.
3. **Producer semantics kept:** idempotent, `acks = all`, topics never auto-created
   (`autocreateTopics: false`). Keys hash with the Java client's murmur2
   (`compatibilityPartitioner`) — the same mapping librdkafka's `murmur2_random` used, so keys
   keep their partitions across the switch. `KAFKA_DELIVERY_TIMEOUT_MS` bounds a whole publish
   (retries included) with a deadline in our code, and caps the per-request timeout.
4. **Consumer:** a consumer group with auto-commit off. The worker reads one record at a time
   from the group's stream and commits its offset only after the inbox handler resolved
   (`consumePlatformEvents`) — at-least-once, as before. A group with a committed offset resumes
   from it; a new group starts at `ANALYTICS_CONSUMER_START_FROM` (`earliest` / `latest`).
5. **Diagnostics:** the client has no logger hook; it emits events. `observeKafkaClient` logs a
   broker it could not reach (warn) and any client `error` (error); the consumer adds failed
   heartbeats (warn) and a lost group (error). Repeats still fold through
   `AggregatingKafkaLogSink`. Log entries carry `clientEvent` (the event name) where they
   carried librdkafka's `facility`.

## Consequences

- No native code in the Kafka path: installs on Node 26 (and any later release) need no
  toolchain, CI installs no longer compile anything, and the Docker install stage stays slim.
- Key → partition mapping is unchanged (Java-compatible murmur2 on both sides of the switch).
- Committed consumer offsets are kept: they live in the broker under the same group id.
- `kafka.client_log` entries name `clientEvent` instead of `facility`; dashboards or alerts that
  filtered on `facility` must switch.
- A publish that misses its deadline may still be acknowledged later; the outbox then retries
  it and the record arrives twice. Consumers dedupe on `eventId` (the inbox), so nothing is
  applied twice.

## Files

- `packages/messaging/src/kafka/` (client options and diagnostics, deadline, provisioning)
- `packages/messaging/src/nest/kafka/kafka-producer.service.ts`
- `apps/analytics-consumer/src/infrastructure/kafka.ts`, `src/main.ts`, `src/cli/provision-kafka-topics.ts`
- `docs/technical/messaging.md`
