import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { systemActor } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { ReferrerCredited } from "../../../../referrals/public-api";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { REFERRER_CREDIT_EMAIL_OPERATION, ReferrerCreditEmailApplicationService } from "../../services/referrer-credit-email.application-service";

/**
 * After the checkout committed: request the credited referrer's email right away. The sale is final
 * either way: a failure is logged and the referral stays owed for the `rewardsReferralCreditNotify`
 * sweeper, never surfaced to the till.
 */
@EventsHandler(ReferrerCredited)
export class RequestReferrerCreditEmailOnReferrerCredited implements IEventHandler<ReferrerCredited> {
	private readonly logger: Logger = new Logger(RequestReferrerCreditEmailOnReferrerCredited.name);
	private readonly emails: ReferrerCreditEmailApplicationService;

	public constructor(@Inject(CLAIMS_UNIT_OF_WORK) uow: UnitOfWork<ClaimsScope>, @Inject(CLOCK) clock: Clock) {
		this.emails = new ReferrerCreditEmailApplicationService(uow, clock);
	}

	public async handle(event: ReferrerCredited): Promise<void> {
		const actor = systemActor(REFERRER_CREDIT_EMAIL_OPERATION, "consumer", null, "Request a credited referrer's email", null);
		try {
			await this.emails.request(actor, { referralId: event.referralId, referrerUserId: event.referrerUserId });
		} catch (error) {
			this.logger.error({ event: "referrals.referrer_credit_email_deferred", referralId: event.referralId, error: error instanceof Error ? error.message : String(error) });
		}
	}
}
