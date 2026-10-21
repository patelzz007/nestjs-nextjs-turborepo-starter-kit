import { Command } from "@nestjs/cqrs";
import type { RewardReferralLinkResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /referrals/rewards/:rewardId/links`: mint one share link of the caller for a reward. */
export class CreateRewardReferralLinkCommand extends Command<RewardReferralLinkResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly rewardId: string,
	) {
		super();
	}
}
