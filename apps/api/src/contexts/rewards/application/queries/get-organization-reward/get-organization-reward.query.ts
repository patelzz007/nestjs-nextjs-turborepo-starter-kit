import { Query } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /orgs/:orgSlug/rewards/:rewardId`. */
export interface GetOrganizationRewardInput {
	readonly organizationId: string;
	readonly rewardId: string;
}

export class GetOrganizationRewardQuery extends Query<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetOrganizationRewardInput,
	) {
		super();
	}
}
