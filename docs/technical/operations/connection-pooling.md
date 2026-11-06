---
title: "Connection Pooling (PgBouncer)"
tags: ["operations", "database", "postgres", "pgbouncer"]
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
order: 4
description: "How to put a transaction-mode pooler such as PgBouncer in front of the API's database safely: what works, the two things that need a real session (DATABASE_SESSION_URL), the login role rule that keeps row-level security, and how migrations connect."
---

# Connection pooling (PgBouncer)

Enhancement 2.5. The API already budgets its own connections (`DB_POOL_MAX`, split into request and system
pools). In front of many API instances, a pooler such as PgBouncer keeps PostgreSQL's connection count low.
This page is what makes that safe with this codebase.

## What works in transaction mode, and why

| Thing | Why it's safe behind `pool_mode = transaction` |
|---|---|
| Row-level security identity | Every transaction stamps who is asking with `set_config(…, true)`: the role, the user, the tenant, the system operation (`src/prisma/tenant-transaction.service.ts`). `true` means **transaction-local**, so nothing leaks to the next client of that server connection |
| Prepared statements | The `pg` driver Prisma uses sends unnamed statements, which a transaction pooler handles |
| Migrations | Run on their own connection (below), never through the pooler |

## Two things that need a real session: `DATABASE_SESSION_URL`

A transaction pooler hands a server connection to someone else after every transaction. Two parts of the API
hold state across transactions, so they connect through **`DATABASE_SESSION_URL`**: a direct connection to
PostgreSQL, or a PgBouncer pool in `session` mode. Unset, they use `DATABASE_URL`, which is right when there is
no pooler.

| Needs a session | What breaks through a transaction pooler |
|---|---|
| `LISTEN` (the live audit trail, GitHub pull requests: `PgListenConnection`) | Notifications are silently never delivered: the `LISTEN` lands on a server connection that is then given away |
| Idempotency advisory locks (`PostgresIdempotencyKeyLocks`, `pg_advisory_lock`) | The lock and its release can land on different server connections, so a duplicate request is no longer held back |

These are few, long-lived connections (two listeners and a small lock pool per instance), so a direct connection
costs little.

## The login role rule (keeps row-level security)

When a connection is checked out, the API switches it to the restricted `app_runtime` role
(`applyRlsSession`, a session-level `SET ROLE`). A transaction pooler doesn't keep that between transactions.
Every transaction sets the role itself as well, so queries inside transactions are always restricted. To make a
statement *outside* a transaction restricted too, the login PgBouncer uses must **default** to `app_runtime`:

```sql
-- The login PgBouncer connects as (never a superuser, never the table owner).
CREATE ROLE app_pooled_login LOGIN PASSWORD '<from your secret store>' NOINHERIT;
GRANT app_runtime TO app_pooled_login;
ALTER ROLE app_pooled_login SET role = 'app_runtime';
```

Never point PgBouncer at the database owner or a superuser: those bypass row-level security.

## Migrations

`prisma migrate deploy` takes an advisory lock for the whole run and uses session features, so it always
connects **directly** (the deploy script's `api-migrate.env`, see the DigitalOcean guide), never through the
pooler.

## A working PgBouncer configuration

```ini
; pgbouncer.ini (the important lines)
[databases]
starter = host=127.0.0.1 port=5432 dbname=starter

[pgbouncer]
pool_mode = transaction
auth_type = scram-sha-256
max_client_conn = 500
default_pool_size = 40
; The pg driver sends these at start-up; PgBouncer must accept them.
ignore_startup_parameters = extra_float_digits,options
```

```bash
# apps/api/.env behind PgBouncer
DATABASE_URL=postgresql://app_pooled_login:<password>@127.0.0.1:6432/starter
DATABASE_SESSION_URL=postgresql://app_pooled_login:<password>@127.0.0.1:5432/starter   # direct
```

## Status

| | |
|---|---|
| Code | `DATABASE_SESSION_URL` (optional, defaults to `DATABASE_URL`) for the two listeners and the advisory-lock pool |
| CI job through PgBouncer | **Not yet**: it needs the `edoburu/pgbouncer` image pulled to verify locally first (question Q14 in `docs/history/PROGRESS-2026-11-02.md`) |
