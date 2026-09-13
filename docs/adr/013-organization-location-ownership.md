---
title: "ADR 013: Organization and Location Ownership"
tags: ["adr", "tenancy", "organization", "location"]
description: "Architecture decision record for organization-level membership with optional location scope."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 13
---

# ADR 013: Organization and Location Ownership

**Status:** Accepted  
**Date:** 2026-09-13  
**Deciders:** Backend Team

## Context

`MerchantOrg` conflated legal organization and store location. The product requires one organization with many locations, location-scoped access, and merchant profile data at the organization level.

## Decision

### Entity model

```
Organization (tenant boundary)
├── OrganizationLocation (store/site)
├── OrganizationMerchantProfile (KYB, branding, merchant metadata)
├── OrganizationMembership (user ↔ org, role, status, attributes)
│   └── OrganizationMembershipLocationScope (all | selected location IDs)
└── Tenant-owned resources (rewards, files, keys, …) → organizationId (+ optional locationId)
```

### Access defaults

- Membership is organization-level.
- Location scope: `ALL_LOCATIONS` or explicit `SELECTED` location IDs.
- New locations: only members with `ALL_LOCATIONS` scope and protected owners gain access automatically.

### MerchantOrg transition

- `MerchantOrg.organizationId` links legacy rows to canonical organizations.
- Initial migration: 1 `MerchantOrg` → 1 `Organization` + 1 primary `OrganizationLocation`.
- Rewards and related tables gain `organizationId`; `merchantOrgId` retained until contract phase.

### Catalog

`Product` and `SampleCategory` remain **global platform catalog** (read-only to tenants). Tenant-owned data references catalog items by ID without copying.

## Consequences

### Positive

- Supports multi-location merchants without duplicate organizations.
- Clear Cedar attributes: `organization`, `membership`, `location`, `resource`.

### Negative

- Migration must backfill `organizationId` on all merchant-domain tables.

## References

- ADR 008, ADR 009
- `docs/security/data-classification-inventory.md`
