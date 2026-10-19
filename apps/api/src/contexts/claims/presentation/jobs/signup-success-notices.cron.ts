import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { SweepSignupSuccessNoticesCommand } from "../../application/commands/sweep-signup-success-notices/sweep-signup-success-notices.command";
import { SIGNUP_SUCCESS_NOTICE_OPERATION } from "../../application/services/signup-success-notice.application-service";

/** The cron's name on its audit rows. */
const SWEEP_CRON_NAME = "SignupSuccessNoticesCron.sweep";

/**
 * Hourly, on every API replica: deliver every owed signup-referral success notice (ADR 035). Overlapping
 * runs are safe: each notice is claimed before it is written. A system command, audited by the
 * dispatcher; a run with failures rethrows so the scheduler logs it.
 */
@Injectable()
export class SignupSuccessNoticesCron {
	private readonly logger: Logger = new Logger(SignupSuccessNoticesCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async sweep(): Promise<void> {
		const swept = await this.dispatcher.dispatch(
			new SweepSignupSuccessNoticesCommand(systemActor(SIGNUP_SUCCESS_NOTICE_OPERATION, "cron", null, "Deliver owed signup referral success notifications", null)),
			{ kind: "cron", name: SWEEP_CRON_NAME },
		);
		if (swept.delivered > 0) {
			this.logger.log({ event: "signup_referral.notifications_swept", delivered: swept.delivered });
		}
	}
}
