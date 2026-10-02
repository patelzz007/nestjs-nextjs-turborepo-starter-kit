"use client";

import type { SalesSummary } from "@workspace/shared";
import { AnalyticsChartCard } from "@workspace/ui/components/display/analytics-chart-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/display/chart";
import { formatMinorUnits, formatMinorUnitsCompact } from "@workspace/ui/lib/format/money";
import { format } from "date-fns";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const SALES_CHART_CONFIG: ChartConfig = {
	salesMinor: { label: "Sales", color: "var(--chart-1)" },
};

/** Room for compact money ticks ("RM 12.3K") on the y-axis. */
const SALES_Y_AXIS_WIDTH_PX = 64;

const CHART_TITLE = "Weekly sales";

export interface SalesOverTimeChartProps {
	/** `undefined` renders the chart skeleton. */
	readonly sales: SalesSummary | undefined;
	readonly description: string;
}

function SalesBars({ sales }: { readonly sales: SalesSummary }): React.JSX.Element {
	const { currency } = sales;
	const chartData = React.useMemo(() => sales.overTime.map((point) => ({ ...point, label: format(new Date(point.date), "MMM d") })), [sales.overTime]);
	const formatMoney = React.useCallback((minor: number): string => formatMinorUnits(minor, currency), [currency]);
	const formatMoneyTick = React.useCallback((minor: number): string => formatMinorUnitsCompact(minor, currency), [currency]);

	return (
		<ChartContainer config={SALES_CHART_CONFIG} className="aspect-auto h-[300px] w-full">
			<BarChart data={chartData}>
				<CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
				<XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
				<YAxis tickLine={false} axisLine={false} width={SALES_Y_AXIS_WIDTH_PX} className="text-xs" tickFormatter={formatMoneyTick} />
				<ChartTooltip content={<ChartTooltipContent valueFormatter={formatMoney} />} />
				<Bar dataKey="salesMinor" fill="var(--color-salesMinor)" name="salesMinor" radius={[4, 4, 0, 0]} />
			</BarChart>
		</ChartContainer>
	);
}

/** Paid-bill totals per week as bars; money arrives in minor units of `sales.currency`. */
export function SalesOverTimeChart({ sales, description }: SalesOverTimeChartProps): React.JSX.Element {
	return (
		<AnalyticsChartCard title={CHART_TITLE} description={description} isLoading={sales === undefined}>
			{sales === undefined ? null : <SalesBars sales={sales} />}
		</AnalyticsChartCard>
	);
}
