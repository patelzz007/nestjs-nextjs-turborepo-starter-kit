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
│   ├── seed.ts                 ← seed CLI: --scenario empty|development|enterprise, --seed <n>
│   ├── seed/                   ← per-domain seeders, scenarios/, deterministic PRNG (prng.ts)
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
# 4. Nest: @ZodBody(apiContract.*.input) + @ZodResponse(...) / @ZodPaginatedResponse(...)
#    so Swagger, validation and response enforcement use the same schema (ADR 022).
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
4. **`packages/shared` Zod** — request/response/query schemas. Types are `z.output<typeof Schema>` (no hand-written twins). Runtime helpers live under `schemas/runtime/`; internal events under `schemas/domain/platform/events.ts`.
5. **Nest HTTP boundary** — `@ZodBody` / `@ZodQuery` / `@ZodParams` with `apiContract.<domain>.<leaf>.input` (or the same shared schema) and one `@ZodResponse` / `@ZodPaginatedResponse` with the leaf's response schema. Never return a Prisma model from a controller: map `bigint` / `Date` columns to the response DTO in the repository or service — the response decorator does not compile otherwise ([Response contracts](./technical/api/response-contracts.md)).
6. **Application types** — services, templates, and adapters import `X` (type) from `@workspace/shared`; `XSchema` only where `.parse()` / `safeParse()` runs. See `docs/typescript.md` §8.
7. **RLS** — if the table is tenant-scoped, add `ENABLE`/`FORCE ROW LEVEL SECURITY` + policies in SQL (Prisma PSL cannot emit them). See §10.

Things Prisma cannot represent (REVOKE, FORCE RLS, `SET ROLE`, grants to
`app_runtime`) do **not** live in a migration. They live in
`apps/api/prisma/rls.sql` and `apps/api/prisma/rls/NN-*.sql` (ordered by
`RLS_APPLY_ORDER` in `apps/api/scripts/rls-apply-plan.ts`) and are applied by
`pnpm db:apply-security` after every `db:migrate`, `db:deploy`, `db:push` and
`db:reset`. See §10.

### Migration history is append-only

Migrations under `prisma/migrations/` are **generated, never hand-written**: edit `schema.prisma`, then `pnpm db:migrate:create --name <change>` (review) or `pnpm db:migrate`. Express every rule Prisma can model in the schema (required columns, relations, partial unique indexes via the `partialIndexes` preview feature, canonical `dbgenerated` defaults). Rules Prisma cannot model (CHECK constraints, data backfills) are not hidden in hand-edited SQL: they are enforced in the service layer (with tests) or raised as an explicit, reviewed data step. They are also **forward-only**. Once a migration
folder has been pushed to a shared branch, never edit, rename, delete or
re-squash it — every database that applied it records its name and checksum in
`_prisma_migrations`, and a rewritten history makes `prisma migrate deploy`
fail (or silently skip work) on those databases. Every schema change is a new
`pnpm db:migrate` folder on top of the existing ones; a change that has to be
undone is undone by another forward migration.

The history was baselined once, before the first deploy, as
`20261002055618_init`. That squash was a one-off, pre-first-deploy action.

#### Squashing — pre-first-deploy forks only

Squashing is allowed **only** in a fork of this kit that has never been
deployed anywhere (no staging, no production, no teammate database you
cannot wipe). After the first deploy, the rule above applies without exception.

```bash
cd apps/api
# 1. Move every folder under prisma/migrations/ out of the tree (keep migration_lock.toml).
# 2. Generate the baseline from the schema:
mkdir -p prisma/migrations/<timestamp>_init
pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  > prisma/migrations/<timestamp>_init/migration.sql
# 3. Rebuild the local database (migrations + client + RLS + seed):
pnpm db:reset
```

#### Drift check

`pnpm db:check-drift` (`apps/api/scripts/check-migration-drift.ts`) replays
`prisma/migrations` into the throwaway `SHADOW_DATABASE_URL` database and
compares the result with `schema.prisma`; it fails when they disagree. A
`dbgenerated(...)` default that is not written in Postgres's canonical form
(see the timestamp convention in §9) shows up here as drift.

### Command reference

| Command                  | Script (`apps/api/package.json`)                      | What it does                                                                                       | Destructive?          |
| ------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------- |
| `pnpm db:migrate`        | `dotenv -e .env -- prisma migrate dev`                | Creates a new migration from schema changes **and applies it**, then regenerates the Prisma client | ❌ No (safe)          |
| `pnpm db:migrate:create` | `dotenv -e .env -- prisma migrate dev --create-only`  | Creates the migration file **without applying** it (so you can review/edit the SQL first)          | ❌ No                 |
| `pnpm db:deploy`         | `dotenv -e .env -- prisma migrate deploy`             | Applies **pending** migrations (used in CI/production — never generates)                           | ❌ No                 |
| `pnpm db:migrate:status` | `dotenv -e .env -- prisma migrate status`             | Shows which migrations are applied / pending                                                       | ❌ No                 |
| `pnpm db:check-drift`    | `dotenv -e .env -- tsx scripts/check-migration-drift.ts` | Replays `prisma/migrations` into `SHADOW_DATABASE_URL` and fails (exit 2) if the result differs from `schema.prisma` | ❌ No (wipes only the shadow DB) |
| `pnpm db:check-seed-coverage` | `dotenv -e .env -- tsx scripts/check-seed-coverage.ts` | Read-only audit of the seeded DB: fails if a table has no rows or a nullable column is NULL in every row — see [Seed coverage](#seed-coverage--every-table-every-column) | ❌ No (read-only transaction) |
| `pnpm db:generate`       | `dotenv -e .env -- prisma generate`                   | Regenerates the Prisma client types in `node_modules/.prisma`                                      | ❌ No                 |
| `pnpm db:push`           | `dotenv -e .env -- prisma db push --accept-data-loss` | Pushes schema straight to the DB **without a migration file** (dev-only)                           | ⚠️ Can drop data      |
| `pnpm db:seed`           | `dotenv -e .env -- tsx prisma/seed.ts`               | Runs the seeder (idempotent — safe to re-run). Default scenario `development`; pick another with `pnpm db:seed -- --scenario empty\|enterprise [--seed <n>]` — see [Seed scenarios](./technical/database.md#seed-data) | ⚠️ Rewrites seed rows |

> [!NOTE] **Note:** the seeder runs through `tsx`, which resolves `@workspace/shared` via
> default (non-`development`) export conditions → it imports the **built**
> `packages/shared/dist/`. On a fresh clone, run `pnpm --filter @workspace/shared build`
> before `pnpm db:seed` (or run `pnpm build` once) or the seed fails with a
> "cannot find module" error.
| `pnpm db:reset`          | `migrate reset --force` → `db:generate` → `db:apply-security` → `db:seed` | Drops **all** tables, replays migrations, regenerates client, applies RLS, then seeds | 🔴 **Wipes the DB**   |
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
pnpm turbo run db:reset            # wipe + re-migrate + generate + RLS + seed
pnpm turbo run db:studio           # open Prisma Studio (persistent server)

# scope to a single workspace if you ever need to
pnpm turbo run db:seed --filter=@workspace/api
```

Two tasks have **dependency chains** declared in `turbo.json`:

- **`db:seed`** `dependsOn` **`db:generate` + `db:deploy`** — the Prisma client and
  schema are guaranteed up to date before seeding runs.
- **`db:reset`** `dependsOn` **`^build` + `db:generate`** (its script then chains `db:generate`, `db:apply-security` and `db:seed` after the reset; the seed imports the built `@workspace/shared`).

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
- **Roles** — `SuperAdmin`, `Admin`, `Manager`, `User` (flat by default; optional hierarchy for extension roles only)
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

### Seed coverage — every table, every column

After `pnpm db:seed`, **every table holds at least one row and every nullable column holds a
real value in at least one row** — soft-delete fields (seed at least one soft-deleted row),
optional columns, audit/context columns (IP, user agent, correlation id, impersonator) and
short-lived tables (a live 2FA challenge, a pending setup, …). A model or column that only
ever holds NULL in the demo data is untested by every screen and query that reads it.

`pnpm --filter @workspace/api db:check-seed-coverage` enforces it. It runs in CI right after the
development seed (and in `pnpm ci:local`), and you should run it after changing the schema or a seeder:

```bash
pnpm --filter @workspace/api db:seed
pnpm --filter @workspace/api db:check-seed-coverage
```

How it works (`apps/api/scripts/seed-coverage.ts`, `seed-coverage-catalog.ts`, `check-seed-coverage.ts`):

- The table/column list comes from **both** sides: the generated client's DMMF (`Prisma.dmmf`,
  cross-checked against the `model` declarations in `schema.prisma`, so a stale client fails) and the
  live Postgres catalog. A table or column present on only one side fails the check — a new model can
  never be skipped. `_prisma_migrations` is ignored.
- It connects with `DATABASE_URL` (the owner/migration login the seed and `db:apply-security` use) in a
  `READ ONLY` transaction with `row_security = off`: it never writes, and if RLS would filter a table
  Postgres raises an error instead of returning a partial view.
- One `count(*)` + `count(column)` scan per table; NOT NULL columns are guaranteed by the database and
  are not counted.

**Exemptions** live in one typed allowlist, `apps/api/prisma/seed/coverage-exemptions.ts`. Each entry
names an `empty-table` or a `null-column` and carries a written `reason` (at least
40 characters) that a reviewer can judge — a structural reason such as "no correct database holds this
value". "We did not seed it" is never a reason: seed it. An entry that no longer matches a gap (unknown
table/column, or the seed now covers it) fails the check, so the list only shrinks.

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
├── 20261002055618_init/                             ← baseline (the one-off pre-deploy squash)
│   └── migration.sql
└── 20261002123150_organization_terminal_live_unique/ ← every later change: a new forward folder
    └── migration.sql
```

- **`prisma migrate dev`** (`db:migrate`) creates a migration from the diff between
  your `schema.prisma` and the current DB state, then applies it.
- **`prisma migrate deploy`** (`db:deploy`) just applies pending migrations
  — this is what you'd run in a CI/CD pipeline or on a production server.
- **`prisma migrate reset`** (`db:reset`) drops everything and replays all
  migrations from scratch, then seeds.

> [!NOTE] **Prisma 7** does not auto-seed or auto-generate on `migrate reset` / `migrate dev`.
> The `db:reset` script runs reset, then **`db:generate`**, **`db:apply-security`** (RLS), and
> **`db:seed`** in that order. The old `--skip-seed` flag no longer exists.

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

Fix: re-apply the grants and policies, which live outside the migrations
(`apps/api/prisma/rls.sql` + `apps/api/prisma/rls/*.sql`):

```bash
cd apps/api && pnpm db:apply-security
```

Prefer `pnpm db:reset` from the repo root over a bare `npx prisma migrate reset`:
it chains `db:generate`, `db:apply-security` and `db:seed` after the reset, so the
RLS SQL is replayed together with the schema.

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
> `@default(dbgenerated("((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint"))`
> for `createdAt`-style defaults so the DB computes the value on insert.
> Write the expression **exactly** in that form: it is the text Postgres stores
> after normalising the default (`pg_get_expr`), and Prisma compares the
> `dbgenerated` string literally. Any other spelling — e.g.
> `(EXTRACT(EPOCH FROM now()) * 1000)::bigint` — is semantically identical but
> makes every `prisma migrate dev` / `migrate diff` emit a spurious
> `ALTER COLUMN … SET DEFAULT` for every such column. The same applies to any
> new `dbgenerated` default: apply it once, read
> `information_schema.columns.column_default`, and copy that text back. In the
> shared Zod schemas use `EpochMsSchema` (branded `EpochMs`), stamp `now` with
> `nowEpochMs()`, and render dates on the FE exclusively via date-fns helpers
> in `apps/admin/lib/dates.ts` — never raw `Intl`/`toLocale*`/ISO slicing.
>
> **One documented exception:** the vendored geography tables (`Region`,
> `Subregion`, `Country`, `State`, `City`, seeded from
> dr5hn/countries-states-cities-database) keep the dataset's
> `DateTime @db.Timestamp(0)` columns and its fixed `createdAt` default
> `dbgenerated("'2014-01-01 12:01:01'::timestamp without time zone")`. Never
> copy that shape into a new table (`rules/08-database-prisma.md`, Migrations).

> [!NOTE] **Unique constraints on soft-deletable models.** Decide whether a
> soft-deleted row should still hold its unique value. Usually it should not:
> use a partial unique index, `@@unique([organizationId, terminalId], where: { isDeleted: false })`
> (the `partialIndexes` preview feature is enabled in the generator block).

Follow the [column / field change order](#column--field-change-order) in §4. Short version:

1. Edit `apps/api/prisma/schema.prisma`.
2. `cd apps/api && pnpm db:migrate` (creates SQL, applies it, `prisma generate`).
3. Review SQL first if needed: `pnpm db:migrate:create` → inspect → `pnpm db:deploy` → `pnpm db:generate`.
4. Seed if the new shape needs rows: `pnpm db:seed`.
5. **Then** Zod in `packages/shared`, Nest `ZodValidationPipe` + Swagger wrappers, client contract leaf.
6. `pnpm typecheck` and `pnpm lint`.
7. Tenant tables: add RLS in `apps/api/prisma/rls.sql` (or `prisma/rls/NN-*.sql`, registered in `RLS_APPLY_ORDER` — `apps/api/scripts/rls-apply-plan.ts`);
   see [RBAC, ACL, and RLS](./technical/security/database-security.md). **Do not** patch
   `migrations/*/migration.sql` for policies.

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
| `app.current_organization_id` | Tenant scope (see below) |
| `app.rls_bypass` | See bypass rules below |

**RLS bypass rules** (`RlsInterceptor` + `TenancyConfigService`):

| Mode | Env | Who bypasses RLS (`app.rls_bypass = true`) |
| --- | --- | --- |
| **Single-tenant** (default) | `TENANCY_ENABLED=false` | `@RlsBypass()`, no `request.user`, `isSuperAdmin`, or **`hasAdminAccess`** |
| **Multi-tenant** | `TENANCY_ENABLED=true` | `@RlsBypass()`, no `request.user`, or **`isSuperAdmin` only** — staff with admin access operate within org scope |

`DEFAULT_ORGANIZATION_ID` names the real organization a single-tenant deployment (tenancy disabled) serves; the API verifies at boot that it is a live row and refuses to start otherwise. In multi-tenant mode only the guard-verified organization is used — there is no fallback. SQL helper: `app_current_organization_id()`. See [ADR 007: Tenancy and RLS bypass](./adr/007-tenancy-and-rls-bypass.md).

**Who sets ALS:** `RlsInterceptor` (`apps/api/src/common/interceptors/rls.interceptor.ts`,
outermost `APP_INTERCEPTOR`) wraps `next.handle()` in `rlsStorage.run(...)`. Guards run
first, so `request.user` is already set on the JWT path.

> [!NOTE] **`@Public()` ≠ RLS bypass.** `@Public()` only skips `AuthGuard`. Routes that
> must touch the database across tenants (signup, login, signed webhooks) also need
> `@RlsBypass()`. Session refresh/logout are `@Public()` but use the refresh token's
> `sub` for scoped RLS — they do **not** use `@RlsBypass()`.

### Public routes and database access

| Route | `@Public()` | `@RlsBypass()` | Touches DB? | Notes |
| --- | --- | --- | --- | --- |
| `GET /` | yes | no | no | Welcome string only |
| `GET /health` | yes | no | yes | `SELECT 1` connectivity probe (no tenant tables) |
| `GET /version` | yes | no | no | Static version manifest |
| `POST /api/v1/auth/signup` | yes | yes | yes | Creates user + role links |
| `POST /api/v1/auth/login` | yes | yes | yes | Lookup by email, lockout counters |
| `POST /api/v1/auth/resend-verification` | yes | yes | yes | User + verification token rows |
| `POST /api/v1/auth/forgot-password` | yes | yes | yes | User + reset token rows |
| `POST /api/v1/auth/reset-password` | yes | yes | yes | User + token rotation |
| `POST /api/v1/auth/verify-email/:token` | yes | yes | yes | User email-verified flag |
| `POST /api/v1/auth/refresh` | yes | no | yes | Scoped to refresh token owner (`sub`) |
| `POST /api/v1/auth/logout` | yes | no | yes | Revokes caller's refresh token row |
| `POST /api/v1/auth/logout-all` | yes | no | yes | Revokes all refresh tokens for `sub` |
| `POST /api/v1/auth/impersonate/:userId` | no | no | yes | Super-admin; sets impersonation access cookie |
| `POST /api/v1/auth/stop-impersonation` | no | no | yes | Ends impersonation; restores admin access cookie |
| `GET /notifications/email-webhook` | yes | no | no | Info endpoint for operators |
| `POST /notifications/email-webhook` | yes | yes | yes | Signature-verified; records `email_delivery_events` and moves `email_logs` forward (writes run under the `email.log.write` system operation) |

Add new public routes in this table when you ship them. If a route needs cross-tenant
DB work, add `@RlsBypass()`; if it only touches the caller's rows, keep scoped RLS.

### Permissions (`@RequirePermission`)

Handlers declare required action+resource with `@RequirePermission("READ", "USER")` etc. The global
`AuthorizationGuard` reads route metadata; `MANAGE` on the same resource grants every action;
`isSuperAdmin` bypasses. Effective permissions are resolved at guard time via
`AuthorizationCheckerService` (cached) — **not** from JWT claims. Seed matrix:
`packages/shared/src/schemas/domain/rbac/rbac/permissions-registry.ts` (synced to DB on startup).

**Policies** (also noted as `/// RLS:` on each model in `schema.prisma` — Prisma cannot emit
`ENABLE ROW LEVEL SECURITY` from PSL, so the SQL lives in `apps/api/prisma/rls.sql` and
`apps/api/prisma/rls/*.sql`, applied by `pnpm db:apply-security` after every migrate/deploy/reset):

- User data (`urls`, `tags`, `api_keys`, tokens, `user_roles`, …): `app_owns(owner_id)`.
- Join tables (`url_tags`, `clicks`, `api_key_usage_logs`): exist via a parent the user owns.
- Catalog (`roles`, `permissions`, menu): `SELECT` open; writes need bypass.
- Ops (audit): bypass only. `logs` / `email_logs`: **INSERT**
  allowed for any session (capture on user traffic); SELECT/UPDATE/DELETE still bypass.

**Apply schema + security** before starting the API after a fresh clone, or queries fail
with `role "app_runtime" does not exist`:

```bash
pnpm db:reset
# or: cd apps/api && pnpm db:deploy   # applies migrations + RLS
```

See [RBAC, ACL, and RLS](./technical/security/database-security.md) for the full template model.

---

_Last updated: August 27, 2026_

