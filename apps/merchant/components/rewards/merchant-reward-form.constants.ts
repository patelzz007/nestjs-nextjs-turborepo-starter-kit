import type { RewardType } from "@workspace/shared";
import { Award, Gift, Percent, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";

export interface RewardTypeOption {
	readonly value: RewardType;
	readonly label: string;
	readonly icon: LucideIcon;
	readonly description: string;
	readonly tone: string;
}

export const REWARD_TYPE_OPTIONS: readonly RewardTypeOption[] = [
	{ value: "DISCOUNT", label: "Discount", icon: Percent, description: "Percentage or fixed amount off", tone: "text-info" },
	{ value: "FREE_ITEM", label: "Free Item", icon: Gift, description: "Complimentary product or service", tone: "text-success" },
	{ value: "CASHBACK", label: "Cashback", icon: TrendingUp, description: "Money back on purchase", tone: "text-warning" },
	{ value: "POINTS", label: "Bonus Points", icon: Award, description: "Extra loyalty points", tone: "text-chart-4" },
	{ value: "BOGO", label: "Buy One Get One", icon: Sparkles, description: "BOGO or similar deals", tone: "text-primary" },
];

export const MAX_CLAIMS_OPTIONS: readonly number[] = [1, 2, 3, 5, 10];

export function getRewardValueLabel(rewardType: RewardType): string {
	switch (rewardType) {
		case "DISCOUNT":
			return "Discount Value (%)";
		case "CASHBACK":
			return "Cashback Amount (RM)";
		case "POINTS":
			return "Bonus Points";
		case "FREE_ITEM":
		case "BOGO":
			return "Quantity";
		default:
			return "Value";
	}
}
