import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { abbreviateMonth, ChartCard, chartDataOf, type ChartTrend, formatUsd } from "./chart-sample";

const DATA = chartDataOf(
	[
		{ month: "January", desktop: 289 },
		{ month: "February", desktop: 345 },
		{ month: "March", desktop: 412 },
		{ month: "April", desktop: 478 },
		{ month: "May", desktop: 534 },
		{ month: "June", desktop: 456 },
		{ month: "July", desktop: 523 },
		{ month: "August", desktop: 589 },
		{ month: "September", desktop: 467 },
		{ month: "October", desktop: 398 },
		{ month: "November", desktop: 356 },
		{ month: "December", desktop: 423 },
	],
	"month",
);

const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-4" }];
const TREND: ChartTrend = { label: "5.2%", tone: "success" };
/** The headline before a month is chosen. */
const RESTING_HEADLINE_VALUE = 123;

// Thin bars: tap one and it widens, prints its value, and the header figure follows it.
export function Chart11Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<number | null>(null);
	const value = selected === null ? RESTING_HEADLINE_VALUE : (DATA.at(selected)?.values.desktop ?? RESTING_HEADLINE_VALUE);
	return (
		<ChartCard title="Conversion Rates" trend={TREND} description="Real-time funnel conversion tracking" headline={formatUsd(value)}>
			<BarChart
				data={DATA}
				series={SERIES}
				accessibilityLabel="Conversions by month"
				shape="thin"
				grid="none"
				formatCategory={abbreviateMonth}
				formatValue={formatUsd}
				selectedIndex={selected}
				onSelectedIndexChange={setSelected}
			/>
		</ChartCard>
	);
}
