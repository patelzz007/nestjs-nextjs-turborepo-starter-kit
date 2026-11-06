---
title: "Project Identity"
tags: ["tooling", "starter-kit", "branding"]
description: "Rename a product built on the starter in one place: project.json holds the slug and display name, and pnpm project:sync applies them everywhere."
order: 9
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Project identity

A product built on this starter needs its own name. `project.json` at the repository root is the
**one place** to set it:

```json
{
	"slug": "starter-kit",
	"displayName": "Starter"
}
```

| Field | Rules | Used for |
|---|---|---|
| `slug` | 2–39 lower-case letters, digits and single dashes, starting with a letter | The root package name, the Docker Compose project, container and network names, the documented `OBSERVE_SERVICE_ID`, CI's Redis namespace, the pm2 process names on a server |
| `displayName` | 1–30 characters (the phone app's store-name limit) | Every app's title and brand row (`BRAND_NAME`), the API's documented `APP_NAME`, the phone app's default store name, CI's `APP_NAME` |

## Renaming

```bash
# 1. Edit project.json
# 2. Apply it
pnpm project:sync
# 3. Confirm
pnpm project:check
```

`pnpm lint` runs the same check (in `@workspace/tooling`), so CI and `pnpm ci:local` fail while any
copy is out of date, and name the files to fix.

## Where the identity goes

Files that can read `project.json` at run time do so. Files that can't hold a copy that
`project:sync` writes:

| File | What is written | How |
|---|---|---|
| `package.json` | `name` | Copy |
| `compose.yml` | `name:`, every `container_name` (`<slug>-<service>`, commented-out services too), the network name | Copy |
| `apps/api/.env.example` | `APP_NAME`, `OBSERVE_SERVICE_ID` | Copy |
| `apps/mobile/app.config.ts` | The default of `MOBILE_APP_NAME` | Copy |
| `packages/tokens/src/project-identity.ts` | `PROJECT_SLUG`, `PROJECT_DISPLAY_NAME` (generated; `BRAND_NAME` re-exports the display name) | Generated |
| `packages/tooling/src/api-ci-env/api-ci-env.ts` | CI's `APP_NAME` (`<displayName> CI`) and `REDIS_NAMESPACE` (`<slug>-ci`) | Reads at run time |
| `infra/pm2/ecosystem.config.cjs` | The pm2 process names (`<slug>-api`, …) | Reads at run time |

Your own `apps/api/.env` is never touched: set `APP_NAME` there yourself (it names the API in
emails, authenticator apps and the Redis namespace).

## After renaming the Docker project

Compose names its volumes after the project, so after a rename the next `pnpm docker:up` starts
**new, empty** Redis, Kafka, RabbitMQ and Mailpit volumes (PostgreSQL runs outside Docker locally).
Stop the old containers first, or their ports collide:

```bash
docker compose -p <old-slug> down     # e.g. docker compose -p hello-world down
pnpm docker:up
```

The old volumes stay until you remove them (`docker volume ls`, then `docker volume rm`).

## Adding a place that needs the name

1. If the file can read JSON at run time, read `project.json` there (validated with
   `parseProjectIdentity` from `packages/tooling/src/project-identity/project-identity.ts`).
2. Otherwise add a renderer to `IDENTITY_TARGETS` in that module. A renderer that can't find its
   anchor line throws, so a moved line fails the check instead of being skipped.
3. Add a case to `packages/tooling/src/project-identity/__tests__/project-identity.test.ts`.
