---
title: "Local Infrastructure (Docker Compose)"
tags: ["operations", "docker", "postgres", "local-development"]
description: "Every service in compose.yml, its ports and dev credentials, how to override them, and how to fix common start-up problems."
author: "Platform Team"
lastUpdated: 1792108800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 3
---

# Local Infrastructure (Docker Compose)

`compose.yml` at the repository root starts everything the apps talk to locally. It is
**development-only**: default passwords are public, and nothing in it is meant for a server.

```bash
pnpm docker:up       # docker compose up -d
pnpm tools docker:ps       # status + health
pnpm tools docker:logs     # follow logs
pnpm docker:down     # stop and remove containers (data volumes are kept)
```

## Services

| Service | Image | Host address | Dev credentials | Used by |
| --- | --- | --- | --- | --- |
| `redis` | `redis:8.10.1` | `localhost:6379` | none | caches, BullMQ |
| `kafka` | `apache/kafka:4.3.1` | `127.0.0.1:9092` (use the IPv4 literal, not `localhost`) | none | analytics events |
| `rabbitmq` | `rabbitmq:4.3.5` | `localhost:5672`, UI `http://localhost:15672` | `rabbit` / `rabbit` | messaging |
| `bull-board` | `venatum/bull-board:3.4.14` | `http://localhost:3030` | none | BullMQ dashboard |
| `mailpit` | `axllent/mailpit:v1.31.3` | inbox + API `http://localhost:8025`, SMTP `localhost:1025` | none | local email (`EMAIL_PROVIDER=mailpit`, [Local email with Mailpit](../email/mailpit-local-inbox.md)) |

**PostgreSQL is not started by default.** The `postgres` service (`postgres:18.6`, the same image
CI uses) is commented out in `compose.yml`; use a native PostgreSQL 18 (Homebrew, apt, Postgres.app)
or uncomment the service. Its defaults (`postgres` / `postgres`, database
`nestjs-nextjs-turborepo-starter-kit`, port 5432) match `DATABASE_URL` in `apps/api/.env.example`.
There is no MinIO service either: use `STORAGE_PROVIDER=local` for zero-setup storage, or a real
bucket ([AWS S3](../storage/aws-s3.md) / [Firebase](../storage/firebase.md)).

Every service binds to `127.0.0.1` only, so the default passwords are not reachable from other
machines on your network.


## Overriding ports and credentials

The newer services read these variables (shell environment, or a git-ignored `.env` file next to
`compose.yml`). Defaults are shown.

| Variable | Default | Notes |
| --- | --- | --- |
| `REDIS_PORT` / `KAFKA_PORT` | `6379` / `9092` | host ports (Kafka advertises `127.0.0.1:${KAFKA_PORT}`, so changing `KAFKA_PORT` only needs the same port in `KAFKA_BROKERS`) |
| `RABBITMQ_AMQP_PORT` / `RABBITMQ_UI_PORT` / `BULL_BOARD_PORT` | `5672` / `15672` / `3030` | host ports |
| `MAILPIT_UI_PORT` / `MAILPIT_SMTP_PORT` | `8025` / `1025` | host ports (set `MAILPIT_URL` in `apps/api/.env` to match a changed UI port) |
| `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` | `rabbit` / `rabbit` | applied only when the volume is first created |

If you uncomment the `postgres` service, it also reads `POSTGRES_PORT` (5432), `POSTGRES_USER` /
`POSTGRES_PASSWORD` (`postgres` / `postgres`) and `POSTGRES_DB`; the credentials apply only when
its volume is first created.

## Bootstrapping the database

```bash
pnpm docker:up
cp apps/api/.env.example apps/api/.env      # if you have not already
pnpm tools db:deploy                               # migrations + RLS (db:apply-security)
pnpm db:seed                                 # development scenario — see Database → Seed data
```

### Fresh clusters and the `app_runtime` role

The API reaches tenant data through the `app_runtime` role (`SET ROLE`), which is subject to RLS.
`pnpm tools db:apply-security` creates it in `prisma/rls/00-app-helpers.sql`, the first file it applies,
so a brand-new cluster needs no manual bootstrap. The apply plan
(`apps/api/prisma/rls/apply-plan.ts`) refuses to run if any file uses a role before the file that
creates it, so this can't regress unnoticed on long-lived dev clusters, where roles already exist
cluster-wide.

## Bring-up order (API + analytics consumer)

Kafka does not auto-create topics (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=false` here and in CI; the
producer and consumer also set `allowAutoTopicCreation: false`), so the topics must be provisioned
before anything publishes or consumes. On a fresh machine, in this order:

1. `pnpm docker:up` — Kafka and the other services (PostgreSQL running natively or via the uncommented service).
2. `pnpm tools db:deploy` — migrations + RLS; this also creates the `analytics_consumer` role.
3. `cp apps/analytics-consumer/.env.example apps/analytics-consumer/.env` and fill in the consumer's own login.
4. `pnpm --filter @workspace/analytics-consumer db:provision-login` — creates that least-privilege login.
5. `pnpm --filter @workspace/analytics-consumer kafka:provision-topics` — creates the topics explicitly.
6. `pnpm tools dev:analytics-consumer` (and `pnpm dev:api`).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `ports are not available … 127.0.0.1:5432` | A native PostgreSQL (Homebrew, Postgres.app) is listening. Stop it, or start with `POSTGRES_PORT=5433` and update `DATABASE_URL`. (Only relevant if you uncommented the `postgres` service.) |
| API / consumer log `kafka.client_log` `Connect to ipv6#[::1]:9092 failed: Connection refused`, then `all broker connections are down` | `KAFKA_BROKERS=localhost:9092` (an old `.env`) or a Kafka container created before the broker advertised `127.0.0.1`: `localhost` resolves to `::1` first, and the broker only listens on IPv4. Set `KAFKA_BROKERS=127.0.0.1:9092` in `apps/api/.env` and `apps/analytics-consumer/.env`, then `docker compose up -d kafka` to recreate the broker with the current advertised listener. A broker that is really down logs its connection error once, then one line with `repeatCount` per minute — not one line per retry. |
| Changed `POSTGRES_*` values are ignored | They only apply when the volume is created. Recreate it: `docker compose down` then `docker volume rm hello-world_postgres_18_data` (**deletes the local database**). |
| `role "app_runtime" does not exist` during `db:deploy` | The cluster was initialised without the init script — see [the fresh-cluster note](#fresh-clusters-and-the-app_runtime-role). |

The Postgres volume name carries the major version (`postgres_18_data`): a major upgrade needs a
dump/restore, and a versioned volume can never be started against data files from an older major.

## Planned rework of `compose.yml` (agreed 2026-10-30, not built yet)

Step 1 of the build order agreed with ADRs [070](../../adr/070-multi-channel-notifications.md),
[071](../../adr/071-unified-rate-limiting.md), [072](../../adr/072-distributed-cache.md) and
[073](../../adr/073-broadcasts-and-tenant-customers.md). Until it is built, the sections above
describe what runs today.

### What starts

`pnpm docker:up` keeps starting **everything** (you run it yourself before `pnpm run dev`), with two
exceptions behind Compose profiles:

| Profile | Service | Why opt-in |
| --- | --- | --- |
| `db` | `postgres` (replaces today's commented-out block) | A native PostgreSQL already owns 5432 and holds the dev database |
| `load` | `load-runner` | Builds an image; only needed for load tests |

`pnpm docker:down` keeps stopping every profile (`--profile "*"`).

### Changes

| # | Change | Why |
| --- | --- | --- |
| 1 | **Fix the misplaced comment**: the Mailpit description sits above `load-runner` | Reads as if the load runner were the inbox |
| 2 | **Drop every hard-coded `container_name`** and the fixed network name; Compose names them from the project name (`COMPOSE_PROJECT_NAME`, default `hello-world`), e.g. `hello-world-redis-1` | A fork and the starter kit can run side by side |
| 3 | **`postgres` becomes a real service in the `db` profile** (`postgres:18.6`, as CI) | No commenting and uncommenting |
| 4 | **Add `object-storage`: SeaweedFS** (`weed server -s3`) plus a one-shot `object-storage-init` container that creates the bucket and exits | Lets the S3 adapter (multipart, presigned URLs) run locally. MinIO Community Edition stopped publishing images in October 2025 and its repository has been archived since 2026 |
| 5 | **Add the tool UIs**: Kafka UI and Redis Insight beside Bull Board | Inspect topics and keys without the CLI |
| 6 | **Redis: explicit `maxmemory` and `maxmemory-policy noeviction`** (one Redis for queues and cache, [ADR 072](../../adr/072-distributed-cache.md)) | An evicted BullMQ key is a lost job; today Redis has no limit at all |
| 7 | **One `x-defaults` block** merged into every service: `restart: unless-stopped`, the shared network, `init: true`, `security_opt: [no-new-privileges:true]`, json-file logs rotated at 10 MB × 3 | Same behaviour everywhere, bounded disk use |
| 8 | **Memory limits**: Kafka heap 512 MB (`KAFKA_HEAP_OPTS`), RabbitMQ memory watermark, a `mem_limit` per service | Keeps a laptop usable |
| 9 | **A healthcheck on every service**, including Bull Board, the tool UIs, SeaweedFS and the load runner; every `depends_on` waits for `service_healthy` (the init container for `service_completed_successfully`) | `docker:up` means ready, not just started |
| 10 | **Bull Board reads `BULLMQ_PREFIX`** instead of a fixed `bull` | Today a changed prefix shows empty queues |
| 11 | New queues from ADRs 070 and 073 (`notifications.fan-out`, `notifications.push`, `notifications.sms`, and the digest, broadcast and retention queues) added to Bull Board's list | Kept in step by the drift test below |

### One naming table, enforced

This document will hold **one table of every name**, and a tooling test checks the files against it
so nothing drifts:

| Kind | Rule | Checked in |
| --- | --- | --- |
| Compose service | Same name as the dependency in Operations: `postgres`, `redis`, `kafka`, `rabbitmq`, `mailpit`, `object-storage`, `bull-board`, `kafka-ui`, `redis-insight`, `load-runner` | `compose.yml`, the Operations dependency list |
| Env var | `<SERVICE>_<THING>` (`REDIS_PORT`, `MAILPIT_UI_PORT`, `OBJECT_STORAGE_S3_PORT`) | `compose.yml`, `.env.example` files, this document |
| Queue | `<context>.<job>` | `ALL_QUEUE_NAMES`, Bull Board's `QUEUE_NAMES`, the docs |
| Image tag | Identical in `compose.yml` and every CI service container | `compose.yml`, `.github/workflows/*.yml` (today's "Keep in step" comments become enforced) |
| Volume | `<service>[_<major>]_data` | `compose.yml` |

### Decisions

| # | Question | Answer |
| --- | --- | --- |
| Q22, Q22b | What `docker:up` starts | Everything, except PostgreSQL (`db`) and the load runner (`load`) |
| Q23 | Container names | Dropped; the project name names them |
| Q24, Q24b | Drift guards and naming | One naming table here; a test checks every file against it |
| Q25 | Laptop hygiene | Shared defaults, memory limits, healthchecks everywhere, Redis memory settings |
| Q26, Q56 | Local object storage | SeaweedFS with a one-shot init container that creates the bucket |
