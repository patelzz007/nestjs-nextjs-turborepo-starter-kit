"use client";

import { TrendingUpIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { abbreviateMonth, formatMonthTooltipLabel, formatUsd } from "@/components/component-gallery/examples/chart/chart-example-format";

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
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function Chart1Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Revenue Growth
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+5.2%
					</Badge>
				</CardTitle>
				<CardDescription>Monthly revenue performance tracking</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart accessibilityLayer data={chartData}>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={abbreviateMonth} />
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} valueFormatter={formatUsd} />}
						/>
						<Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
