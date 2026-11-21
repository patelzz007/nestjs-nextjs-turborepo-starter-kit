// The undo and redo stacks of a table's cell edits, shared by the web and native kits. Pure and immutable: every
// operation returns a new history. It stores what changed, never the rows, so the caller's data stays the only copy.

/** One cell edit, as undo needs it: where, and the value before and after. */
export interface DataTableEditStep<TValue> {
	readonly rowId: string;
	readonly columnId: string;
	readonly previousValue: TValue;
	readonly value: TValue;
}

export interface DataTableEditHistory<TValue> {
	/** Oldest first; the last step is the one undo takes back. */
	readonly past: readonly DataTableEditStep<TValue>[];
	/** Most recently undone last; the last step is the one redo applies again. */
	readonly future: readonly DataTableEditStep<TValue>[];
}

/** How many edits undo can reach back. Older ones are dropped. */
export const DATA_TABLE_EDIT_HISTORY_LIMIT = 100;

export function createDataTableEditHistory<TValue>(): DataTableEditHistory<TValue> {
	return { past: [], future: [] };
}

/** The history after a new edit: it can be undone, and anything undone before it can no longer be redone. */
export function pushDataTableEdit<TValue>(
	history: DataTableEditHistory<TValue>,
	step: DataTableEditStep<TValue>,
	limit = DATA_TABLE_EDIT_HISTORY_LIMIT,
): DataTableEditHistory<TValue> {
	return { past: [...history.past, step].slice(-limit), future: [] };
}

/** What undo does: the step to write back (its values swapped), and the history after it. `null` when there is nothing to undo. */
export function undoDataTableEdit<TValue>(
	history: DataTableEditHistory<TValue>,
): { readonly step: DataTableEditStep<TValue>; readonly history: DataTableEditHistory<TValue> } | null {
	const last = history.past.at(-1);
	if (last === undefined) {
		return null;
	}
	return {
		step: { rowId: last.rowId, columnId: last.columnId, previousValue: last.value, value: last.previousValue },
		history: { past: history.past.slice(0, -1), future: [...history.future, last] },
	};
}

/** What redo does: the step to write again, and the history after it. `null` when there is nothing to redo. */
export function redoDataTableEdit<TValue>(
	history: DataTableEditHistory<TValue>,
): { readonly step: DataTableEditStep<TValue>; readonly history: DataTableEditHistory<TValue> } | null {
	const next = history.future.at(-1);
	if (next === undefined) {
		return null;
	}
	return { step: next, history: { past: [...history.past, next], future: history.future.slice(0, -1) } };
}
