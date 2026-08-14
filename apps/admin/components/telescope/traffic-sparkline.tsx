"use client";

// ============================================
// components/telescope/traffic-sparkline.tsx
// Improvement v2 — traffic time-series. Renders the overview's 24 traffic
// buckets as a compact area chart (requests + errors). Dumb: points arrive
// via props; the chart is purely presentational.
// ============================================

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/display/chart";
import { useCallback, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import type { TelescopeTrafficPoint } from "@workspace/shared";

import { formatTimeOfDay } from "@/lib/dates";

export interface TrafficSparklineProps {
	readonly points: readonly TelescopeTrafficPoint[];
}

/** HH:mm label for a bucket start epoch-ms timestamp. */
function timeLabel(ms: number): string {
	return formatTimeOfDay(ms);
}

/** Compact "12:34" x-axis label, keeping every 3rd bucket. */
function tickFormatter(value: number, index: number): string {
	return index % 3 === 0 ? timeLabel(value) : "";
}

export function TrafficSparkline({ points }: TrafficSparklineProps): React.JSX.Element {
	const config: ChartConfig = useMemo(
		() => ({
			requests: { label: "Requests", color: "var(--chart-2)" },
			errors: { label: "Errors", color: "var(--chart-4)" },
		}),
		[],
	);

	const labelFormatter = useCallback((value: React.ReactNode): React.ReactNode => (typeof value === "number" ? timeLabel(value) : value), []);

	return (
		<ChartContainer config={config} className="h-28 w-full">
			<AreaChart data={[...points]} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
				<defs>
					<linearGradient id="traffic-requests" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.45} />
						<stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0.02} />
					</linearGradient>
					<linearGradient id="traffic-errors" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="var(--color-errors)" stopOpacity={0.4} />
						<stop offset="95%" stopColor="var(--color-errors)" stopOpacity={0.02} />
					</linearGradient>
				</defs>
				<CartesianGrid vertical={false} strokeDasharray="3 3" />
				<XAxis dataKey="t" tickFormatter={tickFormatter} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
				<ChartTooltip content={<ChartTooltipContent labelFormatter={labelFormatter} indicator="line" />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
				<Area dataKey="requests" type="monotone" stroke="var(--color-requests)" fill="url(#traffic-requests)" strokeWidth={1.5} isAnimationActive={false} />
				<Area dataKey="errors" type="monotone" stroke="var(--color-errors)" fill="url(#traffic-errors)" strokeWidth={1.5} isAnimationActive={false} />
			</AreaChart>
		</ChartContainer>
	);
}
