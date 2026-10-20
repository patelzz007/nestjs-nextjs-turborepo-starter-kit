import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardResponse } from "@workspace/shared";

import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { ListRewardsPendingReviewQuery } from "./list-rewards-pending-review.query";

/** The moderation queue, oldest first. The route's `MANAGE REWARD` permission is the authorization. */
@QueryHandler(ListRewardsPendingReviewQuery)
export class ListRewardsPendingReviewHandler implements IQueryHandler<ListRewardsPendingReviewQuery, PaginatedServiceResult<RewardResponse>> {
	public constructor(@Inject(REWARD_READS) private readonly reads: RewardReadPort) {}

	public async execute(query: ListRewardsPendingReviewQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.reads.listPendingReview(query.actor, query.input);
	}
}
