"use client";

import { organizationPath } from "@/lib/org/slug";
import { useOrganizationSlug } from "@/lib/org/use-organization-slug";

/** Resolves an org-scoped merchant route from a menu-relative subpath. */
export function useOrganizationPath(subpath = "dashboard"): string {
	const organizationSlug = useOrganizationSlug();

	if (organizationSlug === undefined) {
		if (subpath === "dashboard" || subpath === "") {
			return "/";
		}
		return subpath.startsWith("/") ? subpath : `/${subpath}`;
	}

	return organizationPath(organizationSlug, subpath);
}
