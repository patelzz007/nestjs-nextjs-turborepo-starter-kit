"use client";

import { TrendingUpIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Area, AreaChart, CartesianGrid, XAxis, type Margin, type DotProps, type ActiveDotProps } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";

const CHART_MARGIN: Partial<Margin> = { top: 20, right: 2, bottom: 0, left: 2 };

const chartData = [
	{ week: "W1", signups: 64 },
	{ week: "W2", signups: 78 },
	{ week: "W3", signups: 52 },
	{ week: "W4", signups: 92 },
	{ week: "W5", signups: 85 },
	{ week: "W6", signups: 110 },
	{ week: "W7", signups: 98 },
	{ week: "W8", signups: 125 },
];

const chartConfig = {
	signups: {
		label: "Signups",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

/** Every point glows (the `chart16-dot-glow` filter), ringed in the card colour. */
const GLOWING_DOT: Partial<DotProps> = { r: 4, fill: "var(--color-signups)", strokeWidth: 2, stroke: "var(--background)", filter: "url(#chart16-dot-glow)" };

const ACTIVE_DOT: Partial<ActiveDotProps> = { r: 6, strokeWidth: 3, stroke: "var(--background)" };

export function Chart16Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					New Signups
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+144%
					</Badge>
				</CardTitle>
				<CardDescription>Weekly user registration trends</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<AreaChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<defs>
							<linearGradient id="chart16-fill" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="var(--color-signups)" stopOpacity={0.35} />
								<stop offset="95%" stopColor="var(--color-signups)" stopOpacity={0} />
							</linearGradient>
							<filter id="chart16-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
								<feGaussianBlur stdDeviation="3" result="blur" />
								<feComposite in="SourceGraphic" in2="blur" operator="over" />
							</filter>
							<filter id="chart16-line-glow" x="-10%" y="-20%" width="120%" height="140%">
								<feGaussianBlur stdDeviation="8" result="blur" />
								<feComposite in="SourceGraphic" in2="blur" operator="over" />
							</filter>
						</defs>
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-36 gap-2.5" />} />
						<Area
							dataKey="signups"
							type="natural"
							fill="url(#chart16-fill)"
							stroke="var(--color-signups)"
							strokeWidth={2}
							filter="url(#chart16-line-glow)"
							dot={GLOWING_DOT}
							activeDot={ACTIVE_DOT}
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
