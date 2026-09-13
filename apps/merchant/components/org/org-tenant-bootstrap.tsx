"use client";

import { isCanonicalOrganizationSlug } from "@/lib/org/resolve-slug";
import { writeMerchantOrgCookie } from "@/lib/org/org";
import { clearOrganizationSlugCookie, writeOrganizationSlugCookie } from "@/lib/org/slug";
import * as React from "react";

export interface OrgTenantBootstrapProps {
	readonly merchantOrgId: string;
	readonly orgSlug: string | null;
}

/** Persists org-scoped cookies from the resolved URL tenant (client-only — Next.js forbids writes in layouts). */
export function OrgTenantBootstrap({ merchantOrgId, orgSlug }: OrgTenantBootstrapProps): null {
	React.useEffect((): void => {
		writeMerchantOrgCookie(merchantOrgId);
		if (orgSlug !== null && isCanonicalOrganizationSlug(orgSlug)) {
			writeOrganizationSlugCookie(orgSlug);
			return;
		}
		clearOrganizationSlugCookie();
	}, [merchantOrgId, orgSlug]);

	return null;
}
