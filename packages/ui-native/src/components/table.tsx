// Values in rows and columns, without borders: a quiet header, rows on
// alternating soft bands (the eye follows a row without a rule under it),
// numbers right-aligned in tabular figures so their digits line up, and an
// optional footer row (a total) set apart by weight. Each row is read by
// screen readers as one sentence — its first cell, then every other column's
// name and value — so the header is not read on its own.
//
// Presentational and generic over the column keys: the caller formats every
// cell. The web kit's `Table` / `DataTable` map onto this one component.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View } from "react-native";

import { cn } from "../lib/cn";

export type TableAlign = "start" | "end";

export interface TableColumn<TKey extends string> {
	readonly key: TKey;
	/** The header ("Spent"). */
	readonly label: string;
	/** `end` for numbers. The first column names the row and is always `start`. */
	readonly align?: TableAlign;
}

export interface TableRow<TKey extends string> {
	readonly key: string;
	readonly cells: Readonly<Record<TKey, string>>;
}

export const tableVariants = cva("gap-0.5", {
	variants: {
		/** `banded`: alternate rows on a soft band. `plain`: no bands, for short tables inside a card. */
		variant: { banded: "", plain: "" },
		size: { md: "", sm: "" },
	},
	defaultVariants: { variant: "banded", size: "md" },
});

export const tableRowVariants = cva("flex-row items-center gap-3 rounded-lg px-3", {
	variants: {
		size: { md: "min-h-9 py-2", sm: "min-h-8 py-1" },
		banded: { true: "bg-muted/60", false: "" },
	},
	defaultVariants: { size: "md", banded: false },
});

type CellTone = "header" | "body" | "footer";

export const tableCellVariants = cva("", {
	variants: {
		tone: {
			header: "font-sans-medium text-xs text-muted-foreground",
			body: "font-sans text-foreground",
			footer: "font-sans-semibold text-foreground",
		},
		size: { md: "", sm: "" },
		/** The first cell takes the room left over; the others fit their numbers. */
		position: { first: "flex-1 text-left", other: "w-24 text-left" },
		align: { start: "", end: "" },
	},
	compoundVariants: [
		{ tone: ["body", "footer"], size: "md", className: "text-sm" },
		{ tone: ["body", "footer"], size: "sm", className: "text-xs" },
		{ position: "other", align: "end", className: "text-right tabular-nums" },
	],
	defaultVariants: { tone: "body", size: "md", position: "other", align: "start" },
});

type TableVariantProps = VariantProps<typeof tableVariants>;
export type TableVariant = NonNullable<TableVariantProps["variant"]>;
export type TableSize = NonNullable<TableVariantProps["size"]>;

export interface TableProps<TKey extends string> {
	/** What the table lists ("Spending over time, per day"): its accessible name. */
	readonly caption: string;
	/** The first column names each row. */
	readonly columns: readonly TableColumn<TKey>[];
	readonly rows: readonly TableRow<TKey>[];
	/** A closing row, e.g. the total. */
	readonly footer?: TableRow<TKey>;
	readonly variant?: TableVariant;
	readonly size?: TableSize;
	/** Extra classes for the container, merged last (layout: `mt-2`). */
	readonly className?: string;
	readonly testID?: string;
}

/** "Sat, 4 Oct: Claimed 3, Redeemed 2". */
export function describeTableRow<TKey extends string>(columns: readonly TableColumn<TKey>[], row: TableRow<TKey>): string {
	const [first, ...rest] = columns;
	if (first === undefined) {
		return "";
	}
	const values = rest.map((column: TableColumn<TKey>): string => `${column.label} ${row.cells[column.key]}`);
	return values.length === 0 ? row.cells[first.key] : `${row.cells[first.key]}: ${values.join(", ")}`;
}

/** The element's ref reaches the table's container `View`. */
type TableComponent = <TKey extends string>(props: TableProps<TKey> & React.RefAttributes<View>) => React.ReactNode;

const TableBase = React.forwardRef<View, TableProps<string>>(function Table(
	{ caption, columns, rows, footer, variant = "banded", size = "md", className, testID },
	ref,
): React.JSX.Element {
	return (
		<View ref={ref} className={cn(tableVariants({ variant, size }), className)} accessibilityLabel={caption} testID={testID}>
			<View className="flex-row gap-3 px-3 pb-1" importantForAccessibility="no-hide-descendants">
				{columns.map((column: TableColumn<string>, index: number): React.JSX.Element => (
					<Cell key={column.key} text={column.label} isFirst={index === 0} align={column.align} tone="header" size={size} />
				))}
			</View>
			{rows.map((row: TableRow<string>, index: number): React.JSX.Element => (
				<Row key={row.key} columns={columns} row={row} banded={variant === "banded" ? index % 2 === 0 : false} tone="body" size={size} />
			))}
			{footer === undefined ? null : (
				<View className="pt-1">
					<Row columns={columns} row={footer} banded={false} tone="footer" size={size} />
				</View>
			)}
		</View>
	);
});

/**
 * `React.memo` and `React.forwardRef` drop a component's type parameters, so
 * the memoised table is bound to its generic signature here (a typed binding,
 * not a cast): callers keep `TKey` checking between `columns` and `rows`.
 */
export const Table: TableComponent = React.memo(TableBase);

interface RowProps {
	readonly columns: readonly TableColumn<string>[];
	readonly row: TableRow<string>;
	readonly banded: boolean;
	readonly tone: CellTone;
	readonly size: TableSize;
}

const Row = React.memo(function Row({ columns, row, banded, tone, size }: RowProps): React.JSX.Element {
	return (
		<View className={tableRowVariants({ size, banded })} accessible accessibilityLabel={describeTableRow(columns, row)}>
			{columns.map((column: TableColumn<string>, index: number): React.JSX.Element => (
				<Cell key={column.key} text={row.cells[column.key] ?? ""} isFirst={index === 0} align={column.align} tone={tone} size={size} />
			))}
		</View>
	);
});

interface CellProps {
	readonly text: string;
	readonly isFirst: boolean;
	readonly align: TableAlign | undefined;
	readonly tone: CellTone;
	readonly size: TableSize;
}

const Cell = React.memo(function Cell({ text, isFirst, align = "start", tone, size }: CellProps): React.JSX.Element {
	return (
		<Text className={tableCellVariants({ tone, size, position: isFirst ? "first" : "other", align })} numberOfLines={1}>
			{text}
		</Text>
	);
});
