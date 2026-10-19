import type { FileCategory, MerchantCapability, OrganizationMembershipRole } from "@workspace/shared";

import type { FileCategoryAccessRule } from "../../../files/public-api";

/** The capabilities one organization-owned file category needs. */
export interface OrganizationFileCapabilities {
	/** Upload, complete and delete: changes what the organization shows or submits. */
	readonly manage: MerchantCapability;
	/** Metadata and signed download URLs. */
	readonly read: MerchantCapability;
	/** The 403 message a caller without the capability sees. */
	readonly deniedMessage: string;
}

/**
 * Builds the access rule of a file category whose files belong to an
 * organization (store branding, KYB evidence, reward images). The rule decides
 * on the caller's CURRENT membership and capability, never on who uploaded the
 * file, so a demoted or former member cannot complete, read or delete it.
 * Exported so another context that owns such a category (rewards) registers its
 * rule on the same organization check.
 */
export interface OrganizationFileAccessPort {
	ruleFor(categories: readonly FileCategory[], capabilities: OrganizationFileCapabilities): FileCategoryAccessRule;
}

/** The caller's active membership role in an organization, or null for a non-member. */
export interface MembershipRoleLookupPort {
	activeRole(userId: string, organizationId: string): Promise<OrganizationMembershipRole | null>;
}

/** The merchant role table, then the tenant Cedar policy, audited (the same `authorize.*` rows as every merchant check). */
export interface MerchantCapabilityGatePort {
	/** True when the capability is the membership itself (no Cedar action): the role table is the whole rule. */
	isMembershipOnly(capability: MerchantCapability): boolean;
	requireMembershipCapability(
		subject: { readonly userId: string; readonly organizationId: string; readonly role: OrganizationMembershipRole },
		capability: MerchantCapability,
	): Promise<void>;
}
