"use client";

// The data grid table's header (enhancement 8.1: split from data-grid-table.tsx): the head rows and cells, the resize handle and its indicator.

import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	type DataGridColumn,
	type DataGridCoreTable,
	type DataGridGridVisitor,
	getColumnHeaderLabel,
	useDataGrid,
	useDataGridAtom,
} from "@workspace/ui/components/data-grid/data-grid";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { type RowData } from "@tanstack/react-table";
import * as React from "react";
import {
	type DataGridHeader,
	HEADER_ROW_ARIA_INDEX,
	INDICATOR_MIN_HEAD_HEIGHT_PX,
	IS_MULTI_LEVEL_HEADER_VISITOR,
	PINNED_EDGE_SHADOW_CLASSES,
	PRIMARY_MOUSE_BUTTON,
	RESIZE_KEYBOARD_STEP_PX,
	dataGridHeaderCellVariants,
	getDataGridHeadCellResizeHeader,
	getDataGridHeadCellSizeVar,
	getDataGridHeaderLeafColumns,
	getDataGridHeaderLineEdge,
	getDataGridTableColumnEdges,
	getPinningStyles,
	hasDataGridTableRightPinnedColumns,
	spacingSize,
} from "./data-grid-table-layout";
import { isMirroredResize, isOnEndResizeMode, startDataGridColumnResize } from "./data-grid-table-resize";
import { getDataGridHeaderSpans } from "./data-grid";

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

export function ariaSortOf<TData extends RowData>(column: DataGridColumn<TData>): "ascending" | "descending" | "none" | undefined {
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

export function selectIsResizingColumn(resizing: { readonly isResizingColumn: false | string }): false | string {
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

export interface DataGridTableResizeIndicatorProps {
	readonly viewportNodeRef: React.RefObject<HTMLDivElement | null>;
}

export interface HeaderHeightCache {
	key: string | false;
	value: number;
}

export function DataGridTableResizeIndicatorInner<TData extends RowData>({
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

export function DataGridTableResizeIndicator({ viewportNodeRef }: DataGridTableResizeIndicatorProps): React.JSX.Element | null {
	const { withGrid } = useDataGrid();
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({ visit: (grid) => <DataGridTableResizeIndicatorInner table={grid.table} viewportNodeRef={viewportNodeRef} /> }),
		[viewportNodeRef],
	);
	return withGrid(visitor);
}

// ── Body / foot sections ───────────────────────────────────────────────────
