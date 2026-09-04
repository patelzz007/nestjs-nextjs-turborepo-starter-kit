---
title: "ADR: RabbitMQ Placeholder"
tags: ["adr", "rabbitmq", "messaging", "infrastructure"]
description: "Architecture decision record for keeping RabbitMQ in Docker Compose as a placeholder until a non-Node worker needs AMQP."
author: "Backend Team"
lastUpdated: 1788643200000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 8
---

# RabbitMQ placeholder (ADR)

## Status

Accepted — infrastructure only. The NestJS API does **not** connect to RabbitMQ yet.

## Context

`compose.yml` runs RabbitMQ for local development. BullMQ (Redis) handles internal job execution; Kafka handles durable platform events via the transactional outbox.

We anticipate future **non-Node workers** (Python, Go, or other runtimes) that may prefer AMQP over Redis streams or Kafka consumers.

## Decision

- Keep RabbitMQ in Docker Compose as a **placeholder**.
- Do **not** wire RabbitMQ in `apps/api` until a concrete worker exists.
- Document connection defaults in `apps/api/.env.example` (commented).

## Consequences

- Developers see four infra services in compose but only Redis + Kafka are API-integrated today.
- When a non-Node worker is added, create a dedicated app under `apps/` and an ADR update describing the queue/exchange contract.

## Revisit when

- A service outside NestJS needs durable task delivery with AMQP routing semantics.
- BullMQ or Kafka cannot meet latency, routing, or operator requirements for that workload.
