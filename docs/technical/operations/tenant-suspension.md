---
title: "Runbook: Tenant Suspension"
tags: ["operations", "tenancy", "runbook", "incident"]
description: "Suspending, restricting, reactivating and deleting a tenant, and what each lifecycle state allows."
author: "Platform Team"
lastUpdated: 1792627200000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 7
---

# Runbook: Tenant Suspension

The lifecycle state is checked at tenant resolution on **every request, in both modes** (D8, D25), including a default tenant suspended after boot (ST-004). There is no cache to flush.

| State | Ordinary tenant routes | `@TenantLifecycleRoute()` routes (the tenant status read `GET /tenants/:tenantSlug/context` and KYB submission `…/kyb`) |
| --- | --- | --- |
| `ACTIVE` | allowed | allowed |
| `RESTRICTED` | allowed, with the narrower rules the code applies | allowed |
| `PROVISIONING`, `SUSPENDED`, `PENDING_DELETION` | 403 `TENANT_SUSPENDED` | allowed |
| `DELETED` | 404 | 404 |

A membership that is not `ACTIVE` gets 403 `MEMBERSHIP_INACTIVE`. (The plan's "leave tenant" lifecycle route does not exist yet; see the plan's completion report.)

## Suspend

1. Record the reason and the ticket in the tenant's audit trail.
2. Set the tenant to `SUSPENDED` from the admin app. Requests are refused from the next request onward (LIFE-001).
3. Revoke the tenant's API keys if the suspension concerns its integrations; POS checkout stops immediately.
4. Revoke any active support grants that are no longer needed.

## Reactivate

1. Resolve the cause and record it.
2. Set the tenant back to `ACTIVE`. Members regain access on their next request.

## Delete

1. A tenant in `PENDING_DELETION` keeps only the lifecycle routes during its grace period.
2. A `DELETED` tenant answers 404 on every route (LIFE-003). The erasure steps are in the [multi-tenancy operations runbook](./multi-tenancy-runbook.md#tenant-deletion).

## Never

Never disable RLS, drop FORCE, or grant `BYPASSRLS` to unblock a suspended tenant. Use the lifecycle state or a support grant.

## Related

- [Multi-tenancy operations runbook](./multi-tenancy-runbook.md)
- [Tenant onboarding](./tenant-onboarding.md)
