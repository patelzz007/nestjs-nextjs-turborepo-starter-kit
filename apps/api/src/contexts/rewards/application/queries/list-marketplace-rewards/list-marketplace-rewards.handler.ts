import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardResponse } from "@workspace/shared";

import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { ListMarketplaceRewardsQuery } from "./list-marketplace-rewards.query";

/** Published, in-stock, unexpired consumer rewards — public, one page at a time. */
@QueryHandler(ListMarketplaceRewardsQuery)
export class ListMarketplaceRewardsHandler implements IQueryHandler<ListMarketplaceRewardsQuery, PaginatedServiceResult<RewardResponse>> {
	public constructor(@Inject(REWARD_READS) private readonly reads: RewardReadPort) {}

	public async execute(query: ListMarketplaceRewardsQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.reads.listMarketplace(query.actor, query.input);
	}
}
