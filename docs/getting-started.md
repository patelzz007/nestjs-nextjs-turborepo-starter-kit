---
title: "Getting Started — A-to-Z Setup Guide"
tags: ["getting-started", "setup", "quickstart"]
description: "From an empty laptop to a running monorepo: prerequisites, env setup, database bootstrap, and all three apps."
order: 1
author: "Acme Inc."
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80"
---

# Getting Started — A-to-Z Setup Guide

> [!NOTE] This guide walks you through **everything**: from an empty laptop to a running
> monorepo with a database, seeded data, and all three apps on screen. It is written
> for a junior developer with ~6 months of experience — no assumed knowledge beyond
> the basics of TypeScript, React, and Node.
>
> **TL;DR (for people who know what they're doing):**
>
> ```bash
> git clone <repo-url> && cd hello-world
> pnpm install
> pnpm docker:up                                # Postgres, Redis, Kafka, RabbitMQ, Mailpit, MinIO
> # (or use your own PostgreSQL and create the database named in DATABASE_URL)
> cp apps/api/.env.example apps/api/.env        # fill in secrets
> cp apps/web/.env.example apps/web/.env
> cp apps/admin/.env.example apps/admin/.env
> cp apps/merchant/.env.example apps/merchant/.env
> pnpm db:all                                   # generate → deploy → seed (development scenario)
> pnpm dev                                      # web :3000, admin :3001, api :8080
> ```

---

## Table of Contents

1. [What you're building](#1-what-youre-building)
2. [Prerequisites — install these first](#2-prerequisites--install-these-first)
3. [Step 1 — Clone the repo](#3-step-1--clone-the-repo)
4. [Step 2 — Install dependencies](#4-step-2--install-dependencies)
5. [Step 3 — Start PostgreSQL & create the database](#5-step-3--start-postgresql--create-the-database)
6. [Step 4 — Configure environment variables](#6-step-4--configure-environment-variables)
7. [Step 5 — Bootstrap the database](#7-step-5--bootstrap-the-database)
8. [Step 6 — Run the dev servers](#8-step-6--run-the-dev-servers)
9. [Step 7 — Verify everything works](#9-step-7--verify-everything-works)
10. [Everyday commands cheat sheet](#10-everyday-commands-cheat-sheet)
11. [Best practices — Dos and Don'ts](#11-best-practices--dos-and-donts)
12. [Where does new code go?](#12-where-does-new-code-go)
13. [Troubleshooting](#13-troubleshooting)
14. [Common mistakes (FAQ)](#14-common-mistakes-faq)
15. [Further reading](#15-further-reading)

---

## 1. What you're building

This is a **monorepo** — multiple projects in one repository, sharing code. There are
three apps and six shared packages:

| Path                         | Package                        | What it is                                              | URL (local)           |
| ---------------------------- | ------------------------------ | ------------------------------------------------------- | --------------------- |
| `apps/web`                   | `@workspace/web`               | Customer-facing Next.js app (login, signup, hello page) | http://localhost:3000 |
| `apps/admin`                 | `@workspace/admin`             | Admin panel Next.js app (login, dashboard)              | http://localhost:3001 |
| `apps/api`                   | `@workspace/api`               | NestJS backend — auth, users, URLs, everything          | http://localhost:8080 |
| `packages/ui`                | `@workspace/ui`                | shadcn/ui components (**presentational only**)          | —                     |
| `packages/client`            | `@workspace/client`            | `AuthProvider`, `useApi` hook, typed endpoint registry  | —                     |
| `packages/shared`            | `@workspace/shared`            | Zod schemas + shared types (the API contract)           | —                     |
| `packages/tooling`           | `@workspace/tooling`           | Repo-wide scripts (syncpack dependency hygiene)         | —                     |
| `packages/eslint-config`     | `@workspace/eslint-config`     | Shared ESLint presets                                   | —                     |
| `packages/typescript-config` | `@workspace/typescript-config` | Shared tsconfig presets                                 | —                     |

**Swagger (API docs)** is served by the API at http://localhost:8080/v1/docs.
**Prisma Studio** (visual DB browser) runs at http://localhost:5555.

> [!NOTE] The key idea: `@workspace/shared` is the **single source of truth**. The API's
> request/response shapes are Zod schemas in `shared`, and both the backend (DTOs)
> and the frontends (typed hooks) derive their types from those schemas. See
> [architecture.md](./technical/architecture.md) for the full mental model.

---

## 2. Prerequisites — install these first

| Tool           | Version                         | Why you need it                                               | Check it's installed              |
| -------------- | ------------------------------- | ------------------------------------------------------------- | --------------------------------- |
| **Node.js**    | `>= 20.19` (CI runs the 24 LTS line) | Runs everything (Next.js, NestJS, Prisma)                | `node -v`                         |
| **pnpm**       | `12.6.0` (`packageManager` in `package.json`) | The package manager (faster than npm, enforces the workspace) | `pnpm -v`               |
| **PostgreSQL** | 18 recommended (Docker stack + CI use `postgres:18.6`) | The database                                   | `psql --version` and `pg_isready` |
| **Docker**     | any recent (optional)           | Runs the local stack in `compose.yml` (Postgres, Redis, …)    | `docker compose version`          |
| **git**        | any                             | Clone the repo                                                | `git --version`                   |

### Installing Node.js

Use the official installer, or a version manager (**recommended**):

```bash
# macOS (Homebrew)
brew install node

# OR use a version manager (recommended — lets you switch Node versions easily)
brew install nvm
nvm install 20
nvm use 20
```

### Installing pnpm

The repo pins its pnpm version (`packageManager: "pnpm@12.6.0"`). The cleanest way
to get it is **corepack** (ships with Node):

```bash
corepack enable
corepack prepare pnpm@12.6.0 --activate

# verify
pnpm -v    # should print 12.6.0
```

If you already have pnpm but a different version, install the repo's version once:

```bash
corepack use pnpm@12.6.0   # pins it for this folder
```

> [!WARNING] **Don't mix package managers.** Use `pnpm` only — never `npm install` or
> `yarn` in this repo. The lockfile (`pnpm-lock.yaml`) is pnpm-specific.

### Installing PostgreSQL

Pick **one** of these (all are fine):

```bash
# Option A — Homebrew (macOS)
brew install postgresql@18
brew services start postgresql@18

# Option B — Docker Compose (recommended: the whole local stack, any OS)
# From the repo root:
pnpm docker:up
# PostgreSQL: localhost:5432 — postgres / postgres, database nestjs-nextjs-turborepo-starter-kit
#             (matches DATABASE_URL in apps/api/.env.example; already has the app_runtime RLS role)
# Mailpit:  SMTP localhost:1025 — inbox at http://localhost:8025
# MinIO:    S3 API http://localhost:9000 — console at http://localhost:9001 (minioadmin/minioadmin)
# Redis:    localhost:6379
# Kafka:    127.0.0.1:9092 (IPv4 literal — `localhost` may resolve to ::1 first)
# RabbitMQ: localhost:5672 — management UI at http://localhost:15672 (rabbit/rabbit)
# BullMQ:   uses Redis; queue dashboard at http://localhost:3030
# Analytics consumer (optional): set apps/analytics-consumer/.env, then
#   pnpm --filter @workspace/analytics-consumer db:provision-login && \
#   pnpm --filter @workspace/analytics-consumer kafka:provision-topics && pnpm dev:analytics-consumer
# Messaging architecture: docs/infrastructure/messaging.md
# Ports, credentials, overrides (e.g. a native Postgres already on 5432):
#   docs/operations/local-infrastructure.md

# Option C — Postgres.app (macOS, GUI)
# Download from https://postgresapp.com and click "Start"
```

Verify it's running:

```bash
pg_isready -h localhost -p 5432    # should print "accepting connections"
```

---

## 3. Step 1 — Clone the repo

```bash
git clone <repo-url> hello-world
cd hello-world
```

> [!NOTE] The folder is currently named `hello-world` — rename it to your project if you like
> (e.g. `mv hello-world my-project && cd my-project`). The package name inside
> `package.json` (`"hello-world"`) can be changed too, but that's optional.

---

## 4. Step 2 — Install dependencies

```bash
pnpm install
```

What this does:

- Installs dependencies for **all** workspaces (`apps/*`, `packages/*`) in one pass.
- Creates the `node_modules` tree (pnpm uses hard links — it's fast and disk-friendly).
- Wires up the `workspace:*` packages so `@workspace/ui`, `@workspace/shared`, etc.
  resolve to each other.

> [!NOTE] No build step happens here — packages are built on demand by turbo when you run
> `pnpm dev` or `pnpm build` (the `dev`/`build` tasks depend on `^build`, so
> `@workspace/shared` compiles first).
>
> Native dependencies (`bcrypt`, `esbuild`) compile during install. On Windows you
> may need the Visual Studio Build Tools; on macOS, Xcode command-line tools. If
> the install fails on those packages, install the build tools and re-run.

---

## 5. Step 3 — Start PostgreSQL & create the database

Make sure Postgres is running (see [Prerequisites](#2-prerequisites--install-these-first)),
then create the database **`monorepo`**:

```bash
createdb monorepo
# or if you don't have the createdb CLI handy:
psql -U postgres -c "CREATE DATABASE monorepo;"
```

> [!WARNING] The seed and migrations **will not create the database for you** — it must
> exist before `pnpm db:all`. If you used the Docker Compose option above, the container
> already created `nestjs-nextjs-turborepo-starter-kit` (the name in `apps/api/.env.example`),
> so skip `createdb` and keep the example `DATABASE_URL`.

The default connection string this repo expects:

```env title=".env"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/monorepo?schema=public"
```

If your Postgres user/password differ, use your own credentials — you'll put this
string in `apps/api/.env` in the next step.

---

## 6. Step 4 — Configure environment variables

Environment files are **git-ignored** (`.gitignore` has `.env*`), so every developer
creates their own from the committed `.env.example` templates.

### The API (`apps/api/.env`)

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fill in the blanks. The API validates **every** variable
once at startup with one zod schema and refuses to boot — listing every missing
or invalid variable **by name, never printing a value** — until they are right.
Secrets have **no defaults** in any environment. The full reference (every
variable, default and rule) is [API Configuration](./technical/configuration/api.md); the
ones you must set are:

| Variable                       | Example                                                                | What it's for |
| ------------------------------ | ---------------------------------------------------------------------- | ------------- |
| `NODE_ENV`                     | `development`                                                          | **Required.** `development` / `test` / `production` |
| `APP_NAME`                     | `Freebuff API`                                                         | **Required.** Shown in emails and authenticator apps |
| `APP_URL`                      | `http://localhost:3000`                                                | **Required.** Web app base URL (email links) |
| `ADMIN_APP_URL`                | `http://localhost:3001`                                                | **Required.** Admin app base URL (email links) |
| `MERCHANT_APP_URL`             | `http://localhost:3003`                                                | **Required.** Merchant portal base URL (invite links) |
| `CORS_ORIGINS`                 | `http://localhost:3000,http://localhost:3001,http://localhost:3003`    | **Required.** Comma-separated frontend origins allowed to call the API |
| `DATABASE_URL`                 | `postgresql://postgres:postgres@localhost:5432/monorepo?schema=public` | **Required.** Postgres connection string |
| `JWT_ACCESS_SECRET`            | (`pnpm secrets:generate`)                                              | **Required secret** (≥ 32 chars). Signs access tokens |
| `JWT_REFRESH_SECRET`           | (`pnpm secrets:generate`)                                              | **Required secret**, must differ from the others. Signs refresh tokens |
| `EMAIL_VERIFICATION_SECRET`    | (`pnpm secrets:generate`)                                              | **Required secret.** Signs email-verification tokens |
| `TWO_FACTOR_PENDING_SECRET`    | (`pnpm secrets:generate`)                                              | **Required secret.** Signs short-lived 2FA login step tokens |
| `MFA_ENCRYPTION_KEYS`          | (`{"1":"<openssl rand -base64 32>"}`)                                  | **Required secret.** Versioned AES-256 keys (each base64 of exactly 32 bytes) for encrypted MFA secrets |
| `TENANT_ENCRYPTION_MASTER_KEY` | (`openssl rand -base64 32`)                                            | **Required secret, no fallback** — base64 of exactly 32 bytes; wraps each organization's data key |
| `EMAIL_FROM_ADDRESS`           | `noreply@example.com`                                                  | **Required.** "From" address for emails |
| `EMAIL_MODE`                   | `log-only`                                                             | `send` (default, needs `RESEND_API_KEY`), `log-only` or `noop` |
| `RESEND_API_KEY`               | `re_...`                                                               | **Required when `EMAIL_MODE=send`.** Sends transactional emails |
| `COOKIE_DOMAIN`                | `localhost`                                                            | Share auth cookies across localhost ports (API + apps) |
| `REDIS_URL`                    | `redis://localhost:6379`                                               | Optional locally, **required in production** (queues, distributed caches) |
| `SWAGGER_ENABLED`              | unset                                                                  | `0`/`false` hides the public `/v1/docs` (on by default in every environment) — see [API Routes](./technical/api/routes.md#9-api-docs-swagger) |
| `TENANCY_ENABLED`              | `false`                                                                | Multi-tenant RLS mode — see [ADR 007](./adr/007-tenancy-and-rls-bypass.md) |

Everything else (`PORT`, `HOST`, JWT expiries, bcrypt rounds, throttles, cache
sizes, storage, Kafka, Observe, …) has a documented default in
`apps/api/.env.example` and [API Configuration](./technical/configuration/api.md).

> [!NOTE] **CORS** (Cross-Origin Resource Sharing): the browser blocks a page on one
> origin (say `localhost:3000`) from calling an API on another origin unless
> the API explicitly allows it. That's what the comma-separated `CORS_ORIGINS`
> value above is for — add any frontend origin that should be allowed to call
> the API.

**Generate strong secrets** (rotates the app-owned signing secrets, **adds** a new 32-byte MFA key version — existing versions are kept so stored MFA secrets stay decryptable — and adds the tenant master key only if it is missing, in `apps/api/.env`):

```bash
pnpm secrets:generate apps/api/.env
```

Or generate one value at a time:

```bash
openssl rand -base64 128
```

### If you copied real secrets into `.env.example`

Tracked example files must contain **placeholders only**. If you ever pasted real JWT signing secrets or a Resend webhook secret into `apps/api/.env.example` (or copied that file into a deployed environment), rotate them immediately:

1. Generate new values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `EMAIL_VERIFICATION_SECRET`, and `TWO_FACTOR_PENDING_SECRET`, and a new `MFA_ENCRYPTION_KEYS` version (`pnpm secrets:generate apps/api/.env`). Rotate `RESEND_WEBHOOK_SECRET` in the Resend dashboard separately.
   The generator never removes an MFA key version: secrets stored under the leaked version still need it to decrypt. New MFA secrets use the new (highest) version; the leaked version can only be deleted once no stored MFA secret uses it (every affected user has re-enrolled). There is no automated re-encryption job yet.
2. Update the live environment variables (never commit the real values).
3. Restart the API so the new secrets load.
4. Expect every existing session to become invalid — users must sign in again.
5. Rotate the webhook signing secret in the Resend dashboard and update `RESEND_WEBHOOK_SECRET` on the server.

Run the repository secret scan locally before opening a PR:

```bash
pnpm secrets:scan
```

> [!NOTE] Email sending is **optional** for local dev. Without a Resend key, keep
> `EMAIL_MODE=log-only` (the `.env.example` default) — emails are printed to the
> API log instead of sent. `EMAIL_MODE=send` without `RESEND_API_KEY` stops the
> API at boot with a message naming `RESEND_API_KEY`.

### The web app (`apps/web/.env`)

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable                         | Example                 | What it's for                                                  |
| -------------------------------- | ----------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | `http://localhost:8080` | **Required.** Base URL of the API the browser calls            |
| `NEXT_PUBLIC_APP_URL`            | `http://localhost:3000` | **Required.** The web app's own origin (session-refresh Origin) |
| `COOKIE_DOMAIN`                  | `localhost` (optional)  | Server-only; must match the API's `COOKIE_DOMAIN`              |
| `SHOW_DEMO_ACCOUNTS`             | `true` (optional)       | Server-only. One-click demo logins; `true`/`false`, default `false` |

### The admin app (`apps/admin/.env`)

```bash
cp apps/admin/.env.example apps/admin/.env
```

| Variable                    | Example                 | What it's for                                                                                                     |
| --------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`       | `http://localhost:8080` | **Required.** Base URL of the API the browser calls                                                               |
| `NEXT_PUBLIC_ADMIN_URL`     | `http://localhost:3001` | **Required.** The admin app's own origin (session-refresh Origin)                                                 |
| `NEXT_PUBLIC_WEB_URL`       | `http://localhost:3000` | **Required.** Web app URL used by the "main website" login link and the impersonation banner                      |
| `NEXT_PUBLIC_MERCHANT_URL`  | `http://localhost:3003` | **Required.** Merchant portal URL (impersonation banner)                                                          |
| `NEXT_PUBLIC_SESSION_POLL_MS` | `60000` (optional)    | Session-status badge steady-poll interval in ms — OPT-IN; unset/`0` disables steady polling (default). The countdown is computed locally from the JWT `exp` claim, so the badge works with zero polling |

The merchant app (`apps/merchant/.env`) needs `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_MERCHANT_URL` (`http://localhost:3003`); see its `.env.example`.

> [!NOTE] `NEXT_PUBLIC_*` vars are inlined into the browser bundle at build time. When you
> deploy, set them to your production URLs (e.g. `https://api.example.com` and
> `https://app.example.com`). Every app validates its env with zod: a missing or
> malformed **required** value fails `next build` / server start with an error that
> names the variable (never its value). See [Configuration](./technical/configuration/frontend.md).

---

## 7. Step 5 — Bootstrap the database

One command does **everything**:

```bash
pnpm db:all
```

`pnpm db:all` runs `turbo run db:seed`, which executes three tasks in order
(generate & deploy run in parallel, then seed):

1. **`db:generate`** — regenerates the Prisma client types from `schema.prisma`
   (Prisma is the project's **ORM** — object-relational mapper — and
   `schema.prisma` is the file that defines every table and relation).
2. **`db:deploy`** — applies any pending migrations (`prisma migrate deploy`).
3. **`db:seed`** — creates permissions, roles, users, URLs, clicks, API keys, etc.

Expect it to take ~30 seconds and end with:

```bash
 Tasks:    3 successful, 3 total
```

> [!WARNING] `db:all` applies **pending** migrations — it never **creates** a new one. On a
> fresh clone there are no pending migrations (they're committed), so step 2 is a
> no-op. If you ever _change_ `schema.prisma`, use `pnpm db:migrate` (interactive)
> to create a migration first, then `pnpm db:all` to re-seed.
>
> [!WARNING] The seed is **idempotent** — safe to re-run as many times as you like. Note it
> **wipes volatile demo data** (refresh tokens, clicks, API keys, usage logs) at the
> start, so any API keys you created manually will be removed.

### Seed scenarios

`pnpm db:seed` (and `pnpm db:all`) seed the **`development`** scenario unless you pick another one.
Everything after `--` is passed to the seed script:

```bash
pnpm db:seed                                        # development (default)
pnpm db:seed -- --scenario empty                    # reference data only
pnpm db:seed -- --scenario enterprise --seed 123    # large deterministic tenant
pnpm db:seed -- --help                              # list scenarios and options
pnpm db:seed -- --allow-destructive                 # only to seed a non-local / non-dev database on purpose
pnpm db:all -- --scenario enterprise                # generate → deploy → seed, with a scenario
```

| Scenario | What it creates | Typical use |
| --- | --- | --- |
| `empty` | Reference data only: permissions, roles and role grants, the MERCHANT capability catalog, the ABAC demo condition. **No users or tenants.** It never deletes anything — run `pnpm db:reset` first for a truly empty database. | Starting a real project on the template; testing first-run flows |
| `development` | Reference data plus the full demo dataset: the test accounts below, URLs/clicks/API keys, geo data (downloaded from GitHub, ~1–3 min), categories, products, the two demo organizations with rewards, POS terminals/keys/sales (including paired, removed, revoked, locked and soft-deleted rows), stores. Idempotent: the two demo tenants are upserted and only **their** re-creatable rows (and the seed accounts' tokens/keys/clicks) are replaced; other tenants and every audit table are never touched. | Day-to-day development (default) |
| `enterprise` | Reference data, the test accounts below, 70 categories, and one large tenant — **Northwind Retail Group** (`/orgs/northwind-enterprise/dashboard`) with 25 locations/stores, 250 members, 500 products. Additive: other tenants are left alone. Runs in seconds. | Pagination, performance, and scale testing |

**Deterministic by design.** `--seed <n>` (0–4294967295, default `1`) drives a small seeded
pseudo-random generator (`apps/api/prisma/seed/prng.ts`), so the same `--scenario enterprise --seed 123`
produces byte-identical names, prices, stock levels, and dates on every machine. Structure — ids,
emails, location codes, SKUs, who holds which role at which location — depends only on the dataset
size, never on the seed, so re-running with a different seed **updates the same rows in place**
instead of adding a second tenant. Timestamps are offsets from a fixed epoch (2026-01-01 UTC), not
the wall clock. `development` draws its generated demo values (devices, IPs, click counts…) from the same `--seed` stream; secrets (token and key material) always come from `crypto`, and seeded refresh tokens are stored as bcrypt hashes exactly like real sessions.

**Safety guard.** The seed refuses to run unless `NODE_ENV` is `development` or `test` **and** `DATABASE_URL` points at a local host (`localhost`, `127.0.0.1`, `::1`, or the compose service `postgres`). Seeding anything else needs the explicit `--allow-destructive` flag (`apps/api/prisma/seed/seed-guard.ts`).

Enterprise accounts (in addition to the test accounts below):

| Email | Password | Organization role |
| --- | --- | --- |
| `owner@enterprise.example.com` | `EnterpriseOwner@123` | OWNER (all locations) |
| `member.0001@enterprise.example.com` … `member.0249@enterprise.example.com` | `EnterpriseMember@123` | `0001` POLICY_ADMIN; every 25th ADMIN (all locations); every 4th MEMBER; the rest CASHIER at one location |

To add a scenario: add its name to `SeedScenarioSchema` in `apps/api/prisma/seed/seed-options.ts`,
write `apps/api/prisma/seed/scenarios/<name>.ts`, and register it in `SEED_SCENARIO_RUNNERS`
(`scenarios/index.ts`) — the runner map is typed as a full `Record`, so a missing runner fails to
compile. Keep generated data in a pure builder with unit tests (see `enterprise-dataset.ts`).

### Seeded login accounts

| Email                    | Password         | Role       |
| ------------------------ | ---------------- | ---------- |
| `superadmin@example.com` | `SuperAdmin@123` | SuperAdmin |
| `admin@example.com`      | `Admin@123`      | Admin      |
| `manager@example.com`    | `Manager@123`    | Manager    |
| `user@example.com`       | `User@123`       | User       |

Plus ~10 dummy users (`alice.johnson@example.com` / `Alice@123`, `bob.smith@example.com` /
`Bob@123`, …). Only users with the **Admin** role (or above) can log into the admin
panel — `user@example.com` can only use the web app. That gate is enforced by
**RBAC** (role-based access control): permissions are attached to roles, roles to
users, and the API checks both when an endpoint is hit.

---

## 8. Step 6 — Run the dev servers

From the repo root:

```bash
pnpm dev
```

This starts all three apps in **watch mode** (they rebuild automatically on save):

| App          | URL                            |
| ------------ | ------------------------------ |
| Web          | http://localhost:3000          |
| Admin        | http://localhost:3001          |
| API          | http://localhost:8080          |
| Swagger docs | http://localhost:8080/v1/docs   |

To run just one app (saves memory):

```bash
pnpm dev:web
pnpm dev:admin
pnpm dev:api
```

Press **Ctrl+C** (or **Cmd+C** on macOS) in the terminal running the API to shut down gracefully.
The server stops accepting new HTTP requests, runs Nest shutdown hooks (Postgres pool, Redis,
BullMQ, Kafka), and exits. You should see log lines such as `Received SIGINT — shutting down
gracefully` followed by `Graceful shutdown complete`. Override the wait with
`SHUTDOWN_TIMEOUT_MS` in `apps/api/.env` (default `15000`).

> [!NOTE] Turbo caching is **disabled** in this repo (`"cache": false`), so dev always runs
> fresh, and `@workspace/shared` is rebuilt before the apps that depend on it.

---

## 9. Step 7 — Verify everything works

**1. API health check** (should return `db: "connected"`):

```bash
curl http://localhost:8080/health
# → {"status":"ok","db":"connected","timestamp":"..."}
```

> [!NOTE] **API versioning:** every business endpoint is served under `/api/v1`
> (e.g. `POST /api/v1/auth/login`, `GET /api/v1/telescope/overview`). The prefix is
> defined ONCE in `@workspace/shared` (`API_VERSION_PREFIX` / the `apiPath()` helper
> in `packages/shared/src/contracts/versioning.ts`) and used by BOTH the server
> controller decorators and the client transport — they can never drift. `GET /`,
> `GET /health`, `GET /version` (the machine-readable version manifest) and
> `POST /notifications/email-webhook` are
> unversioned by design (infra plumbing + external callbacks). Swagger lives at `/v1/docs` (`/docs`
> 302-redirects there). Full invariants — including how to add a v2 and the
> deploy-any-or-die 404 negotiation — are in `docs/architecture.md` §5.

**2. Swagger** — open http://localhost:8080/v1/docs. You should see every endpoint
with its request/response schemas (inferred from the shared Zod schemas).

**3. Log into the web app** — http://localhost:3000/auth/login with
`user@example.com` / `User@123`. You'll be redirected to `/hello`.

**4. Log into the admin panel** — http://localhost:3001/auth/login with
`admin@example.com` / `Admin@123`. You'll land on `/` (the overview dashboard).

> [!NOTE] **Login gotcha:** the web app stores cookies named `accessToken` / `refreshToken`,
> while the admin panel uses **separate** cookies (`adminAccessToken` /
> `adminRefreshToken`) so a web login can't access the admin panel (and vice versa).
> If you're logged in to one app and the other says "not authenticated", that's
> expected — log in again on that app. Both cookie pairs are `SameSite`-scoped,
> which is the primary defence against **CSRF** (Cross-Site Request Forgery):
> a rogue site can't make the browser attach your session cookie to a
> cross-site request it didn't originate.

> [!NOTE] **Token refresh:** when an access token expires, the API returns `401` and the
> `useApi` hook (via `AuthProvider`) automatically calls `POST /auth/refresh`
> once (single-flighted, so concurrent 401s share one call), then retries the
> original request. Each refresh token carries a unique ID — its `jti` (JWT
> ID) — which the API uses to detect token reuse: when a token is rotated the
> old `jti` is invalidated, so a stolen token dies the moment it's used twice.
> On a **full page navigation** the route proxy (`proxy.ts`) can refresh ahead
> of time instead: it runs server-side, so it can read the httpOnly cookies,
> and when the access token is expired (or within 30s of expiring) it calls
> `POST /auth/refresh` itself and forwards the rotated cookies with the
> response — the first API call (e.g. `/auth/me`) then never 401s. If the
> refresh token is dead too, the proxy clears the stale cookies and sends the
> user to `/auth/login`. Only if the refresh itself fails do you get redirected
> to `/auth/login`. The route proxies only require the _access_ token cookie to
> be present — validity is enforced by the API, not the proxy.

> [!NOTE] **Who is signed in (client side):** read it with `useAuth()` from
> `@workspace/client/lib/auth`. In new code, prefer the narrow hooks `useAuthUser()`,
> `useIsAuthenticated()` and `useAuthCommands()`. Behind them is the `auth` feature store
> ([ADR 023](./adr/023-client-state-feature-stores.md)), created once per `AuthProvider`
> mount. It holds only the session _status_. The profile is the `/auth/me` query, which a
> sign-in seeds from the login response. Nothing auth-related is ever written to
> `localStorage`. This is UI state only: the API authorizes every request.

> [!NOTE]The proxies run on the **Node.js runtime** — Next.js 16 runs `proxy.ts` on
> Node by design (only the legacy `middleware.ts` convention can opt into
> Edge), so there is no Edge runtime to set up on Node hosts (DigitalOcean /
> Linode droplets, etc.). One trade-off: the proxy refresh and the client's
> 401-refresh are independent single-flight domains, so a rotation in one tab
> can invalidate an in-flight rotation in another (worst case: a re-login).
>
> **Theme hotkey (`d`):** both apps listen for the `d` key on `window` to toggle
> dark mode (`theme-provider.tsx`). The handler defensively guards against a
> missing `event.key` (some synthetic/polyfilled events can reach the listener
> without a populated key) so it can never throw.

**5. Browse the database visually** (optional):

```bash
pnpm db:studio     # opens Prisma Studio at http://localhost:5555
```

---

## 10. Everyday commands cheat sheet

Run these from the **repo root**:

| Command                                            | What it does                                              |
| -------------------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                                         | Run web + admin + api in watch mode                       |
| `pnpm dev:web` / `pnpm dev:admin` / `pnpm dev:api` | Run just one app                                          |
| `pnpm build`                                       | Production build (shared → api → web/admin)               |
| `pnpm lint`                                        | Lint every workspace (run via turbo)                      |
| `pnpm typecheck`                                   | Type-check every workspace                                |
| `pnpm test`                                        | Run every workspace's unit tests (vitest)                 |
| `pnpm format`                                      | Format everything with Prettier                           |
| `pnpm db:all`                                      | **One-shot DB bootstrap**: generate + deploy + seed       |
| `pnpm db:migrate`                                  | Create + apply a migration (interactive)                  |
| `pnpm db:migrate:create`                           | Create a migration without applying it                    |
| `pnpm db:migrate:status`                           | Show applied / pending migrations                         |
| `pnpm db:deploy`                                   | Apply pending migrations (CI/prod)                        |
| `pnpm db:generate`                                 | Regenerate Prisma client types                            |
| `pnpm db:seed`                                     | Re-seed the database (idempotent, `development` scenario) |
| `pnpm db:seed -- --scenario <name> [--seed <n>]`   | Seed `empty` / `development` / `enterprise` — see [Seed scenarios](#seed-scenarios) |
| `pnpm db:check-rls-manifest`                       | Verify Prisma models ↔ RLS manifest ↔ RLS SQL (CI check)  |
| `pnpm test:e2e`                                    | API e2e tests against the database in `apps/api/.env`     |
| `pnpm docs:check-links`                            | Validate internal links in `docs/` (CI check)             |
| `pnpm db:reset`                                    | 🔴 Drop all data, re-migrate, re-seed                     |
| `pnpm db:studio`                                   | Open Prisma Studio (localhost:5555)                       |
| `pnpm deps:check`                                  | Verify shared deps (React/Zod/TS) are the same everywhere |
| `pnpm deps:fix`                                    | Auto-align dependency versions                            |
| `pnpm turbo run db:<task>`                         | Run any db task through turbo explicitly                  |
| `pnpm docker:up`                                   | Start local infra (Postgres, Redis, Kafka, RabbitMQ, Bull Board, Mailpit, MinIO) — [details](./technical/operations/local-infrastructure.md) |
| `pnpm docker:down`                                 | Stop and remove infra containers                          |
| `pnpm docker:ps`                                   | Show infra container status                               |
| `pnpm docker:logs`                                 | Tail infra container logs                                 |
| `pnpm dev:analytics-consumer`                      | Run Kafka → Postgres analytics staging consumer           |

> [!NOTE] **Add a shadcn component/block:** `pnpm dlx shadcn@latest add <name> -y -o -c apps/admin`
> (run from the repo root; `-y` skips the confirm prompt and `-o` auto-answers the
> "file already exists — overwrite?" prompt, otherwise the CLI hangs waiting for
> input). Primitive components land in `packages/ui/src/components/`, while **block**
> files (page + its components) land inside the target app — see
> [Section 12](#12-where-does-new-code-go).

---

## 11. Best practices — Dos and Don'ts

### The 15 non-negotiable rules

These are enforced by ESLint **and** code review. Violations fail CI:

| #   | Rule                                           | What it means in practice                                                                                            |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | **No `any` / `z.any`**                         | Never opt out of the type system. ESLint: `no-explicit-any` = error.                                                 |
| 2   | **No `unknown` / `z.unknown`**                 | Type everything properly.                                                                                            |
| 3   | **No `never` / `z.never`**                     | A schema that accepts nothing is a design smell.                                                                     |
| 4   | **No type casting (`as Type`)**                | Don't use `as` to force types. **Avoid `as const` too** — use a tuple: `const X: ["a", "b"] = ["a", "b"]`.           |
| 5   | **Avoid `typeof`, infer from Zod**             | Types come from `z.infer<typeof Schema>`, not hand-written interfaces.                                               |
| 6   | **Use generic types (priority 0)**             | Write reusable, generic code — especially in low-level components.                                                   |
| 7   | **Polish the UI**                              | Production-ready, professional, visually appealing.                                                                  |
| 8   | **Mobile responsive**                          | Any UI you touch must work on small screens.                                                                         |
| 9   | **Data lives in the page**                     | `app/<page>/page.tsx` (the "smart component") owns the data; low-level components receive it via **props**.          |
| 10  | **Data changes happen in the smart component** | Low-level components never mutate/fetch data themselves.                                                             |
| 11  | **Low-level components are fluid**             | Nothing hardcoded — they adapt to whatever props the smart component passes.                                         |
| 12  | **Don't change the layout unless asked**       | Layouts are deliberate.                                                                                              |
| 13  | **Prefer Zod validation over string checks**   | Avoid `x === "string"` — validate with a schema.                                                                     |
| 14  | **Update the docs**                            | Whenever you finish a task, update the relevant docs so a junior can follow.                                         |
| 15  | **Access modifiers + return types always**     | `public`/`private`/`protected` and an explicit return type on every class member and function. ESLint enforces this. |

### Dos ✅

- **Put request/response shapes in `packages/shared/src/schemas/`** — never inside
  an app or a NestJS module. Both FE and BE import from there.
- **Declare inputs with `@ZodBody` / `@ZodQuery` / `@ZodParams` and the response with
  `@ZodResponse` / `@ZodPaginatedResponse`** — validation, Swagger and response enforcement all
  come from the shared schema ([Response contracts](./technical/api/response-contracts.md)).
- **Call the API through the `useApi` hook** (`@workspace/client`) — never raw
  `fetch` in a page. New endpoints get a typed entry in
  `packages/client/src/lib/endpoints.ts`.
- **Keep `packages/ui` presentational** — no data logic, no auth, no Zod there.
- **Add access modifiers and return types** on every class method and function.
- **Run the checks before pushing:** `pnpm lint && pnpm typecheck`.
- **Write schemas `.strict()`** so unknown fields are rejected.
- **Export new schemas from the barrel** (`packages/shared/src/index.ts`) or they
  won't be importable.
- **Commit migration folders** (`apps/api/prisma/migrations/`) — other environments
  replay the exact same SQL.
- **Keep `.env` out of git** (it already is via `.gitignore`).
- **Re-run `pnpm deps:check`** after touching any `package.json`.

### Don'ts ❌

- **Don't** use `any`, `unknown`, `never`, `as` casts, or `as const` (see rule 4).
- **Don't** define schemas inside `apps/api/src/modules/...` — they belong in
  `packages/shared/src/schemas/`.
- **Don't** fetch data or handle auth inside a `packages/ui` component.
- **Don't** hand-write response interfaces that duplicate a Zod schema.
- **Don't** edit `packages/shared/dist/` by hand — rebuild with
  `pnpm --filter @workspace/shared build`.
- **Don't** import `@workspace/client` from `@workspace/ui` (or vice versa) — layers
  are one-way.
- **Don't** sprinkle `// eslint-disable` comments to silence errors — fix the code
  (or add a scoped override in `eslint.config.js` if it's a genuine false positive).
- **Don't** run `npm install` / `yarn` — pnpm only.
- **Don't** commit `.env` files or generated `schema.d.ts` / `schema.js` artifacts.

### Git workflow tips

- Small, focused commits with clear messages.
- Run `pnpm lint` + `pnpm typecheck` before pushing (CI runs them too).
- If you changed the DB schema: create a migration (`pnpm db:migrate`), commit the
  migration folder, and re-run `pnpm db:all` locally to re-seed.
- If you changed a shared schema: update the API DTOs (they derive from the schema,
  so usually nothing to do), and let TypeScript point out every frontend usage that
  needs updating.

---

## 12. Where does new code go?

| You're building…                                   | Put it in…                                   |
| -------------------------------------------------- | -------------------------------------------- |
| A reusable UI component (button, dialog, table…)   | `packages/ui/src/components/`                |
| Auth state, API fetching, cookie handling          | `packages/client/src/lib/`                   |
| A Zod schema / shared type used by FE and BE       | `packages/shared/src/schemas/`               |
| A NestJS module / endpoint                         | `apps/api/src/modules/`                      |
| A page or route in the web app                     | `apps/web/app/`                              |
| A page or route in the admin app                   | `apps/admin/app/`                            |
| Admin layout chrome (sidebar, topbar, shell)       | `apps/admin/components/layout/`              |
| Admin auth UI (login form)                         | `apps/admin/components/auth/`                |
| Admin dashboard blocks (table, cards, charts)      | `apps/admin/components/dashboard/`           |
| Admin settings UI (profile card)                   | `apps/admin/components/settings/`            |
| Admin notifications UI (bell dropdown, list)       | `apps/admin/components/notifications/`       |
| Admin docs viewer (renderer, ToC, index cards)     | `apps/admin/components/docs/`                |
| Admin docs server reader + markdown helpers        | `apps/admin/lib/` (`docs.ts`, `markdown.ts`) |
| Admin providers / presentational bits              | `apps/admin/components/common/`              |
| Pure admin logic (search, menu utils, helpers)     | `apps/admin/lib/`                            |
| Admin unit tests (vitest)                          | `apps/admin/lib/__tests__/`                  |
| Sidebar menu data + icons                        | `apps/admin/lib/navigation/`                   |
| Shared admin types (`SidebarUser`, `FooterAction`) | `apps/admin/types/`                          |
| A new ESLint rule for everyone                     | `packages/eslint-config/base.js`             |
| A new tsconfig base                                | `packages/typescript-config/`                |

### The admin dashboard (`apps/admin/app/(panel)`)

The admin dashboard shell is a **TFX-style app layout** (ported from the reference
"TFX Global" seller portal — minus role/permission filtering) built on **Zustand**
(state) and **framer-motion** (animations). All authenticated admin pages live in
the `(panel)` **route group** — route groups add no URL segment, so the overview
is `/`, settings is `/settings/*`, users is `/users`, etc. It is arranged as
follows:

- **The layout** — `apps/admin/app/(panel)/layout.tsx` renders `DashboardShell`
  **once for the whole route group**. Because the shell (sidebar + topbar) lives
  in the layout instead of inside each page, Next.js keeps it **mounted across
  navigations** and only swaps the `children` segment. Navigation is therefore
  **SPA-like**: the sidebar/topbar never remount or re-render, so their state
  (search, expand/collapse, animations, scroll) persists when moving between
  pages. This is why editing the DOM on one page and navigating away no longer
  wipes it — no full page refresh happens between panel routes.
- **The shell** — `apps/admin/components/layout/dashboard-shell.tsx` is the smart
  wrapper the `(panel)` layout uses. It owns the **"who am I?" fetch**
  (`api.procedure(authEndpoints.me).useQuery()`), the loading / error states (with
  a logout button on failure), wraps everything in the **`AdminBreadcrumbProvider`**
  (so the breadcrumb consumers inside the frame are always covered — see
  _Breadcrumbs_ below), and renders `DashboardLayout` with the resolved user.
  Pages never touch auth or the layout directly — they only supply `children`.
- **The frame** — `apps/admin/components/layout/dashboard-layout.tsx` is purely
  presentational: the desktop `Sidebar`, the `Topbar`, the mobile drawer
  (`components/layout/mobile-menu-overlay.tsx`), the breadcrumb trail, and the
  page content. Each page (e.g. `apps/admin/app/(panel)/page.tsx`) is a thin
  smart component that owns its page data — no per-page `DashboardShell` wrapper
  needed.
- **Route-level fallbacks** — `apps/admin/app/(panel)/loading.tsx` shows a content
  skeleton while a page segment streams in (the shell stays mounted, so it feels
  SPA-like), and `apps/admin/app/(panel)/error.tsx` is the client error boundary
  for panel routes with a "Try again" button. **Not-found is shell-preserving:**
  `app/(panel)/[...slug]/page.tsx` is a catch-all that calls `notFound()` for any
  unmatched panel URL, and `app/(panel)/not-found.tsx` is the closest not-found
  boundary — because it lives inside the `(panel)` route group it renders
  **within** the layout, so the sidebar/topbar stay mounted and only the content
  area becomes the 404 page (with a "Back to dashboard" link). The root
  `app/not-found.tsx` (no shell) is the global fallback for URLs that match no
  route anywhere (e.g. malformed auth paths). The 404 markup itself is the
  **shared** `packages/ui/src/components/feedback/not-found-content.tsx` (framework-free:
  all strings + the back link arrive as props, per rules 9–11); the admin wraps
  it in `components/common/not-found-content.tsx` (renamed
  `AdminNotFoundContent`) only to supply the Next.js `Link`.
- **Web app 404** — `apps/web/app/not-found.tsx` renders the same shared
  `NotFoundContent` for any unmatched web URL (the web app has no persistent
  shell — `/hello` is full-screen — so no catch-all route group is needed),
  with a "Back to home" `Link`.
- **Sidebar nav items live in a JSON file** — `apps/admin/lib/navigation/sidebar-menu.json`.
  The file has a `header` (brand title/subtitle), an array of `sections` (each with
  a `title` + recursive `items`), and `bottomItems`. Items may nest to **any depth**
  and each carries a string `icon` name (a PascalCase lucide name). An item whose
  page has not been built yet is marked `"disabled": true` — it renders greyed out
  with a "This feature is currently unavailable" tooltip and is excluded from the
  command palette. The JSON is loaded **once** and typed in
  `config/sidebar-menu.ts` (`SIDEBAR_MENU: SidebarMenuData`) — so the whole tree is
  type-checked against `SidebarMenuItem` (from `lib/navigation/sidebar.ts`) and nothing
  menu-related is hardcoded in the components (rules 9–11).
- **Icons are resolved by name.** `lib/navigation/menu-icons.ts` exports a module-scope
  `ICON_MAP` (string → lucide component). Components look icons up **directly from
  the map** (`ICON_MAP[name] ?? AlertCircle`) instead of calling a factory function
  — that keeps the component reference static, which satisfies React 19's
  `react-hooks/static-components` lint rule. Add any new icon name to `ICON_MAP`
  when you add a menu item.
- **Shared menu logic lives in `lib/`.** `lib/navigation/menu.ts` exports the pure tree
  helpers used by both the sidebar and the command palette — `isRouteActive`,
  `computeRouteState` (active + auto-expanded items), `filterItemsBySearch`,
  `flattenMenuItems` (with breadcrumbs), and `createItemId`. `components/common/highlight.tsx`
  is the single `<mark>` highlight utility both surfaces use for search results.
  These are unit-tested in `lib/__tests__/` (see testing below).
- **State lives in the sidebar feature store.** This is an NgRx-style Zustand feature
  (`@workspace/client/lib/features/sidebar`; see
  [ADR 023](./adr/023-client-state-feature-stores.md)).
  - **Provider:** each app mounts `SidebarStoreProvider` once in its persistent shell, with
    its storage key (`admin-sidebar-state`, `web-sidebar-state`, `merchant-sidebar-state`)
    and DevTools name (`Sidebar · admin` …). The store is created per mount, never at
    module scope.
  - **Components use only the facade:** `useSidebarIsOpen()`, `useSidebarSectionOrder()`,
    `useSidebarExpandedItems()`, `useSidebarSearchQuery()` and `useSidebarCommands()`.
    Every change is a named action in Redux DevTools (development only), e.g.
    `[ Sidebar ] Toggled` or `[ Sidebar ] Section Moved`.
  - **What the store owns:**
    - `isOpen`, the desktop rail (persisted).
    - `sectionOrder`, the custom section order (persisted; `null` = config order).
    - `expandedItems`, manually opened branches (persisted, capped at 20).
    - `searchQuery`, which is **session-only**.
  - **Restoring preferences:** they come back after mount through
    `[ Sidebar ] Preferences Restored` (zod-validated; payloads from older builds are
    upgraded), so the server HTML and the first client render always match.
  - **Not state:**
    - The **menu** is a static constant per app (`SIDEBAR_MENU`, `USER_SIDEBAR_MENU`,
      `MERCHANT_SIDEBAR_MENU`).
    - The **current page** is the URL (`usePathname()`).
  - **Ctrl/Cmd+B** toggles the rail via the shared `SidebarProvider` in `packages/ui`.
- **The sidebar** (`components/layout/sidebar.tsx`, with the recursive row in
  `components/layout/sidebar-nav-item.tsx` and the reorderable section header in
  `components/layout/sidebar-section-header.tsx`) is fully recursive and fluid:
  - **Search** — a filter input with per-match `<mark>` highlighting; while
    searching every item is forced open so results are visible.
  - **Active-route highlight** — `usePathname()` derives `activeItems` and
    `autoExpandedItems` (every ancestor of the active page auto-expands). Items use
    **real route URLs** (e.g. `/users`) so navigation is SPA-based
    (`router.push`, never raw `<a href>`).
  - **Manual expand/collapse** — user toggles merge on top of the auto-expanded set;
    a `grid-template-rows` transition animates open/close smoothly.
  - **Section reordering** — hover a section header to reveal up/down buttons; the
    new order persists through the store.
  - **Footer** — optional `footerActions` (passed as props), `bottomItems` from the
    JSON, and the user card (initials avatar via `lib/user-initials.ts`) with a
    logout button.
  - Every row is the same height at every depth — only indentation differs, nothing
    shrinks as you nest deeper.
- **The topbar** (`components/layout/topbar.tsx`) — mobile menu button, desktop
  sidebar toggle, brand (shown when the rail is collapsed), the **⌘K command
  palette**, a notifications bell (no unread dot on the trigger — the count only
  shows inside the dropdown; see _Notifications_ below), a network status
  indicator (`components/common/network-status-bar.tsx`), theme toggle
  (`components/common/theme-toggle.tsx`), settings link (→ `/settings`),
  and the profile dropdown. Mobile detection uses the shared `useMediaQuery` hook
  (`hooks/use-media-query.ts`) at the `lg` breakpoint — no hand-rolled resize
  listeners.
- **The command palette** (`components/layout/command-palette.tsx`) — a full-featured
  ⌘K search over every page in the sidebar JSON. It supports **scope prefixes**
  (`>` commands, `/` pages, `#` settings), quick actions (toggle theme, open
  settings, go to dashboard, open billing), **pinned & recent chips**,
  per-item colour tiles, section badges, breadcrumb trails, fuzzy "did you mean?"
  suggestions (Levenshtein + filler-word stripping), and a keyboard-hint footer.
  The matching, alias, and styling logic lives in `lib/palette/search.ts` and
  `lib/palette/styles.ts` so the component stays small and the logic is testable.
  - **Recents and pins** live in the shared command palette feature store
    (`@workspace/client/lib/features/command-palette`; see
    [ADR 023](./adr/023-client-state-feature-stores.md)), which the sidebar's pinned
    row reads too. Each app mounts
    `CommandPaletteStoreProvider` once in its persistent shell, next to
    `SidebarStoreProvider`, with the storage key and DevTools name from its
    `lib/palette/store-config.ts` (`command-palette-state` for admin,
    `web-command-palette-state`, `merchant-command-palette-state`). Components read
    `useCommandPaletteRecentSearches()` / `useCommandPalettePinnedUrls()` and change
    state through `useCommandPaletteCommands()`, whose `recordRecentSearch` and
    `togglePin` dispatch `[ Command Palette ] Recent Search Recorded` (newest first,
    one entry per URL, capped at 6) and `[ Command Palette ] Pin Toggled`. The
    recents/pins survive reloads on purpose: they are restored after mount through
    `[ Command Palette ] Preferences Restored`, validated with zod (payloads from the
    older `zustand/persist` build are upgraded; a corrupted one is ignored). The
    **search text itself is local component state** and resets on close/refresh.
- **Display preferences** live in the shared `ui-preferences` feature store
  (`@workspace/client/lib/features/ui-preferences`; see
  [ADR 023](./adr/023-client-state-feature-stores.md)). Today it holds one value,
  `rewardsViewMode` (`grid` | `list`): the layout of the web rewards catalog and the
  merchant rewards catalog.
  - **Provider:** `UiPreferencesStoreProvider`, with the storage key and DevTools name
    from each app's `lib/ui-preferences/store-config.ts`. Web mounts it once in the
    **root layout** (`apps/web/app/layout.tsx`), not the `/rewardhub` shell, because the
    public landing page (`/`) renders the same catalog. Merchant mounts it in
    `MerchantShell`, next to the sidebar and command palette providers. Never nest a
    second provider with the same key: the two stores would drift apart.
  - **Facade:** components read `useRewardsViewMode()` and change it through
    `useUiPreferencesCommands().changeRewardsViewMode`, which dispatches
    `[ UI Preferences ] Rewards View Mode Changed`. Toggles parse their string value
    with the re-exported `RewardsViewModeSchema`.
  - **Persistence:** the keys are unchanged (`rewardhub-view-mode`,
    `merchant-rewards-view-mode`). The choice is restored after mount through
    `[ UI Preferences ] Preferences Restored`, so the first render is always `grid` and
    matches the server HTML. The bare `grid`/`list` string the older helpers wrote is
    upgraded by the schema; the next change rewrites it as
    `{"rewardsViewMode":"list"}`.
  - **Not here:** the colour theme (`next-themes`), data table column/density
    preferences (`packages/ui` keeps those and stays store-free), and anything the URL
    should own.
- **The profile dropdown** (`components/settings/profile-01.tsx`) — a polished
  card: avatar with online-status dot, name + email, a **plan badge** (with an
  Upgrade button), and menu actions (Billing, Settings, Terms & Policies) followed
  by Logout. Every action navigates to a **real route** (`/account/profile`,
  `/account/security`, `/settings/billing`) — see [Routing](./technical/frontend/routing.md).
- **Notifications** — split into a smart + dumb pair (rules 9–11):
  `components/notifications/notifications-dropdown.tsx` (smart) owns the state —
  it loads the data, tracks read/dismissed items, and hands **props + callbacks**
  to `components/notifications/notifications-list.tsx` (dumb, purely
  presentational). The list renders a header with unread count + "Mark all read",
  every notification (unread tint + per-item _mark read_ / _dismiss_ actions
  revealed on hover at `sm`+, always visible on touch), an empty state, and a
  footer. The type is derived from a **Zod schema** in `lib/notifications.ts` via
  `z.infer` (`NotificationItem`), and `data/notification-data.json` is **parsed**
  at module load so the JSON can never drift from the schema. No
  `DropdownMenuLabel` is used — Base UI maps that to `Menu.GroupLabel`, which
  **requires** a `<Menu.Group>` wrapper and throws "MenuGroupContext is missing"
  outside one (the old inline dropdown hit exactly this).
- **The docs viewer** — every guide in the repo's `docs/*.md` folder is
  served inside the admin panel under **`/docs`**: `/docs` (a card-grid index
  with an **inline search box** that filters the grid as you type — no
  separate search page needed) and `/docs/<slug>` (one guide, opened with a
  generated hero **banner**). The pages are **server components** —
  `lib/docs.ts` reads the files straight off the filesystem (`server-only`
  guarded, path-traversal protected, case-insensitive slug resolution so
  `README.md` is served too) and derives metadata + ToC headings with the
  pure helpers in `lib/docs/markdown.ts` (shared `slugifyHeadingText`, so ToC
  anchor ids always match the rendered heading ids).
  - **Frontmatter.** Every guide starts with a small YAML block that drives
    its metadata and ordering:
    `---` / `title:` / `description:` / `order:` / `author:` / `lastUpdated:`
    / `coverImage:` / `---`. It is validated by `DocFrontmatterSchema`
    (`z.infer` for the type) via `parseMarkdownFile` in `lib/docs/markdown.ts` —
    anything missing falls back to the H1 + first paragraph, and a broken
    block can never take the page down (it degrades to empty frontmatter).
    Guides without an `order` sort after every ordered guide. `author` and
    `lastUpdated` are shown on the banner (and `lastUpdated` on the index
    cards); `coverImage` is the absolute https photo URL used as the banner
    cover art (validated with `z.url()`, so a malformed URL fails at parse
    time); the reading time is estimated from the word count
    (`estimateReadingTime`).
  - **Inline search.** The `/docs` index is a client **smart component**
    (`components/docs/docs-index.tsx`) that owns the query and filters the
    card grid with the pure, generic `filterDocSummaries` helper (title
    matches rank above description matches, with `<mark>` highlighting). The
    search box itself (`components/docs/docs-search-box.tsx`) is a dumb,
    controlled input. The old `/docs/search` route now redirects to `/docs`.
  - **Detail page layout.** `app/(panel)/docs/[slug]/page.tsx` is a server
    component — rendered with **SSR** (server-side rendering), so the guide's
    HTML arrives pre-built from the server rather than being assembled in the
    browser: the banner, then the article + ToC, ending with a
    **previous / next guide** pager, a **"Continue exploring" card**, and a
    quiet **"Edit this guide"** link to the source `.md` on GitHub. The
    breadcrumb (`Documentation › <title>`, linking back to `/docs`) comes
    from the **shared `BreadcrumbContext` trail** rendered by the `(panel)`
    layout — the resolver maps `/docs/<slug>` to its menu entry (Settings →
    …) or falls back to the section + doc title, so the docs page needs no		breadcrumb markup of its own. The article column is constrained to a
		comfortable **reading measure** (`max-w-3xl`, ~70ch) so lines don't
		stretch across the whole container, and the whole group is centered on
		the page. **Keyboard shortcuts** (`components/docs/doc-keyboard-nav.tsx`): `[` and
    `]` jump to the previous / next guide (guarded against typing targets
    and modifier keys). **ToC**: the sticky right-hand rail
    (`components/docs/docs-toc.tsx` — scroll-spy, sliding indicator,
    back-to-top, **estimated reading time**, a thin **scroll-progress fill**,
    and **collapsible h3 subtrees**: groups with more than 3 sub-headings
    fold into a "Show N more" toggle) shows at `lg+`; below that it folds
    into a collapsible "On this page" `<details>` disclosure above the
    article. **Pager** (`components/docs/doc-pager.tsx`): the two
    neighbouring guides from the ordered `getAllDocs()` list, rendered as
    quiet link cards at the end of the article. **CTA card**
    (`components/docs/doc-cta-card.tsx`): after the pager — the guide's
    author / updated / read-time meta and a "Browse all guides" link back to
    `/docs`. **Loading state**: `app/(panel)/docs/loading.tsx` is a
    docs-aware skeleton (banner-shaped block + shimmering text lines) shown
    while the segment streams in.
  - **Banner.** `components/docs/doc-banner.tsx` renders a per-guide hero — a
    real **photograph** from the guide's `coverImage` frontmatter (an absolute
    https URL, e.g. an `images.unsplash.com` photo), displayed through
    `next/image` (`fill` + `object-cover` + `priority`, so it is optimized and
    eager-loads) with a **cinematic** left-to-right **dark scrim** plus a
    **bottom vignette** that gives the meta row a solid base. `next.config.ts`
    whitelists `images.unsplash.com` via `images.remotePatterns` — add any
    other image host you use there. If a guide has no `coverImage`, the banner
    falls back to a quiet **dotted-paper** texture (a faint `--color-border`
    dot grid over `bg-card`, token-driven — no hardcoded colors, no decorative
    gradient bands). The typography is deliberately restrained (the "AI-ish"
    look comes from heavy bold headings, letter-spaced uppercase eyebrows and
    high-contrast scrims): a small **sentence-case pill chip** (never
    uppercase, never letter-spaced), a `font-semibold tracking-tight` title
    (never `font-bold`), and a **top-divided meta row** for author,
    last-updated date, and reading time. Because the banner owns the title,
    `getDoc` strips the leading H1 from the markdown body
    (`stripFirstHeading`) so it isn't duplicated.
    Rendering is done by `components/docs/markdown-renderer.tsx` — a custom
    `react-markdown` renderer with GFM + math/KaTeX, headings with copy-link
    buttons, tables, images, task lists, **shiki**-highlighted code blocks
    (`components/docs/code-block.tsx` — the **One Dark Pro** editor theme on a
    fixed dark surface in BOTH light and dark app modes, copy/download,
    optional line numbers, and a **per-language accent** — a colored dot +
    colored label in the header bar matching the grammar's hue). The
    supported fence languages are the `CODE_LANGUAGES` tuple in
    `lib/types/code-block.ts` (bash, typescript, ts, tsx, js, jsx, json, sql,
    prisma, env, css, html, yaml, ini, markdown, http, diff, plaintext). **Always
    tag your fences** (` ```typescript `, ` ```bash `, ` ```http `, ` ```env `,
    …) — a **bare ` ``` `** falls back to `detectLanguageName`
    (`components/docs/code-block.tsx`), which recognizes env `KEY=value` lines,
    HTTP request/response blocks, shell commands, `export default […]` /
    `import … from` configs, SQL, and Prisma schema keywords; everything else
    (ASCII trees, diagrams, prose) renders as uncolored plaintext. Fences are
    lazy-loaded **mermaid** diagrams (`components/ui/mermaid-diagram.tsx`,
    `mermaid` is dynamic-imported so it only loads when a diagram exists). The
    **reading typography** is tuned for docs: a `15px` body
    (`text-foreground/90`, `leading-7`) instead of the default `14px`, a
    **stepped heading scale** (24px h2 → 18px h3 → 16px h4, `font-semibold`,
    never bold + tight-tracking everywhere), inline code as a quiet `bg-muted`
    pill (no border), and lists with `marker`-colored bullets. Beyond the
    basics the renderer adds: **interactive tables**
    (`components/docs/docs-table.tsx` — sticky header, zebra rows, row-hover
    highlight, horizontal scroll on small screens with a swipe affordance),
    **image galleries** (a table whose **every** body row contains an `<img>` — e.g.
    a "Template | Preview" screenshot table — is detected by
    `lib/docs/image-gallery.ts` and rendered as a **polished card grid**
    (`components/docs/docs-image-gallery.tsx`: responsive 1/2/3-column showcase
    cards where each screenshot is shown **in full** — `object-contain`, never
    cropped — inside a padded frame with a quiet token-driven **dot-grid
    texture** (the same `radial-gradient` pattern as the docs banner) acting as
    a neutral stage, a hover zoom + ring, an **"Open full size"** pill button
    (bottom-right, hover-revealed on desktop, always tappable on touch) that
    opens the shared **lightbox**, and a caption bar derived from the row
    labels — the title comes from the image `alt` text and the description from
    the remaining label text with wrapping parens trimmed; the detection is
    conservative, so any table with even one image-less row falls back to the
    normal data table), a
    **drop-cap on the article's opening paragraph** (a remark plugin stamps
    the first ROOT-level paragraph — never one inside a callout, so a guide
    that opens with `> [!NOTE]` doesn't get a drop-cap inside it),
    **glossary tooltips** (jargon from `GLOSSARY_TERMS` in `lib/docs/markdown.ts`
    — JWT, RBAC, jti, HS256, … — renders as `<abbr title>` hover tooltips;
    add a term + one-line definition there and every guide gets it), an
    **image lightbox** (click a diagram's zoom button to open a native
    `<dialog>` full-view overlay; Esc / backdrop / ✕ closes — the lightbox
    helpers live in the shared `lib/docs/lightbox.ts` module, used by BOTH the
    renderer's `img` component and the image gallery, so every zoom button opens
    the same dialog). The lightbox supports **two zoom modes** toggled by
    clicking the image itself (or the mode pill in the dialog header):
    **Fit** — the default, image scaled to the largest size that fits the
    dialog — and **1:1** (actual size), where the image renders at its
    natural pixel resolution inside a scrollable box so you can pan around
    large screenshots. Every open starts in Fit; a double-click always snaps
    back to Fit, and the mode resets when the dialog closes. The header also
    carries a live mode pill ("Fit" / "1:1") as an accessible status, and a
    **Download** button that fetches the current image as a blob (same-origin
    credentials, so auth-gated images work) and saves it at **full
    resolution** — the filename is derived from the image's URL path (or its
    alt text as a fallback), with a success/error toast — and
    optional
    **fence titles** — a `title="file.ts"` hint on the fence's first line
    shows a filename in the code-block header:
    ` ```typescript title="endpoints.ts" `.
  - **Code blocks carry reading extras** — **line highlights** via the
    fence's `{…}` range (` ```ts {2-4,7} ` tints 1-based lines 2–4 and 7 with
    the theme's blue accent and shows an "N lines highlighted" chip in the
    header; `parseHighlightMeta` in the renderer parses the braces and a
    shiki v4 transformer stamps the lines), a **`diff` language** that
    renders GitHub-style (`+` green, `-` red, `@@` hunk headers blue — pure
    CSS, no shiki grammar), a **word-wrap toggle** in the header bar
    (`aria-pressed`, wraps long lines instead of horizontal scrolling), a
    **collapse** for blocks over 30    lines (a bottom fade + "Show all N
    lines" expander), and a **copy toast** that names the target
    (`toast.success("Copied file.ts")` instead of a silent icon flip). The
    fence below demos the highlight + collapse + wrap features together
    (lines 2–3 are tinted, and the block is short enough to skip the
    collapse):

    ```typescript {2-3}
    const client = createClient();
    const session = await client.sessions.current();
    const user = await client.users.me();
    ```
  - **Blockquotes are color-coded callouts** (a remark plugin
    `remarkQuoteKindsPlugin`). Each quote gets a **light pastel** background
    + a 4px left border + tinted text, keyed by kind:

    | Kind | Marker | Colors |
    | ---- | ------ | ------ |
    | info (default) | `> [!NOTE]` / `> [!INFO]` | blue |
    | warning | `> [!WARNING]` / `> [!CAUTION]` / `> [!IMPORTANT]` | yellow |
    | error | `> [!ERROR]` / `> [!DANGER]` | red |
    | success | `> [!SUCCESS]` | blue (same styling as info) |
    | tip | `> [!TIP]` | violet (own hue + lightbulb icon) |

    The marker is **stripped from the rendered text**. When no marker is
    present (the existing guides use plain `>` quotes), the kind is **detected
    from the quote body's keywords** (error/fail → error; warning/caution/
    gotcha/pending → warning; success/tip → success; everything else → info).
    To force a kind explicitly, put the marker on the first line:

    ```markdown
    > [!WARNING]
    > This command wipes volatile demo data.
    ```
    Each kind also gets a **matching icon** in the callout (ℹ / ⚠ / ⛔ / ✓
    — the plugin stamps `data-quote-kind` on the hast node and the
    component reads it back with `QuoteKindSchema`, so the icon always
    matches the colour, rule 13). A `**Bold title:**` lead renders as an
    icon + bold header line; without one, the icon sits inline before the
    content. Every marker kind — NOTE/INFO/TIP/SUCCESS/WARNING/ERROR —
    renders the same **standardized callout** layout: only the accent colour
    and icon vary by kind (TIP gets a distinct **violet** hue with a
    **lightbulb** icon so it never reads as a plain success), so no callout
    ever looks like an outlier. The right-hand **ToC**
    (`components/docs/docs-toc.tsx`) is a sticky scroll-spy rail at the `lg`
    breakpoint (hidden on mobile): a **visible 1px gray guide line** (the same
    guide-line concept as the sidebar's nested items, but on a tone that reads
    over the light page background) with a **sliding 2px primary indicator**,
    and **`h3` sub-sections render indented with their own guide line** —
    mirroring the sidebar's nested-child indentation, so sub-headings are
    visually grouped under their `h2`. The rail header shows the
    **estimated reading time** ("X min"), a thin **scroll-progress fill**
    grows under it as you read, and long `h3` groups (more than 3) collapse
    behind a **"Show N more"** toggle so deep guides stay scannable. The
    scroll-spy **stays in sync with the dashboard's real scroll container**: the shell scrolls inside
    `<main className="flex-1 overflow-y-auto">`, not the window. The
    container is found by **walking up the DOM from the nav's PARENT** — never
    the nav itself, because the ToC's own `<nav>` is `overflow-y-auto` too and
    would be mistaken for the page scroller (which broke the bottom-of-page
    correction on guides whose ToC fits the viewport, e.g. `architecture`,
    `typescript`, `dependencies`). The ToC listens on that container _and_ on
    `window` with a **capture-phase** listener (`{ capture: true }`) — scroll
    events don't bubble, but capture-phase listeners still catch scrolls from
    any inner container. A **`ResizeObserver`** on the scroll container
    re-measures when the sidebar's collapse animation reflows the article (no
    window resize fires in that case), so the indicator never sits stale. A
    **rAF-throttled handler** recomputes the active section once per frame
    (the last heading whose top crossed the reading line, with a
    bottom-of-page correction so the last heading always wins at the end of
    the doc — guarded by `scrollHeight > clientHeight` so a page that fits
    the viewport never pins the last heading), so it tracks scrolling
    continuously instead of snapping (state updates stay inside rAF/event
    callbacks — never in an effect body, per
    `react-hooks/set-state-in-effect`). **Clicking a link** smooth-scrolls the
    ONE detected container with a manual `scrollTo` computed from the
    heading's offset — deliberately NOT `scrollIntoView`, which scrolls every
    scrollable ancestor (main + shell + body) and makes the page "jump
    around" when you click a section far away.
    Internal `.md` links are rewritten to their `/docs/<slug>` pages. New
    dependencies live in `apps/admin/package.json`: `react-markdown`,
    `remark-gfm`, `remark-math`, `rehype-katex`, `katex`, `unist-util-visit`,
    `shiki`, `mermaid`, `server-only` (+ `@types/mdast`). Sidebar
    **Documentation → Docs Home** lists every guide; the sidebar menu,
    breadcrumbs, and ⌘K palette pick them up automatically.
- **Account & settings pages** — `apps/admin/app/(panel)/account/profile/page.tsx` (the
  admin's own profile form + notification toggles + timezone, all state at the page level) and
  `apps/admin/app/(panel)/settings/billing/page.tsx` (current plan + feature
  checklist, payment method card, invoices table). They render **content only** —
  the `(panel)` layout supplies the shell — and are wired into the sidebar JSON
  under **Settings** → General / Billing (plus a disabled Security subtree). A
  server-component `app/(panel)/settings/page.tsx` `redirect()`s a direct hit on
  `/settings` to `/settings/billing` (personal pages live under `/account`).
- **Route protection** — `apps/admin/proxy.ts` (Next.js 16 middleware
  convention) treats **everything except `/auth/*`** as protected: unauthenticated
  visitors are bounced to `/auth/login?redirect=<original path>`, and the login
  page reads that param so you land back on the page you tried to visit. An
  already-authenticated admin hitting `/auth/*` is redirected back into the panel.
- **Mobile** — below `lg` the sidebar renders inside a framer-motion slide-in drawer
  with a backdrop (`components/layout/mobile-menu-overlay.tsx`); the topbar's
  hamburger opens it.
- **Scroll-to-top** — a floating chevron button, **shared** between apps in
  `packages/ui/src/components/navigation/scroll-to-top.tsx` (framework-free; the DOM
  helper `findPageScrollContainer` lives in `packages/ui/src/lib/scroll-container.ts`).
  It appears after 300px of scroll (`threshold` prop) and smooth-scrolls back
  up. It does **not** assume the window scrolls: it detects the real scroller
  by walking up from its own DOM position, so it works both inside the admin
  shell (where `<main>` scrolls — mounted inside `<main>` in
  `dashboard-layout.tsx`) and in the web app (which scrolls the window —
  mounted in `apps/web/app/layout.tsx`). Mount it INSIDE the scrollable area;
  mounted outside, the walk-up lands on `window` and the button never appears.
- **Logout is wired in the layout** — `dashboard-layout.tsx` passes `onLogout` down
  to the sidebar footer and the profile dropdown; there is no standalone logout
  button file.
- **Breadcrumbs via a shared context** — the trail is driven by a
  `BreadcrumbContext` so it can be updated from anywhere (a page, a dialog, a
  settings tab) and stays in sync automatically. The context itself is a
  **framework-free factory** in `packages/ui/src/components/navigation/breadcrumb-context.tsx`
  (`createBreadcrumbContext(resolve)`) — it returns a `{ provider, useBreadcrumb }`
  pair plus the shared `BreadcrumbItem` type (an icon-bearing crumb: `label`,
  `href?`, `icon`). Because `packages/ui` never imports `next/*` (it is
  framework-agnostic, so it can't hold the router), **each app instantiates its
  own instance**:
  - **Shared state machinery** — the provider holds a **trail status**
    (`loading | error | ready`), validates every trail through a **Zod schema**
    (`BreadcrumbItemSchema`, type via `z.infer` — rule 13), memoizes its context
    value, and exposes `setItems` (override), `setError`, `reset` (restore the
    route-derived trail), and **`subscribe`** — a lightweight listener registry
    fired on explicit overrides (`setItems`/`setError`/`reset`) for
    non-render consumers; plain route changes flow to subscribers through the
    normal context re-render instead (no stale reads). Resolving happens in an
    effect keyed on `pathname`; the resolver is held in a ref so it never
    triggers effect churn.
  - **Admin** — `components/common/admin-breadcrumb.tsx` creates the app-wide
    instance, and `lib/navigation/breadcrumb.ts` exports `resolveAdminTrail(pathname)`, a
    pure function that walks `config/sidebar-menu.json` with robust
    prefix-matching (normalizes trailing slashes, never confuses `/users` with
    `/users-x`, matches through any nesting depth) and maps each ancestor to a
    crumb with its **mandatory icon** (from `lib/navigation/menu-icons.ts`'s `ICON_MAP`, `FileText` fallback).
    The resolver is **section-aware** (multi-item content sections like
    `Documents` contribute a context root: `/documents/alpha` →
    `Documents › Project Alpha`; the `Main` catch-all and single-item sections
    don't duplicate) and handles **dynamic segments** (`/users/123` →
    `Users › 123`, rendered from the deepest matching menu parent) and **docs
    routes** (`/docs/prisma` → `Docs Home › Prisma & DB` straight from the menu
    tree). **The provider lives in `DashboardShell`** — one level above
    `DashboardLayout` — so every consumer (the layout's own
    `useTrailDocumentTitle` + `ShellBreadcrumb`) sits inside it; putting it
    inside the layout itself makes those hooks run outside the provider and
    throw "useBreadcrumb must be used within a BreadcrumbProvider".
    `dashboard-layout.tsx` reads the **status** via `useAdminBreadcrumb()` and
    renders the **shared** `BreadcrumbTrail` with a Next.js `renderLink` and a
    responsive `maxItems` (2 on mobile, 4 on desktop via `useMediaQuery`).
  - **Docs title override** — the `/docs/<slug>` page (server component) mounts
    `components/docs/doc-breadcrumb-bridge.tsx`, a client component that calls
    `setItems` with the guide's real **frontmatter title** in an effect and
    `reset()`s in its cleanup, so the trail shows `Docs Home › <Guide Title>`
    while reading a guide and restores the route-derived trail on navigation.
  - **Shared presentational trail** — `packages/ui/src/components/navigation/breadcrumb-trail.tsx`
    is a dumb, `React.memo`-wrapped component used by both apps. Features:
    **mandatory icons** on every crumb; a **`maxItems` collapse** (first crumb +
    last `maxItems - 1`, default 4) whose hidden middle is listed in a
    **popover** (`HiddenCrumbsPopover`) so every hidden crumb stays reachable; a
    **copy-link button** (appears on hover at `sm`+, always on touch, transient
    ✓ state); `title` tooltips on labels; hover (primary + underline) and
    `focus-visible` ring states on links; `font-medium text-foreground` on the
    current-page crumb; a light **entrance animation** (tw-animate-css) keyed on
    the last crumb so it replays on navigation; and **status placeholders** — a
    skeleton while `loading`, a muted message on `error`. The component is
    framework-free: apps pass `renderLink(item) → <Link>`.
  - **Document title** — the admin's `useTrailDocumentTitle` reads the trail
    from the context value and keeps `document.title` in sync with the last
    crumb (the effect re-runs with a fresh status on every navigation — no
    stale closures).
  - **Web** — `apps/web/lib/navigation/breadcrumb.ts` (a route table returning `[]` on
    full-screen auth routes so no trail renders, with a current-page `Home`
    fallback on unknown routes) + `components/breadcrumb-provider.tsx` (thin
    client wrapper feeding `usePathname()` into the framework-free provider) +
    `components/navigation/breadcrumb-trail.tsx` (reads status, renders the shared trail
    with a Next.js `renderLink`); wired into `apps/web/app/layout.tsx` and
    rendered on `/hello`.
  - **Data-driven demo** — `app/(panel)/users/[id]/page.tsx` is a live example
    of the override pattern: the page owns the data (a deterministic mock user;
    a real app would `useQuery` the entity), and the client
    `components/users/user-detail-breadcrumb.tsx` calls `setItems` in an effect
    (with `reset` in its cleanup) so the trail reads `Users › <display name>`
    instead of the URL-derived `Users › 123`.
  - **Testing** — `lib/navigation/breadcrumb.test.ts` covers the resolver: exact
    matches, nested ancestors, section-aware roots, dynamic segments
    (`/users/123`), docs routes, trailing slashes, `/users` vs `/users-x`
    boundary, unknown-route fallback, and mandatory icons on every crumb.
    **Component tests** (`components/common/breadcrumb-trail.test.tsx`, run in
    a **jsdom** environment via `@vitest-environment jsdom`) render the shared
    trail with `@testing-library/react` and cover: crumb rendering with
    `aria-current` on the current page, the loading skeleton, the error
    message, the empty state, the `maxItems` collapse (hidden middle + ellipsis
    trigger), the no-collapse case, and the copy-link button. Dev deps
    `jsdom`, `@testing-library/react`, `@testing-library/dom`, and
    `@vitejs/plugin-react` (for `.tsx` transforms) were added to
    `apps/admin/package.json`; `vitest.config.ts` now includes
    `components/**/*.test.tsx` (with the React plugin so JSX transforms).
- **Auth pages are SPA-friendly** — `components/auth/login-form.tsx` and the auth
  pages use `Link`/`router.push` (never raw `<a href>` or `window.location.href`),
  and the "main website" link reads `NEXT_PUBLIC_WEB_URL`. The admin has only one
  redirect target, so `ClientAuthWrapper` (`@workspace/client/lib/auth/client-auth-wrapper`)
  hardcodes `onUnauthorizedRedirect: "/auth/login"` instead of threading an unused
  prop.
- **Testing** — the admin app has **vitest** (`pnpm test` / `pnpm --filter
@workspace/admin test`). Tests live in `lib/__tests__/` and cover the pure
  logic: `menu.test.ts` (route matching, active/expanded state, search pruning),
  `palette-search.test.ts` (scope parsing, aliases, fuzzy suggestions),
  `user-initials.test.ts`, `notifications.test.ts` (schema parse, id
  uniqueness, unread counting), `breadcrumb.test.ts` (trail resolution,
  collapse boundary), and `markdown.test.ts` (slugify, ToC extraction,
  frontmatter parsing, inline search filtering, reading time + dates) — plus
  **component tests** (`components/common/breadcrumb-trail.test.tsx`, jsdom).
  Run from the app folder with `npx vitest run`, or from the root with
  `pnpm test` (turbo delegates to each workspace's `test` script).
- **Dependencies** — `zustand`, `framer-motion`, and `vitest` (dev) are declared
  in **`apps/admin/package.json`** (app-level, not in `packages/ui`). The dashboard
  page shows real platform sales (`components/dashboard/platform-sales-cards.tsx`) and reuses
  `components/dashboard/chart-area-interactive.tsx`, and `data/dashboard-data.json`
  from the original dashboard-01 block; the data-table is split across
  `components/dashboard/data-table.tsx` (main component),
  `data-table-columns.tsx` (column defs + cell renderers), and
  `data-table-constants.ts` (schema + option lists).

Not sure? Read [architecture.md](./technical/architecture.md) first.

---

## 13. Troubleshooting

| Symptom                                                                 | Cause & fix                                                                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm: command not found`                                               | pnpm isn't installed. Run `corepack enable && corepack prepare pnpm@12.6.0 --activate`.                                                                            |
| `Unsupported engine` / node version error during install                | Your Node is too old. The repo needs Node **>= 20**. Install 20+ and retry.                                                                                         |
| `psql: could not connect to server` / `Connection refused (0x0000274D)` | Postgres isn't running. Start it (`brew services start postgresql@18` or `pnpm docker:up`) and re-run `pg_isready`.                                            |
| `Environment variable not found: DATABASE_URL` / `datasource.url property is required` | `apps/api/.env` is missing or incomplete. Copy `.env.example` → `.env` and fill it in. Prisma 7 reads the URL from `prisma.config.ts`, which loads that file. |
| `database "monorepo" does not exist`                                    | Create it first: `createdb monorepo`.                                                                                                                               |
| `Invalid seed arguments` from `pnpm db:seed`                           | Unknown scenario or malformed `--seed`. Run `pnpm db:seed -- --help` for the valid options. |
| `P3009: migration found that was not applied` / schema not up to date   | Run `pnpm db:all` (applies pending migrations).                                                                                                                     |
| `Tasks: 2 successful, 1 failed` from `pnpm db:all`                      | `db:deploy` or `db:generate` failed, so the seed was skipped (by design). Run `pnpm turbo run db:deploy` to see the real error.                                     |
| Port 3000/3001/8080 already in use                                      | Another process is on the port. Find it (`lsof -i :3000`) and stop it, or change `PORT` in `apps/api/.env`.                                                         |
| Web says "not authenticated" but I logged in on Admin                   | Cookie isolation by design. Web uses `accessToken`/`refreshToken`; admin uses `adminAccessToken`/`adminRefreshToken`. Log in on each app separately.                |
| `user@example.com` can't log into the admin panel                       | Expected — non-admin users are blocked from admin **by design**. Admins (`admin@example.com`/`Admin@123`) can log into **both** web and admin; non-admins only web. |
| `ESLint couldn't find an eslint.config.js file`                         | You ran `npx eslint` from the repo root (no root config). Run it inside a workspace: `cd apps/web && npx eslint .` — see [eslint.md](./technical/tooling/eslint.md).                  |
| Prisma client doesn't know a new field                                  | Run `pnpm db:generate` (or `pnpm db:migrate`, which regenerates) and restart your TS server.                                                                        |
| Email verification link fails                                           | `RESEND_API_KEY` missing or `APP_URL` wrong. Emails are optional in dev.                                                                                            |
| I broke the DB and want a clean slate                                   | `pnpm db:reset` (drops everything, re-migrates, re-seeds). 🔴 All data is wiped.                                                                                    |

---

## 14. Common mistakes (FAQ)

**Q: Why does `pnpm db:all` "only show" generate and deploy?**
A: It runs all three — generate and deploy finish in ~2 seconds, then the seed runs
for ~25–30 seconds. Look for `@workspace/api:db:seed:` lines and the final
`Tasks: 3 successful, 3 total` summary.

**Q: Why can't I import `@workspace/ui` from `@workspace/client`?**
A: Layers are one-way: apps → client/ui → shared. `ui` is presentational; `client`
owns auth + fetching. Crossing them couples concerns and breaks the architecture.

**Q: Do I need a Resend account to develop?**
A: No. Auth works without it — only actual email delivery fails. Add a key when you
need signup/verification emails to send.

**Q: How do merchant KYB (SSM) documents work locally?**
A: Merchant onboarding creates the account first; KYB documents upload after login via
**direct presigned POST** (`POST /files/upload-url` → S3/local shim → `POST /files/:fileId/complete`).
Without `STORAGE_S3_PRIVATE_BUCKET` or `STORAGE_S3_BUCKET`, files land under
`apps/api/.object-storage/` and are promoted to a flat final key when
`POST /files/:id/complete` succeeds.

A **single S3 bucket** (e.g. `STORAGE_S3_BUCKET=rewardhub`) is enough — you do not
need separate public and private buckets. See
[Storage — One bucket vs two buckets](./technical/storage/aws-s3.md).

| Mode | When to use |
|------|-------------|
| **Local filesystem** (default) | Everyday dev — no AWS needed |
| **Local + real S3** | Existing bucket (`STORAGE_S3_BUCKET=…`) or CDK `development` stack |
| **Production** | CDK `production` stack + env vars from stack outputs |

Full CDK walkthrough: [Storage §8 — A to Z](./technical/storage/aws-s3.md).

**Q: I changed `schema.prisma` — what now?**
A: Prisma first, then generate, then Zod, then the pipe. 1) Edit `apps/api/prisma/schema.prisma`.
2) `pnpm db:migrate` (applies SQL **and** `prisma generate`). 3) Add/update Zod in
`packages/shared` so BE and FE share one shape (response schemas map `bigint`/`Date` columns to
epoch-ms numbers). 4) Nest: `@ZodBody(apiContract.*.input)` for the request and
`@ZodResponse(...)` / `@ZodPaginatedResponse(...)` for the response. 5) Client leaf in
`endpoints.ts`. 6) `pnpm typecheck`, then `pnpm openapi:export`. See [prisma.md](./technical/database.md) §4.

**Q: Where does the `:8080` / `3000` / `3001` come from?**
A: Defaults in `main.ts` (API) and the Next.js apps. Override with `PORT` (API) and
`NEXT_PUBLIC_API_URL` (frontends).

**Q: How do I add a new API endpoint?**
A: If it needs a new column, Prisma migrate + generate **before** Zod. Then:
1) Zod in `packages/shared/src/schemas/<domain>.ts` + `apiContract` leaf (with its `response`).
2) Nest service + controller with `@ZodBody(apiContract.<leaf>.input)` (and friends) and one
`@ZodResponse` / `@ZodPaginatedResponse` with the leaf's response schema. 3) Typed leaf in
`packages/client/src/lib/api/endpoints.ts` (and `use-api.ts` / `server-api.ts`).
4) Wire the UI via `useApi`. 5) `pnpm openapi:export` — see [Response contracts](./technical/api/response-contracts.md).

---

## 15. Further reading

- **[Architecture](./technical/architecture.md)** — the full mental model and data flow.
- **[TypeScript configs](./technical/tooling/typescript.md)** — how tsconfig inheritance works.
- **[ESLint setup](./technical/tooling/eslint.md)** — the rules, per-repo configs, and how to run it.
- **[Prisma & database](./technical/database.md)** — every `db:*` command in detail, seeding, migrations.
- **[Storage platform](./technical/storage/overview.md)** — S3 file uploads, local vs production setup, KYB documents, CDK deploy.
- **[Dependency hygiene](./technical/tooling/dependencies.md)** — how syncpack pins shared deps.
- **[Auth roadmap](./auth-roadmap.md)** — auth/RBAC/multi-tenancy design decisions.
- **[Boilerplate roadmap](./boilerplate-roadmap.md)** — 15 improvements + 15 features for the template itself.

---

_Last updated: August 2, 2026_

