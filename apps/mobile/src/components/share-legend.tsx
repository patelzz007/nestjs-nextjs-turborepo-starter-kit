// The legend of a parts-of-a-whole chart (ShareBar, DonutChart): one row per
// part — its swatch, name, value and share. It is the chart's dependable
// channel: every number is here as text, so identity is never colour alone.
//
// Presentational: the caller orders the parts and formats every number.

import * as React from "react";
import { Text, View } from "react-native";

import { CHART_COLOR_CLASSES, type ChartColor } from "./chart-colors";

/** One part of a whole. */
export interface ShareSegment {
	readonly key: string;
	readonly label: string;
	readonly color: ChartColor;
	readonly value: number;
	/** The value as shown ("12"). */
	readonly valueLabel: string;
	/** The share of the whole as shown ("42.9%"). */
	readonly shareLabel: string;
}

export interface ShareLegendProps {
	readonly segments: readonly ShareSegment[];
}

/** "Waiting to be used 37.5%, Redeemed 62.5%": a chart's parts in one sentence. */
export function describeShares(segments: readonly ShareSegment[]): string {
	return segments.map((segment: ShareSegment): string => `${segment.label} ${segment.shareLabel}`).join(", ");
}

export function ShareLegend({ segments }: ShareLegendProps): React.JSX.Element {
	return (
		<View className="gap-2">
			{segments.map((segment: ShareSegment): React.JSX.Element => (
				<View
					key={segment.key}
					className="min-h-6 flex-row items-center gap-2.5"
					accessible
					accessibilityLabel={`${segment.label}: ${segment.valueLabel}, ${segment.shareLabel}`}>
					<View className={`size-2.5 rounded-full ${CHART_COLOR_CLASSES[segment.color].fill}`} />
					<Text className="flex-1 font-sans text-sm text-foreground">{segment.label}</Text>
					<Text className="font-sans-semibold text-sm text-foreground">{segment.valueLabel}</Text>
					<Text className="w-14 text-right font-sans text-sm text-muted-foreground">{segment.shareLabel}</Text>
				</View>
			))}
		</View>
	);
}
