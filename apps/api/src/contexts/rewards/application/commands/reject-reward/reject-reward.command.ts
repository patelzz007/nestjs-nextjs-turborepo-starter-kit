import { Command } from "@nestjs/cqrs";
import type { AdminRejectRewardPathInput, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/rewards/:rewardId/reject` (the reviewer's reason is required). */
export class RejectRewardCommand extends Command<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminRejectRewardPathInput,
	) {
		super();
	}
}
