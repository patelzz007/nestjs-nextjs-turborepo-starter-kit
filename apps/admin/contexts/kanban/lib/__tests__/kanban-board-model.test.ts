import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	allTasks,
	anchorBefore,
	arrangeBoardValue,
	groupIntoLanes,
	hasActiveFilters,
	laneOwnerOf,
	matchesFilters,
	NO_LANE_KEY,
	replaceLane,
	sortTasks,
	toBoardValue,
	type KanbanTaskFilters,
} from "../kanban-board-model";
import { ancestor, column, DOING_ID, FEATURE_ID, STORY_ID, task, TODO_ID } from "./kanban-fixtures";

const NO_FILTERS: KanbanTaskFilters = { search: undefined, priority: undefined, team: undefined, type: undefined };

describe("toBoardValue / allTasks", () => {
	it("keys the board by column id, in board order, and lists every task", () => {
		const columns = [column(TODO_ID, "To do", [task({ id: "a" })]), column(DOING_ID, "Doing", [task({ id: "b" })])];

		expect(Object.keys(toBoardValue(columns))).toEqual([TODO_ID, DOING_ID]);
		expect(allTasks(columns).map((item) => item.id)).toEqual(["a", "b"]);
	});
});

describe("matchesFilters", () => {
	it("matches a search in the title, the description or the owner's name, ignoring case", () => {
		const item = task({ id: "a", title: "Ship the board", description: "with comments", owner: { id: "o", name: "Carol White" } });

		expect(matchesFilters(item, { ...NO_FILTERS, search: "SHIP" })).toBe(true);
		expect(matchesFilters(item, { ...NO_FILTERS, search: "comments" })).toBe(true);
		expect(matchesFilters(item, { ...NO_FILTERS, search: "carol" })).toBe(true);
		expect(matchesFilters(item, { ...NO_FILTERS, search: "unrelated" })).toBe(false);
	});

	it("narrows by priority and team", () => {
		const item = task({ id: "a", priority: "HIGH", team: "QA" });

		expect(matchesFilters(item, { ...NO_FILTERS, priority: "HIGH", team: "QA" })).toBe(true);
		expect(matchesFilters(item, { ...NO_FILTERS, priority: "LOW" })).toBe(false);
		expect(matchesFilters(item, { ...NO_FILTERS, team: "DATA" })).toBe(false);
	});

	it("knows when any filter is set", () => {
		expect(hasActiveFilters(NO_FILTERS)).toBe(false);
		expect(hasActiveFilters({ ...NO_FILTERS, team: "QA" })).toBe(true);
	});
});

describe("sortTasks", () => {
	const items = [
		task({ id: "late", dueAt: epochMs(3_000), priority: "LOW" }),
		task({ id: "none", dueAt: null, priority: "HIGH" }),
		task({ id: "early", dueAt: epochMs(1_000), priority: "MEDIUM" }),
	];

	it("keeps the board's order, or orders by due date (undated last) or by priority (highest first)", () => {
		expect(sortTasks(items, "manual").map((item) => item.id)).toEqual(["late", "none", "early"]);
		expect(sortTasks(items, "due").map((item) => item.id)).toEqual(["early", "late", "none"]);
		expect(sortTasks(items, "priority").map((item) => item.id)).toEqual(["none", "early", "late"]);
	});

	it("never reorders the list it was given", () => {
		sortTasks(items, "due");
		expect(items.map((item) => item.id)).toEqual(["late", "none", "early"]);
	});
});

describe("arrangeBoardValue", () => {
	it("keeps every column (empty ones too) and filters and sorts each", () => {
		const value = toBoardValue([column(TODO_ID, "To do", [task({ id: "a", team: "QA" }), task({ id: "b" })]), column(DOING_ID, "Doing", [task({ id: "c" })])]);

		expect(arrangeBoardValue(value, { ...NO_FILTERS, team: "QA" }, "manual")).toEqual({ [TODO_ID]: [value[TODO_ID]?.at(0)], [DOING_ID]: [] });
	});
});

describe("anchorBefore", () => {
	it("names the item right before, or null at the top or when absent", () => {
		expect(anchorBefore(["a", "b", "c"], "c")).toBe("b");
		expect(anchorBefore(["a", "b", "c"], "a")).toBeNull();
		expect(anchorBefore(["a"], "missing")).toBeNull();
	});
});

describe("matchesFilters, beyond the card's own text", () => {
	it("finds a card by its assignee, a label or a parent's title, and narrows by type", () => {
		const item = task({
			id: "a",
			labels: ["payments"],
			assignee: { id: "p", name: "Eve Davis" },
			ancestors: [ancestor({ id: FEATURE_ID, type: "FEATURE", title: "Refunds" })],
		});

		expect(matchesFilters(item, { ...NO_FILTERS, search: "eve" })).toBe(true);
		expect(matchesFilters(item, { ...NO_FILTERS, search: "PAYMENTS" })).toBe(true);
		expect(matchesFilters(item, { ...NO_FILTERS, search: "refunds" })).toBe(true);
		expect(matchesFilters(item, { ...NO_FILTERS, type: "TASK" })).toBe(false);
	});

	it("sorts a task by its story's due date", () => {
		const story = ancestor({ id: STORY_ID, type: "STORY", dueAt: epochMs(2_000) });
		const items = [task({ id: "late", dueAt: epochMs(5_000) }), task({ id: "sub", type: "TASK", ancestors: [story] })];

		expect(sortTasks(items, "due").map((item) => item.id)).toEqual(["sub", "late"]);
	});
});

describe("swimlanes", () => {
	const feature = ancestor({ id: FEATURE_ID, type: "FEATURE", title: "Refunds" });
	const story = task({ id: "story", ancestors: [feature] });
	const sub = task({ id: "sub", type: "TASK", ancestors: [feature, ancestor({ id: STORY_ID, type: "STORY" })] });
	const loose = task({ id: "loose" });
	const value = { [TODO_ID]: [loose, story], [DOING_ID]: [sub] };

	it("files a story and its tasks under their feature, and an epic under itself", () => {
		expect(laneOwnerOf(sub, "FEATURE")?.title).toBe("Refunds");
		expect(laneOwnerOf(loose, "FEATURE")).toBeNull();
		expect(laneOwnerOf(task({ id: "e", type: "EPIC", title: "Payments" }), "EPIC")).toEqual({ id: "e", key: null, type: "EPIC", title: "Payments" });
	});

	it("keeps every column in every lane, the lane without a feature last", () => {
		const lanes = groupIntoLanes(value, "FEATURE");

		const [refunds, unplanned] = lanes;
		expect(lanes.map((lane) => lane.owner?.title ?? null)).toEqual(["Refunds", null]);
		expect(refunds?.value).toEqual({ [TODO_ID]: [story], [DOING_ID]: [sub] });
		expect(unplanned?.value).toEqual({ [TODO_ID]: [loose], [DOING_ID]: [] });
	});

	it("merges a drag inside one lane back into the whole board", () => {
		const merged = replaceLane(value, FEATURE_ID, { [TODO_ID]: [], [DOING_ID]: [story, sub] }, "FEATURE");

		expect(merged).toEqual({ [TODO_ID]: [loose], [DOING_ID]: [story, sub] });
	});

	it("groups a task under its story when the lanes are stories, the story leading its own lane", () => {
		const parentStory = task({ id: STORY_ID, title: "Refund a card" });
		const child = task({ id: "child", type: "TASK", ancestors: [ancestor({ id: STORY_ID, type: "STORY", title: "Refund a card" })] });
		const stray = task({ id: "stray", type: "TASK" });
		const lanes = groupIntoLanes({ [TODO_ID]: [parentStory], [DOING_ID]: [child, stray] }, "STORY");

		expect(lanes.map((lane) => lane.key)).toEqual([STORY_ID, NO_LANE_KEY]);
		expect(lanes.at(0)?.value).toEqual({ [TODO_ID]: [parentStory], [DOING_ID]: [child] });
	});
});
