import { RadarChart, type ChartAxisDatum, type ChartRadarSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, formatScore, SCORE_MAX } from "./chart-sample";

const METRICS: readonly ChartAxisDatum[] = [
	{ label: "Speed", value: 88 },
	{ label: "Reliability", value: 94 },
	{ label: "Scalability", value: 72 },
	{ label: "Cost", value: 68 },
	{ label: "Security", value: 82 },
	{ label: "DX", value: 78 },
];

const SERIES: ChartRadarSeries = { label: "Score", color: "chart-2", stroke: "bold", fill: { kind: "gradient", tone: "soft", direction: "diagonal" } };

// Held to a 0–100 scale, with hollow corner markers and a diagonal gradient under a glowing stroke.
export function Chart24Example(): React.JSX.Element {
	return (
		<ChartCard title="Infrastructure Score" description="Platform performance metrics">
			<RadarChart data={METRICS} series={SERIES} accessibilityLabel="Platform scores" max={SCORE_MAX} dots="hollow" glow formatValue={formatScore} />
		</ChartCard>
	);
}
