---
title: "Forking the Starter Kit"
tags: ["starter-kit", "getting-started", "upgrades"]
description: "Start a product from the starter kit, make it yours in one place, and keep pulling later starter releases without losing your work."
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?auto=format&fit=crop&w=1600&q=80"
order: 3
---

# Forking the Starter Kit

## 1. Start the product

Keep the starter's history: it is what lets you merge later releases.

```bash
git clone git@github.com:<starter-owner>/nestjs-nextjs-turborepo-starter-kit.git my-product
cd my-product
git remote rename origin starter
git remote add origin git@github.com:<you>/my-product.git
git push -u origin main
```

Releases of the starter are tags (`v0.6.0`, …) described in the [changelog](../../blog/changelog.md).

## 2. Make it yours

| What | Where | How |
|---|---|---|
| Product name and slug | `project.json` | Edit, then `pnpm project:sync` ([project identity](./tooling/project-identity.md)) |
| Brand mark and colours | `packages/tokens/src/brand.ts`, `palette.ts`, `semantic.ts` | Then `pnpm tools tokens:generate` |
| Phone app identity | `MOBILE_APP_NAME`, `MOBILE_APP_SLUG`, `MOBILE_BUNDLE_ID`, `MOBILE_SCHEME` | `apps/mobile/.env` per build |
| Secrets | every app's `.env` | `pnpm tools secrets:generate apps/api/.env` (never reuse the starter's development values) |
| Demo content | `apps/api/prisma/seed/` | Keep it for development; production is never seeded. To start clean, `pnpm db:seed -- --scenario minimal` gives the reference data and one super admin only |
| Docs site | `apps/docs`, `docs/`, `blog/` | Replace the starter's posts with yours; keep `blog/changelog.md` for *your* releases |

Then remove what your product doesn't need, **one bounded context at a time** (its folder under
`apps/api/src/contexts/`, its module import, its pages, its schema models in a generated migration),
running the [completion gate](../../AGENTS.md) after each.

## 3. Where to put your own code

Merging later starter releases is easy in proportion to how little of the starter's own files you edit.

| Do | Why |
|---|---|
| Add new bounded contexts (`apps/api/src/contexts/<yours>/`) and new pages | New files never conflict |
| Extend through the existing ports and registries (permissions registry, notification types, system operations, navigation config) | Additions to a list conflict rarely and resolve easily |
| Keep the starter's naming and folder conventions | A starter fix lands where you expect it |

| Avoid | Why |
|---|---|
| Editing `packages/ui` components in place | Wrap or compose them in your app instead; the kit changes often |
| Reformatting or reorganising starter files | Every moved line is a future conflict |
| Hand-editing generated files (`docs/generated/`, `00-system-operation-scopes.sql`, `packages/tokens/generated/`, `project-identity.ts`) | Regenerate them |

## 4. Pulling a later starter release

```bash
git fetch starter --tags
git checkout -b upgrade/starter-v0.7.0
git merge v0.7.0            # merge, don't rebase: the history stays honest and re-mergeable
```

Then, in order:

1. Read the release's **Upgrade notes** in the changelog.
2. Resolve conflicts. The usual hot spots:

   | File | Resolve by |
   |---|---|
   | `pnpm-lock.yaml` | Take either side, then `pnpm install` to regenerate |
   | `apps/api/prisma/schema.prisma` and `migrations/` | Keep both sides' models; generate a new migration with `pnpm db:migrate:create`, never hand-edit SQL |
   | `apps/api/prisma/migrations-baseline.json` | Take the starter's if it squashed its history, then follow the note |
   | `project.json`, `package.json` `name` | Keep **yours**, then `pnpm project:sync` |
   | `blog/changelog.md` | Keep yours; read the starter's in its release notes |
   | `docs/generated/openapi.json`, generated SQL | Regenerate (`pnpm tools openapi:export`, `db:generate-system-operation-scopes`) |

3. `pnpm install`, then the completion gate: `pnpm run format`, `lint`, `typecheck`, `test`, `test e2e`,
   `ci:local`.
4. Open a pull request; merge it when CI passes. The deploy workflow ships it.

## 5. Contributing back

A fix that belongs in the starter (a bug, a security issue, a generic improvement) is worth sending
upstream: cut a branch from the starter's tag, apply the fix there, and open a pull request to the starter.
The next merge then brings it back without a conflict.
