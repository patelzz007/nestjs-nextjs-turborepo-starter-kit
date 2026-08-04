---
title: "Monorepo Documentation"
description: "Everything a developer needs to understand this monorepo — a hub for all the guides."
order: 11
author: "Acme Inc."
lastUpdated: "2026-08-02"
coverImage: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1600&q=80"
---

# Monorepo Documentation

> Everything a developer needs to understand this monorepo. Each guide is written for
> a junior developer with ~6 months of experience — no assumed knowledge beyond the
> basics of TypeScript, React, and Node.

---

## 📚 Guides

| Guide                                                | What it covers                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Getting Started (A-to-Z)](./getting-started.md)** | **Start here.** From a fresh clone to running apps: prerequisites, env setup, DB bootstrap, dev servers, best practices, dos & don'ts, troubleshooting. |
| **[Architecture](./architecture.md)**                | The big picture: what each workspace is for, how data flows between them, and how to decide where new code goes.                                        |
| **[Token Refresh (simple)](./token-refresh-simple.md)** | The no-jargon, coffee-shop version of how silent refresh works — start here if the main guide feels too technical.                                        |
| **[Token Refresh](./token-refresh.md)**              | How session refresh works: the two layers (server-side proxy + client-side 401), how to observe each, deployment notes, and FAQ.                         |
| **[TypeScript configs](./typescript.md)**            | How `@workspace/typescript-config` works, the base configs, path aliases, and typechecking.                                                             |
| **[ESLint setup](./eslint.md)**                      | The shared lint config, how each workspace extends it, and how to run linting.                                                                          |
| **[Dependency hygiene](./dependencies.md)**          | How `syncpack` keeps shared deps (React, Zod, TS) pinned to the same exact version everywhere.                                                          |
| **[Prisma & database](./prisma.md)**                 | The DB layer, migrations, seeding, and every `db:*` command.                                                                                            |
| **[Auth roadmap](./auth-roadmap.md)**                | Auth ideas/designs + the 30-point hardening deep-dive (status per item) and the full A→Z auth flow, explained like you're 5.                            |
| **[Boilerplate roadmap](./boilerplate-roadmap.md)**  | 15 improvements + 15 new features for the monorepo template itself (tests, CI/CD, Docker, tooling).                                                     |
| **[UI component audit](./ui-components.md)**         | 20 improvements + 20 new features for every component in `packages/ui/src/components` (68 components, 2,720 items), tagged by area.                     |
| **[Logging system](./logging.md)**                  | 40 must-haves for the in-house Datadog-style logging service (terminal + DB, no external SaaS) — grounded in current code.                              |
| **[Email templates](./email.md)**                   | 40 must-haves for the Resend-powered transactional email template system — grounded in current code.                                                  |
| **[Reactive core](./reactive-core.md)**             | Design for replacing promises with a zero-dep rxjs-like core — 50 items, pitfalls (incl. full-SSR), unsubscribe guarantees, rxjs coverage matrix.          |

---

## 🧭 Reading map — which guide first?

Don't read top to bottom. Here's the path we'd walk a new developer through:

| Step | Guide | Why read it now |
| ---- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1️⃣    | **[Getting Started](./getting-started.md)**                         | Get the stack running before you learn anything else — everything below assumes a working dev setup.    |
| 2️⃣    | **[Architecture](./architecture.md)**                               | The big picture: which workspace owns what, so the later guides have somewhere to hang.                 |
| 3️⃣    | **[Token Refresh (simple)](./token-refresh-simple.md)**             | The coffee-shop version of sessions — build the mental model first, zero jargon.                        |
| 4️⃣    | **[Token Refresh](./token-refresh.md)**                             | Now the real machinery: the two layers, how to observe them in DevTools / server logs, and the FAQ.     |
| 5️⃣    | **[TypeScript](./typescript.md) · [ESLint](./eslint.md) · [Dependencies](./dependencies.md)** | Read when you touch config or hit a lint/type error — no need up front.          |
| 6️⃣    | **[Prisma](./prisma.md)**                                           | Read when you touch the database: migrations, seeding, every `db:*` command.                            |
| 7️⃣    | **[Auth roadmap](./auth-roadmap.md) · [Boilerplate roadmap](./boilerplate-roadmap.md) · [UI component audit](./ui-components.md)** | Read when you're *planning* new work — idea lists and the per-component improvement backlog. |

**TL;DR for the common case:** steps 1–4 are required reading; steps 5–7 are
reference material to reach for when the moment calls for them.

---

## 🗺 Quick map

```
apps/                    ← deployable applications
├── web/                 ← @workspace/web    Customer-facing Next.js app  (localhost:3000)
├── admin/               ← @workspace/admin  Admin panel Next.js app      (localhost:3001)
└── api/                 ← @workspace/api    NestJS backend                (localhost:8080)

packages/                ← shared libraries (no ports)
├── ui/                  ← @workspace/ui     shadcn/ui components ONLY (presentational)
├── client/              ← @workspace/client Auth context, useApi hook, typed endpoint registry
├── shared/              ← @workspace/shared Zod schemas + shared types (the API contract)
├── tooling/             ← @workspace/tooling Repo-wide scripts (syncpack dep hygiene)
├── eslint-config/       ← @workspace/eslint-config
└── typescript-config/   ← @workspace/typescript-config
```

---

## 🚀 Common commands (from the repo root)

| Command                                                                                                                | What it does                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                                                                             | Run all apps in watch mode (web, admin, api)                                                                                            |
| `pnpm dev:web` / `pnpm dev:admin` / `pnpm dev:api`                                                                     | Run just one app                                                                                                                        |
| `pnpm build`                                                                                                           | Build everything (shared → api → web/admin)                                                                                             |
| `pnpm lint`                                                                                                            | Lint every workspace                                                                                                                    |
| `pnpm format`                                                                                                          | Format every workspace with Prettier                                                                                                    |
| `pnpm typecheck`                                                                                                       | Type-check every workspace                                                                                                              |
| `pnpm db:all`                                                                                                          | One-shot DB bootstrap: `db:generate` + `db:deploy` → `db:seed` in one turbo command (see [prisma.md](./prisma.md))                      |
| `pnpm db:deploy` / `db:migrate` / `db:seed` / `db:generate` / `db:studio` / `db:reset` (or `pnpm turbo run db:<task>`) | Database commands (see [prisma.md](./prisma.md))                                                                                        |
| `pnpm deps:check` / `pnpm deps:fix` / `pnpm deps:list` (or `pnpm turbo run deps:check`)                                | Verify / auto-fix shared dependency version drift — turbo tasks backed by `packages/tooling` (see [dependencies.md](./dependencies.md)) |

> ⚠️ Turbo caching is **disabled** (`"cache": false` in `turbo.json`) — commands always
> run fresh, and the shared package rebuilds before the apps that depend on it.

---

## 🧭 Where does new code go?

- **A reusable UI component (button, dialog, table…)** → `packages/ui/src/components/`
- **Auth state, API fetching, cookie handling** → `packages/client/src/lib/`
- **A Zod schema / shared type used by both FE and BE** → `packages/shared/src/schemas/`
- **A NestJS module / endpoint** → `apps/api/src/modules/`
- **A page or route in the web app** → `apps/web/app/`
- **A page or route in the admin app** → `apps/admin/app/`

If you're unsure, read [architecture.md](./architecture.md) first.

---

_Last updated: July 31, 2026_
