import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, SignupReferralRefereeItem } from "@workspace/shared";

import { actingUserId } from "../../acting-user";
import type { SignupReferralReadPort } from "../../ports/signup-referral-read.port";
import { SIGNUP_REFERRAL_READS } from "../../ports/referrals.tokens";
import { ListMyRefereesQuery } from "./list-my-referees.query";

/** The caller's referees, one page at a time (the caller is the scope, never input). */
@QueryHandler(ListMyRefereesQuery)
export class ListMyRefereesHandler implements IQueryHandler<ListMyRefereesQuery, PaginatedServiceResult<SignupReferralRefereeItem>> {
	public constructor(@Inject(SIGNUP_REFERRAL_READS) private readonly reads: SignupReferralReadPort) {}

	public async execute(query: ListMyRefereesQuery): Promise<PaginatedServiceResult<SignupReferralRefereeItem>> {
		return this.reads.listReferees(query.actor, actingUserId(query.actor), query.input);
	}
}
