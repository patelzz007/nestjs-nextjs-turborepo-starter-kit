---
title: "ADR 078: Migration governance and audit-record retention"
tags: ["adr", "database", "migrations", "audit", "retention", "security"]
description: "Prisma-generated migrations are the default, not an absolute rule: reviewed hand-written SQL is allowed for PostgreSQL features Prisma can't express. Audit tables stay ordinary, append-only tables; a privileged, batched, legal-hold-aware retention process removes records past the ten-year retention; partitioning comes later, when volume justifies it."
author: "Platform Team"
lastUpdated: 1793664000000
coverImage: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=1200&h=630"
order: 78
---

# ADR 078: Migration governance and audit-record retention

## Status

Accepted (2026-11-03). The owner's answer to Q8 (`docs/history/PROGRESS-2026-11-02.md`): **Option E now, with a path to
Option C**. Enhancement 2.1. Amends the "migrations are generated only" convention everywhere it is stated.

## Context

Q8 asked whether `AuditLog` and `DataChangeLog` should be partitioned by month (which Prisma can't generate)
or kept as plain tables with a purge job. The question mixed three separate concerns:

| Concern | The question |
|---|---|
| Data lifecycle | How audit records are kept, and eventually removed |
| Physical storage | How PostgreSQL stores and organises them |
| Migration governance | How schema changes are introduced and maintained |

They don't need the same mechanism. And "generated only" had become stricter than intended: the repository
already keeps reviewed, hand-written SQL for what Prisma can't express (RLS policies, triggers and
`SECURITY DEFINER` functions in `apps/api/prisma/rls/`, applied by `db:apply-security`).

## Decision

### 1. Migration governance

**Prisma-generated migrations are the default, not an absolute restriction.** Edit `schema.prisma`, run
`db:migrate:create` (or `prisma migrate diff` when the shell can't answer Prisma's prompt), check drift.
Never hand-edit a generated migration.

A **reviewed, hand-written SQL migration** is allowed only for PostgreSQL-native capabilities the Prisma
schema can't represent adequately:

1. Partitioning.
2. Triggers and stored functions.
3. Row-level security policies.
4. Extensions.
5. Indexes and constraints Prisma doesn't support.
6. Database-level performance work.
7. Other native capabilities of the same kind.

Every such exception must:

| Requirement | Meaning |
|---|---|
| Justified | The migration (or its SQL file) starts with why Prisma can't express it |
| Version-controlled | In `prisma/migrations/` (schema shape) or `prisma/rls/` (policies, functions, grants: re-applied idempotently by `db:apply-security`) |
| Idempotent where it can be | `CREATE OR REPLACE`, `IF NOT EXISTS`, guarded `DO` blocks |
| Tested on a clean database | CI's `e2e:deploy` and `e2e:drift` jobs build every database from scratch |
| Compatible with Prisma's history | `db:check-drift` stays clean: the generated part and the hand-written part never fight over the same object |
| Recoverable | A "Rollback / recovery" note in the file: how to undo it, or why it is forward-only |
| Documented for future agents | Listed in `docs/technical/database.md` → "Hand-written SQL" |

Database integrity and tenant isolation are never traded away to keep a migration generated.

### 2. Audit storage: ordinary tables now, partitioning when it is justified

`AuditLog` and `DataChangeLog` stay ordinary PostgreSQL tables. **No partitioning yet**: a starter kit must be
production-capable without making every product inherit storage complexity it may never need (500 audit rows
a day and 500,000 a day don't need the same design). The architecture keeps the path open:

- Retention runs behind an interface (`AuditRetentionPort`), so moving from row deletion to dropping
  partitions changes the adapter, not the callers.
- Records are append-only and immutable, with indexed timestamps (`occurredAt` on both tables).
- **When** volume, retention workload or query performance measurably justifies it, partitioning is
  introduced by a reviewed SQL migration under §1: native monthly range partitions on `occurredAt`, with
  automated partition lifecycle, evaluating `pg_partman` before building partition management by hand.
  That migration must account for PostgreSQL's restrictions: a unique constraint (the primary key) must
  include the partition key, so `id` becomes `(id, occurredAt)` or relies on the UUIDv7 generator for
  global uniqueness; foreign keys into partitioned tables and Prisma relations need review; and a monthly
  partition holds many tenants' rows, so it can be dropped only when **every** row in it is past retention
  and none is under legal hold.

### 3. Retention: a privileged, dedicated process

**Append-only means ordinary application access can never change history; it doesn't mean forever.** The
guarantee is enforced by **database permissions**, not by coding conventions:

| Operation | The application role (`app_runtime`) | The retention process |
|---|---|---|
| INSERT | Allowed | Not needed |
| UPDATE | **Refused** by the database (withheld privilege) | Refused |
| DELETE | **Refused** by the database (withheld privilege) | Only through the purge function, under its own operation |

How it works:

| Piece | What |
|---|---|
| A dedicated role | `app_retention` (`NOLOGIN`): the only role with DELETE on `AuditLog`, `DataChangeLog` and `DataChangeGroup`, through RLS policies written for it alone |
| One way in | `public.app_purge_audit_batch(target, cutoff, batch_size, dry_run)`, `SECURITY DEFINER` owned by `app_retention`, pinned `search_path`. `app_runtime` may only EXECUTE it. It refuses unless the session runs the `maintenance.audit_record_retention` system operation; it refuses a cutoff newer than the retention (ten years, `RECORD_RETENTION_DAYS`) **inside the database**, so even a compromised application can't purge recent history; it caps the batch size; and it skips every row under an active legal hold |
| Legal holds | `AuditLegalHold`: a tenant, a user, or both, with a reason and who placed it. While active, matching rows are never purged, whatever their age. Placing and lifting holds is a platform action, audited |
| Batched | The job deletes in batches (default 5,000) until a batch comes back short, so no single transaction holds millions of rows. Autovacuum reclaims the space; the operations console watches table size |
| Dry run | The same function with `dry_run = true` counts what would go and what is held back, and deletes nothing |
| Recorded | Every run (dry or real) writes a `RetentionRun` row (append-only): table, cutoff, counts deleted and held back, start, end, outcome. The summary is also logged |
| Idempotent | A rerun after a crash simply continues: the cutoff is recomputed, and already-deleted rows are gone |
| Scheduled | A weekly cron (`AuditRecordRetentionCron`), through the system-command dispatcher like every other maintenance job |

**Tenancy.** The platform has one retention for everything (ten years, Q7), so the policy is never taken
from a tenant, a request or any caller-supplied timestamp: the cutoff is computed from the clock and checked
again by the database. Legal holds can name a tenant, which is how one organisation's records are kept longer.
Per-tenant retention periods are not supported. If they are ever needed, they come with partitioning, where
a partition can only be dropped once every tenant in it is past its own retention.

## Consequences

- `rules/08`, `docs/technical/database.md`, the agent memory and this ADR state the same migration rule.
- Removing old audit rows needs no change to the application role's privileges, and can't be done by it.
- The first real purge happens ten years after the first records. Until then the job runs, finds nothing,
  and records that it found nothing: the run log is the evidence the process works.
- Partitioning stays a reviewed, deliberate step with its constraints written down here.
