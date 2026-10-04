---
title: "Local Infrastructure (Docker Compose)"
tags: ["operations", "docker", "postgres", "local-development"]
description: "Every service in compose.yml, its ports and dev credentials, how to override them, and how to fix common start-up problems."
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 3
---

# Local Infrastructure (Docker Compose)

`compose.yml` at the repository root starts everything the apps talk to locally. It is
**development-only**: default passwords are public, and nothing in it is meant for a server.

```bash
pnpm docker:up       # docker compose up -d
pnpm docker:ps       # status + health
pnpm docker:logs     # follow logs
pnpm docker:down     # stop and remove containers (data volumes are kept)
```

## Services

| Service | Image | Host address | Dev credentials | Used by |
| --- | --- | --- | --- | --- |
| `redis` | `redis:8.10.1` | `localhost:6379` | none | caches, BullMQ |
| `kafka` | `apache/kafka:4.3.1` | `127.0.0.1:9092` (use the IPv4 literal, not `localhost`) | none | analytics events |
| `rabbitmq` | `rabbitmq:4.3.5` | `localhost:5672`, UI `http://localhost:15672` | `rabbit` / `rabbit` | messaging |
| `bull-board` | `venatum/bull-board:3.4.14` | `http://localhost:3030` | none | BullMQ dashboard |
| `mailpit` | `axllent/mailpit:v1.31.3` | SMTP `localhost:1025`, inbox `http://localhost:8025` | any SMTP login is accepted | local email sink |

**PostgreSQL is not started by default.** The `postgres` service (`postgres:18.6`, the same image
CI uses) is commented out in `compose.yml`; use a native PostgreSQL 18 (Homebrew, apt, Postgres.app)
or uncomment the service. Its defaults (`postgres` / `postgres`, database
`nestjs-nextjs-turborepo-starter-kit`, port 5432) match `DATABASE_URL` in `apps/api/.env.example`.
There is no MinIO service either: use `STORAGE_PROVIDER=local` for zero-setup storage, or a real
bucket ([AWS S3](../storage/aws-s3.md) / [Firebase](../storage/firebase.md)).

Every service binds to `127.0.0.1` only, so the default passwords are not reachable from other
machines on your network.

> [!NOTE] Mailpit is provisioned ahead of an SMTP email adapter: today the API sends through
> Resend, so locally use `EMAIL_MODE=log-only` (emails printed to the API log) or `noop`.

## Overriding ports and credentials

The newer services read these variables (shell environment, or a git-ignored `.env` file next to
`compose.yml`). Defaults are shown.

| Variable | Default | Notes |
| --- | --- | --- |
| `MAILPIT_SMTP_PORT` / `MAILPIT_UI_PORT` | `1025` / `8025` | host ports |
| `REDIS_PORT` / `KAFKA_PORT` | `6379` / `9092` | host ports (Kafka advertises `127.0.0.1:${KAFKA_PORT}`, so changing `KAFKA_PORT` only needs the same port in `KAFKA_BROKERS`) |
| `RABBITMQ_AMQP_PORT` / `RABBITMQ_UI_PORT` / `BULL_BOARD_PORT` | `5672` / `15672` / `3030` | host ports |
| `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` | `rabbit` / `rabbit` | applied only when the volume is first created |

If you uncomment the `postgres` service, it also reads `POSTGRES_PORT` (5432), `POSTGRES_USER` /
`POSTGRES_PASSWORD` (`postgres` / `postgres`) and `POSTGRES_DB`; the credentials apply only when
its volume is first created.

## Bootstrapping the database

```bash
pnpm docker:up
cp apps/api/.env.example apps/api/.env      # if you have not already
pnpm db:deploy                               # migrations + RLS (db:apply-security)
pnpm db:seed                                 # development scenario — see Database → Seed data
```

### Fresh clusters and the `app_runtime` role

The API reaches tenant data through the `app_runtime` role (`SET ROLE`), which is subject to RLS.
`pnpm db:apply-security` creates it in `prisma/rls/00-app-helpers.sql`, the first file it applies,
so a brand-new cluster needs no manual bootstrap. The apply plan
(`apps/api/scripts/rls-apply-plan.ts`) refuses to run if any file uses a role before the file that
creates it, so this can't regress unnoticed on long-lived dev clusters, where roles already exist
cluster-wide.

## Bring-up order (API + analytics consumer)

Kafka does not auto-create topics (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=false` here and in CI; the
producer and consumer also set `allowAutoTopicCreation: false`), so the topics must be provisioned
before anything publishes or consumes. On a fresh machine, in this order:

1. `pnpm docker:up` — Kafka and the other services (PostgreSQL running natively or via the uncommented service).
2. `pnpm db:deploy` — migrations + RLS; this also creates the `analytics_consumer` role.
3. `cp apps/analytics-consumer/.env.example apps/analytics-consumer/.env` and fill in the consumer's own login.
4. `pnpm --filter @workspace/analytics-consumer db:provision-login` — creates that least-privilege login.
5. `pnpm --filter @workspace/analytics-consumer kafka:provision-topics` — creates the topics explicitly.
6. `pnpm dev:analytics-consumer` (and `pnpm dev:api`).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `ports are not available … 127.0.0.1:5432` | A native PostgreSQL (Homebrew, Postgres.app) is listening. Stop it, or start with `POSTGRES_PORT=5433` and update `DATABASE_URL`. (Only relevant if you uncommented the `postgres` service.) |
| API / consumer log `kafka.client_log` `Connect to ipv6#[::1]:9092 failed: Connection refused`, then `all broker connections are down` | `KAFKA_BROKERS=localhost:9092` (an old `.env`) or a Kafka container created before the broker advertised `127.0.0.1`: `localhost` resolves to `::1` first, and the broker only listens on IPv4. Set `KAFKA_BROKERS=127.0.0.1:9092` in `apps/api/.env` and `apps/analytics-consumer/.env`, then `docker compose up -d kafka` to recreate the broker with the current advertised listener. A broker that is really down logs its connection error once, then one line with `repeatCount` per minute — not one line per retry. |
| Changed `POSTGRES_*` values are ignored | They only apply when the volume is created. Recreate it: `docker compose down` then `docker volume rm hello-world_postgres_18_data` (**deletes the local database**). |
| `role "app_runtime" does not exist` during `db:deploy` | The cluster was initialised without the init script — see [the fresh-cluster note](#fresh-clusters-and-the-app_runtime-role). |

The Postgres volume name carries the major version (`postgres_18_data`): a major upgrade needs a
dump/restore, and a versioned volume can never be started against data files from an older major.
