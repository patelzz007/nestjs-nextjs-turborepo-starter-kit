"use client";

// The data grid table's types, constants, cell variants and table geometry (enhancement 8.1: split from data-grid-table.tsx).

import {
	DATA_GRID_PINNED_CELL_Z_INDEX,
	type DataGridColumn,
	type DataGridCoreTable,
	type DataGridFeatures,
	type DataGridGridVisitor,
	type DataGridResolvedTableLayout,
	getDataGridHeaderSpans,
} from "@workspace/ui/components/data-grid/data-grid";
import { type Header, type Row, type RowData, flexRender } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import * as React from "react";

/** A header cell of a data grid. */
export type DataGridHeader<TData extends RowData> = Header<DataGridFeatures, TData>;

/** A body row of a data grid. */
export type DataGridRow<TData extends RowData> = Row<DataGridFeatures, TData>;

/** Which edge of the scrolled body a pinned row borders. */
export type DataGridTablePinnedBoundary = "top" | "bottom";

/** Inline style that may also carry CSS custom properties (`--col-x-size`). */
export type DataGridStyle = React.CSSProperties & Partial<Record<`--${string}`, string | number>>;

/** The cell padding scale the `dense` layout flag picks. */
export type DataGridCellSpacingSize = "default" | "dense";

/** The inclusive center-column window a column-virtualized row renders. */
export interface DataGridTableCenterWindow {
	readonly start: number;
	readonly end: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Horizontal offset per tree depth level of `DataGridTableRowExpand`. */
export const DEFAULT_TREE_INDENT_PX = 20;

/** Arrow-key step of a focused resize handle. */
export const RESIZE_KEYBOARD_STEP_PX = 10;

/** A drag may shrink a column to just above zero, never past it. */
export const RESIZE_MIN_DELTA_RATIO = -0.999999;

/** Committed widths keep two decimals. */
export const SIZE_ROUNDING_FACTOR = 100;

/** The resize indicator's head never collapses below this height. */
export const INDICATOR_MIN_HEAD_HEIGHT_PX = 6;

/** Sub-pixel overflow is not overflow. */
export const OVERFLOW_TOLERANCE_PX = 0.5;

export const PRIMARY_MOUSE_BUTTON = 0;

/** `aria-rowindex` of the header row; body rows follow it (1-based). */
export const HEADER_ROW_ARIA_INDEX = 1;
export const BODY_ROW_ARIA_INDEX_OFFSET = 2;

/** The filler strip is one extra column when columns are resizable. */
export const FILL_COLUMN_SPAN = 1;

export const NON_PASSIVE_LISTENER: AddEventListenerOptions = { passive: false };

export const FILL_WIDTH_STYLE: React.CSSProperties = { width: "var(--data-grid-fill-size, 0px)" };
export const FILL_WIDTH_COLLAPSED_STYLE: React.CSSProperties = { width: 0 };

/** Every shared `[role=…]`/element a cell press must leave to the control under it. */
export const CELL_INTERACTIVE_SELECTOR =
	'button, a, input, select, textarea, [contenteditable], [role="checkbox"], [data-cell-interactive], [data-slot="data-grid-table-row-expand"], [data-slot="data-grid-cell-fill-handle"]';

/** Pinned cells hide scrolled content behind an opaque surface token. */
export const PINNED_SURFACE = "var(--data-grid-surface,var(--data-grid-card-surface,var(--background)))";

export const PINNED_EDGE_SHADOW_CLASSES =
	"[&[data-pinned=end][data-last-col=end]]:shadow-[inset_calc(1px*var(--data-grid-dir,1))_0_0_0_var(--border)] [&[data-pinned=start][data-last-col=start]]:shadow-[inset_calc(-1px*var(--data-grid-dir,1))_0_0_0_var(--border)]";

export const BODY_ROW_BOTTOM_BORDER_CLASSES = "[&:not(:last-child)>td]:border-b";

// ── Variants ───────────────────────────────────────────────────────────────

export const dataGridHeaderCellVariants = cva("relative h-10 text-left align-middle font-medium text-foreground rtl:text-right [&:has([role=checkbox])]:pe-0", {
	variants: { size: { default: "px-3", dense: "h-8 px-2" } },
	defaultVariants: { size: "default" },
});

export const dataGridBodyCellVariants = cva("align-middle", {
	variants: { size: { default: "px-3 py-2", dense: "px-2 py-1.5" } },
	defaultVariants: { size: "default" },
});

/**
 * The truncation wrapper used when cell selection is on: it consumes the td
 * padding with negative margins and restores it as its own, so its overflow
 * clips at exactly the boundary the td's `truncate` used to clip at.
 */
export const dataGridBodyCellTruncateVariants = cva("truncate", {
	variants: { size: { default: "-mx-3 -my-2 px-3 py-2", dense: "-mx-2 -my-1.5 px-2 py-1.5" } },
	defaultVariants: { size: "default" },
});

export const dataGridFooterCellVariants = cva("align-middle font-medium text-secondary-foreground/80", {
	variants: { size: { default: "px-3 py-2", dense: "px-2 py-1.5" } },
	defaultVariants: { size: "default" },
});

/** The fill handle's look (`tableLayout.cellFillHandleVariant`). */
export const dataGridFillHandleVariants = cva("absolute z-10 cursor-crosshair in-data-[cell-editing]:hidden in-data-[cell-selecting]:hidden", {
	variants: {
		variant: {
			// Rides the corner point, clamped where straddling would break: at the
			// grid's own boundary and beside a pinned column.
			ring: "-end-[5px] -bottom-[5px] size-[11px] rounded-full border-2 border-primary bg-background in-[td:has(+[data-slot=data-grid-table-fill-body-cell]+td[data-pinned])]:end-0 in-[td:has(+[data-slot=data-grid-table-fill-body-cell]:last-child)]:end-0 in-[td:has(+td[data-pinned])]:end-0 in-[td:last-child]:end-0 in-[tr:last-child]:bottom-0",
			// Abuts the cell borders from inside, so it never leaves the grid.
			square: "end-0 bottom-0 size-[5px] bg-primary",
			dot: "end-0 bottom-0 size-[9px] rounded-full border border-background bg-primary",
		},
	},
	defaultVariants: { variant: "dot" },
});

export function spacingSize(layout: DataGridResolvedTableLayout): DataGridCellSpacingSize {
	return layout.dense ? "dense" : "default";
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/** Sticky offsets and stacking for a pinned column (logical insets, so RTL mirrors). */
export function getPinningStyles<TData extends RowData>(column: DataGridColumn<TData>): React.CSSProperties {
	const isPinned = column.getIsPinned();
	if (isPinned === false) {
		return { width: column.getSize() };
	}
	return {
		insetInlineStart: isPinned === "start" ? `${String(column.getStart("start"))}px` : undefined,
		insetInlineEnd: isPinned === "end" ? `${String(column.getAfter("end"))}px` : undefined,
		position: "sticky",
		transform: "translateZ(0)",
		contain: "paint",
		width: column.getSize(),
		zIndex: DATA_GRID_PINNED_CELL_Z_INDEX,
		backgroundClip: "padding-box",
	};
}

/**
 * The indent contract for tree rows: `DataGridTableRowExpand` consumes it, and
 * custom cells can reuse it for depth alignment without the built-in toggle.
 */
export function getDataGridTreeIndentStyle<TData extends RowData>(row: DataGridRow<TData>, indent: number = DEFAULT_TREE_INDENT_PX): DataGridStyle {
	return { "--data-grid-tree-padding": `${String(row.depth * indent)}px` };
}

/**
 * Nearest scroll-area viewport that belongs to THIS grid. A viewport outside
 * the grid's own container (a page-level ScrollArea) would make the width
 * measurement — and the virtualizer — bind the wrong box.
 */
export function getDataGridScrollAreaViewport(node: HTMLElement): HTMLElement | null {
	const scrollViewport = node.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
	if (scrollViewport === null) {
		return null;
	}
	const gridContainer = node.closest('[data-slot="data-grid"]');
	if (gridContainer !== null && !gridContainer.contains(scrollViewport)) {
		return null;
	}
	return scrollViewport;
}

/** The box whose width the fill strip tops up to: the grid's scroll viewport, else the table viewport's parent. */
export function getDataGridTableFillMeasurementTarget(node: HTMLElement): HTMLElement {
	return getDataGridScrollAreaViewport(node) ?? node.parentElement ?? node;
}

/**
 * `true` for an event that reached this element only through a React portal
 * (an in-cell Select or popover): those must not start a cell selection or
 * fire `onRowClick`. The Node check uses the element's own realm, so a grid
 * mounted in an iframe still recognises its targets.
 */
export function isDataGridPortalEvent(event: { readonly currentTarget: Element; readonly target: EventTarget | null }): boolean {
	const { currentTarget, target } = event;
	const view = currentTarget.ownerDocument.defaultView;
	if (view === null || !(target instanceof view.Node)) {
		return true;
	}
	return !currentTarget.contains(target);
}

/** Interactive descendants (buttons, links, editors, checkboxes, `data-cell-interactive`) keep their own press semantics. */
export function isDataGridCellInteractiveTarget(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(CELL_INTERACTIVE_SELECTOR) !== null;
}

/** Rows split by pin position (all center rows when row pinning is off). */
export interface DataGridTableRowSections<TData extends RowData> {
	readonly topRows: readonly DataGridRow<TData>[];
	readonly centerRows: readonly DataGridRow<TData>[];
	readonly bottomRows: readonly DataGridRow<TData>[];
}

export function getDataGridTableRowSections<TData extends RowData>(table: DataGridCoreTable<TData>, rowsPinnable: boolean): DataGridTableRowSections<TData> {
	if (!rowsPinnable) {
		return { topRows: [], centerRows: table.getRowModel().rows, bottomRows: [] };
	}
	return { topRows: table.getTopRows(), centerRows: table.getCenterRows(), bottomRows: table.getBottomRows() };
}

/** One rendered body row and, for the last top-pinned / first bottom-pinned row, the boundary it draws. */
export interface DataGridTableResolvedRow<TData extends RowData> {
	readonly row: DataGridRow<TData>;
	readonly pinnedBoundary: DataGridTablePinnedBoundary | undefined;
}

export function getDataGridTableResolvedRows<TData extends RowData>(table: DataGridCoreTable<TData>, rowsPinnable: boolean): DataGridTableResolvedRow<TData>[] {
	const { topRows, centerRows, bottomRows } = getDataGridTableRowSections(table, rowsPinnable);
	const lastTopIndex = topRows.length - 1;
	const top = topRows.map((row, index): DataGridTableResolvedRow<TData> => ({
		row,
		pinnedBoundary: index === lastTopIndex && (centerRows.length > 0 || bottomRows.length > 0) ? "top" : undefined,
	}));
	const center = centerRows.map((row): DataGridTableResolvedRow<TData> => ({ row, pinnedBoundary: undefined }));
	const bottom = bottomRows.map((row, index): DataGridTableResolvedRow<TData> => ({
		row,
		pinnedBoundary: index === 0 && (centerRows.length > 0 || topRows.length > 0) ? "bottom" : undefined,
	}));
	return [...top, ...center, ...bottom];
}

/** Visible leaf columns in render order: start, center, end. */
export function getDataGridTableOrderedVisibleColumns<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridColumn<TData>[] {
	return [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getEndVisibleLeafColumns()];
}

/** Whether a column renders first / last in its row (pinning-aware, unlike `column.getIndex()`). */
export interface DataGridTableColumnEdges {
	readonly isFirst: boolean;
	readonly isLast: boolean;
}

export function getDataGridTableColumnEdges<TData extends RowData>(table: DataGridCoreTable<TData>, columnId: string): DataGridTableColumnEdges {
	const ordered = getDataGridTableOrderedVisibleColumns(table);
	return { isFirst: ordered.at(0)?.id === columnId, isLast: ordered.at(-1)?.id === columnId };
}

/** One head row: every header, the cells each pin family renders, and the headers a span cell covers. */
export interface DataGridTableMergedHeaderGroup<TData extends RowData> {
	readonly id: string;
	readonly headers: DataGridHeader<TData>[];
	readonly startHeaders: DataGridHeader<TData>[];
	readonly centerHeaders: DataGridHeader<TData>[];
	readonly endHeaders: DataGridHeader<TData>[];
	/** Headers a `meta.headerColSpan` cell covers, by that cell's header id. */
	readonly coveredHeaders: ReadonlyMap<string, DataGridHeader<TData>[]>;
}

/** The headers a span owner covers in one rendered row (same rowSpan, right after it). */
export function collectCoveredHeaders<TData extends RowData>(
	rendered: readonly DataGridHeader<TData>[],
	ownerIndex: number,
	owner: DataGridHeader<TData>,
	coveredColumns: readonly DataGridColumn<TData>[],
): DataGridHeader<TData>[] {
	const covered: DataGridHeader<TData>[] = [];
	for (const coveredColumn of coveredColumns) {
		const next = rendered.at(ownerIndex + 1 + covered.length);
		if (next?.column.id !== coveredColumn.id || next.rowSpan !== owner.rowSpan) {
			break;
		}
		covered.push(next);
	}
	return covered;
}

/**
 * Head rows merged across the three pin families, with TanStack's merged
 * runs (rowSpan 0 cells are not rendered) and `meta.headerColSpan` spans
 * resolved: a covered header renders no cell of its own.
 */
export function getDataGridTableMergedHeaderGroups<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridTableMergedHeaderGroup<TData>[] {
	const startGroups = table.getStartHeaderGroups();
	const centerGroups = table.getCenterHeaderGroups();
	const endGroups = table.getEndHeaderGroups();
	const groupCount = Math.max(startGroups.length, centerGroups.length, endGroups.length);
	const spans = getDataGridHeaderSpans(table);
	const coveredHeaders = new Map<string, DataGridHeader<TData>[]>();

	const getRenderedHeaders = (headers: readonly DataGridHeader<TData>[]): DataGridHeader<TData>[] => {
		const rendered = headers.filter((header) => header.rowSpan !== 0);
		if (spans.size === 0) {
			return rendered;
		}
		const cells: DataGridHeader<TData>[] = [];
		let index = 0;
		while (index < rendered.length) {
			const header = rendered.at(index);
			if (header === undefined) {
				break;
			}
			cells.push(header);
			const coveredColumns = header.column.columns.length > 0 ? undefined : spans.get(header.column.id);
			const covered = coveredColumns === undefined ? [] : collectCoveredHeaders(rendered, index, header, coveredColumns);
			if (covered.length > 0) {
				coveredHeaders.set(header.id, covered);
			}
			index += 1 + covered.length;
		}
		return cells;
	};

	return Array.from({ length: groupCount }, (_, index): DataGridTableMergedHeaderGroup<TData> => {
		const startGroup = startGroups.at(index);
		const centerGroup = centerGroups.at(index);
		const endGroup = endGroups.at(index);
		const groupIds = [startGroup?.id, centerGroup?.id, endGroup?.id].filter((id): id is string => id !== undefined && id !== "");
		const startHeaders = startGroup?.headers ?? [];
		const centerHeaders = centerGroup?.headers ?? [];
		const endHeaders = endGroup?.headers ?? [];
		return {
			id: groupIds.length > 0 ? groupIds.join(":") : `header-group-${String(index)}`,
			headers: [...startHeaders, ...centerHeaders, ...endHeaders],
			startHeaders: getRenderedHeaders(startHeaders),
			centerHeaders: getRenderedHeaders(centerHeaders),
			endHeaders: getRenderedHeaders(endHeaders),
			coveredHeaders,
		};
	});
}

/** Every header the head rows may render: the unpinned tree plus each pinning family's. */
export function getDataGridTableAllFlatHeaders<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridHeader<TData>[] {
	return [...table.getFlatHeaders(), ...table.getStartFlatHeaders(), ...table.getCenterFlatHeaders(), ...table.getEndFlatHeaders()];
}

/**
 * The leaf columns under a header, in render order: a group's leaves, or the
 * column itself for a leaf or a merged cell (v9 `getLeafHeaders` also returns
 * the header itself and every intermediate header, so those are dropped).
 */
export function getDataGridHeaderLeafColumns<TData extends RowData>(header: DataGridHeader<TData>): DataGridColumn<TData>[] {
	if (header.subHeaders.length === 0) {
		return [header.column];
	}
	const leafColumns = header
		.getLeafHeaders()
		.filter((leafHeader) => leafHeader.subHeaders.length === 0)
		.map((leafHeader) => leafHeader.column);
	return leafColumns.length > 0 ? leafColumns : [header.column];
}

/** A placeholder heading a merged run renders its column's header; one left unmerged renders nothing. */
export function renderDataGridTableHeadCellContent<TData extends RowData>(header: DataGridHeader<TData>): React.ReactNode {
	return header.isPlaceholder && header.rowSpan <= 1 ? null : flexRender(header.column.columnDef.header, header.getContext());
}

/** A span's handle drives its last covered leaf; end-pinned, it sits on the start edge and drives the owner. */
export function getDataGridHeadCellResizeHeader<TData extends RowData>(
	header: DataGridHeader<TData>,
	coveredHeaders?: readonly DataGridHeader<TData>[],
): DataGridHeader<TData> {
	if (coveredHeaders === undefined || header.column.getIsPinned() === "end") {
		return header;
	}
	return coveredHeaders.at(-1) ?? header;
}

/** The width expression of a head cell: its own size variable, or the sum of a span's. */
export function getDataGridHeadCellSizeVar<TData extends RowData>(header: DataGridHeader<TData>, coveredHeaders: readonly DataGridHeader<TData>[] = []): string {
	if (coveredHeaders.length === 0) {
		return `calc(var(--header-${header.id}-size) * 1px)`;
	}
	const sizes = [header, ...coveredHeaders].map((spanned) => `var(--header-${spanned.id}-size)`);
	return `calc((${sizes.join(" + ")}) * 1px)`;
}

export function hasDataGridTableRightPinnedColumns<TData extends RowData>(table: DataGridCoreTable<TData>): boolean {
	return table.atoms.columnPinning.get().end.length > 0;
}

/** A `meta.fillWidth` column absorbs the free space itself, so the fill cells collapse. */
export function hasDataGridFillColumn<TData extends RowData>(table: DataGridCoreTable<TData>): boolean {
	return table.getVisibleLeafColumns().some((column) => column.columnDef.meta?.fillWidth === true);
}

/** Which edge of a leaf column's header draws a resting divider line, or `null` for none. */
export function getDataGridHeaderLineEdge<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	layout: DataGridResolvedTableLayout,
	column: DataGridColumn<TData>,
): "start" | "end" | null {
	if (!layout.columnsResizable || !column.getCanResize()) {
		return null;
	}
	const isPinned = column.getIsPinned();
	if (isPinned === "end") {
		return layout.columnsPinnable ? null : "start";
	}
	if (getDataGridTableColumnEdges(table, column.id).isLast) {
		return null;
	}
	if (isPinned === "start") {
		return layout.columnsPinnable ? null : "end";
	}
	if (layout.cellBorder) {
		return null;
	}
	if (layout.columnsPinnable && column.getIsLastColumn("center") && hasDataGridTableRightPinnedColumns(table)) {
		return null;
	}
	return "end";
}

export const HAS_END_PINNED_VISITOR: DataGridGridVisitor<boolean> = { visit: (grid) => hasDataGridTableRightPinnedColumns(grid.table) };
export const VISIBLE_LEAF_COUNT_VISITOR: DataGridGridVisitor<number> = { visit: (grid) => getDataGridTableOrderedVisibleColumns(grid.table).length };
export const IS_MULTI_LEVEL_HEADER_VISITOR: DataGridGridVisitor<boolean> = { visit: (grid) => grid.table.getHeaderGroups().length > 1 };
/** The table's atoms do not depend on the row type; the registry is the same object for the table's lifetime. */
export type DataGridAtoms = DataGridCoreTable<RowData>["atoms"];
export const ATOMS_VISITOR: DataGridGridVisitor<DataGridAtoms> = { visit: (grid) => grid.table.atoms };
/** The table's methods read live state, so the returned getter stays valid across renders. */
export const TOTAL_SIZE_GETTER_VISITOR: DataGridGridVisitor<() => number> = {
	visit: (grid) => {
		const { table } = grid;
		return (): number => table.getTotalSize();
	},
};
