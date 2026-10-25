"use client";

// ============================================================
// components/data-grid/data-grid-table.tsx
//
// The grid's table renderer and its building blocks: the viewport (fill strip
// and meta.autoSize measurement), the <table> with its colgroup and column
// size variables, head rows with merged / spanning / pinned headers and
// resize handles, body rows and cells (row click, CRUD indications, cell
// selection chrome, fill handle), skeleton / spinner / empty states, and the
// row affordances column defs render (select, select-all, expand, pin).
//
// How the row type flows (see data-grid.tsx): parts that receive a typed row,
// header, cell or column read the table from it (`column.table`, `row.table`);
// TData-free parts read it through the context's `withGrid` visitor. The
// virtual and drag-and-drop table variants compose these same blocks.
// ============================================================

import { hasGlobalConstructor, LIST_SLOT_INDEX } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
	DATA_GRID_PINNED_CELL_Z_INDEX,
	dataGridCellSelectionCellClasses,
	getColumnHeaderLabel,
	getDataGridCellSelectionCellAttrs,
	getDataGridHeaderSpans,
	toDataGridDomId,
	useDataGrid,
	useDataGridAtom,
	type DataGridAutoSizeController,
	type DataGridCell,
	type DataGridCellSelectionCellAttrs,
	type DataGridColumn,
	type DataGridCoreTable,
	type DataGridFeatures,
	type DataGridGridVisitor,
	type DataGridResolvedTableLayout,
} from "@workspace/ui/components/data-grid/data-grid";
import { Spinner } from "@workspace/ui/components/spinner";
import { assignRef, mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { flexRender, Subscribe, type ColumnSizingState, type Header, type Row, type RowData } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import { ChevronDownIcon, PinIcon, PinOffIcon, PlusIcon } from "lucide-react";
import * as React from "react";

// ── Types ──────────────────────────────────────────────────────────────────

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
const DEFAULT_TREE_INDENT_PX = 20;

/** Arrow-key step of a focused resize handle. */
const RESIZE_KEYBOARD_STEP_PX = 10;

/** A drag may shrink a column to just above zero, never past it. */
const RESIZE_MIN_DELTA_RATIO = -0.999999;

/** Committed widths keep two decimals. */
const SIZE_ROUNDING_FACTOR = 100;

/** The resize indicator's head never collapses below this height. */
const INDICATOR_MIN_HEAD_HEIGHT_PX = 6;

/** Sub-pixel overflow is not overflow. */
const OVERFLOW_TOLERANCE_PX = 0.5;

const PRIMARY_MOUSE_BUTTON = 0;

/** `aria-rowindex` of the header row; body rows follow it (1-based). */
const HEADER_ROW_ARIA_INDEX = 1;
const BODY_ROW_ARIA_INDEX_OFFSET = 2;

/** The filler strip is one extra column when columns are resizable. */
const FILL_COLUMN_SPAN = 1;

const NON_PASSIVE_LISTENER: AddEventListenerOptions = { passive: false };

const FILL_WIDTH_STYLE: React.CSSProperties = { width: "var(--data-grid-fill-size, 0px)" };
const FILL_WIDTH_COLLAPSED_STYLE: React.CSSProperties = { width: 0 };

/** Every shared `[role=…]`/element a cell press must leave to the control under it. */
const CELL_INTERACTIVE_SELECTOR =
	'button, a, input, select, textarea, [contenteditable], [role="checkbox"], [data-cell-interactive], [data-slot="data-grid-table-row-expand"], [data-slot="data-grid-cell-fill-handle"]';

/** Pinned cells hide scrolled content behind an opaque surface token. */
const PINNED_SURFACE = "var(--data-grid-surface,var(--data-grid-card-surface,var(--background)))";

const PINNED_EDGE_SHADOW_CLASSES =
	"[&[data-pinned=end][data-last-col=end]]:shadow-[inset_calc(1px*var(--data-grid-dir,1))_0_0_0_var(--border)] [&[data-pinned=start][data-last-col=start]]:shadow-[inset_calc(-1px*var(--data-grid-dir,1))_0_0_0_var(--border)]";

const BODY_ROW_BOTTOM_BORDER_CLASSES = "[&:not(:last-child)>td]:border-b";

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
const dataGridBodyCellTruncateVariants = cva("truncate", {
	variants: { size: { default: "-mx-3 -my-2 px-3 py-2", dense: "-mx-2 -my-1.5 px-2 py-1.5" } },
	defaultVariants: { size: "default" },
});

export const dataGridFooterCellVariants = cva("align-middle font-medium text-secondary-foreground/80", {
	variants: { size: { default: "px-3 py-2", dense: "px-2 py-1.5" } },
	defaultVariants: { size: "default" },
});

/** The fill handle's look (`tableLayout.cellFillHandleVariant`). */
const dataGridFillHandleVariants = cva("absolute z-10 cursor-crosshair in-data-[cell-editing]:hidden in-data-[cell-selecting]:hidden", {
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

function spacingSize(layout: DataGridResolvedTableLayout): DataGridCellSpacingSize {
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
function getDataGridTableFillMeasurementTarget(node: HTMLElement): HTMLElement {
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
function isDataGridCellInteractiveTarget(target: EventTarget | null): boolean {
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
function collectCoveredHeaders<TData extends RowData>(
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
function getDataGridTableAllFlatHeaders<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridHeader<TData>[] {
	return [...table.getFlatHeaders(), ...table.getStartFlatHeaders(), ...table.getCenterFlatHeaders(), ...table.getEndFlatHeaders()];
}

/**
 * The leaf columns under a header, in render order: a group's leaves, or the
 * column itself for a leaf or a merged cell (v9 `getLeafHeaders` also returns
 * the header itself and every intermediate header, so those are dropped).
 */
function getDataGridHeaderLeafColumns<TData extends RowData>(header: DataGridHeader<TData>): DataGridColumn<TData>[] {
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
function hasDataGridFillColumn<TData extends RowData>(table: DataGridCoreTable<TData>): boolean {
	return table.getVisibleLeafColumns().some((column) => column.columnDef.meta?.fillWidth === true);
}

/** Which edge of a leaf column's header draws a resting divider line, or `null` for none. */
function getDataGridHeaderLineEdge<TData extends RowData>(
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

/**
 * TanStack's own default, restated: v9 resolves feature defaults internally
 * and may leave the option unset on the instance.
 */
const DATA_GRID_DEFAULT_COLUMN_RESIZE_MODE = "onEnd";

function isOnEndResizeMode<TData extends RowData>(layout: DataGridResolvedTableLayout, table: DataGridCoreTable<TData>): boolean {
	return (layout.columnsResizeMode ?? table.options.columnResizeMode ?? DATA_GRID_DEFAULT_COLUMN_RESIZE_MODE) === DATA_GRID_DEFAULT_COLUMN_RESIZE_MODE;
}

/** End-pinned columns grow from their start edge, so their geometry runs mirrored, like RTL. */
function isMirroredResize<TData extends RowData>(table: DataGridCoreTable<TData>, column: DataGridColumn<TData>): boolean {
	return (table.options.columnResizeDirection === "rtl") !== (column.getIsPinned() === "end");
}

/** The column-size CSS variables of every rendered header (`--header-x-size`, `--col-x-size`). */
function getDataGridColumnSizeVars<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridStyle {
	const fillColumnId = table.getVisibleLeafColumns().find((column) => column.columnDef.meta?.fillWidth === true)?.id;
	const vars: DataGridStyle = {};
	for (const header of getDataGridTableAllFlatHeaders(table)) {
		vars[`--header-${header.id}-size`] = header.getSize();
		vars[`--col-${header.column.id}-size`] =
			header.column.id === fillColumnId ? `calc(${String(header.column.getSize())} + var(--data-grid-fill, 0))` : header.column.getSize();
	}
	return vars;
}

// ── Column resize session ──────────────────────────────────────────────────

type DataGridResizeStartEvent = React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>;

type DataGridResizeDocumentEvent = MouseEvent | TouchEvent;

interface DataGridTouchPoint {
	readonly identifier: number;
	readonly clientX: number;
}

interface DataGridTouchListLike {
	readonly length: number;
	item(index: number): DataGridTouchPoint | null;
}

function isDataGridTouchEvent(event: DataGridResizeStartEvent | DataGridResizeDocumentEvent): event is React.TouchEvent<HTMLElement> | TouchEvent {
	return "touches" in event;
}

function findTouchClientX(list: DataGridTouchListLike, identifier: number): number | undefined {
	for (let index = 0; index < list.length; index++) {
		const touch = list.item(index);
		if (touch?.identifier === identifier) {
			return touch.clientX;
		}
	}
	return undefined;
}

function firstTouch(list: DataGridTouchListLike): DataGridTouchPoint | undefined {
	return list.length > 0 ? (list.item(LIST_SLOT_INDEX.first) ?? undefined) : undefined;
}

function getDataGridResizeEventClientX(event: DataGridResizeStartEvent | DataGridResizeDocumentEvent, touchIdentifier?: number): number | undefined {
	if (!isDataGridTouchEvent(event)) {
		return event.clientX;
	}
	if (touchIdentifier !== undefined) {
		return findTouchClientX(event.touches, touchIdentifier) ?? findTouchClientX(event.changedTouches, touchIdentifier);
	}
	return firstTouch(event.touches)?.clientX ?? firstTouch(event.changedTouches)?.clientX;
}

/** The min/max delta ratio a drag may reach, from the leaves' resolved min/max sizes. */
function getResizeDeltaBounds<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	sizingStart: readonly (readonly [string, number])[],
): { readonly min: number; readonly max: number } {
	let min = RESIZE_MIN_DELTA_RATIO;
	let max = Number.POSITIVE_INFINITY;
	for (const [columnId, size] of sizingStart) {
		if (size > 0) {
			const def = table.getColumn(columnId)?.columnDef;
			if (def?.minSize !== undefined) {
				min = Math.max(min, def.minSize / size - 1);
			}
			if (def?.maxSize !== undefined && Number.isFinite(def.maxSize)) {
				max = Math.min(max, def.maxSize / size - 1);
			}
		}
	}
	return { min, max };
}

/** The size expression written to a column's live variable (the fill column adds the free space). */
function liveColumnSizeValue(columnId: string, size: number, fillColumnId: string | undefined): string {
	return columnId === fillColumnId ? `calc(${String(size)} + var(--data-grid-fill, 0))` : String(size);
}

/**
 * Starts a column resize drag. `live` (onChange mode) writes per-move widths
 * straight to the table element's `--col/--header` variables — zero React
 * renders during the drag — and commits sizing state once at release; onEnd
 * mode tracks the drag in `columnResizing` state for the indicator and
 * commits at release. Returns a teardown that ends the session.
 */
function startDataGridColumnResize<TData extends RowData>(
	event: DataGridResizeStartEvent,
	header: DataGridHeader<TData>,
	live: boolean,
	autoSize: DataGridAutoSizeController,
): (() => void) | undefined {
	const table = header.column.table;
	const column = table.getColumn(header.column.id);
	if (column?.getCanResize() !== true) {
		return undefined;
	}
	const isTouchSession = isDataGridTouchEvent(event);
	if (isTouchSession && event.touches.length > 1) {
		return undefined;
	}

	const { ownerDocument } = event.currentTarget;
	const ownerWindow = ownerDocument.defaultView;
	const previousBodyCursor = ownerDocument.body.style.cursor;
	const previousDocumentCursor = ownerDocument.documentElement.style.cursor;
	const startSize = header.getSize();
	const touchIdentifier = isTouchSession ? firstTouch(event.touches)?.identifier : undefined;
	const dragStartClientX = getDataGridResizeEventClientX(event, touchIdentifier);
	const headerCell = event.currentTarget.closest("th");
	const headerRect = headerCell?.getBoundingClientRect();
	const liveTableElement = live ? (headerCell?.closest("table") ?? null) : null;
	const liveViewportElement = liveTableElement?.closest<HTMLElement>('[data-slot="data-grid-table-viewport"]') ?? null;
	const liveViewportWidthIsComputed = liveViewportElement?.style.width.startsWith("calc(") ?? false;
	const liveContainerWidth = liveViewportElement === null ? 0 : getDataGridTableFillMeasurementTarget(liveViewportElement).clientWidth;
	const totalSizeStart = table.getTotalSize();
	const fillColumnId = table.getVisibleLeafColumns().find((visibleColumn) => visibleColumn.columnDef.meta?.fillWidth === true)?.id;
	const leafColumns = getDataGridHeaderLeafColumns(header);
	const [firstLeaf] = leafColumns;
	const resizeRtl = isMirroredResize(table, firstLeaf ?? column);
	const anchorEdge = headerRect === undefined ? undefined : resizeRtl ? headerRect.left : headerRect.right;
	const startOffset = anchorEdge !== undefined && Number.isFinite(anchorEdge) ? anchorEdge : dragStartClientX;

	if (dragStartClientX === undefined || startOffset === undefined) {
		return undefined;
	}

	ownerDocument.body.style.cursor = "col-resize";
	ownerDocument.documentElement.style.cursor = "col-resize";

	const columnSizingStart = leafColumns.map((leafColumn): [string, number] => [leafColumn.id, leafColumn.getSize()]);
	// Group and merged header cells size from their own variables, which must follow their leaves through a live drag too.
	const liveSpanningHeaders =
		liveTableElement === null
			? []
			: getDataGridTableAllFlatHeaders(table)
					.filter((flatHeader) => flatHeader.subHeaders.length > 0)
					.map((flatHeader) => ({
						id: flatHeader.id,
						leaves: getDataGridHeaderLeafColumns(flatHeader).map((leafColumn): [string, number] => [leafColumn.id, leafColumn.getSize()]),
					}));
	const directionMultiplier = resizeRtl ? -1 : 1;
	const deltaBounds = getResizeDeltaBounds(table, columnSizingStart);

	let lastClientX = dragStartClientX;
	let ended = false;
	let autoSizePreview: { readonly columnId: string; readonly size: number } | null = null;
	const stopListeners: (() => void)[] = [];

	const writeLiveSizes = (tableElement: HTMLTableElement, nextColumnSizing: ColumnSizingState): void => {
		let totalSize = totalSizeStart;
		for (const [columnId, headerSize] of columnSizingStart) {
			const nextSize = nextColumnSizing[columnId];
			if (nextSize !== undefined) {
				totalSize += nextSize - headerSize;
				tableElement.style.setProperty(`--col-${columnId}-size`, liveColumnSizeValue(columnId, nextSize, fillColumnId));
				tableElement.style.setProperty(`--header-${columnId}-size`, String(nextSize));
			}
		}
		// An armed meta.autoSize column would reflow after the commit and move
		// every column past it, so its reflow is previewed here and committed with the drag.
		const preview = autoSize.preview(liveContainerWidth - totalSize);
		autoSizePreview = preview !== null && !(preview.columnId in nextColumnSizing) ? preview : null;
		if (autoSizePreview !== null && preview !== null) {
			totalSize += preview.size - preview.current;
			tableElement.style.setProperty(`--col-${preview.columnId}-size`, liveColumnSizeValue(preview.columnId, preview.size, fillColumnId));
			tableElement.style.setProperty(`--header-${preview.columnId}-size`, String(preview.size));
		}
		for (const spanningHeader of liveSpanningHeaders) {
			let size = 0;
			for (const [columnId, leafStartSize] of spanningHeader.leaves) {
				size += nextColumnSizing[columnId] ?? (autoSizePreview?.columnId === columnId ? autoSizePreview.size : leafStartSize);
			}
			tableElement.style.setProperty(`--header-${spanningHeader.id}-size`, String(size));
		}
		const width = `calc(${String(totalSize)}px + var(--data-grid-fill-size, 0px))`;
		tableElement.style.width = width;
		if (liveViewportElement !== null) {
			if (liveViewportWidthIsComputed) {
				liveViewportElement.style.width = width;
			}
			const fill = Math.max(0, liveContainerWidth - totalSize);
			liveViewportElement.style.setProperty("--data-grid-fill-size", `${String(fill)}px`);
			liveViewportElement.style.setProperty("--data-grid-fill", String(fill));
		}
	};

	const updateOffset = (clientXPos: number | undefined, commit: boolean): void => {
		if (clientXPos === undefined) {
			return;
		}
		lastClientX = clientXPos;
		const deltaPercentage = Math.min(Math.max(((clientXPos - dragStartClientX) * directionMultiplier) / startSize, deltaBounds.min), deltaBounds.max);
		const deltaOffset = deltaPercentage * startSize;
		const nextColumnSizing: ColumnSizingState = {};
		for (const [columnId, headerSize] of columnSizingStart) {
			nextColumnSizing[columnId] = Math.round(Math.max(headerSize + headerSize * deltaPercentage, 0) * SIZE_ROUNDING_FACTOR) / SIZE_ROUNDING_FACTOR;
		}

		if (liveTableElement === null) {
			table.setColumnResizing((old) => ({
				...old,
				startOffset,
				startSize,
				deltaOffset,
				deltaPercentage,
				columnSizingStart,
				isResizingColumn: column.id,
			}));
		} else {
			writeLiveSizes(liveTableElement, nextColumnSizing);
		}

		if (commit) {
			const committed = autoSizePreview === null ? nextColumnSizing : { ...nextColumnSizing, [autoSizePreview.columnId]: autoSizePreview.size };
			if (autoSizePreview !== null) {
				autoSize.adopt(autoSizePreview.columnId, autoSizePreview.size);
			}
			table.setColumnSizing((old) => ({ ...old, ...committed }));
		}
	};

	// Single teardown path, safe to call more than once (blur + mouseup + unmount can race).
	const endResize = (clientXPos: number | undefined): void => {
		if (ended) {
			return;
		}
		ended = true;
		for (const stop of stopListeners) {
			stop();
		}
		updateOffset(clientXPos, true);
		table.setColumnResizing((old) => ({
			...old,
			isResizingColumn: false,
			startOffset: null,
			startSize: null,
			deltaOffset: null,
			deltaPercentage: null,
			columnSizingStart: [],
		}));
		ownerDocument.body.style.cursor = previousBodyCursor;
		ownerDocument.documentElement.style.cursor = previousDocumentCursor;
	};

	const mouseMoveHandler = (moveEvent: MouseEvent): void => {
		updateOffset(moveEvent.clientX, false);
	};
	const mouseUpHandler = (upEvent: MouseEvent): void => {
		endResize(upEvent.clientX);
	};
	const touchMoveHandler = (moveEvent: TouchEvent): void => {
		if (moveEvent.cancelable) {
			moveEvent.preventDefault();
			moveEvent.stopPropagation();
		}
		updateOffset(getDataGridResizeEventClientX(moveEvent, touchIdentifier), false);
	};
	const touchEndHandler = (endEvent: TouchEvent): void => {
		// Only the initiating touch ends the drag.
		const clientXPos = touchIdentifier === undefined ? getDataGridResizeEventClientX(endEvent) : findTouchClientX(endEvent.changedTouches, touchIdentifier);
		if (clientXPos === undefined) {
			return;
		}
		if (endEvent.cancelable) {
			endEvent.preventDefault();
			endEvent.stopPropagation();
		}
		endResize(clientXPos);
	};
	// Interrupted gestures and focus loss would otherwise leave the session live with no pointer held.
	const interruptHandler = (): void => {
		endResize(lastClientX);
	};

	if (isTouchSession) {
		ownerDocument.addEventListener("touchmove", touchMoveHandler, NON_PASSIVE_LISTENER);
		ownerDocument.addEventListener("touchend", touchEndHandler, NON_PASSIVE_LISTENER);
		ownerDocument.addEventListener("touchcancel", interruptHandler);
		stopListeners.push((): void => {
			ownerDocument.removeEventListener("touchmove", touchMoveHandler);
			ownerDocument.removeEventListener("touchend", touchEndHandler);
			ownerDocument.removeEventListener("touchcancel", interruptHandler);
		});
	} else {
		ownerDocument.addEventListener("mousemove", mouseMoveHandler, NON_PASSIVE_LISTENER);
		ownerDocument.addEventListener("mouseup", mouseUpHandler, NON_PASSIVE_LISTENER);
		stopListeners.push((): void => {
			ownerDocument.removeEventListener("mousemove", mouseMoveHandler);
			ownerDocument.removeEventListener("mouseup", mouseUpHandler);
		});
	}
	if (ownerWindow !== null) {
		ownerWindow.addEventListener("blur", interruptHandler);
		stopListeners.push((): void => {
			ownerWindow.removeEventListener("blur", interruptHandler);
		});
	}

	table.setColumnResizing((old) => ({
		...old,
		startOffset,
		startSize,
		deltaOffset: 0,
		deltaPercentage: 0,
		columnSizingStart,
		isResizingColumn: column.id,
	}));

	return (): void => {
		endResize(lastClientX);
	};
}

// ── TData-free table reads (context visitors) ──────────────────────────────

const HAS_FILL_COLUMN_VISITOR: DataGridGridVisitor<boolean> = { visit: (grid) => hasDataGridFillColumn(grid.table) };
const HAS_END_PINNED_VISITOR: DataGridGridVisitor<boolean> = { visit: (grid) => hasDataGridTableRightPinnedColumns(grid.table) };
const VISIBLE_LEAF_COUNT_VISITOR: DataGridGridVisitor<number> = { visit: (grid) => getDataGridTableOrderedVisibleColumns(grid.table).length };
const IS_MULTI_LEVEL_HEADER_VISITOR: DataGridGridVisitor<boolean> = { visit: (grid) => grid.table.getHeaderGroups().length > 1 };
/** The table's atoms do not depend on the row type; the registry is the same object for the table's lifetime. */
type DataGridAtoms = DataGridCoreTable<RowData>["atoms"];
const ATOMS_VISITOR: DataGridGridVisitor<DataGridAtoms> = { visit: (grid) => grid.table.atoms };
/** The table's methods read live state, so the returned getter stays valid across renders. */
const TOTAL_SIZE_GETTER_VISITOR: DataGridGridVisitor<() => number> = {
	visit: (grid) => {
		const { table } = grid;
		return (): number => table.getTotalSize();
	},
};

/** The width style the filler strip cells and col share. */
function useDataGridFillStyle(): React.CSSProperties {
	return useDataGrid().withGrid(HAS_FILL_COLUMN_VISITOR) ? FILL_WIDTH_COLLAPSED_STYLE : FILL_WIDTH_STYLE;
}

// ── Filler strip ───────────────────────────────────────────────────────────

function DataGridTableFillCol(): React.JSX.Element | null {
	const { props } = useDataGrid();
	const style = useDataGridFillStyle();
	if (!props.tableLayout.columnsResizable) {
		return null;
	}
	return <col data-slot="data-grid-table-fill-col" style={style} />;
}

export interface DataGridTableFillHeadCellProps extends Omit<React.ComponentProps<"th">, "children" | "style"> {
	/** Multi-level headers render one fill cell spanning every head row. */
	readonly rowSpan?: number;
}

/** The filler strip's head cell (rendered only under `columnsResizable`). */
export const DataGridTableFillHeadCell = React.forwardRef<HTMLTableCellElement, DataGridTableFillHeadCellProps>(function DataGridTableFillHeadCell(
	{ rowSpan, className, ...props },
	ref,
): React.JSX.Element | null {
	const { props: gridProps } = useDataGrid();
	const style = useDataGridFillStyle();
	if (!gridProps.tableLayout.columnsResizable) {
		return null;
	}
	return (
		<th
			ref={ref}
			aria-hidden="true"
			data-slot="data-grid-table-fill-head-cell"
			rowSpan={rowSpan !== undefined && rowSpan > 1 ? rowSpan : undefined}
			style={style}
			className={cn("p-0", gridProps.tableLayout.headerBackground ? "bg-muted" : undefined, className)}
			{...props}
		/>
	);
});

/** The filler strip's body cell (rendered only under `columnsResizable`). */
export const DataGridTableFillBodyCell = React.forwardRef<HTMLTableCellElement, Omit<React.ComponentProps<"td">, "children" | "style">>(function DataGridTableFillBodyCell(
	{ className, ...props },
	ref,
): React.JSX.Element | null {
	const { props: gridProps } = useDataGrid();
	const style = useDataGridFillStyle();
	if (!gridProps.tableLayout.columnsResizable) {
		return null;
	}
	return <td ref={ref} aria-hidden="true" data-slot="data-grid-table-fill-body-cell" style={style} className={cn("p-0", className)} {...props} />;
});

function DataGridTableFillFootCell(): React.JSX.Element | null {
	const { props } = useDataGrid();
	const style = useDataGridFillStyle();
	if (!props.tableLayout.columnsResizable) {
		return null;
	}
	return <td aria-hidden="true" data-slot="data-grid-table-fill-foot-cell" style={style} className="p-0" />;
}

// ── Add row ────────────────────────────────────────────────────────────────

/**
 * The quick-create affordance, rendered as the body's last row when
 * `onRowCreate` is set: one full-width ghost button. What the click creates
 * stays consumer-owned.
 */
export const DataGridTableAddRow = React.forwardRef<HTMLTableRowElement, Omit<React.ComponentProps<"tr">, "children">>(function DataGridTableAddRow(
	{ className, ...props },
	ref,
): React.JSX.Element | null {
	const { labels, props: gridProps, withGrid } = useDataGrid();
	const { onRowCreate } = gridProps;
	const columnCount = withGrid(VISIBLE_LEAF_COUNT_VISITOR) + (gridProps.tableLayout.columnsResizable ? FILL_COLUMN_SPAN : 0);

	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLElement>): void => {
			// Creating often unmounts this affordance (a draft row takes its
			// place); focus would fall to the body and strand the keyboard, so it
			// moves to the grid — only when it was actually lost. A timer, not
			// rAF: timers also run in background tabs.
			const button = event.currentTarget;
			const grid = button.closest("table");
			onRowCreate?.();
			setTimeout((): void => {
				const { activeElement } = button.ownerDocument;
				if (!button.isConnected && grid?.isConnected === true && grid.tabIndex >= 0 && (activeElement === null || activeElement === button.ownerDocument.body)) {
					grid.focus();
				}
			}, 0);
		},
		[onRowCreate],
	);

	if (onRowCreate === undefined) {
		return null;
	}

	return (
		<tr
			ref={ref}
			data-slot="data-grid-table-add-row"
			className={cn("hover:bg-muted/40 [thead+tbody_&:first-child]:border-t", gridProps.tableClassNames.rowCreate, className)}
			{...props}>
			<td colSpan={columnCount} className="p-0">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					// Block-level flex keeps the icon and label vertically centered.
					className={cn("flex w-full items-center justify-start rounded-none px-3 text-muted-foreground", gridProps.tableLayout.dense ? "h-8 px-2" : "h-9")}
					onClick={handleClick}>
					<PlusIcon className="size-4" aria-hidden="true" />
					{gridProps.rowCreateLabel ?? labels.rowCreate}
				</Button>
			</td>
		</tr>
	);
});

// ── Table base ─────────────────────────────────────────────────────────────

interface DataGridTableBaseInnerProps<TData extends RowData> {
	readonly table: DataGridCoreTable<TData>;
	readonly tableProps: React.ComponentProps<"table">;
}

function DataGridTableBaseInner<TData extends RowData>({ table, tableProps }: DataGridTableBaseInnerProps<TData>): React.JSX.Element {
	const { props, recordCount } = useDataGrid();
	const { tableLayout, tableClassNames } = props;
	// The size variables and the width follow every sizing write.
	useDataGridAtom(table.atoms.columnSizing);
	const { className, style, children, ...rest } = tableProps;
	const startAndCenterColumns = [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns()];
	const endColumns = table.getEndVisibleLeafColumns();
	const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);
	// With cell selection on, the table announces as a grid so its cells compute as gridcells and aria-selected applies.
	const cellSelectionOn = tableLayout.cellSelection;

	const tableStyle: React.CSSProperties | undefined = tableLayout.columnsResizable
		? { ...getDataGridColumnSizeVars(table), width: `calc(${String(table.getTotalSize())}px + var(--data-grid-fill-size, 0px))`, ...style }
		: style;

	const renderCol = (column: DataGridColumn<TData>): React.JSX.Element => {
		const colStyle: React.CSSProperties | undefined = tableLayout.columnsResizable
			? { width: `calc(var(--col-${column.id}-size) * 1px)` }
			: tableLayout.width === "fixed"
				? { width: column.getSize() }
				: undefined;
		return <col key={column.id} style={colStyle} />;
	};

	return (
		<table
			data-slot="data-grid-table"
			role={cellSelectionOn ? "grid" : undefined}
			aria-multiselectable={cellSelectionOn && tableLayout.cellSelectionMode !== "single" ? true : undefined}
			// recordCount can undercount the rows present (a pinned draft row);
			// the union keeps every announced index inside the announced count.
			aria-rowcount={cellSelectionOn ? Math.max(recordCount, table.getRowsInDisplayOrder().length) + HEADER_ROW_ARIA_INDEX : undefined}
			className={cn(
				"caption-bottom text-left align-middle text-sm font-normal text-foreground rtl:text-right",
				// Opaque surfaces follow --card inside a Card.
				"in-data-[slot=card]:[--data-grid-card-surface:var(--card)]",
				// Pinned-edge separators are physical inset shadows; this sign flips them under RTL.
				"rtl:[--data-grid-dir:-1]",
				tableLayout.columnsResizable ? "min-w-0" : "w-full min-w-full",
				tableLayout.width === "auto" ? "table-auto" : "table-fixed",
				tableLayout.columnsDraggable ? undefined : "border-separate border-spacing-0",
				tableClassNames.base,
				className,
			)}
			style={tableStyle}
			{...rest}>
			<colgroup>
				{startAndCenterColumns.map(renderCol)}
				{hasRightPinnedColumns ? <DataGridTableFillCol /> : null}
				{endColumns.map(renderCol)}
				{hasRightPinnedColumns ? null : <DataGridTableFillCol />}
			</colgroup>
			{children}
		</table>
	);
}

/** The `<table>` with its colgroup and (under `columnsResizable`) the column size variables. */
export const DataGridTableBase = React.forwardRef<HTMLTableElement, React.ComponentProps<"table">>(function DataGridTableBase(props, ref): React.JSX.Element {
	const { withGrid } = useDataGrid();
	const tableProps = React.useMemo((): React.ComponentProps<"table"> => ({ ...props, ref }), [props, ref]);
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({ visit: (grid) => <DataGridTableBaseInner table={grid.table} tableProps={tableProps} /> }),
		[tableProps],
	);
	return withGrid(visitor);
});

// ── Viewport ───────────────────────────────────────────────────────────────

export interface DataGridTableViewportProps extends React.ComponentProps<"div"> {
	/** A second ref to the viewport node (kept for the virtual variant, which binds its scroll element through it). */
	readonly viewportRef?: React.Ref<HTMLDivElement>;
}

/**
 * The table's width box. Under `columnsResizable` it measures its container
 * and writes the free space as `--data-grid-fill-size` (and the unitless
 * `--data-grid-fill`) straight onto the node — no React state — and feeds the
 * signed free space to the `meta.autoSize` coordinator.
 */
export const DataGridTableViewport = React.forwardRef<HTMLDivElement, DataGridTableViewportProps>(function DataGridTableViewport(
	{ children, className, viewportRef, style, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, autoSize, withGrid } = useDataGrid();
	const atoms = withGrid(ATOMS_VISITOR);
	useDataGridAtom(atoms.columnSizing);
	const getTotalSize = withGrid(TOTAL_SIZE_GETTER_VISITOR);
	const isColumnsResizable = gridProps.tableLayout.columnsResizable;
	const viewportNodeRef = React.useRef<HTMLDivElement | null>(null);
	const fillStateRef = React.useRef({ containerWidth: 0, appliedFill: -1 });
	const stopContainerObserverRef = React.useRef<(() => void) | null>(null);
	// The latest getter and coordinator ride a ref, so the node callback keeps one identity.
	const latestRef = React.useRef({ getTotalSize, autoSize });
	React.useLayoutEffect((): void => {
		latestRef.current = { getTotalSize, autoSize };
	});

	const syncFillWidth = React.useCallback((): void => {
		const node = viewportNodeRef.current;
		if (node === null) {
			return;
		}
		const latest = latestRef.current;
		const freeSpace = fillStateRef.current.containerWidth - latest.getTotalSize();
		const fillWidth = Math.max(0, freeSpace);
		if (fillStateRef.current.appliedFill !== fillWidth) {
			fillStateRef.current.appliedFill = fillWidth;
			node.style.setProperty("--data-grid-fill-size", `${String(fillWidth)}px`);
			node.style.setProperty("--data-grid-fill", String(fillWidth));
		}
		// Signed on purpose: a shrinking container tells an autoSize column to give its width back.
		latest.autoSize.apply(freeSpace);
	}, []);

	const handleViewportRef = React.useCallback(
		(node: HTMLDivElement | null): void => {
			stopContainerObserverRef.current?.();
			stopContainerObserverRef.current = null;
			viewportNodeRef.current = node;
			assignRef(viewportRef, node);
			assignRef(ref, node);
			if (node === null) {
				return;
			}
			if (!isColumnsResizable) {
				fillStateRef.current.appliedFill = -1;
				node.style.removeProperty("--data-grid-fill-size");
				node.style.removeProperty("--data-grid-fill");
				return;
			}
			const measurementTarget = getDataGridTableFillMeasurementTarget(node);
			const measure = (): void => {
				fillStateRef.current.containerWidth = measurementTarget.clientWidth;
				syncFillWidth();
			};
			// The first measure runs inside the mount commit, so the fill lands in the first painted frame.
			measure();
			if (hasGlobalConstructor("ResizeObserver")) {
				const observer = new ResizeObserver(measure);
				observer.observe(measurementTarget);
				stopContainerObserverRef.current = (): void => {
					observer.disconnect();
				};
			}
		},
		[isColumnsResizable, syncFillWidth, viewportRef, ref],
	);

	// Sizing commits and visibility changes alter the total size without moving the container.
	React.useLayoutEffect((): void => {
		if (isColumnsResizable) {
			syncFillWidth();
		}
	});

	const viewportStyle: React.CSSProperties | undefined = isColumnsResizable
		? { width: `calc(${String(getTotalSize())}px + var(--data-grid-fill-size, 0px))`, ...style }
		: style;

	return (
		<div data-slot="data-grid-table-viewport" ref={handleViewportRef} className={cn("relative min-w-full align-top", className)} style={viewportStyle} {...props}>
			{children}
			<DataGridTableResizeIndicator viewportNodeRef={viewportNodeRef} />
		</div>
	);
});

// ── Head ───────────────────────────────────────────────────────────────────

/** The `<thead>`; sticky under `tableLayout.headerSticky`. */
export const DataGridTableHead = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"thead">>(function DataGridTableHead(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useDataGrid();
	return (
		<thead
			ref={ref}
			className={cn(gridProps.tableClassNames.header, gridProps.tableLayout.headerSticky ? gridProps.tableClassNames.headerSticky : undefined, className)}
			{...props}
		/>
	);
});

export interface DataGridTableHeadRowProps extends React.ComponentProps<"tr"> {
	/** The merged header group's id. */
	readonly rowId: string;
}

/** One head row. */
export const DataGridTableHeadRow = React.forwardRef<HTMLTableRowElement, DataGridTableHeadRowProps>(function DataGridTableHeadRow(
	{ rowId, className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, withGrid } = useDataGrid();
	const { tableLayout } = gridProps;
	const isMultiLevel = withGrid(IS_MULTI_LEVEL_HEADER_VISITOR);
	return (
		<tr
			ref={ref}
			data-row-id={rowId}
			aria-rowindex={tableLayout.cellSelection ? HEADER_ROW_ARIA_INDEX : undefined}
			className={cn(
				tableLayout.headerBorder ? "[&>th]:border-b" : undefined,
				// Under row-merged cells a row's last child is not the last column.
				tableLayout.cellBorder && !isMultiLevel ? "*:last:border-e-0" : undefined,
				tableLayout.stripped || !tableLayout.headerBackground ? "bg-transparent" : undefined,
				gridProps.tableClassNames.headerRow,
				className,
			)}
			{...props}
		/>
	);
});

function ariaSortOf<TData extends RowData>(column: DataGridColumn<TData>): "ascending" | "descending" | "none" | undefined {
	const sortDirection = column.getIsSorted();
	if (sortDirection === "asc") {
		return "ascending";
	}
	if (sortDirection === "desc") {
		return "descending";
	}
	return column.getCanSort() ? "none" : undefined;
}

export interface DataGridTableHeadRowCellProps<TData extends RowData> {
	readonly children?: React.ReactNode;
	readonly header: DataGridHeader<TData>;
	/** Headers this cell spans through `meta.headerColSpan`; they render none. */
	readonly coveredHeaders?: readonly DataGridHeader<TData>[] | undefined;
	/** The drag-and-drop variant's sortable node ref. */
	readonly dndRef?: React.Ref<HTMLTableCellElement> | undefined;
	/** The drag-and-drop variant's transform style. */
	readonly dndStyle?: React.CSSProperties | undefined;
	readonly ref?: React.Ref<HTMLTableCellElement> | undefined;
}

/** A head cell: sort semantics, pinning, spans, group rules and the band that aligns merged labels. */
export function DataGridTableHeadRowCell<TData extends RowData>({
	children,
	header,
	coveredHeaders = [],
	dndRef,
	dndStyle,
	ref,
}: DataGridTableHeadRowCellProps<TData>): React.JSX.Element {
	const { props } = useDataGrid();
	const { tableLayout, tableClassNames } = props;
	const { column } = header;
	const { table } = column;
	// Pinned offsets and the span width below read sizing state.
	useDataGridAtom(table.atoms.columnSizing);
	const mergedRef = React.useMemo((): React.RefCallback<HTMLTableCellElement> => mergeRefs(ref, dndRef), [ref, dndRef]);

	// A group spans several leaves and its own column reads pinned when ANY
	// leaf is: pin state, edges and offsets come from its first and last leaf.
	const isGroup = column.columns.length > 0;
	const isSpan = coveredHeaders.length > 0;
	const leafColumns = isSpan ? [column, ...coveredHeaders.map((covered) => covered.column)] : getDataGridHeaderLeafColumns(header);
	const colSpan = coveredHeaders.reduce((sum, covered) => sum + covered.colSpan, header.colSpan);
	const size = coveredHeaders.reduce((sum, covered) => sum + covered.getSize(), header.getSize());
	const resizeColumn = getDataGridHeadCellResizeHeader(header, coveredHeaders).column;
	const firstLeaf = leafColumns.at(0) ?? column;
	const lastLeaf = leafColumns.at(-1) ?? column;
	const isPinned = firstLeaf.getIsPinned();
	const isFirstStartPinned = isPinned === "start" && firstLeaf.getIsFirstColumn("start");
	const isLastStartPinned = isPinned === "start" && lastLeaf.getIsLastColumn("start");
	const isFirstEndPinned = isPinned === "end" && firstLeaf.getIsFirstColumn("end");
	const isLastEndPinned = isPinned === "end" && lastLeaf.getIsLastColumn("end");
	const isFirst = getDataGridTableColumnEdges(table, firstLeaf.id).isFirst;
	const isLast = getDataGridTableColumnEdges(table, lastLeaf.id).isLast;
	const isMultiLevel = table.getHeaderGroups().length > 1;
	// Every cell ending on the header's bottom edge holds its content in a leaf-row-high band, so merged labels sit level with leaf labels.
	const isBanded = header.rowSpan > 1 || (isMultiLevel && header.subHeaders.length === 0);
	// A group with no resize handle of its own continues the line its edge leaf draws.
	const groupLineEdge =
		isGroup && !column.getCanResize()
			? getDataGridHeaderLineEdge(table, tableLayout, lastLeaf) === "end"
				? "end"
				: getDataGridHeaderLineEdge(table, tableLayout, firstLeaf) === "start"
					? "start"
					: null
			: null;
	const hasColumnDividers = tableLayout.cellBorder || tableLayout.columnsResizable;
	const pinnable = tableLayout.columnsPinnable && column.getCanPin();
	const pinningStyle = pinnable ? (isGroup || isSpan ? { ...getPinningStyles(isPinned === "end" ? lastLeaf : firstLeaf), width: size } : getPinningStyles(column)) : undefined;

	const cellStyle: React.CSSProperties = {
		...(tableLayout.width === "fixed" && !tableLayout.columnsResizable ? { width: size } : undefined),
		...pinningStyle,
		// A sticky child does not ride a sticky ancestor: pin both axes on the cell itself.
		...(tableLayout.headerSticky && isPinned !== false ? { top: 0 } : undefined),
		...(tableLayout.columnsResizable ? { width: getDataGridHeadCellSizeVar(header, coveredHeaders) } : undefined),
		...dndStyle,
	};

	return (
		<th
			ref={mergedRef}
			// One colgroup holds every col, so a group or span is a col header whose colSpan carries its reach.
			scope="col"
			colSpan={colSpan > 1 ? colSpan : undefined}
			rowSpan={header.rowSpan > 1 ? header.rowSpan : undefined}
			aria-sort={ariaSortOf(column)}
			aria-colindex={tableLayout.cellSelection ? firstLeaf.getIndex() + 1 : undefined}
			data-col-id={column.id}
			data-header-id={header.id}
			data-header-depth={header.headerGroup?.depth}
			data-group={isGroup ? true : undefined}
			data-merged={header.rowSpan > 1 ? true : undefined}
			data-span={isSpan ? colSpan : undefined}
			style={cellStyle}
			data-pinned={isPinned === false ? undefined : isPinned}
			data-outer-pinned-col={isFirstStartPinned ? "start" : isLastEndPinned ? "end" : undefined}
			data-last-col={isLastStartPinned ? "start" : isFirstEndPinned ? "end" : undefined}
			className={cn(
				dataGridHeaderCellVariants({ size: spacingSize(tableLayout) }),
				isBanded ? "align-bottom" : undefined,
				tableLayout.headerBackground ? "bg-muted" : undefined,
				tableLayout.cellBorder ? "border-e" : undefined,
				// Multi-level rows end on different columns, so each cell checks its own last leaf.
				tableLayout.cellBorder && isMultiLevel && isLast ? "border-e-0" : undefined,
				// The resize filler follows the center group; a border on the last center cell would float against it.
				tableLayout.cellBorder &&
					tableLayout.columnsResizable &&
					(tableLayout.columnsPinnable || !hasDataGridTableRightPinnedColumns(table)) &&
					isPinned === false &&
					lastLeaf.getIsLastColumn("center")
					? "border-e-0"
					: undefined,
				// A group's own bottom border is the rule spanning exactly its leaves.
				isGroup ? (hasColumnDividers ? "border-b" : "border-b-transparent") : undefined,
				tableLayout.columnsResizable && resizeColumn.getCanResize() ? (isPinned === false ? "overflow-visible" : "overflow-hidden") : undefined,
				// Clears the last column's end-edge resize handle.
				tableLayout.columnsResizable && resizeColumn.getCanResize() && isLast && isPinned !== "end" ? "pe-8" : undefined,
				pinnable ? cn("data-outer-pinned-col:bg-clip-padding data-pinned:isolate data-pinned:bg-muted", PINNED_EDGE_SHADOW_CLASSES) : undefined,
				column.columnDef.meta?.headerClassName,
				isFirst || isLast ? tableClassNames.edgeCell : undefined,
			)}>
			{isBanded ? (
				<div
					data-slot="data-grid-table-head-cell-band"
					className={cn(
						"table w-full table-fixed",
						tableLayout.dense ? (tableLayout.headerBorder ? "h-[calc(--spacing(8)-1px)]" : "h-8") : tableLayout.headerBorder ? "h-[calc(--spacing(10)-1px)]" : "h-10",
					)}>
					<div className="table-cell align-middle">{children}</div>
				</div>
			) : (
				children
			)}
			{isGroup && !hasColumnDividers ? (
				<span
					aria-hidden="true"
					data-slot="data-grid-table-head-group-rule"
					className={cn("pointer-events-none absolute h-px bg-border", tableLayout.headerBorder ? "-bottom-px" : "bottom-0", tableLayout.dense ? "inset-x-2" : "inset-x-3")}
				/>
			) : null}
			{groupLineEdge === null ? null : (
				<span
					aria-hidden="true"
					data-slot="data-grid-table-head-divider"
					className={cn("pointer-events-none absolute inset-y-0 w-px bg-border", groupLineEdge === "end" ? "end-0" : "start-0")}
				/>
			)}
		</th>
	);
}

function selectIsResizingColumn(resizing: { readonly isResizingColumn: false | string }): false | string {
	return resizing.isResizingColumn;
}

export interface DataGridTableHeadRowCellResizeProps<TData extends RowData> {
	readonly header: DataGridHeader<TData>;
}

/**
 * A column's resize handle: a button (its accessible name from the
 * `resizeColumn` label) that drags with mouse or touch, resets on
 * double-click, and steps with ArrowLeft / ArrowRight.
 */
export function DataGridTableHeadRowCellResize<TData extends RowData>({ header }: DataGridTableHeadRowCellResizeProps<TData>): React.JSX.Element {
	const { props, autoSize, labels } = useDataGrid();
	const { tableLayout } = props;
	const { column } = header;
	const { table } = column;
	// Re-renders as a drag starts and ends, for column.getIsResizing() below.
	useDataGridAtom(table.atoms.columnResizing, selectIsResizingColumn);
	// A group's handle sits on its edge leaf's boundary: the last leaf, or the first for an end-pinned group.
	const leafColumns = getDataGridHeaderLeafColumns(header);
	const isPinned = (leafColumns.at(0) ?? column).getIsPinned();
	const edgeColumn = (isPinned === "end" ? leafColumns.at(0) : leafColumns.at(-1)) ?? column;
	const isLastVisibleColumn = getDataGridTableColumnEdges(table, edgeColumn.id).isLast;
	const hidesLastCenterLine = tableLayout.columnsPinnable && edgeColumn.getIsLastColumn("center") && hasDataGridTableRightPinnedColumns(table);
	const isResizeModeOnEnd = isOnEndResizeMode(tableLayout, table);
	const stopResizeSessionRef = React.useRef<(() => void) | undefined>(undefined);

	// End a live drag if the handle unmounts mid-resize, so document listeners and the cursor don't outlive the grid.
	React.useEffect(
		(): (() => void) => (): void => {
			stopResizeSessionRef.current?.();
			stopResizeSessionRef.current = undefined;
		},
		[],
	);

	const handleMouseDown = React.useCallback(
		(event: React.MouseEvent<HTMLElement>): void => {
			// Only the primary button starts a resize; right-click keeps the context menu.
			if (event.button !== PRIMARY_MOUSE_BUTTON) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			stopResizeSessionRef.current?.();
			stopResizeSessionRef.current = startDataGridColumnResize(event, header, !isResizeModeOnEnd, autoSize);
		},
		[header, isResizeModeOnEnd, autoSize],
	);

	const handleTouchStart = React.useCallback(
		(event: React.TouchEvent<HTMLElement>): void => {
			event.preventDefault();
			event.stopPropagation();
			stopResizeSessionRef.current?.();
			stopResizeSessionRef.current = startDataGridColumnResize(event, header, !isResizeModeOnEnd, autoSize);
		},
		[header, isResizeModeOnEnd, autoSize],
	);

	const handleDoubleClick = React.useCallback((): void => {
		column.resetSize();
	}, [column]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLElement>): void => {
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			// The arrow follows the edge the handle sits on: mirrored for RTL and end-pinned columns.
			const grows = (event.key === "ArrowRight") !== isMirroredResize(table, column);
			const next = column.getSize() + (grows ? RESIZE_KEYBOARD_STEP_PX : -RESIZE_KEYBOARD_STEP_PX);
			const { minSize, maxSize } = column.columnDef;
			const clamped = Math.min(Math.max(next, minSize ?? 0), maxSize ?? Number.POSITIVE_INFINITY);
			table.setColumnSizing((old) => ({ ...old, [column.id]: clamped }));
		},
		[table, column],
	);

	const isResizing = column.getIsResizing();

	return (
		// A button (not a div): consumers stretch end-aligned header CONTENT with
		// `[&>div]:w-full`, which must not catch the handle.
		<button
			type="button"
			data-slot="data-grid-table-resize-handle"
			aria-label={labels.resizeColumn(getColumnHeaderLabel(column))}
			onDoubleClick={handleDoubleClick}
			onMouseDown={handleMouseDown}
			onTouchStart={handleTouchStart}
			onKeyDown={handleKeyDown}
			className={cn(
				"absolute top-0 z-10 flex h-full cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
				isPinned === "end"
					? cn(
							// An end-pinned column grows from its START edge, so the handle lives there.
							"start-0 w-5 justify-start",
							tableLayout.columnsPinnable ? "before:hidden" : "before:absolute before:inset-y-0 before:start-0 before:w-px before:bg-border",
						)
					: isLastVisibleColumn
						? "end-0 w-5 justify-end before:hidden"
						: isPinned === "start"
							? cn(
									// A sticky pinned column keeps the handle inside the cell, where the next sticky cell cannot paint over it.
									"end-0 w-5 justify-end",
									tableLayout.columnsPinnable ? "before:hidden" : "before:absolute before:inset-y-0 before:end-0 before:w-px before:bg-border",
								)
							: cn(
									"-end-2 w-5 justify-center",
									// With cell borders the th border-e already marks the boundary.
									tableLayout.cellBorder || hidesLastCenterLine ? "before:hidden" : "before:absolute before:inset-y-0 before:end-2 before:w-px before:bg-border",
								),
				isResizing
					? isResizeModeOnEnd
						? "opacity-100"
						: isLastVisibleColumn && isPinned !== "end"
							? "opacity-100 before:absolute before:inset-y-0 before:end-0 before:block before:w-0.5 before:bg-primary"
							: isPinned === false
								? cn(
										"opacity-100 before:absolute before:inset-y-0 before:block before:w-0.5 before:bg-primary",
										tableLayout.cellBorder && !hidesLastCenterLine ? "before:end-[calc(--spacing(2)-1px)]" : "before:end-2",
									)
								: "opacity-100 before:block before:w-0.5 before:bg-primary"
					: undefined,
			)}
		/>
	);
}

// ── Resize indicator (onEnd mode) ──────────────────────────────────────────

interface DataGridTableResizeIndicatorProps {
	readonly viewportNodeRef: React.RefObject<HTMLDivElement | null>;
}

interface HeaderHeightCache {
	key: string | false;
	value: number;
}

function DataGridTableResizeIndicatorInner<TData extends RowData>({
	table,
	viewportNodeRef,
}: DataGridTableResizeIndicatorProps & { readonly table: DataGridCoreTable<TData> }): React.JSX.Element | null {
	const { props } = useDataGrid();
	const indicatorRef = React.useRef<HTMLDivElement | null>(null);
	const indicatorHeadRef = React.useRef<HTMLDivElement | null>(null);
	// The header height is stable for a drag; caching it avoids a forced layout per mousemove.
	const headerHeightCacheRef = React.useRef<HeaderHeightCache>({ key: false, value: 0 });
	const columnResizing = useDataGridAtom(table.atoms.columnResizing);
	const resizingColumnId = columnResizing.isResizingColumn;
	const isActive = props.tableLayout.columnsResizable && isOnEndResizeMode(props.tableLayout, table) && resizingColumnId !== false;

	// Positioned imperatively after each drag-frame render: layout reads and ref access stay outside render.
	React.useLayoutEffect((): void => {
		const indicator = indicatorRef.current;
		const indicatorHead = indicatorHeadRef.current;
		const viewportElement = viewportNodeRef.current;
		if (!isActive || indicator === null || indicatorHead === null) {
			return;
		}
		const resizingHeader = table.getFlatHeaders().find((header) => header.column.id === resizingColumnId || header.id === resizingColumnId);
		if (resizingHeader === undefined) {
			return;
		}
		// deltaOffset is a logical delta; translate by the physical pointer movement.
		const mirrored = isMirroredResize(table, resizingHeader.column);
		const deltaOffset = (columnResizing.deltaOffset ?? 0) * (mirrored ? -1 : 1);
		const viewportRoot = viewportElement ?? indicator.closest<HTMLElement>('[data-slot="data-grid-table-viewport"]');
		// A 0 is never cached: it means the thead was not measurable yet.
		if (headerHeightCacheRef.current.key !== resizingColumnId || headerHeightCacheRef.current.value <= 0) {
			headerHeightCacheRef.current = {
				key: resizingColumnId,
				value: viewportRoot?.querySelector('[data-slot="data-grid-table"] thead')?.getBoundingClientRect().height ?? 0,
			};
		}
		// Anchor on the live header cell (right for sticky pinned columns at any scroll); a covered leaf's edge is its span's th.
		const spanOwnerId = [...getDataGridHeaderSpans(table)].find(([, covered]) => covered.some((leaf) => leaf.id === resizingHeader.column.id))?.at(LIST_SLOT_INDEX.first);
		const anchorColumnId = spanOwnerId ?? resizingHeader.column.id;
		const headerCellElement = [...(viewportRoot?.querySelectorAll<HTMLElement>("thead th[data-col-id]") ?? [])].find((cell) => cell.dataset.colId === anchorColumnId);
		let indicatorLeft: number;
		if (headerCellElement !== undefined && viewportRoot !== null) {
			const anchorRect = headerCellElement.getBoundingClientRect();
			indicatorLeft = (mirrored ? anchorRect.left : anchorRect.right) - viewportRoot.getBoundingClientRect().left;
		} else if (columnResizing.startOffset !== null && viewportElement !== null) {
			indicatorLeft = columnResizing.startOffset - viewportElement.getBoundingClientRect().left;
		} else {
			indicatorLeft = resizingHeader.getStart() + resizingHeader.getSize();
		}
		indicator.style.left = `${String(indicatorLeft)}px`;
		indicator.style.transform = `translateX(${String(deltaOffset)}px)`;
		indicatorHead.style.height = `${String(Math.max(headerHeightCacheRef.current.value, INDICATOR_MIN_HEAD_HEIGHT_PX))}px`;
	});

	if (!isActive) {
		return null;
	}

	return (
		<div ref={indicatorRef} aria-hidden="true" data-slot="data-grid-table-resize-indicator" className="pointer-events-none absolute inset-y-0 z-overlay">
			<div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-primary/85" />
			<div ref={indicatorHeadRef} className="absolute top-0 left-0 w-[5px] -translate-x-1/2 rounded-b-sm bg-primary shadow-xs" />
		</div>
	);
}

function DataGridTableResizeIndicator({ viewportNodeRef }: DataGridTableResizeIndicatorProps): React.JSX.Element | null {
	const { withGrid } = useDataGrid();
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({ visit: (grid) => <DataGridTableResizeIndicatorInner table={grid.table} viewportNodeRef={viewportNodeRef} /> }),
		[viewportNodeRef],
	);
	return withGrid(visitor);
}

// ── Body / foot sections ───────────────────────────────────────────────────

/** Breathing room between the head and the body when rows carry no borders. */
export const DataGridTableRowSpacer = React.forwardRef<HTMLTableSectionElement, Omit<React.ComponentProps<"tbody">, "children">>(function DataGridTableRowSpacer(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <tbody ref={ref} aria-hidden="true" data-slot="data-grid-table-body-spacer" className={cn("h-2", className)} {...props} />;
});

/** The `<tbody>`. */
export const DataGridTableBody = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tbody">>(function DataGridTableBody(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useDataGrid();
	return (
		<tbody
			ref={ref}
			data-slot="data-grid-table-body"
			className={cn(
				gridProps.tableLayout.rowRounded ? "[&_td:first-child]:rounded-s-lg [&_td:last-child]:rounded-e-lg" : undefined,
				gridProps.tableClassNames.body,
				className,
			)}
			{...props}
		/>
	);
});

/** The `<tfoot>`. */
export const DataGridTableFoot = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tfoot">>(function DataGridTableFoot(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useDataGrid();
	return (
		<tfoot
			ref={ref}
			data-slot="data-grid-table-foot"
			className={cn(gridProps.tableLayout.rowBorder ? "[&>tr:first-child>td]:border-t" : undefined, gridProps.tableClassNames.footer, className)}
			{...props}
		/>
	);
});

/** A footer row; appends the filler strip's cell. */
export const DataGridTableFootRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(function DataGridTableFootRow(
	{ className, children, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, withGrid } = useDataGrid();
	const { tableLayout } = gridProps;
	const hasRightPinnedColumns = withGrid(HAS_END_PINNED_VISITOR);
	return (
		<tr
			ref={ref}
			data-slot="data-grid-table-foot-row"
			className={cn(
				tableLayout.footerBackground ? `bg-muted/40 dark:bg-[color:${PINNED_SURFACE}]` : undefined,
				tableLayout.rowBorder ? BODY_ROW_BOTTOM_BORDER_CLASSES : undefined,
				tableLayout.cellBorder ? "*:last:border-e-0" : undefined,
				// The fill foot cell is the :last child; the real last cell needs the same treatment.
				tableLayout.cellBorder && tableLayout.columnsResizable && (tableLayout.columnsPinnable || !hasRightPinnedColumns)
					? "[&>td:has(+td[data-slot=data-grid-table-fill-foot-cell])]:border-e-0"
					: undefined,
				className,
			)}
			{...props}>
			{children}
			<DataGridTableFillFootCell />
		</tr>
	);
});

/** A footer cell. */
export const DataGridTableFootRowCell = React.forwardRef<HTMLTableCellElement, React.ComponentProps<"td">>(function DataGridTableFootRowCell(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useDataGrid();
	const { tableLayout } = gridProps;
	return (
		<td
			ref={ref}
			className={cn(
				dataGridFooterCellVariants({ size: spacingSize(tableLayout) }),
				tableLayout.footerBackground ? `bg-muted/40 dark:bg-[color:${PINNED_SURFACE}]` : undefined,
				tableLayout.cellBorder ? "border-e" : undefined,
				className,
			)}
			{...props}
		/>
	);
});

// ── Skeleton rows ──────────────────────────────────────────────────────────

/** A loading skeleton row. */
export const DataGridTableBodyRowSkeleton = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(function DataGridTableBodyRowSkeleton(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useDataGrid();
	const { tableLayout } = gridProps;
	return (
		<tr
			ref={ref}
			className={cn(
				"hover:bg-muted/40 data-[state=selected]:bg-muted/50",
				gridProps.onRowClick === undefined ? undefined : "cursor-pointer",
				!tableLayout.stripped && tableLayout.rowBorder ? "border-b border-border [&:not(:last-child)>td]:border-b" : undefined,
				tableLayout.cellBorder ? "*:last:border-e-0" : undefined,
				tableLayout.stripped ? "odd:bg-muted/90 hover:bg-transparent odd:hover:bg-muted" : undefined,
				gridProps.tableClassNames.bodyRow,
				className,
			)}
			{...props}
		/>
	);
});

/** The classes a body or skeleton cell shares: borders, truncation, pinning. */
function bodyCellClasses<TData extends RowData>(
	layout: DataGridResolvedTableLayout,
	column: DataGridColumn<TData>,
	hasRightPinnedColumns: boolean,
	truncates: boolean,
): string {
	return cn(
		dataGridBodyCellVariants({ size: spacingSize(layout) }),
		layout.cellBorder ? "border-e" : undefined,
		// No floating border against the resize filler strip.
		layout.cellBorder && layout.columnsResizable && (layout.columnsPinnable || !hasRightPinnedColumns) && column.getIsPinned() === false && column.getIsLastColumn("center")
			? "border-e-0"
			: undefined,
		layout.columnsResizable && column.getCanResize() && truncates ? "truncate" : undefined,
		column.columnDef.meta?.cellClassName,
		layout.columnsPinnable && column.getCanPin() ? cn(`data-pinned:isolate data-pinned:bg-[color:${PINNED_SURFACE}]`, PINNED_EDGE_SHADOW_CLASSES) : undefined,
	);
}

/** The pin data attributes and style a body or skeleton cell shares. */
function bodyCellLayoutStyle<TData extends RowData>(layout: DataGridResolvedTableLayout, column: DataGridColumn<TData>): React.CSSProperties {
	return {
		...(layout.columnsPinnable && column.getCanPin() ? getPinningStyles(column) : undefined),
		...(layout.columnsResizable ? { width: `calc(var(--col-${column.id}-size) * 1px)` } : undefined),
	};
}

function lastColAttr<TData extends RowData>(column: DataGridColumn<TData>): "start" | "end" | undefined {
	const isPinned = column.getIsPinned();
	if (isPinned === "start" && column.getIsLastColumn("start")) {
		return "start";
	}
	if (isPinned === "end" && column.getIsFirstColumn("end")) {
		return "end";
	}
	return undefined;
}

export interface DataGridTableBodyRowSkeletonCellProps<TData extends RowData> {
	readonly children?: React.ReactNode;
	readonly column: DataGridColumn<TData>;
	readonly ref?: React.Ref<HTMLTableCellElement> | undefined;
}

/** A skeleton row's cell, laid out exactly like a body cell of `column`. */
export function DataGridTableBodyRowSkeletonCell<TData extends RowData>({ children, column, ref }: DataGridTableBodyRowSkeletonCellProps<TData>): React.JSX.Element {
	const { props } = useDataGrid();
	const { tableLayout, tableClassNames } = props;
	const { table } = column;
	const edges = getDataGridTableColumnEdges(table, column.id);
	const isPinned = column.getIsPinned();
	return (
		<td
			ref={ref}
			style={bodyCellLayoutStyle(tableLayout, column)}
			data-pinned={isPinned === false ? undefined : isPinned}
			data-last-col={lastColAttr(column)}
			className={cn(
				bodyCellClasses(tableLayout, column, hasDataGridTableRightPinnedColumns(table), true),
				edges.isFirst || edges.isLast ? tableClassNames.edgeCell : undefined,
			)}>
			{children}
		</td>
	);
}

// ── Body rows ──────────────────────────────────────────────────────────────

export interface DataGridTableBodyRowProps<TData extends RowData> {
	readonly children?: React.ReactNode;
	readonly row: DataGridRow<TData>;
	readonly pinnedBoundary?: DataGridTablePinnedBoundary | undefined;
	/** A ref to the row node (the virtual variant measures rows through it). */
	readonly rowRef?: React.Ref<HTMLTableRowElement> | undefined;
	/** The drag-and-drop variant's sortable node ref. */
	readonly dndRef?: React.Ref<HTMLTableRowElement> | undefined;
	/** The drag-and-drop variant's transform style. */
	readonly dndStyle?: React.CSSProperties | undefined;
	/** The row is the one being dragged (style its slot through `data-dragging`). */
	readonly dndDragging?: boolean | undefined;
	/** Absolute (virtualized) row index: `data-index`, and striping by index instead of `:nth-child`. */
	readonly dataIndex?: number | undefined;
	readonly ref?: React.Ref<HTMLTableRowElement> | undefined;
}

/** The status tints `getRowStatus` activates; pinned cells get the same tints pre-mixed over the opaque surface. */
const ROW_STATUS_CLASSES =
	"data-[row-status=deleted]:bg-destructive/5 data-[row-status=deleted]:opacity-60 data-[row-status=dirty]:bg-warning/5 data-[row-status=new]:bg-success/5 data-[row-status=deleted]:[&_td]:line-through";
const ROW_STATUS_PINNED_CLASSES = `data-[row-status=deleted]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--destructive)_5%,${PINNED_SURFACE})] data-[row-status=dirty]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--warning)_5%,${PINNED_SURFACE})] data-[row-status=new]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--success)_5%,${PINNED_SURFACE})]`;
const ROW_PINNED_HOVER_CLASSES = `hover:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--muted)_40%,${PINNED_SURFACE})] data-[state=selected]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--muted)_50%,${PINNED_SURFACE})]`;

/** A body row: selection state, CRUD tints, pinned-row chrome, row click. */
export function DataGridTableBodyRow<TData extends RowData>({
	children,
	row,
	pinnedBoundary,
	rowRef,
	dndRef,
	dndStyle,
	dndDragging,
	dataIndex,
	ref,
}: DataGridTableBodyRowProps<TData>): React.JSX.Element {
	const { props } = useDataGrid();
	const { tableLayout, tableClassNames, onRowClick, getRowStatus } = props;
	const isRowPinned = row.getIsPinned();
	const rowStatus = getRowStatus?.(row.id);
	const mergedRef = React.useMemo((): React.RefCallback<HTMLTableRowElement> => mergeRefs(ref, rowRef, dndRef), [ref, rowRef, dndRef]);
	const rowId = row.id;

	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLTableRowElement>): void => {
			if (isDataGridPortalEvent(event)) {
				return;
			}
			onRowClick?.(rowId);
		},
		[onRowClick, rowId],
	);

	return (
		<tr
			ref={mergedRef}
			style={dndStyle}
			data-state={row.getIsSelected() ? "selected" : undefined}
			data-index={dataIndex}
			data-row-id={row.id}
			data-depth={row.depth > 0 ? row.depth : undefined}
			data-row-pinned={isRowPinned === false ? undefined : isRowPinned}
			data-row-pinned-boundary={pinnedBoundary}
			data-row-status={rowStatus}
			// Style the dragged row's slot through this, never its inline style.
			data-dragging={dndDragging === true ? true : undefined}
			// 1-based after the header row; row.index keeps the announced index absolute across pagination.
			aria-rowindex={tableLayout.cellSelection ? row.index + BODY_ROW_ARIA_INDEX_OFFSET : undefined}
			onClick={handleClick}
			className={cn(
				"hover:bg-muted/40 data-[state=selected]:bg-muted/50",
				tableLayout.columnsPinnable ? ROW_PINNED_HOVER_CLASSES : undefined,
				onRowClick === undefined ? undefined : "cursor-pointer",
				getRowStatus === undefined ? undefined : ROW_STATUS_CLASSES,
				getRowStatus !== undefined && tableLayout.columnsPinnable ? ROW_STATUS_PINNED_CLASSES : undefined,
				rowStatus === "new" ? tableClassNames.rowNew : undefined,
				rowStatus === "dirty" ? tableClassNames.rowDirty : undefined,
				rowStatus === "deleted" ? tableClassNames.rowDeleted : undefined,
				!tableLayout.stripped && tableLayout.rowBorder ? BODY_ROW_BOTTOM_BORDER_CLASSES : undefined,
				tableLayout.cellBorder ? `*:last:border-e-0 ${BODY_ROW_BOTTOM_BORDER_CLASSES}` : undefined,
				// Virtualized rows stripe by absolute row index (:nth-child parity flips as spacer rows resize).
				tableLayout.stripped
					? dataIndex === undefined
						? "odd:bg-muted/90 hover:bg-transparent odd:hover:bg-muted"
						: cn("hover:bg-transparent", dataIndex % 2 === 0 ? "bg-muted/90 hover:bg-muted" : undefined)
					: undefined,
				tableLayout.rowsPinnable && isRowPinned !== false ? "bg-muted/30 hover:bg-muted/50" : undefined,
				pinnedBoundary === "top" ? "[&>td]:shadow-[0_2px_0_var(--shadow-ambient)]" : undefined,
				// A bottom-pinned row borders scrolled content along its TOP edge.
				pinnedBoundary === "bottom" ? "[&>td]:shadow-[0_-2px_0_var(--shadow-ambient)]" : undefined,
				tableLayout.rowsPinnable && isRowPinned !== false ? tableClassNames.rowPinned : undefined,
				tableClassNames.bodyRow,
			)}>
			{children}
		</tr>
	);
}

export interface DataGridTableBodyRowExpandedProps<TData extends RowData> {
	readonly row: DataGridRow<TData>;
}

/** The detail row under an expanded row: the first column's `meta.expandedContent`. Renders nothing without one. */
export function DataGridTableBodyRowExpandded<TData extends RowData>({ row }: DataGridTableBodyRowExpandedProps<TData>): React.JSX.Element | null {
	const { props } = useDataGrid();
	const expandedContent = row.table.getAllColumns().find((column) => column.columnDef.meta?.expandedContent !== undefined)?.columnDef.meta?.expandedContent;
	// Tree and grouped rows share row.getIsExpanded(); an empty <tr> would break striping and row measurement.
	if (expandedContent === undefined) {
		return null;
	}
	return (
		<tr data-slot="data-grid-table-expanded-row" className={cn(props.tableLayout.rowBorder ? BODY_ROW_BOTTOM_BORDER_CLASSES : undefined)}>
			<td colSpan={row.getVisibleCells().length + (props.tableLayout.columnsResizable ? FILL_COLUMN_SPAN : 0)}>{expandedContent(row.original)}</td>
		</tr>
	);
}

// ── Body cells ─────────────────────────────────────────────────────────────

export interface DataGridTableBodyRowCellProps<TData extends RowData> {
	readonly children?: React.ReactNode;
	readonly cell: DataGridCell<TData>;
	/** The drag-and-drop variant's sortable node ref. */
	readonly dndRef?: React.Ref<HTMLTableCellElement> | undefined;
	/** The drag-and-drop variant's transform style. */
	readonly dndStyle?: React.CSSProperties | undefined;
	/** Center-column index under column virtualization (`data-column-index`). */
	readonly columnIndex?: number | undefined;
	readonly ref?: React.Ref<HTMLTableCellElement> | undefined;
}

interface DataGridTableBodyCellTdProps<TData extends RowData> extends DataGridTableBodyRowCellProps<TData> {
	readonly selection: DataGridCellSelectionCellAttrs | null;
}

const CELL_STATUS_CLASSES =
	"data-[cell-status=invalid]:after:border-t-destructive data-[cell-status]:relative data-[cell-status]:after:absolute data-[cell-status]:after:end-0 data-[cell-status]:after:top-0 data-[cell-status]:after:size-0 data-[cell-status]:after:border-s-[5px] data-[cell-status]:after:border-t-[5px] data-[cell-status]:after:border-s-transparent data-[cell-status]:after:content-[''] data-[cell-status=dirty]:after:border-t-warning";

function DataGridTableBodyCellTd<TData extends RowData>({
	children,
	cell,
	dndRef,
	dndStyle,
	columnIndex,
	ref,
	selection,
}: DataGridTableBodyCellTdProps<TData>): React.JSX.Element {
	const { props, gridId } = useDataGrid();
	const { tableLayout, tableClassNames, getCellStatus } = props;
	const { column, row } = cell;
	const { table } = column;
	const edges = getDataGridTableColumnEdges(table, column.id);
	const isPinned = column.getIsPinned();
	const cellSelectionOn = tableLayout.cellSelection;
	const rangeSelectionOn = cellSelectionOn && tableLayout.cellSelectionMode !== "single";
	const mergedRef = React.useMemo((): React.RefCallback<HTMLTableCellElement> => mergeRefs(ref, dndRef), [ref, dndRef]);

	const handleMouseDown = React.useCallback(
		(event: React.MouseEvent<HTMLTableCellElement>): void => {
			if (event.button !== PRIMARY_MOUSE_BUTTON || isDataGridPortalEvent(event)) {
				return;
			}
			if (isDataGridCellInteractiveTarget(event.target)) {
				// A modifier click is a SELECTION gesture even on a control.
				if (rangeSelectionOn && (event.shiftKey || event.metaKey || event.ctrlKey) && cell.getCanSelect()) {
					event.preventDefault();
					cell.getSelectionStartHandler()(event);
					return;
				}
				// A plain press focuses the cell and can start a drag; a motionless one still ends in the control's own click.
				if (cell.getCanSelect()) {
					if (rangeSelectionOn) {
						cell.getSelectionStartHandler()(event);
					} else {
						table.setFocusedCell(row.id, column.id);
					}
				}
				return;
			}
			if (!rangeSelectionOn) {
				// Single mode: every gesture collapses to the one cell.
				if (cell.getCanSelect()) {
					table.setFocusedCell(row.id, column.id);
				}
				return;
			}
			cell.getSelectionStartHandler()(event);
		},
		[cell, table, row.id, column.id, rangeSelectionOn],
	);

	const handleMouseEnter = React.useCallback(
		(event: React.MouseEvent<HTMLTableCellElement>): void => {
			if (!isDataGridPortalEvent(event)) {
				cell.getSelectionExtendHandler()(event);
			}
		},
		[cell],
	);

	const cellStyle: React.CSSProperties = {
		...bodyCellLayoutStyle(tableLayout, column),
		// Paint containment clips at the padding edge, which would erase the ::before selection chrome on pinned cells.
		...(cellSelectionOn ? { contain: undefined } : undefined),
		...dndStyle,
	};
	const showFillHandle = tableLayout.cellFillHandle && selection?.["data-cell-edge-bottom"] === true && selection["data-cell-edge-right"] === true;
	const content =
		cellSelectionOn && tableLayout.columnsResizable && column.getCanResize() ? (
			// With cell selection the td must not clip (its ::before paints 1px outside), so truncation moves inside.
			<div className={dataGridBodyCellTruncateVariants({ size: spacingSize(tableLayout) })}>{children}</div>
		) : (
			children
		);

	return (
		<td
			ref={mergedRef}
			// The id is what the controller's aria-activedescendant points at.
			id={cellSelectionOn ? `${gridId}c-${toDataGridDomId(row.id)}-${toDataGridDomId(column.id)}` : undefined}
			role={selection === null ? undefined : "gridcell"}
			aria-colindex={cellSelectionOn ? column.getIndex() + 1 : undefined}
			aria-selected={selection?.["aria-selected"]}
			data-col-id={selection?.["data-col-id"]}
			data-cell-selected={selection?.["data-cell-selected"]}
			data-cell-focused={selection?.["data-cell-focused"]}
			data-cell-edge-top={selection?.["data-cell-edge-top"]}
			data-cell-edge-right={selection?.["data-cell-edge-right"]}
			data-cell-edge-bottom={selection?.["data-cell-edge-bottom"]}
			data-cell-edge-left={selection?.["data-cell-edge-left"]}
			style={cellStyle}
			data-pinned={isPinned === false ? undefined : isPinned}
			data-last-col={lastColAttr(column)}
			data-cell-status={getCellStatus?.(row.id, column.id)}
			data-column-index={columnIndex}
			onMouseDown={selection === null ? undefined : handleMouseDown}
			onMouseEnter={rangeSelectionOn ? handleMouseEnter : undefined}
			className={cn(
				bodyCellClasses(tableLayout, column, hasDataGridTableRightPinnedColumns(table), !cellSelectionOn),
				getCellStatus === undefined ? undefined : CELL_STATUS_CLASSES,
				edges.isFirst || edges.isLast ? tableClassNames.edgeCell : undefined,
				selection === null ? undefined : dataGridCellSelectionCellClasses,
			)}>
			{content}
			{showFillHandle ? (
				<span
					data-slot="data-grid-cell-fill-handle"
					className={cn(dataGridFillHandleVariants({ variant: tableLayout.cellFillHandleVariant }), tableClassNames.cellFillHandle)}
				/>
			) : null}
		</td>
	);
}

/**
 * A body cell. With `tableLayout.cellSelection` it subscribes to the
 * cell-selection atom with a projecting selector, so a drag re-renders only
 * the cells whose selection state changed.
 */
export function DataGridTableBodyRowCell<TData extends RowData>(cellProps: DataGridTableBodyRowCellProps<TData>): React.JSX.Element {
	const { props } = useDataGrid();
	const { cell } = cellProps;
	const selectAttrs = React.useCallback((): DataGridCellSelectionCellAttrs => getDataGridCellSelectionCellAttrs(cell), [cell]);
	if (!props.tableLayout.cellSelection) {
		return <DataGridTableBodyCellTd {...cellProps} selection={null} />;
	}
	return (
		<Subscribe source={cell.column.table.atoms.cellSelection} selector={selectAttrs}>
			{(selection: DataGridCellSelectionCellAttrs) => <DataGridTableBodyCellTd {...cellProps} selection={selection} />}
		</Subscribe>
	);
}

export interface DataGridTableRenderedRowProps<TData extends RowData> {
	readonly row: DataGridRow<TData>;
	readonly pinnedBoundary?: DataGridTablePinnedBoundary | undefined;
	readonly rowRef?: React.Ref<HTMLTableRowElement> | undefined;
	/** Virtualized list index, rendered as `data-index` for measureElement. */
	readonly rowIndex?: number | undefined;
	/**
	 * Column-virtualization window over the CENTER cells: only the inclusive
	 * [start, end] slice renders, and each flank collapses into one colSpan
	 * spacer (the colgroup stays complete, so the layout cannot drift).
	 */
	readonly centerWindow?: DataGridTableCenterWindow | undefined;
}

function renderBodyCell<TData extends RowData>(cell: DataGridCell<TData>): React.JSX.Element {
	return (
		<DataGridTableBodyRowCell cell={cell} key={cell.id}>
			{flexRender(cell.column.columnDef.cell, cell.getContext())}
		</DataGridTableBodyRowCell>
	);
}

/** One complete body row (start, windowed center, filler, end cells) plus its expanded detail row. */
export function DataGridTableRenderedRow<TData extends RowData>({
	row,
	pinnedBoundary,
	rowRef,
	rowIndex,
	centerWindow,
}: DataGridTableRenderedRowProps<TData>): React.JSX.Element {
	const { props } = useDataGrid();
	const columnsResizable = props.tableLayout.columnsResizable;
	const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(row.table);
	const centerVisibleCells = row.getCenterVisibleCells();
	const windowedCenterCells = centerWindow === undefined ? centerVisibleCells : centerVisibleCells.slice(centerWindow.start, centerWindow.end + 1);
	const leadingSpacerSpan = centerWindow === undefined ? 0 : centerWindow.start;
	const trailingSpacerSpan = centerWindow === undefined ? 0 : Math.max(0, centerVisibleCells.length - 1 - centerWindow.end);

	return (
		<>
			<DataGridTableBodyRow row={row} pinnedBoundary={pinnedBoundary} rowRef={rowRef} dataIndex={rowIndex}>
				{row.getStartVisibleCells().map(renderBodyCell)}
				{/* The spacers carry no data-slot, so sibling `[data-slot] ~ [data-slot]` rules never restyle every row on a column shift. */}
				{leadingSpacerSpan > 0 ? <td aria-hidden="true" data-col-spacer="start" colSpan={leadingSpacerSpan} /> : null}
				{windowedCenterCells.map((cell, cellIndex) => (
					<DataGridTableBodyRowCell cell={cell} key={cell.id} columnIndex={centerWindow === undefined ? undefined : centerWindow.start + cellIndex}>
						{flexRender(cell.column.columnDef.cell, cell.getContext())}
					</DataGridTableBodyRowCell>
				))}
				{trailingSpacerSpan > 0 ? <td aria-hidden="true" data-col-spacer="end" colSpan={trailingSpacerSpan} /> : null}
				{columnsResizable && hasRightPinnedColumns ? <DataGridTableFillBodyCell /> : null}
				{row.getEndVisibleCells().map(renderBodyCell)}
				{columnsResizable && !hasRightPinnedColumns ? <DataGridTableFillBodyCell /> : null}
			</DataGridTableBodyRow>
			{row.getIsExpanded() ? <DataGridTableBodyRowExpandded row={row} /> : null}
		</>
	);
}

// ── States ─────────────────────────────────────────────────────────────────

/** The empty-state row: `emptyMessage`, else the `empty` label, centred on the visible part of the viewport. */
export const DataGridTableEmpty = React.forwardRef<HTMLTableRowElement, Omit<React.ComponentProps<"tr">, "children">>(function DataGridTableEmpty(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { labels, props: gridProps, withGrid } = useDataGrid();
	const stopObserverRef = React.useRef<(() => void) | null>(null);
	const columnCount = withGrid(VISIBLE_LEAF_COUNT_VISITOR) + (gridProps.tableLayout.columnsResizable ? FILL_COLUMN_SPAN : 0);

	// On a table wider than its viewport the message would centre off-screen; a
	// sticky box sized to the viewport (only while the table overflows) centres it on what is visible.
	const handleMessageRef = React.useCallback((node: HTMLDivElement | null): void => {
		stopObserverRef.current?.();
		stopObserverRef.current = null;
		if (node === null || !hasGlobalConstructor("ResizeObserver")) {
			return;
		}
		const scrollViewport = getDataGridScrollAreaViewport(node) ?? node.closest('[data-slot="data-grid-table-viewport"]')?.parentElement ?? null;
		if (scrollViewport === null) {
			return;
		}
		const measure = (): void => {
			const overflows = scrollViewport.scrollWidth > scrollViewport.clientWidth + OVERFLOW_TOLERANCE_PX;
			node.style.width = overflows ? `${String(scrollViewport.clientWidth)}px` : "";
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(scrollViewport);
		const tableNode = node.closest("table");
		if (tableNode !== null) {
			observer.observe(tableNode);
		}
		stopObserverRef.current = (): void => {
			observer.disconnect();
		};
	}, []);

	return (
		<tr ref={ref} className={className} {...props}>
			<td colSpan={Math.max(columnCount, 1)} className="py-6 text-center text-sm text-muted-foreground">
				<div ref={handleMessageRef} data-slot="data-grid-table-empty" className="sticky start-0">
					{gridProps.emptyMessage ?? labels.empty}
				</div>
			</td>
		</tr>
	);
});

/** A floating loading badge, for grids that overlay their loading state instead of replacing the body. */
export const DataGridTableLoader = React.forwardRef<HTMLDivElement, Omit<React.ComponentProps<"div">, "children">>(function DataGridTableLoader(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { labels, props: gridProps } = useDataGrid();
	return (
		<div ref={ref} className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2", className)} {...props}>
			<div role="status" className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm leading-none font-medium text-muted-foreground">
				<Spinner aria-hidden className="size-5 opacity-60" />
				{gridProps.loadingMessage ?? labels.loading}
			</div>
		</div>
	);
});

// ── Row affordances (rendered by column defs) ──────────────────────────────

export interface DataGridTableRowAffordanceProps<TData extends RowData> {
	readonly row: DataGridRow<TData>;
}

/** Row pin toggle: pins the row to the top, or unpins it. */
export function DataGridTableRowPin<TData extends RowData>({ row }: DataGridTableRowAffordanceProps<TData>): React.JSX.Element {
	const { labels } = useDataGrid();
	const isPinned = row.getIsPinned() !== false;
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			// Pinning must not bubble into the row's onRowClick handler.
			event.stopPropagation();
			row.pin(isPinned ? false : "top");
		},
		[row, isPinned],
	);
	return (
		<button
			type="button"
			aria-label={isPinned ? labels.unpinRow : labels.pinRow}
			aria-pressed={isPinned}
			onClick={handleClick}
			className={cn(
				"inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
				isPinned ? "text-primary hover:text-primary/80" : undefined,
			)}>
			{isPinned ? <PinOffIcon className="size-4" aria-hidden="true" /> : <PinIcon className="size-4" aria-hidden="true" />}
		</button>
	);
}

function stopPropagation(event: React.MouseEvent<HTMLElement>): void {
	// Selection must not bubble into the row's onRowClick handler.
	event.stopPropagation();
}

function DataGridTableRowSelectCheckbox<TData extends RowData>({ row }: DataGridTableRowAffordanceProps<TData>): React.JSX.Element {
	const { labels } = useDataGrid();
	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			row.toggleSelected(checked);
		},
		[row],
	);
	const isSelected = row.getIsSelected();
	const isIndeterminate = row.getIsSomeSelected() && !isSelected;
	return (
		<Checkbox
			checked={isSelected}
			indeterminate={isIndeterminate}
			onCheckedChange={handleCheckedChange}
			onClick={stopPropagation}
			aria-label={labels.selectRow}
			className="align-[inherit]"
		/>
	);
}

/**
 * Row selection checkbox. Subscribes to the row-selection atom, so selection
 * is a render dependency of its own even inside a cached cell template.
 */
export function DataGridTableRowSelect<TData extends RowData>({ row }: DataGridTableRowAffordanceProps<TData>): React.JSX.Element {
	return <Subscribe source={row.table.atoms.rowSelection}>{() => <DataGridTableRowSelectCheckbox row={row} />}</Subscribe>;
}

function DataGridTableRowSelectAllCheckbox<TData extends RowData>({ table }: { readonly table: DataGridCoreTable<TData> }): React.JSX.Element {
	const { labels, recordCount, isLoading } = useDataGrid();
	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			table.toggleAllPageRowsSelected(checked);
		},
		[table],
	);
	// `getIsSomePageRowsSelected()` means "at least one" in v9, so the all-selected case is excluded explicitly.
	const isAllSelected = table.getIsAllPageRowsSelected();
	const isIndeterminate = table.getIsSomePageRowsSelected() && !isAllSelected;
	const isDisabled = isLoading || recordCount === 0;
	return (
		<Checkbox
			checked={isAllSelected}
			indeterminate={isIndeterminate}
			disabled={isDisabled}
			onCheckedChange={handleCheckedChange}
			aria-label={labels.selectAll}
			className="align-[inherit]"
		/>
	);
}

const SELECT_ALL_VISITOR: DataGridGridVisitor<React.JSX.Element> = {
	visit: (grid) => {
		const { table } = grid;
		return <Subscribe source={table.atoms.rowSelection}>{() => <DataGridTableRowSelectAllCheckbox table={table} />}</Subscribe>;
	},
};

/** Header select-all checkbox for the current page. */
export function DataGridTableRowSelectAll(): React.JSX.Element {
	return useDataGrid().withGrid(SELECT_ALL_VISITOR);
}

export interface DataGridTableRowExpandProps<TData extends RowData> extends DataGridTableRowAffordanceProps<TData> {
	/** Horizontal offset in px per tree depth level. */
	readonly indent?: number;
	readonly className?: string;
	/** Custom toggle icon; replaces the default chevron. */
	readonly children?: React.ReactNode;
}

/** Row expansion toggle with tree indentation (a compact spacer for leaf rows). */
export function DataGridTableRowExpand<TData extends RowData>({
	row,
	indent = DEFAULT_TREE_INDENT_PX,
	className,
	children,
}: DataGridTableRowExpandProps<TData>): React.JSX.Element {
	const { labels, props } = useDataGrid();
	const isExpanded = row.getIsExpanded();
	const indentStyle = React.useMemo((): DataGridStyle => getDataGridTreeIndentStyle(row, indent), [row, indent]);
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			// Expansion must not bubble into the row's onRowClick handler.
			event.stopPropagation();
			row.toggleExpanded();
		},
		[row],
	);
	return (
		<span data-slot="data-grid-table-row-expand" style={indentStyle} className={cn("inline-flex shrink-0 items-center ps-(--data-grid-tree-padding) align-middle", className)}>
			{row.getCanExpand() ? (
				<button
					type="button"
					aria-expanded={isExpanded}
					aria-label={isExpanded ? labels.collapseRow : labels.expandRow}
					onClick={handleClick}
					className={cn(
						"inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
						props.tableLayout.dense ? "size-6" : "size-7",
					)}>
					{children ?? (
						<ChevronDownIcon
							aria-hidden="true"
							className="size-4 in-aria-[expanded=false]:-rotate-90 motion-safe:transition-transform motion-safe:duration-200 rtl:in-aria-[expanded=false]:rotate-90"
						/>
					)}
				</button>
			) : (
				// Leaf spacer: compact, so leaf content sits near the parent label.
				<span aria-hidden="true" className="w-2 shrink-0" />
			)}
		</span>
	);
}

// ── Body rows (state switch) ───────────────────────────────────────────────

function DataGridTableSkeletonRows<TData extends RowData>({ table, pageSize }: { readonly table: DataGridCoreTable<TData>; readonly pageSize: number }): React.JSX.Element {
	const { props } = useDataGrid();
	const columnsResizable = props.tableLayout.columnsResizable;
	const startAndCenterColumns = [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns()];
	const endColumns = table.getEndVisibleLeafColumns();
	const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);
	const rowKeys = Array.from({ length: pageSize }, (_, rowIndex) => `skeleton-${String(rowIndex)}`);
	const renderSkeletonCell = (column: DataGridColumn<TData>): React.JSX.Element => (
		<DataGridTableBodyRowSkeletonCell column={column} key={column.id}>
			{column.columnDef.meta?.skeleton}
		</DataGridTableBodyRowSkeletonCell>
	);
	return (
		<>
			{rowKeys.map((rowKey) => (
				<DataGridTableBodyRowSkeleton key={rowKey}>
					{startAndCenterColumns.map(renderSkeletonCell)}
					{columnsResizable && hasRightPinnedColumns ? <DataGridTableFillBodyCell /> : null}
					{endColumns.map(renderSkeletonCell)}
					{columnsResizable && !hasRightPinnedColumns ? <DataGridTableFillBodyCell /> : null}
				</DataGridTableBodyRowSkeleton>
			))}
		</>
	);
}

function DataGridTableBodyRows<TData extends RowData>({ table }: { readonly table: DataGridCoreTable<TData> }): React.JSX.Element {
	const { labels, isLoading, props } = useDataGrid();
	const { pageSize } = table.atoms.pagination.get();

	if (isLoading && props.loadingMode === "skeleton" && pageSize > 0) {
		return <DataGridTableSkeletonRows table={table} pageSize={pageSize} />;
	}

	if (isLoading && props.loadingMode === "spinner") {
		return (
			<tr>
				<td colSpan={getDataGridTableOrderedVisibleColumns(table).length + (props.tableLayout.columnsResizable ? FILL_COLUMN_SPAN : 0)} className="p-8">
					<div role="status" className="flex items-center justify-center gap-3 text-muted-foreground">
						<Spinner aria-hidden className="size-5" />
						{props.loadingMessage ?? labels.loading}
					</div>
				</td>
			</tr>
		);
	}

	const resolvedRows = getDataGridTableResolvedRows(table, props.tableLayout.rowsPinnable);
	if (resolvedRows.length === 0) {
		return <DataGridTableEmpty />;
	}

	return (
		<>
			{resolvedRows.map(({ row, pinnedBoundary }) => (
				<DataGridTableRenderedRow key={row.id} row={row} pinnedBoundary={pinnedBoundary} />
			))}
		</>
	);
}

interface DataGridTableBodyRowsGateProps {
	readonly children: React.ReactNode;
	/** `true` while a column resize or a cell-selection drag is in flight. */
	readonly frozen: boolean;
}

/**
 * Skips body re-renders while frozen: during a resize the widths move through
 * CSS variables, and during a cell-selection drag each cell paints through its
 * own subscription, so row reconciliation would be pure waste.
 */
const DataGridTableBodyRowsGate = React.memo(
	function DataGridTableBodyRowsGate({ children }: DataGridTableBodyRowsGateProps): React.ReactNode {
		return children;
	},
	(_previous: DataGridTableBodyRowsGateProps, next: DataGridTableBodyRowsGateProps): boolean => next.frozen,
);

function isBodyFrozen<TData extends RowData>(table: DataGridCoreTable<TData>): boolean {
	return table.atoms.columnResizing.get().isResizingColumn !== false || table._isSelectingCells;
}

// ── Head rows ──────────────────────────────────────────────────────────────

function DataGridTableHeadRows<TData extends RowData>({ table }: { readonly table: DataGridCoreTable<TData> }): React.JSX.Element {
	const { props } = useDataGrid();
	const mergedHeaderGroups = getDataGridTableMergedHeaderGroups(table);
	const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);
	const columnsResizable = props.tableLayout.columnsResizable;

	return (
		<DataGridTableHead>
			{mergedHeaderGroups.map((headerGroup, rowIndex) => {
				// The fill strip is one cell spanning every head row, so only the first row renders it.
				const fillHeadCell = columnsResizable && rowIndex === 0 ? <DataGridTableFillHeadCell rowSpan={mergedHeaderGroups.length} /> : null;
				const renderHeadCell = (header: DataGridHeader<TData>): React.JSX.Element => {
					const coveredHeaders = headerGroup.coveredHeaders.get(header.id);
					const resizeHeader = getDataGridHeadCellResizeHeader(header, coveredHeaders);
					return (
						<DataGridTableHeadRowCell header={header} coveredHeaders={coveredHeaders} key={header.id}>
							{renderDataGridTableHeadCellContent(header)}
							{columnsResizable && resizeHeader.column.getCanResize() ? <DataGridTableHeadRowCellResize header={resizeHeader} /> : null}
						</DataGridTableHeadRowCell>
					);
				};
				return (
					<DataGridTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
						{[...headerGroup.startHeaders, ...headerGroup.centerHeaders].map(renderHeadCell)}
						{hasRightPinnedColumns ? fillHeadCell : null}
						{headerGroup.endHeaders.map(renderHeadCell)}
						{hasRightPinnedColumns ? null : fillHeadCell}
					</DataGridTableHeadRow>
				);
			})}
		</DataGridTableHead>
	);
}

const HEAD_ROWS_VISITOR: DataGridGridVisitor<React.JSX.Element> = { visit: (grid) => <DataGridTableHeadRows table={grid.table} /> };

/** A header-only table (for split header/body layouts). */
export const DataGridTableHeader = React.forwardRef<HTMLDivElement, Omit<DataGridTableViewportProps, "children">>(function DataGridTableHeader(props, ref): React.JSX.Element {
	const { withGrid } = useDataGrid();
	return (
		<DataGridTableViewport ref={ref} {...props}>
			<DataGridTableBase>{withGrid(HEAD_ROWS_VISITOR)}</DataGridTableBase>
		</DataGridTableViewport>
	);
});

// ── DataGridTable ──────────────────────────────────────────────────────────

const BODY_ROWS_VISITOR: DataGridGridVisitor<React.JSX.Element> = {
	visit: (grid) => (
		<DataGridTableBodyRowsGate frozen={isBodyFrozen(grid.table)}>
			<DataGridTableBodyRows table={grid.table} />
		</DataGridTableBodyRowsGate>
	),
};

export interface DataGridTableProps extends Omit<DataGridTableViewportProps, "children"> {
	/** Footer rows (`DataGridTableFootRow`s) rendered in a `<tfoot>`. */
	readonly footerContent?: React.ReactNode;
	/** `false` renders the body only (pair with `DataGridTableHeader`). Defaults to `true`. */
	readonly renderHeader?: boolean;
}

/** The standard grid table: head rows, body (rows / skeleton / spinner / empty), append and add rows, and an optional footer. */
export const DataGridTable = React.forwardRef<HTMLDivElement, DataGridTableProps>(function DataGridTable(
	{ footerContent, renderHeader = true, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, withGrid } = useDataGrid();
	const { tableLayout } = gridProps;
	return (
		<DataGridTableViewport ref={ref} {...props}>
			<DataGridTableBase>
				{renderHeader ? withGrid(HEAD_ROWS_VISITOR) : null}
				{renderHeader && (tableLayout.stripped || !tableLayout.rowBorder) ? <DataGridTableRowSpacer /> : null}
				<DataGridTableBody>
					{withGrid(BODY_ROWS_VISITOR)}
					{gridProps.appendRow}
					<DataGridTableAddRow />
				</DataGridTableBody>
				{footerContent === undefined || footerContent === null ? null : <DataGridTableFoot>{footerContent}</DataGridTableFoot>}
			</DataGridTableBase>
		</DataGridTableViewport>
	);
});
