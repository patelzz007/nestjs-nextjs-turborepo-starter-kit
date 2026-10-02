---
title: "Quickstart"
tags: ["overview", "setup", "getting-started"]
description: "5-minute overview of the project — tech stack, folder structure, request lifecycle, and how to run it."
order: 12
author: "Acme Inc."
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80"
---

# Quickstart — 5-Minute Overview

> **Goal:** Get a new developer from zero to running the full stack in under 5 minutes.

---

## What Is This?

A full-stack SaaS boilerplate with:

- **NestJS API** (Fastify adapter) — REST endpoints, JWT auth, RBAC, email, email, geo data
- **Next.js Admin Panel** — dashboard for managing users, roles, geo data, emails
- **Next.js Web App** — user-facing SPA with auth, hello page
- **Shared contracts** — Zod schemas used by both API and client (single source of truth)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| API | NestJS 16 + Fastify + Prisma + PostgreSQL |
| Admin | Next.js 16 + TanStack Query + Tailwind 4 + shadcn/ui |
| Web | Next.js 16 + TanStack Query + Tailwind 4 + shadcn/ui |
| Shared | Zod schemas, API contracts, route registry |
| Email | Resend |
| Observability | Telescope (custom, Postgres-backed) |

---

## Folder Structure

```
apps/
  api/          → NestJS backend (src/modules/*)
  admin/        → Next.js admin panel (app/(panel)/*)
  web/          → Next.js user-facing app
  docs/         → Astro documentation site (renders repo-root docs/ + blog/)

packages/
  shared/       → Zod schemas, contracts, route registry (shared by all apps)
  client/       → Auth provider, API hooks, server-side API caller
  ui/           → Shared UI components (shadcn/ui)
  eslint-config/→ Shared ESLint rules
  typescript-config/ → Shared tsconfig bases
```

---

## Request Lifecycle

```
Browser → Next.js proxy (middleware.ts)
         → reads httpOnly cookies
         → access token expired?
            → POST /auth/refresh (server→API, 3s timeout)
            → rotated cookies attached to page response
         → serves page with React Server Components

RSC → server-api.ts (createServerCaller())
     → fetches from NestJS API (cookies forwarded)
     → response parsed by Zod schema
     → passed as props to client component

Client component → useApi() hook
                  → TanStack Query (hydrated from SSR)
                  → background refetch keeps data fresh
```

---

## How to Run

```bash
# 1. Install dependencies
pnpm install

# 2. Start local infrastructure (Postgres, Redis, Kafka, RabbitMQ, Mailpit, MinIO)
pnpm docker:up        # or bring your own PostgreSQL 18 — see getting-started.md §2

# 3. Set up the database (from the repo root)
cp apps/api/.env.example apps/api/.env   # fill in JWT secrets: pnpm secrets:generate apps/api/.env
pnpm db:all                              # generate → migrate deploy + RLS → seed (development scenario)
# other datasets:
#   pnpm db:seed -- --scenario empty                  (reference data only)
#   pnpm db:seed -- --scenario enterprise --seed 123  (1 big tenant, deterministic)

# 4. Start all apps
pnpm run dev  # from repo root (turborepo)

# 5. Open
# API:       http://localhost:8080
# Admin:     http://localhost:3001
# Web:       http://localhost:3000
# Docs:      http://localhost:3002
# Swagger:   http://localhost:8080/docs
```

---

## Key Concepts

### API Contracts (`packages/shared/src/contracts/`)

Every API endpoint is declared once as a Zod contract:

```ts
// packages/shared/src/contracts/index.ts
backup: {
  list: defineContract({ method: "GET", path: apiRoutes.backup.list, input: z.undefined() }),
}
```

The NestJS controller validates with `ZodValidationPipe(apiContract.backup.list.input)`.
The client hook calls `api.backup.list.useQuery()`.
**Both sides use the same schema — they can never drift.**

### Route Registry (`packages/shared/src/api-routes.ts`)

All API paths live in one tree. Changing a path here updates contracts, controllers, and client — compile errors everywhere if something breaks.

### Auth Flow

1. Login → API sets `httpOnly` cookies (`accessToken` + `refreshToken`)
2. Proxy reads cookies, checks expiry, refreshes if needed (server-side)
3. Client hook (`useApi`) handles 401 → refresh → retry automatically
4. Admin uses separate cookie names (`adminAccessToken`) for isolation

---

## Common Tasks

| Task | Where |
|------|-------|
| Add a new API endpoint | `packages/shared` (schema + contract) → `apps/api` (controller + service) → `packages/client` (endpoint definition) |
| Add a new admin page | `apps/admin/app/(panel)/your-page/page.tsx` |
| Add a new UI component | `packages/ui/src/components/` |
| Add a new Zod schema | `packages/shared/src/schemas/` |
| Modify auth behavior | `packages/client/src/lib/auth/` |

---

## Documentation Index

| File | What it covers |
|------|---------------|
| `architecture.md` | Full system architecture, data flow, module map |
| `ADDING-A-FEATURE.md` | Step-by-step guide to adding a new feature module |
| `api-routes.md` | Route registry, buildRoute(), adding/removing endpoints |
| `backup.md` | Backup system (pg_dump, scheduling, restore) |
| `telescope.md` | Observability dashboard (requests, exceptions, SQL, mail) |
| `token-refresh.md` | Token refresh flow (proxy + client) |
| `prisma.md` | Database schema, migrations, RLS |
| `getting-started.md` §7 | Seed scenarios (`empty` / `development` / `enterprise`) and `--seed` |
| `operations/local-infrastructure.md` | Docker Compose services, ports, credentials, overrides |
| `operations/ci.md` | CI jobs, how to reproduce them locally, planned stages |
| `type-safety.md` | Type safety rules and patterns |
