---
title: "Runbook: Switching Single ↔ Multi-Tenant"
tags: ["operations", "tenancy", "runbook"]
description: "How to move a deployment between single-tenant and multi-tenant mode, and what changes for clients."
author: "Platform Team"
lastUpdated: 1792627200000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 5
---

# Runbook: Switching Single ↔ Multi-Tenant

One codebase runs both modes (multi-tenancy plan D1, D12). The mode is read once, from `TENANCY_ENABLED`, into `TenancyMode` and picks the tenant source at the composition root. Nothing else branches on it. Row-level security applies in both modes; no mode bypasses it.

| | Single (`TENANCY_ENABLED=false`) | Multi (`TENANCY_ENABLED=true`, RewardHub) |
| --- | --- | --- |
| User requests | Always the tenant `DEFAULT_TENANT_ID` names. A slug of another tenant gets 404. | The tenant of `/tenants/:tenantSlug` (slug or slug history). No slug, or an unknown one, gets 404. |
| Machine requests (POS, API keys) | The credential's tenant and store. A slug or `tenantId` gets 400. | Same. |
| `DEFAULT_TENANT_ID` | Required, verified at boot (must be a live, non-deleted tenant). | Must be **unset**: boot fails if it is set. |
| New tenants (merchant invites) | Refused: `POST /admin/invites` and `POST /admin/tenants/invites` answer 403 `TENANT_PROVISIONING_DISABLED`, and the admin panel hides **Merchants → Invites** (`GET /admin/invites/availability` answers `available: false`). The seeded tenant signs in and completes its own profile. | Allowed: an invite provisions the merchant's tenant. |

## Single → multi

1. Confirm every client calls tenant routes with the tenant's slug (`/tenants/:tenantSlug/…`). Clients that relied on the default tenant stop working.
2. Confirm integration API keys call the integration API (`/integration/rewards`, `/integration/analytics`, `/integration/redemptions`) and tills call `/integration/terminals/pair` and `/integration/redemptions/validate` / `/checkout`, never a `/tenants/:tenantSlug` path. Tenant routes serve signed-in members only (a key there is not authenticated, 401), and a key that also names a tenant (a slug or tenant id in the path, query or body) is refused with 400 `TENANT_SELECTOR_NOT_ALLOWED`.
3. Set `TENANCY_ENABLED=true` and **remove** `DEFAULT_TENANT_ID`.
4. Deploy. Boot runs the runtime-role proof (`app_runtime` cannot bypass RLS, every table forces it) and refuses to start if it fails.
5. Smoke-test: a member reads their tenant (MT-001), a non-member gets 404 (MT-004), and `GET /health/ready` reports `tenant-isolation` healthy.

## Multi → single

1. Choose the tenant the deployment will serve and note its id. It must be live and not deleted.
2. Set `TENANCY_ENABLED=false` and `DEFAULT_TENANT_ID=<that id>`.
3. Deploy. Boot verifies the tenant (`tenancy.default_tenant.verify`) and refuses to start when it is missing or deleted (ST-003).
4. Every other tenant's data stays in the database but is unreachable: requests resolve only the default tenant, and RLS hides the rest.
5. No new tenant can be created: merchant invites are refused (403 `TENANT_PROVISIONING_DISABLED`) and the admin panel no longer shows the invite page. Pending invites sent before the switch name tenants other than the default one, so they lead nowhere.

## Rollback

Switch the variables back and redeploy. No data migration is involved in either direction. If the readiness probe reports `tenant-isolation` unhealthy, **do not** work around it by granting `BYPASSRLS` or disabling FORCE: fix the role or the table, then redeploy (see [separate database credentials](./separate-database-credentials.md)).

## Related

- [Tenancy and RLS](../authorization/tenancy-and-rls.md)
- [ADR 062](../../adr/062-tenancy-modes-and-isolation.md)
