import { kanbanColumnIsDone } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { featureRollups, matchesFilters, wipCountOf } from "../kanban-board-model";
import { ancestor, column, FEATURE_ID, task, TODO_ID } from "./kanban-fixtures";

const EPIC = ancestor({ id: "epic", type: "EPIC", key: "EPIC-1", title: "Payments" });
const FEATURE = ancestor({ id: FEATURE_ID, type: "FEATURE", key: "FEATURE-2", title: "Refunds" });
const SHIPPED = ancestor({ id: "shipped", type: "FEATURE", key: "FEATURE-3", title: "Exports" });

describe("wipCountOf", () => {
	it("counts stories and tasks, and names subtasks apart", () => {
		expect(wipCountOf([task({ id: "s" }), task({ id: "t", type: "TASK" }), task({ id: "u", type: "SUBTASK" })])).toEqual({ counted: 2, subtasks: 1 });
	});
});

describe("featureRollups", () => {
	it("lists each feature with open stories, under its epic, its stories done of all", () => {
		const columns = [
			column(TODO_ID, "To do", [
				task({ id: "a", ancestors: [EPIC, FEATURE] }),
				task({ id: "b", ancestors: [SHIPPED] }),
				task({ id: "t", type: "TASK", ancestors: [EPIC, FEATURE] }),
			]),
			column("done", "Done", [task({ id: "c", ancestors: [EPIC, FEATURE] }), task({ id: "d", ancestors: [SHIPPED] })], "DONE"),
		];

		const rows = featureRollups(columns, kanbanColumnIsDone);

		expect(rows.map((row) => [row.feature.key, row.epic?.key ?? null, row.done, row.total])).toEqual([
			["FEATURE-2", "EPIC-1", 1, 2],
			["FEATURE-3", null, 1, 2],
		]);
	});

	it("leaves out a feature whose stories are all done", () => {
		const rows = featureRollups([column("done", "Done", [task({ id: "c", ancestors: [FEATURE] })], "DONE")], kanbanColumnIsDone);

		expect(rows).toEqual([]);
	});
});

describe("narrowing and hiding", () => {
	const filters = { search: undefined, priority: undefined, team: undefined, type: undefined };

	it("narrows to a feature and everything under it, and hides subtask cards when asked", () => {
		expect(matchesFilters(task({ id: "a", ancestors: [FEATURE] }), { ...filters, feature: FEATURE_ID })).toBe(true);
		expect(matchesFilters(task({ id: FEATURE_ID, type: "FEATURE" }), { ...filters, feature: FEATURE_ID })).toBe(true);
		expect(matchesFilters(task({ id: "b" }), { ...filters, feature: FEATURE_ID })).toBe(false);
		expect(matchesFilters(task({ id: "u", type: "SUBTASK" }), { ...filters, showSubtasks: false })).toBe(false);
		expect(matchesFilters(task({ id: "u", type: "SUBTASK" }), { ...filters, showSubtasks: true })).toBe(true);
	});

	it("finds an item by its key", () => {
		expect(matchesFilters(task({ id: "k", key: "STORY-142" }), { ...filters, search: "story-142" })).toBe(true);
	});
});
