<p align="center">
  <img src="./docs/assets/readme-banner.png" alt="NestJS + Next.js + PostgreSQL starter kit — Turborepo monorepo with type-safe full-stack TypeScript" width="100%" />
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
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node 20+" /></a>
  <a href="https://pnpm.io"><img src="https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white" alt="pnpm 11" /></a>
  <a href="https://turbo.build"><img src="https://img.shields.io/badge/Turborepo-2.10-EF4444?logo=turborepo&logoColor=white" alt="Turborepo" /></a>
</p>

<p align="center">
  <a href="./docs/getting-started.md"><strong>Getting started</strong></a>
  ·
  <a href="./docs/architecture.md">Architecture</a>
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
| **Web** | `@workspace/web` | `3000` | Public landing + authenticated Reward Hub for consumers |
| **Admin** | `@workspace/admin` | `3001` | Internal operations panel |
| **Docs** | `@workspace/docs` | `3002` | In-repo documentation site |
| **Merchant** | `@workspace/merchant` | `3003` | Merchant portal (isolated auth cookies) |
| **API** | `@workspace/api` | `8080` | NestJS backend — Swagger at `/v1/docs` |

Shared packages keep the stack consistent: **`@workspace/shared`** (Zod schemas), **`@workspace/client`** (auth + typed API), **`@workspace/ui`** (presentational components).

---

## Repository layout

```
apps/
├── web/        Customer-facing Next.js app
├── admin/      Admin panel
├── merchant/   Merchant portal
├── docs/       Documentation site
└── api/        NestJS + Prisma API (Rspack bundle, Fastify adapter)

packages/
├── shared/     Zod schemas + shared types (the API contract)
├── client/     Auth context, useApi hook, endpoint registry
├── ui/         shadcn/ui components (presentational only)
├── eslint-config/
└── typescript-config/
```

---

## Quick start

**Prerequisites:** Node 20+, pnpm 11, PostgreSQL running locally.

```bash
pnpm install

# One-time env + database setup
cp apps/api/.env.example apps/api/.env    # fill in secrets
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
pnpm db:all                               # generate → deploy → seed (~30s)

pnpm dev                                  # web + admin + api (see turbo for all apps)
```

Run individual apps when you need them:

```bash
pnpm dev:web
pnpm dev:admin
pnpm dev:merchant
pnpm dev:api
```

> **New here?** Follow the full [A-to-Z setup guide](./docs/getting-started.md) — prerequisites, every env var, seeded login accounts, best practices, and troubleshooting.

---

## Commands

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` | Start dev servers (Turbo) |
| `pnpm build` | Build all workspaces |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm test` | Quality gates across the monorepo |
| `pnpm db:all` / `db:migrate` / `db:generate` / `db:seed` / `db:studio` / `db:reset` | Database — see [docs/prisma.md](./docs/prisma.md) |
| `pnpm deps:check` / `deps:fix` / `deps:list` | Shared dependency version hygiene (syncpack) |
| `pnpm kill:all` | Free dev ports 3000–3003 and 8080 |
| `pnpm dlx shadcn@latest add <component> -c apps/web` | Add a shadcn component to `packages/ui` |

---

## Documentation

Start with **[Getting started (A-to-Z)](./docs/getting-started.md)**, then **[Architecture](./docs/architecture.md)**.

The full index lives in **[docs/README.md](./docs/README.md)** — auth, Prisma, RBAC, UI audit, token refresh, and more.

---

<p align="center"><sub>NestJS · Next.js · PostgreSQL · Type-safe from database to browser</sub></p>
