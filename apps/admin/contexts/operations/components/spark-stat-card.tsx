"use client";

// One figure as a card: its name, the number now, how it moved over the range (with the words, not
// colour alone), and its history as a sparkline running off the card's bottom edge.

import { Card } from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/core/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import * as React from "react";

import { AreaTrendChart, type AreaTrendSeries } from "./area-trend-chart";

/** How the figure moved over the range, and whether that is good news. */
export interface SparkStatChange {
	/** Signed change in the figure's own unit (percentage points for a share). */
	readonly delta: number;
	/** The change in words ("4 pts higher than 1 hour ago"). */
	readonly label: string;
	/** A rise is bad for usage (CPU, memory, disk): it colours the arrow. */
	readonly higherIsWorse: boolean;
}

export interface SparkStatCardProps {
	readonly title: string;
	readonly value: string;
	/** Under the number: what it is made of ("41.3 GB of 64.0 GB"). */
	readonly detail: string;
	readonly change: SparkStatChange | null;
	readonly points: readonly { readonly at: number; readonly value: number }[];
	readonly format: (value: number) => string;
	/** The series colour token. */
	readonly color?: string;
	readonly domain?: [number, number];
}

const SPARK_SERIES: readonly AreaTrendSeries<"value">[] = [{ key: "value", label: "Value", color: "var(--muted-foreground)" }];

function changeTone(change: SparkStatChange): string {
	if (change.delta === 0) {
		return "text-muted-foreground";
	}
	const worse = change.delta > 0 === change.higherIsWorse;
	return worse ? "text-destructive" : "text-success";
}

function ChangeLine({ change }: { readonly change: SparkStatChange }): React.JSX.Element {
	const Icon = change.delta > 0 ? TrendingUp : change.delta < 0 ? TrendingDown : Minus;
	return (
		<p className="flex items-center gap-1.5 text-sm">
			<Icon aria-hidden className={cn("size-4", changeTone(change))} />
			<span className="text-muted-foreground">{change.label}</span>
		</p>
	);
}

export function SparkStatCard({ title, value, detail, change, points, format, color, domain }: SparkStatCardProps): React.JSX.Element {
	const series = React.useMemo(() => SPARK_SERIES.map((entry) => ({ ...entry, color: color ?? entry.color })), [color]);
	return (
		<Card className="gap-0 overflow-hidden p-0">
			<div className="space-y-1 px-5 pt-5">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
				<p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
				<div className="min-h-6 pt-1">{change === null ? null : <ChangeLine change={change} />}</div>
			</div>
			{points.length < 2 ? (
				<div className="h-20" />
			) : (
				<AreaTrendChart title={`${title} history`} rows={points} series={series} format={format} domain={domain} className="h-20" sparkline />
			)}
		</Card>
	);
}
