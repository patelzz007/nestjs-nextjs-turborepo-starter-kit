"use client";

// Ported from ReUI (https://reui.io/r/base-vega/kanban.json). Part names, props,
// `data-slot` / `data-dragging` / `data-disabled` attributes and composition match
// ReUI, so its docs and examples apply, with these deliberate deviations:
// - Every part forwards its ref. The generic root `Kanban<T>` takes `ref` as a
//   React 19 prop, since `forwardRef` would erase `T`; the parts use `forwardRef`.
// - The shared context is not generic: the root hands the parts each column's
//   item ids, so no part needs the item type.
// - Screen-reader instructions and announcements come from the `kanban` family
//   of `UiKitLabels`; `labels` overrides single strings, `accessibility` dnd-kit.
// - The move rules are pure, exported functions (`findKanbanItem`,
//   `moveKanbanItem`, `reorderKanbanColumns`).
// - `KanbanColumn` and `KanbanItem` take a CVA `state` (`disabled`), and a
//   `locked` prop: the part stays where it is (it cannot be dragged) but looks
//   live — a board whose columns are fixed, or whose cards are sorted, is not
//   an unavailable board. `disabled` keeps meaning "unavailable" and dims it.
// - `KanbanOverlay` renders dnd-kit's `DragOverlay`, which has no ref of its own.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
	closestCenter,
	DndContext,
	DragOverlay,
	getFirstCollision,
	KeyboardSensor,
	MouseSensor,
	pointerWithin,
	rectIntersection,
	TouchSensor,
	useSensor,
	useSensors,
	type CollisionDetection,
	type DragCancelEvent,
	type DragEndEvent,
	type DraggableAttributes,
	type DraggableSyntheticListeners,
	type DragOverEvent,
	type DragOverlayProps,
	type DragStartEvent,
	type Modifiers,
	type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	createDragAndDropAccessibility,
	DRAG_AND_DROP_PRESETS,
	DragOverlayContext,
	findDuplicateId,
	NO_DRAG_MODIFIERS,
	sortableItemVariants,
	useIsClientMounted,
	type DragAndDropAccessibility,
	type DragAndDropLabels,
} from "@workspace/ui/components/sortable";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";
import { createPortal } from "react-dom";

/** The `kanban` family of `UiKitLabels`. */
export type KanbanLabels = DragAndDropLabels;

/** Columns in board order, each holding its items in order. */
export type KanbanValue<T> = Record<string, T[]>;

/* -------------------------------------------------------------------------- */
/*                                 Move logic                                 */
/* -------------------------------------------------------------------------- */

export interface KanbanItemLocation {
	readonly container: string;
	readonly index: number;
}

/** Index of a list position that does not exist, as `findIndex` reports it. */
const NOT_FOUND = -1;

/** The column holding item `id`, and its index there, or `undefined` for an unknown id. */
export function findKanbanItem<T>(columns: KanbanValue<T>, getItemValue: (item: T) => string, id: UniqueIdentifier): KanbanItemLocation | undefined {
	for (const [container, items] of Object.entries(columns)) {
		const index = items.findIndex((item) => getItemValue(item) === id);
		if (index !== NOT_FOUND) {
			return { container, index };
		}
	}
	return undefined;
}

function hasColumn<T>(columns: KanbanValue<T>, id: UniqueIdentifier): boolean {
	return Object.keys(columns).some((key) => key === id);
}

/**
 * The board after moving item `activeId` onto `overId` — another item (it
 * takes that item's place) or a column (it goes to the end) — or `null` when
 * nothing moves. Pure, so the move rule is testable without a drag.
 */
export function moveKanbanItem<T>(columns: KanbanValue<T>, getItemValue: (item: T) => string, activeId: UniqueIdentifier, overId: UniqueIdentifier): KanbanValue<T> | null {
	const from = findKanbanItem(columns, getItemValue, activeId);
	if (from === undefined) {
		return null;
	}
	const overIsColumn = hasColumn(columns, overId);
	const target = overIsColumn ? String(overId) : findKanbanItem(columns, getItemValue, overId)?.container;
	if (target === undefined) {
		return null;
	}
	const sourceItems = columns[from.container] ?? [];
	const targetItems = columns[target] ?? [];

	if (from.container === target) {
		const overIndex = overIsColumn ? targetItems.length - 1 : targetItems.findIndex((item) => getItemValue(item) === overId);
		if (overIndex === NOT_FOUND || overIndex === from.index) {
			return null;
		}
		return { ...columns, [target]: arrayMove(targetItems, from.index, overIndex) };
	}

	const overIndex = overIsColumn ? targetItems.length : targetItems.findIndex((item) => getItemValue(item) === overId);
	const moved = sourceItems.at(from.index);
	if (moved === undefined || overIndex === NOT_FOUND) {
		return null;
	}
	const nextSource = sourceItems.filter((_item, index) => index !== from.index);
	const nextTarget = [...targetItems.slice(0, overIndex), moved, ...targetItems.slice(overIndex)];
	return { ...columns, [from.container]: nextSource, [target]: nextTarget };
}

/** The board with column `activeId` moved to column `overId`'s place, or `null` when nothing moves. */
export function reorderKanbanColumns<T>(columns: KanbanValue<T>, activeId: UniqueIdentifier, overId: UniqueIdentifier): KanbanValue<T> | null {
	const keys = Object.keys(columns);
	const activeIndex = keys.findIndex((key) => key === activeId);
	const overIndex = keys.findIndex((key) => key === overId);
	if (activeIndex === NOT_FOUND || overIndex === NOT_FOUND || activeIndex === overIndex) {
		return null;
	}
	const next: KanbanValue<T> = {};
	for (const key of arrayMove(keys, activeIndex, overIndex)) {
		next[key] = columns[key] ?? [];
	}
	return next;
}

/* -------------------------------------------------------------------------- */
/*                                   Context                                  */
/* -------------------------------------------------------------------------- */

interface KanbanContextValue {
	readonly columnIds: string[];
	readonly itemIdsByColumn: Readonly<Record<string, string[]>>;
	readonly activeId: UniqueIdentifier | null;
	readonly isColumn: (id: UniqueIdentifier) => boolean;
	readonly modifiers: Modifiers;
}

const NO_ITEM_IDS: Readonly<Record<string, string[]>> = {};

const KanbanContext = React.createContext<KanbanContextValue>({
	columnIds: [],
	itemIdsByColumn: NO_ITEM_IDS,
	activeId: null,
	isColumn: (): boolean => false,
	modifiers: NO_DRAG_MODIFIERS,
});

interface ColumnContextValue {
	readonly attributes: DraggableAttributes | undefined;
	readonly listeners: DraggableSyntheticListeners;
	readonly isDragging: boolean;
	readonly disabled: boolean;
}

const ColumnContext = React.createContext<ColumnContextValue>({ attributes: undefined, listeners: undefined, isDragging: false, disabled: false });

interface ItemContextValue {
	readonly listeners: DraggableSyntheticListeners;
	readonly isDragging: boolean;
	readonly disabled: boolean;
}

const ItemContext = React.createContext<ItemContextValue>({ listeners: undefined, isDragging: false, disabled: false });

const OVERLAY_COLUMN_CONTEXT: ColumnContextValue = { attributes: undefined, listeners: undefined, isDragging: true, disabled: false };
const OVERLAY_ITEM_CONTEXT: ItemContextValue = { listeners: undefined, isDragging: true, disabled: false };

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

export interface KanbanMoveEvent {
	readonly event: DragEndEvent;
	readonly activeContainer: string;
	readonly activeIndex: number;
	readonly overContainer: string;
	readonly overIndex: number;
}

export type KanbanCommitKind = "item" | "column";

export interface KanbanCommitMeta<T> {
	readonly kind: KanbanCommitKind;
	readonly event: DragEndEvent;
	readonly activeContainer: string;
	readonly activeIndex: number;
	readonly overContainer: string;
	readonly overIndex: number;
	readonly previousValue: KanbanValue<T>;
}

export interface KanbanRootProps<T> extends Omit<useRender.ComponentProps<"div">, "children" | "onDragStart" | "onDragEnd"> {
	readonly value: KanbanValue<T>;
	readonly onValueChange: (value: KanbanValue<T>) => void;
	/** The unique id of an item (unique across every column) — what its `KanbanItem value` carries. */
	readonly getItemValue: (item: T) => string;
	readonly children: React.ReactNode;
	/** Take over applying item moves (no live preview); column reorders still apply. */
	readonly onMove?: ((event: KanbanMoveEvent) => void) | undefined;
	/** Fired once per completed move, with where it started and the value before the drag. */
	readonly onValueCommit?: ((value: KanbanValue<T>, meta: KanbanCommitMeta<T>) => void) | undefined;
	/** Undo the live-preview moves when a drag is cancelled (Escape). */
	readonly restoreOnCancel?: boolean | undefined;
	readonly onDragStart?: ((event: DragStartEvent) => void) | undefined;
	readonly onDragEnd?: ((event: DragEndEvent) => void) | undefined;
	readonly onDragCancel?: ((event: DragCancelEvent) => void) | undefined;
	/** Replaces dnd-kit accessibility settings (announcements, instructions) built from `labels`. */
	readonly accessibility?: DragAndDropAccessibility | undefined;
	readonly modifiers?: Modifiers | undefined;
	/** Per-usage overrides of the `kanban` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"kanban"> | undefined;
}

interface DragOrigin<T> {
	readonly value: KanbanValue<T>;
	readonly container: string | undefined;
	readonly index: number;
}

function locateDragOrigin<T>(snapshot: KanbanValue<T>, getItemValue: (item: T) => string, id: UniqueIdentifier): DragOrigin<T> {
	const columnIndex = Object.keys(snapshot).findIndex((key) => key === id);
	if (columnIndex !== NOT_FOUND) {
		return { value: snapshot, container: String(id), index: columnIndex };
	}
	const location = findKanbanItem(snapshot, getItemValue, id);
	return { value: snapshot, container: location?.container, index: location?.index ?? NOT_FOUND };
}

/**
 * A drag-and-drop board over any item type. Fully controlled: `value` maps each
 * column id to its items, `onValueChange` receives every change (items preview
 * their new place while dragging). Items move within and across columns, and
 * columns reorder by their `KanbanColumnHandle`, by mouse, touch or keyboard.
 */
function Kanban<T>({
	ref,
	value,
	onValueChange,
	getItemValue,
	children,
	className,
	render,
	onMove,
	onValueCommit,
	restoreOnCancel = false,
	onDragStart,
	onDragEnd,
	onDragCancel,
	accessibility,
	modifiers = NO_DRAG_MODIFIERS,
	labels: labelsOverride,
	...props
}: KanbanRootProps<T>): React.ReactElement {
	const labels = useUiKitLabels("kanban", labelsOverride);
	const columns = value;
	const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);

	// Always-current mirrors so the drag handlers read fresh values without
	// widening their dependency arrays. The handlers only fire after commit, so
	// syncing the mirrors in a layout effect is safe.
	const valueRef = React.useRef(value);
	const getItemValueRef = React.useRef(getItemValue);
	React.useLayoutEffect((): void => {
		valueRef.current = value;
		getItemValueRef.current = getItemValue;
	});
	const dragOriginRef = React.useRef<DragOrigin<T> | null>(null);
	const lastOverIdRef = React.useRef<UniqueIdentifier | null>(null);

	const sensors = useSensors(
		useSensor(MouseSensor, DRAG_AND_DROP_PRESETS.mouse),
		useSensor(TouchSensor, DRAG_AND_DROP_PRESETS.touch),
		useSensor(KeyboardSensor, DRAG_AND_DROP_PRESETS.keyboard),
	);

	const resolvedAccessibility = React.useMemo((): DragAndDropAccessibility => createDragAndDropAccessibility(labels, accessibility), [labels, accessibility]);

	const columnIds = React.useMemo((): string[] => Object.keys(columns), [columns]);

	const itemIdsByColumn = React.useMemo((): Record<string, string[]> => {
		const byColumn: Record<string, string[]> = {};
		for (const [key, items] of Object.entries(columns)) {
			byColumn[key] = items.map(getItemValue);
		}
		const duplicate = process.env.NODE_ENV === "production" ? undefined : findDuplicateId(Object.values(byColumn).flat());
		if (duplicate !== undefined) {
			console.warn(`[Kanban] Duplicate item id "${duplicate}". Item ids must be unique across all columns, or drag and drop will misbehave.`);
		}
		return byColumn;
	}, [columns, getItemValue]);

	const isColumn = React.useCallback((id: UniqueIdentifier): boolean => columnIds.some((key) => key === id), [columnIds]);

	// The droppable under the pointer, not the one the dragged rect overlaps
	// most: in the gap between columns that overlap flips with every live-preview
	// move, and each flip re-runs dragOver until React bails out.
	const collisionDetection = React.useCallback<CollisionDetection>(
		(args) => {
			if (isColumn(args.active.id)) {
				return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((container) => isColumn(container.id)) });
			}
			// Keyboard drags carry no pointer.
			if (args.pointerCoordinates === null) {
				return rectIntersection(args);
			}
			let overId = getFirstCollision(pointerWithin(args), "id");
			if (overId !== null) {
				// Over a column's empty space: resolve to its closest item, if any.
				if (isColumn(overId)) {
					const itemIds = new Set(itemIdsByColumn[String(overId)] ?? []);
					const [closest] = closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((container) => itemIds.has(String(container.id))) });
					overId = closest?.id ?? overId;
				}
				lastOverIdRef.current = overId;
				return [{ id: overId }];
			}
			// Between droppables: hold the last target so the preview stays put.
			return lastOverIdRef.current === null ? rectIntersection(args) : [{ id: lastOverIdRef.current }];
		},
		[isColumn, itemIdsByColumn],
	);

	const commitChange = React.useCallback(
		(finalValue: KanbanValue<T>, event: DragEndEvent, kind: KanbanCommitKind): void => {
			const origin = dragOriginRef.current;
			if (onValueCommit === undefined || origin === null) {
				return;
			}
			const id = event.active.id;
			if (kind === "column") {
				const overIndex = Object.keys(finalValue).findIndex((key) => key === id);
				if (overIndex === NOT_FOUND || overIndex === origin.index) {
					return;
				}
				onValueCommit(finalValue, {
					kind,
					event,
					activeContainer: String(id),
					activeIndex: origin.index,
					overContainer: String(event.over?.id ?? id),
					overIndex,
					previousValue: origin.value,
				});
				return;
			}
			const location = findKanbanItem(finalValue, getItemValueRef.current, id);
			if (location === undefined || (location.container === origin.container && location.index === origin.index)) {
				return;
			}
			onValueCommit(finalValue, {
				kind,
				event,
				activeContainer: origin.container ?? location.container,
				activeIndex: origin.index,
				overContainer: location.container,
				overIndex: location.index,
				previousValue: origin.value,
			});
		},
		[onValueCommit],
	);

	const handleDragStart = React.useCallback(
		(event: DragStartEvent): void => {
			lastOverIdRef.current = null;
			setActiveId(event.active.id);
			onDragStart?.(event);
			if (onValueCommit !== undefined || restoreOnCancel) {
				dragOriginRef.current = locateDragOrigin(valueRef.current, getItemValueRef.current, event.active.id);
			}
		},
		[onDragStart, onValueCommit, restoreOnCancel],
	);

	// Live preview: an item takes its new place while it is dragged.
	const handleDragOver = React.useCallback(
		(event: DragOverEvent): void => {
			const { active, over } = event;
			if (onMove !== undefined || over === null || isColumn(active.id)) {
				return;
			}
			const next = moveKanbanItem(columns, getItemValue, active.id, over.id);
			if (next !== null) {
				onValueChange(next);
			}
		},
		[columns, getItemValue, isColumn, onMove, onValueChange],
	);

	const handleDragCancel = React.useCallback(
		(event: DragCancelEvent): void => {
			const origin = dragOriginRef.current;
			if (origin !== null && onMove === undefined) {
				if (restoreOnCancel) {
					// Escape / cancel: undo the live-preview reshuffle applied during dragOver.
					onValueChange(origin.value);
				} else {
					// No restore requested: the live preview stays visible, so commit it.
					commitChange(valueRef.current, event, "item");
				}
			}
			dragOriginRef.current = null;
			lastOverIdRef.current = null;
			setActiveId(null);
			onDragCancel?.(event);
		},
		[restoreOnCancel, onMove, onValueChange, onDragCancel, commitChange],
	);

	const handleDragEnd = React.useCallback(
		(event: DragEndEvent): void => {
			const { active, over } = event;
			lastOverIdRef.current = null;
			setActiveId(null);
			onDragEnd?.(event);

			const finish = (): void => {
				dragOriginRef.current = null;
			};

			if (over === null) {
				// Released over nothing: the live preview may already have moved the item.
				commitChange(valueRef.current, event, "item");
				finish();
				return;
			}

			if (isColumn(active.id)) {
				const next = isColumn(over.id) ? reorderKanbanColumns(columns, active.id, over.id) : null;
				if (next !== null) {
					onValueChange(next);
					commitChange(next, event, "column");
				}
				finish();
				return;
			}

			if (onMove !== undefined) {
				const from = findKanbanItem(columns, getItemValue, active.id);
				const overContainer = isColumn(over.id) ? String(over.id) : findKanbanItem(columns, getItemValue, over.id)?.container;
				if (from !== undefined && overContainer !== undefined) {
					const overItems = columns[overContainer] ?? [];
					const overIndex = isColumn(over.id) ? overItems.length : overItems.findIndex((item) => getItemValue(item) === over.id);
					onMove({ event, activeContainer: from.container, activeIndex: from.index, overContainer, overIndex });
				}
				// The consumer owns item moves in this mode, so they never commit here.
				finish();
				return;
			}

			// Cross-column moves were applied during dragOver; only a same-column reorder is left.
			const next = moveKanbanItem(columns, getItemValue, active.id, over.id);
			const from = findKanbanItem(columns, getItemValue, active.id);
			const overContainer = isColumn(over.id) ? String(over.id) : findKanbanItem(columns, getItemValue, over.id)?.container;
			if (next !== null && from !== undefined && from.container === overContainer) {
				onValueChange(next);
				commitChange(next, event, "item");
			} else {
				commitChange(columns, event, "item");
			}
			finish();
		},
		[columns, getItemValue, isColumn, onValueChange, onMove, onDragEnd, commitChange],
	);

	const contextValue = React.useMemo(
		(): KanbanContextValue => ({ columnIds, itemIdsByColumn, activeId, isColumn, modifiers }),
		[columnIds, itemIdsByColumn, activeId, isColumn, modifiers],
	);

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
		state: { slot: "kanban", dragging: activeId !== null },
	});

	// dnd-kit numbers its screen-reader description ids from a global counter, which differs between
	// the server render and the browser; a stable id from React keeps hydration matching.
	const dndContextId = React.useId();

	return (
		<KanbanContext.Provider value={contextValue}>
			<DndContext
				id={dndContextId}
				sensors={sensors}
				modifiers={modifiers}
				accessibility={resolvedAccessibility}
				measuring={DRAG_AND_DROP_PRESETS.measuring}
				collisionDetection={collisionDetection}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragEnd={handleDragEnd}
				onDragCancel={handleDragCancel}>
				{element}
			</DndContext>
		</KanbanContext.Provider>
	);
}

/* -------------------------------------------------------------------------- */
/*                                    Board                                   */
/* -------------------------------------------------------------------------- */

export type KanbanBoardProps = useRender.ComponentProps<"div">;

/** The columns' layout and their sortable context (columns reorder here). */
const KanbanBoard = React.forwardRef<HTMLDivElement, KanbanBoardProps>(function KanbanBoard({ className, render, children, ...props }, ref): React.ReactElement {
	const { columnIds } = React.useContext(KanbanContext);
	const element = useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">({ className: cn("grid auto-rows-fr gap-4 sm:grid-cols-3", className), children }, props),
		state: { slot: "kanban-board" },
	});
	return (
		<SortableContext items={columnIds} strategy={rectSortingStrategy}>
			{element}
		</SortableContext>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Column                                   */
/* -------------------------------------------------------------------------- */

export interface KanbanColumnProps extends useRender.ComponentProps<"div"> {
	/** The column's id — its key in the Kanban `value`. */
	readonly value: string;
	/** Unavailable: cannot be dragged, and is drawn dimmed. */
	readonly disabled?: boolean | undefined;
	/** Fixed in place: cannot be dragged, but is drawn as usual (`data-locked`). */
	readonly locked?: boolean | undefined;
}

const KanbanColumn = React.forwardRef<HTMLDivElement, KanbanColumnProps>(function KanbanColumn(
	{ value, className, render, disabled = false, locked = false, "aria-invalid": ariaInvalid, children, ...props },
	ref,
): React.ReactElement {
	const isOverlay = React.useContext(DragOverlayContext);
	const isFixed = disabled || locked;
	const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
		id: value,
		disabled: isFixed || isOverlay,
		animateLayoutChanges: DRAG_AND_DROP_PRESETS.animateLayoutChanges,
	});
	const { activeId, isColumn } = React.useContext(KanbanContext);
	const isColumnDragging = activeId === null ? false : isColumn(activeId);
	const state = resolveFieldState({ disabled, ariaInvalid });
	const style = React.useMemo((): React.CSSProperties => ({ transition, transform: CSS.Transform.toString(transform) }), [transition, transform]);
	const columnContext = React.useMemo(
		(): ColumnContextValue => (isOverlay ? OVERLAY_COLUMN_CONTEXT : { attributes, listeners, isDragging: isColumnDragging, disabled: isFixed }),
		[isOverlay, attributes, listeners, isColumnDragging, isFixed],
	);

	const element = useRender({
		ref: isOverlay ? ref : [ref, setNodeRef],
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			isOverlay
				? { className: cn("group/kanban-column flex flex-col", className), children }
				: {
						"aria-invalid": ariaInvalid,
						style,
						className: cn("group/kanban-column flex flex-col", sortableItemVariants({ dragging: isDragging, state }), className),
						children,
					},
			props,
		),
		state: isOverlay
			? { slot: "kanban-column", value, dragging: true, disabled: false, locked: false }
			: { slot: "kanban-column", value, dragging: isDragging, disabled, locked: locked && !disabled },
	});

	return <ColumnContext.Provider value={columnContext}>{element}</ColumnContext.Provider>;
});

export interface KanbanColumnHandleProps extends useRender.ComponentProps<"div"> {
	/** Show the grab / grabbing cursor. */
	readonly cursor?: boolean | undefined;
}

/** Drags its column. Revealed on column hover and on keyboard focus. */
const KanbanColumnHandle = React.forwardRef<HTMLDivElement, KanbanColumnHandleProps>(function KanbanColumnHandle(
	{ className, render, cursor = true, children, ...props },
	ref,
): React.ReactElement {
	const { attributes, listeners, isDragging, disabled } = React.useContext(ColumnContext);
	const cursorClass = isDragging ? "cursor-grabbing!" : "cursor-grab!";
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				...attributes,
				...listeners,
				className: cn(
					// Keyboard focus shows it too. focus-within would also match the focus
					// a mousedown gives the handle, so it would stay shown after a drag.
					"opacity-0 transition-opacity group-hover/kanban-column:opacity-100 focus-visible:opacity-100 has-focus-visible:opacity-100 motion-reduce:transition-none",
					cursor && cursorClass,
					className,
				),
				children,
			},
			props,
		),
		state: { slot: "kanban-column-handle", dragging: isDragging, disabled },
	});
});

/* -------------------------------------------------------------------------- */
/*                                    Item                                    */
/* -------------------------------------------------------------------------- */

export interface KanbanItemProps extends useRender.ComponentProps<"div"> {
	/** The item's id — what `getItemValue` returns for it. */
	readonly value: string;
	/** Unavailable: cannot be dragged, and is drawn dimmed. */
	readonly disabled?: boolean | undefined;
	/** Fixed in place: cannot be dragged, but is drawn as usual (`data-locked`). */
	readonly locked?: boolean | undefined;
}

const KanbanItem = React.forwardRef<HTMLDivElement, KanbanItemProps>(function KanbanItem(
	{ value, className, render, disabled = false, locked = false, "aria-invalid": ariaInvalid, children, ...props },
	ref,
): React.ReactElement {
	const isOverlay = React.useContext(DragOverlayContext);
	const isFixed = disabled || locked;
	const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
		id: value,
		disabled: isFixed || isOverlay,
		animateLayoutChanges: DRAG_AND_DROP_PRESETS.animateLayoutChanges,
	});
	const { activeId, isColumn } = React.useContext(KanbanContext);
	const isItemDragging = activeId === null ? false : !isColumn(activeId);
	const state = resolveFieldState({ disabled, ariaInvalid });
	const style = React.useMemo((): React.CSSProperties => ({ transition, transform: CSS.Transform.toString(transform) }), [transition, transform]);
	const itemContext = React.useMemo(
		(): ItemContextValue => (isOverlay ? OVERLAY_ITEM_CONTEXT : { listeners, isDragging: isItemDragging, disabled: isFixed }),
		[isOverlay, listeners, isItemDragging, isFixed],
	);

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
		state: isOverlay
			? { slot: "kanban-item", value, dragging: true, disabled: false, locked: false }
			: { slot: "kanban-item", value, dragging: isDragging, disabled, locked: locked && !disabled },
	});

	return <ItemContext.Provider value={itemContext}>{element}</ItemContext.Provider>;
});

export interface KanbanItemHandleProps extends useRender.ComponentProps<"div"> {
	/** Show the grab / grabbing cursor. */
	readonly cursor?: boolean | undefined;
}

/** The part of an item that starts a drag. Without one, nothing in the item is a drag source. */
const KanbanItemHandle = React.forwardRef<HTMLDivElement, KanbanItemHandleProps>(function KanbanItemHandle(
	{ className, render, cursor = true, children, ...props },
	ref,
): React.ReactElement {
	const { listeners, isDragging, disabled } = React.useContext(ItemContext);
	const cursorClass = isDragging ? "cursor-grabbing!" : "cursor-grab!";
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">({ ...listeners, className: cn(cursor && cursorClass, className), children }, props),
		state: { slot: "kanban-item-handle", dragging: isDragging, disabled },
	});
});

/* -------------------------------------------------------------------------- */
/*                               Column content                               */
/* -------------------------------------------------------------------------- */

export interface KanbanColumnContentProps extends useRender.ComponentProps<"div"> {
	/** The column's id — the same `value` as its `KanbanColumn`. */
	readonly value: string;
}

/** The column's item list and its sortable context. Throws for a column id not in the Kanban `value`. */
const KanbanColumnContent = React.forwardRef<HTMLDivElement, KanbanColumnContentProps>(function KanbanColumnContent(
	{ value, className, render, children, ...props },
	ref,
): React.ReactElement {
	const { itemIdsByColumn, columnIds } = React.useContext(KanbanContext);
	const itemIds = itemIdsByColumn[value];
	if (itemIds === undefined) {
		throw new Error(`KanbanColumnContent: column "${value}" was not found in the Kanban value. Available columns: ${columnIds.join(", ") || "(none)"}.`);
	}
	const element = useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">({ className: cn("flex flex-col gap-2", className), children }, props),
		state: { slot: "kanban-column-content" },
	});
	return (
		<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
			{element}
		</SortableContext>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Overlay                                  */
/* -------------------------------------------------------------------------- */

export type KanbanOverlayVariant = "column" | "item";

export interface KanbanOverlayRenderParams {
	readonly value: UniqueIdentifier;
	readonly variant: KanbanOverlayVariant;
}

export interface KanbanOverlayProps extends Omit<DragOverlayProps, "children"> {
	/** What follows the pointer while dragging; a function receives the dragged id and whether it is a column or an item. */
	readonly children?: React.ReactNode | ((params: KanbanOverlayRenderParams) => React.ReactNode);
}

function isOverlayRenderFunction(children: KanbanOverlayProps["children"]): children is (params: KanbanOverlayRenderParams) => React.ReactNode {
	return children instanceof Function;
}

/** The drag preview. Render the dragged column or item inside it (static copies: they do not register as sortable). */
function KanbanOverlay({ children, className, ...props }: KanbanOverlayProps): React.ReactElement | null {
	const { activeId, isColumn, modifiers } = React.useContext(KanbanContext);
	const mounted = useIsClientMounted();
	if (!mounted) {
		return null;
	}
	let content: React.ReactNode = null;
	if (activeId !== null) {
		content = isOverlayRenderFunction(children) ? children({ value: activeId, variant: isColumn(activeId) ? "column" : "item" }) : children;
	}
	return createPortal(
		<DragOverlay dropAnimation={DRAG_AND_DROP_PRESETS.dropAnimation} modifiers={modifiers} className={cn(activeId !== null && "cursor-grabbing", className)} {...props}>
			<DragOverlayContext.Provider value>{content}</DragOverlayContext.Provider>
		</DragOverlay>,
		document.body,
	);
}

export { Kanban, KanbanBoard, KanbanColumn, KanbanColumnHandle, KanbanItem, KanbanItemHandle, KanbanColumnContent, KanbanOverlay };
