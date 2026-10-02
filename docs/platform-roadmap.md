---
title: "Platform Roadmap — Master Spec Gap Analysis"
tags: ["roadmap", "architecture", "platform"]
description: "Where the starter kit stands against the Master Implementation Specification, the decisions taken, and the phased plan to close every gap."
order: 9
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80"
---

# Platform Roadmap — Master Spec Gap Analysis

The *Production-Grade NestJS + NextJS Starter Kit — Master Architecture & Implementation
Specification* describes ~90 subsystems. This page records, section by section, what already
exists in this repository, what is partial, what is missing, the decisions taken where the spec
and the repo disagree, and the order in which the gaps are being closed.

> [!NOTE]
> The spec itself says to inspect before building (§97.1), to preserve sound existing
> architecture (§97.2) and to build foundations first (§94). This roadmap is the result of that
> inspection (four independent audits, 2026-10-01). Status legend: **EXISTS** · **PARTIAL** ·
> **MISSING**.

## Decisions

| Topic | Spec | Repo before | Decision |
| --- | --- | --- | --- |
| `as const` | Forbidden (§2.1) | Allowed by ESLint (cva/shadcn) but banned in `AGENTS.md` | **Enforce the ban** — lint rule + explicitly typed tuples/objects everywhere |
| Form library | TanStack Form (§48) | react-hook-form in 6 files, `useState` elsewhere | **TanStack Form** is the standard; migration happens in Phase G |
| Payments / billing | Provider-neutral port (§33) | Only plan/entitlement tables | **Provider port only** — `PaymentProvider` interface, domain types and a fake adapter; no real provider yet |
| Package names | `contracts`, `database`, `api-client`, … (§4) | `shared`, `client`, `ui`, `messaging` | **Keep** — the existing split is sound (§97.2); boundaries get lint enforcement instead |
| Timestamps | UTC (§36) | Epoch-ms `BigInt` everywhere | **Keep** — epoch ms is UTC by construction |
| Tenancy | Organization tenant + RLS (§13) | Organization → Location/Store, RLS-first (ADR 007/010) | **Keep**; add repository-level scoping (Phase E) |

## Where things stand

### Strong already

- **Authorization kernel** — roles, permissions, per-user allow/deny with documented precedence,
  ACLs, Cedar policies, `explain` ("why 403?") endpoint, frontend `<Can>` / `useCan`
  ([Authorization System](./authorization-system/overview.md)).
- **Tenancy** — membership-verified tenant resolution and PostgreSQL row-level security.
- **Password reset** — single-use hashed tokens, no user enumeration, session revocation.
- **Object storage** — ports and S3 / Firebase / local adapters, direct uploads, magic-byte checks.
- **Typed API client** over TanStack Query (`api.x.y.useQuery`) from one shared `apiContract`.
- **Generic data table** that never fetches; typed contracts with no `z.any` / `any` / casts.

### Gaps by area

| Area (spec §) | Status | Main gaps |
| --- | --- | --- |
| Monorepo & TS (§4–5) | PARTIAL | No import-boundary lint; `exactOptionalPropertyTypes` / `noImplicitOverride` missing; `noUncheckedIndexedAccess` off in api/shared/messaging |
| Config (§6) | PARTIAL | Three overlapping env schemas, ~100 raw `process.env` reads, insecure fallbacks |
| Database (§7–8) | PARTIAL | Seed has no scenarios; legacy Prisma generator |
| Request context (§14) | PARTIAL | Three separate AsyncLocalStorage stores |
| Layering / CRUD (§15, §19) | PARTIAL | Controllers querying Prisma; repositories used inconsistently |
| Contracts & lists (§16, §18) | EXISTS | Phase C done: one list grammar (C1), a documented + enforced + client-parsed response contract on every endpoint (C2), committed OpenAPI artifact (C3) |
| Error model (§20) | MISSING | No global filter; envelope code is dead |
| Sessions & auth (§10) | PARTIAL | No per-session id / revoke-one-device; email verification tokens not single-use; OAuth missing |
| Authorization (§12, §59, §68, §75) | PARTIAL | Free-text reasons (no codes); impersonation has no session/reason/expiry; no permission analyzer in CI |
| Security & rate limits (§37–38) | PARTIAL | Swagger public in production; IP-only rate limits; cookie hardening; 7 audit tables |
| Logging & observability (§21–23) | PARTIAL / MISSING | Redaction covers two headers; no OpenTelemetry/metrics/tracing |
| Messaging (§27–31) | PARTIAL | Outbox written outside the domain transaction; no inbox dedupe; no outgoing webhooks; scattered schedules |
| Idempotency & concurrency (§32) | PARTIAL | Service not wired; payload mismatch not a 409 |
| Flags, settings, i18n, search, import/export, privacy (§34–36, §42–44) | MISSING | — |
| Frontend (§45–52) | PARTIAL | Only 401/404 handled centrally; thin QueryClient defaults; mixed form approaches; no shortcut registry |
| CI, Docker, tests (§53–56) | PARTIAL / MISSING | No CI at all; compose lacks Postgres/Mailpit/MinIO; no factories |
| Developer OS & tooling (§57–92) | MISSING | No `/_dev` console, resource engine, schema registry, drift/impact/migration checks, scenarios, chaos, `.ai/` manifest |

## Phased plan

Each phase ends with `pnpm run lint` (zero warnings) and `pnpm run test` green.

| Phase | Scope | Status |
| --- | --- | --- |
| **A — Correctness & security** | Gate Swagger in production; remove hard-coded encryption fallback; central log redaction; transactional outbox + inbox dedupe; global error filter + `AppError` envelope; `Idempotency-Key` with 409 on mismatch; liveness/readiness; controllers off Prisma; remove Telescope leftovers; create the `app_runtime` role before first use (fresh clusters) | **Done** — see [Error model](./error-model.md), [Messaging](./infrastructure/messaging.md), ADR 015/016 |
| **B — Foundations** | Strict TS flags repo-wide; `as const` ban; import-boundary lint; one zod-validated config (server/client split, no raw `process.env`); unified request context; GitHub Actions CI; Postgres/Mailpit/MinIO in compose; seed scenarios | **Done** — see [Configuration](./configuration.md), [API configuration](./api-configuration.md), [CI](./operations/ci.md), [Local infrastructure](./operations/local-infrastructure.md), ADR 017/018 |
| **C — Contracts & API** | **C1:** consistent list queries (pagination, sort whitelists, filter AST, search) end to end — [List queries](./list-queries.md), ADR 021. **C2:** a shared zod response contract on every endpoint — documented in Swagger (success + `4XX`/`5XX` error envelope), enforced by the API (strip unknown keys, 500 on mismatch, compile-time handler check, no Prisma types on the wire), parsed by the typed client in one place — [Response contracts](./response-contracts.md), ADR 022. **C3:** deterministic `docs/generated/openapi.json` + `pnpm openapi:export` + staleness e2e | **Done** |
| D — Identity | Session model with `sid`, revoke-one-device; `PasswordHasher` (argon2id, rehash); single-use verification tokens; cookie hardening; OAuth + `UserIdentity` | Planned |
| E — Authorization | Reason codes; repository tenant scoping; impersonation sessions; unified audit log; multi-dimension rate limits; permission analyzer | Planned |
| F — App infrastructure | Email provider port (SMTP/Console/Resend/SES); notification intents; outgoing webhooks; scheduler registry; cache port; feature flags; system settings; i18n; import/export; retention & account deletion; payments port | Planned |
| G — Frontend | QueryClient defaults & HTTP error policy; error/loading boundaries; TanStack Form primitives + migration; shortcut registry; server shells | Planned |
| H — Observability | OpenTelemetry, metrics, tracing; request pipeline timings; entity timelines; query diagnostics | Planned |
| I–L — Developer OS & tooling | `/_dev` console; `defineResource`; schema registry; API explorer; state machines; drift / impact / migration-safety / boundary / dependency / changelog tooling; scenarios & chaos; `.ai/` manifest; backups; `doctor`; `production:check` | Planned |

## Open follow-ups from Phases A–C

Resolved on 2026-10-01: dependency advisories (`pnpm audit` clean; scoped overrides documented in
`pnpm-workspace.yaml`), idempotency + inbox retention jobs, `auth.controller.spec.ts` now runs, Next
apps exit on an invalid server env, Swagger documents every body/query/param from its zod schema
([API routes §13](./api-routes.md)), `EMAIL_TEST_TO` allowed for localhost production builds;
`geo.controller.ts` no longer returns Prisma row types and every endpoint has a response contract
(C2, [Response contracts](./response-contracts.md)); `/health/deep` no longer echoes the Redis URL.

Still open:

- CI has not run on GitHub yet (the repo is not pushed); enable branch protection with the CI checks
  as required status checks once it is.
- C1 left deliberately whole (bounded catalogs): admin roles / permissions, an organization's
  reward catalog (the merchant edit page looks rewards up in the list — needs a detail endpoint
  first), member / invite rosters, pending rewards. Move any of them onto the list grammar if it
  can grow unbounded ([List queries §5](./list-queries.md)).
- **C2 (response contracts, ADR 022):**
  - The lint rule `@darraghor/nestjs-typed/api-method-should-specify-api-response` does not know
    `@ZodResponse` / `@ZodPaginatedResponse` / `@ZodRawResponse`; it needs
    `additionalCustomApiResponseDecorators` in `packages/eslint-config/nestjs.js` (human decision —
    `pnpm run lint` fails on the API until then).
  - Action `POST`s that create nothing still answer `201` (preserved to avoid a wire change);
    normalize to `200` / `204` in a versioned change.
  - `GET /admin/roles/:id` and `GET /admin/permissions/:id` answer `200` with `data: null` for an
    unknown id (now explicit in their nullable contracts) — should be `404`.
  - Geo writes (create / update / delete) fail at the database: the `geo_reference` RLS policy only
    allows writes under `app_rls_bypass()`. Decide bypass vs. removing the endpoints; geo also still
    hard-deletes without an audit trail.
  - `docs/generated/openapi.json` is ≈1.5 MB (schemas inlined per operation) — register reused
    response schemas as named components; add the artifact staleness check to CI once CI runs e2e.
- MinIO and Mailpit are provisioned locally but unused until the S3 custom-endpoint and SMTP email
  adapters land (Phase F).
- Prisma pins `deepmerge-ts` / `mysql2` and Google libraries pin `uuid` — drop the scoped overrides
  in `pnpm-workspace.yaml` once upstream releases ship the patched versions.
