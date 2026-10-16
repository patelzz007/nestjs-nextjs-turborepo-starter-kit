"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, type PolarAngleAxisProps, type DotProps } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";

import { SCORE_MAX } from "@/components/component-gallery/examples/chart/chart-example-format";

const chartData = [
	{ metric: "Speed", value: 88 },
	{ metric: "Reliability", value: 94 },
	{ metric: "Scalability", value: 72 },
	{ metric: "Cost", value: 68 },
	{ metric: "Security", value: 82 },
	{ metric: "DX", value: 78 },
];

const chartConfig = {
	value: { label: "Score", color: "var(--chart-2)" },
} satisfies ChartConfig;

const AXIS_TICK: NonNullable<PolarAngleAxisProps["tick"]> = { fontSize: 11 };

/** Scores run from 0 to 100. */
const SCORE_DOMAIN: [number, number] = [0, SCORE_MAX];

/** Hollow points: card-coloured centre, series-coloured ring. */
const POINT_DOT: Partial<DotProps> = { r: 4, fill: "var(--background)", strokeWidth: 2.5, stroke: "var(--color-value)" };

export function Chart24Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="items-center pb-0">
				<CardTitle>Infrastructure Score</CardTitle>
				<CardDescription>Platform performance metrics</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
					<RadarChart accessibilityLayer data={chartData}>
						<defs>
							<linearGradient id="chart25-fill" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.45} />
								<stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.1} />
							</linearGradient>
							<filter id="chart25-glow" x="-15%" y="-15%" width="130%" height="130%">
								<feGaussianBlur stdDeviation="5" result="blur" />
								<feComposite in="SourceGraphic" in2="blur" operator="over" />
							</filter>
						</defs>
						<ChartTooltip content={<ChartTooltipContent />} />
						<PolarAngleAxis dataKey="metric" tick={AXIS_TICK} />
						<PolarGrid strokeDasharray="3 3" />
						<PolarRadiusAxis angle={90} domain={SCORE_DOMAIN} tick={false} axisLine={false} />
						<Radar dataKey="value" fill="url(#chart25-fill)" stroke="var(--color-value)" strokeWidth={2.5} filter="url(#chart25-glow)" dot={POINT_DOT} />
					</RadarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
