import {
	customerTierRank,
	ENTRY_CUSTOMER_TIER,
	epochMs,
	MS_PER_DAY,
	tierThreshold,
	type CustomerTier,
	type CustomerTierChangeReason,
	type EpochMs,
	type TierRules,
} from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { CustomerTierDemoted, CustomerTierDemotionWarned, CustomerTierPromoted, type TierDomainEvent } from "../events/tier.events";
import { countedAt, firstMomentBelow, tierAt, type CountedRedemption } from "../policies/tier-window.policy";

/** A demotion the customer was warned about: the tier they fall to, when, and when they were told. */
export interface DemotionWarning {
	readonly toTier: CustomerTier;
	readonly dueAt: EpochMs;
	readonly warnedAt: EpochMs;
}

/** A customer's standing as stored. `evaluatedAt` null: never evaluated, no row yet (Bronze). */
export interface CustomerTierStandingState {
	readonly userId: string;
	readonly tier: CustomerTier;
	readonly countedRedemptions: number;
	readonly promotedAt: EpochMs | null;
	readonly holdUntil: EpochMs | null;
	readonly warning: DemotionWarning | null;
	readonly evaluatedAt: EpochMs | null;
}

/** One tier change to append to the customer's tier history. */
export interface TierChangeRecord {
	readonly fromTier: CustomerTier;
	readonly toTier: CustomerTier;
	readonly reason: CustomerTierChangeReason;
	readonly countedRedemptions: number;
	readonly occurredAt: EpochMs;
}

function isAbove(tier: CustomerTier, other: CustomerTier): boolean {
	return customerTierRank(tier) > customerTierRank(other);
}

function daysMs(days: number): number {
	return days * MS_PER_DAY;
}

/**
 * One customer's tier (ADR 085): the consistency boundary the tiers context changes, always under a row lock. The rules
 * live here so every path (just after a redemption, the nightly review) applies them the same way:
 *
 * - a promotion happens as soon as the counted redemptions reach a higher tier, and starts a fresh tier hold;
 * - a demotion never happens inside a tier hold, and always after a warning given `warningDays` ahead;
 * - a demotion drops straight to the tier the counted redemptions earn when it falls due;
 * - a warning is withdrawn as soon as the customer no longer heads below their tier within the warning period.
 */
export class CustomerTierStanding extends AggregateRoot<TierDomainEvent> {
	public readonly userId: string;
	private tier: CustomerTier;
	private countedRedemptions: number;
	private promotedAt: EpochMs | null;
	private holdUntil: EpochMs | null;
	private warning: DemotionWarning | null;
	private evaluatedAt: EpochMs | null;
	private readonly recordedChanges: TierChangeRecord[] = [];

	private constructor(state: CustomerTierStandingState) {
		super();
		this.userId = state.userId;
		this.tier = state.tier;
		this.countedRedemptions = state.countedRedemptions;
		this.promotedAt = state.promotedAt;
		this.holdUntil = state.holdUntil;
		this.warning = state.warning;
		this.evaluatedAt = state.evaluatedAt;
	}

	/** A customer never evaluated: Bronze, no hold, no warning. */
	public static fresh(userId: string): CustomerTierStanding {
		return new CustomerTierStanding({
			userId,
			tier: ENTRY_CUSTOMER_TIER,
			countedRedemptions: 0,
			promotedAt: null,
			holdUntil: null,
			warning: null,
			evaluatedAt: null,
		});
	}

	public static rehydrate(state: CustomerTierStandingState): CustomerTierStanding {
		return new CustomerTierStanding(state);
	}

	public snapshot(): CustomerTierStandingState {
		return {
			userId: this.userId,
			tier: this.tier,
			countedRedemptions: this.countedRedemptions,
			promotedAt: this.promotedAt,
			holdUntil: this.holdUntil,
			warning: this.warning,
			evaluatedAt: this.evaluatedAt,
		};
	}

	/** Tier changes made since load, to append to the tier history. */
	public changes(): readonly TierChangeRecord[] {
		return [...this.recordedChanges];
	}

	/**
	 * Just after a redemption: promote when the customer reached a higher tier, and withdraw a warning they no longer
	 * need. Warnings and demotions wait for the nightly review.
	 */
	public afterRedemption(redemptions: readonly CountedRedemption[], rules: TierRules, now: EpochMs): void {
		this.countedRedemptions = countedAt(redemptions, now, rules);
		this.evaluatedAt = now;
		if (this.promoteIfEarned(redemptions, rules, now)) {
			return;
		}
		this.withdrawWarningIfKept(redemptions, rules, now);
	}

	/** The nightly review: promotions that were missed, then warnings due, demotions due and warnings no longer needed. */
	public review(redemptions: readonly CountedRedemption[], rules: TierRules, now: EpochMs): void {
		this.countedRedemptions = countedAt(redemptions, now, rules);
		this.evaluatedAt = now;
		if (this.promoteIfEarned(redemptions, rules, now)) {
			return;
		}
		const warning = this.warning;
		if (warning !== null && warning.dueAt <= now) {
			this.demoteOrKeep(redemptions, rules, now);
			return;
		}
		if (this.withdrawWarningIfKept(redemptions, rules, now) || this.warning !== null) {
			return;
		}
		this.warnIfDue(redemptions, rules, now);
	}

	/** The moment the customer would fall below their tier, no earlier than their hold's end; null when they never would. */
	private projectedDemotionAt(redemptions: readonly CountedRedemption[], rules: TierRules, now: EpochMs): EpochMs | null {
		if (this.tier === ENTRY_CUSTOMER_TIER) {
			return null;
		}
		const notBefore = this.holdUntil !== null && this.holdUntil > now ? this.holdUntil : now;
		return firstMomentBelow(redemptions, this.tier, notBefore, rules);
	}

	private promoteIfEarned(redemptions: readonly CountedRedemption[], rules: TierRules, now: EpochMs): boolean {
		const earned = tierAt(redemptions, now, rules);
		if (!isAbove(earned, this.tier)) {
			return false;
		}
		const from = this.tier;
		const holdUntil = epochMs(now + daysMs(rules.holdDays));
		this.tier = earned;
		this.promotedAt = now;
		this.holdUntil = holdUntil;
		this.warning = null;
		this.recordChange(from, earned, "PROMOTION", now);
		this.record(new CustomerTierPromoted(now, this.userId, from, earned, holdUntil));
		return true;
	}

	/** Withdraws the warning when the customer no longer heads below their tier within the warning period. */
	private withdrawWarningIfKept(redemptions: readonly CountedRedemption[], rules: TierRules, now: EpochMs): boolean {
		if (this.warning === null) {
			return false;
		}
		const projected = this.projectedDemotionAt(redemptions, rules, now);
		if (projected !== null && projected <= now + daysMs(rules.warningDays)) {
			return false;
		}
		this.warning = null;
		return true;
	}

	/**
	 * Warns once the projected demotion falls within the warning period. The demotion is then due a full warning period
	 * from now, never sooner: the nightly review finds it on the first night it comes within reach, so this is at most a
	 * day later than the projection, and a demotion found much closer (the rules just changed, say) still gets full notice.
	 */
	private warnIfDue(redemptions: readonly CountedRedemption[], rules: TierRules, now: EpochMs): void {
		const projected = this.projectedDemotionAt(redemptions, rules, now);
		const dueAt = epochMs(now + daysMs(rules.warningDays));
		if (projected === null || projected > dueAt) {
			return;
		}
		const toTier = tierAt(redemptions, dueAt, rules);
		const redemptionsToKeep = Math.max(0, tierThreshold(rules, this.tier) - countedAt(redemptions, dueAt, rules));
		this.warning = { toTier, dueAt, warnedAt: now };
		this.record(new CustomerTierDemotionWarned(now, this.userId, this.tier, toTier, dueAt, redemptionsToKeep));
	}

	/** The warning fell due: drop straight to the tier earned now, or keep the tier when it is still earned. */
	private demoteOrKeep(redemptions: readonly CountedRedemption[], rules: TierRules, now: EpochMs): void {
		this.warning = null;
		if (this.holdUntil !== null && this.holdUntil > now) {
			return;
		}
		const earned = tierAt(redemptions, now, rules);
		if (!isAbove(this.tier, earned)) {
			return;
		}
		const from = this.tier;
		this.tier = earned;
		this.recordChange(from, earned, "DEMOTION", now);
		this.record(new CustomerTierDemoted(now, this.userId, from, earned));
	}

	private recordChange(fromTier: CustomerTier, toTier: CustomerTier, reason: CustomerTierChangeReason, occurredAt: EpochMs): void {
		this.recordedChanges.push({ fromTier, toTier, reason, countedRedemptions: this.countedRedemptions, occurredAt });
	}
}
