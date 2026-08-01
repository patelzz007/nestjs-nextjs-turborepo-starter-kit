# Getting Started — A-to-Z Setup Guide

> This guide walks you through **everything**: from an empty laptop to a running
> monorepo with a database, seeded data, and all three apps on screen. It is written
> for a junior developer with ~6 months of experience — no assumed knowledge beyond
> the basics of TypeScript, React, and Node.
>
> **TL;DR (for people who know what they're doing):**
>
> ```bash
> git clone <repo-url> && cd hello-world
> pnpm install
> # start PostgreSQL, then create the database:
> createdb monorepo   # or: psql -U postgres -c "CREATE DATABASE monorepo;"
> cp apps/api/.env.example apps/api/.env        # fill in secrets
> cp apps/web/.env.example apps/web/.env
> cp apps/admin/.env.example apps/admin/.env
> pnpm db:all                                   # generate → deploy → seed (~30s)
> pnpm dev                                      # web :3000, admin :3001, api :8080
> ```

---

## Table of Contents

1. [What you're building](#1-what-youre-building)
2. [Prerequisites — install these first](#2-prerequisites--install-these-first)
3. [Step 1 — Clone the repo](#3-step-1--clone-the-repo)
4. [Step 2 — Install dependencies](#4-step-2--install-dependencies)
5. [Step 3 — Start PostgreSQL & create the database](#5-step-3--start-postgresql--create-the-database)
6. [Step 4 — Configure environment variables](#6-step-4--configure-environment-variables)
7. [Step 5 — Bootstrap the database](#7-step-5--bootstrap-the-database)
8. [Step 6 — Run the dev servers](#8-step-6--run-the-dev-servers)
9. [Step 7 — Verify everything works](#9-step-7--verify-everything-works)
10. [Everyday commands cheat sheet](#10-everyday-commands-cheat-sheet)
11. [Best practices — Dos and Don'ts](#11-best-practices--dos-and-donts)
12. [Where does new code go?](#12-where-does-new-code-go)
13. [Troubleshooting](#13-troubleshooting)
14. [Common mistakes (FAQ)](#14-common-mistakes-faq)
15. [Further reading](#15-further-reading)

---

## 1. What you're building

This is a **monorepo** — multiple projects in one repository, sharing code. There are
three apps and six shared packages:

| Path | Package | What it is | URL (local) |
| ---- | ------- | ---------- | ----------- |
| `apps/web` | `@workspace/web` | Customer-facing Next.js app (login, signup, hello page) | http://localhost:3000 |
| `apps/admin` | `@workspace/admin` | Admin panel Next.js app (login, dashboard) | http://localhost:3001 |
| `apps/api` | `@workspace/api` | NestJS backend — auth, users, URLs, everything | http://localhost:8080 |
| `packages/ui` | `@workspace/ui` | shadcn/ui components (**presentational only**) | — |
| `packages/client` | `@workspace/client` | `AuthProvider`, `useApi` hook, typed endpoint registry | — |
| `packages/shared` | `@workspace/shared` | Zod schemas + shared types (the API contract) | — |
| `packages/tooling` | `@workspace/tooling` | Repo-wide scripts (syncpack dependency hygiene) | — |
| `packages/eslint-config` | `@workspace/eslint-config` | Shared ESLint presets | — |
| `packages/typescript-config` | `@workspace/typescript-config` | Shared tsconfig presets | — |

**Swagger (API docs)** is served by the API at http://localhost:8080/docs.
**Prisma Studio** (visual DB browser) runs at http://localhost:5555.

> The key idea: `@workspace/shared` is the **single source of truth**. The API's
> request/response shapes are Zod schemas in `shared`, and both the backend (DTOs)
> and the frontends (typed hooks) derive their types from those schemas. See
> [architecture.md](./architecture.md) for the full mental model.

---

## 2. Prerequisites — install these first

| Tool | Version | Why you need it | Check it's installed |
| ---- | ------- | --------------- | -------------------- |
| **Node.js** | `>= 20` | Runs everything (Next.js, NestJS, Prisma) | `node -v` |
| **pnpm** | `11.18.0` (this repo's version) | The package manager (faster than npm, enforces the workspace) | `pnpm -v` |
| **PostgreSQL** | 14+ (any recent) | The database | `psql --version` and `pg_isready` |
| **git** | any | Clone the repo | `git --version` |

### Installing Node.js

Use the official installer, or a version manager (**recommended**):

```bash
# macOS (Homebrew)
brew install node

# OR use a version manager (recommended — lets you switch Node versions easily)
brew install nvm
nvm install 20
nvm use 20
```

### Installing pnpm

The repo pins its pnpm version (`packageManager: "pnpm@11.18.0"`). The cleanest way
to get it is **corepack** (ships with Node):

```bash
corepack enable
corepack prepare pnpm@11.18.0 --activate

# verify
pnpm -v    # should print 11.18.0
```

If you already have pnpm but a different version, install the repo's version once:

```bash
corepack use pnpm@11.18.0   # pins it for this folder
```

> ⚠️ **Don't mix package managers.** Use `pnpm` only — never `npm install` or
> `yarn` in this repo. The lockfile (`pnpm-lock.yaml`) is pnpm-specific.

### Installing PostgreSQL

Pick **one** of these (all are fine):

```bash
# Option A — Homebrew (macOS)
brew install postgresql@17
brew services start postgresql@17

# Option B — Docker (any OS)
docker run --name monorepo-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=monorepo -p 5432:5432 -d postgres:17

# Option C — Postgres.app (macOS, GUI)
# Download from https://postgresapp.com and click "Start"
```

Verify it's running:

```bash
pg_isready -h localhost -p 5432    # should print "accepting connections"
```

---

## 3. Step 1 — Clone the repo

```bash
git clone <repo-url> hello-world
cd hello-world
```

> The folder is currently named `hello-world` — rename it to your project if you like
> (e.g. `mv hello-world my-project && cd my-project`). The package name inside
> `package.json` (`"hello-world"`) can be changed too, but that's optional.

---

## 4. Step 2 — Install dependencies

```bash
pnpm install
```

What this does:

- Installs dependencies for **all** workspaces (`apps/*`, `packages/*`) in one pass.
- Creates the `node_modules` tree (pnpm uses hard links — it's fast and disk-friendly).
- Wires up the `workspace:*` packages so `@workspace/ui`, `@workspace/shared`, etc.
  resolve to each other.

> No build step happens here — packages are built on demand by turbo when you run
> `pnpm dev` or `pnpm build` (the `dev`/`build` tasks depend on `^build`, so
> `@workspace/shared` compiles first).
>
> Native dependencies (`bcrypt`, `esbuild`) compile during install. On Windows you
> may need the Visual Studio Build Tools; on macOS, Xcode command-line tools. If
> the install fails on those packages, install the build tools and re-run.

---

## 5. Step 3 — Start PostgreSQL & create the database

Make sure Postgres is running (see [Prerequisites](#2-prerequisites--install-these-first)),
then create the database **`monorepo`**:

```bash
createdb monorepo
# or if you don't have the createdb CLI handy:
psql -U postgres -c "CREATE DATABASE monorepo;"
```

> ⚠️ The seed and migrations **will not create the database for you** — it must
> exist before `pnpm db:all`. If you used the Docker option above, the container
> already created it (`POSTGRES_DB=monorepo`).

The default connection string this repo expects:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/monorepo?schema=public"
```

If your Postgres user/password differ, use your own credentials — you'll put this
string in `apps/api/.env` in the next step.

---

## 6. Step 4 — Configure environment variables

Environment files are **git-ignored** (`.gitignore` has `.env*`), so every developer
creates their own from the committed `.env.example` templates.

### The API (`apps/api/.env`)

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fill in real values:

| Variable | Example | What it's for |
| -------- | ------- | ------------- |
| `NODE_ENV` | `development` | Runtime mode |
| `APP_NAME` | `Freebuff API` | Shown in docs/emails |
| `APP_URL` | `http://localhost:3000` | Base URL of the web app (used in emails) |
| `PORT` | `8080` | Port the API listens on |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Comma-separated frontend origins allowed to call the API |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/monorepo?schema=public` | Postgres connection string |
| `JWT_ACCESS_SECRET` | (random ≥ 32 chars) | Signs access tokens |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime (e.g. `15m`, `1h`) |
| `JWT_REFRESH_SECRET` | (random ≥ 32 chars) | Signs refresh tokens |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |
| `EMAIL_VERIFICATION_SECRET` | (random ≥ 32 chars) | Signs email-verification tokens |
| `BCRYPT_SALT_ROUNDS` | `10` | Password hashing cost |
| `RESEND_API_KEY` | `re_...` | Sends transactional emails (signup, password reset) |
| `EMAIL_FROM_ADDRESS` | `noreply@example.com` | "From" address for emails |

**Generate strong secrets** (run this 3 times, paste each result into the three
secret vars):

```bash
openssl rand -base64 32
```

> Email sending is **optional** for local dev. If you don't have a Resend key yet,
> leave `RESEND_API_KEY` empty — auth still works; only the actual email delivery
> will fail (you'll see the error in the API logs).

### The web app (`apps/web/.env`)

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable | Example | What it's for |
| -------- | ------- | ------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Base URL of the API the browser calls |

### The admin app (`apps/admin/.env`)

```bash
cp apps/admin/.env.example apps/admin/.env
```

Same single variable: `NEXT_PUBLIC_API_URL=http://localhost:8080`.

> `NEXT_PUBLIC_*` vars are inlined into the browser bundle at build time. When you
> deploy, set them to your production API URL (e.g. `https://api.example.com`).

---

## 7. Step 5 — Bootstrap the database

One command does **everything**:

```bash
pnpm db:all
```

`pnpm db:all` runs `turbo run db:seed`, which executes three tasks in order
(generate & deploy run in parallel, then seed):

1. **`db:generate`** — regenerates the Prisma client types from `schema.prisma`.
2. **`db:deploy`** — applies any pending migrations (`prisma migrate deploy`).
3. **`db:seed`** — creates permissions, roles, users, URLs, clicks, API keys, etc.

Expect it to take ~30 seconds and end with:

```
 Tasks:    3 successful, 3 total
```

> ⚠️ `db:all` applies **pending** migrations — it never **creates** a new one. On a
> fresh clone there are no pending migrations (they're committed), so step 2 is a
> no-op. If you ever *change* `schema.prisma`, use `pnpm db:migrate` (interactive)
> to create a migration first, then `pnpm db:all` to re-seed.
>
> ⚠️ The seed is **idempotent** — safe to re-run as many times as you like. Note it
> **wipes volatile demo data** (refresh tokens, clicks, API keys, usage logs) at the
> start, so any API keys you created manually will be removed.

### Seeded login accounts

| Email | Password | Role |
| ----- | -------- | ---- |
| `superadmin@example.com` | `SuperAdmin@123` | SuperAdmin |
| `admin@example.com` | `Admin@123` | Admin |
| `manager@example.com` | `Manager@123` | Manager |
| `user@example.com` | `User@123` | User |

Plus ~10 dummy users (`alice.johnson@example.com` / `Alice@123`, `bob.smith@example.com` /
`Bob@123`, …). Only users with the **Admin** role (or above) can log into the admin
panel — `user@example.com` can only use the web app.

---

## 8. Step 6 — Run the dev servers

From the repo root:

```bash
pnpm dev
```

This starts all three apps in **watch mode** (they rebuild automatically on save):

| App | URL |
| --- | --- |
| Web | http://localhost:3000 |
| Admin | http://localhost:3001 |
| API | http://localhost:8080 |
| Swagger docs | http://localhost:8080/docs |

To run just one app (saves memory):

```bash
pnpm dev:web
pnpm dev:admin
pnpm dev:api
```

> Turbo caching is **disabled** in this repo (`"cache": false`), so dev always runs
> fresh, and `@workspace/shared` is rebuilt before the apps that depend on it.

---

## 9. Step 7 — Verify everything works

**1. API health check** (should return `db: "connected"`):

```bash
curl http://localhost:8080/health
# → {"status":"ok","db":"connected","timestamp":"..."}
```

**2. Swagger** — open http://localhost:8080/docs. You should see every endpoint with
its request/response schemas (inferred from the shared Zod schemas).

**3. Log into the web app** — http://localhost:3000/auth/login with
`user@example.com` / `User@123`. You'll be redirected to `/hello`.

**4. Log into the admin panel** — http://localhost:3001/auth/login with
`admin@example.com` / `Admin@123`. You'll land on `/dashboard`.

> **Login gotcha:** the web app stores cookies named `accessToken` / `refreshToken`,
> while the admin panel uses **separate** cookies (`adminAccessToken` /
> `adminRefreshToken`) so a web login can't access the admin panel (and vice versa).
> If you're logged in to one app and the other says "not authenticated", that's
> expected — log in again on that app.

**5. Browse the database visually** (optional):

```bash
pnpm db:studio     # opens Prisma Studio at http://localhost:5555
```

---

## 10. Everyday commands cheat sheet

Run these from the **repo root**:

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` | Run web + admin + api in watch mode |
| `pnpm dev:web` / `pnpm dev:admin` / `pnpm dev:api` | Run just one app |
| `pnpm build` | Production build (shared → api → web/admin) |
| `pnpm lint` | Lint every workspace (run via turbo) |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm format` | Format everything with Prettier |
| `pnpm db:all` | **One-shot DB bootstrap**: generate + deploy + seed |
| `pnpm db:migrate` | Create + apply a migration (interactive) |
| `pnpm db:migrate:create` | Create a migration without applying it |
| `pnpm db:migrate:status` | Show applied / pending migrations |
| `pnpm db:deploy` | Apply pending migrations (CI/prod) |
| `pnpm db:generate` | Regenerate Prisma client types |
| `pnpm db:seed` | Re-seed the database (idempotent) |
| `pnpm db:reset` | 🔴 Drop all data, re-migrate, re-seed |
| `pnpm db:studio` | Open Prisma Studio (localhost:5555) |
| `pnpm deps:check` | Verify shared deps (React/Zod/TS) are the same everywhere |
| `pnpm deps:fix` | Auto-align dependency versions |
| `pnpm turbo run db:<task>` | Run any db task through turbo explicitly |

> **Add a shadcn component:** `pnpm dlx shadcn@latest add <component> -c apps/web`
> adds it to `packages/ui/src/components/`. UI components go in `packages/ui`, not
> in the apps — see [Section 12](#12-where-does-new-code-go).

---

## 11. Best practices — Dos and Don'ts

### The 15 non-negotiable rules

These are enforced by ESLint **and** code review. Violations fail CI:

| # | Rule | What it means in practice |
| - | ---- | ------------------------- |
| 1 | **No `any` / `z.any`** | Never opt out of the type system. ESLint: `no-explicit-any` = error. |
| 2 | **No `unknown` / `z.unknown`** | Type everything properly. |
| 3 | **No `never` / `z.never`** | A schema that accepts nothing is a design smell. |
| 4 | **No type casting (`as Type`)** | Don't use `as` to force types. **Avoid `as const` too** — use a tuple: `const X: ["a", "b"] = ["a", "b"]`. |
| 5 | **Avoid `typeof`, infer from Zod** | Types come from `z.infer<typeof Schema>`, not hand-written interfaces. |
| 6 | **Use generic types (priority 0)** | Write reusable, generic code — especially in low-level components. |
| 7 | **Polish the UI** | Production-ready, professional, visually appealing. |
| 8 | **Mobile responsive** | Any UI you touch must work on small screens. |
| 9 | **Data lives in the page** | `app/<page>/page.tsx` (the "smart component") owns the data; low-level components receive it via **props**. |
| 10 | **Data changes happen in the smart component** | Low-level components never mutate/fetch data themselves. |
| 11 | **Low-level components are fluid** | Nothing hardcoded — they adapt to whatever props the smart component passes. |
| 12 | **Don't change the layout unless asked** | Layouts are deliberate. |
| 13 | **Prefer Zod validation over string checks** | Avoid `x === "string"` — validate with a schema. |
| 14 | **Update the docs** | Whenever you finish a task, update the relevant docs so a junior can follow. |
| 15 | **Access modifiers + return types always** | `public`/`private`/`protected` and an explicit return type on every class member and function. ESLint enforces this. |

### Dos ✅

- **Put request/response shapes in `packages/shared/src/schemas/`** — never inside
  an app or a NestJS module. Both FE and BE import from there.
- **Use `createZodDto(Schema)`** for NestJS DTOs — Swagger and validation both come
  free from the shared schema.
- **Call the API through the `useApi` hook** (`@workspace/client`) — never raw
  `fetch` in a page. New endpoints get a typed entry in
  `packages/client/src/lib/endpoints.ts`.
- **Keep `packages/ui` presentational** — no data logic, no auth, no Zod there.
- **Add access modifiers and return types** on every class method and function.
- **Run the checks before pushing:** `pnpm lint && pnpm typecheck`.
- **Write schemas `.strict()`** so unknown fields are rejected.
- **Export new schemas from the barrel** (`packages/shared/src/index.ts`) or they
  won't be importable.
- **Commit migration folders** (`apps/api/prisma/migrations/`) — other environments
  replay the exact same SQL.
- **Keep `.env` out of git** (it already is via `.gitignore`).
- **Re-run `pnpm deps:check`** after touching any `package.json`.

### Don'ts ❌

- **Don't** use `any`, `unknown`, `never`, `as` casts, or `as const` (see rule 4).
- **Don't** define schemas inside `apps/api/src/modules/...` — they belong in
  `packages/shared/src/schemas/`.
- **Don't** fetch data or handle auth inside a `packages/ui` component.
- **Don't** hand-write response interfaces that duplicate a Zod schema.
- **Don't** edit `packages/shared/dist/` by hand — rebuild with
  `pnpm --filter @workspace/shared build`.
- **Don't** import `@workspace/client` from `@workspace/ui` (or vice versa) — layers
  are one-way.
- **Don't** sprinkle `// eslint-disable` comments to silence errors — fix the code
  (or add a scoped override in `eslint.config.js` if it's a genuine false positive).
- **Don't** run `npm install` / `yarn` — pnpm only.
- **Don't** commit `.env` files or generated `schema.d.ts` / `schema.js` artifacts.

### Git workflow tips

- Small, focused commits with clear messages.
- Run `pnpm lint` + `pnpm typecheck` before pushing (CI runs them too).
- If you changed the DB schema: create a migration (`pnpm db:migrate`), commit the
  migration folder, and re-run `pnpm db:all` locally to re-seed.
- If you changed a shared schema: update the API DTOs (they derive from the schema,
  so usually nothing to do), and let TypeScript point out every frontend usage that
  needs updating.

---

## 12. Where does new code go?

| You're building… | Put it in… |
| ---------------- | ---------- |
| A reusable UI component (button, dialog, table…) | `packages/ui/src/components/` |
| Auth state, API fetching, cookie handling | `packages/client/src/lib/` |
| A Zod schema / shared type used by FE and BE | `packages/shared/src/schemas/` |
| A NestJS module / endpoint | `apps/api/src/modules/` |
| A page or route in the web app | `apps/web/app/` |
| A page or route in the admin app | `apps/admin/app/` |
| A new ESLint rule for everyone | `packages/eslint-config/base.js` |
| A new tsconfig base | `packages/typescript-config/` |

Not sure? Read [architecture.md](./architecture.md) first.

---

## 13. Troubleshooting

| Symptom | Cause & fix |
| ------- | ----------- |
| `pnpm: command not found` | pnpm isn't installed. Run `corepack enable && corepack prepare pnpm@11.18.0 --activate`. |
| `Unsupported engine` / node version error during install | Your Node is too old. The repo needs Node **>= 20**. Install 20+ and retry. |
| `psql: could not connect to server` / `Connection refused (0x0000274D)` | Postgres isn't running. Start it (`brew services start postgresql@17` or your Docker container) and re-run `pg_isready`. |
| `Environment variable not found: DATABASE_URL` | `apps/api/.env` is missing or incomplete. Copy `.env.example` → `.env` and fill it in. |
| `database "monorepo" does not exist` | Create it first: `createdb monorepo`. |
| `P3009: migration found that was not applied` / schema not up to date | Run `pnpm db:all` (applies pending migrations). |
| `Tasks: 2 successful, 1 failed` from `pnpm db:all` | `db:deploy` or `db:generate` failed, so the seed was skipped (by design). Run `pnpm turbo run db:deploy` to see the real error. |
| Port 3000/3001/8080 already in use | Another process is on the port. Find it (`lsof -i :3000`) and stop it, or change `PORT` in `apps/api/.env`. |
| Web says "not authenticated" but I logged in on Admin | Cookie isolation by design. Web uses `accessToken`/`refreshToken`; admin uses `adminAccessToken`/`adminRefreshToken`. Log in on each app separately. |
| `user@example.com` can't log into the admin panel | Expected — non-admin users are blocked from admin **by design**. Admins (`admin@example.com`/`Admin@123`) can log into **both** web and admin; non-admins only web. |
| `ESLint couldn't find an eslint.config.js file` | You ran `npx eslint` from the repo root (no root config). Run it inside a workspace: `cd apps/web && npx eslint .` — see [eslint.md](./eslint.md). |
| Prisma client doesn't know a new field | Run `pnpm db:generate` (or `pnpm db:migrate`, which regenerates) and restart your TS server. |
| Email verification link fails | `RESEND_API_KEY` missing or `APP_URL` wrong. Emails are optional in dev. |
| I broke the DB and want a clean slate | `pnpm db:reset` (drops everything, re-migrates, re-seeds). 🔴 All data is wiped. |

---

## 14. Common mistakes (FAQ)

**Q: Why does `pnpm db:all` "only show" generate and deploy?**
A: It runs all three — generate and deploy finish in ~2 seconds, then the seed runs
for ~25–30 seconds. Look for `@workspace/api:db:seed:` lines and the final
`Tasks: 3 successful, 3 total` summary.

**Q: Why can't I import `@workspace/ui` from `@workspace/client`?**
A: Layers are one-way: apps → client/ui → shared. `ui` is presentational; `client`
owns auth + fetching. Crossing them couples concerns and breaks the architecture.

**Q: Do I need a Resend account to develop?**
A: No. Auth works without it — only actual email delivery fails. Add a key when you
need signup/verification emails to send.

**Q: I changed `schema.prisma` — what now?**
A: 1) `pnpm db:migrate` to create + apply a migration. 2) Update the shared Zod
schemas in `packages/shared` if the API shape changed. 3) `pnpm db:all` to re-seed.
4) `pnpm typecheck` to find every usage that needs updating.

**Q: Where does the `:8080` / `3000` / `3001` come from?**
A: Defaults in `main.ts` (API) and the Next.js apps. Override with `PORT` (API) and
`NEXT_PUBLIC_API_URL` (frontends).

**Q: How do I add a new API endpoint?**
A: 1) Schema in `packages/shared/src/schemas/<domain>.ts`. 2) DTO with
`createZodDto(Schema)` in the controller. 3) Service method. 4) Typed entry in
`packages/client/src/lib/endpoints.ts`. 5) Wire the UI page to it via `useApi`.

---

## 15. Further reading

- **[Architecture](./architecture.md)** — the full mental model and data flow.
- **[TypeScript configs](./typescript.md)** — how tsconfig inheritance works.
- **[ESLint setup](./eslint.md)** — the rules, per-repo configs, and how to run it.
- **[Prisma & database](./prisma.md)** — every `db:*` command in detail, seeding, migrations.
- **[Dependency hygiene](./dependencies.md)** — how syncpack pins shared deps.
- **[Auth roadmap](./auth-roadmap.md)** — auth/RBAC/multi-tenancy design decisions.
- **[Boilerplate roadmap](./boilerplate-roadmap.md)** — 15 improvements + 15 features for the template itself.

---

_Last updated: August 1, 2026_
