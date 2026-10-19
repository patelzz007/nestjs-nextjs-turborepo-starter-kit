import type { Reward } from "../aggregates/reward.aggregate";

/**
 * Persistence port of the {@link Reward} aggregate, bound to one unit-of-work transaction.
 * Every save is a compare-and-set on the aggregate's concurrency token.
 */
export interface RewardRepository {
	/** One live consumer reward of the organization (with its referrer child); {@link RewardNotFoundError} otherwise. */
	getConsumerInOrganization(organizationId: string, rewardId: string): Promise<Reward>;

	/** One live consumer reward of any organization (reviewers); {@link RewardNotFoundError} otherwise. */
	getConsumer(rewardId: string): Promise<Reward>;

	/** Same as {@link getConsumer}, but `null` when it is gone (batch jobs skip it). */
	findConsumer(rewardId: string): Promise<Reward | null>;

	/** Any live reward row (consumer or referrer), unlocked; {@link RewardNotFoundError} otherwise. */
	getLive(rewardId: string): Promise<Reward>;

	/** Any live reward row, locked `FOR UPDATE` until the transaction ends (stock changes serialise on it). */
	getForInventory(rewardId: string): Promise<Reward>;

	/** The live rewards and their referrer children, locked `FOR UPDATE` in one id-ordered pass until the transaction ends. */
	lockForCheckout(rewardIds: readonly string[]): Promise<void>;

	/** A live consumer reward and its referrer child, both locked `FOR UPDATE` (parent first) until the transaction ends. */
	getForReferralCredit(rewardId: string): Promise<Reward>;

	/** Inserts a new reward with its images, store scope and referrer child. */
	add(reward: Reward): Promise<void>;

	/** Compare-and-set save; a reward changed since it was loaded throws `ConcurrentModificationError` (409). */
	save(reward: Reward): Promise<void>;

	/** Same compare-and-set as {@link save}, but answers `false` instead of throwing (batch jobs skip the row). */
	saveIfUnchanged(reward: Reward): Promise<boolean>;
}
