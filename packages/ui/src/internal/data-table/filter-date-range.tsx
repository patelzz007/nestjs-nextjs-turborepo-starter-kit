"use client";

// A toolbar filter that picks a RANGE OF DAYS from a calendar. Controlled: the table holds the value, as two
// `yyyy-MM-dd` days (either may be open). Which instants a day covers is decided in ui-kit-logic.

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatDateInputString, parseDateInputString } from "@workspace/ui/lib/form/date-input";
import {
	DataTableDateRangeSchema,
	DataTableDateValueSchema,
	isWithinDataTableDateRange,
	type DataTableDateRange,
	type DataTableDateZone,
	type DataTableLabels,
} from "@workspace/ui-kit-logic";
import type { CellData, Row, RowData } from "@tanstack/react-table";
import { format } from "date-fns";
import { CalendarRangeIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import type { TableEngineFeatures } from "../table-engine/table-engine";
import type { DataTableDateRangeFilter, DataTableFilterChangeHandler } from "./props";

/** date-fns pattern for a day on the trigger, e.g. "Nov 19, 2026". */
const DAY_DISPLAY_FORMAT = "PP";
/** Shown in place of an end that is open. */
const OPEN_END = "…";
/** Two months side by side, so a range across a month boundary is picked without paging. */
const MONTHS_SHOWN = 2;

function passesDateRange<TData extends RowData>(row: Row<TableEngineFeatures, TData>, columnId: string, filterValue: CellData, zone: DataTableDateZone): boolean {
	const range = DataTableDateRangeSchema.safeParse(filterValue);
	if (!range.success) {
		return true;
	}
	const cell = DataTableDateValueSchema.safeParse(row.getValue(columnId));
	return isWithinDataTableDateRange(cell.success ? cell.data : null, range.data, zone);
}

/** The client-side `filterFn` of a column behind a `date-range` filter that reads the reader's own calendar. */
export function localDateRangeFilterFn<TData extends RowData>(row: Row<TableEngineFeatures, TData>, columnId: string, filterValue: CellData): boolean {
	return passesDateRange(row, columnId, filterValue, "local");
}

/** The same for a column of calendar days stored as their UTC midnight. */
export function utcDateRangeFilterFn<TData extends RowData>(row: Row<TableEngineFeatures, TData>, columnId: string, filterValue: CellData): boolean {
	return passesDateRange(row, columnId, filterValue, "utc");
}

function displayDay(day: string | null): string {
	const date = day === null ? undefined : parseDateInputString(day);
	return date === undefined ? OPEN_END : format(date, DAY_DISPLAY_FORMAT);
}

/** The range as text for the trigger, e.g. "Nov 1, 2026 – Nov 19, 2026"; an open end reads "…". */
export function formatDateRangeSummary(range: DataTableDateRange): string {
	return `${displayDay(range.from)} – ${displayDay(range.to)}`;
}

/** The calendar's selection for a stored range. */
function toCalendarRange(range: DataTableDateRange | null): DateRange | undefined {
	if (range === null) {
		return undefined;
	}
	const from = range.from === null ? undefined : parseDateInputString(range.from);
	const to = range.to === null ? undefined : parseDateInputString(range.to);
	return from === undefined && to === undefined ? undefined : { from, to };
}

export interface FilterDateRangeProps {
	readonly filter: DataTableDateRangeFilter;
	/** The chosen range, or `null` for no filter. */
	readonly value: DataTableDateRange | null;
	readonly labels: DataTableLabels;
	readonly onFilterChange: DataTableFilterChangeHandler;
	/** Fill the cell the toolbar gives it (the `fill` layout). */
	readonly fillWidth?: boolean;
}

export const FilterDateRange = React.memo(function FilterDateRange({ filter, value, labels, onFilterChange, fillWidth = false }: FilterDateRangeProps): React.JSX.Element {
	const selected = React.useMemo((): DateRange | undefined => toCalendarRange(value), [value]);

	const handleSelect = React.useCallback(
		(range: DateRange | undefined): void => {
			const from = range?.from === undefined ? null : formatDateInputString(range.from);
			const to = range?.to === undefined ? null : formatDateInputString(range.to);
			onFilterChange(filter.column, from === null && to === null ? null : { from, to });
		},
		[filter.column, onFilterChange],
	);
	const handleClear = React.useCallback((): void => {
		onFilterChange(filter.column, null);
	}, [filter.column, onFilterChange]);

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button variant="outline" size="sm" className={cn("h-9 justify-start", fillWidth ? "w-full sm:min-w-0" : undefined)}>
						<CalendarRangeIcon aria-hidden="true" className="size-4" />
						{filter.label}
						{value === null ? null : (
							<>
								<Separator orientation="vertical" className="mx-2 h-4" />
								<span className="font-normal tabular-nums">{formatDateRangeSummary(value)}</span>
							</>
						)}
					</Button>
				}
			/>
			<PopoverContent className="w-auto gap-0 p-0" align="start" aria-label={filter.label}>
				{selected === undefined ? (
					<Calendar mode="range" numberOfMonths={MONTHS_SHOWN} onSelect={handleSelect} />
				) : (
					<Calendar mode="range" numberOfMonths={MONTHS_SHOWN} selected={selected} defaultMonth={selected.from ?? selected.to ?? new Date()} onSelect={handleSelect} />
				)}
				{value === null ? null : (
					<>
						<Separator />
						<div className="p-1">
							<Button variant="ghost" size="sm" className="w-full" onClick={handleClear}>
								{labels.clearDateRange}
							</Button>
						</div>
					</>
				)}
			</PopoverContent>
		</Popover>
	);
});
