import { CaughtValueSchema } from "@workspace/shared";
import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { systemActor } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { SignupReferralSucceeded } from "../../../../referrals/public-api";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { SIGNUP_SUCCESS_NOTICE_OPERATION, SignupSuccessNoticeApplicationService } from "../../services/signup-success-notice.application-service";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";

/**
 * After the checkout committed: deliver the referrer's "referral successful" notice for the referral
 * it stamped, as a system operation (the till's key may not write it). The sale is final either way: a
 * failure is logged and left owed for the hourly `SweepSignupSuccessNotices` sweeper.
 */
@EventsHandler(SignupReferralSucceeded)
export class DeliverSignupSuccessNoticeOnSignupReferralSucceeded implements IEventHandler<SignupReferralSucceeded> {
	private readonly logger: Logger = new Logger(DeliverSignupSuccessNoticeOnSignupReferralSucceeded.name);
	private readonly notices: SignupSuccessNoticeApplicationService;

	public constructor(@Inject(CLAIMS_UNIT_OF_WORK) uow: UnitOfWork<ClaimsScope>, @Inject(CLOCK) clock: Clock) {
		this.notices = new SignupSuccessNoticeApplicationService(uow, clock);
	}

	public async handle(event: SignupReferralSucceeded): Promise<void> {
		const actor = systemActor(SIGNUP_SUCCESS_NOTICE_OPERATION, "consumer", null, "Deliver a signup referral success notice", null);
		try {
			await this.notices.deliver(actor, event.signupReferralId);
		} catch (error) {
			this.logger.error({
				event: "signup_referral.notification_deferred",
				signupReferralId: event.signupReferralId,
				...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data),
			});
		}
	}
}
