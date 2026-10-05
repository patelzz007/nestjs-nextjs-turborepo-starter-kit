import { EpochMsSchema } from "@workspace/shared";

import type { AnalyticsReport } from "../../src/modules/rewards/analytics/report/analytics-report";

/** Monday 2026-09-07 00:00 in Kuala Lumpur. */
export const FIXTURE_WEEK_START = Date.UTC(2026, 8, 6, 16);
const WEEK_MS = 7 * 86_400_000;

/** A small, fully known report: two weekly buckets, one table of every cell kind, hostile text. */
export function buildFixtureReport(overrides: Partial<AnalyticsReport> = {}): AnalyticsReport {
	return {
		brand: "RewardHub",
		title: "Analytics report",
		subjectName: 'Brew & Bean, "KL"',
		subjectKey: "brew-and-bean-kl",
		generatedAt: Date.UTC(2026, 9, 5, 9, 30),
		range: {
			from: EpochMsSchema.parse(FIXTURE_WEEK_START),
			to: EpochMsSchema.parse(FIXTURE_WEEK_START + 2 * WEEK_MS),
			timeZone: "Asia/Kuala_Lumpur",
			interval: "week",
			previousFrom: EpochMsSchema.parse(FIXTURE_WEEK_START - 2 * WEEK_MS),
			previousTo: EpochMsSchema.parse(FIXTURE_WEEK_START),
		},
		currency: "MYR",
		kpis: [
			{ label: "Sales", unit: "money", comparison: { value: 123_450, previous: 100_000, change: 23_450, changePercent: 23.5 } },
			{ label: "Bills", unit: "count", comparison: { value: 42, previous: 0, change: 42, changePercent: null } },
			{ label: "Conversion rate", unit: "percent", comparison: { value: 62.5, previous: 70, change: -7.5, changePercent: -10.7 } },
		],
		charts: [
			{
				title: "Sales",
				kind: "bar",
				unit: "money",
				series: [
					{
						label: "Sales",
						points: [
							{ start: FIXTURE_WEEK_START, value: 80_000 },
							{ start: FIXTURE_WEEK_START + WEEK_MS, value: 43_450 },
						],
					},
				],
			},
		],
		tables: [
			{
				key: "series",
				title: "Activity over time",
				columns: [
					{ header: "Period start", kind: "date" },
					{ header: "Partial period", kind: "boolean" },
					{ header: "Sales", kind: "money" },
					{ header: "Bills", kind: "count" },
					{ header: "Conversion", kind: "percent" },
					{ header: "Reward", kind: "text" },
				],
				rows: [
					[
						{ kind: "date", epochMs: FIXTURE_WEEK_START },
						{ kind: "boolean", value: false },
						{ kind: "money", minor: 80_000 },
						{ kind: "count", value: 30 },
						{ kind: "percent", value: 12.5 },
						{ kind: "text", value: '=HYPERLINK("http://evil.example","click")' },
					],
					[
						{ kind: "date", epochMs: FIXTURE_WEEK_START + WEEK_MS },
						{ kind: "boolean", value: true },
						{ kind: "money", minor: 43_450 },
						{ kind: "count", value: 12 },
						{ kind: "percent", value: 0 },
						{ kind: "text", value: 'Café, "latte"\nsecond line' },
					],
				],
			},
			{ key: "stores", title: "Sales by store", columns: [{ header: "Store", kind: "text" }], rows: [] },
		],
		...overrides,
	};
}
