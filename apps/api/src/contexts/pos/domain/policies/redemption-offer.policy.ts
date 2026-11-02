import { DEFAULT_SALE_CURRENCY, SALE_CURRENCY_MINOR_UNIT_EXPONENTS, type RedemptionOffer, type RewardFreeItem, type RewardType } from "@workspace/shared";

import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** What a reward gives, as stored on the reward (rewards' `RewardOfferFacts`). */
export interface RewardOfferTerms {
	readonly rewardType: RewardType;
	/** Percent off, whole-currency cashback, points, or the number of items given (by type). */
	readonly rewardValue: number;
	readonly freeItem: RewardFreeItem | null;
}

/** Decimal base of a currency's minor-unit exponent. */
const DECIMAL_BASE = 10;

/**
 * A reward's offer in the terms a POS applies and prints (ADR 074). Cashback is stored in whole units
 * of the platform's sale currency and reported in its integer minor units, like every amount the till
 * sends and receives. A free item or buy one, get one reward always names its item: one that does not
 * is corrupt data, refused rather than reported without it.
 */
export function redemptionOfferOf(rewardId: string, terms: RewardOfferTerms): RedemptionOffer {
	switch (terms.rewardType) {
		case "DISCOUNT":
			return { type: "DISCOUNT", percentOff: terms.rewardValue };
		case "CASHBACK":
			return {
				type: "CASHBACK",
				amountMinor: terms.rewardValue * DECIMAL_BASE ** SALE_CURRENCY_MINOR_UNIT_EXPONENTS[DEFAULT_SALE_CURRENCY],
				currency: DEFAULT_SALE_CURRENCY,
			};
		case "POINTS":
			return { type: "POINTS", points: terms.rewardValue };
		case "FREE_ITEM":
			return { type: "FREE_ITEM", quantity: terms.rewardValue, item: itemOf(rewardId, terms) };
		case "BOGO":
			return { type: "BOGO", freeQuantity: terms.rewardValue, item: itemOf(rewardId, terms) };
	}
}

function itemOf(rewardId: string, terms: RewardOfferTerms): RewardFreeItem {
	if (terms.freeItem === null) {
		throw new CorruptAggregateStateError("reward", rewardId, `a ${terms.rewardType} reward names no free item`);
	}
	return terms.freeItem;
}
