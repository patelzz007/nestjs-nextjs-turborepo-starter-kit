"use client";

// The data grid table's body and footer (enhancement 8.1: split from data-grid-table.tsx): rows, cells, skeletons and the rendered row.

import {
	type DataGridCell,
	type DataGridCellSelectionCellAttrs,
	type DataGridColumn,
	type DataGridResolvedTableLayout,
	dataGridCellSelectionCellClasses,
	getDataGridCellSelectionCellAttrs,
	toDataGridDomId,
	useDataGrid,
} from "@workspace/ui/components/data-grid/data-grid";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { type RowData, Subscribe, flexRender } from "@tanstack/react-table";
import * as React from "react";
import { DataGridTableFillBodyCell, DataGridTableFillFootCell } from "./data-grid-table-fill";
import {
	BODY_ROW_ARIA_INDEX_OFFSET,
	BODY_ROW_BOTTOM_BORDER_CLASSES,
	type DataGridRow,
	type DataGridTableCenterWindow,
	type DataGridTablePinnedBoundary,
	FILL_COLUMN_SPAN,
	HAS_END_PINNED_VISITOR,
	PINNED_EDGE_SHADOW_CLASSES,
	PINNED_SURFACE,
	PRIMARY_MOUSE_BUTTON,
	dataGridBodyCellTruncateVariants,
	dataGridBodyCellVariants,
	dataGridFillHandleVariants,
	dataGridFooterCellVariants,
	getDataGridTableColumnEdges,
	getPinningStyles,
	hasDataGridTableRightPinnedColumns,
	isDataGridCellInteractiveTarget,
	isDataGridPortalEvent,
	spacingSize,
} from "./data-grid-table-layout";

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
export function bodyCellClasses<TData extends RowData>(
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
export function bodyCellLayoutStyle<TData extends RowData>(layout: DataGridResolvedTableLayout, column: DataGridColumn<TData>): React.CSSProperties {
	return {
		...(layout.columnsPinnable && column.getCanPin() ? getPinningStyles(column) : undefined),
		...(layout.columnsResizable ? { width: `calc(var(--col-${column.id}-size) * 1px)` } : undefined),
	};
}

export function lastColAttr<TData extends RowData>(column: DataGridColumn<TData>): "start" | "end" | undefined {
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
export const ROW_STATUS_CLASSES =
	"data-[row-status=deleted]:bg-destructive/5 data-[row-status=deleted]:opacity-60 data-[row-status=dirty]:bg-warning/5 data-[row-status=new]:bg-success/5 data-[row-status=deleted]:[&_td]:line-through";
export const ROW_STATUS_PINNED_CLASSES = `data-[row-status=deleted]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--destructive)_5%,${PINNED_SURFACE})] data-[row-status=dirty]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--warning)_5%,${PINNED_SURFACE})] data-[row-status=new]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--success)_5%,${PINNED_SURFACE})]`;
export const ROW_PINNED_HOVER_CLASSES = `hover:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--muted)_40%,${PINNED_SURFACE})] data-[state=selected]:[&>td[data-pinned]]:bg-[color-mix(in_oklab,var(--muted)_50%,${PINNED_SURFACE})]`;

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

export interface DataGridTableBodyCellTdProps<TData extends RowData> extends DataGridTableBodyRowCellProps<TData> {
	readonly selection: DataGridCellSelectionCellAttrs | null;
}

export const CELL_STATUS_CLASSES =
	"data-[cell-status=invalid]:after:border-t-destructive data-[cell-status]:relative data-[cell-status]:after:absolute data-[cell-status]:after:end-0 data-[cell-status]:after:top-0 data-[cell-status]:after:size-0 data-[cell-status]:after:border-s-[5px] data-[cell-status]:after:border-t-[5px] data-[cell-status]:after:border-s-transparent data-[cell-status]:after:content-[''] data-[cell-status=dirty]:after:border-t-warning";

export function DataGridTableBodyCellTd<TData extends RowData>({
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

export function renderBodyCell<TData extends RowData>(cell: DataGridCell<TData>): React.JSX.Element {
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
