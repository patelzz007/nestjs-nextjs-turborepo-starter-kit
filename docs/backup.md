---
title: "Database Backup & Restore"
tags: ["backup", "database", "pg_dump", "operations", "admin"]
description: "Admin-triggered pg_dump snapshots with gzip compression, checksums, queueing, signed downloads, restore-to-a-new-database, and verification — plus the role-based rate limits and page-bound progress UI."
order: 19
author: "Acme Inc."
lastUpdated: 1787011200000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# Database Backup & Restore

> [!NOTE] **What this is.** A manual, admin-triggered database backup feature with a download
> flow — the admin panel at `localhost:3001/backup` creates a `pg_dump` → gzip snapshot of the
> whole database, runs it as a **single queued background job**, checksums the result (SHA-256),
> and serves downloads behind a short-lived signed token. Backups can be **verified** (restored
> into a scratch database, then dropped) and **restored** (into a brand-new database, never
> touching existing data). Files are pruned automatically after the retention window.
>
> **Ground truth** (verified 2026-08-18):
>
> - Feature module: `apps/api/src/modules/backup/` (`BackupService` + `BackupController` + `BackupAdminGuard`)
> - Admin UI: `apps/admin/app/(panel)/backup/backup-panel.tsx`
> - Shared contracts: `packages/shared/src/schemas/domain/backup.ts` + `packages/shared/src/contracts/`
> - All routes live under `apiPath("/backup")` → `/api/v1/backup` and are **excluded from the public Swagger doc**
>   (a backup is the whole database — the surface stays out of the docs).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/backup` | Create a backup (202 Accepted, runs in the background) |
| `GET` | `/api/v1/backup` | List history + operational facts (active flag, retention days) |
| `GET` | `/api/v1/backup/options` | Excludable tables + env-driven default exclusions |
| `GET` | `/api/v1/backup/schedules` | In-memory daily/weekly cron rows (static path; registered above `:id`) |
| `POST` | `/api/v1/backup/schedules/:id/toggle` | Enable/disable a schedule (`{ enabled }`; typed via `api.backup.toggleSchedule`) |
| `GET` | `/api/v1/backup/:id` | One backup's status/progress (the poll target) |
| `POST` | `/api/v1/backup/:id/download` | Mint a signed download token (bound to the requesting admin) |
| `GET` | `/api/v1/backup/:id/download?token=…` | Stream the gzip file (token required) |
| `POST` | `/api/v1/backup/:id/verify` | Restore into a scratch DB, count tables, drop it |
| `POST` | `/api/v1/backup/:id/restore` | Restore into a **new** database (password re-verification required) |
| `POST` | `/api/v1/backup/:id/cancel` | Gracefully stop a pending/running job (`CANCELLED`) |
| `DELETE` | `/api/v1/backup/:id` | Delete the file + row |

Every route requires the global `AuthGuard` **and** `BackupAdminGuard` (admin access). The
`/backup` UI is only reachable by admins via the admin proxy.

## Rate limits

Backup creation is capped per user over a **rolling hour** (in-memory window, reset on API
restart). The cap is **role-based** — decided from the `isSuperAdmin` claim in the access token
at request time:

| Role | Default cap | Env var |
| --- | --- | --- |
| Superadmin | **10 / hour** | `BACKUP_RATE_LIMIT_SUPERADMIN` |
| Everyone else | **5 / hour** | `BACKUP_RATE_LIMIT` |

Setting either env var to `0` disables that tier's cap. The rejection is a 503 with copy that
names the limit (e.g. `max 5 backups per hour`), so the UI's error toast is actionable.

The **create form shows the live quota** — a chip with a mini progress bar
(`3 of 5 backups left this hour · resets in ~42m`), computed from the same rolling-window state
the create endpoint enforces (`GET /backup` returns it as `rateLimit: { limit, used, resetsAt }`
in the list payload). When the window is spent the chip turns red and the **Start backup** button
disables until it refills (the server still rejects as defense-in-depth).

> [!TIP] **Why two tiers?** Backups are heavy (full `pg_dump` + gzip + checksum) and the queue
> runs one job at a time. The cap stops one admin from flooding the queue; superadmins get a
> higher ceiling because they're the ones expected to take pre-migration snapshots.

Separately, **download-token mints** are capped per user over a rolling **15-minute** window
(`BACKUP_DOWNLOAD_RATE_LIMIT`, default `10`) — so a single backup can't be re-minted into an
unlimited number of signed URLs.

## Progress UX

**Progress lives on the page, not in a toast.** When a job is pending/processing, the `/backup`
page shows an **Active job card** (right under the header):

- the backup name + current stage (`Waiting for the dump to start…` → `Dumping the database…` →
  `Verifying checksum…`)
- an **eased progress bar** (the API jumps 5 → ~60 → 92 → 100 as pg_dump reports per-table
  progress; the bar glides via a rAF easing hook instead of snapping)
- queue position when the job is waiting behind another
- a **Cancel** button (SIGTERMs the running `pg_dump`, marks the row `CANCELLED`)

The page polls the list every 2s while a job is active. Toasts are **result-only**:
`Backup started` (blue info), then `Backup completed` (green, with size + checksum) or
`Backup failed` (red, with the error-code copy) when the job settles — the watcher only fires
for jobs it saw go active while the page was open, so loading history stays silent.

## Download flow

1. `POST /:id/download` mints a signed JWT (`sub` = backup id, `uid` = requesting admin,
   `purpose: backup:download`, 15-min TTL from `BACKUP_DOWNLOAD_TTL_MINUTES`).
2. `GET /:id/download?token=…` **re-verifies** the token is bound to *this* backup **and** *this*
   admin, checks the file exists + has gzip magic bytes, and streams it with
   `Content-Disposition: attachment` + an `X-Checksum-Sha256` header.
3. The admin app downloads through the same-origin proxy (`/api/backup/…`), so auth rides the
   normal admin cookies — no CORS.

## Verify & restore

- **Verify** (`POST /:id/verify`): restores the dump into a throwaway `verify_<id>` database,
  counts the public tables, persists `verifiedAt` + `verifiedTableCount` on the row, then drops
  the scratch DB — even on failure. The file is re-hashed against the recorded checksum first.
- **Restore** (`POST /:id/restore`): restores into a **brand-new** database (auto-named
  `restored_<name>_<timestamp>` unless a target name is given). Existing databases are never
  touched or overwritten; a name collision is a clean 409. Because restore creates a real
  database, the admin must **re-enter their password** (bcrypt check against the row) — 403 on
  mismatch. Leftover `verify_%` databases from a crash are swept at boot.

## Architecture

```text
                    admin panel (localhost:3001/backup)
                                  |   polls every 2s while a job is active
                                  v
              BackupController  (/api/v1/backup, BackupAdminGuard)
                                  |
                                  v
                        BackupService (in-memory queue, max 3 waiting)
                                  |
                 +----------------+------------------+
                 v                                   v
       runBackupJob(id)                    verifyBackup / restoreBackup
                 |                                   |
   pg_dump ──► gzip ──► counter ──► .part    psql ──► scratch or NEW db
                 |                                   |
        byte-count check ── rename ──►       count tables ── drop scratch
        SHA-256 ── row update ── prune
```

The whole feature is one injectable service + one guarded controller. There is no queue
library — the queue is an in-memory FIFO (`string[]`) because backups are single-host
operations (pg_dump shells out to the same PostgreSQL server). A restart loses the in-memory
queue, but rows persist: stuck `pending`/`processing` rows are failed at boot with
`Backup interrupted by a server restart`, and orphaned `.sql.gz` files and leftover
`verify_%` databases are swept.

### Module layout

- `apps/api/src/modules/backup/backup.service.ts` — queue, the dump/restore pipelines, rate
  limits, retention, sweeps (~1,200 lines; the meat of the feature)
- `apps/api/src/modules/backup/backup.controller.ts` — routes, `BackupAdminGuard`, passes the
  requesting admin (`sub` + `isSuperAdmin`) down to the service
- `apps/api/src/modules/backup/backup-admin.guard.ts` — admin-access gate
- `apps/admin/app/(panel)/backup/` — `page.tsx` (SSR prefetch) + `backup-panel.tsx` (client UI)
- `packages/shared/src/schemas/domain/backup.ts` — the zod contract both sides share

### Data model (`Backup` → `backups` table)

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `uuid` | Row id — also the queue/cancel/download handle |
| `name` | `varchar(100)` | Human label (`backup_YYYYMMDD_HHMMSS` default) |
| `status` | `varchar(20)` | `pending → processing → completed \| failed` |
| `progress` | `int` | 0–100 (5 → ~85 → 92 → 100) |
| `stage` | `varchar(20)` | `queued → dumping → finalizing → done \| failed` |
| `filename` | `varchar(255)` | Path **relative** to `BACKUP_DIR` (`YYYY/MM/DD/…sql.gz`) |
| `size_bytes` | `bigint` | Compressed size once done |
| `checksum` | `varchar(64)` | SHA-256 of the `.sql.gz` |
| `error` / `error_code` | `text` / `varchar(32)` | Redacted message + machine category |
| `compress_level`, `schema_only`, `tables_excluded` | | The create form's choices |
| `requested_by` / `requested_by_name` | | Who started it (display + audit) |
| `created_at`, `completed_at`, `expires_at` | `bigint` | **Epoch ms** (repo-wide convention) |
| `verified_at`, `verified_table_count` | | Last scratch-DB verify result |
| `restored_at`, `restored_database` | | Last restore-into-new-DB result |

All timestamps are epoch milliseconds stored as `bigint` — the FE formats with date-fns.

## Queue design & job lifecycle

- **One job at a time.** `create()` assigns a position: `0` when idle (runs immediately), else
  `queue.length + 1`. A 4th waiter is rejected with 409 **before** a row is created (the row
  is rolled back) — the queue never exceeds `MAX_QUEUE_DEPTH = 3`.
- **Persisted claim.** The job transitions the row with an `updateMany`
  `pending → processing` — if a restart or cancel already changed the row, the job aborts
  without running (`claimed.count === 0`).
- **Cancel** adds the id to `cancelledIds`, SIGTERMs the running child (or fails a queued row
  immediately). The job's catch checks `cancelledIds` **first**, so a SIGTERM race can never
  overwrite the `CANCELLED` state; the queue runner skips cancelled ids.
- **Progress** comes from pg_dump's stderr (`dumping contents of table "x"` lines):
  `5 + 80 × (tables dumped ÷ data tables)`, capped at 85. Finalize bumps to 92, done to 100.
- **Retries:** transient child/pipe failures retry with backoff (3 attempts, 3s then 10s);
  timeouts never retry (a wedged dump won't un-wedge).

## The dump pipeline

1. `pg_dump --dbname=… --no-owner --no-acl --format=plain` (+ `--schema-only` and
   `--exclude-table-data=…` per the row). The DB URL is sanitized for libpq (driver-adapter
   params like `?schema=` are stripped, SSL/timeout params kept).
2. `stdout.pipe(gzip).pipe(counter).pipe(out)` — `out` is a 64KB `highWaterMark` write stream
   to `<filename>.part`. The pass-through `counter` Transform counts **compressed** bytes
   (a Writable never emits `data`, so a byte counter must live in the pipe).
3. A 30-minute watchdog SIGKILLs a wedged pg_dump; stderr is tailed to 4KB.
4. On child close + stream close: `statSync(.part).size` must equal the counted bytes
   (**byte-count verification** catches silent truncation), then the file is atomically
   renamed to its final name. Failure removes the `.part` file.
5. Finalize (5-minute watchdog): SHA-256 the file, record size/checksum/`completedAt`/
   `expiresAt`, zero the circuit breaker, prune expired backups.

## Failure modes & error taxonomy

| `errorCode` | Trigger | Friendly copy (UI) |
| --- | --- | --- |
| `CANCELLED` | Admin cancelled the job | Cancelled by an administrator |
| `TIMEOUT` | 30-min dump / 5-min finalize watchdog fired | The dump exceeded its time limit and was killed |
| `DISK_FULL` | Free space below `BACKUP_MIN_FREE_MB` at create or job start | Not enough free disk space |
| `PGDUMP_UNAVAILABLE` | pg_dump missing / spawn error | pg_dump could not be started — is PostgreSQL installed? |
| `DUMP_SIZE_MISMATCH` | Pipe bytes ≠ bytes on disk | The dump was truncated while writing |
| `RESTORE_FAILED` | psql restore into scratch/new DB failed | The restore step failed |
| `UNKNOWN` | Anything else (message is redacted) | The backup failed |

The **circuit breaker** trips after 3 consecutive job failures: new creates return 503 until
one job succeeds. Error messages are **redacted** (connection URLs / passwords stripped)
before they reach the row or the logs.

## Testing guide (local)

Prereqs: PostgreSQL running, `pg_dump`/`psql` on `PATH`, `BACKUP_ENABLED=true` (default).
The API ships a seeded `admin@example.com` (regular admin, 5/hr) and
`superadmin@example.com` (10/hr) — log in with `x-client-type: admin`.

1. **Create + progress:** `POST /api/v1/backup` → 202 `{ backupId, position: 0 }`. Poll
   `GET /api/v1/backup/:id` and watch `progress` climb 5 → ~85 → 92 → 100. The admin panel
   shows the eased bar on the page.
2. **Queue + cap:** fire 2 more creates → positions 1 and 2; a 4th → 409. Cancel one queued
   job → `CANCELLED`; the next starts.
3. **Schema-only:** create with `schemaOnly: true` → a tiny dump; verify still restores it.
4. **Verify:** `POST /:id/verify` → `tableCount` (scratch DB is dropped right after — confirm
   no `verify_%` database remains via `\l`).
5. **Restore:** `POST /:id/restore` with the admin password → a new `restored_…` database is
   left in place; wrong password → 403.
6. **Rate limits:** hammer create → 503 at 5/hr (regular) / 10/hr (superadmin); the `/backup`
   quota chip counts down and the Start button disables.
7. **Download:** mint a token (`POST /:id/download`), then stream it through the admin proxy
   `GET /api/backup/download/:id?token=…` — verify `Content-Disposition` + `X-Checksum-Sha256`.
8. **Retention:** check `expiresAt`; the next create/list prunes expired rows + files.

## Guardrails

- **Queueing**: jobs run one at a time; up to 3 wait (`MAX_QUEUE_DEPTH`), beyond that `create`
  returns 409. The row is claimed with an `updateMany` `pending → processing` transition, so a
  restart mid-job fails the row at boot instead of leaving a ghost.
- **Retries**: transient dump failures retry with backoff (3 attempts); timeouts never retry.
- **Watchdogs**: 30 min for the dump, 5 min for finalize, 30 min for restores.
- **Circuit breaker**: 3 consecutive failures block new creates until one succeeds.
- **Disk checks**: free space is asserted at create **and** at job start (`df` with a `statfs`
  fallback); below `BACKUP_MIN_FREE_MB` the create is rejected.
- **Atomic writes**: the dump is streamed to `<name>.part` with a byte-count verification and
  renamed only on success; partial files are always cleaned up.
- **Error taxonomy**: failures persist a machine-readable `errorCode`
  (`CANCELLED` / `TIMEOUT` / `DISK_FULL` / `PGDUMP_UNAVAILABLE` / `DUMP_SIZE_MISMATCH` /
  `RESTORE_FAILED` / `UNKNOWN`) that the UI maps to friendly copy.
- **Exclusions**: rows of high-volume observability tables are skipped by default
  (`BACKUP_EXCLUDE_TABLES`, defaults to `logs,backups`) — schema is always kept, so a restore
  still creates every table Prisma expects. The form lets admins pick any set (including none),
  with a "Restore defaults" button that reseeds the env-driven list.

## Production Hardening

### Dynamic Watchdog Timeout

The dump timeout scales with database size instead of a fixed 30-minute limit:

- **≤10GB**: 30 minutes (baseline)
- **10–50GB**: 30 min + 1 min per GB above 10GB (40–70 min)
- **50–100GB**: 70–120 min
- **>100GB**: capped at 4 hours

The formula is `min(30min + (sizeGB - 10) × 1min, 4hr)`. This prevents premature kills on
large databases while still catching genuinely wedged dumps.

### Adaptive Compression

The UI shows a **suggested compression level** based on your database size:

| DB Size | Suggested Level | Reasoning |
| --- | --- | --- |
| <1GB | 6 | Balanced speed/size |
| 1–10GB | 6 | Balanced |
| 10–50GB | 3 | Fast compression to reduce dump time |
| >50GB | 1 | Fastest — compression overhead not worth it |

The suggestion is advisory — you can still override the slider. Schema-only dumps always use
level ≤3 (the schema is tiny; fast compression is sufficient).

### Continuous Disk Monitoring

During an active backup, disk space is checked every **30 seconds**. If free space drops below
512MB (`DISK_CRITICAL_MB`), the backup is **automatically cancelled** to prevent cascading
failures. This catches the scenario where a backup fills the disk mid-dump.

### DB Size Estimation

Create writes `expiresAt = now + BACKUP_RETENTION_DAYS`. Prune deletes rows where
`expiresAt < now` (not `now - retention` — that doubled the window).

Before starting, the service queries `SELECT pg_database_size(current_database())` (no
database name interpolated into SQL) to show:

- **Database size** in the create form
- **Estimated backup time** (rough heuristic: ~100MB/min for pg_dump)
- **Large database warning** (>10GB) with advice to consider schema-only or table exclusion

### Backup Scheduling

Two built-in schedules run as system-level jobs:

| Schedule | Cron | Purpose |
| --- | --- | --- |
| `daily` | `0 2 * * *` | Daily full backup at 2 AM UTC |
| `weekly` | `0 3 * * 0` | Weekly full backup on Sunday at 3 AM UTC |

Schedules are visible in the backup panel (also on `GET /backup` as `schedules`) and
toggled with `POST /api/v1/backup/schedules/:id/toggle`. The scheduler checks
every 60 seconds. Scheduled backups are skipped when:
- A manual backup is already running
- The circuit breaker is open (3+ consecutive failures)

### Structured Audit Logging

Every backup lifecycle event is logged with structured metadata:

| Event | When | Metadata |
| --- | --- | --- |
| `created` | Backup requested | name, ipAddress, schemaOnly |
| `started` | Job begins processing | compressLevel, schemaOnly |
| `completed` | Dump finished | sizeBytes, checksum, durationMs, speedMBps |
| `failed` | Job failed | errorCode, durationMs |
| `cancelled` | Admin cancelled | — |
| `downloaded` | Token minted | ttlSeconds |
| `verified` | Scratch-DB check passed | tableCount, durationMs |
| `restored` | Restore into new DB | database, tableCount, durationMs |
| `deleted` | File + row removed | — |

These events appear in the structured logs (and Telescope if enabled) for compliance and
debugging.

### Enhanced Progress Tracking

The active-job card on the backup page shows:

- **Progress bar** with eased animation (glides instead of snapping)
- **Stage label** (queued → dumping → compressing → finalizing → done)
- **Queue position** when waiting behind another job
- **Cancel button** for graceful termination

The progress updates every 2 seconds via polling. The bar advances from 5% to ~85% during
the dump phase (based on per-table progress from pg_dump stderr), then jumps to 92% for
finalization (checksum) and 100% on completion.

## Environment variables

| Env var | Default | Purpose |
| --- | --- | --- |
| `BACKUP_ENABLED` | `true` | Master switch (`false` disables the feature) |
| `BACKUP_DIR` | `./backups` | Where dumps land (`YYYY/MM/DD/` subdirectories) |
| `BACKUP_RETENTION_DAYS` | `7` | Files + rows pruned past this (epoch-based cutoff) |
| `BACKUP_RATE_LIMIT` | `5` | Backup creations / hour for regular admins (`0` = off) |
| `BACKUP_RATE_LIMIT_SUPERADMIN` | `10` | Backup creations / hour for superadmins (`0` = off) |
| `BACKUP_EXCLUDE_TABLES` | `logs,backups` | Comma-separated tables whose **rows** are skipped |
| `BACKUP_DOWNLOAD_SECRET` | `backup-download-secret-change-me` | Signs download tokens (set a real secret in prod) |
| `BACKUP_DOWNLOAD_TTL_MINUTES` | `15` | Download-token lifetime |
| `BACKUP_DOWNLOAD_RATE_LIMIT` | `10` | Token mints / 15 min per user (`0` = off) |
| `BACKUP_MIN_FREE_MB` | `1024` | Abort a new backup below this much free disk |

**Prerequisites:** `pg_dump` and `psql` must be on the API server's `PATH` — the feature shells
out to them. `BACKUP_DOWNLOAD_SECRET` should be overridden in any non-local environment.
