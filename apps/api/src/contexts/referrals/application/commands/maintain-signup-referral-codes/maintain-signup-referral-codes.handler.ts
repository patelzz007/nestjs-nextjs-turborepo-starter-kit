import { CaughtValueSchema } from "@workspace/shared";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { SignupReferralJobItemsFailedError } from "../../errors/signup-referral.errors";
import type { CodeMaintenanceOutcome, SignupReferralCodeMaintenancePort } from "../../ports/signup-referral-maintenance.port";
import { SIGNUP_REFERRAL_CODE_MAINTENANCE } from "../../ports/referrals.tokens";
import { MaintainSignupReferralCodesCommand, SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE, type SignupReferralCodeJobResult } from "./maintain-signup-referral-codes.command";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";

/**
 * Pages through only the users that need a code and handles each in its own transaction under that
 * user's row lock, so overlapping runs on several replicas issue one code, not two. One user's
 * failure is logged and does not stop the run; the run then throws `SignupReferralJobItemsFailedError`
 * so it is audited as failed (the user stays due for the next run).
 */
@CommandHandler(MaintainSignupReferralCodesCommand)
export class MaintainSignupReferralCodesHandler implements ICommandHandler<MaintainSignupReferralCodesCommand, SignupReferralCodeJobResult> {
	private readonly logger: Logger = new Logger(MaintainSignupReferralCodesHandler.name);

	public constructor(
		@Inject(SIGNUP_REFERRAL_CODE_MAINTENANCE) private readonly codes: SignupReferralCodeMaintenancePort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(_command: MaintainSignupReferralCodesCommand): Promise<SignupReferralCodeJobResult> {
		let firstCodes = 0;
		let successors = 0;
		const failures: Error[] = [];
		let cursor: string | null = null;
		for (;;) {
			const userIds: readonly string[] = await this.codes.listUserIdsNeedingCode(this.clock.now(), SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE, cursor);
			const lastUserId = userIds.at(-1);
			if (lastUserId === undefined) {
				break;
			}
			cursor = lastUserId;
			for (const userId of userIds) {
				try {
					const outcome: CodeMaintenanceOutcome = await this.codes.issueCodeIfDue(userId, this.clock.now());
					firstCodes += outcome === "first" ? 1 : 0;
					successors += outcome === "successor" ? 1 : 0;
				} catch (error) {
					failures.push(error instanceof Error ? error : new Error(String(error)));
					this.logger.error({ event: "signup_referral.code_issue_failed", userId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
				}
			}
		}
		const result: SignupReferralCodeJobResult = { firstCodes, successors, failed: failures.length };
		const [firstFailure] = failures;
		if (firstFailure !== undefined) {
			this.logger.error({ event: "signup_referral.codes_run_failed", ...result });
			throw new SignupReferralJobItemsFailedError(failures.length, firstFailure);
		}
		return result;
	}
}
