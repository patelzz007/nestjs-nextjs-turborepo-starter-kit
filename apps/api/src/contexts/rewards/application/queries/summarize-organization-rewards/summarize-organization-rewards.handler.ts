import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type MerchantRewardSummary } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { SummarizeOrganizationRewardsQuery } from "./summarize-organization-rewards.query";

/** Catalog figures over every reward available at the caller's stores (one store when `locationId` narrows it). */
@QueryHandler(SummarizeOrganizationRewardsQuery)
export class SummarizeOrganizationRewardsHandler implements IQueryHandler<SummarizeOrganizationRewardsQuery, MerchantRewardSummary> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REWARD_READS) private readonly reads: RewardReadPort,
	) {}

	public async execute(query: SummarizeOrganizationRewardsQuery): Promise<MerchantRewardSummary> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, {
			organizationId: input.organizationId,
			capability: MERCHANT_CAPABILITY.viewRewards,
			locationId: input.locationId ?? null,
		});
		return this.reads.summarizeOrganizationRewards(actor, grant);
	}
}
