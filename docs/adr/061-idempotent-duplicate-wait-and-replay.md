---
title: "ADR 061: Idempotent Duplicates Wait on a Key Lock, Then Replay"
tags: ["adr", "idempotency", "postgres", "concurrency"]
description: "A concurrent identical Idempotency-Key request blocks on a Postgres advisory lock for up to 5 seconds, then replays the original's stored response or executes if the original failed. No polling."
author: "Platform Team"
lastUpdated: 1792281600000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 61
---

# ADR 061: Idempotent Duplicates Wait on a Key Lock, Then Replay

## Status

Accepted (2026-10-18). Changes the duplicate-request contract of the `@Idempotent()` ledger (docs/technical/api/routes.md §10).

## Context

The original contract answered a concurrent identical request (same `Idempotency-Key`, same fingerprint, the first one still running) with an immediate `409 IDEMPOTENCY_REQUEST_IN_PROGRESS`. Clients that fire a retry while the first attempt is in flight (POS tills on a flaky network, double-submitted forms) then had to retry again on their own.

The DDD migration replaced that with a wait: the duplicate polled the record every 25 ms, up to 200 times (5 s). Each poll was a full system-operation transaction, so N waiting duplicates issued up to 200·N transactions, and a waiter answered 409 even when the original failed and released the key, instead of executing.

## Decision

1. **Keep "wait, then replay"** for a concurrent identical duplicate, capped at **5 seconds** (`IDEMPOTENCY_DUPLICATE_WAIT_MS`).
2. **Wait on a lock, never poll.** Every request with a key first takes a session-level Postgres advisory lock derived from `(scope, key)` (`pg_advisory_lock(int4, int4)`, SHA-256 halves) under `lock_timeout = 5 s`, on a dedicated pool (`IDEMPOTENCY_LOCK_POOL_MAX` connections, `application_name = api-idempotency-locks`), so the request pool is never starved by waiters.
3. **The executing request holds the lock for the whole handler** and releases it the moment it stores its response or releases the key after a failure (also when the request is cancelled).
4. **On wake, the record decides** under the lock: completed → replay; released or expired → this request executes (takes the key over); different fingerprint → `409 IDEMPOTENCY_KEY_REUSED`; still `IN_PROGRESS` with a live lease → `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` (the holder's session died; its lease must expire first).
5. **After 5 s still locked** → `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` with `Retry-After: 1`.
6. Fencing tokens and leases stay: they still protect against a holder whose session ended while its process kept running.

## Consequences

- A duplicate costs one lock statement while it waits and one record read after it wakes, however long the original runs (proved by `apps/api/test/idempotency-duplicate-wait.e2e-spec.ts`: N waiters are visible as `advisory` lock waits in `pg_stat_activity` and issue no reads).
- A failed original no longer turns its waiting duplicates into 409s: the first waiter executes, the others replay its result.
- Each in-flight idempotent request pins one lock-pool connection for the length of its handler. A request that cannot get a lock connection within 5 s fails (503) rather than waiting forever. Size `IDEMPOTENCY_LOCK_POOL_MAX` for the expected number of concurrent idempotent requests per instance.
- Advisory locks are database-wide, so the guarantee holds across API instances. A PgBouncer in transaction-pooling mode would break session-level advisory locks; the lock pool must connect directly or through session pooling.
- The OpenAPI `Idempotency-Key` header description states the new contract.
