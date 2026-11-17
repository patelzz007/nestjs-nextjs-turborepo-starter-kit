import { Command } from "@nestjs/cqrs";
import type { CustomerTier, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PUT /tenants/:tenantSlug/rewards/:rewardId/minimum-tier`: the new minimum tier, the reward and the caller's tenant. */
export interface SetRewardMinimumTierInput {
	readonly tenantId: string;
	readonly rewardId: string;
	readonly minimumTier: CustomerTier;
}

/** Who may claim a reward from now on (ADR 085): any status with claims ahead, published too, without another review. */
export class SetRewardMinimumTierCommand extends Command<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SetRewardMinimumTierInput,
	) {
		super();
	}
}
