import { Query } from "@nestjs/cqrs";
import type { RewardsAnalyticsQuery, UserRewardsAnalyticsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetConsumerClaimAnalyticsInput {
	readonly query: RewardsAnalyticsQuery;
}

/** The signed-in customer's own weekly analytics (`GET /claims/analytics`): self only, the user comes from the actor. */
export class GetConsumerClaimAnalyticsQuery extends Query<UserRewardsAnalyticsResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetConsumerClaimAnalyticsInput,
	) {
		super();
	}
}
