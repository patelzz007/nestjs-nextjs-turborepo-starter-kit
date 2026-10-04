import type { CapabilitySlug, OrganizationRewardMembershipResponse } from "@workspace/shared";
import { MERCHANT_ROLE_CAPABILITIES } from "@workspace/shared";

import { resolveUrlOrganizationMembership } from "@/lib/org/resolve-slug";

/**
 * The membership of the organization the URL names (`organizationSlug` from
 * `/orgs/[orgSlug]`), or `undefined` outside org routes and for an
 * organization the user does not belong to. Fails closed: it never falls back
 * to another organization's membership, so no role is ever borrowed.
 */
export function resolveActiveOrganizationMembership(
	memberships: readonly OrganizationRewardMembershipResponse[],
	organizationSlug: string | undefined,
): OrganizationRewardMembershipResponse | undefined {
	return resolveUrlOrganizationMembership(memberships, organizationSlug);
}

export function resolveMerchantCapabilities(membership: OrganizationRewardMembershipResponse | undefined): readonly CapabilitySlug[] {
	if (membership === undefined) return [];

	// Same table the API enforces before tenant Cedar policies (advisory UX state only).
	return MERCHANT_ROLE_CAPABILITIES[membership.role];
}
