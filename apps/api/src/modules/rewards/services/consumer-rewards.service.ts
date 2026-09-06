import { Injectable, NotFoundException } from "@nestjs/common";
import type { Reward } from "@prisma/client";

import type { RewardListQuery, RewardResponse } from "@workspace/shared";

import { BaseService } from "../../../platform/persistence/base.service";
import type { EmptyMutationInput } from "../../../platform/persistence/types";
import { mapRewardToResponse } from "../utils/reward-mapper.util";
import { RewardRepository } from "../repositories/reward.repository";

@Injectable()
export class ConsumerRewardsService extends BaseService<Reward, EmptyMutationInput, EmptyMutationInput, RewardListQuery, RewardRepository> {
	public constructor(repository: RewardRepository) {
		super(repository);
	}

	public async listMarketplace(query: RewardListQuery): Promise<{
		items: RewardResponse[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNext: boolean;
		hasPrevious: boolean;
	}> {
		const page = query.page;
		const pageSize = query.limit;
		const result = await this.repository.listMarketplace(query);

		return {
			items: result.items.map((row) => mapRewardToResponse(row, row.merchantOrg)),
			total: result.total,
			page,
			limit: pageSize,
			totalPages: pageSize === 0 ? 0 : Math.ceil(result.total / pageSize),
			hasNext: page * pageSize < result.total,
			hasPrevious: page > 1,
		};
	}

	public async getPublishedReward(rewardId: string): Promise<RewardResponse> {
		const reward = await this.repository.findPublishedConsumerWithMerchant(rewardId);

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		return mapRewardToResponse(reward, reward.merchantOrg);
	}
}
