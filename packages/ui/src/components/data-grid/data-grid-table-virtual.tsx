"use client";

// ============================================================
// components/data-grid/data-grid-table-virtual.tsx
//
// The windowed grid table: only the rows (and, opt-in, the center columns)
// inside the scroll viewport mount, with spacer rows standing in for the rest.
// It composes the same building blocks as `DataGridTable` (data-grid-table.tsx)
// and adds infinite loading (`onFetchMore`) and controlled row / column reveal.
//
// The virtualizer is TanStack's core `Virtualizer` class driven by a small hook
// (`useDataGridVirtualizer`), the kit's pattern (see cascader-virtual.tsx):
// `useVirtualizer` returns functions the React Compiler cannot memoise safely,
// which the repo's lint gate rejects.
// ============================================================

import type { RuntimeValue } from "@workspace/shared";
import {
	useDataGrid,
	useDataGridAtom,
	type DataGridColumn,
	type DataGridCoreTable,
	type DataGridGridVisitor,
	type DataGridResolvedTableLayout,
} from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridTableAddRow,
	DataGridTableBase,
	DataGridTableBody,
	DataGridTableEmpty,
	DataGridTableFillBodyCell,
	DataGridTableFillHeadCell,
	DataGridTableFoot,
	DataGridTableHead,
	DataGridTableHeadRow,
	DataGridTableHeadRowCell,
	DataGridTableHeadRowCellResize,
	DataGridTableRenderedRow,
	DataGridTableRowSpacer,
	DataGridTableViewport,
	getDataGridHeadCellResizeHeader,
	getDataGridScrollAreaViewport,
	getDataGridTableMergedHeaderGroups,
	getDataGridTableRowSections,
	getPinningStyles,
	hasDataGridTableRightPinnedColumns,
	renderDataGridTableHeadCellContent,
	type DataGridHeader,
	type DataGridRow,
	type DataGridTableCenterWindow,
	type DataGridTableMergedHeaderGroup,
	type DataGridTablePinnedBoundary,
	type DataGridTableViewportProps,
} from "@workspace/ui/components/data-grid/data-grid-table";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/core/utils";
import type { RowData } from "@tanstack/react-table";
import { elementScroll, observeElementOffset, observeElementRect, Virtualizer, type VirtualItem, type VirtualizerOptions } from "@tanstack/react-virtual";
import * as React from "react";

// ── Types ──────────────────────────────────────────────────────────────────

/** The two nodes a virtual grid scrolls with: its own viewport and the element that actually scrolls. */
export interface DataGridTableVirtualScrollElements {
	readonly containerElement: HTMLDivElement | null;
	readonly scrollElement: HTMLElement | null;
}

/** The row virtualizer a virtual grid drives. */
export type DataGridTableVirtualizerInstance = Virtualizer<HTMLElement, HTMLTableRowElement>;

/** Where a revealed row or column lands in the viewport. */
export type DataGridTableVirtualScrollAlignment = "auto" | "center" | "start" | "end";

export interface DataGridTableColumnVirtualizerOptions {
	/** Off unless explicitly `true`; a column window is opt-in. */
	readonly enabled?: boolean | undefined;
	/** Center columns rendered beyond each edge of the window. */
	readonly overscan?: number | undefined;
}

/**
 * A per-row size estimate. It receives the row's own data (`row.original`)
 * through a method signature, so `(index, row: IData) => …` type-checks
 * against a grid of any row type (see `DataGridRowRenderer` in data-grid.tsx).
 */
export type DataGridTableVirtualRowEstimator = { bivarianceHack(index: number, row: RowData): number }["bivarianceHack"];

/** A per-row virtualizer key (defaults to the row id); receives `row.original` like the estimator. */
export type DataGridTableVirtualRowKeyGetter = { bivarianceHack(index: number, row: RowData): string | number }["bivarianceHack"];

/** The virtualizer options a grid owns itself (row count, keys, sizes, scroll element, re-render wiring). */
type DataGridTableVirtualOwnedOption = "count" | "estimateSize" | "getItemKey" | "getScrollElement" | "onChange" | "horizontal";

/** Pass-through `@tanstack/react-virtual` options, with the row-aware callbacks the grid resolves itself. */
export type DataGridTableVirtualizerOptions = Partial<Omit<VirtualizerOptions<HTMLElement, HTMLTableRowElement>, DataGridTableVirtualOwnedOption>> & {
	readonly estimateSize?: DataGridTableVirtualRowEstimator | undefined;
	readonly getItemKey?: DataGridTableVirtualRowKeyGetter | undefined;
	/** The element that scrolls; defaults to the enclosing `DataGridScrollArea` viewport, else the grid's own viewport. */
	readonly getScrollElement?: ((elements: DataGridTableVirtualScrollElements) => HTMLElement | null) | undefined;
};

export interface DataGridTableVirtualProps extends Omit<DataGridTableViewportProps, "children" | "viewportRef"> {
	/** Height of the grid's own scroll box (standalone mode, outside a `DataGridScrollArea`). */
	readonly height?: number | string | undefined;
	/** Row height before measurement, in pixels. */
	readonly estimateSize?: number | undefined;
	/** Rows rendered beyond each edge of the viewport. */
	readonly overscan?: number | undefined;
	/** Scroll animation used when revealing a controlled target row or column. */
	readonly scrollBehavior?: ScrollBehavior | undefined;
	/** Alignment used when revealing a controlled target row. Defaults to `"auto"`. */
	readonly scrollToRowAlign?: DataGridTableVirtualScrollAlignment | undefined;
	/** Index within the center (non-pinned) row section to reveal. */
	readonly scrollToRowIndex?: number | undefined;
	/**
	 * Opt-in horizontal virtualization of the CENTER columns. Activates only
	 * under a fixed table layout with a single ungrouped header row; pinned
	 * columns stay mounted, and anything else renders every column.
	 */
	readonly columnVirtualizerOptions?: DataGridTableColumnVirtualizerOptions | undefined;
	/** Alignment used when revealing a controlled target column. */
	readonly scrollToColumnAlign?: DataGridTableVirtualScrollAlignment | undefined;
	/** Index within the center (non-pinned) visible leaf columns to reveal. */
	readonly scrollToColumnIndex?: number | undefined;
	/** Footer rows rendered in a `<tfoot>`. */
	readonly footerContent?: React.ReactNode;
	/** `false` renders the body only. Defaults to `true`. */
	readonly renderHeader?: boolean | undefined;
	/** Infinite mode: called once per row count when the window nears the last row. */
	readonly onFetchMore?: (() => void) | undefined;
	readonly isFetchingMore?: boolean | undefined;
	/** `false` once every row is loaded: the all-rows-loaded footer row shows and fetching stops. */
	readonly hasMore?: boolean | undefined;
	/** How many rows before the last one the window may reach before `onFetchMore` fires. */
	readonly fetchMoreOffset?: number | undefined;
	readonly virtualizerOptions?: DataGridTableVirtualizerOptions | undefined;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Row height handed to the virtualizer before a row is measured, in pixels. */
export const DATA_GRID_VIRTUAL_ESTIMATE_ROW_SIZE_PX = 48;

/** Rows rendered beyond each edge of the viewport. */
export const DATA_GRID_VIRTUAL_OVERSCAN = 10;

/** Center columns rendered beyond each edge of a column window. */
export const DATA_GRID_VIRTUAL_COLUMN_OVERSCAN = 3;

/** Sub-pixel scroll differences are not worth a scroll. */
const SCROLL_TOLERANCE_PX = 0.5;

/** A one-cell span is not a group or a merged header. */
const SINGLE_COLUMN_SPAN = 1;

const EMPTY_VIRTUAL_ITEMS: VirtualItem[] = [];

const DEFAULT_SCROLL_ELEMENTS: DataGridTableVirtualScrollElements = { containerElement: null, scrollElement: null };

// ── Scroll requests (pure) ─────────────────────────────────────────────────

/** A controlled column reveal; two equal requests scroll once. */
export interface DataGridTableColumnScrollRequest {
	readonly align: DataGridTableVirtualScrollAlignment;
	readonly behavior: ScrollBehavior;
	readonly columnId: string | undefined;
	readonly columnIndex: number;
	readonly scrollElement: HTMLElement;
}

export function isSameDataGridTableColumnScrollRequest(previous: DataGridTableColumnScrollRequest | null, next: DataGridTableColumnScrollRequest): boolean {
	return (
		previous !== null &&
		previous.align === next.align &&
		previous.behavior === next.behavior &&
		previous.columnId === next.columnId &&
		previous.columnIndex === next.columnIndex &&
		previous.scrollElement === next.scrollElement
	);
}

/** A controlled row reveal; two equal requests scroll once. */
export interface DataGridTableVirtualScrollRequest {
	readonly align: DataGridTableVirtualScrollAlignment;
	readonly behavior: ScrollBehavior;
	readonly containerElement: HTMLDivElement;
	readonly headerSticky: boolean;
	readonly isVirtualizationEnabled: boolean;
	readonly rowId: string | undefined;
	readonly rowIndex: number;
	readonly scrollElement: HTMLElement;
}

export function isSameDataGridTableScrollRequest(previous: DataGridTableVirtualScrollRequest | null, next: DataGridTableVirtualScrollRequest): boolean {
	return (
		previous !== null &&
		previous.align === next.align &&
		previous.behavior === next.behavior &&
		previous.containerElement === next.containerElement &&
		previous.headerSticky === next.headerSticky &&
		previous.isVirtualizationEnabled === next.isVirtualizationEnabled &&
		previous.rowId === next.rowId &&
		previous.rowIndex === next.rowIndex &&
		previous.scrollElement === next.scrollElement
	);
}

/** The geometry `getDataGridTableScrollTarget` resolves a row reveal from (all in scroll-content pixels). */
export interface DataGridTableScrollTargetInput {
	readonly align: DataGridTableVirtualScrollAlignment;
	readonly clientHeight: number;
	readonly rowBottom: number;
	readonly rowHeight: number;
	readonly rowTop: number;
	readonly scrollHeight: number;
	readonly scrollTop: number;
	/** Height of a sticky header covering the viewport's top edge. */
	readonly viewportTopOffset?: number | undefined;
}

/**
 * The scrollTop that reveals a row with the requested alignment, clamped to
 * the scrollable range, or `null` when `"auto"` finds the row already visible.
 */
export function getDataGridTableScrollTarget({
	align,
	clientHeight,
	rowBottom,
	rowHeight,
	rowTop,
	scrollHeight,
	scrollTop,
	viewportTopOffset = 0,
}: DataGridTableScrollTargetInput): number | null {
	const visibleHeight = Math.max(0, clientHeight - viewportTopOffset);
	const viewportTop = scrollTop + viewportTopOffset;
	const viewportBottom = scrollTop + clientHeight;

	const resolveTarget = (): number | null => {
		switch (align) {
			case "auto":
				if (rowTop < viewportTop) {
					return rowTop - viewportTopOffset;
				}
				return rowBottom > viewportBottom ? rowBottom - clientHeight : null;
			case "start":
				return rowTop - viewportTopOffset;
			case "end":
				return rowBottom - clientHeight;
			case "center":
				return rowTop - viewportTopOffset - Math.max(0, (visibleHeight - rowHeight) / 2);
		}
	};

	const targetTop = resolveTarget();
	if (targetTop === null) {
		return null;
	}
	return Math.min(Math.max(0, targetTop), Math.max(0, scrollHeight - clientHeight));
}

/** How much of the viewport's top a sticky header covers (0 when the header is not sticky or not overlapping). */
export function getDataGridTableHeaderOffset({
	containerElement,
	headerSticky,
	scrollElement,
}: {
	readonly containerElement: HTMLDivElement;
	readonly headerSticky: boolean;
	readonly scrollElement: HTMLElement;
}): number {
	if (!headerSticky) {
		return 0;
	}
	const headerElement = containerElement.querySelector<HTMLElement>(':scope > [data-slot="data-grid-table"] > thead');
	if (headerElement === null) {
		return 0;
	}
	const scrollRect = scrollElement.getBoundingClientRect();
	const headerRect = headerElement.getBoundingClientRect();
	const headerBottomOffset = headerRect.bottom - scrollRect.top;
	const overlapsViewportTop = headerRect.top <= scrollRect.top + SCROLL_TOLERANCE_PX && headerBottomOffset > 0;
	if (!overlapsViewportTop) {
		return 0;
	}
	return Math.min(scrollElement.clientHeight, Math.max(0, headerBottomOffset));
}

/** Scrolls to a vertical offset: through the virtualizer when there is one, else on the element. */
export function scrollDataGridTableToOffset({
	behavior,
	scrollElement,
	targetTop,
	virtualizer,
}: {
	readonly behavior: ScrollBehavior;
	readonly scrollElement: HTMLElement;
	readonly targetTop: number;
	readonly virtualizer?: DataGridTableVirtualizerInstance | undefined;
}): void {
	if (virtualizer !== undefined) {
		virtualizer.scrollToOffset(targetTop, { align: "start", behavior });
		return;
	}
	if (Reflect.has(scrollElement, "scrollTo")) {
		scrollElement.scrollTo({ behavior, top: targetTop });
		return;
	}
	scrollElement.scrollTop = targetTop;
}

export interface DataGridTableRowRevealInput {
	readonly align: DataGridTableVirtualScrollAlignment;
	readonly behavior: ScrollBehavior;
	/** Re-issue the current offset when no scroll is needed, cancelling a smooth scroll still in flight. */
	readonly cancelPendingScroll?: boolean | undefined;
	readonly containerElement: HTMLDivElement | null;
	readonly headerSticky: boolean;
	readonly rowIndex: number;
	readonly scrollElement: HTMLElement | null;
	readonly virtualizer?: DataGridTableVirtualizerInstance | undefined;
}

/**
 * Reveals a MOUNTED body row (`tr[data-index]`) with DOM geometry, so a
 * measured row lands exactly. Returns `false` when the row is not mounted —
 * the caller then asks the virtualizer to bring it into the window first.
 */
export function scrollDataGridTableRowIntoView({
	align,
	behavior,
	cancelPendingScroll = false,
	containerElement,
	headerSticky,
	rowIndex,
	scrollElement,
	virtualizer,
}: DataGridTableRowRevealInput): boolean {
	if (containerElement === null || scrollElement === null) {
		return false;
	}
	const rowElement = containerElement.querySelector<HTMLTableRowElement>(`:scope > [data-slot="data-grid-table"] > tbody > tr[data-index="${String(rowIndex)}"]`);
	if (rowElement === null) {
		return false;
	}
	const scrollRect = scrollElement.getBoundingClientRect();
	const rowRect = rowElement.getBoundingClientRect();
	const viewportTopOffset = getDataGridTableHeaderOffset({ containerElement, headerSticky, scrollElement });
	const rowTop = scrollElement.scrollTop + rowRect.top - scrollRect.top;
	const rowBottom = scrollElement.scrollTop + rowRect.bottom - scrollRect.top;
	const targetTop = getDataGridTableScrollTarget({
		align,
		clientHeight: scrollElement.clientHeight,
		rowBottom,
		rowHeight: rowRect.height > 0 ? rowRect.height : rowElement.offsetHeight,
		rowTop,
		scrollHeight: scrollElement.scrollHeight,
		scrollTop: scrollElement.scrollTop,
		viewportTopOffset,
	});

	if (targetTop === null || Math.abs(targetTop - scrollElement.scrollTop) < SCROLL_TOLERANCE_PX) {
		if (cancelPendingScroll) {
			scrollDataGridTableToOffset({ behavior: "auto", scrollElement, targetTop: scrollElement.scrollTop, virtualizer });
		}
		return true;
	}
	scrollDataGridTableToOffset({ behavior, scrollElement, targetTop, virtualizer });
	return true;
}

// ── Column window (pure) ───────────────────────────────────────────────────

/**
 * Column windows only where the geometry is provable: a fixed table layout
 * (the colgroup then owns every width, so colSpan spacers cannot drift) and a
 * single ungrouped header row (a group or `meta.headerColSpan` cell cannot be
 * windowed).
 */
export function isDataGridTableColumnVirtualizable<TData extends RowData>(
	enabled: boolean,
	layout: DataGridResolvedTableLayout,
	mergedHeaderGroups: readonly DataGridTableMergedHeaderGroup<TData>[],
): boolean {
	if (!enabled || layout.width === "auto" || mergedHeaderGroups.length !== SINGLE_COLUMN_SPAN) {
		return false;
	}
	const [headerGroup] = mergedHeaderGroups;
	if (headerGroup === undefined) {
		return false;
	}
	return headerGroup.headers.every((header) => header.colSpan <= SINGLE_COLUMN_SPAN) && headerGroup.coveredHeaders.size === 0;
}

/** The inclusive [start, end] center-column window the column virtualizer's items cover, or `undefined` before it resolves. */
export function getDataGridTableCenterColumnWindow(virtualColumns: readonly VirtualItem[]): DataGridTableCenterWindow | undefined {
	const first = virtualColumns.at(0);
	const last = virtualColumns.at(-1);
	if (first === undefined || last === undefined) {
		return undefined;
	}
	return { start: first.index, end: last.index };
}

/** The spacer heights standing in for the rows above and below the rendered window. */
export interface DataGridTableVirtualSpacers {
	readonly leading: number;
	readonly trailing: number;
}

export function getDataGridTableVirtualSpacers(virtualItems: readonly VirtualItem[], totalSize: number): DataGridTableVirtualSpacers {
	const first = virtualItems.at(0);
	const last = virtualItems.at(-1);
	if (first === undefined || last === undefined) {
		return { leading: 0, trailing: 0 };
	}
	return { leading: first.start, trailing: Math.max(0, totalSize - last.end) };
}

/** `true` when the window reaches within `offset` rows of the last loaded row. */
export function shouldDataGridTableFetchMore(virtualItems: readonly VirtualItem[], rowCount: number, offset: number): boolean {
	const last = virtualItems.at(-1);
	return last !== undefined && last.index >= rowCount - 1 - Math.max(0, offset);
}

// ── Virtualizer hook ───────────────────────────────────────────────────────

/** Everything the core `Virtualizer` needs, with the DOM wiring defaulted. */
type DataGridVirtualizerInput<TItem extends Element> = Omit<
	VirtualizerOptions<HTMLElement, TItem>,
	"scrollToFn" | "observeElementRect" | "observeElementOffset" | "onChange"
> &
	Partial<Pick<VirtualizerOptions<HTMLElement, TItem>, "scrollToFn" | "observeElementRect" | "observeElementOffset">>;

function bumpVersion(version: number): number {
	return version + 1;
}

/** TanStack's core `Virtualizer` driven by React: options of THIS render applied before anything reads the window. */
function useDataGridVirtualizer<TItem extends Element>(input: DataGridVirtualizerInput<TItem>): Virtualizer<HTMLElement, TItem> {
	const [, rerender] = React.useReducer(bumpVersion, 0);
	const options = React.useMemo(
		(): VirtualizerOptions<HTMLElement, TItem> => ({
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			...input,
			onChange: (): void => {
				rerender();
			},
		}),
		[input],
	);
	const [virtualizer] = React.useState((): Virtualizer<HTMLElement, TItem> => new Virtualizer(options));
	virtualizer.setOptions(options);

	React.useLayoutEffect((): (() => void) => virtualizer._didMount(), [virtualizer]);
	React.useLayoutEffect((): void => {
		virtualizer._willUpdate();
	});

	return virtualizer;
}

// ── Memo gates ─────────────────────────────────────────────────────────────

interface DataGridTableVirtualRowGateProps {
	readonly children: React.ReactNode;
	/** The row object; any data change rebuilds it. */
	readonly rowIdentity: RuntimeValue;
	readonly rowIndex: number | undefined;
	readonly rowRef: RuntimeValue;
	readonly pinnedBoundary: DataGridTablePinnedBoundary | undefined;
	readonly windowStart: number | undefined;
	readonly windowEnd: number | undefined;
}

/**
 * A scroll frame only shifts the window, so every surviving row's inputs are
 * identical and its last render is reused: the per-frame cost is the rows
 * entering the window. Cell-level state repaints through each cell's own
 * subscription, and context changes reach the cells past this gate.
 */
const DataGridTableVirtualRowGate = React.memo(
	function DataGridTableVirtualRowGate({ children }: DataGridTableVirtualRowGateProps): React.ReactNode {
		return children;
	},
	(previous: DataGridTableVirtualRowGateProps, next: DataGridTableVirtualRowGateProps): boolean =>
		previous.rowIdentity === next.rowIdentity &&
		previous.rowIndex === next.rowIndex &&
		previous.rowRef === next.rowRef &&
		previous.pinnedBoundary === next.pinnedBoundary &&
		previous.windowStart === next.windowStart &&
		previous.windowEnd === next.windowEnd,
);

interface DataGridTableVirtualBodyGateProps {
	readonly children: React.ReactNode;
	/** `true` while a column resize or a cell-selection drag is in flight. */
	readonly frozen: boolean;
}

/** Skips body re-renders while frozen (widths move through CSS variables; cells paint through their own subscriptions). */
const DataGridTableVirtualBodyGate = React.memo(
	function DataGridTableVirtualBodyGate({ children }: DataGridTableVirtualBodyGateProps): React.ReactNode {
		return children;
	},
	(_previous: DataGridTableVirtualBodyGateProps, next: DataGridTableVirtualBodyGateProps): boolean => next.frozen,
);

interface DataGridTableVirtualHeadGateProps {
	readonly children: React.ReactNode;
	readonly tableIdentity: RuntimeValue;
	readonly layout: DataGridResolvedTableLayout;
	readonly windowStart: number | undefined;
	readonly windowEnd: number | undefined;
}

/** The header re-renders only when its real inputs move (the table, the layout, the column window) — never per scroll frame. */
const DataGridTableVirtualHeadGate = React.memo(
	function DataGridTableVirtualHeadGate({ children }: DataGridTableVirtualHeadGateProps): React.ReactNode {
		return children;
	},
	(previous: DataGridTableVirtualHeadGateProps, next: DataGridTableVirtualHeadGateProps): boolean =>
		previous.tableIdentity === next.tableIdentity && previous.layout === next.layout && previous.windowStart === next.windowStart && previous.windowEnd === next.windowEnd,
);

function isBodyFrozen<TData extends RowData>(table: DataGridCoreTable<TData>): boolean {
	return table.atoms.columnResizing.get().isResizingColumn !== false || table._isSelectingCells;
}

// ── Utility rows ───────────────────────────────────────────────────────────

const PINNED_PLACEHOLDER_CLASSES =
	"data-pinned:isolate data-pinned:bg-[color:var(--data-grid-surface,var(--data-grid-card-surface,var(--background)))] [&[data-pinned=end][data-last-col=end]]:shadow-[inset_calc(1px*var(--data-grid-dir,1))_0_0_0_var(--border)] [&[data-pinned=start][data-last-col=start]]:shadow-[inset_calc(-1px*var(--data-grid-dir,1))_0_0_0_var(--border)]";

function placeholderLastCol<TData extends RowData>(column: DataGridColumn<TData>): "start" | "end" | undefined {
	const isPinned = column.getIsPinned();
	if (isPinned === "start" && column.getIsLastColumn("start")) {
		return "start";
	}
	if (isPinned === "end" && column.getIsFirstColumn("end")) {
		return "end";
	}
	return undefined;
}

/** A pinned column's cell in a spacer or status row: keeps the sticky surface continuous. */
function DataGridTableVirtualPinnedPlaceholderCell<TData extends RowData>({ column }: { readonly column: DataGridColumn<TData> }): React.JSX.Element {
	const { tableLayout } = useDataGrid().props;
	const isPinned = column.getIsPinned();
	const pinnable = tableLayout.columnsPinnable && column.getCanPin();
	const style: React.CSSProperties = {
		...(pinnable ? getPinningStyles(column) : undefined),
		...(tableLayout.columnsResizable ? { width: `calc(var(--col-${column.id}-size) * 1px)` } : undefined),
	};
	return (
		<td
			aria-hidden="true"
			style={style}
			data-pinned={isPinned === false ? undefined : isPinned}
			data-last-col={placeholderLastCol(column)}
			className={cn("p-0", tableLayout.cellBorder ? "border-e" : undefined, pinnable ? PINNED_PLACEHOLDER_CLASSES : undefined)}
		/>
	);
}

interface DataGridTableVirtualUtilityRowProps<TData extends RowData> {
	readonly table: DataGridCoreTable<TData>;
	readonly children?: React.ReactNode;
	readonly centerCellClassName?: string | undefined;
	readonly centerCellStyle?: React.CSSProperties | undefined;
	readonly ariaHidden?: boolean | undefined;
}

/** A full-width row over the center columns, with the pinned columns kept as placeholders. */
function DataGridTableVirtualUtilityRow<TData extends RowData>({
	table,
	children,
	centerCellClassName,
	centerCellStyle,
	ariaHidden = false,
}: DataGridTableVirtualUtilityRowProps<TData>): React.JSX.Element {
	const { tableLayout } = useDataGrid().props;
	const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);
	const renderPlaceholder = (column: DataGridColumn<TData>): React.JSX.Element => <DataGridTableVirtualPinnedPlaceholderCell column={column} key={column.id} />;
	return (
		<tr aria-hidden={ariaHidden ? true : undefined}>
			{table.getStartVisibleLeafColumns().map(renderPlaceholder)}
			<td colSpan={Math.max(table.getCenterVisibleLeafColumns().length, 1)} className={centerCellClassName} style={centerCellStyle}>
				{children}
			</td>
			{tableLayout.columnsResizable && hasRightPinnedColumns ? <DataGridTableFillBodyCell /> : null}
			{table.getEndVisibleLeafColumns().map(renderPlaceholder)}
			{tableLayout.columnsResizable && !hasRightPinnedColumns ? <DataGridTableFillBodyCell /> : null}
		</tr>
	);
}

/** Stands in for the rows outside the window, so the scroll height stays exact. */
function DataGridTableVirtualSpacer<TData extends RowData>({
	table,
	height,
}: {
	readonly table: DataGridCoreTable<TData>;
	readonly height: number;
}): React.JSX.Element | null {
	const style = React.useMemo((): React.CSSProperties => ({ height, padding: 0 }), [height]);
	if (height <= 0) {
		return null;
	}
	return <DataGridTableVirtualUtilityRow table={table} ariaHidden centerCellClassName="p-0" centerCellStyle={style} />;
}

/** A status row (loading more, all rows loaded) across the center columns. */
function DataGridTableVirtualStatusRow<TData extends RowData>({
	table,
	children,
	className,
}: {
	readonly table: DataGridCoreTable<TData>;
	readonly children: React.ReactNode;
	readonly className?: string | undefined;
}): React.JSX.Element {
	return (
		<DataGridTableVirtualUtilityRow table={table} centerCellClassName={cn("py-4 text-center text-sm text-muted-foreground", className)}>
			{children}
		</DataGridTableVirtualUtilityRow>
	);
}

function DataGridTableVirtualLoadingRow<TData extends RowData>({
	table,
	message,
}: {
	readonly table: DataGridCoreTable<TData>;
	readonly message: React.ReactNode;
}): React.JSX.Element {
	return (
		<DataGridTableVirtualStatusRow table={table}>
			<div role="status" className="flex items-center justify-center gap-2">
				<Spinner aria-hidden className="size-4 opacity-60" />
				{message}
			</div>
		</DataGridTableVirtualStatusRow>
	);
}

// ── Body ───────────────────────────────────────────────────────────────────

interface DataGridTableVirtualBodyProps<TData extends RowData> {
	readonly table: DataGridCoreTable<TData>;
	readonly topRows: readonly DataGridRow<TData>[];
	readonly centerRows: readonly DataGridRow<TData>[];
	readonly bottomRows: readonly DataGridRow<TData>[];
	readonly virtualItems: readonly VirtualItem[];
	readonly totalSize: number;
	readonly isVirtualizationEnabled: boolean;
	readonly isInfiniteMode: boolean;
	readonly isFetchingMore: boolean;
	readonly hasMore: boolean | undefined;
	readonly initialLoadingMessage: React.ReactNode;
	readonly loadingMoreMessage: React.ReactNode;
	readonly allRowsLoadedMessage: React.ReactNode;
	readonly measureRowRef: ((element: HTMLTableRowElement | null) => void) | undefined;
	readonly centerColumnWindow: DataGridTableCenterWindow | undefined;
}

interface RenderVirtualRowInput<TData extends RowData> {
	readonly row: DataGridRow<TData>;
	readonly rowIndex?: number | undefined;
	readonly rowRef?: ((element: HTMLTableRowElement | null) => void) | undefined;
	readonly pinnedBoundary?: DataGridTablePinnedBoundary | undefined;
	readonly centerColumnWindow: DataGridTableCenterWindow | undefined;
}

function renderVirtualRow<TData extends RowData>({ row, rowIndex, rowRef, pinnedBoundary, centerColumnWindow }: RenderVirtualRowInput<TData>): React.JSX.Element {
	return (
		<DataGridTableVirtualRowGate
			key={row.id}
			rowIdentity={row}
			rowIndex={rowIndex}
			rowRef={rowRef}
			pinnedBoundary={pinnedBoundary}
			windowStart={centerColumnWindow?.start}
			windowEnd={centerColumnWindow?.end}>
			<DataGridTableRenderedRow row={row} rowIndex={rowIndex} rowRef={rowRef} pinnedBoundary={pinnedBoundary} centerWindow={centerColumnWindow} />
		</DataGridTableVirtualRowGate>
	);
}

function DataGridTableVirtualBody<TData extends RowData>({
	table,
	topRows,
	centerRows,
	bottomRows,
	virtualItems,
	totalSize,
	isVirtualizationEnabled,
	isInfiniteMode,
	isFetchingMore,
	hasMore,
	initialLoadingMessage,
	loadingMoreMessage,
	allRowsLoadedMessage,
	measureRowRef,
	centerColumnWindow,
}: DataGridTableVirtualBodyProps<TData>): React.JSX.Element {
	const { isLoading } = useDataGrid();
	const totalRows = topRows.length + centerRows.length + bottomRows.length;

	if (totalRows === 0) {
		// The initial load must not flash the empty state as if the query returned nothing.
		return isLoading ? <DataGridTableVirtualLoadingRow table={table} message={initialLoadingMessage} /> : <DataGridTableEmpty />;
	}

	const hasCenterRows = centerRows.length > 0;
	const showFetchingRow = isInfiniteMode && isFetchingMore;
	const showCompleteRow = isInfiniteMode && hasMore === false;
	const hasMiddleSection = hasCenterRows || showFetchingRow || showCompleteRow;
	const spacers = isVirtualizationEnabled && hasCenterRows ? getDataGridTableVirtualSpacers(virtualItems, totalSize) : { leading: 0, trailing: 0 };
	const lastTopIndex = topRows.length - 1;

	const top = topRows.map((row, index) => renderVirtualRow({ row, centerColumnWindow, pinnedBoundary: index === lastTopIndex && hasMiddleSection ? "top" : undefined }));
	const center = isVirtualizationEnabled
		? virtualItems.flatMap((virtualRow) => {
				const row = centerRows.at(virtualRow.index);
				return row === undefined ? [] : [renderVirtualRow({ row, rowRef: measureRowRef, rowIndex: virtualRow.index, centerColumnWindow })];
			})
		: centerRows.map((row, rowIndex) => renderVirtualRow({ row, rowIndex, centerColumnWindow }));
	const bottom = bottomRows.map((row, index) =>
		renderVirtualRow({ row, centerColumnWindow, pinnedBoundary: index === 0 && (topRows.length > 0 || hasMiddleSection) ? "bottom" : undefined }),
	);

	return (
		<>
			{top}
			{spacers.leading > 0 ? <DataGridTableVirtualSpacer table={table} height={spacers.leading} /> : null}
			{center}
			{spacers.trailing > 0 ? <DataGridTableVirtualSpacer table={table} height={spacers.trailing} /> : null}
			{showFetchingRow ? <DataGridTableVirtualLoadingRow table={table} message={loadingMoreMessage} /> : null}
			{showCompleteRow ? (
				<DataGridTableVirtualStatusRow table={table} className="py-3 text-xs">
					{allRowsLoadedMessage}
				</DataGridTableVirtualStatusRow>
			) : null}
			{bottom}
		</>
	);
}

// ── Head ───────────────────────────────────────────────────────────────────

interface DataGridTableVirtualHeadRowsProps<TData extends RowData> {
	readonly mergedHeaderGroups: readonly DataGridTableMergedHeaderGroup<TData>[];
	readonly hasRightPinnedColumns: boolean;
	readonly centerColumnCount: number;
	readonly centerColumnWindow: DataGridTableCenterWindow | undefined;
}

/**
 * Head rows. Under an active column window the single ungrouped header row is
 * bucketed start / windowed center / end, each off-window flank one colSpan
 * spacer sized by the intact colgroup — the shape the body rows take.
 */
function DataGridTableVirtualHeadRows<TData extends RowData>({
	mergedHeaderGroups,
	hasRightPinnedColumns,
	centerColumnCount,
	centerColumnWindow,
}: DataGridTableVirtualHeadRowsProps<TData>): React.JSX.Element {
	const { tableLayout } = useDataGrid().props;
	const columnsResizable = tableLayout.columnsResizable;
	const trailingSpan = centerColumnWindow === undefined ? 0 : centerColumnCount - 1 - centerColumnWindow.end;

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
				const centerHeaders =
					centerColumnWindow === undefined ? headerGroup.centerHeaders : headerGroup.centerHeaders.slice(centerColumnWindow.start, centerColumnWindow.end + 1);
				return (
					<DataGridTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
						{headerGroup.startHeaders.map(renderHeadCell)}
						{centerColumnWindow !== undefined && centerColumnWindow.start > 0 ? (
							<th aria-hidden="true" data-col-spacer="start" colSpan={centerColumnWindow.start} className="p-0" />
						) : null}
						{centerHeaders.map(renderHeadCell)}
						{trailingSpan > 0 ? <th aria-hidden="true" data-col-spacer="end" colSpan={trailingSpan} className="p-0" /> : null}
						{hasRightPinnedColumns ? fillHeadCell : null}
						{headerGroup.endHeaders.map(renderHeadCell)}
						{hasRightPinnedColumns ? null : fillHeadCell}
					</DataGridTableHeadRow>
				);
			})}
		</DataGridTableHead>
	);
}

// ── DataGridTableVirtual ───────────────────────────────────────────────────

interface DataGridTableVirtualInnerProps<TData extends RowData> {
	readonly table: DataGridCoreTable<TData>;
	readonly virtualProps: DataGridTableVirtualProps;
	readonly forwardedRef: React.Ref<HTMLDivElement> | undefined;
}

function toVirtualizerBehavior(behavior: ScrollBehavior): ScrollBehavior {
	return behavior === "smooth" ? "smooth" : "auto";
}

function DataGridTableVirtualInner<TData extends RowData>({ table, virtualProps, forwardedRef }: DataGridTableVirtualInnerProps<TData>): React.JSX.Element {
	const {
		height,
		estimateSize = DATA_GRID_VIRTUAL_ESTIMATE_ROW_SIZE_PX,
		overscan = DATA_GRID_VIRTUAL_OVERSCAN,
		scrollBehavior = "auto",
		scrollToRowAlign = "auto",
		scrollToRowIndex,
		columnVirtualizerOptions,
		scrollToColumnAlign = "auto",
		scrollToColumnIndex,
		footerContent,
		renderHeader = true,
		onFetchMore,
		isFetchingMore = false,
		hasMore,
		fetchMoreOffset = 0,
		virtualizerOptions,
		className,
		style,
		...viewportProps
	} = virtualProps;
	const { labels, props } = useDataGrid();
	const { tableLayout } = props;
	const columnSizing = useDataGridAtom(table.atoms.columnSizing);
	const columnVisibility = useDataGridAtom(table.atoms.columnVisibility);
	const columnOrder = useDataGridAtom(table.atoms.columnOrder);
	const columnPinning = useDataGridAtom(table.atoms.columnPinning);
	const mergedHeaderGroups = getDataGridTableMergedHeaderGroups(table);
	const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table);
	const centerVisibleColumns = table.getCenterVisibleLeafColumns();
	const columnVirtualizationActive = isDataGridTableColumnVirtualizable(columnVirtualizerOptions?.enabled === true, tableLayout, mergedHeaderGroups);
	const { topRows, centerRows, bottomRows } = getDataGridTableRowSections(table, tableLayout.rowsPinnable);
	const isInfiniteMode = onFetchMore !== undefined;
	const [viewportElements, setViewportElements] = React.useState<DataGridTableVirtualScrollElements>(DEFAULT_SCROLL_ELEMENTS);

	const {
		estimateSize: customEstimateSize,
		getItemKey: customGetItemKey,
		getScrollElement: customGetScrollElement,
		measureElement: customMeasureElement,
		overscan: customOverscan,
		...virtualizerOptionsRest
	} = virtualizerOptions ?? {};
	const isVirtualizationEnabled = virtualizerOptions?.enabled !== false;

	const initialLoadingMessage = props.loadingMessage ?? labels.loading;
	const loadingMoreMessage = props.fetchingMoreMessage ?? props.loadingMessage ?? labels.fetchingMore;
	const allRowsLoadedMessage = props.allRowsLoadedMessage ?? labels.allRowsLoaded;

	const handleViewportRef = React.useCallback((node: HTMLDivElement | null): void => {
		setViewportElements({ containerElement: node, scrollElement: node === null ? null : (getDataGridScrollAreaViewport(node) ?? node) });
	}, []);

	const usesExternalScrollArea = viewportElements.scrollElement !== null && viewportElements.scrollElement !== viewportElements.containerElement;

	const resolveScrollElement = React.useCallback(
		(): HTMLElement | null => (customGetScrollElement === undefined ? viewportElements.scrollElement : customGetScrollElement(viewportElements)),
		[customGetScrollElement, viewportElements],
	);

	const resolveItemKey = React.useCallback(
		(index: number): string | number => {
			const row = centerRows.at(index);
			if (row === undefined) {
				return index;
			}
			return customGetItemKey === undefined ? row.id : customGetItemKey(index, row.original);
		},
		[centerRows, customGetItemKey],
	);

	const resolveEstimateSize = React.useCallback(
		(index: number): number => {
			const row = centerRows.at(index);
			return row === undefined || customEstimateSize === undefined ? estimateSize : customEstimateSize(index, row.original);
		},
		[centerRows, customEstimateSize, estimateSize],
	);

	const rowVirtualizerInput = React.useMemo(
		(): DataGridVirtualizerInput<HTMLTableRowElement> => ({
			...virtualizerOptionsRest,
			count: centerRows.length,
			getScrollElement: resolveScrollElement,
			getItemKey: resolveItemKey,
			estimateSize: resolveEstimateSize,
			overscan: customOverscan ?? overscan,
			...(customMeasureElement === undefined ? undefined : { measureElement: customMeasureElement }),
		}),
		[virtualizerOptionsRest, centerRows.length, resolveScrollElement, resolveItemKey, resolveEstimateSize, customOverscan, overscan, customMeasureElement],
	);
	const virtualizer = useDataGridVirtualizer(rowVirtualizerInput);

	// Horizontal offsets invert in RTL; the column virtualizer must be told.
	const isRtl = React.useMemo(
		(): boolean => (viewportElements.containerElement === null ? false : getComputedStyle(viewportElements.containerElement).direction === "rtl"),
		[viewportElements.containerElement],
	);

	const resolveColumnKey = React.useCallback((index: number): string | number => centerVisibleColumns.at(index)?.id ?? index, [centerVisibleColumns]);
	const resolveColumnEstimateSize = React.useCallback((index: number): number => centerVisibleColumns.at(index)?.getSize() ?? 0, [centerVisibleColumns]);

	const columnVirtualizerInput = React.useMemo(
		(): DataGridVirtualizerInput<HTMLTableCellElement> => ({
			horizontal: true,
			isRtl,
			count: columnVirtualizationActive ? centerVisibleColumns.length : 0,
			getScrollElement: resolveScrollElement,
			getItemKey: resolveColumnKey,
			estimateSize: resolveColumnEstimateSize,
			overscan: columnVirtualizerOptions?.overscan ?? DATA_GRID_VIRTUAL_COLUMN_OVERSCAN,
		}),
		[isRtl, columnVirtualizationActive, centerVisibleColumns.length, resolveScrollElement, resolveColumnKey, resolveColumnEstimateSize, columnVirtualizerOptions?.overscan],
	);
	const columnVirtualizer = useDataGridVirtualizer(columnVirtualizerInput);

	// Column sizes are exact getSize() reads, never DOM-measured, so a resize
	// commit or a visibility / order / pinning change resyncs them by hand.
	React.useEffect((): void => {
		if (columnVirtualizationActive) {
			columnVirtualizer.measure();
		}
	}, [columnVirtualizationActive, columnVirtualizer, columnSizing, columnVisibility, columnOrder, columnPinning]);

	const virtualColumns = columnVirtualizationActive ? columnVirtualizer.getVirtualItems() : [];
	const columnWindow = columnVirtualizationActive ? getDataGridTableCenterColumnWindow(virtualColumns) : undefined;
	const windowStart = columnWindow?.start;
	const windowEnd = columnWindow?.end;
	// One identity per window, so unchanged rows keep their memoized render.
	const centerColumnWindow = React.useMemo(
		(): DataGridTableCenterWindow | undefined => (windowStart === undefined || windowEnd === undefined ? undefined : { start: windowStart, end: windowEnd }),
		[windowStart, windowEnd],
	);

	const virtualItems = isVirtualizationEnabled ? virtualizer.getVirtualItems() : EMPTY_VIRTUAL_ITEMS;
	const totalSize = isVirtualizationEnabled ? virtualizer.getTotalSize() : 0;
	const measureRowRef = isVirtualizationEnabled && customMeasureElement !== undefined ? virtualizer.measureElement : undefined;
	const scrollToRowId = scrollToRowIndex === undefined ? undefined : centerRows.at(scrollToRowIndex)?.id;
	const scrollToRowVirtualItem = isVirtualizationEnabled && scrollToRowIndex !== undefined ? virtualItems.find((item) => item.index === scrollToRowIndex) : undefined;
	const headerSticky = renderHeader && tableLayout.headerSticky;
	const pendingScrollToRowIndexRef = React.useRef<number | null>(null);
	const lastScrollRequestRef = React.useRef<DataGridTableVirtualScrollRequest | null>(null);
	// Latch onFetchMore per row count: the window changes every scroll frame,
	// and without it duplicate page requests fire before the consumer flips
	// isFetchingMore (and loop at end-of-data when hasMore is never set).
	const fetchMoreFiredAtCountRef = React.useRef<number | null>(null);
	const lastColumnScrollRequestRef = React.useRef<DataGridTableColumnScrollRequest | null>(null);

	// Controlled column reveal, deduplicated by its request signature.
	React.useEffect((): void => {
		const { scrollElement } = viewportElements;
		if (
			!columnVirtualizationActive ||
			scrollToColumnIndex === undefined ||
			scrollToColumnIndex < 0 ||
			scrollToColumnIndex >= centerVisibleColumns.length ||
			scrollElement === null
		) {
			return;
		}
		const request: DataGridTableColumnScrollRequest = {
			align: scrollToColumnAlign,
			behavior: scrollBehavior,
			columnId: centerVisibleColumns.at(scrollToColumnIndex)?.id,
			columnIndex: scrollToColumnIndex,
			scrollElement,
		};
		if (isSameDataGridTableColumnScrollRequest(lastColumnScrollRequestRef.current, request)) {
			return;
		}
		lastColumnScrollRequestRef.current = request;
		columnVirtualizer.scrollToIndex(scrollToColumnIndex, { align: scrollToColumnAlign, behavior: toVirtualizerBehavior(scrollBehavior) });
	}, [columnVirtualizationActive, columnVirtualizer, centerVisibleColumns, scrollToColumnAlign, scrollToColumnIndex, scrollBehavior, viewportElements]);

	// Controlled row reveal: resolved after every commit (a stable getter can
	// expose a replaced element); the request signature prevents re-scrolling.
	React.useEffect((): void => {
		const previousRequest = lastScrollRequestRef.current;
		const activeVirtualizer = isVirtualizationEnabled ? virtualizer : undefined;

		if (scrollToRowIndex === undefined || scrollToRowIndex < 0 || scrollToRowIndex >= centerRows.length) {
			pendingScrollToRowIndexRef.current = null;
			lastScrollRequestRef.current = null;
			const scrollElement = previousRequest === null ? null : resolveScrollElement();
			if (scrollElement !== null) {
				scrollDataGridTableToOffset({ behavior: "auto", scrollElement, targetTop: scrollElement.scrollTop, virtualizer: activeVirtualizer });
			}
			return;
		}

		const scrollElement = resolveScrollElement();
		const { containerElement } = viewportElements;
		if (containerElement === null || scrollElement === null) {
			return;
		}
		const nextRequest: DataGridTableVirtualScrollRequest = {
			align: scrollToRowAlign,
			behavior: scrollBehavior,
			containerElement,
			headerSticky,
			isVirtualizationEnabled,
			rowId: scrollToRowId,
			rowIndex: scrollToRowIndex,
			scrollElement,
		};
		if (isSameDataGridTableScrollRequest(previousRequest, nextRequest)) {
			return;
		}
		pendingScrollToRowIndexRef.current = null;
		const rowWasHandled = scrollDataGridTableRowIntoView({
			align: scrollToRowAlign,
			behavior: scrollBehavior,
			cancelPendingScroll: previousRequest !== null,
			containerElement,
			headerSticky,
			rowIndex: scrollToRowIndex,
			scrollElement,
			virtualizer: activeVirtualizer,
		});
		lastScrollRequestRef.current = nextRequest;
		if (rowWasHandled || !isVirtualizationEnabled) {
			return;
		}
		pendingScrollToRowIndexRef.current = scrollToRowIndex;
		virtualizer.scrollToIndex(scrollToRowIndex, { align: scrollToRowAlign, behavior: toVirtualizerBehavior(scrollBehavior) });
	});

	// Once the virtualizer has brought a pending target row into the window, align it by its real geometry.
	React.useEffect((): void => {
		if (!isVirtualizationEnabled || scrollToRowIndex === undefined || pendingScrollToRowIndexRef.current !== scrollToRowIndex || scrollToRowVirtualItem === undefined) {
			return;
		}
		const rowWasHandled = scrollDataGridTableRowIntoView({
			align: scrollToRowAlign,
			behavior: "auto",
			cancelPendingScroll: true,
			containerElement: viewportElements.containerElement,
			headerSticky,
			rowIndex: scrollToRowIndex,
			scrollElement: resolveScrollElement(),
			virtualizer,
		});
		if (rowWasHandled) {
			pendingScrollToRowIndexRef.current = null;
		}
	}, [
		isVirtualizationEnabled,
		headerSticky,
		resolveScrollElement,
		scrollToRowAlign,
		scrollToRowIndex,
		scrollToRowVirtualItem,
		virtualizer,
		viewportElements.containerElement,
	]);

	React.useEffect((): void => {
		if (!isVirtualizationEnabled || onFetchMore === undefined || hasMore === false || isFetchingMore) {
			return;
		}
		if (fetchMoreFiredAtCountRef.current === centerRows.length) {
			return;
		}
		if (shouldDataGridTableFetchMore(virtualItems, centerRows.length, fetchMoreOffset)) {
			fetchMoreFiredAtCountRef.current = centerRows.length;
			onFetchMore();
		}
	}, [centerRows.length, hasMore, isFetchingMore, isVirtualizationEnabled, onFetchMore, fetchMoreOffset, virtualItems]);

	// Standalone mode: this node IS the scroll container, so it keeps its
	// parent's width (not the resizable table width) or horizontal scrolling breaks.
	const viewportStyle = React.useMemo(
		(): React.CSSProperties | undefined => (usesExternalScrollArea ? style : { height, overflow: "auto", position: "relative", width: "auto", ...style }),
		[usesExternalScrollArea, height, style],
	);

	return (
		<DataGridTableViewport
			ref={forwardedRef}
			viewportRef={handleViewportRef}
			className={cn(usesExternalScrollArea ? undefined : "block", className)}
			style={viewportStyle}
			{...viewportProps}>
			<DataGridTableBase>
				{renderHeader ? (
					<DataGridTableVirtualHeadGate tableIdentity={table} layout={tableLayout} windowStart={windowStart} windowEnd={windowEnd}>
						<DataGridTableVirtualHeadRows
							mergedHeaderGroups={mergedHeaderGroups}
							hasRightPinnedColumns={hasRightPinnedColumns}
							centerColumnCount={centerVisibleColumns.length}
							centerColumnWindow={centerColumnWindow}
						/>
					</DataGridTableVirtualHeadGate>
				) : null}
				{renderHeader && (tableLayout.stripped || !tableLayout.rowBorder) ? <DataGridTableRowSpacer /> : null}
				<DataGridTableBody>
					<DataGridTableVirtualBodyGate frozen={isBodyFrozen(table)}>
						<DataGridTableVirtualBody
							table={table}
							topRows={topRows}
							centerRows={centerRows}
							bottomRows={bottomRows}
							virtualItems={virtualItems}
							totalSize={totalSize}
							isVirtualizationEnabled={isVirtualizationEnabled}
							isInfiniteMode={isInfiniteMode}
							isFetchingMore={isFetchingMore}
							hasMore={hasMore}
							initialLoadingMessage={initialLoadingMessage}
							loadingMoreMessage={loadingMoreMessage}
							allRowsLoadedMessage={allRowsLoadedMessage}
							measureRowRef={measureRowRef}
							centerColumnWindow={centerColumnWindow}
						/>
					</DataGridTableVirtualBodyGate>
					{/* The same appended region as the standard body, so onRowCreate and a consumer draft work here too. */}
					{props.appendRow}
					<DataGridTableAddRow />
				</DataGridTableBody>
				{footerContent === undefined || footerContent === null ? null : <DataGridTableFoot>{footerContent}</DataGridTableFoot>}
			</DataGridTableBase>
		</DataGridTableViewport>
	);
}

/**
 * The windowed grid table. Inside a `DataGridScrollArea` it virtualizes
 * against that viewport; standalone it is its own scroll box (`height`).
 */
export const DataGridTableVirtual = React.forwardRef<HTMLDivElement, DataGridTableVirtualProps>(function DataGridTableVirtual(props, ref): React.JSX.Element {
	const { withGrid } = useDataGrid();
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({ visit: (grid) => <DataGridTableVirtualInner table={grid.table} virtualProps={props} forwardedRef={ref} /> }),
		[props, ref],
	);
	return withGrid(visitor);
});
