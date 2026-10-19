import { Query } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /rewards/:rewardId` (public). */
export interface GetPublishedRewardInput {
	readonly rewardId: string;
}

export class GetPublishedRewardQuery extends Query<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetPublishedRewardInput,
	) {
		super();
	}
}
