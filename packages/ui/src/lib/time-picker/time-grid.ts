import {
	HOURS_PER_DAY,
	MINUTES_PER_HOUR,
	periodOf,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
	sameTime,
	toSeconds,
	formatTimeValue,
	parseTimeValue,
	type TimePickerGranularity,
	type TimePickerPeriod,
	type TimePickerTime,
	type TimePickerUnit,
} from "@workspace/ui/lib/time-picker/time-values";

/** Marks single times unavailable; receives the time in the value format and as fields. */
export type TimePickerTimeDisabled = (value: string, time: TimePickerTime) => boolean;

/**
 * The selectable times: step-aligned values, a window and a predicate. Times
 * are walked by index, second fastest, so every search is bounded by the grid.
 */
export interface TimeGrid {
	readonly hours: readonly number[];
	readonly minutes: readonly number[];
	readonly seconds: readonly number[];
	/** Earliest selectable second of the day, inclusive. */
	readonly min: number | null;
	/** Latest selectable second of the day, inclusive. */
	readonly max: number | null;
	readonly granularity: TimePickerGranularity;
	readonly isTimeDisabled?: TimePickerTimeDisabled | undefined;
}

/** Restricts a search to times with these fields. */
export interface TimeFilter {
	readonly hour?: number | undefined;
	readonly minute?: number | undefined;
	readonly second?: number | undefined;
	readonly period?: TimePickerPeriod | undefined;
}

export type TimeStepDirection = 1 | -1;

export interface TimeGridOptions {
	readonly hourStep?: number | undefined;
	readonly minuteStep?: number | undefined;
	readonly secondStep?: number | undefined;
	readonly min?: string | undefined;
	readonly max?: string | undefined;
	readonly granularity: TimePickerGranularity;
	readonly isTimeDisabled?: TimePickerTimeDisabled | undefined;
}

/** The last second of an hour, relative to its start. */
const LAST_SECOND_OF_HOUR = SECONDS_PER_HOUR - 1;

/** Step-aligned values from 0 below `limit`. A missing or non-finite step is 1. */
export function stepValues(step: number | undefined, limit: number): number[] {
	const size = Math.floor(step ?? 1);
	if (!Number.isFinite(size)) {
		return [0];
	}
	const increment = Math.max(1, size);
	const values: number[] = [];
	for (let value = 0; value < limit; value += increment) {
		values.push(value);
	}
	return values;
}

/** Seconds since midnight of a value-format string, or `null`. */
export function parseSecondsOfDay(value: string | undefined): number | null {
	const time = parseTimeValue(value);
	return time === null ? null : toSeconds(time);
}

export function gridSize(grid: TimeGrid): number {
	return grid.hours.length * grid.minutes.length * grid.seconds.length;
}

export function timeAt(grid: TimeGrid, index: number): TimePickerTime {
	const secondCount = grid.seconds.length;
	const minuteCount = grid.minutes.length;
	return {
		hour: grid.hours[Math.floor(index / (minuteCount * secondCount))] ?? 0,
		minute: grid.minutes[Math.floor(index / secondCount) % minuteCount] ?? 0,
		second: grid.seconds[index % secondCount] ?? 0,
	};
}

function lastAtOrBelow(values: readonly number[], limit: number): number {
	let found = 0;
	values.forEach((value: number, index: number): void => {
		if (value <= limit) {
			found = index;
		}
	});
	return found;
}

/** The index of the latest grid time at or before `seconds`. Always exists: 00:00:00 is on the grid. */
export function floorIndex(grid: TimeGrid, seconds: number): number {
	const hour = lastAtOrBelow(grid.hours, seconds / SECONDS_PER_HOUR);
	const inHour = seconds - (grid.hours[hour] ?? 0) * SECONDS_PER_HOUR;
	const minute = lastAtOrBelow(grid.minutes, inHour / SECONDS_PER_MINUTE);
	const second = lastAtOrBelow(grid.seconds, inHour - (grid.minutes[minute] ?? 0) * SECONDS_PER_MINUTE);
	return (hour * grid.minutes.length + minute) * grid.seconds.length + second;
}

/** Whether the span of seconds `from`…`to` touches the window. `min` after `max` is an overnight window, 22:00 to 02:00. */
export function spanInWindow(grid: TimeGrid, from: number, to: number): boolean {
	const { min, max } = grid;
	if (min !== null && max !== null && min > max) {
		return to >= min || from <= max;
	}
	return (min === null || to >= min) && (max === null || from <= max);
}

export function isTimeEnabled(grid: TimeGrid, time: TimePickerTime): boolean {
	const seconds = toSeconds(time);
	return spanInWindow(grid, seconds, seconds) && grid.isTimeDisabled?.(formatTimeValue(time, grid.granularity), time) !== true;
}

function matchesFilter(time: TimePickerTime, filter: TimeFilter): boolean {
	return (
		(filter.hour === undefined || time.hour === filter.hour) &&
		(filter.minute === undefined || time.minute === filter.minute) &&
		(filter.second === undefined || time.second === filter.second) &&
		(filter.period === undefined || periodOf(time.hour) === filter.period)
	);
}

function hourMatches(grid: TimeGrid, hour: number, filter: TimeFilter): boolean {
	if (filter.hour !== undefined && hour !== filter.hour) {
		return false;
	}
	if (filter.period !== undefined && periodOf(hour) !== filter.period) {
		return false;
	}
	const start = hour * SECONDS_PER_HOUR;
	return spanInWindow(grid, start, start + LAST_SECOND_OF_HOUR);
}

/** Whether any enabled time matches `filter`. Hours outside the window cost O(1). */
export function hasEnabled(grid: TimeGrid, filter: TimeFilter): boolean {
	return grid.hours.some(
		(hour: number): boolean =>
			hourMatches(grid, hour, filter) &&
			grid.minutes.some(
				(minute: number): boolean =>
					(filter.minute === undefined || minute === filter.minute) &&
					grid.seconds.some((second: number): boolean => (filter.second === undefined || second === filter.second) && isTimeEnabled(grid, { hour, minute, second })),
			),
	);
}

/**
 * The enabled time closest to `target` among those matching `filter`,
 * walking outwards from it. A tie goes to the earlier time.
 */
export function nearestEnabled(grid: TimeGrid, target: TimePickerTime, filter: TimeFilter = {}): TimePickerTime | null {
	const goal = toSeconds(target);
	const total = gridSize(grid);
	let back = floorIndex(grid, goal);
	let ahead = back + 1;
	while (back >= 0 || ahead < total) {
		const behind = back >= 0 ? timeAt(grid, back) : null;
		const next = ahead < total ? timeAt(grid, ahead) : null;
		const useBack = behind !== null && (next === null || goal - toSeconds(behind) <= toSeconds(next) - goal);
		const time = useBack ? behind : next;
		if (time === null) {
			return null;
		}
		if (matchesFilter(time, filter) && isTimeEnabled(grid, time)) {
			return time;
		}
		if (useBack) {
			back -= 1;
		} else {
			ahead += 1;
		}
	}
	return null;
}

/** The first enabled time from index `start` in `direction`, optionally wrapping round the day. */
export function walkEnabled(grid: TimeGrid, start: number, direction: TimeStepDirection, wrap: boolean): TimePickerTime | null {
	const total = gridSize(grid);
	let index = start;
	for (let step = 0; step < total; step += 1) {
		if (index < 0 || index >= total) {
			if (!wrap) {
				return null;
			}
			index = (index + total) % total;
		}
		const time = timeAt(grid, index);
		if (isTimeEnabled(grid, time)) {
			return time;
		}
		index += direction;
	}
	return null;
}

/** The next enabled time after `from`, or before it with -1, wrapping at midnight. */
export function stepEnabled(grid: TimeGrid, from: TimePickerTime, direction: TimeStepDirection): TimePickerTime | null {
	const index = floorIndex(grid, toSeconds(from));
	const onGrid = sameTime(timeAt(grid, index), from);
	let start = index;
	if (direction === 1) {
		start = index + 1;
	} else if (onGrid) {
		start = index - 1;
	}
	return walkEnabled(grid, start, direction, true);
}

/** The latest enabled time of the day, wrapping back from 23:59:59. */
export function lastEnabledTime(grid: TimeGrid): TimePickerTime | null {
	return walkEnabled(grid, gridSize(grid) - 1, -1, true);
}

/** The earliest enabled time, counted from `min` so a night shift starts at 22:00. */
export function firstEnabledTime(grid: TimeGrid): TimePickerTime | null {
	if (grid.min === null) {
		return walkEnabled(grid, 0, 1, true);
	}
	const index = floorIndex(grid, grid.min);
	const start = toSeconds(timeAt(grid, index)) < grid.min ? index + 1 : index;
	return walkEnabled(grid, start, 1, true);
}

/** `time` with one unit replaced. */
export function withUnit(time: TimePickerTime, unit: TimePickerUnit, value: number): TimePickerTime {
	switch (unit) {
		case "hour":
			return { ...time, hour: value };
		case "minute":
			return { ...time, minute: value };
		case "second":
			return { ...time, second: value };
	}
}

/** A filter on one unit. */
export function unitFilter(unit: TimePickerUnit, value: number): TimeFilter {
	switch (unit) {
		case "hour":
			return { hour: value };
		case "minute":
			return { minute: value };
		case "second":
			return { second: value };
	}
}

/** Builds the grid from the picker's steps, bounds and granularity. */
export function buildTimeGrid(options: TimeGridOptions): TimeGrid {
	const { granularity } = options;
	return {
		hours: stepValues(options.hourStep, HOURS_PER_DAY),
		minutes: granularity === "hour" ? [0] : stepValues(options.minuteStep, MINUTES_PER_HOUR),
		seconds: granularity === "second" ? stepValues(options.secondStep, SECONDS_PER_MINUTE) : [0],
		min: parseSecondsOfDay(options.min),
		max: parseSecondsOfDay(options.max),
		granularity,
		isTimeDisabled: options.isTimeDisabled,
	};
}
