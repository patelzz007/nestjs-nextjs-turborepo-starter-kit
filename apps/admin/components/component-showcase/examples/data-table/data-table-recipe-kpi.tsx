"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type * as React from "react";

import { DataTable, type DataTableColumns } from "@workspace/ui/components/data-table";
import { cn } from "@workspace/ui/lib/core/utils";

import { percentChange, sparklinePoints, trendOf, type Trend } from "./data-table-recipe-helpers";

/** One metric, with its last eight weeks. */
interface Kpi {
	readonly id: string;
	readonly name: string;
	readonly weeks: readonly number[];
	/** `up` when a rise is good news (revenue), `down` when a fall is (churn). */
	readonly better: "up" | "down";
	readonly format: (value: number) => string;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");
const share = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export const KPIS: readonly Kpi[] = [
	{ id: "revenue", name: "Weekly revenue", weeks: [41200, 43800, 42100, 46500, 48900, 47300, 51200, 53400], better: "up", format: (value) => money.format(value) },
	{ id: "orders", name: "Orders", weeks: [812, 845, 830, 902, 918, 897, 951, 960], better: "up", format: (value) => count.format(value) },
	{ id: "churn", name: "Churn", weeks: [0.031, 0.029, 0.033, 0.028, 0.027, 0.03, 0.026, 0.024], better: "down", format: (value) => share.format(value) },
	{ id: "tickets", name: "Support tickets", weeks: [140, 152, 147, 161, 170, 188, 176, 194], better: "down", format: (value) => count.format(value) },
];

const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 24;

/** The last two weeks of a metric: what it is now, and what it was. */
export function lastTwo(kpi: Kpi): { readonly previous: number; readonly current: number } {
	const [previous = 0, current = 0] = kpi.weeks.slice(-2);
	return { previous, current };
}

/** Whether the latest move is good, bad or neither, for a metric that is better going `better`. */
export function moveTone(kpi: Kpi): "good" | "bad" | "neutral" {
	const { previous, current } = lastTwo(kpi);
	const trend = trendOf(previous, current);
	if (trend === "flat") {
		return "neutral";
	}
	return trend === kpi.better ? "good" : "bad";
}

const TONE_CLASS: Readonly<Record<"good" | "bad" | "neutral", string>> = { good: "text-success-foreground", bad: "text-destructive", neutral: "text-muted-foreground" };
const TREND_ICON: Readonly<Record<Trend, typeof ArrowUpRight>> = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight };

function Sparkline({ kpi }: { readonly kpi: Kpi }): React.JSX.Element {
	return (
		<svg
			width={SPARK_WIDTH}
			height={SPARK_HEIGHT}
			viewBox={`0 0 ${String(SPARK_WIDTH)} ${String(SPARK_HEIGHT)}`}
			className={cn("overflow-visible", TONE_CLASS[moveTone(kpi)])}
			aria-hidden="true">
			<polyline
				points={sparklinePoints(kpi.weeks, SPARK_WIDTH, SPARK_HEIGHT)}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function getKpiId(kpi: Kpi): string {
	return kpi.id;
}

const signedPercent = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero", maximumFractionDigits: 1 });

const COLUMNS: DataTableColumns<Kpi> = [
	{ accessorKey: "name", header: "Metric", size: 180 },
	{
		id: "current",
		header: "This week",
		size: 130,
		enableSorting: false,
		cell: ({ row }): string => row.original.format(lastTwo(row.original).current),
		meta: { cellClassName: "text-end font-medium tabular-nums", headerClassName: "text-end" },
	},
	{
		id: "change",
		header: "Change",
		size: 110,
		enableSorting: false,
		cell: ({ row }): React.JSX.Element => {
			const { previous, current } = lastTwo(row.original);
			const change = percentChange(previous, current);
			const Icon = TREND_ICON[trendOf(previous, current)];
			return (
				<span className={cn("inline-flex items-center gap-1 tabular-nums", TONE_CLASS[moveTone(row.original)])}>
					<Icon className="size-4" aria-hidden="true" />
					{change === null ? "–" : `${signedPercent.format(change)}%`}
				</span>
			);
		},
	},
	{ id: "trend", header: "Last 8 weeks", size: 130, enableSorting: false, cell: ({ row }): React.JSX.Element => <Sparkline kpi={row.original} /> },
];

/**
 * Recipe: KPIs with sparklines. Each metric shows this week, the change since last week coloured by whether that is
 * good news for that metric (a rise in tickets is bad), and an eight-week sparkline drawn as plain SVG in the cell.
 */
export function DataTableRecipeKpi(): React.JSX.Element {
	return <DataTable data={KPIS} columns={COLUMNS} getRowId={getKpiId} />;
}
