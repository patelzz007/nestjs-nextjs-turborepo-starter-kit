import { Injectable, NotFoundException } from "@nestjs/common";
import type { Reward } from "@prisma/client";

import type { PaginatedServiceResult, RewardListQuery, RewardResponse } from "@workspace/shared";

import { BaseService } from "../../../platform/persistence/base.service";
import { paginateCursorListResult } from "../../../platform/persistence/cursor-list";
import type { EmptyMutationInput } from "../../../platform/persistence/types";
import { mapRewardToResponse } from "../utils/reward-mapper.util";
import { RewardRepository } from "../repositories/reward.repository";

@Injectable()
export class ConsumerRewardsService extends BaseService<Reward, EmptyMutationInput, EmptyMutationInput, RewardListQuery, RewardRepository> {
	public constructor(repository: RewardRepository) {
		super(repository);
	}

	public async listMarketplace(query: RewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		const result = await this.repository.listMarketplace(query);
		return paginateCursorListResult({ ...result, items: result.items.map((row) => mapRewardToResponse(row, row.merchantOrg)) }, query);
	}

	public async getPublishedReward(rewardId: string): Promise<RewardResponse> {
		const reward = await this.repository.findPublishedConsumerWithMerchant(rewardId);

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		return mapRewardToResponse(reward, reward.merchantOrg);
	}
}
