/**
 * RFC 5545 subset recurrence expansion for the gantt — structured rules or raw
 * RRULE strings, with a hard occurrence cap. Pure and React-free: every
 * function takes the display time zone explicitly and never reads the clock.
 */
import { TZDate } from "@date-fns/tz";
import { isStringPrimitive } from "@workspace/shared";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { z } from "zod";

import type { GanttData, GanttDateRange, GanttEvent, GanttOccurrence, GanttOrdinalWeekday, GanttRecurrenceFrequency, GanttRecurrenceRule, GanttWeekday } from "./gantt-types";

/** Guard: max occurrences per event per expansion. */
export const MAX_OCCURRENCES = 1000;

/** Weekday codes in `Date#getDay()` order (0 = Sunday). */
const WEEKDAYS: readonly [GanttWeekday, GanttWeekday, GanttWeekday, GanttWeekday, GanttWeekday, GanttWeekday, GanttWeekday] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const GanttWeekdaySchema = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
const GanttFrequencySchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_HOUR = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;
const DAYS_PER_WEEK = 7;
/** The longest month / year, so a fast-forward jump can never overshoot. */
const MAX_DAYS_PER_MONTH = 31;
const MAX_DAYS_PER_YEAR = 366;
/** A weekly BYDAY series emits across the cursor's whole Sunday-anchored week. */
const WEEK_SLACK_DAYS = DAYS_PER_WEEK - 1;
/** Fast-forward runs at most this many jump passes before the step-by-step remainder. */
const FAST_FORWARD_PASSES = 2;
/** Upper bound on single steps that close the remainder after a fast-forward jump. */
const MAX_CATCH_UP_STEPS = 10_000;
const DECIMAL_RADIX = 10;
/** INTERVAL / COUNT below 1 (or unparsable) clamp to 1. */
const MIN_RULE_NUMBER = 1;
/** RFC 5545 months are 1-based; `Date` months are 0-based. */
const MONTH_NUMBER_OFFSET = 1;
/** A date-only UNTIL is inclusive of its whole day. */
const END_OF_DAY_HOUR = "23";
const END_OF_DAY_MINUTE = "59";
const END_OF_DAY_SECOND = "59";
const RRULE_FIELD_WIDTH = 2;

const RRULE_PREFIX = /^RRULE:/i;
const BYDAY_TOKEN = /^(?<ordinal>-?\d+)?(?<day>SU|MO|TU|WE|TH|FR|SA)$/;
const RRULE_DATE = /^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})(?:T(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})(?<utc>Z)?)?$/;

export class GanttRecurrenceError extends Error {
	public constructor(part: string) {
		super(`Unsupported recurrence part: ${part}. Use the getOccurrences prop to plug a full RRULE engine for exotic rules.`);
		this.name = "GanttRecurrenceError";
	}
}

type GanttRecurrenceRuleDraft = { -readonly [Key in keyof GanttRecurrenceRule]?: GanttRecurrenceRule[Key] };

function parseRuleNumber(value: string): number {
	return Math.max(MIN_RULE_NUMBER, Number.parseInt(value, DECIMAL_RADIX) || MIN_RULE_NUMBER);
}

function parseNumberList(value: string): number[] {
	return value.split(",").map((part: string): number => Number.parseInt(part, DECIMAL_RADIX));
}

function parseByDayToken(token: string): GanttWeekday | GanttOrdinalWeekday {
	const groups = BYDAY_TOKEN.exec(token.trim())?.groups;
	const day = GanttWeekdaySchema.safeParse(groups?.day);
	if (!day.success) {
		throw new GanttRecurrenceError(`BYDAY=${token}`);
	}
	const ordinal = groups?.ordinal;
	return ordinal === undefined ? day.data : { day: day.data, ordinal: Number.parseInt(ordinal, DECIMAL_RADIX) };
}

/**
 * Parses an RFC 5545 UNTIL value. Floating (non-Z) boundaries resolve in the
 * DISPLAY zone when known — local-zone parsing would shift the series end per
 * visitor machine.
 */
function parseRRuleDate(value: string, timeZone: string | undefined): Date {
	const groups = RRULE_DATE.exec(value)?.groups;
	const year = groups?.year;
	const month = groups?.month;
	const day = groups?.day;
	if (year === undefined || month === undefined || day === undefined) {
		throw new GanttRecurrenceError(`UNTIL=${value}`);
	}
	const hour = groups?.hour ?? END_OF_DAY_HOUR;
	const minute = groups?.minute ?? END_OF_DAY_MINUTE;
	const second = groups?.second ?? END_OF_DAY_SECOND;
	const isUtc = groups?.utc !== undefined;
	const date =
		!isUtc && timeZone !== undefined
			? new TZDate(Number(year), Number(month) - MONTH_NUMBER_OFFSET, Number(day), Number(hour), Number(minute), Number(second), timeZone)
			: new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${isUtc ? "Z" : ""}`);
	if (Number.isNaN(date.getTime())) {
		throw new GanttRecurrenceError(`UNTIL=${value}`);
	}
	return new Date(date.getTime());
}

function applyRRulePart(rule: GanttRecurrenceRuleDraft, key: string, value: string, timeZone: string | undefined): void {
	switch (key) {
		case "FREQ": {
			const freq = GanttFrequencySchema.safeParse(value.toLowerCase());
			if (!freq.success) {
				throw new GanttRecurrenceError(`FREQ=${value}`);
			}
			rule.freq = freq.data;
			return;
		}
		case "INTERVAL":
			rule.interval = parseRuleNumber(value);
			return;
		case "COUNT":
			rule.count = parseRuleNumber(value);
			return;
		case "UNTIL":
			rule.until = parseRRuleDate(value, timeZone);
			return;
		case "BYDAY":
			rule.byWeekday = value.split(",").map(parseByDayToken);
			return;
		case "BYMONTHDAY":
			rule.byMonthDay = parseNumberList(value);
			return;
		case "BYMONTH":
			rule.byMonth = parseNumberList(value);
			return;
		case "WKST": {
			const weekStart = GanttWeekdaySchema.safeParse(value);
			if (!weekStart.success) {
				throw new GanttRecurrenceError(`WKST=${value}`);
			}
			rule.weekStart = weekStart.data;
			return;
		}
		default:
			throw new GanttRecurrenceError(key);
	}
}

/**
 * Parses a raw RRULE line (with or without the "RRULE:" prefix) into the
 * structured subset. Pass the display time zone so a floating UNTIL (no
 * trailing Z) resolves there instead of in the runtime's local zone.
 */
export function parseRRuleString(input: string, timeZone?: string): GanttRecurrenceRule {
	const body = input.trim().replace(RRULE_PREFIX, "");
	const draft: GanttRecurrenceRuleDraft = {};
	for (const pair of body.split(";")) {
		if (pair === "") {
			continue;
		}
		const [rawKey = "", rawValue = ""] = pair.split("=");
		applyRRulePart(draft, rawKey.toUpperCase(), rawValue, timeZone);
	}
	const freq = draft.freq;
	if (freq === undefined) {
		throw new GanttRecurrenceError("missing FREQ");
	}
	return { ...draft, freq };
}

function padRRuleField(value: number): string {
	return String(value).padStart(RRULE_FIELD_WIDTH, "0");
}

function formatWeekdayEntry(entry: GanttWeekday | GanttOrdinalWeekday): string {
	return isStringPrimitive(entry) ? entry : `${String(entry.ordinal)}${entry.day}`;
}

/** Serializes the structured subset back to an RRULE line (without prefix). */
export function formatRRuleString(rule: GanttRecurrenceRule): string {
	const parts: string[] = [`FREQ=${rule.freq.toUpperCase()}`];
	if (rule.interval !== undefined && rule.interval > MIN_RULE_NUMBER) {
		parts.push(`INTERVAL=${String(rule.interval)}`);
	}
	if (rule.count !== undefined) {
		parts.push(`COUNT=${String(rule.count)}`);
	}
	if (rule.until !== undefined) {
		const until = rule.until;
		const date = `${String(until.getUTCFullYear())}${padRRuleField(until.getUTCMonth() + MONTH_NUMBER_OFFSET)}${padRRuleField(until.getUTCDate())}`;
		const time = `${padRRuleField(until.getUTCHours())}${padRRuleField(until.getUTCMinutes())}${padRRuleField(until.getUTCSeconds())}`;
		parts.push(`UNTIL=${date}T${time}Z`);
	}
	if (rule.byWeekday !== undefined && rule.byWeekday.length > 0) {
		parts.push(`BYDAY=${rule.byWeekday.map(formatWeekdayEntry).join(",")}`);
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

/** The structured rule behind an event's `recurrence` (raw RRULE lines are parsed in the display zone). */
export function resolveRecurrenceRule(recurrence: GanttRecurrenceRule | string, timeZone?: string): GanttRecurrenceRule {
	return isStringPrimitive(recurrence) ? parseRRuleString(recurrence, timeZone) : recurrence;
}

/**
 * Visibility of one instance against a half-open range. A zero-length instance
 * (a milestone) compares its start CLOSED, so an instant sitting exactly on the
 * range start stays visible; an instant on the range end belongs to the next
 * period. `gantt-lib`'s `occurrenceIntersects` is this same rule.
 */
export function isInstanceVisible(startMs: number, endMs: number, range: GanttDateRange): boolean {
	if (endMs === startMs) {
		return startMs >= range.start.getTime() && startMs < range.end.getTime();
	}
	return startMs < range.end.getTime() && endMs > range.start.getTime();
}

function stepRule(freq: GanttRecurrenceFrequency, from: TZDate, steps: number): TZDate {
	switch (freq) {
		case "daily":
			return addDays(from, steps);
		case "weekly":
			return addWeeks(from, steps);
		case "monthly":
			return addMonths(from, steps);
		case "yearly":
			return addYears(from, steps);
		default:
			return assertNeverFrequency(freq);
	}
}

function assertNeverFrequency(value: never): never {
	throw new GanttRecurrenceError(`FREQ=${String(value)}`);
}

/** The longest wall-time span one step of `freq` can cover, so a jump of N steps never overshoots. */
function maxStepMs(freq: GanttRecurrenceFrequency, interval: number): number {
	const days = freq === "daily" ? 1 : freq === "weekly" ? DAYS_PER_WEEK : freq === "monthly" ? MAX_DAYS_PER_MONTH : MAX_DAYS_PER_YEAR;
	// one spare hour absorbs a DST transition inside the step
	return days * MS_PER_DAY * interval + MS_PER_HOUR;
}

function makeOccurrence<TData extends GanttData>(event: GanttEvent<TData>, start: Date, end: Date, allDay: boolean, recurrenceIndex: number): GanttOccurrence<TData> {
	return { key: `${event.id}::${start.toISOString()}`, eventId: event.id, event, start, end, allDay, isRecurring: true, recurrenceIndex };
}

/** The weekday numbers of a weekly BYDAY rule, or null for a rule that steps by its frequency alone. */
function resolveWeeklyDays(rule: GanttRecurrenceRule): number[] | null {
	if (rule.freq !== "weekly" || rule.byWeekday === undefined || rule.byWeekday.length === 0) {
		return null;
	}
	return rule.byWeekday.map((entry: GanttWeekday | GanttOrdinalWeekday): number => {
		if (!isStringPrimitive(entry)) {
			throw new GanttRecurrenceError("BYDAY ordinal outside monthly/yearly");
		}
		return WEEKDAYS.indexOf(entry);
	});
}

/** Loud contract: silently ignoring a filter would emit WRONG occurrences. */
function assertExpandableRule(rule: GanttRecurrenceRule): void {
	if (rule.byMonthDay !== undefined && rule.byMonthDay.length > 0) {
		throw new GanttRecurrenceError("BYMONTHDAY");
	}
	if (rule.byMonth !== undefined && rule.byMonth.length > 0) {
		throw new GanttRecurrenceError("BYMONTH");
	}
	if (rule.byWeekday !== undefined && rule.byWeekday.length > 0 && rule.freq !== "weekly") {
		throw new GanttRecurrenceError("BYDAY outside FREQ=WEEKLY");
	}
}

/**
 * Expands one event into its occurrences intersecting the range.
 * Non-recurring events yield at most one occurrence. Recurrence iteration is
 * wall-time based in the display zone (DST-safe day/week/month steps).
 *
 * Supported subset: FREQ daily/weekly/monthly/yearly, INTERVAL, COUNT, UNTIL,
 * weekly BYDAY (no ordinals). Parsed-but-unimplemented filters (BYMONTHDAY,
 * BYMONTH, BYDAY outside weekly) throw a GanttRecurrenceError instead of
 * silently mis-expanding; plug the getOccurrences prop for a full engine.
 * WKST parses and round-trips; week emission is Sunday-anchored.
 *
 * exDates remove exactly-matching instants (after COUNT numbering,
 * Google-style: an exception still consumes its COUNT slot); rDates add extra
 * instants with the same duration. RECURRENCE-ID override replacement lives
 * in buildEventIndex, where the override event and its parent series meet.
 */
export function expandRecurrence<TData extends GanttData>(event: GanttEvent<TData>, range: GanttDateRange, context: { readonly timeZone: string }): GanttOccurrence<TData>[] {
	const allDay = event.allDay ?? false;
	if (event.recurrence === undefined) {
		if (!isInstanceVisible(event.start.getTime(), event.end.getTime(), range)) {
			return [];
		}
		return [{ key: `${event.id}::${event.start.toISOString()}`, eventId: event.id, event, start: event.start, end: event.end, allDay, isRecurring: false }];
	}

	const rule = resolveRecurrenceRule(event.recurrence, context.timeZone);
	assertExpandableRule(rule);
	const interval = Math.max(MIN_RULE_NUMBER, rule.interval ?? MIN_RULE_NUMBER);
	const durationMs = event.end.getTime() - event.start.getTime();
	const zonedStart = new TZDate(event.start.getTime(), context.timeZone);
	// Excluded instants matched exactly; filtering happens at push time so an
	// exception still consumes its COUNT slot (Google-style numbering).
	const exTimes = new Set((rule.exDates ?? []).map((date: Date): number => date.getTime()));
	const weeklyDays = resolveWeeklyDays(rule);
	const untilMs = rule.until?.getTime();
	const isPastUntil = (ms: number): boolean => untilMs !== undefined && ms > untilMs;
	const advance = (from: TZDate, steps: number): TZDate => stepRule(rule.freq, from, steps * interval);
	const perStep = weeklyDays === null ? 1 : weeklyDays.length;

	let index = 0;
	let cursor = zonedStart;

	// Fast-forward past periods entirely before the range: they produce
	// nothing and must not consume the occurrence cap. COUNT rules jump too:
	// the skipped periods are credited to `index`, which is what terminates
	// the series. Daily and weekly ONLY — their step is a fixed wall-time
	// length; addMonths/addYears clamp (Jan 31 → Feb 28), so jumping those
	// would land a different day depending on the scroll window.
	const canFastForward = rule.freq === "daily" || rule.freq === "weekly";
	const weekSlackMs = weeklyDays === null ? 0 : WEEK_SLACK_DAYS * MS_PER_DAY;
	const jumpMs = maxStepMs(rule.freq, interval);
	for (let pass = 0; canFastForward && pass < FAST_FORWARD_PASSES; pass += 1) {
		const gap = range.start.getTime() - durationMs - weekSlackMs - cursor.getTime();
		const skip = Math.floor(gap / jumpMs);
		if (skip <= 0) {
			break;
		}
		cursor = advance(cursor, skip);
		index += skip * perStep;
	}
	for (let guard = 0; guard < MAX_CATCH_UP_STEPS && !isPastUntil(cursor.getTime()) && cursor.getTime() + durationMs + weekSlackMs < range.start.getTime(); guard += 1) {
		cursor = advance(cursor, 1);
		index += perStep;
	}
	// The jump credits a whole week of selected days per skipped week, but
	// full iteration never counts the selected days BEFORE the anchor inside
	// the anchor's own week. Drop them once so both paths number alike.
	if (weeklyDays !== null && index > 0) {
		index -= weeklyDays.filter((day: number): boolean => day < zonedStart.getDay()).length;
	}

	const occurrences: GanttOccurrence<TData>[] = [];
	const pushIfVisible = (rawStart: Date, recurrenceIndex: number): void => {
		// normalize to a plain instant so consumers never receive zone-carrying TZDate instances
		const start = new Date(rawStart.getTime());
		if (exTimes.has(start.getTime())) {
			return;
		}
		const end = new Date(start.getTime() + durationMs);
		if (isInstanceVisible(start.getTime(), end.getTime(), range)) {
			occurrences.push(makeOccurrence(event, start, end, allDay, recurrenceIndex));
		}
	};
	const countReached = (): boolean => rule.count !== undefined && index >= rule.count;

	let produced = 0;
	while (produced < MAX_OCCURRENCES) {
		if (isPastUntil(cursor.getTime()) || countReached()) {
			break;
		}
		// Past the visible window with no count to honor — stop. For weekly
		// BYDAY the WEEK START decides: earlier selected days can still fall before range.end.
		const horizonMs = weeklyDays === null ? cursor.getTime() : addDays(cursor, -cursor.getDay()).getTime();
		if (horizonMs >= range.end.getTime() && rule.count === undefined) {
			break;
		}
		if (weeklyDays === null) {
			pushIfVisible(cursor, index);
			produced += 1;
			index += 1;
		} else {
			for (let offset = 0; offset < DAYS_PER_WEEK; offset += 1) {
				const candidate = addDays(cursor, offset - cursor.getDay());
				if (!weeklyDays.includes(candidate.getDay()) || candidate.getTime() < zonedStart.getTime() || isPastUntil(candidate.getTime())) {
					continue;
				}
				// the cap is checked here too, or a week that crosses it still emits its remaining days
				if (produced >= MAX_OCCURRENCES || countReached()) {
					break;
				}
				pushIfVisible(candidate, index);
				produced += 1;
				index += 1;
			}
		}
		cursor = advance(cursor, 1);
	}

	return appendRDates(event, rule, occurrences, { range, durationMs, exTimes, allDay, nextIndex: index });
}

interface RDateContext {
	readonly range: GanttDateRange;
	readonly durationMs: number;
	readonly exTimes: ReadonlySet<number>;
	readonly allDay: boolean;
	readonly nextIndex: number;
}

/**
 * RDATE: extra instants join the set (deduped against generated starts and
 * exclusions) with the same wall-time duration, numbered past the generated
 * instants so no RDATE collides with the series' first occurrence. Sorted so
 * direct consumers still receive chronological order.
 */
function appendRDates<TData extends GanttData>(
	event: GanttEvent<TData>,
	rule: GanttRecurrenceRule,
	generated: readonly GanttOccurrence<TData>[],
	context: RDateContext,
): GanttOccurrence<TData>[] {
	const rDates = rule.rDates ?? [];
	if (rDates.length === 0) {
		return [...generated];
	}
	const seen = new Set(generated.map((occurrence: GanttOccurrence<TData>): number => occurrence.start.getTime()));
	const extra: GanttOccurrence<TData>[] = [];
	let index = context.nextIndex;
	for (const rDate of rDates) {
		const startMs = rDate.getTime();
		if (seen.has(startMs) || context.exTimes.has(startMs)) {
			continue;
		}
		const endMs = startMs + context.durationMs;
		if (!isInstanceVisible(startMs, endMs, context.range)) {
			continue;
		}
		seen.add(startMs);
		extra.push(makeOccurrence(event, new Date(startMs), new Date(endMs), context.allDay, index));
		index += 1;
	}
	return [...generated, ...extra].sort((left: GanttOccurrence<TData>, right: GanttOccurrence<TData>): number => left.start.getTime() - right.start.getTime());
}
