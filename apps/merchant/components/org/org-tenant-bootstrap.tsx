"use client";

import { writeOrganizationSlugCookie } from "@/lib/org/slug";
import * as React from "react";

export interface OrgTenantBootstrapProps {
	readonly orgSlug: string;
}

/** Persists the URL tenant slug for SSR + client consistency (no navigation side effects). */
export function OrgTenantBootstrap({ orgSlug }: OrgTenantBootstrapProps): null {
	React.useEffect((): void => {
		writeOrganizationSlugCookie(orgSlug);
	}, [orgSlug]);

	return null;
}
