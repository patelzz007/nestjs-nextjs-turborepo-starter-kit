---
title: "Getting started"
description: "From git clone to every app running, step by step: tools, PostgreSQL (native or Docker), every environment file including the mobile app's, the phone's API address, the database, the dev servers and a first sign-in."
order: 2
author: "Platform Team"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=630&fit=crop"
tags: ["getting-started", "setup", "local-development"]
---

# Getting started

Follow the steps in order on a fresh clone. Each one ends with a check, so you know it worked before
you move on. Commands run from the repository root unless a step says otherwise.

## 1. Install the tools

| Tool | Version | Install | Check |
| --- | --- | --- | --- |
| Node.js | 24.22.1 (`.nvmrc`) | `nvm install && nvm use` | `node -v` prints `v24.22.1` |
| pnpm | 12 (pinned in `packageManager`) | `corepack enable` | `pnpm -v` prints `12.x` |
| Docker | any recent | Docker Desktop, OrbStack or Colima (runs Redis, Kafka, RabbitMQ, Bull Board and the Mailpit email inbox) | `docker compose version` |
| PostgreSQL | 18 | native, **or** Docker — step 2 decides | step 2 |
| Expo Go (phone, optional) | the store's current build | App Store / Google Play | for the mobile app only (step 8) |

```bash
git clone <your fork> && cd nestjs-nextjs-turborepo-starter-kit
pnpm setup                  # pnpm install + build @workspace/shared
```

## 2. PostgreSQL: use yours, or start one in Docker

First see whether a PostgreSQL server is already running on this machine:

```bash
pg_isready -h 127.0.0.1 -p 5432
```

| What it prints | Meaning | What to do |
| --- | --- | --- |
| `127.0.0.1:5432 - accepting connections` | A native PostgreSQL is running | Use it. Create the database: `createdb nestjs-nextjs-turborepo-starter-kit` |
| `no response` | Nothing listens on 5432 | Start the one you installed (`brew services start postgresql@18`), or use Docker (below) |
| `command not found: pg_isready` | No PostgreSQL client installed | Use Docker (below), or install PostgreSQL 18 natively |

**No PostgreSQL? Run it in Docker.** The `postgres` service in `compose.yml` is commented out, so that
it never fights a native install for port 5432. To use it, open `compose.yml` and uncomment the whole
`postgres:` block under `services:` (every line from `# postgres:` down to its `#     - infra`; the
`postgres_18_data` volume at the bottom is already declared). Then:

```bash
docker compose up -d postgres
docker compose exec postgres pg_isready     # "accepting connections"
```

It creates the user `postgres` / `postgres` and the database `nestjs-nextjs-turborepo-starter-kit`, which is
exactly the default `DATABASE_URL` in `apps/api/.env.example`, so there is nothing to change. If a native
PostgreSQL already owns 5432, start the container on another port with
`POSTGRES_PORT=5433 docker compose up -d postgres` and use `:5433` in `DATABASE_URL` (step 3).

The API must reach PostgreSQL as a superuser-capable owner the first time: `pnpm setup:db` (step 5)
creates the `app_runtime` role and the row-level security policies the API runs under.

## 3. The environment files: one per app

Every app reads its own `.env`, and each has a commented `.env.example` beside it. Copy all five:

```bash
cp apps/api/.env.example      apps/api/.env
cp apps/web/.env.example      apps/web/.env
cp apps/admin/.env.example    apps/admin/.env
cp apps/merchant/.env.example apps/merchant/.env
cp apps/mobile/.env.example   apps/mobile/.env
pnpm tools secrets:generate apps/api/.env       # fills every app-owned secret (JWT, MFA, KEK, …)
```

Then open `apps/api/.env` and check:

- `DATABASE_URL`: your database from step 2 (the default matches both the native and the Docker setup).
- `EMAIL_MODE=send` with `EMAIL_PROVIDER=mailpit` (the defaults) delivers every email into the local
  Mailpit inbox. Switch to `EMAIL_PROVIDER=resend` after [setting up Resend](./email/resend-setup.md) to
  receive real emails.
- `STORAGE_PROVIDER` unset or `local` keeps uploads in `apps/api/.object-storage/`; see
  [AWS S3](./storage/aws-s3.md) or [Firebase](./storage/firebase.md) for cloud storage.
- `MALWARE_SCANNER=none` is required and has no default.

The web, admin and merchant examples already point at `http://localhost:8080`; they need no edits. The
mobile app's `.env` needs this machine's network address, which is the next step.

Every variable, its default and its cross-field rules: [API configuration](./configuration/api.md) and
[frontend configuration](./configuration/frontend.md). The API refuses to start, and names every invalid
variable, if anything is wrong.

## 4. The API address a phone can reach

A phone cannot use `localhost`: on the phone, that is the phone. It reaches the API at this machine's
address on your Wi-Fi. Find it:

```bash
ipconfig getifaddr en0        # macOS, Wi-Fi (try en1 when it prints nothing)
hostname -I | awk '{print $1}' # Linux
ipconfig                      # Windows: the "IPv4 Address" of your Wi-Fi adapter
```

Say it prints `192.168.1.23`. Then:

1. In **`apps/mobile/.env`**, set the API URL to that address and the API's port:

   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.23:8080
   ```

   On macOS you can write it in one go:
   `sed -i '' "s|^#* *EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):8080|" apps/mobile/.env`

2. In **`apps/api/.env`**, let the API accept connections from the network: `HOST=0.0.0.0`. The default,
   `127.0.0.1`, only answers this machine, so the phone's requests would be refused. Pictures and file
   links then use the same LAN address automatically (set `API_PUBLIC_URL` only behind a proxy or tunnel).
   This exposes the development API to your local network, so use a network you trust.

The address can change when you switch networks or your router hands out a new one. When the app on
the phone says it cannot reach the server, run `ipconfig getifaddr en0` again, update
`EXPO_PUBLIC_API_URL`, and restart Expo (`EXPO_PUBLIC_*` values are baked in when the bundle builds).

You can skip this step if you won't run the mobile app: the browser apps all use `localhost`.

## 5. Local services and the database

```bash
pnpm docker:up        # Redis :6379, Kafka :9092, RabbitMQ :5672 (UI :15672), Bull Board :3030, Mailpit :8025
pnpm setup:db         # build shared → prisma generate → migrate deploy → RLS policies → development seed
```

Check: `pnpm setup:db` ends by printing the seeded demo accounts. It is safe to repeat: the seed converges
instead of duplicating. Other datasets: `pnpm db:seed -- --scenario empty` (permissions and roles only)
and `pnpm db:seed -- --scenario enterprise --seed 123` (one large tenant, deterministic). Details:
[Database](./database.md) and [Local infrastructure](./operations/local-infrastructure.md).

Redis is optional in development (queues then run inline) but **required in production**. Kafka is
optional (`KAFKA_BROKERS` unset means the outbox keeps events pending).

## 6. Run the apps

```bash
pnpm dev              # api :8080, web :3000, admin :3001, docs :3002, merchant :3003
pnpm dev:api          # or one app at a time: dev:web, dev:admin, dev:merchant, dev:mobile
pnpm kill:all         # free the ports if a previous run is stuck
```

| What | URL |
| --- | --- |
| API | `http://localhost:8080` (routes under `/api/v1`, health under `/health`) |
| Swagger UI | `http://localhost:8080/v1/docs` (JSON: `/v1/docs-json`) |
| Web (customers) | `http://localhost:3000` |
| Admin (platform staff) | `http://localhost:3001` |
| Merchant console | `http://localhost:3003` |
| Docs site | `http://localhost:3002` |
| Mailpit / Bull Board | `http://localhost:8025` / `http://localhost:3030` |

Check: `curl -s http://localhost:8080/health` answers, and each app's login page opens.

## 7. Sign in

In development each login page lists the seeded demo accounts as one-click buttons. The main ones:

| App | Email | Password |
| --- | --- | --- |
| Admin | `superadmin@example.com` | `SuperAdmin@123` |
| Merchant | `brew.owner@kl-rewards.demo` | `BrewOwner@123` |

Sign-in codes and verification links arrive in Mailpit, never in a real inbox. Read them from the
terminal instead of opening the inbox:

```bash
pnpm mail:latest --to superadmin@example.com --code   # just the six-digit code
pnpm mail:latest --to superadmin@example.com          # recipient, subject, codes, links and body
```

The demo buttons never appear outside `NODE_ENV=development`, and there is no flag to turn them on
(policy: `packages/client/src/lib/contexts/identity/forms/demo-accounts-policy.ts`). The seed prints every
login; more are listed in the [user guide](../user-guide/README.md#try-it-with-the-demo-data).

## 8. The mobile app (Expo Go)

One-time: create a free account at expo.dev, sign in to **Expo Go** on the phone with it, and run
`npx expo login` in `apps/mobile`. Put the phone on the same Wi-Fi as this machine. Step 4 must be done.

```bash
pnpm dev:api          # the API, listening on 0.0.0.0:8080 (step 4)
pnpm dev:mobile       # Expo / Metro, in a second terminal
```

Scan the QR code Expo prints: with the **Camera** app on iPhone, with **Expo Go** on Android. Check: the
sign-in screen appears and the demo accounts sign in. A configuration error screen names the variable
that is wrong in `apps/mobile/.env`. More, including the simulators and `--tunnel`:
[`apps/mobile/README.md`](../../apps/mobile/README.md) and [the mobile app](./mobile/mobile-app.md).

Optional analytics consumer (Kafka → `AnalyticsEvent`): copy `apps/analytics-consumer/.env.example`,
then `pnpm --filter @workspace/analytics-consumer db:provision-login`,
`pnpm --filter @workspace/analytics-consumer kafka:provision-topics` and
`pnpm tools dev:analytics-consumer` ([Messaging](./messaging.md)).

## 9. Before you call a task done

```bash
pnpm run lint     # zero errors
pnpm run test     # every test passes
```

Run both after your last change; also `pnpm run typecheck` when you touch `packages/shared` or the
Prisma schema. `pnpm ci:local` runs the whole CI pipeline locally against throwaway databases
([CI](./operations/ci.md)). The rules behind this gate are in [`AGENTS.md`](../../AGENTS.md).

## 10. First run in production (the seed never runs)

A deployed database must not be seeded, so there is no demo SuperAdmin. After `pnpm tools db:deploy`
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

## 11. Troubleshooting

| Symptom | Fix |
| --- | --- |
| API exits listing `DEFAULT_TENANT_ID`, `MALWARE_SCANNER`, a secret … | Fill in the named variables; `pnpm tools secrets:generate apps/api/.env` for secrets. Single-tenant mode needs `DEFAULT_TENANT_ID` to be a real tenant (the seed creates Brew & Bean KL); multi-tenant mode needs it unset. |
| `Refusing to seed` | The seed only runs against a local database with `NODE_ENV` development/test (or `--allow-destructive`). |
| `EADDRINUSE :8080` | `pnpm kill:all` |
| Logins return `RATE_LIMITED` | 5 attempts per minute per IP on login; wait, or raise `THROTTLE_*` locally. |
| Login works but every page says verify your email | Seed customer accounts are unverified; open the link from Mailpit (`pnpm mail:latest --to <email>`). |
| A sign-in code never arrives | With `EMAIL_PROVIDER=mailpit`, the Mailpit container must be running (`pnpm docker:up`, or `pnpm mailpit` alone); read the code with `pnpm mail:latest --to <email> --code`. |
| Uploads fail with `NoSuchBucket` / CORS errors | Use `STORAGE_PROVIDER=local` offline, or follow [AWS S3](./storage/aws-s3.md#troubleshooting). |
| `permission denied for schema public` (`42501` / `P2039`) | The security layer is missing after a bare `prisma migrate reset`: `pnpm tools db:apply-security`, or use `pnpm db:reset` ([Database security](./security/database-security.md#how-the-api-connects)). |
| Prisma client does not know a new field | `pnpm db:generate` (or `pnpm db:migrate`, which regenerates), then restart the TypeScript server. |
| `oxlint` lints nothing / finds no config from the repo root | There is no root lint config: run `pnpm run lint` from the root, or `pnpm exec oxlint` inside a workspace ([Oxlint](./tooling/oxlint.md)). |
| Signed in on web but "not authenticated" on admin, or a customer cannot sign in to admin | By design: each app has its own cookies, and the admin login only accepts staff with admin-panel access ([Authentication](./security/authentication.md#sessions)). |
| `pg_isready` says `no response`, or `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running: start yours, or uncomment the Docker service (step 2). |
| `database "nestjs-nextjs-turborepo-starter-kit" does not exist` | `createdb nestjs-nextjs-turborepo-starter-kit` (native), or let the Docker service create it on its first start. |
| The phone says it cannot reach the server | `HOST=0.0.0.0` in `apps/api/.env` and restart the API; `EXPO_PUBLIC_API_URL` must be `http://$(ipconfig getifaddr en0):8080` for today's address; restart Expo after changing it; phone and machine on the same Wi-Fi. |
| `ipconfig getifaddr en0` prints nothing | You are on another interface (Ethernet, a second Wi-Fi card): try `en1`, or read it from System Settings → Network. |
| Kafka shown unhealthy at boot | Expected until the producer connects; `KAFKA_BROKERS=127.0.0.1:9092` with `pnpm docker:up`. Unset it to run without Kafka. |
