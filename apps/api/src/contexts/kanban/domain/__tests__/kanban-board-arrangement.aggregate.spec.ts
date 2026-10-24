import { KANBAN_COLUMN_TASK_LIMIT, type KanbanBoardKind } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { KanbanBoardArrangement, type KanbanBoardSnapshot, type KanbanColumnSnapshot } from "../aggregates/kanban-board-arrangement.aggregate";
import {
	KanbanBoardMismatchError,
	KanbanColumnFullError,
	KanbanColumnNotFoundError,
	KanbanColumnStaleError,
	KanbanMoveAnchorInvalidError,
	KanbanTaskNotFoundError,
	KanbanTaskStaleError,
} from "../errors/kanban.errors";

const TODO = "column-todo";
const DOING = "column-doing";
const DONE = "column-done";
const PLAN = "column-plan";
const PLAN_DONE = "column-plan-done";

/** A column whose tasks all sit at version 0, unless `versions` says otherwise. */
function column(
	id: string,
	taskIds: readonly string[],
	options: { readonly version?: number; readonly versions?: Readonly<Record<string, number>>; readonly board?: KanbanBoardKind } = {},
): KanbanColumnSnapshot {
	return {
		id,
		board: options.board ?? "EXECUTION",
		version: options.version ?? 0,
		tasks: taskIds.map((taskId) => ({ id: taskId, type: options.board === "PLANNING" ? "FEATURE" : "STORY", version: options.versions?.[taskId] ?? 0 })),
	};
}

/** To do: a, b, c — Doing: d — Done: (empty). */
function snapshot(): KanbanBoardSnapshot {
	return { columns: [column(TODO, ["a", "b", "c"]), column(DOING, ["d"]), column(DONE, [])] };
}

describe("KanbanBoardArrangement", () => {
	describe("placeNewTask", () => {
		it("puts a new task at the bottom of its column, touching no other row", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			expect(board.placeNewTask("n", TODO, "STORY")).toEqual({ taskId: "n", columnId: TODO, board: "EXECUTION", position: 3 });
			expect(board.changedTaskPlacements()).toEqual([{ taskId: "n", columnId: TODO, board: "EXECUTION", position: 3 }]);
			expect(board.taskVersionBumps()).toEqual([]);
		});

		it("places the first task of an empty column at position 0", () => {
			expect(KanbanBoardArrangement.rehydrate(snapshot()).placeNewTask("n", DONE, "STORY")).toEqual({ taskId: "n", columnId: DONE, board: "EXECUTION", position: 0 });
		});

		it("refuses a column on the other board from the one the type lives on", () => {
			const board = KanbanBoardArrangement.rehydrate({ columns: [column(PLAN, [], { board: "PLANNING" }), ...snapshot().columns] });

			expect(() => board.placeNewTask("n", TODO, "EPIC")).toThrow(KanbanBoardMismatchError);
			expect(() => board.placeNewTask("n", PLAN, "TASK")).toThrow(KanbanBoardMismatchError);
			expect(board.placeNewTask("n", PLAN, "FEATURE")).toEqual({ taskId: "n", columnId: PLAN, board: "PLANNING", position: 0 });
		});

		it("refuses a column that does not exist", () => {
			expect(() => KanbanBoardArrangement.rehydrate(snapshot()).placeNewTask("n", "column-missing", "STORY")).toThrow(KanbanColumnNotFoundError);
		});

		it("refuses a full column", () => {
			const full = column(
				TODO,
				Array.from({ length: KANBAN_COLUMN_TASK_LIMIT }, (_, index) => `task-${String(index)}`),
			);
			expect(() => KanbanBoardArrangement.rehydrate({ columns: [full] }).placeNewTask("n", TODO, "STORY")).toThrow(KanbanColumnFullError);
		});
	});

	describe("moveTask", () => {
		it("moves a task down its own column, rewriting only the rows between", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.moveTask("a", 0, TODO, "c");

			expect(board.changedTaskPlacements()).toEqual([
				{ taskId: "b", columnId: TODO, board: "EXECUTION", position: 0 },
				{ taskId: "c", columnId: TODO, board: "EXECUTION", position: 1 },
				{ taskId: "a", columnId: TODO, board: "EXECUTION", position: 2 },
			]);
			expect(board.taskVersionBumps()).toEqual([{ id: "a", expectedVersion: 0 }]);
		});

		it("moves a task to the top of its column when there is no anchor", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.moveTask("c", 0, TODO, null);

			expect(board.changedTaskPlacements()).toEqual([
				{ taskId: "c", columnId: TODO, board: "EXECUTION", position: 0 },
				{ taskId: "a", columnId: TODO, board: "EXECUTION", position: 1 },
				{ taskId: "b", columnId: TODO, board: "EXECUTION", position: 2 },
			]);
		});

		it("moves a task across columns, closing the gap behind it and opening one below the anchor", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.moveTask("a", 0, DOING, "d");

			expect(board.changedTaskPlacements()).toEqual([
				{ taskId: "b", columnId: TODO, board: "EXECUTION", position: 0 },
				{ taskId: "c", columnId: TODO, board: "EXECUTION", position: 1 },
				{ taskId: "a", columnId: DOING, board: "EXECUTION", position: 1 },
			]);
		});

		it("moves a task into an empty column", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.moveTask("d", 0, DONE, null);

			expect(board.changedTaskPlacements()).toEqual([{ taskId: "d", columnId: DONE, board: "EXECUTION", position: 0 }]);
		});

		it("keeps the moved task's token when it lands where it was (the client still asked to move it)", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.moveTask("b", 0, TODO, "a");

			expect(board.changedTaskPlacements()).toEqual([{ taskId: "b", columnId: TODO, board: "EXECUTION", position: 1 }]);
			expect(board.taskVersionBumps()).toEqual([{ id: "b", expectedVersion: 0 }]);
		});

		it("refuses a move based on a stale read of the task", () => {
			const board = KanbanBoardArrangement.rehydrate({ columns: [column(TODO, ["a", "b"], { versions: { a: 4 } })] });

			expect(() => {
				board.moveTask("a", 3, TODO, "b");
			}).toThrow(KanbanTaskStaleError);
			expect(board.changedTaskPlacements()).toEqual([]);
		});

		it("refuses an unknown task, an unknown target column, and an anchor outside the target column", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			expect(() => {
				board.moveTask("missing", 0, TODO, null);
			}).toThrow(KanbanTaskNotFoundError);
			expect(() => {
				board.moveTask("a", 0, "column-missing", null);
			}).toThrow(KanbanColumnNotFoundError);
			expect(() => {
				board.moveTask("a", 0, DOING, "b");
			}).toThrow(KanbanMoveAnchorInvalidError);
			expect(() => {
				board.moveTask("a", 0, TODO, "a");
			}).toThrow(KanbanMoveAnchorInvalidError);
		});

		it("refuses a move into a full column but allows reordering inside a full one", () => {
			const fullIds = Array.from({ length: KANBAN_COLUMN_TASK_LIMIT }, (_, index) => `task-${String(index)}`);
			const board = KanbanBoardArrangement.rehydrate({ columns: [column(TODO, fullIds), column(DOING, ["x"])] });

			expect(() => {
				board.moveTask("x", 0, TODO, null);
			}).toThrow(KanbanColumnFullError);
			expect(() => {
				board.moveTask("task-1", 0, TODO, null);
			}).not.toThrow();
		});
	});

	describe("removeTask", () => {
		it("moves the tasks below a removed task up one place", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.removeTask("a");

			expect(board.changedTaskPlacements()).toEqual([
				{ taskId: "b", columnId: TODO, board: "EXECUTION", position: 0 },
				{ taskId: "c", columnId: TODO, board: "EXECUTION", position: 1 },
			]);
			expect(board.taskVersionBumps()).toEqual([]);
		});

		it("changes nothing when the last task of a column goes", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.removeTask("d");

			expect(board.changedTaskPlacements()).toEqual([]);
		});

		it("refuses a task that is not on the board", () => {
			expect(() => {
				KanbanBoardArrangement.rehydrate(snapshot()).removeTask("missing");
			}).toThrow(KanbanTaskNotFoundError);
		});
	});

	describe("moveColumn", () => {
		it("moves a column right of another, rewriting the columns it passes", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.moveColumn(TODO, 0, DOING);

			expect(board.changedColumnPlacements()).toEqual([
				{ columnId: DOING, position: 0 },
				{ columnId: TODO, position: 1 },
			]);
			expect(board.columnVersionBumps()).toEqual([{ id: TODO, expectedVersion: 0 }]);
			expect(board.changedTaskPlacements()).toEqual([]);
		});

		it("moves a column first when there is no anchor", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			board.moveColumn(DONE, 0, null);

			expect(board.changedColumnPlacements()).toEqual([
				{ columnId: DONE, position: 0 },
				{ columnId: TODO, position: 1 },
				{ columnId: DOING, position: 2 },
			]);
		});

		it("refuses a move based on a stale read of the column", () => {
			const board = KanbanBoardArrangement.rehydrate({ columns: [column(TODO, [], { version: 2 }), column(DOING, [])] });

			expect(() => {
				board.moveColumn(TODO, 1, DOING);
			}).toThrow(KanbanColumnStaleError);
		});

		it("refuses an unknown column and an anchor that is the column itself or missing", () => {
			const board = KanbanBoardArrangement.rehydrate(snapshot());

			expect(() => {
				board.moveColumn("column-missing", 0, null);
			}).toThrow(KanbanColumnNotFoundError);
			expect(() => {
				board.moveColumn(TODO, 0, TODO);
			}).toThrow(KanbanMoveAnchorInvalidError);
			expect(() => {
				board.moveColumn(TODO, 0, "column-missing");
			}).toThrow(KanbanMoveAnchorInvalidError);
		});

		it("keeps each board's columns apart: positions count per board, anchors stay on the board", () => {
			const board = KanbanBoardArrangement.rehydrate({
				columns: [column(PLAN, [], { board: "PLANNING" }), column(PLAN_DONE, [], { board: "PLANNING" }), ...snapshot().columns],
			});

			expect(() => {
				board.moveColumn(TODO, 0, PLAN);
			}).toThrow(KanbanMoveAnchorInvalidError);

			board.moveColumn(DONE, 0, null);
			expect(board.changedColumnPlacements()).toEqual([
				{ columnId: DONE, position: 0 },
				{ columnId: TODO, position: 1 },
				{ columnId: DOING, position: 2 },
			]);
		});
	});

	describe("the boards", () => {
		it("refuse a move to the other board and name the column an item sits in", () => {
			const board = KanbanBoardArrangement.rehydrate({ columns: [column(PLAN, ["epic"], { board: "PLANNING" }), ...snapshot().columns] });

			expect(board.columnIdOf("epic")).toBe(PLAN);
			expect(() => {
				board.moveTask("epic", 0, TODO, null);
			}).toThrow(KanbanBoardMismatchError);
			expect(() => board.columnIdOf("missing")).toThrow(KanbanTaskNotFoundError);
		});
	});
});
