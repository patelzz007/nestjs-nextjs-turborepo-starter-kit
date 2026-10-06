// ============================================
// lib/analytics/admin-analytics.ts - the platform dashboard's KPIs, series and breakdowns, mapped for the shared primitives
// ============================================
// `GET /admin/analytics/dashboard` (READ ANALYTICS) → props of the packages/ui
// analytics primitives. Colour slots are fixed per entity across the page:
// sales / claims / new customers take slot 1, redemptions / returning
// customers slot 2 (docs/technical/frontend/analytics-charts.md).

import type { AnalyticsFormatters, KpiDefinition } from "@workspace/client/lib/analytics/analytics-presentation";
import { formatShareOfTotal } from "@workspace/client/lib/analytics/analytics-presentation";
import {
	MERCHANT_BUSINESS_CATEGORY_LABELS,
	PILOT_CITY_LABELS,
	UNCATEGORISED_MERCHANT_CATEGORY_LABEL,
	type AdminAnalyticsDashboard,
	type AdminDashboardTotals,
	type MerchantBusinessCategory,
	type PilotCity,
} from "@workspace/shared";
import type { RankedBarItem } from "@workspace/ui/components/ranked-bar-list";
import type { TimeSeriesDefinition } from "@workspace/ui/components/time-series-chart";
import { Receipt, ShoppingBag, Store, Ticket, TicketCheck, TrendingUp, UserPlus, UserRound, Users, Wallet } from "lucide-react";

type AdminKpiKey = keyof AdminDashboardTotals;

export const ADMIN_SALES_KPIS: readonly KpiDefinition<AdminKpiKey>[] = [
	{ key: "salesMinor", label: "Sales", format: "money", icon: Wallet },
	{ key: "bills", label: "Bills", format: "count", icon: Receipt },
	{ key: "averageBillMinor", label: "Average bill", format: "money", icon: ShoppingBag },
	{ key: "activeMerchants", label: "Active merchants", format: "count", icon: Store },
];

export const ADMIN_CUSTOMER_KPIS: readonly KpiDefinition<AdminKpiKey>[] = [
	{ key: "customers", label: "Customers", format: "count", icon: Users },
	{ key: "newCustomers", label: "New customers", format: "count", icon: UserPlus },
	{ key: "returningCustomers", label: "Returning customers", format: "count", icon: UserRound },
];

export const ADMIN_REWARD_KPIS: readonly KpiDefinition<AdminKpiKey>[] = [
	{ key: "claims", label: "Claims", format: "count", icon: Ticket },
	{ key: "redemptions", label: "Redemptions", format: "count", icon: TicketCheck },
	{ key: "conversionRate", label: "Conversion rate", format: "percent", icon: TrendingUp },
];

export const ADMIN_SALES_SERIES: readonly TimeSeriesDefinition<"salesMinor">[] = [{ key: "salesMinor", label: "Sales", color: "chart-1" }];

export const ADMIN_BILLS_SERIES: readonly TimeSeriesDefinition<"bills">[] = [{ key: "bills", label: "Bills", color: "chart-1" }];

export const ADMIN_ENGAGEMENT_SERIES: readonly TimeSeriesDefinition<"claims" | "redemptions">[] = [
	{ key: "claims", label: "Claims", color: "chart-1" },
	{ key: "redemptions", label: "Redemptions", color: "chart-2" },
];

export const ADMIN_CUSTOMER_SERIES: readonly TimeSeriesDefinition<"newCustomers" | "returningCustomers">[] = [
	{ key: "newCustomers", label: "New customers", color: "chart-1" },
	{ key: "returningCustomers", label: "Returning customers", color: "chart-2" },
];

/** A merchant business category's display name; uncategorised reads "Other". */
export function merchantCategoryLabel(category: MerchantBusinessCategory | null): string {
	return category === null ? UNCATEGORISED_MERCHANT_CATEGORY_LABEL : MERCHANT_BUSINESS_CATEGORY_LABELS[category];
}

/** Shown for sales whose store (and so city) is unknown. */
export const UNKNOWN_CITY_LABEL = "Unknown store";

export function cityLabel(city: PilotCity | null): string {
	return city === null ? UNKNOWN_CITY_LABEL : PILOT_CITY_LABELS[city];
}

function billsLabel(bills: number, formatters: AnalyticsFormatters): string {
	return `${formatters.count(bills)} ${bills === 1 ? "bill" : "bills"}`;
}

function merchantsLabel(merchants: number, formatters: AnalyticsFormatters): string {
	return `${formatters.count(merchants)} ${merchants === 1 ? "merchant" : "merchants"}`;
}

/** The ten highest-selling merchants: sales, then category · bills · average bill · share of platform sales. */
export function toTopMerchantItems(dashboard: AdminAnalyticsDashboard, formatters: AnalyticsFormatters): readonly RankedBarItem[] {
	const total = dashboard.totals.salesMinor.value;
	return dashboard.topMerchants.map((merchant): RankedBarItem => ({
		key: merchant.organizationId,
		label: merchant.name,
		value: merchant.salesMinor,
		valueLabel: formatters.money(merchant.salesMinor),
		detail: [
			merchantCategoryLabel(merchant.category),
			billsLabel(merchant.bills, formatters),
			`avg ${formatters.money(merchant.averageBillMinor)}`,
			`${formatShareOfTotal(merchant.salesMinor, total, formatters.locale)} of sales`,
		].join(" · "),
	}));
}

/** Sales per business category, highest first. */
export function toCategoryItems(dashboard: AdminAnalyticsDashboard, formatters: AnalyticsFormatters): readonly RankedBarItem[] {
	const total = dashboard.totals.salesMinor.value;
	return dashboard.byCategory.map((row): RankedBarItem => ({
		key: row.category ?? "uncategorised",
		label: merchantCategoryLabel(row.category),
		value: row.salesMinor,
		valueLabel: formatters.money(row.salesMinor),
		detail: [merchantsLabel(row.merchants, formatters), billsLabel(row.bills, formatters), `${formatShareOfTotal(row.salesMinor, total, formatters.locale)} of sales`].join(
			" · ",
		),
	}));
}

/** Sales per city of the store the bill was paid at, highest first. */
export function toCityItems(dashboard: AdminAnalyticsDashboard, formatters: AnalyticsFormatters): readonly RankedBarItem[] {
	const total = dashboard.totals.salesMinor.value;
	return dashboard.byCity.map((row): RankedBarItem => ({
		key: row.city ?? "unknown",
		label: cityLabel(row.city),
		value: row.salesMinor,
		valueLabel: formatters.money(row.salesMinor),
		detail: [merchantsLabel(row.merchants, formatters), billsLabel(row.bills, formatters), `${formatShareOfTotal(row.salesMinor, total, formatters.locale)} of sales`].join(
			" · ",
		),
	}));
}
