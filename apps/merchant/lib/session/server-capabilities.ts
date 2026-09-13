import type { CapabilitySlug, OrganizationRewardMembershipResponse } from "@workspace/shared";
import { hasCapability } from "@workspace/shared";

const OWNER_REWARDHUB_CAPABILITIES: readonly CapabilitySlug[] = [
	"merchant:view_dashboard",
	"merchant:view_rewards",
	"merchant:manage_rewards",
	"merchant:view_redemptions",
	"merchant:manage_api_keys",
	"merchant:view_analytics",
	"merchant:manage_kyb",
];

const CASHIER_REWARDHUB_CAPABILITIES: readonly CapabilitySlug[] = ["merchant:view_dashboard", "merchant:view_rewards", "merchant:view_redemptions", "merchant:view_analytics"];

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

	if (membership.role === "OWNER" || membership.role === "ADMIN" || membership.role === "POLICY_ADMIN") return OWNER_REWARDHUB_CAPABILITIES;

	if (membership.role === "CASHIER") return CASHIER_REWARDHUB_CAPABILITIES;

	return ["merchant:view_dashboard"];
}

export function serverHasMerchantCapability(
	memberships: readonly OrganizationRewardMembershipResponse[],
	organizationSlug: string | undefined,
	capability: CapabilitySlug,
): boolean {
	const membership = resolveActiveOrganizationMembership(memberships, organizationSlug);
	return hasCapability(resolveMerchantCapabilities(membership), capability);
}
