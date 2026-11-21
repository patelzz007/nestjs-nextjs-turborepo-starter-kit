// Pivoting rows into a grid, shared by the web and native kits: one dimension down the side, one across the top, and
// an aggregate of a value in every cell, with totals for each row, each column and the whole. Pure: a pivot is a
// transform of the caller's data, so DataTable has no pivot prop: the caller pivots, then hands the result to the
// table as rows, columns and a footer.

/** How the values that fall into one cell are combined. */
export type DataTablePivotAggregation = "sum" | "count" | "average" | "min" | "max";

/** How to pivot: where each row goes, and what it contributes. */
export interface DataTablePivotSpec<TRow> {
	/** The key of the grid row this row falls into (e.g. the region). */
	readonly rowKey: (row: TRow) => string;
	/** The key of the grid column this row falls into (e.g. the quarter). */
	readonly columnKey: (row: TRow) => string;
	/** The number this row contributes. Ignored by `count`. */
	readonly value: (row: TRow) => number;
	readonly aggregation: DataTablePivotAggregation;
}

/** The pivoted grid. Keys come in the order they were first seen. A cell with no rows has no value (`null`). */
export interface DataTablePivot {
	readonly rowKeys: readonly string[];
	readonly columnKeys: readonly string[];
	/** The aggregate of one cell, or `null` when no row fell into it. */
	readonly cell: (rowKey: string, columnKey: string) => number | null;
	/** The aggregate of a whole grid row (all its columns), over the source rows, not over the cells. */
	readonly rowTotal: (rowKey: string) => number | null;
	/** The aggregate of a whole grid column. */
	readonly columnTotal: (columnKey: string) => number | null;
	/** The aggregate of every row. */
	readonly grandTotal: number | null;
}

/** The values one cell (or total) collects before they are combined. */
type Bucket = number[];

const CELL_KEY_SEPARATOR = "\u0000";

/** Combines a cell's values. An average of averages would be wrong, so totals are combined from the source values. */
export function aggregateDataTablePivotValues(values: readonly number[], aggregation: DataTablePivotAggregation): number | null {
	if (values.length === 0) {
		return null;
	}
	switch (aggregation) {
		case "count":
			return values.length;
		case "sum":
			return values.reduce((total, value) => total + value, 0);
		case "average":
			return values.reduce((total, value) => total + value, 0) / values.length;
		case "min":
			return Math.min(...values);
		case "max":
			return Math.max(...values);
	}
}

function pushInto(buckets: Map<string, Bucket>, key: string, value: number): void {
	const bucket = buckets.get(key);
	if (bucket === undefined) {
		buckets.set(key, [value]);
	} else {
		bucket.push(value);
	}
}

/** Pivots `rows` by `spec`. */
export function pivotDataTableRows<TRow>(rows: readonly TRow[], spec: DataTablePivotSpec<TRow>): DataTablePivot {
	const rowKeys = new Set<string>();
	const columnKeys = new Set<string>();
	const cells = new Map<string, Bucket>();
	const rowTotals = new Map<string, Bucket>();
	const columnTotals = new Map<string, Bucket>();
	const all: Bucket = [];

	for (const row of rows) {
		const rowKey = spec.rowKey(row);
		const columnKey = spec.columnKey(row);
		const value = spec.value(row);
		rowKeys.add(rowKey);
		columnKeys.add(columnKey);
		pushInto(cells, `${rowKey}${CELL_KEY_SEPARATOR}${columnKey}`, value);
		pushInto(rowTotals, rowKey, value);
		pushInto(columnTotals, columnKey, value);
		all.push(value);
	}

	const combine = (values: Bucket | undefined): number | null => aggregateDataTablePivotValues(values ?? [], spec.aggregation);
	return {
		rowKeys: [...rowKeys],
		columnKeys: [...columnKeys],
		cell: (rowKey: string, columnKey: string): number | null => combine(cells.get(`${rowKey}${CELL_KEY_SEPARATOR}${columnKey}`)),
		rowTotal: (rowKey: string): number | null => combine(rowTotals.get(rowKey)),
		columnTotal: (columnKey: string): number | null => combine(columnTotals.get(columnKey)),
		grandTotal: combine(all),
	};
}
