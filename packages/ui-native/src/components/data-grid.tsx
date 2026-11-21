// The web kit's `DataGrid` for a phone: a low-level grid over a TanStack table the caller owns
// (`useTable({ features: dataGridFeatures, … })`, its state controlled or not, its data). `DataGrid` publishes one
// table, its layout and its copy to the parts under it: `DataGridTable` draws it, and `DataGridPagination`,
// `DataGridColumnHeader`, `DataGridColumnVisibility` and the row controls (`DataGridRowSelect`, `DataGridRowExpand`,
// `DataGridRowPin`, `DataGridRowHandle`) are in `data-grid-parts.tsx`. The grid never writes data: edits reach the
// caller through `onCellsChange`, a moved row through `onRowReorder`.
//
// On a phone the grid scrolls sideways; columns pinned to either edge stay put (their cells ride the scroll offset on
// the UI thread). A tap on a row reports it; with `cellSelection` a tap picks a cell and a long press stretches the
// pick into a block, and a bar offers copy, paste, fill down or right, clear and edit. Headers drag their width
// (`columnsResizable`) and their place (`columnsDraggable`) with a finger, and screen readers get the same as actions.
//
// One React context serves every row type: TanStack declares `TData` invariant, so the context carries the row-type
// free half of the grid plus `withGrid`, a visitor that hands the typed table to a generic function (no cast).

import { flexRender, type CellSelectionBounds, type Header, type RowData, type TableState } from "@tanstack/react-table";
import { isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import { isDataTableUtilityColumnId, parseDataGridClipboardText, tileDataGridClipboardBlock } from "@workspace/ui-kit-logic";
import { cva } from "class-variance-authority";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import {
	FlatList,
	PanResponder,
	Pressable,
	Text,
	View,
	type AccessibilityActionEvent,
	type LayoutChangeEvent,
	type ListRenderItemInfo,
	type ViewInstance,
	type ViewStyle,
} from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { cn } from "../lib/cn";
import {
	clampDataGridColumnSize,
	dataGridCellsChange,
	dataGridCellText,
	dataGridColumnLabel,
	dataGridColumnWindow,
	dataGridCopyDetails,
	dataGridDisplayColumns,
	dataGridDropIndex,
	dataGridMovedColumnOrder,
	dataGridValueText,
	DEFAULT_DATA_GRID_LABELS,
	isDataGridCellWritable,
	resolveDataGridLayout,
	spreadDataGridSpareWidth,
	usesDefaultDataGridCell,
	usesDefaultDataGridHeader,
	type DataGridCellsChangeDetails,
	type DataGridColumn,
	type DataGridCopyDetails,
	type DataGridFeatures,
	type DataGridResolvedTableLayout,
	type DataGridRow,
	type DataGridTableInstance,
	type DataGridTableLayout,
	type NativeDataGridLabels,
} from "../lib/data-grid";
import { memo } from "../lib/generic-memo";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { Icon } from "./icon";
import { Input } from "./input";
import { Skeleton } from "./skeleton";
import { Sortable, SortableItem, type SortableMove } from "./sortable";
import { Spinner } from "./spinner";

// ── Context ────────────────────────────────────────────────────────────────

/** A row moved by dragging: its id, where it was and where it went (indexes among the drawn rows). */
export interface DataGridRowMove {
	readonly rowId: string;
	readonly from: number;
	readonly to: number;
}

/** The typed half of the grid, handed to a visitor. */
export interface DataGridTypedGrid<TData extends RowData> {
	readonly table: DataGridTableInstance<TData>;
	readonly onRowPress: ((row: TData) => void) | undefined;
	readonly onCellsChange: ((details: DataGridCellsChangeDetails<TData>) => void) | undefined;
}

/** Works with a grid of any row type. */
export interface DataGridGridVisitor<TResult> {
	visit<TData extends RowData>(grid: DataGridTypedGrid<TData>): TResult;
}

/** How the grid shows that it is loading: placeholder rows (`skeleton`) or a spinner over the rows. */
export type DataGridLoadingMode = "skeleton" | "spinner";

export interface DataGridContextValue {
	readonly layout: DataGridResolvedTableLayout;
	readonly labels: NativeDataGridLabels;
	readonly recordCount: number;
	readonly isLoading: boolean;
	readonly loadingMode: DataGridLoadingMode;
	readonly loadingMessage: string;
	readonly emptyMessage: React.ReactNode;
	readonly onRowReorder: ((move: DataGridRowMove) => void) | undefined;
	readonly onCellsCopy: ((details: DataGridCopyDetails) => void) | undefined;
	readonly readClipboard: (() => Promise<string>) | undefined;
	/** The table's state when the value was made: a new state is a new value, so the parts draw it. */
	readonly tableState: Readonly<TableState<DataGridFeatures>>;
	readonly withGrid: <TResult>(visitor: DataGridGridVisitor<TResult>) => TResult;
}

const DataGridContext = React.createContext<DataGridContextValue | null>(null);

/** The grid a part sits in; a part outside `DataGrid` is a mistake. */
export function useDataGrid(): DataGridContextValue {
	const value = React.useContext(DataGridContext);
	if (value === null) {
		throw new Error("Data grid parts must sit inside <DataGrid>.");
	}
	return value;
}

export const dataGridVariants = cva("w-full");

export interface DataGridProps<TData extends RowData> {
	/** The grid's root view (a prop, React 19: the root keeps its row type, which `forwardRef` would erase). */
	readonly ref?: React.Ref<ViewInstance> | undefined;
	/** The caller's table: `useTable({ features: dataGridFeatures, columns, data, … })`. */
	readonly table: DataGridTableInstance<TData>;
	/** Every record (all pages; the server's total for a server-side grid), for the pager. */
	readonly recordCount: number;
	readonly children?: React.ReactNode;
	readonly tableLayout?: DataGridTableLayout | undefined;
	readonly labels?: Partial<NativeDataGridLabels> | undefined;
	readonly isLoading?: boolean | undefined;
	readonly loadingMode?: DataGridLoadingMode | undefined;
	readonly loadingMessage?: string | undefined;
	readonly emptyMessage?: React.ReactNode;
	/** A row was tapped. */
	readonly onRowPress?: ((row: TData) => void) | undefined;
	/** A row was dragged to a new place (`rowsDraggable`): the caller reorders its data. */
	readonly onRowReorder?: ((move: DataGridRowMove) => void) | undefined;
	/** Cells to write (paste, fill, clear, edit): the caller writes them to its rows. */
	readonly onCellsChange?: ((details: DataGridCellsChangeDetails<TData>) => void) | undefined;
	/** The selection as text, to put on the clipboard (the kit never touches it: expo-clipboard's `setStringAsync`). */
	readonly onCellsCopy?: ((details: DataGridCopyDetails) => void) | undefined;
	/** Reads the clipboard for Paste (expo-clipboard's `getStringAsync`); without it there is no Paste. */
	readonly readClipboard?: (() => Promise<string>) | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The grid: holds the caller's table for its parts (`DataGridContainer`, `DataGridTable`, the pager…) inside it. */
function DataGridRoot<TData extends RowData>({
	ref,
	table,
	recordCount,
	children,
	tableLayout,
	labels,
	isLoading = false,
	loadingMode = "skeleton",
	loadingMessage,
	emptyMessage,
	onRowPress,
	onRowReorder,
	onCellsChange,
	onCellsCopy,
	readClipboard,
	className,
	testID,
}: DataGridProps<TData>): React.JSX.Element {
	const tableState = table.state;
	const value = React.useMemo((): DataGridContextValue => {
		const copy: NativeDataGridLabels = { ...DEFAULT_DATA_GRID_LABELS, ...labels };
		const typed: DataGridTypedGrid<TData> = { table, onRowPress, onCellsChange };
		return {
			layout: resolveDataGridLayout(tableLayout),
			labels: copy,
			recordCount,
			isLoading,
			loadingMode,
			loadingMessage: loadingMessage ?? copy.loading,
			emptyMessage: emptyMessage ?? copy.empty,
			onRowReorder,
			onCellsCopy,
			readClipboard,
			tableState,
			withGrid: <TResult,>(visitor: DataGridGridVisitor<TResult>): TResult => visitor.visit(typed),
		};
	}, [
		emptyMessage,
		isLoading,
		labels,
		loadingMessage,
		loadingMode,
		onCellsChange,
		onCellsCopy,
		onRowPress,
		onRowReorder,
		readClipboard,
		recordCount,
		table,
		tableLayout,
		tableState,
	]);
	return (
		<DataGridContext.Provider value={value}>
			<View ref={ref} testID={testID} className={cn(dataGridVariants(), className)}>
				{children}
			</View>
		</DataGridContext.Provider>
	);
}

export const DataGrid = memo(DataGridRoot);

// ── Container ──────────────────────────────────────────────────────────────

export const dataGridContainerVariants = cva("w-full overflow-hidden", {
	variants: { border: { true: "rounded-lg border border-border", false: "" } },
	defaultVariants: { border: true },
});

export interface DataGridContainerProps {
	readonly children: React.ReactNode;
	/** A rounded border around the grid. Default `true`. */
	readonly border?: boolean | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The grid's frame: a rounded border, its contents clipped to it. */
export const DataGridContainer = React.memo(
	React.forwardRef<ViewInstance, DataGridContainerProps>(function DataGridContainer({ children, border, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(dataGridContainerVariants({ border }), className)} testID={testID}>
				{children}
			</View>
		);
	}),
);

// ── Styles ─────────────────────────────────────────────────────────────────

export const dataGridRowVariants = cva("flex-row bg-background", {
	variants: {
		border: { true: "border-b border-border", false: "" },
		striped: { true: "bg-muted/40", false: "" },
		rounded: { true: "rounded-lg", false: "" },
		selected: { true: "bg-primary/5", false: "" },
	},
	defaultVariants: { border: true, striped: false, rounded: false, selected: false },
});

export const dataGridCellVariants = cva("justify-center", {
	variants: {
		dense: { true: "min-h-9 px-2.5 py-1.5", false: "min-h-11 px-3 py-2.5" },
		border: { true: "border-r border-border", false: "" },
		align: { start: "items-start", center: "items-center", end: "items-end" },
		selected: { true: "bg-primary/10", false: "" },
		focused: { true: "border-2 border-primary", false: "" },
	},
	defaultVariants: { dense: false, border: false, align: "start", selected: false, focused: false },
});

export const dataGridHeaderRowVariants = cva("flex-row bg-background", {
	variants: {
		background: { true: "bg-muted/50", false: "" },
		border: { true: "border-b border-border", false: "" },
	},
	defaultVariants: { background: false, border: true },
});

/** The text a cell or header draws when its renderer gives back a plain string or number. */
const CELL_TEXT = "text-label font-sans text-foreground";
const HEADER_TEXT = "text-caption font-sans-medium text-muted-foreground";

/** The width a column gets when it has no size of its own (TanStack's default). */
const DEFAULT_MIN_COLUMN_SIZE = 48;
const DEFAULT_MAX_COLUMN_SIZE = 640;
/** One screen-reader step of a column's width. */
const RESIZE_STEP = 16;
/** How far a finger moves before a press on a header becomes a drag. */
const DRAG_SLOP = 6;
/** How many columns past the edges a virtualised row draws. */
const COLUMN_OVERSCAN = 2;
/** Placeholder rows when the table has no page size. */
const DEFAULT_SKELETON_ROWS = 5;
/** How often the scroll offset reaches the JS thread for virtualised columns (ms). */
const SCROLL_EVENT_THROTTLE_MS = 16;
/** How close to the end of a virtualised list the next page is asked for (a fraction of its height). */
const END_REACHED_THRESHOLD = 0.5;

/** A renderer's result as something a View can hold: text and numbers in a `Text`. */
function drawable(node: React.ReactNode, className: string): React.ReactNode {
	return isStringPrimitive(node) || isNumberPrimitive(node) ? (
		<Text numberOfLines={1} className={className}>
			{node}
		</Text>
	) : (
		node
	);
}

// ── Column geometry ─────────────────────────────────────────────────────────

/** Where each drawn column sits: its width, and which block it is in. */
interface ColumnSlot<TData extends RowData> {
	readonly column: DataGridColumn<TData>;
	readonly width: number;
	readonly region: "start" | "center" | "end";
}

interface GridGeometry<TData extends RowData> {
	readonly start: readonly ColumnSlot<TData>[];
	readonly center: readonly ColumnSlot<TData>[];
	readonly end: readonly ColumnSlot<TData>[];
	readonly total: number;
}

/**
 * Each drawn column's slot. The viewport's spare width is shared so the grid always spans it: among the
 * `meta.autoSize` columns when there are any, else among every unpinned data column (never a utility column), each in
 * proportion to its own width, so the columns spread out evenly and keep the widths they were given relative to each
 * other. Pinned columns keep their size.
 */
function gridGeometry<TData extends RowData>(table: DataGridTableInstance<TData>, viewport: number): GridGeometry<TData> {
	const slot =
		(region: ColumnSlot<TData>["region"]) =>
		(column: DataGridColumn<TData>): ColumnSlot<TData> => ({ column, width: column.getSize(), region });
	const start = table.getStartVisibleLeafColumns().map(slot("start"));
	const center = table.getCenterVisibleLeafColumns().map(slot("center"));
	const end = table.getEndVisibleLeafColumns().map(slot("end"));
	const hasAutoSize = [...start, ...center, ...end].some((entry): boolean => entry.column.columnDef.meta?.autoSize === true);
	const grows = (entry: ColumnSlot<TData>): boolean =>
		hasAutoSize ? entry.column.columnDef.meta?.autoSize === true : entry.region === "center" && !isDataTableUtilityColumnId(entry.column.id);
	const all = [...start, ...center, ...end];
	const widths = spreadDataGridSpareWidth(
		all.map((entry) => ({ width: entry.width, grows: grows(entry) })),
		viewport,
	);
	const grownWidth = new Map(all.map((entry, position): [ColumnSlot<TData>, number] => [entry, widths.at(position) ?? entry.width]));
	const grow = (entry: ColumnSlot<TData>): ColumnSlot<TData> => ({ ...entry, width: grownWidth.get(entry) ?? entry.width });
	const grown = { start: start.map(grow), center: center.map(grow), end: end.map(grow) };
	const total = [...grown.start, ...grown.center, ...grown.end].reduce((sum: number, entry): number => sum + entry.width, 0);
	return { ...grown, total };
}

/** The style that places a column: a fixed width, or a share of the width under `width: "auto"`. */
function slotStyle(width: number, auto: boolean): { readonly width: number } | { readonly flexGrow: number; readonly flexBasis: number } {
	return auto ? { flexGrow: width, flexBasis: 0 } : { width };
}

type PinStyle = ReturnType<typeof useAnimatedStyle<ViewStyle>>;

/** The pinned blocks' offsets: the start block rides the scroll; the end block rides it less the overflow. */
interface PinnedStyles {
	readonly start: PinStyle;
	readonly end: PinStyle;
	/** A line as wide as the view (an expanded row, the empty message), kept in view as the columns scroll. */
	readonly span: PinStyle;
}

function usePinnedStyles(scrollX: SharedValue<number>, overflow: number, viewport: number, auto: boolean): PinnedStyles {
	const start = useAnimatedStyle((): ViewStyle => ({ transform: [{ translateX: scrollX.value }], zIndex: 1 }));
	const end = useAnimatedStyle((): ViewStyle => ({ transform: [{ translateX: scrollX.value - overflow }], zIndex: 1 }));
	// Under an auto layout nothing scrolls sideways: the line only takes the view's width.
	const span = useAnimatedStyle((): ViewStyle => ({ width: viewport, transform: [{ translateX: auto ? 0 : scrollX.value }] }));
	return { start, end, span };
}

// ── Header ─────────────────────────────────────────────────────────────────

interface ResizeHandleProps<TData extends RowData> {
	readonly table: DataGridTableInstance<TData>;
	readonly column: DataGridColumn<TData>;
	readonly label: string;
}

const RESIZE_ACTIONS: readonly { readonly name: string }[] = [{ name: "increment" }, { name: "decrement" }];

/** The strip at a header's end: drag it to set the column's width; screen readers step it. */
function ResizeHandle<TData extends RowData>({ table, column, label }: ResizeHandleProps<TData>): React.JSX.Element {
	const min = column.columnDef.minSize ?? DEFAULT_MIN_COLUMN_SIZE;
	// TanStack's own default is "no limit" (the largest safe integer): a phone column stops at the kit's cap instead.
	const max = column.columnDef.maxSize === undefined || column.columnDef.maxSize === Number.MAX_SAFE_INTEGER ? DEFAULT_MAX_COLUMN_SIZE : column.columnDef.maxSize;
	const size = column.getSize();
	const setSize = React.useCallback(
		(next: number): void => {
			table.setColumnSizing((sizing) => ({ ...sizing, [column.id]: clampDataGridColumnSize(next, min, max) }));
		},
		[column.id, max, min, table],
	);
	// The width the drag started from: each move adds its distance to it.
	const startSize = useSharedValue(0);
	const responder = React.useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: (): boolean => true,
				onPanResponderGrant: (): void => {
					startSize.set(column.getSize());
				},
				onPanResponderMove: (_, gesture): void => {
					setSize(startSize.get() + gesture.dx);
				},
			}),
		[column, setSize, startSize],
	);
	const onAction = React.useCallback(
		(event: AccessibilityActionEvent): void => {
			setSize(column.getSize() + (event.nativeEvent.actionName === "increment" ? RESIZE_STEP : -RESIZE_STEP));
		},
		[column, setSize],
	);
	const accessibilityValue = React.useMemo(() => ({ min, max, now: size }), [max, min, size]);
	return (
		<View
			{...responder.panHandlers}
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel={label}
			accessibilityValue={accessibilityValue}
			accessibilityActions={RESIZE_ACTIONS}
			onAccessibilityAction={onAction}
			hitSlop={DRAG_SLOP}
			className="absolute top-1 right-0 bottom-1 w-1.5 items-center justify-center"
			testID={`data-grid-resize-${column.id}`}>
			<View className="h-4 w-0.5 rounded-full bg-border" />
		</View>
	);
}

interface HeaderCellProps<TData extends RowData> {
	readonly table: DataGridTableInstance<TData>;
	readonly header: Header<DataGridFeatures, TData>;
	readonly slot: ColumnSlot<TData>;
	readonly context: DataGridContextValue;
	readonly auto: boolean;
	readonly onDragMove: (columnId: string, dx: number) => void;
	readonly onDragEnd: (columnId: string, dx: number) => void;
	readonly dragDx: number;
}

/** A column's header: what its definition draws, a width handle, and (when columns drag) a drag along the header row. */
function HeaderCell<TData extends RowData>({ table, header, slot, context, auto, onDragMove, onDragEnd, dragDx }: HeaderCellProps<TData>): React.JSX.Element {
	const { column } = slot;
	const { layout, labels } = context;
	const align = column.columnDef.meta?.align ?? "start";
	const draggable = layout.columnsDraggable && slot.region === "center" && !auto;
	const style = React.useMemo(() => ({ ...slotStyle(slot.width, auto), transform: [{ translateX: dragDx }], zIndex: dragDx === 0 ? 0 : 2 }), [auto, dragDx, slot.width]);
	return (
		<View
			style={style}
			className={cn(dataGridCellVariants({ dense: layout.dense, border: layout.cellBorder, align }), "flex-row items-center gap-1", dragDx === 0 ? "" : "bg-muted")}>
			{draggable ? <ColumnGrip table={table} column={column} labels={labels} onDragMove={onDragMove} onDragEnd={onDragEnd} /> : null}
			<View className="min-w-0 flex-1">
				{usesDefaultDataGridHeader(column) ? drawable(column.id, HEADER_TEXT) : drawable(flexRender(column.columnDef.header, header.getContext()), HEADER_TEXT)}
			</View>
			{layout.columnsResizable && column.getCanResize() && !auto ? (
				<ResizeHandle table={table} column={column} label={labels.resizeColumn(dataGridColumnLabel(column))} />
			) : null}
		</View>
	);
}

interface ColumnGripProps<TData extends RowData> {
	readonly table: DataGridTableInstance<TData>;
	readonly column: DataGridColumn<TData>;
	readonly labels: NativeDataGridLabels;
	readonly onDragMove: (columnId: string, dx: number) => void;
	readonly onDragEnd: (columnId: string, dx: number) => void;
}

/** A column's grip: drag it along the header row to move the column; screen readers move it a place at a time. */
function ColumnGrip<TData extends RowData>({ table, column, labels, onDragMove, onDragEnd }: ColumnGripProps<TData>): React.JSX.Element {
	const responder = React.useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: (): boolean => true,
				onPanResponderTerminationRequest: (): boolean => false,
				onPanResponderMove: (_, gesture): void => {
					onDragMove(column.id, gesture.dx);
				},
				onPanResponderRelease: (_, gesture): void => {
					onDragEnd(column.id, gesture.dx);
				},
				onPanResponderTerminate: (): void => {
					onDragMove(column.id, 0);
				},
			}),
		[column.id, onDragEnd, onDragMove],
	);
	const actions = React.useMemo(
		() => [
			{ name: "moveStart", label: labels.moveColumnStart },
			{ name: "moveEnd", label: labels.moveColumnEnd },
		],
		[labels.moveColumnEnd, labels.moveColumnStart],
	);
	const onAction = React.useCallback(
		(event: AccessibilityActionEvent): void => {
			const order = dataGridMovedColumnOrder(table, column.id, event.nativeEvent.actionName === "moveStart" ? -1 : 1);
			if (order !== null) {
				table.setColumnOrder([...order]);
			}
		},
		[column.id, table],
	);
	return (
		<View
			{...responder.panHandlers}
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel={`${labels.dragToReorder}: ${dataGridColumnLabel(column)}`}
			accessibilityActions={actions}
			onAccessibilityAction={onAction}
			hitSlop={DRAG_SLOP}
			className="-ml-1 size-5 items-center justify-center">
			<Icon icon={GripVerticalIcon} size="xs" colorClassName="accent-muted-foreground" />
		</View>
	);
}

// ── Body ───────────────────────────────────────────────────────────────────

interface SelectionHandlers {
	readonly onSelect: (rowId: string, columnId: string) => void;
	readonly onExtend: (rowId: string, columnId: string) => void;
}

interface BodyCellProps<TData extends RowData> {
	readonly row: DataGridRow<TData>;
	readonly slot: ColumnSlot<TData>;
	readonly layout: DataGridResolvedTableLayout;
	readonly auto: boolean;
	readonly selection: SelectionHandlers | undefined;
	readonly hint: string;
}

/** One cell: what its column draws; with cell selection, a button that picks it (a long press stretches the pick). */
function BodyCell<TData extends RowData>({ row, slot, layout, auto, selection, hint }: BodyCellProps<TData>): React.JSX.Element {
	const { column } = slot;
	const cell = row.getAllCells().find((candidate): boolean => candidate.column.id === column.id);
	const style = React.useMemo(() => slotStyle(slot.width, auto), [auto, slot.width]);
	const align = column.columnDef.meta?.align ?? "start";
	const selected = selection !== undefined && (cell?.getIsSelected() ?? false);
	const focused = selection !== undefined && (cell?.getIsFocused() ?? false);
	const select = React.useCallback((): void => {
		selection?.onSelect(row.id, column.id);
	}, [column.id, row.id, selection]);
	const extend = React.useCallback((): void => {
		selection?.onExtend(row.id, column.id);
	}, [column.id, row.id, selection]);
	const className = dataGridCellVariants({ dense: layout.dense, border: layout.cellBorder, align, selected: selected && !focused, focused });
	const content =
		cell === undefined
			? null
			: usesDefaultDataGridCell(column)
				? drawable(dataGridValueText(cell.getValue()), CELL_TEXT)
				: drawable(flexRender(column.columnDef.cell, cell.getContext()), CELL_TEXT);
	if (selection === undefined) {
		return (
			<View style={style} className={className}>
				{content}
			</View>
		);
	}
	const accessibilityState = { selected };
	return (
		<Pressable
			style={style}
			className={className}
			onPress={select}
			onLongPress={extend}
			accessibilityRole="button"
			accessibilityLabel={`${dataGridColumnLabel(column)}, ${dataGridCellText(column, row)}`}
			accessibilityState={accessibilityState}
			accessibilityHint={hint}>
			{content}
		</Pressable>
	);
}

interface RowProps<TData extends RowData> {
	readonly row: DataGridRow<TData>;
	readonly index: number;
	readonly geometry: GridGeometry<TData>;
	readonly context: DataGridContextValue;
	readonly pinned: PinnedStyles;
	readonly auto: boolean;
	readonly window: { readonly start: number; readonly end: number; readonly before: number; readonly after: number } | undefined;
	readonly onRowPress: ((row: TData) => void) | undefined;
	readonly selection: SelectionHandlers | undefined;
}

/** One row: the start block, the scrolling cells (only the window when columns are virtualised), the end block, and its detail when expanded. */
function GridRow<TData extends RowData>({ row, index, geometry, context, pinned, auto, window, onRowPress, selection }: RowProps<TData>): React.JSX.Element {
	const { layout } = context;
	const press = React.useCallback((): void => {
		onRowPress?.(row.original);
	}, [onRowPress, row]);
	const cellOf = (slot: ColumnSlot<TData>): React.JSX.Element => (
		<BodyCell key={slot.column.id} row={row} slot={slot} layout={layout} auto={auto} selection={selection} hint={context.labels.extendSelectionHint} />
	);
	const center = window === undefined ? geometry.center : geometry.center.slice(window.start, window.end + 1);
	const beforeStyle = React.useMemo(() => ({ width: window?.before ?? 0 }), [window?.before]);
	const afterStyle = React.useMemo(() => ({ width: window?.after ?? 0 }), [window?.after]);
	const expanded = row.getIsExpanded();
	const detail = expanded
		? row
				.getVisibleCells()
				.find((cell): boolean => cell.column.columnDef.meta?.expandedContent !== undefined)
				?.column.columnDef.meta?.expandedContent?.(row.original)
		: undefined;
	const rowClassName = dataGridRowVariants({
		border: layout.rowBorder,
		striped: layout.stripped && index % 2 === 1,
		rounded: layout.rowRounded,
		selected: row.getIsSelected(),
	});
	const cells = (
		<>
			{geometry.start.length === 0 ? null : (
				<Animated.View style={auto ? undefined : pinned.start} className={cn("flex-row bg-background", rowClassName)}>
					{geometry.start.map(cellOf)}
				</Animated.View>
			)}
			{window === undefined || window.before === 0 ? null : <View style={beforeStyle} />}
			{center.map(cellOf)}
			{window === undefined || window.after === 0 ? null : <View style={afterStyle} />}
			{geometry.end.length === 0 ? null : (
				<Animated.View style={auto ? undefined : pinned.end} className={cn("flex-row bg-background", rowClassName)}>
					{geometry.end.map(cellOf)}
				</Animated.View>
			)}
		</>
	);
	return (
		<View>
			{onRowPress === undefined ? (
				<View className={rowClassName}>{cells}</View>
			) : (
				<Pressable onPress={press} className={rowClassName} accessibilityRole="button" accessibilityLabel={rowName(row, geometry)}>
					{cells}
				</Pressable>
			)}
			{detail === undefined || detail === null ? null : (
				<Animated.View style={pinned.span} className="border-b border-border bg-muted/30">
					{drawable(detail, CELL_TEXT)}
				</Animated.View>
			)}
		</View>
	);
}

/** A row's name for a screen reader: its first drawn column's value. */
function rowName<TData extends RowData>(row: DataGridRow<TData>, geometry: GridGeometry<TData>): string {
	const first = [...geometry.start, ...geometry.center, ...geometry.end].find((slot): boolean => slot.column.accessorFn !== undefined);
	return first === undefined ? row.id : dataGridCellText(first.column, row);
}

// ── Footer ─────────────────────────────────────────────────────────────────

/** One footer cell: what it draws, and how many columns it spans (default 1). */
export interface DataGridFootCell {
	readonly key: string;
	readonly span?: number | undefined;
	readonly content?: React.ReactNode;
	readonly align?: "start" | "center" | "end" | undefined;
}

/** A footer row: its cells, left to right, spanning the drawn columns. */
export interface DataGridFootRow {
	readonly key: string;
	readonly cells: readonly DataGridFootCell[];
}

interface FootRowProps<TData extends RowData> {
	readonly row: DataGridFootRow;
	readonly geometry: GridGeometry<TData>;
	readonly layout: DataGridResolvedTableLayout;
	readonly auto: boolean;
}

/** A footer row: each cell as wide as the columns it spans. */
function FootRow<TData extends RowData>({ row, geometry, layout, auto }: FootRowProps<TData>): React.JSX.Element {
	const slots = [...geometry.start, ...geometry.center, ...geometry.end];
	const placed = row.cells.reduce<{ readonly next: number; readonly cells: readonly { readonly cell: DataGridFootCell; readonly width: number }[] }>(
		(state, cell) => {
			const span = Math.max(1, cell.span ?? 1);
			const width = slots.slice(state.next, state.next + span).reduce((sum: number, slot): number => sum + slot.width, 0);
			return { next: state.next + span, cells: [...state.cells, { cell, width }] };
		},
		{ next: 0, cells: [] },
	);
	return (
		<View className={cn("flex-row border-t border-border", layout.footerBackground ? "bg-muted/50" : "bg-background")}>
			{placed.cells.map(({ cell, width }): React.JSX.Element => (
				<FootCell key={cell.key} cell={cell} width={width} layout={layout} auto={auto} />
			))}
		</View>
	);
}

function FootCell({
	cell,
	width,
	layout,
	auto,
}: {
	readonly cell: DataGridFootCell;
	readonly width: number;
	readonly layout: DataGridResolvedTableLayout;
	readonly auto: boolean;
}): React.JSX.Element {
	const style = React.useMemo(() => slotStyle(width, auto), [auto, width]);
	return (
		<View style={style} className={dataGridCellVariants({ dense: layout.dense, border: layout.cellBorder, align: cell.align ?? "start" })}>
			{drawable(cell.content, cn(CELL_TEXT, "font-sans-medium"))}
		</View>
	);
}

// ── Cell selection ─────────────────────────────────────────────────────────

interface SelectionBarProps<TData extends RowData> {
	readonly grid: DataGridTypedGrid<TData>;
	readonly context: DataGridContextValue;
	readonly onEdit: () => void;
}

/** The bar over a cell selection: how many cells, and what the caller lets people do with them. */
function SelectionBar<TData extends RowData>({ grid, context, onEdit }: SelectionBarProps<TData>): React.JSX.Element | null {
	const { table, onCellsChange } = grid;
	const { labels, onCellsCopy, readClipboard } = context;
	const done = React.useCallback((): void => {
		table.setCellSelection([]);
	}, [table]);
	const count = table.getSelectedCellCount();
	const bounds = table.getCellSelectionBounds().at(0);
	if (count === 0 || bounds === undefined) {
		return null;
	}
	const focused = table.getFocusedCell();
	const editable = focused !== undefined && isDataGridCellWritable(focused.column, focused.row);
	return (
		<View accessibilityLiveRegion="polite" className="flex-row flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
			<Text className="text-caption font-sans-medium mr-auto text-foreground">{labels.selectionBarCount(count)}</Text>
			{onCellsCopy === undefined ? null : <CopyButton table={table} bounds={bounds} onCopy={onCellsCopy} label={labels.copyCells} />}
			{onCellsChange === undefined ? null : (
				<EditActions table={table} bounds={bounds} onChange={onCellsChange} readClipboard={readClipboard} labels={labels} editable={editable} onEdit={onEdit} />
			)}
			<Button label={labels.selectionBarClear} accessibilityLabel={labels.clearSelection} variant="ghost" size="xs" onPress={done} />
		</View>
	);
}

interface SelectionTarget<TData extends RowData> {
	readonly table: DataGridTableInstance<TData>;
	readonly bounds: CellSelectionBounds;
}

function CopyButton<TData extends RowData>({
	table,
	bounds,
	onCopy,
	label,
}: SelectionTarget<TData> & { readonly onCopy: (details: DataGridCopyDetails) => void; readonly label: string }): React.JSX.Element {
	const copy = React.useCallback((): void => {
		onCopy(dataGridCopyDetails(table, bounds));
	}, [bounds, onCopy, table]);
	return <Button label={label} variant="outline" size="xs" onPress={copy} />;
}

/** A block of text written over the selection, repeated to fill it. */
function tiled(block: readonly (readonly string[])[], bounds: CellSelectionBounds): string[][] {
	return tileDataGridClipboardBlock(block, bounds.maxRowIndex - bounds.minRowIndex + 1, bounds.maxColumnIndex - bounds.minColumnIndex + 1);
}

interface EditActionsProps<TData extends RowData> extends SelectionTarget<TData> {
	readonly onChange: (details: DataGridCellsChangeDetails<TData>) => void;
	readonly readClipboard: (() => Promise<string>) | undefined;
	readonly labels: NativeDataGridLabels;
	readonly editable: boolean;
	readonly onEdit: () => void;
}

/** The writes: paste (with a clipboard reader), fill down or right, clear, and edit the focused cell. */
function EditActions<TData extends RowData>({ table, bounds, onChange, readClipboard, labels, editable, onEdit }: EditActionsProps<TData>): React.JSX.Element {
	const fill = React.useCallback(
		(direction: "down" | "right"): void => {
			const source = dataGridCopyDetails(table, direction === "down" ? { ...bounds, maxRowIndex: bounds.minRowIndex } : { ...bounds, maxColumnIndex: bounds.minColumnIndex });
			onChange(dataGridCellsChange(table, bounds, tiled(parseDataGridClipboardText(source.text), bounds), "fill"));
		},
		[bounds, onChange, table],
	);
	const fillDown = React.useCallback((): void => {
		fill("down");
	}, [fill]);
	const fillRight = React.useCallback((): void => {
		fill("right");
	}, [fill]);
	const clear = React.useCallback((): void => {
		onChange(dataGridCellsChange(table, bounds, [], "clear"));
	}, [bounds, onChange, table]);
	return (
		<>
			{readClipboard === undefined ? null : <PasteButton table={table} bounds={bounds} onChange={onChange} read={readClipboard} label={labels.pasteCells} />}
			<Button label={labels.fillDown} variant="outline" size="xs" onPress={fillDown} disabled={bounds.maxRowIndex === bounds.minRowIndex} />
			<Button label={labels.fillRight} variant="outline" size="xs" onPress={fillRight} disabled={bounds.maxColumnIndex === bounds.minColumnIndex} />
			<Button label={labels.clearCells} variant="outline" size="xs" onPress={clear} />
			{editable ? <Button label={labels.editCell} variant="outline" size="xs" onPress={onEdit} /> : null}
		</>
	);
}

interface PasteButtonProps<TData extends RowData> extends SelectionTarget<TData> {
	readonly onChange: (details: DataGridCellsChangeDetails<TData>) => void;
	readonly read: () => Promise<string>;
	readonly label: string;
}

/** Paste: one picked cell takes the whole copied block from there; a picked block takes the copy repeated across it. */
function PasteButton<TData extends RowData>({ table, bounds, onChange, read, label }: PasteButtonProps<TData>): React.JSX.Element {
	const paste = React.useCallback((): void => {
		read()
			.then((text: string): void => {
				const block = parseDataGridClipboardText(text);
				const [firstLine = []] = block;
				const single = bounds.maxRowIndex === bounds.minRowIndex && bounds.maxColumnIndex === bounds.minColumnIndex;
				const target = single
					? {
							...bounds,
							maxRowIndex: Math.min(table.getRowsInDisplayOrder().length - 1, bounds.minRowIndex + block.length - 1),
							maxColumnIndex: Math.min(dataGridDisplayColumns(table).length - 1, bounds.minColumnIndex + firstLine.length - 1),
						}
					: bounds;
				onChange(dataGridCellsChange(table, target, tiled(block, target), "paste"));
			})
			// An unreadable clipboard pastes nothing: the cells stay as they were, which is what the person sees.
			.catch((): void => undefined);
	}, [bounds, onChange, read, table]);
	return <Button label={label} variant="outline" size="xs" onPress={paste} />;
}

interface CellEditorProps<TData extends RowData> {
	readonly table: DataGridTableInstance<TData>;
	readonly onChange: (details: DataGridCellsChangeDetails<TData>) => void;
	readonly labels: NativeDataGridLabels;
	readonly visible: boolean;
	readonly onClose: () => void;
}

/** The focused cell's text in a sheet: Save writes it through the column's `parse`. */
function CellEditor<TData extends RowData>({ table, onChange, labels, visible, onClose }: CellEditorProps<TData>): React.JSX.Element | null {
	const focused = table.getFocusedCell();
	return focused === undefined ? null : <CellEditorSheet table={table} cell={focused} onChange={onChange} labels={labels} visible={visible} onClose={onClose} />;
}

function CellEditorSheet<TData extends RowData>({
	table,
	cell,
	onChange,
	labels,
	visible,
	onClose,
}: CellEditorProps<TData> & { readonly cell: NonNullable<ReturnType<DataGridTableInstance<TData>["getFocusedCell"]>> }): React.JSX.Element {
	// Mounted afresh for each opening (its key), so it starts from the cell's current text.
	const [text, setText] = React.useState(dataGridCellText(cell.column, cell.row));
	const save = React.useCallback((): void => {
		const columnIndex = dataGridDisplayColumns(table).findIndex((column): boolean => column.id === cell.column.id);
		const rowIndex = table.getRowsInDisplayOrder().findIndex((row): boolean => row.id === cell.row.id);
		onChange(dataGridCellsChange(table, { minRowIndex: rowIndex, maxRowIndex: rowIndex, minColumnIndex: columnIndex, maxColumnIndex: columnIndex }, [[text]], "edit"));
		onClose();
	}, [cell, onChange, onClose, table, text]);
	const title = dataGridColumnLabel(cell.column);
	return (
		<BottomSheet visible={visible} title={title} onClose={onClose}>
			<View className="gap-3">
				<Input
					value={text}
					onChange={setText}
					accessibilityLabel={title}
					keyboardType={cell.column.columnDef.meta?.cellEdit?.control === "number" ? "decimal-pad" : "default"}
					autoFocus
				/>
				<View className="flex-row justify-end gap-2">
					<Button label={labels.cancel} variant="ghost" size="sm" onPress={onClose} />
					<Button label={labels.save} size="sm" onPress={save} />
				</View>
			</View>
		</BottomSheet>
	);
}

// ── The table ──────────────────────────────────────────────────────────────

export interface DataGridTableProps {
	/** The rows scroll inside this height; with `headerSticky` the header stays above them. */
	readonly height?: number | undefined;
	/** Rows drawn as they scroll into view (needs `height`): for long local lists and feeds. */
	readonly virtualized?: boolean | undefined;
	/** Only the columns in view are drawn (for very wide grids). */
	readonly virtualizeColumns?: boolean | undefined;
	/** The end of a virtualised list was reached: load the next page. */
	readonly onFetchMore?: (() => void) | undefined;
	readonly isFetchingMore?: boolean | undefined;
	/** More rows can be fetched. Default `true` while `onFetchMore` is given. */
	readonly hasMore?: boolean | undefined;
	/** Footer rows under the body (totals, statistics). */
	readonly footer?: readonly DataGridFootRow[] | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** Draws the grid's table: header, rows, footer, and the selection bar. */
export const DataGridTable = React.memo(
	React.forwardRef<ViewInstance, DataGridTableProps>(function DataGridTable(props, ref): React.JSX.Element {
		const context = useDataGrid();
		const visitor = React.useMemo(
			(): DataGridGridVisitor<React.JSX.Element> => ({
				visit: <TData extends RowData>(grid: DataGridTypedGrid<TData>): React.JSX.Element => <GridTable viewRef={ref} grid={grid} context={context} options={props} />,
			}),
			[context, props, ref],
		);
		return context.withGrid(visitor);
	}),
);

interface GridTableProps<TData extends RowData> {
	readonly viewRef: React.ForwardedRef<ViewInstance>;
	readonly grid: DataGridTypedGrid<TData>;
	readonly context: DataGridContextValue;
	readonly options: DataGridTableProps;
}

function GridTable<TData extends RowData>({ viewRef, grid, context, options }: GridTableProps<TData>): React.JSX.Element {
	const { table, onRowPress } = grid;
	const { layout, isLoading, loadingMode, loadingMessage, emptyMessage, onRowReorder } = context;
	const { height, virtualized = false, virtualizeColumns = false, onFetchMore, isFetchingMore = false, hasMore = true, footer, className, testID } = options;
	const auto = layout.width === "auto";
	const [viewport, setViewport] = React.useState(0);
	const [offset, setOffset] = React.useState(0);
	const [drag, setDrag] = React.useState<{ readonly columnId: string; readonly dx: number } | null>(null);
	const [editing, setEditing] = React.useState(false);
	/** Each opening of the editor counts up, so it mounts afresh with the cell's text. */
	const [openings, setOpenings] = React.useState(0);
	const scrollX = useSharedValue(0);
	const geometry = gridGeometry(table, viewport);
	const pinned = usePinnedStyles(scrollX, geometry.total - viewport, viewport, auto);
	const onScroll = useAnimatedScrollHandler({
		onScroll: (event): void => {
			scrollX.set(event.contentOffset.x);
			if (virtualizeColumns) {
				scheduleOnRN(setOffset, event.contentOffset.x);
			}
		},
	});
	const measure = React.useCallback((event: LayoutChangeEvent): void => {
		setViewport(event.nativeEvent.layout.width);
	}, []);
	const window = virtualizeColumns
		? dataGridColumnWindow(
				geometry.center.map((slot): number => slot.width),
				offset,
				viewport - geometry.start.reduce((sum: number, slot): number => sum + slot.width, 0),
				COLUMN_OVERSCAN,
			)
		: undefined;

	const dragMove = React.useCallback((columnId: string, dx: number): void => {
		setDrag(dx === 0 ? null : { columnId, dx });
	}, []);
	const dragEnd = React.useCallback(
		(columnId: string, dx: number): void => {
			setDrag(null);
			const center = table.getCenterVisibleLeafColumns();
			const from = center.findIndex((column): boolean => column.id === columnId);
			const to = dataGridDropIndex(
				center.map((column): number => column.getSize()),
				from,
				dx,
			);
			const order = dataGridMovedColumnOrder(table, columnId, to - from);
			if (order !== null) {
				table.setColumnOrder([...order]);
			}
		},
		[table],
	);

	const selection = React.useMemo(
		(): SelectionHandlers | undefined =>
			layout.cellSelection
				? {
						onSelect: (rowId: string, columnId: string): void => {
							table.selectCellRange({ anchorRowId: rowId, anchorColumnId: columnId, focusRowId: rowId, focusColumnId: columnId });
							table.setFocusedCell(rowId, columnId);
						},
						onExtend: (rowId: string, columnId: string): void => {
							const focused = table.getFocusedCell();
							table.selectCellRange({
								anchorRowId: focused?.row.id ?? rowId,
								anchorColumnId: focused?.column.id ?? columnId,
								focusRowId: rowId,
								focusColumnId: columnId,
							});
						},
					}
				: undefined,
		[layout.cellSelection, table],
	);
	const startEditing = React.useCallback((): void => {
		setOpenings((count: number): number => count + 1);
		setEditing(true);
	}, []);
	const stopEditing = React.useCallback((): void => {
		setEditing(false);
	}, []);

	const rows = layout.rowsPinnable ? [...table.getTopRows(), ...table.getCenterRows()] : table.getRowModel().rows;
	const rowIds = rows.map((row): string => row.id);
	const commitReorder = React.useCallback(
		(_order: readonly string[], move: SortableMove): void => {
			onRowReorder?.({ rowId: move.id, from: move.activeIndex, to: move.overIndex });
		},
		[onRowReorder],
	);
	const ignoreOrder = React.useCallback((): void => undefined, []);
	const identity = React.useCallback((id: string): string => id, []);

	const heightStyle = React.useMemo(() => (height === undefined ? undefined : { height }), [height]);
	const widthStyle = React.useMemo(() => ({ width: Math.max(geometry.total, viewport) }), [geometry.total, viewport]);
	const beforeStyle = React.useMemo(() => ({ width: window?.before ?? 0 }), [window?.before]);
	const afterStyle = React.useMemo(() => ({ width: window?.after ?? 0 }), [window?.after]);
	const leafHeaders = table.getLeafHeaders();
	const headerOf = (slot: ColumnSlot<TData>): React.JSX.Element | null => {
		const header = leafHeaders.find((candidate): boolean => candidate.column.id === slot.column.id);
		return header === undefined ? null : (
			<HeaderCell
				key={slot.column.id}
				table={table}
				header={header}
				slot={slot}
				context={context}
				auto={auto}
				onDragMove={dragMove}
				onDragEnd={dragEnd}
				dragDx={drag?.columnId === slot.column.id ? drag.dx : 0}
			/>
		);
	};
	const headerCenter = window === undefined ? geometry.center : geometry.center.slice(window.start, window.end + 1);
	const headerRow = (
		<View className={dataGridHeaderRowVariants({ background: layout.headerBackground, border: layout.headerBorder })}>
			{geometry.start.length === 0 ? null : (
				<Animated.View style={auto ? undefined : pinned.start} className={cn("flex-row", layout.headerBackground ? "bg-muted" : "bg-background")}>
					{geometry.start.map(headerOf)}
				</Animated.View>
			)}
			{window === undefined || window.before === 0 ? null : <View style={beforeStyle} />}
			{headerCenter.map(headerOf)}
			{window === undefined || window.after === 0 ? null : <View style={afterStyle} />}
			{geometry.end.length === 0 ? null : (
				<Animated.View style={auto ? undefined : pinned.end} className={cn("flex-row", layout.headerBackground ? "bg-muted" : "bg-background")}>
					{geometry.end.map(headerOf)}
				</Animated.View>
			)}
		</View>
	);

	const renderRow = React.useCallback(
		(row: DataGridRow<TData>, index: number): React.JSX.Element => (
			<GridRow
				key={row.id}
				row={row}
				index={index}
				geometry={geometry}
				context={context}
				pinned={pinned}
				auto={auto}
				window={window}
				onRowPress={onRowPress}
				selection={selection}
			/>
		),
		[auto, context, geometry, onRowPress, pinned, selection, window],
	);
	const renderItem = React.useCallback(({ item, index }: ListRenderItemInfo<DataGridRow<TData>>): React.JSX.Element => renderRow(item, index), [renderRow]);
	const keyOf = React.useCallback((row: DataGridRow<TData>): string => row.id, []);
	const fetchMore = React.useCallback((): void => {
		if (onFetchMore !== undefined && hasMore && !isFetchingMore) {
			onFetchMore();
		}
	}, [hasMore, isFetchingMore, onFetchMore]);
	const listFooter =
		onFetchMore === undefined ? undefined : (
			<Animated.View style={pinned.span} className="flex-row items-center justify-center gap-2 py-3">
				{isFetchingMore ? <Spinner size="sm" accessibilityLabel={context.labels.fetchingMore} /> : null}
				<Text className="text-caption font-sans text-muted-foreground">{isFetchingMore ? context.labels.fetchingMore : hasMore ? "" : context.labels.allRowsLoaded}</Text>
			</Animated.View>
		);

	const skeletonCount = table.state.pagination.pageSize > 0 ? table.state.pagination.pageSize : DEFAULT_SKELETON_ROWS;
	let body: React.ReactNode;
	if (isLoading && loadingMode === "skeleton") {
		body = Array.from({ length: skeletonCount }, (_, index: number): React.JSX.Element => (
			<View key={`skeleton-${String(index)}`} className={dataGridRowVariants({ border: layout.rowBorder })}>
				{[...geometry.start, ...geometry.center, ...geometry.end].map((slot): React.JSX.Element => (
					<SkeletonCell key={slot.column.id} slot={slot} layout={layout} auto={auto} />
				))}
			</View>
		));
	} else if (rows.length === 0 && !isLoading) {
		body = (
			<Animated.View style={pinned.span} className="items-center justify-center px-4 py-8">
				{drawable(emptyMessage, "text-label font-sans text-muted-foreground")}
			</Animated.View>
		);
	} else if (virtualized) {
		body = (
			<FlatList
				data={rows}
				renderItem={renderItem}
				keyExtractor={keyOf}
				onEndReached={fetchMore}
				onEndReachedThreshold={END_REACHED_THRESHOLD}
				ListFooterComponent={listFooter}
				style={heightStyle}
				nestedScrollEnabled
				testID={testID === undefined ? undefined : `${testID}-list`}
			/>
		);
	} else if (layout.rowsDraggable) {
		body = (
			<Sortable value={rowIds} onValueChange={ignoreOrder} onValueCommit={commitReorder} getItemValue={identity}>
				{rows.map((row, index: number): React.JSX.Element => (
					<SortableItem key={row.id} value={row.id} label={rowName(row, geometry)}>
						{renderRow(row, index)}
					</SortableItem>
				))}
			</Sortable>
		);
	} else {
		body = rows.map(renderRow);
	}

	const sticky = layout.headerSticky || virtualized;
	let frame: React.ReactNode;
	if (virtualized) {
		frame = (
			<>
				{headerRow}
				{body}
			</>
		);
	} else if (heightStyle === undefined) {
		frame = (
			<>
				{headerRow}
				{body}
			</>
		);
	} else if (sticky) {
		frame = (
			<>
				{headerRow}
				<Animated.ScrollView style={heightStyle} nestedScrollEnabled>
					{body}
				</Animated.ScrollView>
			</>
		);
	} else {
		frame = (
			<Animated.ScrollView style={heightStyle} nestedScrollEnabled>
				{headerRow}
				{body}
			</Animated.ScrollView>
		);
	}
	const content = (
		<View>
			{frame}
			{(footer ?? []).map((row): React.JSX.Element => (
				<FootRow key={row.key} row={row} geometry={geometry} layout={layout} auto={auto} />
			))}
		</View>
	);
	return (
		<View ref={viewRef} onLayout={measure} className={cn("w-full", className)} testID={testID}>
			{layout.cellSelection ? <SelectionBar grid={grid} context={context} onEdit={startEditing} /> : null}
			{auto ? (
				content
			) : (
				<Animated.ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					onScroll={onScroll}
					scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
					testID={testID === undefined ? undefined : `${testID}-scroll`}>
					<View style={widthStyle}>{content}</View>
				</Animated.ScrollView>
			)}
			{isLoading && loadingMode === "spinner" ? (
				<View accessibilityLiveRegion="polite" className="absolute inset-0 items-center justify-center gap-2 bg-background/70">
					<Spinner accessibilityLabel={loadingMessage} />
					<Text className="text-caption font-sans text-muted-foreground">{loadingMessage}</Text>
				</View>
			) : null}
			{layout.cellSelection && grid.onCellsChange !== undefined ? (
				<CellEditor key={String(openings)} table={table} onChange={grid.onCellsChange} labels={context.labels} visible={editing} onClose={stopEditing} />
			) : null}
		</View>
	);
}

function SkeletonCell<TData extends RowData>({
	slot,
	layout,
	auto,
}: {
	readonly slot: ColumnSlot<TData>;
	readonly layout: DataGridResolvedTableLayout;
	readonly auto: boolean;
}): React.JSX.Element {
	const style = React.useMemo(() => slotStyle(slot.width, auto), [auto, slot.width]);
	return (
		<View style={style} className={dataGridCellVariants({ dense: layout.dense, border: layout.cellBorder })}>
			{slot.column.columnDef.meta?.skeleton ?? <Skeleton className="h-3.5 w-2/3 rounded" />}
		</View>
	);
}
