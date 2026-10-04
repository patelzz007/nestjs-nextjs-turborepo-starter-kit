---
title: "ADR 007: Tenancy Mode and RLS Bypass"
tags: ["adr", "rls", "tenancy", "security", "postgres"]
description: "Architecture decision record for configurable single-tenant vs multi-tenant RLS bypass and organization scoping."
author: "Backend Team"
lastUpdated: 1772000000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=630&fit=crop"
order: 7
---

# ADR 007: Tenancy Mode and RLS Bypass

**Status:** Accepted  
**Date:** 2026-08-27  
**Deciders:** Backend Team

## Context

Row Level Security (RLS) enforces data isolation in Postgres. The API sets session variables on every pool checkout (`app.current_user_id`, `app.rls_bypass`, `app.current_organization_id`) via `RlsPool` + `RlsInterceptor`.

Two deployment shapes exist:

1. **Single-tenant** — one organization, admin staff need broad visibility (template / internal tools).
2. **Multi-tenant** — many organizations; staff must not see all tenants; only platform super-admins operate globally.

Previously, any JWT with `hasAdminAccess` bypassed RLS. That is correct for single-tenant but unsafe for multi-tenant SaaS.

## Decision

Make **tenancy mode** and **RLS bypass** configurable via environment variables, resolved by `TenancyConfigService` and applied in `RlsInterceptor`.

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `TENANCY_ENABLED` | `false` | `true` = multi-tenant mode |
| `DEFAULT_ORGANIZATION_ID` | none (required in single-tenant mode) | Id (uuid) of the REAL organization a single-tenant deployment serves; verified to be a live row at boot (`DefaultOrganizationService`). Unused in multi-tenant mode |

### RLS bypass matrix

| Condition | Single-tenant (`TENANCY_ENABLED=false`) | Multi-tenant (`TENANCY_ENABLED=true`) |
| --- | --- | --- |
| `@RlsBypass()` on handler | Bypass | Bypass |
| No `request.user` (pre-auth, cron) | Bypass | Bypass |
| `isSuperAdmin` on JWT | Bypass | Bypass |
| `hasAdminAccess` on JWT | **Bypass** | **No bypass** — scoped RLS |
| Normal user | Scoped (`sub`) | Scoped (`sub` + org) |

### Organization scope

Every request gets `organizationId` in `RlsContext` (AsyncLocalStorage):

- **Single-tenant:** always `DEFAULT_ORGANIZATION_ID` (a real organization, verified at boot)
- **Multi-tenant:** only the organization `AuthorizationGuard` verified for the request; with none bound the RLS scope has no organization (`null`) and tenant-scoped access fails closed — there is no fallback organization

`RlsPool` sets `app.current_organization_id` on checkout. SQL helper: `app_current_organization_id()` in `prisma/rls.sql`.

Future table policies can use org id without changing the interceptor contract.

### Explicit bypass only

`@Public()` skips `AuthGuard` but **does not** bypass RLS. Cross-tenant public routes (signup, login, webhooks) must also use `@RlsBypass()`.

## Consequences

### Positive

- **One codebase** serves single-tenant templates and multi-tenant products — flip env, not fork logic.
- **Safer default for SaaS:** multi-tenant mode does not grant global DB access to every admin.
- **Forward-compatible:** org id is stamped on every connection before org-scoped policies land in SQL.

### Negative

- **Two mental models:** developers must know which mode an environment runs in.
- **Header discipline:** multi-tenant admin clients must send `x-organization-id` when switching org context (not yet wired in all UIs).

### Mitigations

- Document bypass matrix in [Prisma §10](../technical/security/database-security.md) and [Authorization](../technical/authorization/overview.md).
- `@RlsBypass()` remains the explicit escape hatch for intentional cross-tenant work.
- Super-admin identity (`isSuperAdmin`) still bypasses globally in both modes.

## Alternatives Considered

1. **Always bypass for `hasAdminAccess`** — simple for templates but wrong for multi-tenant production.
2. **Never bypass for staff** — breaks single-tenant admin UX; every query needs super-admin.
3. **Separate deployments per tenant** — operational cost; rejected for shared SaaS model.
4. **RLS bypass in JWT claim** — would require token rotation on tenancy mode changes; env-based is clearer.

## References

- `apps/api/src/config/tenancy.config.ts` — mode resolution
- `apps/api/src/common/interceptors/rls.interceptor.ts` — bypass rules
- `apps/api/src/prisma/rls-pool.ts` — session variable stamping
- `apps/api/prisma/rls.sql` — `app_current_organization_id()`
- [Prisma & RLS — §10](../technical/security/database-security.md)
