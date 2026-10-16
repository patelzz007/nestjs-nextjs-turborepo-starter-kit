"use client";

import { Label, Pie, PieChart, Sector, type PieSectorShapeProps } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import type * as React from "react";
import { createDonutCenterLabel } from "@/components/component-gallery/examples/chart/donut-center-label";

const chartData = [
	{ plan: "free", users: 12800, fill: "var(--color-free)" },
	{ plan: "starter", users: 5400, fill: "var(--color-starter)" },
	{ plan: "pro", users: 3600, fill: "var(--color-pro)" },
	{ plan: "enterprise", users: 1200, fill: "var(--color-enterprise)" },
];

const totalUsers = chartData.reduce((sum, d) => sum + d.users, 0);
const [freePlan] = chartData;
const paidUsers = totalUsers - (freePlan?.users ?? 0);
const PERCENT = 100;
const conversionRate = ((paidUsers / totalUsers) * PERCENT).toFixed(1);

/** How far the hovered slice grows past the ring (px). */
const ACTIVE_SLICE_GROWTH_PX = 10;

/** Each slice; the hovered one is drawn larger so it stands out. */
function renderSector({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, cornerRadius, fill, stroke, strokeWidth, isActive }: PieSectorShapeProps): React.JSX.Element {
	return (
		<Sector
			cx={cx}
			cy={cy}
			innerRadius={innerRadius}
			outerRadius={isActive ? outerRadius + ACTIVE_SLICE_GROWTH_PX : outerRadius}
			startAngle={startAngle}
			endAngle={endAngle}
			cornerRadius={cornerRadius ?? 0}
			fill={fill}
			stroke={stroke}
			strokeWidth={strokeWidth}
		/>
	);
}

const renderCenterLabel = createDonutCenterLabel({
	value: paidUsers.toLocaleString(),
	caption: "Paid Users",
	valueClassName: "text-2xl",
	captionOffsetPx: 20,
});

const chartConfig = {
	// The value series: named for the tooltip; slices take their own colours.
	users: { label: "Users", color: "var(--chart-1)" },
	free: { label: "Free", color: "var(--chart-5)" },
	starter: { label: "Starter", color: "var(--chart-3)" },
	pro: { label: "Pro", color: "var(--chart-2)" },
	enterprise: { label: "Enterprise", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function Chart22Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs">
			<CardHeader className="items-center pb-0">
				<CardTitle>Conversion Funnel</CardTitle>
				<CardDescription>{conversionRate}% of users are on paid plans</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
					<PieChart accessibilityLayer>
						<ChartTooltip content={<ChartTooltipContent className="min-w-40 gap-2.5" />} />
						<ChartLegend content={<ChartLegendContent nameKey="plan" className="-translate-y-2" />} />
						<Pie
							data={chartData}
							dataKey="users"
							nameKey="plan"
							innerRadius={55}
							cornerRadius={5}
							paddingAngle={3}
							stroke="var(--background)"
							strokeWidth={3}
							shape={renderSector}>
							<Label content={renderCenterLabel} />
						</Pie>
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
