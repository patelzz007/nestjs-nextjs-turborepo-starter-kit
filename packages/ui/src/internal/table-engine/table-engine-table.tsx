"use client";

// ============================================================
// components/table-engine/table-engine-table.tsx
//
// The grid's table renderer and its building blocks: the viewport (fill strip
// and meta.autoSize measurement), the <table> with its colgroup and column
// size variables, head rows with merged / spanning / pinned headers and
// resize handles, body rows and cells (row click, CRUD indications, cell
// selection chrome, fill handle), skeleton / spinner / empty states, and the
// row affordances column defs render (select, select-all, expand, pin).
//
// How the row type flows (see table-engine.tsx): parts that receive a typed row,
// header, cell or column read the table from it (`column.table`, `row.table`);
// TData-free parts read it through the context's `withGrid` visitor. The
// virtual and drag-and-drop table variants compose these same blocks.
// ============================================================

import { hasGlobalConstructor } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { useTableEngine, useTableEngineAtom, type TableEngineColumn, type TableEngineCoreTable, type TableEngineGridVisitor } from "./table-engine";
import { Spinner } from "@workspace/ui/components/spinner";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { type RowData } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import * as React from "react";
import { TableEngineTableEmpty } from "./table-engine-table-affordances";
import {
	TableEngineTableBody,
	TableEngineTableBodyRowSkeleton,
	TableEngineTableBodyRowSkeletonCell,
	TableEngineTableFoot,
	TableEngineTableRenderedRow,
	TableEngineTableRowSpacer,
} from "./table-engine-table-body";
import { TableEngineTableFillBodyCell, TableEngineTableFillCol, TableEngineTableFillHeadCell } from "./table-engine-table-fill";
import {
	TableEngineTableHead,
	TableEngineTableHeadRow,
	TableEngineTableHeadRowCell,
	TableEngineTableHeadRowCellResize,
	TableEngineTableResizeIndicator,
} from "./table-engine-table-head";
import {
	ATOMS_VISITOR,
	type TableEngineHeader,
	FILL_COLUMN_SPAN,
	HEADER_ROW_ARIA_INDEX,
	TOTAL_SIZE_GETTER_VISITOR,
	VISIBLE_LEAF_COUNT_VISITOR,
	getTableEngineHeadCellResizeHeader,
	getTableEngineTableFillMeasurementTarget,
	getTableEngineTableMergedHeaderGroups,
	getTableEngineTableOrderedVisibleColumns,
	getTableEngineTableResolvedRows,
	hasTableEngineTableRightPinnedColumns,
	renderTableEngineTableHeadCellContent,
	spacingClassesOf,
} from "./table-engine-table-layout";
import { getTableEngineColumnSizeVars } from "./table-engine-table-resize";

export {
	TableEngineTableEmpty,
	TableEngineTableLoader,
	type TableEngineTableRowAffordanceProps,
	TableEngineTableRowExpand,
	type TableEngineTableRowExpandProps,
	TableEngineTableRowPin,
	TableEngineTableRowSelect,
	TableEngineTableRowSelectAll,
} from "./table-engine-table-affordances";
export {
	TableEngineTableBody,
	TableEngineTableBodyRow,
	TableEngineTableBodyRowCell,
	type TableEngineTableBodyRowCellProps,
	TableEngineTableBodyRowExpandded,
	type TableEngineTableBodyRowExpandedProps,
	type TableEngineTableBodyRowProps,
	TableEngineTableBodyRowSkeleton,
	TableEngineTableBodyRowSkeletonCell,
	type TableEngineTableBodyRowSkeletonCellProps,
	TableEngineTableFoot,
	TableEngineTableFootRow,
	TableEngineTableFootRowCell,
	TableEngineTableRenderedRow,
	type TableEngineTableRenderedRowProps,
	TableEngineTableRowSpacer,
} from "./table-engine-table-body";
export { TableEngineTableFillBodyCell, TableEngineTableFillHeadCell, type TableEngineTableFillHeadCellProps } from "./table-engine-table-fill";
export {
	TableEngineTableHead,
	TableEngineTableHeadRow,
	TableEngineTableHeadRowCell,
	type TableEngineTableHeadRowCellProps,
	TableEngineTableHeadRowCellResize,
	type TableEngineTableHeadRowCellResizeProps,
	type TableEngineTableHeadRowProps,
} from "./table-engine-table-head";
export {
	type TableEngineCellSpacingSize,
	type TableEngineHeader,
	type TableEngineRow,
	type TableEngineStyle,
	type TableEngineTableCenterWindow,
	type TableEngineTableColumnEdges,
	type TableEngineTableMergedHeaderGroup,
	type TableEngineTablePinnedBoundary,
	type TableEngineTableResolvedRow,
	type TableEngineTableRowSections,
	tableEngineBodyCellVariants,
	tableEngineFooterCellVariants,
	tableEngineHeaderCellVariants,
	getTableEngineHeadCellResizeHeader,
	getTableEngineHeadCellSizeVar,
	getTableEngineScrollAreaViewport,
	getTableEngineTableColumnEdges,
	getTableEngineTableMergedHeaderGroups,
	getTableEngineTableOrderedVisibleColumns,
	getTableEngineTableResolvedRows,
	getTableEngineTableRowSections,
	getTableEngineTreeIndentStyle,
	getPinningStyles,
	hasTableEngineTableRightPinnedColumns,
	isTableEnginePortalEvent,
	renderTableEngineTableHeadCellContent,
} from "./table-engine-table-layout";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * The quick-create affordance, rendered as the body's last row when
 * `onRowCreate` is set: one full-width ghost button. What the click creates
 * stays consumer-owned.
 */
export const TableEngineTableAddRow = React.forwardRef<HTMLTableRowElement, Omit<React.ComponentProps<"tr">, "children">>(function TableEngineTableAddRow(
	{ className, ...props },
	ref,
): React.JSX.Element | null {
	const { labels, props: gridProps, withGrid } = useTableEngine();
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
			data-slot="table-engine-table-add-row"
			className={cn("hover:bg-muted/40 [thead+tbody_&:first-child]:border-t", gridProps.tableClassNames.rowCreate, className)}
			{...props}>
			<td colSpan={columnCount} className="p-0">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					// Block-level flex keeps the icon and label vertically centered.
					className={cn("flex w-full items-center justify-start rounded-none px-3 text-muted-foreground", spacingClassesOf(gridProps.tableLayout).appendRow)}
					onClick={handleClick}>
					<PlusIcon className="size-4" aria-hidden="true" />
					{gridProps.rowCreateLabel ?? labels.rowCreate}
				</Button>
			</td>
		</tr>
	);
});

// ── Table base ─────────────────────────────────────────────────────────────

interface TableEngineTableBaseInnerProps<TData extends RowData> {
	readonly table: TableEngineCoreTable<TData>;
	readonly tableProps: React.ComponentProps<"table">;
}

function TableEngineTableBaseInner<TData extends RowData>({ table, tableProps }: TableEngineTableBaseInnerProps<TData>): React.JSX.Element {
	const { props, recordCount } = useTableEngine();
	const { tableLayout, tableClassNames } = props;
	// The size variables and the width follow every sizing write.
	useTableEngineAtom(table.atoms.columnSizing);
	const { className, style, children, ...rest } = tableProps;
	const startAndCenterColumns = [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns()];
	const endColumns = table.getEndVisibleLeafColumns();
	const hasRightPinnedColumns = hasTableEngineTableRightPinnedColumns(table);
	// With cell selection on, the table announces as a grid so its cells compute as gridcells and aria-selected applies.
	const cellSelectionOn = tableLayout.cellSelection;

	const tableStyle: React.CSSProperties | undefined = tableLayout.columnsResizable
		? { ...getTableEngineColumnSizeVars(table), width: `calc(${String(table.getTotalSize())}px + var(--table-engine-fill-size, 0px))`, ...style }
		: style;

	const renderCol = (column: TableEngineColumn<TData>): React.JSX.Element => {
		const colStyle: React.CSSProperties | undefined = tableLayout.columnsResizable
			? { width: `calc(var(--col-${column.id}-size) * 1px)` }
			: tableLayout.width === "fixed"
				? { width: column.getSize() }
				: undefined;
		return <col key={column.id} style={colStyle} />;
	};

	return (
		<table
			data-slot="table-engine-table"
			role={cellSelectionOn ? "grid" : undefined}
			aria-multiselectable={cellSelectionOn && tableLayout.cellSelectionMode !== "single" ? true : undefined}
			// recordCount can undercount the rows present (a pinned draft row);
			// the union keeps every announced index inside the announced count.
			aria-rowcount={cellSelectionOn ? Math.max(recordCount, table.getRowsInDisplayOrder().length) + HEADER_ROW_ARIA_INDEX : undefined}
			className={cn(
				"caption-bottom text-left align-middle text-sm font-normal text-foreground rtl:text-right",
				// Opaque surfaces follow --card inside a Card.
				"in-data-[slot=card]:[--table-engine-card-surface:var(--card)]",
				// Pinned-edge separators are physical inset shadows; this sign flips them under RTL.
				"rtl:[--table-engine-dir:-1]",
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
				{hasRightPinnedColumns ? <TableEngineTableFillCol /> : null}
				{endColumns.map(renderCol)}
				{hasRightPinnedColumns ? null : <TableEngineTableFillCol />}
			</colgroup>
			{children}
		</table>
	);
}

/** The `<table>` with its colgroup and (under `columnsResizable`) the column size variables. */
export const TableEngineTableBase = React.forwardRef<HTMLTableElement, React.ComponentProps<"table">>(function TableEngineTableBase(props, ref): React.JSX.Element {
	const { withGrid } = useTableEngine();
	const tableProps = React.useMemo((): React.ComponentProps<"table"> => ({ ...props, ref }), [props, ref]);
	const visitor = React.useMemo(
		(): TableEngineGridVisitor<React.JSX.Element> => ({ visit: (grid) => <TableEngineTableBaseInner table={grid.table} tableProps={tableProps} /> }),
		[tableProps],
	);
	return withGrid(visitor);
});

// ── Viewport ───────────────────────────────────────────────────────────────

export interface TableEngineTableViewportProps extends React.ComponentProps<"div"> {
	/** A second ref to the viewport node (kept for the virtual variant, which binds its scroll element through it). */
	readonly viewportRef?: React.Ref<HTMLDivElement>;
}

/**
 * The table's width box. Under `columnsResizable` it measures its container
 * and writes the free space as `--table-engine-fill-size` (and the unitless
 * `--table-engine-fill`) straight onto the node — no React state — and feeds the
 * signed free space to the `meta.autoSize` coordinator.
 */
export const TableEngineTableViewport = React.forwardRef<HTMLDivElement, TableEngineTableViewportProps>(function TableEngineTableViewport(
	{ children, className, viewportRef, style, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, autoSize, withGrid } = useTableEngine();
	const atoms = withGrid(ATOMS_VISITOR);
	useTableEngineAtom(atoms.columnSizing);
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
			node.style.setProperty("--table-engine-fill-size", `${String(fillWidth)}px`);
			node.style.setProperty("--table-engine-fill", String(fillWidth));
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
				node.style.removeProperty("--table-engine-fill-size");
				node.style.removeProperty("--table-engine-fill");
				return;
			}
			const measurementTarget = getTableEngineTableFillMeasurementTarget(node);
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
		? { width: `calc(${String(getTotalSize())}px + var(--table-engine-fill-size, 0px))`, ...style }
		: style;

	return (
		<div data-slot="table-engine-table-viewport" ref={handleViewportRef} className={cn("relative min-w-full align-top", className)} style={viewportStyle} {...props}>
			{children}
			<TableEngineTableResizeIndicator viewportNodeRef={viewportNodeRef} />
		</div>
	);
});

// ── Head ───────────────────────────────────────────────────────────────────

function TableEngineTableSkeletonRows<TData extends RowData>({
	table,
	pageSize,
}: {
	readonly table: TableEngineCoreTable<TData>;
	readonly pageSize: number;
}): React.JSX.Element {
	const { props } = useTableEngine();
	const columnsResizable = props.tableLayout.columnsResizable;
	const startAndCenterColumns = [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns()];
	const endColumns = table.getEndVisibleLeafColumns();
	const hasRightPinnedColumns = hasTableEngineTableRightPinnedColumns(table);
	const rowKeys = Array.from({ length: pageSize }, (_, rowIndex) => `skeleton-${String(rowIndex)}`);
	const renderSkeletonCell = (column: TableEngineColumn<TData>): React.JSX.Element => (
		<TableEngineTableBodyRowSkeletonCell column={column} key={column.id}>
			{column.columnDef.meta?.skeleton}
		</TableEngineTableBodyRowSkeletonCell>
	);
	return (
		<>
			{rowKeys.map((rowKey) => (
				<TableEngineTableBodyRowSkeleton key={rowKey}>
					{startAndCenterColumns.map(renderSkeletonCell)}
					{columnsResizable && hasRightPinnedColumns ? <TableEngineTableFillBodyCell /> : null}
					{endColumns.map(renderSkeletonCell)}
					{columnsResizable && !hasRightPinnedColumns ? <TableEngineTableFillBodyCell /> : null}
				</TableEngineTableBodyRowSkeleton>
			))}
		</>
	);
}

function TableEngineTableBodyRows<TData extends RowData>({ table }: { readonly table: TableEngineCoreTable<TData> }): React.JSX.Element {
	const { labels, isLoading, props } = useTableEngine();
	const pageSize = props.skeletonRowCount ?? table.atoms.pagination.get().pageSize;

	if (isLoading && props.loadingMode === "skeleton" && pageSize > 0) {
		return <TableEngineTableSkeletonRows table={table} pageSize={pageSize} />;
	}

	if (isLoading && props.loadingMode === "spinner") {
		return (
			<tr>
				<td colSpan={getTableEngineTableOrderedVisibleColumns(table).length + (props.tableLayout.columnsResizable ? FILL_COLUMN_SPAN : 0)} className="p-8">
					<div role="status" className="flex items-center justify-center gap-3 text-muted-foreground">
						<Spinner aria-hidden className="size-5" />
						{props.loadingMessage ?? labels.loading}
					</div>
				</td>
			</tr>
		);
	}

	const resolvedRows = getTableEngineTableResolvedRows(table, props.tableLayout.rowsPinnable);
	if (resolvedRows.length === 0) {
		return <TableEngineTableEmpty />;
	}

	return (
		<>
			{resolvedRows.map(({ row, pinnedBoundary }) => (
				<TableEngineTableRenderedRow key={row.id} row={row} pinnedBoundary={pinnedBoundary} />
			))}
		</>
	);
}

interface TableEngineTableBodyRowsGateProps {
	readonly children: React.ReactNode;
	/** `true` while a column resize or a cell-selection drag is in flight. */
	readonly frozen: boolean;
}

/**
 * Skips body re-renders while frozen: during a resize the widths move through
 * CSS variables, and during a cell-selection drag each cell paints through its
 * own subscription, so row reconciliation would be pure waste.
 */
const TableEngineTableBodyRowsGate = React.memo(
	function TableEngineTableBodyRowsGate({ children }: TableEngineTableBodyRowsGateProps): React.ReactNode {
		return children;
	},
	(_previous: TableEngineTableBodyRowsGateProps, next: TableEngineTableBodyRowsGateProps): boolean => next.frozen,
);

function isBodyFrozen<TData extends RowData>(table: TableEngineCoreTable<TData>): boolean {
	return table.atoms.columnResizing.get().isResizingColumn !== false || table._isSelectingCells;
}

// ── Head rows ──────────────────────────────────────────────────────────────

function TableEngineTableHeadRows<TData extends RowData>({ table }: { readonly table: TableEngineCoreTable<TData> }): React.JSX.Element {
	const { props } = useTableEngine();
	const mergedHeaderGroups = getTableEngineTableMergedHeaderGroups(table);
	const hasRightPinnedColumns = hasTableEngineTableRightPinnedColumns(table);
	const columnsResizable = props.tableLayout.columnsResizable;

	return (
		<TableEngineTableHead>
			{mergedHeaderGroups.map((headerGroup, rowIndex) => {
				// The fill strip is one cell spanning every head row, so only the first row renders it.
				const fillHeadCell = columnsResizable && rowIndex === 0 ? <TableEngineTableFillHeadCell rowSpan={mergedHeaderGroups.length} /> : null;
				const renderHeadCell = (header: TableEngineHeader<TData>): React.JSX.Element => {
					const coveredHeaders = headerGroup.coveredHeaders.get(header.id);
					const resizeHeader = getTableEngineHeadCellResizeHeader(header, coveredHeaders);
					return (
						<TableEngineTableHeadRowCell header={header} coveredHeaders={coveredHeaders} key={header.id}>
							{renderTableEngineTableHeadCellContent(header)}
							{columnsResizable && resizeHeader.column.getCanResize() ? <TableEngineTableHeadRowCellResize header={resizeHeader} /> : null}
						</TableEngineTableHeadRowCell>
					);
				};
				return (
					<TableEngineTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
						{[...headerGroup.startHeaders, ...headerGroup.centerHeaders].map(renderHeadCell)}
						{hasRightPinnedColumns ? fillHeadCell : null}
						{headerGroup.endHeaders.map(renderHeadCell)}
						{hasRightPinnedColumns ? null : fillHeadCell}
					</TableEngineTableHeadRow>
				);
			})}
		</TableEngineTableHead>
	);
}

const HEAD_ROWS_VISITOR: TableEngineGridVisitor<React.JSX.Element> = { visit: (grid) => <TableEngineTableHeadRows table={grid.table} /> };

/** A header-only table (for split header/body layouts). */
export const TableEngineTableHeader = React.forwardRef<HTMLDivElement, Omit<TableEngineTableViewportProps, "children">>(
	function TableEngineTableHeader(props, ref): React.JSX.Element {
		const { withGrid } = useTableEngine();
		return (
			<TableEngineTableViewport ref={ref} {...props}>
				<TableEngineTableBase>{withGrid(HEAD_ROWS_VISITOR)}</TableEngineTableBase>
			</TableEngineTableViewport>
		);
	},
);

// ── TableEngineTable ──────────────────────────────────────────────────────────

const BODY_ROWS_VISITOR: TableEngineGridVisitor<React.JSX.Element> = {
	visit: (grid) => (
		<TableEngineTableBodyRowsGate frozen={isBodyFrozen(grid.table)}>
			<TableEngineTableBodyRows table={grid.table} />
		</TableEngineTableBodyRowsGate>
	),
};

export interface TableEngineTableProps extends Omit<TableEngineTableViewportProps, "children"> {
	/** Footer rows (`TableEngineTableFootRow`s) rendered in a `<tfoot>`. */
	readonly footerContent?: React.ReactNode;
	/** `false` renders the body only (pair with `TableEngineTableHeader`). Defaults to `true`. */
	readonly renderHeader?: boolean;
}

/** The standard grid table: head rows, body (rows / skeleton / spinner / empty), append and add rows, and an optional footer. */
export const TableEngineTable = React.forwardRef<HTMLDivElement, TableEngineTableProps>(function TableEngineTable(
	{ footerContent, renderHeader = true, ...props },
	ref,
): React.JSX.Element {
	const { props: gridProps, withGrid } = useTableEngine();
	const { tableLayout } = gridProps;
	return (
		<TableEngineTableViewport ref={ref} {...props}>
			<TableEngineTableBase>
				{renderHeader ? withGrid(HEAD_ROWS_VISITOR) : null}
				{renderHeader && (tableLayout.stripped || !tableLayout.rowBorder) ? <TableEngineTableRowSpacer /> : null}
				<TableEngineTableBody>
					{withGrid(BODY_ROWS_VISITOR)}
					{gridProps.appendRow}
					<TableEngineTableAddRow />
				</TableEngineTableBody>
				{footerContent === undefined || footerContent === null ? null : <TableEngineTableFoot>{footerContent}</TableEngineTableFoot>}
			</TableEngineTableBase>
		</TableEngineTableViewport>
	);
});
