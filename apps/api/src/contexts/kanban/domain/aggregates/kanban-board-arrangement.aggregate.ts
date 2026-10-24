import { KANBAN_COLUMN_TASK_LIMIT, type KanbanBoardKind, type KanbanItemType } from "@workspace/shared";

import {
	KanbanColumnFullError,
	KanbanColumnNotFoundError,
	KanbanColumnStaleError,
	KanbanMoveAnchorInvalidError,
	KanbanTaskNotFoundError,
	KanbanTaskStaleError,
} from "../errors/kanban.errors";
import { assertColumnForLevel } from "../policies/kanban-column.policy";

/** A live task as the board orders it: its id, its level and its concurrency token. */
export interface KanbanTaskSlot {
	readonly id: string;
	readonly type: KanbanItemType;
	readonly version: number;
}

/** A live column as its board orders it, with its tasks top to bottom. */
export interface KanbanColumnSnapshot {
	readonly id: string;
	readonly board: KanbanBoardKind;
	readonly version: number;
	readonly tasks: readonly KanbanTaskSlot[];
}

/** Both boards' arrangement, each board's columns left to right, read under the board lock. */
export interface KanbanBoardSnapshot {
	readonly columns: readonly KanbanColumnSnapshot[];
}

/** Where one task sits after a change: its column (on `board`) and 0-based position there. */
export interface KanbanTaskPlacement {
	readonly taskId: string;
	readonly columnId: string;
	readonly board: KanbanBoardKind;
	readonly position: number;
}

/** Where one column sits after a change: its 0-based position on its board. */
export interface KanbanColumnPlacement {
	readonly columnId: string;
	readonly position: number;
}

/** A row whose concurrency token the change consumes: saved only while still at `expectedVersion`. */
export interface KanbanVersionBump {
	readonly id: string;
	readonly expectedVersion: number;
}

/** Index of a list position that does not exist, as `findIndex` reports it. */
const NOT_FOUND = -1;

/** Both boards, in the order their placements are reported. */
const BOARD_KINDS: readonly KanbanBoardKind[] = ["PLANNING", "EXECUTION"];

interface MutableColumn {
	readonly id: string;
	readonly board: KanbanBoardKind;
	readonly version: number;
	readonly taskIds: string[];
}

/**
 * The boards' ordering rules: which column each item sits in, top to bottom,
 * and each board's columns left to right. Positions are always contiguous from
 * 0 among live rows (columns per board, items per column), so every change
 * knows exactly which rows it rewrites. An item stays on the board its type
 * lives on: it is placed and moved only into that board's columns.
 *
 * Load it under the board lock, apply one change, and save what
 * {@link changedTaskPlacements} / {@link changedColumnPlacements} report: two
 * moves never interleave, so positions never collide. A moved task or column
 * also consumes its concurrency token (`versionBumps`), so a client that moved
 * a card it read before someone else moved it gets a 409, not a silent undo.
 */
export class KanbanBoardArrangement {
	private readonly changedTaskIds = new Set<string>();
	private readonly changedColumnIds = new Set<string>();
	private readonly taskBumps: KanbanVersionBump[] = [];
	private readonly columnBumps: KanbanVersionBump[] = [];

	private constructor(
		private readonly columns: MutableColumn[],
		private readonly taskVersions: ReadonlyMap<string, number>,
		private readonly taskTypes: ReadonlyMap<string, KanbanItemType>,
	) {}

	public static rehydrate(snapshot: KanbanBoardSnapshot): KanbanBoardArrangement {
		const taskVersions = new Map<string, number>();
		const taskTypes = new Map<string, KanbanItemType>();
		const columns: MutableColumn[] = snapshot.columns.map((column): MutableColumn => {
			for (const task of column.tasks) {
				taskVersions.set(task.id, task.version);
				taskTypes.set(task.id, task.type);
			}
			return { id: column.id, board: column.board, version: column.version, taskIds: column.tasks.map((task) => task.id) };
		});
		return new KanbanBoardArrangement(columns, taskVersions, taskTypes);
	}

	/** The board a live column belongs to. */
	public boardOfColumn(columnId: string): KanbanBoardKind {
		return this.requireColumn(columnId).board;
	}

	/** The column a live item sits in. */
	public columnIdOf(taskId: string): string {
		return this.requireTaskColumn(taskId).id;
	}

	/**
	 * The place a new item takes: the bottom of `columnId`. Refused when the
	 * column is missing, full, or on the other board from the one `type` lives on.
	 */
	public placeNewTask(taskId: string, columnId: string, type: KanbanItemType): KanbanTaskPlacement {
		const column = this.requireColumn(columnId);
		assertColumnForLevel(type, column);
		this.assertRoomFor(column);
		column.taskIds.push(taskId);
		this.changedTaskIds.add(taskId);
		return { taskId, columnId, board: column.board, position: column.taskIds.length - 1 };
	}

	/**
	 * Moves `taskId` into `toColumnId`, right below `afterTaskId` (`null`: the
	 * top). The move must be based on the task's current `version`, stays on the
	 * task's board, and a cross-column move is refused when the target is full.
	 */
	public moveTask(taskId: string, expectedVersion: number, toColumnId: string, afterTaskId: string | null): void {
		const from = this.requireTaskColumn(taskId);
		if (this.taskVersions.get(taskId) !== expectedVersion) {
			throw new KanbanTaskStaleError(taskId);
		}
		const to = this.requireColumn(toColumnId);
		assertColumnForLevel(this.typeOf(taskId), to);
		if (afterTaskId !== null && (afterTaskId === taskId || !to.taskIds.includes(afterTaskId))) {
			throw new KanbanMoveAnchorInvalidError(afterTaskId);
		}
		if (from !== to) {
			this.assertRoomFor(to);
		}

		const before: readonly string[] = [...to.taskIds];
		const fromBefore: readonly string[] = [...from.taskIds];
		removeFrom(from.taskIds, taskId);
		const insertAt = afterTaskId === null ? 0 : to.taskIds.indexOf(afterTaskId) + 1;
		to.taskIds.splice(insertAt, 0, taskId);

		this.markReordered(from, fromBefore);
		if (from !== to) {
			this.markReordered(to, before);
		}
		this.changedTaskIds.add(taskId);
		this.taskBumps.push({ id: taskId, expectedVersion });
	}

	/** Takes a deleted task off the board; the tasks below it move up one place. */
	public removeTask(taskId: string): void {
		const column = this.requireTaskColumn(taskId);
		const before: readonly string[] = [...column.taskIds];
		removeFrom(column.taskIds, taskId);
		this.markReordered(column, before);
		this.changedTaskIds.delete(taskId);
	}

	/**
	 * Moves `columnId` right of `afterColumnId` (`null`: first) on its own board.
	 * The move must be based on the column's current `version`; the anchor must be
	 * another column of the same board.
	 */
	public moveColumn(columnId: string, expectedVersion: number, afterColumnId: string | null): void {
		const column = this.requireColumn(columnId);
		if (column.version !== expectedVersion) {
			throw new KanbanColumnStaleError(columnId);
		}
		if (afterColumnId !== null && (afterColumnId === columnId || this.findColumn(afterColumnId)?.board !== column.board)) {
			throw new KanbanMoveAnchorInvalidError(afterColumnId);
		}
		const before: readonly string[] = this.boardColumns(column.board).map((candidate) => candidate.id);
		this.columns.splice(this.columns.indexOf(column), 1);
		const insertAt =
			afterColumnId === null
				? this.columns.findIndex((candidate) => candidate.board === column.board)
				: this.columns.findIndex((candidate) => candidate.id === afterColumnId) + 1;
		this.columns.splice(insertAt === NOT_FOUND ? this.columns.length : insertAt, 0, column);

		this.boardColumns(column.board).forEach((candidate, position): void => {
			if (before.indexOf(candidate.id) !== position) {
				this.changedColumnIds.add(candidate.id);
			}
		});
		this.changedColumnIds.add(columnId);
		this.columnBumps.push({ id: columnId, expectedVersion });
	}

	/** Every task whose column or position this change set, in board order. */
	public changedTaskPlacements(): readonly KanbanTaskPlacement[] {
		return this.columns.flatMap((column) =>
			column.taskIds.flatMap((taskId, position): KanbanTaskPlacement[] =>
				this.changedTaskIds.has(taskId) ? [{ taskId, columnId: column.id, board: column.board, position }] : [],
			),
		);
	}

	/** Every column whose position on its board this change set, each board left to right. */
	public changedColumnPlacements(): readonly KanbanColumnPlacement[] {
		return BOARD_KINDS.flatMap((board) =>
			this.boardColumns(board).flatMap((column, position): KanbanColumnPlacement[] => (this.changedColumnIds.has(column.id) ? [{ columnId: column.id, position }] : [])),
		);
	}

	/** The tasks whose concurrency token this change consumes. */
	public taskVersionBumps(): readonly KanbanVersionBump[] {
		return this.taskBumps;
	}

	/** The columns whose concurrency token this change consumes. */
	public columnVersionBumps(): readonly KanbanVersionBump[] {
		return this.columnBumps;
	}

	/** One board's columns, left to right. */
	private boardColumns(board: KanbanBoardKind): MutableColumn[] {
		return this.columns.filter((column) => column.board === board);
	}

	/** A live item's level (a new item's comes with its placement). */
	private typeOf(taskId: string): KanbanItemType {
		const type = this.taskTypes.get(taskId);
		if (type === undefined) {
			throw new KanbanTaskNotFoundError(taskId);
		}
		return type;
	}

	private findColumn(columnId: string): MutableColumn | undefined {
		return this.columns.find((column) => column.id === columnId);
	}

	private requireColumn(columnId: string): MutableColumn {
		const column = this.findColumn(columnId);
		if (column === undefined) {
			throw new KanbanColumnNotFoundError(columnId);
		}
		return column;
	}

	private requireTaskColumn(taskId: string): MutableColumn {
		const column = this.columns.find((candidate) => candidate.taskIds.includes(taskId));
		if (column === undefined) {
			throw new KanbanTaskNotFoundError(taskId);
		}
		return column;
	}

	private assertRoomFor(column: MutableColumn): void {
		if (column.taskIds.length >= KANBAN_COLUMN_TASK_LIMIT) {
			throw new KanbanColumnFullError(column.id);
		}
	}

	/** Marks every task of `column` whose position differs from `before`. */
	private markReordered(column: MutableColumn, before: readonly string[]): void {
		column.taskIds.forEach((taskId, position): void => {
			if (before.indexOf(taskId) !== position) {
				this.changedTaskIds.add(taskId);
			}
		});
	}
}

function removeFrom(list: string[], id: string): void {
	const index = list.indexOf(id);
	if (index !== NOT_FOUND) {
		list.splice(index, 1);
	}
}
