"use client";

import { TrendingUpIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Area, AreaChart, CartesianGrid, XAxis, type Margin } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { abbreviateMonth, formatMonthTooltipLabel } from "@/components/component-gallery/examples/chart/chart-example-format";

const CHART_MARGIN: Partial<Margin> = { top: 20, right: 2, bottom: 0, left: 2 };

const chartData = [
	{ month: "January", connections: 48 },
	{ month: "February", connections: 62 },
	{ month: "March", connections: 62 },
	{ month: "April", connections: 85 },
	{ month: "May", connections: 85 },
	{ month: "June", connections: 110 },
	{ month: "July", connections: 110 },
	{ month: "August", connections: 135 },
];

const chartConfig = {
	connections: {
		label: "Connections",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

export function Chart15Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Active Connections
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+257%
					</Badge>
				</CardTitle>
				<CardDescription>Server connection pool over time</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<AreaChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<defs>
							<pattern id="chart15-dot-pattern" patternUnits="userSpaceOnUse" width="5" height="5">
								<rect width="5" height="5" fill="var(--color-connections)" opacity="0.08" />
								<circle cx="2.5" cy="2.5" r="1" fill="var(--color-connections)" opacity="0.5" />
							</pattern>
							<linearGradient id="chart15-stroke-grad" x1="0" y1="0" x2="1" y2="0">
								<stop offset="0%" stopColor="var(--color-connections)" stopOpacity={0.4} />
								<stop offset="100%" stopColor="var(--color-connections)" stopOpacity={1} />
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={abbreviateMonth} />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Area dataKey="connections" type="stepAfter" fill="url(#chart15-dot-pattern)" stroke="var(--color-connections)" strokeWidth={2} />
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
