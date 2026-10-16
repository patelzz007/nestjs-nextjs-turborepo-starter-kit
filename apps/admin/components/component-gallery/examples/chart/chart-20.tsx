"use client";

import { Label, Pie, PieChart } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { createDonutCenterLabel } from "@/components/component-gallery/examples/chart/donut-center-label";

const chartData = [
	{ status: "completed", count: 186, fill: "var(--color-completed)" },
	{ status: "inProgress", count: 94, fill: "var(--color-inProgress)" },
	{ status: "pending", count: 62, fill: "var(--color-pending)" },
	{ status: "cancelled", count: 28, fill: "var(--color-cancelled)" },
];

const totalTasks = chartData.reduce((sum, d) => sum + d.count, 0);
const PERCENT = 100;
const [completed] = chartData;
const completionRate = Math.round(((completed?.count ?? 0) / totalTasks) * PERCENT);

const renderCenterLabel = createDonutCenterLabel({
	value: `${String(completionRate)}%`,
	caption: "Completed",
	valueClassName: "text-3xl",
	captionOffsetPx: 22,
});

const chartConfig = {
	// The value series: named for the tooltip; slices take their own colours.
	count: { label: "Tasks", color: "var(--chart-1)" },
	completed: { label: "Completed", color: "var(--chart-1)" },
	inProgress: { label: "In Progress", color: "var(--chart-2)" },
	pending: { label: "Pending", color: "var(--chart-3)" },
	cancelled: { label: "Cancelled", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function Chart20Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="items-center pb-0">
				<CardTitle>Task Status</CardTitle>
				<CardDescription>Current sprint task breakdown</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
					<PieChart accessibilityLayer>
						<ChartTooltip content={<ChartTooltipContent className="min-w-40 gap-2.5" />} />
						<ChartLegend content={<ChartLegendContent nameKey="status" className="-translate-y-2" />} />
						<Pie data={chartData} dataKey="count" nameKey="status" innerRadius={60} cornerRadius={5} paddingAngle={3} stroke="var(--background)" strokeWidth={3}>
							<Label content={renderCenterLabel} />
						</Pie>
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
