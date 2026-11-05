import type { RewardResponse } from "@workspace/shared";

/**
 * Adds the merchant's name and logo to a reward response a command built in its transaction. Called once that
 * transaction has committed: the merchant's display data is a read of the tenants context with a transaction of
 * its own, and opening it inside the command's held a second pooled connection while the first waited.
 */
export interface RewardMerchantDisplayPort {
	withMerchantDisplay(response: RewardResponse): Promise<RewardResponse>;
}
