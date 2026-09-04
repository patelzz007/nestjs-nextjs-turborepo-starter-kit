import type { MerchantCapability, MerchantMembershipResponse } from "@workspace/shared";
import { merchantHasCapability } from "@workspace/shared";

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

export function resolveMerchantCapabilities(membership: MerchantMembershipResponse | undefined): readonly MerchantCapability[] {
	if (membership === undefined) {
		return [];
	}
	return membership.capabilities;
}

export function serverHasMerchantCapability(memberships: readonly MerchantMembershipResponse[], merchantOrgId: string | undefined, capability: MerchantCapability): boolean {
	const membership = resolveActiveMerchantMembership(memberships, merchantOrgId);
	return merchantHasCapability(resolveMerchantCapabilities(membership), capability);
}
