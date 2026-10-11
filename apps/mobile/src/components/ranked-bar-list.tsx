// A ranked list with a bar per row ("where you spent the most"): each row's
// name and value over a thin bar whose length is its share of the top row.
// One series, so one colour for every bar (a darker bar for a bigger value
// would only say twice what the length already says).
//
// Presentational: the caller ranks the rows and formats the values.

import * as React from "react";
import { Text, View } from "react-native";

import { CHART_COLOR_CLASSES, type ChartColor } from "./chart-colors";

export interface RankedBarItem {
	readonly key: string;
	readonly label: string;
	/** Under the name ("Café · 4 visits"). */
	readonly detail?: string;
	readonly value: number;
	/** The value as shown ("RM 182.40"). */
	readonly valueLabel: string;
}

export interface RankedBarListProps {
	/** Highest first. */
	readonly items: readonly RankedBarItem[];
	readonly color?: ChartColor;
	readonly testID?: string;
}

/** Bar length in percent of the row. */
const FULL_PERCENT = 100;

export function RankedBarList({ items, color = "chart-1", testID }: RankedBarListProps): React.JSX.Element {
	const top = Math.max(0, ...items.map((item: RankedBarItem): number => item.value));
	return (
		<View className="gap-4" testID={testID}>
			{items.map((item: RankedBarItem): React.JSX.Element => (
				<RankedBarRow key={item.key} item={item} percent={top > 0 ? (item.value / top) * FULL_PERCENT : 0} fillClassName={CHART_COLOR_CLASSES[color].fill} />
			))}
		</View>
	);
}

interface RankedBarRowProps {
	readonly item: RankedBarItem;
	/** The bar's length, in percent of the row. */
	readonly percent: number;
	readonly fillClassName: string;
}

function RankedBarRow({ item, percent, fillClassName }: RankedBarRowProps): React.JSX.Element {
	// The bar and the rest of the track share the row in proportion: no width string to build.
	const barStyle = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: percent }), [percent]);
	const restStyle = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: FULL_PERCENT - percent }), [percent]);
	const description = item.detail === undefined ? `${item.label}: ${item.valueLabel}` : `${item.label}: ${item.valueLabel}, ${item.detail}`;
	return (
		<View className="gap-1.5" accessible accessibilityLabel={description}>
			<View className="flex-row items-baseline gap-3">
				<View className="flex-1 gap-0.5">
					<Text className="font-sans-medium text-sm text-foreground" numberOfLines={1}>
						{item.label}
					</Text>
					{item.detail === undefined ? null : <Text className="font-sans text-xs text-muted-foreground">{item.detail}</Text>}
				</View>
				<Text className="font-sans-semibold text-sm text-foreground">{item.valueLabel}</Text>
			</View>
			<View className="h-1.5 flex-row overflow-hidden rounded-full bg-muted">
				<View style={barStyle} className={`basis-0 rounded-full ${fillClassName}`} />
				<View style={restStyle} className="basis-0" />
			</View>
		</View>
	);
}
