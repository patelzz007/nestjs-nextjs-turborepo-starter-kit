"use client";

import { isCanonicalOrganizationSlug } from "@/lib/org/resolve-slug";
import { clearOrganizationSlugCookie, writeOrganizationSlugCookie } from "@/lib/org/slug";
import * as React from "react";

export interface OrgSlugBootstrapProps {
	readonly orgSlug: string;
}

/** Persists the URL tenant slug so org-scoped navigation stays consistent. */
export function OrgSlugBootstrap({ orgSlug }: OrgSlugBootstrapProps): null {
	React.useEffect((): void => {
		if (isCanonicalOrganizationSlug(orgSlug)) {
			writeOrganizationSlugCookie(orgSlug);
			return;
		}
		clearOrganizationSlugCookie();
	}, [orgSlug]);

	return null;
}
