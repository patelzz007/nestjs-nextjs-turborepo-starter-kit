import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardListQuery, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /rewards` (public). */
export class ListMarketplaceRewardsQuery extends Query<PaginatedServiceResult<RewardResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RewardListQuery,
	) {
		super();
	}
}
