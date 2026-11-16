"use client";

// The headline in a donut's hole — a large figure with a caption under it —
// as a recharts `<Label content={…} />` renderer. Shared by the donut examples.

import type * as React from "react";
import type { LabelProps } from "recharts";

export interface DonutCenterLabelOptions {
	/** The large figure ("14.2k", "50%"). */
	readonly value: string;
	/** The caption under it ("Total Visits"). */
	readonly caption: string;
	/** Text size of the figure. */
	readonly valueClassName: string;
	/** How far below the centre the caption's baseline sits (px). */
	readonly captionOffsetPx: number;
}

/** Builds the `content` renderer for a `<Label />` inside a `<Pie />`. */
export function createDonutCenterLabel({ value, caption, valueClassName, captionOffsetPx }: DonutCenterLabelOptions): (props: LabelProps) => React.ReactElement {
	return function renderDonutCenterLabel({ viewBox }: LabelProps): React.ReactElement {
		// Only a polar view box (a pie's) has a centre to anchor to.
		if (viewBox === undefined || !("cx" in viewBox)) {
			return <g />;
		}
		return (
			<text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
				<tspan x={viewBox.cx} y={viewBox.cy} className={`fill-foreground font-bold tabular-nums ${valueClassName}`}>
					{value}
				</tspan>
				<tspan x={viewBox.cx} y={viewBox.cy + captionOffsetPx} className="fill-muted-foreground text-xs">
					{caption}
				</tspan>
			</text>
		);
	};
}
