"use client";

// The console's history chart: a gradient area over a full grid, time along the bottom (clock times
// for a day or less, dates beyond), the value on the grid's rows, and a hover read-out of every
// series at that moment. Fills its container edge to edge — the card around it gives the padding.

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatClock, formatDateTimeShort } from "../lib/ops-format";

/** One series: what it is and its colour token (`chart-1` …). */
export interface AreaTrendSeries<TKey extends string> {
	readonly key: TKey;
	readonly label: string;
	readonly color: string;
}

export interface AreaTrendChartProps<TKey extends string> {
	/** What the chart shows, for screen readers. */
	readonly title: string;
	readonly rows: readonly ({ readonly at: number } & Readonly<Record<TKey, number>>)[];
	readonly series: readonly AreaTrendSeries<TKey>[];
	readonly format: (value: number) => string;
	/** A fixed value axis (`[0, 100]` for shares); omitted, it fits the data. */
	readonly domain?: [number, number] | undefined;
	readonly className?: string;
	/** Draws a compact sparkline: no grid, axes or labels. */
	readonly sparkline?: boolean;
}

const DAY_MS = 86_400_000;
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const GRID_DASH = "0";
const TICK_COUNT = 8;
const Y_TICKS = 5;

/** A tick's label: clock times within a day, dates beyond. */
function tickFormatter(spanMs: number): (at: number) => string {
	return spanMs <= DAY_MS ? formatClock : (at: number): string => DATE_FORMAT.format(at);
}

/** The tooltip's heading: the moment in full. */
function momentLabel(_label: React.ReactNode, payload: readonly { readonly payload?: { readonly at?: number } }[]): string {
	const [first] = payload;
	return first?.payload?.at === undefined ? "" : formatDateTimeShort(first.payload.at);
}

export function AreaTrendChart<TKey extends string>({ title, rows, series, format, domain, className, sparkline = false }: AreaTrendChartProps<TKey>): React.JSX.Element {
	const gradientId = React.useId().replaceAll(":", "");
	const config: ChartConfig = React.useMemo(
		(): ChartConfig => Object.fromEntries<ChartConfig[string]>(series.map((entry): [string, ChartConfig[string]] => [entry.key, { label: entry.label, color: entry.color }])),
		[series],
	);
	const [first] = rows;
	const [last] = rows.slice(-1);
	const spanMs = first === undefined || last === undefined ? 0 : last.at - first.at;
	const formatTick = React.useMemo(() => tickFormatter(spanMs), [spanMs]);
	return (
		<ChartContainer config={config} className={cn("w-full", className)} aria-label={title}>
			<AreaChart data={rows} margin={sparkline ? { top: 4, right: 0, bottom: 0, left: 0 } : { top: 12, right: 0, bottom: 0, left: 0 }}>
				<defs>
					{series.map((entry) => (
						<linearGradient key={entry.key} id={`${gradientId}-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor={`var(--color-${entry.key})`} stopOpacity={sparkline ? 0.28 : 0.45} />
							<stop offset="100%" stopColor={`var(--color-${entry.key})`} stopOpacity={0.04} />
						</linearGradient>
					))}
				</defs>
				{sparkline ? null : <CartesianGrid strokeDasharray={GRID_DASH} className="stroke-border/70" />}
				<XAxis
					dataKey="at"
					type="number"
					scale="time"
					domain={["dataMin", "dataMax"]}
					hide={sparkline}
					tickFormatter={formatTick}
					tickCount={TICK_COUNT}
					tickLine={false}
					axisLine={false}
					fontSize={11}
					height={sparkline ? 0 : 24}
				/>
				<YAxis hide domain={domain ?? ["auto", "auto"]} tickCount={Y_TICKS} />
				<ChartTooltip cursor={!sparkline} content={<ChartTooltipContent indicator="line" labelFormatter={momentLabel} valueFormatter={format} />} />
				{series.map((entry) => (
					<Area
						key={entry.key}
						dataKey={entry.key}
						type="monotone"
						stroke={`var(--color-${entry.key})`}
						strokeWidth={sparkline ? 1.5 : 2}
						fill={`url(#${gradientId}-${entry.key})`}
						isAnimationActive={false}
						dot={false}
						activeDot={sparkline ? false : { r: 3 }}
					/>
				))}
			</AreaChart>
		</ChartContainer>
	);
}
