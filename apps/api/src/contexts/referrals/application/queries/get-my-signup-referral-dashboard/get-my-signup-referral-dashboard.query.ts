import { Query } from "@nestjs/cqrs";
import type { SignupReferralDashboard } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /auth/signup-referrals/dashboard`: the caller's current code and whether it can be shared. */
export class GetMySignupReferralDashboardQuery extends Query<SignupReferralDashboard> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
