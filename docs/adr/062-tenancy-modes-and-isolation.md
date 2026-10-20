---
title: "ADR 062: Tenancy Modes Without Bypasses"
tags: ["adr", "tenancy", "rls", "security"]
description: "One codebase runs single- or multi-tenant; the tenant comes only from the route slug or a machine credential, and no staff, superadmin or system operation can bypass row-level security wholesale."
author: "Platform Team"
lastUpdated: 1792627200000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 62
---

# ADR 062: Tenancy Modes Without Bypasses

## Status

Accepted (2026-10-20). Supersedes [ADR 007](./007-tenancy-and-rls-bypass.md).

## Context

RewardHub runs multi-tenant, and the starter kit it lives in must still run single-tenant. Under ADR 007:

- Single-mode staff with admin access bypassed RLS on every table.
- A superadmin bypassed RLS on every request, including merchant routes.
- 64 of 88 system operations could touch any table.
- The tenant could arrive through a header, route params, query or body.
- Every test ran single-tenant, so multi-tenant faults went unnoticed.

## Decision

The full decision set (D1–D31) and the ordered tasks are in [the multi-tenancy plan](../architecture/multi-tenancy-plan.md). In short:

1. **Modes.** `TENANCY_ENABLED` is parsed once into `TenancyMode`.
   - **Single mode** uses the boot-verified `DEFAULT_TENANT_ID`.
   - **Multi mode** has no fallback.
   - Only the composition root reads the mode.
2. **Tenant sources.** User requests get the tenant from `/tenants/:tenantSlug` and machine requests from the credential. A `tenantId` in a request is rejected with 400. A resource of another tenant returns 404.
3. **No bypass.** Platform staff are ordinary users on tenant routes unless an approved `SupportAccessGrant` exists, and impersonation needs one too. Every system operation names its tables. The type cannot express "all tables".
4. **Database.** `FORCE ROW LEVEL SECURITY` is on every RLS table, with a boot and CI proof that `app_runtime` cannot bypass it. Context is set transaction-locally only. Composite `(tenantId, id)` foreign keys guard cross-tenant references.
5. **Vocabulary.** "Organization" becomes "tenant" in code, data, env and docs, through a second pre-release baseline reset. UI copy keeps the product words.
6. **Tests.** Full e2e runs in multi mode, plus a targeted single-mode suite and an RLS runtime-role suite on a shared two-tenant fixture.

## Consequences

- Admin-console endpoints must each declare `@PlatformOperation`, and a coverage test enforces it.
- Every read runs inside a transaction, which adds about one round trip and is to be measured (plan §12).
- Deployments must rename `DEFAULT_ORGANIZATION_ID` to `DEFAULT_TENANT_ID`. The old name fails boot with a message naming the new one.
- Once a shared database exists, renames need expand/contract. The baseline reset was a pre-release-only option.
