import { Query } from "@nestjs/cqrs";
import type { AdminRewardPathInput, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/rewards/:rewardId`. */
export class GetRewardForAdminQuery extends Query<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminRewardPathInput,
	) {
		super();
	}
}
