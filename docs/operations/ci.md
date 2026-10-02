---
title: "CI Pipeline (GitHub Actions)"
tags: ["operations", "ci", "quality-gates", "github-actions"]
description: "What every CI job checks, how to reproduce each one locally, how caching works, and which stages are still planned."
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=1200&h=630&fit=crop"
order: 2
---

# CI Pipeline (GitHub Actions)

CI is the merge gate described in `rules/13-ci-cd-and-quality-gates.md`: a green run on the exact
commit is what authorizes a merge, not "it passed on my machine". The workflow lives in
`.github/workflows/ci.yml`; shared job setup lives in `.github/actions/setup-workspace/action.yml`.

## When it runs

| Trigger | Behaviour |
| --- | --- |
| Pull request (any branch) | Full pipeline. A new push to the same PR **cancels** the stale run. |
| Push to `main` | Full pipeline. Runs are never cancelled, so `main` always has a verdict. |
| Manual (`workflow_dispatch`) | Full pipeline on the chosen ref. |

The workflow token is **read-only** (`permissions: contents: read`), checkouts do not persist
credentials, and every third-party action is pinned to a full commit SHA (the tag is in a trailing
comment). Dependabot (`.github/dependabot.yml`) proposes weekly, grouped updates for those pins.

## Jobs

All jobs run in parallel. Each one is a separate status check, so branch protection can require
them individually.

| Job | What it proves | Reproduce locally |
| --- | --- | --- |
| **Lint** | `turbo run lint` — zero errors **and** zero warnings in every workspace | `pnpm lint` |
| **Typecheck** | `turbo run typecheck` across every workspace (builds `^build` deps first). In `apps/api` this covers **all** TypeScript: `src/` (`tsconfig.typecheck.json`), specs, `test/**`, `prisma/**` and tool configs (`tsconfig.check.json`), and node-only `scripts/` (`tsconfig.scripts.json`) — Vitest itself never type-checks | `pnpm typecheck` |
| **Unit tests** | `turbo run test` — every workspace's Vitest suite | `pnpm test` |
| **Build** | `turbo run build` — API bundle, all Next.js apps, docs site (which also link-checks) | `pnpm build` |
| **RLS manifest drift** | Prisma models ↔ RLS manifest ↔ RLS SQL agree, and the RLS apply plan is valid | `pnpm db:check-rls-manifest` |
| **Dependency consistency** | Shared dependencies (React, Zod, TypeScript, Next) use one version everywhere (syncpack) | `pnpm deps:check` |
| **Secret scan (.env.example)** | No real-looking secrets in tracked `.env.example` files | `pnpm secrets:scan` |
| **Docs link check** | Every internal link and anchor in `docs/` resolves | `pnpm docs:check-links` |
| **Database + API e2e** | See below | See below |

The **Build** job sets the Next.js apps' public `NEXT_PUBLIC_*` config (local-dev origins, no
secrets): the apps validate it with zod while prerendering, and CI has no `.env` files. When an app
gains a new required public variable, add it to that job's `env` block too.

`pnpm lint` and `pnpm test` together are also the local **completion gate** from `AGENTS.md`;
CI re-runs them independently because local environments drift.

### Database + API e2e

This job runs against a real PostgreSQL service container (`postgres:18.6`, the same image as
the local Docker stack in [Local infrastructure](./local-infrastructure.md)):

1. Writes a throwaway `apps/api/.env`. Signing secrets are random per run and masked in logs.
   Redis, Kafka and RabbitMQ are deliberately unset — the API falls back to in-memory caches and
   skips broker integrations, which the e2e suite does not exercise.
2. Builds the API's workspace dependencies (`turbo run build --filter=@workspace/api^...`).
3. `pnpm db:deploy` — `prisma migrate deploy` **then** `db:apply-security` (RLS). A migration that
   does not apply cleanly to an empty database fails here.
4. `pnpm db:seed -- --scenario development` — a schema change that breaks `seed.ts` fails here,
   which is how "update the seed in the same PR" is enforced mechanically.
5. `pnpm test:e2e` — boots the real Nest app against that database.
6. `pnpm db:seed -- --scenario enterprise --seed 1` — proves the large scenario still runs.

To reproduce locally against the Docker Postgres (never against a shared database):

```bash
pnpm docker:up                                   # Postgres + the rest of the local stack
pnpm db:deploy                                   # migrations + RLS
pnpm db:seed -- --scenario development
pnpm test:e2e
```

## Caching

- **pnpm store** — cached by `actions/setup-node` (`cache: pnpm`), keyed on `pnpm-lock.yaml`.
  Installs always use `--frozen-lockfile`: CI never rewrites the lockfile.
- **Turborepo** — each turbo job restores `.turbo/cache` from the GitHub Actions cache (key per
  job + commit, falling back to the job's latest entry). Unchanged packages replay from cache.
  `TURBO_CACHE_MAX_AGE=7d` evicts stale entries so the restored cache cannot grow without bound.
  Task hashes include each task's declared `env` (Turborepo strict env mode), so CI and local
  builds never share outputs built with different configuration.
- Remote Caching (Vercel or self-hosted) is **not** configured. Enabling it later only needs
  `TURBO_TOKEN` / `TURBO_TEAM` on the turbo jobs — see the installed Turborepo docs
  (`docs/guides/ci-vendors/github-actions.mdx` inside the `turbo` package).

## Toolchain versions

| Tool | Where the version comes from |
| --- | --- |
| Node.js | `NODE_VERSION` in `ci.yml` (currently the `24` LTS line). `engines.node` (`>=20.19`) is only the floor. |
| pnpm | `packageManager` in the root `package.json`, read by `pnpm/action-setup`. |
| PostgreSQL | `postgres:18.6` — keep `ci.yml` and `compose.yml` on the same tag. |

## Planned stages (not in CI yet)

These are part of the target pipeline but are **deliberately absent** rather than wired up as
placeholder steps that always pass — a green check must always mean something was verified.

| Stage | Status / blocker |
| --- | --- |
| Contract tests (API schemas, OpenAPI diff) | Planned — needs the contract package work. |
| Architecture fitness (import boundaries, package cycles) | Planned — needs the boundary lint rules. |
| Migration safety (destructive-change detection, expand/contract linting) | Planned. Today CI only proves migrations apply to an empty database. |
| Formatting check (`prettier --check`) | Planned — there is no `format:check` script yet; `format` rewrites files. |
| Dependency vulnerability gate (`pnpm audit --audit-level=high`) | Blocked — the current lockfile has known high/critical advisories; add the gate once they are resolved (or as a "newly introduced only" diff check). |
| Full-history secret scanning (e.g. gitleaks) | Planned — today only `.env.example` files are scanned. |
| npm dependency update automation (Dependabot/Renovate for `package.json`) | Planned — Dependabot currently only updates GitHub Actions pins. |
| Preview deployments, coverage floors, artifact retention policy | Planned. No CI artifacts are uploaded yet. |

## Branch protection (repository settings)

CI cannot enforce itself. In GitHub → Settings → Branches, protect `main` and require every job
above as a status check, plus at least one approving review, an up-to-date branch, and no force
pushes (`rules/13-ci-cd-and-quality-gates.md`, "Required status checks").
