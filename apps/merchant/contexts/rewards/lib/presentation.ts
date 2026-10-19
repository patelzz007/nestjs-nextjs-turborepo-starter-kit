// How the rewards catalog (grid and list) presents a reward: which status
// tab it belongs to, how its offer reads, where it can be redeemed and how
// much stock is left. Pure functions — both layouts read the same answers, so
// switching layout never changes what a reward says.

import { PLATFORM_DISPLAY_REGION, RewardStatusSchema, type RewardResponse, type RewardStatus } from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { formatCount } from "@workspace/ui/lib/format/number";
import { z } from "zod";

/** Status tabs of the catalog, in the order they are shown — also the `?status=` values of its URL (`REWARDS_URL_STATE`). */
export const RewardStatusGroupIdSchema = z.enum(["live", "review", "drafts", "ended"]);

export type RewardStatusGroupId = z.infer<typeof RewardStatusGroupIdSchema>;

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

/** The tab every status belongs to — expired and disabled offers have both stopped. */
const STATUS_GROUP: Readonly<Record<RewardStatus, RewardStatusGroupId>> = {
	PUBLISHED: "live",
	PENDING_REVIEW: "review",
	DRAFT: "drafts",
	EXPIRED: "ended",
	DISABLED: "ended",
};

/** A status tab with how many rewards it holds across every page (from the catalog summary). */
export interface RewardStatusGroup extends RewardStatusGroupDefinition {
	readonly count: number;
}

/** The statuses one tab shows — the catalog asks the API for `filter[status][in]=` these. */
export function statusesOfGroup(groupId: RewardStatusGroupId): readonly RewardStatus[] {
	return RewardStatusSchema.options.filter((status: RewardStatus): boolean => STATUS_GROUP[status] === groupId);
}

/** Every status group in display order, empty ones included (each is a tab), counted from the summary's per-status counts. */
export function groupStatusCounts(countsByStatus: Readonly<Record<RewardStatus, number>>): readonly RewardStatusGroup[] {
	return REWARD_STATUS_GROUPS.map((group): RewardStatusGroup => ({
		...group,
		count: statusesOfGroup(group.id).reduce((sum: number, status: RewardStatus): number => sum + countsByStatus[status], 0),
	}));
}

/** The group the catalog opens on when the URL names none: the first one with rewards (live, unless nothing is live), else live. */
export function defaultRewardStatusGroupId(groups: readonly RewardStatusGroup[]): RewardStatusGroupId {
	return groups.find((group) => group.count > 0)?.id ?? RewardStatusGroupIdSchema.enum.live;
}

/** Whether the offer can still be claimed — ended offers are drawn quieter. */
export function isRewardEnded(status: RewardStatus): boolean {
	return STATUS_GROUP[status] === "ended";
}

/** One store is named "1 store", more are counted. */
const SINGLE_ITEM = 1;

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
