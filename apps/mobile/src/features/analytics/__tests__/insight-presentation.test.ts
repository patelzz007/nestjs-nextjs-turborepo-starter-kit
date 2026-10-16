import { EpochMsSchema, type CustomerAnalyticsDashboard } from "@workspace/shared";

import type { ActivityInsights, ActivityVisit, DayPartValues, StampCard } from "../activity-insights";
import { activityRangeOf, activityRangeOfDays } from "../activity-range";
import {
	asOfLabelOf,
	budgetViewOf,
	categoryItemsOf,
	comparisonItemsOf,
	dayPartFullLabelOf,
	dayPartSegmentsOf,
	highlightsOf,
	NEW_THIS_PERIOD_LABEL,
	periodNamesOf,
	stampItemsOf,
	timelineItemsOf,
	visitHeatmapOf,
	visitsLabelOf,
	weekdayColumnsOf,
	weekdayLabelOf,
} from "../insight-presentation";
import { activityFormatters } from "../presentation";
import { sampleActivityDashboard } from "../sample-dashboard";

const TODAY = "2026-10-12";
const FORMATTERS = activityFormatters("MYR");

/** Intl may separate the currency symbol and the day period with a no-break space: compare on plain spaces. */
function plain(text: string): string {
	return text.replace(/\s/gu, " ");
}

const NONE: DayPartValues = { morning: 0, midday: 0, afternoon: 0, evening: 0 };

const VISIT: ActivityVisit = {
	id: "v1",
	at: EpochMsSchema.parse(Date.UTC(2026, 9, 10, 19, 42)),
	organizationId: "6f1c2a4e-3b7d-4e9a-8c21-5d4f7a9b0e13",
	merchantName: "Kopi Kaki",
	category: "cafe",
	billMinor: 1_450,
	reward: "redeemed",
};

const INSIGHTS: ActivityInsights = {
	visitsByWeekday: {
		monday: { morning: 1, midday: 2, afternoon: 0, evening: 0 },
		tuesday: NONE,
		wednesday: NONE,
		thursday: NONE,
		friday: NONE,
		saturday: { morning: 0, midday: 1, afternoon: 3, evening: 2 },
		sunday: NONE,
	},
	spendByDayPart: { morning: 1_000, midday: 3_000, afternoon: 4_000, evening: 2_000 },
	savedMinor: { value: 650, previous: 500, change: 150, changePercent: 30 },
	biggestBill: VISIT,
	recentVisits: [VISIT, { ...VISIT, id: "v2", merchantName: "Urban Threads", category: "retail", billMinor: 8_900, reward: "none" }],
	stampCards: [{ organizationId: VISIT.organizationId, merchantName: "Kopi Kaki", rewardName: "Free kopi", stamps: 9, stampsPerReward: 10 }],
	monthBudget: {
		from: EpochMsSchema.parse(Date.UTC(2026, 9, 1)),
		to: EpochMsSchema.parse(Date.UTC(2026, 9, 11)),
		budgetMinor: 200_000,
		spentMinor: 50_000,
		daysElapsed: 10,
		daysInMonth: 31,
	},
};

describe("weekday and day-part labels", () => {
	it("names weekdays short and in full", () => {
		expect(weekdayLabelOf("saturday")).toStrictEqual({ key: "saturday", label: "Sat", fullLabel: "Saturday" });
	});

	it("names a part of the day with its hours", () => {
		expect(plain(dayPartFullLabelOf("evening"))).toMatch(/^Evening \(5 pm – 10 pm\)$/iu);
	});

	it("counts visits in words", () => {
		expect(visitsLabelOf(1, FORMATTERS)).toBe("1 visit");
		expect(visitsLabelOf(14, FORMATTERS)).toBe("14 visits");
	});
});

describe("weekdayColumnsOf and visitHeatmapOf", () => {
	it("totals each weekday's visits, Monday first", () => {
		const columns = weekdayColumnsOf(INSIGHTS, FORMATTERS);

		expect(columns.map((column): string => column.label)).toStrictEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
		expect(columns.map((column): number => column.value)).toStrictEqual([3, 0, 0, 0, 0, 6, 0]);
		expect(columns.at(-2)?.valueLabel).toBe("6 visits");
	});

	it("lays the visits out a row per part of the day and a column per weekday", () => {
		const heatmap = visitHeatmapOf(INSIGHTS);

		expect(heatmap.rows.map((row): string => row.label)).toStrictEqual(["Morning", "Midday", "Afternoon", "Evening"]);
		expect(heatmap.columns).toHaveLength(7);
		expect(heatmap.values).toStrictEqual([
			[1, 0, 0, 0, 0, 0, 0],
			[2, 0, 0, 0, 0, 1, 0],
			[0, 0, 0, 0, 0, 3, 0],
			[0, 0, 0, 0, 0, 2, 0],
		]);
	});
});

describe("dayPartSegmentsOf", () => {
	it("splits the spend by part of the day, each part in its own fixed colour", () => {
		expect(dayPartSegmentsOf(INSIGHTS, FORMATTERS).map((segment) => [segment.key, segment.color, segment.shareLabel])).toStrictEqual([
			["morning", "chart-1", "10%"],
			["midday", "chart-2", "30%"],
			["afternoon", "chart-3", "40%"],
			["evening", "chart-4", "20%"],
		]);
	});
});

describe("comparisonItemsOf and periodNamesOf", () => {
	const dashboard = sampleActivityDashboard(activityRangeOf("last30Days", TODAY));

	it("names a preset's two periods by their length", () => {
		expect(periodNamesOf(activityRangeOf("last7Days", TODAY), { kind: "preset", preset: "last7Days" })).toStrictEqual({ current: "Last 7 days", previous: "Previous 7 days" });
	});

	it("names custom dates' two periods by their days", () => {
		expect(periodNamesOf(activityRangeOfDays("2026-09-01", "2026-09-15"), { kind: "custom", fromDate: "2026-09-01", toDate: "2026-09-15" })).toStrictEqual({
			current: "1 Sept – 15 Sept 2026",
			previous: "17 Aug – 31 Aug 2026",
		});
	});

	it("dates what is counted up to the range's last day", () => {
		expect(asOfLabelOf(activityRangeOf("last7Days", TODAY))).toBe("as of 12 Oct 2026");
	});

	it("sets five measures next to the period before", () => {
		const items = comparisonItemsOf(dashboard, FORMATTERS);

		expect(items.map((item): string => item.label)).toStrictEqual(["Spent", "Shop visits", "Shops visited", "Rewards claimed", "Rewards redeemed"]);
		const [spent] = items;
		expect(spent?.current).toBe(dashboard.totals.spentMinor.value);
		expect(plain(spent?.currentLabel ?? "")).toMatch(/^RM [\d,]+\.\d{2}$/u);
	});

	it("says a measure is new when there was nothing before", () => {
		const fresh: CustomerAnalyticsDashboard = {
			...dashboard,
			totals: { ...dashboard.totals, visits: { value: 4, previous: 0, change: 4, changePercent: null } },
		};

		expect(comparisonItemsOf(fresh, FORMATTERS).find((item): boolean => item.key === "visits")?.changeLabel).toBe(NEW_THIS_PERIOD_LABEL);
	});
});

describe("categoryItemsOf", () => {
	it("lists each category with its share of the spend and its visits", () => {
		const dashboard = sampleActivityDashboard(activityRangeOf("last90Days", TODAY));
		const items = categoryItemsOf(dashboard, FORMATTERS);

		expect(items).toHaveLength(dashboard.spendingByCategory.length);
		expect(items.at(0)?.detail).toMatch(/^\d+(\.\d)?% · \d+ visits?$/u);
	});
});

describe("highlightsOf", () => {
	it("picks the busiest day, the favourite shop, the biggest bill and what rewards saved", () => {
		const dashboard = sampleActivityDashboard(activityRangeOf("last30Days", TODAY));
		const highlights = highlightsOf(dashboard, INSIGHTS, FORMATTERS);

		expect(highlights.map((item): string => item.label)).toStrictEqual(["Busiest day", "Favourite shop", "Biggest bill", "Saved with rewards"]);
		const [busiest, , bill, saved] = highlights;
		expect(busiest).toMatchObject({ value: "Saturday", detail: "6 visits" });
		expect(plain(bill?.value ?? "")).toBe("RM 14.50");
		expect(bill?.detail).toBe("Kopi Kaki · Sat, 10 Oct");
		expect(saved?.detail).toBe("+30% on before");
	});

	it("says so when there is nothing to pick", () => {
		const dashboard: CustomerAnalyticsDashboard = { ...sampleActivityDashboard(activityRangeOf("last7Days", TODAY)), spendingByMerchant: [] };
		const highlights = highlightsOf(dashboard, { ...INSIGHTS, biggestBill: null, savedMinor: { value: 0, previous: 0, change: 0, changePercent: null } }, FORMATTERS);
		const [, favourite, bill, saved] = highlights;

		expect(favourite).toMatchObject({ value: "None yet", detail: "No visits" });
		expect(bill?.detail).toBe("No visits");
		expect(saved?.detail).toBe(NEW_THIS_PERIOD_LABEL);
	});
});

describe("budgetViewOf", () => {
	it("shows the share used, what is left, the days to go and the pace", () => {
		const view = budgetViewOf(INSIGHTS.monthBudget, FORMATTERS);

		expect(view.valueLabel).toBe("25%");
		expect(view.periodLabel).toBe("1 Oct – 10 Oct 2026");
		expect(plain(view.accessibilityValueText)).toBe("RM 500.00 of RM 2,000.00");
		expect(view.details.map((item) => [item.label, plain(item.value)])).toStrictEqual([
			["Spent", "RM 500.00"],
			["Left", "RM 1,500.00"],
			["Days to go", "21"],
			["At this pace", "RM 1,550.00"],
		]);
	});

	it("says by how much a budget is over", () => {
		const view = budgetViewOf({ ...INSIGHTS.monthBudget, budgetMinor: 10_000, spentMinor: 12_000, daysElapsed: 0, daysInMonth: 30 }, FORMATTERS);

		expect(view.details.at(1)?.label).toBe("Over by");
		expect(plain(view.details.at(1)?.value ?? "")).toBe("RM 20.00");
		expect(plain(view.details.at(-1)?.value ?? "")).toBe("RM 0.00");
	});
});

describe("stampItemsOf", () => {
	it("counts the stamps and the visits still to go", () => {
		expect(stampItemsOf(INSIGHTS.stampCards, FORMATTERS)).toStrictEqual([
			{ key: VISIT.organizationId, label: "Kopi Kaki", detail: "Free kopi · 1 more visit", value: 9, max: 10, valueLabel: "9 of 10" },
		]);
		const fresh: StampCard = { organizationId: VISIT.organizationId, merchantName: "Kopi Kaki", rewardName: "Free kopi", stamps: 2, stampsPerReward: 10 };
		expect(stampItemsOf([fresh], FORMATTERS).at(0)?.detail).toBe("Free kopi · 8 more visits");
	});
});

describe("timelineItemsOf", () => {
	it("dates each visit in the range's zone, with a badge for its reward", () => {
		const [redeemed, plainVisit] = timelineItemsOf(INSIGHTS.recentVisits, FORMATTERS, "UTC");

		expect(plain(redeemed?.detail ?? "")).toMatch(/^Sat, 10 Oct · 7:42 pm · Café$/iu);
		expect(plain(redeemed?.value ?? "")).toBe("RM 14.50");
		expect(redeemed?.badge).toStrictEqual({ label: "Reward redeemed", tone: "success" });
		expect(plainVisit?.badge).toBeUndefined();
	});
});
