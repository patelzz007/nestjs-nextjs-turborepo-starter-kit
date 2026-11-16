import * as React from "react";
import { Bar, BarChart, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";

const DAY_COUNT = 100;
const BASE_ORDERS = 40;
const ORDER_SPREAD = 25;
const WAVE = 7;

/** A hundred days of orders: one bar each. */
const DAYS = Array.from({ length: DAY_COUNT }, (_, day: number) => ({ day: String(day + 1), orders: BASE_ORDERS + Math.round(Math.sin(day / WAVE) * ORDER_SPREAD) }));

const CONFIG = {
	orders: { label: "Orders", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ChartDont2Example(): React.JSX.Element {
	return (
		<ChartContainer config={CONFIG} className="h-56 w-full max-w-md">
			<BarChart accessibilityLayer data={DAYS}>
				<CartesianGrid vertical={false} />
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar dataKey="orders" fill="var(--color-orders)" />
			</BarChart>
		</ChartContainer>
	);
}
