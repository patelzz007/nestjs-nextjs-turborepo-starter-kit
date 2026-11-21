"use client";

// ============================================================
// components/table-engine/table-engine-table-dnd.tsx
//
// The grid table with drag-and-drop COLUMN reordering (dnd-kit). Each leaf
// header carries a labelled grip; mouse, touch and the keyboard sensor
// (Space to lift, arrows to move one sortable slot, Space to drop) reorder
// columns. The grid never writes the order itself: `handleDragEnd` receives
// dnd-kit's event and the consumer updates its `columnOrder` state.
// Built from the same blocks as TableEngineTable.
// ============================================================

import { Button } from "@workspace/ui/components/button";
import {
	getTableEngineHeaderSpans,
	useTableEngine,
	type TableEngineCell,
	type TableEngineColumn,
	type TableEngineCoreTable,
	type TableEngineGridVisitor,
} from "./table-engine";
import {
	TableEngineTableBase,
	TableEngineTableBody,
	TableEngineTableBodyRow,
	TableEngineTableBodyRowCell,
	TableEngineTableBodyRowExpandded,
	TableEngineTableBodyRowSkeleton,
	TableEngineTableBodyRowSkeletonCell,
	TableEngineTableEmpty,
	TableEngineTableFillBodyCell,
	TableEngineTableFillHeadCell,
	TableEngineTableFoot,
	TableEngineTableHead,
	TableEngineTableHeadRow,
	TableEngineTableHeadRowCell,
	TableEngineTableHeadRowCellResize,
	TableEngineTableRowSpacer,
	TableEngineTableViewport,
	getTableEngineHeadCellResizeHeader,
	getTableEngineHeadCellSizeVar,
	getTableEngineTableMergedHeaderGroups,
	getTableEngineTableOrderedVisibleColumns,
	renderTableEngineTableHeadCellContent,
	type TableEngineHeader,
	type TableEngineRow,
} from "./table-engine-table";
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
import type { RowData } from "@tanstack/react-table";
import { renderTableEngineCellContent } from "./table-engine-table-body";
import { cva } from "class-variance-authority";
import { GripVerticalIcon } from "lucide-react";
import * as React from "react";

// ── Shared with the row variant ────────────────────────────────────────────

/** Opacity of the column / row being carried. */
export const TABLE_ENGINE_DND_DRAGGING_OPACITY = 0.8;

/** The fill cell's key in the one keyed list a row renders (start + center, fill, end). */
export const TABLE_ENGINE_DND_FILL_KEY = "__table-engine-fill";

/** The viewport while a drag is in flight: the grabbing cursor wins over every descendant's. */
export const tableEngineDndViewportVariants = cva("relative", {
	variants: {
		state: {
			default: "",
			dragging: "cursor-grabbing [&_*]:cursor-grabbing!",
		},
	},
	defaultVariants: { state: "default" },
});

/** Skeleton rows for the drag-and-drop variants: one row per page slot, the fill cell between center and end columns. */
export function TableEngineTableDndSkeletonRows<TData extends RowData>({
	table,
	pageSize,
}: {
	/** The TanStack Table instance. */
	readonly table: TableEngineCoreTable<TData>;
	/** How many skeleton rows to draw. */
	readonly pageSize: number;
}): React.JSX.Element {
	const startAndCenter = [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns()];
	const end = table.getEndVisibleLeafColumns();
	const rowKeys = Array.from({ length: pageSize }, (_, rowIndex) => `skeleton-${String(rowIndex)}`);
	const renderCell = (column: TableEngineColumn<TData>): React.JSX.Element => (
		<TableEngineTableBodyRowSkeletonCell column={column} key={column.id}>
			{column.columnDef.meta?.skeleton}
		</TableEngineTableBodyRowSkeletonCell>
	);
	return (
		<>
			{rowKeys.map((rowKey) => (
				<TableEngineTableBodyRowSkeleton key={rowKey}>
					{[...startAndCenter.map(renderCell), <TableEngineTableFillBodyCell key={TABLE_ENGINE_DND_FILL_KEY} />, ...end.map(renderCell)]}
				</TableEngineTableBodyRowSkeleton>
			))}
		</>
	);
}

interface TableEngineTableDndFrozenGateProps {
	/** Content that stays put while a column is dragged. */
	readonly children: React.ReactNode;
	/** `true` while a column resize is in flight: widths move through CSS variables, rows need no reconciliation. */
	readonly frozen: boolean;
}

/** Skips body re-renders while a column resize is in flight. */
export const TableEngineTableDndFrozenGate = React.memo(
	function TableEngineTableDndFrozenGate({ children }: TableEngineTableDndFrozenGateProps): React.ReactNode {
		return children;
	},
	(_previous: TableEngineTableDndFrozenGateProps, next: TableEngineTableDndFrozenGateProps): boolean => next.frozen,
);

/** `true` while a column resize is in flight. */
export function isTableEngineColumnResizing<TData extends RowData>(table: TableEngineCoreTable<TData>): boolean {
	return table.atoms.columnResizing.get().isResizingColumn !== false;
}

/** Locks the grabbing cursor on the document while `active`. */
export function useTableEngineDragCursor(active: boolean): void {
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
export function getTableEngineRenderedColumnIds<TData extends RowData>(table: TableEngineCoreTable<TData>): string[] {
	return getTableEngineTableOrderedVisibleColumns(table).map((column) => column.id);
}

/**
 * A drop on a span's leaves targets its far edge — after its last leaf moving
 * forward, before its owner moving back — so no move lands inside a
 * `meta.headerColSpan` span.
 */
export function getTableEngineDropBesideSpans<TData extends RowData>(table: TableEngineCoreTable<TData>, event: DragEndEvent): DragEndEvent {
	const { active, over } = event;
	if (over === null || active.id === over.id) {
		return event;
	}
	const rendered = getTableEngineRenderedColumnIds(table);
	const activeId = String(active.id);
	const overId = String(over.id);
	const from = rendered.indexOf(activeId);
	const to = rendered.indexOf(overId);
	if (from === -1 || to === -1) {
		return event;
	}
	for (const [ownerId, covered] of getTableEngineHeaderSpans(table)) {
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
		opacity: isDragging ? TABLE_ENGINE_DND_DRAGGING_OPACITY : 1,
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

export interface TableEngineTableDndHeaderProps<TData extends RowData> {
	/** CSS classes for the `<thead>` element. */
	readonly header: TableEngineHeader<TData>;
	/** Headers this cell spans through `meta.headerColSpan`. */
	readonly coveredHeaders?: readonly TableEngineHeader<TData>[] | undefined;
}

/**
 * A sortable head cell with its grip. Pinned columns (pinning decides where
 * they render), group cells (their ids are not in `columnOrder`) and spans
 * (a drop moves one leaf, never its covered ones) get no grip.
 */
export function TableEngineTableDndHeader<TData extends RowData>({ header, coveredHeaders = [] }: TableEngineTableDndHeaderProps<TData>): React.JSX.Element {
	const { labels, props } = useTableEngine();
	const { tableLayout } = props;
	const { column } = header;
	const isPinned = column.getIsPinned() !== false;
	const isGroup = column.columns.length > 0;
	const isSpan = coveredHeaders.length > 0;
	const canOrder = !isPinned && !isGroup && !isSpan;
	const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: column.id, disabled: !canOrder });
	const resizeHeader = getTableEngineHeadCellResizeHeader(header, coveredHeaders);
	const sticky = tableLayout.columnsPinnable && column.getCanPin() && isPinned;
	const width = tableLayout.columnsResizable
		? getTableEngineHeadCellSizeVar(header, coveredHeaders)
		: coveredHeaders.reduce((sum, covered) => sum + covered.column.getSize(), column.getSize());
	const style = getDndColumnStyle(sticky, isDragging, CSS.Translate.toString(transform), transition, width);

	return (
		<TableEngineTableHeadRowCell header={header} coveredHeaders={coveredHeaders} dndStyle={style} dndRef={setNodeRef}>
			<div className="flex items-center justify-start gap-0.5">
				{canOrder ? (
					<Button
						size="icon-xs"
						variant="ghost"
						data-slot="table-engine-table-dnd-column-handle"
						className={dndHandleVariants({ state: isDragging ? "dragging" : "default" })}
						{...attributes}
						{...listeners}
						aria-label={labels.dragToReorder}>
						<GripVerticalIcon aria-hidden="true" className="opacity-60 hover:opacity-100" />
					</Button>
				) : null}
				<div className="grow">{renderTableEngineTableHeadCellContent(header)}</div>
				{tableLayout.columnsResizable && resizeHeader.column.getCanResize() ? <TableEngineTableHeadRowCellResize header={resizeHeader} /> : null}
			</div>
		</TableEngineTableHeadRowCell>
	);
}

/** A body cell that follows its column while the column is carried. */
export function TableEngineTableDndCell<TData extends RowData>({
	cell,
}: {
	/** The TanStack cell this `td` draws. */
	readonly cell: TableEngineCell<TData>;
}): React.JSX.Element {
	const { props } = useTableEngine();
	const { tableLayout } = props;
	const { column } = cell;
	const isPinned = column.getIsPinned() !== false;
	const { isDragging, setNodeRef, transform, transition } = useSortable({ id: column.id, disabled: isPinned });
	const sticky = tableLayout.columnsPinnable && column.getCanPin() && isPinned;
	const width = tableLayout.columnsResizable ? `calc(var(--col-${column.id}-size) * 1px)` : column.getSize();
	const style = getDndColumnStyle(sticky, isDragging, CSS.Translate.toString(transform), transition, width);
	return (
		<TableEngineTableBodyRowCell cell={cell} dndStyle={style} dndRef={setNodeRef}>
			{renderTableEngineCellContent(cell)}
		</TableEngineTableBodyRowCell>
	);
}

function TableEngineTableDndBodyRow<TData extends RowData>({
	row,
	columnIds,
}: {
	readonly row: TableEngineRow<TData>;
	readonly columnIds: readonly string[];
}): React.JSX.Element {
	const renderCell = (cell: TableEngineCell<TData>): React.JSX.Element => <TableEngineTableDndCell cell={cell} key={cell.id} />;
	return (
		<>
			<TableEngineTableBodyRow row={row}>
				<SortableContext items={[...columnIds]} strategy={horizontalListSortingStrategy}>
					{/* One keyed list with the fill in the middle, as in the head row. */}
					{[
						...[...row.getStartVisibleCells(), ...row.getCenterVisibleCells()].map(renderCell),
						<TableEngineTableFillBodyCell key={TABLE_ENGINE_DND_FILL_KEY} />,
						...row.getEndVisibleCells().map(renderCell),
					]}
				</SortableContext>
			</TableEngineTableBodyRow>
			{row.getIsExpanded() ? <TableEngineTableBodyRowExpandded row={row} /> : null}
		</>
	);
}

function TableEngineTableDndBodyRows<TData extends RowData>({ table }: { readonly table: TableEngineCoreTable<TData> }): React.JSX.Element {
	const { isLoading, props } = useTableEngine();
	const pageSize = props.skeletonRowCount ?? table.atoms.pagination.get().pageSize;
	if (props.loadingMode === "skeleton" && isLoading && pageSize > 0) {
		return <TableEngineTableDndSkeletonRows table={table} pageSize={pageSize} />;
	}
	const { rows } = table.getRowModel();
	if (rows.length === 0) {
		return <TableEngineTableEmpty />;
	}
	const columnIds = getTableEngineRenderedColumnIds(table);
	return (
		<>
			{rows.map((row) => (
				<TableEngineTableDndBodyRow key={row.id} row={row} columnIds={columnIds} />
			))}
		</>
	);
}

// ── TableEngineTableDnd ───────────────────────────────────────────────────────

export interface TableEngineTableDndProps {
	/** Receives dnd-kit's drop event (with span-aware `over`); update `columnOrder` from it, e.g. with `arrayMove`. */
	readonly handleDragEnd: (event: DragEndEvent) => void;
	/** Footer rows rendered in a `<tfoot>`. */
	readonly footerContent?: React.ReactNode;
	/** Forwarded to dnd-kit's `DndContext`: screen-reader instructions and live-region announcements. */
	readonly accessibility?: DndContextProps["accessibility"];
	/** Classes for the table. */
	readonly className?: string;
}

interface TableEngineTableDndInnerProps<TData extends RowData> extends TableEngineTableDndProps {
	readonly table: TableEngineCoreTable<TData>;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

function TableEngineTableDndInner<TData extends RowData>({
	table,
	handleDragEnd,
	footerContent,
	accessibility,
	className,
	ref,
}: TableEngineTableDndInnerProps<TData>): React.JSX.Element {
	const { props } = useTableEngine();
	const { tableLayout } = props;
	const dndId = React.useId();
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const viewportRef = React.useMemo(() => mergeRefs(containerRef, ref), [ref]);
	const [isDraggingColumn, setIsDraggingColumn] = React.useState(false);
	useTableEngineDragCursor(isDraggingColumn);

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
			handleDragEnd(getTableEngineDropBesideSpans(table, event));
		},
		[handleDragEnd, table],
	);

	const accessibilityProps = useDndAccessibilityProps(accessibility);
	const mergedHeaderGroups = getTableEngineTableMergedHeaderGroups(table);
	const columnIds = getTableEngineRenderedColumnIds(table);

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
			<TableEngineTableViewport ref={viewportRef} className={cn(tableEngineDndViewportVariants({ state: isDraggingColumn ? "dragging" : "default" }), className)}>
				<TableEngineTableBase>
					<TableEngineTableHead>
						{mergedHeaderGroups.map((headerGroup, rowIndex) => {
							const renderHeader = (header: TableEngineHeader<TData>): React.JSX.Element => (
								<TableEngineTableDndHeader header={header} coveredHeaders={headerGroup.coveredHeaders.get(header.id)} key={header.id} />
							);
							return (
								<TableEngineTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
									<SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
										{/* One keyed list (fill between center and end, as the colgroup puts it), so a column
										    pinned into or out of the end group moves instead of remounting and keeps focus.
										    The fill spans every head row, so only the first renders it. */}
										{[
											...[...headerGroup.startHeaders, ...headerGroup.centerHeaders].map(renderHeader),
											...(rowIndex === 0 ? [<TableEngineTableFillHeadCell key={TABLE_ENGINE_DND_FILL_KEY} rowSpan={mergedHeaderGroups.length} />] : []),
											...headerGroup.endHeaders.map(renderHeader),
										]}
									</SortableContext>
								</TableEngineTableHeadRow>
							);
						})}
					</TableEngineTableHead>
					{tableLayout.stripped || !tableLayout.rowBorder ? <TableEngineTableRowSpacer /> : null}
					<TableEngineTableBody>
						<TableEngineTableDndFrozenGate frozen={isTableEngineColumnResizing(table)}>
							<TableEngineTableDndBodyRows table={table} />
						</TableEngineTableDndFrozenGate>
					</TableEngineTableBody>
					{footerContent === undefined || footerContent === null ? null : <TableEngineTableFoot>{footerContent}</TableEngineTableFoot>}
				</TableEngineTableBase>
			</TableEngineTableViewport>
		</DndContext>
	);
}

/** The grid table with drag-and-drop column reordering. */
export const TableEngineTableDnd = React.forwardRef<HTMLDivElement, TableEngineTableDndProps>(function TableEngineTableDnd(props, ref): React.JSX.Element {
	const { withGrid } = useTableEngine();
	const visitor = React.useMemo(
		(): TableEngineGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <TableEngineTableDndInner table={grid.table} ref={ref} {...props} />,
		}),
		[props, ref],
	);
	return withGrid(visitor);
});
