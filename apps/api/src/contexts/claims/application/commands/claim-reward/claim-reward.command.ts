import { Command } from "@nestjs/cqrs";
import type { CreateRewardClaimInput, RewardClaimCreatedResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /claims`. */
export class ClaimRewardCommand extends Command<RewardClaimCreatedResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateRewardClaimInput,
	) {
		super();
	}
}
