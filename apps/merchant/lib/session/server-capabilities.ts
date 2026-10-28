import { merchantCapabilitiesOf, TENANT_ROLE_TEMPLATES, type CapabilitySlug, type MembershipRole, type MerchantCapability } from "@workspace/shared";

/** Anything that carries a member's role in one tenant (a membership, the tenant context's membership). */
export interface MerchantRoleHolder {
	readonly role: MembershipRole;
	/** What the API says the member holds right now — their tenant role plus live grants (ADR 067). */
	readonly capabilities?: readonly MerchantCapability[] | undefined;
}

/**
 * The `merchant:*` capabilities of a membership (advisory UX state only — the API decides): the API's own
 * answer when the membership carries one, else what the role's template gives. No membership, no capability.
 */
export function resolveMerchantCapabilities(membership: MerchantRoleHolder | undefined): readonly CapabilitySlug[] {
	if (membership === undefined) return [];
	return membership.capabilities ?? merchantCapabilitiesOf(TENANT_ROLE_TEMPLATES[membership.role]);
}
