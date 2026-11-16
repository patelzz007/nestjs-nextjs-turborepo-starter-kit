import { RadarChart, type ChartAxisDatum, type ChartRadarSeries } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, formatScore, SCORE_MAX } from "./chart-sample";

const SKILLS: readonly ChartAxisDatum[] = [
	{ label: "Frontend", value: 92 },
	{ label: "Backend", value: 78 },
	{ label: "DevOps", value: 68 },
	{ label: "Design", value: 74 },
	{ label: "Testing", value: 85 },
	{ label: "Security", value: 62 },
];

const SERIES: ChartRadarSeries = { label: "Proficiency", color: "chart-1", fill: { kind: "gradient", tone: "soft" } };

// Six axes under a top-to-bottom gradient, a soft glow and solid corner dots.
export function Chart23Example(): React.JSX.Element {
	return (
		<ChartCard title="Skill Assessment" description="Team proficiency across key areas">
			<RadarChart data={SKILLS} series={SERIES} accessibilityLabel="Team skill scores" max={SCORE_MAX} glow formatValue={formatScore} />
		</ChartCard>
	);
}
