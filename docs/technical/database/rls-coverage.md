---
title: "RLS Coverage Matrix"
tags: ["database", "rls", "tenancy", "security"]
description: "Every tenant-scoped table: whether row-level security is enabled and forced, which commands a policy admits, and the automated test that proves its isolation."
author: "Platform Team"
lastUpdated: 1792627200000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 2
---

# RLS Coverage Matrix

One row per table that carries a `tenantId` (plus `Tenant` itself), read from the PostgreSQL catalog (`pg_class`, `pg_policies`) of a freshly migrated database with `pnpm db:apply-security` applied. Multi-tenancy plan MT-71.

- **RLS / Forced**: `relrowsecurity` / `relforcerowsecurity`. Every application table must have both, or the API refuses to boot (`RuntimeRoleProof`, D9) — so a `no` here cannot ship.
- **Read / Insert / Update / Delete**: whether a policy admits that command for the runtime role. A policy admits a system operation only through `app_rls_bypass_on('<table>')`, which lists the tables each operation may reach (`src/prisma/system-operation.registry.ts`).
- **Delete**: business rows are soft-deleted (`isDeleted`, `deletedAt`, `deletedBy`); a delete policy exists for cascades and seed cleanup, not for an API hard delete. Append-only logs have no update or delete policy and their `UPDATE`/`DELETE` privileges are withheld (`prisma/rls/withheld-privileges.ts`).
- **Proven by**: the test IDs of the multi-tenancy plan §8.3 — `DB-*` in `apps/api/test/rls/`, `MT-*` / `LOC-*` / `MACH-*` in `apps/api/test/tenancy/`. DB-001 (no tenant set → no rows, insert denied) and DB-005 (no setting survives on a pooled connection) cover every row.

| Table | RLS | Forced | Read | Insert | Update | Delete | Proven by |
|---|---|---|---|---|---|---|---|
| `AuditLog` | yes | yes | policy | policy | no policy (append-only) | no policy (never hard-deleted) | DB-006, DB-002, DB-003 |
| `AuthorizationAudit` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `AuthorizationPolicyDraft` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `AuthorizationPolicyVersion` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `DataChangeLog` | yes | yes | policy | policy | no policy (append-only) | no policy (never hard-deleted) | DB-006, DB-002, DB-003 |
| `Location` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-001, LOC-001…004, MT-007, MT-006 (composite FK) |
| `Membership` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-001, LOC-001…004, MT-007, MT-006 (composite FK) |
| `MembershipLocationScope` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-001, LOC-001…004, MT-007, MT-006 (composite FK) |
| `PolicyDefinition` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `ResourceAcl` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `Reward` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-002, DB-007, MACH-003, MT-006 (composite FK) |
| `RewardAuditLog` | yes | yes | policy | policy | no policy (append-only) | no policy (never hard-deleted) | DB-006, DB-002, DB-003 |
| `RewardImage` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-006 (composite FK) |
| `RewardLocationScope` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-006 (composite FK) |
| `RewardRedemption` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-002, DB-007, MACH-003, MT-006 (composite FK) |
| `RewardSale` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-002, DB-007, MACH-003, MT-006 (composite FK) |
| `Store` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-006 (composite FK) |
| `StoreMembership` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-006 (composite FK) |
| `StoredFile` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `SupportAccessGrant` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `Tenant` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantAccessRequest` | yes | yes | policy | policy | policy | no policy (never hard-deleted) | DB-006, DB-002, DB-003, DB-004 |
| `TenantApiKey` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-006 (composite FK) |
| `TenantAsset` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantAuditLog` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantEncryptionKey` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantInvitation` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantInvitationLocationScope` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-006 (composite FK) |
| `TenantKybFile` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantLifecycleEvent` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantMerchantProfile` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantPlacement` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantSlugHistory` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004 |
| `TenantTerminal` | yes | yes | policy | policy | policy | bypass / policy | DB-006, DB-002, DB-003, DB-004, MT-006 (composite FK) |

## Regenerating this table

Against a throwaway database after `pnpm db:deploy` (never the `.env` database):

```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       bool_or(p.cmd IN ('ALL', 'SELECT')) AS read,   bool_or(p.cmd IN ('ALL', 'INSERT')) AS insert,
       bool_or(p.cmd IN ('ALL', 'UPDATE')) AS update, bool_or(p.cmd IN ('ALL', 'DELETE')) AS delete
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND (c.relname = 'Tenant' OR EXISTS (SELECT 1 FROM information_schema.columns col
       WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenantId'))
GROUP BY 1, 2, 3 ORDER BY 1;
```

A new tenant table appears here in the same change that adds it (`rules/08-database-prisma.md`).

## Related

- [Tenancy and RLS](../authorization/tenancy-and-rls.md)
- [Separate database credentials](../operations/separate-database-credentials.md)
- [Multi-tenancy plan](../../architecture/multi-tenancy-plan.md)
