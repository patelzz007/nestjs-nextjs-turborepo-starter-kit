// The Analytics screen's extras: what the customer's activity says beyond the
// API's dashboard contract — when they shop (day of the week, time of day),
// what rewards saved them, their stamp cards, this month's budget and their
// latest visits. Mobile-only and sample-only for now: no endpoint returns
// these yet (ADR 048), so this is the shape a future one would fill.
// Closed sets are zod enums, as everywhere (rules/28).

import type { AnalyticsComparison, EpochMs, MerchantBusinessCategory } from "@workspace/shared";
import { z } from "zod";

/** The days of the week, Monday first (the API's week starts on Monday). */
export const WeekdaySchema = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

export type Weekday = z.output<typeof WeekdaySchema>;

/** The parts of a shopping day. */
export const DayPartSchema = z.enum(["morning", "midday", "afternoon", "evening"]);

export type DayPart = z.output<typeof DayPartSchema>;

/** The hours each part of the day covers, from its first hour up to (not including) its last. */
export const DAY_PART_HOURS: Readonly<Record<DayPart, { readonly fromHour: number; readonly toHour: number }>> = {
	morning: { fromHour: 7, toHour: 11 },
	midday: { fromHour: 11, toHour: 14 },
	afternoon: { fromHour: 14, toHour: 17 },
	evening: { fromHour: 17, toHour: 22 },
};

/** What became of the reward a visit came with. */
export const VisitRewardSchema = z.enum(["none", "claimed", "redeemed"]);

export type VisitReward = z.output<typeof VisitRewardSchema>;

/** One counted value per part of the day. */
export type DayPartValues = Readonly<Record<DayPart, number>>;

/** One visit: where, when, what it cost and what came of its reward. */
export interface ActivityVisit {
	/** Stable per visit. */
	readonly id: string;
	readonly at: EpochMs;
	readonly organizationId: string;
	readonly merchantName: string;
	readonly category: MerchantBusinessCategory;
	readonly billMinor: number;
	readonly reward: VisitReward;
}

/** A shop's stamp card: visits since the last free reward there. */
export interface StampCard {
	readonly organizationId: string;
	readonly merchantName: string;
	/** What a full card earns ("Free kopi"). */
	readonly rewardName: string;
	readonly stamps: number;
	readonly stampsPerReward: number;
}

/** The calendar month of a range's last day, up to that day, against a budget the customer set. */
export interface MonthBudget {
	/** The month's first day (inclusive) and the end of the range's last day (exclusive). */
	readonly from: EpochMs;
	readonly to: EpochMs;
	readonly budgetMinor: number;
	readonly spentMinor: number;
	/** Days of the month up to and including the range's last day. */
	readonly daysElapsed: number;
	readonly daysInMonth: number;
}

export interface ActivityInsights {
	/** The range's visits by weekday and part of the day. */
	readonly visitsByWeekday: Readonly<Record<Weekday, DayPartValues>>;
	/** The range's spend by part of the day, in minor units. */
	readonly spendByDayPart: DayPartValues;
	/** What redeemed rewards saved in the range, against the previous period. */
	readonly savedMinor: AnalyticsComparison;
	/** The range's largest bill. */
	readonly biggestBill: ActivityVisit | null;
	/** The range's latest visits, newest first. */
	readonly recentVisits: readonly ActivityVisit[];
	/** The fullest stamp cards first. */
	readonly stampCards: readonly StampCard[];
	readonly monthBudget: MonthBudget;
}

const MINUTES_PER_HOUR = 60;

/** The part of the day a time falls in (before the morning counts as morning, after the evening as evening). */
export function dayPartOf(minuteOfDay: number): DayPart {
	const hour = minuteOfDay / MINUTES_PER_HOUR;
	return (
		DayPartSchema.options.find((part: DayPart): boolean => hour >= DAY_PART_HOURS[part].fromHour && hour < DAY_PART_HOURS[part].toHour) ??
		(hour < DAY_PART_HOURS.morning.fromHour ? "morning" : "evening")
	);
}

/** `Date#getUTCDay` counts from Sunday; the week here starts on Monday. */
const DAYS_PER_WEEK = 7;
const MONDAY_OFFSET = 6;

/** The UTC weekday of an instant. */
export function weekdayOf(epochMs: number): Weekday {
	return WeekdaySchema.options.at((new Date(epochMs).getUTCDay() + MONDAY_OFFSET) % DAYS_PER_WEEK) ?? "monday";
}
