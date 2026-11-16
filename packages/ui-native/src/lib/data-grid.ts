// The native data grid's own rules, beside the ones it shares with the web (@workspace/ui-kit-logic `data-grid`: its copy
// and its clipboard text): the TanStack feature bundle every grid's table is built on, the per-column `meta` the grid
// reads, the layout flags and their defaults, a column's name, and the pure geometry and spreadsheet maths the
// component uses (moving a column, a drag's drop slot, clamping a size, the window of columns on screen, the cells a
// paste, fill, clear or edit writes, and a selection as clipboard text).
//
// The grid never writes data: every change reaches the caller as a list of cell changes it applies to its own rows.

import { formatMessage, isBigIntPrimitive, isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import { buildDataGridLabels, DATA_GRID_MESSAGES_EN, serializeDataGridClipboardText, type DataGridLabels } from "@workspace/ui-kit-logic";
import {
	cellSelectionFeature,
	columnFacetingFeature,
	columnFilteringFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnResizingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createExpandedRowModel,
	createFacetedRowModel,
	createFacetedUniqueValues,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	globalFilteringFeature,
	metaHelper,
	rowExpandingFeature,
	rowPaginationFeature,
	rowPinningFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_alphanumericCaseSensitive,
	sortFn_basic,
	sortFn_datetime,
	sortFn_text,
	sortFn_textCaseSensitive,
	tableFeatures,
	type CellData,
	type CellSelectionBounds,
	type Column,
	type ReactTable,
	type Row,
	type RowData,
	type Table,
} from "@tanstack/react-table";
import type * as React from "react";

/** The shared copy, plus the words of the phone's own controls (the web copies and pastes with keys and a context menu). */
export interface NativeDataGridLabels extends DataGridLabels {
	readonly copyCells: string;
	readonly pasteCells: string;
	readonly fillDown: string;
	readonly fillRight: string;
	readonly clearCells: string;
	/** The selection bar's "Clear" (the shared `selectionBarClear`), as screen readers hear it. */
	readonly clearSelection: string;
	readonly editCell: string;
	readonly save: string;
	readonly cancel: string;
	/** What a long press on a cell does, for screen readers. */
	readonly extendSelectionHint: string;
	/** The header menu's name for a column ("Name column options"). */
	readonly columnOptions: (title: string) => string;
	readonly unpinColumnShort: string;
}

export const DEFAULT_DATA_GRID_LABELS: NativeDataGridLabels = {
	...buildDataGridLabels(DATA_GRID_MESSAGES_EN, (message, values): string => formatMessage("en", message, values)),
	copyCells: "Copy",
	pasteCells: "Paste",
	fillDown: "Fill down",
	fillRight: "Fill right",
	clearCells: "Clear values",
	clearSelection: "Clear selection",
	editCell: "Edit",
	save: "Save",
	cancel: "Cancel",
	extendSelectionHint: "Long press to select up to here",
	columnOptions: (title: string): string => `${title} column options`,
	unpinColumnShort: "Unpin",
};

// ── Bivariant row callbacks ─────────────────────────────────────────────────
// Column `meta` is one type for every table on `dataGridFeatures`, so a callback in it cannot name the caller's row
// type. A method signature (React's own `bivarianceHack`) lets a column typed for its rows supply `(row: Person) => …`,
// checked by the compiler, not cast. The grid always calls it with `row.original`.

/** Draws something for a row (an expanded row's detail). */
export type DataGridRowRenderer = { bivarianceHack(row: RowData): React.ReactNode }["bivarianceHack"];
/** A yes or no for a row (whether its cell can be written). */
export type DataGridRowPredicate = { bivarianceHack(row: RowData): boolean }["bivarianceHack"];
/** Clipboard, fill or editor text → the column's typed value; `undefined` refuses the cell. */
export type DataGridCellParser = { bivarianceHack(raw: string, row: RowData): CellData }["bivarianceHack"];
/** A column's typed value → clipboard or editor text. */
export type DataGridCellFormatter = { bivarianceHack(value: CellData, row: RowData): string }["bivarianceHack"];

/** The keyboard a cell's built-in editor opens with. */
export type DataGridCellEditorControl = "text" | "number";

/** A column the spreadsheet operations (paste, fill, clear, edit) may write. Every write still goes to `onCellsChange`. */
export interface DataGridColumnCellEdit {
	/** `false` for a column that is copied but never written; a predicate decides per row. Default `true`. */
	readonly editable?: boolean | DataGridRowPredicate | undefined;
	/** Text → typed value; `undefined` refuses the cell. Without it the text passes through as it is. */
	readonly parse?: DataGridCellParser | undefined;
	/** Typed value → text. Default: the value as text. */
	readonly format?: DataGridCellFormatter | undefined;
	/** What Clear writes. Default `null`. */
	readonly clearValue?: CellData;
	/** The built-in editor's keyboard. Default `text`. */
	readonly control?: DataGridCellEditorControl | undefined;
}

/** Where a column's header and cells sit. */
export type DataGridAlign = "start" | "center" | "end";

/** Per-column extras the grid reads off `columnDef.meta`. */
export interface DataGridColumnMeta {
	/** The column's name in menus, the column list and the editor (when `header` is not plain text). */
	readonly headerTitle?: string | undefined;
	readonly align?: DataGridAlign | undefined;
	/** Drawn in this column's cells while the grid loads with `loadingMode="skeleton"`. */
	readonly skeleton?: React.ReactNode;
	/** A row's detail, drawn under it across the grid while the row is expanded. */
	readonly expandedContent?: DataGridRowRenderer | undefined;
	readonly cellEdit?: DataGridColumnCellEdit | undefined;
	/** Takes the grid's spare width (one column per grid). */
	readonly autoSize?: boolean | undefined;
}

// ── The feature bundle ─────────────────────────────────────────────────────

/**
 * The features every grid's table declares (`useTable({ features: dataGridFeatures, … })`), the web's set. Column
 * resizing is declared for its options and state (`enableResizing`, `column.getCanResize()`); its drag handler reads DOM
 * pointer events, so the native grid drags its own handle and writes `columnSizing`.
 */
export const dataGridFeatures = tableFeatures({
	columnVisibilityFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnSizingFeature,
	columnResizingFeature,
	columnFilteringFeature,
	columnFacetingFeature,
	globalFilteringFeature,
	rowSortingFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowExpandingFeature,
	rowPinningFeature,
	cellSelectionFeature,
	sortedRowModel: createSortedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	expandedRowModel: createExpandedRowModel(),
	facetedRowModel: createFacetedRowModel(),
	facetedUniqueValues: createFacetedUniqueValues(),
	// Every built-in: a string `sortFn` and `"auto"` resolve against this map alone.
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive,
		basic: sortFn_basic,
		datetime: sortFn_datetime,
		text: sortFn_text,
		textCaseSensitive: sortFn_textCaseSensitive,
	},
	columnMeta: metaHelper<DataGridColumnMeta>(),
});

export type DataGridFeatures = typeof dataGridFeatures;
/** A `useTable` result over `dataGridFeatures`: what `DataGrid` takes. */
export type DataGridTableInstance<TData extends RowData> = ReactTable<DataGridFeatures, TData>;
/** The core table a row, a header or a column hands out. */
export type DataGridCoreTable<TData extends RowData> = Table<DataGridFeatures, TData>;
export type DataGridColumn<TData extends RowData> = Column<DataGridFeatures, TData>;
export type DataGridRow<TData extends RowData> = Row<DataGridFeatures, TData>;

// ── Layout ─────────────────────────────────────────────────────────────────

/** How the grid looks and what it lets people do. Every flag is optional. */
export interface DataGridTableLayout {
	/** Shorter rows and tighter cells. */
	readonly dense?: boolean | undefined;
	/** Lines between columns as well as rows. */
	readonly cellBorder?: boolean | undefined;
	/** Lines between rows. Default `true`. */
	readonly rowBorder?: boolean | undefined;
	/** Rounded row ends (with `stripped` or a row background). */
	readonly rowRounded?: boolean | undefined;
	/** Every other row shaded. */
	readonly stripped?: boolean | undefined;
	readonly headerBackground?: boolean | undefined;
	readonly footerBackground?: boolean | undefined;
	/** A line under the header. Default `true`. */
	readonly headerBorder?: boolean | undefined;
	/** The header stays while the rows scroll (with a height). */
	readonly headerSticky?: boolean | undefined;
	/** `fixed`: each column its size, the grid scrolls sideways. `auto`: columns share the width by their sizes. */
	readonly width?: "fixed" | "auto" | undefined;
	/** The header menu lists the columns to show or hide. */
	readonly columnsVisibility?: boolean | undefined;
	/** A handle on each header's end drags its width; screen readers step it. */
	readonly columnsResizable?: boolean | undefined;
	/** The header menu pins a column to either edge. */
	readonly columnsPinnable?: boolean | undefined;
	/** The header menu moves a column one place either way. */
	readonly columnsMovable?: boolean | undefined;
	/** A grip on each header drags the column to a new place. */
	readonly columnsDraggable?: boolean | undefined;
	/** Rows drag by a handle to a new place. */
	readonly rowsDraggable?: boolean | undefined;
	/** Pinned rows stay above the rest. */
	readonly rowsPinnable?: boolean | undefined;
	/** Cells can be selected: a tap picks one, a tap in range mode picks a block, with copy, paste, fill, clear and edit. */
	readonly cellSelection?: boolean | undefined;
}

export type DataGridResolvedTableLayout = { readonly [Key in keyof DataGridTableLayout]-?: NonNullable<DataGridTableLayout[Key]> };

export const DEFAULT_DATA_GRID_LAYOUT: DataGridResolvedTableLayout = {
	dense: false,
	cellBorder: false,
	rowBorder: true,
	rowRounded: false,
	stripped: false,
	headerBackground: false,
	footerBackground: false,
	headerBorder: true,
	headerSticky: false,
	width: "fixed",
	columnsVisibility: false,
	columnsResizable: false,
	columnsPinnable: false,
	columnsMovable: false,
	columnsDraggable: false,
	rowsDraggable: false,
	rowsPinnable: false,
	cellSelection: false,
};

/** Every flag with its value: the caller's, else the default. */
export function resolveDataGridLayout(layout: DataGridTableLayout = {}): DataGridResolvedTableLayout {
	const fallback = DEFAULT_DATA_GRID_LAYOUT;
	return {
		dense: layout.dense ?? fallback.dense,
		cellBorder: layout.cellBorder ?? fallback.cellBorder,
		rowBorder: layout.rowBorder ?? fallback.rowBorder,
		rowRounded: layout.rowRounded ?? fallback.rowRounded,
		stripped: layout.stripped ?? fallback.stripped,
		headerBackground: layout.headerBackground ?? fallback.headerBackground,
		footerBackground: layout.footerBackground ?? fallback.footerBackground,
		headerBorder: layout.headerBorder ?? fallback.headerBorder,
		headerSticky: layout.headerSticky ?? fallback.headerSticky,
		width: layout.width ?? fallback.width,
		columnsVisibility: layout.columnsVisibility ?? fallback.columnsVisibility,
		columnsResizable: layout.columnsResizable ?? fallback.columnsResizable,
		columnsPinnable: layout.columnsPinnable ?? fallback.columnsPinnable,
		columnsMovable: layout.columnsMovable ?? fallback.columnsMovable,
		columnsDraggable: layout.columnsDraggable ?? fallback.columnsDraggable,
		rowsDraggable: layout.rowsDraggable ?? fallback.rowsDraggable,
		rowsPinnable: layout.rowsPinnable ?? fallback.rowsPinnable,
		cellSelection: layout.cellSelection ?? fallback.cellSelection,
	};
}

/** A column's name: `meta.headerTitle`, a plain-text `header`, else its id. */
export function dataGridColumnLabel<TData extends RowData>(column: DataGridColumn<TData>): string {
	const title = column.columnDef.meta?.headerTitle;
	if (title !== undefined) {
		return title;
	}
	const header = column.columnDef.header;
	return isStringPrimitive(header) ? header : column.id;
}

/**
 * Whether a column draws its cells with TanStack's own default (the value as a bare string, which a View cannot hold):
 * it gave no `cell`, and the table no `defaultColumn.cell`. The grid then draws the value as text itself.
 */
export function usesDefaultDataGridCell<TData extends RowData>(column: DataGridColumn<TData>): boolean {
	const { table } = column;
	return table.options.defaultColumn?.cell === undefined && column.columnDef.cell === table.getDefaultColumnDef().cell;
}

/** The same for a header: TanStack's default names the column by a bare string. */
export function usesDefaultDataGridHeader<TData extends RowData>(column: DataGridColumn<TData>): boolean {
	const { table } = column;
	return table.options.defaultColumn?.header === undefined && column.columnDef.header === table.getDefaultColumnDef().header;
}

/** The columns in the order they are drawn: pinned at the start, the rest, pinned at the end. */
export function dataGridDisplayColumns<TData extends RowData>(table: DataGridCoreTable<TData>): readonly DataGridColumn<TData>[] {
	return [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getEndVisibleLeafColumns()];
}

// ── Geometry ───────────────────────────────────────────────────────────────

/** `order` with `id` moved `delta` places (clamped at either end); the same order when `id` is not in it. */
export function moveDataGridColumn(order: readonly string[], id: string, delta: number): readonly string[] {
	const from = order.indexOf(id);
	if (from < 0) {
		return order;
	}
	const to = Math.min(order.length - 1, Math.max(0, from + delta));
	const next = order.filter((candidate): boolean => candidate !== id);
	next.splice(to, 0, id);
	return next;
}

/**
 * Where a column dragged `dx` points from slot `from` lands: it passes a neighbour once it has crossed half of that
 * neighbour's width. `widths` are the slots' widths in order.
 */
export function dataGridDropIndex(widths: readonly number[], from: number, dx: number): number {
	const half = 2;
	let index = from;
	let remaining = Math.abs(dx);
	const step = dx > 0 ? 1 : -1;
	const neighbours = dx > 0 ? widths.slice(from + 1) : widths.slice(0, from).reverse();
	for (const width of neighbours) {
		if (remaining <= width / half) {
			break;
		}
		remaining -= width;
		index += step;
	}
	return index;
}

/**
 * The column order after moving `columnId` `steps` places among the scrolling (unpinned, shown) columns: it lands where
 * the column `steps` away was, in the table's full order (hidden and pinned columns keep their places). `null` when it
 * does not move (not a scrolling column, or already at that edge).
 */
export function dataGridMovedColumnOrder<TData extends RowData>(table: DataGridCoreTable<TData>, columnId: string, steps: number): readonly string[] | null {
	const center = table.getCenterVisibleLeafColumns();
	const from = center.findIndex((column): boolean => column.id === columnId);
	const target = center.at(Math.min(center.length - 1, Math.max(0, from + steps)));
	if (from < 0 || target === undefined || target.id === columnId) {
		return null;
	}
	const stored = table.atoms.columnOrder.get();
	const order = [
		...stored,
		...table
			.getAllLeafColumns()
			.map((column): string => column.id)
			.filter((id: string): boolean => !stored.includes(id)),
	];
	return moveDataGridColumn(order, columnId, order.indexOf(target.id) - order.indexOf(columnId));
}

/** A width kept within a column's bounds, rounded to a whole point. */
export function clampDataGridColumnSize(size: number, min: number, max: number): number {
	return Math.round(Math.min(max, Math.max(min, size)));
}

/** The columns a sideways scroll shows (`start` … `end`, inclusive), and the widths left out before and after. */
export interface DataGridColumnWindow {
	readonly start: number;
	readonly end: number;
	readonly before: number;
	readonly after: number;
}

/**
 * The columns inside the viewport at `offset`, with `overscan` more either side, for drawing only those: `widths` are
 * the scrolling columns' widths in order. No columns: an empty window (`end` below `start`).
 */
export function dataGridColumnWindow(widths: readonly number[], offset: number, viewport: number, overscan: number): DataGridColumnWindow {
	let start = -1;
	let end = -1;
	let left = 0;
	widths.forEach((width: number, index: number): void => {
		const right = left + width;
		if (start < 0 && right > offset) {
			start = index;
		}
		if (left < offset + viewport) {
			end = index;
		}
		left = right;
	});
	if (widths.length === 0) {
		return { start: 0, end: -1, before: 0, after: 0 };
	}
	const first = Math.max(0, (start < 0 ? widths.length - 1 : start) - overscan);
	const last = Math.min(widths.length - 1, Math.max(first, end) + overscan);
	const sum = (from: number, to: number): number => widths.slice(from, to).reduce((total: number, width: number): number => total + width, 0);
	return { start: first, end: last, before: sum(0, first), after: sum(last + 1, widths.length) };
}

// ── Spreadsheet ────────────────────────────────────────────────────────────

/** Which operation produced a batch of cell changes. */
export type DataGridCellsChangeSource = "paste" | "fill" | "clear" | "edit";

/** One cell to write: the row (so writing back needs no lookup), the column, the value before and the new one. */
export interface DataGridCellChange<TData> {
	readonly rowId: string;
	readonly columnId: string;
	readonly row: TData;
	readonly previousValue: CellData;
	readonly value: CellData;
}

/** What the grid asks the caller to write: the changes, and the cells it refused (not writable, or not parsed). */
export interface DataGridCellsChangeDetails<TData> {
	readonly source: DataGridCellsChangeSource;
	readonly changes: readonly DataGridCellChange<TData>[];
	readonly rejected: readonly { readonly rowId: string; readonly columnId: string }[];
}

/** What a copy produced: the selection as TSV, and its size. */
export interface DataGridCopyDetails {
	readonly text: string;
	readonly rowCount: number;
	readonly columnCount: number;
}

/** A value as text: scalars as they read, dates as ISO instants, nothing as empty, anything else as JSON. */
export function dataGridValueText(value: CellData): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (isStringPrimitive(value) || isNumberPrimitive(value) || isBooleanPrimitive(value) || isBigIntPrimitive(value)) {
		return String(value);
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	return JSON.stringify(value);
}

/** Whether `column` takes writes for `row`: it has `meta.cellEdit`, and its `editable` allows the row. */
export function isDataGridCellWritable<TData extends RowData>(column: DataGridColumn<TData>, row: DataGridRow<TData>): boolean {
	const edit = column.columnDef.meta?.cellEdit;
	if (edit === undefined) {
		return false;
	}
	const { editable = true } = edit;
	return editable === true || (editable !== false && editable(row.original));
}

/** A cell's value as its column formats it. */
export function dataGridCellText<TData extends RowData>(column: DataGridColumn<TData>, row: DataGridRow<TData>): string {
	const value = row.getValue<CellData>(column.id);
	const format = column.columnDef.meta?.cellEdit?.format;
	return format === undefined ? dataGridValueText(value) : format(value, row.original);
}

/** The rows and columns inside one selection rectangle, in the order they are drawn. */
export function dataGridBoundsCells<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	bounds: CellSelectionBounds,
): { readonly rows: readonly DataGridRow<TData>[]; readonly columns: readonly DataGridColumn<TData>[] } {
	return {
		rows: table.getRowsInDisplayOrder().slice(bounds.minRowIndex, bounds.maxRowIndex + 1),
		columns: dataGridDisplayColumns(table).slice(bounds.minColumnIndex, bounds.maxColumnIndex + 1),
	};
}

/** A selection rectangle as clipboard text (TSV), each cell as its column formats it. */
export function dataGridCopyDetails<TData extends RowData>(table: DataGridCoreTable<TData>, bounds: CellSelectionBounds): DataGridCopyDetails {
	const { rows, columns } = dataGridBoundsCells(table, bounds);
	const grid = rows.map((row): string[] => columns.map((column): string => dataGridCellText(column, row)));
	return { text: serializeDataGridClipboardText(grid), rowCount: rows.length, columnCount: columns.length };
}

/**
 * The writes that put `grid` (rows of text, already tiled to the rectangle's size) into a selection rectangle, each
 * parsed by its column: unwritable cells and values the column refuses are listed as rejected. `clear` writes each
 * column's clear value instead of parsing.
 */
export function dataGridCellsChange<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	bounds: CellSelectionBounds,
	grid: readonly (readonly string[])[],
	source: DataGridCellsChangeSource,
): DataGridCellsChangeDetails<TData> {
	const { rows, columns } = dataGridBoundsCells(table, bounds);
	const changes: DataGridCellChange<TData>[] = [];
	const rejected: { readonly rowId: string; readonly columnId: string }[] = [];
	rows.forEach((row, rowOffset: number): void => {
		columns.forEach((column, columnOffset: number): void => {
			const edit = column.columnDef.meta?.cellEdit;
			const cell = { rowId: row.id, columnId: column.id };
			if (edit === undefined || !isDataGridCellWritable(column, row)) {
				rejected.push(cell);
				return;
			}
			const raw = grid.at(rowOffset)?.at(columnOffset) ?? "";
			const value = source === "clear" ? (edit.clearValue ?? null) : edit.parse === undefined ? raw : edit.parse(raw, row.original);
			if (value === undefined) {
				rejected.push(cell);
				return;
			}
			changes.push({ ...cell, row: row.original, previousValue: row.getValue<CellData>(column.id), value });
		});
	});
	return { source, changes, rejected };
}
