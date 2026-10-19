import { Command } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /orgs/:orgSlug/rewards/:rewardId/publish`. */
export interface SubmitRewardForReviewInput {
	readonly organizationId: string;
	readonly rewardId: string;
}

export class SubmitRewardForReviewCommand extends Command<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SubmitRewardForReviewInput,
	) {
		super();
	}
}
