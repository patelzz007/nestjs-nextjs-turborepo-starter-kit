"use client";

// ============================================
// components/telescope/error-rate-chart.tsx
// Feature 13 — full error-rate dashboard. A line chart of error rate (%) per
// bucket over a LONG window (6h/24h) using the /telescope/trends endpoint —
// the coarser, longer lens the overview's 24-bucket sparkline cannot show.
//
// Dumb component: trend points arrive via props.
// ============================================

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

import type { TelescopeTrendPoint } from "@workspace/shared";

const HOUR_FORMATTER: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function bucketLabel(iso: string): string {
	return HOUR_FORMATTER.format(new Date(iso));
}

function ChartTooltip({
	active,
	payload,
}: {
	readonly active?: boolean;
	readonly payload?: readonly { readonly payload: { readonly t: string; readonly errorRatePct: number; readonly requests: number; readonly errors: number } }[];
}): React.JSX.Element | null {
	if (!active || payload === undefined || payload.length === 0) {
		return null;
	}
	const point = payload[0]?.payload;
	if (point === undefined) {
		return null;
	}
	return (
		<div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
			<p className="font-medium">{bucketLabel(point.t)}</p>
			<p className="text-muted-foreground">
				{point.errorRatePct.toFixed(1)}% errors · {String(point.requests)} req · {String(point.errors)} err
			</p>
		</div>
	);
}

export function ErrorRateChart({ points }: { readonly points: readonly TelescopeTrendPoint[] }): React.JSX.Element {
	const data = useMemo(() => points.map((point) => ({ ...point, label: bucketLabel(point.t) })), [points]);

	if (data.length === 0) {
		return <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No traffic in this window.</p>;
	}

	return (
		<div className="h-40 w-full">
			<ResponsiveContainer width="100%" height="100%">
				<LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
					<CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
					<XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} />
					<YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" domain={[0, "auto"]} />
					<Tooltip content={<ChartTooltip />} />
					<Line type="monotone" dataKey="errorRatePct" name="Error rate" stroke="var(--chart-4)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
