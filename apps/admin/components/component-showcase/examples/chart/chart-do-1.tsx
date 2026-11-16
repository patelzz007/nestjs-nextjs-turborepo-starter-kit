import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";

const DATA = [
	{ quarter: "Q1", online: 420, store: 380 },
	{ quarter: "Q2", online: 510, store: 360 },
	{ quarter: "Q3", online: 560, store: 410 },
	{ quarter: "Q4", online: 690, store: 450 },
];

const CONFIG = {
	online: { label: "Online", color: "var(--chart-1)" },
	store: { label: "In store", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ChartDo1Example(): React.JSX.Element {
	return (
		<ChartContainer config={CONFIG} className="h-56 w-full max-w-md">
			<BarChart accessibilityLayer data={DATA}>
				<CartesianGrid vertical={false} />
				<XAxis dataKey="quarter" tickLine={false} axisLine={false} />
				<ChartTooltip content={<ChartTooltipContent />} />
				<ChartLegend content={<ChartLegendContent />} />
				<Bar dataKey="online" fill="var(--color-online)" radius={4} />
				<Bar dataKey="store" fill="var(--color-store)" radius={4} fillOpacity={0.45} stroke="var(--color-store)" strokeDasharray="4 2" />
			</BarChart>
		</ChartContainer>
	);
}
