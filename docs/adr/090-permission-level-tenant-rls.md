---
title: "ADR 090: Permission-Level Row-Level Security on Tenant Tables"
tags: ["adr", "rls", "security", "authorization", "multi-tenancy"]
description: "Amends ADR 067: tenant tables move from 'any member of the tenant' to the catalogue permission each command needs (role or live grant, at the store), with narrow own-row and merchant-shell exceptions."
author: "Platform Team"
category: "Architecture decisions"
date: 1794960000000
lastUpdated: 1794960000000
editedAt: 1794960000000
coverImage: "/images/covers/adr/090-permission-level-tenant-rls.webp"
order: 90
---

# ADR 090: Permission-Level Row-Level Security on Tenant Tables

## Status

Accepted and built (2026-11-18); the policies follow one verb per route since
[ADR 092](./092-route-verbs-and-per-record-decisions.md) and are evaluated once per statement since
[ADR 093](./093-per-statement-permission-checks.md). **Amends [ADR 067](./067-unified-authorization-model.md)**: "the database is the main
enforcer" now holds per permission, not only per tenant, on every tenant table a member touches. Policies are declared
in `apps/api/prisma/security/table-policies.ts` ([ADR 089](./089-generated-security-sql.md)).

## Context

Before this change only `Reward`, `RewardClaim`, `RewardRedemption` and `ResourceAcl` checked a permission in the
database. Every other tenant table admitted **any active member**: a Cashier's session could read the team, the
invitations, verification documents, payments, webhooks, API keys and terminals, and could even update or delete
tenant audit rows, memberships and webhook endpoints. Only the API's route checks stood in the way.

## Decision

Each tenant table admits each command through the catalogue permission (ADR 067's role or live grant, `app_has_permission`)
that the API's route checks, plus narrow, named exceptions:

| Group | Tables | Rule |
|---|---|---|
| System operations only (no member path exists) | `TenantEncryptionKey`, `TenantLifecycleEvent`, `TenantPlacement`, `TenantSlugHistory`, `SupportAccessGrant`, `TenantSuspensionAppeal`, `PaymentEvent`, `Broadcast` | `system` |
| Permission per command | `PaymentIntent`, `TenantKybFile`, `RewardAudienceMember`, `TenantInvitation(+LocationScope)`, `TenantTerminal`, `TenantApiKey`, `WebhookEndpoint`, `WebhookDelivery`, `Role` (tenant rows), `TenantCustomerBan`, `RewardAuditLog`, `RewardSale`, `TenantCustomer`, `RewardImage`, `RewardLocationScope` | `permissionRead/Insert/Update/Delete`, at the row's store where it has one |
| Reads stay member-level, writes need a permission | `Location`, `TenantAsset`, `TenantMerchantProfile` | The merchant shell (`GET /tenants/:slug/context`) shows them to every role |
| Own-row exceptions | `Membership` (read and rename one's own), `MembershipLocationScope` (one's own scopes), `TenantAuditLog` (append and read back one's own rows), `TenantAccessRequest` (the requester's own) | Confined to the tenant the session is bound to |

Where a route checks a different verb than the catalogue's natural one (terminals and keys check `api_key.create`,
payments `payment.create`, the team `member.update`, webhooks `webhook.update`), the table accepts both, so the
database never refuses what the API allows. Aligning the route verbs is a follow-up (owner question).

## What guards it

| Check | Proves |
|---|---|
| `apps/api/e2e/tenant-permission-tightening.e2e-spec.ts` | Owner vs Cashier for every group above, writes refused, audit rows only in one's own name, the grant path (a live grant shows sales; revoking it hides them) |
| `e2e/rls/runtime-role.e2e-spec.ts` DB-008 | A member of tenants A and B, on A's route, reaches none of B's rows (it caught an unconfined own-membership read during this change) |
| `pnpm db:security-snapshot --compare docs/history/security-baseline-2026-11-18.json` | Exactly which policies changed; `docs/history/security-after-tightening-2026-11-18.json` is the result |

## Consequences

| Good | Cost |
|---|---|
| A missed API check no longer exposes manager-level tenant data to a Cashier | A custom role that drops a permission loses the matching rows in the database too |
| Members can no longer rewrite or delete tenant audit rows, memberships or webhook endpoints | Two policies where a route's verb and the catalogue's differ, until the routes are aligned |
| Deferred: `StoredFile` / `FileVariant` (need per-category rules) and `Tenant` (the shell) stay member-level | — |
