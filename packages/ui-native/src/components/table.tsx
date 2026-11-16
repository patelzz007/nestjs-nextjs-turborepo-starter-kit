// Values in rows and columns, without borders: a quiet header, rows on
// alternating soft bands (the eye follows a row without a rule under it),
// numbers right-aligned in tabular figures so their digits line up, and an
// optional footer row (a total) set apart by weight. Each row is read by
// screen readers as one sentence — its first cell, then every other column's
// name and value — so the header is not read on its own.
//
// A cell can be drawn as anything (`content`: an avatar and a name, a badge,
// a menu) while its text stays what screen readers hear; a row holding
// controls (`interactive`) is read cell by cell so each control is reachable.
// Columns take a width; a wide table scrolls sideways (`scrollable`); the
// caption can show under the rows (`showCaption`).
//
// Presentational and generic over the column keys: the caller formats every
// cell. The web kit's `Table` / `DataTable` map onto this one component.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ScrollView, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

export type TableAlign = "start" | "end";
/** A column's width after the first: `sm` (the default) fits a number; the first column takes the room left. */
export type TableColumnWidth = "xs" | "sm" | "md" | "lg";

export interface TableColumn<TKey extends string> {
	readonly key: TKey;
	/** The header ("Spent"). */
	readonly label: string;
	/** `end` for numbers. The first column names the row and is always `start`. */
	readonly align?: TableAlign;
	/** How wide the column is (not the first). Default `sm`. */
	readonly width?: TableColumnWidth | undefined;
}

export interface TableRow<TKey extends string> {
	readonly key: string;
	/** Every cell as text: what screen readers hear, and what is drawn where `content` has nothing. */
	readonly cells: Readonly<Record<TKey, string>>;
	/** Cells drawn as anything (an avatar and a name, a badge, a menu) in place of their text. */
	readonly content?: Partial<Readonly<Record<TKey, React.ReactNode>>> | undefined;
	/** The row holds controls (an input, a menu): its cells are read one by one, so each control stays reachable. */
	readonly interactive?: boolean | undefined;
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
			header: "font-sans-medium text-caption text-muted-foreground",
			body: "font-sans text-foreground",
			footer: "font-sans-semibold text-foreground",
		},
		size: { md: "", sm: "" },
		/** The first cell takes the room left over (a fixed column when the table scrolls); the others take their width. */
		position: { first: "flex-1 text-left", fixed: "w-40 text-left", other: "text-left" },
		width: { xs: "", sm: "", md: "", lg: "" },
		align: { start: "", end: "" },
	},
	compoundVariants: [
		{ tone: ["body", "footer"], size: "md", className: "text-body" },
		{ tone: ["body", "footer"], size: "sm", className: "text-caption" },
		{ position: "other", align: "end", className: "text-right tabular-nums" },
		{ position: "other", width: "xs", className: "w-16" },
		{ position: "other", width: "sm", className: "w-24" },
		{ position: "other", width: "md", className: "w-32" },
		{ position: "other", width: "lg", className: "w-40" },
	],
	defaultVariants: { tone: "body", size: "md", position: "other", align: "start", width: "sm" },
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
	/** Shows the caption under the rows, as well as naming the table. */
	readonly showCaption?: boolean | undefined;
	/** A wide table scrolls sideways; its first column then takes a fixed width. */
	readonly scrollable?: boolean | undefined;
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
type TableComponent = <TKey extends string>(props: TableProps<TKey> & React.RefAttributes<ViewInstance>) => React.ReactNode;

const TableBase = React.forwardRef<ViewInstance, TableProps<string>>(function Table(
	{ caption, columns, rows, footer, showCaption = false, scrollable = false, variant = "banded", size = "md", className, testID },
	ref,
): React.JSX.Element {
	const body = (
		<View className={tableVariants({ variant, size })}>
			<View className="flex-row gap-3 px-3 pb-1" importantForAccessibility="no-hide-descendants">
				{columns.map((column: TableColumn<string>, index: number): React.JSX.Element => (
					<Cell key={column.key} text={column.label} first={index === 0} fixedFirst={scrollable} column={column} tone="header" size={size} />
				))}
			</View>
			{rows.map((row: TableRow<string>, index: number): React.JSX.Element => (
				<Row key={row.key} columns={columns} row={row} banded={variant === "banded" ? index % 2 === 0 : false} fixedFirst={scrollable} tone="body" size={size} />
			))}
			{footer === undefined ? null : (
				<View className="pt-1">
					<Row columns={columns} row={footer} banded={false} fixedFirst={scrollable} tone="footer" size={size} />
				</View>
			)}
		</View>
	);
	return (
		<View ref={ref} className={cn("gap-2", className)} accessibilityLabel={caption} testID={testID}>
			{scrollable ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID === undefined ? undefined : `${testID}-scroll`}>
					{body}
				</ScrollView>
			) : (
				body
			)}
			{showCaption ? (
				<Text importantForAccessibility="no" className="text-caption text-center font-sans text-muted-foreground">
					{caption}
				</Text>
			) : null}
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
	readonly fixedFirst: boolean;
	readonly tone: CellTone;
	readonly size: TableSize;
}

const Row = React.memo(function Row({ columns, row, banded, fixedFirst, tone, size }: RowProps): React.JSX.Element {
	const interactive = row.interactive === true;
	return (
		<View className={tableRowVariants({ size, banded })} accessible={!interactive} accessibilityLabel={interactive ? undefined : describeTableRow(columns, row)}>
			{columns.map((column: TableColumn<string>, index: number): React.JSX.Element => {
				const node = row.content?.[column.key];
				return node === undefined ? (
					<Cell key={column.key} text={row.cells[column.key] ?? ""} first={index === 0} fixedFirst={fixedFirst} column={column} tone={tone} size={size} />
				) : (
					<View key={column.key} className={tableCellVariants({ tone, size, position: cellPositionOf(index === 0, fixedFirst), align: column.align, width: column.width })}>
						{node}
					</View>
				);
			})}
		</View>
	);
});

/** Where a cell sits: the first column flexes, or takes a fixed width when the table scrolls. */
function cellPositionOf(first: boolean, fixedFirst: boolean): "first" | "fixed" | "other" {
	if (!first) {
		return "other";
	}
	return fixedFirst ? "fixed" : "first";
}

interface CellProps {
	readonly text: string;
	readonly first: boolean;
	readonly fixedFirst: boolean;
	readonly column: TableColumn<string>;
	readonly tone: CellTone;
	readonly size: TableSize;
}

const Cell = React.memo(function Cell({ text, first, fixedFirst, column, tone, size }: CellProps): React.JSX.Element {
	return (
		<Text className={tableCellVariants({ tone, size, position: cellPositionOf(first, fixedFirst), align: column.align ?? "start", width: column.width })} numberOfLines={1}>
			{text}
		</Text>
	);
});
