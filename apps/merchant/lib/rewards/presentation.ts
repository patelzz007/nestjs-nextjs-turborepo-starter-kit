// How the rewards catalog (grid and list) presents a reward: which status
// section it belongs to, how its offer reads, where it can be redeemed and how
// much stock is left. Pure functions — both layouts read the same answers, so
// switching layout never changes what a reward says.

import { assertNever, PLATFORM_DISPLAY_REGION, type RewardResponse, type RewardStatus, type RewardType, type SaleCurrency } from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { formatCount } from "@workspace/ui/lib/format/number";

/** Status sections of the catalog, in the order they are shown. */
export type RewardStatusGroupId = "live" | "review" | "drafts" | "ended";

export interface RewardStatusGroupDefinition {
	readonly id: RewardStatusGroupId;
	readonly title: string;
	/** Same meaning as the status badges of the rewards in it. */
	readonly tone: StatusTone;
}

/** Live offers first (what customers see now), then what needs the merchant, then what is over. */
export const REWARD_STATUS_GROUPS: readonly RewardStatusGroupDefinition[] = [
	{ id: "live", title: "Live", tone: "success" },
	{ id: "review", title: "In review", tone: "warning" },
	{ id: "drafts", title: "Drafts", tone: "muted" },
	{ id: "ended", title: "Ended", tone: "muted" },
];

/** The section every status belongs to — expired and disabled offers have both stopped. */
const STATUS_GROUP: Readonly<Record<RewardStatus, RewardStatusGroupId>> = {
	PUBLISHED: "live",
	PENDING_REVIEW: "review",
	DRAFT: "drafts",
	EXPIRED: "ended",
	DISABLED: "ended",
};

export interface RewardStatusGroup extends RewardStatusGroupDefinition {
	readonly rewards: readonly RewardResponse[];
}

/** The non-empty status sections in display order; rewards keep the API's order within a section. */
export function groupRewardsByStatus(rewards: readonly RewardResponse[]): readonly RewardStatusGroup[] {
	return REWARD_STATUS_GROUPS.map((group): RewardStatusGroup => ({ ...group, rewards: rewards.filter((reward) => STATUS_GROUP[reward.status] === group.id) })).filter(
		(group) => group.rewards.length > 0,
	);
}

/** Whether the offer can still be claimed — ended offers are drawn quieter. */
export function isRewardEnded(status: RewardStatus): boolean {
	return STATUS_GROUP[status] === "ended";
}

/** Rewards carry cashback in whole units of the platform's currency (the editor asks for "Cashback Amount (RM)"). */
export const REWARD_VALUE_CURRENCY: SaleCurrency = "MYR";

/** Cashback is set in whole currency units, so it is shown without decimals. */
const WHOLE_CURRENCY_FRACTION_DIGITS = 0;

function formatWholeCurrency(amount: number): string {
	return new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, {
		style: "currency",
		currency: REWARD_VALUE_CURRENCY,
		maximumFractionDigits: WHOLE_CURRENCY_FRACTION_DIGITS,
		minimumFractionDigits: WHOLE_CURRENCY_FRACTION_DIGITS,
	}).format(amount);
}

/** A free-item reward with a quantity above one gives several items. */
const SINGLE_ITEM = 1;

/** What the customer gets, in their words — the headline of a reward card ("10% off", "Free item"). */
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

/** Separators a store name may put between the business and the branch ("Jonker Street Kitchen — Bukit Katil"). */
const BRANCH_SEPARATOR = /^[\s–—:|-]+/u;

/**
 * A store's name without the business name in front of it: inside the
 * merchant's own console the business is a given, the branch is what tells
 * stores apart. Names that do not start with the business name are kept whole.
 */
export function shortStoreName(storeName: string, organizationName: string | undefined): string {
	if (organizationName === undefined || organizationName.length === 0 || !storeName.startsWith(organizationName)) {
		return storeName;
	}
	const branch = storeName.slice(organizationName.length).replace(BRANCH_SEPARATOR, "").trim();
	return branch.length > 0 ? branch : storeName;
}

export interface RewardStores {
	/** Short label for the card ("Bukit Katil", "All stores", "2 stores"). */
	readonly label: string;
	/** Every store by its full name, for the tooltip and screen readers. */
	readonly fullLabel: string;
}

/** Where the reward can be redeemed. */
export function describeRewardStores(reward: Pick<RewardResponse, "locationScopeType" | "locationNames" | "locationIds" | "organizationName">): RewardStores {
	if (reward.locationScopeType === "ALL_LOCATIONS") {
		return { label: "All stores", fullLabel: "All stores" };
	}
	const names = reward.locationNames ?? [];
	if (names.length === 0) {
		const count = reward.locationIds.length;
		const label = count === SINGLE_ITEM ? "1 store" : `${formatCount(count, PLATFORM_DISPLAY_REGION.locale)} stores`;
		return { label, fullLabel: label };
	}
	return { label: names.map((name) => shortStoreName(name, reward.organizationName)).join(", "), fullLabel: names.join(", ") };
}

/** At or below this share of the original stock, a live reward is running low. */
export const LOW_STOCK_SHARE = 0.2;

/** Percent scale of the stock bar. */
const FULL_PERCENT = 100;

export type RewardStockLevel = "plenty" | "low" | "out";

export interface RewardStock {
	readonly level: RewardStockLevel;
	/** Share of the original stock still available, 0–100. */
	readonly percentLeft: number;
	/** "28 of 35 left", "Sold out". */
	readonly label: string;
}

/** How much of the reward is left to claim. */
export function describeRewardStock(remaining: number, total: number): RewardStock {
	if (remaining <= 0 || total <= 0) {
		return { level: "out", percentLeft: 0, label: "Sold out" };
	}
	const share = Math.min(1, remaining / total);
	const { locale } = PLATFORM_DISPLAY_REGION;
	return {
		level: share <= LOW_STOCK_SHARE ? "low" : "plenty",
		percentLeft: Math.round(share * FULL_PERCENT),
		label: `${formatCount(remaining, locale)} of ${formatCount(total, locale)} left`,
	};
}

/** When the offer stops: "Ends 14 Nov 2026", or "Ended …" once it has expired. */
export function formatRewardEnd(reward: Pick<RewardResponse, "status" | "expiryDate">): string {
	const date = formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION);
	return reward.status === "EXPIRED" ? `Ended ${date}` : `Ends ${date}`;
}
