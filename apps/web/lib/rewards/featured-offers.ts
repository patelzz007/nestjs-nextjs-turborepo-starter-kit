import type { RewardResponse } from "@workspace/shared";

/** How many offers the landing hero previews. */
export const FEATURED_OFFER_LIMIT = 3;

/** One offer as the landing hero shows it — display data only. */
export interface FeaturedOffer {
	readonly id: string;
	readonly title: string;
	readonly merchantName: string | undefined;
	readonly category: string;
	readonly remaining: number;
	readonly total: number;
	readonly expiryDate: number;
}

/**
 * The offers the landing hero features: still claimable (stock left, not yet
 * expired), soonest-ending first, at most {@link FEATURED_OFFER_LIMIT}. Pure —
 * the page passes `now` so the selection is deterministic in tests.
 */
export function selectFeaturedOffers(rewards: readonly RewardResponse[], now: number, limit: number = FEATURED_OFFER_LIMIT): readonly FeaturedOffer[] {
	// `filter` returns a new array, so sorting it never mutates the caller's list.
	return rewards
		.filter((reward: RewardResponse): boolean => reward.quantityRemaining > 0 && reward.expiryDate > now)
		.sort((left: RewardResponse, right: RewardResponse): number => left.expiryDate - right.expiryDate)
		.slice(0, limit)
		.map((reward: RewardResponse): FeaturedOffer => ({
			id: reward.id,
			title: reward.title,
			merchantName: reward.organizationName,
			category: reward.category,
			remaining: reward.quantityRemaining,
			total: reward.quantityTotal,
			expiryDate: reward.expiryDate,
		}));
}

/** How many merchants the landing strip names. */
export const FEATURED_MERCHANT_LIMIT = 8;

/**
 * Distinct merchant names behind the given offers, in first-seen order, at
 * most `limit` — the landing names only merchants with a live offer.
 */
export function selectMerchantNames(rewards: readonly RewardResponse[], limit: number = FEATURED_MERCHANT_LIMIT): readonly string[] {
	const names = new Set<string>();
	for (const reward of rewards) {
		const name: string | undefined = reward.organizationName?.trim();
		if (name !== undefined && name.length > 0) names.add(name);
		if (names.size === limit) break;
	}
	return [...names];
}
