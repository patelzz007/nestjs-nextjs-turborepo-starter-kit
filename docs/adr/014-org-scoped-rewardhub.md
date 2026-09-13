---
title: "ADR 014: Org-Scoped RewardHub"
tags: ["adr", "rewardhub", "organization", "tenancy", "cedar"]
description: "Architecture decision record for scoping RewardHub to Organization and removing MerchantOrg/MerchantMember."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 14
---

# ADR 014: Org-Scoped RewardHub

**Status:** Accepted  
**Date:** 2026-09-13  
**Deciders:** Backend Team  
**Supersedes:** MerchantOrg-centric RewardHub (pre-20260913120000 migration)

## Context

RewardHub originally used parallel tenancy primitives:

- `MerchantOrg`, `MerchantMember`, `MerchantInvite` for merchant portal access
- `merchantOrgId` on rewards, redemptions, API keys, KYB documents, and audit logs
- `merchant_role_capabilities` table for OWNER/CASHIER capability defaults
- Merchant API routes under `/merchant/*` with `X-Merchant-Org-Id` header

[ADR 008](./008-canonical-organization-tenant.md) and [ADR 013](./013-organization-location-ownership.md) established **Organization** as the canonical tenant with `OrganizationMembership`, `OrganizationLocation`, and `OrganizationMerchantProfile`. RewardHub remained on legacy merchant-org tables until this migration.

## Decision

### Tenant boundary

All RewardHub data is scoped to **`organizationId`** (UUID). URL slugs (`/orgs/:orgSlug/*`) are resolved server-side to the immutable organization id.

```
Organization
├── OrganizationMerchantProfile   (KYB, business metadata)
├── OrganizationMembership        (OWNER | ADMIN | CASHIER)
├── OrganizationLocation          (optional scope for terminals / API keys)
├── Reward                        (catalog is org-wide)
├── OrganizationApiKey            (organizationId required, locationId optional)
├── OrganizationTerminal
├── OrganizationKybDocument / OrganizationKybFile
└── RewardRedemption              (organizationId + optional locationId)
```

### Removed entities

| Removed | Replaced by |
|---------|-------------|
| `MerchantOrg` | `Organization` + `OrganizationMerchantProfile` |
| `MerchantMember` | `OrganizationMembership` |
| `MerchantInvite` | `OrganizationInvitation` |
| `MerchantRoleCapability` | Cedar **TENANT** policies seeded at org provisioning |
| `merchantOrgId` columns | `organizationId` |

### Authorization

- Portal access: active `organization_memberships` row for the authenticated user.
- Capability checks: Cedar evaluation against org-scoped TENANT policies (`seedRewardHubTenantPolicies`).
- Capability catalog (`merchant:*` slugs) remains in `capability_definitions` for UI/menu gating; role grants are **not** stored in SQL.

Default Cedar seed (on org provision / seed):

```cedar
permit(principal, action, resource) when { principal.role == "OWNER" || principal.role == "ADMIN" };
permit(principal, action, resource) when { principal.role == "CASHIER" };
```

### API routes

| Before | After |
|--------|-------|
| `GET /merchant/rewards` + `X-Merchant-Org-Id` | `GET /orgs/:orgSlug/rewards` |
| `POST /merchant/onboarding/*` | `POST /orgs/onboarding/*` |
| `GET /merchant/kyb` | `GET /orgs/:orgSlug/kyb` |
| Admin `merchantOrgId` | Admin `organizationId` |

Client router: `api.organizations.*` (replaces `api.merchant.*`).

### Merchant portal routing

Panel pages moved from `app/(panel)/*` to:

```
app/orgs/[orgSlug]/
├── dashboard
├── rewards/
├── redemptions/
├── analytics/
├── api-keys/
└── settings/
```

Tenant context cookie: **`organizationSlug`** only (no `merchantOrgId` cookie).

### Admin RewardHub

- List/detail KYB: `organizationId` path parameter.
- Admin invite flow: pre-provision org (`PROVISIONING`) + `OrganizationInvitation`; onboarding completion adds OWNER membership and activates org.

### Migration

SQL migration: `20260913120000_org_scoped_rewardhub`

1. Backfill `organization_id` on rewards, redemptions, audit logs, stored files from `merchant_orgs.organization_id`.
2. Create org-scoped replacement tables (`organization_api_keys`, `organization_terminals`, KYB tables, assets).
3. Drop legacy merchant-org tables and `merchant_role_capabilities`.
4. Re-apply RLS policies keyed on `organization_id` (`pnpm db:rls`).

## Consequences

### Positive

- Single tenancy model across platform and RewardHub.
- Multi-location merchants supported via `OrganizationLocation` without duplicate org rows.
- Authorization aligns with Cedar tenant policies; no duplicate capability grant table.
- Cleaner merchant URLs (`/orgs/brew-bean-kl/rewards`).

### Negative

- Breaking change for integrations using `X-Merchant-Org-Id` or `/merchant/*` routes.
- One-time migration complexity for environments with partial applies (resolve via `migrate diff` + `migrate resolve --applied`).
- E2E tests use `ORGANIZATION_SEED_IDS` and org-scoped API routes under `/orgs/:orgSlug/*`.

### Operational notes

After deploy:

```bash
cd apps/api
pnpm db:deploy    # or recover partial apply then pnpm db:rls
pnpm db:seed      # re-seed demo orgs + rewards
```

Seed demo org slugs: `brew-bean-kl`, `jonker-street-kitchen`.

## Related

- [ADR 008: Canonical Organization Tenant Boundary](./008-canonical-organization-tenant.md)
- [ADR 013: Organization and Location Ownership](./013-organization-location-ownership.md)
- [Multi-tenancy](../multi-tenancy.md)
- [Rewards platform PRD](../rewards-platform-prd.md)
