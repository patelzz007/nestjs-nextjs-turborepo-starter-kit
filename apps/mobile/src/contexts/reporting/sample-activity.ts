// ============================================
// Sample activity — the generated history behind the Analytics screen
// ============================================
// The screen is UI only for now: it makes no request. Everything it shows is
// built from this one made-up history of a customer (sample-dashboard.ts in the
// API's contract, sample-insights.ts for the extras).
//
// Deterministic: each day's activity comes from a generator seeded by the day
// itself, so a day reads the same in every range and on every render, and the
// totals of a week are exactly the sum of its days. Nothing here is real
// customer data, and the screen says so.

import { DAY_MS, type MerchantBusinessCategory } from "@workspace/shared";

import { DAY_PART_HOURS, DayPartSchema, weekdayOf, type DayPart } from "./activity-insights";

/** A shop the sample customer visits. */
export interface SampleMerchant {
	readonly organizationId: string;
	readonly merchantName: string;
	readonly category: MerchantBusinessCategory;
	/** A usual bill there, in sen; each visit varies around it. */
	readonly typicalBillMinor: number;
	/** Its stamp card: visits to a free reward, what it is and what it is worth (sen). */
	readonly stampsPerReward: number;
	readonly rewardName: string;
	readonly rewardValueMinor: number;
}

/** Most visited first: visits lean towards the top of the list. */
export const SAMPLE_MERCHANTS: readonly SampleMerchant[] = [
	{
		organizationId: "6f1c2a4e-3b7d-4e9a-8c21-5d4f7a9b0e13",
		merchantName: "Kopi Kaki",
		category: "cafe",
		typicalBillMinor: 1_450,
		stampsPerReward: 10,
		rewardName: "Free kopi",
		rewardValueMinor: 650,
	},
	{
		organizationId: "a2d9e7c4-51b3-4f6e-9a08-7c3e2b1d4f56",
		merchantName: "Nasi Lemak Corner",
		category: "restaurant",
		typicalBillMinor: 2_200,
		stampsPerReward: 8,
		rewardName: "Free nasi lemak",
		rewardValueMinor: 1_200,
	},
	{
		organizationId: "c47e1b9a-8d2f-4a35-b6e1-0f9d3c7a2e84",
		merchantName: "Teh Tarik House",
		category: "beverage",
		typicalBillMinor: 900,
		stampsPerReward: 10,
		rewardName: "Free teh tarik",
		rewardValueMinor: 450,
	},
	{
		organizationId: "e8b3f6d1-2c9a-47e5-a1d7-4b6c8e0f3a29",
		merchantName: "Urban Threads",
		category: "retail",
		typicalBillMinor: 8_900,
		stampsPerReward: 5,
		rewardName: "RM 20 voucher",
		rewardValueMinor: 2_000,
	},
	{
		organizationId: "1d5a8c3f-7e2b-4c90-8f46-9a2e5d1b7c03",
		merchantName: "Starlight Cinemas",
		category: "entertainment",
		typicalBillMinor: 3_600,
		stampsPerReward: 6,
		rewardName: "Free ticket",
		rewardValueMinor: 1_800,
	},
	{
		organizationId: "9b4e2d7a-6f1c-4b38-9e5a-3c8d0f2a6b71",
		merchantName: "Serene Day Spa",
		category: "wellness",
		typicalBillMinor: 12_000,
		stampsPerReward: 4,
		rewardName: "Free massage",
		rewardValueMinor: 6_000,
	},
];

/** How the sample customer behaves: the odds behind every generated day. */
export const SAMPLE_BEHAVIOUR = {
	/** Seeds every day's generator; change it for a different (but still stable) history. */
	seed: 20_261_012,
	/** Mixed into the seed of each day's second generator (visit times), so it never repeats the first. */
	timingSalt: 0x5eed,
	/** Cumulative odds of 0, 1 and 2 visits on a weekday (anything above the last is 3)… */
	visitOdds: [0.3, 0.7, 0.92],
	/** …and on a Saturday or Sunday, when the customer is out more. */
	weekendVisitOdds: [0.12, 0.45, 0.8],
	/** > 1 leans visits towards the merchants at the top of the list. */
	merchantSkew: 1.7,
	/** A bill is the merchant's usual bill times 0.6–1.4. */
	billSpreadMin: 0.6,
	billSpreadRange: 0.8,
	/** Bills round to 10 sen. */
	billRoundingMinor: 10,
	/** Odds a visit comes with a claimed reward, and that a claimed reward is redeemed. */
	claimOdds: 0.55,
	redeemOdds: 0.68,
	/** Odds of a referral link shared on a day, and that the friend redeems it. */
	referralOdds: 0.12,
	creditOdds: 0.45,
	/** An unredeemed claim stays usable this many days, then expires. */
	claimValidityDays: 14,
	/** Cumulative odds of a visit in the morning, at midday and in the afternoon (else the evening): lunch on weekdays… */
	weekdayDayPartOdds: [0.2, 0.6, 0.75],
	/** …and later in the day at weekends. */
	weekendDayPartOdds: [0.15, 0.4, 0.7],
};

/** One visit of a generated day. */
export interface SampleVisit {
	readonly merchant: SampleMerchant;
	readonly billMinor: number;
	/** Minutes after the day's (UTC) midnight. */
	readonly minuteOfDay: number;
	readonly claimed: boolean;
	readonly redeemed: boolean;
}

/** One generated day. */
export interface SampleDay {
	readonly startMs: number;
	readonly visits: readonly SampleVisit[];
	readonly claims: number;
	readonly redemptions: number;
	readonly referralsSent: number;
	readonly referralsCredited: number;
}

/** 32-bit arithmetic of the generator below. */
const UINT32 = 2 ** 32;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_SHIFTS = { first: 15, second: 7, third: 14 };
const MULBERRY_OR_ONE = 1;
const MULBERRY_OR_SECOND = 61;

/** A small, fast seeded generator (mulberry32): the same seed gives the same numbers in [0, 1). */
function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return (): number => {
		state = (state + MULBERRY_INCREMENT) >>> 0;
		let mixed = Math.imul(state ^ (state >>> MULBERRY_SHIFTS.first), state | MULBERRY_OR_ONE);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> MULBERRY_SHIFTS.second), mixed | MULBERRY_OR_SECOND);
		return ((mixed ^ (mixed >>> MULBERRY_SHIFTS.third)) >>> 0) / UINT32;
	};
}

/** The first of a cumulative odds table the roll falls under (past the last: one more). */
function bandOf(roll: number, odds: readonly number[]): number {
	const band = odds.findIndex((limit: number): boolean => roll < limit);
	return band === -1 ? odds.length : band;
}

function isWeekend(startMs: number): boolean {
	const weekday = weekdayOf(startMs);
	return weekday === "saturday" || weekday === "sunday";
}

interface VisitDraft {
	readonly merchant: SampleMerchant;
	readonly billMinor: number;
}

function sampleVisitDraft(random: () => number): VisitDraft {
	const merchantIndex = Math.min(SAMPLE_MERCHANTS.length - 1, Math.floor(random() ** SAMPLE_BEHAVIOUR.merchantSkew * SAMPLE_MERCHANTS.length));
	const merchant = SAMPLE_MERCHANTS.at(merchantIndex) ?? SAMPLE_MERCHANTS.at(0);
	if (merchant === undefined) {
		throw new Error("The sample merchant list is empty");
	}
	const spread = SAMPLE_BEHAVIOUR.billSpreadMin + random() * SAMPLE_BEHAVIOUR.billSpreadRange;
	const billMinor = Math.round((merchant.typicalBillMinor * spread) / SAMPLE_BEHAVIOUR.billRoundingMinor) * SAMPLE_BEHAVIOUR.billRoundingMinor;
	return { merchant, billMinor };
}

const MINUTES_PER_HOUR = 60;

/** A time of day: a part of the day by the day's odds, then a minute within it. */
function sampleMinuteOfDay(timing: () => number, weekend: boolean): number {
	const odds = weekend ? SAMPLE_BEHAVIOUR.weekendDayPartOdds : SAMPLE_BEHAVIOUR.weekdayDayPartOdds;
	const part: DayPart = DayPartSchema.options.at(bandOf(timing(), odds)) ?? "evening";
	const hours = DAY_PART_HOURS[part];
	const from = hours.fromHour * MINUTES_PER_HOUR;
	return from + Math.floor(timing() * (hours.toHour * MINUTES_PER_HOUR - from));
}

/** The activity of the day starting at `startMs` (a UTC midnight) — always the same for the same day. */
export function sampleDay(startMs: number): SampleDay {
	const dayNumber = Math.floor(startMs / DAY_MS);
	const random = seededRandom(SAMPLE_BEHAVIOUR.seed + dayNumber);
	const timing = seededRandom((SAMPLE_BEHAVIOUR.seed ^ SAMPLE_BEHAVIOUR.timingSalt) + dayNumber);
	const weekend = isWeekend(startMs);
	const drafts = [...Array<number>(bandOf(random(), weekend ? SAMPLE_BEHAVIOUR.weekendVisitOdds : SAMPLE_BEHAVIOUR.visitOdds)).keys()].map((): VisitDraft =>
		sampleVisitDraft(random),
	);
	const claimed = drafts.map((): boolean => random() < SAMPLE_BEHAVIOUR.claimOdds);
	const redeemed = claimed.map((isClaimed: boolean): boolean => isClaimed && random() < SAMPLE_BEHAVIOUR.redeemOdds);
	const referralsSent = random() < SAMPLE_BEHAVIOUR.referralOdds ? 1 : 0;
	const referralsCredited = referralsSent > 0 && random() < SAMPLE_BEHAVIOUR.creditOdds ? 1 : 0;
	const visits = drafts
		.map((draft: VisitDraft, index: number): SampleVisit => ({
			...draft,
			minuteOfDay: sampleMinuteOfDay(timing, weekend),
			claimed: claimed.at(index) ?? false,
			redeemed: redeemed.at(index) ?? false,
		}))
		.sort((left: SampleVisit, right: SampleVisit): number => left.minuteOfDay - right.minuteOfDay);
	return {
		startMs,
		visits,
		claims: visits.filter((visit: SampleVisit): boolean => visit.claimed).length,
		redemptions: visits.filter((visit: SampleVisit): boolean => visit.redeemed).length,
		referralsSent,
		referralsCredited,
	};
}

/** Every day in `[fromMs, toMs)`. */
export function daysOf(fromMs: number, toMs: number): readonly SampleDay[] {
	const count = Math.max(0, Math.round((toMs - fromMs) / DAY_MS));
	return [...Array<number>(count).keys()].map((index: number): SampleDay => sampleDay(fromMs + index * DAY_MS));
}

export function sumOf<TItem>(items: readonly TItem[], read: (item: TItem) => number): number {
	return items.reduce((total: number, item: TItem): number => total + read(item), 0);
}

/** What the visits of a day cost, in minor units. */
export function spentOf(day: SampleDay): number {
	return sumOf(day.visits, (visit: SampleVisit): number => visit.billMinor);
}

/** A visit with the day it was on. */
export interface DatedVisit extends SampleVisit {
	/** The (UTC) midnight starting its day. */
	readonly dayStartMs: number;
}

/** Every visit of the days, in time order. */
export function visitsOf(days: readonly SampleDay[]): readonly DatedVisit[] {
	return days.flatMap((day: SampleDay): DatedVisit[] => day.visits.map((visit: SampleVisit): DatedVisit => ({ ...visit, dayStartMs: day.startMs })));
}
