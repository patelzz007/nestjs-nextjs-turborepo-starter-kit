"use client";

import { writeTenantSlugCookie } from "@/contexts/tenancy/lib/tenant/slug";
import * as React from "react";

export interface TenantBootstrapProps {
	/** Canonical slug of a tenant the member belongs to (the tenant layout resolved it). */
	readonly tenantSlug: string;
}

/**
 * The ONE writer of the `tenantSlug` cookie: records the tenant
 * the member opened, so entry routes outside `/t/[tenantSlug]` (`/`,
 * `/account`) reopen it. Rendered by the tenant layout only for a confirmed
 * membership, so a typed URL for a foreign tenant never becomes the
 * preference. No navigation side effects; the URL stays the owner of the
 * active tenant.
 */
export function TenantBootstrap({ tenantSlug }: TenantBootstrapProps): null {
	React.useEffect((): void => {
		writeTenantSlugCookie(tenantSlug);
	}, [tenantSlug]);

	return null;
}
