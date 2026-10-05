import { EpochMsSchema, type AdminAnalyticsDashboard, type MerchantAnalyticsDashboard } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { reportRowCounts } from "./analytics-report";
import { buildMerchantReport, buildPlatformReport, PLATFORM_REPORT_SUBJECT_NAME, UNKNOWN_CITY_LABEL, UNKNOWN_STORE_LABEL } from "./analytics-report.builder";

const START = EpochMsSchema.parse(Date.UTC(2026, 8, 1));
const END = EpochMsSchema.parse(Date.UTC(2026, 8, 2));
const RANGE = {
	from: START,
	to: END,
	timeZone: "UTC",
	interval: "day",
	previousFrom: EpochMsSchema.parse(Date.UTC(2026, 7, 31)),
	previousTo: START,
} satisfies MerchantAnalyticsDashboard["range"];
const compared = (value: number): { value: number; previous: number; change: number; changePercent: null } => ({ value, previous: 0, change: value, changePercent: null });
const PROVENANCE = { brand: "RewardHub", generatedAt: Date.UTC(2026, 9, 5) };

const MERCHANT: MerchantAnalyticsDashboard = {
	range: RANGE,
	currency: "MYR",
	firstBillAt: START,
	totals: {
		salesMinor: compared(5_000),
		bills: compared(2),
		averageBillMinor: compared(2_500),
		claims: compared(4),
		redemptions: compared(2),
		conversionRate: compared(50),
		customers: compared(2),
	},
	series: [{ start: START, end: END, isPartial: false, salesMinor: 5_000, bills: 2, averageBillMinor: 2_500, claims: 4, redemptions: 2 }],
	byStore: [
		{ locationId: "7a2b3c4d-5e6f-4a1b-8c9d-0e1f2a3b4c5d", name: "Bukit Katil", city: "MELAKA", salesMinor: 4_000, bills: 1, averageBillMinor: 4_000, redemptions: 1 },
		{ locationId: null, name: null, city: null, salesMinor: 1_000, bills: 1, averageBillMinor: 1_000, redemptions: 1 },
	],
	byReward: [{ rewardId: "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a", title: "Free tea", claims: 4, redemptions: 2, conversionRate: 50 }],
	byRedemptionMethod: [
		{ method: "SCAN", redemptions: 1 },
		{ method: "MANUAL", redemptions: 1 },
	],
};

describe("buildMerchantReport", () => {
	const report = buildMerchantReport(MERCHANT, { slug: "jonker", displayName: "Jonker Street Kitchen" }, PROVENANCE);

	it("carries the dashboard's numbers unchanged — KPIs, chart series and every table", () => {
		expect(report.kpis.find((kpi) => kpi.label === "Sales")?.comparison).toEqual(MERCHANT.totals.salesMinor);
		expect(report.charts.map((chart) => chart.series.map((series) => series.points.map((point) => point.value)))).toEqual([[[5_000]], [[4], [2]]]);
		expect(report.tables.map((table) => table.key)).toEqual(["series", "stores", "rewards", "redemptionMethods"]);
		expect(reportRowCounts(report)).toEqual({ series: 1, stores: 2, rewards: 1, redemptionMethods: 2 });
	});

	it("names the subject and labels unknown stores and methods for people", () => {
		expect(report).toMatchObject({ subjectName: "Jonker Street Kitchen", subjectKey: "jonker", brand: "RewardHub", generatedAt: PROVENANCE.generatedAt });
		const stores = report.tables.find((table) => table.key === "stores");
		expect(stores?.rows.map((row) => row.slice(0, 2))).toEqual([
			[
				{ kind: "text", value: "Bukit Katil" },
				{ kind: "text", value: "Melaka" },
			],
			[
				{ kind: "text", value: UNKNOWN_STORE_LABEL },
				{ kind: "text", value: "" },
			],
		]);
		expect(report.tables.find((table) => table.key === "redemptionMethods")?.rows.map((row) => row[0])).toEqual([
			{ kind: "text", value: "QR code scan" },
			{ kind: "text", value: "Backup code" },
		]);
	});

	it("keeps every row as long as its header", () => {
		for (const table of report.tables) {
			for (const row of table.rows) {
				expect(row).toHaveLength(table.columns.length);
			}
		}
	});
});

describe("buildPlatformReport", () => {
	const dashboard: AdminAnalyticsDashboard = {
		range: RANGE,
		currency: "MYR",
		totals: {
			salesMinor: compared(5_000),
			bills: compared(2),
			averageBillMinor: compared(2_500),
			claims: compared(4),
			redemptions: compared(2),
			conversionRate: compared(50),
			activeMerchants: compared(1),
			customers: compared(2),
			newCustomers: compared(1),
			returningCustomers: compared(1),
		},
		series: [
			{ start: START, end: END, isPartial: false, salesMinor: 5_000, bills: 2, averageBillMinor: 2_500, claims: 4, redemptions: 2, newCustomers: 1, returningCustomers: 1 },
		],
		topMerchants: [{ organizationId: "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718", name: "Jonker", category: null, salesMinor: 5_000, bills: 2, averageBillMinor: 2_500 }],
		byCategory: [{ category: "cafe", salesMinor: 5_000, bills: 2, merchants: 1 }],
		byCity: [{ city: null, salesMinor: 5_000, bills: 2, merchants: 1 }],
	};
	const report = buildPlatformReport(dashboard, PROVENANCE);

	it("is the platform's report with new vs returning customers and every breakdown", () => {
		expect(report).toMatchObject({ subjectName: PLATFORM_REPORT_SUBJECT_NAME, subjectKey: "platform" });
		expect(report.tables.map((table) => table.key)).toEqual(["series", "topMerchants", "categories", "cities"]);
		expect(report.kpis.map((kpi) => kpi.label)).toEqual(expect.arrayContaining(["New customers", "Returning customers", "Active merchants"]));
		expect(report.tables.find((table) => table.key === "topMerchants")?.rows[0]?.[1]).toEqual({ kind: "text", value: "Other" });
		expect(report.tables.find((table) => table.key === "categories")?.rows[0]?.[0]).toEqual({ kind: "text", value: "Café" });
		expect(report.tables.find((table) => table.key === "cities")?.rows[0]?.[0]).toEqual({ kind: "text", value: UNKNOWN_CITY_LABEL });
	});
});
