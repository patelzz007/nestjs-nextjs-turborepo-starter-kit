// Spreadsheet's public props. A spreadsheet is a grid of CELLS (ranges, clipboard, fill, in-place editing); a list of
// records with a toolbar, filters and a pager is `DataTable`. Re-exported by components/spreadsheet.tsx.

import type { ColumnDef, RowData } from "@tanstack/react-table";
import type { DataTableDensity, TableEngineLabels } from "@workspace/ui-kit-logic";
import type * as React from "react";

import type {
	TableEngineCellEditRequest,
	TableEngineCellSelectionSnapshot,
	TableEngineCellStatus,
	TableEngineCellsChangeDetails,
	TableEngineCopyDetails,
	TableEngineFeatures,
	TableEngineRowStatus,
} from "../table-engine/table-engine";
import type { TableEngineCellSelectionApi } from "./cell-selection-model";

/** The TanStack feature set a `Spreadsheet` is built on. Type columns as `ColumnDef<SpreadsheetFeatures, Row>`. */
export type SpreadsheetFeatures = TableEngineFeatures;

/** A spreadsheet's column definitions. A column is writable when it declares `meta: { cellEdit: { … } }`. */
export type SpreadsheetColumns<TData extends RowData> = ColumnDef<SpreadsheetFeatures, TData>[];

/** One batch of cell writes: a paste, a cut, a clear, a fill or an edit, however many cells it spans. */
export type SpreadsheetCellsChange<TData> = TableEngineCellsChangeDetails<TData>;

/** A request to open your own editor for a writable cell that has no built-in one. */
export type SpreadsheetCellEditRequest<TData> = TableEngineCellEditRequest<TData>;

/** The current selection: the focused cell, every selected region and how many cells it covers. */
export type SpreadsheetSelection = TableEngineCellSelectionSnapshot;

/** What reached the clipboard after a copy or a cut. */
export type SpreadsheetCopy = TableEngineCopyDetails;

/** "new" and "dirty" tint a row, "deleted" mutes and strikes it. */
export type SpreadsheetRowStatus = TableEngineRowStatus;

/** A corner mark on a cell: "dirty" for an unsaved edit, "invalid" for a value that was refused. */
export type SpreadsheetCellStatus = TableEngineCellStatus;

/** What `ref` exposes: move the focus to a cell, clear the selection, scroll a cell into view. */
export type SpreadsheetApi = TableEngineCellSelectionApi;

/** Reads a row's stable id. Declared through a method signature so a row-typed function type-checks with no cast. */
export type SpreadsheetRowIdReader<TData> = { bivarianceHack(row: TData): string }["bivarianceHack"];

export interface SpreadsheetFillHandle {
	/** The handle's look: a dot inside the selection's corner, a ring riding it, or a square. */
	readonly variant?: "dot" | "ring" | "square";
}

export interface SpreadsheetEditing {
	/** What opens the editor with a pointer. Enter, F2 and typing always do. */
	readonly trigger?: "double-click" | "click";
	/** Enter commits and moves down (Shift+Enter up), as spreadsheets do. On by default. */
	readonly enterAdvances?: boolean;
}

/** The "add row" affordance under the last row. What a click creates stays with the caller. */
export interface SpreadsheetDraftRow {
	readonly onCreate: () => void;
	/** The button's label; "Add row" by default. */
	readonly label?: string;
}

export interface SpreadsheetLayout {
	/** How much room each row takes. */
	readonly density?: DataTableDensity;
	/** Draw a line between columns. On by default. */
	readonly cellBorders?: boolean;
	/** Keep the header in view while the body scrolls. Needs `maxHeight`. */
	readonly stickyHeader?: boolean;
	/** The tallest the grid may grow before it scrolls: pixels, or any CSS length. */
	readonly maxHeight?: number | string;
}

export interface SpreadsheetVirtualize {
	readonly rows?: boolean;
	readonly columns?: boolean;
}

export interface SpreadsheetProps<TData extends RowData> {
	// ── The cells ─────────────────────────────────────────────────────────
	/** The rows. */
	readonly data: readonly TData[];
	/** TanStack column definitions. A column is writable when it declares `meta.cellEdit`. */
	readonly columns: SpreadsheetColumns<TData>;
	/** A row's stable id: every write names its cell by row id and column id. */
	readonly getRowId: SpreadsheetRowIdReader<TData>;

	// ── Writing ───────────────────────────────────────────────────────────
	/** Receives every write as one batch. Apply it to your rows; the grid never changes data itself. */
	readonly onCellsChange?: (change: SpreadsheetCellsChange<TData>) => void;
	/** Asks you to open your own editor for a writable cell without a built-in one (Enter, F2 or typing). */
	readonly onCellEditRequest?: (request: SpreadsheetCellEditRequest<TData>) => void;

	// ── Selecting ─────────────────────────────────────────────────────────
	/** `range` (default): drag, Shift and Ctrl/Cmd select blocks of cells. `single`: one focused cell only. */
	readonly selectionMode?: "range" | "single";
	/** Fires on every selection change. */
	readonly onSelectionChange?: (selection: SpreadsheetSelection) => void;
	/** Fires after a copy or a cut wrote the clipboard. */
	readonly onCopy?: (copy: SpreadsheetCopy) => void;
	/** The drag-to-fill handle on the selection's corner. */
	readonly fillHandle?: SpreadsheetFillHandle;

	// ── Editing ───────────────────────────────────────────────────────────
	/** How the built-in editor opens and what Enter does. */
	readonly editing?: SpreadsheetEditing;

	// ── Marks ─────────────────────────────────────────────────────────────
	/** A lifecycle mark per row. */
	readonly rowStatus?: { bivarianceHack(row: TData): SpreadsheetRowStatus | undefined }["bivarianceHack"];
	/** A corner mark per cell. */
	readonly cellStatus?: { bivarianceHack(row: TData, columnId: string): SpreadsheetCellStatus | undefined }["bivarianceHack"];
	/** An "add row" button under the last row. */
	readonly draftRow?: SpreadsheetDraftRow;

	// ── Formulas ──────────────────────────────────────────────────────────
	/**
	 * A cell whose text starts with `=` shows the formula's result: A1 references (`B2`, `$B$2`), ranges (`A1:C4`),
	 * `+ - * / ^ & = <> < <= > >=`, and SUM, AVERAGE, MIN, MAX, COUNT, IF, ROUND, ABS, CONCAT, AND, OR, NOT. The
	 * editor shows the formula; errors show as `#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`, `#CYCLE!` or `#ERROR!`. Cells
	 * are addressed by their place on screen. Fill moves a formula's relative references. Keep the formula text in
	 * your data; the grid never writes the result back.
	 */
	readonly formulas?: boolean;
	/**
	 * `columns` (default): each column's own title. `a1`: column letters, row numbers, and a bar above the grid with
	 * the focused cell's address and what it holds.
	 */
	readonly headers?: "columns" | "a1";

	// ── Look ──────────────────────────────────────────────────────────────
	/** Density, borders, sticky header and height. */
	readonly layout?: SpreadsheetLayout;
	/** Draw only the rows and columns in view. */
	readonly virtualize?: SpreadsheetVirtualize;

	// ── Standard ──────────────────────────────────────────────────────────
	/** Overrides some of the grid's copy. Keep it a module constant. */
	readonly labels?: Partial<TableEngineLabels>;
	/** Classes for the outer element. */
	readonly className?: string;
	/** The selection API: `focusCell`, `clearSelection`, `scrollToCell`. */
	readonly ref?: React.Ref<SpreadsheetApi>;
}
