"use client";

import * as React from "react";

import { DataTable, type DataTableColumns, type DataTableLayout } from "@workspace/ui/components/data-table";
import { cn } from "@workspace/ui/lib/core/utils";

import { extentOf, heatClassFor, normalizeToScale } from "./data-table-recipe-helpers";

/** Orders taken in one hour of each weekday. */
interface HourRow {
	readonly hour: string;
	readonly days: readonly number[];
}

const DAYS: readonly string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FIRST_HOUR = 8;
const HOUR_COUNT = 10;
/** Sample figures: busiest around lunch, quieter at the weekend, so the heat has a shape to show. */
const LUNCH_HOUR = 12;
const PEAK_ORDERS = 60;
const DROP_PER_HOUR = 9;
const WEEKEND_FACTOR = 0.6;
const WEEKEND_START = 5;

export const HOURS: readonly HourRow[] = Array.from({ length: HOUR_COUNT }, (_hour, index) => {
	const hour = FIRST_HOUR + index;
	const base = Math.max(4, PEAK_ORDERS - Math.abs(hour - LUNCH_HOUR) * DROP_PER_HOUR);
	return {
		hour: `${String(hour).padStart(2, "0")}:00`,
		days: DAYS.map((_day, day) => Math.round(base * (day >= WEEKEND_START ? WEEKEND_FACTOR : 1) + ((day * 7 + index * 3) % 9))),
	};
});

function getHourId(row: HourRow): string {
	return row.hour;
}

/** One extent over the whole grid, so a colour means the same number in every column. */
const EXTENT = extentOf(HOURS.flatMap((row) => row.days));

function HeatCell({ value }: { readonly value: number }): React.JSX.Element {
	return (
		<span className={cn("-mx-3 -my-2 flex h-full items-center justify-center px-3 py-2 tabular-nums", heatClassFor(normalizeToScale(value, EXTENT.min, EXTENT.max)))}>
			{value}
		</span>
	);
}

const COLUMNS: DataTableColumns<HourRow> = [
	{ accessorKey: "hour", header: "Hour", size: 90 },
	...DAYS.map((day, index): DataTableColumns<HourRow>[number] => ({
		id: day,
		header: day,
		size: 72,
		accessorFn: (row: HourRow): number => row.days.at(index) ?? 0,
		cell: ({ getValue }): React.JSX.Element => <HeatCell value={Number(getValue())} />,
		meta: { cellClassName: "text-center", headerClassName: "text-center [&>div]:justify-center" },
	})),
];

/**
 * Recipe: a heatmap. The table draws plain cells; the recipe colours each one by where its number sits on one scale
 * for the whole grid (`normalizeToScale`), using token colours so it works in light and dark mode.
 */
export function DataTableRecipeHeatmap(): React.JSX.Element {
	return <DataTable data={HOURS} columns={COLUMNS} getRowId={getHourId} layout={LAYOUT} />;
}

const LAYOUT: DataTableLayout = { density: "compact", cellBorders: true };
