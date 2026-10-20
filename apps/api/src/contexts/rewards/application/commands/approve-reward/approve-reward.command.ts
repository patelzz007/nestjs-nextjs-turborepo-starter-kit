import { Command } from "@nestjs/cqrs";
import type { AdminRewardPathInput, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/rewards/:rewardId/approve`. */
export class ApproveRewardCommand extends Command<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminRewardPathInput,
	) {
		super();
	}
}
