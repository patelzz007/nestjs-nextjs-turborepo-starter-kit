---
title: "Local Infrastructure (Docker Compose)"
tags: ["operations", "docker", "postgres", "local-development"]
description: "Every service in compose.yml, its ports and dev credentials, how to override them, and how to fix common start-up problems."
author: "Platform Team"
lastUpdated: 1790812800000
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
| `postgres` | `postgres:18.6` | `localhost:5432` | `postgres` / `postgres`, database `nestjs-nextjs-turborepo-starter-kit` | API (`DATABASE_URL`) |
| `redis` | `redis:8.10.1` | `localhost:6379` | none | caches, BullMQ |
| `kafka` | `apache/kafka:4.3.1` | `localhost:9092` | none | analytics events |
| `rabbitmq` | `rabbitmq:4.3.5` | `localhost:5672`, UI `http://localhost:15672` | `rabbit` / `rabbit` | messaging |
| `bull-board` | `venatum/bull-board` | `http://localhost:3030` | none | BullMQ dashboard |
| `mailpit` | `axllent/mailpit:v1.31.3` | SMTP `localhost:1025`, inbox `http://localhost:8025` | any SMTP login is accepted | local email sink |
| `minio` | `pgsty/minio` | S3 API `http://localhost:9000`, console `http://localhost:9001` | `minioadmin` / `minioadmin` | S3-compatible storage |
| `minio-init` | `pgsty/mc` | — (one-shot) | — | creates the buckets, then exits |

The Postgres default matches `DATABASE_URL` in `apps/api/.env.example`, so a fresh
`cp apps/api/.env.example apps/api/.env` works against the Docker database as-is.

`postgres`, `mailpit`, and `minio` bind to `127.0.0.1` only, so their default passwords are not
reachable from other machines on your network.

### Buckets created by `minio-init`

| Bucket | Access | Matches |
| --- | --- | --- |
| `local-private-bucket` | private | the API's default private container (`STORAGE_PRIVATE_CONTAINER` fallback) |
| `local-public-bucket` | anonymous **read of objects** (no listing) | the API's default public container (`STORAGE_PUBLIC_CONTAINER` fallback) |

> [!NOTE] Mailpit and MinIO are provisioned ahead of the application adapters that will use them.
> Today the API sends email through Resend (set `EMAIL_MODE=log-only` or `noop` locally) and its S3
> adapter targets AWS without a custom endpoint, so point the API at MinIO/Mailpit once the SMTP
> email adapter and S3 endpoint support land (see the platform roadmap). Until then
> `STORAGE_PROVIDER=local` remains the zero-setup storage option.

Upstream MinIO stopped publishing container images in late 2025 (`minio/minio` and
`quay.io/minio/minio` are no longer available), so the stack uses `pgsty/minio` / `pgsty/mc`, the
maintained community builds of the same server and client, pinned to release tags.

## Overriding ports and credentials

The newer services read these variables (shell environment, or a git-ignored `.env` file next to
`compose.yml`). Defaults are shown.

| Variable | Default | Notes |
| --- | --- | --- |
| `POSTGRES_PORT` | `5432` | host port |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `postgres` / `postgres` | applied only when the volume is first created |
| `POSTGRES_DB` | `nestjs-nextjs-turborepo-starter-kit` | applied only when the volume is first created |
| `MAILPIT_SMTP_PORT` / `MAILPIT_UI_PORT` | `1025` / `8025` | host ports |
| `MINIO_API_PORT` / `MINIO_CONSOLE_PORT` | `9000` / `9001` | host ports |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `minioadmin` / `minioadmin` | password must be ≥ 8 characters |
| `MINIO_PRIVATE_BUCKET` / `MINIO_PUBLIC_BUCKET` | `local-private-bucket` / `local-public-bucket` | buckets created by `minio-init` |

Example — a native PostgreSQL already owns 5432 and something else owns 9000:

```bash
POSTGRES_PORT=5433 MINIO_API_PORT=9100 MINIO_CONSOLE_PORT=9101 pnpm docker:up
# then use localhost:5433 in apps/api/.env → DATABASE_URL
```

## Bootstrapping the database

```bash
pnpm docker:up
cp apps/api/.env.example apps/api/.env      # if you have not already
pnpm db:deploy                               # migrations + RLS (db:apply-security)
pnpm db:seed                                 # development scenario — see Getting Started §7
```

### Fresh clusters and the `app_runtime` role

The API reaches tenant data through the `app_runtime` role (`SET ROLE`), which is subject to RLS.
`pnpm db:apply-security` creates it in `prisma/rls/00-app-helpers.sql`, the first file it applies,
so a brand-new cluster needs no manual bootstrap. The apply plan
(`apps/api/scripts/rls-apply-plan.ts`) refuses to run if any file uses a role before the file that
creates it, so this can't regress unnoticed on long-lived dev clusters, where roles already exist
cluster-wide.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `ports are not available … 127.0.0.1:5432` | A native PostgreSQL (Homebrew, Postgres.app) is listening. Stop it, or start with `POSTGRES_PORT=5433` and update `DATABASE_URL`. You can also start only the other services: `docker compose up -d redis kafka rabbitmq bull-board mailpit minio minio-init`. |
| `ports are not available … 127.0.0.1:9000` | Another tool (php-fpm, Portainer, SonarQube…) owns 9000. Use `MINIO_API_PORT` / `MINIO_CONSOLE_PORT`. |
| Changed `POSTGRES_*` values are ignored | They only apply when the volume is created. Recreate it: `docker compose down` then `docker volume rm hello-world_postgres_18_data` (**deletes the local database**). |
| `role "app_runtime" does not exist` during `db:deploy` | The cluster was initialised without the init script — see [the fresh-cluster note](#fresh-clusters-and-the-app_runtime-role). |
| `minio-init` shows `Exited (0)` | Expected — it is a one-shot job. `Exited (1)` means MinIO was unreachable; check `docker compose logs minio minio-init`. |

The Postgres volume name carries the major version (`postgres_18_data`): a major upgrade needs a
dump/restore, and a versioned volume can never be started against data files from an older major.
