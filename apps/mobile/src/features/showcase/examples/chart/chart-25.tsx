import { RadialBarChart, type ChartSliceDatum } from "@workspace/ui-native/components/chart";
import * as React from "react";

import { ChartCard, formatScore, SCORE_MAX } from "./chart-sample";

const SCORES: readonly ChartSliceDatum[] = [
	{ key: "mobile", label: "Mobile", value: 58, color: "chart-4", fill: { kind: "gradient", tone: "rising", direction: "right" } },
	{ key: "desktop", label: "Desktop", value: 76, color: "chart-2", fill: { kind: "gradient", tone: "rising", direction: "right" } },
	{ key: "api", label: "API", value: 92, color: "chart-1", fill: { kind: "gradient", tone: "rising", direction: "right" } },
];

// Three rings on a 0–100 track, each with its own gradient, their scores in the legend.
export function Chart25Example(): React.JSX.Element {
	return (
		<ChartCard title="Lighthouse Scores" description="Performance audit by platform">
			<RadialBarChart bars={SCORES} accessibilityLabel="Lighthouse scores by platform" max={SCORE_MAX} formatValue={formatScore} />
		</ChartCard>
	);
}
