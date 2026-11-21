"use client";

// ============================================================
// components/table-engine/table-engine-table-dnd-rows.tsx
//
// The grid table with drag-and-drop ROW reordering (dnd-kit). A column def
// renders `<TableEngineTableDndRowHandle />` as the grip; mouse, touch and the
// keyboard sensor (Space to lift, arrows to move one row, Space to drop)
// reorder rows. The rows hold still while one is carried — a DragOverlay
// clone, measured off the source row, follows the pointer and a bar marks the
// seam it would land on. The grid never writes the order: `handleDragEnd`
// receives dnd-kit's event and the consumer updates its data.
// ============================================================

import { isBrowserRuntime } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { useTableEngine, type TableEngineCell, type TableEngineCoreTable, type TableEngineGridVisitor } from "./table-engine";
import {
	TableEngineTableAddRow,
	TableEngineTableBase,
	TableEngineTableBody,
	TableEngineTableBodyRow,
	TableEngineTableBodyRowCell,
	TableEngineTableBodyRowExpandded,
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
	getTableEngineTableMergedHeaderGroups,
	renderTableEngineTableHeadCellContent,
	type TableEngineHeader,
	type TableEngineRow,
} from "./table-engine-table";
import {
	TABLE_ENGINE_DND_FILL_KEY,
	TableEngineTableDndFrozenGate,
	TableEngineTableDndSkeletonRows,
	tableEngineDndViewportVariants,
	isTableEngineColumnResizing,
	useTableEngineDragCursor,
	useDndAccessibilityProps,
} from "./table-engine-table-dnd";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
	type CollisionDetection,
	type DndContextProps,
	type DragCancelEvent,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	type DragStartEvent,
	type Modifier,
	type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, type SortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RowData } from "@tanstack/react-table";
import { renderTableEngineCellContent } from "./table-engine-table-body";
import { cva } from "class-variance-authority";
import { GripHorizontalIcon } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Tree metadata attached to every sortable row, readable from
 * `active.data.current` / `over.data.current` in any drag event, so
 * cross-parent drops resolve without re-deriving the table's shape.
 */
export interface TableEngineTableDndRowData {
	readonly type: "table-engine-row";
	/** Tree depth, 0 for root rows. */
	readonly depth: number;
	/** Index within the parent's children, or within the root rows. */
	readonly index: number;
	/** Parent row id, or `null` for root rows. */
	readonly parentId: string | null;
}

/** What a row decoration renders from: the row's id and tree metadata, and its drag state. */
export interface TableEngineTableDndRowDecorationContext extends TableEngineTableDndRowData {
	readonly rowId: string;
	readonly isDragging: boolean;
	readonly isOver: boolean;
}

/**
 * Per-row render slot for drop indicators and depth guides, positioned over
 * the row (it never adds a column or shifts striping). It receives the row id
 * rather than the row object: the table body is row-type agnostic, and the
 * consumer already holds its rows by id.
 */
export type TableEngineTableDndRowDecoration = (context: TableEngineTableDndRowDecorationContext) => React.ReactNode;

/** The row's sortable activator, shared from the row to its handle. */
interface SortableRowHandleContextValue {
	readonly attributes: ReturnType<typeof useSortable>["attributes"];
	readonly listeners: ReturnType<typeof useSortable>["listeners"];
}

const SortableRowHandleContext = React.createContext<SortableRowHandleContextValue | null>(null);

// ── Handle ─────────────────────────────────────────────────────────────────

const dndRowHandleVariants = cva("size-7 opacity-70 hover:bg-transparent hover:opacity-100", {
	variants: {
		state: {
			default: "cursor-grab active:cursor-grabbing",
			disabled: "cursor-not-allowed",
		},
	},
	defaultVariants: { state: "default" },
});

export interface TableEngineTableDndRowHandleProps {
	/** Classes for the drag grip. */
	readonly className?: string;
	/**
	 * Renders the grip inert instead of withdrawing it (e.g. while the view is
	 * sorted by something other than the manual order): the gutter keeps its
	 * shape and the control reads as unavailable rather than broken.
	 */
	readonly disabled?: boolean;
	/** Announced and shown on hover while disabled; defaults to the `reorderingUnavailable` label. */
	readonly disabledLabel?: string;
}

/** The row grip a column def renders. Outside a draggable row it renders inert. */
export const TableEngineTableDndRowHandle = React.forwardRef<HTMLButtonElement, TableEngineTableDndRowHandleProps>(function TableEngineTableDndRowHandle(
	{ className, disabled = false, disabledLabel },
	ref,
): React.JSX.Element {
	const { labels } = useTableEngine();
	const context = React.useContext(SortableRowHandleContext);
	const resolvedDisabledLabel = disabledLabel ?? labels.reorderingUnavailable;

	if (context === null || disabled) {
		return (
			<Button
				ref={ref}
				variant="ghost"
				size="icon-sm"
				data-slot="table-engine-table-dnd-row-handle"
				className={cn(dndRowHandleVariants({ state: disabled ? "disabled" : "default" }), className)}
				aria-label={disabled ? resolvedDisabledLabel : labels.dragToReorderRow}
				title={disabled ? resolvedDisabledLabel : undefined}
				disabled>
				<GripHorizontalIcon aria-hidden="true" />
			</Button>
		);
	}

	return (
		<Button
			ref={ref}
			variant="ghost"
			size="icon-sm"
			data-slot="table-engine-table-dnd-row-handle"
			className={cn(dndRowHandleVariants({ state: "default" }), className)}
			{...context.attributes}
			{...context.listeners}
			aria-label={labels.dragToReorderRow}>
			<GripHorizontalIcon aria-hidden="true" />
		</Button>
	);
});

// ── Rows ───────────────────────────────────────────────────────────────────

/** Opacity of the slot the carried row left behind. */
const DRAG_SOURCE_OPACITY = 0.4;

/**
 * The rows do not move while one is carried: sliding siblings apart opens a
 * gap the height of the held row (wrong for rows of unequal height) and slides
 * the origin away. The DragOverlay clone and the drop bar say where it goes.
 * Pass `verticalListSortingStrategy` as `sortingStrategy` for the sliding feel.
 */
export const holdRowsInPlaceStrategy: SortingStrategy = () => null;

/** Which edge of a row the carried row would land on, or `null` when the row is not the drop target. */
export function getTableEngineDndRowDropEdge(enabled: boolean, activeIndex: number, index: number, overIndex: number, isDragging: boolean): "top" | "bottom" | null {
	if (!enabled || activeIndex === -1 || index !== overIndex || isDragging) {
		return null;
	}
	// Dragging down it lands after the target, dragging up before it.
	return activeIndex < overIndex ? "bottom" : "top";
}

/**
 * The carried row's style. dnd-kit's transition is deliberately dropped: a
 * transition on a `tr` transform stops it applying at all in Chrome. The
 * source row is drawn by the overlay, so the one left behind becomes a dashed
 * slot outline (inset, so the neighbouring border cannot clip it).
 */
function getDndRowStyle(transform: string | undefined, isDragging: boolean): React.CSSProperties {
	const base: React.CSSProperties = { transform, zIndex: isDragging ? 1 : 0, position: "relative", cursor: isDragging ? "grabbing" : undefined };
	return isDragging ? { ...base, opacity: DRAG_SOURCE_OPACITY, outline: "1px dashed var(--border)", outlineOffset: "-1px" } : base;
}

interface TableEngineTableDndRowProps<TData extends RowData> {
	readonly row: TableEngineRow<TData>;
	readonly renderRowDecoration?: TableEngineTableDndRowDecoration | undefined;
	readonly dropIndicator: boolean;
}

function TableEngineTableDndRow<TData extends RowData>({ row, renderRowDecoration, dropIndicator }: TableEngineTableDndRowProps<TData>): React.JSX.Element {
	const rowData = React.useMemo(
		(): TableEngineTableDndRowData => ({ type: "table-engine-row", depth: row.depth, index: row.index, parentId: row.getParentRow()?.id ?? null }),
		[row],
	);
	const { transform, setNodeRef, isDragging, isOver, attributes, listeners, index, activeIndex, overIndex } = useSortable({ id: row.id, data: rowData });
	const handleContext = React.useMemo((): SortableRowHandleContextValue => ({ attributes, listeners }), [attributes, listeners]);
	const dropEdge = getTableEngineDndRowDropEdge(dropIndicator, activeIndex, index, overIndex, isDragging);
	const style = getDndRowStyle(CSS.Transform.toString(transform), isDragging);
	const decoration = renderRowDecoration?.({ ...rowData, rowId: row.id, isDragging, isOver });
	const cells = row.getVisibleCells();
	const lastCell = cells.at(-1);

	const renderCell = (cell: TableEngineCell<TData>): React.JSX.Element => (
		<TableEngineTableBodyRowCell cell={cell} key={cell.id}>
			{renderTableEngineCellContent(cell)}
			{/* Overlays ride inside the last cell: an extra td would add a column and disturb `table-layout: fixed`. */}
			{decoration !== undefined && decoration !== null && cell === lastCell ? (
				<div aria-hidden="true" data-slot="table-engine-table-row-decoration" className="pointer-events-none absolute inset-0">
					{decoration}
				</div>
			) : null}
			{dropEdge !== null && cell === lastCell ? (
				<div aria-hidden="true" data-slot="table-engine-table-row-drop-indicator" data-edge={dropEdge} className="pointer-events-none absolute inset-0 z-20">
					<span className="absolute inset-y-0 start-0 w-0.5 bg-primary" />
				</div>
			) : null}
		</TableEngineTableBodyRowCell>
	);

	return (
		<SortableRowHandleContext.Provider value={handleContext}>
			<TableEngineTableBodyRow row={row} dndRef={setNodeRef} dndStyle={style} dndDragging={isDragging}>
				{/* One keyed list with the fill in the middle, as in the head row. */}
				{[
					...cells.filter((cell) => cell.column.getIsPinned() !== "end").map(renderCell),
					<TableEngineTableFillBodyCell key={TABLE_ENGINE_DND_FILL_KEY} />,
					...cells.filter((cell) => cell.column.getIsPinned() === "end").map(renderCell),
				]}
			</TableEngineTableBodyRow>
			{row.getIsExpanded() ? <TableEngineTableBodyRowExpandded row={row} /> : null}
		</SortableRowHandleContext.Provider>
	);
}

interface TableEngineTableDndRowsBodyProps<TData extends RowData> {
	readonly table: TableEngineCoreTable<TData>;
	readonly dataIds: readonly UniqueIdentifier[];
	readonly renderRowDecoration?: TableEngineTableDndRowDecoration | undefined;
	readonly dropIndicator: boolean;
	readonly sortingStrategy: SortingStrategy;
}

function TableEngineTableDndRowsBody<TData extends RowData>({
	table,
	dataIds,
	renderRowDecoration,
	dropIndicator,
	sortingStrategy,
}: TableEngineTableDndRowsBodyProps<TData>): React.JSX.Element {
	const { isLoading, props } = useTableEngine();
	const items = React.useMemo((): UniqueIdentifier[] => [...dataIds], [dataIds]);
	const pageSize = props.skeletonRowCount ?? table.atoms.pagination.get().pageSize;
	if (props.loadingMode === "skeleton" && isLoading && pageSize > 0) {
		return <TableEngineTableDndSkeletonRows table={table} pageSize={pageSize} />;
	}
	const { rows } = table.getRowModel();
	if (rows.length === 0) {
		return <TableEngineTableEmpty />;
	}
	return (
		<SortableContext items={items} strategy={sortingStrategy}>
			{rows.map((row) => (
				<TableEngineTableDndRow key={row.id} row={row} renderRowDecoration={renderRowDecoration} dropIndicator={dropIndicator} />
			))}
		</SortableContext>
	);
}

// ── Drag overlay ───────────────────────────────────────────────────────────

/** The carried row's geometry, measured off the source row the moment the drag starts. */
export interface TableEngineDndCarriedRow {
	readonly id: UniqueIdentifier;
	readonly width: number;
	readonly height: number;
	readonly columns: readonly number[];
	readonly padding: readonly { readonly start: string; readonly end: string }[];
}

const FILL_SLOTS: readonly string[] = ["table-engine-table-fill-body-cell", "table-engine-table-fill-head-cell"];

function isFillCell(cell: Element): boolean {
	return FILL_SLOTS.includes(cell.getAttribute("data-slot") ?? "");
}

/**
 * Measures the row being picked up. The clone lives outside the table, so it
 * is told its column widths (the data cells only — measuring the fill strip
 * in would make it wider than the row), its height, and each cell's inline
 * padding (a td cannot render narrower than its own padding).
 */
export function measureTableEngineDndRow(container: HTMLElement, id: UniqueIdentifier): TableEngineDndCarriedRow | null {
	const head = container.querySelector("thead tr");
	if (head === null) {
		return null;
	}
	const source = Array.from(container.querySelectorAll<HTMLElement>("tbody tr[data-row-id]")).find((candidate) => candidate.dataset.rowId === String(id));
	const cells = Array.from(source?.children ?? head.children).filter((cell) => !isFillCell(cell));
	const columns = cells.map((cell) => cell.getBoundingClientRect().width);
	const padding = Array.from(source?.children ?? [])
		.filter((cell) => !isFillCell(cell))
		.map((cell) => {
			const style = getComputedStyle(cell);
			return { start: style.paddingInlineStart, end: style.paddingInlineEnd };
		});
	return {
		id,
		width: columns.reduce((total, width) => total + width, 0),
		height: source?.getBoundingClientRect().height ?? 0,
		columns,
		padding,
	};
}

interface TableEngineTableDndRowOverlayProps<TData extends RowData> {
	readonly row: TableEngineRow<TData>;
	readonly carried: TableEngineDndCarriedRow;
}

function TableEngineTableDndRowOverlay<TData extends RowData>({ row, carried }: TableEngineTableDndRowOverlayProps<TData>): React.JSX.Element {
	const cells = row.getVisibleCells();
	const tableStyle = React.useMemo((): React.CSSProperties => ({ width: carried.width, tableLayout: "fixed" }), [carried.width]);
	const rowStyle = React.useMemo((): React.CSSProperties => ({ height: carried.height > 0 ? carried.height : undefined }), [carried.height]);
	const cellStyles = cells.map((cell, index): { readonly td: React.CSSProperties; readonly inner: React.CSSProperties; readonly measured: boolean } => {
		const padding = carried.padding.at(index);
		return {
			// Falls back to the column's own size so a header/cell count mismatch degrades to a real width.
			td: { width: carried.columns.at(index) ?? cell.column.getSize() },
			inner: { paddingInlineStart: padding?.start, paddingInlineEnd: padding?.end },
			measured: padding !== undefined,
		};
	});
	return (
		<table aria-hidden="true" style={tableStyle} className="pointer-events-none cursor-grabbing rounded-md border border-border bg-background shadow-lg">
			<tbody>
				<tr style={rowStyle} className="[&>td]:p-0 [&>td]:align-middle">
					{cells.map((cell, index) => {
						const styles = cellStyles.at(index);
						return (
							<td key={cell.id} style={styles?.td}>
								<div className={cn("truncate", styles?.measured === true ? undefined : "px-3")} style={styles?.inner}>
									{renderTableEngineCellContent(cell)}
								</div>
							</td>
						);
					})}
				</tr>
			</tbody>
		</table>
	);
}

function subscribeToNothing(): () => void {
	return (): void => undefined;
}

function getPortalTarget(): HTMLElement | null {
	return isBrowserRuntime() ? document.body : null;
}

function getServerPortalTarget(): HTMLElement | null {
	return null;
}

// ── TableEngineTableDndRows ───────────────────────────────────────────────────

export interface TableEngineTableDndRowsProps {
	/** Receives dnd-kit's drop event; reorder the data from `active.id` / `over.id`, e.g. with `arrayMove`. */
	readonly handleDragEnd: (event: DragEndEvent) => void;
	/** The sortable row ids, in rendered order (the rows' `getRowId` values). */
	readonly dataIds: readonly UniqueIdentifier[];
	/** Footer rows rendered in a `<tfoot>`. */
	readonly footerContent?: React.ReactNode;
	/** Overrides the default `closestCenter` strategy. */
	readonly collisionDetection?: CollisionDetection;
	/**
	 * Replaces the default `restrictToVerticalAxis` (e.g. for the horizontal
	 * gesture tree re-parenting reads). The table-container clamp is always
	 * applied after these, so a dragged row cannot leave the grid.
	 */
	readonly modifiers?: readonly Modifier[];
	/** Replaces the default hold-in-place strategy. */
	readonly sortingStrategy?: SortingStrategy;
	/** Per-row slot for drop indicators and depth guides. */
	readonly renderRowDecoration?: TableEngineTableDndRowDecoration;
	/** Draws a bar on the seam the carried row would land on. Defaults to `true`. */
	readonly dropIndicator?: boolean;
	/** Forwarded from the drag context, after the internal drag state updates. */
	readonly onDragStart?: (event: DragStartEvent) => void;
	/** Forwarded from the drag context. */
	readonly onDragMove?: (event: DragMoveEvent) => void;
	/** Forwarded from the drag context. */
	readonly onDragOver?: (event: DragOverEvent) => void;
	/** Forwarded from the drag context, after the internal drag state resets. */
	readonly onDragCancel?: (event: DragCancelEvent) => void;
	/** Forwarded to dnd-kit's `DndContext`: screen-reader instructions and live-region announcements. */
	readonly accessibility?: DndContextProps["accessibility"];
	/** Classes for the table. */
	readonly className?: string;
}

interface TableEngineTableDndRowsInnerProps<TData extends RowData> extends TableEngineTableDndRowsProps {
	readonly table: TableEngineCoreTable<TData>;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

function TableEngineTableDndRowsInner<TData extends RowData>({
	table,
	handleDragEnd,
	dataIds,
	footerContent,
	collisionDetection = closestCenter,
	modifiers,
	sortingStrategy = holdRowsInPlaceStrategy,
	renderRowDecoration,
	dropIndicator = true,
	onDragStart,
	onDragMove,
	onDragOver,
	onDragCancel,
	accessibility,
	className,
	ref,
}: TableEngineTableDndRowsInnerProps<TData>): React.JSX.Element {
	const { props } = useTableEngine();
	const { tableLayout } = props;
	const dndId = React.useId();
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const viewportRef = React.useMemo(() => mergeRefs(containerRef, ref), [ref]);
	const [carried, setCarried] = React.useState<TableEngineDndCarriedRow | null>(null);
	const isDraggingRow = carried !== null;
	useTableEngineDragCursor(isDraggingRow);
	// The overlay is portalled to the body: `position: fixed` would otherwise
	// re-anchor to any ancestor with `contain` / `transform` / `content-visibility`.
	// Null on the server so the server and first client render agree.
	const portalTarget = React.useSyncExternalStore(subscribeToNothing, getPortalTarget, getServerPortalTarget);
	const accessibilityProps = useDndAccessibilityProps(accessibility);

	const sensors = useSensors(
		useSensor(MouseSensor, {}),
		useSensor(TouchSensor, {}),
		// Keyboard reordering moves one sortable position per keypress.
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const resolvedModifiers = React.useMemo((): Modifier[] => {
		const restrictToTableContainer: Modifier = ({ transform, draggingNodeRect }) => {
			const container = containerRef.current;
			if (container === null || draggingNodeRect === null) {
				return transform;
			}
			const containerRect = container.getBoundingClientRect();
			const minX = containerRect.left - draggingNodeRect.left;
			const maxX = containerRect.right - draggingNodeRect.right;
			const minY = containerRect.top - draggingNodeRect.top;
			const maxY = containerRect.bottom - draggingNodeRect.bottom;
			return {
				...transform,
				// The horizontal rail only engages under the default axis restriction:
				// a caller that replaced it reads x (a tree resolves drop depth from it).
				x: modifiers === undefined ? Math.max(minX, Math.min(maxX, transform.x)) : transform.x,
				y: Math.max(minY, Math.min(maxY, transform.y)),
			};
		};
		return [...(modifiers ?? [restrictToVerticalAxis]), restrictToTableContainer];
	}, [modifiers]);

	const handleDragStart = React.useCallback(
		(event: DragStartEvent): void => {
			const container = containerRef.current;
			setCarried(container === null ? null : measureTableEngineDndRow(container, event.active.id));
			onDragStart?.(event);
		},
		[onDragStart],
	);
	const handleDragCancel = React.useCallback(
		(event: DragCancelEvent): void => {
			setCarried(null);
			onDragCancel?.(event);
		},
		[onDragCancel],
	);
	const handleDragEndEvent = React.useCallback(
		(event: DragEndEvent): void => {
			setCarried(null);
			handleDragEnd(event);
		},
		[handleDragEnd],
	);
	const handleDragMove = React.useCallback(
		(event: DragMoveEvent): void => {
			onDragMove?.(event);
		},
		[onDragMove],
	);
	const handleDragOver = React.useCallback(
		(event: DragOverEvent): void => {
			onDragOver?.(event);
		},
		[onDragOver],
	);

	const carriedRow = carried === null ? undefined : table.getRowModel().rows.find((row) => row.id === String(carried.id));
	const mergedHeaderGroups = getTableEngineTableMergedHeaderGroups(table);

	return (
		<DndContext
			id={dndId}
			{...accessibilityProps}
			collisionDetection={collisionDetection}
			modifiers={resolvedModifiers}
			sensors={sensors}
			onDragStart={handleDragStart}
			onDragMove={handleDragMove}
			onDragOver={handleDragOver}
			onDragCancel={handleDragCancel}
			onDragEnd={handleDragEndEvent}>
			<TableEngineTableViewport ref={viewportRef} className={cn(tableEngineDndViewportVariants({ state: isDraggingRow ? "dragging" : "default" }), className)}>
				<TableEngineTableBase>
					<TableEngineTableHead>
						{mergedHeaderGroups.map((headerGroup, rowIndex) => {
							const renderHeader = (header: TableEngineHeader<TData>): React.JSX.Element => {
								const coveredHeaders = headerGroup.coveredHeaders.get(header.id);
								const resizeHeader = getTableEngineHeadCellResizeHeader(header, coveredHeaders);
								return (
									<TableEngineTableHeadRowCell header={header} coveredHeaders={coveredHeaders} key={header.id}>
										{renderTableEngineTableHeadCellContent(header)}
										{tableLayout.columnsResizable && resizeHeader.column.getCanResize() ? <TableEngineTableHeadRowCellResize header={resizeHeader} /> : null}
									</TableEngineTableHeadRowCell>
								);
							};
							return (
								<TableEngineTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
									{/* One keyed list with the fill between center and end; only the first row renders it. */}
									{[
										...[...headerGroup.startHeaders, ...headerGroup.centerHeaders].map(renderHeader),
										...(rowIndex === 0 ? [<TableEngineTableFillHeadCell key={TABLE_ENGINE_DND_FILL_KEY} rowSpan={mergedHeaderGroups.length} />] : []),
										...headerGroup.endHeaders.map(renderHeader),
									]}
								</TableEngineTableHeadRow>
							);
						})}
					</TableEngineTableHead>
					{tableLayout.stripped || !tableLayout.rowBorder ? <TableEngineTableRowSpacer /> : null}
					<TableEngineTableBody>
						<TableEngineTableDndFrozenGate frozen={isTableEngineColumnResizing(table)}>
							<TableEngineTableDndRowsBody
								table={table}
								dataIds={dataIds}
								renderRowDecoration={renderRowDecoration}
								dropIndicator={dropIndicator}
								sortingStrategy={sortingStrategy}
							/>
						</TableEngineTableDndFrozenGate>
						{/* The same trailing rows as the plain body: the caller's own, then the "add row" button. Outside the
						    sortable list, so they never move with a drag. */}
						{props.appendRow}
						<TableEngineTableAddRow />
					</TableEngineTableBody>
					{footerContent === undefined || footerContent === null ? null : <TableEngineTableFoot>{footerContent}</TableEngineTableFoot>}
				</TableEngineTableBase>
			</TableEngineTableViewport>
			{portalTarget === null
				? null
				: createPortal(
						<DragOverlay dropAnimation={null}>
							{carried !== null && carriedRow !== undefined ? <TableEngineTableDndRowOverlay row={carriedRow} carried={carried} /> : null}
						</DragOverlay>,
						portalTarget,
					)}
		</DndContext>
	);
}

/** The grid table with drag-and-drop row reordering. */
export const TableEngineTableDndRows = React.forwardRef<HTMLDivElement, TableEngineTableDndRowsProps>(function TableEngineTableDndRows(props, ref): React.JSX.Element {
	const { withGrid } = useTableEngine();
	const visitor = React.useMemo(
		(): TableEngineGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <TableEngineTableDndRowsInner table={grid.table} ref={ref} {...props} />,
		}),
		[props, ref],
	);
	return withGrid(visitor);
});
