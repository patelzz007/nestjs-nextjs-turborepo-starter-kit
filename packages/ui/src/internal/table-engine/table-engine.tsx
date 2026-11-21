"use client";

// ============================================================
// components/table-engine/table-engine.tsx
//
// The table-engine core: the TanStack Table v9 feature bundle every grid builds
// on, the per-column `meta` contract, the spreadsheet/CRUD callback types, the
// `meta.autoSize` coordinator, and the provider (`TableEngine`) that publishes one
// grid's table, resolved layout and copy to the parts below it
// (`TableEngineTable`, `TableEnginePagination`, `TableEngineColumnHeader`, …).
//
// The grid is a low-level, data-agnostic component: the consumer owns the
// TanStack table (`useTable({ features: tableEngineFeatures, … })`), its state
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
import type { TableEngineLabels, TableEngineLabelsOverride } from "./table-engine-i18n";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import {
	aggregationFn_count,
	aggregationFn_max,
	aggregationFn_mean,
	aggregationFn_min,
	aggregationFn_sum,
	cellSelectionFeature,
	columnFacetingFeature,
	columnFilteringFeature,
	columnGroupingFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnResizingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createExpandedRowModel,
	createFacetedRowModel,
	createFacetedUniqueValues,
	createFilteredRowModel,
	createGroupedRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	globalFilteringFeature,
	metaHelper,
	rowAggregationFeature,
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
 * Column `meta` is ONE type shared by every table built on `tableEngineFeatures`
 * (v9 resolves it from the feature bundle, not per row type), so a callback in
 * it cannot name the consumer's row type. Declaring it through a method
 * signature (React's own `bivarianceHack` pattern for event handlers) lets a
 * column typed for `IData` supply `(row: IData) => …` — checked by the
 * compiler, not cast. The grid always calls it with `row.original`.
 */
export type TableEngineRowRenderer = { bivarianceHack(row: RowData): React.ReactNode }["bivarianceHack"];

/** A per-row yes/no decision in column `meta` (see `TableEngineRowRenderer` for why it is bivariant). */
export type TableEngineRowPredicate = { bivarianceHack(row: RowData): boolean }["bivarianceHack"];

/** Clipboard/fill/editor text → the column's typed value; `undefined` rejects the cell. */
export type TableEngineCellParser = { bivarianceHack(raw: string, row: RowData): CellData }["bivarianceHack"];

/** A column's typed value → clipboard/editor text. */
export type TableEngineCellFormatter = { bivarianceHack(value: CellData, row: RowData): string }["bivarianceHack"];

/**
 * How a value changes when the fill handle carries it to a cell `rowOffset` rows down and `columnOffset` columns
 * right of where it came from (both may be negative). A spreadsheet formula moves its relative references this way.
 */
export type TableEngineCellCarrier = { bivarianceHack(value: CellData, rowOffset: number, columnOffset: number): CellData }["bivarianceHack"];

/** Checks a parsed value before the editor commits it: a message to show, or `undefined` when the value is fine. */
export type TableEngineCellValidator = { bivarianceHack(value: CellData, row: RowData): string | undefined }["bivarianceHack"];

/** The built-in free-text editor a writable column can opt into. */
export type TableEngineCellEditorControl = "text" | "textarea";

/**
 * Per-column write contract for the spreadsheet operations (paste, fill,
 * clear, cut, edit). Presence marks the column writable; every write still
 * flows through `onCellsChange`, so the consumer's state stays the only data
 * owner. Values are TanStack's `CellData` — whatever the column's accessor
 * returns; `parse` and `format` are where the consumer types them.
 */
export interface TableEngineColumnCellEdit {
	/**
	 * `false` for a column that formats clipboard output but is never written;
	 * a predicate decides per row (locked, archived or totals rows reject like
	 * any read-only cell). Defaults to `true`.
	 */
	readonly editable?: boolean | TableEngineRowPredicate;
	/**
	 * Clipboard or fill string → typed value. Return `undefined` to reject the
	 * cell into `rejected`. Without it the raw string passes through unchanged:
	 * a deliberate non-coercion — a number column receives strings only when the
	 * consumer chose not to parse.
	 */
	readonly parse?: TableEngineCellParser;
	/** Typed value → clipboard string. Fallback: `String(value ?? "")`. */
	readonly format?: TableEngineCellFormatter;
	/**
	 * Checked when the built-in editor commits (Enter, Tab): a message keeps the editor open, shows the message under
	 * it and commits nothing until the value is fixed; leaving the cell then drops the edit. Runs on the PARSED value,
	 * after `parse`. Paste and fill do not run it: they reject through `parse`.
	 */
	readonly validate?: TableEngineCellValidator;
	/** How fill changes a value it carries to another cell; without it the value is copied as it is. */
	readonly carry?: TableEngineCellCarrier;
	/** Value dispatched by Delete/Backspace and cut. Defaults to `null`. */
	readonly clearValue?: CellData;
	/**
	 * Opt into the grid's built-in free-text editor: an overlay input (or
	 * auto-growing textarea) flush over the focused cell, opened by Enter, F2,
	 * typing or double-click, committing through `onCellsChange` as source
	 * `"edit"` with `parse` applied. Columns without it stay consumer-edited via
	 * `onCellEditRequest` or their own cell renderers.
	 */
	readonly control?: TableEngineCellEditorControl;
}

/** Per-column extras the grid reads off `columnDef.meta` (registered on `tableEngineFeatures`). */
export interface TableEngineColumnMeta {
	/** Plain-text column title for menus, the visibility list and the editor's accessible name. */
	readonly headerTitle?: string;
	readonly headerClassName?: string;
	readonly cellClassName?: string;
	/** Placeholder rendered in this column's cells while `loadingMode="skeleton"`. */
	readonly skeleton?: React.ReactNode;
	/** Detail content rendered in a full-width row under an expanded row. */
	readonly expandedContent?: TableEngineRowRenderer;
	/** Under `columnsResizable`, this column absorbs the container's free width and reflows with it. */
	readonly autoSize?: boolean;
	/** The header spans this many leaves: this one and its next adjacent siblings. */
	readonly headerColSpan?: number;
	readonly cellEdit?: TableEngineColumnCellEdit;
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
 * const table = useTable({ features: tableEngineFeatures, columns, data });
 * ```
 *
 * Registration is inert until a layout flag turns a behaviour on:
 * `cellSelectionFeature` only seeds an empty `cellSelection` slice, so grids
 * without `tableLayout.cellSelection` behave exactly as before.
 */
export const tableEngineFeatures = tableFeatures({
	columnVisibilityFeature,
	columnOrderingFeature,
	columnPinningFeature,
	columnSizingFeature,
	// columnResizingFeature requires columnSizingFeature, declared above.
	columnResizingFeature,
	columnFilteringFeature,
	// Powers TableEngineColumnFilter's column.getFacetedUniqueValues(); on v9 the
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
	// Grouping rows by a column's value, with a subtotal per group. Inert while the `grouping` state is empty.
	columnGroupingFeature,
	rowAggregationFeature,
	groupedRowModel: createGroupedRowModel(),
	// The ways a group's subtotal combines its rows, named by `aggregationFn` on a column.
	aggregationFns: {
		sum: aggregationFn_sum,
		count: aggregationFn_count,
		mean: aggregationFn_mean,
		min: aggregationFn_min,
		max: aggregationFn_max,
	},
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
	columnMeta: metaHelper<TableEngineColumnMeta>(),
});

/** The feature set `tableEngineFeatures` registers. */
export type TableEngineFeatures = typeof tableEngineFeatures;

/** The table every grid part works with: a `useTable` result over `tableEngineFeatures`. */
export type TableEngineTableInstance<TData extends RowData> = ReactTable<TableEngineFeatures, TData>;

/**
 * The core (framework-agnostic) table behind a grid: what `row.table`,
 * `header.getContext().table` and a column def's `table` hand out. Every
 * helper takes this, so it accepts both a core table and the `useTable`
 * result (`TableEngineTableInstance`).
 */
export type TableEngineCoreTable<TData extends RowData> = Table<TableEngineFeatures, TData>;

/** A leaf or group column of a data grid. */
export type TableEngineColumn<TData extends RowData> = Column<TableEngineFeatures, TData>;

/** A body cell of a data grid. */
export type TableEngineCell<TData extends RowData> = Cell<TableEngineFeatures, TData>;

// ── Column helpers ─────────────────────────────────────────────────────────

/** Label for headers / column visibility: `meta.headerTitle`, a string `columnDef.header`, or `column.id`. */
export function getColumnHeaderLabel<TData extends RowData, TValue extends CellData>(column: Column<TableEngineFeatures, TData, TValue>): string {
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
	owner: TableEngineColumn<TData>,
	family: readonly TableEngineColumn<TData>[],
	ownerIndex: number,
	allColumns: readonly TableEngineColumn<TData>[],
): TableEngineColumn<TData>[] {
	const span = Math.floor(owner.columnDef.meta?.headerColSpan ?? 1);
	if (span < MIN_HEADER_COL_SPAN) {
		return [];
	}
	// The next span - 1 siblings in definition order, so a span never leaves
	// its parent group; a hidden one is skipped, not a gap.
	const siblings = owner.parent?.columns ?? allColumns;
	const at = siblings.findIndex((sibling) => sibling.id === owner.id);
	const intended = at < 0 ? [] : siblings.slice(at + 1, at + span).filter((sibling) => sibling.getIsVisible());
	const covered: TableEngineColumn<TData>[] = [];
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
export function getTableEngineHeaderSpans<TData extends RowData>(table: TableEngineCoreTable<TData>): Map<string, TableEngineColumn<TData>[]> {
	const spans = new Map<string, TableEngineColumn<TData>[]>();
	const families: readonly (readonly TableEngineColumn<TData>[])[] = [
		table.getStartVisibleLeafColumns(),
		table.getCenterVisibleLeafColumns(),
		table.getEndVisibleLeafColumns(),
	];
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
type TableEngineCellSelectionDataAttr =
	| "data-cell-selected"
	| "data-cell-focused"
	| "data-cell-edge-top"
	| "data-cell-edge-right"
	| "data-cell-edge-bottom"
	| "data-cell-edge-left";

/** The `<td>` attributes a selectable cell carries, read inside a `cellSelection` subscription. */
export type TableEngineCellSelectionCellAttrs = Readonly<
	Record<TableEngineCellSelectionDataAttr, true | undefined> & Record<"aria-selected", boolean> & Record<"data-col-id", string>
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
export function getTableEngineCellSelectionCellAttrs<TData extends RowData>(cell: TableEngineCell<TData>): TableEngineCellSelectionCellAttrs {
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
 * cell through `--table-engine-overlay-*` custom properties. Logical start/end
 * insets keep RTL mirrored. Every colour is a theme token: pinned cells stay
 * opaque with the tint pre-mixed over `--table-engine-surface` (falling back to
 * the card / background token).
 */
export const tableEngineCellSelectionCellClasses = cn(
	"relative select-none",
	"data-[cell-selected]:bg-primary/4",
	"data-[cell-selected]:data-pinned:bg-[color-mix(in_oklab,var(--primary)_4%,var(--table-engine-surface,var(--table-engine-card-surface,var(--background))))]",
	"data-[cell-focused]:bg-transparent!",
	"data-[cell-focused]:data-pinned:bg-[color:var(--table-engine-surface,var(--table-engine-card-surface,var(--background)))]!",
	"data-[cell-selected]:before:pointer-events-none data-[cell-selected]:before:absolute data-[cell-selected]:before:start-[var(--table-engine-overlay-start,-1px)] data-[cell-selected]:before:end-[var(--table-engine-overlay-end,-1px)] data-[cell-selected]:before:top-[var(--table-engine-overlay-top,-1px)] data-[cell-selected]:before:bottom-[var(--table-engine-overlay-bottom,-1px)] data-[cell-selected]:before:border-primary data-[cell-selected]:before:content-['']",
	"data-[cell-focused]:before:pointer-events-none data-[cell-focused]:before:absolute data-[cell-focused]:before:start-[var(--table-engine-overlay-start,-1px)] data-[cell-focused]:before:end-[var(--table-engine-overlay-end,-1px)] data-[cell-focused]:before:top-[var(--table-engine-overlay-top,-1px)] data-[cell-focused]:before:bottom-[var(--table-engine-overlay-bottom,-1px)] data-[cell-focused]:before:border-primary data-[cell-focused]:before:content-['']",
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
	"in-[tr:last-child]:[--table-engine-overlay-bottom:0px]",
	"in-[tr:first-child]:[--table-engine-overlay-top:0px]",
	"first:[--table-engine-overlay-start:0px]",
	"last:[--table-engine-overlay-end:0px]",
	"[&:has(+td[data-pinned])]:[--table-engine-overlay-end:0px]",
	"[&:has(+[data-slot=table-engine-table-fill-body-cell]:last-child)]:[--table-engine-overlay-end:0px]",
	"[&:has(+[data-slot=table-engine-table-fill-body-cell]+td[data-pinned])]:[--table-engine-overlay-end:0px]",
	"[td[data-pinned]+&]:[--table-engine-overlay-start:0px]",
	// Fill-drag targets: tint only; the dashed region outline is one overlay.
	"data-[cell-fill-target]:bg-primary/4",
	"data-[cell-fill-target]:data-pinned:bg-[color-mix(in_oklab,var(--primary)_4%,var(--table-engine-surface,var(--table-engine-card-surface,var(--background))))]",
);

// ── Server-side fetch contract ─────────────────────────────────────────────

/** What a server-driven grid sends to its data endpoint. */
export interface TableEngineApiFetchParams {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly sorting?: SortingState;
	readonly filters?: ColumnFiltersState;
	readonly searchQuery?: string;
}

/** What a server-driven grid's data endpoint returns. */
export interface TableEngineApiResponse<TData> {
	readonly data: TData[];
	readonly empty: boolean;
	readonly pagination: {
		readonly total: number;
		readonly page: number;
	};
}

/** The table state a server-driven grid forwards with each request. */
export interface TableEngineRequestParams {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly sorting?: SortingState;
	readonly columnFilters?: ColumnFiltersState;
}

// ── Spreadsheet & CRUD callback contracts ──────────────────────────────────

/** Which spreadsheet operation produced a cell change batch. */
export type TableEngineCellsChangeSource = "paste" | "cut" | "clear" | "fill" | "edit";

export interface TableEngineCellChange<TData> {
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
export interface TableEngineCopyDetails {
	/** The TSV text that reached the clipboard. */
	readonly text: string;
	/** The same content as a row-major grid of formatted fields. */
	readonly grid: readonly (readonly string[])[];
	/** `true` when the write came from a cut, which clears the region next. */
	readonly cut: boolean;
}

/** One resolved positive region, in pre-paginated display indexes. */
export interface TableEngineCellSelectionBound {
	readonly minRowIndex: number;
	readonly maxRowIndex: number;
	readonly minColumnIndex: number;
	readonly maxColumnIndex: number;
}

/** A cell address: the row id and column id it sits at. */
export interface TableEngineCellAddress {
	readonly rowId: string;
	readonly columnId: string;
}

/** What `onCellSelectionChange` receives, resolved from the live selection. */
export interface TableEngineCellSelectionSnapshot {
	/** The virtually focused cell, the active range's anchor; `null` when clear. */
	readonly focused: TableEngineCellAddress | null;
	/** Every positive region, geometric order. */
	readonly bounds: readonly TableEngineCellSelectionBound[];
	/** The most recent region, the one copy and paste act on. */
	readonly activeBound: TableEngineCellSelectionBound | null;
	/** Cells of the selection the view can show — the count a batch will touch. */
	readonly visibleCellCount: number;
}

/** Why a cell of a write batch was not written. */
export type TableEngineCellRejectionReason = "readonly" | "invalid";

export interface TableEngineCellRejection {
	readonly rowId: string;
	readonly columnId: string;
	readonly raw: string;
	readonly reason: TableEngineCellRejectionReason;
}

/**
 * Lifecycle of a row for the optional CRUD indications: "new" and "dirty"
 * tint the row, "deleted" mutes and strikes it. Purely presentational — the
 * consumer's state stays the only owner of what the statuses mean.
 */
export type TableEngineRowStatus = "new" | "dirty" | "deleted";

/** Lifecycle of a cell for the optional CRUD indications: a warning corner mark for "dirty", a destructive one for "invalid". */
export type TableEngineCellStatus = "dirty" | "invalid";

/**
 * Asks the consumer to open its editor for the focused cell: Enter or F2, or
 * a typed printable character (then `initialText` carries it — the
 * type-to-replace flow). Dispatched only for cells whose column is writable
 * via `meta.cellEdit`.
 */
export interface TableEngineCellEditRequest<TData> {
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
export interface TableEngineCellsChangeDetails<TData> {
	readonly source: TableEngineCellsChangeSource;
	readonly changes: readonly TableEngineCellChange<TData>[];
	readonly rejected: readonly TableEngineCellRejection[];
}

// ── Layout ─────────────────────────────────────────────────────────────────

/** The table's look: `grid` (compact, for dense data) or `records` (the records-table look). */
export const TableEngineLookSchema = z.enum(["grid", "records"]);

/** One of the table's looks. */
export type TableEngineLook = z.output<typeof TableEngineLookSchema>;

/**
 * Every layout flag, with its default. Parsed (not trusted) because the grid
 * memoizes the resolved layout by its serialized value: a consumer's inline
 * `tableLayout={{ … }}` object then does not re-publish the grid context on
 * every render.
 */
export const TableEngineTableLayoutSchema = z.object({
	/**
	 * The table's look. `grid` (default): a quiet header in the body's text style and compact rows, for dense data.
	 * `records`: the kit's records-table look — a tinted header with small uppercase titles and tall, roomy rows.
	 */
	look: TableEngineLookSchema.default("grid"),
	dense: z.boolean().default(false),
	/** Roomier rows than the default. `dense` wins when both are set. */
	spacious: z.boolean().default(false),
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
	/** What a third click on a sorted header does: back to ascending ("asc-desc"), or no sort ("asc-desc-none"). */
	sortCycle: z.enum(["asc-desc", "asc-desc-none"]).default("asc-desc-none"),
});

/** The `tableLayout` prop: every flag optional. */
export type TableEngineTableLayout = z.input<typeof TableEngineTableLayoutSchema>;

/** The layout every part reads: every flag resolved to its value. */
export type TableEngineResolvedTableLayout = z.output<typeof TableEngineTableLayoutSchema>;

/**
 * The sticky header's default chrome. Its z-index (`z-40`) keeps it above
 * pinned body cells (`TABLE_ENGINE_PINNED_CELL_Z_INDEX`), which would otherwise
 * paint over it while scrolling vertically.
 */
const DEFAULT_HEADER_STICKY_CLASS_NAME = "sticky top-0 z-40 bg-background/90 backdrop-blur-xs";

/** Class-name overrides per grid part (merged after the grid's own classes). */
export const TableEngineTableClassNamesSchema = z.object({
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
export type TableEngineTableClassNames = z.input<typeof TableEngineTableClassNamesSchema>;

/** The class names every part reads. */
export type TableEngineResolvedTableClassNames = z.output<typeof TableEngineTableClassNamesSchema>;

/** How the body renders while `isLoading`. */
export type TableEngineLoadingMode = "skeleton" | "spinner";

/** z-index of pinned (sticky) cells; the sticky header (z-40) sits above, the editor overlay between. */
export const TABLE_ENGINE_PINNED_CELL_Z_INDEX = 30;

// ── autoSize coordinator ───────────────────────────────────────────────────

/** What one `preview` call reports: the armed column's current and reflowed width. */
export interface TableEngineAutoSizePreview {
	readonly columnId: string;
	readonly current: number;
	readonly size: number;
}

/**
 * Coordinator for `meta.autoSize` columns. Lives at the core level so every
 * table variant and viewport instance shares one application state.
 */
export interface TableEngineAutoSizeController {
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
	readonly preview: (freeSpace: number) => TableEngineAutoSizePreview | null;
	/** Records a width the caller commits for the armed column, so the next measurement keeps reflowing. */
	readonly adopt: (columnId: string, size: number) => void;
}

interface TableEngineAutoSizeApplied {
	readonly columnId: string;
	readonly base: number;
	readonly grown: number;
}

interface TableEngineAutoSizeReflowState {
	applied: TableEngineAutoSizeApplied | null;
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
const tableEngineAutoSizeStates = new WeakMap<object, TableEngineAutoSizeReflowState>();

function getTableEngineAutoSizeState(atoms: object): TableEngineAutoSizeReflowState {
	const existing = tableEngineAutoSizeStates.get(atoms);
	if (existing !== undefined) {
		return existing;
	}
	const created: TableEngineAutoSizeReflowState = { applied: null, settleTimer: null, pendingFreeSpace: 0, lastCommitAt: 0 };
	tableEngineAutoSizeStates.set(atoms, created);
	return created;
}

function findAutoSizeColumn<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineColumn<TData> | undefined {
	return table.getVisibleLeafColumns().find((column) => column.columnDef.meta?.autoSize === true && column.getCanResize());
}

interface TableEngineAutoSizeReflow {
	readonly state: TableEngineAutoSizeReflowState;
	readonly applied: TableEngineAutoSizeApplied;
	readonly target: number;
	readonly maxSize: number;
}

/**
 * The armed column's reflow target at this free space, or `null` when no
 * column is armed or the user has taken the width over. Reads LIVE sizing
 * state (`atoms.columnSizing.get()`), never a render snapshot: a measurement
 * can run between this coordinator's own commit and React's re-render.
 */
function resolveTableEngineAutoSizeReflow<TData extends RowData>(table: TableEngineCoreTable<TData>, freeSpace: number): TableEngineAutoSizeReflow | null {
	const state = getTableEngineAutoSizeState(table.atoms);
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

function reflowTableEngineAutoSize<TData extends RowData>(table: TableEngineCoreTable<TData>, freeSpace: number): boolean {
	const resolved = resolveTableEngineAutoSizeReflow(table, freeSpace);
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
export function createTableEngineAutoSizeController<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineAutoSizeController {
	return {
		preview: (freeSpace: number): TableEngineAutoSizePreview | null => {
			const resolved = resolveTableEngineAutoSizeReflow(table, freeSpace);
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
			const state = getTableEngineAutoSizeState(table.atoms);
			if (state.applied?.columnId === columnId) {
				state.applied = { ...state.applied, grown: size };
			}
		},
		apply: (freeSpace: number): boolean => {
			const state = getTableEngineAutoSizeState(table.atoms);
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
					return reflowTableEngineAutoSize(table, freeSpace);
				}
				if (state.settleTimer !== null) {
					clearTimeout(state.settleTimer);
				}
				state.settleTimer = setTimeout((): void => {
					state.settleTimer = null;
					state.lastCommitAt = Date.now();
					reflowTableEngineAutoSize(table, state.pendingFreeSpace);
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

const tableEngineAutoSizeControllers = new WeakMap<object, TableEngineAutoSizeController>();

/**
 * The one coordinator of a table, keyed on its `atoms` registry: split
 * header/body viewports then cannot apply the growth twice, and the
 * coordinator survives the per-state-change `table` wrapper.
 */
export function getTableEngineAutoSizeController<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineAutoSizeController {
	const existing = tableEngineAutoSizeControllers.get(table.atoms);
	if (existing !== undefined) {
		return existing;
	}
	const created = createTableEngineAutoSizeController(table);
	tableEngineAutoSizeControllers.set(table.atoms, created);
	return created;
}

// ── Context ────────────────────────────────────────────────────────────────

/**
 * The TData-free half of the grid's props, resolved: what every part reads.
 * Row callbacks are bound by row id here (the provider looks the row up and
 * hands the consumer its own typed `row.original`), so no part needs the row
 * type to fire them.
 */
export interface TableEngineLayoutProps {
	readonly tableLayout: TableEngineResolvedTableLayout;
	readonly tableClassNames: TableEngineResolvedTableClassNames;
	readonly loadingMode: TableEngineLoadingMode;
	/** How many skeleton rows a loading body draws; `undefined` draws one page's worth. */
	readonly skeletonRowCount: number | undefined;
	readonly loadingMessage: React.ReactNode;
	readonly fetchingMoreMessage: React.ReactNode;
	readonly allRowsLoadedMessage: React.ReactNode;
	readonly emptyMessage: React.ReactNode;
	readonly rowCreateLabel: React.ReactNode;
	readonly appendRow: React.ReactNode;
	readonly onRowCreate: (() => void) | undefined;
	readonly activeRowId: string | undefined;
	readonly onCellSelectionChange: ((snapshot: TableEngineCellSelectionSnapshot) => void) | undefined;
	readonly onCellsCopy: ((details: TableEngineCopyDetails) => void) | undefined;
	readonly onRowClick: ((rowId: string) => void) | undefined;
	readonly getRowStatus: ((rowId: string) => TableEngineRowStatus | undefined) | undefined;
	readonly getCellStatus: ((rowId: string, columnId: string) => TableEngineCellStatus | undefined) | undefined;
}

/** The typed half of the grid: the table plus every callback that names the row type. */
export interface TableEngineTypedGrid<TData extends RowData> {
	readonly table: TableEngineTableInstance<TData>;
	readonly onRowClick: ((row: TData) => void) | undefined;
	readonly onCellsChange: ((details: TableEngineCellsChangeDetails<TData>) => void) | undefined;
	readonly onCellEditRequest: ((request: TableEngineCellEditRequest<TData>) => void) | undefined;
	readonly getRowStatus: ((row: TData) => TableEngineRowStatus | undefined) | undefined;
	readonly getCellStatus: ((row: TData, columnId: string) => TableEngineCellStatus | undefined) | undefined;
}

/**
 * A function over "the grid's table, whatever its row type". `visit` is
 * generic, so its body can use the typed table and callbacks freely while the
 * caller stays row-type agnostic.
 */
export interface TableEngineGridVisitor<TResult> {
	visit<TData extends RowData>(grid: TableEngineTypedGrid<TData>): TResult;
}

/** What `useTableEngine()` returns. */
export interface TableEngineContextValue {
	readonly props: TableEngineLayoutProps;
	/** The resolved `tableEngine` copy (provider pack + the grid's `labels` override). */
	readonly labels: TableEngineLabels;
	readonly recordCount: number;
	readonly isLoading: boolean;
	/** Stable per-grid prefix for the DOM ids ARIA relations point at. */
	readonly gridId: string;
	readonly autoSize: TableEngineAutoSizeController;
	/** Runs `visitor` against the typed table and callbacks. */
	readonly withGrid: <TResult>(visitor: TableEngineGridVisitor<TResult>) => TResult;
}

const TableEngineContext = React.createContext<TableEngineContextValue | null>(null);

/** The nearest grid's context. Throws outside `<TableEngine>`, which a grid part can never render without. */
export function useTableEngine(): TableEngineContextValue {
	const context = React.useContext(TableEngineContext);
	if (context === null) {
		throw new Error("useTableEngine must be used within <TableEngine>");
	}
	return context;
}

/** The slice of a TanStack store atom the grid subscribes to. */
export interface TableEngineStateAtom<TValue> {
	get(): TValue;
	subscribe(listener: () => void): { unsubscribe(): void };
}

/**
 * Re-renders the caller when one table state atom changes (a column resize in
 * flight paints through this). Pass `select` to subscribe to a slice or a
 * primitive of the atom's value; it must return the same identity for an
 * unchanged input, or every write re-renders.
 */
export function useTableEngineAtom<TValue>(atom: TableEngineStateAtom<TValue>): TValue;
export function useTableEngineAtom<TValue, TSelected>(atom: TableEngineStateAtom<TValue>, select: (value: TValue) => TSelected): TSelected;
export function useTableEngineAtom<TValue, TSelected>(atom: TableEngineStateAtom<TValue>, select?: (value: TValue) => TSelected): TValue | TSelected {
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
export function toTableEngineDomId(value: string): string {
	return value.replace(/[^\w-]/g, "_");
}

// ── TableEngine ───────────────────────────────────────────────────────────────

export interface TableEngineProps<TData extends RowData> {
	/** The consumer's table: `useTable({ features: tableEngineFeatures, columns, data, … })`. */
	readonly table: TableEngineTableInstance<TData>;
	/** Total rows the grid represents (all pages); drives pagination copy and ARIA row counts. */
	readonly recordCount: number;
	/** The grid's parts: a table renderer, pagination, a scroll area, a selection bar. */
	readonly children?: React.ReactNode;
	/** Callback function triggered when a row is clicked. */
	readonly onRowClick?: ((row: TData) => void) | undefined;
	/** Receives every spreadsheet write batch (paste, cut, clear, fill, edit). Absent: copy still works, writes no-op. */
	readonly onCellsChange?: ((details: TableEngineCellsChangeDetails<TData>) => void) | undefined;
	/** Opens the consumer's editor from the keyboard: Enter, F2, or typing on the focused cell. */
	readonly onCellEditRequest?: ((request: TableEngineCellEditRequest<TData>) => void) | undefined;
	/** Fires on every cell-selection change with a resolved snapshot. */
	readonly onCellSelectionChange?: ((snapshot: TableEngineCellSelectionSnapshot) => void) | undefined;
	/** Fires after the grid writes the clipboard (Cmd/Ctrl+C or X, or the native copy/cut events). */
	readonly onCellsCopy?: ((details: TableEngineCopyDetails) => void) | undefined;
	/** Renders an "Add row" affordance as the body's last row; clicking it is the consumer's cue to create one. */
	readonly onRowCreate?: (() => void) | undefined;
	/** Label of the `onRowCreate` affordance; defaults to the `rowCreate` label. */
	readonly rowCreateLabel?: React.ReactNode;
	/** Rendered inside the body after the data rows: the slot a DRAFT row lives in while it is being created (a `<tr>`). */
	readonly appendRow?: React.ReactNode;
	/** The row whose details are open beside the table: marked `aria-current` and tinted, whatever else it is. */
	readonly activeRowId?: string | undefined;
	/** Optional CRUD indication per row; return `undefined` for none. */
	readonly getRowStatus?: ((row: TData) => TableEngineRowStatus | undefined) | undefined;
	/** Optional CRUD indication per cell: the corner mark on cells the consumer tracks as edited or invalid. */
	readonly getCellStatus?: ((row: TData, columnId: string) => TableEngineCellStatus | undefined) | undefined;
	/** Whether the table is in a loading state. */
	readonly isLoading?: boolean;
	/** Overrides some of the `tableEngine` copy for this grid. Keep it a module constant. */
	readonly labels?: TableEngineLabelsOverride | undefined;
	/** The visual style of the loading state. */
	readonly loadingMode?: TableEngineLoadingMode;
	/** How many skeleton rows `loadingMode="skeleton"` draws. Defaults to the page size. */
	readonly skeletonRowCount?: number | undefined;
	/** Message to display when `loadingMode` is `"spinner"`. */
	readonly loadingMessage?: React.ReactNode;
	/** Message to display while `TableEngineTableVirtual` is fetching more rows. */
	readonly fetchingMoreMessage?: React.ReactNode;
	/** Message to display when virtual infinite scroll reaches the end. */
	readonly allRowsLoadedMessage?: React.ReactNode;
	/** Message to display when the table is empty. */
	readonly emptyMessage?: React.ReactNode;
	/** Configuration for table layout and features. */
	readonly tableLayout?: TableEngineTableLayout;
	/** Custom CSS classes for various table parts. */
	readonly tableClassNames?: TableEngineTableClassNames;
}

const EMPTY_LAYOUT_KEY = "{}";

/** Structural memo of a plain-data prop: re-parsed only when its serialized value changes. */
function useParsedLayout<TSchema extends z.ZodType>(schema: TSchema, value: object | undefined): z.output<TSchema> {
	const key = value === undefined ? EMPTY_LAYOUT_KEY : JSON.stringify(value);
	return React.useMemo((): z.output<TSchema> => schema.parse(JSON.parse(key)), [schema, key]);
}

/**
 * Provides one grid to its parts. Renders no DOM of its own (wrap the parts
 * in `TableEngineContainer`), so it has no ref to forward.
 */
export function TableEngine<TData extends RowData>({
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
	activeRowId,
	getRowStatus,
	getCellStatus,
	isLoading = false,
	labels: labelsOverride,
	loadingMode = "skeleton",
	skeletonRowCount,
	loadingMessage,
	fetchingMoreMessage,
	allRowsLoadedMessage,
	emptyMessage,
	tableLayout,
	tableClassNames,
}: TableEngineProps<TData>): React.JSX.Element {
	const gridId = React.useId();
	const labels = useUiKitLabels("tableEngine", labelsOverride);
	const resolvedLayout = useParsedLayout(TableEngineTableLayoutSchema, tableLayout);
	const resolvedClassNames = useParsedLayout(TableEngineTableClassNamesSchema, tableClassNames);

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

	// One coordinator per table (see getTableEngineAutoSizeController).
	const autoSize = React.useMemo((): TableEngineAutoSizeController => getTableEngineAutoSizeController(table), [table]);

	const layoutProps = React.useMemo(
		(): TableEngineLayoutProps => ({
			tableLayout: resolvedLayout,
			tableClassNames: resolvedClassNames,
			loadingMode,
			skeletonRowCount,
			loadingMessage,
			fetchingMoreMessage,
			allRowsLoadedMessage,
			emptyMessage,
			rowCreateLabel,
			appendRow,
			onRowCreate,
			activeRowId,
			onCellSelectionChange,
			onCellsCopy,
			onRowClick:
				onRowClick === undefined
					? undefined
					: (rowId: string): void => {
							onRowClick(table.getRow(rowId, true).original);
						},
			getRowStatus: getRowStatus === undefined ? undefined : (rowId: string): TableEngineRowStatus | undefined => getRowStatus(table.getRow(rowId, true).original),
			getCellStatus:
				getCellStatus === undefined
					? undefined
					: (rowId: string, columnId: string): TableEngineCellStatus | undefined => getCellStatus(table.getRow(rowId, true).original, columnId),
		}),
		[
			resolvedLayout,
			resolvedClassNames,
			loadingMode,
			skeletonRowCount,
			loadingMessage,
			fetchingMoreMessage,
			allRowsLoadedMessage,
			emptyMessage,
			rowCreateLabel,
			appendRow,
			onRowCreate,
			activeRowId,
			onCellSelectionChange,
			onCellsCopy,
			onRowClick,
			getRowStatus,
			getCellStatus,
			table,
		],
	);

	const typedGrid = React.useMemo(
		(): TableEngineTypedGrid<TData> => ({ table, onRowClick, onCellsChange, onCellEditRequest, getRowStatus, getCellStatus }),
		[table, onRowClick, onCellsChange, onCellEditRequest, getRowStatus, getCellStatus],
	);

	const value = React.useMemo(
		(): TableEngineContextValue => ({
			props: layoutProps,
			labels,
			recordCount,
			isLoading,
			gridId,
			autoSize,
			withGrid: <TResult,>(visitor: TableEngineGridVisitor<TResult>): TResult => visitor.visit(typedGrid),
		}),
		[layoutProps, labels, recordCount, isLoading, gridId, autoSize, typedGrid],
	);

	return <TableEngineContext.Provider value={value}>{children}</TableEngineContext.Provider>;
}

// ── TableEngineContainer ──────────────────────────────────────────────────────

export const tableEngineContainerVariants = cva(
	// relative: anchors floating chrome composed inside the container, like the fill-drag preview outline.
	"relative w-full overflow-hidden",
	{
		variants: {
			/** `default` (no frame), `bordered` (a rounded border around the grid) or `records` (the records look's tighter frame). */
			variant: {
				default: "",
				bordered: "rounded-lg border border-border",
				records: "rounded-md border border-border",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface TableEngineContainerProps extends React.ComponentProps<"div">, VariantProps<typeof tableEngineContainerVariants> {}

/** The grid's outer box: clips the scroll area and anchors the grid's floating chrome. */
export const TableEngineContainer = React.forwardRef<HTMLDivElement, TableEngineContainerProps>(function TableEngineContainer(
	{ className, variant, ...props },
	ref,
): React.JSX.Element {
	return <div ref={ref} data-slot="table-engine" className={cn(tableEngineContainerVariants({ variant }), className)} {...props} />;
});
