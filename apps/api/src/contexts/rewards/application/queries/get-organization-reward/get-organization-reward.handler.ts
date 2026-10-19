import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type RewardResponse } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { RewardNotFoundError } from "../../../domain/errors/reward.errors";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { GetOrganizationRewardQuery } from "./get-organization-reward.query";

/** One reward as the merchant sees it; one not offered at any of the caller's stores is 404, exactly as it is absent from the list. */
@QueryHandler(GetOrganizationRewardQuery)
export class GetOrganizationRewardHandler implements IQueryHandler<GetOrganizationRewardQuery, RewardResponse> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REWARD_READS) private readonly reads: RewardReadPort,
	) {}

	public async execute(query: GetOrganizationRewardQuery): Promise<RewardResponse> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, { organizationId: input.organizationId, capability: MERCHANT_CAPABILITY.viewRewards });
		const reward = await this.reads.findOrganizationReward(actor, grant, input.rewardId);
		if (reward === null) {
			throw new RewardNotFoundError(input.rewardId);
		}
		return reward;
	}
}
