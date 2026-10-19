import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SignupSuccessNoticeSweep } from "../../services/signup-success-notice.application-service";

/** The backlog sweeper: every owed signup-referral success notice, oldest success first (ADR 035, "Notification"). */
export class SweepSignupSuccessNoticesCommand extends Command<SignupSuccessNoticeSweep> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
