import { describe, expect, it } from "vitest";

import { keyNumberOf, planChecklists, planColumns, planKeys, planPlanningTriage, verifyConversion, type BoardSnapshot, type SnapshotItem } from "../kanban-conversion";

const OWNER = "owner-1";

function item(overrides: Partial<SnapshotItem> & Pick<SnapshotItem, "id" | "type">): SnapshotItem {
	return {
		key: null,
		createdAt: 1,
		parentId: null,
		ownerId: OWNER,
		priority: "MEDIUM",
		team: "BACKEND",
		columnId: null,
		planningColumnId: null,
		executionColumnId: null,
		position: 0,
		isDeleted: false,
		...overrides,
	};
}

/** An older board: Backlog · In Progress · Done on planning, To Do · Doing · Done on execution, nothing converted. */
function legacyBoard(items: readonly SnapshotItem[]): BoardSnapshot {
	return {
		legacyColumns: [
			{ id: "p-backlog", board: "PLANNING", title: "Backlog", kind: "BACKLOG", position: 0, wipLimit: null },
			{ id: "p-doing", board: "PLANNING", title: "In Progress", kind: "IN_PROGRESS", position: 1, wipLimit: 2 },
			{ id: "p-done", board: "PLANNING", title: "Done", kind: "DONE", position: 2, wipLimit: null },
			{ id: "e-todo", board: "EXECUTION", title: "To Do", kind: "PLANNED", position: 0, wipLimit: null },
			{ id: "e-doing", board: "EXECUTION", title: "Doing", kind: "IN_PROGRESS", position: 1, wipLimit: 4 },
			{ id: "e-done", board: "EXECUTION", title: "Done", kind: "DONE", position: 2, wipLimit: null },
		],
		planningColumns: [],
		executionColumns: [],
		items,
		counters: new Map(),
		legacySubtasks: [],
	};
}

function sequence(): () => string {
	let next = 0;
	return (): string => {
		next += 1;
		return `new-${String(next)}`;
	};
}

describe("planKeys", () => {
	it("keys each level in creation order, deleted items too, continuing after the counter and existing keys", () => {
		const plan = planKeys({
			...legacyBoard([
				item({ id: "s2", type: "STORY", createdAt: 20 }),
				item({ id: "s1", type: "STORY", createdAt: 10, isDeleted: true }),
				item({ id: "s0", type: "STORY", createdAt: 5, key: "STORY-7" }),
				item({ id: "e1", type: "EPIC", createdAt: 30 }),
			]),
			counters: new Map([["STORY", 3]]),
		});

		expect(plan.assignments).toEqual([
			{ itemId: "e1", key: "EPIC-1" },
			{ itemId: "s1", key: "STORY-8" },
			{ itemId: "s2", key: "STORY-9" },
		]);
		expect(plan.counters.get("STORY")).toBe(9);
		expect(plan.counters.get("TASK")).toBe(0);
	});

	it("plans nothing once every item is keyed", () => {
		expect(planKeys(legacyBoard([item({ id: "s", type: "STORY", key: "STORY-1" })])).assignments).toEqual([]);
	});

	it("reads a key's number", () => {
		expect(keyNumberOf("SUBTASK-42")).toBe(42);
		expect(keyNumberOf("STORY-0")).toBeNull();
	});
});

describe("planColumns", () => {
	it("keeps each column's id and order, maps it to a stage or state, and adds the stages the board lacked", () => {
		const plan = planColumns(legacyBoard([]), sequence());

		expect(plan.planningColumns.map((column) => [column.id, column.stage, column.position])).toEqual([
			["p-backlog", "BACKLOG", 0],
			["new-1", "REFINING", 1],
			["new-2", "READY", 2],
			["new-3", "PLANNED", 3],
			["p-done", "DELIVERED", 4],
		]);
		expect(plan.executionColumns.map((column) => [column.id, column.state, column.wipLimit])).toEqual([
			["e-todo", "TODO", null],
			["e-doing", "IN_PROGRESS", 4],
			["new-4", "REVIEW", null],
			["e-done", "DONE", null],
		]);
	});

	it("places live items where they stood, and leaves planning items in progress for the triage", () => {
		const plan = planColumns(
			legacyBoard([
				item({ id: "story", type: "STORY", columnId: "e-doing", position: 2 }),
				item({ id: "epic", type: "EPIC", columnId: "p-backlog" }),
				item({ id: "feature", type: "FEATURE", columnId: "p-doing" }),
				item({ id: "gone", type: "STORY", columnId: "e-todo", isDeleted: true }),
			]),
			sequence(),
		);

		expect(plan.placements).toEqual([
			{ itemId: "story", board: "EXECUTION", columnId: "e-doing", position: 2 },
			{ itemId: "epic", board: "PLANNING", columnId: "p-backlog", position: 0 },
		]);
		expect(plan.problems).toEqual([]);
	});

	it("reports an item on the wrong board instead of placing it, and plans nothing once the split ran", () => {
		expect(planColumns(legacyBoard([item({ id: "story", type: "STORY", key: "STORY-1", columnId: "p-backlog" })]), sequence()).problems).toEqual([
			"STORY-1: a story in a column of the other board",
		]);
		const split: BoardSnapshot = { ...legacyBoard([]), planningColumns: [{ id: "p-backlog", title: "Backlog", stage: "BACKLOG", position: 0 }] };
		expect(planColumns(split, sequence()).planningColumns).toEqual([]);
	});
});

describe("planPlanningTriage", () => {
	it("sends an item with a breakdown to Ready and one without to Refining, at the bottom, in order", () => {
		const snapshot: BoardSnapshot = {
			...legacyBoard([
				item({ id: "broken-down", type: "FEATURE", key: "FEATURE-1", columnId: "p-doing", position: 0 }),
				item({ id: "story", type: "STORY", parentId: "broken-down", executionColumnId: "e-todo" }),
				item({ id: "bare", type: "EPIC", key: "EPIC-1", columnId: "p-doing", position: 1 }),
				item({ id: "already-ready", type: "FEATURE", planningColumnId: "ready" }),
			]),
			planningColumns: [
				{ id: "refining", title: "Refining", stage: "REFINING", position: 1 },
				{ id: "ready", title: "Ready", stage: "READY", position: 2 },
			],
		};

		expect(planPlanningTriage(snapshot)).toEqual([
			{ itemId: "broken-down", key: "FEATURE-1", stage: "READY", columnId: "ready", position: 1 },
			{ itemId: "bare", key: "EPIC-1", stage: "REFINING", columnId: "refining", position: 0 },
		]);
	});
});

describe("planChecklists", () => {
	it("turns each top-level row into a subtask and the rows under it into its steps, one level up", () => {
		const snapshot: BoardSnapshot = {
			...legacyBoard([item({ id: "task", type: "TASK", priority: "HIGH", team: "QA" }), item({ id: "gone-task", type: "TASK", isDeleted: true })]),
			executionColumns: [
				{ id: "todo", title: "To Do", state: "TODO", position: 0 },
				{ id: "done", title: "Done", state: "DONE", position: 3 },
			],
			counters: new Map([["SUBTASK", 4]]),
			legacySubtasks: [
				{ id: "r1", taskId: "task", title: "Design", depth: 0, isDone: true, assigneeId: "carol", position: 0 },
				{ id: "r2", taskId: "task", title: "Schema", depth: 1, isDone: false, assigneeId: null, position: 1 },
				{ id: "r3", taskId: "task", title: "Index", depth: 2, isDone: false, assigneeId: null, position: 2 },
				{ id: "r4", taskId: "task", title: "Ship", depth: 0, isDone: false, assigneeId: null, position: 3 },
				{ id: "r5", taskId: "gone-task", title: "Orphan", depth: 0, isDone: false, assigneeId: null, position: 0 },
			],
		};

		const plan = planChecklists(snapshot, sequence());

		expect(plan.subtasks.map((subtask) => [subtask.key, subtask.title, subtask.columnId, subtask.priority, subtask.team, subtask.assigneeId])).toEqual([
			["SUBTASK-5", "Design", "done", "HIGH", "QA", "carol"],
			["SUBTASK-6", "Ship", "todo", "HIGH", "QA", null],
		]);
		expect(plan.subtasks.at(0)?.steps.map((step) => [step.title, step.depth, step.position])).toEqual([
			["Schema", 0, 0],
			["Index", 1, 1],
		]);
		expect(plan.retiredRowIds).toEqual(["r1", "r2", "r3", "r4"]);
		expect(plan.subtaskCounter).toBe(6);
	});
});

describe("verifyConversion", () => {
	it("names everything left before migration 2, and nothing on a converted board", () => {
		expect(
			verifyConversion({
				...legacyBoard([item({ id: "s", type: "STORY", key: "STORY-9" }), item({ id: "t", type: "TASK" })]),
				counters: new Map([["STORY", 2]]),
				legacySubtasks: [{ id: "r", taskId: "t", title: "x", depth: 0, isDone: false, assigneeId: null, position: 0 }],
			}),
		).toEqual([
			"1 item(s) have no key.",
			"2 live item(s) sit in no planning or execution column.",
			"1 task checklist row(s) are not subtasks yet.",
			"The STORY counter (2) is behind its highest key (STORY-9).",
		]);
		expect(verifyConversion({ ...legacyBoard([item({ id: "s", type: "STORY", key: "STORY-1", executionColumnId: "e" })]), counters: new Map([["STORY", 1]]) })).toEqual([]);
	});
});
