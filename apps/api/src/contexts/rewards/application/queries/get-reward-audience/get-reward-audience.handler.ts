import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type RewardAudienceResponse } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { RewardNotFoundError } from "../../../domain/errors/reward.errors";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_CUSTOMERS_READ_OPERATION, REWARD_READS, REWARDS_UNIT_OF_WORK } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { toRewardCustomer } from "../list-reward-customers/list-reward-customers.handler";
import { GetRewardAudienceQuery } from "./get-reward-audience.query";

/**
 * Who a reward was given to, for its editor: people who manage rewards, and only for a reward they may see
 * (one outside the caller's stores is 404, as everywhere else). A customer whose link is gone is left out.
 */
@QueryHandler(GetRewardAudienceQuery)
export class GetRewardAudienceHandler implements IQueryHandler<GetRewardAudienceQuery, RewardAudienceResponse> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REWARD_READS) private readonly reads: RewardReadPort,
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
	) {}

	public async execute(query: GetRewardAudienceQuery): Promise<RewardAudienceResponse> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.manageRewards });
		if ((await this.reads.findTenantReward(actor, grant, input.rewardId)) === null) {
			throw new RewardNotFoundError(input.rewardId);
		}
		return this.uow.runSystemOperation(REWARD_CUSTOMERS_READ_OPERATION, actor, async (scope): Promise<RewardAudienceResponse> => {
			const { audience } = (await scope.rewards.getConsumerInTenant(input.tenantId, input.rewardId)).snapshot();
			const customers = await scope.customers.summaries(input.tenantId, audience.customerIds);
			return { audienceType: audience.type, customers: customers.map(toRewardCustomer) };
		});
	}
}
