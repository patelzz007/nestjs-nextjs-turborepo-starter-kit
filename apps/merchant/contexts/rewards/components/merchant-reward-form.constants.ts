import { REWARD_VALUE_CURRENCY } from "@workspace/client/lib/contexts/rewards/reward-offer";
import { assertNever, type RewardType, type SaleCurrency } from "@workspace/shared";
import { Award, Gift, Percent, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";

/** One kind of reward as the editor's type card shows it: a title, a one-line subtitle, and its details. */
export interface RewardTypeOption {
	readonly value: RewardType;
	/** The card's title. */
	readonly label: string;
	/** The card's subtitle: what the customer gets, in one line. */
	readonly description: string;
	/** How the offer reads to a customer. */
	readonly example: string;
	/** What the merchant fills in for this type. */
	readonly youSet: string;
	/** What the till does with it when the code is scanned. */
	readonly atTheTill: string;
	readonly icon: LucideIcon;
}

/** The kinds of reward a merchant can offer, in the order the editor lists them. */
export const REWARD_TYPE_OPTIONS: readonly RewardTypeOption[] = [
	{
		value: "DISCOUNT",
		label: "Discount",
		description: "A percentage off the customer's bill.",
		example: "15% off",
		youSet: "The percent off",
		atTheTill: "Takes the percent off the bill",
		icon: Percent,
	},
	{
		value: "FREE_ITEM",
		label: "Free item",
		description: "Something from your menu, on the house.",
		example: "Free latte",
		youSet: "The item, its SKU and how many",
		atTheTill: "Rings the item up at no charge",
		icon: Gift,
	},
	{
		value: "CASHBACK",
		label: "Cashback",
		description: "A fixed amount back after they pay.",
		example: "RM 5 cashback",
		youSet: "The amount in RM",
		atTheTill: "Gives the amount back",
		icon: TrendingUp,
	},
	{
		value: "POINTS",
		label: "Bonus points",
		description: "Extra loyalty points on a purchase.",
		example: "200 bonus points",
		youSet: "How many points",
		atTheTill: "Adds the points to their balance",
		icon: Award,
	},
	{
		value: "BOGO",
		label: "Buy one, get one",
		description: "Buy an item and get more of it free.",
		example: "Buy 1 laksa, get 1 free",
		youSet: "The item, its SKU and how many free",
		atTheTill: "Adds the free ones at no charge",
		icon: Sparkles,
	},
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
