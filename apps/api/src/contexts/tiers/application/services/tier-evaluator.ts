import { epochMs, type CustomerTier } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { windowMs } from "../../domain/policies/tier-window.policy";
import { TIER_STANDING_EVALUATE_OPERATION } from "../ports/tiers.tokens";
import type { TiersScope } from "../tiers-scope";

/** Why a customer is evaluated: just after one of their redemptions, or by the nightly review. */
export type TierEvaluationTrigger = "redemption" | "review";

/**
 * Evaluates one customer's tier in its own transaction (ADR 085): lock the standing, read the rules and the counted
 * redemptions in the window, apply the aggregate's rule for the trigger, save, and send the notices of what changed —
 * all or nothing. Used by the evaluation after a redemption and by the nightly review, so both apply the same rules.
 */
export class TierEvaluator {
	public constructor(
		private readonly uow: UnitOfWork<TiersScope>,
		private readonly clock: Clock,
	) {}

	/** The customer's tier after the evaluation. */
	public evaluate(actor: ActorContext, userId: string, trigger: TierEvaluationTrigger): Promise<CustomerTier> {
		return this.uow.runSystemOperation(TIER_STANDING_EVALUATE_OPERATION, actor, async (scope: TiersScope): Promise<CustomerTier> => {
			const now = this.clock.now();
			const rules = await scope.rules.current();
			const standing = await scope.standings.lockForEvaluation(userId);
			const redemptions = await scope.redemptions.countedSince(userId, epochMs(Math.max(0, now - windowMs(rules))));
			if (trigger === "redemption") {
				standing.afterRedemption(redemptions, rules, now);
			} else {
				standing.review(redemptions, rules, now);
			}
			await scope.standings.save(standing);
			for (const event of standing.pullEvents()) {
				await scope.notices.send(event);
			}
			return standing.snapshot().tier;
		});
	}
}
