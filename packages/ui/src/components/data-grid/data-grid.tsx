"use client";

// ============================================================
// components/data-grid/data-grid.tsx
//
// The data-grid core: the TanStack Table v9 feature bundle every grid builds
// on, the per-column `meta` contract, the spreadsheet/CRUD callback types, the
// `meta.autoSize` coordinator, and the provider (`DataGrid`) that publishes one
// grid's table, resolved layout and copy to the parts below it
// (`DataGridTable`, `DataGridPagination`, `DataGridColumnHeader`, …).
//
// The grid is a low-level, data-agnostic component: the consumer owns the
// TanStack table (`useTable({ features: dataGridFeatures, … })`), its state
// (controlled or not) and the data. The grid never writes data itself — every
// edit reaches the consumer through a callback.
//
// One React context serves every row type. TanStack v9 declares `TData`
// invariant, so a context cannot hold "a table of some TData" structurally.
// The context therefore carries the TData-free half of the grid (resolved
// layout, copy, ids, row callbacks bound by row id) plus `withGrid`, a visitor
// that hands the fully typed table and callbacks to a generic function — the
// existential-type encoding, with no cast anywhere.
// ============================================================

import { isStringPrimitive } from "@workspace/shared";
import type { DataGridLabels, DataGridLabelsOverride } from "@workspace/ui/components/data-grid/data-grid-i18n";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
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
	type Cell,
	type CellData,
	type Column,
	type ColumnFiltersState,
	type ColumnSizingState,
	type ReactTable,
	type RowData,
	type SortingState,
	type Table,
} from "@tanstack/react-table";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { z } from "zod";

// ── Bivariant row callbacks ─────────────────────────────────────────────────

/**
 * Column `meta` is ONE type shared by every table built on `dataGridFeatures`
 * (v9 resolves it from the feature bundle, not per row type), so a callback in
 * it cannot name the consumer's row type. Declaring it through a method
 * signature (React's own `bivarianceHack` pattern for event handlers) lets a
 * column typed for `IData` supply `(row: IData) => …` — checked by the
 * compiler, not cast. The grid always calls it with `row.original`.
 */
export type DataGridRowRenderer = { bivarianceHack(row: RowData): React.ReactNode }["bivarianceHack"];

/** A per-row yes/no decision in column `meta` (see `DataGridRowRenderer` for why it is bivariant). */
export type DataGridRowPredicate = { bivarianceHack(row: RowData): boolean }["bivarianceHack"];

/** Clipboard/fill/editor text → the column's typed value; `undefined` rejects the cell. */
export type DataGridCellParser = { bivarianceHack(raw: string, row: RowData): CellData }["bivarianceHack"];

/** A column's typed value → clipboard/editor text. */
export type DataGridCellFormatter = { bivarianceHack(value: CellData, row: RowData): string }["bivarianceHack"];

/** The built-in free-text editor a writable column can opt into. */
export type DataGridCellEditorControl = "text" | "textarea";

/**
 * Per-column write contract for the spreadsheet operations (paste, fill,
 * clear, cut, edit). Presence marks the column writable; every write still
 * flows through `onCellsChange`, so the consumer's state stays the only data
 * owner. Values are TanStack's `CellData` — whatever the column's accessor
 * returns; `parse` and `format` are where the consumer types them.
 */
export interface DataGridColumnCellEdit {
	/**
	 * `false` for a column that formats clipboard output but is never written;
	 * a predicate decides per row (locked, archived or totals rows reject like
	 * any read-only cell). Defaults to `true`.
	 */
	readonly editable?: boolean | DataGridRowPredicate;
	/**
	 * Clipboard or fill string → typed value. Return `undefined` to reject the
	 * cell into `rejected`. Without it the raw string passes through unchanged:
	 * a deliberate non-coercion — a number column receives strings only when the
	 * consumer chose not to parse.
	 */
	readonly parse?: DataGridCellParser;
	/** Typed value → clipboard string. Fallback: `String(value ?? "")`. */
	readonly format?: DataGridCellFormatter;
	/** Value dispatched by Delete/Backspace and cut. Defaults to `null`. */
	readonly clearValue?: CellData;
	/**
	 * Opt into the grid's built-in free-text editor: an overlay input (or
	 * auto-growing textarea) flush over the focused cell, opened by Enter, F2,
	 * typing or double-click, committing through `onCellsChange` as source
	 * `"edit"` with `parse` applied. Columns without it stay consumer-edited via
	 * `onCellEditRequest` or their own cell renderers.
	 */
	readonly control?: DataGridCellEditorControl;
}

/** Per-column extras the grid reads off `columnDef.meta` (registered on `dataGridFeatures`). */
export interface DataGridColumnMeta {
	/** Plain-text column title for menus, the visibility list and the editor's accessible name. */
	readonly headerTitle?: string;
	readonly headerClassName?: string;
	readonly cellClassName?: string;
	/** Placeholder rendered in this column's cells while `loadingMode="skeleton"`. */
	readonly skeleton?: React.ReactNode;
	/** Detail content rendered in a full-width row under an expanded row. */
	readonly expandedContent?: DataGridRowRenderer;
	/** Under `columnsResizable`, this column absorbs the container's free width and reflows with it. */
	readonly autoSize?: boolean;
	/** The header spans this many leaves: this one and its next adjacent siblings. */
	readonly headerColSpan?: number;
	readonly cellEdit?: DataGridColumnCellEdit;
	/**
	 * Under `columnsResizable`, this column absorbs the free space the filler
	 * strip would otherwise hold, so the grid always reads full-width. One
	 * column per grid; while free space remains, resizing it is visually a
	 * no-op (the absorbed space compensates).
	 */
	readonly fillWidth?: boolean;
}

// ── The feature bundle ─────────────────────────────────────────────────────

/**
 * The feature bundle every data grid builds on. v9 requires each table to
 * declare its features up front, and the grid's render path needs the ones
 * registered here: `columnVisibilityFeature` alone gates
 * `row.getVisibleCells()`, so even a grid that never hides a column needs it.
 *
 * ```tsx
 * const table = useTable({ features: dataGridFeatures, columns, data });
 * ```
 *
 * Registration is inert until a layout flag turns a behaviour on:
 * `cellSelectionFeature` only seeds an empty `cellSelection` slice, so grids
 * without `tableLayout.cellSelection` behave exactly as before.
 */
export const dataGridFeatures = tableFeatures({
	columnVisibilityFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnSizingFeature,
	// columnResizingFeature requires columnSizingFeature, declared above.
	columnResizingFeature,
	columnFilteringFeature,
	// Powers DataGridColumnFilter's column.getFacetedUniqueValues(); on v9 the
	// method does not exist without it, so the faceted row models are required.
	columnFacetingFeature,
	// globalFilteringFeature requires columnFilteringFeature, declared above.
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
	// Every built-in v9 ships. A string `sortFn` resolves against this map alone,
	// and `sortFn: "auto"` infers a name from the first row's value — a partial
	// map would make auto sorting fall back silently on ordinary string columns.
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

/** The feature set `dataGridFeatures` registers. */
export type DataGridFeatures = typeof dataGridFeatures;

/** The table every grid part works with: a `useTable` result over `dataGridFeatures`. */
export type DataGridTableInstance<TData extends RowData> = ReactTable<DataGridFeatures, TData>;

/**
 * The core (framework-agnostic) table behind a grid: what `row.table`,
 * `header.getContext().table` and a column def's `table` hand out. Every
 * helper takes this, so it accepts both a core table and the `useTable`
 * result (`DataGridTableInstance`).
 */
export type DataGridCoreTable<TData extends RowData> = Table<DataGridFeatures, TData>;

/** A leaf or group column of a data grid. */
export type DataGridColumn<TData extends RowData> = Column<DataGridFeatures, TData>;

/** A body cell of a data grid. */
export type DataGridCell<TData extends RowData> = Cell<DataGridFeatures, TData>;

// ── Column helpers ─────────────────────────────────────────────────────────

/** Label for headers / column visibility: `meta.headerTitle`, a string `columnDef.header`, or `column.id`. */
export function getColumnHeaderLabel<TData extends RowData, TValue extends CellData>(column: Column<DataGridFeatures, TData, TValue>): string {
	const headerTitle = column.columnDef.meta?.headerTitle;
	if (headerTitle !== undefined) {
		return headerTitle;
	}
	const defHeader = column.columnDef.header;
	if (isStringPrimitive(defHeader)) {
		return defHeader;
	}
	return column.id;
}

/** A span below 2 covers nothing. */
const MIN_HEADER_COL_SPAN = 2;

/** The leaves one column's header covers through `meta.headerColSpan`. */
function getCoveredSiblings<TData extends RowData>(
	owner: DataGridColumn<TData>,
	family: readonly DataGridColumn<TData>[],
	ownerIndex: number,
	allColumns: readonly DataGridColumn<TData>[],
): DataGridColumn<TData>[] {
	const span = Math.floor(owner.columnDef.meta?.headerColSpan ?? 1);
	if (span < MIN_HEADER_COL_SPAN) {
		return [];
	}
	// The next span - 1 siblings in definition order, so a span never leaves
	// its parent group; a hidden one is skipped, not a gap.
	const siblings = owner.parent?.columns ?? allColumns;
	const at = siblings.findIndex((sibling) => sibling.id === owner.id);
	const intended = at < 0 ? [] : siblings.slice(at + 1, at + span).filter((sibling) => sibling.getIsVisible());
	const covered: DataGridColumn<TData>[] = [];
	for (const sibling of intended) {
		const next = family.at(ownerIndex + 1 + covered.length);
		if (next?.id !== sibling.id) {
			break;
		}
		covered.push(next);
	}
	return covered;
}

/**
 * `meta.headerColSpan`: the sibling leaves each owning leaf's header covers,
 * by owner id. Each must render right after the owner in its pin family, or
 * the span ends there; the header rows, the resize indicator and the move and
 * drop targets all read spans from here.
 */
export function getDataGridHeaderSpans<TData extends RowData>(table: DataGridCoreTable<TData>): Map<string, DataGridColumn<TData>[]> {
	const spans = new Map<string, DataGridColumn<TData>[]>();
	const families: readonly (readonly DataGridColumn<TData>[])[] = [table.getStartVisibleLeafColumns(), table.getCenterVisibleLeafColumns(), table.getEndVisibleLeafColumns()];
	const allColumns = table.getAllColumns();

	for (const family of families) {
		let index = 0;
		while (index < family.length) {
			const owner = family.at(index);
			if (owner === undefined) {
				break;
			}
			const covered = getCoveredSiblings(owner, family, index, allColumns);
			if (covered.length > 0) {
				spans.set(owner.id, covered);
			}
			index += 1 + covered.length;
		}
	}

	return spans;
}

// ── Cell selection chrome ──────────────────────────────────────────────────

/** The presence-only data attributes of a selectable cell. */
type DataGridCellSelectionDataAttr =
	| "data-cell-selected"
	| "data-cell-focused"
	| "data-cell-edge-top"
	| "data-cell-edge-right"
	| "data-cell-edge-bottom"
	| "data-cell-edge-left";

/** The `<td>` attributes a selectable cell carries, read inside a `cellSelection` subscription. */
export type DataGridCellSelectionCellAttrs = Readonly<
	Record<DataGridCellSelectionDataAttr, true | undefined> & Record<"aria-selected", boolean> & Record<"data-col-id", string>
>;

/** `true` → the attribute's present value; `false` → the attribute is omitted. */
function presentAttr(flag: boolean): true | undefined {
	return flag ? true : undefined;
}

/**
 * The `<td>` contract for spreadsheet selection. Call inside a
 * `Subscribe source={table.atoms.cellSelection}` render only: the reads are
 * builder calls on a cell that keeps its identity across renders.
 */
export function getDataGridCellSelectionCellAttrs<TData extends RowData>(cell: DataGridCell<TData>): DataGridCellSelectionCellAttrs {
	const selected = cell.getIsSelected();
	const edges = cell.getSelectionEdges();
	return {
		"aria-selected": selected,
		"data-col-id": cell.column.id,
		"data-cell-selected": presentAttr(selected),
		"data-cell-focused": presentAttr(cell.getIsFocused()),
		"data-cell-edge-top": presentAttr(edges.top),
		"data-cell-edge-right": presentAttr(edges.right),
		"data-cell-edge-bottom": presentAttr(edges.bottom),
		"data-cell-edge-left": presentAttr(edges.left),
	};
}

/**
 * Selection chrome for a body `<td>`, activated by the data attributes above
 * plus the imperatively toggled `data-cell-fill-target` (the fill-drag
 * preview). Every selection line is one layout-free `::before` overlay per
 * cell that reaches 1px beyond the cell, so each line paints exactly ON the
 * shared gridline it replaces; at the grid's own boundaries (first/last
 * column, first/last row, a pinned neighbour) the overshoot is clamped to the
 * cell through `--data-grid-overlay-*` custom properties. Logical start/end
 * insets keep RTL mirrored. Every colour is a theme token: pinned cells stay
 * opaque with the tint pre-mixed over `--data-grid-surface` (falling back to
 * the card / background token).
 */
export const dataGridCellSelectionCellClasses = cn(
	"relative select-none",
	"data-[cell-selected]:bg-primary/4",
	"data-[cell-selected]:data-pinned:bg-[color-mix(in_oklab,var(--primary)_4%,var(--data-grid-surface,var(--data-grid-card-surface,var(--background))))]",
	"data-[cell-focused]:bg-transparent!",
	"data-[cell-focused]:data-pinned:bg-[color:var(--data-grid-surface,var(--data-grid-card-surface,var(--background)))]!",
	"data-[cell-selected]:before:pointer-events-none data-[cell-selected]:before:absolute data-[cell-selected]:before:start-[var(--data-grid-overlay-start,-1px)] data-[cell-selected]:before:end-[var(--data-grid-overlay-end,-1px)] data-[cell-selected]:before:top-[var(--data-grid-overlay-top,-1px)] data-[cell-selected]:before:bottom-[var(--data-grid-overlay-bottom,-1px)] data-[cell-selected]:before:border-primary data-[cell-selected]:before:content-['']",
	"data-[cell-focused]:before:pointer-events-none data-[cell-focused]:before:absolute data-[cell-focused]:before:start-[var(--data-grid-overlay-start,-1px)] data-[cell-focused]:before:end-[var(--data-grid-overlay-end,-1px)] data-[cell-focused]:before:top-[var(--data-grid-overlay-top,-1px)] data-[cell-focused]:before:bottom-[var(--data-grid-overlay-bottom,-1px)] data-[cell-focused]:before:border-primary data-[cell-focused]:before:content-['']",
	// Interior dividers: selected cells repaint their own end and bottom
	// gridlines, so gridline-less grids still divide a range; perimeter sides
	// (the edge attributes) stay primary.
	"data-[cell-selected]:before:border-e data-[cell-selected]:before:border-b",
	"data-[cell-selected]:not-data-[cell-edge-right]:before:border-e-border",
	"data-[cell-selected]:not-data-[cell-edge-bottom]:before:border-b-border",
	// A focused cell with no selection at all draws its own full box.
	"data-[cell-focused]:not-data-[cell-selected]:before:border",
	"data-[cell-edge-bottom]:before:border-b data-[cell-edge-left]:before:border-s data-[cell-edge-right]:before:border-e data-[cell-edge-top]:before:border-t",
	// A live fill drag or an open editor paints its own single border.
	"in-data-[cell-filling]:data-[cell-selected]:before:hidden",
	"in-data-[cell-filling]:data-[cell-focused]:before:hidden",
	"in-data-[cell-editing]:data-[cell-focused]:before:hidden",
	// Boundary clamps (see above).
	"in-[tr:last-child]:[--data-grid-overlay-bottom:0px]",
	"in-[tr:first-child]:[--data-grid-overlay-top:0px]",
	"first:[--data-grid-overlay-start:0px]",
	"last:[--data-grid-overlay-end:0px]",
	"[&:has(+td[data-pinned])]:[--data-grid-overlay-end:0px]",
	"[&:has(+[data-slot=data-grid-table-fill-body-cell]:last-child)]:[--data-grid-overlay-end:0px]",
	"[&:has(+[data-slot=data-grid-table-fill-body-cell]+td[data-pinned])]:[--data-grid-overlay-end:0px]",
	"[td[data-pinned]+&]:[--data-grid-overlay-start:0px]",
	// Fill-drag targets: tint only; the dashed region outline is one overlay.
	"data-[cell-fill-target]:bg-primary/4",
	"data-[cell-fill-target]:data-pinned:bg-[color-mix(in_oklab,var(--primary)_4%,var(--data-grid-surface,var(--data-grid-card-surface,var(--background))))]",
);

// ── Server-side fetch contract ─────────────────────────────────────────────

/** What a server-driven grid sends to its data endpoint. */
export interface DataGridApiFetchParams {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly sorting?: SortingState;
	readonly filters?: ColumnFiltersState;
	readonly searchQuery?: string;
}

/** What a server-driven grid's data endpoint returns. */
export interface DataGridApiResponse<TData> {
	readonly data: TData[];
	readonly empty: boolean;
	readonly pagination: {
		readonly total: number;
		readonly page: number;
	};
}

/** The table state a server-driven grid forwards with each request. */
export interface DataGridRequestParams {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly sorting?: SortingState;
	readonly columnFilters?: ColumnFiltersState;
}

// ── Spreadsheet & CRUD callback contracts ──────────────────────────────────

/** Which spreadsheet operation produced a cell change batch. */
export type DataGridCellsChangeSource = "paste" | "cut" | "clear" | "fill" | "edit";

export interface DataGridCellChange<TData> {
	readonly rowId: string;
	readonly columnId: string;
	/** The consumer's row object, so immutable write-back needs no second lookup. */
	readonly row: TData;
	/** Accessor value at dispatch time; enables consumer-side undo stacks. */
	readonly previousValue: CellData;
	/** Typed value produced by `meta.cellEdit.parse`, or `clearValue` for clear/cut. */
	readonly value: CellData;
}

/** What `onCellsCopy` receives after the grid writes the clipboard. */
export interface DataGridCopyDetails {
	/** The TSV text that reached the clipboard. */
	readonly text: string;
	/** The same content as a row-major grid of formatted fields. */
	readonly grid: readonly (readonly string[])[];
	/** `true` when the write came from a cut, which clears the region next. */
	readonly cut: boolean;
}

/** One resolved positive region, in pre-paginated display indexes. */
export interface DataGridCellSelectionBound {
	readonly minRowIndex: number;
	readonly maxRowIndex: number;
	readonly minColumnIndex: number;
	readonly maxColumnIndex: number;
}

/** A cell address: the row id and column id it sits at. */
export interface DataGridCellAddress {
	readonly rowId: string;
	readonly columnId: string;
}

/** What `onCellSelectionChange` receives, resolved from the live selection. */
export interface DataGridCellSelectionSnapshot {
	/** The virtually focused cell, the active range's anchor; `null` when clear. */
	readonly focused: DataGridCellAddress | null;
	/** Every positive region, geometric order. */
	readonly bounds: readonly DataGridCellSelectionBound[];
	/** The most recent region, the one copy and paste act on. */
	readonly activeBound: DataGridCellSelectionBound | null;
	/** Cells of the selection the view can show — the count a batch will touch. */
	readonly visibleCellCount: number;
}

/** Why a cell of a write batch was not written. */
export type DataGridCellRejectionReason = "readonly" | "invalid";

export interface DataGridCellRejection {
	readonly rowId: string;
	readonly columnId: string;
	readonly raw: string;
	readonly reason: DataGridCellRejectionReason;
}

/**
 * Lifecycle of a row for the optional CRUD indications: "new" and "dirty"
 * tint the row, "deleted" mutes and strikes it. Purely presentational — the
 * consumer's state stays the only owner of what the statuses mean.
 */
export type DataGridRowStatus = "new" | "dirty" | "deleted";

/** Lifecycle of a cell for the optional CRUD indications: a warning corner mark for "dirty", a destructive one for "invalid". */
export type DataGridCellStatus = "dirty" | "invalid";

/**
 * Asks the consumer to open its editor for the focused cell: Enter or F2, or
 * a typed printable character (then `initialText` carries it — the
 * type-to-replace flow). Dispatched only for cells whose column is writable
 * via `meta.cellEdit`.
 */
export interface DataGridCellEditRequest<TData> {
	readonly rowId: string;
	readonly columnId: string;
	readonly row: TData;
	readonly previousValue: CellData;
	/** The typed character that started the edit; absent for Enter and F2. */
	readonly initialText?: string;
}

/**
 * One batch per operation, however many cells it spans: a 10k-cell paste is
 * one callback, one consumer setState, one table rebuild.
 */
export interface DataGridCellsChangeDetails<TData> {
	readonly source: DataGridCellsChangeSource;
	readonly changes: readonly DataGridCellChange<TData>[];
	readonly rejected: readonly DataGridCellRejection[];
}

// ── Layout ─────────────────────────────────────────────────────────────────

/**
 * Every layout flag, with its default. Parsed (not trusted) because the grid
 * memoizes the resolved layout by its serialized value: a consumer's inline
 * `tableLayout={{ … }}` object then does not re-publish the grid context on
 * every render.
 */
export const DataGridTableLayoutSchema = z.object({
	dense: z.boolean().default(false),
	cellBorder: z.boolean().default(false),
	rowBorder: z.boolean().default(true),
	rowRounded: z.boolean().default(false),
	stripped: z.boolean().default(false),
	headerBackground: z.boolean().default(false),
	footerBackground: z.boolean().default(false),
	headerBorder: z.boolean().default(true),
	headerSticky: z.boolean().default(false),
	width: z.enum(["auto", "fixed"]).default("fixed"),
	columnsVisibility: z.boolean().default(false),
	columnsResizable: z.boolean().default(false),
	/** No default on purpose: unset, the table's own `columnResizeMode` (TanStack default `"onEnd"`) is honored. */
	columnsResizeMode: z.enum(["onChange", "onEnd"]).optional(),
	columnsPinnable: z.boolean().default(false),
	columnsMovable: z.boolean().default(false),
	columnsDraggable: z.boolean().default(false),
	rowsDraggable: z.boolean().default(false),
	rowsPinnable: z.boolean().default(false),
	/** Spreadsheet cell range selection: mouse ranges, keyboard, clipboard chrome. */
	cellSelection: z.boolean().default(false),
	/** "range": drag, Shift and Ctrl/Cmd gestures grow multi-cell regions. "single": one focused cell only. */
	cellSelectionMode: z.enum(["single", "range"]).default("range"),
	/** Drag-to-fill handle on the selection corner. Requires `cellSelection`. */
	cellFillHandle: z.boolean().default(false),
	/** How a cell opens its editor from the mouse: on the second click ("dblclick") or a click on the focused cell ("click"). */
	cellEditMode: z.enum(["dblclick", "click"]).default("dblclick"),
	/** `true`: committing an edit with Enter moves focus down (Shift+Enter up), the spreadsheet convention. */
	cellEditEnterAdvance: z.boolean().default(false),
	/** The fill handle's look: a dot inside the corner, a ring riding the corner point, or a square. */
	cellFillHandleVariant: z.enum(["dot", "ring", "square"]).default("dot"),
});

/** The `tableLayout` prop: every flag optional. */
export type DataGridTableLayout = z.input<typeof DataGridTableLayoutSchema>;

/** The layout every part reads: every flag resolved to its value. */
export type DataGridResolvedTableLayout = z.output<typeof DataGridTableLayoutSchema>;

/**
 * The sticky header's default chrome. Its z-index (`z-40`) keeps it above
 * pinned body cells (`DATA_GRID_PINNED_CELL_Z_INDEX`), which would otherwise
 * paint over it while scrolling vertically.
 */
const DEFAULT_HEADER_STICKY_CLASS_NAME = "sticky top-0 z-40 bg-background/90 backdrop-blur-xs";

/** Class-name overrides per grid part (merged after the grid's own classes). */
export const DataGridTableClassNamesSchema = z.object({
	base: z.string().optional(),
	header: z.string().optional(),
	headerRow: z.string().optional(),
	headerSticky: z.string().default(DEFAULT_HEADER_STICKY_CLASS_NAME),
	body: z.string().optional(),
	bodyRow: z.string().optional(),
	footer: z.string().optional(),
	edgeCell: z.string().optional(),
	/** Override the `getRowStatus` tints. */
	rowNew: z.string().optional(),
	rowDirty: z.string().optional(),
	rowDeleted: z.string().optional(),
	/** Override the pinned-row chrome (muted tint, boundary shadow). */
	rowPinned: z.string().optional(),
	/** The `onRowCreate` affordance row. */
	rowCreate: z.string().optional(),
	/** The fill handle. */
	cellFillHandle: z.string().optional(),
});

/** The `tableClassNames` prop. */
export type DataGridTableClassNames = z.input<typeof DataGridTableClassNamesSchema>;

/** The class names every part reads. */
export type DataGridResolvedTableClassNames = z.output<typeof DataGridTableClassNamesSchema>;

/** How the body renders while `isLoading`. */
export type DataGridLoadingMode = "skeleton" | "spinner";

/** z-index of pinned (sticky) cells; the sticky header (z-40) sits above, the editor overlay between. */
export const DATA_GRID_PINNED_CELL_Z_INDEX = 30;

// ── autoSize coordinator ───────────────────────────────────────────────────

/** What one `preview` call reports: the armed column's current and reflowed width. */
export interface DataGridAutoSizePreview {
	readonly columnId: string;
	readonly current: number;
	readonly size: number;
}

/**
 * Coordinator for `meta.autoSize` columns. Lives at the core level so every
 * table variant and viewport instance shares one application state.
 */
export interface DataGridAutoSizeController {
	/**
	 * Feeds one viewport measurement: the SIGNED free space between the scroll
	 * container and the table (negative while it overflows). The first sight of
	 * an autoSize column absorbs the free space; after that every measurement
	 * reflows the same growth — down to the column's `minSize` (or its starting
	 * width). Sub-pixel deltas are dropped, a streaming resize gets one leading
	 * and one trailing commit, and a width the user dragged is never touched.
	 * Returns `true` when a sizing update was dispatched.
	 */
	readonly apply: (freeSpace: number) => boolean;
	/** The armed column's reflowed and current width at this free space, without committing; `null` when none is armed. */
	readonly preview: (freeSpace: number) => DataGridAutoSizePreview | null;
	/** Records a width the caller commits for the armed column, so the next measurement keeps reflowing. */
	readonly adopt: (columnId: string, size: number) => void;
}

interface DataGridAutoSizeApplied {
	readonly columnId: string;
	readonly base: number;
	readonly grown: number;
}

interface DataGridAutoSizeReflowState {
	applied: DataGridAutoSizeApplied | null;
	settleTimer: ReturnType<typeof setTimeout> | null;
	pendingFreeSpace: number;
	lastCommitAt: number;
}

/** A streaming resize parks its latest measurement this long before the trailing commit. */
const AUTO_SIZE_SETTLE_MS = 150;

/** Width changes smaller than one pixel are not worth a commit. */
const AUTO_SIZE_MIN_DELTA_PX = 1;

/**
 * Bookkeeping keyed on the table's `atoms` registry, never on a React
 * instance: dev StrictMode double-mounts the tree, so two controllers serve
 * one page and only the first would remember what it absorbed. The registry
 * is created once per table and shared by every per-render `table` wrapper,
 * and the WeakMap lets a discarded table take its bookkeeping along.
 */
const dataGridAutoSizeStates = new WeakMap<object, DataGridAutoSizeReflowState>();

function getDataGridAutoSizeState(atoms: object): DataGridAutoSizeReflowState {
	const existing = dataGridAutoSizeStates.get(atoms);
	if (existing !== undefined) {
		return existing;
	}
	const created: DataGridAutoSizeReflowState = { applied: null, settleTimer: null, pendingFreeSpace: 0, lastCommitAt: 0 };
	dataGridAutoSizeStates.set(atoms, created);
	return created;
}

function findAutoSizeColumn<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridColumn<TData> | undefined {
	return table.getVisibleLeafColumns().find((column) => column.columnDef.meta?.autoSize === true && column.getCanResize());
}

interface DataGridAutoSizeReflow {
	readonly state: DataGridAutoSizeReflowState;
	readonly applied: DataGridAutoSizeApplied;
	readonly target: number;
	readonly maxSize: number;
}

/**
 * The armed column's reflow target at this free space, or `null` when no
 * column is armed or the user has taken the width over. Reads LIVE sizing
 * state (`atoms.columnSizing.get()`), never a render snapshot: a measurement
 * can run between this coordinator's own commit and React's re-render.
 */
function resolveDataGridAutoSizeReflow<TData extends RowData>(table: DataGridCoreTable<TData>, freeSpace: number): DataGridAutoSizeReflow | null {
	const state = getDataGridAutoSizeState(table.atoms);
	const { applied } = state;
	if (applied === null) {
		return null;
	}
	const autoSizeColumn = findAutoSizeColumn(table);
	if (autoSizeColumn?.id !== applied.columnId) {
		return null;
	}
	const currentSize = table.atoms.columnSizing.get()[applied.columnId];
	if (currentSize !== undefined && currentSize !== applied.grown) {
		return null;
	}
	// The free space as it would measure with this growth removed; the target
	// re-absorbs exactly that, floored at a consumer minSize (TanStack always
	// resolves a built-in one, so only a value that differs from the defaults
	// counts) or else the starting width.
	const freeAtBase = freeSpace + (applied.grown - applied.base);
	const resolvedMinSize = autoSizeColumn.columnDef.minSize;
	const hasConsumerMinSize = table.options.defaultColumn?.minSize !== undefined || resolvedMinSize !== table.getDefaultColumnDef().minSize;
	const floor = hasConsumerMinSize && resolvedMinSize !== undefined ? resolvedMinSize : applied.base;
	return {
		state,
		applied,
		target: Math.max(floor, applied.base + freeAtBase),
		maxSize: autoSizeColumn.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER,
	};
}

function reflowDataGridAutoSize<TData extends RowData>(table: DataGridCoreTable<TData>, freeSpace: number): boolean {
	const resolved = resolveDataGridAutoSizeReflow(table, freeSpace);
	if (resolved === null) {
		return false;
	}
	const { state, applied, target } = resolved;
	if (Math.abs(target - applied.grown) < AUTO_SIZE_MIN_DELTA_PX) {
		return false;
	}
	state.applied = { ...applied, grown: target };
	table.setColumnSizing((old: ColumnSizingState): ColumnSizingState => ({ ...old, [applied.columnId]: target }));
	return true;
}

/**
 * Builds the coordinator for one table. The table's methods and atoms are
 * live for the table's lifetime (only its `state` snapshot is per render), so
 * the controller can hold the instance it was created with.
 */
export function createDataGridAutoSizeController<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridAutoSizeController {
	return {
		preview: (freeSpace: number): DataGridAutoSizePreview | null => {
			const resolved = resolveDataGridAutoSizeReflow(table, freeSpace);
			if (resolved === null) {
				return null;
			}
			// In rendered pixels: getSize() clamps to maxSize.
			return {
				columnId: resolved.applied.columnId,
				current: Math.min(resolved.applied.grown, resolved.maxSize),
				size: Math.min(resolved.target, resolved.maxSize),
			};
		},
		adopt: (columnId: string, size: number): void => {
			const state = getDataGridAutoSizeState(table.atoms);
			if (state.applied?.columnId === columnId) {
				state.applied = { ...state.applied, grown: size };
			}
		},
		apply: (freeSpace: number): boolean => {
			const state = getDataGridAutoSizeState(table.atoms);
			const columnSizing = table.atoms.columnSizing.get();

			// Re-arm after a reset (double-click resetSize, resetColumnSizing, a
			// controlled state replacement) so the column re-fills.
			if (state.applied !== null && columnSizing[state.applied.columnId] === undefined) {
				state.applied = null;
			}

			const autoSizeColumn = findAutoSizeColumn(table);

			if (autoSizeColumn !== undefined && state.applied?.columnId === autoSizeColumn.id) {
				state.pendingFreeSpace = freeSpace;
				const now = Date.now();
				if (now - state.lastCommitAt > AUTO_SIZE_SETTLE_MS) {
					state.lastCommitAt = now;
					return reflowDataGridAutoSize(table, freeSpace);
				}
				if (state.settleTimer !== null) {
					clearTimeout(state.settleTimer);
				}
				state.settleTimer = setTimeout((): void => {
					state.settleTimer = null;
					state.lastCommitAt = Date.now();
					reflowDataGridAutoSize(table, state.pendingFreeSpace);
				}, AUTO_SIZE_SETTLE_MS);
				return false;
			}

			const fillWidth = Math.max(0, freeSpace);
			if (fillWidth <= 0 || autoSizeColumn === undefined) {
				return false;
			}

			// A width this coordinator did not write belongs to the user (a resize
			// drag); filling over it would snap the column back.
			const currentSize = columnSizing[autoSizeColumn.id];
			if (currentSize !== undefined && currentSize !== state.applied?.grown) {
				return false;
			}

			// Candidate switched (the grown column was hidden and another took
			// over): revert the previous growth unless the user resized it since.
			const previous = state.applied;
			const revert = previous !== null && columnSizing[previous.columnId] === previous.grown ? previous : null;
			const base = columnSizing[autoSizeColumn.id] ?? autoSizeColumn.getSize();
			const grown = base + fillWidth;

			state.applied = { columnId: autoSizeColumn.id, base, grown };
			table.setColumnSizing((old: ColumnSizingState): ColumnSizingState => {
				const next: ColumnSizingState = { ...old, [autoSizeColumn.id]: grown };
				if (revert !== null && next[revert.columnId] === revert.grown) {
					return { ...next, [revert.columnId]: revert.base };
				}
				return next;
			});
			return true;
		},
	};
}

const dataGridAutoSizeControllers = new WeakMap<object, DataGridAutoSizeController>();

/**
 * The one coordinator of a table, keyed on its `atoms` registry: split
 * header/body viewports then cannot apply the growth twice, and the
 * coordinator survives the per-state-change `table` wrapper.
 */
export function getDataGridAutoSizeController<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridAutoSizeController {
	const existing = dataGridAutoSizeControllers.get(table.atoms);
	if (existing !== undefined) {
		return existing;
	}
	const created = createDataGridAutoSizeController(table);
	dataGridAutoSizeControllers.set(table.atoms, created);
	return created;
}

// ── Context ────────────────────────────────────────────────────────────────

/**
 * The TData-free half of the grid's props, resolved: what every part reads.
 * Row callbacks are bound by row id here (the provider looks the row up and
 * hands the consumer its own typed `row.original`), so no part needs the row
 * type to fire them.
 */
export interface DataGridLayoutProps {
	readonly tableLayout: DataGridResolvedTableLayout;
	readonly tableClassNames: DataGridResolvedTableClassNames;
	readonly loadingMode: DataGridLoadingMode;
	readonly loadingMessage: React.ReactNode;
	readonly fetchingMoreMessage: React.ReactNode;
	readonly allRowsLoadedMessage: React.ReactNode;
	readonly emptyMessage: React.ReactNode;
	readonly rowCreateLabel: React.ReactNode;
	readonly appendRow: React.ReactNode;
	readonly onRowCreate: (() => void) | undefined;
	readonly onCellSelectionChange: ((snapshot: DataGridCellSelectionSnapshot) => void) | undefined;
	readonly onCellsCopy: ((details: DataGridCopyDetails) => void) | undefined;
	readonly onRowClick: ((rowId: string) => void) | undefined;
	readonly getRowStatus: ((rowId: string) => DataGridRowStatus | undefined) | undefined;
	readonly getCellStatus: ((rowId: string, columnId: string) => DataGridCellStatus | undefined) | undefined;
}

/** The typed half of the grid: the table plus every callback that names the row type. */
export interface DataGridTypedGrid<TData extends RowData> {
	readonly table: DataGridTableInstance<TData>;
	readonly onRowClick: ((row: TData) => void) | undefined;
	readonly onCellsChange: ((details: DataGridCellsChangeDetails<TData>) => void) | undefined;
	readonly onCellEditRequest: ((request: DataGridCellEditRequest<TData>) => void) | undefined;
	readonly getRowStatus: ((row: TData) => DataGridRowStatus | undefined) | undefined;
	readonly getCellStatus: ((row: TData, columnId: string) => DataGridCellStatus | undefined) | undefined;
}

/**
 * A function over "the grid's table, whatever its row type". `visit` is
 * generic, so its body can use the typed table and callbacks freely while the
 * caller stays row-type agnostic.
 */
export interface DataGridGridVisitor<TResult> {
	visit<TData extends RowData>(grid: DataGridTypedGrid<TData>): TResult;
}

/** What `useDataGrid()` returns. */
export interface DataGridContextValue {
	readonly props: DataGridLayoutProps;
	/** The resolved `dataGrid` copy (provider pack + the grid's `labels` override). */
	readonly labels: DataGridLabels;
	readonly recordCount: number;
	readonly isLoading: boolean;
	/** Stable per-grid prefix for the DOM ids ARIA relations point at. */
	readonly gridId: string;
	readonly autoSize: DataGridAutoSizeController;
	/** Runs `visitor` against the typed table and callbacks. */
	readonly withGrid: <TResult>(visitor: DataGridGridVisitor<TResult>) => TResult;
}

const DataGridContext = React.createContext<DataGridContextValue | null>(null);

/** The nearest grid's context. Throws outside `<DataGrid>`, which a grid part can never render without. */
export function useDataGrid(): DataGridContextValue {
	const context = React.useContext(DataGridContext);
	if (context === null) {
		throw new Error("useDataGrid must be used within <DataGrid>");
	}
	return context;
}

/** The slice of a TanStack store atom the grid subscribes to. */
export interface DataGridStateAtom<TValue> {
	get(): TValue;
	subscribe(listener: () => void): { unsubscribe(): void };
}

/**
 * Re-renders the caller when one table state atom changes (a column resize in
 * flight paints through this). Pass `select` to subscribe to a slice or a
 * primitive of the atom's value; it must return the same identity for an
 * unchanged input, or every write re-renders.
 */
export function useDataGridAtom<TValue>(atom: DataGridStateAtom<TValue>): TValue;
export function useDataGridAtom<TValue, TSelected>(atom: DataGridStateAtom<TValue>, select: (value: TValue) => TSelected): TSelected;
export function useDataGridAtom<TValue, TSelected>(atom: DataGridStateAtom<TValue>, select?: (value: TValue) => TSelected): TValue | TSelected {
	const subscribe = React.useCallback(
		(onChange: () => void): (() => void) => {
			const subscription = atom.subscribe(onChange);
			return (): void => {
				subscription.unsubscribe();
			};
		},
		[atom],
	);
	const getSnapshot = React.useCallback((): TValue | TSelected => (select === undefined ? atom.get() : select(atom.get())), [atom, select]);
	return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Row ids are consumer strings; DOM ids cannot carry spaces or quotes. One sanitizer for every id writer and reader. */
export function toDataGridDomId(value: string): string {
	return value.replace(/[^\w-]/g, "_");
}

// ── DataGrid ───────────────────────────────────────────────────────────────

export interface DataGridProps<TData extends RowData> {
	/** The consumer's table: `useTable({ features: dataGridFeatures, columns, data, … })`. */
	readonly table: DataGridTableInstance<TData>;
	/** Total rows the grid represents (all pages); drives pagination copy and ARIA row counts. */
	readonly recordCount: number;
	readonly children?: React.ReactNode;
	readonly onRowClick?: (row: TData) => void;
	/** Receives every spreadsheet write batch (paste, cut, clear, fill, edit). Absent: copy still works, writes no-op. */
	readonly onCellsChange?: (details: DataGridCellsChangeDetails<TData>) => void;
	/** Opens the consumer's editor from the keyboard: Enter, F2, or typing on the focused cell. */
	readonly onCellEditRequest?: (request: DataGridCellEditRequest<TData>) => void;
	/** Fires on every cell-selection change with a resolved snapshot. */
	readonly onCellSelectionChange?: (snapshot: DataGridCellSelectionSnapshot) => void;
	/** Fires after the grid writes the clipboard (Cmd/Ctrl+C or X, or the native copy/cut events). */
	readonly onCellsCopy?: (details: DataGridCopyDetails) => void;
	/** Renders an "Add row" affordance as the body's last row; clicking it is the consumer's cue to create one. */
	readonly onRowCreate?: () => void;
	/** Label of the `onRowCreate` affordance; defaults to the `rowCreate` label. */
	readonly rowCreateLabel?: React.ReactNode;
	/** Rendered inside the body after the data rows: the slot a DRAFT row lives in while it is being created (a `<tr>`). */
	readonly appendRow?: React.ReactNode;
	/** Optional CRUD indication per row; return `undefined` for none. */
	readonly getRowStatus?: (row: TData) => DataGridRowStatus | undefined;
	/** Optional CRUD indication per cell: the corner mark on cells the consumer tracks as edited or invalid. */
	readonly getCellStatus?: (row: TData, columnId: string) => DataGridCellStatus | undefined;
	readonly isLoading?: boolean;
	/** Overrides some of the `dataGrid` copy for this grid. Keep it a module constant. */
	readonly labels?: DataGridLabelsOverride;
	readonly loadingMode?: DataGridLoadingMode;
	readonly loadingMessage?: React.ReactNode;
	readonly fetchingMoreMessage?: React.ReactNode;
	readonly allRowsLoadedMessage?: React.ReactNode;
	readonly emptyMessage?: React.ReactNode;
	readonly tableLayout?: DataGridTableLayout;
	readonly tableClassNames?: DataGridTableClassNames;
}

const EMPTY_LAYOUT_KEY = "{}";

/** Structural memo of a plain-data prop: re-parsed only when its serialized value changes. */
function useParsedLayout<TSchema extends z.ZodType>(schema: TSchema, value: object | undefined): z.output<TSchema> {
	const key = value === undefined ? EMPTY_LAYOUT_KEY : JSON.stringify(value);
	return React.useMemo((): z.output<TSchema> => schema.parse(JSON.parse(key)), [schema, key]);
}

/**
 * Provides one grid to its parts. Renders no DOM of its own (wrap the parts
 * in `DataGridContainer`), so it has no ref to forward.
 */
export function DataGrid<TData extends RowData>({
	table,
	recordCount,
	children,
	onRowClick,
	onCellsChange,
	onCellEditRequest,
	onCellSelectionChange,
	onCellsCopy,
	onRowCreate,
	rowCreateLabel,
	appendRow,
	getRowStatus,
	getCellStatus,
	isLoading = false,
	labels: labelsOverride,
	loadingMode = "skeleton",
	loadingMessage,
	fetchingMoreMessage,
	allRowsLoadedMessage,
	emptyMessage,
	tableLayout,
	tableClassNames,
}: DataGridProps<TData>): React.JSX.Element {
	const gridId = React.useId();
	const labels = useUiKitLabels("dataGrid", labelsOverride);
	const resolvedLayout = useParsedLayout(DataGridTableLayoutSchema, tableLayout);
	const resolvedClassNames = useParsedLayout(DataGridTableClassNamesSchema, tableClassNames);

	// Re-assert an explicit tableLayout resize mode so the consumer's own
	// useTable options cannot flip it back between drags. Without one, the
	// table's columnResizeMode (TanStack default "onEnd") is honored.
	const resizeMode = resolvedLayout.columnsResizable ? resolvedLayout.columnsResizeMode : undefined;
	React.useEffect((): void => {
		if (resizeMode === undefined || table.options.columnResizeMode === resizeMode) {
			return;
		}
		table.setOptions((old) => ({ ...old, columnResizeMode: resizeMode }));
	}, [table, resizeMode]);

	// With the selection UI on, every paste/fill/clear batch replaces `data`;
	// the feature's default autoResetCellSelection would wipe the selection
	// after each write. Ranges are row-id based, so keeping them is correct.
	const cellSelectionOn = resolvedLayout.cellSelection;
	React.useEffect((): void => {
		if (!cellSelectionOn || table.options.autoResetCellSelection === false) {
			return;
		}
		table.setOptions((old) => ({ ...old, autoResetCellSelection: false }));
	}, [table, cellSelectionOn]);

	// Rendered row indexes re-base per page, so a range kept across a page flip
	// would re-light the same positions over different rows: a page change
	// clears the selection, as spreadsheet-family grids do.
	const { pageIndex, pageSize } = table.state.pagination;
	const pageKey = `${String(pageIndex)}:${String(pageSize)}`;
	const previousPageKeyRef = React.useRef(pageKey);
	React.useEffect((): void => {
		if (previousPageKeyRef.current === pageKey) {
			return;
		}
		previousPageKeyRef.current = pageKey;
		if (cellSelectionOn) {
			table.resetCellSelection(true);
		}
	}, [pageKey, cellSelectionOn, table]);

	// One coordinator per table (see getDataGridAutoSizeController).
	const autoSize = React.useMemo((): DataGridAutoSizeController => getDataGridAutoSizeController(table), [table]);

	const layoutProps = React.useMemo(
		(): DataGridLayoutProps => ({
			tableLayout: resolvedLayout,
			tableClassNames: resolvedClassNames,
			loadingMode,
			loadingMessage,
			fetchingMoreMessage,
			allRowsLoadedMessage,
			emptyMessage,
			rowCreateLabel,
			appendRow,
			onRowCreate,
			onCellSelectionChange,
			onCellsCopy,
			onRowClick:
				onRowClick === undefined
					? undefined
					: (rowId: string): void => {
							onRowClick(table.getRow(rowId, true).original);
						},
			getRowStatus: getRowStatus === undefined ? undefined : (rowId: string): DataGridRowStatus | undefined => getRowStatus(table.getRow(rowId, true).original),
			getCellStatus:
				getCellStatus === undefined
					? undefined
					: (rowId: string, columnId: string): DataGridCellStatus | undefined => getCellStatus(table.getRow(rowId, true).original, columnId),
		}),
		[
			resolvedLayout,
			resolvedClassNames,
			loadingMode,
			loadingMessage,
			fetchingMoreMessage,
			allRowsLoadedMessage,
			emptyMessage,
			rowCreateLabel,
			appendRow,
			onRowCreate,
			onCellSelectionChange,
			onCellsCopy,
			onRowClick,
			getRowStatus,
			getCellStatus,
			table,
		],
	);

	const typedGrid = React.useMemo(
		(): DataGridTypedGrid<TData> => ({ table, onRowClick, onCellsChange, onCellEditRequest, getRowStatus, getCellStatus }),
		[table, onRowClick, onCellsChange, onCellEditRequest, getRowStatus, getCellStatus],
	);

	const value = React.useMemo(
		(): DataGridContextValue => ({
			props: layoutProps,
			labels,
			recordCount,
			isLoading,
			gridId,
			autoSize,
			withGrid: <TResult,>(visitor: DataGridGridVisitor<TResult>): TResult => visitor.visit(typedGrid),
		}),
		[layoutProps, labels, recordCount, isLoading, gridId, autoSize, typedGrid],
	);

	return <DataGridContext.Provider value={value}>{children}</DataGridContext.Provider>;
}

// ── DataGridContainer ──────────────────────────────────────────────────────

export const dataGridContainerVariants = cva(
	// relative: anchors floating chrome composed inside the container, like the fill-drag preview outline.
	"relative w-full overflow-hidden",
	{
		variants: {
			variant: {
				default: "",
				bordered: "rounded-lg border border-border",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface DataGridContainerProps extends React.ComponentProps<"div">, VariantProps<typeof dataGridContainerVariants> {}

/** The grid's outer box: clips the scroll area and anchors the grid's floating chrome. */
export const DataGridContainer = React.forwardRef<HTMLDivElement, DataGridContainerProps>(function DataGridContainer(
	{ className, variant, ...props },
	ref,
): React.JSX.Element {
	return <div ref={ref} data-slot="data-grid" className={cn(dataGridContainerVariants({ variant }), className)} {...props} />;
});
