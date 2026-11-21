// The rules of DataTable's `date-range` filter, shared by the web and native kits: which instants a range of calendar
// days covers. Pure: no React, no DOM.

import { isArrayValue, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import { z } from "zod";

import type { DataTableDateRange, DataTableFilterValue } from "./query";

/** What a date column's cells may hold: epoch milliseconds, a `Date`, or text `Date.parse` reads (an ISO string). */
export const DataTableDateValueSchema = z.union([z.number(), z.date(), z.string().min(1)]);

export type DataTableDateValue = z.output<typeof DataTableDateValueSchema>;

/**
 * Whose calendar decides which day an instant falls on. `local`: the reader's time zone, for timestamps ("created at
 * 23:30 on the 19th" is the 19th where the reader sits). `utc`: for a calendar day stored as its UTC midnight, which
 * must read as the same day everywhere.
 */
export const DataTableDateZoneSchema = z.enum(["local", "utc"]);

export type DataTableDateZone = z.output<typeof DataTableDateZoneSchema>;

/** A range as it arrives from table state or a URL. */
export const DataTableDateRangeSchema = z.object({ from: z.string().nullable(), to: z.string().nullable() });

const DAY_PATTERN = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;
const MONTHS_ARE_ZERO_BASED = 1;
const NEXT_DAY = 1;

/** A filter value that is a date range (not a chosen option or a list of them). */
export function isDataTableDateRange(value: DataTableFilterValue | null | undefined): value is DataTableDateRange {
	return value !== null && value !== undefined && !isStringPrimitive(value) && !isArrayValue(value);
}

/** A cell's date as epoch milliseconds, or `null` for text that is not a date. */
export function dataTableDateValueToEpochMs(value: DataTableDateValue): number | null {
	if (isNumberPrimitive(value)) {
		return value;
	}
	const epochMs = isStringPrimitive(value) ? Date.parse(value) : value.getTime();
	return Number.isNaN(epochMs) ? null : epochMs;
}

/** The first instant of a calendar day (`2026-11-19`) and the first instant of the day after it. */
export interface DataTableDayBounds {
	readonly startMs: number;
	/** Exclusive: the next day's first instant. */
	readonly endMs: number;
}

/** A day's bounds in the given zone, or `null` for text that is not a `yyyy-MM-dd` day. */
export function dataTableDayBounds(day: string, zone: DataTableDateZone): DataTableDayBounds | null {
	const groups = DAY_PATTERN.exec(day)?.groups;
	if (groups === undefined) {
		return null;
	}
	const year = Number(groups.year);
	const monthIndex = Number(groups.month) - MONTHS_ARE_ZERO_BASED;
	const dayOfMonth = Number(groups.day);
	const startMs = zone === "utc" ? Date.UTC(year, monthIndex, dayOfMonth) : new Date(year, monthIndex, dayOfMonth).getTime();
	const endMs = zone === "utc" ? Date.UTC(year, monthIndex, dayOfMonth + NEXT_DAY) : new Date(year, monthIndex, dayOfMonth + NEXT_DAY).getTime();
	return Number.isNaN(startMs) || Number.isNaN(endMs) ? null : { startMs, endMs };
}

/**
 * Whether a cell's date falls in the range. Both ends are inclusive days; an end that is `null` is open. A cell with
 * no date passes only a range that is open at both ends, and a bound that is not a day is treated as open.
 */
export function isWithinDataTableDateRange(value: DataTableDateValue | null, range: DataTableDateRange, zone: DataTableDateZone = "local"): boolean {
	const from = range.from === null ? null : dataTableDayBounds(range.from, zone);
	const to = range.to === null ? null : dataTableDayBounds(range.to, zone);
	if (from === null && to === null) {
		return true;
	}
	const epochMs = value === null ? null : dataTableDateValueToEpochMs(value);
	if (epochMs === null) {
		return false;
	}
	return (from === null || epochMs >= from.startMs) && (to === null || epochMs < to.endMs);
}
