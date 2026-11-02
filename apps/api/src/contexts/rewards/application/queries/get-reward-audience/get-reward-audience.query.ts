import { Query } from "@nestjs/cqrs";
import type { RewardAudienceResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /tenants/:tenantSlug/rewards/:rewardId/audience`. */
export interface GetRewardAudienceInput {
	readonly tenantId: string;
	readonly rewardId: string;
}

export class GetRewardAudienceQuery extends Query<RewardAudienceResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetRewardAudienceInput,
	) {
		super();
	}
}
