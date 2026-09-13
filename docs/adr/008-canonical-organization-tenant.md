---
title: "ADR 008: Canonical Organization Tenant Boundary"
tags: ["adr", "tenancy", "organization", "security"]
description: "Architecture decision record for Organization as the canonical multi-tenant boundary with global identity and per-organization membership."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 8
---

# ADR 008: Canonical Organization Tenant Boundary

**Status:** Accepted  
**Date:** 2026-09-13  
**Deciders:** Backend Team

## Context

The repository previously had two parallel tenancy concepts:

1. Generic organization scaffolding (`TENANCY_ENABLED`, `x-organization-id`, `app.current_organization_id`) without an `Organization` table.
2. Merchant-org tenancy (`MerchantOrg`, `MerchantMember`, `app_merchant_member_of`) as the only live business isolation.

Production multi-tenancy requires one canonical tenant boundary, global user identity, and organization-scoped authorization and data.

## Decision

Adopt **Organization** as the canonical tenant:

- A global `User` may belong to many organizations through `OrganizationMembership`.
- Each organization owns one or more `OrganizationLocation` records.
- Merchant-specific profile data attaches to the organization (via `OrganizationMerchantProfile` and legacy `MerchantOrg.organizationId`).
- Authorization and RLS use immutable `organizationId` (UUID). URL slugs are mutable aliases resolved server-side.
- Consumer web (`apps/web`) remains user-scoped. Platform admin (`apps/admin`) remains global. Merchant portal (`apps/merchant`) operates inside organization context.

### Migration rule

Existing `MerchantOrg` rows map **one-to-one** to `Organization` + initial `OrganizationLocation`. No inferred merges by owner or domain.

## Consequences

### Positive

- Single tenancy vocabulary across API, database, caches, jobs, and UI.
- Global identity with per-organization roles and attributes.
- Clear path from pilot (≤100 tenants) to future placement directory and dedicated tiers.

### Negative

- Transitional dual paths (`merchantOrgId` headers vs URL org slug) until cutover completes.
- Every tenant-owned table must carry `organizationId` and composite constraints.

### Mitigations

- Expand → backfill → contract migration with reconciliation gates.
- Uniform not-found for missing/unauthorized organization slugs.
- Document pilot infrastructure limits separately from future scale targets.

## References

- `apps/api/prisma/schema.prisma` — Organization models
- `packages/shared/src/schemas/domain/organization/organization.ts` — shared contracts
- [Data classification inventory](../security/data-classification-inventory.md)
- [Threat model](../security/multi-tenancy-threat-model.md)
