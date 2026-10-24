import { KANBAN_BOARD_OF_TYPE, type KanbanBoardKind, type KanbanItemType } from "@workspace/shared";

import { KanbanBoardMismatchError } from "../errors/kanban.errors";

/** A column as the level check reads it: its id and the board it belongs to. */
export interface KanbanColumnOfBoard {
	readonly id: string;
	readonly board: KanbanBoardKind;
}

/**
 * THE check that an item of `type` may sit in `column`: epics and features in a
 * planning column, stories, tasks and subtasks in an execution column. Every
 * write that places an item — a create, an import, a move, the conversion —
 * goes through it, so no path can put an item on the wrong board.
 */
export function assertColumnForLevel(type: KanbanItemType, column: KanbanColumnOfBoard): void {
	if (KANBAN_BOARD_OF_TYPE[type] !== column.board) {
		throw new KanbanBoardMismatchError(column.id);
	}
}
