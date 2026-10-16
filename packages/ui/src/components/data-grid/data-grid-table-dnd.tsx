"use client";

// ============================================================
// components/data-grid/data-grid-table-dnd.tsx
//
// The grid table with drag-and-drop COLUMN reordering (dnd-kit). Each leaf
// header carries a labelled grip; mouse, touch and the keyboard sensor
// (Space to lift, arrows to move one sortable slot, Space to drop) reorder
// columns. The grid never writes the order itself: `handleDragEnd` receives
// dnd-kit's event and the consumer updates its `columnOrder` state.
// Built from the same blocks as DataGridTable.
// ============================================================

import { Button } from "@workspace/ui/components/button";
import {
	getDataGridHeaderSpans,
	useDataGrid,
	type DataGridCell,
	type DataGridColumn,
	type DataGridCoreTable,
	type DataGridGridVisitor,
} from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridTableBase,
	DataGridTableBody,
	DataGridTableBodyRow,
	DataGridTableBodyRowCell,
	DataGridTableBodyRowExpandded,
	DataGridTableBodyRowSkeleton,
	DataGridTableBodyRowSkeletonCell,
	DataGridTableEmpty,
	DataGridTableFillBodyCell,
	DataGridTableFillHeadCell,
	DataGridTableFoot,
	DataGridTableHead,
	DataGridTableHeadRow,
	DataGridTableHeadRowCell,
	DataGridTableHeadRowCellResize,
	DataGridTableRowSpacer,
	DataGridTableViewport,
	getDataGridHeadCellResizeHeader,
	getDataGridHeadCellSizeVar,
	getDataGridTableMergedHeaderGroups,
	getDataGridTableOrderedVisibleColumns,
	renderDataGridTableHeadCellContent,
	type DataGridHeader,
	type DataGridRow,
} from "@workspace/ui/components/data-grid/data-grid-table";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
	type DndContextProps,
	type DragEndEvent,
	type Modifier,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, type RowData } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import { GripVerticalIcon } from "lucide-react";
import * as React from "react";

// ── Shared with the row variant ────────────────────────────────────────────

/** Opacity of the column / row being carried. */
export const DATA_GRID_DND_DRAGGING_OPACITY = 0.8;

/** The fill cell's key in the one keyed list a row renders (start + center, fill, end). */
export const DATA_GRID_DND_FILL_KEY = "__data-grid-fill";

/** The viewport while a drag is in flight: the grabbing cursor wins over every descendant's. */
export const dataGridDndViewportVariants = cva("relative", {
	variants: {
		state: {
			default: "",
			dragging: "cursor-grabbing [&_*]:cursor-grabbing!",
		},
	},
	defaultVariants: { state: "default" },
});

/** Skeleton rows for the drag-and-drop variants: one row per page slot, the fill cell between center and end columns. */
export function DataGridTableDndSkeletonRows<TData extends RowData>({
	table,
	pageSize,
}: {
	readonly table: DataGridCoreTable<TData>;
	readonly pageSize: number;
}): React.JSX.Element {
	const startAndCenter = [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns()];
	const end = table.getEndVisibleLeafColumns();
	const rowKeys = Array.from({ length: pageSize }, (_, rowIndex) => `skeleton-${String(rowIndex)}`);
	const renderCell = (column: DataGridColumn<TData>): React.JSX.Element => (
		<DataGridTableBodyRowSkeletonCell column={column} key={column.id}>
			{column.columnDef.meta?.skeleton}
		</DataGridTableBodyRowSkeletonCell>
	);
	return (
		<>
			{rowKeys.map((rowKey) => (
				<DataGridTableBodyRowSkeleton key={rowKey}>
					{[...startAndCenter.map(renderCell), <DataGridTableFillBodyCell key={DATA_GRID_DND_FILL_KEY} />, ...end.map(renderCell)]}
				</DataGridTableBodyRowSkeleton>
			))}
		</>
	);
}

interface DataGridTableDndFrozenGateProps {
	readonly children: React.ReactNode;
	/** `true` while a column resize is in flight: widths move through CSS variables, rows need no reconciliation. */
	readonly frozen: boolean;
}

/** Skips body re-renders while a column resize is in flight. */
export const DataGridTableDndFrozenGate = React.memo(
	function DataGridTableDndFrozenGate({ children }: DataGridTableDndFrozenGateProps): React.ReactNode {
		return children;
	},
	(_previous: DataGridTableDndFrozenGateProps, next: DataGridTableDndFrozenGateProps): boolean => next.frozen,
);

/** `true` while a column resize is in flight. */
export function isDataGridColumnResizing<TData extends RowData>(table: DataGridCoreTable<TData>): boolean {
	return table.atoms.columnResizing.get().isResizingColumn !== false;
}

/** Locks the grabbing cursor on the document while `active`. */
export function useDataGridDragCursor(active: boolean): void {
	React.useEffect((): (() => void) | undefined => {
		if (!active) {
			return undefined;
		}
		const { body, documentElement } = document;
		const previousBodyCursor = body.style.cursor;
		const previousDocumentCursor = documentElement.style.cursor;
		body.style.cursor = "grabbing";
		documentElement.style.cursor = "grabbing";
		return (): void => {
			body.style.cursor = previousBodyCursor;
			documentElement.style.cursor = previousDocumentCursor;
		};
	}, [active]);
}

/** `DndContext` takes `accessibility` only when set (it rejects an explicit `undefined`). */
export function useDndAccessibilityProps(accessibility: DndContextProps["accessibility"]): Pick<DndContextProps, "accessibility"> {
	return React.useMemo((): Pick<DndContextProps, "accessibility"> => (accessibility === undefined ? {} : { accessibility }), [accessibility]);
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/** The visible leaf ids in rendered order (start, center, end): the sortable list's items. */
export function getDataGridRenderedColumnIds<TData extends RowData>(table: DataGridCoreTable<TData>): string[] {
	return getDataGridTableOrderedVisibleColumns(table).map((column) => column.id);
}

/**
 * A drop on a span's leaves targets its far edge — after its last leaf moving
 * forward, before its owner moving back — so no move lands inside a
 * `meta.headerColSpan` span.
 */
export function getDataGridDropBesideSpans<TData extends RowData>(table: DataGridCoreTable<TData>, event: DragEndEvent): DragEndEvent {
	const { active, over } = event;
	if (over === null || active.id === over.id) {
		return event;
	}
	const rendered = getDataGridRenderedColumnIds(table);
	const activeId = String(active.id);
	const overId = String(over.id);
	const from = rendered.indexOf(activeId);
	const to = rendered.indexOf(overId);
	if (from === -1 || to === -1) {
		return event;
	}
	for (const [ownerId, covered] of getDataGridHeaderSpans(table)) {
		const leaves = [ownerId, ...covered.map((column) => column.id)];
		if (!leaves.includes(overId)) {
			continue;
		}
		if (leaves.includes(activeId)) {
			return event;
		}
		const edge = from < to ? leaves.at(-1) : leaves.at(0);
		return edge === undefined || edge === overId ? event : { ...event, over: { ...over, id: edge } };
	}
	return event;
}

/**
 * The style a sortable column cell takes. A sticky pinned cell must not take
 * the drag keys: `relative` and z-index 0 would unstick it and sink it under
 * the centre cells, so they are omitted (not `undefined`, which would still win).
 */
function getDndColumnStyle(sticky: boolean, isDragging: boolean, transform: string | undefined, transition: string | undefined, width: string | number): React.CSSProperties {
	const base: React.CSSProperties = {
		opacity: isDragging ? DATA_GRID_DND_DRAGGING_OPACITY : 1,
		transition,
		cursor: isDragging ? "grabbing" : undefined,
		whiteSpace: "nowrap",
		width,
	};
	return sticky ? base : { ...base, position: "relative", transform, zIndex: isDragging ? 1 : 0 };
}

// ── Header & cells ─────────────────────────────────────────────────────────

const dndHandleVariants = cva("-ms-2 size-6", {
	variants: {
		state: {
			default: "cursor-grab active:cursor-grabbing",
			dragging: "cursor-grabbing",
		},
	},
	defaultVariants: { state: "default" },
});

export interface DataGridTableDndHeaderProps<TData extends RowData> {
	readonly header: DataGridHeader<TData>;
	/** Headers this cell spans through `meta.headerColSpan`. */
	readonly coveredHeaders?: readonly DataGridHeader<TData>[] | undefined;
}

/**
 * A sortable head cell with its grip. Pinned columns (pinning decides where
 * they render), group cells (their ids are not in `columnOrder`) and spans
 * (a drop moves one leaf, never its covered ones) get no grip.
 */
export function DataGridTableDndHeader<TData extends RowData>({ header, coveredHeaders = [] }: DataGridTableDndHeaderProps<TData>): React.JSX.Element {
	const { labels, props } = useDataGrid();
	const { tableLayout } = props;
	const { column } = header;
	const isPinned = column.getIsPinned() !== false;
	const isGroup = column.columns.length > 0;
	const isSpan = coveredHeaders.length > 0;
	const canOrder = !isPinned && !isGroup && !isSpan;
	const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: column.id, disabled: !canOrder });
	const resizeHeader = getDataGridHeadCellResizeHeader(header, coveredHeaders);
	const sticky = tableLayout.columnsPinnable && column.getCanPin() && isPinned;
	const width = tableLayout.columnsResizable
		? getDataGridHeadCellSizeVar(header, coveredHeaders)
		: coveredHeaders.reduce((sum, covered) => sum + covered.column.getSize(), column.getSize());
	const style = getDndColumnStyle(sticky, isDragging, CSS.Translate.toString(transform), transition, width);

	return (
		<DataGridTableHeadRowCell header={header} coveredHeaders={coveredHeaders} dndStyle={style} dndRef={setNodeRef}>
			<div className="flex items-center justify-start gap-0.5">
				{canOrder ? (
					<Button
						size="icon-xs"
						variant="ghost"
						data-slot="data-grid-table-dnd-column-handle"
						className={dndHandleVariants({ state: isDragging ? "dragging" : "default" })}
						{...attributes}
						{...listeners}
						aria-label={labels.dragToReorder}>
						<GripVerticalIcon aria-hidden="true" className="opacity-60 hover:opacity-100" />
					</Button>
				) : null}
				<div className="grow">{renderDataGridTableHeadCellContent(header)}</div>
				{tableLayout.columnsResizable && resizeHeader.column.getCanResize() ? <DataGridTableHeadRowCellResize header={resizeHeader} /> : null}
			</div>
		</DataGridTableHeadRowCell>
	);
}

/** A body cell that follows its column while the column is carried. */
export function DataGridTableDndCell<TData extends RowData>({ cell }: { readonly cell: DataGridCell<TData> }): React.JSX.Element {
	const { props } = useDataGrid();
	const { tableLayout } = props;
	const { column } = cell;
	const isPinned = column.getIsPinned() !== false;
	const { isDragging, setNodeRef, transform, transition } = useSortable({ id: column.id, disabled: isPinned });
	const sticky = tableLayout.columnsPinnable && column.getCanPin() && isPinned;
	const width = tableLayout.columnsResizable ? `calc(var(--col-${column.id}-size) * 1px)` : column.getSize();
	const style = getDndColumnStyle(sticky, isDragging, CSS.Translate.toString(transform), transition, width);
	return (
		<DataGridTableBodyRowCell cell={cell} dndStyle={style} dndRef={setNodeRef}>
			{flexRender(cell.column.columnDef.cell, cell.getContext())}
		</DataGridTableBodyRowCell>
	);
}

function DataGridTableDndBodyRow<TData extends RowData>({ row, columnIds }: { readonly row: DataGridRow<TData>; readonly columnIds: readonly string[] }): React.JSX.Element {
	const renderCell = (cell: DataGridCell<TData>): React.JSX.Element => <DataGridTableDndCell cell={cell} key={cell.id} />;
	return (
		<>
			<DataGridTableBodyRow row={row}>
				<SortableContext items={[...columnIds]} strategy={horizontalListSortingStrategy}>
					{/* One keyed list with the fill in the middle, as in the head row. */}
					{[
						...[...row.getStartVisibleCells(), ...row.getCenterVisibleCells()].map(renderCell),
						<DataGridTableFillBodyCell key={DATA_GRID_DND_FILL_KEY} />,
						...row.getEndVisibleCells().map(renderCell),
					]}
				</SortableContext>
			</DataGridTableBodyRow>
			{row.getIsExpanded() ? <DataGridTableBodyRowExpandded row={row} /> : null}
		</>
	);
}

function DataGridTableDndBodyRows<TData extends RowData>({ table }: { readonly table: DataGridCoreTable<TData> }): React.JSX.Element {
	const { isLoading, props } = useDataGrid();
	const { pageSize } = table.atoms.pagination.get();
	if (props.loadingMode === "skeleton" && isLoading && pageSize > 0) {
		return <DataGridTableDndSkeletonRows table={table} pageSize={pageSize} />;
	}
	const { rows } = table.getRowModel();
	if (rows.length === 0) {
		return <DataGridTableEmpty />;
	}
	const columnIds = getDataGridRenderedColumnIds(table);
	return (
		<>
			{rows.map((row) => (
				<DataGridTableDndBodyRow key={row.id} row={row} columnIds={columnIds} />
			))}
		</>
	);
}

// ── DataGridTableDnd ───────────────────────────────────────────────────────

export interface DataGridTableDndProps {
	/** Receives dnd-kit's drop event (with span-aware `over`); update `columnOrder` from it, e.g. with `arrayMove`. */
	readonly handleDragEnd: (event: DragEndEvent) => void;
	/** Footer rows rendered in a `<tfoot>`. */
	readonly footerContent?: React.ReactNode;
	/** Forwarded to dnd-kit's `DndContext`: screen-reader instructions and live-region announcements. */
	readonly accessibility?: DndContextProps["accessibility"];
	readonly className?: string;
}

interface DataGridTableDndInnerProps<TData extends RowData> extends DataGridTableDndProps {
	readonly table: DataGridCoreTable<TData>;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

function DataGridTableDndInner<TData extends RowData>({
	table,
	handleDragEnd,
	footerContent,
	accessibility,
	className,
	ref,
}: DataGridTableDndInnerProps<TData>): React.JSX.Element {
	const { props } = useDataGrid();
	const { tableLayout } = props;
	const dndId = React.useId();
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const viewportRef = React.useMemo(() => mergeRefs(containerRef, ref), [ref]);
	const [isDraggingColumn, setIsDraggingColumn] = React.useState(false);
	useDataGridDragCursor(isDraggingColumn);

	const sensors = useSensors(
		useSensor(MouseSensor, {}),
		useSensor(TouchSensor, {}),
		// Keyboard reordering moves one sortable position per keypress.
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	// Keeps the carried header inside the table horizontally and locks the vertical axis.
	const modifiers = React.useMemo((): Modifier[] => {
		const restrictToTableBounds: Modifier = ({ draggingNodeRect, transform }) => {
			const container = containerRef.current;
			if (draggingNodeRect === null || container === null) {
				return { ...transform, y: 0 };
			}
			const containerRect = container.getBoundingClientRect();
			const minX = containerRect.left - draggingNodeRect.left;
			const maxX = containerRect.right - draggingNodeRect.left - draggingNodeRect.width;
			return { ...transform, x: Math.min(Math.max(transform.x, minX), maxX), y: 0 };
		};
		return [restrictToTableBounds];
	}, []);

	const handleDragStart = React.useCallback((): void => {
		setIsDraggingColumn(true);
	}, []);
	const handleDragCancel = React.useCallback((): void => {
		setIsDraggingColumn(false);
	}, []);
	const handleDragEndEvent = React.useCallback(
		(event: DragEndEvent): void => {
			setIsDraggingColumn(false);
			handleDragEnd(getDataGridDropBesideSpans(table, event));
		},
		[handleDragEnd, table],
	);

	const accessibilityProps = useDndAccessibilityProps(accessibility);
	const mergedHeaderGroups = getDataGridTableMergedHeaderGroups(table);
	const columnIds = getDataGridRenderedColumnIds(table);

	return (
		<DndContext
			id={dndId}
			{...accessibilityProps}
			collisionDetection={closestCenter}
			modifiers={modifiers}
			sensors={sensors}
			onDragStart={handleDragStart}
			onDragCancel={handleDragCancel}
			onDragEnd={handleDragEndEvent}>
			<DataGridTableViewport ref={viewportRef} className={cn(dataGridDndViewportVariants({ state: isDraggingColumn ? "dragging" : "default" }), className)}>
				<DataGridTableBase>
					<DataGridTableHead>
						{mergedHeaderGroups.map((headerGroup, rowIndex) => {
							const renderHeader = (header: DataGridHeader<TData>): React.JSX.Element => (
								<DataGridTableDndHeader header={header} coveredHeaders={headerGroup.coveredHeaders.get(header.id)} key={header.id} />
							);
							return (
								<DataGridTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
									<SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
										{/* One keyed list (fill between center and end, as the colgroup puts it), so a column
										    pinned into or out of the end group moves instead of remounting and keeps focus.
										    The fill spans every head row, so only the first renders it. */}
										{[
											...[...headerGroup.startHeaders, ...headerGroup.centerHeaders].map(renderHeader),
											...(rowIndex === 0 ? [<DataGridTableFillHeadCell key={DATA_GRID_DND_FILL_KEY} rowSpan={mergedHeaderGroups.length} />] : []),
											...headerGroup.endHeaders.map(renderHeader),
										]}
									</SortableContext>
								</DataGridTableHeadRow>
							);
						})}
					</DataGridTableHead>
					{tableLayout.stripped || !tableLayout.rowBorder ? <DataGridTableRowSpacer /> : null}
					<DataGridTableBody>
						<DataGridTableDndFrozenGate frozen={isDataGridColumnResizing(table)}>
							<DataGridTableDndBodyRows table={table} />
						</DataGridTableDndFrozenGate>
					</DataGridTableBody>
					{footerContent === undefined || footerContent === null ? null : <DataGridTableFoot>{footerContent}</DataGridTableFoot>}
				</DataGridTableBase>
			</DataGridTableViewport>
		</DndContext>
	);
}

/** The grid table with drag-and-drop column reordering. */
export const DataGridTableDnd = React.forwardRef<HTMLDivElement, DataGridTableDndProps>(function DataGridTableDnd(props, ref): React.JSX.Element {
	const { withGrid } = useDataGrid();
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <DataGridTableDndInner table={grid.table} ref={ref} {...props} />,
		}),
		[props, ref],
	);
	return withGrid(visitor);
});
