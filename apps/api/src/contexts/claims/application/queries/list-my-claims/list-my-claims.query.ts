import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardClaimListQuery, RewardClaimResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /claims`. */
export class ListMyClaimsQuery extends Query<PaginatedServiceResult<RewardClaimResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RewardClaimListQuery,
	) {
		super();
	}
}
