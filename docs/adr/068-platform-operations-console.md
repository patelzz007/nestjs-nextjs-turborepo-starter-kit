---
title: "ADR 068: Platform operations — server monitoring, database backups and load tests"
tags: ["adr", "operations", "monitoring", "backups", "load-testing", "plan"]
description: "A RunCloud-style operations console in the admin panel: a server agent and instance heartbeats with history in PostgreSQL, threshold alerts by email, pg_dump backups to object storage, and k6 load tests from a separate runner inside a dedicated Load Test tenant — and the two rule exceptions it needs."
author: "Platform Team"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
order: 68
---

# ADR 068: Platform operations — server monitoring, database backups and load tests

## Status

**Accepted (2026-10-28); all four phases built** — see [Phases](#phases) and [As built](#as-built). Every decision was agreed
in a design interview; the [decision trail](#the-decision-trail) records it. Terms are defined in
[`GLOSSARY.md`](../../GLOSSARY.md) under *Platform operations*.

## Context

The platform's operators need what a server panel such as RunCloud gives them — the health of each
server and its history, database backups, and a way to load-test a feature or the whole platform —
inside the admin panel they already use, with the same authorization, audit and design system. The
production target is DigitalOcean droplets running Docker Compose, with DigitalOcean Managed
PostgreSQL and Redis; locally, the developer's laptop is the server.

## Decision

### Monitoring

- **Servers report through a server agent** (`apps/server-agent`): a small Node program, run as a
  systemd service on each droplet and started by `pnpm dev` on a laptop, that reads the machine
  (`systeminformation`: Linux and macOS) every 10 s and pushes to the API with that server's own token.
  Registering a server in the panel issues the token and the install command. **The DigitalOcean API**
  (optional read-only token) adds the droplet's facts — name, region, size, status — and DigitalOcean's
  own view of it when the agent is silent. Without a token that section is hidden.
- **Instances report themselves**: every API, worker and analytics-consumer process writes a heartbeat
  with its live numbers to Redis every 10 s (the live gauges read it) and a per-minute rollup to
  PostgreSQL. No heartbeat for 30 s shows *Down*; for 2 minutes raises an alert.
- **Dependencies** — PostgreSQL, Redis, Kafka, RabbitMQ and the BullMQ queues — are probed by the
  instances, with their key statistics.
- **History lives in PostgreSQL**: minute rows kept 7 days, hourly rows 1 year, pruned by a job.
  Prometheus and Grafana are a later, separate step; nothing here blocks them.
- **Alerts**: one per incident (CPU, memory, disk, silence, a dependency down), emailed when it opens and
  when it resolves, to every SuperAdmin plus an editable recipients list, and shown in the panel.

### Backups

- `pg_dump --format=custom` run by a BullMQ job **on the worker**, as a dedicated read-only
  `app_backup` role with `BYPASSRLS` (its own `BACKUP_DATABASE_URL`; the application's roles are
  unchanged), streamed by multipart upload into a private, server-side-encrypted storage prefix.
  Locally, a `pg_dump` older than the server runs from the `postgres:18.6` image instead.
- Manual and daily (03:00, platform time zone); 14 days kept; a pinned backup is never pruned. Download
  is a 5-minute signed URL behind a fresh password / 2FA check, and audited. SuperAdmin only.
- **Not built:** restore from the panel (a documented CLI runbook instead) and client-side encryption.
  The managed database's own snapshots stay the disaster-recovery layer.

### Load tests

- **k6 in a separate load runner** (`apps/load-runner`, a Docker Compose service with k6 in its image),
  never inside the API it measures. It takes runs from BullMQ and streams live statistics back every
  second.
- A run is a **scenario** (a named user journey written in code), a **traffic mix** (every scenario,
  weighted) or **one read endpoint** (`GET` only — writes happen only through scenarios); shaped as
  constant, ramp, spike or soak; capped at 300 virtual users, 1,000 requests/s and 30 minutes (soak 2
  hours), caps editable by SuperAdmin; one run at a time; aborted automatically when errors stay above
  50 % for 30 s or a server stays above 95 % CPU for 60 s.
- Every run acts as **load-test users inside the Load Test tenant** only: no 2FA, never emailed, their own
  rate-limit bucket, and — enforced by the domain — never a platform role or another tenant. Their
  traffic is left out of analytics.
- Off unless `LOAD_TESTING_ENABLED=true`; in production a second explicit override is also required.
- Results: requests/s, p50/p95/p99, errors and a per-step breakdown over time, the server and instance
  metrics on the same timeline, pass/fail thresholds, a history of runs and a side-by-side comparison.

### Access

New permissions on exact verbs ([ADR 067](./067-unified-authorization-model.md)): `READ` / `LIST`
`SERVER_METRIC`, `CREATE` / `READ` / `DELETE` `DATABASE_BACKUP`, `CREATE` / `READ` `LOAD_TEST`. A new
platform role, **Platform Developer**, holds metrics and load tests; **Admin** holds metrics; backups are
SuperAdmin only.

## Two exceptions to the non-negotiables

Both are deliberate, limited, and must not be copied as a pattern:

1. **Agent pushes are not written to the HTTP audit log**, like the automated health checks it already
   leaves out: one row every 10 s per server forever would bury real activity. The server's last-seen time
   is still recorded, and registering a server, rotating its token and revoking it are audited.
2. **The load-test purge hard-deletes** the rows of the Load Test tenant and its load-test users — nothing
   else — instead of soft-deleting them. A run can create hundreds of thousands of rows; kept as
   soft-deleted rows forever, they would grow the database and skew every real metric. The purge is
   SuperAdmin only and audited.

## Considered options

- **Prometheus + Grafana now** — a second stack outside the admin panel, with its own sign-in. Later.
- **The DigitalOcean Monitoring API alone** — minute resolution, DigitalOcean only, nothing locally.
- **The API measuring its own host** — inside a container it sees only its own slice of the machine.
- **autocannon or a Node runner** — rate accuracy falls under load, and the runner competes with its own
  measurement. k6 is built for it.
- **A provider snapshot as the backup** — not downloadable, tied to one provider.

## Phases

Each phase ends with format → lint → typecheck → test → e2e → `ci:local`.

1. **Monitoring** — server agent, instances, dependencies, history and rollups, alerts and email, the
   Servers, Server detail, Dependencies and Alerts screens.
2. **Backups.**
3. **Load tests** — runner, scenarios, Load Test tenant, live results, comparison.
4. **Deployment** — production Dockerfiles, the droplet Compose file and the deployment guide.

## As built

What the implementation settled that the interview left open, and where it differs from the plan:

- **No separate backup worker process.** Backups run in the API's own BullMQ worker
  (`operations.backup`), one at a time; `pg_dump` is a child process streamed straight into object
  storage. The load runner is the only new long-running process.
- **Cloud facts through one generic adapter.** DigitalOcean, Linode (Akamai), Vultr and Hetzner are
  subclasses of one template-method adapter; a provider without a token is "not configured", never a
  half-working client.
- **Dependency probes are strategies.** RabbitMQ is checked by a TCP connection (the platform has no
  RabbitMQ client yet) and Kafka consumer lag is reported as "not measured".
- **The create-reward scenario became `merchant-rewards`** (list and read a merchant's rewards):
  creating a reward needs an image upload, which a load test should not generate by the thousand.
- **Load-test traffic keys.** Each run gets a key (`X-Load-Test-Key`) that gives its requests their
  own rate-limit bucket for the run's length, instead of switching throttling off.
- **Backup download step-up** reuses the MFA step-up window of the session: an operator who signed in
  with the authenticator recently can download; otherwise they sign in again.
- **The machine's spec** (CPU model, cores, RAM, storage) is part of every server summary, so the
  console shows what a machine is next to what it is using.
- **Development**: `pnpm dev` starts the agent as the seeded "This laptop"; `pnpm load-runner` starts
  the runner in Docker with k6 inside.

How to run and operate it: [Platform operations console](../technical/operations/platform-operations-console.md).

## The decision trail

| # | Question | Decision |
|---|---|---|
| 1 | "Exact replica" | RunCloud's feature set in the admin panel's own design, not a visual copy |
| 2 | What a server is | Server agent + instances + dependencies; DigitalOcean droplets in production |
| 3, 14 | Metrics | The extended set: per-core CPU, steal, iowait, swap, disk I/O, inodes, TCP, file descriptors, top processes; latency percentiles, slowest endpoints, GC, pool; PostgreSQL, Redis, queues, Kafka lag, TLS expiry, uptime checks |
| 4 | History | PostgreSQL now; Prometheus + Grafana later |
| 5, 15 | Alerts | Email to SuperAdmins + an editable list (the owner's address only in their own `.env`), Mailpit locally |
| 6 | Backup mechanism | `pg_dump` to object storage |
| 7 | Restore | No restore button for now |
| 8 | Schedule | Manual + daily 03:00, 14 days, pinning, 5-minute signed download |
| 9 | Protection | Private encrypted prefix, SuperAdmin, fresh re-authentication, audited; client-side encryption later |
| 10 | Who | Platform Developer: metrics + load tests; Admin: metrics; backups SuperAdmin |
| 11 | Where load runs | Separate load runner, off by default, Load Test tenant, caps and abort |
| 12 | Collection | Agent for live data + the DigitalOcean API for droplet facts |
| 13 | Hosting | Docker Compose on droplets, Managed PostgreSQL and Redis; the laptop locally |
| 16 | Load targets | Scenario, traffic mix, single `GET` endpoint |
| 17 | Engine | k6 |
| 18, 28 | Shapes and caps | Constant, ramp, spike, soak; 300 VUs, 1,000 rps, 30 min / 2 h; auto-abort; one at a time |
| 19 | Results | Live charts, server metrics on the same timeline, thresholds, history, comparison |
| 20 | Screens | Platform → Operations in the admin panel |
| 21 | Laptop | Cross-platform agent, started by `pnpm dev` as "This laptop" |
| 22 | Audit | Agent pushes left out of the HTTP audit log (exception 1) |
| 23 | Instances | Redis heartbeat + PostgreSQL rollup; Down at 30 s, alert at 2 min |
| 24 | Backup access | `app_backup` role with `BYPASSRLS`, on the worker; Docker `pg_dump` fallback |
| 25 | Runner locally | Docker Compose service `load-runner` |
| 26 | Load-test data | Hard-delete purge of the Load Test tenant (exception 2); excluded from analytics |
| 27 | Load-test users | No 2FA, never emailed, own rate limit, confined to the Load Test tenant |
| 29 | Order | Monitoring, backups, load tests, deployment |
