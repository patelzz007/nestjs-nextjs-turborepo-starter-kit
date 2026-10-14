import { assertNever, PLATFORM_DISPLAY_REGION, type RewardType, type SaleCurrency } from "@workspace/shared";
import { formatCount } from "@workspace/ui/lib/format/number";

// ============================================
// lib/rewards/reward-offer.ts — a reward's offer, in the customer's words
// ============================================
// One wording for every app that shows rewards (the consumer web app, the
// merchant console), so "10% off" never reads differently in two places.

/** Rewards carry cashback in whole units of the platform's currency (the editor asks for "Cashback Amount (RM)"). */
export const REWARD_VALUE_CURRENCY: SaleCurrency = "MYR";

/** Cashback is set in whole currency units, so it is shown without decimals. */
const WHOLE_CURRENCY_FRACTION_DIGITS = 0;

/** A free-item reward with a quantity above one gives several items. */
const SINGLE_ITEM = 1;

function formatWholeCurrency(amount: number): string {
	return new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, {
		style: "currency",
		currency: REWARD_VALUE_CURRENCY,
		maximumFractionDigits: WHOLE_CURRENCY_FRACTION_DIGITS,
		minimumFractionDigits: WHOLE_CURRENCY_FRACTION_DIGITS,
	}).format(amount);
}

/** What the customer gets — the headline of a reward ("10% off", "RM 15 cashback", "Free item"). */
export function formatRewardOffer(rewardType: RewardType, rewardValue: number): string {
	const { locale } = PLATFORM_DISPLAY_REGION;
	switch (rewardType) {
		case "DISCOUNT":
			return `${formatCount(rewardValue, locale)}% off`;
		case "CASHBACK":
			return `${formatWholeCurrency(rewardValue)} cashback`;
		case "POINTS":
			return `${formatCount(rewardValue, locale)} bonus points`;
		case "FREE_ITEM":
			return rewardValue > SINGLE_ITEM ? `${formatCount(rewardValue, locale)} free items` : "Free item";
		case "BOGO":
			return "Buy one, get one";
		default:
			return assertNever(rewardType, "reward type");
	}
}

/** The kind of reward, in sentence case — a badge beside the offer ("Discount", "Cashback"). */
export function rewardTypeLabel(rewardType: RewardType): string {
	switch (rewardType) {
		case "DISCOUNT":
			return "Discount";
		case "CASHBACK":
			return "Cashback";
		case "POINTS":
			return "Bonus points";
		case "FREE_ITEM":
			return "Free item";
		case "BOGO":
			return "Buy one, get one";
		default:
			return assertNever(rewardType, "reward type");
	}
}
