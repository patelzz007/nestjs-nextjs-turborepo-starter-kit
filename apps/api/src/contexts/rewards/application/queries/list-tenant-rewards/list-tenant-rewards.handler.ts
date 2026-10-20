import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type PaginatedServiceResult, type RewardResponse } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { ListTenantRewardsQuery } from "./list-tenant-rewards.query";

/** One page of the tenant's rewards available at the caller's stores (one store when `locationId` narrows it). */
@QueryHandler(ListTenantRewardsQuery)
export class ListTenantRewardsHandler implements IQueryHandler<ListTenantRewardsQuery, PaginatedServiceResult<RewardResponse>> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REWARD_READS) private readonly reads: RewardReadPort,
	) {}

	public async execute(query: ListTenantRewardsQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		const { actor, input } = query;
		const grant = await this.merchantAccess.assertCapability(actor, {
			tenantId: input.tenantId,
			capability: MERCHANT_CAPABILITY.viewRewards,
			locationId: input.locationId ?? null,
		});
		return this.reads.listTenantRewards(actor, grant, input);
	}
}
