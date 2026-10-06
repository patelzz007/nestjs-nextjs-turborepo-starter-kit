// ============================================
// lib/rewards/customer-analytics.ts - the customer's "My Activity" dashboard, mapped for the shared primitives
// ============================================
// `GET /claims/analytics/dashboard` (the signed-in customer's own activity) →
// props of the packages/ui analytics primitives. Days are UTC (the API cuts a
// customer's buckets in UTC — they spend across merchants and zones).

import { formatShareOfTotal, type AnalyticsFormatters, type KpiDefinition } from "@workspace/client/lib/analytics/analytics-presentation";
import {
	MERCHANT_BUSINESS_CATEGORY_LABELS,
	UNCATEGORISED_MERCHANT_CATEGORY_LABEL,
	type CustomerAnalyticsDashboard,
	type CustomerDashboardTotals,
	type MerchantBusinessCategory,
	type RewardClaimStatus,
} from "@workspace/shared";
import type { RankedBarItem } from "@workspace/ui/components/ranked-bar-list";
import type { ShareSegment } from "@workspace/ui/components/share-bar";
import type { TimeSeriesDefinition, TimeSeriesPoint } from "@workspace/ui/components/time-series-chart";
import { categoricalChartSlot, type ChartColorSlot } from "@workspace/ui/lib/charts/chart-colors";
import { Gift, Receipt, Share2, ShoppingBag, Store, Ticket, TicketCheck, TrendingUp, UserCheck, Wallet } from "lucide-react";

type CustomerKpiKey = keyof CustomerDashboardTotals;

export const CUSTOMER_SPENDING_KPIS: readonly KpiDefinition<CustomerKpiKey>[] = [
	{ key: "spentMinor", label: "Total spent", format: "money", icon: Wallet, iconTone: "green" },
	{ key: "visits", label: "Shop visits", format: "count", icon: Receipt, iconTone: "teal" },
	{ key: "averageBillMinor", label: "Average bill", format: "money", icon: ShoppingBag, iconTone: "orange" },
	{ key: "merchants", label: "Shops visited", format: "count", icon: Store, iconTone: "blue" },
];

export const CUSTOMER_REWARD_KPIS: readonly KpiDefinition<CustomerKpiKey>[] = [
	{ key: "claims", label: "Rewards claimed", format: "count", icon: Ticket, iconTone: "brand" },
	{ key: "redemptions", label: "Rewards redeemed", format: "count", icon: TicketCheck, iconTone: "green" },
	{ key: "conversionRate", label: "Redemption rate", format: "percent", icon: TrendingUp, iconTone: "orange" },
];

export const CUSTOMER_REFERRAL_KPIS: readonly KpiDefinition<CustomerKpiKey>[] = [
	{ key: "referralsSent", label: "Referrals sent", format: "count", icon: Share2, iconTone: "blue" },
	{ key: "referralsCredited", label: "Referrals credited", format: "count", icon: UserCheck, iconTone: "violet" },
	{ key: "referralRewardsEarned", label: "Rewards earned", format: "count", icon: Gift, iconTone: "brand" },
];

/** How each claim status is named and coloured (fixed per status, never by rank). */
export const CLAIM_STATUS_DISPLAY: Readonly<Record<RewardClaimStatus, { readonly label: string; readonly color: ChartColorSlot }>> = {
	PENDING: { label: "Waiting to be used", color: "chart-1" },
	REDEEMED: { label: "Redeemed", color: "chart-2" },
	EXPIRED: { label: "Expired", color: "chart-3" },
};

/** The range's claims by their current status, as parts of the whole (every status, zero included). */
export function toClaimStatusSegments(dashboard: CustomerAnalyticsDashboard, formatters: AnalyticsFormatters): readonly ShareSegment[] {
	const total = dashboard.claimsByStatus.reduce((sum, row) => sum + row.claims, 0);
	return dashboard.claimsByStatus.map((row): ShareSegment => ({
		key: row.status,
		label: CLAIM_STATUS_DISPLAY[row.status].label,
		color: CLAIM_STATUS_DISPLAY[row.status].color,
		value: row.claims,
		valueLabel: formatters.count(row.claims),
		shareLabel: formatShareOfTotal(row.claims, total, formatters.locale),
	}));
}

export const CUSTOMER_SPENDING_SERIES: readonly TimeSeriesDefinition<"spentMinor">[] = [{ key: "spentMinor", label: "Spent", color: "chart-1" }];

export const CUSTOMER_ENGAGEMENT_SERIES: readonly TimeSeriesDefinition<"claims" | "redemptions">[] = [
	{ key: "claims", label: "Claimed", color: "chart-1" },
	{ key: "redemptions", label: "Redeemed", color: "chart-2" },
];

/**
 * Shops drawn as lines on the "top shops over time" chart. Lines that cross
 * each other stay readable for three series; the full top five are in the
 * ranked list beside it.
 */
export const MAX_SHOP_TREND_SERIES = 3;

/** A merchant business category's display name; uncategorised spend reads "Other". */
export function spendCategoryLabel(category: MerchantBusinessCategory | null): string {
	return category === null ? UNCATEGORISED_MERCHANT_CATEGORY_LABEL : MERCHANT_BUSINESS_CATEGORY_LABELS[category];
}

function visitsLabel(visits: number, formatters: AnalyticsFormatters): string {
	return `${formatters.count(visits)} ${visits === 1 ? "visit" : "visits"}`;
}

/** Spending per category, highest first — one hue for every bar (the length carries the amount). */
export function toCategoryItems(dashboard: CustomerAnalyticsDashboard, formatters: AnalyticsFormatters): readonly RankedBarItem[] {
	const total = dashboard.totals.spentMinor.value;
	return dashboard.spendingByCategory.map((row): RankedBarItem => ({
		key: row.category ?? "uncategorised",
		label: spendCategoryLabel(row.category),
		value: row.totalMinor,
		valueLabel: formatters.money(row.totalMinor),
		detail: `${visitsLabel(row.visits, formatters)} · ${formatShareOfTotal(row.totalMinor, total, formatters.locale)} of your spending`,
	}));
}

/** The shops the customer spent the most at (top five), with category, visits and share. */
export function toShopItems(dashboard: CustomerAnalyticsDashboard, formatters: AnalyticsFormatters): readonly RankedBarItem[] {
	const total = dashboard.totals.spentMinor.value;
	return dashboard.spendingByMerchant.map((shop): RankedBarItem => ({
		key: shop.organizationId,
		label: shop.merchantName,
		value: shop.totalMinor,
		valueLabel: formatters.money(shop.totalMinor),
		detail: [
			spendCategoryLabel(shop.category),
			visitsLabel(shop.visits, formatters),
			`${formatShareOfTotal(shop.totalMinor, total, formatters.locale)} of your spending`,
		].join(" · "),
	}));
}

/** One line per top shop (by its organization id) for the "top shops over time" chart. */
export interface ShopTrend {
	readonly series: readonly TimeSeriesDefinition<string>[];
	readonly points: readonly TimeSeriesPoint<string>[];
	readonly isEmpty: boolean;
}

/**
 * The top {@link MAX_SHOP_TREND_SERIES} shops' spending per bucket, on the
 * buckets of the main series (each shop's series has one value per bucket;
 * a bucket a shop's series lacks is zero). Colours follow the shop's rank in
 * this view, in fixed slot order — the legend names every line.
 */
export function toShopTrend(dashboard: CustomerAnalyticsDashboard): ShopTrend {
	const shops = dashboard.spendingByMerchant.slice(0, MAX_SHOP_TREND_SERIES);
	const series = shops.map((shop, index): TimeSeriesDefinition<string> => ({ key: shop.organizationId, label: shop.merchantName, color: categoricalChartSlot(index) }));
	const totalsByShop = new Map(shops.map((shop) => [shop.organizationId, new Map(shop.series.map((value) => [value.start, value.totalMinor]))]));
	const points = dashboard.series.map((bucket): TimeSeriesPoint<string> => ({
		start: bucket.start,
		end: bucket.end,
		isPartial: bucket.isPartial,
		values: Object.fromEntries(shops.map((shop) => [shop.organizationId, totalsByShop.get(shop.organizationId)?.get(bucket.start) ?? 0])),
	}));
	return { series, points, isEmpty: shops.every((shop) => shop.totalMinor === 0) };
}
