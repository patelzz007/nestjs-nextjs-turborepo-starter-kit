import { Command } from "@nestjs/cqrs";
import type { RewardReferralAttributionResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /referrals/attribution`: the caller opened a referral link; remember it for their next claim. */
export class RecordRewardReferralAttributionCommand extends Command<RewardReferralAttributionResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly attributionToken: string,
	) {
		super();
	}
}
