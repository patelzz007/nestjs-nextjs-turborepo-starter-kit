// Now against before, measure by measure ("this 30 days vs the previous 30"):
// one row per measure, its name and its change, over two thin bars — the
// current period in the series colour and the previous one in the neutral
// slot. The bars of a row share that row's scale (its larger value fills the
// track), so a row compares its own two periods; rows are not compared with
// each other (they are different units). A legend names the two periods.
//
// Presentational: the caller orders the measures and formats every number.

import * as React from "react";
import { Text, View } from "react-native";

import { CHART_COLOR_CLASSES, type ChartColor } from "./chart-colors";

export interface ComparisonItem {
	readonly key: string;
	readonly label: string;
	readonly current: number;
	readonly previous: number;
	/** The values as shown ("RM 412.30", "RM 380.00"). */
	readonly currentLabel: string;
	readonly previousLabel: string;
	/** How it moved, as shown ("+8.5%"); the caller words "no data before". */
	readonly changeLabel: string;
}

export interface ComparisonBarsProps {
	readonly items: readonly ComparisonItem[];
	/** The two periods' names ("Last 30 days", "Previous 30 days"). */
	readonly currentName: string;
	readonly previousName: string;
	readonly color?: ChartColor;
	readonly testID?: string;
}

/** The neutral slot: the previous period steps back. */
const PREVIOUS_COLOR: ChartColor = "chart-5";
/** Bar length in percent of the track. */
const FULL_PERCENT = 100;

export function ComparisonBars({ items, currentName, previousName, color = "chart-1", testID }: ComparisonBarsProps): React.JSX.Element {
	return (
		<View className="gap-4" testID={testID}>
			<View className="flex-row flex-wrap gap-x-4 gap-y-1" accessible accessibilityLabel={`Legend: ${currentName}, ${previousName}`}>
				<LegendKey label={currentName} fillClassName={CHART_COLOR_CLASSES[color].fill} />
				<LegendKey label={previousName} fillClassName={CHART_COLOR_CLASSES[PREVIOUS_COLOR].fill} />
			</View>
			{items.map((item: ComparisonItem): React.JSX.Element => {
				const top = Math.max(item.current, item.previous);
				return (
					<View
						key={item.key}
						className="gap-1.5"
						accessible
						accessibilityLabel={`${item.label}: ${item.currentLabel}, ${previousName} ${item.previousLabel}, ${item.changeLabel}`}>
						<View className="flex-row items-baseline gap-3">
							<Text className="font-sans-medium flex-1 text-sm text-foreground">{item.label}</Text>
							<Text className="font-sans text-xs text-muted-foreground">{item.changeLabel}</Text>
						</View>
						<ComparisonBar percent={top > 0 ? (item.current / top) * FULL_PERCENT : 0} valueLabel={item.currentLabel} fillClassName={CHART_COLOR_CLASSES[color].fill} />
						<ComparisonBar
							percent={top > 0 ? (item.previous / top) * FULL_PERCENT : 0}
							valueLabel={item.previousLabel}
							fillClassName={CHART_COLOR_CLASSES[PREVIOUS_COLOR].fill}
						/>
					</View>
				);
			})}
		</View>
	);
}

interface LegendKeyProps {
	readonly label: string;
	readonly fillClassName: string;
}

function LegendKey({ label, fillClassName }: LegendKeyProps): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-1.5">
			<View className={`size-2.5 rounded-full ${fillClassName}`} />
			<Text className="font-sans text-sm text-muted-foreground">{label}</Text>
		</View>
	);
}

interface ComparisonBarProps {
	readonly percent: number;
	readonly valueLabel: string;
	readonly fillClassName: string;
}

/** A bar with its value at the end of the track. */
function ComparisonBar({ percent, valueLabel, fillClassName }: ComparisonBarProps): React.JSX.Element {
	const barStyle = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: percent }), [percent]);
	const restStyle = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: FULL_PERCENT - percent }), [percent]);
	return (
		<View className="flex-row items-center gap-2">
			<View className="h-2 flex-1 flex-row overflow-hidden rounded-full bg-muted">
				<View style={barStyle} className={`basis-0 rounded-full ${fillClassName}`} />
				<View style={restStyle} className="basis-0" />
			</View>
			<Text className="w-24 text-right font-sans text-xs text-foreground" numberOfLines={1}>
				{valueLabel}
			</Text>
		</View>
	);
}
