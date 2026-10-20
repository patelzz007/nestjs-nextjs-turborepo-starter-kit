import { EpochMsSchema, type AnalyticsReportRange, type CustomerAnalyticsDashboard } from "@workspace/shared";

import { activityRangeOf } from "../activity-range";
import {
	ACTIVITY_KPIS,
	activityFormatters,
	bucketLabelsOf,
	categoryLabelOf,
	chartHintOf,
	claimStatusSegmentsOf,
	comparisonLabelOf,
	engagementSeriesOf,
	HEADLINE_KPI,
	isEmptyActivity,
	kpiChangeOf,
	kpiViewOf,
	NO_PREVIOUS_PERIOD_LABEL,
	perBucketLabelOf,
	rangeLabelOf,
	referralTilesOf,
	spendingSeriesOf,
	topShopItemsOf,
} from "../presentation";
import { sampleActivityDashboard } from "../sample-dashboard";

const TODAY = "2026-10-12";
const FORMATTERS = activityFormatters("MYR");

/** Intl may separate the currency symbol with a no-break space: compare on plain spaces. */
function plain(text: string): string {
	return text.replace(/\s/gu, " ");
}

function comparison(value: number, previous: number, changePercent: number | null): CustomerAnalyticsDashboard["totals"]["visits"] {
	return { value, previous, change: value - previous, changePercent };
}

describe("activityFormatters", () => {
	it("writes money from minor units in ringgit", () => {
		expect(plain(FORMATTERS.money(123_450))).toBe("RM 1,234.50");
		expect(plain(FORMATTERS.moneyTick(20_000))).toBe("RM 200");
	});

	it("writes counts, percentages and signed changes", () => {
		expect(FORMATTERS.count(1204)).toBe("1,204");
		expect(FORMATTERS.percent(87.75)).toBe("87.8%");
		expect(FORMATTERS.percentChange(12.4)).toBe("+12.4%");
		expect(FORMATTERS.percentChange(-3)).toBe("-3%");
		expect(FORMATTERS.percentChange(0)).toBe("0%");
	});
});

describe("kpiChangeOf", () => {
	it("is good news when a KPI rises and bad news when it falls", () => {
		expect(kpiChangeOf(comparison(12, 10, 20), FORMATTERS)).toStrictEqual({ status: "change", direction: "up", sentiment: "positive", label: "+20%" });
		expect(kpiChangeOf(comparison(8, 10, -20), FORMATTERS)).toStrictEqual({ status: "change", direction: "down", sentiment: "negative", label: "-20%" });
	});

	it("is neutral when nothing moved", () => {
		expect(kpiChangeOf(comparison(10, 10, 0), FORMATTERS)).toStrictEqual({ status: "change", direction: "flat", sentiment: "neutral", label: "0%" });
	});

	it("says so when there is nothing to compare with", () => {
		expect(kpiChangeOf(comparison(4, 0, null), FORMATTERS)).toStrictEqual({ status: "noPrevious", label: NO_PREVIOUS_PERIOD_LABEL });
	});
});

describe("range labels", () => {
	const RANGE = activityRangeOf("last30Days", TODAY);

	it("names the days the range covers, its end excluded", () => {
		expect(rangeLabelOf(RANGE)).toBe("13 Sept – 12 Oct 2026");
	});

	it("names what changes are measured against", () => {
		expect(comparisonLabelOf(RANGE)).toBe("vs previous 30 days");
	});

	it("names the buckets by the range's interval", () => {
		const weekly: AnalyticsReportRange = { ...RANGE, interval: "week" };

		expect(chartHintOf(RANGE)).toBe("Touch the chart to see each day");
		expect(perBucketLabelOf(weekly)).toBe("per week");
	});
});

describe("bucketLabelsOf", () => {
	it("labels days short under the plot and with their weekday in the readout", () => {
		const labels = bucketLabelsOf(sampleActivityDashboard(activityRangeOf("last7Days", TODAY)));

		expect(labels.at(-1)).toStrictEqual({ tick: "12 Oct", full: "Mon, 12 Oct" });
	});

	it("labels weeks by their first day", () => {
		const labels = bucketLabelsOf(sampleActivityDashboard(activityRangeOf("last90Days", TODAY)));

		expect(labels.at(1)).toStrictEqual({ tick: "20 Jul", full: "Week of 20 Jul" });
	});

	it("labels months by name", () => {
		const dashboard = sampleActivityDashboard(activityRangeOf("last7Days", TODAY));
		const [point] = dashboard.series;
		if (point === undefined) {
			throw new Error("The sample has no buckets");
		}
		const monthly: CustomerAnalyticsDashboard = {
			...dashboard,
			range: { ...dashboard.range, interval: "month" },
			series: [{ ...point, start: EpochMsSchema.parse(Date.UTC(2026, 8, 1)) }],
		};

		expect(bucketLabelsOf(monthly)).toStrictEqual([{ tick: "Sept", full: "September 2026" }]);
	});
});

describe("KPIs", () => {
	const DASHBOARD = sampleActivityDashboard(activityRangeOf("last30Days", TODAY));

	it("leads with what was spent", () => {
		const headline = kpiViewOf(HEADLINE_KPI, DASHBOARD, FORMATTERS);

		expect(headline.label).toBe("Total spent");
		expect(headline.value).toBe(FORMATTERS.money(DASHBOARD.totals.spentMinor.value));
		expect(headline.trend).toHaveLength(DASHBOARD.series.length);
	});

	it("follows with the web's four activity KPIs, each with a trend per bucket", () => {
		const views = ACTIVITY_KPIS.map((definition) => kpiViewOf(definition, DASHBOARD, FORMATTERS));

		expect(views.map((view) => view.label)).toStrictEqual(["Shop visits", "Average bill", "Rewards claimed", "Redemption rate"]);
		expect(views.every((view): boolean => view.trend.length === DASHBOARD.series.length)).toBe(true);
		expect(views.find((view) => view.key === "conversionRate")?.value).toBe(FORMATTERS.percent(DASHBOARD.totals.conversionRate.value));
	});

	it("draws an empty bucket's ratios as zero, not as a gap", () => {
		const emptyPoint = { start: DASHBOARD.range.from, end: DASHBOARD.range.to, isPartial: false, spentMinor: 0, visits: 0, claims: 0, redemptions: 0 };

		expect(ACTIVITY_KPIS.map((definition): number => definition.trend(emptyPoint))).toStrictEqual([0, 0, 0, 0]);
	});

	it("lists the referral numbers", () => {
		expect(referralTilesOf(DASHBOARD.totals, FORMATTERS).map((tile) => tile.label)).toStrictEqual(["Referrals sent", "Referrals credited", "Rewards earned"]);
	});

	it("is empty only when nothing at all happened", () => {
		const none = comparison(0, 0, null);

		expect(isEmptyActivity(DASHBOARD.totals)).toBe(false);
		expect(isEmptyActivity({ ...DASHBOARD.totals, visits: none, claims: none, referralsSent: none })).toBe(true);
	});
});

describe("charts and breakdowns", () => {
	const DASHBOARD = sampleActivityDashboard(activityRangeOf("last30Days", TODAY));

	it("plots spending alone, and claimed against redeemed on one axis", () => {
		expect(spendingSeriesOf(DASHBOARD).map((series) => series.color)).toStrictEqual(["chart-1"]);
		expect(engagementSeriesOf(DASHBOARD).map((series) => [series.label, series.color])).toStrictEqual([
			["Claimed", "chart-1"],
			["Redeemed", "chart-2"],
		]);
	});

	it("colours every claim status the same whatever its share", () => {
		const segments = claimStatusSegmentsOf(DASHBOARD, FORMATTERS);

		expect(segments.map((segment) => [segment.label, segment.color])).toStrictEqual([
			["Waiting to be used", "chart-1"],
			["Redeemed", "chart-2"],
			["Expired", "chart-3"],
		]);
	});

	it("gives an empty breakdown zero shares instead of dividing by zero", () => {
		const empty: CustomerAnalyticsDashboard = { ...DASHBOARD, claimsByStatus: [{ status: "PENDING", claims: 0 }] };

		expect(claimStatusSegmentsOf(empty, FORMATTERS).map((segment) => segment.shareLabel)).toStrictEqual(["0%"]);
	});

	it("describes each top shop by category and visits", () => {
		const [top] = topShopItemsOf(DASHBOARD, FORMATTERS);

		expect(top?.detail).toMatch(/^(Café|Restaurant|Retail|Wellness|Entertainment|Food|Beverage) · \d+ visits?$/u);
	});

	it("calls an uncategorised shop Other", () => {
		expect(categoryLabelOf(null)).toBe("Other");
		expect(categoryLabelOf("cafe")).toBe("Café");
	});
});
