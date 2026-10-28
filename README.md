<p align="center">
  <img src="https://raw.githubusercontent.com/patelzz007/nestjs-nextjs-turborepo-starter-kit/main/docs/assets/readme-banner.png" alt="NestJS + Next.js + PostgreSQL starter kit — Turborepo monorepo with type-safe full-stack TypeScript" width="100%" />
</p>

<p align="center">
  <strong>NestJS + Next.js + PostgreSQL starter kit</strong> — a Turborepo monorepo with multiple Next.js frontends, a NestJS API on Fastify, and shared Zod contracts from database to browser.
</p>

<p align="center">
  <a href="https://nestjs.com"><img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white" alt="NestJS" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white" alt="Next.js" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/TailwindCSS-4-38BDF8?logo=tailwindcss&logoColor=white" alt="TailwindCSS" /></a>
  <a href="https://zod.dev"><img src="https://img.shields.io/badge/Zod-4-3B82F6" alt="Zod" /></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://fastify.dev"><img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" alt="Fastify" /></a>
  <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white" alt="Prisma ORM" /></a>
</p>

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-24.22.1-339933?logo=node.js&logoColor=white" alt="Node 24.22.1" /></a>
  <a href="https://pnpm.io"><img src="https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white" alt="pnpm 11" /></a>
  <a href="https://turbo.build"><img src="https://img.shields.io/badge/Turborepo-2.10-EF4444?logo=turborepo&logoColor=white" alt="Turborepo" /></a>
</p>

<p align="center">
  <a href="./docs/technical/getting-started.md"><strong>Getting started</strong></a>
  ·
  <a href="./docs/technical/architecture.md">Architecture</a>
  ·
  <a href="./docs/README.md">All docs</a>
  ·
  <a href="http://localhost:8080/v1/docs">API Swagger</a>
</p>

---

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| **API** | [NestJS](https://nestjs.com) on [Fastify](https://fastify.dev) |
| **Frontend** | [Next.js](https://nextjs.org) (App Router) |
| **Language** | [TypeScript](https://www.typescriptlang.org) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) |
| **Validation** | [Zod](https://zod.dev) — shared schemas in `@workspace/shared` |
| **Database** | [PostgreSQL](https://www.postgresql.org) |
| **ORM** | [Prisma](https://www.prisma.io) |
| **Monorepo** | [Turborepo](https://turbo.build) + [pnpm](https://pnpm.io) workspaces |

**Data flow:** `PostgreSQL → Prisma → Zod (shared) → NestJS → Next.js (smart) → UI (dumb props)`

---

## What you get

| Surface | App | Port | Purpose |
| ------- | --- | ---- | ------- |
| **Web** | `@workspace/web` | `3000` | Public landing + the authenticated customer dashboard |
| **Admin** | `@workspace/admin` | `3001` | Internal operations panel |
| **Docs** | `@workspace/docs` | `3002` | Astro documentation site for `docs/` + `blog/` (see `apps/docs/README.md`) |
| **Merchant** | `@workspace/merchant` | `3003` | Merchant portal (isolated auth cookies) |
| **API** | `@workspace/api` | `8080` | NestJS backend — Swagger at `/v1/docs` |
| **Mobile** | `@workspace/mobile` | `8081` (Metro) | Expo (SDK 58) iOS + Android starter shell, run in Expo Go (see `apps/mobile/README.md`) |

Shared packages keep the stack consistent: **`@workspace/shared`** (Zod schemas), **`@workspace/client`** (auth + typed API), **`@workspace/ui`** (presentational components).

---

## Repository layout

```
apps/
├── web/        Customer-facing Next.js app
├── admin/      Admin panel
├── merchant/   Merchant portal
├── docs/       Documentation site
├── mobile/     Expo app (iOS + Android, Expo Router, Uniwind)
└── api/        NestJS + Prisma API (Rspack bundle, Fastify adapter)

packages/
├── shared/     Zod schemas + shared types (the API contract)
├── client/     Auth context, useApi hook, endpoint registry
├── ui/         shadcn/ui components (presentational only)
├── oxlint-config/
└── typescript-config/
```

---

## Quick start

**Prerequisites:** Node 24.22.1 (`nvm use` reads `.nvmrc`; CI runs the same release), pnpm 12, PostgreSQL 18 (installed natively — the `postgres` service in `compose.yml` is commented out) and Docker for the rest of the local stack (`pnpm docker:up` starts Redis, Kafka, RabbitMQ, Bull Board and the Mailpit email inbox — see [local infrastructure](./docs/technical/operations/local-infrastructure.md) and [local email with Mailpit](./docs/technical/email/mailpit-local-inbox.md)).

```bash
# Install dependencies + build shared workspace package

pnpm setup

# One-time env + database setup

# Windows PowerShell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/admin/.env.example apps/admin/.env
Copy-Item apps/merchant/.env.example apps/merchant/.env

# macOS / Linux
# cp apps/api/.env.example apps/api/.env
# cp apps/web/.env.example apps/web/.env
# cp apps/admin/.env.example apps/admin/.env
# cp apps/merchant/.env.example apps/merchant/.env

# Fill in secrets and DATABASE_URL inside apps/api/.env

# Create the database named in DATABASE_URL in your PostgreSQL 18, then start the rest of the stack
pnpm docker:up

pnpm setup:db                         # build shared → generate → deploy → RLS → seed

pnpm dev                              # web + admin + merchant + docs + api
```

`pnpm setup` runs:

```text
pnpm install
→ pnpm --filter @workspace/shared build
```

`pnpm setup:db` runs the complete database initialization flow:

```text
@workspace/shared build
→ Prisma generate
→ Prisma migrate deploy
→ Apply PostgreSQL RLS policies
→ Seed database
```

The RLS setup is cross-platform and does not require Bash on Windows.

Run individual apps when you need them:

```bash
pnpm dev:web
pnpm dev:admin
pnpm dev:merchant
pnpm dev:api
pnpm dev:mobile   # Expo Go on your phone — see apps/mobile/README.md
```

### Rebuild the dev database (and keep your GitHub token)

Run these from the repository root, with the dev servers stopped. The GitHub token is stored encrypted in the database, so a rebuild deletes it unless you carry it across:

```bash
pnpm kill:all                                   # 1. stop the dev servers (ports 3000–3003, 8080)

pnpm tools db:carry-github-link -- export             # 2. save the superadmin's GitHub link to ~/.starter-kit/github-link.json
                                                #    (skip when no token is linked yet)

# 3. drop and rebuild — pick ONE:
pnpm db:reset                                   #    a. drop every table, re-apply the migrations, generate, apply RLS, seed
# or, to drop the database itself:
# dropdb <db-name> && createdb <db-name>        #    b. <db-name> is the database in DATABASE_URL (apps/api/.env)
# pnpm setup:db                                 #       then build shared → generate → deploy → RLS → seed

pnpm tools db:carry-github-link -- import --in ~/.starter-kit/github-link.json
                                                # 4. put the GitHub link back on the superadmin (matched by email)

pnpm dev                                        # 5. start everything again
```

- The import only works while `GITHUB_CREDENTIAL_ENCRYPTION_KEYS` in `apps/api/.env` still holds the key it was saved under, because the token is carried as ciphertext and never decrypted.
- With no saved link, or a new token, link one in the admin panel instead: **Account → GitHub token** (`http://localhost:3001/account/github`), or on the phone under **Profile → GitHub token**.
- `pnpm db:reset` already covers migrate, generate, RLS and seed. You don't need to chain `prisma migrate reset`, `prisma generate`, `prisma migrate dev`, `db:seed` and `db:apply-security` yourself.

> **New here?** Follow [Getting started](./docs/technical/getting-started.md) — prerequisites, env files, database, demo accounts and troubleshooting.

---

## Commands

The root `package.json` holds only what you run day to day. Everything else is one entry away:
`pnpm tools` lists the occasional commands, grouped and described, and `pnpm tools <name>` runs one.

| Everyday command | What it does |
| ------- | ------------ |
| `pnpm setup` | Install dependencies and build `@workspace/shared` |
| `pnpm setup:db` | First-time database: build shared, generate the Prisma client, deploy migrations, apply RLS, seed |
| `pnpm dev` | Start every dev server (Turbo) |
| `pnpm dev:web` / `dev:admin` / `dev:merchant` / `dev:api` / `dev:mobile` | Start one app |
| `pnpm build` | Build every workspace |
| `pnpm lint` / `format` / `typecheck` / `test` | Quality gates across the monorepo |
| `pnpm test:e2e` | The API and analytics-consumer end-to-end suites |
| `pnpm ci:local` | Run what CI runs, locally |
| `pnpm db:migrate` / `db:migrate:create` / `db:generate` / `db:seed` / `db:studio` / `db:reset` | Database — see [docs/technical/database.md](./docs/technical/database.md) |
| `pnpm db:seed -- --scenario empty\|development\|enterprise [--seed <n>]` | Seed a specific dataset — see [seed data](./docs/technical/database.md#seed-data) |
| `pnpm docker:up` / `docker:down` | Local infrastructure — see [docs/technical/operations/local-infrastructure.md](./docs/technical/operations/local-infrastructure.md) |
| `pnpm mailpit` / `mail:latest` | Start the local inbox (Docker) alone, and print the newest email in it |
| `pnpm tools` | List the occasional commands: database checks, tunnels, code generators, dependency hygiene, freeing ports |

A few `pnpm tools` commands you may want:

| Command | What it does |
| ------- | ------------ |
| `pnpm kill:all` | Free dev ports 3000–3003 and 8080 |
| `pnpm tools db:carry-github-link -- export` / `-- import --in <file>` | Carry the superadmin's GitHub link across a database rebuild — see [Rebuild the dev database](#rebuild-the-dev-database-and-keep-your-github-token) |
| `pnpm tools tokens:generate` | Regenerate the theme CSS and brand assets after editing `packages/tokens` |
| `pnpm tools deps:check` | Shared dependency version hygiene (syncpack) |
| `pnpm dlx shadcn@latest add <component> -c apps/web` | Add a shadcn component to `packages/ui` |

---

## Documentation

Start with **[Getting started (A-to-Z)](./docs/technical/getting-started.md)**, then **[Architecture](./docs/technical/architecture.md)**.

The full index lives in **[docs/README.md](./docs/README.md)**: the [user guide](./docs/user-guide/README.md) (operator flows with flowcharts), the [technical documentation](./docs/technical/README.md) and the generated [API reference](./docs/technical/api-reference/README.md).

---

<p align="center"><sub>NestJS · Next.js · PostgreSQL · Type-safe from database to browser</sub></p>
