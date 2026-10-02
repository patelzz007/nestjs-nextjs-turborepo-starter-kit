import "server-only";

import * as React from "react";

import { MerchantAccessDenied } from "@/components/access/merchant-capability-gate";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { ORG_PAGE_RULES, type OrgPageRoute } from "@/lib/navigation/org-route-authorization";
import { decideOrgPageAccess } from "@/lib/org/org-page-access";

/**
 * Server-side guard every page under `app/orgs/[orgSlug]/` calls FIRST, before
 * it fetches or renders anything:
 *
 * ```tsx
 * const denied = await guardOrgPage(orgSlug, "/settings/team");
 * if (denied !== null) return denied;
 * ```
 *
 * Returns the standard access-denied state when the user's membership in that
 * organization lacks the route's capability (`ORG_PAGE_RULES`), else `null`.
 * It runs per page, not in the org layout: layouts do not re-render on
 * client-side navigation, so a layout check would be skipped when a user
 * moves between org pages. UX only — the API authorizes every request.
 */
export async function guardOrgPage(orgSlug: string, route: OrgPageRoute): Promise<React.JSX.Element | null> {
	if (ORG_PAGE_RULES[route].kind === "open") {
		return null;
	}

	const { memberships } = await loadMerchantServerContext();
	const access = decideOrgPageAccess(memberships, orgSlug, route);
	if (access.allowed) {
		return null;
	}

	return access.denial === undefined ? <MerchantAccessDenied /> : <MerchantAccessDenied title={access.denial.title} description={access.denial.description} />;
}
