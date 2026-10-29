---
title: "ADR 069: In-house application observability — our own agents, collector and Observe console"
tags: ["adr", "observability", "tracing", "errors", "logs", "replay", "plan"]
description: "Replace @nestjs/observe with our own NestJS, web and Expo agents, a collector in the API backed by PostgreSQL and object storage, and an Observe section in the admin panel: traces, issues, logs, jobs, metrics, profiler, objectives, releases, Web Vitals and session replay — and the one rule exception it needs."
author: "Platform Team"
lastUpdated: 1793232000000
coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop"
order: 69
---

# ADR 069: In-house application observability — our own agents, collector and Observe console

## Status

**Accepted (2026-10-29); not built yet.** Every decision was agreed in a design interview; the
[decision trail](#the-decision-trail) records it. Terms are defined in [`GLOSSARY.md`](../../GLOSSARY.md)
under *Application observability*.

## Context

The API reports to the hosted [`@nestjs/observe`](https://github.com/nestjs/observe) service when
`OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` are set (`apps/api/src/observe.bootstrap.ts`). That ships
our traces, errors, source fragments and captured requests to a third party, covers only the API,
says nothing about the web panels or the mobile app, and its dashboard is closed source: we cannot
put it behind our authorization, audit or design system.

[ADR 068](./068-platform-operations-console.md) already watches the machines (servers, instances,
dependencies). This decision watches the code: what each request, job and screen did, why it failed
and how fast it was.

The reference repository is only the **agent**; its dashboard (observe.nestjs.com) is not open. We
build both halves ourselves, with the agent's full feature set as the floor and the dashboard's pages
as the guide.

## Decision

### Three agent packages and one contract

| Package | Runs in | Records |
|---|---|---|
| `packages/observe` | Every NestJS process: the API, the worker, the analytics consumer, and any Nest service later built on the kit | Traces with per-span self time, issues, logs, jobs, runtime and custom metrics, CPU profiles, objectives |
| `packages/observe-web` | The browser and the Next.js server side of `web`, `merchant` and `admin` | Errors, page loads and navigations, Web Vitals, breadcrumbs, replay; server components, route handlers and server actions through `instrumentation.ts` |
| `packages/observe-native` | The Expo app | Errors, Expo Router navigations, `fetch`, replay from screen frames, an offline buffer |
| `packages/contracts` | Everywhere | The zod wire contract, and the gRPC `.proto` that mirrors it |

The Nest agent never ships browser code and the browser packages never import `worker_threads` or
the inspector; that is why they are three packages and not one with entry points.

**Our own API names**, validated by zod at startup (an invalid option stops the process, like the
environment config):

| Reference | Ours |
|---|---|
| `createObserveModule()` | `createObservability()` |
| `ObserveModule`, `ObserveInstrument` | `ObservabilityModule`, `ObservabilityInstrument` |
| `TracerService` | `TraceContext` (`setOperationId`, `span()`) |
| custom metrics on `TracerService` | `Metrics` (`counter`, `gauge`, `summary`) |
| `@Objective()` | `@Objective()` |

### What the Nest agent covers

Everything the reference agent does, except where noted:

- **Protocols**: HTTP (Fastify), GraphQL, RPC (`@nestjs/microservices`), gRPC, WebSocket gateways
  (`ws` and socket.io), BullMQ, legacy Bull, `@nestjs/schedule` — and, beyond the reference, Kafka and
  RabbitMQ consumers.
- **Outgoing calls**: `pg` (which covers Prisma, since it runs on `@prisma/adapter-pg`), Redis commands,
  and outbound `fetch`/`undici` and `node:http`/`https`. Statements are recorded with every value removed.
- **Not built**: BullMQ Pro (a paid, private-registry package we cannot install or test), and the
  `mysql2`, `mssql` and `mongodb` drivers (we run none of them). The protocol and driver layers are
  plug-in interfaces so any of these can be added later.
- **Trace ids** cross HTTP, queues and Kafka. The trace id **is** the correlation id
  (`X-Correlation-Id`), so one id joins a trace, its log lines, its audit row, its jobs and the
  database's `app.correlation_id` ([ADR 017](./017-unified-request-context.md)).
- **Shaping a trace before it leaves**: per-trace sampling (100 % by default; failed traces and those
  slower than the capture threshold, 2,000 ms, are always kept), span collapse (more than 20 identical
  siblings keep the 3 slowest and every failed one, the rest become one node carrying the count and the
  summed duration), `skipSpans` for expected 4xx outcomes, `setOperationId`.
- **Errors** grouped into issues by fingerprint, with a few source lines around each in-app frame
  (source maps resolved), and the release inferred from the environment, the CI platform or the git
  checkout.
- **Captured requests**: headers from a safe list on every failed or slow request; bodies off until a
  SuperAdmin turns them on per service, capped at 2 KB.
- **Logs**: our own apps forward `info` and above from both `LogService` and Fastify's pino logger,
  each line carrying its trace id; other services opt in with `OBSERVE_FORWARD_LOGS=1`.
- **Runtime metrics** (memory, CPU, GC, event loop) and **custom metrics** with a series limit.
- **CPU profiler** with time slices per span, **on demand**: a platform developer picks an instance and
  10–60 seconds; the order reaches the agent in the reply to its next batch, so no inbound port is
  opened. Scheduled background profiling exists but is off.
- **Delivery**: telemetry is serialized and sent from a worker thread, flushed on shutdown, and backed
  off on refusal — `401` doubles the wait up to one attempt an hour, `429` honours `Retry-After` and
  keeps the buffer.
- **Redaction** everywhere — log lines, error messages, captured requests, breadcrumbs, replay text —
  goes through the **one** existing list, `SENSITIVE_FIELD_NAMES`, shared with the logger.

### What the front ends cover

- **Errors** (uncaught, unhandled rejections, React error boundaries), **page loads and navigations**
  as traces with their API calls as spans, **Web Vitals** (LCP, INP, CLS, FCP, TTFB) on the web, and the
  last 50 **breadcrumbs** (clicks, navigations, console warnings) before an error.
- **One trace across browser and API, one id per request.** A page load has its own trace id. Each
  `fetch` sends a fresh `X-Correlation-Id` — the API request's own trace id, exactly as today — and the
  browser span stores it as a link, so the waterfall nests the backend trace under the fetch span. An
  audit row still holds exactly one request.
- **Replay**: `rrweb` on the web; on mobile, screen frames from `react-native-view-shot` (at most one
  per second, only while the user is touching or scrolling, downscaled JPEG) with every `TextInput` and
  every view marked `observeMask` painted over before the frame is encoded. Recording runs into a
  60-second rolling buffer; when an error happens that minute and the rest of the session are kept and
  linked to the issue, and 10 % of error-free sessions are kept too (adjustable per service).
- **Input values are recorded** — in replay and breadcrumbs — **except**, always: password fields,
  `autocomplete` one-time-code and `cc-*` fields, fields whose name or label matches
  `SENSITIVE_FIELD_NAMES`, and anything marked `data-observe-mask` (web) or `observeMask` (mobile).
- **Source maps** are generated at build time, uploaded by `pnpm observe:sourcemaps` in CI with a
  SuperAdmin-issued upload token to a private storage prefix keyed by release, and **deleted from the
  build output before deploy**. Hermes maps are uploaded per EAS build and update. The collector
  symbolicates on ingest.
- **Mobile offline buffer**: at most 500 events or 1 MB on the device, oldest dropped first, errors kept
  ahead of performance data; sent when the app is back online or in the foreground.

### Privacy and consent

- Front-end telemetry holds the **user id only** (no email or name), URLs **without query values**, and
  the IP **reduced to a country** through the audit log's existing geo lookup.
- **`web`** (customers) gets a consent banner with three choices: *error reports* (always on — the
  operator's legitimate interest in a working service), *performance* (traces and Web Vitals) and
  *session recording* (replay and input capture). The last two are off until the customer opts in, and
  can be changed from a footer link.
- **The mobile app** asks customers the same three choices on first launch and in Settings; a user
  signed in with a tenant role is staff and is not asked.
- **`merchant` and `admin`** are staff tools and record without a banner. Telling staff is a matter for
  the staff policy, outside this repository.

### The collector

`apps/api/src/contexts/observability` owns ingest, storage, queries, objectives and alerts.

- **Credentials**: a backend service authenticates with its own **key and secret**, issued when a
  SuperAdmin registers it (shown once; rotate and revoke are audited). A front end cannot keep a
  secret, so it reports with a public **client key** that can only send telemetry, is accepted only
  from the service's registered origins (CORS and an `Origin` check), and is rate-limited per key and
  per IP with a payload cap; the mobile app, which has no origin, relies on those limits alone. Without
  credentials an agent sends nothing and logs one warning at startup. Seeds never create keys.
- **`pnpm observe:link <service>`** replaces the reference's `npx observe link`: it prints a code, a
  SuperAdmin approves it in the panel after fresh re-authentication, and it writes
  `OBSERVE_SERVICE_KEY` and `OBSERVE_SERVICE_SECRET` into that app's git-ignored `.env`.
- **Two transports**, both behind one transport interface in each agent and one ingest pipeline in the
  collector: **HTTP** (gzip-compressed JSON, the default) and **gRPC** on its own port,
  `OBSERVE_GRPC_PORT` (off when unset), with credentials in gRPC metadata. An agent picks one with
  `OBSERVE_TRANSPORT=http|grpc`. The `.proto` lives in `packages/contracts`, and a test fails if it
  drifts from the zod schemas — zod stays the contract.
- **Ingest pipeline**: check the credentials → validate the batch with zod → per-service rate limit and
  size cap → enqueue on BullMQ → `202`. The worker writes the batch in bulk. Overload answers `429` with
  `Retry-After`.
- **The API observes itself** through the same loopback path as everyone else; the ingest routes and
  the batch-writing job are never traced, or every batch would trace its own writing.
- **Storage**: the same PostgreSQL, in its own tables behind a repository port — traces, spans,
  issues and their occurrences, log lines, runtime samples, metric points, profiles, objectives — plus
  per-minute and hourly summary tables for the charts and a job that deletes what is past retention.
  Replays go to object storage in chunks under a private prefix, through the existing storage port,
  with an index row in PostgreSQL. Table partitioning is not used: migrations are generated by Prisma,
  which cannot declare partitions. ClickHouse can replace the storage later behind the same port.

**Retention** (each overridable by an environment variable):

| Data | Kept for |
|---|---|
| Traces and spans, log lines, captured requests, CPU profiles | 7 days |
| Replays | 14 days |
| Error occurrences, raw runtime samples and custom metrics | 30 days |
| Issues | until resolved, then 90 days |
| Per-minute summaries | 90 days |
| Hourly summaries | 1 year |

### Objectives and alerts

- **Objectives** are declared in code with `@Objective({ availability, latency: { underMs, target },
  windowDays, name })` or created by a SuperAdmin in the panel for an operation without one. Code-owned
  objectives are marked *in code* and read-only in the panel, and the agent restates them hourly, so a
  delete in the panel does not last while the decorator is there. Windows are 7, 14, 28 (default) or 30
  days; targets 90–99.999 %; at most ten per handler. An objective can also target a page's LCP or INP.
- **Alerts are the one Alert concept of ADR 068**, with new kinds, emailed to the same recipients and
  listed on the same Operations → Alerts page. Rules are editable per service or per operation by a
  SuperAdmin:

| Rule | Fires when |
|---|---|
| Error rate | over 5 % across 5 minutes, with at least 20 requests |
| Latency | p95 over 1,000 ms across 10 minutes |
| New issue | an issue is seen for the first time |
| Regression | a resolved issue comes back in a newer release |
| Objective burn | the error budget burns 14.4× too fast over 1 hour, or 6× over 6 hours |

### The Observe console

A new **Observe** group in the admin panel: Overview, Operations, Traces (waterfall), Issues (filtered by
platform — web, iOS, Android — with browser, OS, device and release from the audit log's user-agent
parser; one fingerprint across platforms is one issue), Logs, Jobs, Profiler, Objectives, Releases, Web
Vitals (p75 per page in good / needs improvement / poor bands), Replays and Services (registration, keys,
origins, capture settings).

Everything links through the shared id: a trace to its audit row and back; an issue to **Watch replay**,
opened at the moment of the error; the replay timeline (navigations, clicks, console lines, errors and
API calls) to each API call's backend trace; a backend trace to the replay of the session that made it.

### Access

New permissions on exact verbs ([ADR 067](./067-unified-authorization-model.md)): platform **Admin** and
**Platform Developer** list and read telemetry; **SuperAdmin** manages services, keys, objectives and
alert rules. Watching a replay needs its own `REPLAY` resource — Admin and SuperAdmin, **not** Platform
Developer by default — and every replay viewed writes an audit row, as viewing audit-log payloads does.
Telemetry is platform-level: no tenant RLS, each trace tagged with its `tenantId` for filtering, never
visible to tenant users.

## One exception to the non-negotiables

It is deliberate, limited, and must not be copied as a pattern:

1. **Ingest posts are not written to the HTTP audit log**, exactly as ADR 068 decided for server-agent
   pushes: one row every few seconds from every instance and every browser forever would bury real
   activity. Each service's last-seen time and ingest counts are still recorded, and registering a
   service, rotating or revoking its key, approving an `observe:link` code, uploading source maps, and
   changing capture settings, objectives and alert rules are all audited.

## Considered options

- **Keep `@nestjs/observe`** — a third party holds our traces, source and captured requests; no front
  end, no replay; a closed dashboard outside our authorization, audit and design system.
- **OpenTelemetry with a collector, plus Grafana Tempo/Loki** — vendor-neutral, but generic Node
  instrumentation cannot name spans after Nest classes and methods, and it is a second stack outside the
  admin panel. Our wire format can still be exported to OTLP later.
- **One package with entry points** for Nest, web and native — one wrong import puts `worker_threads`
  or the inspector into a client bundle.
- **Agents writing straight to Redis or PostgreSQL** — every service would hold our database
  credentials, and the collector could not enforce limits.
- **gRPC only** — a second port through every firewall and proxy, and nothing a browser can call.
- **ClickHouse now** — a new service everywhere, CI included, before the volume asks for it.
- **One id for a whole page load** — five audit rows would share one correlation id, which would stop
  meaning "one request".
- **Building every reference driver** (`mysql2`, `mssql`, `mongodb`, BullMQ Pro) — dependencies we do
  not run, and suites we could only satisfy with stubs or a licence we do not hold.

## Phases

Built in one go, then format → lint → typecheck → test → e2e → `ci:local` once at the end.

1. **Core** — the Nest agent core (instrument hook, span tree, worker-thread buffer, redaction,
   sampling, collapse, `skipSpans`), the HTTP transport, ingest and storage, the Operations and Traces
   pages.
2. **Errors** — issues, source context, releases, logs, captured requests.
3. **Async and outgoing** — BullMQ, Bull, schedule, Kafka, RabbitMQ, Redis, `pg`, outbound HTTP, trace
   ids across services and queues.
4. **Metrics** — runtime and custom metrics, the profiler.
5. **Objectives and alerts.**
6. **Remaining protocols and tooling** — GraphQL, RPC, gRPC and WebSocket instrumentation, the gRPC
   transport, `observe:link`, removal of `@nestjs/observe`.
7. **Web** — `observe-web` in `web`, `merchant` and `admin`; source maps; the consent banner; Web
   Vitals; `rrweb` replay.
8. **Mobile** — `observe-native`, offline buffer, Hermes source maps, screen-frame replay.

The protocol packages (`@nestjs/graphql`, `@nestjs/microservices`, `@grpc/grpc-js`,
`@nestjs/websockets`, `ws`, socket.io, `@nestjs/bull`, `bull`) are dev dependencies and optional peers of
`packages/observe` only; its integration suites boot small Nest apps that use them, and **no suite skips
itself** when a server is missing. The API, worker and consumer pick up whichever integrations match
what they already import.

## Consequences

- `@nestjs/observe`, `observe.bootstrap.ts` and `OBSERVE_APP_KEY` / `OBSERVE_APP_SECRET` /
  `OBSERVE_ENABLED` are removed; nothing is sent to a hosted service.
- Telemetry shares the business database. Its writes are batched by the worker and never traced, but a
  busy platform will eventually want the storage port pointed at ClickHouse.
- Mobile replay is screen frames, not a structural recording: coarser and larger than `rrweb` on the web.

## The decision trail

| # | Question | Decision |
|---|---|---|
| 1 | Replace or run alongside | Replace `@nestjs/observe` entirely |
| 2 | Where the parts live | `packages/observe` agent, `contexts/observability` collector, admin panel UI |
| 3 | Ingest transport | HTTP and gRPC, behind one transport interface |
| 4 | Protocols | Everything the reference instruments, plus Kafka, RabbitMQ and Redis |
| 5 | Features | The reference's full feature set, built in phases |
| 6 | Ids | The trace id is the correlation id |
| 7 | Who sees it | Platform-level, tagged by tenant; Admin and Platform Developer read, SuperAdmin manages |
| 8 | Names | Service, Operation, Trace, Span, Issue, Objective, Release; one shared Alert |
| 9 | BullMQ Pro | Left out |
| 10 | Protocol packages | Dev dependencies and optional peers of `packages/observe` only |
| 11 | Database drivers | `pg` only; MySQL, SQL Server and MongoDB left out |
| 12 | Storage | Same PostgreSQL behind a port; replays in object storage |
| 13 | Retention | The table above |
| 14 | Ingest path | Credentials → zod → limits → BullMQ → `202`; `429` with `Retry-After` |
| 15 | Audit | Ingest posts left out of the HTTP audit log (the exception) |
| 16 | Data leaving the process | Source context on, safe headers on failure, bodies opt-in per service, one redaction list |
| 17 | gRPC specifics | Own port, metadata credentials, `.proto` in contracts checked against zod |
| 18 | Self-observation | Loopback through the normal path, ingest never traced |
| 19 | Registration | Panel-issued key and secret; `pnpm observe:link` |
| 20 | API names | `createObservability`, `ObservabilityModule`, `TraceContext`, `Metrics`, `@Objective` |
| 21 | Console | An Observe group in the admin panel; alerts on the shared Alerts page |
| 22 | Alert rules | Error rate, latency, new issue, regression, objective burn |
| 23 | Objectives | From code (read-only in the panel) and from the panel |
| 24 | Sampling | 100 %; failed and slow traces always kept |
| 25 | Profiler | On demand, 10–60 s; scheduled profiling off |
| 26 | Logs | Our apps forward `info`+; others opt in |
| 27 | Front ends | In scope: web panels and the Expo app |
| 28 | Front-end signals | Errors, navigations, Web Vitals, breadcrumbs, Next.js server side, replay and input values |
| 29 | Front-end packages | `observe-web` and `observe-native`, separate from the Nest agent |
| 30 | Front-end credentials | Public client key, origin-checked and rate-limited |
| 31 | Source maps | Uploaded in CI, deleted before deploy, symbolicated on ingest |
| 32 | Browser ↔ API | A fresh correlation id per fetch, stored as a link |
| 33 | Customer privacy | User id only, no query values, country only; three-choice consent banner on `web` |
| 34 | Offline (mobile) | 500 events or 1 MB, oldest dropped, errors first |
| 35 | Front-end UI | Platform filters, cross-platform issues, Web Vitals page, page objectives |
| 36 | Replay engine | `rrweb` on the web; masked screen frames on mobile |
| 37 | Never captured | Passwords, one-time codes, card fields, sensitive names, marked elements |
| 38 | Which sessions | Error sessions (with the minute before) plus 10 % of the rest; 14 days |
| 39 | Replay access | `REPLAY` for Admin and SuperAdmin; every view audited |
| 40 | Consent | Errors always; performance and recording opt-in on `web` and for mobile customers; staff not asked |
| 41 | Delivery | All phases in one go, one full gate at the end |
