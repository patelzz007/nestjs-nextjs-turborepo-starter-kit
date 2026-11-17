import type { CustomerTier } from "@workspace/shared";

/**
 * The customer's tier at the moment of a redemption (ADR 085), read inside the till's checkout transaction under its
 * API key's session, so the redemption records it. Implemented by the tiers context and consumed by pos through its
 * `CUSTOMER_TIER_SNAPSHOT_FACTORY` token, so pos never imports tiers (tiers reacts to pos's `SaleCheckedOut`).
 */
export interface CustomerTierSnapshotPort {
	/** The customer's stored tier (Bronze without a standing). */
	tierOf(customerUserId: string): Promise<CustomerTier>;
}
