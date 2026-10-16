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
	{ month: "Jan", desktop: 300 },
	{ month: "Feb", desktop: 550 },
	{ month: "Mar", desktop: 400 },
	{ month: "Apr", desktop: 630 },
	{ month: "May", desktop: 460 },
	{ month: "Jun", desktop: 780 },
	{ month: "Jul", desktop: 390 },
	{ month: "Aug", desktop: 925 },
	{ month: "Sep", desktop: 645 },
	{ month: "Oct", desktop: 530 },
	{ month: "Nov", desktop: 700 },
	{ month: "Dec", desktop: 270 },
];

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

export function Chart4Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Website Traffic
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+8%
					</Badge>
				</CardTitle>
				<CardDescription>Monthly visitor behavior patterns</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<defs>
							<pattern id="chart4-elegant-dotted-pattern" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
								<rect width="5" height="5" fill="var(--color-desktop)" opacity="0.1" />
								<circle cx="5" cy="5" r="1.4" fill="var(--color-desktop)" opacity={0.6}></circle>
							</pattern>
						</defs>
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Bar dataKey="desktop" fill="url(#chart4-elegant-dotted-pattern)" stroke="var(--color-desktop)" strokeWidth={1} radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
