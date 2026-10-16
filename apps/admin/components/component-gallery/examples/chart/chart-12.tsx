"use client";

import { TrendingDownIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Bar, BarChart, XAxis, YAxis, type Margin } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { formatMonthTooltipLabel } from "@/components/component-gallery/examples/chart/chart-example-format";

const CHART_MARGIN: Partial<Margin> = { left: -10, right: 20 };

const chartData = [
	{ month: "Jan", desktop: 342, mobile: 245 },
	{ month: "Feb", desktop: 876, mobile: 654 },
	{ month: "Mar", desktop: 512, mobile: 389 },
	{ month: "Apr", desktop: 629, mobile: 521 },
	{ month: "May", desktop: 458, mobile: 367 },
	{ month: "Jun", desktop: 781, mobile: 598 },
];

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--chart-1)",
	},
	mobile: {
		label: "Mobile",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

export function Chart12Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Inventory Levels
					<Badge variant="destructive-light" className="ml-2">
						<TrendingDownIcon aria-hidden="true" />
						-3.2%
					</Badge>
				</CardTitle>
				<CardDescription>Stock availability across warehouses</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart accessibilityLayer data={chartData} layout="vertical" margin={CHART_MARGIN} barCategoryGap="30%">
						<YAxis type="category" dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
						<XAxis type="number" tickLine={false} tickMargin={10} axisLine={false} hide />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Bar dataKey="desktop" fill="var(--color-desktop)" radius={2} />
						<Bar dataKey="mobile" fill="var(--color-mobile)" radius={2} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
