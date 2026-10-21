import type { Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import type { ReferableRewardLookupFactory, ReferableRewardLookupPort } from "../../../referrals/public-api";

/**
 * A reward can be shared while the marketplace shows it and its referrals are on: a live, published,
 * in-stock, unexpired consumer reward that has started (a referrer clone is never shared).
 */
export function referableRewardWhere(rewardId: string, now: EpochMs): Prisma.RewardWhereInput {
	const at = BigInt(now);
	return {
		id: rewardId,
		isDeleted: false,
		status: "PUBLISHED",
		rewardKind: "CONSUMER",
		referralsEnabled: true,
		quantityRemaining: { gt: 0 },
		expiryDate: { gte: at },
		OR: [{ startDate: null }, { startDate: { lte: at } }],
	};
}

/** Rewards' answer to "may this reward be shared?", on the link command's transaction. */
export class PrismaReferableRewardLookup implements ReferableRewardLookupPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async isReferable(rewardId: string, now: EpochMs): Promise<boolean> {
		return (await this.db.reward.count({ where: referableRewardWhere(rewardId, now) })) === 1;
	}
}

/** What rewards provides under referrals' `REFERABLE_REWARD_LOOKUP_FACTORY`. */
export const REWARDS_REFERABLE_REWARD_LOOKUP_FACTORY: ReferableRewardLookupFactory = {
	forTransaction(db: Prisma.TransactionClient): ReferableRewardLookupPort {
		return new PrismaReferableRewardLookup(db);
	},
};
