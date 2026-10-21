import type { EpochMs } from "@workspace/shared";

import type { MerchantAccessGrant } from "./authorization.port";

/** The customer behind one redemption, and what identifies that redemption to the merchant's staff. */
export interface RedemptionCustomer {
	readonly redemptionId: string;
	readonly customerUserId: string;
	readonly rewardTitle: string;
	readonly redeemedAt: EpochMs;
}

/**
 * A merchant bans a customer from one of the customer's redemptions (merchants never see who a
 * customer is). Implemented by pos (it owns `RewardRedemption`) and consumed by tenants through its
 * `REDEMPTION_CUSTOMER_FACTORY` token, so tenants never imports pos (pos depends on tenants).
 * Bound to the caller's unit-of-work transaction.
 */
export interface RedemptionCustomerPort {
	/**
	 * The redemption, if it is one of `grant`'s tenant at a store of `grant` (a store-limited member
	 * sees only their stores' redemptions); `null` otherwise — another tenant's is answered alike.
	 */
	findRedemptionCustomer(grant: MerchantAccessGrant, redemptionId: string): Promise<RedemptionCustomer | null>;
}
