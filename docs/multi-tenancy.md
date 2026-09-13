---
title: "Multi-Tenancy Guide"
tags: ["tenancy", "organization", "rls", "cedar"]
description: "Developer guide for organization-scoped multi-tenancy — architecture, data flow, and operations."
author: "Backend Team"
lastUpdated: 1773000000000
order: 12
---

# Multi-Tenancy Guide

## Overview

This monorepo uses **Organization** as the canonical tenant boundary. See ADRs 008–013 for decisions.

| App | Tenancy |
| --- | --- |
| `apps/merchant` | Organization URL context (`/orgs/:orgSlug/...`) |
| `apps/web` | User-scoped (consumer) |
| `apps/admin` | Platform-global operations |

## Data flow

```
URL orgSlug → OrganizationContext → Cedar → withTenantTransaction → PostgreSQL RLS
```

## Key modules

| Module | Path |
| --- | --- |
| Organization context | `apps/api/src/modules/organization/` |
| Tenant transactions | `apps/api/src/prisma/tenant-transaction.service.ts` |
| Cedar control plane | `apps/api/src/modules/authorization-cedar/` |
| Support access (JIT) | `apps/api/src/modules/support-access/` |
| Shared schemas | `packages/shared/src/schemas/domain/organization.ts` |

## Local / fresh database

Organizations, merchant org links, memberships, and platform Cedar guardrails are created by the main seed:

```bash
pnpm --filter @workspace/api db:reset
```

## Cutover (live data)

1. `pnpm db:migrate` then `pnpm db:rls`
2. Dark-deploy API + merchant `/orgs/[orgSlug]` routes; canary internal tenants
3. Customer-visible cutover; retire `X-Merchant-Org-Id` after reconciliation

## Pilot limits

- ≤100 organizations, ≤10,000 users
- Single VPS deployment with best-effort recovery
- Remote encrypted backups with monthly restore drills
- No HIPAA/PHI at launch

## Related docs

- [Threat model](./security/multi-tenancy-threat-model.md)
- [Data classification](./security/data-classification-inventory.md)
- [Prisma RLS](./prisma.md#10-row-level-security)
- [Operations runbook](./operations/multi-tenancy-runbook.md)
