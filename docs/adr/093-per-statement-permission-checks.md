---
title: "ADR 093: Permission Checks Evaluated Once per Statement, Not per Row"
tags: ["adr", "rls", "performance", "security"]
description: "Row-level security asks for the caller's permitted tenants and stores once per statement (app_permitted_tenants / app_permitted_stores) instead of calling app_has_permission for every row; proved equivalent, and about 56× faster when counting 100 000 rows."
author: "Platform Team"
category: "Architecture decisions"
date: 1794960000000
lastUpdated: 1794960000000
editedAt: 1794960000000
coverImage: "/images/covers/adr/093-per-statement-permission-checks.webp"
order: 93
---

# ADR 093: Permission Checks Evaluated Once per Statement, Not per Row

## Status

Accepted and built (2026-11-18). Changes how [ADR 090](./090-permission-level-tenant-rls.md)'s policies are written;
what they allow is unchanged.

## Context

ADR 090's policies called `app_has_permission('ANALYTICS', 'READ', "tenantId", "locationId")`. The arguments are the
row's own columns, so PostgreSQL calls the function — a `SECURITY DEFINER` SQL function joining memberships, roles and
grants, which the planner cannot inline — **once for every row** a query touches. The new benchmark
(`pnpm --filter @workspace/api db:security-benchmark`, a throwaway database with 100 000 generated sales) measured it:

| Query | No RLS | Per-row check | Per-statement check |
|---|---|---|---|
| Count a tenant's 100 000 sales | 10 ms | 2 642 ms (×261) | 47 ms (×4.5) |
| Newest 50 sales | 0.6 ms | 6.4 ms | 5.0 ms |
| Count 10 000 rewards | 0.9 ms | 251 ms (×271) | 5.5 ms (×3.9) |

## Decision

The policies ask a question that does not depend on the row, once:

- `app_permitted_tenants(resource, action)` returns every tenant where the caller's role, or a live tenant-wide grant,
  gives `resource.action` (tenant-level records).
- `app_permitted_stores(resource, action)` returns `tenant|store` keys for every store the caller may act at, and
  `tenant|*` when the membership covers every store.

A policy writes `"tenantId" = ANY ((SELECT app_permitted_tenants('ANALYTICS', 'READ'))::text[])`. The `(SELECT …)` does
not reference the row, so PostgreSQL runs it once per statement (an InitPlan), and each row is only compared against an
array. The `::text[]` cast makes `ANY` compare against the returned array rather than read it as a subquery.
`generator/permission-check.ts` (`permitted(resource, action, tenant, store?)`) writes this for every reusable and
one-off rule. No policy passes a row's column to a permission function any more.

`app_has_permission` stays as the reference definition. `e2e/rls/permitted-scope-equivalence.e2e-spec.ts` compares
both forms over every fixture user, bound and unbound tenant, tenant, store (none, live, another tenant's, unknown) and
permission. It adds store-limited, tenant-wide, expired and deleted-store grants: 2 160 comparisons, all equal.

## Consequences

- Large tenant reads stay usable under RLS. `db:security-benchmark --max-overhead X` can turn the ratio into a budget.
- The two set functions must stay equivalent to `app_has_permission`; a change to one is a change to all three, and
  the equivalence test fails otherwise.
- The remaining overhead (about 4×) is the fixed cost of resolving the caller's scope once per statement.
