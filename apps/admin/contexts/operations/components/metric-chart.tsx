"use client";

// One history chart of the console: the shared gradient-area look (`AreaTrendChart`) over
// `{ at, values }` rows, one area per series. A thin adapter: no chart logic of its own.

import type { TimeSeriesDefinition } from "@workspace/ui/components/time-series-chart";
import * as React from "react";

import { AreaTrendChart, type AreaTrendSeries } from "./area-trend-chart";

export interface MetricChartProps<TKey extends string> {
	readonly title: string;
	readonly rows: readonly { readonly at: number; readonly values: Readonly<Record<TKey, number>> }[];
	readonly series: readonly TimeSeriesDefinition<TKey>[];
	readonly format: (value: number) => string;
	/** A fixed value axis (`[0, 100]` for shares). */
	readonly domain?: [number, number] | undefined;
	readonly loading?: boolean;
}

export function MetricChart<TKey extends string>({ title, rows, series, format, domain, loading = false }: MetricChartProps<TKey>): React.JSX.Element {
	const flat = React.useMemo(() => rows.map((row) => ({ ...row.values, at: row.at })), [rows]);
	const areas: AreaTrendSeries<TKey>[] = React.useMemo(() => series.map((entry) => ({ key: entry.key, label: entry.label, color: `var(--${entry.color})` })), [series]);
	if (flat.length < 2) {
		return <p className="py-16 text-center text-sm text-muted-foreground">{loading ? "Loading…" : "No data in this range yet."}</p>;
	}
	return <AreaTrendChart title={title} rows={flat} series={areas} format={format} domain={domain} className="h-56" />;
}
