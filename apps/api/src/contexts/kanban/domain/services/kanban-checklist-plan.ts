import { KanbanChecklistItemNotFoundError } from "../errors/kanban.errors";

/** A live checklist row as stored. */
export interface KanbanChecklistRow {
	readonly id: string;
	readonly title: string;
	readonly depth: number;
	readonly isDone: boolean;
	readonly assigneeId: string | null;
	readonly position: number;
}

/** A row of an edit, in order: `id` names a stored row, no `id` is a new one. */
export interface KanbanChecklistRowInput {
	readonly id?: string | undefined;
	readonly title: string;
	readonly depth: number;
	readonly isDone: boolean;
	readonly assigneeId: string | null;
}

/** What replacing a stored list with an edit's list writes. */
export interface KanbanChecklistPlan {
	/** New rows, with the ids they are created under. */
	readonly creates: readonly KanbanChecklistRow[];
	/** Kept rows whose title, depth, state, assignee or position changed. */
	readonly updates: readonly KanbanChecklistRow[];
	/** Stored rows the edit left out: soft-deleted. */
	readonly removals: readonly string[];
	/** True when the list reads differently afterwards (anything above is non-empty). */
	readonly changed: boolean;
}

function sameRow(left: KanbanChecklistRow, right: KanbanChecklistRow): boolean {
	return left.title === right.title && left.depth === right.depth && left.isDone === right.isDone && left.assigneeId === right.assigneeId && left.position === right.position;
}

/**
 * Replaces `stored` with `incoming`, by id: a row naming a stored row keeps it
 * (and its history), a row without an id is created under `nextId()`, a stored
 * row left out is removed. Positions follow the incoming order. A row naming an
 * id this list does not hold is refused, so an edit cannot reach another item's rows.
 */
export function planChecklistReplacement(stored: readonly KanbanChecklistRow[], incoming: readonly KanbanChecklistRowInput[], nextId: () => string): KanbanChecklistPlan {
	const byId = new Map(stored.map((row): [string, KanbanChecklistRow] => [row.id, row]));
	const creates: KanbanChecklistRow[] = [];
	const updates: KanbanChecklistRow[] = [];
	const kept = new Set<string>();

	incoming.forEach((input, position): void => {
		const fields = { title: input.title, depth: input.depth, isDone: input.isDone, assigneeId: input.assigneeId, position };
		if (input.id === undefined) {
			creates.push({ id: nextId(), ...fields });
			return;
		}
		const current = byId.get(input.id);
		if (current === undefined) {
			throw new KanbanChecklistItemNotFoundError(input.id);
		}
		kept.add(input.id);
		const next: KanbanChecklistRow = { id: input.id, ...fields };
		if (!sameRow(current, next)) {
			updates.push(next);
		}
	});

	const removals = stored.filter((row) => !kept.has(row.id)).map((row) => row.id);
	return { creates, updates, removals, changed: creates.length > 0 || updates.length > 0 || removals.length > 0 };
}
