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
	{ month: "Feb", desktop: 600 },
	{ month: "Mar", desktop: 500 },
	{ month: "Apr", desktop: 600 },
	{ month: "May", desktop: 400 },
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
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function Chart10Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Operational Efficiency
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+12.5%
					</Badge>
				</CardTitle>
				<CardDescription>Supply chain performance metrics</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<defs>
							{/* A hard stop at 50% splits each bar into a pale left half and a solid right half. */}
							<linearGradient id="chart10-duotone-bar" x1="0" y1="0" x2="1" y2="0">
								<stop offset="50%" stopColor="var(--color-desktop)" stopOpacity={0.4} />
								<stop offset="50%" stopColor="var(--color-desktop)" />
							</linearGradient>
						</defs>
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Bar dataKey="desktop" fill="url(#chart10-duotone-bar)" radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
