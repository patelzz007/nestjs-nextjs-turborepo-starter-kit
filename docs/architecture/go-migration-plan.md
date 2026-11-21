---
title: "NestJS to Go migration plan"
description: "Phase 0 of moving the whole backend from NestJS and Prisma to Go, Gin, ent and Atlas: what exists today, the decisions already made, the proposed Go layout, the migration order, the schedule to the 18 December launch, and the decisions that still need the owner."
tags: ["architecture", "go", "gin", "ent", "atlas", "migration", "plan"]
author: "Platform Team"
category: "Architecture"
date: 1795219200000
lastUpdated: 1795219200000
editedAt: 1795272885000
order: 11
---

# NestJS to Go migration plan

## Status

**Phase 0 — owner answered the open questions (2026-11-21); waiting for the go-ahead on Phase 1.** Nothing in Go
exists yet. After that, phases run one after another without stopping, and each phase ends with a
report.

## In one paragraph

The backend (`apps/api`, `packages/messaging`, `apps/analytics-consumer`, `apps/server-agent`, `apps/load-runner`)
moves to Go. Gin handles HTTP. ent describes the database and Atlas makes the migrations. The web, admin, merchant
and mobile apps do not change, except for small, reviewed contract improvements. Zod in `packages/shared` stays the
one place where API shapes are written, and Go gets its types and validation generated from it. The Go API goes live
on **Friday 18 December 2026** and replaces NestJS completely. Nothing is in production before then, so the
database can change freely until launch.

## Decisions already made by the owner

These are settled. They change the original brief where the two disagree; **this document wins over the brief.**

| Topic | Decision | Change to the brief |
|---|---|---|
| Why | Performance, learning, hiring and a client — all of them | — |
| End state | Go **replaces** NestJS. The starter kit becomes Go + Next.js + Expo | — |
| Launch | **Fri 2026-12-18**, Go only, everything migrated. No hybrid proxy | Phases 14–15 shrink: no canary, shadow traffic or traffic split, because nothing is live |
| HTTP | Gin, kept out of domain and application code | — |
| Database access | **ent + Atlas**. Prisma is removed. Hand-written SQL only where ent cannot express it (RLS context, security SQL, a few reports) | Replaces "pgx + sqlc, no ORM" |
| Conventions in the data layer | Shared helpers for the base model, soft delete and unique-on-soft-delete are allowed | Relaxes "no abstractions" for this case |
| Seeds | Move to Go | — |
| Contracts | **Zod stays the source.** Go types and request validation are generated from it | Replaces "OpenAPI is the contract" |
| Small API improvements | Allowed, when reviewed | Relaxes "identical contracts" |
| Token compatibility | NestJS and Go accept each other's tokens **during development only** | — |
| Cedar | Out of scope. ADR 067 removed it; Go copies ADR 067's model | Phase 9 removed |
| Workers and messaging | Port all of it to Go, including `packages/messaging` and `analytics-consumer` | — |
| Background jobs | A **Go-native job queue built in this repo**, matching BullMQ's features | Replaces "pick a library" |
| Kafka client | `franz-go` | — |
| RabbitMQ client | `amqp091-go` (the RabbitMQ team's own client) | — |
| Go version | Latest stable | — |
| First slice | **All** of identity (passkeys, TOTP, MFA recovery, impersonation included) | Brief advised against starting with the riskiest area; the owner chose it |
| Location | `apps/api-go` | — |
| Docs | Go ADRs and runbooks live in this docs site, same front matter | — |

### How the TypeScript rules carry over to Go

| TypeScript rule | Go rule |
|---|---|
| Tests in a `__tests__/` folder | **Go-only exception:** `_test.go` beside the code (Go requires it for package-private tests). `rules/11` and the test-placement guard get a Go clause |
| No `any`, `unknown`, casts | No `any` / `interface{}` in our own signatures, no unchecked type assertions (`v.(T)` must use the `v, ok :=` form). Enforced by `golangci-lint` (`forbidigo`, `forcetypeassert`) |
| Zod at every boundary, no `typeof` | Generated JSON Schema validation at the HTTP edge, plus `go-playground/validator` tags on bound structs. Domain invariants stay in domain constructors |
| Coverage above 95% on all four metrics | Go only measures statements: **95% statement coverage**, counting every package, generated ent code excluded |
| Completion gate | `apps/api-go/package.json` wraps `gofmt`, `golangci-lint`, `go vet`, `go build` and `go test`, so `pnpm run format / lint / typecheck / test / test:e2e / ci:local` cover Go through turbo |
| One approved lint exception | The `golangci-lint` config is approved once in Phase 1. After that, the same rule: no new exceptions without asking |
| `tsrs`, not `tsc` | Still applies to the TypeScript apps that remain |

## What exists today (inventory)

### Size

| Area | Today |
|---|---|
| `apps/api` source | about **146,000 lines** (without tests) |
| HTTP routes | about **575** route handlers in **96** controllers; the committed OpenAPI file (`docs/generated/openapi.json`) lists **430 paths** |
| Bounded contexts | **23** under `apps/api/src/contexts` plus `platform/` (about 23,500 lines) |
| CQRS | `@nestjs/cqrs`: about **190 commands** and **55 queries** in folders |
| Prisma schema | **145 models**, **125 enums**, 6,539 lines, one baseline migration (`20261121014409_init`) |
| Security SQL | `prisma/rls/*.sql`: **4,246 lines** — **370 policies**, **29 functions** (16 `SECURITY DEFINER`), 3 triggers, **6 database roles** (`app_runtime`, `app_backup`, `app_enumerator`, `app_erasure`, `app_retention`, `analytics_consumer`). Generated by `prisma/security/` (a TS generator) |
| Seeds | `prisma/seed*`: **24,700 lines** of TypeScript |
| Unit tests | **633** test files in `apps/api/src` |
| API e2e tests | **124** specs in `apps/api/e2e` — they boot Nest in-process and call `app.inject`, so they **cannot be pointed at Go as-is** |
| Environment | **168** API variables (`config/api-config/api-env.input.ts`) |

### Contexts, largest first

| Context | Lines | Routes | Commands | Queries | Notes |
|---|---:|---:|---:|---:|---|
| identity | 15,281 | 51 | 40 | 6 | JWT (HS256), refresh rotation, bcrypt, passkeys (`@simplewebauthn/server`), TOTP (`otplib`), MFA recovery, impersonation, new-device checks, breached-password check |
| notifications | 13,589 | 52 | 8 | 0 | Email (Resend), push (`firebase-admin`), SMS, broadcasts, inbox |
| tenancy | 11,016 | 51 | 33 | 8 | Organizations, locations, memberships, URL tenant resolution (ADR 009) |
| authorization | 10,794 | 48 | 25 | 3 | ADR 067: catalogue, roles, grants, shares, ownership; ADR 090 database-level permission checks |
| operations | 8,669 | 44 | 8 | 0 | Backups, load tests, health, admin tooling |
| integrations-github | 7,819 | 29 | 11 | 12 | OAuth link, webhooks, contributions |
| rewards | 5,820 | 25 | 8 | 6 | |
| reporting | 5,207 | 11 | 0 | 4 | PDF (`pdfkit`, `fontkit`), Excel (`write-excel-file`) |
| feature-flags | 4,785 | 36 | 0 | 0 | Experiments, analytics |
| kanban | 4,579 | 25 | 15 | 3 | |
| files | 4,301 | 11 | 8 | 2 | S3, presigned posts, CloudFront, `sharp` images, virus scan |
| webhooks | 4,276 | 13 | 9 | 3 | Inbound signatures (Twilio, Resend, GitHub), outbound deliveries |
| pos | 4,176 | 16 | 9 | 6 | |
| claims | 3,343 | 5 | 9 | 0 | |
| reference-data | 2,869 | 31 | 0 | 0 | |
| referrals | 1,984 | 4 | 3 | 1 | |
| audit | 1,901 | 5 | 1 | 0 | One timeline of requests and row changes |
| tiers | 1,866 | 6 | 2 | 0 | |
| payments | 1,784 | 8 | 1 | 0 | |
| catalog | 1,152 | 16 | 0 | 0 | |
| docs-publishing | 1,100 | 7 | 5 | 0 | |
| privacy | 754 | 7 | 1 | 1 | Account erasure |
| saved-views | 311 | 3 | 0 | 0 | |
| platform | 23,451 | 12 | — | — | Outbox, idempotency, rate limiting, throttling, encryption, storage, transaction log, unit of work, jobs, logging |

### Tenancy and RLS (how a request gets its database context)

Every tenant-scoped transaction runs `SET ROLE app_runtime` and then sets these transaction-local values with
`set_config(…, true)`:

| Setting | Meaning |
|---|---|
| `app.current_user_id` | The signed-in user |
| `app.current_tenant_id` | The tenant the request acts in |
| `app.current_api_key_id`, `app.current_api_key_location_id` | API-key callers (POS) |
| `app.actor_purpose` | Why the actor is acting |
| `app.system_operation` | Named system operation (`system-operation.registry.ts`) |
| `app.rls_bypass` | The explicit, audited bypass (ADR 007) |
| `app.correlation_id` | Ties row-change audit to the request |

Go must set exactly the same values in the same transaction. The policies stay as they are.

### Workers, jobs and messaging

| Kind | Today | Count |
|---|---|---|
| Queue workers | BullMQ `@Processor`: outbox publish, email send, broadcasts, push, SMS, notifications fan-out, claims expiry (3), rewards auto-publish and referral credit, storage scan, delete, cleanup and CDN invalidation, feature-flag maintenance, operations backup, transaction-log write, idempotency and outbox retention | **20** |
| Scheduled tasks | `@nestjs/schedule` `@Cron` (every minute to weekly) | **23** |
| Kafka | `@platformatic/kafka`; topics `platform.auth`, `platform.email`, `platform.feature-flags`, `platform.rewards`, `platform.sessions` | 5 topics |
| RabbitMQ | `packages/messaging/src/nest/rabbitmq` (optional `RABBITMQ_URL`) | 1 transport |
| Outbox / inbox | ADR 015 and 060: outbox table → `outbox.publish` queue → Kafka; Postgres inbox with dead letters | — |
| Other apps | `analytics-consumer` (948 lines, Kafka → Postgres), `server-agent` (397 lines, host metrics), `load-runner` (583 lines, BullMQ + Redis) | 3 apps |
| Shared package | `packages/messaging` (3,068 lines) | — |

### External services

| Service | Today | Go replacement |
|---|---|---|
| S3, presigned posts, CloudFront | `@aws-sdk/*` | `aws-sdk-go-v2` (s3, cloudfront, presign) |
| Email | `resend` | `resend-go` |
| Push | `firebase-admin` | `firebase.google.com/go/v4` |
| SMS / Twilio | inbound signature checks | HMAC check rewritten; provider client chosen in Phase 13 |
| GitHub | OAuth and webhooks | `go-github` plus our HMAC check |
| Passkeys | `@simplewebauthn/server` | `go-webauthn/webauthn` |
| TOTP | `otplib` | `pquerna/otp` (same SHA-1, 30-second step and window, proven by test vectors) |
| Passwords | `bcrypt` | `golang.org/x/crypto/bcrypt` (reads the same `$2b$` hashes) |
| JWT | `@nestjs/jwt`, `jsonwebtoken` (HS256) | `golang-jwt/jwt/v5` |
| Images | `sharp` (libvips) | **Decision needed**, see below |
| PDF reports | `pdfkit`, `fontkit` | **Decision needed**, see below |
| Excel | `write-excel-file` | `xuri/excelize` |
| Compression | `fflate` | standard library |

### Clients and contracts

| Item | Today |
|---|---|
| Schemas | `packages/shared`: about **1,400** exported Zod schemas (33,000 lines) |
| Rules JSON Schema cannot express | **105** `.refine` / `.superRefine` / `.transform` / `.preprocess` / `.pipe` calls — these need a Go mirror and a parity test |
| Client | `packages/api-client`, used by web, admin, merchant and mobile via `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL` |
| Breaking-change gate | `.github/workflows/api-contract.yml` runs `oasdiff` on `docs/generated/openapi.json` |
| Browser e2e | Playwright suites in web, admin and merchant call the real API, so they act as a black-box parity check against Go for free |

### Build, CI and deploy

| Item | Today |
|---|---|
| CI | `.github/workflows/ci.yml` (+ api-contract, dependency-review, deploy, docs, load-nightly, mobile-nightly) |
| Local gate | `pnpm ci:local` (`packages/tooling/src/ci-local`) |
| Image | `infra/docker/Dockerfile` |
| Production | DigitalOcean Droplet, pm2 + nginx, deploy gate over SSH (ADR 075, `deploy.yml`) |
| Tooling | `packages/tooling` — the API-specific parts (`db:*`, migration history, api-ci-env, app secrets) move to Go; the rest stays for the TypeScript apps |
| Local machine | **Go, Atlas and golangci-lint are not installed** — Phase 1 needs them |

## Proposed Go layout

```text
apps/api-go/
├── go.mod                      one module for every Go program
├── package.json                turbo wrapper: format, lint, typecheck, test, test:e2e, build
├── cmd/
│   ├── api/                    HTTP server (Gin)
│   ├── worker/                 job workers and schedules
│   ├── analytics-consumer/     Kafka → Postgres
│   ├── server-agent/           host metrics
│   ├── load-runner/            load generator
│   └── tools/                  db schema, security SQL, seed, checks (replaces the TS db:* scripts)
├── ent/schema/                 one file per model; mixins for the base model and soft delete
├── migrations/                 Atlas versioned migrations (generated)
├── security/                   generated RLS policies, functions, grants (ported generator)
├── contracts/                  Go types + JSON Schemas generated from packages/shared (never hand-edited)
└── internal/
    ├── platform/               config, logging (slog), telemetry (OpenTelemetry), database (RLS transaction),
    │                           http (Gin setup, errors, middleware), jobs, messaging, outbox, inbox,
    │                           idempotency, rate limiting, encryption, storage, audit
    ├── contexts/<context>/
    │   ├── domain/             no Gin, no ent, no Redis
    │   ├── application/        commands, queries, ports (small interfaces owned here)
    │   ├── infrastructure/     ent repositories, adapters
    │   └── http/               Gin handlers and route registration
    └── bootstrap/              composition root: builds everything with constructors
```

Rules for the layout:

- Only `internal/*/http` and `internal/platform/http` import Gin. A lint rule (`depguard`) enforces it.
- Only `infrastructure` and `platform/database` import ent.
- Contexts talk to each other only through a `public` package per context, as `public-api.ts` does today (ADR 058).
- No global service variables. `bootstrap` builds the graph once with plain constructors.

## How the hard parts work

### ent + Atlas and the existing schema

1. A Go tool reads today's `schema.prisma` once and writes the first `ent/schema/*.go` files. After that the ent
   files are the source, and `schema.prisma` is deleted at decommission.
2. Table and column names stay exactly as they are (camelCase, no renames) by setting the storage key on each
   field. NestJS keeps working against the same database during development.
3. **Acceptance test for this step:** Atlas compares a database built by Prisma with one built from ent, and the
   difference must be empty.
4. The base-model block (ids, timestamps, soft delete, audit columns) becomes an ent **mixin**. Soft delete becomes
   an ent **interceptor** (filters reads) plus a **hook** (turns deletes into updates). Unique-on-soft-delete becomes
   a partial unique index in the mixin.
5. `atlas migrate diff` generates the migrations. The rule "migrations are generated, never hand-written" stays.
6. The RLS and security SQL generator (`prisma/security/`) is ported to Go and reads the ent schema instead of
   Prisma. It still writes `security/*.sql`, applied after migrations (today's `db:apply-security`). This avoids
   Atlas Pro, which is paid.

### The RLS transaction

`platform/database` offers one way to run tenant work:
`RunInTenant(ctx, scope, func(tx *ent.Tx) error) error`. It opens a transaction, runs `SET LOCAL ROLE app_runtime`,
sets the `app.*` values, and hands the ent transaction to the callback. A repository function cannot get a database
handle any other way, so tenant work cannot run without its context (the brief's "fail closed"). System work uses a
separate, named entry point, like `system-prisma.service.ts` today.

Integration tests use Testcontainers against real Postgres: pooled connection reuse, rollback, cancellation,
missing context, cross-tenant reads and writes. The existing `e2e/rls` and `e2e/tenancy` cases are the checklist.

### Contracts from Zod

1. A TypeScript script in `packages/shared` exports every request and response schema to JSON Schema (Zod 4's
   `toJSONSchema`), together with the route table (`api-routes.ts`).
2. A Go generator turns that into Go structs and route constants in `apps/api-go/contracts`.
3. At runtime Go validates request bodies against **the same JSON Schemas** with a JSON Schema validator, so the
   server and the browser apply the same rules.
4. The **105 refinements** JSON Schema cannot express get a Go function each. A parity test runs one shared list of
   good and bad inputs through both Zod and Go and expects the same answer.
5. Go serves an OpenAPI document built from the same export. The `oasdiff` gate keeps running, and the owner
   reviews each reported break as an intended improvement or a bug.

Node is still needed at **build time** for step 1. Nothing runs Node in production.

### Go-native job queue

Built in `internal/platform/jobs` on the existing Redis. It must match what the 20 workers and 23 schedules use
today:

| Feature | How |
|---|---|
| Enqueue, delayed jobs | Redis sorted sets, moved to the ready list by a Lua script |
| Retries with backoff, max attempts | Per-queue options, same as `MONITORED_WORKER_OPTIONS` today |
| Concurrency, rate limits, priorities | Per-queue options |
| Stalled-job recovery | Lease with a heartbeat; an expired lease returns the job to the queue |
| Repeat / cron | Replaces `@Cron`; a Redis lock makes sure only one instance runs each schedule |
| Dead letters, retention | Failed jobs kept for inspection, trimmed by age |
| Enqueue inside a database transaction | Through the outbox, as today |
| Metrics and health | OpenTelemetry metrics and the existing health endpoints |

It gets its own ADR, and its own tests against real Redis.

### Authentication

- HS256 with `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, same claims (`sub`, `id`, `sid`, scope, MFA time). Tokens
  from either server work on the other during development.
- bcrypt hashes from the seed and from sign-ups work unchanged.
- Passkeys, TOTP secrets and other encrypted secrets use the same keys and format, proven by tests that decrypt
  values written by NestJS.
- Cookies, the session URL and the server-rendered session (ADR 050) keep their names and attributes.

## Migration order and schedule

**27 days, 21 Nov → 18 Dec.** The table is the plan, not a promise. See the risks section. The phases are
renumbered from the brief: Cedar is gone, and platform services move before identity because sign-in needs audit,
rate limiting, encryption and the outbox.

Every phase ends the same way: its tests pass, its seeds fill every column of the tables it moved, its docs are
updated, and a phase report is written to `docs/history/`.

| # | Phase | What gets built | Done when | Target finish |
|---|---|---|---|---|
| 1 | Go foundation | Install Go, Atlas, golangci-lint. `apps/api-go` module. Gin server on `net/http.Server` with timeouts, body limits and graceful shutdown. Typed config for the 168 variables. `slog` logging with secret redaction. Request id and OpenTelemetry tracing. Central error mapping (same error shape as today). Documented middleware order. Health and readiness. `golangci-lint` config (approved once). `package.json` wrapper so the six gate commands include Go. Dockerfile stage with libvips. CI job. Go clauses in `rules/` | The server starts, answers health, shuts down cleanly; lint, vet and tests pass through `pnpm`; owner approves the lint config | Mon 23 Nov |
| 2 | Database foundation | Prisma → ent converter (run once). 145 models and 125 enums as ent schemas, camelCase kept. Base-model mixin, soft-delete interceptor and hook, unique-on-soft-delete indexes. Atlas migrations. Security SQL generator ported to Go. `RunInTenant` / system transaction with `SET LOCAL ROLE` and the `app.*` settings. Database error mapping. Testcontainers setup. Go seed runner skeleton | Atlas shows **no difference** between the Prisma-built and ent-built databases; generated security SQL is **identical** to today's; RLS leak, rollback and missing-context tests pass | Thu 26 Nov |
| 3 | Contracts | Zod → JSON Schema + route table export in `packages/shared`. Go generator for types and route constants. Request validation middleware using the same schemas. Go functions for the 105 refinements. OpenAPI served by Go. `oasdiff` gate pointed at Go's document | Shared good/bad inputs give the same answer in Zod and Go; regenerating is a no-op in CI | Fri 27 Nov |
| 4 | Platform services | Outbox and inbox, idempotency keys, rate limiting and throttling, request and row-change audit, encryption (same keys and format), cache (Redis), object storage (S3, CloudFront), the Go-native job queue with schedules, the four admin queue endpoints | Each service has real Redis/Postgres integration tests; the admin queues page works against Go | Sun 29 Nov |
| 5 | Identity | All 51 identity routes and 40 commands: sign-up, login, refresh rotation, logout (device, all), email verify, password reset and change, breached-password check, TOTP, backup codes, passkeys, MFA recovery, impersonation, new-device checks, bans and unlocks, profile and preferences, admin user lists. Same cookies, claims and session URL. Reads the session's permissions through a port that phase 7 fills in fully | Tokens work in both directions with NestJS; NestJS-written bcrypt hashes, TOTP secrets and passkeys verify in Go; identity e2e cases ported and green | Wed 2 Dec |
| 6 | Tenancy | 51 routes, 33 commands: organizations, locations, memberships, URL tenant resolution (ADR 009), tenancy modes (ADR 062), API-key principals | Cross-tenant read and write attempts fail in Go e2e and in RLS tests | Thu 3 Dec |
| 7 | Authorization | 48 routes, 25 commands: catalogue, roles, grants, shares, ownership (ADR 067), database permission checks (ADR 090), authorization caching and invalidation (ADR 004), decision audit | Every route declares its permission; the authorization e2e and hardening cases pass | Fri 4 Dec |
| — | **Checkpoint** | Phases 1–7 done and green? | If not, the owner hears the same day that 18 Dec is at risk | Fri 4 Dec |
| 8 | Business contexts | rewards, claims, referrals, tiers, pos, catalog, payments, reference-data (about 110 routes) | Their e2e cases ported and green; browser e2e for these screens pass | Tue 8 Dec |
| 9 | Communication and integrations | notifications (email, push, SMS, broadcasts, inbox), webhooks (inbound signatures, outbound deliveries), files (`govips`, scan, presigned uploads), integrations-github, feature-flags (about 140 routes) | Provider calls tested against recording fakes; webhook signatures verified with real fixtures | Fri 11 Dec |
| 10 | Operations and reporting | operations, reporting (pure-Go PDF, `excelize`), kanban, audit, privacy (erasure), docs-publishing, saved-views (about 100 routes) | Each PDF report checked by eye by the owner; erasure e2e green | Sun 13 Dec |
| 11 | Workers and other apps | The 20 workers and 23 schedules on the Go job queue. Kafka (`franz-go`) and RabbitMQ (`amqp091-go`). `analytics-consumer`, `server-agent`, `load-runner` as Go programs | Every queue and schedule has a Go owner; Kafka round-trip and dead-letter tests pass | Tue 15 Dec |
| 12 | Remove NestJS | Delete `apps/api`, Prisma, `packages/messaging`, the TS `analytics-consumer`, `server-agent`, `load-runner` and the API-only tooling. Point `api-client`, web, admin, merchant and mobile settings at Go. Update README, rules, ADRs and runbooks | No TypeScript file imports the removed packages; the full gate (`format`, `lint`, `typecheck`, `test`, `test:e2e`, `ci:local`) passes | Wed 16 Dec |
| 13 | Launch preparation | Browser e2e (web, admin, merchant) against Go. Load test with the Go `load-runner`. Droplet deploy (ADR 075 runbook updated) and a rollback rehearsal | All green; deploy and rollback both rehearsed | Thu 17 Dec |
| 14 | Launch | Go goes live | Health checks green after deploy | **Fri 18 Dec** |

## Risks

| Risk | Why it matters | What we do |
|---|---|---|
| **The date** | About 146,000 lines, 575 routes, 145 models and 24,700 lines of seeds in 27 days, each phase passing the full gate | The 4 Dec checkpoint says early whether 18 Dec holds. The gate is never relaxed to make the date |
| API e2e tests can't be reused | They boot Nest in-process | Rewrite them in Go against the real Gin router (`httptest`) and real Postgres. Browser e2e give a second, black-box check |
| 105 Zod refinements | JSON Schema loses them | A Go function each, plus shared parity cases |
| `sharp` and `pdfkit` | No pure-Go equal; reports and images may look different | Owner decision below |
| Security SQL generator | 370 policies and 16 `SECURITY DEFINER` functions are security-critical | Port it first; the generated SQL must be identical to today's output (byte-for-byte diff test) |
| Two servers on one development database | Easy to confuse which one owns a write | Only during development; nothing is live |
| Toolchain missing locally | Go, Atlas and golangci-lint are not installed | Installed with Homebrew in Phase 1 (approved) |
| `govips` needs cgo and libvips | The Go build is no longer a single static binary | libvips installed in the Docker image and on the Droplet; covered by the deploy rehearsal |

## Acceptance criteria for the whole migration

- Every route in `docs/generated/openapi.json` is served by Go, or removed by a reviewed decision.
- `oasdiff` shows no unreviewed breaking change.
- Every browser e2e suite (web, admin, merchant) passes against Go.
- The Go e2e suite covers every case the 124 NestJS e2e specs covered, including `e2e/rls` and `e2e/tenancy`.
- Atlas reports no drift. The security SQL check passes. The seed fills every column.
- Coverage is 95% or more in every Go package.
- `pnpm run format`, `lint`, `typecheck`, `test`, `test:e2e` and `ci:local` pass with NestJS deleted.
- Deploy and rollback are rehearsed on the Droplet.

## Owner decisions on the Phase 0 questions (2026-11-21)

| # | Question | Decision |
|---|---|---|
| 1 | Install Go (latest stable), Atlas and golangci-lint with Homebrew | **Yes.** CI pins the same versions |
| 2 | Image processing | **`govips`** (same libvips as `sharp`). Needs cgo and libvips on the Droplet and in the Docker image |
| 3 | PDF reports | **A pure-Go PDF library**, each report layout rebuilt and checked by eye |
| 4 | Job-queue dashboard at launch | **Yes — the existing admin page** (`apps/admin/app/(panel)/operations/queues`). Go serves the same four endpoints: list queues, list failed jobs, retry a job, discard a job |
| 5 | When NestJS is deleted | **As soon as Go has taken over everything**, before launch. Launch runs Go only |
| 6 | Column names | **Keep camelCase** for good |
| 7 | The original brief | **This document replaces it** |
