"use client";

// Ported from ReUI (https://reui.io/r/base-vega/sortable.json). Part names, props,
// `data-slot` / `data-dragging` / `data-disabled` attributes and composition match
// ReUI, so its docs and examples apply, with these deliberate deviations:
// - Every part forwards its ref. The generic root `Sortable<T>` takes `ref` as a
//   React 19 prop, since `forwardRef` would erase `T`; the parts use `forwardRef`.
// - Screen-reader instructions and live announcements come from the `sortable`
//   family of `UiKitLabels` (dnd-kit's built-in copy is English-only). A `labels`
//   prop overrides single strings; `accessibility` still overrides dnd-kit wholesale.
// - The reorder rule is the pure, exported `reorderSortableValue`.
// - `SortableItem` takes a CVA `state` (`disabled`), resolved with `resolveFieldState`.
// - `SortableOverlay` renders dnd-kit's `DragOverlay`, which has no ref of its own.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
	defaultDropAnimationSideEffects,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	MeasuringStrategy,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
	type Announcements,
	type DndContextProps,
	type DragCancelEvent,
	type DragEndEvent,
	type DraggableSyntheticListeners,
	type DragOverlayProps,
	type DragStartEvent,
	type DropAnimation,
	type Modifiers,
	type UniqueIdentifier,
} from "@dnd-kit/core";
import {
	arrayMove,
	defaultAnimateLayoutChanges,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
	type AnimateLayoutChanges,
	type SortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva } from "class-variance-authority";
import * as React from "react";
import { createPortal } from "react-dom";

/* -------------------------------------------------------------------------- */
/*                                   Labels                                   */
/* -------------------------------------------------------------------------- */

/**
 * Copy a drag-and-drop surface speaks to screen readers. Each announcement
 * receives the dragged item's id (and the target's), so a product pack can
 * phrase it ("Picked up card 3"). Shared by the `sortable` and `kanban`
 * families of `UiKitLabels`.
 */
export interface DragAndDropLabels {
	/** Read when a draggable item receives focus: how to pick it up, move it, drop it and cancel. */
	readonly instructions: string;
	readonly pickedUp: (id: string) => string;
	readonly movedOver: (id: string, overId: string) => string;
	readonly movedOutside: (id: string) => string;
	readonly dropped: (id: string, overId: string) => string;
	readonly droppedOutside: (id: string) => string;
	readonly cancelled: (id: string) => string;
}

/** The `sortable` family of `UiKitLabels`. */
export type SortableLabels = DragAndDropLabels;

/** dnd-kit's `accessibility` prop: announcements, instructions, live-region container, focus restore. */
export type DragAndDropAccessibility = NonNullable<DndContextProps["accessibility"]>;

/**
 * dnd-kit's accessibility config from kit labels, with the caller's own
 * `accessibility` laid over it, so either can be replaced.
 */
export function createDragAndDropAccessibility(labels: DragAndDropLabels, accessibility: DragAndDropAccessibility | undefined): DragAndDropAccessibility {
	const announcements: Announcements = {
		onDragStart: ({ active }): string => labels.pickedUp(String(active.id)),
		onDragOver: ({ active, over }): string => (over === null ? labels.movedOutside(String(active.id)) : labels.movedOver(String(active.id), String(over.id))),
		onDragEnd: ({ active, over }): string => (over === null ? labels.droppedOutside(String(active.id)) : labels.dropped(String(active.id), String(over.id))),
		onDragCancel: ({ active }): string => labels.cancelled(String(active.id)),
	};
	return { announcements, screenReaderInstructions: { draggable: labels.instructions }, ...accessibility };
}

/* -------------------------------------------------------------------------- */
/*                               Shared drag config                           */
/* -------------------------------------------------------------------------- */

/** Pixels the mouse travels before a press becomes a drag, so a click on a handle stays a click. */
const MOUSE_ACTIVATION_DISTANCE_PX = 10;
/** A touch must rest this long (ms) before it drags, so a swipe still scrolls the page. */
const TOUCH_ACTIVATION_DELAY_MS = 250;
/** Pixels a resting touch may wander before the pending drag is abandoned. */
const TOUCH_ACTIVATION_TOLERANCE_PX = 5;
/** Opacity of the source item while its overlay copy drops into place. */
const DROP_SOURCE_OPACITY = "0.4";

/** dnd-kit sensor and measuring presets shared by the kit's drag-and-drop surfaces. */
export const DRAG_AND_DROP_PRESETS: {
	readonly mouse: { readonly activationConstraint: { readonly distance: number } };
	readonly touch: { readonly activationConstraint: { readonly delay: number; readonly tolerance: number } };
	readonly keyboard: { readonly coordinateGetter: typeof sortableKeyboardCoordinates };
	readonly measuring: NonNullable<DndContextProps["measuring"]>;
	readonly dropAnimation: DropAnimation;
	readonly animateLayoutChanges: AnimateLayoutChanges;
} = {
	mouse: { activationConstraint: { distance: MOUSE_ACTIVATION_DISTANCE_PX } },
	touch: { activationConstraint: { delay: TOUCH_ACTIVATION_DELAY_MS, tolerance: TOUCH_ACTIVATION_TOLERANCE_PX } },
	keyboard: { coordinateGetter: sortableKeyboardCoordinates },
	measuring: { droppable: { strategy: MeasuringStrategy.Always } },
	dropAnimation: { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: DROP_SOURCE_OPACITY } } }) },
	animateLayoutChanges: (args): boolean => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
};

/** Shared so every surface without modifiers passes the same (stable) list. */
export const NO_DRAG_MODIFIERS: Modifiers = [];

/**
 * Client-mount gate for the overlay portals, which need `document.body` and so
 * must not render on the server or during hydration. The never-notifying
 * subscription makes `useSyncExternalStore` return the server snapshot while
 * rendering on the server and hydrating, then `true` once mounted. The three
 * functions are module-scoped so their identities stay stable.
 */
function subscribeToNothing(): () => void {
	return (): void => undefined;
}
function getIsMounted(): boolean {
	return true;
}
function getIsMountedOnServer(): boolean {
	return false;
}

/** `true` once mounted on the client — the gate for a `document.body` portal. */
export function useIsClientMounted(): boolean {
	return React.useSyncExternalStore(subscribeToNothing, getIsMounted, getIsMountedOnServer);
}

/** True inside a drag overlay, where items render a static copy (no sortable registration). */
export const DragOverlayContext = React.createContext(false);

/* -------------------------------------------------------------------------- */
/*                                Reorder logic                               */
/* -------------------------------------------------------------------------- */

export interface SortableReorder<T> {
	readonly value: T[];
	readonly activeIndex: number;
	readonly overIndex: number;
}

/** Index of a list position that does not exist, as `findIndex` reports it. */
const NOT_FOUND = -1;

/**
 * The list after dragging `activeId` onto `overId`, with both indexes, or
 * `null` when nothing moves (either id is unknown, or the item is dropped on
 * itself). Pure, so the drop rule is testable without a drag.
 */
export function reorderSortableValue<T>(value: T[], getItemValue: (item: T) => string, activeId: UniqueIdentifier, overId: UniqueIdentifier): SortableReorder<T> | null {
	const activeIndex = value.findIndex((item) => getItemValue(item) === activeId);
	const overIndex = value.findIndex((item) => getItemValue(item) === overId);
	if (activeIndex === NOT_FOUND || overIndex === NOT_FOUND || activeIndex === overIndex) {
		return null;
	}
	return { value: arrayMove(value, activeIndex, overIndex), activeIndex, overIndex };
}

/** The first id that appears twice, or `undefined` — duplicate ids make drag and drop misbehave. */
export function findDuplicateId(ids: readonly string[]): string | undefined {
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) {
			return id;
		}
		seen.add(id);
	}
	return undefined;
}

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

export type SortableStrategy = "horizontal" | "vertical" | "grid";

const STRATEGY_MAP: Readonly<Record<SortableStrategy, SortingStrategy>> = {
	horizontal: rectSortingStrategy,
	grid: rectSortingStrategy,
	vertical: verticalListSortingStrategy,
};

interface SortableInternalContextValue {
	readonly activeId: UniqueIdentifier | null;
	readonly modifiers: Modifiers;
}

const SortableInternalContext = React.createContext<SortableInternalContextValue>({ activeId: null, modifiers: NO_DRAG_MODIFIERS });

interface SortableItemContextValue {
	readonly listeners: DraggableSyntheticListeners;
	readonly isDragging: boolean;
	readonly disabled: boolean;
}

const SortableItemContext = React.createContext<SortableItemContextValue>({ listeners: undefined, isDragging: false, disabled: false });

export interface SortableCommitMeta<T> {
	readonly event: DragEndEvent;
	readonly activeIndex: number;
	readonly overIndex: number;
	readonly previousValue: T[];
}

export interface SortableMoveEvent {
	readonly event: DragEndEvent;
	readonly activeIndex: number;
	readonly overIndex: number;
}

export interface SortableRootProps<T> extends Omit<useRender.ComponentProps<"div">, "onDragStart" | "onDragEnd" | "children"> {
	readonly value: T[];
	readonly onValueChange: (value: T[]) => void;
	/** The unique id of an item — the same string its `SortableItem value` carries. */
	readonly getItemValue: (item: T) => string;
	readonly children: React.ReactNode;
	/** Take over applying the move; `onValueChange` / `onValueCommit` are then not called. */
	readonly onMove?: ((event: SortableMoveEvent) => void) | undefined;
	/** Fired once per completed reorder, with the indexes and the value before it. */
	readonly onValueCommit?: ((value: T[], meta: SortableCommitMeta<T>) => void) | undefined;
	readonly strategy?: SortableStrategy | undefined;
	readonly onDragStart?: ((event: DragStartEvent) => void) | undefined;
	readonly onDragEnd?: ((event: DragEndEvent) => void) | undefined;
	readonly onDragCancel?: ((event: DragCancelEvent) => void) | undefined;
	/** Replaces dnd-kit accessibility settings (announcements, instructions) built from `labels`. */
	readonly accessibility?: DragAndDropAccessibility | undefined;
	readonly modifiers?: Modifiers | undefined;
	/** Per-usage overrides of the `sortable` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"sortable"> | undefined;
}

/**
 * A drag-and-drop reorderable list, grid or row over any item type. Fully
 * controlled: `value` is the order, `onValueChange` receives the next one.
 * Mouse, touch and keyboard (Space to lift, arrows to move, Space to drop,
 * Escape to cancel) all drag, with screen-reader announcements.
 */
function Sortable<T>({
	ref,
	value,
	onValueChange,
	getItemValue,
	className,
	render,
	onMove,
	onValueCommit,
	strategy = "vertical",
	onDragStart,
	onDragEnd,
	onDragCancel,
	accessibility,
	modifiers = NO_DRAG_MODIFIERS,
	labels: labelsOverride,
	children,
	...props
}: SortableRootProps<T>): React.ReactElement {
	const labels = useUiKitLabels("sortable", labelsOverride);
	const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
	const mounted = useIsClientMounted();

	const sensors = useSensors(
		useSensor(MouseSensor, DRAG_AND_DROP_PRESETS.mouse),
		useSensor(TouchSensor, DRAG_AND_DROP_PRESETS.touch),
		useSensor(KeyboardSensor, DRAG_AND_DROP_PRESETS.keyboard),
	);

	const resolvedAccessibility = React.useMemo((): DragAndDropAccessibility => createDragAndDropAccessibility(labels, accessibility), [labels, accessibility]);

	const handleDragStart = React.useCallback(
		(event: DragStartEvent): void => {
			setActiveId(event.active.id);
			onDragStart?.(event);
		},
		[onDragStart],
	);

	const handleDragEnd = React.useCallback(
		(event: DragEndEvent): void => {
			const { active, over } = event;
			setActiveId(null);
			onDragEnd?.(event);
			if (over === null) {
				return;
			}
			const reorder = reorderSortableValue(value, getItemValue, active.id, over.id);
			if (reorder === null) {
				return;
			}
			if (onMove !== undefined) {
				onMove({ event, activeIndex: reorder.activeIndex, overIndex: reorder.overIndex });
				return;
			}
			onValueChange(reorder.value);
			onValueCommit?.(reorder.value, { event, activeIndex: reorder.activeIndex, overIndex: reorder.overIndex, previousValue: value });
		},
		[value, getItemValue, onValueChange, onMove, onDragEnd, onValueCommit],
	);

	const handleDragCancel = React.useCallback(
		(event: DragCancelEvent): void => {
			setActiveId(null);
			onDragCancel?.(event);
		},
		[onDragCancel],
	);

	const itemIds = React.useMemo((): string[] => {
		const ids = value.map(getItemValue);
		const duplicate = process.env.NODE_ENV === "production" ? undefined : findDuplicateId(ids);
		if (duplicate !== undefined) {
			console.warn(`[Sortable] Duplicate item id "${duplicate}". Item ids must be unique, or drag and drop will misbehave.`);
		}
		return ids;
	}, [value, getItemValue]);

	const contextValue = React.useMemo((): SortableInternalContextValue => ({ activeId, modifiers }), [activeId, modifiers]);

	// The dragged item's own element, re-rendered as the overlay copy.
	const overlayContent = React.useMemo((): React.ReactNode => {
		if (activeId === null) {
			return null;
		}
		let result: React.ReactNode = null;
		React.Children.forEach(children, (child): void => {
			if (React.isValidElement<SortableItemProps>(child) && child.props.value === activeId) {
				result = React.cloneElement(child, { className: cn(child.props.className, "z-overlay") });
			}
		});
		return result;
	}, [activeId, children]);

	const element = useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				className: cn(activeId !== null && "cursor-grabbing!", className),
				children,
			},
			props,
		),
		state: { slot: "sortable", dragging: activeId !== null },
	});

	// dnd-kit numbers its screen-reader description ids from a global counter, which differs between
	// the server render and the browser; a stable id from React keeps hydration matching.
	const dndContextId = React.useId();

	return (
		<SortableInternalContext.Provider value={contextValue}>
			<DndContext
				id={dndContextId}
				sensors={sensors}
				modifiers={modifiers}
				accessibility={resolvedAccessibility}
				measuring={DRAG_AND_DROP_PRESETS.measuring}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={handleDragCancel}>
				<SortableContext items={itemIds} strategy={STRATEGY_MAP[strategy]}>
					{element}
				</SortableContext>
				{mounted
					? createPortal(
							<DragOverlay dropAnimation={DRAG_AND_DROP_PRESETS.dropAnimation} modifiers={modifiers} className={cn(activeId !== null && "cursor-grabbing")}>
								<DragOverlayContext.Provider value>{overlayContent}</DragOverlayContext.Provider>
							</DragOverlay>,
							document.body,
						)
					: null}
			</DndContext>
		</SortableInternalContext.Provider>
	);
}

/* -------------------------------------------------------------------------- */
/*                                    Item                                    */
/* -------------------------------------------------------------------------- */

const sortableItemVariants = cva("", {
	variants: {
		dragging: {
			true: "z-overlay opacity-50",
			false: "",
		},
		state: {
			default: "",
			loading: "cursor-wait opacity-70",
			disabled: "opacity-50",
			error: "ring-2 ring-destructive/20",
		},
	},
	defaultVariants: {
		dragging: false,
		state: "default",
	},
});

export interface SortableItemProps extends useRender.ComponentProps<"div"> {
	/** The item's unique id — what `getItemValue` returns for it. */
	readonly value: string;
	readonly disabled?: boolean | undefined;
}

const OVERLAY_ITEM_CONTEXT: SortableItemContextValue = { listeners: undefined, isDragging: true, disabled: false };

const SortableItem = React.forwardRef<HTMLDivElement, SortableItemProps>(function SortableItem(
	{ value, className, render, disabled = false, "aria-invalid": ariaInvalid, children, ...props },
	ref,
): React.ReactElement {
	const isOverlay = React.useContext(DragOverlayContext);
	const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
		id: value,
		disabled: disabled || isOverlay,
		animateLayoutChanges: DRAG_AND_DROP_PRESETS.animateLayoutChanges,
	});
	const state = resolveFieldState({ disabled, ariaInvalid });
	const itemContext = React.useMemo(
		(): SortableItemContextValue => (isOverlay ? OVERLAY_ITEM_CONTEXT : { listeners, isDragging, disabled }),
		[isOverlay, listeners, isDragging, disabled],
	);
	const style = React.useMemo((): React.CSSProperties => ({ transition, transform: CSS.Transform.toString(transform) }), [transition, transform]);

	const element = useRender({
		ref: isOverlay ? ref : [ref, setNodeRef],
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			isOverlay
				? { className: cn(className), children }
				: {
						"aria-invalid": ariaInvalid,
						style,
						...attributes,
						className: cn(sortableItemVariants({ dragging: isDragging, state }), className),
						children,
					},
			props,
		),
		state: isOverlay ? { slot: "sortable-item", value, dragging: true, disabled: false } : { slot: "sortable-item", value, dragging: isDragging, disabled },
	});

	return <SortableItemContext.Provider value={itemContext}>{element}</SortableItemContext.Provider>;
});

/* -------------------------------------------------------------------------- */
/*                                   Handle                                   */
/* -------------------------------------------------------------------------- */

export interface SortableItemHandleProps extends useRender.ComponentProps<"div"> {
	/** Show the grab / grabbing cursor. */
	readonly cursor?: boolean | undefined;
}

/** The part of an item that starts a drag. Without one, nothing in the item is a drag source. */
const SortableItemHandle = React.forwardRef<HTMLDivElement, SortableItemHandleProps>(function SortableItemHandle(
	{ className, render, cursor = true, children, ...props },
	ref,
): React.ReactElement {
	const { listeners, isDragging, disabled } = React.useContext(SortableItemContext);
	const cursorClass = isDragging ? "cursor-grabbing!" : "cursor-grab!";

	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				...listeners,
				className: cn(cursor && cursorClass, className),
				children,
			},
			props,
		),
		state: { slot: "sortable-item-handle", dragging: isDragging, disabled },
	});
});

/* -------------------------------------------------------------------------- */
/*                                   Overlay                                  */
/* -------------------------------------------------------------------------- */

export interface SortableOverlayProps extends Omit<DragOverlayProps, "children"> {
	/** What follows the pointer while dragging; a function receives the dragged item's id. */
	readonly children?: React.ReactNode | ((params: { readonly value: UniqueIdentifier }) => React.ReactNode);
}

function isOverlayRenderFunction(children: SortableOverlayProps["children"]): children is (params: { readonly value: UniqueIdentifier }) => React.ReactNode {
	return children instanceof Function;
}

/** A custom drag preview. Without one, the root shows a copy of the dragged item. */
function SortableOverlay({ children, className, ...props }: SortableOverlayProps): React.ReactElement | null {
	const { activeId, modifiers } = React.useContext(SortableInternalContext);
	const mounted = useIsClientMounted();
	if (!mounted) {
		return null;
	}
	let content: React.ReactNode = null;
	if (activeId !== null) {
		content = isOverlayRenderFunction(children) ? children({ value: activeId }) : children;
	}
	return createPortal(
		<DragOverlay dropAnimation={DRAG_AND_DROP_PRESETS.dropAnimation} modifiers={modifiers} className={cn(activeId !== null && "cursor-grabbing", className)} {...props}>
			<DragOverlayContext.Provider value>{content}</DragOverlayContext.Provider>
		</DragOverlay>,
		document.body,
	);
}

export { Sortable, SortableItem, SortableItemHandle, SortableOverlay, sortableItemVariants };
