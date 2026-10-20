import { Query } from "@nestjs/cqrs";
import type { AdminPendingRewardListQuery, PaginatedServiceResult, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/rewards/pending`. */
export class ListRewardsPendingReviewQuery extends Query<PaginatedServiceResult<RewardResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminPendingRewardListQuery,
	) {
		super();
	}
}
