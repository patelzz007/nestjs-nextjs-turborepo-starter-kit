"use client";

// CPU by core as bars: hover a core for its figure. A core turns amber, then red, as it saturates —
// one pegged core behind a calm average is exactly what this chart is for.

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
import * as React from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { usageLevel } from "@workspace/shared";

import { formatPercent } from "../lib/ops-format";

/** A core's colour: the series colour while healthy, amber when high, red when saturated. */
export function coreFill(percent: number): string {
	switch (usageLevel(percent)) {
		case "danger":
			return "var(--destructive)";
		case "warning":
			return "var(--warning)";
		case "ok":
			return "var(--chart-1)";
	}
}

const CORE_CONFIG: ChartConfig = { load: { label: "Load", color: "var(--chart-1)" } };
const PERCENT_DOMAIN: [number, number] = [0, 100];
const BAR_RADIUS: [number, number, number, number] = [3, 3, 0, 0];

export function CoreChart({ cores }: { readonly cores: readonly number[] }): React.JSX.Element {
	const rows = React.useMemo(() => cores.map((load, index) => ({ core: `#${String(index)}`, load, fill: coreFill(load) })), [cores]);
	return (
		<ChartContainer config={CORE_CONFIG} className="h-40 w-full" aria-label="CPU load by core">
			<BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
				<XAxis dataKey="core" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" />
				<YAxis domain={PERCENT_DOMAIN} tickLine={false} axisLine={false} fontSize={10} tickFormatter={formatPercent} />
				<ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={formatPercent} />} />
				<Bar dataKey="load" radius={BAR_RADIUS} isAnimationActive={false} />
			</BarChart>
		</ChartContainer>
	);
}
