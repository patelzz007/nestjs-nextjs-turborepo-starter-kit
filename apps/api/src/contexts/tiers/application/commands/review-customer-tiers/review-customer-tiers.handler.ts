import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CaughtValueSchema, epochMs, MS_PER_DAY } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";
import { TierReviewItemsFailedError } from "../../errors/tier-review.errors";
import type { TierReviewCandidatesPort } from "../../ports/tier-review-candidates.port";
import type { TiersAvailabilityPort } from "../../ports/tiers-availability.port";
import { TIER_EVALUATOR, TIER_REVIEW_CANDIDATES, TIERS_AVAILABILITY } from "../../ports/tiers.tokens";
import type { TierEvaluator } from "../../services/tier-evaluator";
import { ReviewCustomerTiersCommand, TIER_REVIEW_PAGE_SIZE, TIER_REVIEW_RECENT_DAYS, type TierReviewResult } from "./review-customer-tiers.command";

/**
 * Pages through the review's customers and evaluates each in their own transaction under their row lock, so overlapping
 * runs on several replicas apply each change once (a second run finds the warning given, the demotion made). One
 * customer's failure is logged and does not stop the run; the run then throws {@link TierReviewItemsFailedError} so it
 * is audited as failed (the customer is reviewed again next night). Nothing runs while tiers are off.
 */
@CommandHandler(ReviewCustomerTiersCommand)
export class ReviewCustomerTiersHandler implements ICommandHandler<ReviewCustomerTiersCommand, TierReviewResult> {
	private readonly logger: Logger = new Logger(ReviewCustomerTiersHandler.name);

	public constructor(
		@Inject(TIERS_AVAILABILITY) private readonly availability: TiersAvailabilityPort,
		@Inject(TIER_REVIEW_CANDIDATES) private readonly candidates: TierReviewCandidatesPort,
		@Inject(TIER_EVALUATOR) private readonly evaluator: Pick<TierEvaluator, "evaluate">,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReviewCustomerTiersCommand): Promise<TierReviewResult> {
		if (!(await this.availability.isOn())) {
			return { reviewed: 0, failed: 0 };
		}
		const recentSince = epochMs(Math.max(0, this.clock.now() - TIER_REVIEW_RECENT_DAYS * MS_PER_DAY));
		let reviewed = 0;
		const failures: Error[] = [];
		let cursor: string | null = null;
		for (;;) {
			const userIds: readonly string[] = await this.candidates.page(cursor, TIER_REVIEW_PAGE_SIZE, recentSince);
			const lastUserId = userIds.at(-1);
			if (lastUserId === undefined) {
				break;
			}
			cursor = lastUserId;
			for (const userId of userIds) {
				try {
					await this.evaluator.evaluate(command.actor, userId, "review");
					reviewed += 1;
				} catch (error) {
					failures.push(error instanceof Error ? error : new Error(String(error)));
					this.logger.error({ event: "tiers.review_failed", userId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
				}
			}
		}
		const result: TierReviewResult = { reviewed, failed: failures.length };
		const [firstFailure] = failures;
		if (firstFailure !== undefined) {
			this.logger.error({ event: "tiers.review_run_failed", ...result });
			throw new TierReviewItemsFailedError(failures.length, firstFailure);
		}
		return result;
	}
}
