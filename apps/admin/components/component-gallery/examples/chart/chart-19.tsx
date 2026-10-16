"use client";

import { Label, Pie, PieChart } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { createDonutCenterLabel } from "@/components/component-gallery/examples/chart/donut-center-label";

interface TrafficEntry {
	readonly source: string;
	readonly visits: number;
	/** Each slice is painted with its source's gradient. */
	readonly fill: string;
}

const chartData: readonly TrafficEntry[] = [
	{ source: "direct", visits: 4200, fill: "url(#chart19-gradient-direct)" },
	{ source: "search", visits: 3600, fill: "url(#chart19-gradient-search)" },
	{ source: "social", visits: 2800, fill: "url(#chart19-gradient-social)" },
	{ source: "email", visits: 1900, fill: "url(#chart19-gradient-email)" },
	{ source: "referral", visits: 1400, fill: "url(#chart19-gradient-referral)" },
];

const totalVisits = chartData.reduce((sum: number, entry: TrafficEntry): number => sum + entry.visits, 0);

const VISITS_PER_THOUSAND = 1000;

/** The drop shadow that lifts the ring off the card. */
const PIE_STYLE: React.CSSProperties = { filter: "url(#chart19-3d)" };

const renderCenterLabel = createDonutCenterLabel({
	value: `${(totalVisits / VISITS_PER_THOUSAND).toFixed(1)}k`,
	caption: "Total Visits",
	valueClassName: "text-3xl",
	captionOffsetPx: 22,
});

const chartConfig = {
	// The value series: named for the tooltip; slices take their own colours.
	visits: { label: "Visits", color: "var(--chart-1)" },
	direct: { label: "Direct", color: "var(--chart-1)" },
	search: { label: "Search", color: "var(--chart-2)" },
	social: { label: "Social", color: "var(--chart-3)" },
	email: { label: "Email", color: "var(--chart-4)" },
	referral: { label: "Referral", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function Chart19Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="items-center pb-0">
				<CardTitle>Traffic Sources</CardTitle>
				<CardDescription>Where your visitors come from</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
					<PieChart accessibilityLayer>
						<defs>
							<filter id="chart19-3d" x="-20%" y="-20%" width="140%" height="140%">
								<feDropShadow dx="0" dy="8" stdDeviation="5" floodOpacity="0.2" />
							</filter>
							<linearGradient id="chart19-gradient-direct" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
								<stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.8} />
							</linearGradient>
							<linearGradient id="chart19-gradient-search" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--chart-2)" stopOpacity={1} />
								<stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.8} />
							</linearGradient>
							<linearGradient id="chart19-gradient-social" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--chart-3)" stopOpacity={1} />
								<stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.8} />
							</linearGradient>
							<linearGradient id="chart19-gradient-email" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--chart-4)" stopOpacity={1} />
								<stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.8} />
							</linearGradient>
							<linearGradient id="chart19-gradient-referral" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--chart-5)" stopOpacity={1} />
								<stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.8} />
							</linearGradient>
						</defs>
						<ChartTooltip content={<ChartTooltipContent className="min-w-40 gap-2.5" />} />
						<Pie
							data={chartData}
							dataKey="visits"
							nameKey="source"
							innerRadius={65}
							outerRadius={95}
							cornerRadius={8}
							paddingAngle={4}
							stroke="var(--background)"
							strokeWidth={4}
							style={PIE_STYLE}>
							<Label content={renderCenterLabel} />
						</Pie>
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
