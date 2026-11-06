---
title: "ADR 083: Generated Standard RLS Policies"
tags: ["adr", "rls", "security", "database", "tooling"]
description: "Policies that repeat across tables are generated from one per-table list; one-off policies stay hand-written SQL."
author: "Platform Team"
lastUpdated: 1793923200000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 83
---

# ADR 083: Generated Standard RLS Policies

## Status

Accepted and built (2026-11-06), phase 6 of the folder structure plan.

## Context

Row-level security was 250 hand-written policies in one large file and 17 fragments. Most repeated a few shapes, and the
same rule was spelled two ways ("owner OR bypass" and "bypass OR owner"). A new table meant copying SQL, and nothing
forced anyone to decide a table's rules.

## Decision

| Part | Decision |
|---|---|
| One folder | `prisma/rls.sql` became `prisma/rls/10-policies.sql`, in the same place in the apply order |
| The list | `prisma/rls/table-policies.ts` names every table and the standard rules it follows. An empty list means its policies are all one-offs |
| Generated SQL | `pnpm --filter @workspace/api db:generate-rls-policies` writes `prisma/rls/97-standard-policies.sql`, one spelling per rule |
| Order | That file runs after every hand-written fragment and before the runtime grants, so every helper exists |
| One-offs | 84 policies stay hand-written SQL |

The plan said the apply step would write the policies. They are written by a command into a checked-in file instead, the
pattern `00-system-operation-scopes.sql` already uses: a reviewer sees the real SQL in a diff, every tool that reads the
fragments keeps working, and a test fails when the file is stale.

## What guards it

| Check | Fails when |
|---|---|
| `table-policies.spec.ts` | A table is missing from the list, the SQL is stale, or a policy is both generated and hand-written |
| `pg_policies` comparison | Run for this change on fresh databases |

**The proof:** a fresh database before and after both had 276 policies, none missing or extra. The only differences are
12 owner policies whose `OR` terms swapped to the single spelling. The first comparison caught two real mistakes: API-key
policies had lost `TO app_runtime`, and a policy that a later fragment drops on purpose had come back.

## Consequences

| Good | Cost |
|---|---|
| A new table needs one line, and can't be forgotten | Two places to look: the list and the fragments |
| One spelling per rule | A policy that a fragment drops on purpose must not be listed, or it comes back: run the comparison for any change to the list |
