---
title: "CI Pipeline (GitHub Actions)"
tags: ["operations", "ci", "quality-gates", "github-actions"]
description: "What every CI job checks, how to reproduce each one locally, how caching works, and which stages are still planned."
author: "Platform Team"
lastUpdated: 1791072000000
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
| **Unit tests** | `turbo run test` — every workspace's Vitest suite; `apps/mobile` runs its jest-expo suites ([ADR 031](../../adr/031-jest-expo-for-mobile-tests.md)) followed by `expo install --check` (Expo SDK version drift fails) | `pnpm test` |
| **Build** | `turbo run build` — API bundle, all Next.js apps, docs site (which also link-checks), and the mobile app's bundle check (`expo export --platform ios --platform android` into `apps/mobile/dist`: proves Metro resolves every workspace package without Xcode or Android Studio) | `pnpm build` |
| **RLS manifest drift** | Prisma models ↔ RLS manifest ↔ RLS SQL agree, and the RLS apply plan is valid | `pnpm db:check-rls-manifest` |
| **Dependency consistency** | Shared dependencies (React, Zod, TypeScript, Next) use one version everywhere (syncpack); `apps/mobile` has its own groups for what Expo SDK 57 pins (React 19.2, React Native, Metro, Jest 29) | `pnpm deps:check` |
| **Migration history** | Committed Prisma migrations at or after the [baseline](#migration-baseline) are immutable: relative to the merge base, none is edited, deleted, renamed or extended, and every new one is strictly newer than the latest committed one with a unique timestamp prefix. Migrations older than the baseline are ignored | `node packages/tooling/scripts/check-migration-history.mjs --base origin/main --working-tree` |
| **Dependency audit** | `pnpm audit --audit-level=high` finds no high/critical advisory. Fix by upgrading, or with a scoped `overrides` entry in `pnpm-workspace.yaml` that names the advisory and the condition for removing it. An advisory with **no patched release** that is unreachable from untrusted input may be accepted under `auditConfig.ignoreGhsas` (reason + `# review-by:` date) — see [Dependency review](#dependency-review-weekly) | `pnpm audit --audit-level=high` |
| **Secret scan (.env.example)** | No real-looking secrets in tracked `.env.example` files | `pnpm secrets:scan` |
| **Docs link check** | Every internal link and anchor in `docs/` resolves | `pnpm docs:check-links` |
| **Database + API e2e** | See below | See below |
| **Browser e2e (Playwright — web + admin)** | Seeds a fresh Postgres, starts the API, web and admin apps, waits for `/health/ready`, then runs the web and admin Playwright suites in Chromium (admin login: the public seed SuperAdmin) | `pnpm ci:local --e2e-only` (runs it against a throwaway `<name>_ci_local_browser` database) |
| **Analytics consumer e2e (Postgres + Kafka)** | Postgres (`postgres:18.6`) and Kafka (`apache/kafka:4.3.1`, KRaft, broker auto-create off) service containers; `pnpm db:deploy` (creates the `analytics_consumer` role), then `pnpm --filter @workspace/analytics-consumer test:e2e`: inbox idempotency, binary-safe parking, least-privilege role checks, retention + advisory locks, login provisioning, topic provisioning and the consumer start position. The consumer login password is random per run | `pnpm docker:up && pnpm db:deploy`, set `apps/analytics-consumer/.env`, then `pnpm --filter @workspace/analytics-consumer test:e2e` (also part of `pnpm test:e2e`) |

The **Build** job sets the Next.js apps' public `NEXT_PUBLIC_*` config (local-dev origins, no
secrets): the apps validate it with zod while prerendering, and CI has no `.env` files. When an app
gains a new required public variable, add it to that job's `env` block too.

`pnpm lint` and `pnpm test` together are also the local **completion gate** from `AGENTS.md`;
CI re-runs them independently because local environments drift.

### Run the whole pipeline locally

`pnpm ci:local` runs the same commands in the same order (lint, typecheck, test, build, RLS manifest, dependency consistency, migration history, audit, secret scan, docs links) and then the database jobs against **throwaway databases** (`<name>_ci_local`, `<name>_ci_local_shadow`) that it creates next to the one in `apps/api/.env`, migrates and seeds from scratch, and drops afterwards. A fresh database is what CI has, so state left behind by earlier local runs can no longer make a suite pass locally and fail in CI. Flags: `--skip-e2e`, `--e2e-only`, `--no-cache` (bypass the Turborepo cache), `--base <ref>` (default `origin/main`). A run with `--skip-e2e` / `--e2e-only` reports the skipped part as FAIL: it is not a full CI run. The analytics-consumer suite additionally needs `pnpm docker:up` (Kafka) and `apps/analytics-consumer/.env`.

The plan lives in `packages/tooling/scripts/lib/ci-local-plan.mjs`; its test asserts every command appears in `ci.yml`, so the two cannot drift apart silently.

### Database + API e2e

This job runs against a real PostgreSQL service container (`postgres:18.6`, the same image as
the local Docker stack in [Local infrastructure](./local-infrastructure.md)):

1. Writes a throwaway `apps/api/.env`. Signing secrets are random per run and masked in logs.
   Redis, Kafka and RabbitMQ are deliberately unset — the API falls back to in-memory caches and
   skips broker integrations, which the e2e suite does not exercise.
2. Builds the API's workspace dependencies (`turbo run build --filter=@workspace/api^...`).
3. `pnpm db:deploy` — `prisma migrate deploy` **then** `db:apply-security` (RLS). A migration that
   does not apply cleanly to an empty database fails here.
3a. Schema drift: `pnpm --filter @workspace/api db:check-drift` replays `prisma/migrations` into a separate shadow database (`app_ci_shadow`) and fails when the result differs from `prisma/schema.prisma`.
4. `pnpm db:seed -- --scenario development` — a schema change that breaks `seed.ts` fails here,
   which is how "update the seed in the same PR" is enforced mechanically.
4a. Seed coverage: `pnpm --filter @workspace/api db:check-seed-coverage` audits the freshly seeded
   database (read-only, before the e2e suite writes anything) and fails when a table has no rows or a
   nullable column is NULL in every row, unless `apps/api/prisma/seed/coverage-exemptions.ts` lists the
   gap with a written reason. Adding a table or column without seeding it fails here — see
   [Seed coverage](../database.md#seed-coverage--every-table-every-column).
5. `pnpm test:e2e` — boots the real Nest app against that database. Seeded customers such as `alice.johnson@example.com` are deliberately unverified (they demo the verify-email flow): a suite that signs in as one must establish the verified state itself (`markSeedUserEmailVerified` in `test/e2e-helpers.ts`) and never depend on suite order. The sign-in restriction is never disabled.
6. `pnpm db:seed -- --scenario enterprise --seed 1` — proves the large scenario still runs.

To reproduce locally against the Docker Postgres (never against a shared database):

```bash
pnpm docker:up                                   # Postgres + the rest of the local stack
pnpm db:deploy                                   # migrations + RLS
pnpm db:seed -- --scenario development
pnpm --filter @workspace/api db:check-seed-coverage
pnpm test:e2e
```

## Migration baseline

`apps/api/prisma/migrations-baseline.json` names the oldest migration that is still history:

```json
{ "baseline": "<timestamp>_init", "reason": "why earlier history was dropped", "since": "<YYYY-MM-DD>" }
```

The guard (`packages/tooling/scripts/check-migration-history.mjs`, rules in `scripts/lib/migration-history.mjs`) validates the file with zod and enforces:

| Rule | Result |
| --- | --- |
| The baseline names a migration directory that exists after the change | otherwise fails |
| Migrations older than the baseline (at the merge base) | ignored |
| The baseline and everything after it | immutable, exactly as without a baseline |
| Moving the baseline forward | the only way to drop history. Migrations it passes may be **deleted** in that same change (not edited), and the job prints a `MIGRATION BASELINE MOVED` warning annotation listing them |
| Moving the baseline backwards, or deleting the marker | fails |
| A new migration older than the baseline | fails |

**When it is acceptable:** only when no shared or deployed database (staging, production, a teammate's shared DB) ever applied the dropped migrations. Such a database records them in `_prisma_migrations`. Against the new history, `prisma migrate deploy` there finds applied migrations missing locally, and the new baseline would try to recreate tables that already exist. Once anything shared has been deployed, history is append-only: undo with a forward migration.

**Procedure** (never hand-write migration SQL):

1. Confirm, and write in the PR, that no shared or deployed database ran the migrations being dropped.
2. Delete the old migration directories, regenerate one migration from `schema.prisma` with `pnpm --filter @workspace/api db:migrate:create --name init` against an empty database, then run `pnpm db:check-drift`.
3. Set `baseline` to the new directory, `reason` to step 1's justification and `since` to today's date, in the same commit.
4. CI shows the `MIGRATION BASELINE MOVED` notice; the reviewer checks it against step 1.
5. Every developer resets their local database (`pnpm db:reset`).

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
| Node.js | `NODE_VERSION` in `ci.yml` (currently the `24` LTS line). `engines.node` (`>=22.12`) is only the floor. |
| pnpm | `packageManager` in the root `package.json`, read by `pnpm/action-setup`. |
| PostgreSQL | `postgres:18.6` — keep `ci.yml` and `compose.yml` on the same tag. |

## Planned stages (not in CI yet)

These are part of the target pipeline but are **deliberately absent** rather than wired up as
placeholder steps that always pass — a green check must always mean something was verified.

| Stage | Status / blocker |
| --- | --- |
| OpenAPI breaking-change diff | Planned. Today the e2e job only proves the committed `docs/generated/openapi.json` matches the code (`test/openapi-artifact.e2e-spec.ts`), and the docs unit tests prove the generated [API reference](../api-reference/README.md) matches that file. |
| Architecture fitness (import boundaries, package cycles) | Planned — needs the boundary lint rules. |
| Migration safety (destructive-change detection, expand/contract linting) | Planned. Today CI only proves migrations apply to an empty database. |
| Formatting check (`prettier --check`) | Planned — there is no `format:check` script yet; `format` rewrites files. |
| Full-history secret scanning (e.g. gitleaks) | Planned — today only `.env.example` files are scanned. |
| npm dependency update automation (Dependabot/Renovate for `package.json`) | Planned — Dependabot currently only updates GitHub Actions pins. |
| Preview deployments, coverage floors, artifact retention policy | Planned. No CI artifacts are uploaded yet. |

## Branch protection (repository settings)

CI cannot enforce itself. In GitHub → Settings → Branches, protect `main` and require every job
above as a status check, plus at least one approving review, an up-to-date branch, and no force
pushes (`rules/13-ci-cd-and-quality-gates.md`, "Required status checks").

## Dependency review (weekly)

`.github/workflows/dependency-review.yml` runs every Monday 01:00 UTC (and on demand via *Run workflow*). It holds the checks that depend on **today's date**, which must never block a push:

| Check | What it reports | Local |
|---|---|---|
| **Due dependency exceptions** | An accepted advisory (`auditConfig.ignoreGhsas`) past its `# review-by:` date, or a supply-chain cooldown exception (`minimumReleaseAgeExclude`) whose "Delete this entry on or after" date has arrived — with the action to take for each | `pnpm --filter @workspace/tooling deps:review` (add `-- --today YYYY-MM-DD` to preview a date) |
| **Dependency audit** | New high/critical advisories, even in weeks with no pushes | `pnpm audit --audit-level=high` |

Push CI only checks that every exception is **well-formed** (a written reason and a valid date — `packages/tooling/tests/dependency-exceptions.test.mjs`), so a calendar day passing never turns a push red. When the weekly run fails, follow the printed action (upgrade and delete an accepted advisory once a fix exists, or move its review-by date after re-checking it is still unreachable; delete a cooldown exception once its version is mature), then re-run the workflow.
