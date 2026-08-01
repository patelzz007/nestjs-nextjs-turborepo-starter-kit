# Monorepo Template

A Turborepo + pnpm monorepo with a Next.js customer app, a Next.js admin panel, and a
NestJS API — all sharing a single source of truth for types and validation.

## Workspaces

```
apps/
├── web/      @workspace/web     Customer-facing Next.js app   (localhost:3000)
├── admin/    @workspace/admin   Admin panel Next.js app       (localhost:3001)
└── api/      @workspace/api     NestJS backend                (localhost:8080, Swagger at /docs)

packages/
├── ui/       @workspace/ui      shadcn/ui components (presentational only)
├── client/   @workspace/client  Auth context, useApi hook, typed endpoint registry
├── shared/   @workspace/shared  Zod schemas + shared types (the API contract)
├── eslint-config/               Shared ESLint presets
└── typescript-config/           Shared tsconfig presets
```

## Quick start

```bash
pnpm install

# one-time DB setup (PostgreSQL must be running first)
cp apps/api/.env.example apps/api/.env   # then fill in secrets
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
pnpm db:all                              # generate → deploy → seed (~30s)

pnpm dev                                 # runs web, admin, and api together
pnpm dev:web                             # or run them individually
pnpm dev:admin
pnpm dev:api
```

> 🧭 **New here? Read the full [A-to-Z setup guide](./docs/getting-started.md)** —
> prerequisites, every env var explained, seeded login accounts, best practices,
> dos & don'ts, and troubleshooting.

## Useful commands

| Command | What it does |
| ------- | ------------ |
| `pnpm lint` | Lint every workspace |
| `pnpm format` | Format every workspace with Prettier |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm build` | Build everything (shared → api → web/admin) |
| `pnpm db:all` / `db:migrate` / `db:generate` / `db:seed` / `db:studio` / `db:reset` | Database commands (see [docs/prisma.md](./docs/prisma.md)) |
| `pnpm deps:check` / `deps:fix` / `deps:list` | Verify / fix shared dependency version drift |
| `pnpm dlx shadcn@latest add <component> -c apps/web` | Add a shadcn component to `packages/ui` |

## Documentation

See [docs/](./docs/README.md) — start with the
[A-to-Z getting-started guide](./docs/getting-started.md), then the
[architecture guide](./docs/architecture.md).
