import type { EpochMs, TierRules } from "@workspace/shared";

import type { CustomerTierStanding } from "../../domain/aggregates/customer-tier-standing.aggregate";
import type { CountedRedemption } from "../../domain/policies/tier-window.policy";

/** A customer's standing inside one evaluation's transaction (ADR 085). */
export interface TierStandingRepository {
	/**
	 * The customer's standing, locked for the rest of the transaction so two evaluations of one customer never
	 * interleave (a redemption's and the nightly review's, or two replicas'); a fresh Bronze standing when there is none.
	 */
	lockForEvaluation(userId: string): Promise<CustomerTierStanding>;
	/** Writes the standing and appends its new tier changes to the tier history. */
	save(standing: CustomerTierStanding): Promise<void>;
}

/** The redemptions that count toward a tier: the customer's, minus those made while a member of that merchant. */
export interface CountedRedemptionsPort {
	/** The customer's counted redemptions made after `since` (oldest first). */
	countedSince(userId: string, since: EpochMs): Promise<readonly CountedRedemption[]>;
}

/** The tier rules in force: the stored ones, else `DEFAULT_TIER_RULES`. */
export interface TierRulesPort {
	current(): Promise<TierRules>;
}
