import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { ReviewCustomerTiersCommand } from "../../application/commands/review-customer-tiers/review-customer-tiers.command";
import { TIER_STANDING_EVALUATE_OPERATION } from "../../application/ports/tiers.tokens";

/** The cron's name on its audit rows. */
const TIER_REVIEW_CRON_NAME = "TierReviewCron.review";

/**
 * Nightly at 03:00 in the platform's time zone (Malaysia), on every API replica (ADR 085): the tier review. Overlapping
 * runs are safe: each customer is evaluated under their own row lock, so a second run finds the change already made. A
 * system command, audited by the dispatcher; a run with failures rethrows so the scheduler logs it.
 */
@Injectable()
export class TierReviewCron {
	private readonly logger: Logger = new Logger(TierReviewCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: PLATFORM_DISPLAY_REGION.timeZone, waitForCompletion: true })
	public async review(): Promise<void> {
		const result = await this.dispatcher.dispatch(
			new ReviewCustomerTiersCommand(systemActor(TIER_STANDING_EVALUATE_OPERATION, "cron", null, "Nightly customer tier review", null)),
			{ kind: "cron", name: TIER_REVIEW_CRON_NAME },
		);
		if (result.reviewed > 0) {
			this.logger.log({ event: "tiers.reviewed", reviewed: result.reviewed });
		}
	}
}
