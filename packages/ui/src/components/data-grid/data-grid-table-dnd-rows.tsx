"use client";

// ============================================================
// components/data-grid/data-grid-table-dnd-rows.tsx
//
// The grid table with drag-and-drop ROW reordering (dnd-kit). A column def
// renders `<DataGridTableDndRowHandle />` as the grip; mouse, touch and the
// keyboard sensor (Space to lift, arrows to move one row, Space to drop)
// reorder rows. The rows hold still while one is carried — a DragOverlay
// clone, measured off the source row, follows the pointer and a bar marks the
// seam it would land on. The grid never writes the order: `handleDragEnd`
// receives dnd-kit's event and the consumer updates its data.
// ============================================================

import { isBrowserRuntime } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { useDataGrid, type DataGridCell, type DataGridCoreTable, type DataGridGridVisitor } from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridTableBase,
	DataGridTableBody,
	DataGridTableBodyRow,
	DataGridTableBodyRowCell,
	DataGridTableBodyRowExpandded,
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
	getDataGridTableMergedHeaderGroups,
	renderDataGridTableHeadCellContent,
	type DataGridHeader,
	type DataGridRow,
} from "@workspace/ui/components/data-grid/data-grid-table";
import {
	DATA_GRID_DND_FILL_KEY,
	DataGridTableDndFrozenGate,
	DataGridTableDndSkeletonRows,
	dataGridDndViewportVariants,
	isDataGridColumnResizing,
	useDataGridDragCursor,
	useDndAccessibilityProps,
} from "@workspace/ui/components/data-grid/data-grid-table-dnd";
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
import { flexRender, type RowData } from "@tanstack/react-table";
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
export interface DataGridTableDndRowData {
	readonly type: "data-grid-row";
	/** Tree depth, 0 for root rows. */
	readonly depth: number;
	/** Index within the parent's children, or within the root rows. */
	readonly index: number;
	/** Parent row id, or `null` for root rows. */
	readonly parentId: string | null;
}

/** What a row decoration renders from: the row's id and tree metadata, and its drag state. */
export interface DataGridTableDndRowDecorationContext extends DataGridTableDndRowData {
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
export type DataGridTableDndRowDecoration = (context: DataGridTableDndRowDecorationContext) => React.ReactNode;

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

export interface DataGridTableDndRowHandleProps {
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
export const DataGridTableDndRowHandle = React.forwardRef<HTMLButtonElement, DataGridTableDndRowHandleProps>(function DataGridTableDndRowHandle(
	{ className, disabled = false, disabledLabel },
	ref,
): React.JSX.Element {
	const { labels } = useDataGrid();
	const context = React.useContext(SortableRowHandleContext);
	const resolvedDisabledLabel = disabledLabel ?? labels.reorderingUnavailable;

	if (context === null || disabled) {
		return (
			<Button
				ref={ref}
				variant="ghost"
				size="icon-sm"
				data-slot="data-grid-table-dnd-row-handle"
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
			data-slot="data-grid-table-dnd-row-handle"
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
export function getDataGridDndRowDropEdge(enabled: boolean, activeIndex: number, index: number, overIndex: number, isDragging: boolean): "top" | "bottom" | null {
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

interface DataGridTableDndRowProps<TData extends RowData> {
	readonly row: DataGridRow<TData>;
	readonly renderRowDecoration?: DataGridTableDndRowDecoration | undefined;
	readonly dropIndicator: boolean;
}

function DataGridTableDndRow<TData extends RowData>({ row, renderRowDecoration, dropIndicator }: DataGridTableDndRowProps<TData>): React.JSX.Element {
	const rowData = React.useMemo(
		(): DataGridTableDndRowData => ({ type: "data-grid-row", depth: row.depth, index: row.index, parentId: row.getParentRow()?.id ?? null }),
		[row],
	);
	const { transform, setNodeRef, isDragging, isOver, attributes, listeners, index, activeIndex, overIndex } = useSortable({ id: row.id, data: rowData });
	const handleContext = React.useMemo((): SortableRowHandleContextValue => ({ attributes, listeners }), [attributes, listeners]);
	const dropEdge = getDataGridDndRowDropEdge(dropIndicator, activeIndex, index, overIndex, isDragging);
	const style = getDndRowStyle(CSS.Transform.toString(transform), isDragging);
	const decoration = renderRowDecoration?.({ ...rowData, rowId: row.id, isDragging, isOver });
	const cells = row.getVisibleCells();
	const lastCell = cells.at(-1);

	const renderCell = (cell: DataGridCell<TData>): React.JSX.Element => (
		<DataGridTableBodyRowCell cell={cell} key={cell.id}>
			{flexRender(cell.column.columnDef.cell, cell.getContext())}
			{/* Overlays ride inside the last cell: an extra td would add a column and disturb `table-layout: fixed`. */}
			{decoration !== undefined && decoration !== null && cell === lastCell ? (
				<div aria-hidden="true" data-slot="data-grid-table-row-decoration" className="pointer-events-none absolute inset-0">
					{decoration}
				</div>
			) : null}
			{dropEdge !== null && cell === lastCell ? (
				<div aria-hidden="true" data-slot="data-grid-table-row-drop-indicator" data-edge={dropEdge} className="pointer-events-none absolute inset-0 z-20">
					<span className="absolute inset-y-0 start-0 w-0.5 bg-primary" />
				</div>
			) : null}
		</DataGridTableBodyRowCell>
	);

	return (
		<SortableRowHandleContext.Provider value={handleContext}>
			<DataGridTableBodyRow row={row} dndRef={setNodeRef} dndStyle={style} dndDragging={isDragging}>
				{/* One keyed list with the fill in the middle, as in the head row. */}
				{[
					...cells.filter((cell) => cell.column.getIsPinned() !== "end").map(renderCell),
					<DataGridTableFillBodyCell key={DATA_GRID_DND_FILL_KEY} />,
					...cells.filter((cell) => cell.column.getIsPinned() === "end").map(renderCell),
				]}
			</DataGridTableBodyRow>
			{row.getIsExpanded() ? <DataGridTableBodyRowExpandded row={row} /> : null}
		</SortableRowHandleContext.Provider>
	);
}

interface DataGridTableDndRowsBodyProps<TData extends RowData> {
	readonly table: DataGridCoreTable<TData>;
	readonly dataIds: readonly UniqueIdentifier[];
	readonly renderRowDecoration?: DataGridTableDndRowDecoration | undefined;
	readonly dropIndicator: boolean;
	readonly sortingStrategy: SortingStrategy;
}

function DataGridTableDndRowsBody<TData extends RowData>({
	table,
	dataIds,
	renderRowDecoration,
	dropIndicator,
	sortingStrategy,
}: DataGridTableDndRowsBodyProps<TData>): React.JSX.Element {
	const { isLoading, props } = useDataGrid();
	const items = React.useMemo((): UniqueIdentifier[] => [...dataIds], [dataIds]);
	const { pageSize } = table.atoms.pagination.get();
	if (props.loadingMode === "skeleton" && isLoading && pageSize > 0) {
		return <DataGridTableDndSkeletonRows table={table} pageSize={pageSize} />;
	}
	const { rows } = table.getRowModel();
	if (rows.length === 0) {
		return <DataGridTableEmpty />;
	}
	return (
		<SortableContext items={items} strategy={sortingStrategy}>
			{rows.map((row) => (
				<DataGridTableDndRow key={row.id} row={row} renderRowDecoration={renderRowDecoration} dropIndicator={dropIndicator} />
			))}
		</SortableContext>
	);
}

// ── Drag overlay ───────────────────────────────────────────────────────────

/** The carried row's geometry, measured off the source row the moment the drag starts. */
export interface DataGridDndCarriedRow {
	readonly id: UniqueIdentifier;
	readonly width: number;
	readonly height: number;
	readonly columns: readonly number[];
	readonly padding: readonly { readonly start: string; readonly end: string }[];
}

const FILL_SLOTS: readonly string[] = ["data-grid-table-fill-body-cell", "data-grid-table-fill-head-cell"];

function isFillCell(cell: Element): boolean {
	return FILL_SLOTS.includes(cell.getAttribute("data-slot") ?? "");
}

/**
 * Measures the row being picked up. The clone lives outside the table, so it
 * is told its column widths (the data cells only — measuring the fill strip
 * in would make it wider than the row), its height, and each cell's inline
 * padding (a td cannot render narrower than its own padding).
 */
export function measureDataGridDndRow(container: HTMLElement, id: UniqueIdentifier): DataGridDndCarriedRow | null {
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

interface DataGridTableDndRowOverlayProps<TData extends RowData> {
	readonly row: DataGridRow<TData>;
	readonly carried: DataGridDndCarriedRow;
}

function DataGridTableDndRowOverlay<TData extends RowData>({ row, carried }: DataGridTableDndRowOverlayProps<TData>): React.JSX.Element {
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
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
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

// ── DataGridTableDndRows ───────────────────────────────────────────────────

export interface DataGridTableDndRowsProps {
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
	readonly renderRowDecoration?: DataGridTableDndRowDecoration;
	/** Draws a bar on the seam the carried row would land on. Defaults to `true`. */
	readonly dropIndicator?: boolean;
	readonly onDragStart?: (event: DragStartEvent) => void;
	readonly onDragMove?: (event: DragMoveEvent) => void;
	readonly onDragOver?: (event: DragOverEvent) => void;
	readonly onDragCancel?: (event: DragCancelEvent) => void;
	/** Forwarded to dnd-kit's `DndContext`: screen-reader instructions and live-region announcements. */
	readonly accessibility?: DndContextProps["accessibility"];
	readonly className?: string;
}

interface DataGridTableDndRowsInnerProps<TData extends RowData> extends DataGridTableDndRowsProps {
	readonly table: DataGridCoreTable<TData>;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

function DataGridTableDndRowsInner<TData extends RowData>({
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
}: DataGridTableDndRowsInnerProps<TData>): React.JSX.Element {
	const { props } = useDataGrid();
	const { tableLayout } = props;
	const dndId = React.useId();
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const viewportRef = React.useMemo(() => mergeRefs(containerRef, ref), [ref]);
	const [carried, setCarried] = React.useState<DataGridDndCarriedRow | null>(null);
	const isDraggingRow = carried !== null;
	useDataGridDragCursor(isDraggingRow);
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
			setCarried(container === null ? null : measureDataGridDndRow(container, event.active.id));
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
	const mergedHeaderGroups = getDataGridTableMergedHeaderGroups(table);

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
			<DataGridTableViewport ref={viewportRef} className={cn(dataGridDndViewportVariants({ state: isDraggingRow ? "dragging" : "default" }), className)}>
				<DataGridTableBase>
					<DataGridTableHead>
						{mergedHeaderGroups.map((headerGroup, rowIndex) => {
							const renderHeader = (header: DataGridHeader<TData>): React.JSX.Element => {
								const coveredHeaders = headerGroup.coveredHeaders.get(header.id);
								const resizeHeader = getDataGridHeadCellResizeHeader(header, coveredHeaders);
								return (
									<DataGridTableHeadRowCell header={header} coveredHeaders={coveredHeaders} key={header.id}>
										{renderDataGridTableHeadCellContent(header)}
										{tableLayout.columnsResizable && resizeHeader.column.getCanResize() ? <DataGridTableHeadRowCellResize header={resizeHeader} /> : null}
									</DataGridTableHeadRowCell>
								);
							};
							return (
								<DataGridTableHeadRow key={headerGroup.id} rowId={headerGroup.id}>
									{/* One keyed list with the fill between center and end; only the first row renders it. */}
									{[
										...[...headerGroup.startHeaders, ...headerGroup.centerHeaders].map(renderHeader),
										...(rowIndex === 0 ? [<DataGridTableFillHeadCell key={DATA_GRID_DND_FILL_KEY} rowSpan={mergedHeaderGroups.length} />] : []),
										...headerGroup.endHeaders.map(renderHeader),
									]}
								</DataGridTableHeadRow>
							);
						})}
					</DataGridTableHead>
					{tableLayout.stripped || !tableLayout.rowBorder ? <DataGridTableRowSpacer /> : null}
					<DataGridTableBody>
						<DataGridTableDndFrozenGate frozen={isDataGridColumnResizing(table)}>
							<DataGridTableDndRowsBody
								table={table}
								dataIds={dataIds}
								renderRowDecoration={renderRowDecoration}
								dropIndicator={dropIndicator}
								sortingStrategy={sortingStrategy}
							/>
						</DataGridTableDndFrozenGate>
					</DataGridTableBody>
					{footerContent === undefined || footerContent === null ? null : <DataGridTableFoot>{footerContent}</DataGridTableFoot>}
				</DataGridTableBase>
			</DataGridTableViewport>
			{portalTarget === null
				? null
				: createPortal(
						<DragOverlay dropAnimation={null}>
							{carried !== null && carriedRow !== undefined ? <DataGridTableDndRowOverlay row={carriedRow} carried={carried} /> : null}
						</DragOverlay>,
						portalTarget,
					)}
		</DndContext>
	);
}

/** The grid table with drag-and-drop row reordering. */
export const DataGridTableDndRows = React.forwardRef<HTMLDivElement, DataGridTableDndRowsProps>(function DataGridTableDndRows(props, ref): React.JSX.Element {
	const { withGrid } = useDataGrid();
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <DataGridTableDndRowsInner table={grid.table} ref={ref} {...props} />,
		}),
		[props, ref],
	);
	return withGrid(visitor);
});
