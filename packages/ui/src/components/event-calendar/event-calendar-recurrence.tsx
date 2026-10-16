// Ported from ReUI (https://reui.io/r/base-vega/event-calendar-recurrence.json):
// RFC 5545 subset recurrence expansion — structured rules or raw RRULE strings,
// with a hard occurrence cap. Exports and behaviour match ReUI; the deviations
// are mechanical: enumerated RRULE values are validated with the zod schemas in
// `event-calendar-types` (no casts), RegExp matches read named groups, and the
// calendar maths runs in the display time zone through `TZDate` everywhere
// (ReUI used the host zone for month lengths and weekday lookups).
import { TZDate } from "@date-fns/tz";
import { isStringPrimitive } from "@workspace/shared";
import { addDays, addMonths, addWeeks, addYears, getDaysInMonth } from "date-fns";

import {
	EVENT_CALENDAR_WEEKDAYS,
	EventCalendarFrequencySchema,
	EventCalendarWeekdaySchema,
	type CalendarEvent,
	type EventCalendarByWeekday,
	type EventCalendarDateRange,
	type EventCalendarEventData,
	type EventCalendarFrequency,
	type EventCalendarOccurrence,
	type EventCalendarRecurrenceRule,
	type EventCalendarWeekday,
} from "./event-calendar-types";

/** Guard: max window-intersecting occurrences per event per expansion. */
export const MAX_OCCURRENCES = 1000;

/** Runaway guard: absolute cap on period iterations regardless of visibility. */
const MAX_ITERATIONS = 10000;

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
/** Mean Gregorian year length in days (400-year cycle). */
const MEAN_DAYS_PER_YEAR = 365.2425;
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Gregorian mean period lengths for the O(1) fast-forward approximation. */
const PERIOD_MS: Readonly<Record<EventCalendarFrequency, number>> = {
	daily: MS_PER_DAY,
	weekly: MS_PER_DAY * DAYS_PER_WEEK,
	monthly: (MS_PER_DAY * MEAN_DAYS_PER_YEAR) / MONTHS_PER_YEAR,
	yearly: MS_PER_DAY * MEAN_DAYS_PER_YEAR,
};

/** Periods the fast-forward lands before the window, so mean-length drift never skips one. */
const FAST_FORWARD_SAFETY_PERIODS = 2;

/** Wall time an UNTIL value without a time part means: the end of that day, inclusive. */
const END_OF_DAY_HOUR = "23";
const END_OF_DAY_MINUTE = "59";
const END_OF_DAY_SECOND = "59";

const RADIX_DECIMAL = 10;

/** The last day of a week, as an offset from its first day. */
const LAST_WEEKDAY_OFFSET = DAYS_PER_WEEK - 1;

const RRULE_PREFIX = /^RRULE:/i;
const BYDAY_TOKEN = /^(?<ordinal>[+-]?\d+)?(?<day>SU|MO|TU|WE|TH|FR|SA)$/;
const RRULE_DATE = /^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})(?:T(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})(?<utc>Z)?)?$/;

/** A rule part this subset does not support; plug a full engine through `getOccurrences` for those. */
export class EventCalendarRecurrenceError extends Error {
	public constructor(part: string) {
		super(`Unsupported recurrence part: ${part}. Use the getOccurrences prop to plug a full RRULE engine for exotic rules.`);
		this.name = "EventCalendarRecurrenceError";
	}
}

/** A rule under construction while parsing: every part optional and writable. */
type RecurrenceRuleDraft = { -readonly [Key in keyof EventCalendarRecurrenceRule]?: EventCalendarRecurrenceRule[Key] };

function parsePositiveInteger(value: string): number {
	const parsed = Number.parseInt(value, RADIX_DECIMAL);
	return Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
}

function parseByWeekdayToken(token: string): EventCalendarByWeekday {
	// RFC 5545 3.1: enumerated values are case-insensitive.
	const groups = BYDAY_TOKEN.exec(token.trim().toUpperCase())?.groups;
	const day = EventCalendarWeekdaySchema.safeParse(groups?.day);
	if (!day.success) {
		throw new EventCalendarRecurrenceError(`BYDAY=${token}`);
	}
	const ordinal = groups?.ordinal;
	return ordinal === undefined ? day.data : { day: day.data, ordinal: Number.parseInt(ordinal, RADIX_DECIMAL) };
}

function parseByMonthDayToken(token: string): number {
	const day = Number.parseInt(token, RADIX_DECIMAL);
	// NaN would match no day in any month and leave the event permanently invisible.
	if (Number.isNaN(day)) {
		throw new EventCalendarRecurrenceError(`BYMONTHDAY=${token}`);
	}
	return day;
}

/**
 * The UNTIL instant. RFC 5545 basic formats: YYYYMMDD or YYYYMMDDTHHMMSS(Z).
 * Z-less values (including date-only ones, which mean end of that day
 * inclusive) are wall time in the display zone; without one, the host zone.
 */
function parseRRuleDate(value: string, timeZone?: string): Date {
	const groups = RRULE_DATE.exec(value.trim().toUpperCase())?.groups;
	const year = groups?.year;
	const month = groups?.month;
	const day = groups?.day;
	if (year === undefined || month === undefined || day === undefined) {
		throw new EventCalendarRecurrenceError(`UNTIL=${value}`);
	}
	const hour = groups?.hour ?? END_OF_DAY_HOUR;
	const minute = groups?.minute ?? END_OF_DAY_MINUTE;
	const second = groups?.second ?? END_OF_DAY_SECOND;
	const parts: readonly [number, number, number, number, number, number] = [Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)];
	const [y, m, d, hh, mm, ss] = parts;
	let instant: Date;
	if (groups?.utc !== undefined) {
		instant = new Date(Date.UTC(y, m, d, hh, mm, ss));
	} else if (timeZone === undefined) {
		instant = new Date(y, m, d, hh, mm, ss);
	} else {
		instant = new Date(new TZDate(y, m, d, hh, mm, ss, timeZone).getTime());
	}
	if (Number.isNaN(instant.getTime())) {
		throw new EventCalendarRecurrenceError(`UNTIL=${value}`);
	}
	return instant;
}

function applyRRulePart(rule: RecurrenceRuleDraft, key: string, value: string, timeZone: string | undefined): void {
	switch (key) {
		case "FREQ": {
			const freq = EventCalendarFrequencySchema.safeParse(value.toLowerCase());
			if (!freq.success) {
				throw new EventCalendarRecurrenceError(`FREQ=${value}`);
			}
			rule.freq = freq.data;
			return;
		}
		case "INTERVAL":
			rule.interval = parsePositiveInteger(value);
			return;
		case "COUNT":
			rule.count = parsePositiveInteger(value);
			return;
		case "UNTIL":
			rule.until = parseRRuleDate(value, timeZone);
			return;
		case "BYDAY":
			rule.byWeekday = value.split(",").map(parseByWeekdayToken);
			return;
		case "BYMONTHDAY":
			rule.byMonthDay = value.split(",").map(parseByMonthDayToken);
			return;
		case "BYMONTH":
			rule.byMonth = value.split(",").map((token: string): number => Number.parseInt(token, RADIX_DECIMAL));
			return;
		case "WKST": {
			const weekStart = EventCalendarWeekdaySchema.safeParse(value.trim().toUpperCase());
			if (!weekStart.success) {
				throw new EventCalendarRecurrenceError(`WKST=${value}`);
			}
			rule.weekStart = weekStart.data;
			return;
		}
		default:
			throw new EventCalendarRecurrenceError(key);
	}
}

/**
 * Parses a raw RRULE line (with or without the "RRULE:" prefix) into the
 * structured subset. Pass the display time zone so Z-less UNTIL values are
 * interpreted as wall time in that zone rather than the machine zone.
 */
export function parseRRuleString(input: string, timeZone?: string): EventCalendarRecurrenceRule {
	const body = input.trim().replace(RRULE_PREFIX, "");
	const draft: RecurrenceRuleDraft = {};
	for (const pair of body.split(";")) {
		if (pair === "") {
			continue;
		}
		const [rawKey = "", rawValue = ""] = pair.split("=");
		applyRRulePart(draft, rawKey.toUpperCase(), rawValue, timeZone);
	}
	const { freq } = draft;
	if (freq === undefined) {
		throw new EventCalendarRecurrenceError("missing FREQ");
	}
	return { ...draft, freq };
}

function padTwo(value: number): string {
	return String(value).padStart(2, "0");
}

function formatByWeekday(entry: EventCalendarByWeekday): string {
	return isStringPrimitive(entry) ? entry : `${String(entry.ordinal)}${entry.day}`;
}

/** Serializes the structured subset back to an RRULE line (without prefix). */
export function formatRRuleString(rule: EventCalendarRecurrenceRule): string {
	const parts: string[] = [`FREQ=${rule.freq.toUpperCase()}`];
	if (rule.interval !== undefined && rule.interval > 1) {
		parts.push(`INTERVAL=${String(rule.interval)}`);
	}
	if (rule.count !== undefined) {
		parts.push(`COUNT=${String(rule.count)}`);
	}
	if (rule.until !== undefined) {
		const until = rule.until;
		const date = `${String(until.getUTCFullYear())}${padTwo(until.getUTCMonth() + 1)}${padTwo(until.getUTCDate())}`;
		const time = `${padTwo(until.getUTCHours())}${padTwo(until.getUTCMinutes())}${padTwo(until.getUTCSeconds())}`;
		parts.push(`UNTIL=${date}T${time}Z`);
	}
	if (rule.byWeekday !== undefined && rule.byWeekday.length > 0) {
		parts.push(`BYDAY=${rule.byWeekday.map(formatByWeekday).join(",")}`);
	}
	if (rule.byMonthDay !== undefined && rule.byMonthDay.length > 0) {
		parts.push(`BYMONTHDAY=${rule.byMonthDay.join(",")}`);
	}
	if (rule.byMonth !== undefined && rule.byMonth.length > 0) {
		parts.push(`BYMONTH=${rule.byMonth.join(",")}`);
	}
	if (rule.weekStart !== undefined) {
		parts.push(`WKST=${rule.weekStart}`);
	}
	return parts.join(";");
}

/** A structured rule, parsing a raw RRULE line on the way. */
export function resolveRecurrenceRule(recurrence: EventCalendarRecurrenceRule | string, timeZone?: string): EventCalendarRecurrenceRule {
	return isStringPrimitive(recurrence) ? parseRRuleString(recurrence, timeZone) : recurrence;
}

function weekdayIndex(day: EventCalendarWeekday): number {
	return EVENT_CALENDAR_WEEKDAYS.indexOf(day);
}

function weekdayOf(entry: EventCalendarByWeekday): EventCalendarWeekday {
	return isStringPrimitive(entry) ? entry : entry.day;
}

function ordinalOf(entry: EventCalendarByWeekday): number {
	return isStringPrimitive(entry) ? 0 : entry.ordinal;
}

/** Negative BYMONTHDAY values count back from the month end (-1 = last day). */
function resolveMonthDay(monthDay: number, daysInMonth: number): number {
	return monthDay < 0 ? daysInMonth + 1 + monthDay : monthDay;
}

function uniqueSorted(values: readonly number[]): number[] {
	return [...new Set(values)].sort((left: number, right: number): number => left - right);
}

function occurrenceKey(eventId: string, start: Date): string {
	return `${eventId}::${start.toISOString()}`;
}

/** The recurrence context of one expansion: the rule plus everything derived from DTSTART once. */
interface RecurrencePlan {
	readonly rule: EventCalendarRecurrenceRule;
	readonly interval: number;
	readonly timeZone: string;
	readonly zonedStart: TZDate;
	/** Weekly BYDAY weekdays (0-6), or null for "the DTSTART weekday". */
	readonly weeklyDays: readonly number[] | null;
	/** BYDAY entries resolved inside a month (monthly, and yearly within each BYMONTH). */
	readonly monthlyByDay: readonly EventCalendarByWeekday[] | null;
	/** WKST weekday index (RFC 5545 default MO). */
	readonly weekStartIndex: number;
	/** Yearly months (1-12), ascending. */
	readonly yearlyMonths: readonly number[];
	/** Month-shaped BY* parts make the per-period occurrence count variable. */
	readonly hasMonthDayParts: boolean;
	/** RFC 5545 LIMIT filters (BY* parts that narrow rather than expand). */
	readonly limitByMonth: readonly number[] | null;
	readonly limitByMonthDay: readonly number[] | null;
	readonly limitByWeekday: readonly number[] | null;
}

function weeklyDaysOf(rule: EventCalendarRecurrenceRule): readonly number[] | null {
	if (rule.freq !== "weekly" || rule.byWeekday === undefined || rule.byWeekday.length === 0) {
		return null;
	}
	return [
		...new Set(
			rule.byWeekday.map((entry: EventCalendarByWeekday): number => {
				if (!isStringPrimitive(entry)) {
					throw new EventCalendarRecurrenceError("BYDAY ordinal outside monthly/yearly");
				}
				return weekdayIndex(entry);
			}),
		),
	];
}

function createPlan(rule: EventCalendarRecurrenceRule, zonedStart: TZDate, timeZone: string): RecurrencePlan {
	const hasByWeekday = rule.byWeekday !== undefined && rule.byWeekday.length > 0;
	const hasByMonthDay = rule.byMonthDay !== undefined && rule.byMonthDay.length > 0;
	const validByMonth = (rule.byMonth ?? []).filter((month: number): boolean => month >= 1 && month <= MONTHS_PER_YEAR);
	const monthlyByDay = (rule.freq === "monthly" || rule.freq === "yearly") && hasByWeekday ? (rule.byWeekday ?? null) : null;
	return {
		rule,
		interval: Math.max(1, rule.interval ?? 1),
		timeZone,
		zonedStart,
		weeklyDays: weeklyDaysOf(rule),
		monthlyByDay,
		weekStartIndex: weekdayIndex(rule.weekStart ?? "MO"),
		yearlyMonths: validByMonth.length > 0 ? uniqueSorted(validByMonth) : [zonedStart.getMonth() + 1],
		hasMonthDayParts:
			(rule.freq === "monthly" && (hasByMonthDay || monthlyByDay !== null)) || (rule.freq === "yearly" && (validByMonth.length > 0 || hasByMonthDay || monthlyByDay !== null)),
		limitByMonth: rule.freq !== "yearly" && validByMonth.length > 0 ? validByMonth : null,
		limitByMonthDay: rule.freq === "daily" && hasByMonthDay ? (rule.byMonthDay ?? null) : null,
		limitByWeekday: rule.freq === "daily" && hasByWeekday ? (rule.byWeekday ?? []).map((entry: EventCalendarByWeekday): number => weekdayIndex(weekdayOf(entry))) : null,
	};
}

function hasLimits(plan: RecurrencePlan): boolean {
	return plan.limitByMonth !== null || plan.limitByMonthDay !== null || plan.limitByWeekday !== null;
}

function zonedDaysInMonth(plan: RecurrencePlan, year: number, month: number): number {
	return getDaysInMonth(new TZDate(year, month, 1, plan.timeZone));
}

/** Days from the WKST-aligned week start to `day` (0-6). */
function fromWeekStart(plan: RecurrencePlan, day: number): number {
	return (day - plan.weekStartIndex + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

function passesLimits(plan: RecurrencePlan, candidate: TZDate): boolean {
	if (plan.limitByMonth !== null && !plan.limitByMonth.includes(candidate.getMonth() + 1)) {
		return false;
	}
	if (plan.limitByWeekday !== null && !plan.limitByWeekday.includes(candidate.getDay())) {
		return false;
	}
	if (plan.limitByMonthDay !== null) {
		const total = zonedDaysInMonth(plan, candidate.getFullYear(), candidate.getMonth());
		const day = candidate.getDate();
		if (!plan.limitByMonthDay.some((monthDay: number): boolean => resolveMonthDay(monthDay, total) === day)) {
			return false;
		}
	}
	return true;
}

/** Wall-clock instant in the display zone carrying DTSTART's time-of-day. */
function zonedDate(plan: RecurrencePlan, year: number, month: number, day: number): TZDate {
	const start = plan.zonedStart;
	return new TZDate(year, month, day, start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds(), plan.timeZone);
}

/** Every day-of-month of `month` that falls on `weekday`, ascending. */
function weekdayMatches(plan: RecurrencePlan, year: number, month: number, weekday: number): number[] {
	const total = zonedDaysInMonth(plan, year, month);
	const matches: number[] = [];
	for (let day = 1; day <= total; day++) {
		if (new TZDate(year, month, day, plan.timeZone).getDay() === weekday) {
			matches.push(day);
		}
	}
	return matches;
}

function byDayMatches(plan: RecurrencePlan, byDay: readonly EventCalendarByWeekday[], year: number, month: number): number[] {
	const result: number[] = [];
	for (const entry of byDay) {
		const matches = weekdayMatches(plan, year, month, weekdayIndex(weekdayOf(entry)));
		const ordinal = ordinalOf(entry);
		if (ordinal === 0) {
			result.push(...matches);
			continue;
		}
		// 2TU = 2nd Tuesday, -1FR = last Friday; absent ordinals skip.
		const pick = matches.at(ordinal > 0 ? ordinal - 1 : ordinal);
		if (pick !== undefined) {
			result.push(pick);
		}
	}
	return result;
}

/** Selected days-of-month, ascending: BYMONTHDAY (and) BYDAY, else the clamped anchor day. */
function monthDays(plan: RecurrencePlan, year: number, month: number): number[] {
	const total = zonedDaysInMonth(plan, year, month);
	const { byMonthDay } = plan.rule;
	let days: number[] | null = null;
	if (byMonthDay !== undefined && byMonthDay.length > 0) {
		days = byMonthDay.map((monthDay: number): number => resolveMonthDay(monthDay, total)).filter((day: number): boolean => day >= 1 && day <= total);
	}
	if (plan.monthlyByDay !== null) {
		const matches = byDayMatches(plan, plan.monthlyByDay, year, month);
		days = days === null ? matches : days.filter((day: number): boolean => matches.includes(day));
	}
	return uniqueSorted(days ?? [Math.min(plan.zonedStart.getDate(), total)]);
}

function weeklyCandidates(plan: RecurrencePlan, period: number): TZDate[] {
	const base = addWeeks(plan.zonedStart, period * plan.interval);
	const { weeklyDays } = plan;
	if (weeklyDays === null) {
		return [base];
	}
	const week: TZDate[] = [];
	const baseOffset = fromWeekStart(plan, base.getDay());
	for (let offset = 0; offset < DAYS_PER_WEEK; offset++) {
		const candidate = addDays(base, offset - baseOffset);
		// Days of the DTSTART week before DTSTART are not part of the series.
		if (weeklyDays.includes(candidate.getDay()) && candidate.getTime() >= plan.zonedStart.getTime()) {
			week.push(candidate);
		}
	}
	return week;
}

/** Chronological candidates of one period, derived from the DTSTART anchor by index (no drift). */
function periodCandidates(plan: RecurrencePlan, period: number): TZDate[] {
	const { freq } = plan.rule;
	const startMs = plan.zonedStart.getTime();
	if (freq === "daily") {
		return [addDays(plan.zonedStart, period * plan.interval)];
	}
	if (freq === "weekly") {
		return weeklyCandidates(plan, period);
	}
	if (freq === "monthly") {
		const anchor = addMonths(plan.zonedStart, period * plan.interval);
		const year = anchor.getFullYear();
		const month = anchor.getMonth();
		return monthDays(plan, year, month)
			.map((day: number): TZDate => zonedDate(plan, year, month, day))
			.filter((candidate: TZDate): boolean => candidate.getTime() >= startMs);
	}
	const year = addYears(plan.zonedStart, period * plan.interval).getFullYear();
	const dates: TZDate[] = [];
	for (const month of plan.yearlyMonths) {
		for (const day of monthDays(plan, year, month - 1)) {
			dates.push(zonedDate(plan, year, month - 1, day));
		}
	}
	return dates.filter((candidate: TZDate): boolean => candidate.getTime() >= startMs);
}

/** Candidates of one period with the LIMIT filters applied. */
function candidatesFor(plan: RecurrencePlan, period: number): TZDate[] {
	const candidates = periodCandidates(plan, period);
	return hasLimits(plan) ? candidates.filter((candidate: TZDate): boolean => passesLimits(plan, candidate)) : candidates;
}

type PeriodEdge = "first" | "last";

/** Earliest/latest instant a period can produce — loop bounds without expanding it. */
function periodEdge(plan: RecurrencePlan, period: number, edge: PeriodEdge): TZDate {
	const { freq } = plan.rule;
	if (freq === "daily") {
		return addDays(plan.zonedStart, period * plan.interval);
	}
	if (freq === "weekly") {
		const base = addWeeks(plan.zonedStart, period * plan.interval);
		if (plan.weeklyDays === null) {
			return base;
		}
		return addDays(base, (edge === "first" ? 0 : LAST_WEEKDAY_OFFSET) - fromWeekStart(plan, base.getDay()));
	}
	if (freq === "monthly") {
		const anchor = addMonths(plan.zonedStart, period * plan.interval);
		const year = anchor.getFullYear();
		const month = anchor.getMonth();
		return zonedDate(plan, year, month, edge === "first" ? 1 : zonedDaysInMonth(plan, year, month));
	}
	const year = addYears(plan.zonedStart, period * plan.interval).getFullYear();
	const anchorMonth = plan.zonedStart.getMonth() + 1;
	const month = (edge === "first" ? (plan.yearlyMonths.at(0) ?? anchorMonth) : (plan.yearlyMonths.at(-1) ?? anchorMonth)) - 1;
	return zonedDate(plan, year, month, edge === "first" ? 1 : zonedDaysInMonth(plan, year, month));
}

/** The series ordinal of the first candidate of `startPeriod`, so COUNT and recurrenceIndex stay exact. */
function ordinalAtPeriod(plan: RecurrencePlan, startPeriod: number): number {
	if (startPeriod === 0) {
		return 0;
	}
	if (plan.hasMonthDayParts || hasLimits(plan)) {
		// Per-period counts vary (skipped days, 4-vs-5 weekday months), so sum them.
		let index = 0;
		for (let period = 0; period < startPeriod; period++) {
			index += candidatesFor(plan, period).length;
		}
		return index;
	}
	const { weeklyDays } = plan;
	if (weeklyDays !== null) {
		// Week 0 only counts selected weekdays at/after DTSTART's.
		const anchorOffset = fromWeekStart(plan, plan.zonedStart.getDay());
		const firstWeek = weeklyDays.filter((day: number): boolean => fromWeekStart(plan, day) >= anchorOffset).length;
		return firstWeek + (startPeriod - 1) * weeklyDays.length;
	}
	return startPeriod;
}

/** The first period whose last instant can still reach the window. */
function firstVisiblePeriod(plan: RecurrencePlan, range: EventCalendarDateRange, durationMs: number): number {
	const aheadMs = range.start.getTime() - durationMs - plan.zonedStart.getTime();
	const stepMs = PERIOD_MS[plan.rule.freq] * plan.interval;
	let startPeriod = aheadMs > 0 ? Math.max(0, Math.floor(aheadMs / stepMs) - FAST_FORWARD_SAFETY_PERIODS) : 0;
	// Mean-length drift is bounded well under one period — refine forward.
	while (periodEdge(plan, startPeriod, "last").getTime() + durationMs <= range.start.getTime()) {
		startPeriod++;
	}
	return startPeriod;
}

/**
 * The end instant of an occurrence starting at `start`. A span of whole local
 * days is wall time, not an absolute delta — a 3-day all-day bar crossing a DST
 * change keeps 3 days. Timed spans stay absolute so a 2-hour meeting stays 2h.
 */
function createEndResolver(event: CalendarEvent, zonedStart: TZDate, timeZone: string): (start: Date) => Date {
	const durationMs = event.end.getTime() - event.start.getTime();
	const daySpan = Math.round(durationMs / MS_PER_DAY);
	const wallDaySpan = daySpan > 0 && addDays(zonedStart, daySpan).getTime() === event.end.getTime() ? daySpan : null;
	return (start: Date): Date =>
		wallDaySpan === null ? new Date(start.getTime() + durationMs) : new Date(addDays(new TZDate(start.getTime(), timeZone), wallDaySpan).getTime());
}

function singleOccurrence<TData extends EventCalendarEventData>(event: CalendarEvent<TData>, range: EventCalendarDateRange): EventCalendarOccurrence<TData>[] {
	// A zero-length milestone pinned to the first visible instant only has to be inside.
	const isPoint = event.end.getTime() === event.start.getTime();
	const visible = event.start < range.end && (event.end > range.start || (isPoint && event.start >= range.start));
	if (!visible) {
		return [];
	}
	return [{ key: occurrenceKey(event.id, event.start), eventId: event.id, event, start: event.start, end: event.end, allDay: event.allDay ?? false, isRecurring: false }];
}

/**
 * Expands one event into its occurrences intersecting the range.
 * Non-recurring events yield at most one occurrence. Recurrence iteration is
 * wall-time based in the display zone (DST-safe day/week/month steps).
 *
 * exDates remove exactly-matching instants (after COUNT numbering,
 * Google-style: an exception still consumes its COUNT slot); rDates add extra
 * instants with the same duration. RECURRENCE-ID override replacement lives
 * in buildEventIndex, where the override event and its parent series meet.
 */
export function expandRecurrence<TData extends EventCalendarEventData>(
	event: CalendarEvent<TData>,
	range: EventCalendarDateRange,
	context: { readonly timeZone: string },
): EventCalendarOccurrence<TData>[] {
	if (event.recurrence === undefined) {
		return singleOccurrence(event, range);
	}
	const { timeZone } = context;
	const allDay = event.allDay ?? false;
	const rule = resolveRecurrenceRule(event.recurrence, timeZone);
	const durationMs = event.end.getTime() - event.start.getTime();
	const zonedStart = new TZDate(event.start.getTime(), timeZone);
	const plan = createPlan(rule, zonedStart, timeZone);
	const endFor = createEndResolver(event, zonedStart, timeZone);
	const exTimes = new Set((rule.exDates ?? []).map((date: Date): number => date.getTime()));
	const untilMs = rule.until?.getTime();
	const occurrences: EventCalendarOccurrence<TData>[] = [];

	const startPeriod = firstVisiblePeriod(plan, range, durationMs);
	let index = ordinalAtPeriod(plan, startPeriod);

	const pushIfVisible = (rawStart: Date, recurrenceIndex: number): void => {
		// Normalize to a plain instant so consumers never receive zone-carrying TZDates.
		const start = new Date(rawStart.getTime());
		if (exTimes.has(start.getTime())) {
			return;
		}
		const end = endFor(start);
		if (start < range.end && end > range.start) {
			occurrences.push({ key: occurrenceKey(event.id, start), eventId: event.id, event, start, end, allDay, isRecurring: true, recurrenceIndex });
		}
	};

	const reachedEnd = (candidateMs: number): boolean => (rule.count !== undefined && index >= rule.count) || (untilMs !== undefined && candidateMs > untilMs);

	let period = startPeriod;
	for (let iterations = 0; iterations < MAX_ITERATIONS && occurrences.length < MAX_OCCURRENCES; iterations++) {
		// Whole-period bounds (no break on a mid-period candidate), so earlier ones are still emitted.
		const earliest = periodEdge(plan, period, "first").getTime();
		if (earliest >= range.end.getTime() || reachedEnd(earliest)) {
			break;
		}
		let ended = false;
		for (const candidate of candidatesFor(plan, period)) {
			if (reachedEnd(candidate.getTime())) {
				ended = true;
				break;
			}
			pushIfVisible(candidate, index);
			index++;
			if (occurrences.length >= MAX_OCCURRENCES) {
				ended = true;
				break;
			}
		}
		if (ended) {
			break;
		}
		period++;
	}

	if (rule.rDates !== undefined && rule.rDates.length > 0) {
		const seen = new Set(occurrences.map((occurrence: EventCalendarOccurrence<TData>): number => occurrence.start.getTime()));
		for (const rDate of rule.rDates) {
			const start = new Date(rDate.getTime());
			const end = endFor(start);
			if (seen.has(start.getTime()) || exTimes.has(start.getTime()) || start >= range.end || end <= range.start) {
				continue;
			}
			seen.add(start.getTime());
			// Keep counting past the generated instants so every instance keeps a series position.
			occurrences.push({ key: occurrenceKey(event.id, start), eventId: event.id, event, start, end, allDay, isRecurring: true, recurrenceIndex: index });
			index++;
		}
		occurrences.sort((left: EventCalendarOccurrence<TData>, right: EventCalendarOccurrence<TData>): number => left.start.getTime() - right.start.getTime());
	}

	return occurrences;
}
