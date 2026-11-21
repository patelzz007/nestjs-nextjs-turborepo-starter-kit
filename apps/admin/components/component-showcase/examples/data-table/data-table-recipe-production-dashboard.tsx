"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { DataTable, type DataTableColumns } from "@workspace/ui/components/data-table";
import { Progress, ProgressIndicator, ProgressTrack } from "@workspace/ui/components/progress";

import { percentChange, trendOf, type Trend } from "./data-table-recipe-helpers";

/** One production line's shift. */
interface LineShift {
	readonly line: string;
	readonly product: string;
	readonly target: number;
	readonly produced: number;
	readonly producedLastShift: number;
	/** Share of units that passed inspection, 0..1. */
	readonly yield: number;
}

export const LINE_SHIFTS: readonly LineShift[] = [
	{ line: "Line 1", product: "Bottling", target: 1200, produced: 1134, producedLastShift: 1050, yield: 0.992 },
	{ line: "Line 2", product: "Labelling", target: 1200, produced: 820, producedLastShift: 990, yield: 0.951 },
	{ line: "Line 3", product: "Capping", target: 900, produced: 905, producedLastShift: 902, yield: 0.987 },
	{ line: "Line 4", product: "Packing", target: 600, produced: 310, producedLastShift: 420, yield: 0.918 },
];

/** A share of target below this needs attention; at or above it the line is on track. */
const ON_TRACK_SHARE = 0.9;
/** A yield below this is flagged. */
const YIELD_FLOOR = 0.95;
/** The progress bar runs from 0 to this. */
const PROGRESS_MAX = 100;
/** Shift-on-shift moves smaller than this many units count as flat. */
const FLAT_TOLERANCE_UNITS = 10;

/** How far a line is towards its target, as 0..1 (capped at 1: overproduction still reads as done). */
export function progressShare(shift: LineShift): number {
	return shift.target === 0 ? 0 : Math.min(1, shift.produced / shift.target);
}

const TREND_ICON: Readonly<Record<Trend, React.JSX.Element>> = {
	up: <ArrowUpRight className="size-4 text-success-foreground" aria-hidden="true" />,
	down: <ArrowDownRight className="size-4 text-destructive" aria-hidden="true" />,
	flat: <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />,
};

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const signedPercent = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero", maximumFractionDigits: 0 });

function getLine(shift: LineShift): string {
	return shift.line;
}

const COLUMNS: DataTableColumns<LineShift> = [
	{ accessorKey: "line", header: "Line", size: 90 },
	{ accessorKey: "product", header: "Product", size: 120 },
	{
		id: "progress",
		header: "Against target",
		size: 220,
		accessorFn: progressShare,
		cell: ({ row }): React.JSX.Element => {
			const share = progressShare(row.original);
			return (
				<div className="flex items-center gap-2">
					<Progress value={Math.round(share * PROGRESS_MAX)} className="flex-1" aria-label={`${row.original.line} against target`}>
						<ProgressTrack>
							<ProgressIndicator className={share < ON_TRACK_SHARE ? "bg-warning" : undefined} />
						</ProgressTrack>
					</Progress>
					<span className="w-24 text-end text-xs text-muted-foreground tabular-nums">
						{row.original.produced} / {row.original.target}
					</span>
				</div>
			);
		},
	},
	{
		id: "trend",
		header: "vs last shift",
		size: 130,
		accessorFn: (shift: LineShift): number => percentChange(shift.producedLastShift, shift.produced) ?? 0,
		cell: ({ row }): React.JSX.Element => {
			const { producedLastShift, produced } = row.original;
			const change = percentChange(producedLastShift, produced);
			return (
				<span className="inline-flex items-center gap-1 tabular-nums">
					{TREND_ICON[trendOf(producedLastShift, produced, FLAT_TOLERANCE_UNITS)]}
					{change === null ? "–" : `${signedPercent.format(change)}%`}
				</span>
			);
		},
	},
	{
		accessorKey: "yield",
		header: "Yield",
		size: 110,
		cell: ({ row }): React.JSX.Element => (
			<Badge variant={row.original.yield < YIELD_FLOOR ? "destructive-light" : "success-light"} className="tabular-nums">
				{percent.format(row.original.yield)}
			</Badge>
		),
	},
];

/**
 * Recipe: a production dashboard. A progress bar against each line's target (amber below 90%), the change since
 * last shift with its direction, and yield flagged under 95%. Every rule lives in the recipe; the table draws cells.
 */
export function DataTableRecipeProductionDashboard(): React.JSX.Element {
	return <DataTable data={LINE_SHIFTS} columns={COLUMNS} getRowId={getLine} />;
}
