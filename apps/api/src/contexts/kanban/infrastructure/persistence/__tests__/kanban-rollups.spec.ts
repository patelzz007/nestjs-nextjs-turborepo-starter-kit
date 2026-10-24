import { describe, expect, it } from "vitest";

import { computeRollups, type KanbanRollupItem } from "../kanban-rollups";

const ITEMS: readonly KanbanRollupItem[] = [
	{ id: "epic", type: "EPIC", parentId: null, storyPoints: null, isDone: false },
	{ id: "feature-a", type: "FEATURE", parentId: "epic", storyPoints: null, isDone: false },
	{ id: "feature-b", type: "FEATURE", parentId: "epic", storyPoints: null, isDone: true },
	{ id: "story-1", type: "STORY", parentId: "feature-a", storyPoints: 5, isDone: true },
	{ id: "story-2", type: "STORY", parentId: "feature-a", storyPoints: 3, isDone: false },
	{ id: "story-3", type: "STORY", parentId: "feature-b", storyPoints: 8, isDone: true },
	{ id: "story-unestimated", type: "STORY", parentId: "feature-b", storyPoints: null, isDone: false },
	{ id: "task-1", type: "TASK", parentId: "story-2", storyPoints: null, isDone: true },
	{ id: "task-2", type: "TASK", parentId: "story-2", storyPoints: null, isDone: false },
];

describe("computeRollups", () => {
	const rollups = computeRollups(ITEMS);

	it("sums story points up the hierarchy, counting done points from stories in a done column", () => {
		expect(rollups.get("feature-a")?.points).toEqual({ done: 5, total: 8 });
		expect(rollups.get("feature-b")?.points).toEqual({ done: 8, total: 8 });
		expect(rollups.get("epic")?.points).toEqual({ done: 13, total: 16 });
	});

	it("gives a story its own estimate and never counts its tasks", () => {
		expect(rollups.get("story-2")).toEqual({ children: { done: 1, total: 2 }, points: { done: 0, total: 3 } });
		expect(rollups.get("story-unestimated")?.points).toEqual({ done: 0, total: 0 });
	});

	it("counts direct children and the done ones", () => {
		expect(rollups.get("epic")?.children).toEqual({ done: 1, total: 2 });
		expect(rollups.get("task-1")).toEqual({ children: { done: 0, total: 0 }, points: { done: 0, total: 0 } });
	});
});
