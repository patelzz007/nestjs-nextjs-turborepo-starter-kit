import { Query } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /tenants/:tenantSlug/rewards/:rewardId`. */
export interface GetTenantRewardInput {
	readonly tenantId: string;
	readonly rewardId: string;
}

export class GetTenantRewardQuery extends Query<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetTenantRewardInput,
	) {
		super();
	}
}
