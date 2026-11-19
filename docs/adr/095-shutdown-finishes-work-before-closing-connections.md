---
title: "ADR 095: Shutdown Finishes the Work in Progress, Then Closes the Connections"
tags: ["adr", "operations", "shutdown", "bullmq", "http"]
description: "app.close() alone is a graceful shutdown: queue workers, cron and interval ticks, HTTP requests and event streams finish or end first, buffers flush, and only then do the database, Kafka and Redis connections close, each in the Nest phase that guarantees that order."
author: "Platform Team"
category: "Architecture decisions"
date: 1795046400000
lastUpdated: 1795046400000
editedAt: 1795046400000
coverImage: "/images/covers/adr/095-shutdown-finishes-work-before-closing-connections.webp"
order: 95
---

# ADR 095: Shutdown Finishes the Work in Progress, Then Closes the Connections

## Status

Accepted (2026-11-19). Supersedes the worker drain of enhancement 4.3 (`BullMqWorkerDrainService`, removed).

## Context

A graceful shutdown must let the work in progress finish before it closes what that work uses. The API closed its
connections too early:

| What | Where it closed | What went wrong |
|---|---|---|
| Prisma pools, Kafka producer, idempotency lock pool | `onModuleDestroy`, Nest's first phase | `@nestjs/bullmq` closes its workers in the same phase, and Nest orders global modules by registration, so the pool ended under a running job ("Cannot use a pool after calling end on the pool"). The HTTP server closes even later (Nest's dispose), so an in-flight request lost its pool too. |
| Interval sweeps (webhooks, authorization changes, retention, operations) | Their timers were cleared, nothing waited | A sweep in progress kept running while the connections closed. |
| Cron jobs | `@nestjs/schedule` stops them, but waits only for jobs declared `waitForCompletion` | No cron declared it. |
| Feature-flag exposure buffer | Flushed in `onModuleDestroy` | Requests still running could note exposures after the final flush, and a periodic flush in progress was not awaited. |
| HTTP keep-alive connections | Fastify marks only the requests that arrive after closing began | A request already in its handler answered on a keep-alive connection that held the closing server open for `keepAliveTimeout` (72 s). |
| Event streams (`@Sse()`) | Never | An open browser tab held the server open until the shutdown timeout killed the process. |

The SIGTERM handler hid the first row by draining the BullMQ workers before `app.close()`. Every other caller of
`app.close()`, and every other kind of work, was left exposed.

## Decision

**`app.close()` alone is a graceful shutdown.** Each kind of work stops and finishes in the Nest phase that runs
before the connections it uses close:

| Phase (Nest's order) | What happens there |
|---|---|
| 1. `onModuleDestroy` | Consumers stop taking work and finish what they hold. `@nestjs/bullmq` closes every worker; `Worker.close()` waits for its running jobs. Pub/sub listeners unsubscribe. |
| 2. `beforeApplicationShutdown` | Scheduled work stops and the running tick finishes. `@nestjs/schedule` stops every cron and waits for the ones declared `{ waitForCompletion: true }`, which is every cron (`src/__tests__/cron-shutdown.spec.ts` fails on one without it). Our interval schedulers stop their timers and await their `InFlightWork`. |
| 3. dispose (HTTP server close) | Fastify's `preClose` fires `HttpServerClosing`, which ends every event stream (`EventStreamShutdownInterceptor`). From then on a response says `Connection: close`, and each finished response closes the idle sockets (`registerHttpShutdown`). Requests that arrive now get 503. Fastify waits for the in-flight ones. |
| 4. `onApplicationShutdown` | Buffers flush (exposures, the transaction log) and the instance leaves the operations list; these live in non-global modules, which Nest runs first. Then the connection owners close: Prisma (both pools), the Kafka producer, the Redis clients, BullMQ's queues. They live in global modules, which Nest runs last. |

| Rule | Meaning |
|---|---|
| A connection owner closes in `onApplicationShutdown` | Prisma, the Kafka producer, the idempotency lock pool, the Redis clients (already so). Never in `onModuleDestroy`. |
| A consumer stops in `onModuleDestroy` or `beforeApplicationShutdown` | And waits for what it started. A timer that starts work routes each run through `InFlightWork` (`platform/application/in-flight-work.ts`). |
| Every `@Cron` declares `waitForCompletion: true` | Also means a slow tick is never overlapped by the next one. |
| Every HTTP application registers `registerHttpShutdown` | Bootstrap and the e2e application factory. |

`runGracefulShutdown` (SIGTERM, SIGINT, SIGHUP) marks the instance not ready, calls `app.close()`, and exits `0`,
or `1` on a failure or after `SHUTDOWN_TIMEOUT_MS`. It has no drain step of its own.

## Consequences

- `BullMqWorkerDrainService` is gone from `@workspace/messaging`; nothing needs to call anything before `app.close()`.
- Tests and scripts that call `app.close()` shut down as production does.
- `e2e/graceful-shutdown.e2e-spec.ts` proves it with real BullMQ, Postgres and HTTP: a job running at SIGTERM and at a
  plain `app.close()` finishes on its first attempt, a request in flight gets its answer and `Connection: close`, an
  open event stream ends, and none of them holds the server open.
- A shutdown now takes as long as the longest piece of work in progress. `SHUTDOWN_TIMEOUT_MS` still bounds it.
