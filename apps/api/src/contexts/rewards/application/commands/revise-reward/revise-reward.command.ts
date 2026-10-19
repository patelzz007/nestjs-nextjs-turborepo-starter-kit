import { Command } from "@nestjs/cqrs";
import type { MerchantUpdateRewardInput, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PATCH /orgs/:orgSlug/rewards/:rewardId`: the body plus the reward and the caller's organization. */
export type ReviseRewardInput = MerchantUpdateRewardInput & { readonly organizationId: string; readonly rewardId: string };

export class ReviseRewardCommand extends Command<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReviseRewardInput,
	) {
		super();
	}
}
