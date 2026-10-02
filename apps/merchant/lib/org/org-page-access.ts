import { hasCapability, type CapabilitySlug, type OrganizationRewardMembershipResponse } from "@workspace/shared";

import { isOrgPageRuleSatisfied, ORG_PAGE_RULES, type OrgPageDenialCopy, type OrgPageRoute } from "@/lib/navigation/org-route-authorization";
import { resolveOrganizationTenantFromUrlSegment } from "@/lib/org/resolve-slug";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";

/** Outcome of the server-side org page check. */
export type OrgPageAccess = { readonly allowed: true } | { readonly allowed: false; readonly denial: OrgPageDenialCopy | undefined };

/**
 * The membership for exactly the organization in the URL (`/orgs/{slug or id}`).
 * Unlike the shell's active-membership fallback, this never borrows another
 * organization's role, so a URL for an organization the user does not belong
 * to grants nothing.
 */
export function resolveUrlOrganizationMembership(
	memberships: readonly OrganizationRewardMembershipResponse[],
	orgSegment: string,
): OrganizationRewardMembershipResponse | undefined {
	const tenant = resolveOrganizationTenantFromUrlSegment(memberships, orgSegment);
	return tenant === undefined ? undefined : memberships.find((membership) => membership.organizationId === tenant.organizationId);
}

/**
 * Whether the signed-in user may open `route` in the organization `orgSegment`
 * names, from their memberships (the role → capability table the API enforces
 * first). Open routes are allowed; gated routes fail closed without a
 * membership in that organization.
 */
export function decideOrgPageAccess(memberships: readonly OrganizationRewardMembershipResponse[], orgSegment: string, route: OrgPageRoute): OrgPageAccess {
	const rule = ORG_PAGE_RULES[route];
	if (rule.kind === "open") {
		return { allowed: true };
	}

	const capabilities = resolveMerchantCapabilities(resolveUrlOrganizationMembership(memberships, orgSegment));
	const isGranted = (capability: CapabilitySlug): boolean => hasCapability(capabilities, capability);
	return isOrgPageRuleSatisfied(rule, isGranted) ? { allowed: true } : { allowed: false, denial: rule.denial };
}
