"use client";

import { useOrganizationSlug } from "@/lib/org/use-organization-slug";
import { orgRoutes } from "@/lib/routes";
import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Org switcher action: the URL owns the active organization, so switching is
 * a navigation to the other organization's dashboard. Each organization keeps
 * its own store choice (`organizationLocationId.<orgSlug>`), so nothing is
 * cleared: the new organization's server render prefetches with ITS stored
 * store, its tenant context mounts fresh (keyed by the slug), and
 * `OrgTenantBootstrap` records it as the last opened organization.
 */
export function useSwitchOrganization(): (organizationSlug: string) => void {
	const router = useRouter();
	const currentOrganizationSlug = useOrganizationSlug();

	return React.useCallback(
		(organizationSlug: string): void => {
			if (organizationSlug === currentOrganizationSlug) {
				return;
			}
			router.push(orgRoutes(organizationSlug).dashboard);
		},
		[currentOrganizationSlug, router],
	);
}
