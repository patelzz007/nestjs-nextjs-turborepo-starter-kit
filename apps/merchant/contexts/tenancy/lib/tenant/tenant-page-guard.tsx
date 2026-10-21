import "server-only";

import * as React from "react";

import { MerchantAccessDenied } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { loadTenantContext } from "@/lib/merchant-server-api";
import { ORG_PAGE_RULES, type TenantPageRoute } from "@/lib/navigation/tenant-route-authorization";
import { decideTenantPageAccess } from "@/contexts/tenancy/lib/tenant/tenant-page-access";

/**
 * Server-side guard every page under `app/t/[tenantSlug]/` calls FIRST, before
 * it fetches or renders anything:
 *
 * ```tsx
 * const denied = await guardTenantPage(tenantSlug, "/settings/team");
 * if (denied !== null) return denied;
 * ```
 *
 * Returns the standard access-denied state when the user's membership in that
 * tenant lacks the route's capability (`ORG_PAGE_RULES`), else `null`.
 * It runs per page, not in the tenant layout: layouts do not re-render on
 * client-side navigation, so a layout check would be skipped when a user
 * moves between tenant pages. UX only — the API authorizes every request.
 */
export async function guardTenantPage(tenantSlug: string, route: TenantPageRoute): Promise<React.JSX.Element | null> {
	if (ORG_PAGE_RULES[route].kind === "open") {
		return null;
	}

	// The member's own membership in this tenant (the same per-request context the layout loads).
	const context = await loadTenantContext(tenantSlug);
	const access = decideTenantPageAccess(context?.data.membership, route);
	if (access.allowed) {
		return null;
	}

	return access.denial === undefined ? <MerchantAccessDenied /> : <MerchantAccessDenied title={access.denial.title} description={access.denial.description} />;
}
