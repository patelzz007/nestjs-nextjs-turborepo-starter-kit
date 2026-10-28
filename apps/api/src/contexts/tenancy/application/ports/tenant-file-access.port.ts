import type { FileCategory, MerchantCapability, MembershipRole } from "@workspace/shared";

import type { FileCategoryAccessRule } from "../../../files/public-api";

/** The capabilities one tenant-owned file category needs. */
export interface TenantFileCapabilities {
	/** Upload, complete and delete: changes what the tenant shows or submits. */
	readonly manage: MerchantCapability;
	/** Metadata and signed download URLs. */
	readonly read: MerchantCapability;
	/** The 403 message a caller without the capability sees. */
	readonly deniedMessage: string;
}

/**
 * Builds the access rule of a file category whose files belong to an
 * tenant (store branding, KYB evidence, reward images). The rule decides
 * on the caller's CURRENT membership and capability, never on who uploaded the
 * file, so a demoted or former member cannot complete, read or delete it.
 * Exported so another context that owns such a category (rewards) registers its
 * rule on the same tenant check.
 */
export interface TenantFileAccessPort {
	ruleFor(categories: readonly FileCategory[], capabilities: TenantFileCapabilities): FileCategoryAccessRule;
}

/** The caller's active membership role in a tenant, or null for a non-member. */
export interface MembershipRoleLookupPort {
	activeRole(userId: string, tenantId: string): Promise<MembershipRole | null>;
}

/** The member's capability, decided by the access-control service and audited (the same `authorize.*` rows as every merchant check). */
export interface MerchantCapabilityGatePort {
	requireMembershipCapability(subject: { readonly userId: string; readonly tenantId: string; readonly role: MembershipRole }, capability: MerchantCapability): Promise<void>;
}
