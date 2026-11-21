// Where a dragged row lands, shared by the web and native kits. Pure: rows are named by id, and a row moves only among
// its siblings (the rows with the same parent), so a tree is never rearranged across branches.

/** One row on screen, as the move needs it: its id, and its parent's id (`null` at the top level). */
export interface DataTableReorderRow {
	readonly id: string;
	readonly parentId: string | null;
}

/** What moved, by row id. `orderedIds` is the new order of the moved row and its siblings, as they were on screen. */
export interface DataTableRowMove {
	readonly activeId: string;
	readonly overId: string;
	/** The parent whose children were reordered; `null` at the top level and in a table without a tree. */
	readonly parentId: string | null;
	readonly orderedIds: readonly string[];
}

/**
 * The move a drop makes, or `null` when it makes none: the row was dropped on itself, on a row that is not on screen,
 * or on a row with another parent. Dragging down lands after the target, dragging up before it.
 */
export function resolveDataTableRowMove(rows: readonly DataTableReorderRow[], activeId: string, overId: string): DataTableRowMove | null {
	if (activeId === overId) {
		return null;
	}
	const active = rows.find((row) => row.id === activeId);
	const over = rows.find((row) => row.id === overId);
	if (active === undefined || over === undefined || active.parentId !== over.parentId) {
		return null;
	}
	const siblingIds = rows.filter((row) => row.parentId === active.parentId).map((row) => row.id);
	const activeIndex = siblingIds.indexOf(activeId);
	const overIndex = siblingIds.indexOf(overId);
	const withoutActive = siblingIds.filter((id) => id !== activeId);
	const insertAt = withoutActive.indexOf(overId) + (activeIndex < overIndex ? 1 : 0);
	return { activeId, overId, parentId: active.parentId, orderedIds: [...withoutActive.slice(0, insertAt), activeId, ...withoutActive.slice(insertAt)] };
}
