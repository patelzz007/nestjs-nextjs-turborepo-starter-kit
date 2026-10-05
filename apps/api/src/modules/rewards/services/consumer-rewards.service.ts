import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedServiceResult, RewardListQuery, RewardResponse } from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { mapRewardToResponse } from "../utils/reward-mapper.util";
import { RewardRepository } from "../repositories/reward.repository";

@Injectable()
export class ConsumerRewardsService {
	public constructor(private readonly repository: RewardRepository) {}

	public async listMarketplace(query: RewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		const result = await this.repository.listMarketplace(query);
		return toPaginatedServiceResult(
			mapListResult(result, (row) => mapRewardToResponse(row, row.organization)),
			query,
		);
	}

	public async getPublishedReward(rewardId: string): Promise<RewardResponse> {
		const reward = await this.repository.findPublishedConsumerWithOrganization(rewardId);

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		return mapRewardToResponse(reward, reward.organization);
	}
}
