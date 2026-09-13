"use client";

import { useMerchantOrg } from "@/lib/session/root-provider";

/** Active organization slug from client context (set by org layout / store switcher). */
export function useOrganizationSlug(): string | undefined {
	const { organizationSlug } = useMerchantOrg();
	return organizationSlug;
}
