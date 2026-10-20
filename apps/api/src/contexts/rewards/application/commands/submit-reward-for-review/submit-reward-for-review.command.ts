import { Command } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /tenants/:tenantSlug/rewards/:rewardId/publish`. */
export interface SubmitRewardForReviewInput {
	readonly tenantId: string;
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
