"use client";

// The data grid table's header (enhancement 8.1: split from table-engine-table.tsx): the head rows and cells, the resize handle and its indicator.

import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	type TableEngineColumn,
	type TableEngineCoreTable,
	type TableEngineGridVisitor,
	getColumnHeaderLabel,
	getTableEngineHeaderSpans,
	useTableEngine,
	useTableEngineAtom,
} from "./table-engine";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { type RowData } from "@tanstack/react-table";
import * as React from "react";
import {
	type TableEngineHeader,
	HEADER_ROW_ARIA_INDEX,
	INDICATOR_MIN_HEAD_HEIGHT_PX,
	IS_MULTI_LEVEL_HEADER_VISITOR,
	PINNED_EDGE_SHADOW_CLASSES,
	PRIMARY_MOUSE_BUTTON,
	RESIZE_KEYBOARD_STEP_PX,
	tableEngineHeaderCellVariants,
	getTableEngineHeadCellResizeHeader,
	getTableEngineHeadCellSizeVar,
	getTableEngineHeaderLeafColumns,
	getTableEngineHeaderLineEdge,
	getTableEngineTableColumnEdges,
	getPinningStyles,
	hasTableEngineTableRightPinnedColumns,
	spacingClassesOf,
	spacingSize,
} from "./table-engine-table-layout";
import { isMirroredResize, isOnEndResizeMode, startTableEngineColumnResize } from "./table-engine-table-resize";

/** The `<thead>`; sticky under `tableLayout.headerSticky`. */
export const TableEngineTableHead = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"thead">>(function TableEngineTableHead(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useTableEngine();
	return (
		<thead
			ref={ref}
			className={cn(gridProps.tableClassNames.header, gridProps.tableLayout.headerSticky ? gridProps.tableClassNames.headerSticky : undefined, className)}
			{...props}
		/>
	);
});

export interface TableEngineTableHeadRowProps extends React.ComponentProps<"tr"> {
	/** The merged header group's id. */
	readonly rowId: string;
}

/** One head row. */
export const TableEngineTableHeadRow = React.forwardRef<HTMLTableRowElement, TableEngineTableHeadRowProps>(function TableEngineTableHeadRow(
	{ rowId, className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, withGrid } = useTableEngine();
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

export function ariaSortOf<TData extends RowData>(column: TableEngineColumn<TData>): "ascending" | "descending" | "none" | undefined {
	const sortDirection = column.getIsSorted();
	if (sortDirection === "asc") {
		return "ascending";
	}
	if (sortDirection === "desc") {
		return "descending";
	}
	return column.getCanSort() ? "none" : undefined;
}

export interface TableEngineTableHeadRowCellProps<TData extends RowData> {
	/** The header cell's content. */
	readonly children?: React.ReactNode;
	/** CSS classes for the `<thead>` element. */
	readonly header: TableEngineHeader<TData>;
	/** Headers this cell spans through `meta.headerColSpan`; they render none. */
	readonly coveredHeaders?: readonly TableEngineHeader<TData>[] | undefined;
	/** The drag-and-drop variant's sortable node ref. */
	readonly dndRef?: React.Ref<HTMLTableCellElement> | undefined;
	/** The drag-and-drop variant's transform style. */
	readonly dndStyle?: React.CSSProperties | undefined;
	/** The header cell's `th`. */
	readonly ref?: React.Ref<HTMLTableCellElement> | undefined;
}

/** A head cell: sort semantics, pinning, spans, group rules and the band that aligns merged labels. */
export function TableEngineTableHeadRowCell<TData extends RowData>({
	children,
	header,
	coveredHeaders = [],
	dndRef,
	dndStyle,
	ref,
}: TableEngineTableHeadRowCellProps<TData>): React.JSX.Element {
	const { props } = useTableEngine();
	const { tableLayout, tableClassNames } = props;
	const { column } = header;
	const { table } = column;
	// Pinned offsets and the span width below read sizing state.
	useTableEngineAtom(table.atoms.columnSizing);
	const mergedRef = React.useMemo((): React.RefCallback<HTMLTableCellElement> => mergeRefs(ref, dndRef), [ref, dndRef]);

	// A group spans several leaves and its own column reads pinned when ANY
	// leaf is: pin state, edges and offsets come from its first and last leaf.
	const isGroup = column.columns.length > 0;
	const isSpan = coveredHeaders.length > 0;
	const leafColumns = isSpan ? [column, ...coveredHeaders.map((covered) => covered.column)] : getTableEngineHeaderLeafColumns(header);
	const colSpan = coveredHeaders.reduce((sum, covered) => sum + covered.colSpan, header.colSpan);
	const size = coveredHeaders.reduce((sum, covered) => sum + covered.getSize(), header.getSize());
	const resizeColumn = getTableEngineHeadCellResizeHeader(header, coveredHeaders).column;
	const firstLeaf = leafColumns.at(0) ?? column;
	const lastLeaf = leafColumns.at(-1) ?? column;
	const isPinned = firstLeaf.getIsPinned();
	const isFirstStartPinned = isPinned === "start" && firstLeaf.getIsFirstColumn("start");
	const isLastStartPinned = isPinned === "start" && lastLeaf.getIsLastColumn("start");
	const isFirstEndPinned = isPinned === "end" && firstLeaf.getIsFirstColumn("end");
	const isLastEndPinned = isPinned === "end" && lastLeaf.getIsLastColumn("end");
	const isFirst = getTableEngineTableColumnEdges(table, firstLeaf.id).isFirst;
	const isLast = getTableEngineTableColumnEdges(table, lastLeaf.id).isLast;
	const isMultiLevel = table.getHeaderGroups().length > 1;
	// Every cell ending on the header's bottom edge holds its content in a leaf-row-high band, so merged labels sit level with leaf labels.
	const isBanded = header.rowSpan > 1 || (isMultiLevel && header.subHeaders.length === 0);
	// A group with no resize handle of its own continues the line its edge leaf draws.
	const groupLineEdge =
		isGroup && !column.getCanResize()
			? getTableEngineHeaderLineEdge(table, tableLayout, lastLeaf) === "end"
				? "end"
				: getTableEngineHeaderLineEdge(table, tableLayout, firstLeaf) === "start"
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
		...(tableLayout.columnsResizable ? { width: getTableEngineHeadCellSizeVar(header, coveredHeaders) } : undefined),
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
				tableEngineHeaderCellVariants({ look: tableLayout.look, size: spacingSize(tableLayout) }),
				isBanded ? "align-bottom" : undefined,
				tableLayout.headerBackground ? "bg-muted" : undefined,
				tableLayout.cellBorder ? "border-e" : undefined,
				// Multi-level rows end on different columns, so each cell checks its own last leaf.
				tableLayout.cellBorder && isMultiLevel && isLast ? "border-e-0" : undefined,
				// The resize filler follows the center group; a border on the last center cell would float against it.
				tableLayout.cellBorder &&
					tableLayout.columnsResizable &&
					(tableLayout.columnsPinnable || !hasTableEngineTableRightPinnedColumns(table)) &&
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
					data-slot="table-engine-table-head-cell-band"
					className={cn("table w-full table-fixed", tableLayout.headerBorder ? spacingClassesOf(tableLayout).headBandBordered : spacingClassesOf(tableLayout).headBand)}>
					<div className="table-cell align-middle">{children}</div>
				</div>
			) : (
				children
			)}
			{isGroup && !hasColumnDividers ? (
				<span
					aria-hidden="true"
					data-slot="table-engine-table-head-group-rule"
					className={cn("pointer-events-none absolute h-px bg-border", tableLayout.headerBorder ? "-bottom-px" : "bottom-0", spacingClassesOf(tableLayout).groupRule)}
				/>
			) : null}
			{groupLineEdge === null ? null : (
				<span
					aria-hidden="true"
					data-slot="table-engine-table-head-divider"
					className={cn("pointer-events-none absolute inset-y-0 w-px bg-border", groupLineEdge === "end" ? "end-0" : "start-0")}
				/>
			)}
		</th>
	);
}

export function selectIsResizingColumn(resizing: { readonly isResizingColumn: false | string }): false | string {
	return resizing.isResizingColumn;
}

export interface TableEngineTableHeadRowCellResizeProps<TData extends RowData> {
	/** CSS classes for the `<thead>` element. */
	readonly header: TableEngineHeader<TData>;
}

// The handle draws its line with ::before. At rest: a short, soft divider centred in the header, so the header reads
// as columns without lines running through the rows. On hover or keyboard focus: the full header height in the
// primary colour, saying "drag here". While a live drag runs: the same line down the whole table, a guide for the new
// edge (`--table-engine-resize-guide`, set by the drag to the table's height below the header's top).
const RESIZE_LINE_RESTING_CLASS_NAME =
	"before:absolute before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2 before:rounded-full before:bg-border before:transition-[background-color,height,width] before:duration-150";
const RESIZE_LINE_HOVER_CLASS_NAME =
	"hover:before:top-0 hover:before:h-full hover:before:w-0.5 hover:before:translate-y-0 hover:before:bg-primary focus-visible:before:top-0 focus-visible:before:h-full focus-visible:before:w-0.5 focus-visible:before:translate-y-0 focus-visible:before:bg-primary";
const RESIZE_LINE_ACTIVE_CLASS_NAME =
	"opacity-100 before:top-0 before:h-(--table-engine-resize-guide,100%) before:w-0.5 before:translate-y-0 before:bg-primary before:transition-none";

/**
 * A column's resize handle: a button (its accessible name from the
 * `resizeColumn` label) that drags with mouse or touch, resets on
 * double-click, and steps with ArrowLeft / ArrowRight.
 */
export function TableEngineTableHeadRowCellResize<TData extends RowData>({ header }: TableEngineTableHeadRowCellResizeProps<TData>): React.JSX.Element {
	const { props, autoSize, labels } = useTableEngine();
	const { tableLayout } = props;
	const { column } = header;
	const { table } = column;
	// Re-renders as a drag starts and ends, for column.getIsResizing() below.
	useTableEngineAtom(table.atoms.columnResizing, selectIsResizingColumn);
	// A group's handle sits on its edge leaf's boundary: the last leaf, or the first for an end-pinned group.
	const leafColumns = getTableEngineHeaderLeafColumns(header);
	const isPinned = (leafColumns.at(0) ?? column).getIsPinned();
	const edgeColumn = (isPinned === "end" ? leafColumns.at(0) : leafColumns.at(-1)) ?? column;
	const isLastVisibleColumn = getTableEngineTableColumnEdges(table, edgeColumn.id).isLast;
	const hidesLastCenterLine = tableLayout.columnsPinnable && edgeColumn.getIsLastColumn("center") && hasTableEngineTableRightPinnedColumns(table);
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
			stopResizeSessionRef.current = startTableEngineColumnResize(event, header, !isResizeModeOnEnd, autoSize);
		},
		[header, isResizeModeOnEnd, autoSize],
	);

	const handleTouchStart = React.useCallback(
		(event: React.TouchEvent<HTMLElement>): void => {
			event.preventDefault();
			event.stopPropagation();
			stopResizeSessionRef.current?.();
			stopResizeSessionRef.current = startTableEngineColumnResize(event, header, !isResizeModeOnEnd, autoSize);
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
	// Where the handle and its line sit on the column's edge.
	const edgeClassName =
		isPinned === "end"
			? // An end-pinned column grows from its START edge, so the handle lives there.
				"start-0 w-5 justify-start before:start-0"
			: isLastVisibleColumn || isPinned === "start"
				? // A sticky pinned column keeps the handle inside the cell, where the next sticky cell cannot paint over it.
					"end-0 w-5 justify-end before:end-0"
				: cn("-end-2 w-5 justify-center", tableLayout.cellBorder && !hidesLastCenterLine ? "before:end-[calc(--spacing(2)-1px)]" : "before:end-2");
	// The resting divider shows only where nothing else marks the boundary: not after the last column, not over a cell
	// border (the th border-e already draws it), not where pinned columns already draw their own edge.
	const showsRestingLine = isPinned === false ? !isLastVisibleColumn && !tableLayout.cellBorder && !hidesLastCenterLine : !tableLayout.columnsPinnable;

	return (
		// A button (not a div): consumers stretch end-aligned header CONTENT with
		// `[&>div]:w-full`, which must not catch the handle.
		<button
			type="button"
			data-slot="table-engine-table-resize-handle"
			aria-label={labels.resizeColumn(getColumnHeaderLabel(column))}
			onDoubleClick={handleDoubleClick}
			onMouseDown={handleMouseDown}
			onTouchStart={handleTouchStart}
			onKeyDown={handleKeyDown}
			className={cn(
				"absolute top-0 z-10 flex h-full cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none select-none",
				edgeClassName,
				RESIZE_LINE_RESTING_CLASS_NAME,
				showsRestingLine ? undefined : "before:bg-transparent",
				RESIZE_LINE_HOVER_CLASS_NAME,
				// onEnd mode draws its guide as a separate indicator; a live drag draws it from the handle down the table.
				isResizing ? (isResizeModeOnEnd ? "opacity-100" : RESIZE_LINE_ACTIVE_CLASS_NAME) : undefined,
			)}
		/>
	);
}

// ── Resize indicator (onEnd mode) ──────────────────────────────────────────

export interface TableEngineTableResizeIndicatorProps {
	readonly viewportNodeRef: React.RefObject<HTMLDivElement | null>;
}

export interface HeaderHeightCache {
	key: string | false;
	value: number;
}

export function TableEngineTableResizeIndicatorInner<TData extends RowData>({
	table,
	viewportNodeRef,
}: TableEngineTableResizeIndicatorProps & { readonly table: TableEngineCoreTable<TData> }): React.JSX.Element | null {
	const { props } = useTableEngine();
	const indicatorRef = React.useRef<HTMLDivElement | null>(null);
	const indicatorHeadRef = React.useRef<HTMLDivElement | null>(null);
	// The header height is stable for a drag; caching it avoids a forced layout per mousemove.
	const headerHeightCacheRef = React.useRef<HeaderHeightCache>({ key: false, value: 0 });
	const columnResizing = useTableEngineAtom(table.atoms.columnResizing);
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
		const viewportRoot = viewportElement ?? indicator.closest<HTMLElement>('[data-slot="table-engine-table-viewport"]');
		// A 0 is never cached: it means the thead was not measurable yet.
		if (headerHeightCacheRef.current.key !== resizingColumnId || headerHeightCacheRef.current.value <= 0) {
			headerHeightCacheRef.current = {
				key: resizingColumnId,
				value: viewportRoot?.querySelector('[data-slot="table-engine-table"] thead')?.getBoundingClientRect().height ?? 0,
			};
		}
		// Anchor on the live header cell (right for sticky pinned columns at any scroll); a covered leaf's edge is its span's th.
		const spanOwnerId = [...getTableEngineHeaderSpans(table)].find(([, covered]) => covered.some((leaf) => leaf.id === resizingHeader.column.id))?.at(LIST_SLOT_INDEX.first);
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
		<div ref={indicatorRef} aria-hidden="true" data-slot="table-engine-table-resize-indicator" className="pointer-events-none absolute inset-y-0 z-overlay">
			<div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-primary/85" />
			<div ref={indicatorHeadRef} className="absolute top-0 left-0 w-[5px] -translate-x-1/2 rounded-b-sm bg-primary shadow-xs" />
		</div>
	);
}

export function TableEngineTableResizeIndicator({ viewportNodeRef }: TableEngineTableResizeIndicatorProps): React.JSX.Element | null {
	const { withGrid } = useTableEngine();
	const visitor = React.useMemo(
		(): TableEngineGridVisitor<React.JSX.Element> => ({ visit: (grid) => <TableEngineTableResizeIndicatorInner table={grid.table} viewportNodeRef={viewportNodeRef} /> }),
		[viewportNodeRef],
	);
	return withGrid(visitor);
}

// ── Body / foot sections ───────────────────────────────────────────────────
