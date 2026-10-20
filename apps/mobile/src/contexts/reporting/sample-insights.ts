// ============================================
// Sample insights — the Analytics screen's extras, made on the device
// ============================================
// What the sample history (sample-activity.ts) says beyond the API's
// dashboard contract, in the shape of ActivityInsights (activity-insights.ts):
// when the customer shops, what rewards saved them, their stamp cards, this
// month's budget and their latest visits. The range is the dashboard's, so
// every section on the screen speaks of the same days.

import { DAY_MS, EpochMsSchema, type AnalyticsReportRange } from "@workspace/shared";

import {
	dayPartOf,
	weekdayOf,
	type ActivityInsights,
	type ActivityVisit,
	type DayPart,
	type DayPartValues,
	type MonthBudget,
	type StampCard,
	type VisitReward,
	type Weekday,
} from "./activity-insights";
import { daysOf, SAMPLE_MERCHANTS, spentOf, sumOf, visitsOf, type DatedVisit, type SampleMerchant } from "./sample-activity";
import { compare } from "./sample-dashboard";

/** The visits listed under "Recent visits". */
export const RECENT_VISITS_LIMIT = 6;
/** The stamp cards shown: the fullest ones. */
export const STAMP_CARDS_LIMIT = 4;
/** Stamps count from visits in this many days up to today (older cards were filled and reset). */
export const STAMP_WINDOW_DAYS = 120;
/** The sample customer's monthly budget, in sen (RM 2,000). */
export const SAMPLE_MONTHLY_BUDGET_MINOR = 200_000;

const MINUTE_MS = 60_000;

function rewardOf(visit: DatedVisit): VisitReward {
	if (visit.redeemed) {
		return "redeemed";
	}
	return visit.claimed ? "claimed" : "none";
}

function activityVisitOf(visit: DatedVisit, index: number): ActivityVisit {
	return {
		id: `${String(visit.dayStartMs)}-${String(index)}-${visit.merchant.tenantId}`,
		at: EpochMsSchema.parse(visit.dayStartMs + visit.minuteOfDay * MINUTE_MS),
		tenantId: visit.merchant.tenantId,
		merchantName: visit.merchant.merchantName,
		category: visit.merchant.category,
		billMinor: visit.billMinor,
		reward: rewardOf(visit),
	};
}

/** One value per part of the day, read from the visits in it. */
function byDayPart(visits: readonly DatedVisit[], read: (visit: DatedVisit) => number): DayPartValues {
	const of = (part: DayPart): number =>
		sumOf(
			visits.filter((visit: DatedVisit): boolean => dayPartOf(visit.minuteOfDay) === part),
			read,
		);
	return { morning: of("morning"), midday: of("midday"), afternoon: of("afternoon"), evening: of("evening") };
}

function visitsByWeekdayOf(visits: readonly DatedVisit[]): Readonly<Record<Weekday, DayPartValues>> {
	const of = (weekday: Weekday): DayPartValues =>
		byDayPart(
			visits.filter((visit: DatedVisit): boolean => weekdayOf(visit.dayStartMs) === weekday),
			(): number => 1,
		);
	return {
		monday: of("monday"),
		tuesday: of("tuesday"),
		wednesday: of("wednesday"),
		thursday: of("thursday"),
		friday: of("friday"),
		saturday: of("saturday"),
		sunday: of("sunday"),
	};
}

/** What the redeemed rewards of the visits were worth. */
function savedOf(visits: readonly DatedVisit[]): number {
	return sumOf(
		visits.filter((visit: DatedVisit): boolean => visit.redeemed),
		(visit: DatedVisit): number => visit.merchant.rewardValueMinor,
	);
}

/** Each shop's stamps since its last full card, fullest first. */
function stampCardsOf(range: AnalyticsReportRange): readonly StampCard[] {
	const visits = visitsOf(daysOf(range.to - STAMP_WINDOW_DAYS * DAY_MS, range.to));
	return SAMPLE_MERCHANTS.map((merchant: SampleMerchant): StampCard => {
		const count = visits.filter((visit: DatedVisit): boolean => visit.merchant.tenantId === merchant.tenantId).length;
		return {
			tenantId: merchant.tenantId,
			merchantName: merchant.merchantName,
			rewardName: merchant.rewardName,
			stamps: count % merchant.stampsPerReward,
			stampsPerReward: merchant.stampsPerReward,
		};
	})
		.filter((card: StampCard): boolean => card.stamps > 0)
		.sort((left: StampCard, right: StampCard): number => right.stamps / right.stampsPerReward - left.stamps / left.stampsPerReward)
		.slice(0, STAMP_CARDS_LIMIT);
}

/** The calendar month of the range's last day, from its 1st up to the end of that day. */
function monthBudgetOf(range: AnalyticsReportRange): MonthBudget {
	const lastDay = new Date(range.to - 1);
	const monthStart = Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), 1);
	const nextMonthStart = Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth() + 1, 1);
	return {
		from: EpochMsSchema.parse(monthStart),
		to: range.to,
		budgetMinor: SAMPLE_MONTHLY_BUDGET_MINOR,
		spentMinor: sumOf(daysOf(monthStart, range.to), spentOf),
		daysElapsed: Math.round((range.to - monthStart) / DAY_MS),
		daysInMonth: Math.round((nextMonthStart - monthStart) / DAY_MS),
	};
}

/** The sample customer's extras over `range` (and the period before it). */
export function sampleActivityInsights(range: AnalyticsReportRange): ActivityInsights {
	const visits = visitsOf(daysOf(range.from, range.to));
	const previousVisits = visitsOf(daysOf(range.previousFrom, range.previousTo));
	const listed = visits.map(activityVisitOf);
	const biggestBill = listed.reduce(
		(biggest: ActivityVisit | null, visit: ActivityVisit): ActivityVisit => (biggest === null || visit.billMinor > biggest.billMinor ? visit : biggest),
		null,
	);
	return {
		visitsByWeekday: visitsByWeekdayOf(visits),
		spendByDayPart: byDayPart(visits, (visit: DatedVisit): number => visit.billMinor),
		savedMinor: compare(savedOf(visits), savedOf(previousVisits)),
		biggestBill,
		recentVisits: listed.slice(-RECENT_VISITS_LIMIT).reverse(),
		stampCards: stampCardsOf(range),
		monthBudget: monthBudgetOf(range),
	};
}
