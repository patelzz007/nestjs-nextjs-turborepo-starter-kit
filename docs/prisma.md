---
title: "Prisma & Database Commands"
tags: ["prisma", "database", "orm"]
description: "The database layer: how Prisma is configured, where the schema lives, and every db: command."
order: 8
author: "Acme Inc."
lastUpdated: 1785628800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# Prisma & Database Commands

> [!NOTE] This document covers everything you need to know about the database layer in this
> monorepo: how Prisma is configured, where the schema lives, and the exact commands
> for migrating, generating, seeding, resetting, and inspecting the database.
> Written for a junior developer with 6 months of experience.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Where everything lives](#2-where-everything-lives)
3. [Database connection (DATABASE_URL)](#3-database-connection-database_url)
4. [The database commands](#4-the-database-commands)
   - [The typical day-to-day workflow](#the-typical-day-to-day-workflow)
   - [Command reference](#command-reference)
   - [Column / field change order](#column--field-change-order)
5. [Seeding the database](#5-seeding-the-database)
6. [Migrations explained](#6-migrations-explained)
7. [How the API connects to the DB](#7-how-the-api-connects-to-the-db)
8. [Troubleshooting](#8-troubleshooting)
9. [Adding a new model / field](#9-adding-a-new-model--field)
10. [Row Level Security](#10-row-level-security)

---

## 1. Overview

- **ORM:** [Prisma](https://www.prisma.io) (v7, `prisma-client-js` generator).
- **Database:** PostgreSQL (via the `@prisma/adapter-pg` driver adapter).
- **Schema:** lives in `apps/api/prisma/schema.prisma`.
- **Prisma is used for the DB layer only** — validation & shared types come from
  **Zod schemas** in `packages/shared` (the API DTOs extend `createZodDto(...)`).
- All Prisma commands are run from **`apps/api`** (that's where the schema and
  scripts live), using the `db:*` scripts in `apps/api/package.json`.

---

## 2. Where everything lives

```
apps/api/
├── prisma/
│   ├── schema.prisma           ← the schema (models, enums, relations)
│   ├── seed.ts                 ← the seeder (users, roles, URLs, clicks, tags…)
│   └── migrations/
│       ├── migration_lock.toml
│       └── <timestamp>_<name>/
│           └── migration.sql   ← generated SQL for each migration
├── .env                        ← DATABASE_URL etc. (git-ignored, NOT committed)
└── package.json                ← the db:* scripts
```

> [!WARNING] **`.env` is git-ignored** (`.gitignore` has `.env*`). You must create it
> locally. See the next section.

---

## 3. Database connection (DATABASE_URL)

The connection string is read from `apps/api/.env`:

```env title=".env"
# apps/api/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/monorepo?schema=public"
```

Format breakdown:

```env title=".env"
postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
```

| Part             | Example     | Meaning                        |
| ---------------- | ----------- | ------------------------------ |
| `USER`           | `postgres`  | DB user                        |
| `PASSWORD`       | `postgres`  | DB password                    |
| `HOST`           | `localhost` | Where Postgres runs            |
| `PORT`           | `5432`      | Postgres default port          |
| `DATABASE_NAME`  | `monorepo`  | The database name (must exist) |
| `?schema=public` | —           | Postgres schema to use         |

> [!NOTE] Note: `schema.prisma` no longer hardcodes `url = env("DATABASE_URL")` — with
> Prisma 7 the CLI reads `datasource.url` from `prisma.config.ts`, and the API /
> seeder pass the same `DATABASE_URL` into the `PrismaPg` adapter. `prisma.config.ts`
> loads `apps/api/.env` so `npx prisma …` works without `dotenv-cli`.

**One-time setup:** make sure the database actually exists:

```bash
psql -U postgres -c "CREATE DATABASE monorepo;"
# or via pgAdmin / your local Postgres GUI
```

---

## 4. The database commands

All commands run from **`apps/api`** (or via `pnpm --filter @workspace/api ...` from the root).

### The typical day-to-day workflow

Prisma is the source of truth for **columns**. Shared Zod is the source of
truth for **HTTP**. Do not invent a Zod field that has no Prisma column, and
do not ship a SQL-only column Prisma could have modeled.

```bash
# 1. Edit apps/api/prisma/schema.prisma first (new model / field / index).
# 2. Create + apply a migration AND regenerate the Prisma client:
pnpm db:migrate
#    (same as: prisma migrate dev, then prisma generate)
# 3. Only then add/update Zod in packages/shared (BE + FE share it).
# 4. Nest: ZodValidationPipe(apiContract.*.input) + createWrappedDto / ApiBody
#    so Swagger sample req/res match the same schema.
# 5. Wire the client leaf (endpoints.ts + use-api + server-api).

# Client types only (no schema change):
pnpm db:generate

# Fresh machine / CI with an up-to-date schema? One-shot bootstrap
# (run from the REPO ROOT — db:all is root-only, not in apps/api):
# pnpm db:all
```

### Column / field change order

1. **`schema.prisma`** — add the column, relation, or index.
2. **`pnpm db:migrate`** (from `apps/api`) — writes `migrations/<timestamp>_*/migration.sql`, applies it, runs `prisma generate`.
3. **`npx prisma generate`** is already part of `db:migrate`. Run `pnpm db:generate` only if you pulled migrations and need the client without creating a new one.
4. **`packages/shared` Zod** — request/response/query schemas. Types are `z.output<typeof Schema>` (no hand-written twins).
5. **Nest HTTP boundary** — `ZodValidationPipe(apiContract.<domain>.<leaf>.input)` (or the same shared schema). Swagger samples come from `createZodDto` / `createWrappedDto` + `@ApiBody` / `@ApiOkResponse`, not a second DTO shape.
6. **RLS** — if the table is tenant-scoped, add `ENABLE`/`FORCE ROW LEVEL SECURITY` + policies in SQL (Prisma PSL cannot emit them). See §10.

Things Prisma cannot represent (REVOKE, FORCE RLS, `SET ROLE`) stay in SQL **after**
the schema change they belong to — never as a substitute for a column. In this repo
that SQL is the **tail of the single `20260818235200_init` migration**, not a
separate folder. If you regenerate init from `migrate diff --from-empty --to-schema`,
append that tail again or `app_runtime` will get `42501 permission denied for schema public`.

### Squashing to one `init`

This tree keeps **one** folder under `prisma/migrations/`. Do not delete it and
run a schema-only migrate — Prisma will not emit GRANT/RLS.

To rebuild init after a schema change (dev only, wipes the DB):

```bash
cd apps/api
pnpm exec dotenv -e .env -- prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
# Merge that SQL with the existing RLS tail in 20260818235200_init/migration.sql
pnpm db:reset
pnpm db:generate
```

### Command reference

| Command                  | Script (`apps/api/package.json`)                      | What it does                                                                                       | Destructive?          |
| ------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------- |
| `pnpm db:migrate`        | `dotenv -e .env -- prisma migrate dev`                | Creates a new migration from schema changes **and applies it**, then regenerates the Prisma client | ❌ No (safe)          |
| `pnpm db:migrate:create` | `dotenv -e .env -- prisma migrate dev --create-only`  | Creates the migration file **without applying** it (so you can review/edit the SQL first)          | ❌ No                 |
| `pnpm db:deploy`         | `dotenv -e .env -- prisma migrate deploy`             | Applies **pending** migrations (used in CI/production — never generates)                           | ❌ No                 |
| `pnpm db:migrate:status` | `dotenv -e .env -- prisma migrate status`             | Shows which migrations are applied / pending                                                       | ❌ No                 |
| `pnpm db:generate`       | `dotenv -e .env -- prisma generate`                   | Regenerates the Prisma client types in `node_modules/.prisma`                                      | ❌ No                 |
| `pnpm db:push`           | `dotenv -e .env -- prisma db push --accept-data-loss` | Pushes schema straight to the DB **without a migration file** (dev-only)                           | ⚠️ Can drop data      |
| `pnpm db:seed`           | `dotenv -e .env -- tsx prisma/seed.ts`               | Runs the seeder (idempotent — safe to re-run)                                                      | ⚠️ Rewrites seed rows |

> [!NOTE] **Note:** the seeder runs through `tsx`, which resolves `@workspace/shared` via
> default (non-`development`) export conditions → it imports the **built**
> `packages/shared/dist/`. On a fresh clone, run `pnpm --filter @workspace/shared build`
> before `pnpm db:seed` (or run `pnpm build` once) or the seed fails with a
> "cannot find module" error.
| `pnpm db:reset`          | `dotenv -e .env -- prisma migrate reset --force && pnpm db:seed` | Drops **all** tables, re-applies all migrations, then runs the seeder                              | 🔴 **Wipes the DB**   |
| `pnpm db:studio`         | `prisma studio`                                       | Opens the Prisma Studio GUI at `localhost:5555` to browse/edit data                                | ❌ No (read/write UI) |

> [!NOTE] **Why `dotenv -e .env --`?** Prisma CLI doesn't load `.env` automatically in all
> contexts here, so the scripts explicitly load `apps/api/.env` first.

### From the repo root

```bash
pnpm db:all           # one-shot bootstrap (see below)
pnpm db:deploy
pnpm db:migrate
pnpm db:seed
pnpm db:generate
pnpm db:reset
pnpm db:studio
```

### One-shot setup (`db:all`)

`pnpm db:all` runs the **entire database bootstrap in a single turbo command**:

```bash
pnpm db:all    # = turbo run db:seed  (expands to: db:generate + db:deploy → db:seed)
```

Because `db:seed` `dependsOn` `db:generate` + `db:deploy` in `turbo.json`, this
regenerates the Prisma client, applies any **pending** migrations, and seeds the
database — in the right order (generate & deploy run **in parallel**, then seed),
exactly once each, non-interactively. It is the fastest way to get a fresh
machine or CI environment from "empty repo" to "seeded, running DB".

> [!WARNING] Don't "simplify" `db:all` to `pnpm --filter @workspace/api db:all` —
> `apps/api` has no `db:all` script. The whole point is running through **turbo**
> so `db:seed`'s `dependsOn` chain (generate + deploy) executes first.

> [!WARNING] `db:all` applies pending migrations (`migrate deploy`) — it never **creates**
> one. If you changed `schema.prisma` and need a brand-new migration, run
> `pnpm db:migrate` (interactive) once first, then `pnpm db:all`.

### Via turbo (CI-friendly)

**Every `db:*` script is registered as a turbo task**, so the whole database
toolchain can run through the pipeline. Each task runs **exactly once** in
`apps/api` — the only workspace that defines the scripts (the root `pnpm db:*`
shortcuts are plain `pnpm --filter` calls and are never double-executed by turbo):

```bash
pnpm turbo run db:deploy           # apply pending migrations
pnpm turbo run db:migrate          # migrate dev (interactive — may prompt)
pnpm turbo run db:migrate:create   # create-only (interactive)
pnpm turbo run db:migrate:status   # show applied / pending migrations
pnpm turbo run db:generate         # regenerate the Prisma client
pnpm turbo run db:push             # push schema without a migration file
pnpm turbo run db:seed             # seed (auto-runs db:generate + db:deploy first)
pnpm turbo run db:reset            # wipe + re-migrate (auto-runs db:generate)
pnpm turbo run db:studio           # open Prisma Studio (persistent server)

# scope to a single workspace if you ever need to
pnpm turbo run db:seed --filter=@workspace/api
```

Two tasks have **dependency chains** declared in `turbo.json`:

- **`db:seed`** `dependsOn` **`db:generate` + `db:deploy`** — the Prisma client and
  schema are guaranteed up to date before seeding runs.
- **`db:reset`** `dependsOn` **`db:generate`**.

Task flags:

- `db:migrate` / `db:migrate:create` are `interactive: true` — they may prompt for
  a migration name, and turbo passes your terminal input through.
- `db:studio` is `persistent: true` — a long-running dev server; stop it with
  `Ctrl+C`.
- Every db task runs with caching disabled, and `DATABASE_URL` is declared as the
  relevant env var (the scripts load `apps/api/.env` themselves via `dotenv`).

---

## 5. Seeding the database

The seeder (`apps/api/prisma/seed.ts`) populates a realistic dataset:

- **Permissions** — the full `PermissionAction × PermissionResource` matrix,
  grouped (User Management, Role Management, URL Management, etc.).
- **Roles** — `SuperAdmin`, `Admin`, `Manager`, `User`, plus the role hierarchy
  (each role inherits from its parent).
- **Users** — 4 system accounts + 10 dummy users (14 total).
- **Role/User permission assignments** and per-user overrides.
- **Refresh tokens** — 2 per active user (desktop + mobile).
- **Tags, URLs, UrlTags, and Clicks** — enough data to make the dashboards and
  analytics look real.

Run it with:

```bash
cd apps/api && pnpm db:seed
```

It is **idempotent** — running it twice converges to the same state instead of
duplicating rows or throwing:

- **Reference data** (permissions, roles, users, tags, URLs, menu items) is
  created with `upsert` / `skipDuplicates`, so re-running just fills in what's
  missing.
- **Volatile demo data** (refresh tokens, clicks, API keys, usage logs, password
  reset tokens) is **deleted at the start of `main()`** and re-generated from
  scratch. This keeps row counts stable across runs and guarantees the seed never
  crashes on a unique-constraint conflict.

> [!WARNING] Because volatile tables are wiped, any API keys / refresh tokens you created
> manually during development will be removed when you re-run `db:seed`.

### Seeded login accounts

| Email                    | Password         | Role       |
| ------------------------ | ---------------- | ---------- |
| `superadmin@example.com` | `SuperAdmin@123` | SuperAdmin |
| `admin@example.com`      | `Admin@123`      | Admin      |
| `manager@example.com`    | `Manager@123`    | Manager    |
| `user@example.com`       | `User@123`       | User       |

Plus 10 dummy users: `alice.johnson@example.com` / `Bob@123`-style passwords
(`Alice@123`, `Bob@123`, `Carol@123`, …).

---

## 6. Migrations explained

Migrations are versioned SQL files under `apps/api/prisma/migrations/`:

```
migrations/
├── migration_lock.toml                              ← locks the provider (postgresql)
├── 20260728220040_init/                             ← first migration
│   └── migration.sql
└── 20260729192341_add_brute_force_protection/       ← second migration
    └── migration.sql
```

- **`prisma migrate dev`** (`db:migrate`) creates a migration from the diff between
  your `schema.prisma` and the current DB state, then applies it.
- **`prisma migrate deploy`** (`db:deploy`) just applies pending migrations
  — this is what you'd run in a CI/CD pipeline or on a production server.
- **`prisma migrate reset`** (`db:reset`) drops everything and replays all
  migrations from scratch, then seeds.

> [!NOTE] **Prisma 7 no longer auto-seeds** on `migrate reset` / `migrate dev` — seeding
> is only triggered explicitly via `prisma db seed`. That's why the `db:reset`
> script chains the seeder manually (`migrate reset --force && pnpm db:seed`);
> the two-step sequence is what the docs below describe as "re-seeds".

> [!NOTE] When you change the schema, **commit the generated migration folder** — it's part
> of the repo so other environments can replay the exact same SQL.

---

## 7. How the API connects to the DB

The API uses Prisma 7's **driver adapter** pattern. `PrismaService` wraps `PrismaClient`
with a `PrismaPg` adapter over an `RlsPool` (`pg.Pool` subclass):

```typescript
// conceptually, in apps/api/src/prisma/prisma.service.ts
const pool = new RlsPool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
	adapter: new PrismaPg(pool),
});
```

Every checkout runs `SET ROLE app_runtime` and `set_config` for `app.current_user_id` /
`app.rls_bypass` (see [§10](#10-row-level-security)). The seeder uses a **plain** `pg.Pool`
(superuser, no `SET ROLE`) so `db:seed` is not subject to FORCE RLS.

Because of this, `schema.prisma`'s `datasource` block only declares the provider —
no `url`:

```prisma title="schema.prisma"
datasource db {
  provider = "postgresql"
}
```

The seeder uses the same pattern (`new PrismaClient({ adapter: new PrismaPg({...}) })`).

---

## 8. Troubleshooting

### "permission denied for schema public" (`42501` / Prisma `P2039`)

The API pool runs `SET ROLE app_runtime`. That role is **cluster-wide** (it survives
`DROP DATABASE`), but `USAGE` on `public` and table grants are **per database**.
A `prisma migrate reset` that re-baselines without the RLS migration leaves
`app_runtime` in the cluster and a new `public` schema with no grants (Postgres 15+).

Fix: the squashed `20260818235200_init` migration **must** include the RLS
tail (`GRANT USAGE ON SCHEMA public TO app_runtime`, policies). A Prisma
schema-only init will boot into `42501`. Prefer `pnpm db:reset` from the repo
root so that single file is replayed in full.

```bash
cd apps/api && pnpm db:deploy
```

Prefer `pnpm db:reset` from the repo root over a bare `npx prisma migrate reset`,
so the RLS SQL is replayed together with the schema.

Prisma 7 takes the URL from `apps/api/prisma.config.ts` (`process.env.DATABASE_URL`),
not from `schema.prisma`. That file loads `apps/api/.env`. If the error still appears:

1. Copy `apps/api/.env.example` → `apps/api/.env` and set `DATABASE_URL`.
2. Run from `apps/api` (or use the workspace scripts from the repo root).

```bash
pnpm db:reset          # from repo root — preferred
cd apps/api && pnpm db:migrate
```

### "Can't reach database server at `localhost:5432`"Postgres isn't running, or the port/user/password in `DATABASE_URL` is wrong.

Start your local Postgres (e.g. `brew services start postgresql` or via Docker), then re-run. Verify with:

```bash
psql "postgresql://postgres:postgres@localhost:5432/monorepo" -c "SELECT 1;"
```

### "Database does not exist"

Create it first:

```bash
psql -U postgres -c "CREATE DATABASE monorepo;"
```

### "The database schema is not up to date" / "P3009"

Run `pnpm db:migrate` (dev) or `pnpm db:deploy` (production) to apply pending
migrations.

### The Prisma client doesn't know about a new field

Run `pnpm db:generate` (or `pnpm db:migrate`, which regenerates automatically).
If your editor still complains, restart the TS server.

### I broke the database and just want a clean slate

```bash
cd apps/api && pnpm db:reset
```

This drops all data, replays all migrations, and re-seeds. 🔴 Everything is wiped.

---

## 9. Adding a new model / field

> [!IMPORTANT] **Timestamp convention — epoch milliseconds everywhere.**
> Every date column is `BigInt` storing epoch ms (never `DateTime`). Use
> `@default(dbgenerated("(EXTRACT(EPOCH FROM now()) * 1000)::bigint"))` for
> `createdAt`-style defaults so the DB computes the value on insert. In the
> shared Zod schemas use `EpochMsSchema` (branded `EpochMs`), stamp `now` with
> `nowEpochMs()`, and render dates on the FE exclusively via date-fns helpers
> in `apps/admin/lib/dates.ts` — never raw `Intl`/`toLocale*`/ISO slicing.

Follow the [column / field change order](#column--field-change-order) in §4. Short version:

1. Edit `apps/api/prisma/schema.prisma`.
2. `cd apps/api && pnpm db:migrate` (creates SQL, applies it, `prisma generate`).
3. Review SQL first if needed: `pnpm db:migrate:create` → inspect → `pnpm db:deploy` → `pnpm db:generate`.
4. Seed if the new shape needs rows: `pnpm db:seed`.
5. **Then** Zod in `packages/shared`, Nest `ZodValidationPipe` + Swagger wrappers, client contract leaf.
6. `pnpm typecheck` and `pnpm lint`.
7. Tenant tables: keep the RLS tail at the bottom of `20260818235200_init`
   (Prisma PSL cannot emit GRANT / POLICY).

---

## 10. Row Level Security

TypeScript `where: { userId }` is not enough. Postgres enforces isolation.

**Why `SET ROLE`:** the `DATABASE_URL` user is usually a superuser. Superusers **bypass
RLS even with `FORCE ROW LEVEL SECURITY`**. The API therefore sets `ROLE app_runtime`
(a `NOLOGIN NOSUPERUSER NOBYPASSRLS` role) on every pool checkout.

**Session vars** (transaction-false / connection-scoped, overwritten every checkout):

| Setting | Meaning |
| --- | --- |
| `app.current_user_id` | JWT `sub`, or empty |
| `app.rls_bypass` | `true` for `@Public()`, telescope-token calls (no `request.user`), admin JWTs (`hasAdminAccess` / `isSuperAdmin`), and anything with no ALS (cron, `onModuleInit`) |

**Who sets ALS:** `RlsInterceptor` (`apps/api/src/common/interceptors/rls.interceptor.ts`,
outermost `APP_INTERCEPTOR`) wraps `next.handle()` in `rlsStorage.run(...)`. Guards run
first, so `request.user` is already set on the JWT path.

**Policies** (also noted as `/// RLS:` on each model in `schema.prisma` — Prisma cannot emit
`ENABLE ROW LEVEL SECURITY` from PSL, so the SQL lives in
the squashed `20260818235200_init` migration):

- User data (`urls`, `tags`, `api_keys`, tokens, `user_roles`, …): `app_owns(owner_id)`.
- Join tables (`url_tags`, `clicks`, `api_key_usage_logs`): exist via a parent the user owns.
- Catalog (`roles`, `permissions`, menu): `SELECT` open; writes need bypass.
- Ops (`backups`, audit): bypass only. `logs` / `email_logs` / telescope_* : **INSERT**
  allowed for any session (capture on user traffic); SELECT/UPDATE/DELETE still bypass.

**Apply the migration** before starting the API after this change, or every query fails
with `role "app_runtime" does not exist`:

```bash
cd apps/api && pnpm db:deploy
```

---

_Last updated: August 18, 2026_

