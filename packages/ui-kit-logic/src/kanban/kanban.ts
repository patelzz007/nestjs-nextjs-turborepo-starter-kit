// Moving cards on a kanban board, and the board's columns: which column holds a card, the board after a
// card lands on another card (or a column), the board after a column moves. Pure and framework-free, so the
// web's and the phone's Kanban move cards by the same rule, and the rule is tested without a drag.

/** A card's or a column's id (dnd-kit's UniqueIdentifier on the web: a string or a number). */
export type KanbanId = string | number;

/** `items` with the entry at `from` moved to `to`. */
function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
	const next = [...items];
	const [moved] = next.splice(from, 1);
	if (moved !== undefined) {
		next.splice(to, 0, moved);
	}
	return next;
}

/** Columns in board order, each holding its items in order. */
export type KanbanValue<T> = Record<string, T[]>;

export interface KanbanItemLocation {
	readonly container: string;
	readonly index: number;
}

/** Index of a list position that does not exist, as `findIndex` reports it. */
const NOT_FOUND = -1;

/** The column holding item `id`, and its index there, or `undefined` for an unknown id. */
export function findKanbanItem<T>(columns: KanbanValue<T>, getItemValue: (item: T) => string, id: KanbanId): KanbanItemLocation | undefined {
	for (const [container, items] of Object.entries(columns)) {
		const index = items.findIndex((item) => getItemValue(item) === id);
		if (index !== NOT_FOUND) {
			return { container, index };
		}
	}
	return undefined;
}

function hasColumn<T>(columns: KanbanValue<T>, id: KanbanId): boolean {
	return Object.keys(columns).some((key) => key === id);
}

/**
 * The board after moving item `activeId` onto `overId` — another item (it
 * takes that item's place) or a column (it goes to the end) — or `null` when
 * nothing moves. Pure, so the move rule is testable without a drag.
 */
export function moveKanbanItem<T>(columns: KanbanValue<T>, getItemValue: (item: T) => string, activeId: KanbanId, overId: KanbanId): KanbanValue<T> | null {
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
export function reorderKanbanColumns<T>(columns: KanbanValue<T>, activeId: KanbanId, overId: KanbanId): KanbanValue<T> | null {
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
