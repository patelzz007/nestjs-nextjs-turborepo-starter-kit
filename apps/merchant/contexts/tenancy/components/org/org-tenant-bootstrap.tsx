"use client";

import { writeTenantSlugCookie } from "@/contexts/tenancy/lib/org/slug";
import * as React from "react";

export interface OrgTenantBootstrapProps {
	/** Canonical slug of a tenant the member belongs to (the org layout resolved it). */
	readonly tenantSlug: string;
}

/**
 * The ONE writer of the `tenantSlug` cookie: records the tenant
 * the member opened, so entry routes outside `/t/[tenantSlug]` (`/`,
 * `/account`) reopen it. Rendered by the org layout only for a confirmed
 * membership, so a typed URL for a foreign tenant never becomes the
 * preference. No navigation side effects; the URL stays the owner of the
 * active tenant.
 */
export function OrgTenantBootstrap({ tenantSlug }: OrgTenantBootstrapProps): null {
	React.useEffect((): void => {
		writeTenantSlugCookie(tenantSlug);
	}, [tenantSlug]);

	return null;
}
