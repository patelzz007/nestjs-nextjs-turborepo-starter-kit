"use client";

import { resolveTenantHref, type AppPath } from "@/lib/routes";
import { useTenantSlug } from "@/contexts/tenancy/lib/org/use-tenant-slug";

/**
 * Browser href for an org-relative route (`TENANT_ROUTES.*`) in the active
 * tenant. Before the tenant is known it falls back to the
 * top-level entry page that resolves it server-side (see `resolveTenantHref`).
 */
export function useTenantPath(path: AppPath): AppPath {
	const tenantSlug = useTenantSlug();
	return resolveTenantHref(tenantSlug, path);
}
