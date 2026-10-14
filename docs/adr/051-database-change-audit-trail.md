---
title: "ADR 051: Every Row Change Is Recorded by the Database Itself"
tags: ["adr", "security", "audit", "rls", "postgresql"]
description: "A trigger on every captured table records each INSERT / UPDATE / DELETE / TRUNCATE in data_change_logs in the same transaction — the full row before and after, redacted — attributed from the session variables the API already sets and joined to its HTTP request by correlation id."
author: "Backend Team"
lastUpdated: 1791936000000
coverImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=630&fit=crop"
order: 51
---

# ADR 051: Every Row Change Is Recorded by the Database Itself

**Status:** Accepted — implemented (2026-10-14)
**Date:** 2026-10-14
**Deciders:** Backend Team

## Context

ADR 025 records every HTTP request: who called which endpoint, with what, and what came back.
It does not record what the request changed in the database — `POST /redemptions/checkout`
touches claims, sales and redemptions, and the audit row cannot say which rows or what they held
before. Writes that never pass through HTTP leave no record at all: queue jobs, schedulers, the
outbox dispatcher, consumers, CLIs, migrations and anyone with a `psql` prompt.

The requirement: **anything that hits the database is known about** — every change by every user
from SuperAdmin to cashier, however small. Reads stay covered by ADR 025 (one row per request,
response included); recording every SELECT statement would need a server extension writing to
the server log, not a queryable table, at a volume no viewer could use.

## Decision

- **Capture in the database, not in application code.** Every table in `public` gets two
  triggers — `data_change_capture` (AFTER INSERT / UPDATE / DELETE, per row) and
  `data_change_capture_truncate` (AFTER TRUNCATE) — that append to `data_change_logs` **in the
  same transaction** as the change. A change can never commit without its record, and a rolled-back
  change leaves none. No endpoint, job or repository has to remember anything: a new code path is
  captured the moment it writes.
- **What a record holds:** table, primary key (`row_id`; composite keys joined with `/`),
  operation, the **full row before and after** (`old_data` / `new_data`), the columns an UPDATE
  changed (`changed_columns`, compared before redaction, so a changed password hash is listed
  although both values read `[REDACTED]`), the transaction id and a write sequence (exact order).
- **Attribution from the session, not from the client.** The trigger reads the transaction-local
  variables the API already sets for RLS: `app.current_user_id`, `app.current_organization_id`,
  `app.current_api_key_id`, `app.system_operation`, `app.actor_purpose` and `app.correlation_id`
  (`TenantTransactionService`; the pool checkout now stamps the request's correlation id too, so
  a write outside an explicit transaction still joins its request). `actor_kind` summarises it:
  `USER`, `API_KEY`, `SYSTEM` (a job under a system operation) or `UNATTRIBUTED` — a migration,
  the seed, a manual SQL session, or a code path that skipped its context, which is itself a
  finding. The trigger is `SECURITY INVOKER`, so `database_role` is the role that really wrote the
  row; `login_role`, `application_name` and `client_address` identify the connection.
- **One redaction policy for both trails.** The trigger SQL is generated from the TypeScript
  constants the HTTP trail uses (`src/common/audit/audit-data-policy.ts`): secret columns →
  `[REDACTED]`, email columns → first character + domain, other personal data → `[PII]`, any value
  over 16 KiB → `{ truncated, originalBytes }`. Secret columns are declared per table
  (`DATA_CHANGE_SECRET_COLUMNS`); any column whose name looks like secret material must be
  classified one way or the other, or `db:apply-security` (live catalog) and the unit suite
  (Prisma schema) fail.
- **Capture is the default; exemptions are declared.** `DATA_CHANGE_CAPTURE_EXEMPTIONS` lists the
  17 tables left out, each with its reason: the trail itself, the other append-only audit trails
  (their rows already are records of captured actions), log sinks, telemetry and messaging / cache
  plumbing (outbox, inbox, idempotency). A table created by a later migration is captured on the
  next apply.
- **Tamper resistance.** `data_change_logs` accepts INSERT only while a trigger runs
  (`pg_trigger_depth() > 0`, FORCE RLS); `app_runtime` cannot create functions or triggers, so it
  cannot forge or pre-write a record. UPDATE / DELETE are withheld from `app_runtime`; SELECT is
  bypass-only.
- **One audit log, two stores (decided 2026-10-14).** The admin panel has ONE audit page
  (`/audit-logs`). It reads `GET /admin/audit-trail`: a single timeline (`UNION ALL` of both
  stores) whose entries are either a `REQUEST` — an HTTP request with how many rows it changed and
  in which tables — or a `BACKGROUND` entry — database writes no request made (a job, scheduler,
  CLI, the seed or manual SQL), grouped per correlation id (one job, one seed run), and per
  database transaction when there is none (one manual statement, one migration). Clicking a request opens its record with a "Database changes" list; clicking a
  background entry opens the row change, with the job's other changes. A row change's own page is
  `/audit-logs/changes/[id]`. Filters: source, request-only ones (outcome, method, credential,
  device, address class — they leave only requests), "attributed to" (leaves only background
  writes), and actor / organization / correlation id / table + row (a row's whole history). The
  timeline sorts by time only. The stores stay separate on purpose: a request and a row change
  have different shapes, one request makes many changes, and they are written at different
  moments (the trigger inside the transaction, the HTTP row after the response) — merging them
  into one table would leave most columns empty and couple the two write paths.
- **APIs.** `GET /admin/audit-trail` (the timeline), `GET /admin/audit-logs/:id` (a request) and
  `GET /admin/data-changes` / `:id` (a request's or job's changes; one change) — all admin-panel
  access + `LIST` / `READ AUDIT_LOG`, under `audit.trail.read` / `audit.http_request.read` /
  `audit.data_change.read`; every read is itself recorded as a sensitive read.
- **Seed.** Fixture writes are recorded as `UNATTRIBUTED` under `application_name = prisma-seed`
  — the truth — and every seed connection carries one `seed-run-<uuid>` correlation id, so a whole
  run is ONE audit-log entry. The seed writes that reproduce a seeded request (the POS till's `last_seen_at`, the
  customer's profile edit) run under that request's session variables
  (`prisma/seed/attributed-session.ts`), so their records join it like live ones.

- **Connections say who they are.** The API's request pool connects as `application_name = api`,
  its system pool (`SystemPrismaService`, no RLS context) as `api-system`; the seed as
  `prisma-seed`. A write recorded without context therefore still names the pool that made it.
- **What the trail exposed on day one.** The API's boot sync of the PLATFORM capability catalog
  ran on the context-free system pool and re-wrote every row on every start (~50 unattributed
  UPDATEs per boot). It now runs `convergePlatformCapabilities` — the reference-data loader's
  diff-only writer — under the `authorization.capability_catalog.sync` system operation: an
  up-to-date database records nothing.

## Consequences

- **Every write costs one more INSERT in its own transaction**, plus `to_jsonb` of the row. Bulk
  loads double their write volume (a full seed records ~200k changes, ~160 MB locally, mostly geo
  reference data). The table grows with total write traffic; like `audit_logs` it is kept forever
  (ADR 025's retention decision) — partition by `occurred_at` or archive before it hurts.
- The timeline groups background changes and anti-joins them against `audit_logs` on every page
  (~175 ms per count over ~225k changes locally). Past a few million change rows, narrow by time
  by default or maintain the grouping (a per-job summary table) instead of computing it per read.
- Six btree indexes serve the viewer (`correlation_id`, `table_name + row_id`, actor,
  organization, actor kind, transaction, time); identifier filters compare exactly so they use them.
- A role that writes a captured table needs INSERT on `data_change_logs`. `app_runtime` has it;
  the analytics consumer writes only exempt tables. A role without it fails its write — the
  system fails closed rather than writing unrecorded.
- The impersonator is not a session variable: a change made under impersonation is attributed to
  the impersonated user, and the SuperAdmin behind it is on the HTTP audit row with the same
  correlation id (the viewer links the two).
- Disabling a trigger needs table ownership (a deployment credential, not the application's), and
  `db:apply-security` re-installs and verifies every trigger on each run.

## References

- `apps/api/prisma/rls/data-change-capture.ts` — manifest (exemptions, secret / non-secret columns) and the generated SQL
- `apps/api/scripts/apply-rls.ts` — installs and verifies the triggers against the live catalog
- `apps/api/prisma/rls.sql` (`data_change_logs_*` policies), `prisma/rls/withheld-privileges.ts`
- `apps/api/src/modules/audit-logs/` — the read side; `packages/shared/src/schemas/domain/platform/data-change-log.ts` — its contract
- `apps/api/src/modules/audit-logs/repositories/audit-trail.repository.ts` — the timeline query
- `apps/admin/app/(panel)/audit-logs/` (the one audit page, `changes/[id]`), `apps/admin/components/audit-logs/`
- ADR 012 (system operations), ADR 017 (request context), ADR 025 (HTTP audit log)
