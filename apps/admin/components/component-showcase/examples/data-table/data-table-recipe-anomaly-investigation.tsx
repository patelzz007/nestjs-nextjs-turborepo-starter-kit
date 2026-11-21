"use client";

import * as React from "react";
import { z } from "zod";

import { Badge } from "@workspace/ui/components/badge";
import { DataTable, type DataTableColumns, type DataTableHeading } from "@workspace/ui/components/data-table";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/core/utils";

import { normalizeToScale } from "./data-table-recipe-helpers";

/** One series: its expected band (from history) and what was observed. */
interface Observation {
	readonly id: string;
	readonly series: string;
	readonly expectedLow: number;
	readonly expectedHigh: number;
	readonly observed: number;
}

// Two data sets for one recipe: the plan's "finance variant" is the same table over different rows, not a copy.
export const OPERATIONS: readonly Observation[] = [
	{ id: "op-1", series: "API latency p95 (ms)", expectedLow: 180, expectedHigh: 260, observed: 410 },
	{ id: "op-2", series: "Checkout errors / hour", expectedLow: 2, expectedHigh: 9, observed: 7 },
	{ id: "op-3", series: "Queue depth", expectedLow: 40, expectedHigh: 120, observed: 18 },
	{ id: "op-4", series: "Sign-ups / hour", expectedLow: 30, expectedHigh: 55, observed: 49 },
];

export const FINANCE: readonly Observation[] = [
	{ id: "fi-1", series: "Refunds (USD)", expectedLow: 1200, expectedHigh: 2600, observed: 5100 },
	{ id: "fi-2", series: "Card declines (%)", expectedLow: 1.5, expectedHigh: 3.2, observed: 2.4 },
	{ id: "fi-3", series: "Payouts (USD)", expectedLow: 40000, expectedHigh: 52000, observed: 51200 },
	{ id: "fi-4", series: "Chargebacks", expectedLow: 3, expectedHigh: 11, observed: 0 },
];

export type AnomalyLevel = "above" | "below" | "normal";

/** Where an observation sits against its expected band. */
export function anomalyOf(observation: Observation): AnomalyLevel {
	if (observation.observed > observation.expectedHigh) {
		return "above";
	}
	return observation.observed < observation.expectedLow ? "below" : "normal";
}

/** How far outside the band the observation is, as a multiple of the band's width (0 inside it). */
export function deviationOf(observation: Observation): number {
	const width = Math.max(observation.expectedHigh - observation.expectedLow, Number.EPSILON);
	if (observation.observed > observation.expectedHigh) {
		return (observation.observed - observation.expectedHigh) / width;
	}
	return observation.observed < observation.expectedLow ? (observation.expectedLow - observation.observed) / width : 0;
}

/** The scale a range bar is drawn on: the band with half its width of margin either side, stretched to fit the observation. */
function scaleOf(observation: Observation): { readonly min: number; readonly max: number } {
	const margin = (observation.expectedHigh - observation.expectedLow) / 2;
	return {
		min: Math.min(observation.expectedLow - margin, observation.observed),
		max: Math.max(observation.expectedHigh + margin, observation.observed),
	};
}

const PERCENT = 100;

function RangeBar({ observation }: { readonly observation: Observation }): React.JSX.Element {
	const { min, max } = scaleOf(observation);
	const low = normalizeToScale(observation.expectedLow, min, max) * PERCENT;
	const high = normalizeToScale(observation.expectedHigh, min, max) * PERCENT;
	const mark = normalizeToScale(observation.observed, min, max) * PERCENT;
	const level = anomalyOf(observation);
	return (
		<div className="relative h-4 w-full" aria-hidden="true">
			<div className="absolute inset-x-0 top-1/2 h-px bg-border" />
			<div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm bg-primary/20" style={{ left: `${String(low)}%`, width: `${String(high - low)}%` }} />
			<div
				className={cn(
					"absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
					level === "normal" ? "bg-primary" : "bg-destructive",
				)}
				style={{ left: `${String(mark)}%` }}
			/>
		</div>
	);
}

const LEVEL_BADGE: Readonly<Record<AnomalyLevel, { readonly label: string; readonly variant: "destructive-light" | "warning-light" | "success-light" }>> = {
	above: { label: "Above range", variant: "destructive-light" },
	below: { label: "Below range", variant: "warning-light" },
	normal: { label: "Normal", variant: "success-light" },
};

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function getObservationId(observation: Observation): string {
	return observation.id;
}

const COLUMNS: DataTableColumns<Observation> = [
	{ accessorKey: "series", header: "Series", size: 200 },
	{
		id: "range",
		header: "Expected range and observed",
		size: 240,
		enableSorting: false,
		cell: ({ row }): React.JSX.Element => <RangeBar observation={row.original} />,
	},
	{
		accessorKey: "observed",
		header: "Observed",
		size: 110,
		cell: ({ row }): string => number.format(row.original.observed),
		meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" },
	},
	{
		id: "deviation",
		header: "Status",
		size: 140,
		// Sorting by status puts the furthest outside its band first when descending.
		accessorFn: deviationOf,
		cell: ({ row }): React.JSX.Element => {
			const badge = LEVEL_BADGE[anomalyOf(row.original)];
			return <Badge variant={badge.variant}>{badge.label}</Badge>;
		},
	},
];

const dataSetSchema = z.enum(["operations", "finance"]);
type DataSet = z.output<typeof dataSetSchema>;
const DATA_SETS: Readonly<Record<DataSet, { readonly label: string; readonly rows: readonly Observation[] }>> = {
	operations: { label: "Operations", rows: OPERATIONS },
	finance: { label: "Finance", rows: FINANCE },
};

/**
 * Recipe: anomaly investigation. Each series shows its expected band from history as a shaded bar and today's value
 * as a dot (red outside the band). Sort Status descending to see the furthest outliers first. The finance variant is
 * the same recipe over another data set, picked in the heading.
 */
export function DataTableRecipeAnomalyInvestigation(): React.JSX.Element {
	const [dataSet, setDataSet] = React.useState<DataSet>("operations");
	const handleDataSetChange = React.useCallback((values: string[]): void => {
		const next = dataSetSchema.safeParse(values.at(0));
		if (next.success) {
			setDataSet(next.data);
		}
	}, []);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Today against the usual range",
			actions: (
				<ToggleGroup variant="outline" size="sm" value={[dataSet]} onValueChange={handleDataSetChange} aria-label="Data set">
					{dataSetSchema.options.map((option) => (
						<ToggleGroupItem key={option} value={option}>
							{DATA_SETS[option].label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			),
		}),
		[dataSet, handleDataSetChange],
	);

	return <DataTable data={DATA_SETS[dataSet].rows} columns={COLUMNS} getRowId={getObservationId} heading={heading} />;
}
