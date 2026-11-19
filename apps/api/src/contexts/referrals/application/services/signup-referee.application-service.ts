import { Inject, Injectable } from "@nestjs/common";
import type { PaginatedServiceResult, SignupReferralRefereeItem, SignupReferralRefereeListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { actingUserId } from "../acting-user";
import type { SignupReferralReadPort } from "../ports/signup-referral-read.port";
import { SIGNUP_REFERRAL_READS } from "../ports/referrals.tokens";

/** The people the caller referred at signup (ADR 096). */
@Injectable()
export class SignupRefereeApplicationService {
	public constructor(@Inject(SIGNUP_REFERRAL_READS) private readonly reads: SignupReferralReadPort) {}

	/** The caller's referees, one page at a time (the caller is the scope, never input). */
	public async listMyReferees(actor: ActorContext, input: SignupReferralRefereeListQuery): Promise<PaginatedServiceResult<SignupReferralRefereeItem>> {
		return this.reads.listReferees(actor, actingUserId(actor), input);
	}
}
