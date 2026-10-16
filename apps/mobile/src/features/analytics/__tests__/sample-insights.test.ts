import { DayPartSchema, WeekdaySchema, type ActivityVisit, type DayPart, type StampCard, type Weekday } from "../activity-insights";
import { ActivityRangePresetSchema, activityRangeOf, type ActivityRangePreset } from "../activity-range";
import { sampleActivityDashboard } from "../sample-dashboard";
import { RECENT_VISITS_LIMIT, SAMPLE_MONTHLY_BUDGET_MINOR, sampleActivityInsights, STAMP_CARDS_LIMIT } from "../sample-insights";

const TODAY = "2026-10-12";

function totalOf(values: Readonly<Record<DayPart, number>>): number {
	return DayPartSchema.options.reduce((total: number, part: DayPart): number => total + values[part], 0);
}

describe("sampleActivityInsights", () => {
	it.each(ActivityRangePresetSchema.options)("tells the same story as the dashboard for %s", (preset: ActivityRangePreset) => {
		const insights = sampleActivityInsights(activityRangeOf(preset, TODAY));
		const { totals } = sampleActivityDashboard(activityRangeOf(preset, TODAY));

		const visits = WeekdaySchema.options.reduce((total: number, weekday: Weekday): number => total + totalOf(insights.visitsByWeekday[weekday]), 0);
		expect(visits).toBe(totals.visits.value);
		expect(totalOf(insights.spendByDayPart)).toBe(totals.spentMinor.value);
	});

	it("is the same on every call for the same day", () => {
		expect(sampleActivityInsights(activityRangeOf("last30Days", TODAY))).toStrictEqual(sampleActivityInsights(activityRangeOf("last30Days", TODAY)));
	});

	it("lists the latest visits of the range, newest first", () => {
		const { recentVisits } = sampleActivityInsights(activityRangeOf("last30Days", TODAY));
		const range = activityRangeOf("last30Days", TODAY);
		const times = recentVisits.map((visit: ActivityVisit): number => visit.at);

		expect(recentVisits).toHaveLength(RECENT_VISITS_LIMIT);
		expect(times).toStrictEqual([...times].sort((left: number, right: number): number => right - left));
		expect(times.every((at: number): boolean => at >= range.from && at < range.to)).toBe(true);
		expect(new Set(recentVisits.map((visit: ActivityVisit): string => visit.id)).size).toBe(RECENT_VISITS_LIMIT);
	});

	it("finds the range's biggest bill", () => {
		const { biggestBill, recentVisits } = sampleActivityInsights(activityRangeOf("last90Days", TODAY));

		expect(biggestBill).not.toBeNull();
		recentVisits.forEach((visit: ActivityVisit): void => {
			expect(biggestBill?.billMinor ?? 0).toBeGreaterThanOrEqual(visit.billMinor);
		});
	});

	it("shows the fullest stamp cards first, none of them full", () => {
		const { stampCards } = sampleActivityInsights(activityRangeOf("last7Days", TODAY));
		const fullness = stampCards.map((card: StampCard): number => card.stamps / card.stampsPerReward);

		expect(stampCards.length).toBeGreaterThan(0);
		expect(stampCards.length).toBeLessThanOrEqual(STAMP_CARDS_LIMIT);
		expect(fullness).toStrictEqual([...fullness].sort((left: number, right: number): number => right - left));
		expect(stampCards.every((card: StampCard): boolean => card.stamps > 0 && card.stamps < card.stampsPerReward)).toBe(true);
	});

	it("measures the budget over the calendar month so far, whatever the range", () => {
		const week = sampleActivityInsights(activityRangeOf("last7Days", TODAY)).monthBudget;

		expect(week).toStrictEqual(sampleActivityInsights(activityRangeOf("last90Days", TODAY)).monthBudget);
		expect(week).toMatchObject({ budgetMinor: SAMPLE_MONTHLY_BUDGET_MINOR, daysElapsed: 12, daysInMonth: 31 });
		expect(week.spentMinor).toBeGreaterThan(0);
	});

	it("compares what rewards saved with the period before", () => {
		const { savedMinor } = sampleActivityInsights(activityRangeOf("last30Days", TODAY));

		expect(savedMinor.value).toBeGreaterThan(0);
		expect(savedMinor.change).toBe(savedMinor.value - savedMinor.previous);
	});
});
