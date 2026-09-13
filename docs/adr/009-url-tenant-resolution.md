---
title: "ADR 009: URL-Derived Tenant Resolution"
tags: ["adr", "tenancy", "routing", "security"]
description: "Architecture decision record for resolving organization context from URL slugs with server-side membership verification."
author: "Backend Team"
lastUpdated: 1773000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 9
---

# ADR 009: URL-Derived Tenant Resolution

**Status:** Accepted  
**Date:** 2026-09-13  
**Deciders:** Backend Team

## Context

Merchant tenancy previously used `X-Merchant-Org-Id` headers and cookie fallbacks. Client-provided tenant identifiers are untrusted and enable confused-deputy and enumeration attacks.

## Decision

### Merchant portal routing

- Canonical path: `/orgs/:orgSlug/...`
- Server resolves `orgSlug` → immutable `organizationId` via `Organization` + `OrganizationSlugHistory`.
- Membership, organization lifecycle state, and Cedar policies are evaluated before opening a tenant unit of work.
- Missing slug, unauthorized access, and suspended organizations return a **uniform not-found** response (no metadata leakage).

### Slug semantics

- Authorization authority is always `organizationId` (UUID).
- `slug` is a mutable unique alias; renames preserve history for safe redirects.
- Slugs are not reusable by other tenants while reserved in history.

### Tenant switch

On organization switch:

1. Resolve URL tenant and verify membership.
2. Rebuild policy attributes and session context.
3. Invalidate tenant-scoped client/server caches.
4. Refresh route state.

### API contract

- Legacy `X-Merchant-Org-Id` is deprecated; dual-read during migration only.
- Each HTTP request has exactly one organization context. No mixed-tenant batch operations on user-facing endpoints.

## Consequences

### Positive

- Tenant context is visible, bookmarkable, and auditable in URLs.
- Eliminates fallback-to-first-membership behavior.

### Negative

- Requires merchant app route restructuring and redirect map from legacy paths.

## References

- `apps/merchant/app/orgs/[orgSlug]/` — URL tenant routes
- `apps/api/src/modules/organization/services/organization-context.service.ts`
- ADR 008
