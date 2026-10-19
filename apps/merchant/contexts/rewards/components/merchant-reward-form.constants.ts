import { REWARD_VALUE_CURRENCY } from "@workspace/client/lib/contexts/rewards/reward-offer";
import { assertNever, type RewardType, type SaleCurrency } from "@workspace/shared";
import { Award, Gift, Percent, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";

export interface RewardTypeOption {
	readonly value: RewardType;
	readonly label: string;
	readonly icon: LucideIcon;
}

/** The kinds of reward a merchant can offer, in the order the editor lists them. */
export const REWARD_TYPE_OPTIONS: readonly RewardTypeOption[] = [
	{ value: "DISCOUNT", label: "Discount", icon: Percent },
	{ value: "FREE_ITEM", label: "Free item", icon: Gift },
	{ value: "CASHBACK", label: "Cashback", icon: TrendingUp },
	{ value: "POINTS", label: "Bonus points", icon: Award },
	{ value: "BOGO", label: "Buy one, get one", icon: Sparkles },
];

export const MAX_CLAIMS_OPTIONS: readonly number[] = [1, 2, 3, 5, 10];

/** How each sale currency is written before an amount in a field ("RM" for MYR) — a new currency must name its symbol here. */
const CURRENCY_SYMBOL: Readonly<Record<SaleCurrency, string>> = { MYR: "RM" };

/** How the reward's value field reads for one reward type: its label and the unit around the number. */
export interface RewardValueField {
	readonly label: string;
	/** Shown before the number ("RM"). */
	readonly prefix?: string;
	/** Shown after the number ("%", "points"). */
	readonly suffix?: string;
}

export function getRewardValueField(rewardType: RewardType): RewardValueField {
	switch (rewardType) {
		case "DISCOUNT":
			return { label: "Discount", suffix: "%" };
		case "CASHBACK":
			return { label: "Cashback", prefix: CURRENCY_SYMBOL[REWARD_VALUE_CURRENCY] };
		case "POINTS":
			return { label: "Bonus points", suffix: "points" };
		case "FREE_ITEM":
			return { label: "Items given", suffix: "items" };
		case "BOGO":
			return { label: "Free items per purchase", suffix: "items" };
		default:
			return assertNever(rewardType, "reward type");
	}
}

/** The minimum spend is set in the same currency as cashback. */
export const MIN_SPEND_PREFIX = CURRENCY_SYMBOL[REWARD_VALUE_CURRENCY];
