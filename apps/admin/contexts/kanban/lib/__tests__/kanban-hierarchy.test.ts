import { describe, expect, it } from "vitest";

import { buildHierarchy, countNodes, expandableIds, filterHierarchy, isExpandable, treeProgress } from "../kanban-hierarchy";
import type { KanbanTaskFilters } from "../kanban-board-model";
import { column, DOING_ID, FEATURE_ID, STORY_ID, task, TODO_ID } from "./kanban-fixtures";

const NO_FILTERS: KanbanTaskFilters = { search: undefined, priority: undefined, team: undefined, type: undefined };

const feature = task({ id: FEATURE_ID, type: "FEATURE", title: "Refunds" });
const story = task({ id: STORY_ID, title: "Refund a card", parentId: FEATURE_ID });
const step = task({
	id: "step",
	type: "TASK",
	title: "Call the gateway",
	parentId: STORY_ID,
	columnId: DOING_ID,
	rollup: { children: { done: 1, total: 3 }, points: { done: 0, total: 0 } },
});
const subtask = task({ id: "subtask", type: "SUBTASK", title: "Retry on timeout", parentId: "step", columnId: DOING_ID, steps: { done: 1, total: 2 } });
const loose = task({ id: "loose", title: "Loose story" });

const COLUMNS = [column(TODO_ID, "To do", [feature, story, loose]), column(DOING_ID, "Doing", [step, subtask], "IN_PROGRESS")];

describe("buildHierarchy", () => {
	it("folds every item under its parent, in board order, an item without one at the top", () => {
		const tree = buildHierarchy(COLUMNS);

		expect(tree.map((node) => node.task.id)).toEqual([FEATURE_ID, "loose"]);
		const [refunds] = tree;
		expect(refunds?.children.map((node) => node.task.id)).toEqual([STORY_ID]);
		expect(refunds?.children.at(0)?.children.at(0)?.status).toEqual({ id: DOING_ID, board: "EXECUTION", title: "Doing", state: "IN_PROGRESS" });
		expect(
			refunds?.children
				.at(0)
				?.children.at(0)
				?.children.map((node) => node.task.id),
		).toEqual(["subtask"]);
		expect(countNodes(tree)).toBe(5);
	});

	it("keeps an item listed twice once, and puts an item whose parent is elsewhere at the top", () => {
		const orphan = task({ id: "orphan", parentId: "0199d0c0-0000-7000-8000-0000000000ff" });
		const tree = buildHierarchy([column(TODO_ID, "To do", [orphan]), column(DOING_ID, "Doing", [orphan])]);

		expect(tree.map((node) => [node.task.id, node.status.title])).toEqual([["orphan", "To do"]]);
	});
});

describe("filterHierarchy", () => {
	it("keeps a match with the path down to it, and a matching parent with its whole branch", () => {
		const tree = buildHierarchy(COLUMNS);

		const byStep = filterHierarchy(tree, { ...NO_FILTERS, search: "gateway" });
		expect(byStep.map((node) => node.task.id)).toEqual([FEATURE_ID]);
		expect(countNodes(byStep)).toBe(4);

		const byFeature = filterHierarchy(tree, { ...NO_FILTERS, search: "refunds" });
		expect(byFeature.map((node) => node.task.id)).toEqual([FEATURE_ID]);
		expect(countNodes(byFeature)).toBe(4);
		expect(filterHierarchy(tree, { ...NO_FILTERS, search: "nothing" })).toEqual([]);
	});
});

describe("expanding", () => {
	it("opens a row with children, or a subtask with steps, at any depth", () => {
		const tree = buildHierarchy(COLUMNS);

		expect(expandableIds(tree)).toEqual([FEATURE_ID, STORY_ID, "step", "subtask"]);
		expect(isExpandable({ task: loose, status: { id: TODO_ID, board: "EXECUTION", title: "To do", state: "TODO" }, children: [] })).toBe(false);
	});
});

describe("treeProgress", () => {
	it("measures each level its own way, and says nothing when there is nothing to count", () => {
		expect(treeProgress(task({ id: "e", type: "EPIC", rollup: { children: { done: 0, total: 1 }, points: { done: 3, total: 12 } } }))).toBe(25);
		expect(treeProgress(task({ id: "s", rollup: { children: { done: 1, total: 2 }, points: { done: 0, total: 0 } } }))).toBe(50);
		expect(treeProgress(step)).toBe(33);
		expect(treeProgress(subtask)).toBe(50);
		expect(treeProgress(loose)).toBeNull();
	});
});
