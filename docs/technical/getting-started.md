---
title: "Getting started"
description: "From git clone to a running stack: prerequisites, environment files, database, seed, dev servers, demo accounts and the completion gate."
order: 2
author: "Platform Team"
lastUpdated: 1791072000000
coverImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=630&fit=crop"
tags: ["getting-started", "setup", "local-development"]
---

# Getting started

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 22.12 (CI uses the 24 LTS line) | `engines` in the root `package.json` |
| pnpm | 12 (`packageManager: pnpm@12.9.1`) | `corepack enable` picks the pinned version |
| PostgreSQL | 18 | Your own install (Homebrew, apt, Postgres.app …). The `postgres` service in `compose.yml` is commented out. |
| Docker | any recent | For Redis, Kafka, RabbitMQ, Bull Board and Mailpit (`pnpm docker:up`) |

Redis is optional in development (queues then run inline) but **required in production**. Kafka
is optional (`KAFKA_BROKERS` unset = the outbox keeps events pending).

## 2. Install and configure

```bash
pnpm setup                                   # pnpm install + build @workspace/shared

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/merchant/.env.example apps/merchant/.env
pnpm secrets:generate apps/api/.env          # fills every app-owned secret (JWT, MFA, KEK, …)
```

Then edit `apps/api/.env`:

- `DATABASE_URL` — your PostgreSQL database (create it first, e.g. `createdb nestjs-nextjs-turborepo-starter-kit`).
- `EMAIL_MODE=log-only` (the example default) prints emails into the API log; switch to `send`
  after [setting up Resend](./email/resend-setup.md).
- `STORAGE_PROVIDER` unset or `local` keeps uploads in `apps/api/.object-storage/`; see
  [AWS S3](./storage/aws-s3.md) / [Firebase](./storage/firebase.md) for cloud storage.
- `MALWARE_SCANNER=none` is required and has no default.

Every variable, its default and its cross-field rules: [API configuration](./configuration/api.md)
and [frontend configuration](./configuration/frontend.md). The API refuses to start and lists every
invalid variable by name if anything is wrong.

## 3. Local services and database

```bash
pnpm docker:up        # Redis :6379, Kafka :9092, RabbitMQ :5672 (UI :15672), Bull Board :3030, Mailpit :8025
pnpm setup:db         # build shared → prisma generate → migrate deploy → RLS policies → development seed
```

`pnpm setup:db` is safe to repeat: the seed converges instead of duplicating. Other datasets:
`pnpm db:seed -- --scenario empty` (permissions and roles only) and
`pnpm db:seed -- --scenario enterprise --seed 123` (one large tenant, deterministic). Details:
[Database](./database.md) and [Local infrastructure](./operations/local-infrastructure.md).

## 4. Run

```bash
pnpm dev              # api :8080, web :3000, admin :3001, docs :3002, merchant :3003
pnpm dev:api          # or one app at a time: dev:web, dev:admin, dev:merchant
pnpm kill:all         # free the ports if a previous run is stuck
```

| What | URL |
| --- | --- |
| API | `http://localhost:8080` (routes under `/api/v1`, health under `/health`) |
| Swagger UI | `http://localhost:8080/v1/docs` (JSON: `/v1/docs-json`) |
| Web / Admin / Merchant | `http://localhost:3000` / `:3001` / `:3003` |
| Docs site | `http://localhost:3002` |
| Mailpit / Bull Board | `http://localhost:8025` / `http://localhost:3030` |

In development, each app's login page lists the seeded demo accounts as one-click buttons.
Outside `NODE_ENV=development` they are never shown and there is no flag to turn them on
(policy: `packages/client/src/lib/auth/forms/demo-accounts-policy.ts`; per-app server-only lists
in `apps/*/lib/auth/demo-account-list.ts`). The seed prints every login; the main ones are listed
in the [user guide](../user-guide/README.md#try-it-with-the-demo-data).

Optional analytics consumer (Kafka → `analytics_events`): copy
`apps/analytics-consumer/.env.example`, then
`pnpm --filter @workspace/analytics-consumer db:provision-login`,
`pnpm --filter @workspace/analytics-consumer kafka:provision-topics` and
`pnpm dev:analytics-consumer` ([Messaging](./messaging.md)).

## 5. Before you call a task done

```bash
pnpm run lint     # zero errors and zero warnings
pnpm run test     # every test passes
```

Run both after your last change; also `pnpm run typecheck` when you touch `packages/shared` or the
Prisma schema. `pnpm ci:local` runs the whole CI pipeline locally against throwaway databases
([CI](./operations/ci.md)). The rules behind this gate are in [`AGENTS.md`](../../AGENTS.md).

## 6. First run in production (the seed never runs)

A deployed database must not be seeded, so there is no demo SuperAdmin. After `pnpm db:deploy`
(migrations + RLS), load the platform roles and permissions (idempotent, no users or demo data, safe on
every deploy), then create the first operator once:

```bash
pnpm --filter @workspace/api db:sync-reference-data
pnpm --filter @workspace/api admin:bootstrap-superadmin -- --email ops@example.com --full-name "Platform Operator"
```

The password comes from a no-echo prompt (or `--password-stdin`), never from arguments or the environment,
and must satisfy the signup password policy. The command refuses if an active SuperAdmin already exists, so
it is safe to leave in a runbook. Log in, enrol two-factor authentication (it is required on first login),
then create named staff. Guarantees, audit rows and exit codes: [Bootstrap the first SuperAdmin](./operations/superadmin-bootstrap.md).

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| API exits listing `DEFAULT_ORGANIZATION_ID`, `MALWARE_SCANNER`, a secret … | Fill in the named variables; `pnpm secrets:generate apps/api/.env` for secrets. Single-tenant mode needs `DEFAULT_ORGANIZATION_ID` to be a real organization (the seed creates Brew & Bean KL). |
| `Refusing to seed` | The seed only runs against a local database with `NODE_ENV` development/test (or `--allow-destructive`). |
| `EADDRINUSE :8080` | `pnpm kill:all` |
| Logins return `RATE_LIMITED` | 5 attempts per minute per IP on login; wait, or raise `THROTTLE_*` locally. |
| Login works but every page says verify your email | Seed customer accounts are unverified; use the link from the API log (`EMAIL_MODE=log-only`) or Mailpit. |
| Uploads fail with `NoSuchBucket` / CORS errors | Use `STORAGE_PROVIDER=local` offline, or follow [AWS S3](./storage/aws-s3.md#troubleshooting). |
| `permission denied for schema public` (`42501` / `P2039`) | The security layer is missing after a bare `prisma migrate reset`: `pnpm db:apply-security`, or use `pnpm db:reset` ([Database security](./security/database-security.md#how-the-api-connects)). |
| Prisma client does not know a new field | `pnpm db:generate` (or `pnpm db:migrate`, which regenerates), then restart the TypeScript server. |
| `ESLint couldn't find an eslint.config.js file` | There is no root ESLint config: run `pnpm run lint` from the root, or `pnpm exec eslint .` inside a workspace ([ESLint](./tooling/eslint.md)). |
| Signed in on web but "not authenticated" on admin, or a customer cannot sign in to admin | By design: each app has its own cookies, and the admin login only accepts staff with admin-panel access ([Authentication](./security/authentication.md#sessions)). |
| Kafka shown unhealthy at boot | Expected until the producer connects; `KAFKA_BROKERS=127.0.0.1:9092` with `pnpm docker:up`. Unset it to run without Kafka. |
