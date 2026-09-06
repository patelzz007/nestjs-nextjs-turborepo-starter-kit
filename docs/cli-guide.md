---
title: "CLI Guide (ELI5)"
tags: ["guide", "cli", "generator", "onboarding", "scaffolding"]
description: "Plain-language guide to the `pnpm app` CLI — what it does, when to use it, and how to add a new admin CRUD resource step by step."
order: 13
author: "Acme Inc."
lastUpdated: 1788643200000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# CLI Guide (ELI5)

> **Who is this for?** Junior developers (~6 months experience) who need to add a new admin CRUD feature without hand-writing every file from scratch.
>
> **One sentence summary:** You describe a database table in one file, and the CLI builds the API, Zod contracts, client routes, and admin UI for you.

---

## 30-second TL;DR

```bash
# 1. Make sure the repo is ready
pnpm app doctor

# 2. Create a new resource (interactive wizard)
pnpm app new resource

# 3. Generate code from the definition
pnpm app generate resource my-resource --non-interactive

# 4. Apply database changes
pnpm db:migrate

# 5. Start the apps and open the admin panel
pnpm dev
# → http://localhost:3001/<your-slug>
```

**Already have a definition file?** Skip step 2 and run `pnpm app generate resource <name>` instead.

---

## What is the CLI? (ELI5)

Imagine you want a new **“Products”** page in the admin panel with a database table behind it.

Without the CLI you would manually create **dozens** of files:

- Prisma model + migration
- NestJS controller, service, repository
- Zod schemas in `packages/shared`
- API route registry
- Admin list/create/edit pages
- Tests, permissions, sidebar menu entry…

That is a lot of copy-paste and easy-to-miss wiring.

**The CLI is a robot assistant** that reads one short description file and builds all of that for you in a consistent, type-safe way.

```
You write ONE file          CLI builds MANY files
─────────────────          ────────────────────
resources/definitions/     apps/api/...
  product.resource.ts  →   packages/shared/...
                             apps/admin/...
                             packages/client/...
```

The CLI lives in [`packages/cli`](../packages/cli). You run it from the **repo root** as:

```bash
pnpm app <command>
```

That is shorthand for `pnpm --filter @workspace/cli start`.

---

## When should I use it?

| Situation | Use the CLI? |
|-----------|--------------|
| New admin CRUD resource (list / create / edit / delete) | **Yes** — this is the happy path |
| Auth, rewards, geo, or other complex domains | **No** — those are hand-written modules |
| Tweaking one button on an existing page | **No** — edit the page directly |
| Changing columns on a generated resource | **Yes** — edit the `.resource.ts`, then `pnpm app sync <name>` |

For the manual (legacy) workflow, see [Adding a Feature](./ADDING-A-FEATURE.md).

---

## The one file you care about: `.resource.ts`

Every generated feature starts with a **resource definition** in:

```
resources/definitions/<slug>.resource.ts
```

Example (simplified from `sample-category`):

```typescript
import { defineResource } from "@workspace/cli";

export default defineResource({
  version: 1,
  name: "SampleCategory",
  model: {
    name: "SampleCategory",
    softDelete: true,
    rls: "admin-only",
    fields: {
      name: { type: "string", required: true, searchable: true },
      slug: { type: "string", required: true },
      isActive: { type: "boolean", default: true, filterable: true },
    },
  },
  permissions: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true,
  },
  admin: {
    navigation: { label: "Categories", group: "Platform", icon: "FolderTree" },
    list: { columns: ["name", "slug", "isActive", "createdAt"] },
    form: { layout: "two-column", fields: ["name", "slug", "isActive"] },
  },
});
```

Think of this file as a **recipe card**:

- **`model`** — what the database table looks like
- **`permissions`** — who can create/read/update/delete
- **`admin`** — how the admin UI should look (menu label, table columns, form fields)

The CLI **never runs this file as code**. It reads it like a structured document, validates it with Zod, and generates real TypeScript from it.

### Live examples in this repo

| Definition | What it demonstrates |
|------------|----------------------|
| [`sample-category.resource.ts`](../resources/definitions/sample-category.resource.ts) | Parent table, soft delete, admin-only RLS |
| [`product.resource.ts`](../resources/definitions/product.resource.ts) | Child table with a foreign key to `SampleCategory` |

---

## Three kinds of generated files (important!)

Not every file the CLI touches behaves the same way. Learn this early — it saves pain later.

| Kind | Filename pattern | Can I edit it? | What happens on `sync`? |
|------|------------------|----------------|-------------------------|
| **Generated** | `*.generated.ts` / `*.generated.tsx` | **No** — your changes will be overwritten | Always regenerated |
| **Scaffolded** | `page.tsx`, `*.module.ts`, `*.service.ts` (no `.generated`) | **Yes** — add your custom logic here | Created once; skipped if file already exists |
| **Manual** | Anything you wrote yourself | **Yes** | Never touched |

**Rule of thumb:** If the filename ends in `.generated`, treat it like a build artifact — do not edit it.

Manifests that track what was generated live in [`.app/manifests/`](../.app/manifests/).

---

## How to run the CLI

### Interactive mode (easiest for beginners)

From the repo root, run:

```bash
pnpm app
```

If your terminal supports it, you get a menu:

1. Create a new resource
2. Generate from definition
3. List resources
4. Validate a definition
5. Run environment check (`doctor`)
6. Exit

Same menu via:

```bash
pnpm app interactive
# or
pnpm app hub
```

### Command mode (for scripts and copy-paste)

All commands start with `pnpm app`:

```bash
pnpm app doctor
pnpm app new resource
pnpm app generate resource product
pnpm app sync product
pnpm app schema validate product
pnpm app routes list
```

---

## Step-by-step: your first resource

### Step 0 — Check the environment

```bash
pnpm app doctor
```

`doctor` checks that the monorepo layout matches what the generator expects:

- `apps/api` (NestJS)
- `apps/admin` (Next.js admin)
- `packages/shared` (Zod contracts)
- `packages/client` (typed API client)
- `resources/definitions/` (your recipe files)
- Prisma schema at `apps/api/prisma/schema.prisma`

Fix anything it reports before continuing.

### Step 1 — Create the definition (wizard)

```bash
pnpm app new resource
```

The wizard has **4 steps**:

| Step | What you decide |
|------|-----------------|
| 1. Basics | Resource name (e.g. `Product`) and admin menu label |
| 2. Access & lifecycle | Who can see rows (RLS), soft delete on/off |
| 3. Columns | Add fields one at a time (text, number, boolean, link to another table…) |
| 4. Review | Confirm before the file is written |

When you finish, the CLI writes:

```
resources/definitions/<slug>.resource.ts
```

**Optional:** generate code immediately:

```bash
pnpm app new resource --generate
```

### Step 2 — Validate before you generate

Always validate first — it is faster than fixing a broken generate run.

```bash
pnpm app schema validate sample-category
```

Other useful checks:

```bash
# See the normalized plan the CLI will use (JSON)
pnpm app schema inspect sample-category

# Preview file changes without writing anything
pnpm app schema diff sample-category
```

### Step 3 — Generate the code

```bash
# Interactive (asks for confirmation):
pnpm app generate resource sample-category

# Non-interactive (CI / when you know what you want):
pnpm app generate resource sample-category --non-interactive
```

**Preview only (no files written):**

```bash
pnpm app generate resource sample-category --dry-run
```

After generation, the CLI runs **format → lint → typecheck** on affected packages (unless you pass `--skip-validation`).

### Step 4 — Update the database

The CLI patches `apps/api/prisma/schema.prisma` with your new model. You still need to run migrations yourself:

```bash
pnpm db:migrate
```

This also applies Row Level Security via `pnpm db:rls` (see [Prisma & database](./prisma.md)).

> **Note:** `pnpm app migrate <name>` only prints a reminder to run `pnpm db:migrate` — it does not run migrations for you.

### Step 5 — Run and verify

```bash
pnpm dev
```

Open the admin app (default `http://localhost:3001`) and look for your new menu item, or go directly to:

```
http://localhost:3001/<slug>
```

For `sample-category`, that is `/sample-category`.

---

## Linking two tables (parent → child)

**One resource = one database table.**

If `Product` belongs to `SampleCategory`:

1. Generate the **parent** first (`sample-category`)
2. Run `pnpm db:migrate`
3. Create the **child** (`product`) — in the wizard choose **“Link to another table”**, or add a `categoryId` field with a `relation` in the `.resource.ts` (see [`product.resource.ts`](../resources/definitions/product.resource.ts))
4. Generate the child and migrate again

The wizard always uses a `categoryId`-style UUID column for child → parent links. You do not need to think about relation cardinality — the CLI handles the boring parts.

**Never add these manually** — the CLI adds them automatically:

- `id` (UUID primary key)
- `createdAt`
- `updatedAt`

---

## Updating an existing resource

You changed the `.resource.ts` (new column, renamed field, etc.) and want fresh generated files:

```bash
pnpm app sync product
```

`sync` is the same as `generate resource --non-interactive` — it regenerates **generator-owned** files without asking questions.

**Workflow:**

1. Edit `resources/definitions/product.resource.ts`
2. `pnpm app schema validate product`
3. `pnpm app schema diff product` (optional but recommended)
4. `pnpm app sync product`
5. `pnpm db:migrate` if the model changed

---

## Command cheat sheet

### Everyday commands

| Command | What it does |
|---------|--------------|
| `pnpm app` | Open interactive menu |
| `pnpm app doctor` | Check monorepo is generator-ready |
| `pnpm app new resource` | Wizard → new `.resource.ts` |
| `pnpm app generate resource <name>` | Build API + contracts + admin from definition |
| `pnpm app sync <name>` | Regenerate after editing a definition |
| `pnpm app schema validate <name>` | Check definition file is valid |
| `pnpm app schema diff <name>` | Preview planned file changes |
| `pnpm app routes list` | List all resources from definitions |

### Useful flags

| Flag | Used with | Meaning |
|------|-----------|---------|
| `--dry-run` | `generate`, `new resource` | Show plan, write nothing |
| `--non-interactive` | `generate` | Skip confirmation prompts |
| `--generate` | `new resource` | Run generation right after wizard |
| `--skip-validation` | `generate`, `sync` | Skip post-generate format/lint/typecheck |
| `--allow-destructive` | `generate`, `sync` | Allow risky Prisma schema changes |
| `--schema <path>` | `generate`, `schema validate` | Use a custom definition file path |

### Aliases (all do the same thing today)

These all run **full resource generation** — slice-specific generation is planned for later:

```bash
pnpm app generate module <name>
pnpm app generate model <name>
pnpm app generate page <name>
pnpm app generate api <name>
# …etc.
```

Prefer `pnpm app generate resource <name>` — it is the supported v1 command.

---

## What the CLI generates (big picture)

For each resource, the plan typically includes:

```
resources/definitions/<slug>.resource.ts
        │
        ▼  parse + validate + normalize
   ResourceIR (internal plan)
        │
        ▼  generators
┌───────┴───────────────────────────────────────────────┐
│ apps/api/prisma/schema.prisma     (model block)      │
│ apps/api/prisma/rls.sql             (RLS policies)     │
│ apps/api/src/modules/<slug>/        (NestJS module)    │
│ packages/shared/src/schemas/        (Zod contracts)  │
│ packages/client/src/lib/api/          (typed endpoints)│
│ apps/admin/app/(panel)/<slug>/      (admin CRUD UI)  │
│ sidebar menu, permissions, tests, manifests…          │
└───────────────────────────────────────────────────────┘
        │
        ▼
   format → lint → typecheck
```

Data still flows the same way as the rest of the monorepo:

```
Database → Prisma → Zod (shared) → API → Client → Admin UI
```

See [Architecture](./architecture.md) for the full picture.

---

## Troubleshooting

### `pnpm app doctor` fails

Read each line — it tells you which folder or file is missing. Common fixes:

- Run commands from the **repo root** (where `pnpm-workspace.yaml` and `turbo.json` live)
- Make sure `resources/definitions/` exists

### `schema validate` fails

- Check that your file uses `defineResource({ ... })` with a **plain object** (no functions, no variables)
- Compare your file to [`sample-category.resource.ts`](../resources/definitions/sample-category.resource.ts)
- Run `pnpm app schema inspect <name>` to see how the CLI interpreted your file

### Generation succeeds but lint/typecheck fails

The CLI **keeps the generated files** and exits with code `1` so you can debug.

1. Read the error output
2. Fix the definition or scaffolded files if needed
3. Re-run with `--skip-validation` only if you are debugging generator output itself:

```bash
pnpm app sync product --skip-validation
```

### Admin page is empty / 404

- Did you run `pnpm db:migrate` after generating?
- Is `pnpm dev` running?
- Check `pnpm app routes list` — does your slug appear?
- Some resources use `hiddenInProduction: true` in the definition (they are dev-only menu items)

### I edited a `.generated.ts` file and my changes disappeared

That is expected. Put custom logic in the **scaffolded** sibling files (e.g. `product.service.ts`, not `product.service.generated.ts`).

### Foreign key / relation errors

Generate and migrate the **parent** table before the **child**. The child definition must reference a model name that already exists in Prisma.

---

## FAQ

**Do I need environment variables for the CLI?**

No. The CLI only reads the filesystem. Database env vars (`apps/api/.env`) matter for `pnpm db:migrate`, not for `pnpm app generate`.

**Can I write the `.resource.ts` by hand instead of using the wizard?**

Yes. Many teams prefer hand-editing after the first resource. Use the wizard to learn the shape, then copy an existing definition.

**What is the difference between `generate` and `sync`?**

| | `generate resource` | `sync` |
|---|---------------------|--------|
| Prompts | Yes (unless `--non-interactive`) | No |
| Dry-run | `--dry-run` supported | No |
| Typical use | First-time generation | After editing a definition |

**Where is the deep technical reference?**

See [Contract-Driven Scaffolding](./contract-driven-scaffolding.md) for architecture details, ownership rules, and platform runtime services.

---

## Related docs

| Doc | Why read it |
|-----|-------------|
| [Contract-Driven Scaffolding](./contract-driven-scaffolding.md) | Architecture deep dive |
| [Adding a Feature](./ADDING-A-FEATURE.md) | Manual workflow for non-CRUD modules |
| [Prisma & database](./prisma.md) | Migrations, RLS, `db:*` commands |
| [Authorization & RBAC](./authorization.md) | How permissions connect to generated resources |
| [API Routes](./api-routes.md) | How generated routes land in `api-routes.ts` |

---

_Last updated: September 2026_
