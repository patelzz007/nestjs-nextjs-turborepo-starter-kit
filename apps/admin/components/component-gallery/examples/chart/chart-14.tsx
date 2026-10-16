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
	{ month: "January", organic: 1200, paid: 580, referral: 320 },
	{ month: "February", organic: 1450, paid: 620, referral: 380 },
	{ month: "March", organic: 1380, paid: 540, referral: 420 },
	{ month: "April", organic: 1650, paid: 710, referral: 460 },
	{ month: "May", organic: 1520, paid: 680, referral: 390 },
	{ month: "June", organic: 1800, paid: 750, referral: 510 },
];

const chartConfig = {
	organic: { label: "Organic", color: "var(--chart-1)" },
	paid: { label: "Paid", color: "var(--chart-2)" },
	referral: { label: "Referral", color: "var(--chart-3)" },
} satisfies ChartConfig;

type TrafficSource = keyof typeof chartConfig;

/** The stacked series, each with its own fill gradient. */
const AREA_SERIES: readonly TrafficSource[] = ["organic", "paid", "referral"];

export function Chart14Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Traffic Sources
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+18.3%
					</Badge>
				</CardTitle>
				<CardDescription>Visitor acquisition by channel</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<AreaChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<defs>
							{AREA_SERIES.map((key: TrafficSource): React.JSX.Element => (
								<linearGradient key={key} id={`chart14-${key}`} x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.5} />
									<stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.1} />
								</linearGradient>
							))}
						</defs>
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={abbreviateMonth} />
						<ChartTooltip content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<Area
							dataKey="referral"
							type="natural"
							stackId="1"
							fill="url(#chart14-referral)"
							fillOpacity={0.4}
							stroke="var(--color-referral)"
							strokeWidth={0.8}
							strokeDasharray="3 3"
						/>
						<Area dataKey="paid" type="natural" stackId="1" fill="url(#chart14-paid)" fillOpacity={0.4} stroke="var(--color-paid)" strokeWidth={0.8} strokeDasharray="3 3" />
						<Area dataKey="organic" type="natural" stackId="1" fill="url(#chart14-organic)" fillOpacity={0.4} stroke="var(--color-organic)" strokeWidth={2} />
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
