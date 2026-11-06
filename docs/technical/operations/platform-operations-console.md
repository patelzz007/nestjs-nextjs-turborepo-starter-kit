---
title: "Platform operations console (servers, backups, load tests)"
tags: ["operations", "monitoring", "backups", "load-testing", "adr-068"]
description: "How the admin panel's operations console works: the server agent, live and historical metrics, alerts, database backups, load tests, and how to run each piece locally and on a droplet."
author: "Platform Team"
lastUpdated: 1793145600000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 8
---

# Platform operations console

The admin panel's **Operations** section (ADR 068) is the platform's own RunCloud-style console:
every server's health and history, the API instances and dependencies, alerts, database backups and
load tests. This page explains how it works and how to run it. The decision record is
[ADR 068](../../adr/068-platform-operations-console.md); the screens are described for operators in
[the user guide](../../user-guide/11-operations-console.md).

## Who sees what

| Screen | SuperAdmin | Platform Developer | Admin |
| --- | --- | --- | --- |
| Servers, server detail, alerts | ✅ | ✅ | ✅ |
| Register / rotate / remove a server, alert thresholds | ✅ | — | — |
| Backups (all of it) | ✅ | — | — |
| Load tests: start, abort, compare | ✅ | ✅ | — |
| Load-test caps and the load-test data purge | ✅ | — | — |

The API enforces every row (`SERVER_METRIC`, `LOAD_TEST`, `DATABASE_BACKUP` permissions and
`@SuperAdminOnly`); the admin hides what you cannot use. Development seeds
`developer@example.com` / `Developer@123` with the Platform Developer role.

## The pieces

| Piece | Where | What it does |
| --- | --- | --- |
| Server agent | `apps/server-agent` | Reads one machine (CPU, memory, disks, network, processes) every 10 s and posts it to the API with its own bearer token. Rolls its own minute up and sends it once a minute. |
| API, `operations` context | `apps/api/src/contexts/operations` | Stores the latest sample in Redis (30 s TTL), minute and hour history in PostgreSQL, evaluates alerts every minute, probes dependencies, runs backups and records load tests. |
| Load runner | `apps/load-runner` | Takes load tests from the `operations.load-test` queue and drives them with k6. Never runs inside the API. |
| Admin screens | `apps/admin/contexts/operations` | Servers, a server's detail, alerts, backups, load tests and the comparison of two runs. |

### Data flow

1. The agent posts `POST /api/v1/operations/agent/report` every 10 s. Its token's SHA-256 digest
   identifies the server; the report is not written to the HTTP audit log (ADR 068, exception 1),
   but the server's last-seen time is.
2. The API keeps the live sample in Redis and writes the agent's finished minute to
   `OpsServerSample` (`MINUTE`). Every API instance records its own minute (`OpsInstanceSample`) and
   one instance per minute probes the dependencies (`OpsDependencySample`).
3. Hourly, the minutes roll up into `HOUR` rows. Minutes are kept 7 days, hours a year.
4. Each minute the alert rules run over the latest readings. An alert opens and resolves through
   `notify()` (`operations.alert`) for every SuperAdmin, Admin and Platform Developer — admin bell,
   phone app, push at any hour, email — and by email alone to `OPS_ALERT_EXTRA_RECIPIENTS`
   (`ops-alert-notifier.ts`, [notifications](../notifications/overview.md#operations-alerts)).
   An instance that stops reporting alerts only when nothing **replaced** it: if a newer process of the
   same service on the same host started after it last reported, it was restarted (a deploy, a process
   manager, a developer's watcher), so it opens no alert and the live store forgets it that minute
   (`replacedInstanceIds`). One with no successor — a crash nothing restarted, a host gone — alerts, and
   is forgotten after 24 hours.

### Cloud providers (a generic adapter)

A server registered as **DigitalOcean**, **Linode**, **Vultr** or **Hetzner** with its provider id
also shows the provider's own view (plan, region, size, public IP, status). One template-method
base class (`CloudServerFactsAdapter`) does the call, the timeout and the error handling; each
provider is a small subclass that names its URL, its answer's schema and how it maps. Adding a
provider is one subclass and one `case` in `adapterFor`. Answers are cached for a minute.

| Provider | Token variable | Token scope |
| --- | --- | --- |
| DigitalOcean | `DIGITALOCEAN_TOKEN` | Read |
| Linode (Akamai) | `LINODE_TOKEN` | Linodes: Read Only |
| Vultr | `VULTR_API_KEY` | API key, with the API's IP allowed |
| Hetzner | `HCLOUD_TOKEN` | Read |

Without a token the console still shows everything the agent reports.

## Running it locally

`pnpm dev` starts everything, including the server agent as **"This laptop"**: the seed registers
that server with a fixed development token and the agent's `dev` script uses it
(`OPS_AGENT_DEV=true`). Open **Operations → Servers** in the admin panel.

- Run `pnpm db:seed` once after pulling ADR 068: it seeds a day of minutes and a year of hours of
  history, alerts, backups and load-test runs, so every chart range has data.
- Start the load runner with `pnpm load-runner` (Docker; k6 is inside the image) and set
  `LOAD_TESTING_ENABLED=true` in `apps/api/.env`.
- Backups need `pg_dump` 18. Without it locally, the API runs `pg_dump` in the
  `BACKUP_PG_DUMP_DOCKER_IMAGE` container instead.

## Backups

- **Back up now** or the daily schedule (hour and retention, in the platform's time zone) queue a
  job on `operations.backup`. The worker streams `pg_dump --format=custom` straight into object
  storage with multipart upload (16 MiB parts, a failed part retries alone), records the size, the
  SHA-256 checksum and both PostgreSQL versions.
- `pg_dump` connects as a login in the `app_backup` group (`BYPASSRLS`, read only), set in
  `BACKUP_DATABASE_URL`. Never point it at the application role: RLS would make the dump partial.
- Downloading needs a fresh second factor (the step-up window): the API issues a one-time ticket
  that is spent on first use and lives five minutes.
- There is deliberately **no restore button**. Restore with `pg_restore` following the runbook.
- Retention removes unpinned backups older than the retention; pinned ones stay.
- **Weekly restore drill** (enhancement 2.6): once a week (queued on `operations.backup` with a per-week
  job id, so it runs once however many instances ask, and never beside a dump) the newest good backup is
  read back from storage, its SHA-256 compared with the one recorded when it was taken, restored with
  `pg_restore` into a throwaway `restore_drill_<time>` database on the same server, and checked: every
  application table present, row-level security enabled and forced on every manifest table, a finished
  migration, real rows. The copy is always dropped. The result (passed or failed, with each failure) is
  recorded in `OpsRestoreDrill` and shown under **Restore drills** on the Backups screen. Set it up with a
  login that may create and drop databases (never the application's own login):

  ```sql
  CREATE ROLE restore_drill LOGIN PASSWORD '<from your secret store>' CREATEDB;
  ```

  and `RESTORE_DRILL_DATABASE_URL=postgresql://restore_drill:<password>@<host>:5432/postgres`. Unset, no
  drill runs. The local `pg_restore` must be the server's major version or newer, or the drill fails and
  says so.

## Queues

**Operations → Queues** (enhancement 4.4) shows every BullMQ queue the API uses, in the console itself rather
than a separate Bull Board:

| Shows | From |
|---|---|
| Waiting, running, delayed and failed jobs, and whether the queue is paused | `getJobCounts`, `isPaused` |
| The last hour's finished and failed jobs, and the failure rate (failed ÷ finished) | BullMQ's own per-minute metrics. Every processor passes `MONITORED_WORKER_OPTIONS` (`@workspace/messaging/nest`) to turn them on; the queue e2e test checks every worker does |
| A queue's newest 50 failed jobs: name, id, why it failed, attempts, when | The failed set. **Never the job's data**: it can hold personal data |

**Retry** (attempts reset) and **Discard** act on one failed job and need a reason, which the request audit
records with who did it. A job that isn't failed (any more) answers 404. Permissions: `BACKGROUND_JOB`
`LIST` to look (Admin and Platform Developer), `UPDATE` to retry and `DELETE` to discard (Platform
Developer). Without Redis the screen says there are no queues.

The optional `bull-board` container in `compose.yml` stays for local debugging only (it has no sign-in and no
audit); production uses this screen.

## Status page

The **public status page** (enhancement 4.5) is `/status` on the web app, backed by `GET /operations/status`
(no sign-in; cached 30 seconds). It shows three parts of the service, each the worse of what the monitor last
saw and any open incident naming it:

| Part | Rests on | A check older than 5 minutes |
|---|---|---|
| Website, apps and API | ENDPOINTS | reads "No recent check" |
| Accounts and data | POSTGRES | reads "No recent check" |
| Emails, notifications and background work | QUEUES, REDIS | reads "No recent check" |

An incident's impact can only make a part look worse than the monitor says (Minor → slower, Major → partly
down, Critical → down), never better. Nothing internal is public: no latencies, errors, hosts or who posted.

Staff use **Operations → Status page**: open an incident (title, impact, affected parts, first update), then
post updates (Investigating → Cause found → Fixed, watching → Resolved). Updates are append-only, and once
an incident is resolved nothing more can be posted (409; two people resolving at once can't both post).
Every post is audited. Permissions: `STATUS_INCIDENT` `LIST`, `CREATE`, `UPDATE` (Admin and Platform
Developer). Resolved incidents stay on the public page for 7 days.

## Load tests

- A run targets **one scenario**, the **whole platform** (a weighted mix of scenarios) or **one
  read endpoint**, with a shape (ramp, constant, spike, soak), virtual users, requests per second,
  a duration and pass thresholds (p95 and error share). The SuperAdmin's caps bound every run.
- It acts only as load-test users of the **Load Test tenant**: they need no second factor, are
  never emailed (`.invalid` addresses are dropped) and cannot be added to a real tenant.
- Every request carries the run's traffic key (`X-Load-Test-Key`), which gives the run its own
  rate-limit bucket for the run's length.
- One run at a time. A run stops itself when errors stay above 50% for 30 s or a server stays above
  95% CPU for 60 s. Load testing is refused on production unless
  `LOAD_TESTING_ALLOW_PRODUCTION=true` is also set.
- Provisioning (every start) is idempotent: one customer per virtual user, and
  ⌈virtual users ÷ 5⌉ staff accounts — a user keeps at most 5 sessions
  (`MAX_ACTIVE_SESSIONS_PER_USER`) and the runner gives virtual user *n* the staff account
  `(n − 1) mod accounts`, so no account is asked for a sixth session (which would revoke the oldest:
  `401 SESSION_REVOKED`). Ten published rewards, each marked in `Reward.metadata`
  (`loadTestRewardSlot`), so later runs find them whoever the audit capture records as their creator.
- Every provisioned reward shows the tenant's **load-test picture**: a plain 1920×1080 PNG drawn in
  memory (EXIF and file name `load-test-reward.png` say what it is) and stored through the files
  context's `ServerFileIngest` — the checks, malware scan and renditions an upload gets — before the
  provisioning transaction (object storage is never written inside one). The same bytes are found
  again on later runs, so it is stored once. With an asynchronous scanner a start answers
  `409 FILE_NOT_READY` until the picture's scan has finished.
- **Purge load-test data** hard-deletes what load tests created in the Load Test tenant (ADR 068,
  exception 2): every reward there except the provisioned ones (which keep their picture, so the
  picture stays in use and cannot be deleted), the load-test users' claims, sessions and the rest.
  Runs and their results stay.
- A nightly CI job runs a short traffic mix through this same path and fails when an endpoint group's
  p95 or error rate regresses against `budgets/load.json` ([CI: Load test (nightly)](./ci.md#load-test-nightly)).

## Deploying to a droplet

`infra/docker/Dockerfile` builds every deployable with `--target` (`api` ships `pg_dump` 18;
`load-runner` ships k6). `infra/droplet/compose.yml` runs the platform on one machine, with
PostgreSQL and Redis as the provider's managed services:

```bash
docker compose -f infra/droplet/compose.yml up -d --build                       # the platform
docker compose -f infra/droplet/compose.yml --profile agent up -d server-agent   # its server agent
```

Register the server in **Operations → Servers** first; the dialog shows the token and the exact
command once.

## Configuration

Every variable is documented in `apps/api/.env.example` under **PLATFORM OPERATIONS**:
`DIGITALOCEAN_TOKEN`, `LINODE_TOKEN`, `VULTR_API_KEY`, `HCLOUD_TOKEN`, `BACKUP_DATABASE_URL`,
`BACKUP_PG_DUMP_DOCKER_IMAGE`, `LOAD_TESTING_ENABLED`, `LOAD_TESTING_ALLOW_PRODUCTION`,
`LOAD_TEST_TARGET_URL`, and `OPS_ALERT_EXTRA_RECIPIENTS` for extra alert addresses (keep real
addresses in `.env`, never in the repository).

## Known limits

- RabbitMQ is checked by a TCP connection only, and Kafka consumer lag is not measured yet (shown
  as "not measured").
- Prometheus and Grafana are planned; until then PostgreSQL holds the history.
- Backups are encrypted by the storage provider; client-side encryption is planned.
