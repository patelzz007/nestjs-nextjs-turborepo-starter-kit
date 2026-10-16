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
	{ month: "Jan", desktop: 340, mobile: 180 },
	{ month: "Feb", desktop: 870, mobile: 420 },
	{ month: "Mar", desktop: 510, mobile: 280 },
	{ month: "Apr", desktop: 620, mobile: 350 },
	{ month: "May", desktop: 450, mobile: 240 },
	{ month: "Jun", desktop: 780, mobile: 390 },
];

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--chart-2)",
	},
	mobile: {
		label: "Mobile",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

const DESKTOP_BAR_STYLE: React.CSSProperties = { color: "var(--color-desktop)" };

export function Chart9Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Customer Retention
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+18.4%
					</Badge>
				</CardTitle>
				<CardDescription>Customer loyalty across segments</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<BarChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<defs>
							<pattern id="chart6-elegant-dotted-pattern" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
								<rect width="5" height="5" fill="var(--color-desktop)" opacity="0.1" />
								<circle cx="5" cy="5" r="1.4" fill="var(--color-desktop)" opacity={1}></circle>
							</pattern>
						</defs>
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Bar dataKey="desktop" fill="url(#chart6-elegant-dotted-pattern)" stroke="var(--color-desktop)" strokeWidth={1} radius={4} style={DESKTOP_BAR_STYLE} />
						<Bar dataKey="mobile" fill="var(--color-mobile)" stroke="var(--color-mobile)" strokeWidth={1} radius={4} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
