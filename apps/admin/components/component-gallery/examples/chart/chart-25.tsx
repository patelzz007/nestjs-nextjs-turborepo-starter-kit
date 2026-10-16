"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, type RadialBarProps } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { formatScore, SCORE_MAX } from "@/components/component-gallery/examples/chart/chart-example-format";

const chartData = [
	{ name: "mobile", score: 58, fill: "url(#chart28-mobile)" },
	{ name: "desktop", score: 76, fill: "url(#chart28-desktop)" },
	{ name: "api", score: 92, fill: "url(#chart28-api)" },
];

const chartConfig = {
	// The value series: named for the tooltip; slices take their own colours.
	score: { label: "Score", color: "var(--chart-1)" },
	mobile: { label: "Mobile", color: "var(--chart-4)" },
	desktop: { label: "Desktop", color: "var(--chart-2)" },
	api: { label: "API", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Scores run from 0 to 100. */
const SCORE_DOMAIN: [number, number] = [0, SCORE_MAX];

/** Each bar's score, printed inside its start in the card colour. */
const BAR_LABEL: NonNullable<RadialBarProps["label"]> = { position: "insideStart", fill: "var(--background)", fontSize: 11, fontWeight: 600 };

type Platform = "mobile" | "desktop" | "api";

/** The audited platforms, each with its own bar gradient. */
const PLATFORMS: readonly Platform[] = ["mobile", "desktop", "api"];

export function Chart25Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="items-center pb-0">
				<CardTitle>Lighthouse Scores</CardTitle>
				<CardDescription>Performance audit by platform</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
					<RadialBarChart data={chartData} innerRadius={35} outerRadius={110} barSize={22}>
						<defs>
							{PLATFORMS.map((key: Platform): React.JSX.Element => (
								<linearGradient key={key} id={`chart28-${key}`} x1="0" y1="0" x2="1" y2="0">
									<stop offset="0%" stopColor={`var(--color-${key})`} stopOpacity={0.5} />
									<stop offset="100%" stopColor={`var(--color-${key})`} stopOpacity={1} />
								</linearGradient>
							))}
							<filter id="chart28-glow" x="-15%" y="-15%" width="130%" height="130%">
								<feGaussianBlur stdDeviation="3" result="blur" />
								<feComposite in="SourceGraphic" in2="blur" operator="over" />
							</filter>
						</defs>
						<ChartTooltip content={<ChartTooltipContent className="min-w-40 gap-2.5" nameKey="name" valueFormatter={formatScore} />} />
						<PolarAngleAxis type="number" domain={SCORE_DOMAIN} angleAxisId={0} tick={false} />
						<RadialBar dataKey="score" background cornerRadius={10} filter="url(#chart28-glow)" label={BAR_LABEL} />
						<ChartLegend content={<ChartLegendContent nameKey="name" className="-translate-y-2" />} />
					</RadialBarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
