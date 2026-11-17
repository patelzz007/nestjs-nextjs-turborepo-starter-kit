import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardResponse } from "@workspace/shared";

import { actingUserId } from "../../../../../platform/application/actor-context";
import { CUSTOMER_TIER_ACCESS, type CustomerTierAccessPort } from "../../../../../platform/application/ports/customer-tier-access.port";
import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { ListMarketplaceRewardsQuery } from "./list-marketplace-rewards.query";

/**
 * Published, in-stock, unexpired consumer rewards — public, one page at a time. By default only those the viewer can
 * claim by tier (a signed-out visitor is Bronze); with `includeLocked`, the higher-tier ones too, to show locked (ADR 085).
 */
@QueryHandler(ListMarketplaceRewardsQuery)
export class ListMarketplaceRewardsHandler implements IQueryHandler<ListMarketplaceRewardsQuery, PaginatedServiceResult<RewardResponse>> {
	public constructor(
		@Inject(REWARD_READS) private readonly reads: RewardReadPort,
		@Inject(CUSTOMER_TIER_ACCESS) private readonly tiers: Pick<CustomerTierAccessPort, "accessFor">,
	) {}

	public async execute(query: ListMarketplaceRewardsQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		const tierAccess = await this.tiers.accessFor(actingUserId(query.actor));
		return this.reads.listMarketplace(query.actor, query.input, tierAccess);
	}
}
