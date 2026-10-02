"use client";

import { clearOrganizationLocationCookie } from "@/lib/org/location";
import { useOrganizationSlug } from "@/lib/org/use-organization-slug";
import { orgRoutes } from "@/lib/routes";
import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Org switcher action: the URL owns the active organization, so switching is
 * a navigation to the other organization's dashboard. The store choice is
 * dropped first (a store belongs to one organization), so the new
 * organization's server render prefetches its default filter; its tenant
 * context mounts fresh (keyed by the slug) and `OrgTenantBootstrap` records
 * the new organization as the last opened one.
 */
export function useSwitchOrganization(): (organizationSlug: string) => void {
	const router = useRouter();
	const currentOrganizationSlug = useOrganizationSlug();

	return React.useCallback(
		(organizationSlug: string): void => {
			if (organizationSlug === currentOrganizationSlug) {
				return;
			}
			clearOrganizationLocationCookie();
			router.push(orgRoutes(organizationSlug).dashboard);
		},
		[currentOrganizationSlug, router],
	);
}
