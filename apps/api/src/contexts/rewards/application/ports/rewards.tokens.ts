import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** The rewards unit of work (`UnitOfWork<RewardsScope>`). */
export const REWARDS_UNIT_OF_WORK = Symbol("REWARDS_UNIT_OF_WORK");

/** {@link RewardReadPort}. */
export const REWARD_READS = Symbol("REWARD_READS");
/** {@link RewardMerchantDisplayPort}: a command response's merchant name and logo, after its commit. */
export const REWARD_MERCHANT_DISPLAY = Symbol("REWARD_MERCHANT_DISPLAY");

/** {@link RewardImageDeliveryPort}. */
export const REWARD_IMAGE_DELIVERY = Symbol("REWARD_IMAGE_DELIVERY");

/** {@link LegalAcceptanceReadPort}. */
export const LEGAL_ACCEPTANCE_READS = Symbol("LEGAL_ACCEPTANCE_READS");

/** {@link IdGenerator}. */
export const REWARD_ID_GENERATOR = Symbol("REWARD_ID_GENERATOR");

/** Admin moderation of consumer rewards, across tenants. */
export const REWARDS_ADMIN_REVIEW_OPERATION: SystemOperationName = "rewards.admin_review";
/** A merchant reads its customers' names (masked emails) to give a reward to chosen ones. */
export const REWARD_CUSTOMERS_READ_OPERATION: SystemOperationName = "rewards.customers.read";

/** Published consumer rewards on the public marketplace. */
export const MARKETPLACE_REWARDS_READ_OPERATION: SystemOperationName = "marketplace.published_rewards.read";

/** Generates ids for new aggregates (a fake makes them deterministic in tests). */
export interface IdGenerator {
	next(): string;
}
