---
title: "API Tooling Scripts"
tags: ["tooling", "database", "development", "scripts"]
description: "The two command-line tools in apps/api/scripts — database and local development — and how to add a command."
order: 8
author: "Platform Team"
lastUpdated: 1792368000000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# API tooling scripts

`apps/api/scripts` holds two command-line tools. Each one is a set of named commands, and you
run them through the package scripts, never by file name:

```
apps/api/scripts/
  db.ts         database tooling (schema, security, drift, seed coverage)
  dev.ts        local development tooling (tunnel, mail, webhook test, email screenshots)
  lib/          pure helpers the commands use, each tested in lib/__tests__
  __tests__/    checks on the package scripts themselves
```

The RLS apply code lives with the RLS SQL in `prisma/rls/apply.ts` and `prisma/rls/apply-plan.ts`,
because the seed and the e2e scratch databases import it too.

## `scripts/db.ts`

| Package script (in `apps/api`)        | Command                            | What it does                                                                                            |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `db:schema` (`--check` to verify)     | `schema`                           | Writes the base model into every `/// @extends BaseModel` model of `prisma/schema.prisma`.              |
| `db:apply-security`                   | `apply-security`                   | Applies RLS, grants, withheld privileges, data-change capture and the row audit triggers.               |
| `db:check-rls-manifest`               | `check-rls-manifest`               | Fails when the Prisma models, the RLS manifest and the RLS SQL disagree.                                |
| `db:generate-system-operation-scopes` | `generate-system-operation-scopes` | Renders `prisma/rls/00-system-operation-scopes.sql` from the system-operation registry.                 |
| `db:check-drift`                      | `check-drift`                      | Fails when `prisma/migrations` does not reproduce `prisma/schema.prisma` (needs `SHADOW_DATABASE_URL`). |
| `db:check-seed-coverage`              | `check-seed-coverage`              | Fails when a table or nullable column of the seeded database is empty.                                  |

## `scripts/dev.ts`

Development only. `tunnel` and `github-webhook` refuse to run when `NODE_ENV=production`.

| Package script                                    | Command             | What it does                                                                                                                    |
| ------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:tunnel` (root)                          | `tunnel`            | Starts a detached Cloudflare quick tunnel to the API, then re-points the Resend delivery webhook and GitHub live updates to it. |
| `github:webhook-tunnel <url>`                     | `github-webhook`    | Re-points GitHub live pull-request updates only ([GitHub pull requests](../github-pull-requests.md)).                           |
| `pnpm mail:latest [--to <email>] [--code]` (root) | `mail`              | Prints the newest email in the local Mailpit ([Mailpit](../email/mailpit-local-inbox.md)).                                      |
| `webhook:test-signature`                          | `webhook-signature` | Posts a signed and a tampered Resend event to the email webhook (expect 200, then 403).                                         |
| `email:previews`                                  | `email-previews`    | Screenshots every email template into `docs/images/email` (needs Google Chrome; `CHROME_BIN`).                                  |

## Adding a command

1. Write the command as a function in `db.ts` or `dev.ts` that returns the exit code (`EXIT_OK` /
   `EXIT_FAILED` from `lib/cli.ts`), and register it in that file's command map with a one-line summary.
2. Put any logic worth testing in `lib/` as a pure function, with its spec in `lib/__tests__`.
3. Add the package script (`tsx scripts/<cli>.ts <command>`; prefix `dotenv run -q --` when it needs
   `apps/api/.env`). `scripts/__tests__/package-script-commands.spec.ts` fails if a package script
   names a command the CLI does not define.

Write output with `PROCESS_OUTPUT` from `lib/cli.ts`, not `console`. The scripts are linted and
type-checked as part of `tsconfig.check.json`, under the same rules as `src/`.
