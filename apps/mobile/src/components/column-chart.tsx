// A value per category as columns ("visits by day of the week"): one column
// per category in the caller's order, rising from a shared baseline, each as
// tall as its share of the highest. Tap a column to read it: the readout
// above the plot names it with its value, and the other columns step back.
// Each column is a button for screen readers, named with its value.
//
// One series, so one colour for every column (a column's height already says
// its size). Presentational: the caller orders the columns and formats values.

import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { playSelectionFeedback } from "../lib/haptics";
import { CHART_COLOR_CLASSES, type ChartColor } from "./chart-colors";

export interface ColumnDatum {
	readonly key: string;
	/** Under the column ("Sat"). */
	readonly label: string;
	/** In the readout and for screen readers ("Saturday"). */
	readonly fullLabel: string;
	readonly value: number;
	/** The value as shown ("14 visits"). */
	readonly valueLabel: string;
}

export interface ColumnChartProps {
	/** What the chart shows ("Visits by day of the week"): its accessible name. */
	readonly title: string;
	readonly columns: readonly ColumnDatum[];
	/** Shown in the readout until a column is picked ("Tap a day to see its visits"). */
	readonly hint: string;
	readonly color?: ChartColor;
	readonly testID?: string;
}

/** Height of the plot, in points. */
const PLOT_HEIGHT = 136;
/** A column's height in percent of the plot, at the highest value. */
const FULL_PERCENT = 100;
/** The least a non-zero column shows, so a small value is still seen. */
const MIN_VISIBLE_PERCENT = 3;

const styles = StyleSheet.create({
	plot: { height: PLOT_HEIGHT },
});

/** A column's height in percent of the plot: in proportion to the highest, never invisible when above zero. */
export function columnPercentOf(value: number, max: number): number {
	if (value <= 0 || max <= 0) {
		return 0;
	}
	return Math.max(MIN_VISIBLE_PERCENT, (value / max) * FULL_PERCENT);
}

export function ColumnChart({ title, columns, hint, color = "chart-1", testID }: ColumnChartProps): React.JSX.Element {
	const [pickedKey, setPickedKey] = React.useState<string | null>(null);
	const picked = columns.find((column: ColumnDatum): boolean => column.key === pickedKey) ?? null;
	const max = Math.max(0, ...columns.map((column: ColumnDatum): number => column.value));

	const pick = React.useCallback(
		(key: string): void => {
			if (key !== pickedKey) {
				playSelectionFeedback();
				setPickedKey(key);
			}
		},
		[pickedKey],
	);

	return (
		<View className="gap-3" accessibilityLabel={title} testID={testID}>
			<View className="min-h-11 justify-center" importantForAccessibility="no-hide-descendants">
				{picked === null ? (
					<Text className="font-sans text-sm text-muted-foreground">{hint}</Text>
				) : (
					<>
						<Text className="font-sans-medium text-xs text-muted-foreground">{picked.fullLabel}</Text>
						<Text className="font-sans-semibold text-base text-foreground">{picked.valueLabel}</Text>
					</>
				)}
			</View>
			<View style={styles.plot} className="flex-row gap-1.5 border-b border-border">
				{columns.map((column: ColumnDatum): React.JSX.Element => (
					<Column
						key={column.key}
						column={column}
						percent={columnPercentOf(column.value, max)}
						fillClassName={picked === null || picked.key === column.key ? CHART_COLOR_CLASSES[color].fill : CHART_COLOR_CLASSES[color].faded}
						selected={picked?.key === column.key}
						onPick={pick}
						{...(testID === undefined ? {} : { testID: `${testID}-${column.key}` })}
					/>
				))}
			</View>
			<View className="flex-row gap-1.5" importantForAccessibility="no-hide-descendants">
				{columns.map((column: ColumnDatum): React.JSX.Element => (
					<Text key={column.key} className={`flex-1 text-center font-sans text-xs ${picked?.key === column.key ? "text-foreground" : "text-muted-foreground"}`}>
						{column.label}
					</Text>
				))}
			</View>
		</View>
	);
}

interface ColumnProps {
	readonly column: ColumnDatum;
	readonly percent: number;
	readonly fillClassName: string;
	readonly selected: boolean;
	readonly onPick: (key: string) => void;
	readonly testID?: string;
}

/** A column and the empty space above it, sharing the plot's height in proportion. */
function Column({ column, percent, fillClassName, selected, onPick, testID }: ColumnProps): React.JSX.Element {
	const restStyle = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: FULL_PERCENT - percent }), [percent]);
	const barStyle = React.useMemo((): { readonly flexGrow: number } => ({ flexGrow: percent }), [percent]);
	const press = React.useCallback((): void => {
		onPick(column.key);
	}, [column.key, onPick]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${column.fullLabel}: ${column.valueLabel}`}
			accessibilityState={{ selected }}
			onPress={press}
			className="flex-1"
			testID={testID}>
			<View style={restStyle} className="basis-0" />
			<View style={barStyle} className={`basis-0 rounded-t-md ${fillClassName}`} />
		</Pressable>
	);
}
