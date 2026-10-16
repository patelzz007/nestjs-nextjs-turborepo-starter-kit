"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, type Margin } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { abbreviateMonth, formatMonthTooltipLabel, formatUsd } from "@/components/component-gallery/examples/chart/chart-example-format";

const CHART_MARGIN: Partial<Margin> = { top: 20, right: 0, bottom: 0, left: 0 };

const chartData = [
	{ month: "January", forecast: 2600, forecastArea: 2600 },
	{ month: "February", forecast: 4200, forecastArea: 4200 },
	{ month: "March", forecast: 2400, forecastArea: 2400 },
	{ month: "April", forecast: 5000, forecastArea: 5000 },
	{ month: "May", forecast: 2800, forecastArea: 2800 },
	{ month: "June", forecast: 5800, forecastArea: 5800 },
	{ month: "July", forecast: 3200, forecastArea: 3200 },
	{ month: "August", forecast: 6200, forecastArea: 6200 },
	{ month: "September", forecast: 3800, forecastArea: 3800 },
];

const chartConfig = {
	forecast: { label: "Forecast", color: "var(--chart-4)" },
	forecastArea: { label: "Forecast", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function Chart17Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Sales Forecast</CardTitle>
				<CardDescription>Projected sales performance with trends</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig}>
					<ComposedChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
						<defs>
							<pattern id="chart17-forecast-stripe" patternUnits="userSpaceOnUse" width="6" height="6">
								<rect width="6" height="6" fill="var(--color-forecast)" opacity="0.04" />
								<path d="M0,6 L6,0" stroke="var(--color-forecast)" strokeWidth="0.8" opacity="0.15" />
							</pattern>
						</defs>
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={abbreviateMonth} />
						<ChartTooltip content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} valueFormatter={formatUsd} />} />
						<ChartLegend content={<ChartLegendContent />} />
						<Area dataKey="forecastArea" type="natural" fill="url(#chart17-forecast-stripe)" stroke="none" connectNulls legendType="none" tooltipType="none" />
						<Line dataKey="forecast" type="natural" stroke="var(--color-forecast)" strokeWidth={2.5} dot={false} connectNulls />
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
