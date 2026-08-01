# Monorepo Documentation

> Everything a developer needs to understand this monorepo. Each guide is written for
> a junior developer with ~6 months of experience — no assumed knowledge beyond the
> basics of TypeScript, React, and Node.

---

## 📚 Guides

| Guide | What it covers |
| ----- | -------------- |
| **[Getting Started (A-to-Z)](./getting-started.md)** | **Start here.** From a fresh clone to running apps: prerequisites, env setup, DB bootstrap, dev servers, best practices, dos & don'ts, troubleshooting. |
| **[Architecture](./architecture.md)** | The big picture: what each workspace is for, how data flows between them, and how to decide where new code goes. |
| **[TypeScript configs](./typescript.md)** | How `@workspace/typescript-config` works, the base configs, path aliases, and typechecking. |
| **[ESLint setup](./eslint.md)** | The shared lint config, how each workspace extends it, and how to run linting. |
| **[Dependency hygiene](./dependencies.md)** | How `syncpack` keeps shared deps (React, Zod, TS) pinned to the same exact version everywhere. |
| **[Prisma & database](./prisma.md)** | The DB layer, migrations, seeding, and every `db:*` command. |
| **[Auth roadmap](./auth-roadmap.md)** | Ideas and design decisions for auth, RBAC, multi-tenancy, and secrets management. |
| **[Boilerplate roadmap](./boilerplate-roadmap.md)** | 15 improvements + 15 new features for the monorepo template itself (tests, CI/CD, Docker, tooling). |

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

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` | Run all apps in watch mode (web, admin, api) |
| `pnpm dev:web` / `pnpm dev:admin` / `pnpm dev:api` | Run just one app |
| `pnpm build` | Build everything (shared → api → web/admin) |
| `pnpm lint` | Lint every workspace |
| `pnpm format` | Format every workspace with Prettier |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm db:all` | One-shot DB bootstrap: `db:generate` + `db:deploy` → `db:seed` in one turbo command (see [prisma.md](./prisma.md)) |
| `pnpm db:deploy` / `db:migrate` / `db:seed` / `db:generate` / `db:studio` / `db:reset` (or `pnpm turbo run db:<task>`) | Database commands (see [prisma.md](./prisma.md)) |
| `pnpm deps:check` / `pnpm deps:fix` / `pnpm deps:list` (or `pnpm turbo run deps:check`) | Verify / auto-fix shared dependency version drift — turbo tasks backed by `packages/tooling` (see [dependencies.md](./dependencies.md)) |

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
