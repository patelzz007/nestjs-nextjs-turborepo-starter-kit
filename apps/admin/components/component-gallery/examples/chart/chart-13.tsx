"use client";

import { TrendingUpIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Area, AreaChart, CartesianGrid, XAxis, type Margin } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { abbreviateMonth, formatMonthTooltipLabel } from "@/components/component-gallery/examples/chart/chart-example-format";

const CHART_MARGIN: Partial<Margin> = { top: 20, right: 0, bottom: 0, left: 0 };

const chartData = [
	{ month: "January", visitors: 2400 },
	{ month: "February", visitors: 2850 },
	{ month: "March", visitors: 2600 },
	{ month: "April", visitors: 3100 },
	{ month: "May", visitors: 2900 },
	{ month: "June", visitors: 3400 },
];

const chartConfig = {
	visitors: {
		label: "Visitors",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function Chart13Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Website Traffic
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+24.5%
					</Badge>
				</CardTitle>
				<CardDescription>Monthly unique visitor trends</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<AreaChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<defs>
							<linearGradient id="chart13-gradient" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="var(--color-visitors)" stopOpacity={0.5} />
								<stop offset="95%" stopColor="var(--color-visitors)" stopOpacity={0.05} />
							</linearGradient>
							<pattern id="chart13-stripe" patternUnits="userSpaceOnUse" width="6" height="6">
								<path d="M0,6 L6,0" stroke="var(--color-visitors)" strokeWidth="0.8" opacity="0.15" />
							</pattern>
						</defs>
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={abbreviateMonth} />
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Area dataKey="visitors" type="natural" fill="url(#chart13-gradient)" stroke="var(--color-visitors)" strokeWidth={2} />
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
