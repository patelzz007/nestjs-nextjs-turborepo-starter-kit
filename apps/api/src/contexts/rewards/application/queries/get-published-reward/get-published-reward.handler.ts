import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import { RewardNotFoundError } from "../../../domain/errors/reward.errors";
import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { GetPublishedRewardQuery } from "./get-published-reward.query";

/** One published consumer reward; anything else is 404. */
@QueryHandler(GetPublishedRewardQuery)
export class GetPublishedRewardHandler implements IQueryHandler<GetPublishedRewardQuery, RewardResponse> {
	public constructor(@Inject(REWARD_READS) private readonly reads: RewardReadPort) {}

	public async execute(query: GetPublishedRewardQuery): Promise<RewardResponse> {
		const reward = await this.reads.findPublished(query.actor, query.input.rewardId);
		if (reward === null) {
			throw new RewardNotFoundError(query.input.rewardId);
		}
		return reward;
	}
}
