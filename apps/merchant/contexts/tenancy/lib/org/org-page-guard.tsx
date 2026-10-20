import "server-only";

import * as React from "react";

import { MerchantAccessDenied } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { loadTenantContext } from "@/lib/merchant-server-api";
import { ORG_PAGE_RULES, type OrgPageRoute } from "@/lib/navigation/org-route-authorization";
import { decideOrgPageAccess } from "@/contexts/tenancy/lib/org/org-page-access";

/**
 * Server-side guard every page under `app/t/[tenantSlug]/` calls FIRST, before
 * it fetches or renders anything:
 *
 * ```tsx
 * const denied = await guardOrgPage(orgSlug, "/settings/team");
 * if (denied !== null) return denied;
 * ```
 *
 * Returns the standard access-denied state when the user's membership in that
 * tenant lacks the route's capability (`ORG_PAGE_RULES`), else `null`.
 * It runs per page, not in the org layout: layouts do not re-render on
 * client-side navigation, so a layout check would be skipped when a user
 * moves between org pages. UX only — the API authorizes every request.
 */
export async function guardOrgPage(tenantSlug: string, route: OrgPageRoute): Promise<React.JSX.Element | null> {
	if (ORG_PAGE_RULES[route].kind === "open") {
		return null;
	}

	// The member's own membership in this tenant (the same per-request context the layout loads).
	const context = await loadTenantContext(tenantSlug);
	const access = decideOrgPageAccess(context?.data.membership, route);
	if (access.allowed) {
		return null;
	}

	return access.denial === undefined ? <MerchantAccessDenied /> : <MerchantAccessDenied title={access.denial.title} description={access.denial.description} />;
}
