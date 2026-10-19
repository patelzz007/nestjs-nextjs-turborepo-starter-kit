import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { MaintainSignupReferralCodesCommand } from "../../application/commands/maintain-signup-referral-codes/maintain-signup-referral-codes.command";

/** The cron's name on its audit rows. */
const MAINTENANCE_CRON_NAME = "SignupReferralMaintenanceCron.maintain";

/**
 * Hourly, on every API replica: issue due signup referral codes (ADR 035). Overlapping runs are safe:
 * each user is handled under its own row lock. A system command, audited by the dispatcher; a run with
 * failures rethrows so the scheduler logs it. The owed success notices are swept by claims, which
 * delivers them.
 */
@Injectable()
export class SignupReferralMaintenanceCron {
	private readonly logger: Logger = new Logger(SignupReferralMaintenanceCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async maintain(): Promise<void> {
		const codes = await this.dispatcher.dispatch(
			new MaintainSignupReferralCodesCommand(systemActor("maintenance.signup_referral_codes", "cron", null, "Issue due signup referral codes", null)),
			{ kind: "cron", name: MAINTENANCE_CRON_NAME },
		);
		if (codes.firstCodes > 0 || codes.successors > 0) {
			this.logger.log({ event: "signup_referral.maintained", firstCodes: codes.firstCodes, successors: codes.successors });
		}
	}
}
