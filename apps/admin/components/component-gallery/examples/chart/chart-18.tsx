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
	{ month: "January", api: 1820, webhook: 1640 },
	{ month: "February", api: 2340, webhook: 2160 },
	{ month: "March", api: 1960, webhook: 1880 },
	{ month: "April", api: 2780, webhook: 2540 },
	{ month: "May", api: 2100, webhook: 1920 },
	{ month: "June", api: 3120, webhook: 2880 },
	{ month: "July", api: 2540, webhook: 2320 },
	{ month: "August", api: 3480, webhook: 3160 },
	{ month: "September", api: 2860, webhook: 2580 },
	{ month: "October", api: 2420, webhook: 2140 },
	{ month: "November", api: 3240, webhook: 2960 },
	{ month: "December", api: 2680, webhook: 2440 },
];

const chartConfig = {
	api: {
		label: "API Calls",
		color: "var(--chart-1)",
	},
	webhook: {
		label: "Webhooks",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

type RequestSeries = "api" | "webhook";

/** The stacked series, each filled with a crosshatch in its own colour. */
const CROSSHATCH_SERIES: readonly RequestSeries[] = ["api", "webhook"];

export function Chart18Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>
					Request Volume
					<Badge variant="success-light" className="ml-2">
						<TrendingUpIcon aria-hidden="true" />
						+12.8%
					</Badge>
				</CardTitle>
				<CardDescription>API and webhook traffic over 12 months</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<AreaChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={abbreviateMonth} />
						<ChartTooltip content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
						<defs>
							{CROSSHATCH_SERIES.map((key: RequestSeries): React.JSX.Element => (
								<pattern key={key} id={`chart18-crosshatch-${key}`} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
									<path d="M0,8 L8,0" stroke={`var(--color-${key})`} strokeWidth="0.8" opacity="0.4" />
									<path d="M0,0 L8,8" stroke={`var(--color-${key})`} strokeWidth="0.8" opacity="0.2" />
								</pattern>
							))}
						</defs>
						<Area dataKey="webhook" type="natural" fill="url(#chart18-crosshatch-webhook)" fillOpacity={0.5} stroke="var(--color-webhook)" stackId="a" strokeWidth={1} />
						<Area dataKey="api" type="natural" fill="url(#chart18-crosshatch-api)" fillOpacity={0.5} stroke="var(--color-api)" stackId="a" strokeWidth={1} />
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
