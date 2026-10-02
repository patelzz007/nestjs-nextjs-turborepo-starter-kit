"use client";

import { writeOrganizationSlugCookie } from "@/lib/org/slug";
import * as React from "react";

export interface OrgTenantBootstrapProps {
	/** Canonical slug of an organization the member belongs to (the org layout resolved it). */
	readonly orgSlug: string;
}

/**
 * The ONE writer of the `organizationSlug` cookie: records the organization
 * the member opened, so entry routes outside `/orgs/[orgSlug]` (`/`,
 * `/account`) reopen it. Rendered by the org layout only for a confirmed
 * membership, so a typed URL for a foreign organization never becomes the
 * preference. No navigation side effects; the URL stays the owner of the
 * active organization.
 */
export function OrgTenantBootstrap({ orgSlug }: OrgTenantBootstrapProps): null {
	React.useEffect((): void => {
		writeOrganizationSlugCookie(orgSlug);
	}, [orgSlug]);

	return null;
}
