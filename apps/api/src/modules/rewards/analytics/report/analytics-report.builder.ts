import {
	ADMIN_ANALYTICS_EXPORT_SUBJECT,
	MERCHANT_BUSINESS_CATEGORY_LABELS,
	PILOT_CITY_LABELS,
	UNCATEGORISED_MERCHANT_CATEGORY_LABEL,
	type AdminAnalyticsDashboard,
	type MerchantAnalyticsDashboard,
	type MerchantBusinessCategory,
	type PilotCity,
	type RewardRedemptionMethod,
} from "@workspace/shared";

import type { MerchantDashboardSubject } from "../analytics-dashboard.service";
import type { AnalyticsReport, AnalyticsReportCell, AnalyticsReportColumn, AnalyticsReportTable } from "./analytics-report";

/** Shown for a store breakdown row of bills paid without a known store. */
export const UNKNOWN_STORE_LABEL = "No store recorded";

/** Shown for a city breakdown row of bills paid without a known store. */
export const UNKNOWN_CITY_LABEL = "Unknown city";

/** Subject name of the platform report. */
export const PLATFORM_REPORT_SUBJECT_NAME = "All merchants";

/** How each redemption method reads in a report. */
export const REDEMPTION_METHOD_LABELS: Readonly<Record<RewardRedemptionMethod, string>> = {
	SCAN: "QR code scan",
	MANUAL: "Backup code",
};

/** Where the report comes from: the product name and when it was generated. */
export interface ReportProvenance {
	readonly brand: string;
	readonly generatedAt: number;
}

const text = (value: string): AnalyticsReportCell => ({ kind: "text", value });
const count = (value: number): AnalyticsReportCell => ({ kind: "count", value });
const money = (minor: number): AnalyticsReportCell => ({ kind: "money", minor });
const percent = (value: number): AnalyticsReportCell => ({ kind: "percent", value });
const date = (epochMs: number): AnalyticsReportCell => ({ kind: "date", epochMs });
const flag = (value: boolean): AnalyticsReportCell => ({ kind: "boolean", value });

function column(header: string, kind: AnalyticsReportColumn["kind"]): AnalyticsReportColumn {
	return { header, kind };
}

function categoryLabel(category: MerchantBusinessCategory | null): string {
	return category === null ? UNCATEGORISED_MERCHANT_CATEGORY_LABEL : MERCHANT_BUSINESS_CATEGORY_LABELS[category];
}

function cityLabel(city: PilotCity | null): string {
	return city === null ? UNKNOWN_CITY_LABEL : PILOT_CITY_LABELS[city];
}

/** The merchant's report: KPIs, the sales and claims charts, the series and every breakdown of the dashboard. */
export function buildMerchantReport(dashboard: MerchantAnalyticsDashboard, subject: MerchantDashboardSubject, provenance: ReportProvenance): AnalyticsReport {
	const { totals } = dashboard;
	const series: AnalyticsReportTable = {
		key: "series",
		title: "Activity over time",
		columns: [
			column("Period start", "date"),
			column("Partial period", "boolean"),
			column("Sales", "money"),
			column("Bills", "count"),
			column("Average bill", "money"),
			column("Claims", "count"),
			column("Redemptions", "count"),
		],
		rows: dashboard.series.map((point) => [
			date(point.start),
			flag(point.isPartial),
			money(point.salesMinor),
			count(point.bills),
			money(point.averageBillMinor),
			count(point.claims),
			count(point.redemptions),
		]),
	};
	const stores: AnalyticsReportTable = {
		key: "stores",
		title: "Sales by store",
		columns: [
			column("Store", "text"),
			column("City", "text"),
			column("Sales", "money"),
			column("Bills", "count"),
			column("Average bill", "money"),
			column("Redemptions", "count"),
		],
		rows: dashboard.byStore.map((store) => [
			text(store.name ?? UNKNOWN_STORE_LABEL),
			text(store.locationId === null ? "" : cityLabel(store.city)),
			money(store.salesMinor),
			count(store.bills),
			money(store.averageBillMinor),
			count(store.redemptions),
		]),
	};
	const rewards: AnalyticsReportTable = {
		key: "rewards",
		title: "Rewards",
		columns: [column("Reward", "text"), column("Claims", "count"), column("Redemptions", "count"), column("Conversion", "percent")],
		rows: dashboard.byReward.map((reward) => [text(reward.title), count(reward.claims), count(reward.redemptions), percent(reward.conversionRate)]),
	};
	const methods: AnalyticsReportTable = {
		key: "redemptionMethods",
		title: "Redemptions by method",
		columns: [column("Method", "text"), column("Redemptions", "count")],
		rows: dashboard.byRedemptionMethod.map((row) => [text(REDEMPTION_METHOD_LABELS[row.method]), count(row.redemptions)]),
	};

	return {
		brand: provenance.brand,
		title: "Analytics report",
		subjectName: subject.displayName,
		subjectKey: subject.slug,
		generatedAt: provenance.generatedAt,
		range: dashboard.range,
		currency: dashboard.currency,
		kpis: [
			{ label: "Sales", unit: "money", comparison: totals.salesMinor },
			{ label: "Bills", unit: "count", comparison: totals.bills },
			{ label: "Average bill", unit: "money", comparison: totals.averageBillMinor },
			{ label: "Customers", unit: "count", comparison: totals.customers },
			{ label: "Claims", unit: "count", comparison: totals.claims },
			{ label: "Redemptions", unit: "count", comparison: totals.redemptions },
			{ label: "Conversion rate", unit: "percent", comparison: totals.conversionRate },
		],
		charts: [
			{ title: "Sales", kind: "bar", unit: "money", series: [{ label: "Sales", points: dashboard.series.map((point) => ({ start: point.start, value: point.salesMinor })) }] },
			{
				title: "Claims vs redemptions",
				kind: "line",
				unit: "count",
				series: [
					{ label: "Claims", points: dashboard.series.map((point) => ({ start: point.start, value: point.claims })) },
					{ label: "Redemptions", points: dashboard.series.map((point) => ({ start: point.start, value: point.redemptions })) },
				],
			},
		],
		tables: [series, stores, rewards, methods],
	};
}

/** The admin's platform report: KPIs incl. new vs returning customers, charts, the series and every breakdown. */
export function buildPlatformReport(dashboard: AdminAnalyticsDashboard, provenance: ReportProvenance): AnalyticsReport {
	const { totals } = dashboard;
	const series: AnalyticsReportTable = {
		key: "series",
		title: "Activity over time",
		columns: [
			column("Period start", "date"),
			column("Partial period", "boolean"),
			column("Sales", "money"),
			column("Bills", "count"),
			column("Average bill", "money"),
			column("Claims", "count"),
			column("Redemptions", "count"),
			column("New customers", "count"),
			column("Returning customers", "count"),
		],
		rows: dashboard.series.map((point) => [
			date(point.start),
			flag(point.isPartial),
			money(point.salesMinor),
			count(point.bills),
			money(point.averageBillMinor),
			count(point.claims),
			count(point.redemptions),
			count(point.newCustomers),
			count(point.returningCustomers),
		]),
	};
	const merchants: AnalyticsReportTable = {
		key: "topMerchants",
		title: "Top merchants",
		columns: [column("Merchant", "text"), column("Category", "text"), column("Sales", "money"), column("Bills", "count"), column("Average bill", "money")],
		rows: dashboard.topMerchants.map((merchant) => [
			text(merchant.name),
			text(categoryLabel(merchant.category)),
			money(merchant.salesMinor),
			count(merchant.bills),
			money(merchant.averageBillMinor),
		]),
	};
	const categories: AnalyticsReportTable = {
		key: "categories",
		title: "Sales by business category",
		columns: [column("Category", "text"), column("Sales", "money"), column("Bills", "count"), column("Merchants", "count")],
		rows: dashboard.byCategory.map((row) => [text(categoryLabel(row.category)), money(row.salesMinor), count(row.bills), count(row.merchants)]),
	};
	const cities: AnalyticsReportTable = {
		key: "cities",
		title: "Sales by city",
		columns: [column("City", "text"), column("Sales", "money"), column("Bills", "count"), column("Merchants", "count")],
		rows: dashboard.byCity.map((row) => [text(cityLabel(row.city)), money(row.salesMinor), count(row.bills), count(row.merchants)]),
	};

	return {
		brand: provenance.brand,
		title: "Platform analytics report",
		subjectName: PLATFORM_REPORT_SUBJECT_NAME,
		subjectKey: ADMIN_ANALYTICS_EXPORT_SUBJECT,
		generatedAt: provenance.generatedAt,
		range: dashboard.range,
		currency: dashboard.currency,
		kpis: [
			{ label: "Sales", unit: "money", comparison: totals.salesMinor },
			{ label: "Bills", unit: "count", comparison: totals.bills },
			{ label: "Average bill", unit: "money", comparison: totals.averageBillMinor },
			{ label: "Active merchants", unit: "count", comparison: totals.activeMerchants },
			{ label: "Customers", unit: "count", comparison: totals.customers },
			{ label: "New customers", unit: "count", comparison: totals.newCustomers },
			{ label: "Returning customers", unit: "count", comparison: totals.returningCustomers },
			{ label: "Claims", unit: "count", comparison: totals.claims },
			{ label: "Redemptions", unit: "count", comparison: totals.redemptions },
			{ label: "Conversion rate", unit: "percent", comparison: totals.conversionRate },
		],
		charts: [
			{ title: "Sales", kind: "bar", unit: "money", series: [{ label: "Sales", points: dashboard.series.map((point) => ({ start: point.start, value: point.salesMinor })) }] },
			{
				title: "New vs returning customers",
				kind: "line",
				unit: "count",
				series: [
					{ label: "New", points: dashboard.series.map((point) => ({ start: point.start, value: point.newCustomers })) },
					{ label: "Returning", points: dashboard.series.map((point) => ({ start: point.start, value: point.returningCustomers })) },
				],
			},
		],
		tables: [series, merchants, categories, cities],
	};
}
