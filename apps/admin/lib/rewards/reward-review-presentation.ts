import { REWARD_VALUE_CURRENCY } from "@workspace/client/lib/rewards/reward-offer";
import { MERCHANT_BUSINESS_CATEGORY_LABELS, PLATFORM_DISPLAY_REGION, RewardCategorySchema, type RewardResponse, type RewardStatus } from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";
import { formatMinorUnits, minorUnitExponent } from "@workspace/ui/lib/format/money";
import { formatCount } from "@workspace/ui/lib/format/number";

// ============================================
// lib/rewards/reward-review-presentation.ts — a reward, in a reviewer's words
// ============================================

/** A reward status as the moderation pages show it. */
export interface RewardStatusPresentation {
	readonly label: string;
	readonly tone: StatusTone;
}

/** Pending review is what waits on the reviewer; published is done; drafts and ended rewards recede. */
export const REWARD_STATUS_PRESENTATION: Readonly<Record<RewardStatus, RewardStatusPresentation>> = {
	DRAFT: { label: "Draft", tone: "muted" },
	PENDING_REVIEW: { label: "Pending review", tone: "warning" },
	PUBLISHED: { label: "Published", tone: "success" },
	EXPIRED: { label: "Expired", tone: "muted" },
	DISABLED: { label: "Disabled", tone: "danger" },
};

/** A reward's category by its label ("Café"); a category outside the known vocabulary is shown as stored. */
export function rewardCategoryLabel(category: string): string {
	const parsed = RewardCategorySchema.safeParse(category);
	return parsed.success ? MERCHANT_BUSINESS_CATEGORY_LABELS[parsed.data] : category;
}

/** Where the reward can be redeemed: every store, the named stores, or a count when the names are not loaded. */
export function rewardStoresLabel(reward: Pick<RewardResponse, "locationScopeType" | "locationIds" | "locationNames">): string {
	if (reward.locationScopeType === "ALL_LOCATIONS") {
		return "All stores";
	}
	const names = reward.locationNames ?? [];
	if (names.length > 0) {
		return names.join(", ");
	}
	const count = reward.locationIds.length;
	return count === 1 ? "1 store" : `${formatCount(count, PLATFORM_DISPLAY_REGION.locale)} stores`;
}

/** The smallest bill the reward applies to ("RM 30.00"), or "None". Rules carry it in whole ringgit, possibly with sen. */
export function rewardMinimumSpendLabel(minSpendMyr: number | undefined): string {
	if (minSpendMyr === undefined || minSpendMyr === 0) {
		return "None";
	}
	const minor = Math.round(minSpendMyr * 10 ** minorUnitExponent(REWARD_VALUE_CURRENCY));
	return formatMinorUnits(minor, REWARD_VALUE_CURRENCY, PLATFORM_DISPLAY_REGION.locale);
}

/** How often one customer may use the reward. */
export function rewardUsesPerCustomerLabel(maxUsePerUser: number | undefined): string {
	if (maxUsePerUser === undefined) {
		return "No limit";
	}
	return maxUsePerUser === 1 ? "Once" : `${formatCount(maxUsePerUser, PLATFORM_DISPLAY_REGION.locale)} times`;
}

/** Whether customers can refer friends, and how much of the referral pool is left. */
export function rewardReferralsLabel(reward: Pick<RewardResponse, "referralsEnabled" | "referralPoolTotal" | "referralPoolRemaining">): string {
	if (!reward.referralsEnabled) {
		return "Off";
	}
	if (reward.referralPoolTotal === null || reward.referralPoolRemaining === null) {
		return "On";
	}
	const { locale } = PLATFORM_DISPLAY_REGION;
	return `On, ${formatCount(reward.referralPoolRemaining, locale)} of ${formatCount(reward.referralPoolTotal, locale)} referral rewards left`;
}

/** How many of the reward are left to claim ("8 of 10 left"). */
export function rewardQuantityLabel(remaining: number, total: number): string {
	const { locale } = PLATFORM_DISPLAY_REGION;
	return `${formatCount(remaining, locale)} of ${formatCount(total, locale)} left`;
}
