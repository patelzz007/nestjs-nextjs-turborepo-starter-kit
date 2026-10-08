
---
title: "Starter kit — production roadmap (extended reference)"
description: "Long-form reference: agency fork strategy, locked product decisions, tenancy modes, Reward Hub removal, DigitalOcean, authorization kernel, Cedar, Kafka, semver releases, and improvement backlog."
order: 6
author: "Platform Team"
lastUpdated: 1791196800000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
tags: ["starter-kit", "roadmap", "operations", "authorization", "agency", "tenancy", "digitalocean"]
---

# Starter kit — production roadmap (extended reference)

> **Purpose.** This document is the long-form companion to the starter-kit review. It is written for
> you (maintainer) and for agency engineers forking the template. It assumes Reward Hub is being
> removed soon and that the kernel (auth, authorization, RLS, messaging, contracts) remains the
> product.
>
> **Length.** Deliberately detailed (~1,000+ lines) so you can re-read sections in isolation after a
> break. Update the [Locked decisions](#locked-decisions-record) when reality changes.

## Table of contents

1. [Locked decisions record](#locked-decisions-record)
2. [Executive summary](#executive-summary)
3. [Buyer persona: agencies](#buyer-persona-agencies)
4. [Tenancy: multi-tenant vs single-tenant per client](#tenancy-multi-tenant-vs-single-tenant-per-client)
5. [Post–Reward Hub application surfaces](#postreward-hub-application-surfaces)
6. [Kafka and analytics-consumer (staying in default template)](#kafka-and-analytics-consumer-staying-in-default-template)
7. [Cedar for all agency forks](#cedar-for-all-agency-forks)
8. [Semver template releases](#semver-template-releases)
9. [Reward Hub removal — detailed program](#reward-hub-removal--detailed-program)
10. [Authorization kernel — deep reference](#authorization-kernel--deep-reference)
11. [Runtime validation (rule 28)](#runtime-validation-rule-28)
12. [Production readiness phases](#production-readiness-phases)
13. [DigitalOcean deployment reference](#digitalocean-deployment-reference)
14. [Developer experience and onboarding](#developer-experience-and-onboarding)
15. [CI, quality gates, and parity gaps](#ci-quality-gates-and-parity-gaps)
16. [Improvement backlog (expanded)](#improvement-backlog-expanded)
17. [Success metrics and certification](#success-metrics-and-certification)
18. [Risk register](#risk-register)
19. [Appendices](#appendices)

---

## Locked decisions record

These decisions were confirmed by the maintainer and should be treated as **template policy** until
explicitly revised.

| # | Question | Decision | Implications (short) |
| --- | --- | --- | --- |
| 1 | Per client: one DO project vs multi-tenant in one deployment? | **Both.** Some clients want multi-tenancy; some want single-tenancy. | Use `TENANCY_ENABLED` + `DEFAULT_ORGANIZATION_ID` per deployment; document two DO runbook variants. |
| 2 | Merchant app after strip? | **Keep app shell; placeholder page only** (remove reward content). | Merchant port stays in monorepo; CI may smoke placeholder route; Cedar/capability docs trimmed of reward-specific flows. |
| 3 | Kafka + analytics-consumer? | **Keep in default template** (not profile-only, not deleted). | `compose.yml` stays full-featured; CI keeps consumer e2e; agencies accept Docker footprint. |
| 4 | Cedar for agency forks? | **Keep for all forks** (not “RBAC-only narrative”). | Onboarding must teach Cedar + capabilities; reward-specific Cedar actions removed with vertical. |
| 5 | Web after strip? | **Placeholder page**; **admin keeps dashboard layout** as today. | Web = marketing/auth shell; admin = primary operator UI; sample category remains teaching module. |
| 6 | Template updates? | **Semver releases with migration notes** (not fork-once-never-merge). | Tag releases, CHANGELOG, upgrade guides for Prisma migrations and env renames. |

---

## Executive summary

### What this repository is

This is a **NestJS + Next.js Turborepo starter kit** with an unusually deep **platform kernel**:

- Shared Zod contracts (`@workspace/shared`) from database to Swagger to browser.
- NestJS API on Fastify with global validation, audit logging, idempotency patterns, outbox, optional Kafka.
- Multiple Next.js apps with **separate session cookies** per surface (`X-Client-Type`).
- Authorization **kernel** (RBAC, scopes, ACL, JSON policies) plus **tenant Cedar policies** and **PostgreSQL RLS**.
- CI that mirrors production concerns: migration immutability, RLS manifest, seed coverage, API e2e, Playwright, analytics-consumer e2e.

Reward Hub is **not** the long-term product of the template; it is a **reference vertical** being removed.
After removal, the **sample category** module is the golden path for “how to add a feature.”

### What “production ready” means for an agency template

Production ready does **not** mean “every ADR is implemented” (payments port is still accepted-not-built).
It means:

1. A fork can deploy to **DigitalOcean** using a documented golden path.
2. A fork can choose **single-tenant or multi-tenant** without rewriting authorization code.
3. A junior can add a CRUD feature using **one documented chain** (contract → DB → RLS → API → client → admin UI).
4. `pnpm ci:local` passes on a clean machine with documented prerequisites.
5. **Semver releases** tell forks what broke and how to migrate.

### What to preserve while stripping Reward Hub

Do **not** accidentally remove platform value:

- Authorization kernel, Cedar control plane, reference-data sync, RLS manifest discipline.
- Contract-first API and response validation.
- Audit logs and security middleware (CSRF on mutations, rate limits, etc.).
- Messaging package, outbox, analytics-consumer (per decision #3).

---

## Buyer persona: agencies

### Why agencies are the primary audience

Agencies fork once per client (or per product line). Their needs differ from a single startup:

| Need | How the kit should help |
| --- | --- |
| Predictable upgrade path | Semver + migration notes |
| White-label | `APP_NAME`, URLs, email from-address (document cookie pitfalls) |
| Variable tenancy | Env-flip single vs multi tenant |
| Proof of quality | `ci:local` + sample category module |
| Time to first demo | Minimal seed + admin dashboard shell |

### Agency anti-patterns to document in forking guide

1. **Renaming session cookie names** without a coordinated migration — breaks all logged-in users.
2. **Disabling RLS** “temporarily” in production — forbidden; use `@RlsBypass()` only with audited system operations.
3. **Skipping `db:sync-reference-data` on deploy** — permissions/catalog drift; mysterious 403s.
4. **Seeding production** — never; use bootstrap superadmin runbook.
5. **Trusting admin UI hiding** — every new endpoint still needs server authorization.

### Per-client deployment models (decision #1 expanded)

Agencies will run **both** models across their portfolio:

```text
Model A — Single-tenant per client (common for B2B “dedicated instance”)
  One DO App / one database / one “logical customer”
  TENANCY_ENABLED=false
  DEFAULT_ORGANIZATION_ID=<uuid of the one org row>
  Staff admins may bypass RLS (see ADR 007)

Model B — Multi-tenant SaaS for one client’s product
  One DO App / one database / many organizations
  TENANCY_ENABLED=true
  DEFAULT_ORGANIZATION_ID unset (not used)
  Only SuperAdmin bypasses RLS globally; staff are org-scoped
```

**Same codebase, different env.** This is a major selling point — do not fork the repo per model.

### DigitalOcean project strategy

| Strategy | When agencies use it | Notes |
| --- | --- | --- |
| **One DO project per end-client** | Dedicated instances, compliance, single-tenant | Higher ops cost; simpler blast radius |
| **One DO project per agency “platform”** | Agency runs many single-tenant instances | Separate databases still recommended |
| **One deployment multi-tenant** | Client’s product is SaaS | Strong RLS + tenancy testing in CI |

Document all three; recommend **managed Postgres + managed Redis** for every production API.

---

## Tenancy: multi-tenant vs single-tenant per client

### Source of truth in code

- **ADR:** [ADR 007: Tenancy mode and RLS bypass](../adr/007-tenancy-and-rls-bypass.md)
- **Config:** `apps/api/src/config/api-config.schema.ts`, `tenancy.config.ts`
- **Boot verification:** `DefaultOrganizationService` — single-tenant mode refuses to start if `DEFAULT_ORGANIZATION_ID` is not a live organization row.
- **Runtime:** `RlsInterceptor`, `RlsPool`, `TenancyConfigService`

### Environment variables

| Variable | Single-tenant | Multi-tenant |
| --- | --- | --- |
| `TENANCY_ENABLED` | `false` (default) | `true` |
| `DEFAULT_ORGANIZATION_ID` | **Required** — UUID of real org | **Unused** — must not be relied upon |

Full reference: [API configuration — Tenancy](./configuration/api.md).

### RLS bypass matrix (memorize for incidents)

| Condition | Single-tenant | Multi-tenant |
| --- | --- | --- |
| `@RlsBypass()` on handler | Bypass | Bypass |
| No authenticated user (pre-auth routes) | Bypass | Bypass |
| `isSuperAdmin` on JWT | Bypass | Bypass |
| Staff with `hasAdminAccess` | **Bypass** | **No bypass** — scoped RLS |
| Normal end user | Scoped to user | Scoped to user + verified org |

**Incident rule:** never disable RLS globally. See [Multi-tenancy operations runbook](./operations/multi-tenancy-runbook.md).

### `DEFAULT_ORGANIZATION_ID` — what it is NOT

- It is **not** a fake placeholder string — boot verifies the organization exists.
- It is **not** used in multi-tenant mode for “default tenant when header missing” — multi-tenant fails closed without verified org context.
- It is **not** a substitute for authorization — kernel checks still apply; RLS is an additional layer.

### Agency checklist: choosing tenancy for a new client

**Choose single-tenant when:**

- Client pays for isolated database/instance.
- All staff should see all rows for that client’s org (template/internal tool style).
- You want simpler admin operations debugging (staff RLS bypass).

**Choose multi-tenant when:**

- Client’s product is SaaS with many organizations on one deployment.
- Compromise of one staff admin account must not expose all tenants’ rows.
- You will invest in org-switching UX (`x-organization-id` discipline).

### Migration between modes (dangerous — plan explicitly)

Switching `TENANCY_ENABLED` on an existing production database is a **major** operational change:

1. Freeze writes or maintenance window.
2. Audit all `@RlsBypass()` usage and admin code paths assuming staff bypass.
3. Re-test every admin list endpoint with `kernel.filter()` and RLS policies.
4. Re-run full API e2e and authorization test suites.
5. Update client apps to send org context headers where required.

Document as a semver **major** template release if you provide automation.

### Testing tenancy in development

- Single-tenant: default `.env.example` path after minimal seed.
- Multi-tenant: integration tests and e2e should cover `TENANCY_ENABLED=true` scenarios (extend if missing post-rewards).

---

## Post–Reward Hub application surfaces

### Decision summary (#2 and #5)

| App | Port | After strip |
| --- | --- | --- |
| `@workspace/web` | 3000 | **Placeholder** — marketing/auth shell, not a consumer Reward Hub |
| `@workspace/admin` | 3001 | **Full dashboard layout** — primary operator UI (as today) |
| `@workspace/merchant` | 3003 | **Placeholder only** — app remains, reward flows removed |
| `@workspace/docs` | 3002 | Astro docs; remove Reward Hub user-guide prominence |
| `@workspace/api` | 8080 | Kernel + sample modules; rewards modules deleted |

### Web placeholder — what to keep

Keep infrastructure that agencies reuse:

- Auth cookie flow for `X-Client-Type: web` if you still demo consumer login later.
- Layout, theme, `@workspace/ui` patterns.
- A single page explaining “fork this app for your customer-facing product.”

Remove:

- Reward Hub routes, claim flows, consumer dashboards tied to rewards contracts.

### Admin — what stays

- Dashboard layout, sidebar system, command palette patterns.
- Settings, access control, user management (platform scope).
- **Catalog → sample categories** as the teaching module.
- Authorization explorer / RBAC admin surfaces (kernel value).

Prune menus and permissions that only existed for rewards, KYB, POS, merchant analytics.

### Merchant placeholder — why keep the app at all

Reasons aligned with your decision:

1. **Proves multi-app cookie isolation** (`merchant` vs `admin` vs `web`) in one repo.
2. **Proves org-slug routing** (`/orgs/[orgSlug]/…`) for future B2B portals.
3. **Avoids another “how to add a Next app” doc** — agencies duplicate merchant shell for client portals.

Placeholder content should state clearly: “Implement your org-scoped portal here.”

### Client package (`@workspace/client`)

After rewards removal:

- Remove endpoint registry leaves for reward/merchant/POS APIs.
- Keep auth, session sync, `can()`, url-state, download helpers.
- Regenerate or prune OpenAPI-dependent docs samples.

---

## Kafka and analytics-consumer (staying in default template)

### Decision (#3)

Kafka and `apps/analytics-consumer` **remain in the default template**, not hidden behind compose profiles only.

### Why this matters for agencies

| Benefit | Cost |
| --- | --- |
| Demonstrates **transactional outbox → Kafka** pattern | Heavier local Docker (RAM, ports) |
| CI already runs **analytics-consumer e2e** | More env vars to explain |
| Shows event ingestion + idempotent inbox | Another deployable component on DO |

### Local development story (document clearly)

```text
pnpm docker:up     → Redis, Kafka, RabbitMQ, Mailpit, Bull Board (see compose.yml)
KAFKA_BROKERS unset  → API still runs; outbox events may remain pending (documented)
analytics-consumer   → separate process; needs apps/analytics-consumer/.env
```

Getting started should list **minimum** vs **full** stack without implying Kafka is deleted in template.

### Production on DigitalOcean

Options to document:

1. **Managed Kafka** (if DO or Confluent Cloud) — agency enterprise clients.
2. **Self-hosted Kafka on Droplet** — smaller clients; operational burden.
3. **Disable Kafka** — API runs; outbox backlog; **not** ideal for analytics path but valid for MVP.

Because consumer stays in template, provide a **“deploy consumer”** section: same DB migrations, consumer login role, topic provisioning (see consumer e2e and docs).

### What not to do

- Do not remove consumer from CI without replacing with a lighter contract test — you would lose regression signal.
- Do not pretend Kafka is optional in every production — document when it is required (analytics, certain outbox consumers).

---

## Cedar for all agency forks

### Decision (#4)

**Keep Cedar for all agency forks** — the default narrative is **not** “RBAC + RLS only.”

### Three layers (teach in onboarding)

```text
1. PERMISSION.* / platform RBAC     → platform admin panel capabilities
2. MERCHANT_CAPABILITY.* + role table → org-scoped capability baseline
3. Tenant Cedar policies            → may NARROW capabilities, never widen
```

Kernel JSON policies (ABAC) are a **fourth** concept — do not conflate with Cedar.

### What changes when Reward Hub is removed

Remove or rewrite:

- Cedar actions tied to `manage_rewards`, KYB, POS, analytics exports (as product features).
- `organization-reward-auth` naming — rename to org capability gate without “reward” in the name if service survives.
- Merchant docs that walk reward-specific Cedar examples.

Keep:

- Cedar control plane, policy publish, audit, default tenant policy seed.
- File authorization paths that used Cedar (still valid for org file categories).
- Testing patterns in `organization-reward-auth.service.spec.ts` → migrate to generic org capability tests.

### Agency onboarding requirement

Every fork engineer should read:

1. [Authorization overview](./authorization/overview.md)
2. [Backend kernel](./authorization/backend.md) — Cedar section
3. [Troubleshooting](./authorization/troubleshooting.md) — `ORGANIZATION_ACTION_FORBIDDEN`

Provide **authorization ladder** appendix (see §10) mapping “I only build admin CRUD” vs “I build org portal with Cedar.”

### Debugging 403s

Train teams on:

- `POST /authorization/decisions/explain` (or equivalent explain API)
- Authorization audit rows
- Difference between kernel deny vs Cedar narrow vs missing org header

---

## Semver template releases

### Decision (#6)

Ship **semver releases with migration notes** — forks are expected to **merge or cherry-pick upstream**, not clone once silently.

### Versioning scope

| Artifact | Versioning |
| --- | --- |
| **Template repo** (monorepo) | Git tags `vMAJOR.MINOR.PATCH` |
| Internal packages `@workspace/*` | Workspace protocol; version together on tag |
| Database | Prisma migrations — **immutable** history per rules/13 |
| Public API | OpenAPI in `docs/generated/openapi.json` — breaking changes bump major |

### Release notes must include

1. **Prisma:** new migrations — expand/contract notes if risky.
2. **Env:** new required variables, renamed variables, stricter validation.
3. **Authorization:** new permissions — run `db:sync-reference-data`.
4. **Breaking:** removed routes, removed apps pages, Cedar action renames.
5. **Upgrade command sequence:** `pnpm install`, `pnpm build:shared`, `pnpm db:deploy`, sync reference data, restart workers.

### Recommended branching model for agencies

```text
upstream/main     → your template releases
client/acme       → long-lived fork; merge v1.x tags on schedule
client/acme/v2    → optional breaking upgrade branch
```

### Changesets

Consider [Changesets](https://github.com/changesets/changesets) only if you publish packages outside the monorepo; for template-only, **CHANGELOG.md + GitHub Releases** may suffice.

### Communication cadence

| Release type | Expectation |
| --- | --- |
| PATCH | Security, bugfix, doc — safe to merge quickly |
| MINOR | Features, new permissions, new optional env — read notes |
| MAJOR | Tenancy default change, migration squash, rewards-level removals |

---

## Reward Hub removal — detailed program

### Program principles

1. **One milestone PR series** — not six months of drift.
2. **CI green after each merge** — `pnpm run lint` + `pnpm run test` + `ci:local` before calling done.
3. **No authorization kernel rewrite** in the same program.
4. **Update seed coverage** — every remaining table/column still seeded or exempted with reason.

### Workstreams

#### WS-A — Database and Prisma

- Inventory models: rewards, claims, redemptions, POS, referrals, merchant KYB, terminals, etc.
- Design target schema: kernel + organization + sample catalog + files + auth + audit.
- Migration strategy:
  - **Option 1:** New baseline migration (update `migrations-baseline.json`) — clean for agencies, painful for existing forks.
  - **Option 2:** Forward migrations dropping tables — better for ongoing forks; more SQL review.
- RLS: remove policies for dropped tables; update `manifest-index.ts`.
- Run `pnpm db:check-rls-manifest` after every migration PR.

#### WS-B — API modules

- Remove `apps/api/src/modules/rewards/**` (~124 files today).
- Remove reward-specific controllers from organization module if any.
- Prune `apiRoutes` and `contracts/index.ts` leaves.
- Update `app.module` imports and queue modules.
- Remove POS rate limit guards if only used by rewards.
- Re-run `openapi:export` and `pnpm docs:api` sample capture.

#### WS-C — Shared contracts

- Delete `packages/shared/src/schemas/domain/rewards/**` (and related exports).
- Prune `permission.ts` — remove `REWARD_*`, merchant capabilities tied to rewards.
- Prune Cedar action maps in organization constants.
- Keep list-query helpers, api-error, auth schemas intact.

#### WS-D — Frontends

**Web:** replace Reward Hub pages with placeholder; keep root layout and auth.

**Admin:** remove rewards/merchants/kyb/analytics menu entries; keep dashboard shell.

**Merchant:** single placeholder route under org slug; remove reward panels.

**Client:** prune `endpoints.ts` tree; fix tests.

#### WS-E — Seed and scenarios

- Introduce `minimal` scenario: one org, superadmin path, sample categories, one web user optional.
- Trim `enterprise` scenario or repurpose for load testing only.
- Update `organization-seed-ids.ts` if default org UUID changes.
- Update `DEFAULT_ORGANIZATION_ID` in `.env.example` to match minimal seed org.

#### WS-F — Documentation and marketing

- README, docs/README, user-guide: remove Reward Hub promises.
- Keep technical depth on kernel.
- Update blog posts or add deprecation banner.

#### WS-G — CI and e2e

- Rewrite e2e tests that login as merchant for rewards flows.
- Playwright: admin login + sample category CRUD smoke.
- analytics-consumer e2e: ensure topics/events not reward-specific if they were.
- Seed coverage audit: delete exemptions for dropped tables.

### Definition of done (rewards program)

- [ ] No `modules/rewards` in API.
- [ ] No reward exports in `@workspace/shared` public API.
- [ ] Web + merchant show documented placeholders.
- [ ] Admin sample category works end-to-end.
- [ ] `pnpm ci:local` passes.
- [ ] Roadmap doc updated (this file) — Reward Hub marked complete.

---

## Authorization kernel — deep reference

### Is the kernel “wrong”?

**No.** It is intentional, tested, layered security. Confusion is not the same as incorrect design.

### Request flow (authoritative)

```text
HTTP Request
  → AuthGuard (session/JWT/API key)
  → AuthorizationGuard (decorators → kernel)
  → ZodValidationPipe (shared schemas)
  → Controller → Service → Repository
  → Prisma with RLS session variables set
  → Response validated + audit log
```

Frontend `can()` is **never** step 2 — only step 6 UX.

### Kernel API surface (learn these methods)

| Method | Use |
| --- | --- |
| `can()` | Boolean check |
| `authorize()` | Throws mapped 403 |
| `explain()` | Why deny — debugging |
| `filter()` | List queries — DB-side scope |
| `resourceCapabilities()` | UI capability sets |
| `hasRoles()` | Role checks |

Location: `apps/api/src/modules/authorization/kernel/authorization-kernel.service.ts`

### Grants loader — where permissions come from

`subject-grants.loader.ts` aggregates:

- Role permissions (with inheritance)
- Store membership roles
- User ALLOW/DENY overrides
- Implicit self grants

Caches invalidated via `authorization-invalidation.service.ts` — Redis in production matters.

### When to use which decorator

Document in [Recipes](./authorization/recipes.md) (expand):

| Scenario | Typical decorators |
| --- | --- |
| Platform admin CRUD | `@RequirePermission(PERMISSION....)` |
| Org-scoped merchant API | `@Authorize` + membership capability |
| Public signup | `@Public()` + `@RlsBypass()` where needed |
| File download | `FileAuthorizationService` |

### Authorization ladder (for agencies)

**Level 1 — Platform admin only (post-rewards typical)**

- Add `PERMISSION` in shared.
- Seed permission catalog.
- Protect controller with `@RequirePermission`.
- Add admin menu gated with `can()`.
- RLS policies for new tables with org/platform scope as appropriate.

**Level 2 — Organization portal (merchant placeholder future)**

- `MERCHANT_CAPABILITY` (renamed/generic capabilities).
- `requireMembershipCapability` pattern.
- `guardOrgPage` + `ORG_PAGE_RULES` on server components.
- Cedar tenant policy publish (narrow only).

**Level 3 — Row-level list filtering**

- `kernel.filter()` in repository list methods.
- Never fetch-all-then-filter in JavaScript.

### Why not rewrite the kernel during rewards removal?

| Risk | Detail |
| --- | --- |
| Regression surface | 86+ files under `modules/authorization` |
| Coupled tests | Guard specs, kernel specs, e2e authz |
| RLS coupling | Policies assume kernel org resolution |
| Cedar coupling | Tenant policies reference capability actions |

Improve docs and trim vertical permissions instead.

### SuperAdmin

- Bypasses permission checks — audited.
- Agencies need runbook: who holds SuperAdmin, break-glass, no daily use.

---

## Runtime validation (rule 28)

### Problem statement

`typeof x === "string"` in business logic duplicates Zod and drifts from `z.infer<>`.

### Trust zone model

Parse **once per boundary** (HTTP handler, queue consumer, storage read), then pass inferred types inward.

### ESLint enforcement

`packages/eslint-config/restricted-syntax-rules.js` — `runtimeValidationRestrictedSyntaxSelectors`.

Schema authoring paths exempt for `z.custom` predicates.

### Shared helpers (`@workspace/shared`)

| Helper | Purpose |
| --- | --- |
| `isPlainObject` / `assertPlainObject` | Route trees, JSON unions |
| `isArrayValue` | Replace `Array.isArray` for structural branches |
| `isStringPrimitive`, etc. | Narrow without `typeof` |
| `isFunctionValue` | Includes `AsyncFunction` (Nest route handlers) |
| `hasGlobalConstructor` | `BroadcastChannel`, `IntersectionObserver` |
| `CaughtValueSchema`, `messageFromCaughtValue` | Catch blocks |

Full rule: [`rules/28-runtime-validation.md`](../../rules/28-runtime-validation.md).

### Lesson learned (OpenAPI bootstrap)

`RouteHandlerSchema` must treat **async** controller methods as functions (`[object AsyncFunction]`). Use `safeParse` and skip non-callable prototype entries in `collectPublicOperationIds`.

---

## Production readiness phases

### Phase 0 — Product definition (complete when rewards stripped)

- Kernel vs placeholder apps documented.
- Sample category is golden reference.
- Locked decisions table at top of this doc kept current.

### Phase 1 — Operable production

- `docs/technical/operations/digitalocean.md` written.
- First production deploy checklist (bootstrap superadmin, no seed).
- Redis required in prod called out on every runbook page.

### Phase 2 — Certification module

- Optional tiny module (`contacts`) **or** sample category timed exercise.
- Payments boundary documented (ADR 020).

### Phase 3 — Adoption ergonomics

- `pnpm dev:stack` documented.
- Forking guide with semver merge strategy.
- Fix `rules/26` contracts → shared naming.

### Phase 4 — Hardening

- CI job with Redis for API smoke.
- Merchant placeholder Playwright smoke (login optional).
- Feature flags for experimental admin pages.

---

## DigitalOcean deployment reference

### Recommended reference architecture (agency default)

```text
                    ┌─────────────────────────────────────┐
                    │  DigitalOcean App Platform          │
                    │  - api (Nest/Fastify bundle)        │
                    │  - admin (Next.js)                  │
                    │  - web (Next.js)                    │
                    │  - merchant (Next.js) placeholder   │
                    └──────────────┬──────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  Managed PostgreSQL        Managed Redis              Spaces (S3)
         │                         │
         │                  analytics-consumer (worker component
         │                  or separate App — decision per client)
         ▼
  Optional: Managed Kafka OR self-hosted on Droplet
```

### Environment variable checklist (API)

Copy from [API configuration](./configuration/api.md). Minimum production set:

- `NODE_ENV=production`
- `DATABASE_URL` (SSL)
- `REDIS_URL` (**required**)
- `JWT_*` secrets (≥32 chars, unique)
- `API_PUBLIC_URL` (HTTPS)
- `CORS_ORIGINS` (all Next app origins)
- `COOKIE_DOMAIN` if sharing cookies across subdomains
- `STORAGE_PROVIDER` + Spaces credentials
- `EMAIL_MODE=send` + Resend + webhook secret
- `TENANCY_ENABLED` / `DEFAULT_ORGANIZATION_ID` per client model
- `KAFKA_BROKERS` if outbox/analytics path active

### Environment variable checklist (each Next app)

See [Frontend configuration](./configuration/frontend.md):

- `NEXT_PUBLIC_API_URL`
- App-specific public URLs for redirects

### Deploy sequence (every release)

```bash
# 1. Build artifacts (CI does this)
pnpm build:shared
pnpm turbo run build --filter=@workspace/api ...
# 2. Database
pnpm db:deploy              # migrate + RLS
pnpm db:sync-reference-data # permissions catalog
# 3. One-time per environment (not per deploy)
# pnpm admin:bootstrap-superadmin ...
# 4. Roll containers / App Platform deploy
# 5. Smoke: GET /health/ready, admin login, sample category list
```

### TLS and proxy

- Set `TRUST_PROXY` when behind DO load balancer.
- Ensure cookies are `Secure` in production builds.

### Spaces (object storage)

- Map to existing S3 storage abstraction.
- CORS for browser direct upload must include web/admin origins.

### Single-tenant DO deployment variant

- `TENANCY_ENABLED=false`
- Seed **locally** to create org; note UUID in `DEFAULT_ORGANIZATION_ID` for prod env.
- Document that prod does not run seed — create org via migration SQL or one-time admin script if needed.

### Multi-tenant DO deployment variant

- `TENANCY_ENABLED=true`
- No `DEFAULT_ORGANIZATION_ID`
- Test org creation invite flow and RLS denial paths before go-live.

---

## Developer experience and onboarding

### Day 1 path (recommended)

```bash
pnpm setup
cp apps/api/.env.example apps/api/.env
# ... web, admin, merchant examples
pnpm secrets:generate apps/api/.env
pnpm docker:up
pnpm db:deploy && pnpm db:seed -- --scenario minimal   # after you add minimal
pnpm dev:api
pnpm dev:admin
```

### Day 2 — add a feature

Follow [Adding a feature](./adding-a-feature.md) using sample category as template.

### Day 3 — authorization

Read overview + recipes; run explain API on a denied request in dev.

### Pain points to fix (non-rewards)

| Pain | Fix |
| --- | --- |
| Five ports | Document filters; add `dev:stack` script |
| Native Postgres + Docker | Document “Postgres in Docker” uncomment path |
| Long rules/ folder | Point juniors to roadmap + rule 26 + golden reference |
| docs lint vs shared dist | turbo `lint` dependsOn `^build` for docs |

---

## CI, quality gates, and parity gaps

### What CI already proves

See [CI pipeline](./operations/ci.md): lint, typecheck, test, build, RLS manifest, migrations, audit, e2e, Playwright, analytics-consumer.

### Known parity gaps

| Gap | Recommendation |
| --- | --- |
| API e2e without Redis | Add smoke with Redis service container |
| Merchant not in Playwright | Placeholder route smoke after strip |
| CI Node 24 vs engines >=22.12 | Document both |

### Completion gate (local)

```bash
pnpm run lint   # zero errors, zero warnings
pnpm run test   # all workspaces
```

Before claiming any milestone done.

### `ci:local`

Agencies should run before client go-live:

```bash
pnpm ci:local
# or --skip-e2e for fast check (not full parity)
```

---

## Improvement backlog (expanded)

### High impact

1. **DigitalOcean runbook** — full doc file.
2. **dev:stack** script — api + admin + web.
3. **minimal seed scenario** — part of rewards program.
4. **Forking guide** — semver merge, white-label pitfalls.
5. **Authorization ladder** — section in recipes or standalone.
6. **Redis CI smoke** — production parity.

### Medium impact

7. Compose profiles for **optional** Rabbit/Bull Board (Kafka stays default per your decision).
8. Root package rename from `hello-world`.
9. Certification timed exercise documented.
10. ESLint tests for rule 28 selectors.
11. Fix junior guide `packages/contracts` → `packages/shared`.
12. Mobile mention in AGENTS until app exists.

### Lower impact

13. Feature flag example in admin.
14. Payments port stub + ADR status in README.
15. Multipart upload roadmap in storage docs.

---

## Success metrics and certification

| Metric | Target | How to measure |
| --- | --- | --- |
| CRUD feature | &lt;4h junior / &lt;2h mid | Timed sample category clone |
| Fork → staging | ≤15 steps | DO checklist rehearsal |
| `ci:local` | Pass on clean laptop | New engineer onboarding |
| Junior PR | No Slack help | Scripted small UI task |
| Semver upgrade | Fork merges minor in &lt;1 day | Dry-run release notes |

---

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Rewards removal breaks CI e2e | High | High | Workstream G; incremental merges |
| R2 | Agency merges major without reading notes | Med | High | Semver + CHANGELOG + migration scripts |
| R3 | Single/multi tenancy misconfigured | Med | Critical | Boot-time validation; runbook |
| R4 | Cedar confusion after strip | Med | Med | Ladder doc; rename reward-auth service |
| R5 | DO deploy drift from CI build | Med | Med | Document build filters; env parity table |
| R6 | Kafka ops burden for small clients | Med | Med | Document “pending outbox” mode; still keep in template |
| R7 | Placeholder apps look “broken” | Low | Med | Clear copy on web/merchant placeholders |

---

## Appendices

### Appendix A — Glossary (quick)

| Term | Meaning |
| --- | --- |
| Kernel | Auth + authorization + RLS + contracts + audit + jobs |
| Reference vertical | Reward Hub (being removed) |
| Golden module | Sample category |
| Trust boundary | HTTP, queue, disk — parse Zod once |
| Staff bypass | Single-tenant RLS behavior for admins |

### Appendix B — Related documentation index

| Doc | Path |
| --- | --- |
| Getting started | [getting-started.md](./getting-started.md) |
| Architecture | [architecture.md](./architecture.md) |
| Adding a feature | [adding-a-feature.md](./adding-a-feature.md) |
| ADR 007 Tenancy | [../adr/007-tenancy-and-rls-bypass.md](../adr/007-tenancy-and-rls-bypass.md) |
| Authorization overview | [authorization/overview.md](./authorization/overview.md) |
| CI | [operations/ci.md](./operations/ci.md) |
| Rule 28 | [../../rules/28-runtime-validation.md](../../rules/28-runtime-validation.md) |
| AGENTS | [../../AGENTS.md](../../AGENTS.md) |

### Appendix C — Post-rewards placeholder copy (suggested)

**Web home:** “Customer-facing application placeholder. Implement your product routes in `apps/web`.”

**Merchant home:** “Organization portal placeholder. Implement B2B features under `apps/merchant/app/orgs/[orgSlug]`.”

### Appendix D — Semver release template (CHANGELOG snippet)

```markdown
## vX.Y.Z — YYYY-MM-DD

### Breaking
- ...

### Migrations
- Run `pnpm db:deploy` — includes migration `2026....`

### Environment
- New required: `...`

### Authorization
- Run `pnpm db:sync-reference-data` after deploy.

### Upgrade steps
1. ...
```

### Appendix E — Reward removal file checklist (representative)

Use `git grep` / ripgrep before merge; this list is representative not exhaustive.

1. `apps/api/src/modules/rewards/`
2. `packages/shared/src/schemas/domain/rewards/`
3. `packages/shared/src/contracts/ leaves for rewards`
4. `apps/web/app/** reward* routes`
5. `apps/admin/** rewards*, merchants*, kyb*`
6. `apps/merchant/** reward* panels`
7. `docs/user-guide/** reward*`
8. `docs/technical/api/analytics.md (trim or rewrite)`
9. `apps/docs api-reference samples for reward endpoints`
10. `prisma seed enterprise reward graphs`
11. `permission.ts REWARD_* and merchant reward capabilities`
12. `organization-reward-auth (rename/refactor)`

### Appendix F — Per-endpoint authorization mapping template

Copy into each feature's module README or PR description:

| Field | Value |
| --- | --- |
| Endpoint | `METHOD /path` |
| Permission(s) | `PERMISSION....` |
| Scope | GLOBAL / ORGANIZATION / ... |
| Ownership check | yes/no — rule |
| RLS table policies | `table_name` |
| Cedar | action or n/a |
| Public? | no |
| Frontend `can()` slug | same as permission |

### Appendix G — DigitalOcean App Platform component list (starter)

- **api** — build command, run command, health check path, env group
- **admin** — build command, run command, health check path, env group
- **web** — build command, run command, health check path, env group
- **merchant** — build command, run command, health check path, env group
- **analytics-consumer (worker)** — build command, run command, health check path, env group

### Appendix H — `TENANCY_ENABLED` FAQ lines for support

**Q:** Why does admin see all rows in dev but not staging?
**A:** Staging may be multi-tenant; dev may be single-tenant with staff RLS bypass.

**Q:** Why is DEFAULT_ORGANIZATION_ID required?
**A:** Single-tenant mode fixes org context to one verified row.

**Q:** Can I set DEFAULT_ORGANIZATION_ID in multi-tenant?
**A:** Ignored; use org headers and membership guards.

**Q:** Does Public() bypass RLS?
**A:** No — add @RlsBypass() only when intentional.

**Q:** Where is tenancy configured?
**A:** apps/api/.env TENANCY_ENABLED and ADR 007.

#### WS-A Database — task list

- [ ] 1. List all Prisma models with reward or POS relations
- [ ] 2. Draw dependency graph (FK order for drops)
- [ ] 3. Write migration DROP TABLE in safe order
- [ ] 4. Remove RLS policies referencing dropped tables
- [ ] 5. Update manifest-index.ts
- [ ] 6. Run db:check-rls-manifest locally
- [ ] 7. Run db:check-drift in CI
- [ ] 8. Update seed coverage exemptions file with deletions
- [ ] 9. Verify analytics_events if consumer stays
- [ ] 10. Document new baseline if squashing

#### WS-B API — task list

- [ ] 1. Remove RewardsModule import from AppModule
- [ ] 2. Remove Bull queue processors for referrals
- [ ] 3. Unregister cron jobs for claims expiry
- [ ] 4. Delete OpenAPI tags for rewards
- [ ] 5. Fix health module dependencies
- [ ] 6. Re-run unit tests in authorization (no reward imports)
- [ ] 7. Update e2e-helpers seed user emails
- [ ] 8. Verify geo and auth modules still load
- [ ] 9. Check api-keys module for merchant reward scopes
- [ ] 10. Export OpenAPI artifact

#### WS-C Shared — task list

- [ ] 1. Remove reward exports from schemas/index.ts
- [ ] 2. Prune apiRoutes tree
- [ ] 3. Update contracts index
- [ ] 4. Remove MERCHANT_CAPABILITY reward entries
- [ ] 5. Update permissions-registry seed source
- [ ] 6. Fix client type exports
- [ ] 7. Run typecheck on all workspaces
- [ ] 8. Update docs generated samples
- [ ] 9. Verify list-query schemas unchanged
- [ ] 10. Keep JsonValue and auth schemas stable

#### WS-D Frontends — task list

- [ ] 1. Web: delete reward dashboard routes
- [ ] 2. Web: add placeholder page component
- [ ] 3. Admin: prune sidebar JSON
- [ ] 4. Admin: remove reward analytics charts
- [ ] 5. Merchant: replace org home with placeholder
- [ ] 6. Update breadcrumb tests
- [ ] 7. Fix route-coverage tests
- [ ] 8. Update Playwright selectors
- [ ] 9. Verify admin dashboard layout still wraps children
- [ ] 10. Check middleware auth redirects

#### WS-E Seed — task list

- [ ] 1. Define minimal scenario flags
- [ ] 2. Reduce organization-seed graph
- [ ] 3. Keep superadmin bootstrap path testable
- [ ] 4. Update enterprise scenario or gate behind CI only
- [ ] 5. Fix DEFAULT_ORGANIZATION_ID constant
- [ ] 6. db:check-seed-coverage green
- [ ] 7. Document minimal in getting-started
- [ ] 8. Remove Brew & Bean narrative
- [ ] 9. Keep sample categories in seed
- [ ] 10. Verify RLS applies on seeded rows

#### WS-F Docs — task list

- [ ] 1. README tech stack table
- [ ] 2. docs/README operator vs engineer split
- [ ] 3. Archive user-guide reward chapters
- [ ] 4. Update architecture diagram apps/web label
- [ ] 5. Blog deprecation notices
- [ ] 6. API reference regen
- [ ] 7. Link this roadmap from technical README
- [ ] 8. Update ADR cross-links if models removed
- [ ] 9. Fix broken internal links via docs:check-links
- [ ] 10. Update openapi-document e2e if needed

#### WS-G CI — task list

- [ ] 1. Grep e2e for reward strings
- [ ] 2. Replace with sample category flows
- [ ] 3. analytics-consumer e2e event types
- [ ] 4. Playwright admin catalog test
- [ ] 5. Remove merchant reward e2e or placeholder-only smoke
- [ ] 6. Verify turbo pipeline cache keys after package removals
- [ ] 7. Confirm `ci-local-plan.mjs` still matches `ci.yml`
- [ ] 8. Migration history check if baseline changes
- [ ] 9. RLS manifest job green on PR
- [ ] 10. Full `pnpm ci:local` before template tag

### Appendix I — Authorization kernel file map (study order)

| Order | Path | Why read it |
| --- | --- | --- |
| 1 | `apps/api/src/modules/authorization/guards/authorization.guard.ts` | Decorators become kernel calls |
| 2 | `apps/api/src/modules/authorization/kernel/authorization-kernel.service.ts` | `can`, `authorize`, `explain`, `filter` |
| 3 | `apps/api/src/modules/authorization/kernel/subject-grants.loader.ts` | Where grants are loaded |
| 4 | `apps/api/src/modules/authorization/kernel/policy-engine.service.ts` | JSON ABAC (not Cedar) |
| 5 | `apps/api/src/modules/authorization/kernel/acl.service.ts` | Explicit ALLOW/DENY rows |
| 6 | `apps/api/src/modules/authorization/kernel/tenant-membership.service.ts` | Org/store/location proof |
| 7 | `apps/api/src/modules/authorization/services/authorization-context.resolver.ts` | Tenant headers → verified context |
| 8 | `packages/shared/src/authorization/permission.ts` | Permission and capability constants |
| 9 | `apps/api/src/modules/authorization/decorators/authorize.decorator.ts` | Route requirement DSL |
| 10 | `docs/technical/authorization/backend.md` | Cedar + merchant capabilities chapter |

### Appendix J — Rule 28 migration patterns

| Instead of | Use |
| --- | --- |
| `typeof x === "string"` on wire JSON | `z.string().safeParse(x)` at boundary; `z.infer<>` inward |
| `Array.isArray(x)` on `T \| T[]` unions | `isArrayValue(x)` from `@workspace/shared` |
| `typeof window === "undefined"` | `globalThis.window === undefined` (or allowed `typeof window`) |
| `typeof BroadcastChannel === "undefined"` | `hasGlobalConstructor("BroadcastChannel")` |
| `catch (e)` + `typeof e === "string"` | `CaughtValueSchema.safeParse(e)` + `messageFromCaughtValue` |
| `z.custom` + `typeof fn === "function"` in app code | `isFunctionValue` (includes **async** handlers) |
| Route tree `typeof node === "string"` | `isPlainObject(node)` branch vs leaf string |
| OpenAPI `RouteHandlerSchema.parse` on prototype | `safeParse`; skip non-callable descriptors |

Full policy: [`rules/28-runtime-validation.md`](../../rules/28-runtime-validation.md).

### Appendix K — Agency fork FAQ (answers to draft in `forking.md`)

#### How do we rename the product?

Change `APP_NAME`, email templates, `NEXT_PUBLIC_*` app titles, and docs copy. Do **not** rename `X-Client-Type` values or cookie names without a coordinated auth migration.

#### How do we add a second Next app?

Copy `apps/web` workspace shape, add env schema, register CORS + cookie policy on API, add `X-Client-Type` value in shared auth schemas if it is a new session class.

#### How do we disable merchant app in deploy?

Omit merchant component from DO App Platform; keep code in monorepo for future portals. API must not require merchant origin in CORS if unused.

#### How do we run without Kafka temporarily?

Unset `KAFKA_BROKERS`; API runs; outbox events stay pending. Analytics-consumer needs Kafka — document that analytics path is degraded. Template **keeps** Kafka in default compose per policy.

#### How do we upgrade from template v1.2 to v1.3?

Read GitHub Release notes; `pnpm install`; `pnpm build:shared`; `pnpm db:deploy`; `pnpm db:sync-reference-data`; redeploy apps; run smoke tests. Major versions: read migration baseline notes.

#### How do we test multi-tenant locally?

Set `TENANCY_ENABLED=true` in `apps/api/.env`, seed multiple orgs, verify staff admin **does not** bypass RLS; test `x-organization-id` flows.

#### How do we create the first organization in production?

Production does not run seed. Use platform APIs after bootstrap superadmin, or a one-time migration/script documented in runbook — never `pnpm db:seed` on prod.

#### How do we rotate JWT secrets?

Plan session invalidation; rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with overlap strategy documented in security runbook (all sessions re-login).

#### How do we add a new permission?

Add to `permission.ts` + permissions registry seed source → `db:sync-reference-data` → protect controller → `can()` in admin → tests.

#### How do we debug RLS denials?

Check `TenancyConfigService` mode; verify `app.current_organization_id` context; read RLS policies for table; never disable RLS globally.

#### How do we use Cedar without rewards?

Keep capability table + tenant policies; remove reward-specific Cedar actions when vertical is stripped; use generic org capabilities for future merchant portal.

#### How do we configure Spaces CORS?

Mirror [AWS S3](./storage/aws-s3.md) guidance with DO Spaces endpoint; allow browser upload origins for web/admin.

#### How do we run analytics-consumer on DO?

Deploy as worker component; same `DATABASE_URL`; consumer credentials; `KAFKA_BROKERS`; run consumer e2e env as reference.

#### What breaks if we remove docs app?

None for runtime; CI docs link check and API reference site optional for forks.

#### Can we use only API + admin?

Yes — typical agency MVP; web/merchant placeholders optional in deploy.

### Appendix L — Conversation summary (original review themes)

The following themes from the starter-kit review are folded into this document:

1. **Agency fork persona** — semver, DO, minimal placeholders, kernel preserved.
2. **Improvements beyond rewards** — dev:stack, DO runbook, Redis CI parity, forking guide, docs drift fixes.
3. **Authorization kernel** — not broken; complexity is teaching + vertical coupling; Cedar stays.
4. **Runtime validation** — rule 28, shared helpers, async handler lesson for OpenAPI.
5. **Success metrics** — CRUD timing, ci:local, junior PR, fork-to-staging checklist.

### Appendix M — Document maintenance

- Update **Locked decisions record** when policy changes.
- Bump `lastUpdated` in front matter on substantive edits.
- After Reward Hub removal, mark **Definition of done** checkboxes in §9 and archive reward-specific appendices.
- Link new `digitalocean.md` and `forking.md` from [technical README](./README.md) when created.

---

*End of extended roadmap. This file intentionally exceeds 1,000 lines for offline reading; prefer editing the section you need rather than duplicating content elsewhere.*
