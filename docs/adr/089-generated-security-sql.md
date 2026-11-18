---
title: "ADR 089: All Security SQL Generated From TypeScript"
tags: ["adr", "rls", "security", "database", "tooling"]
description: "Every policy, role, grant, trigger and helper function is declared in TypeScript under prisma/security and generated into five committed SQL files; nobody writes or edits prisma/rls by hand."
author: "Platform Team"
category: "Architecture decisions"
date: 1794960000000
lastUpdated: 1794960000000
editedAt: 1794960000000
coverImage: "/images/covers/adr/089-generated-security-sql.webp"
order: 89
---

# ADR 089: All Security SQL Generated From TypeScript

## Status

Accepted and built (2026-11-18). Supersedes the "one-offs stay hand-written SQL" part of
[ADR 083](./083-generated-standard-rls-policies.md); everything else in ADR 083 still holds.

## Context

After ADR 083, 167 policies were generated but about 90 policies, 26 functions, 3 triggers, 6 roles and every grant were
still hand-written across 21 numbered `.sql` files. Changing access meant knowing which file, which order and which SQL
idiom — hard to do without help, and easy to get subtly wrong.

## Decision

| Part | Decision |
|---|---|
| Source | TypeScript in `apps/api/prisma/security/`: `table-policies.ts` (every table's policies), `roles.ts` (roles and grants), `triggers.ts`, `withheld-privileges.ts`, `generator/functions/` (function building blocks) and the system-operation registry |
| Output | Five generated, committed files in `apps/api/prisma/rls/`: `01-roles`, `02-functions`, `03-triggers`, `04-policies`, `05-grants` |
| Policies | Each policy names a reusable rule (`generator/policy-rules.ts`) or a one-off rule tied to one table (`generator/table-specific-rules.ts`). No SQL in a table's entry |
| Functions | The SQL bodies live once, in `generator/functions/`, written with the `sql` tag so editors colour them |
| Commands | `db:generate-security` writes the files, `db:check-security` fails when they are stale, `db:apply-security` applies the committed files, `db:security` does generate + apply for a developer |
| Cleanup | `04-policies.sql` drops any policy on a listed table that the list no longer declares, so a rename never leaves the old policy behind |
| Proof | `db:security-snapshot` builds a fresh database in a throwaway PostgreSQL container and records every policy, function, trigger, role, membership, privilege and RLS flag |

`db:apply-security` applies the committed files rather than regenerating: rendering needs the generated Prisma client,
which a deploy step may not have, and a deploy should run exactly the SQL that was reviewed.

## What guards it

| Check | Fails when |
|---|---|
| `generated-sql.spec.ts`, `db:check-security` (CI) | A committed file differs from what the TypeScript generates |
| `apply-plan.ts` | `prisma/rls/` holds a `.sql` file the generator does not write, or a helper or role is used before it exists |
| `table-policies.spec.ts` | A table is not listed, a rule lacks an input it needs, a one-off rule is used on another table |
| `db:security-snapshot --compare` | The database a change produces differs from a saved snapshot |

**The proof (2026-11-18):** a fresh database built from the generated files, and one upgraded from the old hand-written
files, both matched the baseline snapshot exactly: 297 policies, 110 functions, 367 triggers, 7 roles, every privilege
and RLS flag. Baseline: `docs/history/security-baseline-2026-11-18.json`.

## Consequences

| Good | Cost |
|---|---|
| A new table is one entry in `table-policies.ts`; nobody writes SQL | A genuinely new kind of access is a change to the generator, reviewed once |
| Security changes show up as a readable SQL diff in review | SQL bodies of functions live inside TypeScript strings (coloured by the recommended editor extension) |
| Renamed or removed policies are cleaned up everywhere | Two places to read: the TypeScript (what) and the generated SQL (exactly how) |
