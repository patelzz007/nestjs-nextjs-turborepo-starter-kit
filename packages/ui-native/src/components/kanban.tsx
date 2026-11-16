// Columns of cards the person moves between columns (the web kit's
// `Kanban`): the same parts — Kanban, KanbanBoard, KanbanColumn,
// KanbanColumnContent, KanbanColumnHandle, KanbanItem, KanbanItemHandle — and
// props (`value` as columns of items, `onValueChange`, `getItemValue`,
// `onValueCommit`). The move rules are shared with the web (@workspace/shared
// `moveKanbanItem`, `reorderKanbanColumns`).
//
// Drag a card's handle: it follows the finger; the card or column it is over
// is outlined; letting go drops it there (on a card it takes that card's
// place, on a column's empty space it goes to the end). A column's handle
// reorders the columns. With a screen reader, a card's handle offers "Move
// to <column>" for every other column and up/down within its own; a
// column's, left/right; each move is announced.
//
// React Native's own responder drives the drag; at its start the board
// measures every card and column on screen, so the finger is hit-tested in
// the same window coordinates however the columns are nested or scrolled.
// The ref reaches each part's root view.

import { moveKanbanItem, reorderKanbanColumns, type KanbanValue } from "@workspace/ui-kit-logic";
import { cva } from "class-variance-authority";
import * as React from "react";
import {
	AccessibilityInfo,
	type AccessibilityActionEvent,
	type AccessibilityActionInfo,
	PanResponder,
	type PanResponderGestureState,
	ScrollView,
	View,
	type ViewInstance,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import type { ValueHandler } from "../lib/value-handler";

const StyledAnimatedView = withUniwind(Animated.View);

export const kanbanBoardVariants = cva("flex-row gap-3");
export const kanbanColumnVariants = cva("rounded-xl border-2 bg-muted/50 p-2", {
	variants: { target: { true: "border-primary", false: "border-transparent" }, dragging: { true: "z-10 opacity-90 shadow-lg", false: "" } },
	defaultVariants: { target: false, dragging: false },
});
export const kanbanColumnContentVariants = cva("gap-2");
export const kanbanItemVariants = cva("rounded-lg border-2", {
	variants: { target: { true: "border-primary", false: "border-transparent" }, dragging: { true: "z-10 opacity-90 shadow-lg", false: "" } },
	defaultVariants: { target: false, dragging: false },
});
export const kanbanHandleVariants = cva("min-h-11 min-w-11 items-center justify-center");

/** A box on screen, in window coordinates. */
interface Box {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

function holds(box: Box, x: number, y: number): boolean {
	return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

/** What a dragged card lands on at (`x`, `y`): another card first (not itself), else a column; `null` over nothing. */
export function kanbanDropTargetAt(
	items: ReadonlyMap<string, Box>,
	columns: ReadonlyMap<string, Box>,
	activeId: string,
	point: { readonly x: number; readonly y: number },
): string | null {
	for (const [id, box] of items) {
		if (id !== activeId && holds(box, point.x, point.y)) {
			return id;
		}
	}
	for (const [id, box] of columns) {
		if (holds(box, point.x, point.y)) {
			return id;
		}
	}
	return null;
}

/** The spoken words; English by default. */
export interface KanbanLabels {
	readonly itemHandle: (item: string) => string;
	readonly columnHandle: (column: string) => string;
	readonly moveTo: (column: string) => string;
	readonly moveUp: string;
	readonly moveDown: string;
	readonly moveLeft: string;
	readonly moveRight: string;
	readonly movedItem: (item: string, column: string) => string;
	readonly movedColumn: (column: string, position: number, count: number) => string;
}

export const DEFAULT_KANBAN_LABELS: KanbanLabels = {
	itemHandle: (item: string): string => `Move ${item}`,
	columnHandle: (column: string): string => `Move the ${column} column`,
	moveTo: (column: string): string => `Move to ${column}`,
	moveUp: "Move up",
	moveDown: "Move down",
	moveLeft: "Move left",
	moveRight: "Move right",
	movedItem: (item: string, column: string): string => `Moved ${item} to ${column}`,
	movedColumn: (column: string, position: number, count: number): string => `Moved the ${column} column to position ${String(position)} of ${String(count)}`,
};

/** A move the caller can save. */
export interface KanbanMove {
	readonly kind: "item" | "column";
	readonly id: string;
	readonly overId: string;
}

type DragKind = "item" | "column";

interface KanbanContextValue {
	readonly activeId: string | null;
	readonly activeKind: DragKind | null;
	readonly targetId: string | null;
	readonly labels: KanbanLabels;
	readonly columnIds: readonly string[];
	readonly columnLabel: (id: string) => string;
	readonly columnOf: (itemId: string) => string | undefined;
	readonly neighbours: (itemId: string) => { readonly above: string | undefined; readonly below: string | undefined };
	readonly translateX: ReturnType<typeof useSharedValue<number>>;
	readonly translateY: ReturnType<typeof useSharedValue<number>>;
	readonly registerItem: (id: string, node: ViewInstance | null) => void;
	readonly registerColumn: (id: string, label: string, node: ViewInstance | null) => void;
	readonly start: (id: string, kind: DragKind) => void;
	readonly drag: (gesture: PanResponderGestureState) => void;
	readonly drop: () => void;
	readonly cancel: () => void;
	readonly moveItem: (id: string, label: string, overId: string) => void;
	readonly moveColumn: (id: string, label: string, by: -1 | 1) => void;
}

const KanbanContext = React.createContext<KanbanContextValue | null>(null);

function useKanbanContext(part: string): KanbanContextValue {
	const context = React.use(KanbanContext);
	if (context === null) {
		throw new Error(`${part} must be inside a Kanban`);
	}
	return context;
}

/** What a board holds: records, or plain ids. */
export type KanbanEntry = object | string;

type ItemValueGetter<T> = { bivarianceHack(item: T): string }["bivarianceHack"];
type CommitHandler<T> = { bivarianceHack(value: KanbanValue<T>, move: KanbanMove): void }["bivarianceHack"];

export interface KanbanProps<T extends KanbanEntry> {
	/** The columns in board order, each holding its items in order. */
	readonly value: KanbanValue<T>;
	readonly onValueChange: ValueHandler<KanbanValue<T>>;
	/** The same, with what moved: for saving the board. */
	readonly onValueCommit?: CommitHandler<T> | undefined;
	readonly getItemValue: ItemValueGetter<T>;
	readonly labels?: KanbanLabels | undefined;
	readonly children: React.ReactNode;
	/** Extra classes for the root, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

type KanbanComponent = <T extends KanbanEntry>(props: KanbanProps<T> & React.RefAttributes<ViewInstance>) => React.ReactNode;

const KanbanBase = React.forwardRef<ViewInstance, KanbanProps<KanbanEntry>>(function Kanban(
	{ value, onValueChange, onValueCommit, getItemValue, labels = DEFAULT_KANBAN_LABELS, children, className, testID },
	ref,
): React.JSX.Element {
	const itemNodes = React.useRef(new Map<string, ViewInstance>());
	const columnNodes = React.useRef(new Map<string, ViewInstance>());
	const columnLabels = React.useRef(new Map<string, string>());
	const itemBoxes = React.useRef(new Map<string, Box>());
	const columnBoxes = React.useRef(new Map<string, Box>());
	const [activeId, setActiveId] = React.useState<string | null>(null);
	const [activeKind, setActiveKind] = React.useState<DragKind | null>(null);
	const [targetId, setTargetId] = React.useState<string | null>(null);
	const translateX = useSharedValue(0);
	const translateY = useSharedValue(0);
	const activeRef = React.useRef<{ readonly id: string; readonly kind: DragKind } | null>(null);
	const targetRef = React.useRef<string | null>(null);
	const columnIds = Object.keys(value);

	const apply = React.useCallback(
		(next: KanbanValue<KanbanEntry> | null, move: KanbanMove): boolean => {
			if (next === null) {
				return false;
			}
			onValueChange(next);
			onValueCommit?.(next, move);
			return true;
		},
		[onValueChange, onValueCommit],
	);
	// The drag's callbacks stay the same for the whole drag: they read the latest board through a ref.
	const applyRef = React.useRef({ apply, value, getItemValue });
	React.useEffect((): void => {
		applyRef.current = { apply, value, getItemValue };
	}, [apply, getItemValue, value]);

	const aim = React.useCallback((id: string | null): void => {
		targetRef.current = id;
		setTargetId(id);
	}, []);
	const reset = React.useCallback((): void => {
		translateX.set(0);
		translateY.set(0);
		activeRef.current = null;
		setActiveId(null);
		setActiveKind(null);
		aim(null);
	}, [aim, translateX, translateY]);
	const measureAll = React.useCallback((): void => {
		const measure = (nodes: ReadonlyMap<string, ViewInstance>, boxes: Map<string, Box>): void => {
			boxes.clear();
			for (const [id, node] of nodes) {
				node.measureInWindow((x: number, y: number, width: number, height: number): void => {
					boxes.set(id, { x, y, width, height });
				});
			}
		};
		measure(itemNodes.current, itemBoxes.current);
		measure(columnNodes.current, columnBoxes.current);
	}, []);
	const start = React.useCallback(
		(id: string, kind: DragKind): void => {
			measureAll();
			activeRef.current = { id, kind };
			setActiveId(id);
			setActiveKind(kind);
			aim(null);
		},
		[aim, measureAll],
	);
	const drag = React.useCallback(
		(gesture: PanResponderGestureState): void => {
			const active = activeRef.current;
			if (active === null) {
				return;
			}
			translateX.set(gesture.dx);
			translateY.set(gesture.dy);
			const point = { x: gesture.moveX, y: gesture.moveY };
			const over =
				active.kind === "item"
					? kanbanDropTargetAt(itemBoxes.current, columnBoxes.current, active.id, point)
					: kanbanDropTargetAt(new Map(), columnBoxes.current, active.id, point);
			if (over !== targetRef.current) {
				aim(over === active.id ? null : over);
			}
		},
		[aim, translateX, translateY],
	);
	const drop = React.useCallback((): void => {
		const active = activeRef.current;
		const over = targetRef.current;
		if (active !== null && over !== null) {
			const { apply: commit, value: board, getItemValue: idOf } = applyRef.current;
			const next = active.kind === "item" ? moveKanbanItem(board, idOf, active.id, over) : reorderKanbanColumns(board, active.id, over);
			commit(next, { kind: active.kind, id: active.id, overId: over });
		}
		reset();
	}, [reset]);

	const columnOf = React.useCallback(
		(itemId: string): string | undefined =>
			columnIds.find((column: string): boolean => (value[column] ?? []).some((item: KanbanEntry): boolean => getItemValue(item) === itemId)),
		[columnIds, getItemValue, value],
	);
	const neighbours = React.useCallback(
		(itemId: string): { readonly above: string | undefined; readonly below: string | undefined } => {
			const column = columnOf(itemId);
			const ids = (column === undefined ? [] : (value[column] ?? [])).map(getItemValue);
			const index = ids.indexOf(itemId);
			return { above: index > 0 ? ids.at(index - 1) : undefined, below: ids.at(index + 1) };
		},
		[columnOf, getItemValue, value],
	);
	const columnLabel = React.useCallback((id: string): string => columnLabels.current.get(id) ?? id, []);
	const moveItem = React.useCallback(
		(id: string, label: string, overId: string): void => {
			const moved = apply(moveKanbanItem(value, getItemValue, id, overId), { kind: "item", id, overId });
			const column = columnOf(id);
			const landed = columnIds.includes(overId) ? overId : column;
			if (moved && landed !== undefined) {
				AccessibilityInfo.announceForAccessibility(labels.movedItem(label, columnLabel(landed)));
			}
		},
		[apply, columnIds, columnLabel, columnOf, getItemValue, labels, value],
	);
	const moveColumn = React.useCallback(
		(id: string, label: string, by: -1 | 1): void => {
			const index = columnIds.indexOf(id);
			const overId = columnIds.at(index + by);
			if (overId === undefined || index + by < 0) {
				return;
			}
			if (apply(reorderKanbanColumns(value, id, overId), { kind: "column", id, overId })) {
				AccessibilityInfo.announceForAccessibility(labels.movedColumn(label, index + by + 1, columnIds.length));
			}
		},
		[apply, columnIds, labels, value],
	);
	const registerItem = React.useCallback((id: string, node: ViewInstance | null): void => {
		if (node === null) {
			itemNodes.current.delete(id);
		} else {
			itemNodes.current.set(id, node);
		}
	}, []);
	const registerColumn = React.useCallback((id: string, label: string, node: ViewInstance | null): void => {
		columnLabels.current.set(id, label);
		if (node === null) {
			columnNodes.current.delete(id);
		} else {
			columnNodes.current.set(id, node);
		}
	}, []);

	const context = React.useMemo(
		(): KanbanContextValue => ({
			activeId,
			activeKind,
			targetId,
			labels,
			columnIds,
			columnLabel,
			columnOf,
			neighbours,
			translateX,
			translateY,
			registerItem,
			registerColumn,
			start,
			drag,
			drop,
			cancel: reset,
			moveItem,
			moveColumn,
		}),
		[
			activeId,
			activeKind,
			columnIds,
			columnLabel,
			columnOf,
			drag,
			drop,
			labels,
			moveColumn,
			moveItem,
			neighbours,
			registerColumn,
			registerItem,
			reset,
			start,
			targetId,
			translateX,
			translateY,
		],
	);

	return (
		<KanbanContext.Provider value={context}>
			<View ref={ref} testID={testID} className={cn(className)}>
				{children}
			</View>
		</KanbanContext.Provider>
	);
});

export const Kanban: KanbanComponent = React.memo(KanbanBase);

interface KanbanPartProps {
	readonly children?: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The row of columns, scrolling sideways when they do not fit. */
export const KanbanBoard = React.memo(
	React.forwardRef<ViewInstance, KanbanPartProps>(function KanbanBoard({ children, className, testID }, ref): React.JSX.Element {
		return (
			<ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID === undefined ? undefined : `${testID}-scroll`}>
				<View ref={ref} testID={testID} className={cn(kanbanBoardVariants(), className)}>
					{children}
				</View>
			</ScrollView>
		);
	}),
);

interface ColumnContextValue {
	readonly id: string;
	readonly label: string;
}

const ColumnContext = React.createContext<ColumnContextValue | null>(null);

export interface KanbanColumnProps extends KanbanPartProps {
	/** The column's key in `value`. */
	readonly value: string;
	/** The column's name, for handles and announcements ("In progress"). Default its key. */
	readonly label?: string | undefined;
}

export const KanbanColumn = React.memo(
	React.forwardRef<ViewInstance, KanbanColumnProps>(function KanbanColumn({ value, label, children, className, testID }, ref): React.JSX.Element {
		const { activeId, activeKind, targetId, registerColumn, translateX, translateY } = useKanbanContext("KanbanColumn");
		const name = label ?? value;
		const dragging = activeKind === "column" && activeId === value;
		const dragStyle = useAnimatedStyle(() => ({ transform: dragging ? [{ translateX: translateX.get() }, { translateY: translateY.get() }] : [] }));
		// The column is measured through its content's wrapper (the ref stays the caller's).
		const register = React.useCallback(
			(node: ViewInstance | null): void => {
				registerColumn(value, name, node);
			},
			[name, registerColumn, value],
		);
		const column = React.useMemo((): ColumnContextValue => ({ id: value, label: name }), [name, value]);
		return (
			<ColumnContext.Provider value={column}>
				<StyledAnimatedView
					ref={ref}
					style={dragStyle}
					testID={testID}
					className={cn(kanbanColumnVariants({ dragging, target: activeId !== null && !dragging && targetId === value }), className)}>
					<View ref={register}>{children}</View>
				</StyledAnimatedView>
			</ColumnContext.Provider>
		);
	}),
);

/** A column's cards, in order. */
export const KanbanColumnContent = React.memo(
	React.forwardRef<ViewInstance, KanbanPartProps>(function KanbanColumnContent({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(kanbanColumnContentVariants(), className)}>
				{children}
			</View>
		);
	}),
);

interface ItemContextValue {
	readonly id: string;
	readonly label: string;
}

const ItemContext = React.createContext<ItemContextValue | null>(null);

export interface KanbanItemProps extends KanbanPartProps {
	/** The card's id: `getItemValue` of its entry. */
	readonly value: string;
	/** The card's name, for its handle and announcements. Default its id. */
	readonly label?: string | undefined;
}

export const KanbanItem = React.memo(
	React.forwardRef<ViewInstance, KanbanItemProps>(function KanbanItem({ value, label, children, className, testID }, ref): React.JSX.Element {
		const { activeId, activeKind, targetId, registerItem, translateX, translateY } = useKanbanContext("KanbanItem");
		const dragging = activeKind === "item" && activeId === value;
		const dragStyle = useAnimatedStyle(() => ({ transform: dragging ? [{ translateX: translateX.get() }, { translateY: translateY.get() }] : [] }));
		// The card is measured through its content's wrapper (the ref stays the caller's).
		const register = React.useCallback(
			(node: ViewInstance | null): void => {
				registerItem(value, node);
			},
			[registerItem, value],
		);
		const item = React.useMemo((): ItemContextValue => ({ id: value, label: label ?? value }), [label, value]);
		return (
			<ItemContext.Provider value={item}>
				<StyledAnimatedView
					ref={ref}
					style={dragStyle}
					testID={testID}
					className={cn(kanbanItemVariants({ dragging, target: activeKind === "item" && !dragging && targetId === value }), className)}>
					<View ref={register}>{children}</View>
				</StyledAnimatedView>
			</ItemContext.Provider>
		);
	}),
);

/** The drag responder shared by both handles. */
function useDragResponder(id: string, kind: DragKind): ReturnType<typeof PanResponder.create> {
	const { start, drag, drop, cancel } = useKanbanContext("Kanban handle");
	return React.useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: (): boolean => true,
				onMoveShouldSetPanResponder: (): boolean => true,
				// The drag keeps the gesture: the board's scroll view does not take it over.
				onPanResponderTerminationRequest: (): boolean => false,
				onPanResponderGrant: (): void => {
					start(id, kind);
				},
				onPanResponderMove: (_event, gesture: PanResponderGestureState): void => {
					drag(gesture);
				},
				onPanResponderRelease: (): void => {
					drop();
				},
				onPanResponderTerminate: (): void => {
					cancel();
				},
			}),
		[cancel, drag, drop, id, kind, start],
	);
}

export interface KanbanHandleProps {
	/** The handle's glyph (a grip). */
	readonly children: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const UP = "up";
const DOWN = "down";
const COLUMN_ACTION = "column:";

/** The grip that drags its card; for a screen reader, the actions that move it. */
export const KanbanItemHandle = React.memo(
	React.forwardRef<ViewInstance, KanbanHandleProps>(function KanbanItemHandle({ children, className, testID }, ref): React.JSX.Element {
		const { labels, columnIds, columnLabel, columnOf, neighbours, moveItem } = useKanbanContext("KanbanItemHandle");
		const item = React.use(ItemContext);
		if (item === null) {
			throw new Error("KanbanItemHandle must be inside a KanbanItem");
		}
		const { id, label } = item;
		const responder = useDragResponder(id, "item");
		const home = columnOf(id);
		const actions = React.useMemo(
			(): readonly AccessibilityActionInfo[] => [
				{ name: UP, label: labels.moveUp },
				{ name: DOWN, label: labels.moveDown },
				...columnIds
					.filter((column: string): boolean => column !== home)
					.map((column: string): AccessibilityActionInfo => ({ name: `${COLUMN_ACTION}${column}`, label: labels.moveTo(columnLabel(column)) })),
			],
			[columnIds, columnLabel, home, labels],
		);
		const act = React.useCallback(
			(event: AccessibilityActionEvent): void => {
				const name = event.nativeEvent.actionName;
				if (name.startsWith(COLUMN_ACTION)) {
					moveItem(id, label, name.slice(COLUMN_ACTION.length));
					return;
				}
				const { above, below } = neighbours(id);
				const overId = name === UP ? above : below;
				if (overId !== undefined) {
					moveItem(id, label, overId);
				}
			},
			[id, label, moveItem, neighbours],
		);
		return (
			<View
				ref={ref}
				{...responder.panHandlers}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={labels.itemHandle(label)}
				accessibilityActions={actions}
				onAccessibilityAction={act}
				testID={testID}
				className={cn(kanbanHandleVariants(), className)}>
				{children}
			</View>
		);
	}),
);

const LEFT = "left";
const RIGHT = "right";
const BEFORE = -1;
const AFTER = 1;

/** The grip that drags its column; for a screen reader, left and right. */
export const KanbanColumnHandle = React.memo(
	React.forwardRef<ViewInstance, KanbanHandleProps>(function KanbanColumnHandle({ children, className, testID }, ref): React.JSX.Element {
		const { labels, moveColumn } = useKanbanContext("KanbanColumnHandle");
		const column = React.use(ColumnContext);
		if (column === null) {
			throw new Error("KanbanColumnHandle must be inside a KanbanColumn");
		}
		const { id, label } = column;
		const responder = useDragResponder(id, "column");
		const actions = React.useMemo(
			(): readonly AccessibilityActionInfo[] => [
				{ name: LEFT, label: labels.moveLeft },
				{ name: RIGHT, label: labels.moveRight },
			],
			[labels],
		);
		const act = React.useCallback(
			(event: AccessibilityActionEvent): void => {
				moveColumn(id, label, event.nativeEvent.actionName === LEFT ? BEFORE : AFTER);
			},
			[id, label, moveColumn],
		);
		return (
			<View
				ref={ref}
				{...responder.panHandlers}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={labels.columnHandle(label)}
				accessibilityActions={actions}
				onAccessibilityAction={act}
				testID={testID}
				className={cn(kanbanHandleVariants(), className)}>
				{children}
			</View>
		);
	}),
);
