"use client";

import { TrendingDownIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Bar, BarChart, XAxis, type Margin } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { formatMonthTooltipLabel } from "@/components/component-gallery/examples/chart/chart-example-format";
import { createIsometricBarShape } from "@/components/component-gallery/examples/chart/isometric-bar";

const CHART_MARGIN: Partial<Margin> = { top: 40, right: 40, bottom: 20, left: 20 };

const chartData = [
	{ month: "Jan", desktop: 340 },
	{ month: "Feb", desktop: 870 },
	{ month: "Mar", desktop: 510 },
	{ month: "Apr", desktop: 620 },
	{ month: "May", desktop: 450 },
	{ month: "Jun", desktop: 780 },
	{ month: "Jul", desktop: 390 },
	{ month: "Aug", desktop: 920 },
	{ month: "Sep", desktop: 640 },
	{ month: "Oct", desktop: 530 },
	{ month: "Nov", desktop: 800 },
	{ month: "Dec", desktop: 270 },
];

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--chart-5)",
	},
} satisfies ChartConfig;

/** One flat colour; the hidden faces fade so the block reads as lit from the front. */
const renderBar = createIsometricBarShape({
	back: { fill: "var(--color-desktop)", opacity: 0.6 },
	side: { fill: "var(--color-desktop)", opacity: 0.7 },
	top: { fill: "var(--color-desktop)", opacity: 0.8 },
	front: { fill: "var(--color-desktop)" },
});

export function Chart8Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Financial Forecast
					<Badge variant="destructive-light" className="ml-2">
						<TrendingDownIcon aria-hidden="true" />
						+8.2%
					</Badge>
				</CardTitle>
				<CardDescription>Projected vs actual revenue growth</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart accessibilityLayer data={chartData} margin={CHART_MARGIN} barCategoryGap="20%">
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={12} />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Bar dataKey="desktop" fill="var(--color-desktop)" shape={renderBar} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
