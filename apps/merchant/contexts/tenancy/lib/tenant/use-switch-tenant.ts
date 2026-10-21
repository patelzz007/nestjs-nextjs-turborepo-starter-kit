"use client";

import { useTenantSlug } from "@/contexts/tenancy/lib/tenant/use-tenant-slug";
import { tenantRoutes } from "@/lib/routes";
import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Tenant switcher action: the URL owns the active tenant, so switching is
 * a navigation to the other tenant's dashboard. Each tenant keeps
 * its own store choice (`tenantLocationId.<tenantSlug>`), so nothing is
 * cleared: the new tenant's server render prefetches with ITS stored
 * store, its tenant context mounts fresh (keyed by the slug), and
 * `TenantBootstrap` records it as the last opened tenant.
 */
export function useSwitchTenant(): (tenantSlug: string) => void {
	const router = useRouter();
	const currentTenantSlug = useTenantSlug();

	return React.useCallback(
		(tenantSlug: string): void => {
			if (tenantSlug === currentTenantSlug) {
				return;
			}
			router.push(tenantRoutes(tenantSlug).dashboard);
		},
		[currentTenantSlug, router],
	);
}
