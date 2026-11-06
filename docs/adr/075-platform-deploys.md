---
title: "ADR 075: Platform deploys — pm2 on a Droplet, triggered by GitHub Actions through a one-command SSH gate"
tags: ["adr", "deployment", "operations", "digitalocean", "ci-cd"]
description: "The API, web, admin and merchant apps run under pm2 on a DigitalOcean Droplet with data services in Docker; after CI passes on main, GitHub Actions sends one line over SSH to a forced-command gate that builds the commit into its own release, migrates with the migration login, switches atomically, health-checks and rolls back."
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&h=630"
order: 75
---

# ADR 075: Platform deploys — pm2 on a Droplet, triggered by GitHub Actions through a one-command SSH gate

## Status

**Accepted and built (2026-11-03).** Runbook: [Deploying to DigitalOcean](../technical/operations/digitalocean-deployment.md).

## Context

Deploys were manual: SSH in, `git pull`, rebuild, restart pm2. The owner chose the hosting during the
Notion docs planning (`docs/architecture/notion-docs-plan.md` §10): one DigitalOcean Droplet, the Node apps
under **pm2** on the host (not in containers), only the **data services in Docker**, **nginx** and
**certbot** in front. ADR 068 phase 4 had produced an all-in-Docker alternative (`infra/droplet/compose.yml`,
`infra/docker/Dockerfile`), which stays available but is not the default.

Requirements: deploy on every green `main` without anyone signing in; never run a build that CI didn't
pass; never leave a half-deployed site; roll back in one action; keep the server's keys narrow.

## Decision

1. **Trigger.** `.github/workflows/deploy.yml` runs after the CI workflow succeeds for a push to `main`
   (or by hand, to deploy a chosen commit of `main` or to roll back). It runs in the `production`
   environment, so required reviewers can gate it, one deploy at a time. It is off until the repository
   variable `DEPLOY_ENABLED` is `true`, so forks never fail on it.
2. **One line over SSH.** The workflow sends only `deploy <full sha>` or `rollback`, with a dedicated key
   whose `authorized_keys` line forces `src/deploy/gate-cli.ts` (no shell, no pty, no forwarding), to a host key
   pinned in a secret.
3. **The gate** (installed once in `/srv/<slug>/bin/deploy`) validates the line, takes a lock, fetches
   `main` into a bare mirror with a **read-only** deploy key, refuses any commit not on `main`, and unpacks
   the commit with `git archive` (no working copy, no hooks) into `releases/<sha>`. It then runs **that
   release's own** `src/deploy/release-cli.ts`, so the deploy logic always matches the code it ships.
4. **The release script**: link `shared/env/<app>.env` into the release; `pnpm install --frozen-lockfile`;
   build the four apps; with the **migration login** (`shared/env/api-migrate.env`, via `DOTENV_PATH`) run
   `db:deploy` (migrations + security SQL) and `db:sync-reference-data`; point `previous` at the live
   release and switch `current` atomically (rename of a symlink); `pm2 startOrReload` from the release's
   `infra/pm2/ecosystem.config.cjs`; health-check each app on loopback. Any failure after the switch
   switches back and reloads the previous release; a failure before it changes nothing live. The last five
   releases are kept, never pruning the live or previous one.
5. **Migrations are expand/contract.** They run before the switch while the old release serves, and a
   rollback doesn't undo them, so each must work with the code already running.
6. **Process names** come from `project.json` (`<slug>-api`, …), so two products can share a Droplet.
7. **Data services** (`infra/droplet/data-services.compose.yml`): PostgreSQL 18 and Redis 8 on
   127.0.0.1; Redis speaks **TLS** with a password because a deployed API refuses anything else (ADR 072),
   its certificate signed by a CA made on the Droplet, which pm2 hands to the API as `NODE_EXTRA_CA_CERTS`.

## Alternatives considered

| Option | Why not (now) |
|---|---|
| Build in GitHub Actions and ship an artifact | The Droplet wouldn't need repository access or build headroom. But the apps don't produce self-contained output yet (no Next.js `standalone`, the API bundle needs `node_modules`), so the artifact would be the whole installed workspace (gigabytes). Revisit with standalone output |
| The all-in-Docker Droplet (ADR 068 phase 4) | The owner chose pm2 on the host. It remains in `deploy/` for products that prefer containers |
| DigitalOcean App Platform | Less control over the data services; the owner chose a Droplet |
| A general SSH login for CI | A leaked key would be a shell on production. The forced command limits it to deploy or roll back a commit already on `main` |

## Consequences

- A push to `main` that passes CI is live minutes later, or after one approval.
- The Droplet builds each release, so it needs 4 GB of memory (or the swap file) and some minutes per deploy.
- The Droplet holds a read-only deploy key for the repository.
- Writing migrations needs the expand/contract discipline (documented in the runbook).
- The `platform` user is in the `docker` group, which is root-equivalent on that machine.

## Implementation notes (2026-11-03)

| Piece | File |
|---|---|
| Workflow | `.github/workflows/deploy.yml` |
| Gate, release script, pure plan (tested) | `packages/tooling/src/deploy/{gate-cli.ts,release-cli.ts,deploy-plan.ts}`, `packages/tooling/src/deploy/__tests__/deploy-plan.test.ts` |
| pm2 | `infra/pm2/ecosystem.config.cjs` |
| Data services, server preparation, nginx | `infra/droplet/data-services.compose.yml`, `infra/droplet/setup-droplet.sh`, `infra/nginx/platform.conf.template` |

Not verified against a real Droplet in this change (no server exists yet): the first deploy is the
acceptance test, following the runbook's step 16.

**Storage (decided 2026-11-03):** products keep Firebase Storage or AWS S3; no DigitalOcean Spaces adapter. On a Droplet that means Firebase Storage.
