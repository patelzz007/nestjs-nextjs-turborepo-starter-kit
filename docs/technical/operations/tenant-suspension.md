---
title: "Runbook: Tenant Suspension"
tags: ["operations", "tenancy", "runbook", "incident"]
description: "Suspending, banning, restricting, reactivating and deleting a tenant, and what each lifecycle state allows."
author: "Platform Team"
lastUpdated: 1792627200000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 7
---

# Runbook: Tenant Suspension

The lifecycle state is checked at tenant resolution on **every request, in both modes** (D8, D25), including a default tenant suspended after boot (ST-004). There is no cache to flush.

| State | Ordinary tenant routes | `@TenantLifecycleRoute()` routes (`…/context`, `…/lifecycle`, appeal, reactivate, leave) | Rewards in the marketplace |
| --- | --- | --- | --- |
| `ACTIVE` | allowed | allowed | listed, claimable |
| `RESTRICTED` | allowed, with the narrower rules the code applies | allowed | hidden |
| `SUSPENDED` | 403 `TENANT_SUSPENDED` | allowed; the owner may appeal | hidden |
| `BANNED` | 403 `TENANT_BANNED` | allowed, but appeal and reactivate are refused (only reading the status and leaving work) | hidden |
| `PROVISIONING`, `PENDING_DELETION` | 403 `TENANT_NOT_ACTIVE` | allowed | hidden |
| `DELETED` | 404 | 404 | hidden |

A membership that is not `ACTIVE` gets 403 `MEMBERSHIP_INACTIVE`, except on the leave route. A
merchant's rewards are listed and claimable only while it is `ACTIVE`: the marketplace and the
reward page hide the others, and a claim answers 404 `REWARD_NOT_FOUND`. Tills of a merchant that
is not `ACTIVE` are refused at the API key.

## Suspend

1. Record the reason and the ticket in the tenant's audit trail.
2. Set the tenant to `SUSPENDED` from the admin app. Requests are refused from the next request onward (LIFE-001).
3. Revoke the tenant's API keys if the suspension concerns its integrations; POS checkout stops immediately.
4. Revoke any active support grants that are no longer needed.

## Reactivate

1. Resolve the cause and record it.
2. Set the tenant back to `ACTIVE`. Members regain access on their next request.

## Ban (super admin)

A ban is for a merchant that must not come back through an appeal (fraud confirmed, counterfeit
vouchers). It can be applied to an `ACTIVE`, `RESTRICTED` or `SUSPENDED` tenant.

1. Record the reason; it is stored on the lifecycle event and in the tenant audit row (`tenant.banned`).
2. Open the merchant in the admin app and use **Ban merchant** (only a super admin sees it;
   `POST /admin/merchants/:tenantId/ban` is `@SuperAdminOnly()`). A pending suspension appeal is
   closed in the same transaction ("Closed: the platform banned this business.").
3. From the next request, the merchant's members see a "banned" screen; non-owners can leave.
   Its rewards leave the marketplace and its tills stop working.
4. **Lift ban** (`POST /admin/merchants/:tenantId/unban`, with a reason) makes it `ACTIVE` again.

## Delete

1. A tenant in `PENDING_DELETION` keeps only the lifecycle routes during its grace period.
2. A `DELETED` tenant answers 404 on every route (LIFE-003). The erasure steps are in the [multi-tenancy operations runbook](./multi-tenancy-runbook.md#tenant-deletion).

## Never

Never disable RLS, drop FORCE, or grant `BYPASSRLS` to unblock a suspended tenant. Use the lifecycle state or a support grant.

## Related

- [Multi-tenancy operations runbook](./multi-tenancy-runbook.md)
- [Tenant onboarding](./tenant-onboarding.md)
