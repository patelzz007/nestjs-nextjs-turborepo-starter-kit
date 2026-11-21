import { describe, expect, it } from "vitest";

import { resolveDataTableRowMove, type DataTableReorderRow } from "../reorder";

const FLAT: readonly DataTableReorderRow[] = [
	{ id: "a", parentId: null },
	{ id: "b", parentId: null },
	{ id: "c", parentId: null },
	{ id: "d", parentId: null },
];

/** Two branches, as an open tree shows them: each parent followed by its children. */
const TREE: readonly DataTableReorderRow[] = [
	{ id: "p1", parentId: null },
	{ id: "p1-a", parentId: "p1" },
	{ id: "p1-b", parentId: "p1" },
	{ id: "p1-c", parentId: "p1" },
	{ id: "p2", parentId: null },
	{ id: "p2-a", parentId: "p2" },
];

describe("resolveDataTableRowMove", () => {
	it("puts a row dragged down after the row it was dropped on", () => {
		expect(resolveDataTableRowMove(FLAT, "a", "c")).toEqual({ activeId: "a", overId: "c", parentId: null, orderedIds: ["b", "c", "a", "d"] });
	});

	it("puts a row dragged up before the row it was dropped on", () => {
		expect(resolveDataTableRowMove(FLAT, "d", "b")?.orderedIds).toEqual(["a", "d", "b", "c"]);
	});

	it("makes no move for a drop on the row itself or on a row that is not on screen", () => {
		expect(resolveDataTableRowMove(FLAT, "a", "a")).toBeNull();
		expect(resolveDataTableRowMove(FLAT, "a", "gone")).toBeNull();
		expect(resolveDataTableRowMove(FLAT, "gone", "a")).toBeNull();
	});

	it("reorders a tree row among its siblings, and names their parent", () => {
		expect(resolveDataTableRowMove(TREE, "p1-c", "p1-a")).toEqual({ activeId: "p1-c", overId: "p1-a", parentId: "p1", orderedIds: ["p1-c", "p1-a", "p1-b"] });
	});

	it("reorders top-level rows of a tree without their children in the order", () => {
		expect(resolveDataTableRowMove(TREE, "p1", "p2")?.orderedIds).toEqual(["p2", "p1"]);
	});

	it("makes no move across branches or levels", () => {
		expect(resolveDataTableRowMove(TREE, "p1-a", "p2-a")).toBeNull();
		expect(resolveDataTableRowMove(TREE, "p1-a", "p2")).toBeNull();
	});
});
