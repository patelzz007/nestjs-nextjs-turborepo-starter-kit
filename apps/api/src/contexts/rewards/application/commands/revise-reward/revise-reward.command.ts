import { Command } from "@nestjs/cqrs";
import type { MerchantUpdateRewardInput, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PATCH /tenants/:tenantSlug/rewards/:rewardId`: the body plus the reward and the caller's tenant. */
export type ReviseRewardInput = MerchantUpdateRewardInput & { readonly tenantId: string; readonly rewardId: string };

export class ReviseRewardCommand extends Command<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReviseRewardInput,
	) {
		super();
	}
}
