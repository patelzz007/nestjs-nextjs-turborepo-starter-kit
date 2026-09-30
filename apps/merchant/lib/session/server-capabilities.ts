import type { CapabilitySlug, OrganizationRewardMembershipResponse } from "@workspace/shared";
import { hasCapability, MERCHANT_ROLE_CAPABILITIES } from "@workspace/shared";

export function resolveActiveOrganizationMembership(
	memberships: readonly OrganizationRewardMembershipResponse[],
	organizationSlug: string | undefined,
): OrganizationRewardMembershipResponse | undefined {
	if (organizationSlug !== undefined) {
		const match = memberships.find((row) => row.organizationSlug === organizationSlug);
		if (match !== undefined) return match;
	}
	return memberships[0];
}

export function resolveMerchantCapabilities(membership: OrganizationRewardMembershipResponse | undefined): readonly CapabilitySlug[] {
	if (membership === undefined) return [];

	// Same table the API enforces before tenant Cedar policies (advisory UX state only).
	return MERCHANT_ROLE_CAPABILITIES[membership.role];
}

export function serverHasMerchantCapability(
	memberships: readonly OrganizationRewardMembershipResponse[],
	organizationSlug: string | undefined,
	capability: CapabilitySlug,
): boolean {
	const membership = resolveActiveOrganizationMembership(memberships, organizationSlug);
	return hasCapability(resolveMerchantCapabilities(membership), capability);
}
