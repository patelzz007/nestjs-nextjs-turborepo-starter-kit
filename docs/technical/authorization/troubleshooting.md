---
title: "Authorization Troubleshooting & FAQ"
tags: ["authorization", "troubleshooting", "faq", "rls", "403"]
description: "Symptoms, causes and fixes for common authorization problems — unexpected 403s, missing menu items, RLS errors, reset deadlocks — plus answers to frequent design questions."
order: 27
author: "Platform Team"
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Authorization Troubleshooting & FAQ

> [!TIP]
> Your first tool is always `explain()` — see [recipes → debug a denial](./recipes.md#12-debug-why-was-i-denied).

---

## 1. "I get 403 but I should be allowed"

| Symptom | Likely cause | Fix |
|---|---|---|
| 403 on **every** request with an `x-organization-id` / `x-store-id` header | The user is not an active member of that organization / store (or the store is inactive / belongs to another org) | Check `organization_memberships` / `store_memberships`. The header is only accepted when proven. |
| 403 on a self-service route (change password, 2FA) | `@Authorize` with `resourceId` but no `self()`, or the caller is anonymous | Use `resourceId: self()` |
| 403 although the role has the permission | a `DENY` override or ACL `DENY` exists | `explain()` shows `source: "override"` or `"acl"` |
| 403 with an `ORGANIZATION` / `STORE` scoped role | no verified tenant, or the record's tenant attributes were not passed | send the tenant header; pass `resourceAttributes: { organizationId, storeId }` |
| 403 with an `OWN` scoped role on a list | `OWN` grants never satisfy collection-level checks | use `kernel.filter()` for lists; `OWN` applies per record |
| 403 on an organization member with no roles | membership is not permission | assign a role / store membership role |
| 403 from a policy | a DENY policy matched, or ALLOW policies exist and none matched | `explain()` shows `source: "policy"` with the policy id |
| Merchant cashier gets 403 creating a reward | expected: cashiers are read-only (`MERCHANT_ROLE_CAPABILITIES`) | use an `OWNER` / `ADMIN` account |
| Merchant `403 ORGANIZATION_ROLE_CAPABILITY_REQUIRED` on team / locations / KYB | the role lacks `merchant:manage_team` / `manage_locations` / `manage_verification` (KYB is owner-only, admins included) | use an account whose role holds it |
| Merchant `403 ORGANIZATION_ACTION_FORBIDDEN` although the role holds the capability | a tenant Cedar policy narrows it (or the organization has no published tenant policy) | check the organization's published policy versions |
| Merchant page shows "You don't have access to this page" | `guardOrgPage` denied it on the server: the role lacks the capability in `ORG_PAGE_RULES`, or the URL names an organization you do not belong to | expected; the sidebar hides such pages |
| Admin gets 403 assigning a role | subset rule: the admin does not hold every permission of that role, or they are editing themselves | ask a SuperAdmin, or grant the admin those permissions first |
| 403 uploading a store logo / KYB document | needs `merchant:manage_locations` (logo, banner — `OWNER` / `ADMIN`) or `merchant:manage_verification` (KYB — `OWNER`) | check the membership role in `MERCHANT_ROLE_CAPABILITIES` |

## 2. "A menu item / button is missing"

| Cause | Fix |
|---|---|
| The page's requirement in `ADMIN_MENU_AUTHORIZATION` is not held | check `GET /auth/permissions` in the browser network tab |
| Permissions changed recently | the list refreshes on window focus and every 60 s; reload to force |
| The item has a `featureFlag` that is not enabled | enable the flag (`lib/feature-flags.ts`) |
| Merchant: the membership role lacks the capability | see `MERCHANT_ROLE_CAPABILITIES` |
| You forgot the provider in a new app / layout | without a provider every check denies |

## 3. "RLS" errors

| Symptom | Cause | Fix |
|---|---|---|
| `new row violates row-level security policy for table "X"` | the code runs under a user scope but the table needs bypass (e.g. `outbox_events`), or the row's tenant does not match | run the write inside a named system operation, or pass the right tenant |
| A query returns nothing in a background job | no RLS scope → the fail-closed anonymous context | wrap the job in `runWithSystemRlsContext("queue.<your-job>", …)` after registering that name |
| `System operation not allowlisted: …` | new system-operation name not registered | add it to `src/prisma/system-operation.registry.ts` |
| `Tenant database access requires organization context` | a scoped user query with no organization in multi-tenant mode | send `x-organization-id`, or use `TenantTransactionService.withTenantTransaction` |

## 4. Reset / seed problems

| Symptom | Cause | Fix |
|---|---|---|
| `Error: deadlock detected` during `db:apply-security` | another connection (running API, workers, Prisma Studio) touches the same tables | stop the API; the script now retries automatically with a lock timeout |
| New permissions / roles missing after seeding | the seed read an old `@workspace/shared` build | `pnpm build:shared`, then seed again |
| Seed fails with "Seed data missing …" / "Seed role … is missing" | seeds ran out of order | run the full `pnpm db:seed` after `db:reset` |
| Logins return `429` in e2e tests | the Redis throttler remembers earlier runs | wait a few minutes |

---

## 5. FAQ

**Why is there both `Store` and `OrganizationLocation`?**
Locations already carried terminals, rewards and API keys. Each location got a `Store` twin
(kept in sync automatically) so staff authorization could follow the spec without a risky
rename. See [tenancy](./tenancy-and-rls.md#1-the-tenant-model).

**Can I create a role without deploying?**
Yes. Roles, role permissions, store memberships and overrides are data (spec §49). Only new
**permission types** (a new action × resource × scope) need code, because real code must
implement them (spec §119, §120).

**Do I need a new RLS policy for a new role?**
No — never (spec §50).

**Why does a SuperAdmin see everything in the UI?**
The backend bypasses checks for them, so `/auth/permissions` returns every platform
capability; otherwise the UI would hide things they are actually allowed to use.

**Why did my logout stop being "bypass"?**
Refresh / logout now run scoped to the token's user. Anything they must write to
infrastructure tables goes through named system operations (e.g. `outbox.enqueue`).

**What is `SystemPrismaService` for?**
A second database client that ignores RLS, used only for startup permission sync, the
capability catalog sync and authorization audit writes. Feature code must not use it — see
[tenancy → the two database clients](./tenancy-and-rls.md#7-the-two-database-clients).

**Where did the resource generator (`pnpm app`, `packages/cli`) go?**
It was removed. Products and sample categories are ordinary code now. See the
[change log](./changelog.md#8-resource-generator-removed).
