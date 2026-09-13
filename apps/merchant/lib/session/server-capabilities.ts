import type { CapabilitySlug, MerchantMembershipResponse } from "@workspace/shared";
import { hasCapability } from "@workspace/shared";

export function resolveActiveMerchantMembership(
	memberships: readonly MerchantMembershipResponse[],
	merchantOrgId: string | undefined,
): MerchantMembershipResponse | undefined {
	if (merchantOrgId !== undefined) {
		const match = memberships.find((row) => row.merchantOrgId === merchantOrgId);
		if (match !== undefined) {
			return match;
		}
	}
	return memberships[0];
}

export function resolveMerchantCapabilities(membership: MerchantMembershipResponse | undefined): readonly CapabilitySlug[] {
	if (membership === undefined) {
		return [];
	}
	return membership.capabilities;
}

export function serverHasMerchantCapability(memberships: readonly MerchantMembershipResponse[], merchantOrgId: string | undefined, capability: CapabilitySlug): boolean {
	const membership = resolveActiveMerchantMembership(memberships, merchantOrgId);
	return hasCapability(resolveMerchantCapabilities(membership), capability);
}
