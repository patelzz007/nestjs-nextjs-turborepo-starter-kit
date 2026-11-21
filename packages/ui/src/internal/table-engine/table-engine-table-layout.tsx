"use client";

// The data grid table's types, constants, cell variants and table geometry (enhancement 8.1: split from table-engine-table.tsx).

import {
	TABLE_ENGINE_PINNED_CELL_Z_INDEX,
	type TableEngineColumn,
	type TableEngineCoreTable,
	type TableEngineFeatures,
	type TableEngineGridVisitor,
	type TableEngineLook,
	type TableEngineResolvedTableLayout,
	getTableEngineHeaderSpans,
} from "./table-engine";
import { cn } from "@workspace/ui/lib/core/utils";
import { isDataTableUtilityColumnId } from "@workspace/ui-kit-logic";
import { type Header, type Row, type RowData, flexRender } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import * as React from "react";

/** A header cell of a data grid. */
export type TableEngineHeader<TData extends RowData> = Header<TableEngineFeatures, TData>;

/** A body row of a data grid. */
export type TableEngineRow<TData extends RowData> = Row<TableEngineFeatures, TData>;

/** Which edge of the scrolled body a pinned row borders. */
export type TableEngineTablePinnedBoundary = "top" | "bottom";

/** Inline style that may also carry CSS custom properties (`--col-x-size`). */
export type TableEngineStyle = React.CSSProperties & Partial<Record<`--${string}`, string | number>>;

/** The cell padding scale the `dense` and `spacious` layout flags pick. */
export type TableEngineCellSpacingSize = "default" | "dense" | "spacious";

/** The inclusive center-column window a column-virtualized row renders. */
export interface TableEngineTableCenterWindow {
	readonly start: number;
	readonly end: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Horizontal offset per tree depth level of `TableEngineTableRowExpand`. */
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

export const FILL_WIDTH_STYLE: React.CSSProperties = { width: "var(--table-engine-fill-size, 0px)" };
export const FILL_WIDTH_COLLAPSED_STYLE: React.CSSProperties = { width: 0 };

/** Every shared `[role=…]`/element a cell press must leave to the control under it. */
export const CELL_INTERACTIVE_SELECTOR =
	'button, a, input, select, textarea, [contenteditable], [role="checkbox"], [data-cell-interactive], [data-slot="table-engine-table-row-expand"], [data-slot="table-engine-cell-fill-handle"]';

/** Pinned cells hide scrolled content behind an opaque surface token. */
export const PINNED_SURFACE = "var(--table-engine-surface,var(--table-engine-card-surface,var(--background)))";

export const PINNED_EDGE_SHADOW_CLASSES =
	"[&[data-pinned=end][data-last-col=end]]:shadow-[inset_calc(1px*var(--table-engine-dir,1))_0_0_0_var(--border)] [&[data-pinned=start][data-last-col=start]]:shadow-[inset_calc(-1px*var(--table-engine-dir,1))_0_0_0_var(--border)]";

export const BODY_ROW_BOTTOM_BORDER_CLASSES = "[&:not(:last-child)>td]:border-b";

// ── Variants ───────────────────────────────────────────────────────────────

/** The size variant every look shares: each look sets its own padding per size through compound variants. */
const SPACING_SIZE_VARIANT: Readonly<Record<TableEngineCellSpacingSize, string>> = { default: "", dense: "", spacious: "" };

export const tableEngineHeaderCellVariants = cva("relative text-left align-middle rtl:text-right [&:has([role=checkbox])]:pe-0", {
	variants: {
		look: {
			grid: "font-medium text-foreground",
			// The records look: a tinted band with small, spaced, uppercase titles.
			records: "bg-muted/30 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
		},
		size: SPACING_SIZE_VARIANT,
	},
	compoundVariants: [
		{ look: "grid", size: "default", className: "h-10 px-3" },
		{ look: "grid", size: "dense", className: "h-8 px-2" },
		{ look: "grid", size: "spacious", className: "h-12 px-4" },
		{ look: "records", size: "default", className: "h-11 px-4" },
		{ look: "records", size: "dense", className: "h-9 px-3" },
		{ look: "records", size: "spacious", className: "h-12 px-5" },
	],
	defaultVariants: { look: "grid", size: "default" },
});

/** Cell padding per look and size; the body, footer and truncation wrapper share it. */
const CELL_PADDING: Readonly<Record<TableEngineLook, Readonly<Record<TableEngineCellSpacingSize, string>>>> = {
	grid: { default: "px-3 py-2", dense: "px-2 py-1.5", spacious: "px-4 py-3.5" },
	records: { default: "p-4", dense: "px-3 py-2", spacious: "p-5" },
};

/** The truncation wrapper's negative margins: the exact inverse of `CELL_PADDING`. */
const CELL_PADDING_INVERSE: Readonly<Record<TableEngineLook, Readonly<Record<TableEngineCellSpacingSize, string>>>> = {
	grid: { default: "-mx-3 -my-2", dense: "-mx-2 -my-1.5", spacious: "-mx-4 -my-3.5" },
	records: { default: "-m-4", dense: "-mx-3 -my-2", spacious: "-m-5" },
};

/** The look and size a cell is drawn at. */
export interface TableEngineCellLook {
	readonly look: TableEngineLook;
	readonly size: TableEngineCellSpacingSize;
}

/** A body cell's padding. */
export function tableEngineBodyCellVariants({ look, size }: TableEngineCellLook): string {
	return cn("align-middle", CELL_PADDING[look][size]);
}

/**
 * The truncation wrapper used when cell selection is on: it consumes the td
 * padding with negative margins and restores it as its own, so its overflow
 * clips at exactly the boundary the td's `truncate` used to clip at.
 */
export function tableEngineBodyCellTruncateVariants({ look, size }: TableEngineCellLook): string {
	return cn("truncate", CELL_PADDING_INVERSE[look][size], CELL_PADDING[look][size]);
}

/** A footer cell: the body's padding, in a quieter, heavier text. */
export function tableEngineFooterCellVariants({ look, size }: TableEngineCellLook): string {
	return cn("align-middle font-medium text-secondary-foreground/80", CELL_PADDING[look][size]);
}

/** A layout's look and spacing size, for the cell helpers above. */
export function cellLookOf(layout: TableEngineResolvedTableLayout): TableEngineCellLook {
	return { look: layout.look, size: spacingSize(layout) };
}

/** A body row's hover and selected tints per look. */
export const TABLE_ENGINE_BODY_ROW_TINT_CLASSES: Readonly<Record<TableEngineLook, string>> = {
	grid: "hover:bg-muted/40 data-[state=selected]:bg-muted/50",
	records: "hover:bg-muted/50 data-[state=selected]:bg-muted",
};

/** The fill handle's look (`tableLayout.cellFillHandleVariant`). */
export const tableEngineFillHandleVariants = cva("absolute z-10 cursor-crosshair in-data-[cell-editing]:hidden in-data-[cell-selecting]:hidden", {
	variants: {
		variant: {
			// Rides the corner point, clamped where straddling would break: at the
			// grid's own boundary and beside a pinned column.
			ring: "-end-[5px] -bottom-[5px] size-[11px] rounded-full border-2 border-primary bg-background in-[td:has(+[data-slot=table-engine-table-fill-body-cell]+td[data-pinned])]:end-0 in-[td:has(+[data-slot=table-engine-table-fill-body-cell]:last-child)]:end-0 in-[td:has(+td[data-pinned])]:end-0 in-[td:last-child]:end-0 in-[tr:last-child]:bottom-0",
			// Abuts the cell borders from inside, so it never leaves the grid.
			square: "end-0 bottom-0 size-[5px] bg-primary",
			dot: "end-0 bottom-0 size-[9px] rounded-full border border-background bg-primary",
		},
	},
	defaultVariants: { variant: "dot" },
});

export function spacingSize(layout: TableEngineResolvedTableLayout): TableEngineCellSpacingSize {
	if (layout.dense) {
		return "dense";
	}
	return layout.spacious ? "spacious" : "default";
}

/**
 * Classes that differ per look and spacing size outside the cell variants: the header band, the group rule, the row
 * toggle, the add-row button and the body row's least height (the records look keeps its tall rows).
 */
export interface TableEngineSpacingClasses {
	readonly headBand: string;
	readonly headBandBordered: string;
	readonly groupRule: string;
	readonly rowToggle: string;
	readonly appendRow: string;
	readonly bodyRow: string;
}

export const TABLE_ENGINE_SPACING_CLASSES: Readonly<Record<TableEngineLook, Readonly<Record<TableEngineCellSpacingSize, TableEngineSpacingClasses>>>> = {
	grid: {
		dense: { headBand: "h-8", headBandBordered: "h-[calc(--spacing(8)-1px)]", groupRule: "inset-x-2", rowToggle: "size-6", appendRow: "h-8 px-2", bodyRow: "" },
		default: { headBand: "h-10", headBandBordered: "h-[calc(--spacing(10)-1px)]", groupRule: "inset-x-3", rowToggle: "size-7", appendRow: "h-9", bodyRow: "" },
		spacious: { headBand: "h-12", headBandBordered: "h-[calc(--spacing(12)-1px)]", groupRule: "inset-x-4", rowToggle: "size-8", appendRow: "h-11 px-4", bodyRow: "" },
	},
	records: {
		dense: { headBand: "h-9", headBandBordered: "h-[calc(--spacing(9)-1px)]", groupRule: "inset-x-3", rowToggle: "size-6", appendRow: "h-9 px-3", bodyRow: "h-12" },
		default: { headBand: "h-11", headBandBordered: "h-[calc(--spacing(11)-1px)]", groupRule: "inset-x-4", rowToggle: "size-7", appendRow: "h-11 px-4", bodyRow: "h-18" },
		spacious: { headBand: "h-12", headBandBordered: "h-[calc(--spacing(12)-1px)]", groupRule: "inset-x-5", rowToggle: "size-8", appendRow: "h-12 px-5", bodyRow: "h-20" },
	},
};

/** The spacing classes for a layout's look and size. */
export function spacingClassesOf(layout: TableEngineResolvedTableLayout): TableEngineSpacingClasses {
	return TABLE_ENGINE_SPACING_CLASSES[layout.look][spacingSize(layout)];
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/** Sticky offsets and stacking for a pinned column (logical insets, so RTL mirrors). */
export function getPinningStyles<TData extends RowData>(column: TableEngineColumn<TData>): React.CSSProperties {
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
		zIndex: TABLE_ENGINE_PINNED_CELL_Z_INDEX,
		backgroundClip: "padding-box",
	};
}

/**
 * The indent contract for tree rows: `TableEngineTableRowExpand` consumes it, and
 * custom cells can reuse it for depth alignment without the built-in toggle.
 */
export function getTableEngineTreeIndentStyle<TData extends RowData>(row: TableEngineRow<TData>, indent: number = DEFAULT_TREE_INDENT_PX): TableEngineStyle {
	return { "--table-engine-tree-padding": `${String(row.depth * indent)}px` };
}

/**
 * Nearest scroll-area viewport that belongs to THIS grid. A viewport outside
 * the grid's own container (a page-level ScrollArea) would make the width
 * measurement — and the virtualizer — bind the wrong box.
 */
export function getTableEngineScrollAreaViewport(node: HTMLElement): HTMLElement | null {
	const scrollViewport = node.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
	if (scrollViewport === null) {
		return null;
	}
	const gridContainer = node.closest('[data-slot="table-engine"]');
	if (gridContainer !== null && !gridContainer.contains(scrollViewport)) {
		return null;
	}
	return scrollViewport;
}

/** The box whose width the fill strip tops up to: the grid's scroll viewport, else the table viewport's parent. */
export function getTableEngineTableFillMeasurementTarget(node: HTMLElement): HTMLElement {
	return getTableEngineScrollAreaViewport(node) ?? node.parentElement ?? node;
}

/**
 * `true` for an event that reached this element only through a React portal
 * (an in-cell Select or popover): those must not start a cell selection or
 * fire `onRowClick`. The Node check uses the element's own realm, so a grid
 * mounted in an iframe still recognises its targets.
 */
export function isTableEnginePortalEvent(event: { readonly currentTarget: Element; readonly target: EventTarget | null }): boolean {
	const { currentTarget, target } = event;
	const view = currentTarget.ownerDocument.defaultView;
	if (view === null || !(target instanceof view.Node)) {
		return true;
	}
	return !currentTarget.contains(target);
}

/** Interactive descendants (buttons, links, editors, checkboxes, `data-cell-interactive`) keep their own press semantics. */
export function isTableEngineCellInteractiveTarget(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(CELL_INTERACTIVE_SELECTOR) !== null;
}

/** Rows split by pin position (all center rows when row pinning is off). */
export interface TableEngineTableRowSections<TData extends RowData> {
	readonly topRows: readonly TableEngineRow<TData>[];
	readonly centerRows: readonly TableEngineRow<TData>[];
	readonly bottomRows: readonly TableEngineRow<TData>[];
}

/** Splits rows into top-pinned, scrolling and bottom-pinned sections. */
export function getTableEngineTableRowSections<TData extends RowData>(table: TableEngineCoreTable<TData>, rowsPinnable: boolean): TableEngineTableRowSections<TData> {
	if (!rowsPinnable) {
		return { topRows: [], centerRows: table.getRowModel().rows, bottomRows: [] };
	}
	return { topRows: table.getTopRows(), centerRows: table.getCenterRows(), bottomRows: table.getBottomRows() };
}

/** One rendered body row and, for the last top-pinned / first bottom-pinned row, the boundary it draws. */
export interface TableEngineTableResolvedRow<TData extends RowData> {
	readonly row: TableEngineRow<TData>;
	readonly pinnedBoundary: TableEngineTablePinnedBoundary | undefined;
}

/** The rows to render, with pinned rows split out of the scrolling ones. */
export function getTableEngineTableResolvedRows<TData extends RowData>(table: TableEngineCoreTable<TData>, rowsPinnable: boolean): TableEngineTableResolvedRow<TData>[] {
	const { topRows, centerRows, bottomRows } = getTableEngineTableRowSections(table, rowsPinnable);
	const lastTopIndex = topRows.length - 1;
	const top = topRows.map((row, index): TableEngineTableResolvedRow<TData> => ({
		row,
		pinnedBoundary: index === lastTopIndex && (centerRows.length > 0 || bottomRows.length > 0) ? "top" : undefined,
	}));
	const center = centerRows.map((row): TableEngineTableResolvedRow<TData> => ({ row, pinnedBoundary: undefined }));
	const bottom = bottomRows.map((row, index): TableEngineTableResolvedRow<TData> => ({
		row,
		pinnedBoundary: index === 0 && (centerRows.length > 0 || topRows.length > 0) ? "bottom" : undefined,
	}));
	return [...top, ...center, ...bottom];
}

/** Visible leaf columns in render order: start, center, end. */
export function getTableEngineTableOrderedVisibleColumns<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineColumn<TData>[] {
	return [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getEndVisibleLeafColumns()];
}

/** Whether a column renders first / last in its row (pinning-aware, unlike `column.getIndex()`). */
export interface TableEngineTableColumnEdges {
	readonly isFirst: boolean;
	readonly isLast: boolean;
}

/** The pixel edges of each visible column, for scrolling a column into view. */
export function getTableEngineTableColumnEdges<TData extends RowData>(table: TableEngineCoreTable<TData>, columnId: string): TableEngineTableColumnEdges {
	const ordered = getTableEngineTableOrderedVisibleColumns(table);
	return { isFirst: ordered.at(0)?.id === columnId, isLast: ordered.at(-1)?.id === columnId };
}

/** One head row: every header, the cells each pin family renders, and the headers a span cell covers. */
export interface TableEngineTableMergedHeaderGroup<TData extends RowData> {
	readonly id: string;
	readonly headers: TableEngineHeader<TData>[];
	readonly startHeaders: TableEngineHeader<TData>[];
	readonly centerHeaders: TableEngineHeader<TData>[];
	readonly endHeaders: TableEngineHeader<TData>[];
	/** Headers a `meta.headerColSpan` cell covers, by that cell's header id. */
	readonly coveredHeaders: ReadonlyMap<string, TableEngineHeader<TData>[]>;
}

/** The headers a span owner covers in one rendered row (same rowSpan, right after it). */
export function collectCoveredHeaders<TData extends RowData>(
	rendered: readonly TableEngineHeader<TData>[],
	ownerIndex: number,
	owner: TableEngineHeader<TData>,
	coveredColumns: readonly TableEngineColumn<TData>[],
): TableEngineHeader<TData>[] {
	const covered: TableEngineHeader<TData>[] = [];
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
export function getTableEngineTableMergedHeaderGroups<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineTableMergedHeaderGroup<TData>[] {
	const startGroups = table.getStartHeaderGroups();
	const centerGroups = table.getCenterHeaderGroups();
	const endGroups = table.getEndHeaderGroups();
	const groupCount = Math.max(startGroups.length, centerGroups.length, endGroups.length);
	const spans = getTableEngineHeaderSpans(table);
	const coveredHeaders = new Map<string, TableEngineHeader<TData>[]>();

	const getRenderedHeaders = (headers: readonly TableEngineHeader<TData>[]): TableEngineHeader<TData>[] => {
		const rendered = headers.filter((header) => header.rowSpan !== 0);
		if (spans.size === 0) {
			return rendered;
		}
		const cells: TableEngineHeader<TData>[] = [];
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

	return Array.from({ length: groupCount }, (_, index): TableEngineTableMergedHeaderGroup<TData> => {
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
export function getTableEngineTableAllFlatHeaders<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineHeader<TData>[] {
	return [...table.getFlatHeaders(), ...table.getStartFlatHeaders(), ...table.getCenterFlatHeaders(), ...table.getEndFlatHeaders()];
}

/**
 * The leaf columns under a header, in render order: a group's leaves, or the
 * column itself for a leaf or a merged cell (v9 `getLeafHeaders` also returns
 * the header itself and every intermediate header, so those are dropped).
 */
export function getTableEngineHeaderLeafColumns<TData extends RowData>(header: TableEngineHeader<TData>): TableEngineColumn<TData>[] {
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
export function renderTableEngineTableHeadCellContent<TData extends RowData>(header: TableEngineHeader<TData>): React.ReactNode {
	return header.isPlaceholder && header.rowSpan <= 1 ? null : flexRender(header.column.columnDef.header, header.getContext());
}

/** A span's handle drives its last covered leaf; end-pinned, it sits on the start edge and drives the owner. */
export function getTableEngineHeadCellResizeHeader<TData extends RowData>(
	header: TableEngineHeader<TData>,
	coveredHeaders?: readonly TableEngineHeader<TData>[],
): TableEngineHeader<TData> {
	if (coveredHeaders === undefined || header.column.getIsPinned() === "end") {
		return header;
	}
	return coveredHeaders.at(-1) ?? header;
}

/** The width expression of a head cell: its own size variable, or the sum of a span's. */
export function getTableEngineHeadCellSizeVar<TData extends RowData>(header: TableEngineHeader<TData>, coveredHeaders: readonly TableEngineHeader<TData>[] = []): string {
	if (coveredHeaders.length === 0) {
		return `calc(var(--header-${header.id}-size) * 1px)`;
	}
	const sizes = [header, ...coveredHeaders].map((spanned) => `var(--header-${spanned.id}-size)`);
	return `calc((${sizes.join(" + ")}) * 1px)`;
}

/** Whether any column is pinned to the end. */
export function hasTableEngineTableRightPinnedColumns<TData extends RowData>(table: TableEngineCoreTable<TData>): boolean {
	return table.atoms.columnPinning.get().end.length > 0;
}

/** Each column's share of the free space, by column id; the shares add up to 1. */
export type TableEngineFillShares = ReadonlyMap<string, number>;

/**
 * Who absorbs the free space, so the table always spans its container. A visible `meta.fillWidth` column takes all of
 * it. Otherwise every visible unpinned data column (never a utility column: select, drag, actions) takes a share in
 * proportion to its own width, so the columns spread out evenly and keep the widths they were given relative to each
 * other. Pinned columns keep their size, so their sticky offsets stay true. Empty only when no column qualifies; the
 * fill strip then holds the space.
 */
export function resolveTableEngineFillShares<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineFillShares {
	const visible = table.getVisibleLeafColumns();
	const marked = visible.find((column) => column.columnDef.meta?.fillWidth === true);
	if (marked !== undefined) {
		return new Map([[marked.id, 1]]);
	}
	const growing = visible.filter((column) => column.getIsPinned() === false && !isDataTableUtilityColumnId(column.id));
	const totalSize = growing.reduce((sum, column) => sum + column.getSize(), 0);
	if (totalSize <= 0) {
		return new Map();
	}
	return new Map(growing.map((column): [string, number] => [column.id, column.getSize() / totalSize]));
}

/** Columns absorb the free space themselves, so the fill cells collapse. */
export function hasTableEngineFillColumn<TData extends RowData>(table: TableEngineCoreTable<TData>): boolean {
	return resolveTableEngineFillShares(table).size > 0;
}

/** A column's size variable: its own size, plus its share of the free space when it takes one. */
export function columnSizeValue(columnId: string, size: number, shares: TableEngineFillShares): string {
	const share = shares.get(columnId);
	return share === undefined ? String(size) : `calc(${String(size)} + var(--table-engine-fill, 0) * ${String(share)})`;
}

/** Which edge of a leaf column's header draws a resting divider line, or `null` for none. */
export function getTableEngineHeaderLineEdge<TData extends RowData>(
	table: TableEngineCoreTable<TData>,
	layout: TableEngineResolvedTableLayout,
	column: TableEngineColumn<TData>,
): "start" | "end" | null {
	if (!layout.columnsResizable || !column.getCanResize()) {
		return null;
	}
	const isPinned = column.getIsPinned();
	if (isPinned === "end") {
		return layout.columnsPinnable ? null : "start";
	}
	if (getTableEngineTableColumnEdges(table, column.id).isLast) {
		return null;
	}
	if (isPinned === "start") {
		return layout.columnsPinnable ? null : "end";
	}
	if (layout.cellBorder) {
		return null;
	}
	if (layout.columnsPinnable && column.getIsLastColumn("center") && hasTableEngineTableRightPinnedColumns(table)) {
		return null;
	}
	return "end";
}

export const HAS_END_PINNED_VISITOR: TableEngineGridVisitor<boolean> = { visit: (grid) => hasTableEngineTableRightPinnedColumns(grid.table) };
export const VISIBLE_LEAF_COUNT_VISITOR: TableEngineGridVisitor<number> = { visit: (grid) => getTableEngineTableOrderedVisibleColumns(grid.table).length };
export const IS_MULTI_LEVEL_HEADER_VISITOR: TableEngineGridVisitor<boolean> = { visit: (grid) => grid.table.getHeaderGroups().length > 1 };
/** The table's atoms do not depend on the row type; the registry is the same object for the table's lifetime. */
export type TableEngineAtoms = TableEngineCoreTable<RowData>["atoms"];
export const ATOMS_VISITOR: TableEngineGridVisitor<TableEngineAtoms> = { visit: (grid) => grid.table.atoms };
/** The table's methods read live state, so the returned getter stays valid across renders. */
export const TOTAL_SIZE_GETTER_VISITOR: TableEngineGridVisitor<() => number> = {
	visit: (grid) => {
		const { table } = grid;
		return (): number => table.getTotalSize();
	},
};
