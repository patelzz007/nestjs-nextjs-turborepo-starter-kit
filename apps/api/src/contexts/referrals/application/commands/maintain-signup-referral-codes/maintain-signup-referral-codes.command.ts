import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** What one run of the code job did. */
export interface SignupReferralCodeJobResult {
	readonly firstCodes: number;
	readonly successors: number;
	readonly failed: number;
}

/** Users the code job reads per page; it pages until no user needs a code. */
export const SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE = 200;

/** The hourly code job (ADR 035, "Job"): a first code for every live user with none, a successor for every user whose latest code expired. */
export class MaintainSignupReferralCodesCommand extends Command<SignupReferralCodeJobResult> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
