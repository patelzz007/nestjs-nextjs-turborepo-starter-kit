"use client";

import { useTenantSlug } from "@/contexts/tenancy/lib/org/use-tenant-slug";
import { tenantRoutes } from "@/lib/routes";
import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Org switcher action: the URL owns the active tenant, so switching is
 * a navigation to the other tenant's dashboard. Each tenant keeps
 * its own store choice (`tenantLocationId.<orgSlug>`), so nothing is
 * cleared: the new tenant's server render prefetches with ITS stored
 * store, its tenant context mounts fresh (keyed by the slug), and
 * `OrgTenantBootstrap` records it as the last opened tenant.
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
