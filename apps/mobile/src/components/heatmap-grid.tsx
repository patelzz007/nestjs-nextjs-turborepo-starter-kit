// A value at every crossing of two categories ("visits by day and time of
// day"): a grid of cells, one row per row category and one column per column
// category, each cell shaded on one hue's sequential scale (nothing is the
// muted surface, then four steps up to the highest value). A "Less … More"
// key reads the scale. Tap a cell to read it: the readout above the grid
// names it with its value. Each cell is a button for screen readers, named
// with its row, its column and its value.
//
// Presentational: the caller orders the rows and columns and formats values.

import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { intensityLevel } from "../lib/chart-geometry";
import { playSelectionFeedback } from "../lib/haptics";
import { CHART_RAMP_STEPS, rampClassOf, type ChartColor } from "./chart-colors";

/** A row's or column's name: short beside the grid ("Sat"), in full in the readout ("Saturday"). */
export interface HeatmapLabel {
	readonly key: string;
	readonly label: string;
	readonly fullLabel: string;
}

export interface HeatmapGridProps {
	/** What the grid shows ("When you visit"): its accessible name. */
	readonly title: string;
	readonly rows: readonly HeatmapLabel[];
	readonly columns: readonly HeatmapLabel[];
	/** One row of values per row, one value per column. */
	readonly values: readonly (readonly number[])[];
	/** A cell's value as read ("5 visits"). */
	readonly formatValue: (value: number) => string;
	/** Shown in the readout until a cell is picked ("Tap a square to see its visits"). */
	readonly hint: string;
	readonly lowLabel?: string;
	readonly highLabel?: string;
	readonly color?: ChartColor;
	readonly testID?: string;
}

/** The key's steps: nothing, then every step of the ramp. */
const KEY_LEVELS: readonly number[] = [...Array<number>(CHART_RAMP_STEPS + 1).keys()];

/** A cell: its row, its column and its value. */
interface CellRef {
	readonly row: HeatmapLabel;
	readonly column: HeatmapLabel;
	readonly value: number;
}

function cellKeyOf(row: HeatmapLabel, column: HeatmapLabel): string {
	return `${row.key}:${column.key}`;
}

export function HeatmapGrid({
	title,
	rows,
	columns,
	values,
	formatValue,
	hint,
	lowLabel = "Less",
	highLabel = "More",
	color = "chart-1",
	testID,
}: HeatmapGridProps): React.JSX.Element {
	const [pickedKey, setPickedKey] = React.useState<string | null>(null);
	const max = Math.max(0, ...values.flat());
	const cells = rows.flatMap((row: HeatmapLabel, rowIndex: number): CellRef[] =>
		columns.map((column: HeatmapLabel, columnIndex: number): CellRef => ({ row, column, value: values.at(rowIndex)?.at(columnIndex) ?? 0 })),
	);
	const picked = cells.find((cell: CellRef): boolean => cellKeyOf(cell.row, cell.column) === pickedKey) ?? null;

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
						<Text className="font-sans-medium text-xs text-muted-foreground">{`${picked.row.fullLabel} · ${picked.column.fullLabel}`}</Text>
						<Text className="font-sans-semibold text-base text-foreground">{formatValue(picked.value)}</Text>
					</>
				)}
			</View>
			<View className="gap-1">
				<View className="flex-row gap-1" importantForAccessibility="no-hide-descendants">
					<View className="w-20" />
					{columns.map((column: HeatmapLabel): React.JSX.Element => (
						<Text key={column.key} className="flex-1 text-center font-sans text-xs text-muted-foreground" numberOfLines={1}>
							{column.label}
						</Text>
					))}
				</View>
				{rows.map((row: HeatmapLabel): React.JSX.Element => (
					<View key={row.key} className="flex-row items-center gap-1">
						<Text className="w-20 font-sans text-xs text-muted-foreground" importantForAccessibility="no" numberOfLines={1}>
							{row.label}
						</Text>
						{cells
							.filter((cell: CellRef): boolean => cell.row.key === row.key)
							.map((cell: CellRef): React.JSX.Element => {
								const key = cellKeyOf(cell.row, cell.column);
								return (
									<HeatCell
										key={key}
										cellKey={key}
										className={rampClassOf(color, intensityLevel(cell.value, max, CHART_RAMP_STEPS))}
										description={`${row.fullLabel}, ${cell.column.fullLabel}: ${formatValue(cell.value)}`}
										selected={key === pickedKey}
										onPick={pick}
										{...(testID === undefined ? {} : { testID: `${testID}-${row.key}-${cell.column.key}` })}
									/>
								);
							})}
					</View>
				))}
			</View>
			<View className="flex-row items-center justify-end gap-1" importantForAccessibility="no-hide-descendants">
				<Text className="mr-1 font-sans text-xs text-muted-foreground">{lowLabel}</Text>
				{KEY_LEVELS.map((level: number): React.JSX.Element => (
					<View key={level} className={`size-3 rounded-sm ${rampClassOf(color, level)}`} />
				))}
				<Text className="ml-1 font-sans text-xs text-muted-foreground">{highLabel}</Text>
			</View>
		</View>
	);
}

interface HeatCellProps {
	readonly cellKey: string;
	readonly className: string;
	readonly description: string;
	readonly selected: boolean;
	readonly onPick: (cellKey: string) => void;
	readonly testID?: string;
}

function HeatCell({ cellKey, className, description, selected, onPick, testID }: HeatCellProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(cellKey);
	}, [cellKey, onPick]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={description}
			accessibilityState={{ selected }}
			onPress={press}
			className={`h-9 flex-1 rounded-md ${className} ${selected ? "border-2 border-foreground" : ""}`}
			testID={testID}
		/>
	);
}
