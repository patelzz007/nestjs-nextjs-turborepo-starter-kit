// A list (or grid) the person reorders (the web kit's `Sortable`): the same
// parts — Sortable, SortableItem, SortableItemHandle — and props (`value`,
// `onValueChange`, `getItemValue`, `strategy`, `onValueCommit`).
//
// Drag a handle: the item follows the finger, the item it is over is
// outlined, and letting go moves it there. With a screen reader, each handle
// offers actions instead — move up, move down, to the start, to the end — and
// the new place is announced ("Moved Spec sheet to position 2 of 4"). The
// order is the caller's: `onValueChange` hears every move (`onValueCommit`
// the same, for a save), so the list is controlled.
//
// React Native's own responder drives the drag (the app carries no gesture
// library); the dragged item moves on the UI thread (Reanimated). Items are
// laid out by the root's classes (a column, or a wrapping grid) and measured
// where they sit. The ref reaches the root view.

import { cva } from "class-variance-authority";
import * as React from "react";
import { AccessibilityInfo, type AccessibilityActionEvent, type LayoutChangeEvent, PanResponder, type PanResponderGestureState, View, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import type { ValueHandler } from "../lib/value-handler";

const StyledAnimatedView = withUniwind(Animated.View);

export type SortableStrategy = "vertical" | "horizontal" | "grid";

export const sortableVariants = cva("", {
	variants: { strategy: { vertical: "", horizontal: "flex-row", grid: "flex-row flex-wrap" } },
	defaultVariants: { strategy: "vertical" },
});

export const sortableItemVariants = cva("rounded-lg border-2", {
	variants: {
		/** Being dragged: lifted over the others. */
		dragging: { true: "z-10 opacity-90 shadow-lg", false: "" },
		/** The item the dragged one would land on. */
		target: { true: "border-primary", false: "border-transparent" },
	},
	defaultVariants: { dragging: false, target: false },
});

export const sortableHandleVariants = cva("min-h-11 min-w-11 items-center justify-center", {
	variants: { disabled: { true: "opacity-40", false: "" } },
	defaultVariants: { disabled: false },
});

/** Where an item sits inside the root, from its layout. */
interface ItemRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** The spoken words; English by default. */
export interface SortableLabels {
	readonly handle: (item: string) => string;
	readonly moveUp: string;
	readonly moveDown: string;
	readonly moveToStart: string;
	readonly moveToEnd: string;
	readonly moved: (item: string, position: number, count: number) => string;
}

export const DEFAULT_SORTABLE_LABELS: SortableLabels = {
	handle: (item: string): string => `Reorder ${item}`,
	moveUp: "Move up",
	moveDown: "Move down",
	moveToStart: "Move to start",
	moveToEnd: "Move to end",
	moved: (item: string, position: number, count: number): string => `Moved ${item} to position ${String(position)} of ${String(count)}`,
};

/** `value` with the item at `from` moved to `to`; the same array when nothing moves. */
export function moveSortableItem<T>(value: readonly T[], from: number, to: number): readonly T[] {
	if (from === to || from < 0 || to < 0 || from >= value.length || to >= value.length) {
		return value;
	}
	const next = [...value];
	const [moved] = next.splice(from, 1);
	if (moved === undefined) {
		return value;
	}
	next.splice(to, 0, moved);
	return next;
}

/** The id of the item whose box holds `point`, or the nearest one by centre. */
export function sortableTargetAt(rects: ReadonlyMap<string, ItemRect>, point: { readonly x: number; readonly y: number }): string | null {
	let nearest: string | null = null;
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (const [id, rect] of rects) {
		if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
			return id;
		}
		const distance = Math.hypot(point.x - (rect.x + rect.width / 2), point.y - (rect.y + rect.height / 2));
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearest = id;
		}
	}
	return nearest;
}

/** A reorder the caller can save: where the item was and where it went. */
export interface SortableMove {
	readonly id: string;
	readonly activeIndex: number;
	readonly overIndex: number;
}

interface SortableContextValue {
	readonly activeId: string | null;
	readonly targetId: string | null;
	readonly labels: SortableLabels;
	readonly strategy: SortableStrategy;
	readonly translateX: ReturnType<typeof useSharedValue<number>>;
	readonly translateY: ReturnType<typeof useSharedValue<number>>;
	readonly register: (id: string, rect: ItemRect) => void;
	readonly start: (id: string) => void;
	readonly drag: (id: string, gesture: PanResponderGestureState) => void;
	readonly drop: (id: string) => void;
	readonly cancel: () => void;
	readonly moveBy: (id: string, label: string, to: "up" | "down" | "start" | "end") => void;
}

const SortableContext = React.createContext<SortableContextValue | null>(null);

function useSortableContext(part: string): SortableContextValue {
	const context = React.use(SortableContext);
	if (context === null) {
		throw new Error(`${part} must be inside a Sortable`);
	}
	return context;
}

interface ItemContextValue {
	readonly id: string;
	readonly label: string;
	readonly disabled: boolean;
}

const ItemContext = React.createContext<ItemContextValue | null>(null);

/** What a sortable list holds: records, or plain ids. */
export type SortableEntry = object | string;

/** The callbacks below are checked bivariantly (see lib/value-handler) so `T` survives `memo` / `forwardRef`. */
type ItemValueGetter<T> = { bivarianceHack(item: T): string }["bivarianceHack"];
type CommitHandler<T> = { bivarianceHack(value: readonly T[], move: SortableMove): void }["bivarianceHack"];

export interface SortableProps<T extends SortableEntry> {
	readonly value: readonly T[];
	/** Every move, with the new order. */
	readonly onValueChange: ValueHandler<readonly T[]>;
	/** The same, with where the item came from and went: for saving the order. */
	readonly onValueCommit?: CommitHandler<T> | undefined;
	/** Each item's stable id: the `value` its SortableItem carries. */
	readonly getItemValue: ItemValueGetter<T>;
	/** `vertical` (a column, the default), `horizontal` (a row) or `grid` (a wrapping grid). */
	readonly strategy?: SortableStrategy | undefined;
	readonly labels?: SortableLabels | undefined;
	readonly children: React.ReactNode;
	/** Extra classes for the root (gaps, columns), merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** `React.memo` and `React.forwardRef` drop type parameters: the root is bound to its generic signature here. */
type SortableComponent = <T extends SortableEntry>(props: SortableProps<T> & React.RefAttributes<ViewInstance>) => React.ReactNode;

const SortableBase = React.forwardRef<ViewInstance, SortableProps<SortableEntry>>(function Sortable(
	{ value, onValueChange, onValueCommit, getItemValue, strategy = "vertical", labels = DEFAULT_SORTABLE_LABELS, children, className, testID },
	ref,
): React.JSX.Element {
	const rects = React.useRef(new Map<string, ItemRect>());
	const [activeId, setActiveId] = React.useState<string | null>(null);
	const [targetId, setTargetId] = React.useState<string | null>(null);
	const translateX = useSharedValue(0);
	const translateY = useSharedValue(0);
	const ids = value.map(getItemValue);

	const commit = React.useCallback(
		(id: string, overId: string): number | null => {
			const activeIndex = ids.indexOf(id);
			const overIndex = ids.indexOf(overId);
			const next = moveSortableItem(value, activeIndex, overIndex);
			if (next === value) {
				return null;
			}
			onValueChange(next);
			onValueCommit?.(next, { id, activeIndex, overIndex });
			return overIndex;
		},
		[ids, onValueChange, onValueCommit, value],
	);
	// The drag's callbacks stay the same for the whole drag (a new responder mid-gesture would restart its
	// tracking): they read the latest target and commit through refs.
	const targetRef = React.useRef<string | null>(null);
	const commitRef = React.useRef(commit);
	React.useEffect((): void => {
		commitRef.current = commit;
	}, [commit]);
	const aim = React.useCallback((id: string | null): void => {
		targetRef.current = id;
		setTargetId(id);
	}, []);
	const reset = React.useCallback((): void => {
		translateX.set(0);
		translateY.set(0);
		setActiveId(null);
		aim(null);
	}, [aim, translateX, translateY]);
	const register = React.useCallback((id: string, rect: ItemRect): void => {
		rects.current.set(id, rect);
	}, []);
	const start = React.useCallback(
		(id: string): void => {
			setActiveId(id);
			aim(id);
		},
		[aim],
	);
	const drag = React.useCallback(
		(id: string, gesture: PanResponderGestureState): void => {
			const rect = rects.current.get(id);
			if (rect === undefined) {
				return;
			}
			const dx = strategy === "vertical" ? 0 : gesture.dx;
			const dy = strategy === "horizontal" ? 0 : gesture.dy;
			translateX.set(dx);
			translateY.set(dy);
			const over = sortableTargetAt(rects.current, { x: rect.x + rect.width / 2 + dx, y: rect.y + rect.height / 2 + dy });
			if (over !== targetRef.current) {
				aim(over);
			}
		},
		[aim, strategy, translateX, translateY],
	);
	const drop = React.useCallback(
		(id: string): void => {
			const over = targetRef.current;
			if (over !== null) {
				commitRef.current(id, over);
			}
			reset();
		},
		[reset],
	);
	const moveBy = React.useCallback(
		(id: string, label: string, to: "up" | "down" | "start" | "end"): void => {
			const index = ids.indexOf(id);
			const destination = { up: index - 1, down: index + 1, start: 0, end: ids.length - 1 }[to];
			const overId = ids.at(destination);
			if (destination < 0 || overId === undefined) {
				return;
			}
			const position = commit(id, overId);
			if (position !== null) {
				AccessibilityInfo.announceForAccessibility(labels.moved(label, position + 1, ids.length));
			}
		},
		[commit, ids, labels],
	);

	const context = React.useMemo(
		(): SortableContextValue => ({ activeId, targetId, labels, strategy, translateX, translateY, register, start, drag, drop, cancel: reset, moveBy }),
		[activeId, drag, drop, labels, moveBy, register, reset, start, strategy, targetId, translateX, translateY],
	);

	return (
		<SortableContext.Provider value={context}>
			<View ref={ref} testID={testID} className={cn(sortableVariants({ strategy }), className)}>
				{children}
			</View>
		</SortableContext.Provider>
	);
});

export const Sortable: SortableComponent = React.memo(SortableBase);

export interface SortableItemProps {
	/** The item's id: `getItemValue` of its entry in `value`. */
	readonly value: string;
	/** The item's name, for its handle and the announcements ("Spec sheet"). Default its id. */
	readonly label?: string | undefined;
	readonly disabled?: boolean | undefined;
	readonly children: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** One item: measured where it sits, lifted and following the finger while dragged. */
export const SortableItem = React.memo(
	React.forwardRef<ViewInstance, SortableItemProps>(function SortableItem({ value, label, disabled = false, children, className, testID }, ref): React.JSX.Element {
		const { activeId, targetId, register, translateX, translateY } = useSortableContext("SortableItem");
		const dragging = activeId === value;
		const measure = React.useCallback(
			(event: LayoutChangeEvent): void => {
				const { x, y, width, height } = event.nativeEvent.layout;
				register(value, { x, y, width, height });
			},
			[register, value],
		);
		const dragStyle = useAnimatedStyle(() => ({ transform: dragging ? [{ translateX: translateX.get() }, { translateY: translateY.get() }] : [] }));
		const item = React.useMemo((): ItemContextValue => ({ id: value, label: label ?? value, disabled }), [disabled, label, value]);
		return (
			<ItemContext.Provider value={item}>
				<StyledAnimatedView
					ref={ref}
					onLayout={measure}
					style={dragStyle}
					testID={testID}
					className={cn(sortableItemVariants({ dragging, target: activeId !== null && !dragging && targetId === value }), className)}>
					{children}
				</StyledAnimatedView>
			</ItemContext.Provider>
		);
	}),
);

export interface SortableItemHandleProps {
	/** The handle's glyph (a grip). */
	readonly children: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

type MoveAction = "up" | "down" | "start" | "end";
const ACTION_NAMES: readonly MoveAction[] = ["up", "down", "start", "end"];

/** The grip that drags its item; for a screen reader, the actions that move it. */
export const SortableItemHandle = React.memo(
	React.forwardRef<ViewInstance, SortableItemHandleProps>(function SortableItemHandle({ children, className, testID }, ref): React.JSX.Element {
		const { start, drag, drop, cancel, moveBy, labels, strategy } = useSortableContext("SortableItemHandle");
		const item = React.use(ItemContext);
		if (item === null) {
			throw new Error("SortableItemHandle must be inside a SortableItem");
		}
		const { id, label, disabled } = item;
		const responder = React.useMemo(
			() =>
				PanResponder.create({
					onStartShouldSetPanResponder: (): boolean => !disabled,
					onMoveShouldSetPanResponder: (): boolean => !disabled,
					// The drag keeps the gesture: a scroll view around the list does not take it over.
					onPanResponderTerminationRequest: (): boolean => false,
					onPanResponderGrant: (): void => {
						start(id);
					},
					onPanResponderMove: (_event, gesture: PanResponderGestureState): void => {
						drag(id, gesture);
					},
					onPanResponderRelease: (): void => {
						drop(id);
					},
					onPanResponderTerminate: (): void => {
						cancel();
					},
				}),
			[cancel, disabled, drag, drop, id, start],
		);
		const vertical = strategy !== "horizontal";
		const actions = React.useMemo(
			() => [
				{ name: "up", label: vertical ? labels.moveUp : labels.moveToStart },
				{ name: "down", label: labels.moveDown },
				{ name: "start", label: labels.moveToStart },
				{ name: "end", label: labels.moveToEnd },
			],
			[labels, vertical],
		);
		const act = React.useCallback(
			(event: AccessibilityActionEvent): void => {
				const action = ACTION_NAMES.find((name: MoveAction): boolean => name === event.nativeEvent.actionName);
				if (action !== undefined) {
					moveBy(id, label, action);
				}
			},
			[id, label, moveBy],
		);
		const accessibilityState = React.useMemo(() => ({ disabled }), [disabled]);
		// A plain view: the responder is the handle's whole interaction (a Pressable's own responder would take it).
		return (
			<View
				ref={ref}
				{...responder.panHandlers}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={labels.handle(label)}
				accessibilityActions={actions}
				accessibilityState={accessibilityState}
				onAccessibilityAction={act}
				testID={testID}
				className={cn(sortableHandleVariants({ disabled }), className)}>
				{children}
			</View>
		);
	}),
);
