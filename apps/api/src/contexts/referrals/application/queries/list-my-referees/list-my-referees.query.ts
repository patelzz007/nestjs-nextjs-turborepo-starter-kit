import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, SignupReferralRefereeItem, SignupReferralRefereeListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /auth/signup-referrals/referees`: the people who registered with the caller's codes. */
export class ListMyRefereesQuery extends Query<PaginatedServiceResult<SignupReferralRefereeItem>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SignupReferralRefereeListQuery,
	) {
		super();
	}
}
