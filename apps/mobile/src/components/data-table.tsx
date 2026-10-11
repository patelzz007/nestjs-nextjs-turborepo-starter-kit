// Values in rows and columns, without borders: a quiet header, rows on
// alternating soft bands (the eye follows a row without a rule under it),
// numbers right-aligned in tabular figures so their digits line up, and an
// optional footer row (a total) set apart by weight. Each row is read by
// screen readers as one sentence — its first cell, then every other column's
// name and value — so the header is not read on its own.
//
// Presentational and generic over the column keys: the caller formats every
// cell.

import * as React from "react";
import { Text, View } from "react-native";

export type DataTableAlign = "start" | "end";

export interface DataTableColumn<TKey extends string> {
	readonly key: TKey;
	/** The header ("Spent"). */
	readonly label: string;
	/** `end` for numbers. The first column names the row and is always `start`. */
	readonly align?: DataTableAlign;
}

export interface DataTableRow<TKey extends string> {
	readonly key: string;
	readonly cells: Readonly<Record<TKey, string>>;
}

export interface DataTableProps<TKey extends string> {
	/** What the table lists ("Spending over time, per day"): its accessible name. */
	readonly caption: string;
	/** The first column names each row. */
	readonly columns: readonly DataTableColumn<TKey>[];
	readonly rows: readonly DataTableRow<TKey>[];
	/** A closing row, e.g. the total. */
	readonly footer?: DataTableRow<TKey>;
	readonly testID?: string;
}

/** "Sat, 4 Oct: Claimed 3, Redeemed 2". */
export function describeRow<TKey extends string>(columns: readonly DataTableColumn<TKey>[], row: DataTableRow<TKey>): string {
	const [first, ...rest] = columns;
	if (first === undefined) {
		return "";
	}
	const values = rest.map((column: DataTableColumn<TKey>): string => `${column.label} ${row.cells[column.key]}`);
	return values.length === 0 ? row.cells[first.key] : `${row.cells[first.key]}: ${values.join(", ")}`;
}

export function DataTable<TKey extends string>({ caption, columns, rows, footer, testID }: DataTableProps<TKey>): React.JSX.Element {
	return (
		<View className="gap-0.5" accessibilityLabel={caption} testID={testID}>
			<View className="flex-row gap-3 px-3 pb-1" importantForAccessibility="no-hide-descendants">
				{columns.map((column: DataTableColumn<TKey>, index: number): React.JSX.Element => (
					<Cell key={column.key} text={column.label} isFirst={index === 0} align={column.align} tone="header" />
				))}
			</View>
			{rows.map((row: DataTableRow<TKey>, index: number): React.JSX.Element => (
				<Row key={row.key} columns={columns} row={row} banded={index % 2 === 0} tone="body" />
			))}
			{footer === undefined ? null : (
				<View className="pt-1">
					<Row columns={columns} row={footer} banded={false} tone="footer" />
				</View>
			)}
		</View>
	);
}

type CellTone = "header" | "body" | "footer";

const TONE_CLASSES: Readonly<Record<CellTone, string>> = {
	header: "font-sans-medium text-xs text-muted-foreground",
	body: "font-sans text-sm text-foreground",
	footer: "font-sans-semibold text-sm text-foreground",
};

interface RowProps<TKey extends string> {
	readonly columns: readonly DataTableColumn<TKey>[];
	readonly row: DataTableRow<TKey>;
	readonly banded: boolean;
	readonly tone: CellTone;
}

function Row<TKey extends string>({ columns, row, banded, tone }: RowProps<TKey>): React.JSX.Element {
	return (
		<View className={`min-h-9 flex-row items-center gap-3 rounded-lg px-3 py-2 ${banded ? "bg-muted/60" : ""}`} accessible accessibilityLabel={describeRow(columns, row)}>
			{columns.map((column: DataTableColumn<TKey>, index: number): React.JSX.Element => (
				<Cell key={column.key} text={row.cells[column.key]} isFirst={index === 0} align={column.align} tone={tone} />
			))}
		</View>
	);
}

interface CellProps {
	readonly text: string;
	readonly isFirst: boolean;
	readonly align: DataTableAlign | undefined;
	readonly tone: CellTone;
}

/** The first cell takes the room left over; the others fit their numbers. */
function Cell({ text, isFirst, align, tone }: CellProps): React.JSX.Element {
	const alignClass = !isFirst && align === "end" ? "text-right tabular-nums" : "text-left";
	return (
		<Text className={`${isFirst ? "flex-1" : "w-24"} ${alignClass} ${TONE_CLASSES[tone]}`} numberOfLines={1}>
			{text}
		</Text>
	);
}
