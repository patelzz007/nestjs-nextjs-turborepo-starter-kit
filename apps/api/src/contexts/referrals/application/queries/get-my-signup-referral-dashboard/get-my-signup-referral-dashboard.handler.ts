import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { SignupReferralDashboard } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { signupReferralDashboardOf } from "../../../domain/policies/signup-referral-dashboard.policy";
import { actingUserId } from "../../acting-user";
import type { SignupReferralReadPort } from "../../ports/signup-referral-read.port";
import { SIGNUP_REFERRAL_READS } from "../../ports/referrals.tokens";
import { GetMySignupReferralDashboardQuery } from "./get-my-signup-referral-dashboard.query";

/** A read, never a write: an account the code job has not backfilled yet gets `pending` (ADR 035, "Consumer read"). */
@QueryHandler(GetMySignupReferralDashboardQuery)
export class GetMySignupReferralDashboardHandler implements IQueryHandler<GetMySignupReferralDashboardQuery, SignupReferralDashboard> {
	public constructor(
		@Inject(SIGNUP_REFERRAL_READS) private readonly reads: SignupReferralReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: GetMySignupReferralDashboardQuery): Promise<SignupReferralDashboard> {
		const facts = await this.reads.dashboardFacts(query.actor, actingUserId(query.actor));
		return signupReferralDashboardOf(facts, this.clock.now());
	}
}
