import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type RewardResponse, type RewardViewerCapabilities } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { MerchantAccessPort, MerchantAccessTarget, MerchantCapabilityQueryPort } from "../../../../../platform/application/ports/authorization.port";
import { RewardNotFoundError } from "../../../domain/errors/reward.errors";
import { MERCHANT_ACCESS, MERCHANT_CAPABILITY_QUERY } from "../../../../tenancy/public-api";
import type { RewardReadPort } from "../../ports/reward-read.port";
import { REWARD_READS } from "../../ports/rewards.tokens";
import { GetTenantRewardQuery } from "./get-tenant-reward.query";

/**
 * One reward as the merchant sees it; one not offered at any of the caller's stores is 404, exactly as it is absent
 * from the list. Decided for THIS reward (ADR 067): a share of it lets a member read it without reward.read. A member
 * also gets what the reward allows them (`viewerCapabilities`), decided the same way per record.
 */
@QueryHandler(GetTenantRewardQuery)
export class GetTenantRewardHandler implements IQueryHandler<GetTenantRewardQuery, RewardResponse> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(MERCHANT_CAPABILITY_QUERY) private readonly capabilities: MerchantCapabilityQueryPort,
		@Inject(REWARD_READS) private readonly reads: RewardReadPort,
	) {}

	public async execute(query: GetTenantRewardQuery): Promise<RewardResponse> {
		const { actor, input } = query;
		const target: MerchantAccessTarget = { resource: "REWARD", resourceId: input.rewardId };
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.viewRewards, target });
		const reward = await this.reads.findTenantReward(actor, grant, input.rewardId);
		if (reward === null) {
			throw new RewardNotFoundError(input.rewardId);
		}
		if (actor.kind !== "user") {
			return reward;
		}
		return { ...reward, viewerCapabilities: await this.viewerCapabilities(actor, input.tenantId, target) };
	}

	private async viewerCapabilities(actor: ActorContext, tenantId: string, target: MerchantAccessTarget): Promise<RewardViewerCapabilities> {
		const [update, publish] = await Promise.all([
			this.capabilities.holds(actor, { tenantId, capability: MERCHANT_CAPABILITY.manageRewards, target }),
			this.capabilities.holds(actor, { tenantId, capability: MERCHANT_CAPABILITY.publishRewards, target }),
		]);
		return { update, publish };
	}
}
