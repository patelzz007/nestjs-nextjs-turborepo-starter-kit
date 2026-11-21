"use client";

// The data grid table's body and footer (enhancement 8.1: split from table-engine-table.tsx): rows, cells, skeletons and the rendered row.

import {
	type TableEngineCell,
	type TableEngineCellSelectionCellAttrs,
	type TableEngineColumn,
	type TableEngineResolvedTableLayout,
	tableEngineCellSelectionCellClasses,
	getTableEngineCellSelectionCellAttrs,
	toTableEngineDomId,
	useTableEngine,
} from "./table-engine";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { type RowData, Subscribe, flexRender } from "@tanstack/react-table";
import * as React from "react";
import { TableEngineTableRowExpand } from "./table-engine-table-affordances";
import { TableEngineTableFillBodyCell, TableEngineTableFillFootCell } from "./table-engine-table-fill";
import {
	BODY_ROW_ARIA_INDEX_OFFSET,
	BODY_ROW_BOTTOM_BORDER_CLASSES,
	type TableEngineRow,
	type TableEngineTableCenterWindow,
	type TableEngineTablePinnedBoundary,
	FILL_COLUMN_SPAN,
	HAS_END_PINNED_VISITOR,
	PINNED_EDGE_SHADOW_CLASSES,
	PINNED_SURFACE,
	PRIMARY_MOUSE_BUTTON,
	tableEngineBodyCellTruncateVariants,
	tableEngineBodyCellVariants,
	tableEngineFillHandleVariants,
	tableEngineFooterCellVariants,
	getTableEngineTableColumnEdges,
	getPinningStyles,
	hasTableEngineTableRightPinnedColumns,
	isTableEngineCellInteractiveTarget,
	isTableEnginePortalEvent,
	cellLookOf,
	spacingClassesOf,
	TABLE_ENGINE_BODY_ROW_TINT_CLASSES,
} from "./table-engine-table-layout";

/** Breathing room between the head and the body when rows carry no borders. */
export const TableEngineTableRowSpacer = React.forwardRef<HTMLTableSectionElement, Omit<React.ComponentProps<"tbody">, "children">>(function TableEngineTableRowSpacer(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <tbody ref={ref} aria-hidden="true" data-slot="table-engine-table-body-spacer" className={cn("h-2", className)} {...props} />;
});

/** The `<tbody>`. */
export const TableEngineTableBody = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tbody">>(function TableEngineTableBody(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useTableEngine();
	return (
		<tbody
			ref={ref}
			data-slot="table-engine-table-body"
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
export const TableEngineTableFoot = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<"tfoot">>(function TableEngineTableFoot(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useTableEngine();
	return (
		<tfoot
			ref={ref}
			data-slot="table-engine-table-foot"
			className={cn(gridProps.tableLayout.rowBorder ? "[&>tr:first-child>td]:border-t" : undefined, gridProps.tableClassNames.footer, className)}
			{...props}
		/>
	);
});

/** A footer row; appends the filler strip's cell. */
export const TableEngineTableFootRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(function TableEngineTableFootRow(
	{ className, children, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, withGrid } = useTableEngine();
	const { tableLayout } = gridProps;
	const hasRightPinnedColumns = withGrid(HAS_END_PINNED_VISITOR);
	return (
		<tr
			ref={ref}
			data-slot="table-engine-table-foot-row"
			className={cn(
				tableLayout.footerBackground ? `bg-muted/40 dark:bg-[color:${PINNED_SURFACE}]` : undefined,
				tableLayout.rowBorder ? BODY_ROW_BOTTOM_BORDER_CLASSES : undefined,
				tableLayout.cellBorder ? "*:last:border-e-0" : undefined,
				// The fill foot cell is the :last child; the real last cell needs the same treatment.
				tableLayout.cellBorder && tableLayout.columnsResizable && (tableLayout.columnsPinnable || !hasRightPinnedColumns)
					? "[&>td:has(+td[data-slot=table-engine-table-fill-foot-cell])]:border-e-0"
					: undefined,
				className,
			)}
			{...props}>
			{children}
			<TableEngineTableFillFootCell />
		</tr>
	);
});

/** A footer cell. */
export const TableEngineTableFootRowCell = React.forwardRef<HTMLTableCellElement, React.ComponentProps<"td">>(function TableEngineTableFootRowCell(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useTableEngine();
	const { tableLayout } = gridProps;
	return (
		<td
			ref={ref}
			className={cn(
				tableEngineFooterCellVariants(cellLookOf(tableLayout)),
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
export const TableEngineTableBodyRowSkeleton = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(function TableEngineTableBodyRowSkeleton(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps } = useTableEngine();
	const { tableLayout } = gridProps;
	return (
		<tr
			ref={ref}
			className={cn(
				TABLE_ENGINE_BODY_ROW_TINT_CLASSES[tableLayout.look],
				spacingClassesOf(tableLayout).bodyRow,
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
export function bodyCellClasses<TData extends RowData>(
	layout: TableEngineResolvedTableLayout,
	column: TableEngineColumn<TData>,
	hasRightPinnedColumns: boolean,
	truncates: boolean,
): string {
	return cn(
		tableEngineBodyCellVariants(cellLookOf(layout)),
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
export function bodyCellLayoutStyle<TData extends RowData>(layout: TableEngineResolvedTableLayout, column: TableEngineColumn<TData>): React.CSSProperties {
	return {
		...(layout.columnsPinnable && column.getCanPin() ? getPinningStyles(column) : undefined),
		...(layout.columnsResizable ? { width: `calc(var(--col-${column.id}-size) * 1px)` } : undefined),
	};
}

export function lastColAttr<TData extends RowData>(column: TableEngineColumn<TData>): "start" | "end" | undefined {
	const isPinned = column.getIsPinned();
	if (isPinned === "start" && column.getIsLastColumn("start")) {
		return "start";
	}
	if (isPinned === "end" && column.getIsFirstColumn("end")) {
		return "end";
	}
	return undefined;
}

export interface TableEngineTableBodyRowSkeletonCellProps<TData extends RowData> {
	/** The placeholder's content. */
	readonly children?: React.ReactNode;
	/** The column the placeholder stands in. */
	readonly column: TableEngineColumn<TData>;
	/** The cell's `td`. */
	readonly ref?: React.Ref<HTMLTableCellElement> | undefined;
}

/** A skeleton row's cell, laid out exactly like a body cell of `column`. */
export function TableEngineTableBodyRowSkeletonCell<TData extends RowData>({ children, column, ref }: TableEngineTableBodyRowSkeletonCellProps<TData>): React.JSX.Element {
	const { props } = useTableEngine();
	const { tableLayout, tableClassNames } = props;
	const { table } = column;
	const edges = getTableEngineTableColumnEdges(table, column.id);
	const isPinned = column.getIsPinned();
	return (
		<td
			ref={ref}
			style={bodyCellLayoutStyle(tableLayout, column)}
			data-pinned={isPinned === false ? undefined : isPinned}
			data-last-col={lastColAttr(column)}
			className={cn(
				bodyCellClasses(tableLayout, column, hasTableEngineTableRightPinnedColumns(table), true),
				edges.isFirst || edges.isLast ? tableClassNames.edgeCell : undefined,
			)}>
			{children}
		</td>
	);
}

// ── Body rows ──────────────────────────────────────────────────────────────

export interface TableEngineTableBodyRowProps<TData extends RowData> {
	/** The row's cells. */
	readonly children?: React.ReactNode;
	/** The TanStack Table row instance. */
	readonly row: TableEngineRow<TData>;
	/** Whether the row is the last pinned row, drawn with the boundary between pinned and scrolling rows. */
	readonly pinnedBoundary?: TableEngineTablePinnedBoundary | undefined;
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
	/** The row's `tr`. */
	readonly ref?: React.Ref<HTMLTableRowElement> | undefined;
}

/** The status tints `getRowStatus` activates; pinned cells get the same tints pre-mixed over the opaque surface. */
export const ROW_STATUS_CLASSES =
	"data-[row-status=deleted]:bg-destructive/5 data-[row-status=deleted]:opacity-60 data-[row-status=dirty]:bg-warning/5 data-[row-status=new]:bg-success/5 data-[row-status=deleted]:[&_td]:line-through";
export const ROW_STATUS_PINNED_CLASSES = `data-[row-status=deleted]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--destructive)_5%,${PINNED_SURFACE})] data-[row-status=dirty]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--warning)_5%,${PINNED_SURFACE})] data-[row-status=new]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--success)_5%,${PINNED_SURFACE})]`;
export const ROW_PINNED_HOVER_CLASSES = `hover:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--muted)_40%,${PINNED_SURFACE})] data-[state=selected]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--muted)_50%,${PINNED_SURFACE})]`;

/** A body row: selection state, CRUD tints, pinned-row chrome, row click. */
export function TableEngineTableBodyRow<TData extends RowData>({
	children,
	row,
	pinnedBoundary,
	rowRef,
	dndRef,
	dndStyle,
	dndDragging,
	dataIndex,
	ref,
}: TableEngineTableBodyRowProps<TData>): React.JSX.Element {
	const { props } = useTableEngine();
	const { tableLayout, tableClassNames, onRowClick, getRowStatus, activeRowId } = props;
	const isRowPinned = row.getIsPinned();
	const rowStatus = getRowStatus?.(row.id);
	const isActive = activeRowId !== undefined && activeRowId === row.id;
	const mergedRef = React.useMemo((): React.RefCallback<HTMLTableRowElement> => mergeRefs(ref, rowRef, dndRef), [ref, rowRef, dndRef]);
	const rowId = row.id;

	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLTableRowElement>): void => {
			if (isTableEnginePortalEvent(event)) {
				return;
			}
			onRowClick?.(rowId);
		},
		[onRowClick, rowId],
	);

	// A clickable row is also a keyboard target: Enter or Space on the row itself (never on a control inside it)
	// activates it. With cell selection on, the grid owns the keyboard, so the row stays out of the tab order.
	const isKeyboardActivatable = onRowClick !== undefined && !tableLayout.cellSelection;
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLTableRowElement>): void => {
			if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) {
				return;
			}
			// Space would otherwise scroll the page.
			event.preventDefault();
			onRowClick?.(rowId);
		},
		[onRowClick, rowId],
	);

	return (
		<tr
			ref={mergedRef}
			tabIndex={isKeyboardActivatable ? 0 : undefined}
			onKeyDown={isKeyboardActivatable ? handleKeyDown : undefined}
			style={dndStyle}
			data-state={row.getIsSelected() ? "selected" : undefined}
			data-index={dataIndex}
			data-row-id={row.id}
			data-depth={row.depth > 0 ? row.depth : undefined}
			data-row-pinned={isRowPinned === false ? undefined : isRowPinned}
			data-row-pinned-boundary={pinnedBoundary}
			data-row-status={rowStatus}
			data-active={isActive ? true : undefined}
			aria-current={isActive ? true : undefined}
			// Style the dragged row's slot through this, never its inline style.
			data-dragging={dndDragging === true ? true : undefined}
			// 1-based after the header row; row.index keeps the announced index absolute across pagination.
			aria-rowindex={tableLayout.cellSelection ? row.index + BODY_ROW_ARIA_INDEX_OFFSET : undefined}
			onClick={handleClick}
			className={cn(
				TABLE_ENGINE_BODY_ROW_TINT_CLASSES[tableLayout.look],
				spacingClassesOf(tableLayout).bodyRow,
				"data-active:bg-primary/8 data-active:hover:bg-primary/12",
				tableLayout.columnsPinnable ? ROW_PINNED_HOVER_CLASSES : undefined,
				onRowClick === undefined ? undefined : "cursor-pointer",
				isKeyboardActivatable ? "outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset" : undefined,
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

export interface TableEngineTableBodyRowExpandedProps<TData extends RowData> {
	/** The TanStack Table row instance. */
	readonly row: TableEngineRow<TData>;
}

/** The detail row under an expanded row: the first column's `meta.expandedContent`. Renders nothing without one. */
export function TableEngineTableBodyRowExpandded<TData extends RowData>({ row }: TableEngineTableBodyRowExpandedProps<TData>): React.JSX.Element | null {
	const { props } = useTableEngine();
	const expandedContent = row.table.getAllColumns().find((column) => column.columnDef.meta?.expandedContent !== undefined)?.columnDef.meta?.expandedContent;
	// Tree and grouped rows share row.getIsExpanded(); an empty <tr> would break striping and row measurement.
	if (expandedContent === undefined) {
		return null;
	}
	return (
		<tr data-slot="table-engine-table-expanded-row" className={cn(props.tableLayout.rowBorder ? BODY_ROW_BOTTOM_BORDER_CLASSES : undefined)}>
			<td colSpan={row.getVisibleCells().length + (props.tableLayout.columnsResizable ? FILL_COLUMN_SPAN : 0)}>{expandedContent(row.original)}</td>
		</tr>
	);
}

// ── Body cells ─────────────────────────────────────────────────────────────

export interface TableEngineTableBodyRowCellProps<TData extends RowData> {
	/** The cell's content. */
	readonly children?: React.ReactNode;
	/** The TanStack cell this `td` draws. */
	readonly cell: TableEngineCell<TData>;
	/** The drag-and-drop variant's sortable node ref. */
	readonly dndRef?: React.Ref<HTMLTableCellElement> | undefined;
	/** The drag-and-drop variant's transform style. */
	readonly dndStyle?: React.CSSProperties | undefined;
	/** Center-column index under column virtualization (`data-column-index`). */
	readonly columnIndex?: number | undefined;
	/** The cell's `td`. */
	readonly ref?: React.Ref<HTMLTableCellElement> | undefined;
}

export interface TableEngineTableBodyCellTdProps<TData extends RowData> extends TableEngineTableBodyRowCellProps<TData> {
	readonly selection: TableEngineCellSelectionCellAttrs | null;
}

export const CELL_STATUS_CLASSES =
	"data-[cell-status=invalid]:after:border-t-destructive data-[cell-status]:relative data-[cell-status]:after:absolute data-[cell-status]:after:end-0 data-[cell-status]:after:top-0 data-[cell-status]:after:size-0 data-[cell-status]:after:border-s-[5px] data-[cell-status]:after:border-t-[5px] data-[cell-status]:after:border-s-transparent data-[cell-status]:after:content-[''] data-[cell-status=dirty]:after:border-t-warning";

export function TableEngineTableBodyCellTd<TData extends RowData>({
	children,
	cell,
	dndRef,
	dndStyle,
	columnIndex,
	ref,
	selection,
}: TableEngineTableBodyCellTdProps<TData>): React.JSX.Element {
	const { props, gridId } = useTableEngine();
	const { tableLayout, tableClassNames, getCellStatus } = props;
	const { column, row } = cell;
	const { table } = column;
	const edges = getTableEngineTableColumnEdges(table, column.id);
	const isPinned = column.getIsPinned();
	const cellSelectionOn = tableLayout.cellSelection;
	const rangeSelectionOn = cellSelectionOn && tableLayout.cellSelectionMode !== "single";
	const mergedRef = React.useMemo((): React.RefCallback<HTMLTableCellElement> => mergeRefs(ref, dndRef), [ref, dndRef]);

	const handleMouseDown = React.useCallback(
		(event: React.MouseEvent<HTMLTableCellElement>): void => {
			if (event.button !== PRIMARY_MOUSE_BUTTON || isTableEnginePortalEvent(event)) {
				return;
			}
			if (isTableEngineCellInteractiveTarget(event.target)) {
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
			if (!isTableEnginePortalEvent(event)) {
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
			<div className={tableEngineBodyCellTruncateVariants(cellLookOf(tableLayout))}>{children}</div>
		) : (
			children
		);

	return (
		<td
			ref={mergedRef}
			// The id is what the controller's aria-activedescendant points at.
			id={cellSelectionOn ? `${gridId}c-${toTableEngineDomId(row.id)}-${toTableEngineDomId(column.id)}` : undefined}
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
				bodyCellClasses(tableLayout, column, hasTableEngineTableRightPinnedColumns(table), !cellSelectionOn),
				getCellStatus === undefined ? undefined : CELL_STATUS_CLASSES,
				edges.isFirst || edges.isLast ? tableClassNames.edgeCell : undefined,
				selection === null ? undefined : tableEngineCellSelectionCellClasses,
			)}>
			{content}
			{showFillHandle ? (
				<span
					data-slot="table-engine-cell-fill-handle"
					className={cn(tableEngineFillHandleVariants({ variant: tableLayout.cellFillHandleVariant }), tableClassNames.cellFillHandle)}
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
export function TableEngineTableBodyRowCell<TData extends RowData>(cellProps: TableEngineTableBodyRowCellProps<TData>): React.JSX.Element {
	const { props } = useTableEngine();
	const { cell } = cellProps;
	const selectAttrs = React.useCallback((): TableEngineCellSelectionCellAttrs => getTableEngineCellSelectionCellAttrs(cell), [cell]);
	if (!props.tableLayout.cellSelection) {
		return <TableEngineTableBodyCellTd {...cellProps} selection={null} />;
	}
	return (
		<Subscribe source={cell.column.table.atoms.cellSelection} selector={selectAttrs}>
			{(selection: TableEngineCellSelectionCellAttrs) => <TableEngineTableBodyCellTd {...cellProps} selection={selection} />}
		</Subscribe>
	);
}

export interface TableEngineTableRenderedRowProps<TData extends RowData> {
	/** The TanStack Table row instance. */
	readonly row: TableEngineRow<TData>;
	/** Whether the row is the last pinned row. */
	readonly pinnedBoundary?: TableEngineTablePinnedBoundary | undefined;
	/** The row's `tr`, for virtualisation measuring. */
	readonly rowRef?: React.Ref<HTMLTableRowElement> | undefined;
	/** Virtualized list index, rendered as `data-index` for measureElement. */
	readonly rowIndex?: number | undefined;
	/**
	 * Column-virtualization window over the CENTER cells: only the inclusive
	 * [start, end] slice renders, and each flank collapses into one colSpan
	 * spacer (the colgroup stays complete, so the layout cannot drift).
	 */
	readonly centerWindow?: TableEngineTableCenterWindow | undefined;
}

/**
 * What a body cell shows. In a grouped table a group's own row has three kinds of cell: the one it is grouped by
 * (a toggle, the group's value and how many rows it holds), a subtotal (the column's `aggregatedCell`, or its plain
 * `cell` over the aggregated value), and an empty placeholder. Every other cell renders its column's `cell`.
 */
export function renderTableEngineCellContent<TData extends RowData>(cell: TableEngineCell<TData>): React.ReactNode {
	if (cell.getIsGrouped()) {
		return (
			<span data-slot="table-engine-group-cell" className="inline-flex min-w-0 items-center gap-1 font-medium">
				<TableEngineTableRowExpand row={cell.row} />
				<span className="min-w-0 truncate">{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
				<span className="text-xs text-muted-foreground tabular-nums">({cell.row.subRows.length})</span>
			</span>
		);
	}
	if (cell.getIsAggregated()) {
		return <span className="font-medium">{flexRender(cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell, cell.getContext())}</span>;
	}
	if (cell.getIsPlaceholder()) {
		return null;
	}
	return flexRender(cell.column.columnDef.cell, cell.getContext());
}

export function renderBodyCell<TData extends RowData>(cell: TableEngineCell<TData>): React.JSX.Element {
	return (
		<TableEngineTableBodyRowCell cell={cell} key={cell.id}>
			{renderTableEngineCellContent(cell)}
		</TableEngineTableBodyRowCell>
	);
}

/** One complete body row (start, windowed center, filler, end cells) plus its expanded detail row. */
export function TableEngineTableRenderedRow<TData extends RowData>({
	row,
	pinnedBoundary,
	rowRef,
	rowIndex,
	centerWindow,
}: TableEngineTableRenderedRowProps<TData>): React.JSX.Element {
	const { props } = useTableEngine();
	const columnsResizable = props.tableLayout.columnsResizable;
	const hasRightPinnedColumns = hasTableEngineTableRightPinnedColumns(row.table);
	const centerVisibleCells = row.getCenterVisibleCells();
	const windowedCenterCells = centerWindow === undefined ? centerVisibleCells : centerVisibleCells.slice(centerWindow.start, centerWindow.end + 1);
	const leadingSpacerSpan = centerWindow === undefined ? 0 : centerWindow.start;
	const trailingSpacerSpan = centerWindow === undefined ? 0 : Math.max(0, centerVisibleCells.length - 1 - centerWindow.end);

	return (
		<>
			<TableEngineTableBodyRow row={row} pinnedBoundary={pinnedBoundary} rowRef={rowRef} dataIndex={rowIndex}>
				{row.getStartVisibleCells().map(renderBodyCell)}
				{/* The spacers carry no data-slot, so sibling `[data-slot] ~ [data-slot]` rules never restyle every row on a column shift. */}
				{leadingSpacerSpan > 0 ? <td aria-hidden="true" data-col-spacer="start" colSpan={leadingSpacerSpan} /> : null}
				{windowedCenterCells.map((cell, cellIndex) => (
					<TableEngineTableBodyRowCell cell={cell} key={cell.id} columnIndex={centerWindow === undefined ? undefined : centerWindow.start + cellIndex}>
						{renderTableEngineCellContent(cell)}
					</TableEngineTableBodyRowCell>
				))}
				{trailingSpacerSpan > 0 ? <td aria-hidden="true" data-col-spacer="end" colSpan={trailingSpacerSpan} /> : null}
				{columnsResizable && hasRightPinnedColumns ? <TableEngineTableFillBodyCell /> : null}
				{row.getEndVisibleCells().map(renderBodyCell)}
				{columnsResizable && !hasRightPinnedColumns ? <TableEngineTableFillBodyCell /> : null}
			</TableEngineTableBodyRow>
			{row.getIsExpanded() ? <TableEngineTableBodyRowExpandded row={row} /> : null}
		</>
	);
}

// ── States ─────────────────────────────────────────────────────────────────
