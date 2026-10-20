import { MERCHANT_ROLE_CAPABILITIES, type CapabilitySlug, type MembershipRole } from "@workspace/shared";

/** Anything that carries a member's role in one tenant (a membership, the tenant context's membership). */
export interface MerchantRoleHolder {
	readonly role: MembershipRole;
}

/**
 * The `merchant:*` capabilities of a membership's role — the same table the API enforces before tenant Cedar
 * policies (advisory UX state only). No membership, no capability.
 */
export function resolveMerchantCapabilities(membership: MerchantRoleHolder | undefined): readonly CapabilitySlug[] {
	if (membership === undefined) return [];
	return MERCHANT_ROLE_CAPABILITIES[membership.role];
}
