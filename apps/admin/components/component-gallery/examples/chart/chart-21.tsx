"use client";

import { Pie, PieChart } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";

const chartData = [
	{ priority: "critical", bugs: 14, fill: "url(#chart21-critical-pattern)" },
	{ priority: "high", bugs: 28, fill: "var(--color-high)" },
	{ priority: "medium", bugs: 42, fill: "url(#chart21-medium-pattern)" },
	{ priority: "low", bugs: 36, fill: "var(--color-low)" },
];

const chartConfig = {
	// The value series: named for the tooltip; slices take their own colours.
	bugs: { label: "Bugs", color: "var(--chart-1)" },
	critical: { label: "Critical", color: "var(--destructive)" },
	high: { label: "High", color: "var(--chart-4)" },
	medium: { label: "Medium", color: "var(--chart-3)" },
	low: { label: "Low", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function Chart21Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="items-center pb-0">
				<CardTitle>Bug Priority</CardTitle>
				<CardDescription>Open issues by severity level</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
					<PieChart accessibilityLayer>
						<defs>
							<pattern id="chart21-critical-pattern" patternUnits="userSpaceOnUse" width="6" height="6">
								<rect width="6" height="6" fill="var(--destructive)" opacity="0.3" />
								<path d="M0,6 L6,0 M-2,2 L2,-2 M4,8 L8,4" stroke="var(--destructive)" strokeWidth="1.5" opacity="0.9" />
							</pattern>
							<pattern id="chart21-medium-pattern" patternUnits="userSpaceOnUse" width="5" height="5">
								<rect width="5" height="5" fill="var(--chart-3)" opacity="0.2" />
								<circle cx="2.5" cy="2.5" r="1.2" fill="var(--chart-3)" opacity="0.7" />
							</pattern>
						</defs>
						<ChartTooltip content={<ChartTooltipContent className="min-w-40 gap-2.5" />} />
						<ChartLegend content={<ChartLegendContent nameKey="priority" className="-translate-y-2" />} />
						<Pie data={chartData} dataKey="bugs" nameKey="priority" innerRadius={40} cornerRadius={4} paddingAngle={3} stroke="var(--background)" strokeWidth={3}></Pie>
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
