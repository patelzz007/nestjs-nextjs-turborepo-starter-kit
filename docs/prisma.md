---
title: "Prisma & Database Commands"
description: "The database layer: how Prisma is configured, where the schema lives, and every db: command."
order: 8
author: "Acme Inc."
lastUpdated: "2026-08-02"
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# Prisma & Database Commands

> This document covers everything you need to know about the database layer in this
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
5. [Seeding the database](#5-seeding-the-database)
6. [Migrations explained](#6-migrations-explained)
7. [How the API connects to the DB](#7-how-the-api-connects-to-the-db)
8. [Troubleshooting](#8-troubleshooting)
9. [Adding a new model / field](#9-adding-a-new-model--field)

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

> ⚠️ **`.env` is git-ignored** (`.gitignore` has `.env*`). You must create it
> locally. See the next section.

---

## 3. Database connection (DATABASE_URL)

The connection string is read from `apps/api/.env`:

```env
# apps/api/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/monorepo?schema=public"
```

Format breakdown:

```
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

> Note: `schema.prisma` no longer hardcodes `url = env("DATABASE_URL")` — with
> Prisma 7 the connection is passed **programmatically** via the driver adapter
> (`PrismaPg`) in both the API's `PrismaService` and the seeder. The `DATABASE_URL`
> env var is still the single source of truth.

**One-time setup:** make sure the database actually exists:

```bash
psql -U postgres -c "CREATE DATABASE monorepo;"
# or via pgAdmin / your local Postgres GUI
```

---

## 4. The database commands

All commands run from **`apps/api`** (or via `pnpm --filter @workspace/api ...` from the root).

### The typical day-to-day workflow

```bash
# 1. You edited schema.prisma (added a model/field) →
#    create + apply a migration (also regenerates the client)
pnpm db:migrate

# 2. Or, if you only need the client types refreshed (no schema change):
pnpm db:generate

# 3. Fresh machine / CI with an up-to-date schema? One-shot bootstrap
#    (run from the REPO ROOT — db:all is root-only, not in apps/api):
#    pnpm db:all
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

> **Note:** the seeder runs through `tsx`, which resolves `@workspace/shared` via
> default (non-`development`) export conditions → it imports the **built**
> `packages/shared/dist/`. On a fresh clone, run `pnpm --filter @workspace/shared build`
> before `pnpm db:seed` (or run `pnpm build` once) or the seed fails with a
> "cannot find module" error.
| `pnpm db:reset`          | `dotenv -e .env -- prisma migrate reset --force`      | Drops **all** tables, re-applies all migrations, then runs the seeder                              | 🔴 **Wipes the DB**   |
| `pnpm db:studio`         | `prisma studio`                                       | Opens the Prisma Studio GUI at `localhost:5555` to browse/edit data                                | ❌ No (read/write UI) |

> **Why `dotenv -e .env --`?** Prisma CLI doesn't load `.env` automatically in all
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

> ⚠️ Don't "simplify" `db:all` to `pnpm --filter @workspace/api db:all` —
> `apps/api` has no `db:all` script. The whole point is running through **turbo**
> so `db:seed`'s `dependsOn` chain (generate + deploy) executes first.

> ⚠️ `db:all` applies pending migrations (`migrate deploy`) — it never **creates**
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

> ⚠️ Because volatile tables are wiped, any API keys / refresh tokens you created
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

> When you change the schema, **commit the generated migration folder** — it's part
> of the repo so other environments can replay the exact same SQL.

---

## 7. How the API connects to the DB

The API uses Prisma 7's **driver adapter** pattern. The `PrismaService` wraps
`PrismaClient` with a `PrismaPg` adapter so the DB driver handles the connection
pool:

```typescript
// (conceptually, in apps/api/src/prisma/prisma.service.ts)
const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
```

Because of this, `schema.prisma`'s `datasource` block only declares the provider —
no `url`:

```prisma
datasource db {
  provider = "postgresql"
}
```

The seeder uses the same pattern (`new PrismaClient({ adapter: new PrismaPg({...}) })`).

---

## 8. Troubleshooting

### "Environment variable not found: DATABASE_URL"

The `.env` file is missing or the script didn't load it. Make sure `apps/api/.env`
exists with a valid `DATABASE_URL`, and run via the npm script (which loads it):

```bash
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

1. Edit `apps/api/prisma/schema.prisma`.
2. Generate + apply a migration:
   ```bash
   cd apps/api && pnpm db:migrate
   ```
   This creates a timestamped migration folder, applies it, and regenerates the client.
3. If you want to review the SQL first:
   ```bash
   pnpm db:migrate:create   # creates the file without applying
   # inspect apps/api/prisma/migrations/<new>/migration.sql
   pnpm db:deploy           # then apply it
   ```
4. Update the seeder (`apps/api/prisma/seed.ts`) if new seed data is needed, then
   `pnpm db:seed`.
5. Update the **Zod schemas** in `packages/shared/src/schemas/` so the API DTOs and
   the FE types stay in sync with the new shape.
6. Run `pnpm typecheck` and `pnpm lint` to verify.

---

_Last updated: July 31, 2026_
