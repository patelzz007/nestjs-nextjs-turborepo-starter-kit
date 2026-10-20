import type { EpochMs } from "@workspace/shared";

import type { RewardRepository } from "../../domain/repositories/reward.repository";
import type { ClaimableRewardFacts, ReferrerCreditFacts, RewardInventoryPort } from "../ports/reward-inventory.port";

/**
 * {@link RewardInventoryPort} over the Reward aggregate. Every stock change loads the reward row
 * locked `FOR UPDATE`, so concurrent claims of one reward serialise on it; the save is still a
 * compare-and-set and writes the counters as increments.
 */
export class RewardInventoryApplicationService implements RewardInventoryPort {
	public constructor(private readonly rewards: RewardRepository) {}

	public async assertClaimable(rewardId: string, now: EpochMs): Promise<ClaimableRewardFacts> {
		const reward = await this.rewards.getLive(rewardId);
		return reward.assertClaimable(now);
	}

	public async reserve(rewardId: string, now: EpochMs): Promise<ClaimableRewardFacts> {
		const reward = await this.rewards.getForInventory(rewardId);
		const facts = reward.reserve(now);
		await this.rewards.save(reward);
		return facts;
	}

	public async release(rewardId: string, now: EpochMs): Promise<void> {
		const reward = await this.rewards.getForInventory(rewardId);
		reward.release(now);
		await this.rewards.save(reward);
	}

	public async lockForCheckout(rewardIds: readonly string[]): Promise<void> {
		await this.rewards.lockForCheckout(rewardIds);
	}

	public async recordRedemption(rewardId: string, now: EpochMs): Promise<void> {
		const reward = await this.rewards.getForInventory(rewardId);
		reward.recordRedemption(now);
		await this.rewards.save(reward);
	}

	public async creditReferral(rewardId: string, now: EpochMs): Promise<ReferrerCreditFacts | null> {
		const reward = await this.rewards.getForReferralCredit(rewardId);
		const credit = reward.creditReferral(now);
		if (credit !== null) {
			await this.rewards.save(reward);
		}
		return credit;
	}
}
