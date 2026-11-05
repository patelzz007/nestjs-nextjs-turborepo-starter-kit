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

import { hasGlobalConstructor } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { useDataGrid, useDataGridAtom, type DataGridColumn, type DataGridCoreTable, type DataGridGridVisitor } from "@workspace/ui/components/data-grid/data-grid";
import { Spinner } from "@workspace/ui/components/spinner";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { type RowData } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import * as React from "react";
import { DataGridTableEmpty } from "./data-grid-table-affordances";
import {
	DataGridTableBody,
	DataGridTableBodyRowSkeleton,
	DataGridTableBodyRowSkeletonCell,
	DataGridTableFoot,
	DataGridTableRenderedRow,
	DataGridTableRowSpacer,
} from "./data-grid-table-body";
import { DataGridTableFillBodyCell, DataGridTableFillCol, DataGridTableFillHeadCell } from "./data-grid-table-fill";
import { DataGridTableHead, DataGridTableHeadRow, DataGridTableHeadRowCell, DataGridTableHeadRowCellResize, DataGridTableResizeIndicator } from "./data-grid-table-head";
import {
	ATOMS_VISITOR,
	type DataGridHeader,
	FILL_COLUMN_SPAN,
	HEADER_ROW_ARIA_INDEX,
	TOTAL_SIZE_GETTER_VISITOR,
	VISIBLE_LEAF_COUNT_VISITOR,
	getDataGridHeadCellResizeHeader,
	getDataGridTableFillMeasurementTarget,
	getDataGridTableMergedHeaderGroups,
	getDataGridTableOrderedVisibleColumns,
	getDataGridTableResolvedRows,
	hasDataGridTableRightPinnedColumns,
	renderDataGridTableHeadCellContent,
} from "./data-grid-table-layout";
import { getDataGridColumnSizeVars } from "./data-grid-table-resize";

export {
	DataGridTableEmpty,
	DataGridTableLoader,
	type DataGridTableRowAffordanceProps,
	DataGridTableRowExpand,
	type DataGridTableRowExpandProps,
	DataGridTableRowPin,
	DataGridTableRowSelect,
	DataGridTableRowSelectAll,
} from "./data-grid-table-affordances";
export {
	DataGridTableBody,
	DataGridTableBodyRow,
	DataGridTableBodyRowCell,
	type DataGridTableBodyRowCellProps,
	DataGridTableBodyRowExpandded,
	type DataGridTableBodyRowExpandedProps,
	type DataGridTableBodyRowProps,
	DataGridTableBodyRowSkeleton,
	DataGridTableBodyRowSkeletonCell,
	type DataGridTableBodyRowSkeletonCellProps,
	DataGridTableFoot,
	DataGridTableFootRow,
	DataGridTableFootRowCell,
	DataGridTableRenderedRow,
	type DataGridTableRenderedRowProps,
	DataGridTableRowSpacer,
} from "./data-grid-table-body";
export { DataGridTableFillBodyCell, DataGridTableFillHeadCell, type DataGridTableFillHeadCellProps } from "./data-grid-table-fill";
export {
	DataGridTableHead,
	DataGridTableHeadRow,
	DataGridTableHeadRowCell,
	type DataGridTableHeadRowCellProps,
	DataGridTableHeadRowCellResize,
	type DataGridTableHeadRowCellResizeProps,
	type DataGridTableHeadRowProps,
} from "./data-grid-table-head";
export {
	type DataGridCellSpacingSize,
	type DataGridHeader,
	type DataGridRow,
	type DataGridStyle,
	type DataGridTableCenterWindow,
	type DataGridTableColumnEdges,
	type DataGridTableMergedHeaderGroup,
	type DataGridTablePinnedBoundary,
	type DataGridTableResolvedRow,
	type DataGridTableRowSections,
	dataGridBodyCellVariants,
	dataGridFooterCellVariants,
	dataGridHeaderCellVariants,
	getDataGridHeadCellResizeHeader,
	getDataGridHeadCellSizeVar,
	getDataGridScrollAreaViewport,
	getDataGridTableColumnEdges,
	getDataGridTableMergedHeaderGroups,
	getDataGridTableOrderedVisibleColumns,
	getDataGridTableResolvedRows,
	getDataGridTableRowSections,
	getDataGridTreeIndentStyle,
	getPinningStyles,
	hasDataGridTableRightPinnedColumns,
	isDataGridPortalEvent,
	renderDataGridTableHeadCellContent,
} from "./data-grid-table-layout";

// ── Types ──────────────────────────────────────────────────────────────────

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
