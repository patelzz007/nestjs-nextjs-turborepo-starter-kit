"use client";

import { TrendingUpIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Bar, BarChart, XAxis, type Margin } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { formatMonthTooltipLabel } from "@/components/component-gallery/examples/chart/chart-example-format";

const CHART_MARGIN: Partial<Margin> = { top: 20, right: 12, bottom: 12, left: 12 };

const chartData = [
	{ month: "Jan", desktop: 120 },
	{ month: "Feb", desktop: 250 },
	{ month: "Mar", desktop: 200 },
	{ month: "Apr", desktop: 170 },
	{ month: "May", desktop: 209 },
	{ month: "Jun", desktop: 210 },
	{ month: "Jul", desktop: 150 },
	{ month: "Aug", desktop: 230 },
	{ month: "Sep", desktop: 180 },
	{ month: "Oct", desktop: 190 },
	{ month: "Nov", desktop: 200 },
	{ month: "Dec", desktop: 120 },
];

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

export function Chart7Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Engagement Metrics
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+2.4%
					</Badge>
				</CardTitle>
				<CardDescription>User interaction and click-through rates</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart accessibilityLayer data={chartData} margin={CHART_MARGIN} barCategoryGap="15%">
						<defs>
							<linearGradient id="chart7-gradient-bar" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--color-desktop)" stopOpacity={0.7} />
								<stop offset="50%" stopColor="var(--color-desktop)" stopOpacity={0.4} />
								<stop offset="100%" stopColor="var(--color-desktop)" stopOpacity={0.2} />
							</linearGradient>
						</defs>
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Bar dataKey="desktop" fill="url(#chart7-gradient-bar)" radius={6} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
