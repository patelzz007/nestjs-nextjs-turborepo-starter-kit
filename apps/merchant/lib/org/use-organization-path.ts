"use client";

import { resolveOrgHref, type AppPath } from "@/lib/routes";
import { useOrganizationSlug } from "@/lib/org/use-organization-slug";

/**
 * Browser href for an org-relative route (`ORG_ROUTES.*`) in the active
 * organization. Before the organization is known it falls back to the
 * top-level entry page that resolves it server-side (see `resolveOrgHref`).
 */
export function useOrganizationPath(path: AppPath): AppPath {
	const organizationSlug = useOrganizationSlug();
	return resolveOrgHref(organizationSlug, path);
}
