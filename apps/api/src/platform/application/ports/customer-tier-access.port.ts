import type { CustomerTier } from "@workspace/shared";

import type { CustomerTierAccess } from "../../domain/customer-tier-access";

export type { CustomerTierAccess } from "../../domain/customer-tier-access";

/**
 * Customers' tiers for the contexts that gate on them or show them (rewards' marketplace and editor, claims, a
 * merchant's customer list). Implemented by the tiers context and consumed through {@link CUSTOMER_TIER_ACCESS}, so
 * none of them imports tiers (tiers depends on pos, which depends on them). Reads outside any unit of work.
 */
export interface CustomerTierAccessPort {
	/** Whether tiers are on, and the viewer's tier (null: a signed-out visitor, Bronze). */
	accessFor(userId: string | null): Promise<CustomerTierAccess>;
	/** Each customer's tier (Bronze without a standing); null when tiers are off, so nothing should show a tier. */
	tiersOf(userIds: readonly string[]): Promise<ReadonlyMap<string, CustomerTier> | null>;
}

export const CUSTOMER_TIER_ACCESS = Symbol("CUSTOMER_TIER_ACCESS");
