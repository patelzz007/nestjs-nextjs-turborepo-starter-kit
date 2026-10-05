// ============================================
// lib/analytics/merchant-analytics.ts - the merchant dashboard's KPIs, series and breakdowns, mapped for the shared primitives
// ============================================
// `GET /orgs/:orgSlug/analytics/dashboard` (merchant:view_analytics) → props of
// the packages/ui analytics primitives. Colour slots are fixed per entity on
// the page: sales / claims / QR scans take slot 1, redemptions / backup codes
// slot 2 (docs/technical/frontend/analytics-charts.md).

import { formatShareOfTotal, type AnalyticsFormatters, type KpiDefinition } from "@workspace/client/lib/analytics/analytics-presentation";
import {
	PILOT_CITY_LABELS,
	PLATFORM_DISPLAY_REGION,
	type MerchantAnalyticsDashboard,
	type MerchantDashboardTotals,
	type OrganizationContextResponse,
	type RewardRedemptionMethod,
} from "@workspace/shared";
import type { RankedBarItem } from "@workspace/ui/components/analytics/ranked-bar-list";
import type { ShareSegment } from "@workspace/ui/components/analytics/share-bar";
import type { TimeSeriesDefinition } from "@workspace/ui/components/analytics/time-series-chart";
import type { ChartColorSlot } from "@workspace/ui/lib/charts/chart-colors";
import { Receipt, ShoppingBag, Ticket, TicketCheck, TrendingUp, Users, Wallet } from "lucide-react";

/**
 * The zone a merchant's dashboard is cut in: the organization's own
 * (`organization.timeZone` of the context the merchant app loads). Without a
 * context (not a member — the page then renders the access state) it is the
 * platform's, which is also `Organization.timeZone`'s default.
 */
export function reportTimeZone(context: OrganizationContextResponse | undefined): string {
	return context?.organization.timeZone ?? PLATFORM_DISPLAY_REGION.timeZone;
}

type MerchantKpiKey = keyof MerchantDashboardTotals;

export const MERCHANT_SALES_KPIS: readonly KpiDefinition<MerchantKpiKey>[] = [
	{ key: "salesMinor", label: "Sales", format: "money", icon: Wallet },
	{ key: "bills", label: "Bills", format: "count", icon: Receipt },
	{ key: "averageBillMinor", label: "Average bill", format: "money", icon: ShoppingBag },
	{ key: "customers", label: "Customers", format: "count", icon: Users },
];

export const MERCHANT_REWARD_KPIS: readonly KpiDefinition<MerchantKpiKey>[] = [
	{ key: "claims", label: "Claims", format: "count", icon: Ticket },
	{ key: "redemptions", label: "Redemptions", format: "count", icon: TicketCheck },
	{ key: "conversionRate", label: "Conversion rate", format: "percent", icon: TrendingUp },
];

export const MERCHANT_SALES_SERIES: readonly TimeSeriesDefinition<"salesMinor">[] = [{ key: "salesMinor", label: "Sales", color: "chart-1" }];

export const MERCHANT_BILLS_SERIES: readonly TimeSeriesDefinition<"bills">[] = [{ key: "bills", label: "Bills", color: "chart-1" }];

export const MERCHANT_AVERAGE_BILL_SERIES: readonly TimeSeriesDefinition<"averageBillMinor">[] = [{ key: "averageBillMinor", label: "Average bill", color: "chart-1" }];

export const MERCHANT_ENGAGEMENT_SERIES: readonly TimeSeriesDefinition<"claims" | "redemptions">[] = [
	{ key: "claims", label: "Claims", color: "chart-1" },
	{ key: "redemptions", label: "Redemptions", color: "chart-2" },
];

/** How each redemption method is named and coloured (fixed per method, never by rank). */
export const REDEMPTION_METHOD_DISPLAY: Readonly<Record<RewardRedemptionMethod, { readonly label: string; readonly color: ChartColorSlot }>> = {
	SCAN: { label: "QR code scan", color: "chart-1" },
	MANUAL: { label: "Backup code", color: "chart-2" },
};

/** Bills paid without a known store (only members who see every store get this row). */
export const NO_STORE_LABEL = "No store recorded";

function plural(count: number, singular: string, formatters: AnalyticsFormatters): string {
	return `${formatters.count(count)} ${count === 1 ? singular : `${singular}s`}`;
}

/** Stores in scope by sales: bills · average bill · redemptions, and the city when known. */
export function toStoreItems(dashboard: MerchantAnalyticsDashboard, formatters: AnalyticsFormatters): readonly RankedBarItem[] {
	return dashboard.byStore.map((store): RankedBarItem => {
		const parts = [plural(store.bills, "bill", formatters), `avg ${formatters.money(store.averageBillMinor)}`, plural(store.redemptions, "redemption", formatters)];
		return {
			key: store.locationId ?? "no-store",
			label: store.name ?? NO_STORE_LABEL,
			value: store.salesMinor,
			valueLabel: formatters.money(store.salesMinor),
			detail: (store.city === null ? parts : [PILOT_CITY_LABELS[store.city], ...parts]).join(" · "),
		};
	});
}

/** The most active rewards, by claims: redemptions and conversion. */
export function toRewardItems(dashboard: MerchantAnalyticsDashboard, formatters: AnalyticsFormatters): readonly RankedBarItem[] {
	return dashboard.byReward.map((reward): RankedBarItem => ({
		key: reward.rewardId,
		label: reward.title,
		value: reward.claims,
		valueLabel: plural(reward.claims, "claim", formatters),
		detail: `${plural(reward.redemptions, "redemption", formatters)} · ${formatters.percent(reward.conversionRate)} redeemed`,
	}));
}

/** Redemptions by method as parts of the whole (every method, zero included). */
export function toRedemptionMethodSegments(dashboard: MerchantAnalyticsDashboard, formatters: AnalyticsFormatters): readonly ShareSegment[] {
	const total = dashboard.byRedemptionMethod.reduce((sum, row) => sum + row.redemptions, 0);
	return dashboard.byRedemptionMethod.map((row): ShareSegment => ({
		key: row.method,
		label: REDEMPTION_METHOD_DISPLAY[row.method].label,
		color: REDEMPTION_METHOD_DISPLAY[row.method].color,
		value: row.redemptions,
		valueLabel: formatters.count(row.redemptions),
		shareLabel: formatShareOfTotal(row.redemptions, total, formatters.locale),
	}));
}
