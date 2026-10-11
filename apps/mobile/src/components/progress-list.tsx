// Rows of progress towards a target ("Kopi Kaki · 7 of 10 stamps"): each
// row's name and value over a meter. `display="bar"` is a continuous bar;
// `display="steps"` is one pip per unit, for a small whole-number target (a
// stamp card), where counting the pips is the point. Each row is read by
// screen readers as a progress bar with its numbers.
//
// Presentational: the caller orders the rows and formats the values.

import * as React from "react";
import { Text, View } from "react-native";

import { progressShare } from "../lib/chart-geometry";
import { CHART_COLOR_CLASSES, type ChartColor } from "./chart-colors";

export interface ProgressItem {
	readonly key: string;
	readonly label: string;
	/** Under the name ("Free kopi"). */
	readonly detail?: string;
	readonly value: number;
	readonly max: number;
	/** The progress as shown ("7 of 10"). */
	readonly valueLabel: string;
}

export type ProgressDisplay = "bar" | "steps";

export interface ProgressListProps {
	readonly items: readonly ProgressItem[];
	readonly display?: ProgressDisplay;
	readonly color?: ChartColor;
	readonly testID?: string;
}

/** Bar length in percent of the row. */
const FULL_PERCENT = 100;

export function ProgressList({ items, display = "bar", color = "chart-1", testID }: ProgressListProps): React.JSX.Element {
	const fillClassName = CHART_COLOR_CLASSES[color].fill;
	return (
		<View className="gap-4" testID={testID}>
			{items.map((item: ProgressItem): React.JSX.Element => (
				<View
					key={item.key}
					className="gap-2"
					accessible
					accessibilityRole="progressbar"
					accessibilityLabel={item.detail === undefined ? item.label : `${item.label}, ${item.detail}`}
					accessibilityValue={{ min: 0, max: item.max, now: Math.min(Math.max(0, item.value), item.max), text: item.valueLabel }}>
					<View className="flex-row items-baseline gap-3">
						<View className="flex-1 gap-0.5">
							<Text className="font-sans-medium text-sm text-foreground" numberOfLines={1}>
								{item.label}
							</Text>
							{item.detail === undefined ? null : <Text className="font-sans text-xs text-muted-foreground">{item.detail}</Text>}
						</View>
						<Text className="font-sans-semibold text-sm text-foreground">{item.valueLabel}</Text>
					</View>
					{display === "steps" ? (
						<StepsMeter value={item.value} max={item.max} fillClassName={fillClassName} testID={`progress-${item.key}`} />
					) : (
						<BarMeter percent={progressShare(item.value, item.max) * FULL_PERCENT} fillClassName={fillClassName} />
					)}
				</View>
			))}
		</View>
	);
}

interface StepsMeterProps {
	readonly value: number;
	readonly max: number;
	readonly fillClassName: string;
	readonly testID: string;
}

/** One pip per unit of the target, the first `value` of them filled. */
function StepsMeter({ value, max, fillClassName, testID }: StepsMeterProps): React.JSX.Element {
	const steps = [...Array<number>(Math.max(0, Math.round(max))).keys()];
	return (
		<View className="flex-row gap-1" testID={testID}>
			{steps.map((step: number): React.JSX.Element => (
				<View key={step} className={`h-2 flex-1 rounded-full ${step < value ? fillClassName : "bg-muted"}`} testID={step < value ? `${testID}-filled` : `${testID}-empty`} />
			))}
		</View>
	);
}

interface BarMeterProps {
	readonly percent: number;
	readonly fillClassName: string;
}

function BarMeter({ percent, fillClassName }: BarMeterProps): React.JSX.Element {
	// The bar and the rest of the track share the row in proportion: no width string to build.
	const barStyle = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: percent }), [percent]);
	const restStyle = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: FULL_PERCENT - percent }), [percent]);
	return (
		<View className="h-2 flex-row overflow-hidden rounded-full bg-muted">
			<View style={barStyle} className={`basis-0 rounded-full ${fillClassName}`} />
			<View style={restStyle} className="basis-0" />
		</View>
	);
}
