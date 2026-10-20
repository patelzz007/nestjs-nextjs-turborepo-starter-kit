import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import { RewardNotFoundError } from "../../../domain/errors/reward.errors";
import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { GetRewardForAdminQuery } from "./get-reward-for-admin.query";

/** One consumer reward in full, whatever its status — reviewers keep the page after deciding. */
@QueryHandler(GetRewardForAdminQuery)
export class GetRewardForAdminHandler implements IQueryHandler<GetRewardForAdminQuery, RewardResponse> {
	public constructor(@Inject(REWARD_READS) private readonly reads: RewardReadPort) {}

	public async execute(query: GetRewardForAdminQuery): Promise<RewardResponse> {
		const reward = await this.reads.findConsumerForReview(query.actor, query.input.rewardId);
		if (reward === null) {
			throw new RewardNotFoundError(query.input.rewardId);
		}
		return reward;
	}
}
