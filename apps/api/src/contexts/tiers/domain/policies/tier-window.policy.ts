import { customerTierRank, epochMs, MS_PER_DAY, tierForCount, type CustomerTier, type EpochMs, type TierRules } from "@workspace/shared";

/**
 * One redemption that counts toward a tier (ADR 085): the merchant it was at and when. A redemption at a store where
 * the customer was a member at that moment is never one of these: the read side leaves it out.
 */
export interface CountedRedemption {
	readonly tenantId: string;
	readonly redeemedAt: EpochMs;
}

/** How many of one merchant's redemptions count in a window, and how many more still would under the cap. */
export interface MerchantCount {
	readonly tenantId: string;
	readonly counted: number;
	readonly remainingUnderCap: number;
}

/** A moment counted redemptions leave the window, and how much the count drops then. */
export interface DropOff {
	readonly at: EpochMs;
	readonly count: number;
}

/** The tier window's length in milliseconds. */
export function windowMs(rules: TierRules): number {
	return rules.windowDays * MS_PER_DAY;
}

/** Whether `redeemedAt` is inside the window ending at `at`: (at − window, at]. */
function isInWindow(redeemedAt: EpochMs, at: EpochMs, rules: TierRules): boolean {
	return redeemedAt <= at && redeemedAt > at - windowMs(rules);
}

/** Each merchant's redemptions inside the window ending at `at`, before the cap. */
function perMerchantInWindow(redemptions: readonly CountedRedemption[], at: EpochMs, rules: TierRules): ReadonlyMap<string, number> {
	const counts = new Map<string, number>();
	for (const redemption of redemptions) {
		if (isInWindow(redemption.redeemedAt, at, rules)) {
			counts.set(redemption.tenantId, (counts.get(redemption.tenantId) ?? 0) + 1);
		}
	}
	return counts;
}

/** The counted redemptions in the window ending at `at`: each merchant's, capped at `perMerchantCap`, summed. */
export function countedAt(redemptions: readonly CountedRedemption[], at: EpochMs, rules: TierRules): number {
	let total = 0;
	for (const count of perMerchantInWindow(redemptions, at, rules).values()) {
		total += Math.min(count, rules.perMerchantCap);
	}
	return total;
}

/** The tier the counted redemptions in the window ending at `at` reach. */
export function tierAt(redemptions: readonly CountedRedemption[], at: EpochMs, rules: TierRules): CustomerTier {
	return tierForCount(rules, countedAt(redemptions, at, rules));
}

/** Each merchant's counted redemptions in the window ending at `at`, most counted first (ties by tenant id). */
export function merchantCountsAt(redemptions: readonly CountedRedemption[], at: EpochMs, rules: TierRules): readonly MerchantCount[] {
	return [...perMerchantInWindow(redemptions, at, rules).entries()]
		.map(([tenantId, count]): MerchantCount => {
			const counted = Math.min(count, rules.perMerchantCap);
			return { tenantId, counted, remainingUnderCap: rules.perMerchantCap - counted };
		})
		.sort((left: MerchantCount, right: MerchantCount): number => right.counted - left.counted || left.tenantId.localeCompare(right.tenantId));
}

/** When each redemption leaves the window: the first moment it is no longer inside (redeemedAt + window). */
function leavesWindowAt(redemption: CountedRedemption, rules: TierRules): EpochMs {
	return epochMs(redemption.redeemedAt + windowMs(rules));
}

/**
 * The moments from `from` on at which the count can drop (no new redemptions assumed), soonest first, each once.
 * The count only falls when a redemption leaves the window, so these are the only moments worth looking at.
 */
function futureDropMoments(redemptions: readonly CountedRedemption[], from: EpochMs, rules: TierRules): readonly EpochMs[] {
	const moments = new Set<EpochMs>();
	for (const redemption of redemptions) {
		const leaves = leavesWindowAt(redemption, rules);
		if (leaves > from) {
			moments.add(leaves);
		}
	}
	return [...moments].sort((left: EpochMs, right: EpochMs): number => left - right);
}

/**
 * The first moment at or after `notBefore` at which the counted redemptions no longer hold `tier`, assuming the customer
 * redeems nothing more; null when they hold it for good (Bronze needs nothing).
 */
export function firstMomentBelow(redemptions: readonly CountedRedemption[], tier: CustomerTier, notBefore: EpochMs, rules: TierRules): EpochMs | null {
	if (customerTierRank(tierAt(redemptions, notBefore, rules)) < customerTierRank(tier)) {
		return notBefore;
	}
	for (const moment of futureDropMoments(redemptions, notBefore, rules)) {
		if (customerTierRank(tierAt(redemptions, moment, rules)) < customerTierRank(tier)) {
			return moment;
		}
	}
	return null;
}

/** The moments counted redemptions leave the window after `now`, with how much the count drops at each, soonest first. */
export function dropOffsAfter(redemptions: readonly CountedRedemption[], now: EpochMs, rules: TierRules): readonly DropOff[] {
	const dropOffs: DropOff[] = [];
	let previous = countedAt(redemptions, now, rules);
	for (const moment of futureDropMoments(redemptions, now, rules)) {
		const next = countedAt(redemptions, moment, rules);
		if (next < previous) {
			dropOffs.push({ at: moment, count: previous - next });
		}
		previous = next;
	}
	return dropOffs;
}
