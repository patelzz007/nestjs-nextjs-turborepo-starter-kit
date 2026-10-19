import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ReferrerCreditEmailSweep } from "../../services/referrer-credit-email.application-service";

/** Request the referrer-credit emails still owed (BullMQ `rewardsReferralCreditNotify`, the backlog sweeper). */
export class SweepReferrerCreditEmailsCommand extends Command<ReferrerCreditEmailSweep> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
