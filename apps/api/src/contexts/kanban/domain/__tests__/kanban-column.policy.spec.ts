import type { KanbanItemType } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { KanbanBoardMismatchError } from "../errors/kanban.errors";
import { assertColumnForLevel, type KanbanColumnOfBoard } from "../policies/kanban-column.policy";

const PLANNING: KanbanColumnOfBoard = { id: "column-plan", board: "PLANNING" };
const EXECUTION: KanbanColumnOfBoard = { id: "column-todo", board: "EXECUTION" };
const PLANNING_LEVELS: readonly KanbanItemType[] = ["EPIC", "FEATURE"];
const EXECUTION_LEVELS: readonly KanbanItemType[] = ["STORY", "TASK", "SUBTASK"];

describe("assertColumnForLevel", () => {
	it("lets epics and features into planning columns only", () => {
		for (const type of PLANNING_LEVELS) {
			expect(() => {
				assertColumnForLevel(type, PLANNING);
			}).not.toThrow();
			expect(() => {
				assertColumnForLevel(type, EXECUTION);
			}).toThrow(KanbanBoardMismatchError);
		}
	});

	it("lets stories, tasks and subtasks into execution columns only", () => {
		for (const type of EXECUTION_LEVELS) {
			expect(() => {
				assertColumnForLevel(type, EXECUTION);
			}).not.toThrow();
			expect(() => {
				assertColumnForLevel(type, PLANNING);
			}).toThrow(KanbanBoardMismatchError);
		}
	});
});
